// gitter.js – zuschaltbares UTM-Kilometergitter (MGRS/UTMREF) auf der Karte

import { store } from './state.js';
import { nachUTM, vonUTM, utmZone, toMGRS, distanz } from './geo.js';
import { basiskarteById } from './map.js';

/* Nur dekadische Maschenweiten: an den Strichen stehen die Ziffern der
   MGRS-Angabe selbst – bei 500 m stünde dort ein Wert, den keine Gitterangabe
   trägt und den niemand über Funk durchgeben kann. */
const WEITEN = [100, 1000, 10000, 100000];

/* Engster zulässiger Linienabstand in Kartenpixeln, grob am Blattgitter der
   topografischen Karten ausgerichtet (dort 1 cm bis 4 cm je nach Maßstab). */
const MIN_ABSTAND_PX = 50;

/* Gitterlinien sind auf Blattgröße fast gerade; die Stützpunkte fangen nur
   die leichte Drehung des Gitters gegen das Blatt und den Schnitt am
   Zonenrand ab. */
const SEGMENTE = 24;

const MAX_LINIEN = 120;      // Schranke gegen einen Ausreißer der Weitenwahl
const RAND_PX = 4;           // Abstand der Randzahlen zur Blattkante
const ECKE_FREI_PX = 46;     // Ecken bleiben frei: Nordpfeil, Werkzeugkasten

export class GitterLayer {
  constructor(karte, opt = {}) {
    this.karte = karte;
    this.interaktiv = opt.interaktiv !== false;
    this.sw = !!opt.sw;
    // Die Druckkarte wird doppelt gerendert und halbiert – wie bei den
    // Strecken wachsen Striche und Abstände mit, sonst wird das Gitter zu eng.
    this.strichFaktor = opt.strichFaktor || 1;
    this.gruppe = L.layerGroup().addTo(karte);
    this._an = false;
    this._stand = null;
    this._info = null;

    /* Eigene Ebene unter den Strecken: das Gitter ist Orientierung, keine
       Planung – es darf weder Trasse noch Beschriftung überdecken. */
    if (!karte.getPane('fbp-gitter')) {
      const ebene = karte.createPane('fbp-gitter');
      ebene.style.zIndex = 405;
      ebene.style.pointerEvents = 'none';
    }

    if (this.interaktiv) {
      this._neu = () => { if (this._an) this._zeichneGitter(); };
      karte.on('moveend zoomend fbp:basiskarte', this._neu);
    }
  }

  zerstoeren() {
    if (this.interaktiv) this.karte.off('moveend zoomend fbp:basiskarte', this._neu);
    this._infoWeg();
    this.gruppe.remove();
  }

  /** Wie bei den anderen Ebenen: ohne Argument gelten die Projekt-Optionen. */
  zeichne(optionen) {
    const o = optionen || store.projekt.optionen;
    this._an = !!o.gitter;
    if (!this._an) {
      this._stand = null;
      this.gruppe.clearLayers();
      this._infoWeg();
      return;
    }
    this._zeichneGitter();
  }

  // ------------------------------------------------------------ Aufbau

  _zeichneGitter() {
    const karte = this.karte;
    const groesse = karte.getSize();
    if (!groesse.x || !groesse.y) return;

    /* Beim Ziehen wandern die Linien mit der Karte; neu gerechnet wird erst
       am Ende der Bewegung. Der Neuaufbau über die Projektmeldungen läuft
       dagegen bei jedem Tastendruck – Unverändertes stehen lassen. */
    const stand = this._signatur();
    if (stand === this._stand) return;
    this._stand = stand;
    this.gruppe.clearLayers();

    // Vorrat über den Blattrand: so bleibt das Gitter beim Ziehen geschlossen,
    // bis das nächste moveend neu zeichnet.
    const b = karte.getBounds().pad(0.3);

    /* Jenseits der MGRS-Bänder gibt es nichts abzulesen, und über den Äquator
       hinweg springt der Nordwert um die falsche Nordung – dann lieber gar
       kein Gitter als ein falsches. */
    if (b.getNorth() > 84 || b.getSouth() < -80 ||
        (b.getSouth() < 0 && b.getNorth() > 0)) { this._infoWeg(); return; }

    const sued = karte.getCenter().lat < 0;

    // Meter je Kartenpixel aus der Karte selbst gemessen – die Druckkarte
    // rastet auf Viertel-Zoomstufen, eine Zweierpotenz-Formel griffe daneben.
    const m1 = karte.containerPointToLatLng([groesse.x / 2, groesse.y / 2]);
    const m2 = karte.containerPointToLatLng([groesse.x / 2 + 100, groesse.y / 2]);
    const mProPx = Math.max(0.01, distanz(m1, m2) / 100);
    const weite = WEITEN.find(w => w / mProPx >= MIN_ABSTAND_PX * this.strichFaktor)
      || WEITEN[WEITEN.length - 1];

    /* Am Zonenrand (in Deutschland der 12. Längengrad) wird je Zone ihr
       eigenes Gitter gezeichnet und am Meridian geschnitten – die Werte der
       Nachbarzone passen nicht zu den 100-km-Buchstaben der eigenen. */
    const zoneVon = utmZone(b.getWest()), zoneBis = utmZone(b.getEast());
    if (zoneBis - zoneVon > 2) { this._infoWeg(); return; }

    const dunkel = !!basiskarteById(karte._fbpBasisId).dunkel;
    const zahlen = [];
    for (let zone = zoneVon; zone <= zoneBis; zone++) {
      this._zeichneZone(zone, b, sued, weite, dunkel, zahlen);
    }
    this._beschrifte(zahlen, dunkel);
    this._infoZeigen(this._infoText(weite));
  }

  _signatur() {
    const m = this.karte.getCenter(), g = this.karte.getSize();
    return `${this.karte.getZoom()}|${m.lat.toFixed(6)},${m.lng.toFixed(6)}|` +
           `${g.x}x${g.y}|${this.karte._fbpBasisId}`;
  }

  /** Gitter einer Zone im Streifen zwischen Zonenrand und Blattausschnitt */
  _zeichneZone(zone, b, sued, weite, dunkel, zahlen) {
    const west = Math.max(b.getWest(), 6 * (zone - 1) - 180);
    const ost = Math.min(b.getEast(), 6 * zone - 180);

    // Das Gitter liegt schräg zum Blatt – die UTM-Spanne über die vier Ecken
    // des Streifens deckt deshalb jede sichtbare Linie ab.
    const ecken = [
      [b.getSouth(), west], [b.getSouth(), ost],
      [b.getNorth(), west], [b.getNorth(), ost]
    ].map(([lat, lng]) => nachUTM(lat, lng, zone));
    const minOst = Math.floor(Math.min(...ecken.map(e => e.ost)) / weite) * weite;
    const maxOst = Math.ceil(Math.max(...ecken.map(e => e.ost)) / weite) * weite;
    const minNord = Math.floor(Math.min(...ecken.map(e => e.nord)) / weite) * weite;
    const maxNord = Math.ceil(Math.max(...ecken.map(e => e.nord)) / weite) * weite;
    if ((maxOst - minOst) / weite > MAX_LINIEN ||
        (maxNord - minNord) / weite > MAX_LINIEN) return;

    const stil = {
      pane: 'fbp-gitter', interactive: false,
      color: dunkel ? '#ffffff' : (this.sw ? '#000000' : '#2c4a9e'),
      weight: this.strichFaktor,
      opacity: dunkel ? 0.75 : 0.55
    };

    for (let o = minOst; o <= maxOst; o += weite) {
      const pfad = this._pfad(t => vonUTM(zone, o, minNord + t * (maxNord - minNord), sued), west, ost);
      if (pfad.length < 2) continue;
      L.polyline(pfad, stil).addTo(this.gruppe);
      this._randzahl(zahlen, pfad, 'oben', o, weite);
      if (!this.interaktiv) this._randzahl(zahlen, pfad, 'unten', o, weite);
    }
    for (let n = minNord; n <= maxNord; n += weite) {
      const pfad = this._pfad(t => vonUTM(zone, minOst + t * (maxOst - minOst), n, sued), west, ost);
      if (pfad.length < 2) continue;
      L.polyline(pfad, stil).addTo(this.gruppe);
      this._randzahl(zahlen, pfad, 'links', n, weite);
      if (!this.interaktiv) this._randzahl(zahlen, pfad, 'rechts', n, weite);
    }
  }

  /** Linienzug einer Gitterlinie, am Zonenrand abgeschnitten */
  _pfad(beiT, west, ost) {
    const pfad = [];
    for (let i = 0; i <= SEGMENTE; i++) {
      const p = beiT(i / SEGMENTE);
      if (p.lng >= west && p.lng <= ost) pfad.push([p.lat, p.lng]);
    }
    return pfad;
  }

  // ------------------------------------------------------------ Randzahlen

  /** Schnittpunkt der Linie mit einer Blattkante vormerken */
  _randzahl(zahlen, pfad, kante, wert, weite) {
    const g = this.karte.getSize();
    const f = this.strichFaktor;
    const rand = RAND_PX * f;
    const px = pfad.map(ll => this.karte.latLngToContainerPoint(ll));
    const waagerecht = kante === 'oben' || kante === 'unten';
    const lage = kante === 'oben' ? rand
      : kante === 'unten' ? g.y - rand
      : kante === 'links' ? rand : g.x - rand;

    for (let i = 1; i < px.length; i++) {
      const a = waagerecht ? px[i - 1].y : px[i - 1].x;
      const z = waagerecht ? px[i].y : px[i].x;
      if ((a - lage) * (z - lage) > 0 || a === z) continue;
      const t = (lage - a) / (z - a);
      const quer = waagerecht
        ? px[i - 1].x + (px[i].x - px[i - 1].x) * t
        : px[i - 1].y + (px[i].y - px[i - 1].y) * t;
      const frei = ECKE_FREI_PX * f;
      const kantenlaenge = waagerecht ? g.x : g.y;
      if (quer < frei || quer > kantenlaenge - frei) return;
      zahlen.push({
        punkt: waagerecht ? [quer, lage] : [lage, quer],
        kante, wert, weite
      });
      return;
    }
  }

  _beschrifte(zahlen, dunkel) {
    for (const z of zahlen) {
      L.marker(this.karte.containerPointToLatLng(z.punkt), {
        pane: 'fbp-gitter', interactive: false, keyboard: false,
        icon: L.divIcon({
          className: 'gitter-label',
          html: `<span class="gitter-zahl ${z.kante}${dunkel ? ' dunkel' : ''}">${zahlHTML(z.wert, z.weite)}</span>`,
          iconSize: null
        })
      }).addTo(this.gruppe);
    }
  }

  // ------------------------------------------------------------ Hinweis

  /* Maschenweite und 100-km-Buchstaben stehen klein in der Kartenecke: erst
     mit ihnen wird aus den Randzahlen eine vollständige MGRS-Angabe. */
  _infoText(weite) {
    const b = this.karte.getBounds();
    const stellen = [this.karte.getCenter(), b.getSouthWest(), b.getSouthEast(),
                     b.getNorthWest(), b.getNorthEast()];
    const zonen = new Map();
    for (const ll of stellen) {
      const m = toMGRS(ll.lat, ll.lng, 1);
      if (m.startsWith('–')) continue;
      const [zone, quadrat] = m.split(' ');
      if (!zonen.has(zone)) zonen.set(zone, new Set());
      zonen.get(zone).add(quadrat);
    }
    const weiteText = weite >= 1000 ? `${weite / 1000}-km-Gitter` : `${weite}-m-Gitter`;
    const lage = [...zonen].map(([zone, qs]) => `${zone} ${[...qs].sort().join('/')}`).join(' · ');
    return lage ? `UTMREF (MGRS) ${lage} · ${weiteText}` : `UTM · ${weiteText}`;
  }

  _infoZeigen(text) {
    if (!this._info) {
      /* Auf dem Bildschirm zur Maßstabsleiste unten rechts; auf dem Blatt
         sind dort Übersichtskarte und Maßstab – oben links ist frei. */
      this._info = L.control({ position: this.interaktiv ? 'bottomright' : 'topleft' });
      this._info.onAdd = () => L.DomUtil.create('div', 'gitter-info');
      this._info.addTo(this.karte);
    }
    this._info.getContainer().textContent = text;
  }

  _infoWeg() {
    if (this._info) { this._info.remove(); this._info = null; }
  }
}

/** Randzahl wie auf der topografischen Karte: die Kilometerstellen groß,
 *  die 100-km-Stellen davor klein – bei 100 m Maschenweite auch die
 *  Hundertmeterstelle dahinter. */
function zahlHTML(wert, weite) {
  const km = Math.floor(wert / 1000);
  const gross = String(km % 100).padStart(2, '0');
  const davor = String(Math.floor(km / 100));
  const danach = weite < 1000 ? `<small>${Math.floor((wert % 1000) / 100)}</small>` : '';
  return `<small>${davor}</small>${gross}${danach}`;
}
