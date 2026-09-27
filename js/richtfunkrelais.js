// richtfunkrelais.js – Zwischenstandort für eine Richtfunkstrecke, die das Gelände verdeckt

/* Wenn die Sichtlinie zwischen zwei Aufbauplätzen nicht frei ist, bleibt am
   Kartentisch die Frage: wohin mit einem dritten Mast, damit zwei Teilstrecken
   tragen? Die Antwort steckt in zwei Funksichtflächen (funksicht.js): eine von
   A aus, eine von B aus – und ein Zwischenstandort ist jeder Ort, der in beiden
   liegt. Diese Schnittmenge wird hier gebildet, in zusammenhängende Bereiche
   zerlegt und je Bereich auf einen Vorschlag verdichtet.

   Was das Verfahren nicht ist: eine Standortwahl. Ob der Ort erreichbar ist,
   ob dort ein Mast stehen darf und ob nicht ein Waldrand die Sicht nimmt, steht
   in keinem Höhenmodell. Der Vorschlag ist ein technischer Kandidat – das
   Wort steht deshalb in jedem Satz, der ihn nennt. Ein zweites, das er nicht
   ist: eine Rechnung über Bewuchs. Die Funksicht rechnet über das nackte
   Gelände, und wo sie frei sagt, kann ein Gehölz das Gegenteil sagen. Die
   Teilstrecken bekommen, sobald sie angelegt sind, den vollen Geländeschnitt
   mit Oberfläche – das ist der Ort, an dem der Kandidat sich bewähren muss. */

import { funksicht, SICHT, UMKREIS_HOECHSTENS } from './funksicht.js';
import { rasterGitter, eckenFuer } from './hoehe.js';
import { distanz } from './geo.js';

/* Mehr als eine Handvoll Vorschläge liest niemand; die Fläche auf der Karte
   zeigt ohnehin alle Bereiche. */
export const KANDIDATEN_HOECHSTENS = 6;

/* Ein einzelnes Rasterfeld von 25 m ist ein Rechenrest, kein Standort:
   benachbarte Strahlen der beiden Sichtprüfungen treffen sich dort zufällig.
   Erst ein Bereich, der einen Mast samt Abspannung fasst, gilt als Vorschlag. */
const MINDESTZELLEN = 6;

/**
 * Bereiche, von denen aus beide Aufbauplätze in freier Funksicht liegen.
 *
 * Der Umkreis der beiden Sichtprüfungen ist die Distanz der Strecke selbst:
 * ein Zwischenstandort, der von einem Ende weiter entfernt liegt als das
 * andere Ende, verlängert die Strecke, ohne etwas zu gewinnen. Ein Mindestmaß
 * hält kurze Strecken auf einem Umkreis, in dem überhaupt Fläche entsteht.
 *
 * @param {{lat:number,lng:number}} a  Aufbauplatz A
 * @param {number} hA                  Antennenhöhe an A über Grund
 * @param {{lat:number,lng:number}} b  Aufbauplatz B
 * @param {number} hB                  Antennenhöhe an B über Grund
 * @param {number} mhz                 Mittenfrequenz des Bandes
 * @param {number} mast                angenommene Antennenhöhe am Zwischenstandort
 * @returns {Promise<object|null>} `beide[i] === 1` heißt: von hier aus sind
 *          beide Enden frei; `kandidaten` nach Gesamtlänge geordnet. `null`,
 *          wenn für eines der Enden keine Höhen zu bekommen waren.
 */
export async function zwischenstandorte(a, hA, b, hB, mhz, mast) {
  const D = distanz(a, b);
  const r = Math.min(UMKREIS_HOECHSTENS, Math.max(1000, D));
  const [ea, eb] = await Promise.all([
    funksicht(a, hA, mhz, r, mast),
    funksicht(b, hB, mhz, r, mast)
  ]);
  if (!ea || !eb) return null;

  /* Beide Rasterblöcke liegen auf demselben Weltpixelgitter (hoehe.js rechnet
     auf fester Zoomstufe) – die Schnittmenge ist ein ganzzahliger Ausschnitt,
     nichts wird umgerechnet oder interpoliert. */
  const x0 = Math.max(ea.x0, eb.x0), y0 = Math.max(ea.y0, eb.y0);
  const x1 = Math.min(ea.x0 + ea.spalten, eb.x0 + eb.spalten);
  const y1 = Math.min(ea.y0 + ea.zeilen, eb.y0 + eb.zeilen);
  const leer = {
    beide: new Uint8Array(0), spalten: 0, zeilen: 0, x0, y0,
    ecken: eckenFuer(x0, y0, 0, 0), kandidaten: [], bereiche: 0, zellen: 0,
    umkreis: r, mast, distanz: D, fehlend: (ea.fehlend || 0) + (eb.fehlend || 0)
  };
  if (x1 <= x0 || y1 <= y0) return leer;
  const spalten = x1 - x0, zeilen = y1 - y0;

  const beide = new Uint8Array(spalten * zeilen);
  let zellen = 0;
  for (let j = 0; j < zeilen; j++) {
    const za = (j + y0 - ea.y0) * ea.spalten + (x0 - ea.x0);
    const zb = (j + y0 - eb.y0) * eb.spalten + (x0 - eb.x0);
    for (let i = 0; i < spalten; i++) {
      if (ea.stufen[za + i] === SICHT && eb.stufen[zb + i] === SICHT) {
        beide[j * spalten + i] = 1; zellen++;
      }
    }
  }
  if (!zellen) return { ...leer, beide, spalten, zeilen, ecken: eckenFuer(x0, y0, spalten, zeilen) };

  /* Zusammenhängende Bereiche, vier Nachbarn, mit eigenem Stapel statt
     Rekursion – ein Bereich kann hunderttausend Zellen haben. Je Bereich wird
     die Zelle gemerkt, die die Gesamtstrecke A–R–B am wenigsten verlängert:
     gerechnet in Zellen, das genügt für die Wahl; die Meter kommen erst für
     die Gewinner. */
  const ax = ea.x0 + (ea.spalten - 1) / 2 - x0, ay = ea.y0 + (ea.zeilen - 1) / 2 - y0;
  const bx = eb.x0 + (eb.spalten - 1) / 2 - x0, by = eb.y0 + (eb.zeilen - 1) / 2 - y0;
  const besucht = new Uint8Array(beide.length);
  const stapel = new Int32Array(beide.length);
  const bereiche = [];
  for (let start = 0; start < beide.length; start++) {
    if (!beide[start] || besucht[start]) continue;
    let n = 0, groesse = 0, beste = -1, besteWeg = Infinity;
    stapel[n++] = start; besucht[start] = 1;
    while (n) {
      const idx = stapel[--n];
      groesse++;
      const i = idx % spalten, j = (idx - i) / spalten;
      const weg = Math.hypot(i - ax, j - ay) + Math.hypot(i - bx, j - by);
      if (weg < besteWeg) { besteWeg = weg; beste = idx; }
      const nachbarn = [idx - 1, idx + 1, idx - spalten, idx + spalten];
      if (i === 0) nachbarn[0] = -1;
      if (i === spalten - 1) nachbarn[1] = -1;
      for (const nb of nachbarn) {
        if (nb < 0 || nb >= beide.length || !beide[nb] || besucht[nb]) continue;
        besucht[nb] = 1; stapel[n++] = nb;
      }
    }
    if (groesse >= MINDESTZELLEN) bereiche.push({ groesse, beste });
  }

  const { lats, lngs } = rasterGitter({ x0, y0, spalten, zeilen });
  const kandidaten = bereiche.map(be => {
    const i = be.beste % spalten, j = (be.beste - i) / spalten;
    const ort = { lat: lats[j], lng: lngs[i] };
    const dA = distanz(a, ort), dB = distanz(ort, b);
    return {
      lat: ort.lat, lng: ort.lng,
      dA, dB, gesamt: dA + dB,
      flaeche: be.groesse * ea.meterJeZelle * ea.meterJeZelle
    };
  }).sort((p, q) => p.gesamt - q.gesamt).slice(0, KANDIDATEN_HOECHSTENS);

  return {
    beide, spalten, zeilen, x0, y0,
    ecken: eckenFuer(x0, y0, spalten, zeilen),
    kandidaten, bereiche: bereiche.length, zellen,
    umkreis: r, mast, distanz: D,
    fehlend: (ea.fehlend || 0) + (eb.fehlend || 0)
  };
}

const km = m => (Math.round(m / 100) / 10).toLocaleString('de-DE') + ' km';
const meterText = m => (Math.round(m * 10) / 10).toLocaleString('de-DE') + ' m';

/** Der Satz zur Fläche – gleicher Wortlaut auf Schirm und Blatt. */
export function zwischenText(e) {
  if (!e) return 'Für eines der beiden Enden liegen keine Geländehöhen vor.';
  const mast = meterText(e.mast);
  if (!e.kandidaten.length) {
    return `Im Umkreis von ${km(e.umkreis)} um beide Aufbauplätze gibt es keinen ` +
      `Bereich, von dem aus beide Enden mit ${mast} Antennenhöhe frei in Funksicht ` +
      'liegen. Ein höherer Mast an einem der Enden oder ein zweiter Zwischenstandort ' +
      'wären die nächsten Fragen.';
  }
  const n = e.bereiche;
  return `${n === 1 ? 'Ein Bereich' : `${n} Bereiche`} mit freier Funksicht zu beiden ` +
    `Aufbauplätzen, gerechnet mit ${mast} Antennenhöhe am Zwischenstandort und über ` +
    'nacktem Gelände. Die Nummern sind technische Kandidaten, keine Standortwahl: ' +
    'Bewuchs, Bebauung, Zufahrt und Erlaubnis stehen in keinem Höhenmodell.';
}

/** Eine Zeile je Kandidat: „A–R 3,2 km · R–B 11,5 km · gesamt 14,7 km“ */
export function kandidatText(k) {
  return `A–R ${km(k.dA)} · R–B ${km(k.dB)} · gesamt ${km(k.gesamt)}`;
}
