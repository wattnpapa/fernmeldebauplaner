// kacheln.js – Kartenkacheln für den Bauort mitnehmen

/* Am Bauort ist kein Netz. Die Anwendung selbst startet ohne eines – dafür
   sorgt `sw.js` –, aber ohne Kartenkacheln wäre der Baumodus blind: der Trupp
   soll antippen, wo der Punkt wirklich liegt, und sieht eine graue Fläche.

   Deshalb wird der Ausschnitt entlang der Trasse vor dem Ausrücken geholt und
   im Gerät abgelegt. Der Speicher ist derselbe wie für die Lichtbilder –
   IndexedDB, nicht localStorage: eine einzelne Kachel wiegt im Mittel rund
   20 kB (leere Feldflur 5 kB, Stadtkern 40 kB), und die 5 MB des localStorage
   wären nach zwei Dutzend voll.

   Zwei Dinge, die hier bewusst begrenzt sind:

   **Die Menge.** Die Nutzungsbedingungen von OpenStreetMap untersagen das
   massenhafte Vorabladen von Kacheln ausdrücklich, und auch für die übrigen
   Quellen gilt: ein Werkzeug, das auf Knopfdruck zehntausend Kacheln zieht,
   wird irgendwann ausgesperrt – und dann steht der ganze FMBauplaner ohne
   Karte da, nicht nur der Vorrat. Der Vorrat ist deshalb auf den Korridor der
   Trasse beschnitten, auf `HOECHSTENS` Kacheln gedeckelt und läuft mit
   angezogener Handbremse (`GLEICHZEITIG`, `PAUSE`). Wer die Grenzen hochsetzt,
   verschiebt den Preis auf den Anbieter und auf alle anderen Nutzer.

   **Der Zoombereich.** Vorgabe 13 bis 17: darunter ist die Übersicht, die
   ohnehin wenige Kacheln kostet, darüber wächst die Zahl je Stufe auf das
   Vierfache. Stufe 17 zeigt einzelne Gebäude – mehr braucht am Bauplatz
   niemand, der eine Muffe einmisst. */

import { distanz } from './geo.js';

const DATENBANK = 'fbp.kacheln';
const LAGER = 'kacheln';

/** Kachelkante in Bildpunkten – bei allen hier angebundenen Quellen 256 */
const KANTE = 256;

/* Deckel für einen Vorrat. 2000 Kacheln sind bei rund 20 kB je Kachel etwa
   39 MB. Nachgerechnet mit `kachelliste()`: eine 10 km lange Trasse kostet bis
   Zoom 17 rund 470 Kacheln, eine 20 km lange rund 900 – der Deckel greift also
   erst weit jenseits dessen, was ein Fernmeldetrupp an einem Tag baut. Was
   darüber liegt, ist keine Bauplanung mehr, sondern ein Kartenabzug. */
export const HOECHSTENS = 2000;

/* Vier Abrufe nebeneinander und eine kurze Pause dazwischen. Das ist langsam
   genug, dass kein Anbieter es als Angriff liest, und schnell genug, dass ein
   üblicher Vorrat in ein bis zwei Minuten steht. */
const GLEICHZEITIG = 4;
const PAUSE = 120;

export const ZOOM_VON = 13;
export const ZOOM_BIS = 17;

/* Puffer beiderseits der Trasse. 300 m ist die Breite, in der sich ein Trupp
   bewegt, wenn er einem Hindernis ausweicht – und die Strecke, die er zu Fuß
   in fünf Minuten zurücklegt. */
export const PUFFER = 300;

// ---------------------------------------------------------------- Speicher

let verbindungLauf = null;

function db() {
  if (verbindungLauf) return verbindungLauf;
  verbindungLauf = new Promise((fertig, zurueckweisen) => {
    if (!window.indexedDB) return zurueckweisen(new Error('Dieser Browser stellt keinen Kachelspeicher bereit.'));
    const antrag = indexedDB.open(DATENBANK, 1);
    antrag.onupgradeneeded = () => {
      if (!antrag.result.objectStoreNames.contains(LAGER)) {
        antrag.result.createObjectStore(LAGER, { keyPath: 'url' });
      }
    };
    antrag.onsuccess = () => fertig(antrag.result);
    /* Im privaten Fenster mancher Browser ist IndexedDB gesperrt. Der Fehler
       wird nicht verschluckt: wer die Karte mitnehmen will, muss erfahren,
       dass sie nicht bleiben wird. */
    antrag.onerror = () => zurueckweisen(new Error('Kachelspeicher des Browsers nicht verfügbar.'));
    antrag.onblocked = () => zurueckweisen(new Error('Kachelspeicher ist von einem anderen Fenster belegt.'));
  });
  verbindungLauf.catch(() => { verbindungLauf = null; });
  return verbindungLauf;
}

async function imLager(modus, tun) {
  const verbindung = await db();
  return new Promise((fertig, zurueckweisen) => {
    const vorgang = verbindung.transaction(LAGER, modus);
    const lager = vorgang.objectStore(LAGER);
    let ergebnis;
    vorgang.oncomplete = () => fertig(ergebnis);
    vorgang.onerror = () => zurueckweisen(vorgang.error);
    vorgang.onabort = () => zurueckweisen(vorgang.error || new Error('Vorgang abgebrochen'));
    ergebnis = tun(lager, w => { ergebnis = w; });
  });
}

/** Eine Kachel aus dem Vorrat – `null`, wenn sie nicht da ist */
export async function kachelHolen(url) {
  try {
    return await imLager('readonly', (lager, setze) => {
      const a = lager.get(url);
      a.onsuccess = () => setze(a.result ? a.result.blob : null);
    });
  } catch (e) {
    /* Ohne Vorrat läuft die Karte wie bisher übers Netz weiter. Ein Browser,
       der IndexedDB sperrt, darf sie nicht schwarz machen. */
    return null;
  }
}

async function kachelAblegen(url, blob, karte) {
  /* Erst nach dem Schreiben als geändert melden: eine Abdeckung, die
     dazwischen gezählt wird, sähe die Kachel noch nicht und bliebe so gemerkt. */
  return imLager('readwrite', lager => {
    lager.put({ url, blob, karte, zeit: Date.now(), groesse: blob.size });
  }).finally(vorratGeaendert);
}

/** Was im Vorrat liegt: Anzahl und belegter Platz in Bytes */
export async function bestand() {
  try {
    return await imLager('readonly', (lager, setze) => {
      let anzahl = 0, bytes = 0;
      const karten = new Set();
      const a = lager.openCursor();
      a.onsuccess = () => {
        const zeiger = a.result;
        if (!zeiger) return setze({ anzahl, bytes, karten: [...karten] });
        anzahl++;
        bytes += zeiger.value.groesse || 0;
        if (zeiger.value.karte) karten.add(zeiger.value.karte);
        zeiger.continue();
      };
    });
  } catch (e) {
    return { anzahl: 0, bytes: 0, karten: [] };
  }
}

/** Den ganzen Vorrat wegräumen */
export async function leeren() {
  return imLager('readwrite', lager => { lager.clear(); }).finally(vorratGeaendert);
}

// ---------------------------------------------------------------- Abdeckung

/* Ob die Karte einer Strecke dabei ist, sagt nicht die Zahl der Kacheln im
   Gerät. Im Audit stand „Karte dabei ✓“, weil eine einzige Kachel weit
   abseits lag oder ein abgebrochener Lauf 10 von 300 geholt hatte – und am
   Bauort war die Karte grau. Gefragt wird deshalb mit derselben Kachelliste,
   die „Karte holen“ abarbeitet: liegt jede davon im Gerät?

   Eine Abfrage je Kachel wären bei jedem Neuaufbau des Bau-Reiters einige
   hundert Vorgänge. Gelesen werden stattdessen einmal alle Schlüssel, und
   zwar nur, wenn sich der Vorrat seitdem geändert haben kann; das Ergebnis je
   Strecke und Karte bleibt stehen, bis Vorrat, Trasse oder Kartenwahl sich
   ändern – das sind die Eingaben dieser Rechnung, und jede steht in ihrem
   Schlüssel. */
let vorratStand = 0;
let adressenLauf = null;
const abdeckungen = new Map();

function vorratGeaendert() {
  vorratStand++;
  adressenLauf = null;
  abdeckungen.clear();
}

/* Ein zweites Fenster der Anwendung kann den Vorrat gefüllt oder geleert
   haben, ohne dass dieses es merkt – IndexedDB meldet fremde Schreibvorgänge
   nicht. Wer zurück ins Fenster kommt, bekommt deshalb frisch gezählt. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') vorratGeaendert();
  });
}

function alleAdressen() {
  if (adressenLauf) return adressenLauf;
  const stand = vorratStand;
  const lauf = imLager('readonly', (lager, setze) => {
    const a = lager.getAllKeys();
    a.onsuccess = () => setze(new Set(a.result));
  });
  adressenLauf = lauf;
  /* Ändert sich der Vorrat, während gelesen wird, gilt die Antwort nur für
     diesen einen Aufruf und wird nicht für den nächsten gemerkt. */
  lauf.then(() => { if (stand !== vorratStand && adressenLauf === lauf) adressenLauf = null; },
            () => { if (adressenLauf === lauf) adressenLauf = null; });
  return lauf;
}

/**
 * Wie viel der Kachelliste einer Trasse im Gerät liegt.
 *
 * `linien` wie bei `vorladen()`. Gezählt wird gegen genau die Liste, die
 * „Karte holen“ mit denselben Angaben holen würde, Deckel eingeschlossen –
 * eine Karte, deren feine Stufen der Deckel abgeschnitten hat, ist nicht
 * vollständig, und das soll die Anzeige nicht verschweigen.
 *
 * @returns {Promise<{gesamt:number, da:number}>} – ohne Kachelspeicher `da` 0
 */
export async function abdeckung(vorlage, linien, o = {}) {
  const liste = kachellisteLinien(linien, o).slice(0, o.hoechstens || HOECHSTENS);
  if (!liste.length) return { gesamt: 0, da: 0 };
  const schluessel = JSON.stringify([vorlage, o.zoomVon, o.zoomBis, o.puffer, o.hoechstens,
    linienVon(linien).map(l => l.map(p => [p.lat, p.lng]))]);
  const gemerkt = abdeckungen.get(schluessel);
  if (gemerkt && gemerkt.stand === vorratStand) return gemerkt.wert;
  const stand = vorratStand;
  let adressen;
  try { adressen = await alleAdressen(); } catch (e) { return { gesamt: liste.length, da: 0 }; }
  let da = 0;
  for (const kachel of liste) if (adressen.has(kacheladresse(vorlage, kachel))) da++;
  const wert = { gesamt: liste.length, da };
  if (stand === vorratStand) abdeckungen.set(schluessel, { stand, wert });
  return wert;
}

// ---------------------------------------------------------------- Kachelrechnung

/* Die übliche Rechnung des Kachelrasters (Web-Mercator, „slippy map“). Sie
   steht hier und nicht in `geo.js`, weil sie nichts mit Geodäsie zu tun hat:
   sie sagt nur, wie ein Anbieter seine Bilder nummeriert. */
const kachelX = (lng, z) => Math.floor((lng + 180) / 360 * Math.pow(2, z));
const kachelY = (lat, z) => {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
};

/** Kantenlänge einer Kachel in Metern auf dieser Breite */
export function kachelMeter(lat, z) {
  return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z) * KANTE;
}

/**
 * Die Kacheln entlang einer Punktfolge, mit Puffer, für einen Zoombereich.
 *
 * Abgetastet wird der Linienzug und nicht sein umschließendes Rechteck: eine
 * 10 km lange Trasse quer über die Karte liegt in einem Rechteck von 100 km²,
 * ihr Korridor misst 6 km². Der Unterschied ist der zwischen zwei Minuten und
 * einer Stunde Ladezeit – und zwischen einem geduldeten und einem
 * missbräuchlichen Zugriff auf den Kachelserver.
 */
export function kachelliste(punkte, { zoomVon = ZOOM_VON, zoomBis = ZOOM_BIS, puffer = PUFFER } = {}) {
  const liste = [];
  if (!punkte || punkte.length === 0) return liste;
  for (let z = zoomVon; z <= zoomBis; z++) {
    const gesehen = new Set();
    const mittlereBreite = punkte.reduce((s, p) => s + p.lat, 0) / punkte.length;
    const meterJeKachel = kachelMeter(mittlereBreite, z);
    /* Wie viele Kacheln in jede Richtung der Puffer erreicht. Mindestens eine,
       sonst risse der Korridor bei feinem Zoom an den Rändern auf. */
    const rand = Math.max(1, Math.ceil(puffer / meterJeKachel));
    for (const p of abtasten(punkte, meterJeKachel / 2)) {
      const mx = kachelX(p.lng, z), my = kachelY(p.lat, z);
      for (let dx = -rand; dx <= rand; dx++) {
        for (let dy = -rand; dy <= rand; dy++) {
          const x = mx + dx, y = my + dy;
          const schluessel = `${z}/${x}/${y}`;
          if (gesehen.has(schluessel)) continue;
          gesehen.add(schluessel);
          liste.push({ z, x, y });
        }
      }
    }
  }
  return liste;
}

/* Eine Punktfolge oder mehrere. Mehrere Linien – Plan und Ist einer Strecke,
   oder alle Strecken einer Planung – wurden früher zu einem einzigen Zug
   aneinandergehängt, und der Korridor lief dann auch über den Sprung vom
   Ende der einen zur nächsten: Kacheln, die keine Trasse berührt. Für die
   Abdeckung wäre das schlimmer als teuer: die Liste der Planung hinge davon
   ab, ob schon Ist-Punkte da sind, und eine vollständig mitgenommene Karte
   hieße nach dem ersten Punkt am Bauort „unvollständig“. Jede Linie für sich
   gerechnet gibt für die Planung immer dieselbe Liste. */
const linienVon = x => (x && x.length && Array.isArray(x[0]) ? x : [x || []]).filter(l => l.length);

/** Die Kacheln mehrerer Linien, ohne Doppel, von grob nach fein */
export function kachellisteLinien(linien, o = {}) {
  const gesehen = new Set();
  const liste = [];
  for (const linie of linienVon(linien)) {
    for (const k of kachelliste(linie, o)) {
      const schluessel = `${k.z}/${k.x}/${k.y}`;
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      liste.push(k);
    }
  }
  /* Nach Zoom geordnet, BEVOR gedeckelt wird: der Deckel soll die feinsten
     Stufen kappen und nicht die Übersicht der letzten Linie. */
  return liste.sort((a, b) => a.z - b.z);
}

/** Stützpunkte längs des Linienzuges, höchstens `schritt` Meter auseinander */
function* abtasten(punkte, schritt) {
  if (punkte.length === 1) { yield punkte[0]; return; }
  for (let i = 1; i < punkte.length; i++) {
    const a = punkte[i - 1], b = punkte[i];
    const d = distanz(a, b);
    const n = Math.max(1, Math.ceil(d / Math.max(1, schritt)));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      yield { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
  }
  yield punkte[punkte.length - 1];
}

/** Die Adresse einer Kachel aus der Vorlage der Basiskarte */
export function kacheladresse(vorlage, { z, x, y }) {
  /* `{s}` ist der Buchstabe des Unterservers. Im Vorrat steht immer `a`, damit
     die Adresse, unter der abgelegt wird, dieselbe ist, mit der die Karte beim
     Lesen nachfragt – der Schlüssel ist die Adresse, ein anderer Buchstabe wäre
     ein Fehlgriff. Deshalb steht in `map.js` bei den Ebenen ebenfalls `a`. */
  return vorlage
    .replace('{s}', 'a')
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

// ---------------------------------------------------------------- Vorladen

/**
 * Den Kachelvorrat für eine Trasse anlegen.
 *
 * `linien` ist eine Punktfolge oder eine Liste davon (`kachellisteLinien`).
 *
 * `beiFortschritt(fertig, gesamt, stand)` wird nach jeder Kachel gerufen;
 * `stand` trägt `geholt`, `vorhanden` und `fehler`. Ohne diese Zahlen wüsste
 * die Anzeige nur, wie viele Abrufe durch sind – und ein Lauf ohne Netz lief
 * bis zum vollen Balken durch, obwohl keine einzige Kachel ankam. Das
 * zurückgegebene Objekt trägt `abbrechen()`; ein abgebrochener Lauf lässt
 * liegen, was schon da ist – halb geholte Karte ist besser als keine.
 *
 * Kacheln, die schon im Vorrat liegen, werden nicht noch einmal geholt. Wer
 * denselben Ausschnitt zweimal mitnimmt, kostet den Anbieter nichts.
 */
export function vorladen(vorlage, kartenId, linien, o = {}) {
  const alle = kachellisteLinien(linien, o);
  const gedeckelt = alle.slice(0, o.hoechstens || HOECHSTENS);
  const beiFortschritt = o.beiFortschritt || (() => {});
  const abbruch = new AbortController();
  let abgebrochen = false;
  let speicherVoll = false;
  /* `vorhanden` zählt, was schon im Gerät lag: zusammen mit `geholt` ist das
     die Zahl, die am Ende wirklich mitgeht. Ohne sie sähe ein zweiter Lauf
     über denselben Ausschnitt aus wie ein misslungener – null geholt. */
  let fertig = 0, geholt = 0, vorhanden = 0, bytes = 0, fehler = 0;

  const lauf = (async () => {
    /* Der Reihe nach von grob nach fein: bricht der Lauf ab oder reißt das
       Netz, liegt wenigstens die Übersicht vollständig da. Umgekehrt hätte man
       Gebäudekacheln ohne die Karte drumherum. */
    const nachZoom = gedeckelt.slice().sort((a, b) => a.z - b.z);
    const warteschlange = nachZoom[Symbol.iterator]();

    async function arbeiter() {
      for (const kachel of warteschlange) {
        if (abgebrochen || speicherVoll) return;
        const url = kacheladresse(vorlage, kachel);
        let ausDemNetz = false;
        try {
          if (await kachelHolen(url)) {
            vorhanden++;
          } else {
            ausDemNetz = true;
            const antwort = await fetch(url, {
              mode: 'cors', credentials: 'omit', signal: abbruch.signal
            });
            if (antwort.ok) {
              const blob = await antwort.blob();
              await kachelAblegen(url, blob, kartenId);
              geholt++; bytes += blob.size;
            } else {
              fehler++;
            }
          }
        } catch (e) {
          if (e && e.name === 'AbortError') return;
          /* Ein volles Gerät bricht den ganzen Lauf ab. Weiterzuladen hieße,
             dem Kartenanbieter noch tausend Kacheln abzuverlangen, um sie
             sofort wegzuwerfen – genau die Art Zugriff, die eine Sperre
             auslöst, und für den Nutzer ohne jeden Ertrag. */
          if (e && (e.name === 'QuotaExceededError'
                    || (e.inner && e.inner.name === 'QuotaExceededError'))) {
            speicherVoll = true;
            return;
          }
          /* Eine einzelne Kachel, die nicht kommt, bricht den Vorrat nicht ab:
             am Ende steht, wie viele fehlen, und der Rest ist brauchbar. */
          fehler++;
        }
        fertig++;
        beiFortschritt(fertig, gedeckelt.length, { geholt, vorhanden, fehler });
        /* Gedrosselt wird nur, was wirklich beim Anbieter geholt wurde. Wer
           denselben Ausschnitt ein zweites Mal mitnimmt, säße sonst minutenlang
           vor einem Balken, hinter dem nichts geschieht. */
        if (PAUSE && ausDemNetz) await new Promise(f => setTimeout(f, PAUSE));
      }
    }

    await Promise.all(Array.from({ length: GLEICHZEITIG }, arbeiter));
    return { fertig, geholt, vorhanden, bytes, fehler, gesamt: gedeckelt.length,
             ausgelassen: alle.length - gedeckelt.length, abgebrochen, speicherVoll };
  })();

  return {
    lauf,
    /* Bricht sofort ab und nicht erst nach der laufenden Kachel: ein Abruf, der
       an einer schlechten Verbindung hängt, hielte den Knopf sonst minutenlang
       auf „Abbrechen“ – und der Nutzer müsste die Seite neu laden. */
    abbrechen: () => { abgebrochen = true; abbruch.abort(); },
    gesamt: gedeckelt.length,
    ausgelassen: alle.length - gedeckelt.length
  };
}

/** Grober Umfang eines Vorrats, bevor er geholt wird */
export function umfang(linien, o = {}) {
  const alle = kachellisteLinien(linien, o);
  const anzahl = Math.min(alle.length, o.hoechstens || HOECHSTENS);
  /* Mit dem Mittelwert aus dem Kopf dieser Datei. Die Zahl ist eine Schätzung
     und wird als solche angezeigt. */
  return { anzahl, bytes: anzahl * 20 * 1024, ausgelassen: alle.length - anzahl };
}

/** Freier Platz im Gerät, soweit der Browser ihn nennt */
export async function platz() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { belegt: usage || 0, kontingent: quota || 0 };
  } catch (e) {
    return null;
  }
}
