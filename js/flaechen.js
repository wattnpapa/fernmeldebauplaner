// flaechen.js – Flächen mit festen Maßen auf der Karte: Fahrzeuge, Zelte, Aufbauplätze

import { store, neueFlaeche, flaecheSichtbar } from './state.js';
import { escapeHtml } from './strecken.js';
import { flaechenartById } from './flaechen-vorlagen.js';

export { FLAECHENARTEN, AUFSTELLUNGEN, flaechenartById } from './flaechen-vorlagen.js';

/* Eine Fläche ist kein taktisches Zeichen: das Zeichen sagt, *was* an einer
   Stelle ist, die Fläche sagt, *wie viel Platz* es braucht. Sie wird deshalb
   maßstäblich gezeichnet – ein FüKomKW ist auf der Karte so groß, wie er auf
   dem Aufbauplatz steht – und schrumpft beim Herauszoomen bis zur Marke. */

// ---------------------------------------------------------------- Geometrie

/** Meter je Kartenpixel auf dieser Breite und Zoomstufe (Web-Mercator). */
export function meterJePixel(lat, zoom) {
  return 40075016.686 * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, zoom));
}

const winkel = f => (((Number(f.drehung) || 0) % 360) + 360) % 360;

/* Ein Punkt der Zeichnung (x nach rechts, y nach unten, in Metern ab Mitte)
   auf die Karte: erst um die Drehung im Uhrzeigersinn, dann nach Ost und
   Nord. Auf den paar Metern einer Fläche reicht die ebene Näherung; der
   Fehler liegt weit unter dem, was die Karte zeigt. */
export function flaechenPunkt(f, x, y) {
  const b = winkel(f) * Math.PI / 180;
  const ost = x * Math.cos(b) - y * Math.sin(b);
  const nord = -(x * Math.sin(b) + y * Math.cos(b));
  const lat = f.lat + nord / 111320;
  const lng = f.lng + ost / (111320 * Math.cos(f.lat * Math.PI / 180));
  return [lat, lng];
}

/** Die vier Ecken auf der Karte, im Uhrzeigersinn ab oben links. */
export function flaechenEcken(f) {
  const hb = f.breite / 2, hl = f.laenge / 2;
  return [[-hb, -hl], [hb, -hl], [hb, hl], [-hb, hl]].map(([x, y]) => flaechenPunkt(f, x, y));
}

/** Beschriftung der Maße, wie sie in Liste und Tooltip steht. */
export function masseText(f) {
  const z = n => (Math.round(n * 100) / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 });
  return `${z(f.breite)} × ${z(f.laenge)} m`;
}

export const flaechenTitel = f => f.name || flaechenartById(f.art).kurz;

// ---------------------------------------------------------------- Zeichnung

/* Jede Art hat eine stilisierte Draufsicht in Metern, damit sie auf der Karte
   auf einen Blick zu unterscheiden ist: der Koffer mit Ausschub und Kabine
   ist der FüKomKW, der breite Kasten mit Mast und Deichsel der Anhänger, das
   Rechteck mit Firstlinie das Zelt. Die Lage entspricht dem Erkundungsblatt –
   Fahrerhaus unten, Heckstufen oben, Ausschub vom Anhänger weg; beim
   Anhänger Deichsel und Mast oben, die Treppe unten. Die Zeichnung ist
   über die Vorlagenmaße hinaus dehnbar – wer eine Kante ändert, bekommt
   dieselbe Figur gestreckt. */
const FIGUREN = {
  fuekomkw: (b, l) => {
    const sx = b / 4.12, sy = l / 9.71;
    const r = (x, y, w, h, k, rx = 0) =>
      `<rect x="${x * sx}" y="${y * sy}" width="${w * sx}" height="${h * sy}" rx="${rx * sx}" class="fl-teil ${k}"/>`;
    const li = (x1, y1, x2, y2) =>
      `<line x1="${x1 * sx}" y1="${y1 * sy}" x2="${x2 * sx}" y2="${y2 * sy}" class="fl-linie"/>`;
    /* Dieselbe Sprache wie beim Anhänger: Stufen bedeuten Einstieg. Das
       Fahrerhaus bekommt die gerundete Front, Windschutzscheibe und Spiegel,
       damit die Fahrtrichtung auch bei kleiner Figur zu erkennen ist. */
    return r(1.62, 0.9, 2.5, 5.9, 'fl-voll') +   // Koffer
      r(2.5, 0.05, 0.74, 0.85, 'fl-leicht') +    // Trittstufen am Heck
      li(2.5, 0.35, 3.24, 0.35) + li(2.5, 0.62, 3.24, 0.62) +
      li(2.87, 0.9, 2.87, 1.15) +                // Hecktür
      r(0, 3.6, 1.62, 2.0, 'fl-voll') +          // Ausschub
      r(1.72, 6.9, 2.3, 2.7, 'fl-leicht', 0.55) + // Fahrerhaus, vorn gerundet
      li(1.85, 7.85, 3.89, 7.85) +               // Windschutzscheibe
      li(1.72, 7.3, 1.45, 7.45) + li(4.02, 7.3, 4.29, 7.45) +   // Spiegel
      `<circle cx="${2.87 * sx}" cy="${1.9 * sy}" r="${0.18 * sx}" class="fl-linie"/>`;   // Mast
  },
  anh_fuela: (b, l) => {
    const sx = b / 5.21, sy = l / 8.37;
    const r = (x, y, w, h, k) =>
      `<rect x="${x * sx}" y="${y * sy}" width="${w * sx}" height="${h * sy}" class="fl-teil ${k}"/>`;
    const P = (x, y) => `${x * sx},${y * sy}`;
    /* Vorn (oben) die Deichsel als V mit Kupplungsring und dem Mast in ihrer
       Mitte, hinten die Treppe mit Stufen: die beiden Enden müssen sich auf
       der Karte unterscheiden, sonst ist nicht zu erkennen, wo eingestiegen
       wird und wo das Zugfahrzeug steht. */
    return `<polyline points="${P(1.9, 1.7)} ${P(2.6, 0.35)} ${P(3.3, 1.7)}" class="fl-linie"/>` +   // Deichsel
      `<circle cx="${2.6 * sx}" cy="${0.3 * sy}" r="${0.2 * sx}" class="fl-linie"/>` +      // Kupplung
      `<circle cx="${2.6 * sx}" cy="${1.15 * sy}" r="${0.22 * sx}" class="fl-teil fl-voll"/>` +  // Mast
      r(0, 1.9, 1.35, 4.6, 'fl-leicht') +        // Ausschub links
      r(3.85, 1.9, 1.36, 4.6, 'fl-leicht') +     // Ausschub rechts
      r(1.35, 1.7, 2.5, 5.0, 'fl-voll') +        // Koffer
      r(2.05, 6.7, 1.1, 0.7, 'fl-leicht') +      // Podest
      r(2.2, 7.4, 0.8, 0.97, 'fl-leicht') +      // Treppe
      [7.65, 7.9, 8.15].map(y =>
        `<line x1="${2.2 * sx}" y1="${y * sy}" x2="${3.0 * sx}" y2="${y * sy}" class="fl-linie"/>`).join('');
  },
  zelt_sg300: (b, l) =>
    `<rect x="0" y="0" width="${b}" height="${l}" class="fl-teil fl-voll"/>` +
    `<line x1="0" y1="${l / 2}" x2="${b}" y2="${l / 2}" class="fl-linie"/>` +
    `<line x1="0" y1="0" x2="${b * 0.08}" y2="${l / 2}" class="fl-linie"/>` +
    `<line x1="0" y1="${l}" x2="${b * 0.08}" y2="${l / 2}" class="fl-linie"/>` +
    `<line x1="${b}" y1="0" x2="${b * 0.92}" y2="${l / 2}" class="fl-linie"/>` +
    `<line x1="${b}" y1="${l}" x2="${b * 0.92}" y2="${l / 2}" class="fl-linie"/>`
};

/**
 * Vollständiges <svg> einer Fläche. `px` ist die Kantenlänge eines Meters in
 * Bildpunkten; die Figur selbst rechnet in Metern, deshalb reicht ein viewBox.
 * Strichstärken hängen nicht am Maßstab (`vector-effect` im Stilblatt), sonst
 * wäre der Umriss beim Hineinzoomen armdick und beim Herauszoomen fort.
 */
export function flaechenSVG(f, px, o = {}) {
  const art = flaechenartById(f.art);
  const b = Math.max(0.1, Number(f.breite) || art.breite);
  const l = Math.max(0.1, Number(f.laenge) || art.laenge);
  const figur = FIGUREN[art.id] ? FIGUREN[art.id](b, l) : '';
  const farbe = o.sw ? '#000' : (f.farbe || '#003399');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b} ${l}"
    width="${b * px}" height="${l * px}" class="fl-svg${art.umriss ? ' fl-umriss' : ''}"
    style="--farbe:${farbe};--strich:${o.strich || 1}" role="img"
    aria-label="${escapeHtml(flaechenTitel(f))}"
    ><rect x="0" y="0" width="${b}" height="${l}" class="fl-feld"/>${figur}</svg>`;
}

/** Kleine Vorschau einer Art für Liste und Auswahl. */
export function flaechenVorschau(artId, kante = 28) {
  const art = flaechenartById(artId);
  const px = kante / Math.max(art.breite, art.laenge);
  return flaechenSVG({ art: art.id, breite: art.breite, laenge: art.laenge, farbe: '#003399' }, px);
}

// ---------------------------------------------------------------- Kartenebene

/* Unterhalb dieser Kantenlänge steht statt der Figur eine Marke: eine Fläche
   von einem halben Bildpunkt wäre weder zu sehen noch zu treffen, und beim
   Herauszoomen soll die Führungsstelle nicht von der Karte verschwinden. */
const MARKE_AB = 10;
const MARKE = 12;

export class FlaechenLayer {
  constructor(karte, opt = {}) {
    this.karte = karte;
    this.interaktiv = opt.interaktiv !== false;
    this.gruppe = L.layerGroup().addTo(karte);
    this.auswahl = null;
    this.setzModus = null;        // Vorlage, die beim nächsten Klick gesetzt wird
    this.setzZuteilung = null;
    this.aufAuswahl = opt.aufAuswahl || (() => {});
    this.aufAenderung = opt.aufAenderung || (() => {});
    this.sw = !!opt.sw;
    this.strichFaktor = opt.strichFaktor || 1;
    /* Abschnittsregeln wie bei den Zeichen: eingeschränkt zeigt die Ebene die
       Flächen des Abschnitts und die nicht zugeteilten; im Druck entscheidet
       die Auswahl und nicht das Auge des Abschnitts auf der Arbeitskarte. */
    this.nurAbschnitt = opt.nurAbschnitt;
    this.abschnittSchaltet = opt.abschnittSchaltet !== false;
    this._marker = new Map();
    /* Die Größe hängt am Zoom: nach jedem Zoomschritt werden die Figuren neu
       gerechnet, nicht nur verschoben. */
    this._zoomWaechter = () => this.zeichne();
    karte.on('zoomend', this._zoomWaechter);
    if (this.interaktiv) {
      this._klick = e => this._kartenKlick(e);
      karte.on('click', this._klick);
    }
  }

  zerstoeren() {
    this.karte.off('zoomend', this._zoomWaechter);
    if (this.interaktiv) this.karte.off('click', this._klick);
    this.gruppe.remove();
  }

  /** Setzmodus: `vorlage` ist eine Art (`{id}`) oder eine Aufstellung (`{teile}`). */
  starteSetzen(vorlage, zuteilung = {}) {
    this.setzModus = vorlage;
    this.setzZuteilung = zuteilung;
    L.DomUtil.addClass(this.karte.getContainer(), 'modus-flaeche');
  }

  beendeSetzen() {
    this.setzModus = null;
    this.setzZuteilung = null;
    L.DomUtil.removeClass(this.karte.getContainer(), 'modus-flaeche');
  }

  _kartenKlick(e) {
    if (!this.setzModus) return;
    /* Der Klick ist verbraucht: der allgemeine Klickhorcher der Karte kommt
       nach dieser Ebene an die Reihe und nähme der eben gesetzten Fläche
       sonst die Auswahl gleich wieder ab. */
    if (e.originalEvent) e.originalEvent._fbpVerbraucht = true;
    const vorlage = this.setzModus;
    const zut = this.setzZuteilung || {};
    const neue = [];
    store.aendern(p => {
      const teile = vorlage.teile || [{ art: vorlage.id, dx: 0 }];
      /* Ein Verbund entsteht nur aus einer Aufstellung – eine einzelne Fläche
         trägt keinen, sonst zeigte „Aus dem Verbund lösen“ dort ins Leere. */
      const verbund = vorlage.teile ? neueFlaeche(0, 0).id : null;
      for (const t of teile) {
        const mitte = { lat: e.latlng.lat, lng: e.latlng.lng, drehung: 0 };
        const [lat, lng] = flaechenPunkt(mitte, t.dx || 0, t.dy || 0);
        const f = neueFlaeche(lat, lng, t.art);
        f.abschnitt = zut.abschnitt || null;
        f.verbund = verbund;
        p.flaechen.push(f);
        neue.push(f);
      }
    }, 'flaeche');
    this.beendeSetzen();
    this.auswahl = neue[0].id;
    this.zeichne();
    this.aufAuswahl(neue[0].id);
    this.aufAenderung();
  }

  waehle(fid) {
    this.auswahl = fid;
    this.zeichne();
    this.aufAuswahl(fid);
  }

  /** Welche Flächen diese Ebene zeigt – dieselbe Regel wie bei den Zeichen. */
  gezeichnete() {
    const p = store.projekt;
    return (p.flaechen || []).filter(f => {
      if (f.sichtbar === false) return false;
      const angefordert = !this.abschnittSchaltet && !!this.nurAbschnitt && f.abschnitt === this.nurAbschnitt;
      if (!angefordert && !flaecheSichtbar(p, f)) return false;
      return !(this.nurAbschnitt && f.abschnitt && f.abschnitt !== this.nurAbschnitt);
    });
  }

  zeichne() {
    this.gruppe.clearLayers();
    this._marker.clear();
    const zoom = this.karte.getZoom();
    for (const f of this.gezeichnete()) this._flaeche(f, 1 / meterJePixel(f.lat, zoom));
    if (this.interaktiv && this.auswahl) {
      const f = store.projekt.flaechen.find(x => x.id === this.auswahl);
      if (f && this._marker.has(f.id)) this._drehgriff(f);
    }
  }

  _icon(f, px) {
    const gewaehlt = f.id === this.auswahl;
    const bPx = f.breite * px, lPx = f.laenge * px;
    if (Math.max(bPx, lPx) < MARKE_AB) {
      return L.divIcon({
        className: 'fbp-flaeche-icon',
        html: `<span class="fl-marke${gewaehlt ? ' gewaehlt' : ''}" style="--farbe:${this.sw ? '#000' : (f.farbe || '#003399')}"></span>`,
        iconSize: [MARKE, MARKE], iconAnchor: [MARKE / 2, MARKE / 2]
      });
    }
    /* Das Feld des Markers ist das umschriebene Rechteck der gedrehten Figur –
       Leaflet setzt den Anker auf seine Mitte, die Figur dreht sich darin um
       dieselbe Mitte. */
    const g = winkel(f) * Math.PI / 180;
    const feldB = Math.ceil(Math.abs(bPx * Math.cos(g)) + Math.abs(lPx * Math.sin(g)));
    const feldL = Math.ceil(Math.abs(bPx * Math.sin(g)) + Math.abs(lPx * Math.cos(g)));
    const svg = flaechenSVG(f, px, { sw: this.sw, strich: this.strichFaktor });
    const zeigeLabel = Math.min(bPx, lPx) >= 28;
    const html = `<div class="fl-wrap${gewaehlt ? ' gewaehlt' : ''}" style="width:${feldB}px;height:${feldL}px">
        <div class="fl-dreh" style="width:${Math.ceil(bPx)}px;height:${Math.ceil(lPx)}px;transform:rotate(${winkel(f)}deg)">${svg}</div>
        ${zeigeLabel ? `<span class="fl-label">${escapeHtml(flaechenTitel(f))}</span>` : ''}
      </div>`;
    return L.divIcon({
      className: 'fbp-flaeche-icon', html,
      iconSize: [feldB, feldL], iconAnchor: [feldB / 2, feldL / 2]
    });
  }

  _flaeche(f, px) {
    const m = L.marker([f.lat, f.lng], {
      pane: 'fbp-flaechen',
      draggable: this.interaktiv,
      interactive: this.interaktiv,
      keyboard: false,
      icon: this._icon(f, px)
    }).addTo(this.gruppe);
    this._marker.set(f.id, m);
    if (!this.interaktiv) return;

    m.on('click', e => { L.DomEvent.stop(e); this.waehle(f.id); });
    m.bindTooltip(
      `<b>${escapeHtml(flaechenTitel(f))}</b><br>${escapeHtml(flaechenartById(f.art).name)} · ${masseText(f)}` +
      (f.bemerkung ? `<br>${escapeHtml(f.bemerkung)}` : ''),
      { direction: 'top', className: 'fbp-tooltip', offset: [0, -8] }
    );

    /* Ein Verbund wandert als Ganzes: die übrigen Teile folgen dem gezogenen
       um denselben Versatz in Kartenpixeln – so bleibt die Aufstellung, wie
       das Blatt sie vorgibt, auch nach dem Verschieben Kante an Kante. */
    let start = null;
    m.on('dragstart', () => {
      store.schnappschuss();
      start = this.karte.latLngToLayerPoint(m.getLatLng());
      this.gruppe.eachLayer(l => { if (l._fbpGriff) this.gruppe.removeLayer(l); });
    });
    m.on('drag', () => {
      if (!f.verbund) return;
      const jetzt = this.karte.latLngToLayerPoint(m.getLatLng());
      const d = jetzt.subtract(start);
      start = jetzt;
      for (const g of this._verbund(f)) {
        const mg = this._marker.get(g.id);
        if (!mg) continue;
        mg.setLatLng(this.karte.layerPointToLatLng(this.karte.latLngToLayerPoint(mg.getLatLng()).add(d)));
      }
    });
    m.on('dragend', () => {
      store.aendern(() => {
        for (const g of [f, ...this._verbund(f)]) {
          const mg = this._marker.get(g.id);
          if (!mg) continue;
          const ll = mg.getLatLng();
          g.lat = ll.lat; g.lng = ll.lng;
        }
      }, 'flaeche', { undo: false });
      this.aufAenderung();
    });
  }

  /** Die anderen Teile desselben Verbunds – die gezeichneten, nicht alle. */
  _verbund(f) {
    if (!f.verbund) return [];
    return this.gezeichnete().filter(g => g.verbund === f.verbund && g.id !== f.id);
  }

  /* Der Drehgriff sitzt vor der oberen Kante der Figur. Gezogen wird er um
     die Mitte; die Drehung folgt der Richtung zwischen Mitte und Griff. Das
     ist der Handgriff, der sich auf der Karte von selbst erklärt – ein
     Gradfeld steht zusätzlich im Eintrag. */
  _drehgriff(f) {
    const px = 1 / meterJePixel(f.lat, this.karte.getZoom());
    const abstand = Math.max(f.laenge * px, MARKE_AB) / 2 + 14;
    const mitte = this.karte.latLngToLayerPoint([f.lat, f.lng]);
    const g = winkel(f) * Math.PI / 180;
    const pos = this.karte.layerPointToLatLng(
      mitte.add(L.point(abstand * Math.sin(g), -abstand * Math.cos(g))));
    const griff = L.marker(pos, {
      pane: 'fbp-griffe', draggable: true, keyboard: false,
      icon: L.divIcon({
        className: 'fbp-flaeche-griff', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9]
      }),
      title: 'Ziehen dreht die Fläche'
    }).addTo(this.gruppe);
    griff._fbpGriff = true;

    griff.on('dragstart', () => store.schnappschuss());
    griff.on('drag', () => {
      const q = this.karte.latLngToLayerPoint(griff.getLatLng()).subtract(mitte);
      const grad = Math.round(((Math.atan2(q.x, -q.y) * 180 / Math.PI) + 360) % 360);
      this._drehen(f, grad - winkel(f), mitte, px);
    });
    griff.on('dragend', () => {
      /* Die Werte stehen schon in den Flächen – gemeldet wird nur noch, damit
         Speicherstand und Seitenleiste nachziehen. Der Undo-Punkt liegt beim
         Anfassen des Griffs. */
      store.aendern(() => {}, 'flaeche', { undo: false });
      this.aufAenderung();
    });
  }

  /* Dreht die Fläche und ihren Verbund um die Mitte der gezogenen Fläche –
     die Teile behalten ihre Lage zueinander, wie beim Verschieben. Während
     des Ziehens werden nur die Marker umgesetzt; gespeichert wird beim
     Loslassen. */
  _drehen(f, delta, mitte, px) {
    if (!delta) return;
    f.drehung = (winkel(f) + delta + 360) % 360;
    this._marker.get(f.id)?.setIcon(this._icon(f, px));
    const b = delta * Math.PI / 180;
    for (const g of this._verbund(f)) {
      const q = this.karte.latLngToLayerPoint([g.lat, g.lng]).subtract(mitte);
      const r = L.point(q.x * Math.cos(b) - q.y * Math.sin(b), q.x * Math.sin(b) + q.y * Math.cos(b));
      const ll = this.karte.layerPointToLatLng(mitte.add(r));
      g.lat = ll.lat; g.lng = ll.lng;
      g.drehung = (winkel(g) + delta + 360) % 360;
      const mg = this._marker.get(g.id);
      if (mg) { mg.setLatLng(ll); mg.setIcon(this._icon(g, px)); }
    }
  }
}
