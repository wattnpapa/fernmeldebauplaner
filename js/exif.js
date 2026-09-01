// exif.js – Ortsangabe, Aufnahmezeit und Blickrichtung aus einem Lichtbild

/* Ein Lichtbild vom Telefon bringt seinen Ort selbst mit: die Kamera schreibt
   ihn beim Auslösen in den EXIF-Block der Datei. Gelesen wird er hier von Hand
   statt mit einer Bibliothek – gebraucht werden sechs Angaben, und der
   FMBauplaner nimmt für sechs Angaben keine Abhängigkeit auf (siehe CLAUDE.md).
   Für die Bildpunkte einer HEIC-Datei liegt eine unter `vendor/libheif/`; deren
   Schnittstelle gibt die Angaben aber nicht heraus, gelesen werden sie auch dort
   hier.

   Zwei Verpackungen, ein Inhalt. In beiden steckt derselbe TIFF-Block: das erste
   Verzeichnis (IFD0) verweist auf zwei weitere – die Aufnahmedaten und die
   Ortsangaben.

   - JPEG beginnt mit FFD8, danach folgen Segmente; FFE1 mit der Kennung
     „Exif\0\0“ trägt den TIFF-Block.
   - HEIC ist ein ISO-Mediencontainer aus verschachtelten Kästen. Der Kasten
     `meta` führt ein Verzeichnis der Bestandteile (`iinf`) und ihrer Fundstellen
     (`iloc`); einer davon hat den Typ `Exif` und enthält denselben TIFF-Block. */

const KENNUNG_EXIF = 0x45786966;   // „Exif“
const TIFF_KLEIN   = 0x4949;       // „II“ – kleines Ende zuerst (Intel)
const TIFF_GROSS   = 0x4D4D;       // „MM“ – großes Ende zuerst (Motorola)

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
  try {
    const sicht = new DataView(puffer);
    return istISOContainer(sicht) ? heifLesen(sicht) : jpegLesen(sicht);
  } catch (e) { return { ...LEER, roh: { breite: 0, hoehe: 0 } }; }
}

function jpegLesen(sicht) {
  const { tiff, roh } = segmenteLesen(sicht);
  return tiffLesen(sicht, tiff, roh);
}

/** Auswertung des TIFF-Blocks – aus JPEG und HEIC kommt derselbe */
function tiffLesen(sicht, tiff, roh) {
  if (tiff < 0 || tiff + 8 > sicht.byteLength) return { ...LEER, roh };

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

// ---------------------------------------------------------------- HEIC

/* Ein ISO-Mediencontainer besteht aus Kästen: vier Bytes Länge, vier Bytes
   Typ, dann der Inhalt – ein Kasten kann weitere enthalten. HEIC-Dateien
   beginnen mit `ftyp`. Erkannt wird an diesem Kasten und nicht an der Endung
   oder am gemeldeten Typ: Chrome gibt für eine aus dem Ordner gezogene
   HEIC-Datei oft gar keinen Typ an. */

const BRANDS_HEIF = ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm',
                     'hevs', 'mif1', 'msf1', 'heif'];

export function istISOContainer(sicht) {
  return sicht.byteLength >= 12 && viererKennung(sicht, 4) === 'ftyp';
}

/** Trägt dieser Container ein HEIF-Bild? Prüft Haupt- und Nebenkennungen. */
export function istHeif(puffer) {
  try {
    const sicht = new DataView(puffer);
    if (!istISOContainer(sicht)) return false;
    const ende = Math.min(sicht.getUint32(0) || 12, sicht.byteLength);
    for (let p = 8; p + 4 <= ende; p += 4) {
      if (BRANDS_HEIF.includes(viererKennung(sicht, p))) return true;
    }
    return false;
  } catch (e) { return false; }
}

const viererKennung = (sicht, ort) => String.fromCharCode(
  sicht.getUint8(ort), sicht.getUint8(ort + 1), sicht.getUint8(ort + 2), sicht.getUint8(ort + 3));

/** Die Kästen einer Ebene der Reihe nach an `tun` geben */
function kaesten(sicht, von, bis, tun) {
  let ort = von;
  while (ort + 8 <= bis) {
    let groesse = sicht.getUint32(ort);
    let kopf = 8;
    // Länge 1 heißt: die wirkliche Länge steht als 64-Bit-Zahl dahinter
    if (groesse === 1) {
      if (ort + 16 > bis) return;
      groesse = Number(sicht.getBigUint64(ort + 8));
      kopf = 16;
    }
    if (groesse === 0) groesse = bis - ort;        // reicht bis zum Ende
    if (groesse < kopf || ort + groesse > bis) return;
    if (tun(viererKennung(sicht, ort + 4), ort + kopf, ort + groesse) === false) return;
    ort += groesse;
  }
}

function heifLesen(sicht) {
  let meta = null;
  kaesten(sicht, 0, sicht.byteLength, (typ, von, bis) => {
    if (typ === 'meta') { meta = [von + 4, bis]; return false; }   // FullBox: Fassung und Merker
  });
  if (!meta) return { ...LEER, roh: { breite: 0, hoehe: 0 } };

  /* Ohne codierte Maße: welcher der Kästen `ispe` zum Hauptbild gehört, sagt
     erst die Zuordnungstabelle `ipma`, und der erste gehört in echten Dateien
     zum Vorschaubild. Gebraucht werden sie hier auch nicht – anders als beim
     JPEG dreht bei HEIC der Decoder selbst (siehe `js/bilder.js`). */
  const ispe = { breite: 0, hoehe: 0 };
  let exifNummer = 0, ort = null;
  kaesten(sicht, meta[0], meta[1], (typ, von, bis) => {
    if (typ === 'iinf') exifNummer = exifItemSuchen(sicht, von, bis);
  });
  /* `iloc` erst im zweiten Durchgang: es steht in echten Dateien hinter `iinf`,
     aber verlassen kann man sich darauf nicht. */
  if (exifNummer) {
    kaesten(sicht, meta[0], meta[1], (typ, von, bis) => {
      if (typ === 'iloc') ort = itemOrtSuchen(sicht, von, bis, exifNummer);
    });
  }
  if (!ort) return { ...LEER, roh: ispe };

  return tiffLesen(sicht, tiffImItem(sicht, ort.von, ort.bis), ispe);
}

/** Nummer des Bestandteils mit dem Typ `Exif`, oder 0 */
function exifItemSuchen(sicht, von, bis) {
  const fassung = sicht.getUint8(von);
  let ort = von + 4 + (fassung === 0 ? 2 : 4);      // Fassung, Merker, Anzahl
  let gefunden = 0;
  kaesten(sicht, ort, bis, (typ, v, b) => {
    if (typ !== 'infe') return;
    const f = sicht.getUint8(v);
    if (f < 2) return;                              // ältere Fassungen führen keinen Typ
    const nummer = f === 2 ? sicht.getUint16(v + 4) : sicht.getUint32(v + 4);
    const art = viererKennung(sicht, v + 4 + (f === 2 ? 2 : 4) + 2);
    if (art === 'Exif') { gefunden = nummer; return false; }
  });
  return gefunden;
}

/**
 * Fundstelle eines Bestandteils aus dem Kasten `iloc`.
 *
 * Der Kasten ist bewusst sparsam gehalten: wie viele Bytes eine Fundstelle
 * belegt, steht in seinem eigenen Kopf. Gelesen wird nur die erste Teilstelle –
 * ein EXIF-Block liegt immer am Stück.
 */
function itemOrtSuchen(sicht, von, bis, nummer) {
  const fassung = sicht.getUint8(von);
  let p = von + 4;
  const groessen = sicht.getUint8(p), basisGroessen = sicht.getUint8(p + 1);
  const versatzBytes = groessen >> 4, laengeBytes = groessen & 15;
  const basisBytes = basisGroessen >> 4, kennBytes = fassung >= 1 ? (basisGroessen & 15) : 0;
  p += 2;
  const anzahl = fassung < 2 ? sicht.getUint16(p) : sicht.getUint32(p);
  p += fassung < 2 ? 2 : 4;

  const zahl = (ort, bytes) => {
    if (bytes === 4) return sicht.getUint32(ort);
    if (bytes === 8) return Number(sicht.getBigUint64(ort));
    return 0;                                       // 0 Bytes heißt: Wert ist 0
  };

  for (let i = 0; i < anzahl && p < bis; i++) {
    const item = fassung < 2 ? sicht.getUint16(p) : sicht.getUint32(p);
    p += fassung < 2 ? 2 : 4;
    /* Die Bauart sagt, worauf sich der Versatz bezieht: 0 auf die Datei,
       1 auf den Kasten `idat`. Alles außer 0 wird hier nicht gelesen – ein
       EXIF-Block liegt in echten Dateien in `mdat`. */
    const bauart = fassung >= 1 ? (sicht.getUint16(p) & 15) : 0;
    if (fassung >= 1) p += 2;
    p += 2;                                          // Verweis auf eine andere Datei
    const basis = zahl(p, basisBytes); p += basisBytes;
    const teile = sicht.getUint16(p); p += 2;

    let treffer = null;
    for (let t = 0; t < teile; t++) {
      p += kennBytes;
      const versatz = zahl(p, versatzBytes); p += versatzBytes;
      const laenge = zahl(p, laengeBytes); p += laengeBytes;
      if (item === nummer && bauart === 0 && !treffer) {
        treffer = { von: basis + versatz, bis: basis + versatz + laenge };
      }
    }
    if (treffer && treffer.bis <= sicht.byteLength) return treffer;
    if (item === nummer) return null;
  }
  return null;
}

/**
 * Anfang des TIFF-Blocks im Inhalt eines Exif-Bestandteils.
 * Davor stehen vier Bytes, die sagen, wie weit es bis dorthin noch ist –
 * manche Schreiber legen zusätzlich die JPEG-Kennung „Exif\0\0“ davor.
 */
function tiffImItem(sicht, von, bis) {
  if (von + 4 > bis) return -1;
  let ort = von + 4 + sicht.getUint32(von);
  if (ort + 8 <= bis && sicht.getUint32(ort) === KENNUNG_EXIF) ort += 6;
  if (ort + 8 > bis) return -1;
  const kennung = sicht.getUint16(ort);
  return (kennung === TIFF_KLEIN || kennung === TIFF_GROSS) ? ort : -1;
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
