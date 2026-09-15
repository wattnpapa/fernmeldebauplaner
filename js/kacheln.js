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
  return imLager('readwrite', lager => {
    lager.put({ url, blob, karte, zeit: Date.now(), groesse: blob.size });
  });
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
  return imLager('readwrite', lager => { lager.clear(); });
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
 * `beiFortschritt(fertig, gesamt)` wird nach jeder Kachel gerufen. Das
 * zurückgegebene Objekt trägt `abbrechen()`; ein abgebrochener Lauf lässt
 * liegen, was schon da ist – halb geholte Karte ist besser als keine.
 *
 * Kacheln, die schon im Vorrat liegen, werden nicht noch einmal geholt. Wer
 * denselben Ausschnitt zweimal mitnimmt, kostet den Anbieter nichts.
 */
export function vorladen(vorlage, kartenId, punkte, o = {}) {
  const alle = kachelliste(punkte, o);
  const gedeckelt = alle.slice(0, o.hoechstens || HOECHSTENS);
  const beiFortschritt = o.beiFortschritt || (() => {});
  const abbruch = new AbortController();
  let abgebrochen = false;
  let speicherVoll = false;
  let fertig = 0, geholt = 0, bytes = 0, fehler = 0;

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
          if (!(await kachelHolen(url))) {
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
        beiFortschritt(fertig, gedeckelt.length);
        /* Gedrosselt wird nur, was wirklich beim Anbieter geholt wurde. Wer
           denselben Ausschnitt ein zweites Mal mitnimmt, säße sonst minutenlang
           vor einem Balken, hinter dem nichts geschieht. */
        if (PAUSE && ausDemNetz) await new Promise(f => setTimeout(f, PAUSE));
      }
    }

    await Promise.all(Array.from({ length: GLEICHZEITIG }, arbeiter));
    return { fertig, geholt, bytes, fehler, gesamt: gedeckelt.length,
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
export function umfang(punkte, o = {}) {
  const alle = kachelliste(punkte, o);
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
