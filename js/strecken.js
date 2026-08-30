// strecken.js – Darstellung, Zeichnen und Bearbeiten der Bau-Strecken

import { distanz, kumuliert, formatLaenge, meter, punktBeiLaenge, standortText } from './geo.js';
import { store, neuerPunkt, punktartById, kabelById, streckeSichtbar } from './state.js';
import { auslegung, querschnittText } from './strom.js';
import { querungsartById, reichweite, abbindeBedarf } from './vorschrift.js';

/* Eine rechnerische Trommelstelle so dicht an einer geplanten Muffe ist
   dieselbe Verbindung und wird nicht zusätzlich aufgeführt. */
const MUFFEN_NAEHE = 30;

/* Obergrenze der Trommelstöße. Die Schleife endet von sich aus am Streckenende;
   die Schranke fängt nur den Fall einer versehentlich winzigen Trommellänge ab –
   kennzahlen() läuft in der Seitenleiste bei jedem Tastendruck. */
const MAX_STOESSE = 500;

/** Kennzahlen einer Strecke – überall gleich gerechnet */
export function kennzahlen(strecke) {
  const p = strecke.punkte;
  /* Die kumulierten Längen tragen die Trassenlänge in ihrem letzten Wert; so
     fallen die teuren Entfernungsrechnungen nur einmal an. */
  const kum = kumuliert(p);
  const trasse = kum[kum.length - 1];
  const zuschlag = Math.max(0, Number(strecke.zuschlag) || 0);
  const bedarf = trasse * (1 + zuschlag / 100);
  const tl = Math.max(1, Number(strecke.trommellaenge) || 500);
  const leistung = Math.max(1, Number(strecke.verlegeleistung) || 800);
  const kabel = kabelById(strecke.kabeltyp);
  const trommeln = bedarf > 0 ? Math.ceil(bedarf / tl) : 0;
  const querungsliste = querungen(p, kum);
  return {
    trasse,
    zuschlag,
    bedarf,
    trommellaenge: tl,
    trommeln,
    /* Nur belegte Kabelarten tragen ein Trommelgewicht; sonst bleibt das Feld leer,
       damit im Bauauftrag keine erfundene Traglast steht. */
    trommelgewicht: kabel.gewicht,
    transportgewicht: kabel.gewicht ? trommeln * kabel.gewicht : null,
    punkte: p.length,
    abschnitte: Math.max(0, p.length - 1),
    bauzeitStunden: bedarf / leistung,
    muffen: p.filter(x => x.art === 'muffe').length,
    querungen: querungsliste.length,
    querungsliste,
    /* Genehmigungspflichtig ist auch, was die Vorschrift nur an Bauwerken
       zulässt – der Trupp braucht dafür ebenso eine Freigabe. */
    querungenGenehmigung: querungsliste.filter(q => q.art.genehmigung || q.art.verbot).length,
    laengenverbindungen: laengenverbindungen(p, kum, bedarf, tl, zuschlag),
    abbinden: abbindeBedarf(bedarf),
    /* Maßgebend ist die tatsächlich liegende Kabellänge, also der Bedarf
       einschließlich Bauzuschlag – so wie es beim Spannungsfall der
       Stromleitung schon gehandhabt wird, nicht über die Trassenlänge. */
    reichweite: reichweite(strecke.kabeltyp, strecke.verlegeart, bedarf),
    kabel,
    /* Der Querschnitt wird über die tatsächlich liegende Leitung gerechnet,
       also über den Bedarf einschließlich Bauzuschlag – nicht über die Trasse. */
    strom: strecke.kabeltyp === 'strom' ? auslegung(strecke.strom, bedarf) : null
  };
}

/** Querungen in Trassenreihenfolge, Art nach KatS-Dv 861, Abschnitt 8 aufgelöst */
function querungen(punkte, kum) {
  const out = [];
  punkte.forEach((pt, i) => {
    if (pt.art !== 'querung') return;
    out.push({
      nr: out.length + 1,
      punktNr: i + 1,
      name: pt.name || '',
      art: querungsartById(pt.querungsart),
      lat: pt.lat,
      lng: pt.lng,
      abAnfang: kum[i]
    });
  });
  return out;
}

/**
 * Stellen, an denen eine Längenverbindung entsteht: geplante Muffen und die
 * rechnerischen Trommelstöße, zusammengeführt und nach Lage durchnumeriert.
 * @returns {object[]} leer, solange die Strecke keine zwei Punkte hat
 */
function laengenverbindungen(punkte, kum, bedarf, trommellaenge, zuschlag) {
  if (punkte.length < 2 || !(bedarf > 0)) return [];

  const namen = punkte.map(pt => pt.name || '');
  const liste = [];

  punkte.forEach((pt, i) => {
    if (pt.art !== 'muffe') return;
    liste.push({
      nr: 0,
      quelle: 'geplant',
      abAnfang: kum[i],
      lat: pt.lat,
      lng: pt.lng,
      punktNr: i + 1,
      name: pt.name || '',
      lage: standortText(punkte, kum[i], namen)
    });
  });

  /* Die Trommellängen zählen entlang des Kabels, das wegen des Bauzuschlags
     länger ist als die Trasse. Nur über den Zuschlag zurückgerechnet lässt sich
     der Stoß als Trassenmeter und damit als Ort auf der Karte angeben. */
  const streckung = 1 + zuschlag / 100;
  const muffen = liste.map(v => v.abAnfang);
  const stoesse = Math.min(MAX_STOESSE, Math.ceil(bedarf / trommellaenge));
  for (let k = 1; k <= stoesse; k++) {
    const kabelAbAnfang = k * trommellaenge;
    if (kabelAbAnfang >= bedarf) break;
    const abAnfang = kabelAbAnfang / streckung;
    // Dort ist die Verbindung schon geplant, sie wird nicht doppelt gezählt.
    if (muffen.some(m => Math.abs(m - abAnfang) < MUFFEN_NAEHE)) continue;
    const stelle = punktBeiLaenge(punkte, abAnfang);
    if (!stelle) continue;
    liste.push({
      nr: 0,
      quelle: 'rechnerisch',
      abAnfang,
      kabelAbAnfang,
      lat: stelle.lat,
      lng: stelle.lng,
      punktNr: stelle.index + 1,
      name: '',
      lage: standortText(punkte, abAnfang, namen)
    });
  }

  liste.sort((a, b) => a.abAnfang - b.abAnfang);
  liste.forEach((v, i) => { v.nr = i + 1; });
  return liste;
}

/** Summen über mehrere Strecken – für die Seitenleiste und den Sammeldruck.
 *  `nachKabel` fasst zusätzlich je Leitungsart zusammen; danach wird das
 *  Material bestellt, nicht nach Strecken. */
export function gesamtKennzahlen(strecken) {
  const ges = {
    anzahl: strecken.length, trasse: 0, bedarf: 0, trommeln: 0,
    gewicht: 0, gewichtVollstaendig: true,
    bauzeitStunden: 0, muffen: 0, querungen: 0, punkte: 0,
    nachKabel: []
  };
  const je = new Map();
  for (const s of strecken) {
    const k = kennzahlen(s);
    ges.trasse += k.trasse;
    ges.bedarf += k.bedarf;
    ges.trommeln += k.trommeln;
    ges.bauzeitStunden += k.bauzeitStunden;
    ges.muffen += k.muffen;
    ges.querungen += k.querungen;
    ges.punkte += k.punkte;
    if (k.transportgewicht) ges.gewicht += k.transportgewicht;
    else ges.gewichtVollstaendig = false;

    const eintrag = je.get(k.kabel.id) || { kabel: k.kabel, strecken: 0, bedarf: 0, trommeln: 0, gewicht: 0 };
    eintrag.strecken++;
    eintrag.bedarf += k.bedarf;
    eintrag.trommeln += k.trommeln;
    eintrag.gewicht += k.transportgewicht || 0;
    je.set(k.kabel.id, eintrag);
  }
  ges.nachKabel = [...je.values()].sort((a, b) => b.bedarf - a.bedarf);
  return ges;
}

export function segmentLaengen(strecke) {
  const out = [];
  for (let i = 1; i < strecke.punkte.length; i++) {
    out.push(distanz(strecke.punkte[i - 1], strecke.punkte[i]));
  }
  return out;
}

export { kumuliert };

const mitte = (a, b) => L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);

/**
 * Zeichnet und verwaltet alle Strecken auf einer Karte.
 * Wird sowohl für die Arbeitskarte als auch für die Druckkarte benutzt
 * (dort mit interaktiv:false).
 */
export class StreckenLayer {
  constructor(karte, opt = {}) {
    this.karte = karte;
    this.interaktiv = opt.interaktiv !== false;
    this.gruppe = L.layerGroup().addTo(karte);
    this.auswahl = null;        // Strecken-ID
    this.aktiverPunkt = null;   // Punkt-ID
    this.zeichenModus = null;   // Strecken-ID während des Zeichnens
    this.aufAuswahl = opt.aufAuswahl || (() => {});
    this.aufAenderung = opt.aufAenderung || (() => {});
    this.sw = !!opt.sw;                       // Schwarz-Weiß-Druck
    this.hervorheben = opt.hervorheben || null;  // diese Strecke betonen
    this.nurStrecke = opt.nurStrecke || null;    // nur diese zeichnen
    // Sammeldruck: nur die Strecken der Sammlung, unabhängig davon, ob sie
    // auf der Arbeitskarte gerade ausgeblendet sind.
    this.nurStrecken = opt.nurStrecken ? new Set(opt.nurStrecken) : null;
    this.andereBlass = opt.andereBlass !== false;
    // Die Druckkarte wird doppelt so groß gerendert und per CSS halbiert;
    // damit die Linien im Ausdruck gleich stark wirken, werden sie mitskaliert.
    this.strichFaktor = opt.strichFaktor || 1;
    this._vorschau = null;
    this._vorschauLabel = null;
    this._bind();
  }

  _bind() {
    if (!this.interaktiv) return;
    this._klick = e => this._kartenKlick(e);
    this._move = e => this._kartenMove(e);
    this.karte.on('click', this._klick);
    this.karte.on('mousemove', this._move);
  }

  zerstoeren() {
    if (this.interaktiv) {
      this.karte.off('click', this._klick);
      this.karte.off('mousemove', this._move);
    }
    this.gruppe.remove();
  }

  // ------------------------------------------------------------ Zeichenmodus

  starteZeichnen(sid) {
    this.zeichenModus = sid;
    this.auswahl = sid;
    L.DomUtil.addClass(this.karte.getContainer(), 'modus-zeichnen');
    this.zeichne();
  }

  beendeZeichnen() {
    this.zeichenModus = null;
    L.DomUtil.removeClass(this.karte.getContainer(), 'modus-zeichnen');
    this._raeumeVorschau();
    this.zeichne();
    this.aufAenderung();
  }

  letztenPunktZurueck() {
    const s = store.strecke(this.zeichenModus);
    if (!s || !s.punkte.length) return;
    store.aendern(() => { s.punkte.pop(); this._artenAktualisieren(s); }, 'strecke');
  }

  _kartenKlick(e) {
    if (!this.zeichenModus) return;
    const s = store.strecke(this.zeichenModus);
    if (!s) return this.beendeZeichnen();
    store.aendern(() => {
      s.punkte.push(neuerPunkt(e.latlng.lat, e.latlng.lng));
      this._artenAktualisieren(s);
    }, 'strecke');
  }

  _kartenMove(e) {
    if (!this.zeichenModus) return this._raeumeVorschau();
    const s = store.strecke(this.zeichenModus);
    if (!s || !s.punkte.length) return this._raeumeVorschau();
    const letzter = s.punkte[s.punkte.length - 1];
    const pfad = [[letzter.lat, letzter.lng], e.latlng];
    if (!this._vorschau) {
      this._vorschau = L.polyline(pfad, {
        pane: 'fbp-strecken', color: s.farbe, weight: 3, opacity: 0.85, dashArray: '6 6', interactive: false
      }).addTo(this.gruppe);
    } else {
      this._vorschau.setLatLngs(pfad).setStyle({ color: s.farbe });
    }
    const d = distanz(letzter, e.latlng);
    const html = `<span class="seg-mass vorschau">${meter(d)}</span>`;
    const pos = mitte(letzter, e.latlng);
    if (!this._vorschauLabel) {
      this._vorschauLabel = L.marker(pos, {
        pane: 'fbp-labels', interactive: false,
        icon: L.divIcon({ className: 'fbp-label', html, iconSize: null })
      }).addTo(this.gruppe);
    } else {
      this._vorschauLabel.setLatLng(pos);
      this._vorschauLabel.getElement().innerHTML = html;
    }
  }

  _raeumeVorschau() {
    if (this._vorschau) { this.gruppe.removeLayer(this._vorschau); this._vorschau = null; }
    if (this._vorschauLabel) { this.gruppe.removeLayer(this._vorschauLabel); this._vorschauLabel = null; }
  }

  /** Erster Punkt = Anfang, letzter = Ende – solange nicht manuell gesetzt */
  _artenAktualisieren(s) {
    s.punkte.forEach((p, i) => {
      if (p._manuell) return;
      if (i === 0) p.art = 'start';
      else if (i === s.punkte.length - 1) p.art = 'ziel';
      else if (p.art === 'start' || p.art === 'ziel') p.art = 'punkt';
    });
  }

  // ------------------------------------------------------------ Auswahl

  waehle(sid, pid = null) {
    this.auswahl = sid;
    this.aktiverPunkt = pid;
    this.zeichne();
    this.aufAuswahl(sid, pid);
  }

  // ------------------------------------------------------------ Rendering

  zeichne(optionen) {
    const p = store.projekt;
    const o = optionen || p.optionen;
    this.gruppe.clearLayers();
    this._vorschau = null; this._vorschauLabel = null;

    for (const s of p.strecken) {
      if (this.nurStrecke && s.id !== this.nurStrecke) continue;
      if (this.nurStrecken && !this.nurStrecken.has(s.id)) continue;
      /* Ausdrücklich angeforderte Strecken werden immer gezeichnet: im Druck
         entscheidet die Auswahl, nicht der Augenschalter der Arbeitskarte. */
      const angefordert = s.id === this.nurStrecke || s.id === this.hervorheben ||
        (this.nurStrecken && this.nurStrecken.has(s.id));
      if (!angefordert && !streckeSichtbar(p, s)) continue;
      this._zeichneStrecke(s, o);
    }
  }

  /**
   * Linienstil. Im S/W-Druck tragen Strichmuster die Unterscheidung,
   * nicht die Farbe: die Auftragsstrecke ist durchgezogen und schwarz,
   * alle anderen gestrichelt und grau.
   */
  _stil(s) {
    const st = this._stilRoh(s);
    const f = this.strichFaktor;
    return f === 1 ? st : {
      ...st,
      breite: st.breite * f,
      fassung: st.fassung * f,
      strich: st.strich ? st.strich.split(' ').map(n => Number(n) * f).join(' ') : st.strich
    };
  }

  _stilRoh(s) {
    const betont = this.hervorheben ? s.id === this.hervorheben : true;
    const nebensache = this.hervorheben && !betont;
    if (this.sw) {
      return {
        farbe: nebensache ? '#8a8a8a' : '#000000',
        breite: nebensache ? 2.4 : 5,
        strich: nebensache ? '5 5' : (s.verlegeart === 'erd' ? '16 6' : (s.verlegeart === 'ober' ? '2 7' : null)),
        deckkraft: nebensache ? 0.85 : 1,
        fassung: nebensache ? 0 : 8.5
      };
    }
    return {
      farbe: s.farbe,
      breite: nebensache ? 2.6 : (betont && this.hervorheben ? 6 : (s.id === this.auswahl ? 6 : 4.5)),
      strich: s.verlegeart === 'erd' ? '14 7' : (s.verlegeart === 'ober' ? '2 8' : null),
      deckkraft: nebensache ? 0.45 : 1,
      fassung: nebensache ? 0 : (s.id === this.auswahl || betont && this.hervorheben ? 11 : 8)
    };
  }

  _zeichneStrecke(s, o) {
    const gewaehlt = s.id === this.auswahl;
    const st = this._stil(s);
    const nebensache = this.hervorheben && s.id !== this.hervorheben;
    const pfad = s.punkte.map(pt => [pt.lat, pt.lng]);
    if (pfad.length >= 2) {
      // weiße Kontrastfassung darunter
      if (st.fassung) {
        L.polyline(pfad, {
          pane: 'fbp-strecken', color: '#ffffff', weight: st.fassung,
          opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false
        }).addTo(this.gruppe);
      }

      const linie = L.polyline(pfad, {
        pane: 'fbp-strecken', color: st.farbe, weight: st.breite,
        opacity: st.deckkraft, lineCap: 'round', lineJoin: 'round',
        dashArray: st.strich,
        interactive: this.interaktiv, bubblingMouseEvents: false
      }).addTo(this.gruppe);
      if (this.interaktiv) {
        linie.on('click', e => { L.DomEvent.stop(e); if (!this.zeichenModus) this.waehle(s.id); });
        linie.bindTooltip(() => this._tooltipText(s), { sticky: true, direction: 'top', className: 'fbp-tooltip' });
      }
    }

    // Teillängen
    if (o.teillaengen && pfad.length >= 2 && !nebensache) {
      const laengen = segmentLaengen(s);
      for (let i = 1; i < s.punkte.length; i++) {
        const a = s.punkte[i - 1], b = s.punkte[i];
        L.marker(mitte(a, b), {
          pane: 'fbp-labels', interactive: false,
          icon: L.divIcon({
            className: 'fbp-label',
            html: `<span class="seg-mass" style="--farbe:${st.farbe}">${meter(laengen[i - 1])}</span>`,
            iconSize: null
          })
        }).addTo(this.gruppe);
      }
    }

    // Punkte
    if ((o.punktnummern !== false || gewaehlt) && !nebensache) {
      s.punkte.forEach((pt, i) => this._zeichnePunkt(s, pt, i, gewaehlt, o, st));
    }

    // Einfügegriffe zwischen den Punkten
    if (this.interaktiv && gewaehlt && !this.zeichenModus && s.punkte.length >= 2) {
      for (let i = 1; i < s.punkte.length; i++) {
        const m = mitte(s.punkte[i - 1], s.punkte[i]);
        const griff = L.marker(m, {
          pane: 'fbp-griffe', draggable: true, title: 'Ziehen: Zwischenpunkt einfügen',
          icon: L.divIcon({ className: 'fbp-einfuegen', html: '<i></i>', iconSize: [14, 14], iconAnchor: [7, 7] })
        }).addTo(this.gruppe);
        const idx = i;
        griff.on('dragend', ev => {
          const ll = ev.target.getLatLng();
          store.aendern(() => {
            const np = neuerPunkt(ll.lat, ll.lng);
            np._manuell = false;
            s.punkte.splice(idx, 0, np);
            this._artenAktualisieren(s);
          }, 'strecke');
          this.aufAenderung();
        });
      }
    }

    // Streckenname mit Gesamtlänge
    if (o.gesamtlaenge && pfad.length >= 1 && !nebensache) {
      const k = kennzahlen(s);
      const anker = s.punkte[Math.floor((s.punkte.length - 1) / 2)];
      const versatz = s.punkte.length >= 2 ? '' : ' allein';
      L.marker([anker.lat, anker.lng], {
        pane: 'fbp-labels', interactive: false,
        icon: L.divIcon({
          className: 'fbp-label',
          html: `<span class="strecken-mass${versatz}${gewaehlt ? ' aktiv' : ''}" style="--farbe:${st.farbe}">
                   <b>${escapeHtml(s.name)}</b>
                   <span class="wert">${formatLaenge(k.trasse)}</span>
                   ${k.zuschlag ? `<span class="zus">+${k.zuschlag}% → ${formatLaenge(k.bedarf)}</span>` : ''}
                 </span>`,
          iconSize: null
        })
      }).addTo(this.gruppe);
    }
  }

  _zeichnePunkt(s, pt, i, gewaehlt, o, st = this._stil(s)) {
    const art = punktartById(pt.art);
    const nr = i + 1;
    const aktiv = gewaehlt && pt.id === this.aktiverPunkt;
    const klassen = ['fbp-punkt', `art-${pt.art}`, gewaehlt ? 'gewaehlt' : '', aktiv ? 'aktiv' : ''].join(' ');
    const beschriftung = o.punktnummern === false ? '' : (art.kurz === '·' ? nr : `${nr}${art.kurz}`);

    const m = L.marker([pt.lat, pt.lng], {
      pane: 'fbp-griffe',
      draggable: this.interaktiv && gewaehlt && !this.zeichenModus,
      keyboard: false,
      interactive: this.interaktiv,
      icon: L.divIcon({
        className: 'fbp-punkt-icon',
        html: `<span class="${klassen}" style="--farbe:${st.farbe}">${beschriftung}</span>`,
        iconSize: [22, 22], iconAnchor: [11, 11]
      })
    }).addTo(this.gruppe);

    if (!this.interaktiv) return;

    m.on('click', e => {
      L.DomEvent.stop(e);
      if (this.zeichenModus) return;
      this.waehle(s.id, pt.id);
    });
    m.on('drag', ev => {
      const ll = ev.target.getLatLng();
      pt.lat = ll.lat; pt.lng = ll.lng;
    });
    m.on('dragstart', () => store.schnappschuss());
    m.on('dragend', ev => {
      const ll = ev.target.getLatLng();
      store.aendern(() => { pt.lat = ll.lat; pt.lng = ll.lng; }, 'strecke', { undo: false });
      this.aufAenderung();
    });
    m.bindTooltip(
      `<b>Punkt ${nr}</b> – ${art.name}${pt.name ? '<br>' + escapeHtml(pt.name) : ''}`,
      { direction: 'top', className: 'fbp-tooltip', offset: [0, -10] }
    );
  }

  _tooltipText(s) {
    const k = kennzahlen(s);
    return `<b>${escapeHtml(s.name)}</b><br>${k.kabel.kurz} · ${formatLaenge(k.trasse)} Trasse` +
           `<br>Bedarf inkl. ${k.zuschlag}%: ${formatLaenge(k.bedarf)}` +
           (k.strom && k.strom.querschnitt ? `<br>Querschnitt: ${querschnittText(k.strom.querschnitt)}` : '');
  }

  /** Auf eine Strecke zoomen */
  zeigeStrecke(sid, padding = [60, 60]) {
    const s = store.strecke(sid);
    if (!s || !s.punkte.length) return;
    if (s.punkte.length === 1) this.karte.setView([s.punkte[0].lat, s.punkte[0].lng], 16);
    else this.karte.fitBounds(L.latLngBounds(s.punkte.map(p => [p.lat, p.lng])), { padding });
  }
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
