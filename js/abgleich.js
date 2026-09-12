// abgleich.js – Planungen zwischen Gerät und angebundenem Speicher abgleichen

/* Der Gerätespeicher bleibt die Wahrheit. Gearbeitet wird immer im
   localStorage und im Bildspeicher – am Bauort ist kein Netz, und genau dort
   wird die Planung gebraucht und fortgeschrieben. Was hier steht, legt sich
   darüber: es lädt hoch, wenn Netz da ist, und merkt sich dabei zu jeder Datei
   die Marke, unter der sie zuletzt gesehen wurde.

   Die Marke ist der ganze Schutz gegen den Fall, der sonst still Arbeit
   vernichtet: zwei Geräte, beide offline, dieselbe Planung. Geschrieben wird
   nur gegen die zuletzt gesehene Marke – „überschreibe nur, wenn dort noch
   genau das liegt, was ich kenne“. Stimmt sie nicht mehr, war ein zweites
   Gerät da, und dann wird nicht zusammengeführt, sondern gefragt. Ein
   automatisch verschmolzener Trassenverlauf wäre nicht nachvollziehbar, und
   eine falsch verschmolzene Planung ist schlimmer als zwei, zwischen denen
   jemand entscheidet.

   Der Umfang ist bewusst begrenzt: hochgeladen wird, was auf diesem Gerät
   liegt. Eine Planung, die nur am Speicher liegt, wird nicht still angelegt –
   sie steht unter „Planungen am Speicher“ und wird geöffnet, wenn der Nutzer
   es will. Und eine hier gelöschte Planung wird dort nicht gelöscht: was in
   einer fremden Cloud liegt, räumt ihr Eigentümer auf, nicht dieses Programm. */

import {
  store, ladeAlle, migrieren, projektAblegen, id as neueKennung
} from './state.js';
import { holen as bildHolen, ablegen as bildAblegen } from './bildspeicher.js';
import {
  PLANUNGSDATEI, BILDORDNER, CloudFehler, KonfliktFehler,
  rueckseite, verbindungLaden, verbindung, ordnerName, kennungAusOrdner, pfad,
  ablageLesen, ablageSchreiben, ablageLoeschen
} from './cloud.js';

/* Wartezeit zwischen der letzten Änderung und dem Hochladen. `speichern()` im
   Store läuft nach 400 ms – jeder Klick ein Upload ginge nicht, über Mobilfunk
   am Bauort schon gar nicht. Zwölf Sekunden sind lang genug, dass ein
   zusammenhängender Arbeitsgang (eine Trasse zeichnen, ein Formular ausfüllen)
   in einer Übertragung landet, und kurz genug, dass niemand das Gerät zuklappt,
   bevor die Arbeit draußen ist. */
const RUHE = 12000;

const zustandSchluessel = pid => 'abgleich:' + pid;

// ---------------------------------------------------------------- Zustand

/* „gesichert / ausstehend / Fehler“ – ohne diese Anzeige glaubt der Nutzer,
   es sei gesichert, und es ist es nicht. Sie ist deshalb kein Beiwerk,
   sondern der Teil, ohne den die Anbindung nicht ausgeliefert werden darf. */

const HORCHER = new Set();

let lage = {
  stand: 'aus',        // aus | bereit | laeuft | ausstehend | fehler | konflikt | anmeldung
  meldung: '',
  seit: null,          // Zeitpunkt der letzten vollständigen Übertragung
  konflikt: null       // { pid, name, meine, fremde, fremdesProjekt }
};

export const abgleichLage = () => lage;

export function aufAbgleich(fn) {
  HORCHER.add(fn);
  return () => HORCHER.delete(fn);
}

function setzen(aenderung) {
  lage = { ...lage, ...aenderung };
  for (const fn of HORCHER) fn(lage);
}

// ---------------------------------------------------------------- Anlauf

let laeuft = null;        // der laufende Durchgang, damit nie zwei zugleich schreiben
let nochmal = false;      // während eines Durchgangs kam eine Änderung
let ruheTimer = null;

/**
 * Den Abgleich in Betrieb nehmen. Tut nichts, solange keine Verbindung
 * eingerichtet ist – und lädt dann auch keine Rückseite nach.
 */
export async function abgleichStarten() {
  const v = await verbindungLaden();
  if (!v) { setzen({ stand: 'aus', meldung: '' }); return; }
  setzen({ stand: 'bereit', meldung: '', seit: await letzterStand() });

  store.on((p, grund) => {
    if (grund === 'gespeichert' || grund === 'dateisicherung') return;
    vormerken();
  });

  /* Wer das Gerät am Bauort zuklappt und in der Unterkunft wieder aufmacht,
     soll nicht erst einen Knopf suchen müssen. Beide Ereignisse zusammen
     decken den Fall ab: das Netz kommt wieder, oder das Fenster kommt wieder
     nach vorn. */
  window.addEventListener('online', () => jetztAbgleichen().catch(() => {}));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && lage.stand === 'ausstehend') {
      jetztAbgleichen().catch(() => {});
    }
  });

  /* Der erste Durchgang wartet einen Augenblick: der Kartenaufbau und das
     Nachladen der ersten Kacheln sind wichtiger als eine Übertragung, die
     niemand gerade abwartet. */
  setTimeout(() => { jetztAbgleichen().catch(() => {}); }, 3000);
}

/** Eine Änderung vormerken – übertragen wird erst, wenn Ruhe eingekehrt ist */
export function vormerken() {
  if (lage.stand === 'aus' || lage.stand === 'konflikt') return;
  if (lage.stand !== 'laeuft') setzen({ stand: 'ausstehend', meldung: '' });
  clearTimeout(ruheTimer);
  ruheTimer = setTimeout(() => { jetztAbgleichen().catch(() => {}); }, RUHE);
}

/** Jetzt abgleichen – aus dem Knopf, beim Start und wenn das Netz zurückkommt */
export function jetztAbgleichen() {
  if (laeuft) { nochmal = true; return laeuft; }
  clearTimeout(ruheTimer);
  laeuft = durchgang().finally(() => {
    laeuft = null;
    if (!nochmal) return;
    nochmal = false;
    /* Was während des Durchgangs dazukam, geht mit dem nächsten hinaus – nicht
       sofort hinterher: sonst hinge das Gerät bei zügiger Arbeit dauerhaft am
       Netz statt an der Karte. */
    vormerken();
  });
  return laeuft;
}

async function durchgang() {
  if (!verbindung()) { setzen({ stand: 'aus', meldung: '' }); return; }
  if (lage.konflikt) { setzen({ stand: 'konflikt' }); return; }
  setzen({ stand: 'laeuft', meldung: '' });
  try {
    const rs = await rueckseite();
    if (!rs) { setzen({ stand: 'aus', meldung: '' }); return; }

    /* Die geöffnete Planung zuerst: an ihr wird gerade gearbeitet, und sie ist
       die einzige, deren Verlust gerade weh täte. Die übrigen folgen – sonst
       bliebe eine Planung, die gestern geschlossen wurde, für immer hier. */
    /* Erst den Browserspeicher auf Stand bringen. `speichernVerzoegert()`
       schreibt 400 ms nach der letzten Änderung – wer in dieser Lücke abgleicht,
       liest über `ladeAlle()` einen Stand der offenen Planung, der schon
       überholt ist, und schriebe ihn beim Danebenlegen einer zweiten Fassung
       wieder fest. */
    store.speichern();

    const verzeichnis = {};
    const offen = store.projekt;
    await planungAbgleichen(rs, offen, verzeichnis);
    if (lage.konflikt) return;

    for (const p of Object.values(ladeAlle())) {
      if (p.id === offen.id) continue;
      await planungAbgleichen(rs, migrieren(p), verzeichnis);
      if (lage.konflikt) return;
    }

    const jetzt = new Date().toISOString();
    await ablageSchreiben('abgleich-stand', jetzt);
    setzen({ stand: 'bereit', meldung: '', seit: jetzt });
  } catch (e) {
    if (e instanceof CloudFehler && e.erneuern) {
      setzen({ stand: 'anmeldung', meldung: e.message });
      return;
    }
    /* Ein zweites Gerät hat zwischen dem Nachsehen und dem Schreiben zugeschlagen.
       Das ist kein Ausfall: der nächste Durchgang liest die neue Marke und stellt
       die beiden Stände ordentlich nebeneinander. Als roter Fehler gemeldet
       schickte es den Nutzer auf die Suche nach einer Störung, die es nicht gibt. */
    if (e instanceof KonfliktFehler) {
      setzen({ stand: 'ausstehend', meldung: 'Am Speicher kam etwas dazwischen – gleich noch einmal.' });
      vormerken();
      return;
    }
    /* Ausstehend und nicht „Fehler“, wenn schlicht kein Netz da ist: am
       Bauort ist das der Normalfall und keine Störung, über die jemand
       nachdenken soll. */
    const ohneNetz = !navigator.onLine;
    setzen({
      stand: ohneNetz ? 'ausstehend' : 'fehler',
      meldung: ohneNetz ? 'Kein Netz – die Übertragung holt das nach.' : e.message
    });
  }
}

// ---------------------------------------------------------------- Eine Planung

async function planungAbgleichen(rs, projekt, verzeichnis) {
  const z = (await ablageLesen(zustandSchluessel(projekt.id))) || {
    ordner: null, planungMarke: null, bilder: {}, lokalGeaendert: null
  };
  const ordner = await ordnerFinden(rs, projekt, z, verzeichnis);
  const dateiPfad = pfad(ordner, PLANUNGSDATEI);

  const fern = await rs.lesen(dateiPfad);
  const fremdeMarke = fern ? fern.marke : null;
  const lokalGeaendert = projekt.geaendert || '';

  /* Der allererste Abgleich dieser Planung: hier ist keine Marke bekannt, an
     der sich ablesen ließe, wer von wem abstammt. Liegt dort schon etwas,
     wird deshalb nicht angenommen, es sei der neuere Stand – der Inhalt
     entscheidet. Ist er derselbe, ist nichts zu tun außer die Marken zu
     merken; ist er ein anderer, stehen sich zwei Stände gegenüber, die
     nichts voneinander wissen, und das ist genau der Fall, über den der
     Nutzer entscheidet. Still zu übernehmen wäre hier der Griff, mit dem
     eine Anbindung Arbeit vernichtet. */
  if (z.lokalGeaendert === null) {
    if (!fern) return hochladen(rs, projekt, ordner, z, null);
    if (await inhaltGleich(fern, projekt)) {
      await ablageSchreiben(zustandSchluessel(projekt.id), {
        ordner,
        planungMarke: fremdeMarke,
        bilder: Object.fromEntries((projekt.bilder || []).map(b => [b.id, SCHON_OBEN])),
        lokalGeaendert,
        zuletzt: new Date().toISOString()
      });
      return;
    }
    return konfliktStellen(projekt, ordner, fern, z);
  }

  /* Danach entscheidet die Marke:
     – Sie ist die zuletzt gesehene: niemand war dort, das Gerät darf schreiben.
     – Sie ist eine andere, aber hier hat sich seit dem letzten Abgleich nichts
       geändert: der andere Stand ist der neuere, er wird übernommen.
     – Sie ist eine andere und hier ist auch etwas geschehen: Konflikt. */
  if (fremdeMarke !== z.planungMarke) {
    if (lokalGeaendert === z.lokalGeaendert) {
      /* Dort gelöscht, hier unverändert: die Planung bleibt auf dem Gerät
         stehen und wird beim nächsten Durchgang neu angelegt. Ob das richtig
         ist oder ob gefragt werden sollte, ist in CLOUD.md als offener Punkt
         vermerkt – der stille Wiederaufbau ist der Weg, der nichts verliert. */
      if (!fern) {
        await ablageSchreiben(zustandSchluessel(projekt.id),
          { ...z, ordner, planungMarke: null });
        return;
      }
      return uebernehmen(rs, projekt, ordner, fern, z);
    }
    if (fern) {
      /* Bevor zwei Geräte angenommen werden: Trägt der Stand am Speicher genau
         den Änderungszeitpunkt, den dieses Gerät zuletzt hinaufgeschrieben hat,
         ist es die eigene Datei – nur unter einer neuen Marke. Das ist der
         Normalfall, wenn jemand seinen Ordner in der Cloud aufräumt: Die Planung
         wird an ihrer Kennung wiedergefunden, aber Verschieben und Umbenennen
         geben der Datei bei den meisten Anbietern eine neue Marke. Ein Konflikt
         wäre hier eine Rückfrage ohne zweites Gerät. */
      const dort = await gelesen(fern);
      if (dort && (dort.geaendert || '') === z.lokalGeaendert) {
        return hochladen(rs, projekt, ordner, { ...z, planungMarke: fremdeMarke }, fremdeMarke);
      }
      return konfliktStellen(projekt, ordner, fern, z);
    }
  }

  if (lokalGeaendert === z.lokalGeaendert && fremdeMarke === z.planungMarke) {
    await bilderAbgleichen(rs, projekt, ordner, z);
    return;
  }

  await hochladen(rs, projekt, ordner, z, fremdeMarke);
}

/** Die Planungsdatei vom Speicher als Objekt; `null`, wenn sie unlesbar ist */
async function gelesen(fern) {
  try { return JSON.parse(await fern.blob.text()); } catch (e) { return null; }
}

/* Beim Erstabgleich wird verglichen, was verglichen werden kann: der Inhalt
   ohne den Zeitstempel. `geaendert` läuft schon auseinander, wenn eine Planung
   auf zwei Geräten nur geöffnet wurde – daran ließe sich kein Unterschied
   festmachen, der einen Konflikt rechtfertigt. */
async function inhaltGleich(fern, projekt) {
  const dort = await gelesen(fern);
  return !!dort && kern(dort) === kern(projekt);
}

function kern(p) {
  const { geaendert, erstellt, version, ...rest } = p || {};
  return JSON.stringify(rest);
}

/* Der Ordnername ist Beschriftung, nicht Schlüssel: wer seine Cloud aufräumt
   und den Ordner umbenennt, soll seine Planung nicht verlieren. Gesucht wird
   deshalb zuerst an der gemerkten Stelle, dann an der Kennung im Ordnernamen –
   und erst, wenn beides nichts hergibt, in den Planungsdateien selbst. */
async function ordnerFinden(rs, projekt, z, verzeichnis) {
  const gewuenscht = ordnerName(projekt);
  if (z.ordner) {
    /* Steht dort noch eine Planungsdatei, bleibt es dabei. Ein umbenannter
       Ordner fällt hier durch und wird unten wiedergefunden. */
    const da = await rs.lesen(pfad(z.ordner, PLANUNGSDATEI));
    if (da) return z.ordner;
  }

  /* Die Wurzelliste wird je Durchgang einmal geholt: bei zwanzig Planungen
     wären es sonst zwanzig Abrufe für dieselbe Auskunft. */
  if (!verzeichnis.liste) {
    try { verzeichnis.liste = await rs.auflisten(''); } catch (e) { verzeichnis.liste = []; }
  }
  const ordner = verzeichnis.liste.filter(e => e.ordner);

  const amNamen = ordner.find(e => kennungAusOrdner(e.name) === projekt.id);
  if (amNamen) return amNamen.name;

  /* Zuletzt der teure Weg: in die Dateien sehen. Er greift für Ordner, deren
     Name die Kennung nicht mehr trägt – etwa weil ein Sync-Programm beim
     Namenskonflikt „ (2)“ angehängt hat. */
  for (const e of ordner) {
    if (kennungAusOrdner(e.name)) continue;        // trägt eine andere Kennung
    try {
      const datei = await rs.lesen(pfad(e.name, PLANUNGSDATEI));
      if (!datei) continue;
      const inhalt = JSON.parse(await datei.blob.text());
      if (inhalt && inhalt.id === projekt.id) return e.name;
    } catch (x) { /* keine lesbare Planung – dann eben nicht */ }
  }
  return gewuenscht;
}

// ---------------------------------------------------------------- Hochladen

async function hochladen(rs, projekt, ordner, z, fremdeMarke) {
  /* Erst die Bilder, dann die Planung. Andersherum stünde am Speicher für
     einen Augenblick eine Planung, die Lichtbilder nennt, die noch nicht da
     sind – und genau in diesem Augenblick lädt sie das zweite Gerät. Umgekehrt
     liegt höchstens ein Bild dort, das noch keine Planung nennt; das kostet
     Platz und sonst nichts. */
  const bilderStand = await bilderAbgleichen(rs, projekt, ordner, z, true);

  const blob = new Blob([JSON.stringify(projekt, null, 2)], { type: 'application/json' });
  const erwartet = z.planungMarke !== null ? z.planungMarke : (fremdeMarke === null ? null : undefined);
  const marke = await rs.schreiben(pfad(ordner, PLANUNGSDATEI), blob, erwartet);

  await ablageSchreiben(zustandSchluessel(projekt.id), {
    ordner,
    planungMarke: marke,
    bilder: bilderStand,
    lokalGeaendert: projekt.geaendert || '',
    zuletzt: new Date().toISOString()
  });
}

/**
 * Die Lichtbilder einer Planung nachziehen.
 * @returns {Promise<object>} der neue Stand der Bildmarken
 */
async function bilderAbgleichen(rs, projekt, ordner, z, nurHoch = false) {
  const stand = { ...(z.bilder || {}) };
  const vorhanden = new Set((projekt.bilder || []).map(b => b.id));

  for (const b of projekt.bilder || []) {
    if (stand[b.id]) continue;                     // liegt schon oben
    const eintrag = await bildHolen(b.id);
    /* Ein Eintrag ohne Bilddaten – etwa aus einer Datei, deren Bilder der
       Speicher nicht angenommen hat – reist ohne Bild mit. Ort und
       Beschriftung sind das, was zählt, und beide stehen in der Planung. */
    if (!eintrag || !eintrag.bild) continue;
    stand[b.id] = await rs.schreiben(bildPfad(ordner, b.id), eintrag.bild, undefined);
  }

  /* Was keine Planung mehr nennt, wird auch oben weggeräumt: die Lichtbilder
     sind der Posten, der einen Ordner schwer macht, und ein gelöschtes Bild,
     das dort liegenbleibt, käme beim nächsten Gerät wieder mit. */
  for (const kennung of Object.keys(stand)) {
    if (vorhanden.has(kennung)) continue;
    try { await rs.loeschen(bildPfad(ordner, kennung)); } catch (e) { /* nächstes Mal */ }
    delete stand[kennung];
  }

  if (!nurHoch) {
    await ablageSchreiben(zustandSchluessel(projekt.id), { ...z, ordner, bilder: stand });
  }
  return stand;
}

const bildPfad = (ordner, kennung) => pfad(ordner, BILDORDNER, kennung + '.jpg');

/* Die Bildmarken sind kein Vergleichswert wie die der Planungsdatei, sondern
   ein Vermerk: „liegt oben“. Ein Lichtbild ändert sich nicht mehr, nachdem es
   aufgenommen wurde – es wird angelegt oder gelöscht, nie überschrieben.
   Für ein Bild, das von oben kam, ist keine Marke bekannt, und es braucht auch
   keine; dieser Wert hält die Stelle. */
const SCHON_OBEN = 'liegt-oben';

// ---------------------------------------------------------------- Übernehmen

/** Den Stand vom Speicher als den geltenden übernehmen */
async function uebernehmen(rs, projekt, ordner, fern, z) {
  const fremd = migrieren(JSON.parse(await fern.blob.text()));
  fremd.id = projekt.id;                            // die Kennung bleibt die der Planung

  await bilderHolen(rs, ordner, fremd);

  const stand = {
    ordner,
    planungMarke: fern.marke,
    bilder: Object.fromEntries(
      (fremd.bilder || []).map(b => [b.id, (z.bilder || {})[b.id] || SCHON_OBEN])),
    lokalGeaendert: fremd.geaendert || '',
    zuletzt: new Date().toISOString()
  };

  if (store.projekt && store.projekt.id === projekt.id) {
    store.uebernehmen(fremd);
  } else {
    /* Eine Planung, die gerade nicht offen ist, wird still im Browserspeicher
       ersetzt. Sie über den Store zu laden hieße, dem Nutzer mitten in der
       Arbeit die Karte umzuschalten. */
    projektAblegen(fremd);
  }
  await ablageSchreiben(zustandSchluessel(projekt.id), stand);
}

/** Fehlende Lichtbilder aus dem Speicher in den Bildspeicher des Geräts holen */
async function bilderHolen(rs, ordner, projekt) {
  const { vorschauErzeugen } = await import('./bilder.js');
  for (const b of projekt.bilder || []) {
    if (await bildHolen(b.id)) continue;            // liegt schon hier
    let datei = null;
    try { datei = await rs.lesen(bildPfad(ordner, b.id)); } catch (e) { datei = null; }
    if (!datei) continue;
    try {
      /* Das Vorschaubild wird hier neu gerechnet und nicht mitübertragen: es
         ist aus dem großen abzuleiten, und ein zweiter Satz kleiner Dateien
         verdoppelte die Zahl der Dateien in einem Ordner, den auch Menschen
         ansehen. */
      const mini = await vorschauErzeugen(datei.blob);
      await bildAblegen(b.id, datei.blob, mini || datei.blob);
    } catch (e) { /* dann steht der Eintrag ohne Bilddaten – Ort und Text bleiben */ }
  }
}

// ---------------------------------------------------------------- Konflikt

/* Nicht zusammenführen, sondern danebenlegen und fragen. Der fremde Stand wird
   dafür schon hier gelesen – der Dialog soll beide Fassungen mit Datum und
   Umfang nebeneinanderstellen können, und nicht erst beim Klick merken, dass
   der Speicher inzwischen weg ist. */

async function konfliktStellen(projekt, ordner, fern, z) {
  let fremd;
  try { fremd = migrieren(JSON.parse(await fern.blob.text())); }
  catch (e) {
    throw new CloudFehler('Am Speicher liegt eine Planungsdatei, die sich nicht lesen lässt.');
  }
  setzen({
    stand: 'konflikt',
    meldung: `„${projekt.name}“ wurde auch auf einem anderen Gerät geändert.`,
    konflikt: {
      pid: projekt.id,
      ordner,
      name: projekt.name,
      marke: fern.marke,
      zustand: z,
      meine: umfang(projekt),
      fremde: umfang(fremd),
      fremdesProjekt: fremd
    }
  });
}

const umfang = p => ({
  name: p.name,
  geaendert: p.geaendert || '',
  strecken: (p.strecken || []).length,
  zeichen: (p.zeichen || []).length,
  flaechen: (p.flaechen || []).length,
  relaisstellen: (p.relaisstellen || []).length,
  bilder: (p.bilder || []).length,
  punkte: (p.strecken || []).reduce((n, s) => n + (s.punkte || []).length, 0)
});

/**
 * Den Konflikt entscheiden.
 *
 * `meine`   – der Stand dieses Geräts gilt und wird hinaufgeschrieben.
 * `fremde`  – der Stand vom Speicher gilt; der eigene wird als zweite Planung
 *             danebengelegt, damit nichts verschwindet.
 * `beide`   – der fremde Stand kommt als zweite Planung dazu, die Bindung an
 *             den Speicher bleibt beim eigenen.
 */
export async function konfliktEntscheiden(wahl) {
  const k = lage.konflikt;
  if (!k) return;
  const rs = await rueckseite();
  if (!rs) throw new CloudFehler('Es ist keine Verbindung eingerichtet.');
  setzen({ stand: 'laeuft', meldung: 'Konflikt wird aufgelöst …' });

  try {
    const roh = k.pid === store.projekt.id ? store.projekt : ladeAlle()[k.pid];
    if (!roh) throw new CloudFehler('Die Planung liegt auf diesem Gerät nicht mehr vor.');
    const meins = k.pid === store.projekt.id ? roh : migrieren(roh);

    if (wahl === 'fremde') {
      /* Der eigene Stand wird als eigenständige Planung danebengelegt, bevor
         der fremde ihn ersetzt. Ohne diesen Schritt wäre die Entscheidung
         „die andere gilt“ unumkehrbar, und das ist sie nicht: der Nutzer hat
         zwei Stände vor sich, keinen Fehler. */
      danebenlegen(meins, 'dieses Gerät');
      await uebernehmen(rs, meins, k.ordner,
        { blob: new Blob([JSON.stringify(k.fremdesProjekt)]), marke: k.marke },
        k.zustand);
    } else if (wahl === 'beide') {
      danebenlegen(k.fremdesProjekt, 'anderes Gerät');
      await hochladenGegen(rs, meins, k);
    } else {
      await hochladenGegen(rs, meins, k);
    }

    setzen({ stand: 'bereit', meldung: '', konflikt: null, seit: new Date().toISOString() });
  } catch (e) {
    setzen({ stand: 'fehler', meldung: e.message, konflikt: null });
    throw e;
  }
}

/* Gegen die Marke, die der Konflikt gesehen hat: liegt inzwischen ein dritter
   Stand dort – ein weiteres Gerät, während der Dialog offen stand –, schlägt
   das Schreiben erneut fehl statt ihn zu überfahren. */
async function hochladenGegen(rs, projekt, k) {
  const z = { ...k.zustand, ordner: k.ordner, planungMarke: k.marke };
  await hochladen(rs, projekt, k.ordner, z, k.marke);
}

/** Eine Planung als eigenständige Kopie in den Browserspeicher legen */
function danebenlegen(projekt, herkunft) {
  const kopie = migrieren(projekt);
  kopie.id = neueKennung();
  const stempel = new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  kopie.name = `${projekt.name} (${herkunft}, ${stempel})`;
  projektAblegen(kopie);
  return kopie;
}

/** Einen anstehenden Konflikt fallen lassen, ohne zu entscheiden */
export function konfliktVertagen() {
  setzen({ stand: 'ausstehend', meldung: 'Der Konflikt ist noch offen.', konflikt: null });
}

// ---------------------------------------------------------------- Speicherliste

/**
 * Was am Speicher liegt – für den Dialog „Planungen am Speicher“.
 * @returns {Promise<Array<{ordner: string, name: string, pid: string, geaendert: string,
 *                          hier: boolean, umfang: object}>>}
 */
export async function planungenAmSpeicher() {
  const rs = await rueckseite();
  if (!rs) return [];
  const hier = ladeAlle();
  const raus = [];
  for (const e of await rs.auflisten('')) {
    if (!e.ordner) continue;
    let inhalt = null;
    try {
      const datei = await rs.lesen(pfad(e.name, PLANUNGSDATEI));
      if (!datei) continue;
      inhalt = migrieren(JSON.parse(await datei.blob.text()));
    } catch (x) { continue; }
    raus.push({
      ordner: e.name,
      name: inhalt.name || e.name,
      pid: inhalt.id,
      geaendert: inhalt.geaendert || '',
      hier: !!hier[inhalt.id],
      umfang: umfang(inhalt)
    });
  }
  return raus.sort((a, b) => (b.geaendert || '').localeCompare(a.geaendert || ''));
}

/**
 * Eine Planung vom Speicher auf dieses Gerät holen und öffnen. Liegt sie hier
 * schon, wird sie nicht angerührt – dafür ist der Abgleich zuständig, und der
 * kennt den Konfliktfall.
 */
export async function vomSpeicherHolen(ordner) {
  const rs = await rueckseite();
  if (!rs) throw new CloudFehler('Es ist keine Verbindung eingerichtet.');
  setzen({ stand: 'laeuft', meldung: 'Planung wird geholt …' });
  try {
    const datei = await rs.lesen(pfad(ordner, PLANUNGSDATEI));
    if (!datei) throw new CloudFehler('In diesem Ordner liegt keine Planung mehr.');
    const projekt = migrieren(JSON.parse(await datei.blob.text()));
    await bilderHolen(rs, ordner, projekt);
    store.uebernehmen(projekt);
    await ablageSchreiben(zustandSchluessel(projekt.id), {
      ordner,
      planungMarke: datei.marke,
      bilder: Object.fromEntries((projekt.bilder || []).map(b => [b.id, SCHON_OBEN])),
      lokalGeaendert: projekt.geaendert || '',
      zuletzt: new Date().toISOString()
    });
    setzen({ stand: 'bereit', meldung: '', seit: new Date().toISOString() });
    return projekt;
  } catch (e) {
    setzen({ stand: 'fehler', meldung: e.message });
    throw e;
  }
}

// ---------------------------------------------------------------- Aufräumen

/** Beim Trennen der Verbindung: alle gemerkten Marken fallen lassen */
export async function abgleichVergessen() {
  for (const p of Object.values(ladeAlle())) await ablageLoeschen(zustandSchluessel(p.id));
  await ablageLoeschen('abgleich-stand');
  clearTimeout(ruheTimer);
  setzen({ stand: 'aus', meldung: '', seit: null, konflikt: null });
}

/** Wann zuletzt vollständig übertragen wurde – überlebt das Neuladen der Seite */
const letzterStand = () => ablageLesen('abgleich-stand');

/** Ist diese Planung an den Speicher gebunden? Für den Projektreiter. */
export async function bindungVon(pid) {
  return await ablageLesen(zustandSchluessel(pid));
}
