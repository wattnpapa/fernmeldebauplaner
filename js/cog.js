// cog.js – Lesen einzelner Kacheln aus einem Cloud-Optimized GeoTIFF

/* Warum ein eigener TIFF-Leser und keine Bibliothek: das Projekt kommt ohne
   Paketmanager aus, und der Bedarf ist eng. Gebraucht wird genau eine Sorte
   Datei – das Copernicus-DSM: unkomprimiert wäre es 34 MB je Grad, gepackt
   sind es 30 MB, und davon wird für eine Richtfunkstrecke eine einzige
   1024×1024-Kachel gebraucht. Ein COG erlaubt genau das: Kopf lesen, die
   Byte-Bereiche der Kacheln nachschlagen, die eine Kachel per Range-Anfrage
   holen. Eine ausgewachsene GeoTIFF-Bibliothek in vendor/ könnte alle
   Kompressionen und Farbmodelle, die hier keine Rolle spielen.

   Unterstützt wird deshalb nur, was in diesen Dateien vorkommt und was der
   Browser von sich aus kann: Little Endian, Deflate (DecompressionStream),
   Float32, Fließkomma-Prädiktor. Alles andere wirft – lieber eine klare
   Fehlmeldung als ein stillschweigend falscher Höhenwert. */

const TAG = {
  breite: 256, hoehe: 257, bitsProProbe: 258, kompression: 259,
  probenProPixel: 277, praediktor: 317,
  kachelBreite: 322, kachelHoehe: 323, kachelVersatz: 324, kachelLaenge: 325,
  probenformat: 339, pixelmass: 33550, passpunkt: 33922
};

/* Typgrößen der TIFF-Feldtypen, so weit sie in diesen Dateien auftreten. */
const TYPGROESSE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 };

/* Frist wie bei den übrigen Abrufen: eine Kachel von einigen Megabyte darf
   dauern, aber nicht endlos – sonst steht die Anzeige still. */
const FRIST = 25000;

async function bereich(url, von, bis) {
  const r = await fetch(url, {
    headers: { Range: `bytes=${von}-${bis}` },
    signal: AbortSignal.timeout(FRIST)
  });
  if (!r.ok) throw new Error(`COG ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function feldWerte(sicht, roh, typ, anzahl, versatz, kopfVersatz) {
  const groesse = TYPGROESSE[typ] || 1;
  /* Bis vier Byte stehen die Werte im Feld selbst, darüber steht dort ein
     Zeiger in die Datei. Der Kopfpuffer beginnt bei kopfVersatz, deshalb wird
     der Zeiger vor dem Zugriff dorthin zurückgerechnet. */
  const p = groesse * anzahl <= 4 ? versatz : sicht.getUint32(versatz, true) - kopfVersatz;
  const aus = [];
  for (let i = 0; i < anzahl; i++) {
    const q = p + i * groesse;
    if (q < 0 || q + groesse > roh.length) return null;   // liegt außerhalb des Kopfes
    if (typ === 3) aus.push(sicht.getUint16(q, true));
    else if (typ === 4) aus.push(sicht.getUint32(q, true));
    else if (typ === 12) aus.push(sicht.getFloat64(q, true));
    else if (typ === 16) aus.push(Number(sicht.getBigUint64(q, true)));
    else aus.push(sicht.getUint8(q));
  }
  return aus;
}

/* Wie viel vom Dateianfang geholt wird, um Kopf und erstes Verzeichnis zu
   haben. Die Kachelverzeichnisse eines COG stehen unmittelbar hinter dem Kopf;
   256 KB decken auch Dateien mit mehreren hundert Kacheln ab. Kommt der Wert
   eines Feldes trotzdem außerhalb zu liegen, meldet feldWerte das, statt zu raten. */
const KOPF = 262144;

/**
 * Kopf eines COG lesen. Liefert die Angaben der höchsten Auflösungsstufe und
 * eine Funktion, die einzelne Kacheln nachlädt.
 *
 * @param {string} url  Adresse der Datei, Range-Anfragen müssen erlaubt sein
 */
export async function oeffnen(url) {
  const roh = await bereich(url, 0, KOPF - 1);
  const sicht = new DataView(roh.buffer, roh.byteOffset, roh.byteLength);
  if (sicht.getUint16(0, true) !== 0x4949 || sicht.getUint16(2, true) !== 42) {
    throw new Error('Kein Little-Endian-TIFF');
  }

  const versatz = sicht.getUint32(4, true);
  const anzahl = sicht.getUint16(versatz, true);
  const felder = new Map();
  for (let i = 0; i < anzahl; i++) {
    const p = versatz + 2 + i * 12;
    const marke = sicht.getUint16(p, true);
    const typ = sicht.getUint16(p + 2, true);
    const n = sicht.getUint32(p + 4, true);
    felder.set(marke, feldWerte(sicht, roh, typ, n, p + 8, 0));
  }
  const eins = m => { const w = felder.get(m); return w ? w[0] : null; };

  if (eins(TAG.kompression) !== 8 && eins(TAG.kompression) !== 32946) {
    throw new Error(`Kompression ${eins(TAG.kompression)} wird nicht gelesen`);
  }
  if (eins(TAG.probenformat) !== 3 || eins(TAG.bitsProProbe) !== 32) {
    throw new Error('Nur 32-Bit-Fließkomma wird gelesen');
  }
  if ((eins(TAG.probenProPixel) || 1) !== 1) throw new Error('Nur einkanalige Raster');

  const mass = felder.get(TAG.pixelmass);
  const pass = felder.get(TAG.passpunkt);
  if (!mass || !pass) throw new Error('Datei ohne Georeferenz');

  return {
    url,
    breite: eins(TAG.breite), hoehe: eins(TAG.hoehe),
    kachelBreite: eins(TAG.kachelBreite), kachelHoehe: eins(TAG.kachelHoehe),
    praediktor: eins(TAG.praediktor) || 1,
    versaetze: felder.get(TAG.kachelVersatz),
    laengen: felder.get(TAG.kachelLaenge),
    /* Nordwestecke des Rasters und Kantenlänge einer Zelle in Grad. Die Zeilen
       laufen nach Süden, deshalb geht die Breite mit Minus ein. */
    westen: pass[3], norden: pass[4],
    schrittLng: mass[0], schrittLat: mass[1]
  };
}

/* Fließkomma-Prädiktor (TIFF 3): der Packer legt die Bytes einer Zeile nach
   Wertigkeit sortiert ab – erst alle höchstwertigen, dann die nächsten – und
   speichert je Byteebene nur die Differenz zum Vorgänger. Das packt sich weit
   besser, muss aber in genau dieser Reihenfolge zurückgenommen werden:
   erst die Differenzen aufaddieren, dann die Byteebenen wieder verschränken. */
function praediktorZuruecknehmen(bytes, breite, zeilen) {
  const proZeile = breite * 4;
  const zeile = new Uint8Array(proZeile);
  for (let y = 0; y < zeilen; y++) {
    const a = y * proZeile;
    for (let i = 1; i < proZeile; i++) bytes[a + i] = (bytes[a + i] + bytes[a + i - 1]) & 0xff;
    zeile.set(bytes.subarray(a, a + proZeile));
    for (let i = 0; i < breite; i++) {
      /* Ebene 0 trägt das höchstwertige Byte; im Speicher liegt Float32
         hier little-endian, deshalb wandert sie an die letzte Stelle. */
      for (let b = 0; b < 4; b++) bytes[a + i * 4 + (3 - b)] = zeile[b * breite + i];
    }
  }
}

async function auspacken(daten) {
  const strom = new Blob([daten]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

/* Kachel-Zwischenspeicher als Promise, aus demselben Grund wie in hoehe.js:
   zwei Stützpunkte derselben Strecke liegen fast immer in derselben Kachel,
   und die soll einmal übertragen werden, nicht zweimal. Eine Kachel sind
   4 MB Fließkommazahlen; mehr als vier davon gleichzeitig braucht keine
   Strecke, die dieses Werkzeug beurteilt. */
const kacheln = new Map();
const KACHELN_HOECHSTENS = 4;

function kachel(bild, kx, ky) {
  const spalten = Math.ceil(bild.breite / bild.kachelBreite);
  const nummer = ky * spalten + kx;
  const schluessel = `${bild.url.split('?')[0]}|${nummer}`;
  if (kacheln.has(schluessel)) {
    const p = kacheln.get(schluessel);
    kacheln.delete(schluessel); kacheln.set(schluessel, p);
    return p;
  }
  const laenge = bild.laengen[nummer];
  const p = (async () => {
    if (!laenge) return null;                       // leere Kachel, kommt in COG vor
    const roh = await bereich(bild.url, bild.versaetze[nummer], bild.versaetze[nummer] + laenge - 1);
    const bytes = await auspacken(roh);
    if (bild.praediktor === 3) praediktorZuruecknehmen(bytes, bild.kachelBreite, bild.kachelHoehe);
    return new Float32Array(bytes.buffer, bytes.byteOffset, bild.kachelBreite * bild.kachelHoehe);
  })().catch(() => null);
  kacheln.set(schluessel, p);
  if (kacheln.size > KACHELN_HOECHSTENS) kacheln.delete(kacheln.keys().next().value);
  return p;
}

/**
 * Werte an mehreren Orten. Gearbeitet wird punktweise über die Kachel, die den
 * Ort enthält – ohne Interpolation: bei 30 m Zellenweite würde eine bilineare
 * Glättung genau die Kanten abtragen, um die es hier geht (Dachfirst, Waldrand).
 *
 * @param {object} bild   aus oeffnen()
 * @param {Array<{lat:number,lng:number}>} orte
 * @returns {Promise<Array<number|null>>} Werte in der Reihenfolge der Orte
 */
export async function werteAn(bild, orte) {
  const zellen = orte.map(o => {
    const px = Math.floor((o.lng - bild.westen) / bild.schrittLng);
    const py = Math.floor((bild.norden - o.lat) / bild.schrittLat);
    if (px < 0 || py < 0 || px >= bild.breite || py >= bild.hoehe) return null;
    return { px, py, kx: Math.floor(px / bild.kachelBreite), ky: Math.floor(py / bild.kachelHoehe) };
  });

  const noetig = new Map();
  for (const z of zellen) if (z) noetig.set(`${z.kx}/${z.ky}`, z);
  const daten = new Map();
  await Promise.all([...noetig].map(async ([k, z]) => daten.set(k, await kachel(bild, z.kx, z.ky))));

  return zellen.map(z => {
    if (!z) return null;
    const d = daten.get(`${z.kx}/${z.ky}`);
    if (!d) return null;
    const w = d[(z.py % bild.kachelHoehe) * bild.kachelBreite + (z.px % bild.kachelBreite)];
    return isFinite(w) ? w : null;
  });
}
