// ortssuche.js – Adresse oder Ortsname in eine Koordinate wandeln (Nominatim)

/* Am Kartentisch kommt ein Aufbauplatz selten als Koordinate an, sondern als
   „Feuerwehrhaus Musterstadt, Hauptstraße 12“. Bis hierher musste man den Ort
   auf der Karte suchen oder die Koordinate aus einer anderen Anwendung holen.
   Die Suche geht an Nominatim, den Geokodierer der OpenStreetMap Foundation.

   Das ist eine Außenverbindung mit Planungsinhalt: nach außen geht der
   SUCHTEXT, also der Name eines Ortes, an dem gebaut werden soll. Sie ist
   deshalb in datenschutz.html (Abschnitt 4) als Ausnahme aufgeführt und läuft
   nur auf ausdrücklichen Knopfdruck – nie beim Tippen, nie beim Verlassen des
   Feldes. Eine Suche beim Tippen sähe nach Komfort aus und schickte jeden
   halbfertigen Ortsnamen hinaus.

   Nominatim verlangt in seinen Nutzungsbedingungen höchstens eine Anfrage je
   Sekunde und eine erkennbare Anwendung. Den Referer schickt der Browser von
   selbst; ein eigener User-Agent lässt sich aus dem Browser heraus nicht
   setzen. Die Bremse steht hier, damit ein Doppeltipp nicht zwei Anfragen
   auslöst. */

export const ADRESSE = 'https://nominatim.openstreetmap.org/search';

/* Kurze Frist: die Suche ist ein Dialog, und wer zehn Sekunden auf eine
   Ortsliste wartet, hat den Ort längst auf der Karte gefunden. */
const FRIST = 12000;
const ABSTAND = 1100;
const HOECHSTENS = 6;

let zuletzt = 0;

/**
 * Orte zu einem Suchtext.
 *
 * @param {string} text  Adresse oder Ortsname, wie eingegeben
 * @returns {Promise<Array<{name:string,lat:number,lng:number,art:string}>>}
 *          leer, wenn nichts gefunden wurde; wirft bei Netz- oder Dienstfehler
 */
export async function ortSuchen(text) {
  const frage = (text || '').trim();
  if (!frage) return [];
  const warten = ABSTAND - (Date.now() - zuletzt);
  if (warten > 0) await new Promise(r => setTimeout(r, warten));
  zuletzt = Date.now();

  const url = new URL(ADRESSE);
  url.searchParams.set('q', frage);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(HOECHSTENS));
  url.searchParams.set('accept-language', 'de');
  /* Kein Ländervorfilter: der Fernmeldebau kennt auch den Einsatz jenseits der
     Grenze, und ein Treffer im Nachbarland ist besser als kein Treffer. */
  const antwort = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(FRIST)
  });
  if (!antwort.ok) throw new Error(`Nominatim antwortet mit ${antwort.status}`);
  const liste = await antwort.json();
  return (Array.isArray(liste) ? liste : [])
    .map(t => ({
      name: String(t.display_name || ''),
      lat: Number(t.lat), lng: Number(t.lon),
      art: String(t.type || t.category || '')
    }))
    .filter(t => isFinite(t.lat) && isFinite(t.lng));
}

/** Kurzform eines Treffers für Listen: die ersten drei Glieder der Anschrift. */
export function trefferKurz(t) {
  const teile = t.name.split(',').map(s => s.trim()).filter(Boolean);
  return teile.slice(0, 3).join(', ') || t.name;
}

/** Quellenangabe, wie sie neben jeder Trefferliste stehen muss. */
export const ORTSSUCHE_QUELLE = 'Ortssuche: Nominatim, © OpenStreetMap-Mitwirkende';
