// bilder.js – Lichtbilder aufnehmen, verkleinern und auf der Karte zeigen

import { store, neuesBild, bildAufKarte } from './state.js';
import { ablegen, bildUrl } from './bildspeicher.js';
import { exifLesen, istHeif } from './exif.js';
import { heicEntschluesseln } from './heic.js';
import { escapeHtml } from './strecken.js';
import { himmelsrichtung } from './geo.js';

/* Ein Lichtbild vom Telefon bringt 12 Megapixel und mehrere Megabyte mit. Für
   den Zweck – „so sah die Stelle aus“ – genügt die lange Kante bei 1600 px;
   das ist ungefähr das, was auf einem Blatt A4 noch schärfer aussähe als der
   Drucker es hergibt, und es hält eine Planung mit zwanzig Bildern bei
   wenigen Megabyte. Das Vorschaubild trägt nur die Liste in der Seitenleiste. */
const MAX_KANTE = 1600, GUETE = 0.72;
const MINI_KANTE = 200, MINI_GUETE = 0.6;

/** Nur so viel vom Dateianfang lesen, wie der EXIF-Block belegen kann */
const EXIF_FENSTER = 256 * 1024;

/** Größte Vorschau, die beim Überfahren eines Bildpunktes aufgeht */
export const VORSCHAU = { breite: 300, hoehe: 240 };

/**
 * Maße, in denen ein Bild in einen Rahmen passt – ohne es zu verzerren und
 * ohne es über seine eigene Größe hinaus aufzublasen.
 */
export function passendeMasse(b, maxBreite, maxHoehe) {
  const breite = b.breite || 4, hoehe = b.hoehe || 3;
  const q = Math.min(maxBreite / breite, maxHoehe / hoehe, 1);
  return { breite: Math.max(1, Math.round(breite * q)), hoehe: Math.max(1, Math.round(hoehe * q)) };
}

// ---------------------------------------------------------------- Aufnehmen

/**
 * Bilddateien in die Planung übernehmen.
 *
 * Jede Datei wird für sich behandelt: eine unlesbare hält die übrigen nicht
 * auf, sie wird nur gemeldet. Die Bilddaten liegen erst im Bildspeicher, bevor
 * der Eintrag in die Planung kommt – sonst zeigte die Karte einen Punkt, hinter
 * dem nichts steht.
 *
 * @returns {Promise<{angenommen: object[], ohneOrt: number, abgewiesen: object[]}>}
 */
export async function bilderAufnehmen(dateien) {
  const angenommen = [], abgewiesen = [];
  let ohneOrt = 0;

  laufend++;
  try {
    for (const datei of Array.from(dateien || [])) {
      try {
        const b = await eineDatei(datei);
        if (b.lat === null) ohneOrt++;
        angenommen.push(b);
      } catch (e) {
        abgewiesen.push({ name: datei.name || 'Bild', grund: e.message });
      }
    }
    if (angenommen.length) store.aendern(p => { p.bilder.push(...angenommen); }, 'bild');
  } finally {
    laufend--;
  }
  return { angenommen, ohneOrt, abgewiesen };
}

/* Zwischen dem Ablegen der Bilddaten und dem Eintrag in der Planung liegt ein
   Augenblick, in dem die Daten zu niemandem gehören. Das Aufräumen verwaister
   Bilddaten muss ihn abwarten – bei einer HEIC-Aufnahme kann er lang sein, weil
   der Entschlüsseler den Hauptfaden hält und den Zeitgeber des Aufräumlaufs
   genau bis dorthin aufschiebt. */
let laufend = 0;
export const uebernahmeLaeuft = () => laufend > 0;

async function eineDatei(datei) {
  const kopf = await datei.slice(0, EXIF_FENSTER).arrayBuffer();
  /* Erkannt wird am Inhalt, nicht an Endung oder gemeldetem Typ: für eine aus
     dem Ordner gezogene HEIC-Datei gibt Chrome oft gar keinen Typ an. */
  const heic = istHeif(kopf);
  if (!heic && !/^image\//.test(datei.type || '')) throw new Error('keine Bilddatei');

  /* HEIC führt den EXIF-Block im Datenteil, oft weit hinter dem Dateianfang –
     dort reicht das Fenster nicht, und die Datei wird ohnehin ganz gebraucht. */
  const ganz = heic ? await datei.arrayBuffer() : null;
  const exif = exifLesen(ganz || kopf);

  let quelle, vomDecoder = false;
  try {
    // Safari entschlüsselt HEIC selbst; dort bleibt der eigene Weg ungenutzt
    quelle = await createImageBitmap(datei);
  } catch (e) {
    if (!heic) throw new Error('Bild nicht lesbar');
    quelle = await heicEntschluesseln(ganz);
    vomDecoder = true;
  }

  try {
    /* Hat der Browser das Bild schon aufgerichtet, wäre eine zweite Drehung
       eine zu viel – es läge dann quer statt hochkant. Der eigene HEIC-Weg
       richtet ebenfalls auf: libheif wendet die Drehung des Containers (`irot`)
       beim Entschlüsseln an. */
    const lage = (vomDecoder || browserDreht(quelle, exif)) ? 1 : exif.ausrichtung;
    const gross = await verkleinern(quelle, MAX_KANTE, GUETE, lage);
    const mini  = await verkleinern(quelle, MINI_KANTE, MINI_GUETE, lage);
    const b = neuesBild({
      lat: exif.lat, lng: exif.lng,
      aufgenommen: exif.aufgenommen,
      richtung: exif.richtung,
      breite: gross.breite, hoehe: gross.hoehe,
      groesse: gross.blob.size + mini.blob.size,
      name: dateiname(datei.name)
    });
    await ablegen(b.id, gross.blob, mini.blob);
    return b;
  } finally {
    quelle.close?.();
  }
}

/** Der Dateiname ohne Endung als erste Beschriftung – „IMG_4711“ sagt mehr als nichts */
const dateiname = name => String(name || '').replace(/\.[^.]+$/, '').slice(0, 60);

/* Wendet der Browser die Ausrichtung aus dem EXIF-Block beim Entschlüsseln
   selbst an? Fragen lässt sich das nicht: `imageOrientation: 'none'` gilt als
   überholt und wird stillschweigend übergangen, und wann welcher Browser
   umgestellt hat, ist kein Maßstab, den man in den Quelltext schreiben will.
   Also wird gemessen: bei einer Vierteldrehung müssen die Kanten des
   entschlüsselten Bildes vertauscht sein gegenüber den codierten Maßen aus dem
   Rahmenkopf.

   Die Antwort gilt für den ganzen Browser und bleibt deshalb stehen. Sie hilft
   auch den Lagen 2 bis 4, bei denen die Kanten gleich bleiben und die Messung
   selbst nichts hergäbe: sobald ein einziges hochkant aufgenommenes Bild durch
   ist, steht sie fest. Bis dahin gilt die Annahme, die auf jeden Browser
   zutrifft, der diese Anwendung überhaupt ausführt. */
let drehtSelbst = true;

function browserDreht(bitmap, exif) {
  const quer = exif.ausrichtung >= 5 && exif.ausrichtung <= 8;
  const { breite, hoehe } = exif.roh || {};
  // Ein quadratisches Bild verrät nichts – dort sind beide Fälle gleich
  if (quer && breite && hoehe && breite !== hoehe) {
    drehtSelbst = bitmap.width === hoehe && bitmap.height === breite;
  }
  return drehtSelbst;
}

/**
 * Verkleinert und richtet ein Bild auf.
 *
 * Die Drehung aus dem EXIF-Block wird in derselben Zeichnung erledigt wie das
 * Verkleinern: eine zweite Leinwand in Originalgröße kostete bei einem Bild
 * mit 12 Megapixeln rund 48 MB Arbeitsspeicher.
 */
async function verkleinern(quelle, maxKante, guete, ausrichtung) {
  const q = Math.min(1, maxKante / Math.max(quelle.width, quelle.height));
  const zielB = Math.max(1, Math.round(quelle.width * q));
  const zielH = Math.max(1, Math.round(quelle.height * q));
  const quer = ausrichtung >= 5 && ausrichtung <= 8;   // 90°-Drehungen tauschen die Kanten

  const leinwand = document.createElement('canvas');
  leinwand.width  = quer ? zielH : zielB;
  leinwand.height = quer ? zielB : zielH;
  const stift = leinwand.getContext('2d');
  stift.imageSmoothingEnabled = true;
  stift.imageSmoothingQuality = 'high';
  aufrichten(stift, ausrichtung, zielB, zielH);
  stift.drawImage(quelle, 0, 0, zielB, zielH);

  const blob = await new Promise(fertig => leinwand.toBlob(fertig, 'image/jpeg', guete));
  if (!blob) throw new Error('Bild ließ sich nicht umwandeln');
  return { blob, breite: leinwand.width, hoehe: leinwand.height };
}

/* Die acht Lagen des EXIF-Feldes „Orientation“ als Abbildung der Zeichenfläche.
   `breite`/`hoehe` sind die Maße vor der Drehung – die Leinwand hat sie bei
   den Fällen 5 bis 8 bereits vertauscht. */
function aufrichten(stift, lage, breite, hoehe) {
  if (lage === 2) stift.transform(-1, 0, 0, 1, breite, 0);
  else if (lage === 3) stift.transform(-1, 0, 0, -1, breite, hoehe);
  else if (lage === 4) stift.transform(1, 0, 0, -1, 0, hoehe);
  else if (lage === 5) stift.transform(0, 1, 1, 0, 0, 0);
  else if (lage === 6) stift.transform(0, 1, -1, 0, hoehe, 0);
  else if (lage === 7) stift.transform(0, -1, -1, 0, hoehe, breite);
  else if (lage === 8) stift.transform(0, -1, 1, 0, 0, breite);
}

// ---------------------------------------------------------------- Kartenebene

/**
 * Die Lichtbilder als Punkte auf der Karte.
 *
 * Ein Punkt und nicht das Bild selbst: zwanzig aufgeklappte Bilder verdeckten
 * die Trasse, um die es geht. Wer wissen will, was an einer Stelle steht,
 * fährt darüber – dann geht die Vorschau auf.
 */
export class BilderLayer {
  constructor(karte, opt = {}) {
    this.karte = karte;
    this.gruppe = L.layerGroup().addTo(karte);
    this.auswahl = null;
    this.setzModus = null;          // Kennung des Bildes, dessen Ort gesetzt wird
    this.aufAuswahl = opt.aufAuswahl || (() => {});
    this.aufAenderung = opt.aufAenderung || (() => {});
    this._klick = e => this._kartenKlick(e);
    karte.on('click', this._klick);
  }

  zerstoeren() {
    this.karte.off('click', this._klick);
    this.gruppe.remove();
  }

  /** Ort eines Bildes auf der Karte nachtragen – der nächste Klick setzt ihn */
  starteSetzen(bid) {
    this.setzModus = bid;
    L.DomUtil.addClass(this.karte.getContainer(), 'modus-bild');
  }

  beendeSetzen() {
    this.setzModus = null;
    L.DomUtil.removeClass(this.karte.getContainer(), 'modus-bild');
  }

  _kartenKlick(e) {
    if (!this.setzModus) return;
    const bid = this.setzModus;
    store.aendern(p => {
      const b = p.bilder.find(x => x.id === bid);
      if (!b) return;
      b.lat = e.latlng.lat;
      b.lng = e.latlng.lng;
      /* Von Hand gesetzt: ab jetzt ist der Ort eine Setzung des Planenden und
         darf am Griff nachjustiert werden. */
      b.ortAusKamera = false;
    }, 'bild');
    this.beendeSetzen();
    this.auswahl = bid;
    this.aufAuswahl(bid);
    this.aufAenderung();
  }

  waehle(bid) {
    this.auswahl = bid;
    this.zeichne();
    this.aufAuswahl(bid);
  }

  zeichne() {
    this.gruppe.clearLayers();
    for (const b of store.projekt.bilder || []) {
      if (!bildAufKarte(b)) continue;
      this._punkt(b);
    }
  }

  _punkt(b) {
    const gewaehlt = b.id === this.auswahl;
    const m = L.marker([b.lat, b.lng], {
      pane: 'fbp-bilder',
      /* Was die Kamera aufgezeichnet hat, ist eine Messung – ein Rutscher mit
         der Maus darf daraus keine Behauptung machen. Geändert wird ein solcher
         Ort nur ausdrücklich, über „Ort von Hand setzen“ im Eintrag. Ein von
         Hand gesetzter Ort ist dagegen eine Setzung und bleibt am Griff. */
      draggable: !b.ortAusKamera,
      keyboard: false,
      icon: L.divIcon({
        className: 'fbp-bild-icon',
        html: `<span class="fbp-bild-marke">${blickSpitze(b)}` +
              `<span class="fbp-bild${gewaehlt ? ' gewaehlt' : ''}"></span></span>`,
        iconSize: [MARKE, MARKE], iconAnchor: [MARKE / 2, MARKE / 2]
      }),
      title: markenTitel(b)
    }).addTo(this.gruppe);

    /* Beim Überfahren geht das Bild groß auf – der Punkt ist nur die Marke,
       das Bild ist der Inhalt. Erst beim Zeigen geladen: die Adressen aller
       Bilder gleichzeitig zu halten, füllte bei einer größeren Planung den
       Arbeitsspeicher mit Daten, die niemand ansieht. */
    let ueber = false;
    m.on('mouseover', async () => {
      ueber = true;
      const adresse = await bildUrl(b.id);
      if (!ueber || !adresse || !this.gruppe.hasLayer(m)) return;
      m.bindTooltip(vorschauHTML(b, adresse), {
        className: 'fbp-bild-vorschau',
        direction: this._richtung(m),
        offset: [0, 0],
        opacity: 1
      }).openTooltip();
    });
    m.on('mouseout', () => { ueber = false; m.closeTooltip(); m.unbindTooltip(); });

    /* Ein Klick zeigt das Bild in voller Größe und wählt es zugleich in der
       Liste aus. Am Bauort gibt es kein Überfahren – auf dem Tablet ist der
       Klick der einzige Weg zum Bild. */
    m.on('click', e => {
      L.DomEvent.stop(e);
      ueber = false;
      m.closeTooltip();
      this.waehle(b.id);
    });

    m.on('dragstart', () => { ueber = false; m.closeTooltip(); store.schnappschuss(); });
    m.on('dragend', ev => {
      const ll = ev.target.getLatLng();
      store.aendern(() => { b.lat = ll.lat; b.lng = ll.lng; }, 'bild', { undo: false });
      this.aufAenderung();
    });
  }

  /* Am oberen Kartenrand hätte eine Vorschau über dem Punkt keinen Platz –
     Leaflet schneidet sie dort ab, statt sie umzulegen. */
  _richtung(m) {
    const y = this.karte.latLngToContainerPoint(m.getLatLng()).y;
    return y < VORSCHAU.hoehe + 40 ? 'bottom' : 'top';
  }
}

/* Kantenlänge des Markenfeldes. Größer als das Viereck selbst, damit die
   Blickspitze in jeder Drehung darin Platz hat – angeklickt wird trotzdem nur
   das Viereck, dafür sorgt `pointer-events` im Stilblatt. Ohne das griffe eine
   Marke weit über ihren sichtbaren Rand hinaus und nähme der benachbarten die
   Klicks weg. */
const MARKE = 38;

/**
 * Die kleine Spitze am Punkt: wohin die Kamera geblickt hat.
 *
 * Sie erscheint nur, wenn die Aufnahme die Richtung mitbringt – viele Kameras
 * zeichnen sie nicht auf, und eine geratene Richtung wäre schlimmer als keine.
 * Gedreht wird unmittelbar um den EXIF-Winkel: auf der Karte liegt Norden
 * immer oben.
 */
function blickSpitze(b) {
  if (!Number.isFinite(b.richtung)) return '';
  const mitte = MARKE / 2;
  return `<svg class="fbp-blick" viewBox="0 0 ${MARKE} ${MARKE}" width="${MARKE}" height="${MARKE}"
     aria-hidden="true" style="--blick:${b.richtung.toFixed(1)}deg"
   ><path d="M${mitte} 2 L${mitte + 5.5} 11.5 L${mitte - 5.5} 11.5 Z" paint-order="stroke"/></svg>`;
}

/** Beschriftung am Mauszeiger – nennt die Richtung, weil die Spitze sie nur zeigt */
function markenTitel(b) {
  const name = b.name || 'Lichtbild';
  return Number.isFinite(b.richtung)
    ? `${name} – Blick nach ${himmelsrichtung(b.richtung)} (${Math.round(b.richtung)}°)`
    : name;
}

function vorschauHTML(b, adresse) {
  const masse = passendeMasse(b, VORSCHAU.breite, VORSCHAU.hoehe);
  /* Maße am Bild: ohne sie stellt Leaflet die Vorschau auf, bevor das Bild
     geladen ist, und sie steht danach neben dem Punkt statt darüber. */
  return `<img src="${adresse}" width="${masse.breite}" height="${masse.hoehe}"
            alt="${escapeHtml(b.name || 'Lichtbild')}">` +
    (b.name ? `<span class="bv-titel">${escapeHtml(b.name)}</span>` : '');
}
