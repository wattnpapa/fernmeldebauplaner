// baumeldung.js – Der Rückweg vom Bauort: eine Meldung einordnen und einspielen

/* Hin geht die Planung, zurück geht eine Baumeldung. Sie trägt nur die
   `bau`-Blöcke der Strecken, an denen ein Trupp gearbeitet hat – gepackt wird
   sie in `teilen.js`, eingeordnet und eingespielt wird sie hier.

   Warum das ein eigenes Modul ist und nicht in `baudoku.js` steht: dort geht es
   um die EIGENE Baustelle, hier um eine FREMDE Meldung. Alles in dieser Datei
   rechnet damit, dass die andere Seite etwas anderes gesehen hat als wir – eine
   andere Strecke gleichen Namens, einen inzwischen eingefügten Punkt, einen
   Bauabschnitt, an dem schon ein anderer Trupp gemeldet hat. Diese Vorsicht
   gehört nicht in die Fachlogik des eigenen Bauens.

   Verschmolzen wird NICHT. Das ist dieselbe Festlegung wie in `CLOUD.md`: eine
   falsch verschmolzene Trasse ist schlimmer als zwei, zwischen denen jemand
   entscheidet. Eine Baumeldung ERSETZT genau die Bauabschnitte, die sie nennt,
   und rührt die Soll-Geometrie nicht an. Wo zwei Meldungen denselben
   Bauabschnitt betreffen, wird gefragt. */

import { bauNormalisieren, BAUSTAENDE, id as neueKennung } from './state.js';
import {
  bauabschnitte, istPunkte, baukennzahlen, abstandZurLinie, ABSEITS_SCHWELLE
} from './baudoku.js';
import { bauAbdruck } from './teilen.js';
import { materialById } from './vorschrift.js';

/* Die Reihenfolge der Baustände, um sie vergleichen zu können. */
const STAND_RANG = new Map(BAUSTAENDE.map((b, i) => [b.id, i]));
const rang = id => STAND_RANG.get(id) ?? 0;
const nachRang = r => BAUSTAENDE[Math.max(0, Math.min(BAUSTAENDE.length - 1, r))].id;

/**
 * Der Baustand der STRECKE nach einer Meldung über einen Teil von ihr.
 *
 * Zwei Fehler liegen hier nahe, und beide wären schlimm. Den gemeldeten Stand
 * einfach zu übernehmen hieße: Trupp Nord meldet „gebaut“ für seine Hälfte, und
 * die ganze Strecke gilt als gebaut, während Süd noch im Gelände steht.
 * Umgekehrt immer den niedrigeren zu nehmen hieße: die Strecke bliebe für immer
 * auf „noch nicht begonnen“, denn dort fängt sie an – keine Meldung könnte sie
 * je bewegen.
 *
 * Deshalb: eine Teilmeldung hebt den Stand, senkt ihn nie, und hebt ihn
 * höchstens auf „im Bau“. Dass die Strecke fertig ist, entscheidet der Planer –
 * er ist der Einzige, der alle Abschnitte vor sich hat.
 */
function standNachTeilmeldung(bisher, gemeldet) {
  const gedeckelt = Math.min(rang(gemeldet), rang('laeuft'));
  return nachRang(Math.max(rang(bisher), gedeckelt));
}

// ------------------------------------------------------------- Einordnen

/**
 * Welche Strecke der Planung ist gemeint?
 *
 * Über den Namen, denn mehr teilen die beiden Seiten nicht: `verschlanken()`
 * wirft die Streckenkennungen weg, der Empfänger vergibt neue. Gefunden wird
 * nur, was EINDEUTIG ist – trägt die Planung zwei Strecken desselben Namens,
 * bleibt der Vorschlag leer und der Planer entscheidet. Ein Zufallstreffer
 * legte die Aufnahme eines Trupps auf die falsche Trasse.
 */
export function vorschlag(projekt, name) {
  const treffer = (projekt.strecken || []).filter(s => s.name === name);
  return treffer.length === 1 ? treffer[0] : null;
}

/** Wer gemeldet hat – aus den Bauabschnitten der Meldung, für die Vorschau */
export function truppText(meldung) {
  const namen = new Set();
  /* Der Absender, den der Trupp am Gerät eingetragen hat, geht vor: er steht
     auch dann da, wenn die Strecke ohne Bauabschnitt gebaut wurde – der Fall,
     in dem der Planer vorher niemanden genannt bekam. */
  if (meldung.von) namen.add(String(meldung.von));
  for (const m of meldung.strecken || []) {
    for (const a of (m.bau && m.bau.abschnitte) || []) {
      /* „Trupp 3 · Krause, Trupp 3“ stand im Audit da: der Abschnitt nennt
         den Trupp, den der Absender schon enthält. */
      if (a && a.trupp && !String(meldung.von || '').includes(a.trupp)) namen.add(a.trupp);
    }
  }
  return [...namen].join(', ');
}

/**
 * Was das Einspielen bedeuten würde – die Grundlage der Vorschau.
 *
 * Gerechnet wird gegen eine Zuordnung, die der Planer noch ändern kann:
 * `zuordnung[i]` ist die Kennung der Zielstrecke für die i-te Meldung, oder
 * `null` für „nicht einspielen“. Es wird nichts geschrieben.
 */
export function befund(projekt, meldung, zuordnung) {
  return (meldung.strecken || []).map((m, i) => {
    const zielId = zuordnung ? zuordnung[i] : undefined;
    const ziel = zielId === null ? null
      : (projekt.strecken || []).find(s => s.id === zielId) || vorschlag(projekt, m.name);
    /* Der Name wird hier genauso hergestellt, wie `bauNormalisieren()` ihn
       später herstellt – sonst sähe die Vorschau leere Namen, meldete nie eine
       Kollision und zeigte „0 weichen“, während das Einspielen sehr wohl
       etwas ersetzte. */
    const abschnitteDerMeldung = ((m.bau && m.bau.abschnitte) || [])
      .map((a, n) => String((a && a.name) || `Bauabschnitt ${n + 1}`));
    const ganzeStrecke = abschnitteDerMeldung.length === 0;
    const unzugeordnet = m.bau ? zaehleOhneAbschnitt(m.bau) : 0;

    /* Ein Bauabschnitt gleichen Namens, an dem beim Planer schon etwas hängt,
       ist der Kollisionsfall: zwei Trupps haben denselben Abschnitt gemeldet,
       oder derselbe Trupp zweimal. Entschieden wird das nicht hier. */
    const vorhandene = ziel ? bauabschnitte(ziel) : [];
    const kollision = ziel ? vorhandene.filter(a =>
      abschnitteDerMeldung.includes(a.name) && traegtEintraege(ziel, a.id)) : [];

    /* Die Stellen der Verweise stimmen nur, solange der Plan derselbe ist.
       Weicht die Zahl der geplanten Punkte ab, hat jemand eingefügt oder
       gelöscht – dann zeigen Bestätigungen möglicherweise auf den falschen
       Punkt, und wir lösen sie lieber ganz. */
    const planAbweicht = !!ziel && Number.isInteger(m.sollPunkte) &&
      m.sollPunkte !== (ziel.punkte || []).length;

    /* Der jüngste Eintrag auf beiden Seiten. Im Messenger stehen mehrere Links
       untereinander, und wer den falschen antippt, spielt einen älteren Stand
       über einen neueren; ein zweimal geöffneter Link kam als gewöhnliche
       Meldung daher. Beides wird jetzt benannt – entschieden wird weiter vom
       Planer. */
    const juengster = bau => {
      let z = '';
      for (const x of [...((bau && bau.punkte) || []), ...((bau && bau.meldungen) || [])]) {
        if (x && typeof x.zeit === 'string' && x.zeit > z) z = x.zeit;
      }
      return z;
    };
    const standMeldung = juengster(m.bau);
    const standHier = ziel ? juengster(ziel.bau) : '';

    /* Ob das Einspielen etwas ändert, wird ausprobiert und nicht an den
       Zeitstempeln abgelesen: an einer Abschrift der Zielstrecke, und
       verglichen wird, was danach hinausginge. Vorher galt eine Meldung als
       „schon eingespielt“, sobald ihr jüngster Eintrag mit dem hiesigen
       übereinstimmte – im Audit genau die BERICHTIGTE Meldung, in der der
       Trupp 31.200 m auf 3.120 m korrigiert hatte. „Verwerfen genügt“ stand
       darüber, und der Zahlendreher blieb in der Dokumentation. */
    const probe = ziel ? probeEinspielen(ziel, m) : null;
    const schonDa = !!(probe && bauAbdruck(ziel) && bauAbdruck(probe) === bauAbdruck(ziel));
    const aelter = !schonDa && !!(standMeldung && standHier && standMeldung < standHier);
    /* Was danach nicht mehr dasteht – gezählt über den Inhalt der Einträge und
       nicht über ihre Zahl. „Dabei weichen 3 Punkte“ stand auch dann da, wenn
       dieselben drei Punkte gleich wieder hereinkamen, und wer das einmal
       gesehen hat, liest es beim nächsten Mal nicht mehr. */
    const verloren = probe ? verlust(ziel.bau, probe.bau)
      : { punkte: 0, meldungen: 0, material: 0, punkteGeaendert: 0, meldungenGeaendert: 0 };
    /* Eine Materialzeile desselben Artikels ist kein Verlust, sondern eine
       Änderung – und die Änderung ist genau das, was der Planer sehen muss:
       im Audit nannte der Dialog bei der berichtigten Meldung „1 Materialzeile
       geht verloren“ und nirgends „31.200 → 3.120 m“. */
    const geaendert = probe ? mengenAenderung(ziel.bau, probe.bau) : [];
    verloren.material = Math.max(0, verloren.material - geaendert.length);

    /* Wie weit die gemeldete Aufnahme neben der Trasse liegt, der sie
       zugeordnet wird. Zugeordnet wird über den Namen, und „Strecke 1“ in
       „Neue Planung“ heißt in jedem Ortsverband so: im Audit kam die Meldung
       eines fremden Trupps an, 80 km entfernt, und ersetzte ohne ein Wort die
       eigene Aufnahme. Liegt schon der NÄCHSTE Punkt weiter als
       `ABSEITS_SCHWELLE` daneben, gehört die Meldung nicht hierher; liegen nur
       einzelne daneben, ist es eine Ortung am falschen Platz, und das ist eine
       Nachfrage, kein Grund zu verwerfen. */
    const lage = (ziel && (ziel.punkte || []).length)
      ? ((m.bau && m.bau.punkte) || [])
          .filter(pt => pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng))
          .map(pt => abstandZurLinie(pt, ziel.punkte))
      : [];
    const daneben = lage.length ? {
      naechster: Math.min(...lage),
      weitester: Math.max(...lage),
      zahl: lage.filter(d => d >= ABSEITS_SCHWELLE).length,
      alle: lage.every(d => d >= ABSEITS_SCHWELLE)
    } : null;

    /* „Übergeben“ ohne Messung kam beim Planer als fertige Leitung an. Beim
       Trupp fragt die Auswahl nach (`bauUebergabeBlock` in ui.js) – sie lässt
       „trotzdem übergeben“ aber zu, und dann stand im Empfangsdialog nur der
       Standwechsel. */
    const staemme = (m.bau && m.bau.pruefung && m.bau.pruefung.staemme) || [];
    const uebergabeFraglich = !(m.bau && m.bau.stand === 'uebergeben') ? ''
      : !staemme.length ? 'ohne Prüfzeile'
      : staemme.some(z => z && z.bestanden === false) ? 'mit durchgefallener Prüfung'
      : '';

    /* Was der Planer lesen will, bevor er einspielt: die neuen Baumeldungen im
       Wortlaut und wie sich der Stand verschiebt. Vorher stand im Dialog nur
       „3 Punkte · 2 Baumeldungen“ – ob eine davon „Deich überflutet“ hieß,
       erfuhr er erst danach in der Liste. Neu ist, was die Abschrift nach dem
       Einspielen trägt und hier noch nicht steht. */
    const neueMeldungen = probe ? neuNachInhalt(ziel.bau, probe.bau, 'meldungen')
      .filter(x => String(x.text || '').trim())
      .sort((a, b) => String(a.zeit || '').localeCompare(String(b.zeit || ''))) : [];
    const kurz = k => ({ stand: k.stand.id, bestaetigt: k.bestaetigt, soll: k.sollPunkte,
      ist: k.istPunkte, abweichungen: k.abweichungen.length + k.abseits.length });
    const bisher = ziel ? kurz(baukennzahlen(ziel)) : null;
    const danach = probe ? kurz(baukennzahlen(probe)) : null;

    return {
      standMeldung, standHier, schonDa, aelter, verloren, geaendert,
      daneben, uebergabeFraglich, neueMeldungen, bisher, danach,
      /* Wessen Aufnahme hier steht. Ohne den Namen war „Dabei weichen 3
         Punkte“ nicht von „mein eigener älterer Stand“ zu unterscheiden – und
         im Audit verschwand so die Aufnahme des ANDEREN Trupps. */
      bisherVon: ziel ? bisherVon(ziel, abschnitteDerMeldung, ganzeStrecke) : '',
      standAlt: ziel && ziel.bau ? ziel.bau.stand : '',
      standNeu: m.bau && typeof m.bau.stand === 'string' ? m.bau.stand : '',
      s6: m.bau && typeof m.bau.abweichung === 'string' ? m.bau.abweichung.trim() : '',
      stelle: i,
      name: m.name,
      ziel,
      ganzeStrecke,
      abschnitte: abschnitteDerMeldung,
      istPunkte: ((m.bau && m.bau.punkte) || []).length,
      materialzeilen: ((m.bau && m.bau.material) || []).length,
      meldungen: ((m.bau && m.bau.meldungen) || []).length,
      pruefzeilen: ((m.bau && m.bau.pruefung && m.bau.pruefung.staemme) || []).length,
      uebergabe: !!(m.bau && m.bau.pruefung && m.bau.pruefung.uebergabeAn),
      /* Was die Meldung ohne Bauabschnitt mitbringt. Es wird mit eingespielt und
         ersetzt den unzugeordneten Bestand des Planers – der Planer muss das
         vorher sehen. */
      unzugeordnet,
      kollision,
      planAbweicht,
      /* Was eine Meldung über die ganze Strecke beim Planer wegnimmt: sie tritt
         an die Stelle des ganzen Bogens, also auch an die von Bauabschnitten,
         die sie gar nicht nennt, und von Prüfung und Übergabe. */
      /* Auch hier nach dem Inhalt und nicht nach der Zahl: was die Abschrift
         nach dem Einspielen noch trägt, geht nicht verloren. Vorher stand
         „Dabei gehen verloren: 1 Materialzeilen“ auch dann, wenn dieselbe
         Zeile gleich wieder hereinkam. */
      verdraengt: (ziel && ganzeStrecke && probe) ? verdraengtNachInhalt(ziel.bau, probe.bau, verloren) : null,
      /* Was beim Planer verlorenginge. Bei der ganzen Strecke ist das der
         ganze Bogen, bei einzelnen Abschnitten nur deren Eintragungen. */
      ersetzt: ziel ? (ganzeStrecke ? istPunkte(ziel).length
        : istPunkte(ziel).filter(pt => pt.abschnitt &&
            vorhandene.some(a => a.id === pt.abschnitt &&
              abschnitteDerMeldung.includes(a.name))).length) : 0
    };
  });
}

/* Wie viele Eintragungen dieses Bogens keinem Bauabschnitt zugeordnet sind.
   Gilt für den ROHEN Bogen einer Meldung, und dort steht die Zuordnung als
   STELLE in der Abschnittsliste. Die erste Stelle ist die 0, und die ist falsch
   – ein `!z.abschnitt` zählte die Eintragungen des ersten Bauabschnitts
   allesamt als unzugeordnet und meldete dem Planer, sie träten an die Stelle
   seines eigenen unzugeordneten Bestands. */
const nichtZugeordnet = x => x.abschnitt === undefined || x.abschnitt === null;
const zaehleOhneAbschnitt = bau =>
  (bau.punkte || []).filter(nichtZugeordnet).length +
  (bau.material || []).filter(nichtZugeordnet).length +
  (bau.meldungen || []).filter(nichtZugeordnet).length;

/* Das Einspielen an einer Abschrift – dieselben Schritte wie in
   `einspielen()`, nur ohne Folgen. */
function probeEinspielen(ziel, m) {
  const kopie = JSON.parse(JSON.stringify(ziel));
  const planAbweicht = Number.isInteger(m.sollPunkte) &&
    m.sollPunkte !== (kopie.punkte || []).length;
  const frisch = aufloesen(kopie, m, planAbweicht);
  if (!frisch) return null;
  if (!frisch.abschnitte.length) ganzeStreckeErsetzen(kopie, frisch);
  else abschnitteErsetzen(kopie, frisch);
  return kopie;
}

/* Ein Eintrag ohne das, was beim Einspielen neu vergeben wird: Kennungen und
   Verweise. Übrig bleibt, was der Trupp ausgesagt hat. */
const inhaltVon = x => {
  const { id, abschnitt, sollPunkt, ...rest } = x || {};
  return JSON.stringify(rest, Object.keys(rest).sort());
};
/* Paart die Einträge von vorher und nachher über ihren Inhalt. Übrig bleiben,
   was vorher stand und danach nicht mehr (`weg`), und was danach neu dasteht
   (`neu`). */
function paaren(vorher, nachher, feld) {
  const da = new Map();
  for (const x of (nachher && nachher[feld]) || []) {
    const k = inhaltVon(x);
    if (!da.has(k)) da.set(k, []);
    da.get(k).push(x);
  }
  const weg = [];
  for (const x of (vorher && vorher[feld]) || []) {
    const liste = da.get(inhaltVon(x));
    if (liste && liste.length) liste.pop();
    else weg.push(x);
  }
  return { weg, neu: [].concat(...da.values()) };
}

const neuNachInhalt = (vorher, nachher, feld) => paaren(vorher, nachher, feld).neu;

function verlust(vorher, nachher) {
  /* Ein Punkt, dem der Trupp nach der ersten Meldung eine Bezeichnung
     nachgetragen hat, ist nicht verloren, sondern geändert. Seit ein Verlust
     „Verwerfen“ nach vorn stellt, wäre das sonst bei jeder gewöhnlichen
     zweiten Meldung so gewesen. Erkannt wird er an der Aufnahmezeit – sie
     setzt das Gerät beim Aufnehmen und reist mit. */
  const zaehle = (feld, ueberZeit) => {
    const { weg, neu } = paaren(vorher, nachher, feld);
    if (!ueberZeit) return { weg: weg.length, geaendert: 0 };
    let verloren = 0, geaendert = 0;
    for (const x of weg) {
      const i = neu.findIndex(n => n && x && n.zeit && n.zeit === x.zeit);
      if (i >= 0) { neu.splice(i, 1); geaendert++; } else verloren++;
    }
    return { weg: verloren, geaendert };
  };
  const p = zaehle('punkte', true), m = zaehle('meldungen', true), z = zaehle('material', false);
  return { punkte: p.weg, meldungen: m.weg, material: z.weg,
           punkteGeaendert: p.geaendert, meldungenGeaendert: m.geaendert };
}

function mengenAenderung(vorher, nachher) {
  const schluessel = z => `${z.artikel}|${z.abschnitt || ''}|${z.artikel === 'sonstiges' ? z.bemerkung : ''}`;
  const neu = new Map(((nachher && nachher.material) || []).map(z => [schluessel(z), z]));
  const liste = [];
  for (const z of (vorher && vorher.material) || []) {
    const n = neu.get(schluessel(z));
    if (n && n.menge !== z.menge) {
      const m = materialById(z.artikel);
      liste.push({ name: (z.artikel === 'sonstiges' && z.bemerkung) || (m ? m.name : z.artikel),
        einheit: m ? m.einheit : '', alt: z.menge, neu: n.menge });
    }
  }
  return liste;
}

function verdraengtNachInhalt(vorher, nachher, verloren) {
  const v = vorher || {}, n = nachher || {};
  const pv = v.pruefung || {}, pn = n.pruefung || {};
  const namen = new Set((n.abschnitte || []).map(a => a.name));
  const zeilenNachher = new Set((pn.staemme || []).map(inhaltVon));
  return {
    abschnitte: (v.abschnitte || []).filter(a => !namen.has(a.name)).length,
    pruefzeilen: (pv.staemme || []).filter(z => !zeilenNachher.has(inhaltVon(z))).length,
    uebergabe: !!pv.uebergabeAn && (pv.uebergabeAn !== pn.uebergabeAn || pv.uebergabeZeit !== pn.uebergabeZeit),
    material: verloren.material,
    abweichung: !!v.abweichung && v.abweichung !== n.abweichung
  };
}

/* Wer den Stand gemeldet hat, der ersetzt würde: der Trupp der betroffenen
   Bauabschnitte, sonst der Absender der letzten eingespielten Meldung. */
function bisherVon(ziel, namen, ganzeStrecke) {
  const bau = ziel.bau;
  if (!bau) return '';
  const trupps = (bau.abschnitte || [])
    .filter(a => ganzeStrecke || namen.includes(a.name))
    .map(a => a.trupp).filter(Boolean);
  if (trupps.length) return [...new Set(trupps)].join(', ');
  return String(bau.gemeldetVon || '');
}

/** Hängt an diesem Bauabschnitt überhaupt etwas? */
function traegtEintraege(strecke, aid) {
  const bau = strecke.bau;
  if (!bau) return false;
  return (bau.punkte || []).some(pt => pt.abschnitt === aid) ||
         (bau.material || []).some(z => z.abschnitt === aid) ||
         (bau.meldungen || []).some(m => m.abschnitt === aid);
}

// ------------------------------------------------------------- Einspielen

/**
 * Eine Baumeldung einspielen.
 *
 * `zuordnung[i]` ist die Kennung der Zielstrecke oder `null`. Zurück kommt,
 * was geschehen ist – die Oberfläche meldet es dem Planer.
 *
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function einspielen(projekt, meldung, zuordnung) {
  const bericht = { strecken: 0, punkte: 0, bestand: 0, abschnitte: 0, uebersprungen: 0 };
  (meldung.strecken || []).forEach((m, i) => {
    const zielId = zuordnung ? zuordnung[i] : undefined;
    const ziel = zielId === null ? null
      : (projekt.strecken || []).find(s => s.id === zielId) || vorschlag(projekt, m.name);
    if (!ziel) { bericht.uebersprungen++; return; }

    const planAbweicht = Number.isInteger(m.sollPunkte) &&
      m.sollPunkte !== (ziel.punkte || []).length;
    const frisch = aufloesen(ziel, m, planAbweicht);
    if (!frisch) { bericht.uebersprungen++; return; }

    const vorher = istPunkte(ziel).length;
    if (!frisch.abschnitte.length) ganzeStreckeErsetzen(ziel, frisch);
    else abschnitteErsetzen(ziel, frisch);
    /* Der Absender bleibt an der Strecke stehen: die Streckenliste nennt ihn,
       und die nächste Meldung sagt damit, WESSEN Aufnahme sie ersetzt. */
    /* Ohne Absender steht das auch so da: ein leeres Feld ließ die nächste
       Meldung nicht mehr sagen, wessen Aufnahme sie ersetzt. */
    ziel.bau.gemeldetVon = meldung.von ? String(meldung.von).slice(0, 120) : 'unbekannter Absender';

    bericht.strecken++;
    /* Gezählt wird, was danach WIRKLICH in der Planung steht, und nicht, was die
       Meldung mitbrachte. Beides auseinanderlaufen zu lassen wäre die
       schlimmste Sorte Fehler: der Planer läse „7 Punkte eingespielt“ und hätte
       drei – und suchte den Fehler beim Trupp. */
    bericht.punkte += Math.max(0, istPunkte(ziel).length - vorher);
    bericht.bestand += istPunkte(ziel).length;
    bericht.abschnitte += frisch.abschnitte.length;
  });
  return bericht;
}

/**
 * Den `bau`-Block der Meldung auf die Zielstrecke umrechnen.
 *
 * Die Verweise stehen als Stelle in der Punktliste – aufgelöst wird gegen die
 * Punkte des ZIELS, denn dort wird eingespielt. Was sich nicht auflösen lässt,
 * wird `null`: ein Ist-Punkt ohne Bezug zum Plan ist ein eigenständiger Punkt
 * und bleibt stehen, während ein falsch aufgelöster Verweis behauptete, ein
 * bestimmter geplanter Punkt sei bestätigt worden.
 *
 * Danach läuft alles durch dieselbe Weißliste wie jede fremde Datei
 * (`bauNormalisieren` in `state.js`) – eine Baumeldung kommt aus derselben
 * Fremde wie ein Link.
 */
function aufloesen(ziel, m, planAbweicht) {
  if (!m || !m.bau || typeof m.bau !== 'object') return null;
  const roh = JSON.parse(JSON.stringify(m.bau));
  const punkte = ziel.punkte || [];
  const abschnitte = Array.isArray(roh.abschnitte) ? roh.abschnitte : [];

  /* Jeder Bauabschnitt der Meldung bekommt hier seine Kennung, und zwar VOR dem
     Auflösen: die Verweise von Punkten, Materialzeilen und Meldungen zeigen als
     Stelle auf ihn, und die Stelle muss sich in eine Kennung übersetzen lassen.
     `bauNormalisieren()` vergäbe sie erst danach – die Verweise stünden dann
     schon auf `undefined`, und der ganze Bogen des Trupps fiele an einen
     Abschnitt, den es nicht gibt. Genauso macht es `bauAuffuellen()` in
     `teilen.js` für den Weg über den Link.

     Ein vorhandener Abschnitt gleichen Namens gibt seine Kennung her: sonst
     hinge alles, was beim Planer sonst noch auf ihn zeigt, in der Luft. */
  const vorhandene = bauabschnitte(ziel);
  const vergeben = new Set();
  abschnitte.forEach((a, n) => {
    /* Der Name wird festgeschrieben, BEVOR gesucht wird, und zwar genauso, wie
       `bauNormalisieren()` ihn gleich darauf herstellen wird. Sonst suchte
       diese Zeile mit einem leeren Namen, fände nichts, und der Namensvergleich
       in `abschnitteErsetzen()` träfe eine Zeile später doch – auf eine andere
       Kennung. Der Bogen beider Trupps wäre dann weg. */
    a.name = String((a && a.name) || `Bauabschnitt ${n + 1}`);
    const alt = vorhandene.find(x => x.name === a.name && !vergeben.has(x.id));
    if (alt) vergeben.add(alt.id);
    a.id = alt ? alt.id : (a.id || neueKennung());
  });

  /* Weicht die Zahl der geplanten Punkte ab, hat jemand eingefügt oder gelöscht,
     und die Stellen zeigen auf eine andere Liste als die, gegen die sie
     geschrieben wurden. Dann wird JEDER Planbezug gelöst und keiner geraten:
     ein Ist-Punkt ohne Bezug ist ein eigenständiger Punkt und bleibt stehen,
     ein falsch aufgelöster behauptete, ein bestimmter geplanter Punkt sei
     bestätigt worden – und genau darauf beruht die ganze Abweichungsrechnung.
     Die Vorschau sagt das vorher zu; hier wird es eingelöst. */
  const punktKennung = i =>
    (!planAbweicht && Number.isInteger(i) && punkte[i] ? punkte[i].id : null);
  const abschnittKennung = i => (Number.isInteger(i) && abschnitte[i] ? abschnitte[i].id : null);
  abschnitte.forEach(a => {
    a.vonPunkt = punktKennung(a.vonPunkt);
    a.bisPunkt = punktKennung(a.bisPunkt);
  });
  for (const pt of (Array.isArray(roh.punkte) ? roh.punkte : [])) {
    if (!pt) continue;
    pt.sollPunkt = punktKennung(pt.sollPunkt);
    pt.abschnitt = abschnittKennung(pt.abschnitt);
  }
  for (const z of (Array.isArray(roh.material) ? roh.material : [])) {
    if (z) z.abschnitt = abschnittKennung(z.abschnitt);
  }
  for (const mm of (Array.isArray(roh.meldungen) ? roh.meldungen : [])) {
    if (mm) mm.abschnitt = abschnittKennung(mm.abschnitt);
  }
  return bauNormalisieren(roh);
}

/* Trägt dieser Bogen etwas, das keinem Bauabschnitt zugeordnet ist?
   Gilt für den AUFGELÖSTEN Bogen, dort ist die Zuordnung eine Kennung oder
   `null` – eine Stelle 0 kann hier nicht mehr vorkommen. Derselbe Test steht
   für den rohen Bogen weiter oben unter `nichtZugeordnet`. */
const ohneAbschnitt = bau =>
  (bau.punkte || []).some(nichtZugeordnet) ||
  (bau.material || []).some(nichtZugeordnet) ||
  (bau.meldungen || []).some(nichtZugeordnet);

/**
 * Die Ist-Punkte wieder in die Ordnung der Planung bringen.
 *
 * Nötig, weil zwei Trupps aufeinander zu bauen und der eine am Ende der Trasse
 * anfängt – nach der Eintragungszeit sortiert liefe die gebaute Trasse sonst
 * verkehrt herum über die Karte.
 *
 * Ein Punkt OHNE Planbezug bekommt dabei den Rang seines Vorgängers und nicht
 * den letzten: ans Listenende geschoben liefe die gebaute Trasse über die ganze
 * Strecke und wieder zurück, und die gerechnete Länge wäre doppelt so groß wie
 * die gebaute. Denselben Fehler vermeidet `nebenDenNachbarn()` in `baudoku.js`
 * beim Aufnehmen – hier darf er nicht durch die Hintertür zurückkommen.
 */
function istPunkteOrdnen(ziel, punkte) {
  const ordnung = new Map((ziel.punkte || []).map((pt, i) => [pt.id, i]));
  let zuletzt = -1;
  const mitRang = punkte.map((pt, i) => {
    if (ordnung.has(pt.sollPunkt)) zuletzt = ordnung.get(pt.sollPunkt);
    return { pt, rang: zuletzt, stelle: i };
  });
  mitRang.sort((a, b) => a.rang - b.rang || a.stelle - b.stelle);
  return mitRang.map(x => x.pt);
}

/* Eine Meldung ohne Bauabschnitt betrifft die ganze Strecke: ein Trupp, eine
   Trasse. Dann tritt ihr Bogen an die Stelle des vorhandenen – alles andere
   liefe darauf hinaus, zwei Bögen zu verschmelzen. */
function ganzeStreckeErsetzen(ziel, frisch) {
  ziel.bau = frisch;
}

/* Eine Meldung MIT Bauabschnitten ersetzt genau die, die sie nennt. Was beim
   Planer an anderen Abschnitten hängt, bleibt unangetastet – das ist der ganze
   Zweck der Abschnitte: dass zwei Trupps nie in dasselbe Feld schreiben. */
function abschnitteErsetzen(ziel, frisch) {
  const bau = ziel.bau || (ziel.bau = bauNormalisieren({}));
  const betroffen = new Set();
  const vergeben = new Set();

  for (const neu of frisch.abschnitte) {
    /* Jeder vorhandene Abschnitt wird höchstens EINMAL vergeben: trüge eine
       Meldung zwei Abschnitte desselben Namens, fielen sonst beide auf
       denselben Eintrag, und der zweite verlöre seine Eintragungen. */
    const alt = (bau.abschnitte || []).find(a => a.name === neu.name && !vergeben.has(a.id));
    if (alt) {
      vergeben.add(alt.id);
      betroffen.add(alt.id);
      /* Die Farbe bleibt die des Planers: an ihr hängt die Karte, die er vor
         sich hat, und der Trupp hat sie nie gesehen. */
      Object.assign(alt, neu, { id: alt.id, farbe: alt.farbe });
    } else {
      betroffen.add(neu.id);
      bau.abschnitte.push(neu);
    }
  }

  /* Was der Trupp OHNE Bauabschnitt aufgenommen hat, gehört ebenso zu seiner
     Meldung – und fiele sonst lautlos weg, weil `null` in keiner Menge von
     Abschnittskennungen steht. Das ist kein Randfall: wer aufnimmt, ohne oben
     einen Abschnitt zu wählen, landet hier, und `bauabschnittLoeschen()` setzt
     die Zuordnung beim Umgliedern ausdrücklich zurück.

     Der unzugeordnete Bestand des Planers wird dabei ERSETZT und nicht
     ergänzt. Sonst stünde nach einem zweiten Einspielen derselben Meldung alles
     doppelt da – und eine Meldung zweimal einzuspielen ist am Bauort
     wahrscheinlicher als zwei Trupps, die beide nichts zuordnen. Die Vorschau
     nennt diesen Bestand eigens. */
  if (ohneAbschnitt(frisch)) betroffen.add(null);

  bau.punkte = (bau.punkte || []).filter(pt => !betroffen.has(pt.abschnitt))
    .concat(frisch.punkte.filter(pt => betroffen.has(pt.abschnitt)));
  bau.material = (bau.material || []).filter(z => !betroffen.has(z.abschnitt))
    .concat(frisch.material.filter(z => betroffen.has(z.abschnitt)));
  bau.meldungen = (bau.meldungen || []).filter(mm => !betroffen.has(mm.abschnitt))
    .concat(frisch.meldungen.filter(mm => betroffen.has(mm.abschnitt)));
  bau.punkte = istPunkteOrdnen(ziel, bau.punkte);

  bau.stand = standNachTeilmeldung(bau.stand, frisch.stand);

  /* Prüfung und Übergabe gehören der ganzen Leitung und nicht einem Abschnitt.
     Eine Meldung über einen Teil der Strecke überschreibt sie deshalb nicht –
     sie trägt nur ein, wo beim Planer noch nichts steht. */
  if (!bau.pruefung && frisch.pruefung) bau.pruefung = frisch.pruefung;

  /* Zwei Abweichungsmeldungen werden aneinandergehängt und nicht ersetzt: was
     der eine Trupp gemeldet hat, geht den anderen nichts an, und der S 6
     braucht beides. */
  if (frisch.abweichung && frisch.abweichung !== bau.abweichung) {
    bau.abweichung = bau.abweichung
      ? bau.abweichung + '\n\n' + frisch.abweichung : frisch.abweichung;
  }
}

/** Kurzfassung für die Meldung nach dem Einspielen */
export function berichtText(bericht) {
  const teile = [];
  const zaehl = (n, ein, viele) => { if (n) teile.push(`${n} ${n === 1 ? ein : viele}`); };
  zaehl(bericht.strecken, 'Strecke', 'Strecken');
  zaehl(bericht.abschnitte, 'Bauabschnitt', 'Bauabschnitte');
  if (!teile.length) return 'Nichts eingespielt';
  /* Der Bestand und nicht der Zuwachs: eine Meldung, die vorhandene Punkte
     ERSETZT, bringt netto null neue – „0 Punkte“ danebenzuschreiben wäre
     irreführend, „12 Punkte stehen jetzt an dieser Strecke“ ist die Aussage,
     die der Planer prüfen kann. „In der Baudokumentation“ und nicht „in der
     Planung“: der Empfangsdialog hatte zwei Schritte vorher versichert, die
     geplante Trasse bleibe unangetastet, und der Satz danach klang, als sei
     sie es nicht. */
  const satz = teile.join(', ') + ' eingespielt';
  return bericht.bestand
    ? `${satz} – ${bericht.bestand} ${bericht.bestand === 1
        ? 'aufgenommener Punkt steht' : 'aufgenommene Punkte stehen'} jetzt in der Baudokumentation`
    : satz;
}
