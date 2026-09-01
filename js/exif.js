// exif.js – Ortsangabe, Aufnahmezeit und Blickrichtung aus einem Lichtbild

/* Ein Lichtbild vom Telefon bringt seinen Ort selbst mit: die Kamera schreibt
   ihn beim Auslösen in den EXIF-Block der JPEG-Datei. Gelesen wird er hier von
   Hand statt mit einer Bibliothek – gebraucht werden sechs Angaben, und der
   FMBauplaner nimmt für sechs Angaben keine Abhängigkeit auf (siehe CLAUDE.md).

   Aufbau, den dieser Leser voraussetzt: JPEG beginnt mit FFD8, danach folgen
   Segmente. Das Segment FFE1 mit der Kennung „Exif\0\0“ enthält einen
   vollständigen TIFF-Block; darin verweist das erste Verzeichnis (IFD0) auf
   zwei weitere – die Aufnahmedaten und die Ortsangaben. */

const KENNUNG_EXIF = 0x45786966;   // „Exif“
const TIFF_KLEIN   = 0x4949;       // „II“ – kleines Ende zuerst (Intel)

/** Bytes je EXIF-Werttyp; 0 steht für einen Typ, den dieser Leser nicht kennt. */
const TYPLAENGE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8];

/* Die sechs Marken, auf die es ankommt. Die Namen sind die des Standards –
   danach wird in fremden Werkzeugen gesucht, wenn eine Angabe fehlt. */
const AUSRICHTUNG   = 0x0112;   // Orientation
const EXIF_ZEIGER   = 0x8769;   // ExifIFDPointer
const GPS_ZEIGER    = 0x8825;   // GPSInfoIFDPointer
const AUFNAHMEZEIT  = 0x9003;   // DateTimeOriginal
const GPS_BREITE_NS = 0x0001;   // GPSLatitudeRef
const GPS_BREITE    = 0x0002;   // GPSLatitude
const GPS_LAENGE_EW = 0x0003;   // GPSLongitudeRef
const GPS_LAENGE    = 0x0004;   // GPSLongitude
const GPS_HOEHE_REF = 0x0005;   // GPSAltitudeRef
const GPS_HOEHE     = 0x0006;   // GPSAltitude
const GPS_BLICK     = 0x0011;   // GPSImgDirection

const LEER = {
  lat: null, lng: null, hoehe: null, aufgenommen: '', richtung: null,
  ausrichtung: 1, roh: { breite: 0, hoehe: 0 }
};

/**
 * Liest den EXIF-Block einer JPEG-Datei.
 * @param {ArrayBuffer} puffer Anfang der Datei – die ersten 128 kB genügen
 * @returns {{lat: ?number, lng: ?number, hoehe: ?number, aufgenommen: string,
 *            richtung: ?number, ausrichtung: number,
 *            roh: {breite: number, hoehe: number}}}
 *          Fehlende Angaben stehen als `null`; `ausrichtung` ist notfalls 1
 *          (aufrecht), damit der Aufrufer nicht prüfen muss. `roh` sind die
 *          Maße, wie das Bild codiert ist – vor jeder Drehung.
 */
export function exifLesen(puffer) {
  try { return lesen(new DataView(puffer)); }
  catch (e) { return { ...LEER, roh: { breite: 0, hoehe: 0 } }; }
}

function lesen(sicht) {
  const { tiff, roh } = segmenteLesen(sicht);
  if (tiff < 0) return { ...LEER, roh };

  const klein = sicht.getUint16(tiff) === TIFF_KLEIN;
  const ifd0 = ifdLesen(sicht, tiff, sicht.getUint32(tiff + 4, klein), klein);

  const raus = { ...LEER, roh };
  const dreh = zahl(sicht, tiff, ifd0.get(AUSRICHTUNG), klein);
  if (dreh >= 1 && dreh <= 8) raus.ausrichtung = dreh;

  const exif = zeigerIFD(sicht, tiff, ifd0.get(EXIF_ZEIGER), klein);
  const zeit = text(sicht, tiff, exif.get(AUFNAHMEZEIT), klein);
  if (zeit) raus.aufgenommen = alsZeitpunkt(zeit);

  const gps = zeigerIFD(sicht, tiff, ifd0.get(GPS_ZEIGER), klein);
  raus.lat = gradWert(sicht, tiff, gps, GPS_BREITE, GPS_BREITE_NS, 'S', 90, klein);
  raus.lng = gradWert(sicht, tiff, gps, GPS_LAENGE, GPS_LAENGE_EW, 'W', 180, klein);
  /* Eine Koordinate ist nur zu zweit eine: eine halbe Angabe wäre eine
     Ortsmarke irgendwo auf dem Nullmeridian. */
  if (raus.lat === null || raus.lng === null) { raus.lat = null; raus.lng = null; }

  const hoehe = werte(sicht, tiff, gps.get(GPS_HOEHE), klein)[0];
  if (Number.isFinite(hoehe)) {
    // Referenz 1 heißt „unter dem Meeresspiegel“ – der Betrag steht positiv da
    raus.hoehe = zahl(sicht, tiff, gps.get(GPS_HOEHE_REF), klein) === 1 ? -hoehe : hoehe;
  }

  const blick = werte(sicht, tiff, gps.get(GPS_BLICK), klein)[0];
  if (Number.isFinite(blick)) raus.richtung = ((blick % 360) + 360) % 360;

  return raus;
}

/**
 * Ein Durchgang durch die Segmente der Datei: Anfang des TIFF-Blocks (oder −1)
 * und die codierte Bildgröße aus dem Rahmenkopf.
 *
 * Die codierte Größe wird gebraucht, um zu erkennen, ob der Browser die
 * Ausrichtung beim Entschlüsseln schon selbst angewandt hat – siehe
 * `js/bilder.js`.
 */
function segmenteLesen(sicht) {
  const raus = { tiff: -1, roh: { breite: 0, hoehe: 0 } };
  if (sicht.byteLength < 4 || sicht.getUint16(0) !== 0xFFD8) return raus;
  let pos = 2;
  while (pos + 4 <= sicht.byteLength) {
    if (sicht.getUint8(pos) !== 0xFF) break;
    const marke = sicht.getUint8(pos + 1);
    // Ab dem Bildbeginn (SOS) folgen komprimierte Daten, in denen nicht gesucht wird
    if (marke === 0xDA || marke === 0xD9) break;
    const laenge = sicht.getUint16(pos + 2);
    if (laenge < 2) break;

    /* FFE1 trägt auch XMP-Angaben – erst die Kennung „Exif\0\0“ macht das
       Segment zu dem gesuchten. */
    if (raus.tiff < 0 && marke === 0xE1 && pos + 10 <= sicht.byteLength &&
        sicht.getUint32(pos + 4) === KENNUNG_EXIF && sicht.getUint16(pos + 8) === 0) {
      raus.tiff = pos + 10;
    }
    /* Rahmenkopf (SOF0 bis SOF15). C4, C8 und CC tragen dieselbe Kennzahl,
       meinen aber Huffman-Tabellen und keine Bildmaße. */
    if (marke >= 0xC0 && marke <= 0xCF && marke !== 0xC4 && marke !== 0xC8 && marke !== 0xCC &&
        pos + 9 <= sicht.byteLength && !raus.roh.breite) {
      raus.roh = { hoehe: sicht.getUint16(pos + 5), breite: sicht.getUint16(pos + 7) };
    }
    pos += 2 + laenge;
  }
  return raus;
}

/** Ein Verzeichnis als Karte Marke → Feldbeschreibung */
function ifdLesen(sicht, tiff, versatz, klein) {
  const felder = new Map();
  const anfang = tiff + versatz;
  if (versatz <= 0 || anfang + 2 > sicht.byteLength) return felder;
  const anzahl = sicht.getUint16(anfang, klein);
  for (let i = 0; i < anzahl; i++) {
    const e = anfang + 2 + i * 12;
    if (e + 12 > sicht.byteLength) break;
    felder.set(sicht.getUint16(e, klein), {
      typ: sicht.getUint16(e + 2, klein),
      anzahl: sicht.getUint32(e + 4, klein),
      ort: e + 8
    });
  }
  return felder;
}

/** Das Verzeichnis, auf das ein Zeigerfeld verweist – notfalls ein leeres */
function zeigerIFD(sicht, tiff, feld, klein) {
  const ziel = zahl(sicht, tiff, feld, klein);
  return ziel > 0 ? ifdLesen(sicht, tiff, ziel, klein) : new Map();
}

/**
 * Werte eines Feldes. Bis zu vier Bytes stehen unmittelbar im Verzeichnis,
 * alles Längere nur als Verweis an eine andere Stelle des TIFF-Blocks.
 */
function werte(sicht, tiff, feld, klein) {
  if (!feld) return [];
  const groesse = TYPLAENGE[feld.typ] || 0;
  if (!groesse || !feld.anzahl) return [];
  const gesamt = groesse * feld.anzahl;
  const ort = gesamt <= 4 ? feld.ort : tiff + sicht.getUint32(feld.ort, klein);
  if (ort < 0 || ort + gesamt > sicht.byteLength) return [];

  const raus = [];
  for (let i = 0; i < feld.anzahl; i++) {
    const p = ort + i * groesse;
    if (feld.typ === 1 || feld.typ === 7) raus.push(sicht.getUint8(p));
    else if (feld.typ === 2) raus.push(String.fromCharCode(sicht.getUint8(p)));
    else if (feld.typ === 3) raus.push(sicht.getUint16(p, klein));
    else if (feld.typ === 4) raus.push(sicht.getUint32(p, klein));
    else if (feld.typ === 9) raus.push(sicht.getInt32(p, klein));
    else if (feld.typ === 5 || feld.typ === 10) {
      const zaehler = feld.typ === 5 ? sicht.getUint32(p, klein) : sicht.getInt32(p, klein);
      const nenner  = feld.typ === 5 ? sicht.getUint32(p + 4, klein) : sicht.getInt32(p + 4, klein);
      raus.push(nenner ? zaehler / nenner : 0);
    }
  }
  return raus;
}

const zahl = (sicht, tiff, feld, klein) => {
  const w = werte(sicht, tiff, feld, klein)[0];
  return Number.isFinite(w) ? w : 0;
};

const text = (sicht, tiff, feld, klein) =>
  werte(sicht, tiff, feld, klein).join('').replace(/\0.*$/s, '').trim();

/**
 * Grad, Minute, Sekunde in Dezimalgrad. `negativRef` ist der Buchstabe, der
 * die andere Halbkugel bezeichnet – „S“ bzw. „W“.
 */
function gradWert(sicht, tiff, gps, marke, refMarke, negativRef, grenze, klein) {
  const teile = werte(sicht, tiff, gps.get(marke), klein);
  if (teile.length < 3 || !teile.every(Number.isFinite)) return null;
  const grad = teile[0] + teile[1] / 60 + teile[2] / 3600;
  if (!Number.isFinite(grad) || grad > grenze) return null;
  const ref = text(sicht, tiff, gps.get(refMarke), klein).toUpperCase();
  return ref === negativRef ? -grad : grad;
}

/**
 * „2026:08:30 14:22:07“ in einen Zeitpunkt, den `new Date` als Ortszeit liest.
 * EXIF führt keine Zeitzone mit – die Angabe bleibt deshalb bewusst ohne.
 */
function alsZeitpunkt(roh) {
  const t = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(roh);
  return t ? `${t[1]}-${t[2]}-${t[3]}T${t[4]}:${t[5]}:${t[6]}` : '';
}
