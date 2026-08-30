// kml.js – KML und KMZ aus Google Earth lesen
//
// Wer eine Trasse in Google Earth vorplant, hat sie dort als Pfad vorliegen und
// die Standorte als Ortsmarken. Genau das wird übernommen: Pfade werden zu
// Strecken, Ortsmarken zu taktischen Zeichen. Höhenangaben, Zeitstempel,
// Bildüberlagerungen und Netzverweise haben in einem Bauauftrag keine
// Entsprechung und bleiben deshalb außen vor.

// ---------------------------------------------------------------- XML-Zugriff

/** Alle Nachfahren mit diesem Namen – ohne Rücksicht auf das Präfix (kml:, gx:). */
const alle = (el, name) => [...el.getElementsByTagNameNS('*', name)];
/** Nur das unmittelbare Kind: trennt die Angaben des Placemarks von denen seiner Geometrie. */
const kind = (el, name) => el ? [...el.children].find(c => c.localName === name) : null;
const text = (el, name) => kind(el, name)?.textContent.trim() || '';

/** Text aus einem Dateipuffer, mit der im XML-Vorspann genannten Kodierung. */
export function alsText(puffer) {
  const roh = new TextDecoder('utf-8').decode(puffer);
  const kodierung = roh.slice(0, 200).match(/encoding=["']([\w-]+)["']/i)?.[1];
  if (!kodierung || /^utf-?8$/i.test(kodierung)) return roh;
  try { return new TextDecoder(kodierung).decode(puffer); } catch { return roh; }
}

/** „PK“ am Anfang: ein ZIP-Archiv, also ein KMZ. */
export function istKMZ(puffer) {
  if (puffer.byteLength < 22) return false;
  const kopf = new Uint8Array(puffer, 0, 2);
  return kopf[0] === 0x50 && kopf[1] === 0x4b;
}

// ---------------------------------------------------------------- Koordinaten

/**
 * `<coordinates>` nennt die Punkte als „Länge,Breite[,Höhe]“, durch Leerraum
 * getrennt – also anders herum als überall sonst in dieser Anwendung.
 */
function koordinaten(roh) {
  const punkte = [];
  for (const stueck of String(roh).trim().split(/\s+/)) {
    const [lng, lat] = stueck.split(',').map(Number);
    punkte.push([lat, lng]);
  }
  return saubern(punkte);
}

/** `<gx:coord>` einer Aufzeichnung: „Länge Breite Höhe“, mit Leerzeichen. */
function trackKoordinaten(track) {
  return saubern(alle(track, 'coord').map(c => {
    const [lng, lat] = c.textContent.trim().split(/\s+/).map(Number);
    return [lat, lng];
  }));
}

/** Unbrauchbare und doppelt gesetzte Punkte fallen weg. */
function saubern(punkte) {
  const raus = [];
  for (const [lat, lng] of punkte) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const letzter = raus[raus.length - 1];
    if (letzter && letzter[0] === lat && letzter[1] === lng) continue;
    raus.push([lat, lng]);
  }
  return raus;
}

// ---------------------------------------------------------------- Farben

/**
 * KML schreibt Farben als `aabbggrr` – Deckkraft zuerst, Blau vor Rot.
 * Zurück kommt `null`, wenn sich daraus keine brauchbare Streckenfarbe ergibt;
 * dann bleibt es bei der Farbe aus der Palette der Planung.
 */
function farbeAusKML(roh) {
  const h = String(roh).trim().replace(/^#/, '');
  if (!/^[0-9a-f]{8}$/i.test(h)) return null;
  const [b, g, r] = [h.slice(2, 4), h.slice(4, 6), h.slice(6, 8)].map(x => parseInt(x, 16));
  // Google Earth zeichnet Pfade in der Vorgabe fast weiß. Auf der topographischen
  // Karte und erst recht im Ausdruck wäre die Trasse damit nicht zu sehen.
  if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8) return null;
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Farben der benannten Stile, damit `styleUrl` eines Placemarks etwas findet. */
function stilfarben(doc) {
  const farben = new Map();
  for (const stil of alle(doc, 'Style')) {
    const kennung = stil.getAttribute('id');
    const farbe = linienfarbe(stil);
    if (kennung && farbe) farben.set('#' + kennung, farbe);
  }
  // Google Earth verweist über eine StyleMap auf zwei Stile – einen für den
  // Normalfall, einen für die Auswahl. Maßgebend ist der normale.
  for (const karte of alle(doc, 'StyleMap')) {
    const kennung = karte.getAttribute('id');
    if (!kennung) continue;
    for (const paar of alle(karte, 'Pair')) {
      const ziel = farben.get(text(paar, 'styleUrl'));
      if (text(paar, 'key') === 'normal' && ziel) farben.set('#' + kennung, ziel);
    }
  }
  return farben;
}

const linienfarbe = stil => stil ? farbeAusKML(text(kind(stil, 'LineStyle'), 'color')) : null;

// ---------------------------------------------------------------- Beschreibung

/**
 * Beschreibungen kommen aus Google Earth oft als HTML-Tabelle. Für die
 * Bemerkung zählt der Text darin, und auch der nur in Bauauftrags-Länge.
 */
function klartext(roh) {
  if (!roh) return '';
  // Vor jedes Element ein Leerzeichen: sonst klebt der Text zweier Zeilen
  // zusammen, weil <br> und </td> selbst keinen Zwischenraum hinterlassen.
  const doc = new DOMParser().parseFromString(roh.replace(/</g, ' <'), 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

/** Fällt der Name aus, hilft der Ordner weiter, in dem die Ortsmarke liegt. */
function ordnername(el) {
  for (let v = el.parentElement; v; v = v.parentElement) {
    if (v.localName !== 'Folder' && v.localName !== 'Document') continue;
    const n = text(v, 'name');
    if (n) return n;
  }
  return '';
}

// ---------------------------------------------------------------- KML lesen

/**
 * Liest ein KML-Dokument.
 * @returns {{linien: object[], punkte: object[], netzverweise: number}}
 */
export function kmlLesen(inhalt) {
  const doc = new DOMParser().parseFromString(inhalt, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length)
    throw new Error('Die KML-Datei lässt sich nicht lesen – sie ist unvollständig oder beschädigt.');
  if (doc.documentElement?.localName !== 'kml')
    throw new Error('Die Datei enthält kein KML.');

  const farben = stilfarben(doc);
  const linien = [], punkte = [];

  for (const pm of alle(doc, 'Placemark')) {
    const name = text(pm, 'name') || ordnername(pm);
    const beschreibung = klartext(text(pm, 'description'));
    // Ein Placemark kann seinen Stil selbst mitbringen statt ihn zu nennen.
    const farbe = linienfarbe(kind(pm, 'Style')) || farben.get(text(pm, 'styleUrl')) || null;

    const spuren = [
      ...alle(pm, 'LineString').map(g => koordinaten(text(g, 'coordinates'))),
      // Flächen kommen als äußere Begrenzung herein; die Löcher darin nicht.
      ...alle(pm, 'outerBoundaryIs').flatMap(b =>
        alle(b, 'LinearRing').map(r => koordinaten(text(r, 'coordinates')))),
      ...alle(pm, 'Track').map(trackKoordinaten)
    ].filter(k => k.length >= 2);

    spuren.forEach((koord, i) => linien.push({
      name: name && spuren.length > 1 ? `${name} (${i + 1})` : name,
      beschreibung, farbe, koordinaten: koord
    }));

    for (const g of alle(pm, 'Point')) {
      const [erster] = koordinaten(text(g, 'coordinates'));
      if (erster) punkte.push({ name, beschreibung, lat: erster[0], lng: erster[1] });
    }
  }

  return { linien, punkte, netzverweise: alle(doc, 'NetworkLink').length };
}

// ---------------------------------------------------------------- KMZ auspacken

/**
 * Holt die KML aus einem KMZ. Ein KMZ ist ein ZIP-Archiv; gebraucht wird daraus
 * nur ein einziger Eintrag, deshalb steht hier ein kleiner eigener Leser statt
 * einer Fremdbibliothek. Die Anwendung soll ohne Bauschritt auskommen.
 */
export async function kmlAusKMZ(puffer) {
  const sicht = new DataView(puffer);
  const ende = endeDesVerzeichnisses(sicht);
  if (ende < 0) throw new Error('Das KMZ-Archiv ist unvollständig.');

  const anzahl = sicht.getUint16(ende + 10, true);
  let zeiger = sicht.getUint32(ende + 16, true);
  let treffer = null;

  for (let i = 0; i < anzahl; i++) {
    if (zeiger + 46 > sicht.byteLength || sicht.getUint32(zeiger, true) !== 0x02014b50) break;
    const namensLaenge = sicht.getUint16(zeiger + 28, true);
    const eintrag = {
      name: new TextDecoder().decode(new Uint8Array(puffer, zeiger + 46, namensLaenge)),
      verfahren: sicht.getUint16(zeiger + 10, true),
      groesse: sicht.getUint32(zeiger + 20, true),
      anfang: sicht.getUint32(zeiger + 42, true)
    };
    if (/\.kml$/i.test(eintrag.name) && (!treffer || rang(eintrag.name) < rang(treffer.name)))
      treffer = eintrag;
    zeiger += 46 + namensLaenge + sicht.getUint16(zeiger + 30, true) + sicht.getUint16(zeiger + 32, true);
  }

  if (!treffer) throw new Error('In diesem KMZ-Archiv steckt keine KML-Datei.');
  return alsText(await auspacken(puffer, sicht, treffer));
}

/** Google Earth legt die Hauptdatei als doc.kml ganz oben ab – die zählt zuerst. */
function rang(name) {
  if (/^doc\.kml$/i.test(name)) return 0;
  return name.includes('/') ? 2 : 1;
}

/** Das zentrale Verzeichnis endet mit einer Marke, hinter der nur der Kommentar steht. */
function endeDesVerzeichnisses(sicht) {
  const grenze = Math.max(0, sicht.byteLength - 22 - 0xffff);
  for (let i = sicht.byteLength - 22; i >= grenze; i--)
    if (sicht.getUint32(i, true) === 0x06054b50) return i;
  return -1;
}

async function auspacken(puffer, sicht, eintrag) {
  if (sicht.getUint32(eintrag.anfang, true) !== 0x04034b50)
    throw new Error('Das KMZ-Archiv ist beschädigt.');
  const daten = eintrag.anfang + 30
    + sicht.getUint16(eintrag.anfang + 26, true)
    + sicht.getUint16(eintrag.anfang + 28, true);
  const roh = puffer.slice(daten, daten + eintrag.groesse);

  if (eintrag.verfahren === 0) return roh;                    // ungepackt abgelegt
  if (eintrag.verfahren !== 8)
    throw new Error('Das KMZ-Archiv ist mit einem unbekannten Verfahren gepackt.');
  if (typeof DecompressionStream === 'undefined')
    throw new Error('Dieser Browser kann KMZ nicht auspacken – in Google Earth als .kml speichern.');

  const strom = new Blob([roh]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(strom).arrayBuffer();
}
