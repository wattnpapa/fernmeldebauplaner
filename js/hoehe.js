// hoehe.js – Geländehöhe aus Höhenkacheln: Punkthöhe und Streckenprofil

import { distanz } from './geo.js';

/* Die Höhe kommt aus Kacheln, nicht aus einer Punkt-API. Ein Richtfunkprofil
   braucht mehrere hundert Stützpunkte, und die sollen sich beim Ziehen eines
   Endpunkts sofort neu rechnen – eine Punktabfrage je Stützpunkt wäre schon
   bei der ersten Strecke am Tageslimit jedes öffentlichen Dienstes. Eine
   Kachel dagegen wird einmal geholt, danach ist jede Höhe eine Pixellese im
   Speicher. Nach außen geht dabei nur eine Kachelanfrage wie bei der Karte
   selbst; der Anbieter sieht den Ausschnitt, nicht die abgefragte Position.

   Die „Terrain Tiles“ auf AWS Open Data liegen im Terrarium-Format: ein PNG,
   in dem die Höhe in den Farbkanälen steckt. In Deutschland stammen sie aus
   dem EU-DEM mit rund 25 m Raster; Zoom 12 (etwa 25 m je Pixel auf unserer
   Breite) holt davon alles heraus, ohne größere Kacheln zu laden. */

const QUELLE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const ZOOM = 12;
const KANTE = 256;

// ---------------------------------------------------------------- Kachel-Cache

/* Der Cache hält Promises, nicht fertige Bilder: Bewegt sich der Mauszeiger
   über eine noch ladende Kachel, hängen sich alle Anfragen an dieselbe
   Übertragung, statt sie zehnmal anzustoßen. Eine fehlgeschlagene Kachel
   bleibt als `null` stehen – ein Dienst, der gerade nicht antwortet, soll
   nicht bei jeder Mausbewegung erneut angefragt werden. */
const kacheln = new Map();
const fehlversuche = new Set();
const HOECHSTENS = 64;   // 64 × 256 KB Pixeldaten sind ein vertretbarer Speicher

function kachelSchluessel(x, y) { return `${ZOOM}/${x}/${y}`; }

function kachelHolen(x, y) {
  const schluessel = kachelSchluessel(x, y);
  if (kacheln.has(schluessel)) {
    // Zuletzt Gebrauchtes ans Ende, damit die Verdrängung das Älteste trifft
    const p = kacheln.get(schluessel);
    kacheln.delete(schluessel); kacheln.set(schluessel, p);
    return p;
  }
  const url = QUELLE.replace('{z}', ZOOM).replace('{x}', x).replace('{y}', y);
  const p = fetch(url)
    .then(r => r.ok ? r.blob() : Promise.reject(new Error(`Höhenkachel ${r.status}`)))
    .then(createImageBitmap)
    .then(bild => {
      const c = document.createElement('canvas');
      c.width = KANTE; c.height = KANTE;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bild, 0, 0);
      bild.close?.();
      return ctx.getImageData(0, 0, KANTE, KANTE).data;
    })
    .catch(() => null);
  p.then(daten => { if (!daten) fehlversuche.add(schluessel); });
  kacheln.set(schluessel, p);
  if (kacheln.size > HOECHSTENS) kacheln.delete(kacheln.keys().next().value);
  return p;
}

/**
 * Fehlversuche vergessen, damit der nächste Abruf sie wirklich wiederholt.
 *
 * Der Zwischenspeicher behält eine gescheiterte Kachel mit Absicht – sonst
 * fragte jede Mausbewegung über einer Lücke erneut an. Hinter einem Knopf
 * „Erneut versuchen“ steht aber kein Zufall, sondern jemand, der gerade
 * gesehen hat, dass es nicht ging: für ihn wäre der gemerkte Fehlschlag eine
 * Sackgasse bis zum Neuladen der Seite.
 */
export function kachelfehlerVergessen() {
  for (const k of fehlversuche) kacheln.delete(k);
  fehlversuche.clear();
}

// ---------------------------------------------------------------- Projektion

/* Web-Mercator in Weltpixel auf Zoomstufe ZOOM – dieselbe Rechnung, mit der
   Leaflet die Kartenkacheln adressiert, nur ohne die Karte zu bemühen. */
function weltPixel(lat, lng) {
  const n = Math.pow(2, ZOOM) * KANTE;
  const phi = lat * Math.PI / 180;
  return {
    x: (lng + 180) / 360 * n,
    y: (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * n
  };
}

/* Bilineare Interpolation greift auf vier Pixel zu, die auch in zwei oder
   vier Nachbarkacheln liegen können. Deshalb wird jedes Pixel einzeln über
   seine Kachel aufgelöst, statt eine Kachel zu wählen und am Rand zu raten. */
function pixelKacheln(px, py) {
  const x0 = Math.floor(px - 0.5), y0 = Math.floor(py - 0.5);
  const menge = new Map();
  for (const [x, y] of [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]]) {
    const kx = Math.floor(x / KANTE), ky = Math.floor(y / KANTE);
    menge.set(kachelSchluessel(kx, ky), [kx, ky]);
  }
  return [...menge.values()];
}

function pixelWert(daten, px, py) {
  const kx = Math.floor(px / KANTE), ky = Math.floor(py / KANTE);
  const d = daten.get(kachelSchluessel(kx, ky));
  if (!d) return null;
  const i = ((py - ky * KANTE) * KANTE + (px - kx * KANTE)) * 4;
  return (d[i] * 256 + d[i + 1] + d[i + 2] / 256) - 32768;
}

function interpoliert(daten, lat, lng) {
  const { x, y } = weltPixel(lat, lng);
  const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5);
  const fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  const h00 = pixelWert(daten, x0, y0),     h10 = pixelWert(daten, x0 + 1, y0);
  const h01 = pixelWert(daten, x0, y0 + 1), h11 = pixelWert(daten, x0 + 1, y0 + 1);
  if ([h00, h10, h01, h11].some(h => h === null)) return null;
  return (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
}

/* `beiKachel` meldet, wie viele der nötigen Kacheln da sind. Das ist die
   einzige Stelle, an der ein Fortschritt überhaupt zu haben ist: wie lange ein
   Profil braucht, hängt nicht an seinen Stützpunkten, sondern daran, wie viele
   Kacheln dafür über das Netz müssen – und die kommen einzeln an. */
async function kachelnFuer(punkte, beiKachel) {
  const noetig = new Map();
  for (const p of punkte) {
    const { x, y } = weltPixel(p.lat, p.lng);
    for (const [kx, ky] of pixelKacheln(x, y)) noetig.set(kachelSchluessel(kx, ky), [kx, ky]);
  }
  const daten = new Map();
  let fertig = 0;
  await Promise.all([...noetig].map(async ([schluessel, [kx, ky]]) => {
    daten.set(schluessel, await kachelHolen(kx, ky));
    if (beiKachel) beiKachel(++fertig, noetig.size);
  }));
  return daten;
}

// ---------------------------------------------------------------- Rasterblock

/* Kantenlänge einer Kachelzelle in Metern. Web-Mercator staucht mit der Breite,
   deshalb hängt der Wert am Ort: auf 48° sind es rund 25,8 m, auf 54° rund 22,2 m.
   Genau diese Zahl ist der Maßstab, in dem eine Sichtprüfung rechnet – sie steht
   deshalb hier und wird nicht beim Aufrufer noch einmal hergeleitet. */
export function meterJePixel(lat) {
  return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, ZOOM);
}

/* Umkehrung von weltPixel – der Rasterblock muss als Bild auf die Karte gelegt
   werden, und Leaflet will dafür geografische Ecken, keine Pixel. */
function weltPixelZurueck(x, y) {
  const n = Math.pow(2, ZOOM) * KANTE;
  const lng = x / n * 360 - 180;
  const k = Math.PI - 2 * Math.PI * y / n;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(k) - Math.exp(-k)));
  return { lat, lng };
}

/**
 * Zusammenhängendes Höhenraster um einen Punkt, Kantenlänge `meterJePixel(lat)`.
 * Liefert `{ werte, spalten, zeilen, mitteX, mitteY, meterJeZelle, ecken, fehlend }`
 * mit `werte` als Float32Array in Zeilenordnung; fehlende Höhen stehen als NaN.
 * `ecken` sind Süd-West und Nord-Ost des Blocks für die Kartenüberlagerung.
 *
 * Anders als profil() wird hier nicht interpoliert, sondern die Kachelzelle
 * genommen, wie sie ist: eine Sichtprüfung liest jede Zelle einmal, und eine
 * bilineare Glättung würde Kuppen abtragen – gerade die entscheiden.
 */
export async function raster(mitte, radiusM) {
  const mjp = meterJePixel(mitte.lat);
  const r = Math.ceil(radiusM / mjp);
  const { x: mx, y: my } = weltPixel(mitte.lat, mitte.lng);
  const x0 = Math.round(mx) - r, y0 = Math.round(my) - r;
  const spalten = 2 * r + 1, zeilen = 2 * r + 1;

  const noetig = new Map();
  for (let ky = Math.floor(y0 / KANTE); ky <= Math.floor((y0 + zeilen - 1) / KANTE); ky++) {
    for (let kx = Math.floor(x0 / KANTE); kx <= Math.floor((x0 + spalten - 1) / KANTE); kx++) {
      noetig.set(kachelSchluessel(kx, ky), [kx, ky]);
    }
  }
  const daten = new Map();
  await Promise.all([...noetig].map(async ([schluessel, [kx, ky]]) => {
    daten.set(schluessel, await kachelHolen(kx, ky));
  }));

  const werte = new Float32Array(spalten * zeilen);
  let fehlend = 0;
  for (let j = 0; j < zeilen; j++) {
    for (let i = 0; i < spalten; i++) {
      const h = pixelWert(daten, x0 + i, y0 + j);
      if (h === null) fehlend++;
      werte[j * spalten + i] = h === null ? NaN : h;
    }
  }
  return {
    werte, spalten, zeilen,
    mitteX: r, mitteY: r,
    meterJeZelle: mjp,
    fehlend,
    /* Der Ursprung in Weltpixeln der festen Zoomstufe. Zwei Rasterblöcke liegen
       damit auf demselben Gitter und lassen sich über ganzzahlige Versätze
       übereinanderlegen – das braucht die Überdeckung mehrerer Relaisstellen
       (siehe `ueberdeckung` in ausbreitung.js). Über die Ecken ginge das nur
       mit einer Rückrechnung, die auf halbe Zellen führt. */
    x0, y0,
    ecken: [weltPixelZurueck(x0, y0 + zeilen), weltPixelZurueck(x0 + spalten, y0)]
  };
}

/**
 * Süd-West- und Nord-Ost-Ecke eines Blocks von `spalten` × `zeilen` Zellen ab
 * dem Weltpixel (x0, y0) – die Form, in der Leaflet eine Überlagerung erwartet.
 *
 * Ein `raster()` bringt seine Ecken schon mit. Gebraucht wird das hier für
 * Felder, die aus mehreren Blöcken zusammengesetzt wurden und deshalb zu keinem
 * einzelnen Rasterblock mehr gehören (siehe `ueberdeckung` in ausbreitung.js).
 */
export function eckenFuer(x0, y0, spalten, zeilen) {
  return [weltPixelZurueck(x0, y0 + zeilen), weltPixelZurueck(x0 + spalten, y0)];
}

/**
 * Die Orte der Zellenmitten eines Rasterblocks – nach Zeilen und Spalten
 * getrennt, nicht als Feld von Punkten.
 *
 * Das ist kein Sparsamkeitstrick, sondern folgt aus der Projektion: in
 * Web-Mercator hängt die geografische Breite allein an der Zeile und die Länge
 * allein an der Spalte. Ein Block mit 800 × 800 Zellen braucht deshalb 1.600
 * Umrechnungen und nicht 640.000 – und wer die Orte danach zeilenweise
 * durchgeht, setzt sie aus zwei Zahlen zusammen. Gebraucht wird das, um zu
 * einem Höhenraster die passenden Oberflächenhöhen zu holen
 * (`oberflaechenraster` in oberflaeche.js).
 */
export function rasterGitter(bild) {
  const lats = new Float64Array(bild.zeilen);
  const lngs = new Float64Array(bild.spalten);
  for (let j = 0; j < bild.zeilen; j++) lats[j] = weltPixelZurueck(0, bild.y0 + j + 0.5).lat;
  for (let i = 0; i < bild.spalten; i++) lngs[i] = weltPixelZurueck(bild.x0 + i + 0.5, 0).lng;
  return { lats, lngs };
}

/* Wie viele Kacheln ein Umkreis kostet – der Aufrufer soll vor dem Abruf sagen
   können, was er anstößt, statt den Nutzer in eine unbestimmte Wartezeit zu
   schicken. Der Cache oben hält 64 Kacheln; darüber verdrängt sich der Block
   selbst und ein zweiter Abruf lädt neu. */
export function kachelbedarf(lat, radiusM) {
  const r = Math.ceil(radiusM / meterJePixel(lat));
  return Math.pow(Math.ceil((2 * r + 1) / KANTE) + 1, 2);
}

// ---------------------------------------------------------------- Öffentlich

/** Geländehöhe in Metern über NN, `null` wenn keine Kachel zu bekommen ist. */
export async function hoeheAn(lat, lng) {
  const daten = await kachelnFuer([{ lat, lng }]);
  return interpoliert(daten, lat, lng);
}

/**
 * Höhenprofil zwischen zwei Punkten, alle `schritt` Meter ein Stützpunkt,
 * Anfang und Ende immer dabei. Jeder Eintrag: { d, lat, lng, h } mit d als
 * Abstand vom Anfang in Metern und h als Höhe (oder null ohne Daten).
 * Die Stützpunkte liegen linear zwischen den Koordinaten – auf
 * Richtfunkdistanzen weicht das nur um Zentimeter von der Großkreislinie ab.
 *
 * `beiKachel(fertig, gesamt)` wird nach jeder eingetroffenen Höhenkachel
 * gerufen, damit der Aufrufer einen Fortschritt anzeigen kann.
 */
export async function profil(a, b, schritt = 25, beiKachel = null) {
  const laenge = distanz(a, b);
  const n = Math.max(1, Math.ceil(laenge / schritt));
  const punkte = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    punkte.push({ d: laenge * t, lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  const daten = await kachelnFuer(punkte, beiKachel);
  return punkte.map(p => ({ ...p, h: interpoliert(daten, p.lat, p.lng) }));
}

/** Quellenangabe für Blattfuß und Lizenzhinweis. */
export const HOEHEN_QUELLE = 'Höhen: Terrain Tiles (AWS Open Data), EU-DEM © EU/Copernicus';
