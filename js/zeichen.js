// zeichen.js – taktische Zeichen als Kartenmarker

import { store, neuesZeichen, zeichenSichtbar, zeichengruppeZeigt } from './state.js';
import { symbolSVG, symbolMasse, symbolById, GRUNDBREITE } from './symbols.js';
import { escapeHtml } from './strecken.js';

export class ZeichenLayer {
  constructor(karte, opt = {}) {
    this.karte = karte;
    this.interaktiv = opt.interaktiv !== false;
    this.gruppe = L.layerGroup().addTo(karte);
    this.auswahl = null;
    this.setzModus = null;      // Symbol-ID, das beim nächsten Klick gesetzt wird
    this.setzZuteilung = null;  // {abschnitt, gruppe} für das neue Zeichen
    this.aufAuswahl = opt.aufAuswahl || (() => {});
    this.aufAenderung = opt.aufAenderung || (() => {});
    this.sw = !!opt.sw;
    /* Auf einen Abschnitt eingeschränkt zeigt die Karte dessen eigene Zeichen
       und die nicht zugeteilten: die gehören zum gemeinsamen Lagebild und
       fehlen sonst auf jedem Ausschnitt. `undefined` heißt: alle. */
    this.nurAbschnitt = opt.nurAbschnitt;
    /* Im Druck entscheidet die Auswahl, nicht der Augenschalter des Abschnitts
       auf der Arbeitskarte – aber nur für den gedruckten Abschnitt selbst,
       genau wie bei den Strecken. */
    this.abschnittSchaltet = opt.abschnittSchaltet !== false;
    if (this.interaktiv) {
      this._klick = e => this._kartenKlick(e);
      karte.on('click', this._klick);
    }
  }

  zerstoeren() {
    if (this.interaktiv) this.karte.off('click', this._klick);
    this.gruppe.remove();
  }

  /** `zuteilung` teilt das Zeichen beim Setzen gleich zu: `{abschnitt, gruppe}`.
   *  So legt „+ Zeichen in dieser Gruppe“ in einem Griff an, was sonst erst
   *  gesetzt, gesucht und von Hand zugeteilt werden müsste. */
  starteSetzen(symbolId, zuteilung = {}) {
    this.setzModus = symbolId;
    this.setzZuteilung = zuteilung;
    L.DomUtil.addClass(this.karte.getContainer(), 'modus-zeichen');
  }

  beendeSetzen() {
    this.setzModus = null;
    this.setzZuteilung = null;
    L.DomUtil.removeClass(this.karte.getContainer(), 'modus-zeichen');
  }

  _kartenKlick(e) {
    if (!this.setzModus) return;
    const sym = this.setzModus;
    const zut = this.setzZuteilung || {};
    let neu;
    store.aendern(p => {
      neu = neuesZeichen(e.latlng.lat, e.latlng.lng, sym);
      neu.abschnitt = zut.abschnitt || null;
      neu.gruppe = zut.gruppe || null;
      p.zeichen.push(neu);
    }, 'zeichen');
    this.beendeSetzen();
    this.auswahl = neu.id;
    this.zeichne();
    this.aufAuswahl(neu.id);
    this.aufAenderung();
  }

  waehle(zid) {
    this.auswahl = zid;
    this.zeichne();
    this.aufAuswahl(zid);
  }

  zeichne(optionen) {
    const p = store.projekt;
    const o = optionen || p.optionen;
    this.gruppe.clearLayers();
    const skala = o.symbolgroesse || 1;

    for (const z of p.zeichen) {
      if (z.sichtbar === false) continue;
      /* Die Zeichengruppe ist ein Filter des Lagebildes und gilt überall –
         auch auf dem Blatt eines eigens angeforderten Abschnitts. Wer die
         Gefahrenstellen ausblendet, will sie nicht im Druck wiederfinden. */
      if (!zeichengruppeZeigt(p, z)) continue;
      const angefordert = !this.abschnittSchaltet && !!this.nurAbschnitt &&
        z.abschnitt === this.nurAbschnitt;
      if (!angefordert && !zeichenSichtbar(p, z)) continue;
      if (this.nurAbschnitt && z.abschnitt && z.abschnitt !== this.nurAbschnitt) continue;
      const basis = symbolById(z.symbol);
      const breite = Math.round(GRUNDBREITE * skala * (z.groesse || 1));
      const opt = { symbol: z.symbol, drehung: z.drehung, breite, sw: this.sw };
      const svg = symbolSVG(opt);
      const masse = symbolMasse(opt);
      const gewaehlt = z.id === this.auswahl;

      const html =
        `<div class="tz-wrap${gewaehlt ? ' gewaehlt' : ''}">${svg}` +
        (z.label ? `<span class="tz-label">${escapeHtml(z.label)}</span>` : '') + `</div>`;

      const m = L.marker([z.lat, z.lng], {
        pane: 'fbp-zeichen',
        draggable: this.interaktiv,
        interactive: this.interaktiv,
        keyboard: false,
        icon: L.divIcon({
          className: 'fbp-zeichen-icon',
          html,
          iconSize: [masse.breite, masse.hoehe],
          iconAnchor: [masse.breite / 2, masse.hoehe / 2]
        })
      }).addTo(this.gruppe);

      if (!this.interaktiv) continue;

      m.on('click', e => { L.DomEvent.stop(e); this.waehle(z.id); });
      m.on('dragstart', () => store.schnappschuss());
      m.on('dragend', ev => {
        const ll = ev.target.getLatLng();
        store.aendern(() => { z.lat = ll.lat; z.lng = ll.lng; }, 'zeichen', { undo: false });
        this.aufAenderung();
      });
      m.bindTooltip(
        `<b>${escapeHtml(z.label || basis.name)}</b>` +
        (z.label ? `<br>${escapeHtml(basis.name)}` : '') +
        (z.bemerkung ? `<br>${escapeHtml(z.bemerkung)}` : ''),
        { direction: 'top', className: 'fbp-tooltip', offset: [0, -12] }
      );
    }
  }
}
