// overpass.js – Zugang zur Overpass-API von OpenStreetMap

/* Zwei Fragen der Planung gehen an denselben Dienst: was einer Funkstrecke im
   Weg steht (oberflaeche.js) und was eine Kabeltrasse kreuzt
   (querungspruefung.js). Der Zugang liegt deshalb hier und nicht bei einem der
   beiden – sonst hätte der zweite Aufrufer die Erfahrungen des ersten mit
   Drosselung und Fristen noch einmal machen müssen.

   Nach außen geht bei jeder Abfrage der Verlauf der geplanten Strecke. Das ist
   die eine Ausnahme von der Zusage „nur der Kartenausschnitt, nie die Position“
   und steht so auch in datenschutz.html, Abschnitt 4. */

/* Zwei Adressen, der Reihe nach: der Hauptdienst drosselt bei Andrang und
   antwortet dann mit einer Fehlermeldung statt mit Daten. Beim Planen am
   Kartentisch ist ein zweiter Anlauf auf einem Spiegel die bessere Antwort als
   eine leere Hindernisliste. Beide sind austauschbar – gefordert ist nur eine
   Overpass-API, die auf `POST data=…` mit `[out:json]` antwortet. */
export const ADRESSEN = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

/* Geduld für einen Abruf. Ohne Frist bleibt eine Anfrage, die der Dienst
   stillschweigend in eine Warteschlange legt, ewig offen – und mit ihr die
   Meldung „wird geholt …“ in der Anzeige. Nach dieser Frist wird der zweite
   Dienst versucht; bleibt auch der stumm, urteilt der Aufrufer ohne die Daten
   und sagt, dass sie fehlten.

   40 s sind gemessen, nicht geschätzt: die öffentlichen Overpass-Instanzen sind
   zeitweise so belastet, dass dieselbe Abfrage über einem Dorf einmal in 1,5 s
   und einmal in 23 s beantwortet wird. Bei 25 s Frist wären die langsamen
   Antworten abgeschnitten worden, obwohl sie noch gekommen wären. */
export const FRIST = 40000;

/* Welche Adresse zuletzt geantwortet hat. Der Hauptdienst drosselt tageweise;
   ohne dieses Merken zahlt jede weitere Abfrage der Sitzung erneut die volle
   Frist, bevor der Spiegel überhaupt gefragt wird. */
let bewaehrt = null;

/**
 * Eine Overpass-Abfrage stellen; bei Ausfall die nächste Adresse versuchen.
 *
 * @param {string} daten  Abfrage in Overpass QL
 * @returns {Promise<object>} geparste Antwort
 */
export async function overpass(daten) {
  let letzter = null;
  const reihe = bewaehrt
    ? [bewaehrt, ...ADRESSEN.filter(a => a !== bewaehrt)]
    : ADRESSEN;
  for (const adresse of reihe) {
    try {
      const r = await fetch(adresse, {
        method: 'POST', body: new URLSearchParams({ data: daten }),
        signal: AbortSignal.timeout(FRIST)
      });
      if (!r.ok) throw new Error(`Overpass ${r.status}`);
      const antwort = await r.json();
      bewaehrt = adresse;
      return antwort;
    } catch (fehler) { letzter = fehler; }
  }
  throw letzter || new Error('Overpass nicht erreichbar');
}

/**
 * Umschließendes Rechteck einer Punktfolge als Overpass-Filter `(süd,west,nord,ost)`.
 * Der Zuschlag in Grad hält Objekte im Bild, die knapp über den Rand ragen.
 */
export function rechteck(punkte, zuschlag = 0) {
  const lat = punkte.map(p => p.lat), lng = punkte.map(p => p.lng);
  return '(' + [
    Math.min(...lat) - zuschlag, Math.min(...lng) - zuschlag,
    Math.max(...lat) + zuschlag, Math.max(...lng) + zuschlag
  ].map(w => w.toFixed(5)).join(',') + ')';
}

/**
 * Ringe eines Overpass-Objekts. Bei Relationen zählen die äußeren Ringe;
 * Innenringe (Lichtungen, Höfe) bleiben unberücksichtigt – sie würden die
 * Fläche kleiner machen, und die vorsichtige Seite ist die größere.
 */
export function ringe(o) {
  if (o.type === 'way' && o.geometry) return [o.geometry];
  if (o.type === 'relation' && Array.isArray(o.members)) {
    return o.members.filter(m => m.geometry && m.role !== 'inner').map(m => m.geometry);
  }
  return [];
}
