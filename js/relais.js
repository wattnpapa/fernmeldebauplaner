// relais.js – Relaisstellen des BOS-Sprechfunks als Kartenmarke und Fläche

import { store, neueRelaisstelle, relaisstelleSichtbar } from './state.js';
import { symbolSVG, symbolMasse, symbolById, GRUNDBREITE } from './symbols.js';
import { escapeHtml } from './strecken.js';
import { zeichneAusbreitung } from './map.js';
import { ausbreitung, ueberdeckung, noetigeMasthoehe } from './ausbreitung.js';
import { bosBandById, gegenstellenhoehe, gegenstelleById } from './bosfunk.js';

/**
 * Welche Relaisstellen eine Ebene mit diesen Einstellungen zeichnen würde.
 * Steht wie bei den taktischen Zeichen außerhalb der Klasse, weil der Ausschnitt
 * der Lagekarte dieselbe Auswahl braucht, ohne sie zu zeichnen.
 */
export function gezeichneteRelaisstellen(p, { nurAbschnitt, abschnittSchaltet = true } = {}) {
  return (p.relaisstellen || []).filter(r => {
    if (r.sichtbar === false) return false;
    const angefordert = !abschnittSchaltet && !!nurAbschnitt && r.abschnitt === nurAbschnitt;
    if (!angefordert && !relaisstelleSichtbar(p, r)) return false;
    return !(nurAbschnitt && r.abschnitt && r.abschnitt !== nurAbschnitt);
  });
}

export const relaisTitel = r => r.name || 'Relaisstelle';

const meterKurz = m =>
  (Math.round((Number(m) || 0) * 10) / 10).toLocaleString('de-DE') + ' m';

/** Kurzfassung für Liste, Marke und Tooltip: „2 m · 10 m Mast · Handfunkgerät“ */
export function relaisKurz(r) {
  return `${bosBandById(r.band).kurz} · ${meterKurz(r.antennenhoehe)} Mast · ` +
    gegenstelleById(r.gegenstelle).kurz;
}

// ------------------------------------------------------------ Zwischenspeicher

/* Derselbe Grundsatz wie beim Geländeurteil der Richtfunkstrecke
   (funkrechnung.js): der Befund kostet einen Kachelabruf und wird deshalb auf
   Knopfdruck geholt – aber er wird NICHT gespeichert. Ein Befund, der älter ist
   als die Planung, wäre schlimmer als keiner: die Fläche sähe aus wie ein
   Ergebnis und wäre für eine Masthöhe gerechnet, die längst nicht mehr im
   Formular steht.

   Der Schlüssel trägt deshalb alles, was in die Rechnung eingeht. Verschiebt
   jemand den Standort, wechselt das Band, ändert Masthöhe, Gegenstelle oder
   Umkreis, ist der alte Befund nicht mehr gemeint und fällt von selbst heraus,
   ohne dass ihn jemand löschen müsste. */
const befunde = new Map();

export function befundSchluessel(r) {
  if (!r) return null;
  return `${r.id}|${r.lat.toFixed(5)},${r.lng.toFixed(5)}|${r.band}` +
    `|${r.antennenhoehe}|${r.gegenstelle}|${r.umkreis}`;
}

/** Befund zu dieser Relaisstelle, `undefined` solange keiner geholt wurde. */
export function befundLesen(r) {
  const k = befundSchluessel(r);
  return k ? befunde.get(k) : undefined;
}

function befundMerken(r, e) {
  const k = befundSchluessel(r);
  if (!k) return;
  /* Je Relaisstelle bleibt nur der jüngste Befund liegen; die älteren Schlüssel
     derselben Stelle werden beim Ablegen weggeräumt. Ein Rasterblock über 20 km
     sind mehrere Megabyte, und wer an der Masthöhe dreht, erzeugte sonst je
     Halbmeterschritt einen weiteren. */
  for (const alt of [...befunde.keys()]) {
    if (alt.startsWith(r.id + '|') && alt !== k) befunde.delete(alt);
  }
  befunde.set(k, e);
}

/** Frequenz und Gegenstellenhöhe, mit denen für diese Relaisstelle gerechnet wird. */
export function rechenwerte(r) {
  const band = bosBandById(r.band);
  return {
    band,
    mhz: band.mhz,
    zielhoehe: gegenstellenhoehe(r.gegenstelle, r.antennenhoehe)
  };
}

/* Was schon läuft, wird nicht zweimal angestoßen: der Abruf zieht bis zu 64
   Höhenkacheln, und genau so viele hält der Cache in hoehe.js. Ein zweiter
   Anlauf während des ersten verdrängte dem ersten die Kacheln unter den Füßen
   weg, und beide lüden neu. */
const laeuft = new Map();

/**
 * Ausbreitungsfläche einer Relaisstelle holen – aus dem Zwischenspeicher, sonst
 * gerechnet. `null`, wenn keine Höhen zu bekommen waren.
 */
export function befundHolen(r) {
  const vorhanden = befundLesen(r);
  if (vorhanden) return Promise.resolve(vorhanden);
  const k = befundSchluessel(r);
  if (laeuft.has(k)) return laeuft.get(k);
  const { mhz, zielhoehe } = rechenwerte(r);
  const lauf = ausbreitung({ lat: r.lat, lng: r.lng }, r.antennenhoehe, mhz, r.umkreis, zielhoehe)
    .then(e => { if (e) befundMerken(r, e); return e; })
    .finally(() => laeuft.delete(k));
  laeuft.set(k, lauf);
  return lauf;
}

/** Nötige Masthöhe bis zu einem Ort – ohne Zwischenspeicher: das Höhenprofil
 *  ist gegenüber dem Rasterblock billig, und die Frage wird selten zweimal
 *  für denselben Ort gestellt. */
export function masthoeheFuer(r, ziel) {
  const { mhz, zielhoehe } = rechenwerte(r);
  return noetigeMasthoehe({ lat: r.lat, lng: r.lng }, ziel, mhz, r.antennenhoehe, zielhoehe);
}

// ---------------------------------------------------------------- Kartenebene

export class RelaisLayer {
  constructor(karte, opt = {}) {
    this.karte = karte;
    this.interaktiv = opt.interaktiv !== false;
    /* Zwei Gruppen: die Marken liegen über allem, die Flächen ganz unten in der
       Ebene der Funksicht. Eine gemeinsame Gruppe ginge nicht – Leaflet ordnet
       innerhalb einer Gruppe nach Ebene, und die Fläche verdeckte ihre eigene
       Marke. */
    this.gruppe = L.layerGroup().addTo(karte);
    this.flaechen = L.layerGroup().addTo(karte);
    this.auswahl = null;
    this.setzModus = false;
    this.setzZuteilung = null;
    /* Zielwahl für die Rückwärtsrechnung: solange eine Kennung darin steht,
       setzt der nächste Kartenklick keine Relaisstelle, sondern beantwortet die
       Frage „welche Masthöhe brauche ich bis dorthin?“. */
    this.zielModus = null;
    this.aufAuswahl = opt.aufAuswahl || (() => {});
    this.aufAenderung = opt.aufAenderung || (() => {});
    this.aufZiel = opt.aufZiel || (() => {});
    this.sw = !!opt.sw;
    this.nurAbschnitt = opt.nurAbschnitt;
    this.abschnittSchaltet = opt.abschnittSchaltet !== false;
    /* Welche Flächen gerade liegen. Der Zustand gehört an die Ebene und nicht
       in die Seitenleiste: die wird bei jeder Änderung neu gebaut, die Fläche
       soll dabei liegen bleiben. */
    this.gezeigt = new Set();
    this.ueberdeckungAn = false;
    /* Woraus die liegenden Flächen zuletzt gezeichnet wurden – Grundlage des
       Vergleichs in flaechenNachfuehren. */
    this._gezeichnet = null;
    if (this.interaktiv) {
      this._klick = e => this._kartenKlick(e);
      karte.on('click', this._klick);
    }
  }

  zerstoeren() {
    if (this.interaktiv) this.karte.off('click', this._klick);
    this.flaechen.remove();
    this.gruppe.remove();
  }

  starteSetzen(zuteilung = {}) {
    this.setzModus = true;
    this.setzZuteilung = zuteilung;
    this.zielModus = null;
    L.DomUtil.addClass(this.karte.getContainer(), 'modus-relais');
  }

  beendeSetzen() {
    this.setzModus = false;
    this.setzZuteilung = null;
    L.DomUtil.removeClass(this.karte.getContainer(), 'modus-relais');
  }

  /** Nächster Klick beantwortet die Frage nach der nötigen Masthöhe bis dorthin. */
  starteZielwahl(rid) {
    this.beendeSetzen();
    this.zielModus = rid;
    L.DomUtil.addClass(this.karte.getContainer(), 'modus-relais');
  }

  beendeZielwahl() {
    this.zielModus = null;
    L.DomUtil.removeClass(this.karte.getContainer(), 'modus-relais');
  }

  _kartenKlick(e) {
    if (this.zielModus) {
      if (e.originalEvent) e.originalEvent._fbpVerbraucht = true;
      const rid = this.zielModus;
      this.beendeZielwahl();
      this.aufZiel(rid, { lat: e.latlng.lat, lng: e.latlng.lng });
      return;
    }
    if (!this.setzModus) return;
    /* Der Klick ist verbraucht: der allgemeine Klickhorcher der Karte kommt nach
       dieser Ebene an die Reihe und nähme der eben gesetzten Relaisstelle sonst
       die Auswahl gleich wieder ab. */
    if (e.originalEvent) e.originalEvent._fbpVerbraucht = true;
    const zut = this.setzZuteilung || {};
    let neu;
    store.aendern(p => {
      neu = neueRelaisstelle(p, e.latlng.lat, e.latlng.lng, zut.band);
      neu.abschnitt = zut.abschnitt || null;
      p.relaisstellen.push(neu);
    }, 'relais');
    this.beendeSetzen();
    this.auswahl = neu.id;
    this.zeichne();
    this.aufAuswahl(neu.id);
    this.aufAenderung();
  }

  waehle(rid) {
    this.auswahl = rid;
    this.zeichne();
    this.aufAuswahl(rid);
  }

  // -------------------------------------------------------------- Flächen

  /** Liegt für diese Relaisstelle gerade eine Fläche auf der Karte? */
  zeigtFlaeche(rid) { return this.gezeigt.has(rid); }

  /**
   * Fläche einer Relaisstelle zeigen oder wegnehmen.
   * @returns {Promise<object|null|undefined>} der Befund; `null`, wenn keine
   *          Höhen zu bekommen waren; `undefined` beim Wegnehmen.
   */
  async flaecheUmschalten(r) {
    if (this.gezeigt.has(r.id)) {
      this.gezeigt.delete(r.id);
      this._gezeichnet = null;
      this.flaechenZeichnen();
      return undefined;
    }
    const e = await befundHolen(r);
    if (!e) return null;
    /* Die Überdeckung und die Einzelfläche schließen einander aus: übereinander
       gelegt wäre nicht mehr zu sehen, welche Fläche welcher Relaisstelle
       gehört, und der Satz daneben könnte nur für eine von beiden gelten. */
    this.ueberdeckungAn = false;
    this.gezeigt.add(r.id);
    this._gezeichnet = null;
    this.flaechenZeichnen();
    return e;
  }

  /**
   * Überdeckung aller sichtbaren Relaisstellen: alle Flächen holen und
   * gemeinsam legen. Ist sie schon an, nimmt der zweite Aufruf sie wieder weg.
   */
  async ueberdeckungUmschalten() {
    if (this.ueberdeckungAn) {
      this.ueberdeckungAn = false;
      this._gezeichnet = null;
      this.flaechenZeichnen();
      return undefined;
    }
    const stellen = gezeichneteRelaisstellen(store.projekt, this);
    if (!stellen.length) return null;
    /* Nacheinander und nicht nebeneinander: jede Fläche zieht bis zu 64
       Höhenkacheln, und genau so viele hält der Cache. Parallel angefordert
       verdrängten sich zwei Relaisstellen gegenseitig die Kacheln, und jede
       lüde zweimal. */
    const teile = [];
    for (const r of stellen) teile.push(await befundHolen(r));
    const e = ueberdeckung(teile);
    /* 'zu_weit' ist kein Fehlschlag, sondern ein Befund: die Relaisstellen
       liegen zu weit auseinander, um einander zu überdecken. Er wird nach oben
       durchgereicht, damit die Seitenleiste ihn sagen kann, statt eine leere
       Fläche zu zeigen. */
    if (e === 'zu_weit' || !e) return e || null;
    this.ueberdeckungAn = true;
    this.gezeigt.clear();
    this._gezeichnet = null;
    this.flaechenZeichnen();
    return e;
  }

  /** Der Befund, den die Überdeckung zeigt – aus dem Zwischenspeicher. */
  ueberdeckungBefund() {
    return ueberdeckung(gezeichneteRelaisstellen(store.projekt, this).map(befundLesen));
  }

  /** Alle Flächen wegnehmen – beim Wechsel der Planung. */
  flaechenWeg() {
    this.gezeigt.clear();
    this.ueberdeckungAn = false;
    this._gezeichnet = null;
    this.flaechen.clearLayers();
  }

  /**
   * Die liegenden Flächen an den Stand der Planung angleichen.
   *
   * Das ist die Stelle, an der der Grundsatz des Zwischenspeichers wirksam
   * wird. Wer im Formular die Masthöhe ändert, ändert den Schlüssel des
   * Befundes – die Fläche auf der Karte gehört dann zu einer Höhe, die nirgends
   * mehr steht, und wäre genau der Befund, der älter ist als die Planung. Sie
   * verschwindet deshalb von selbst, statt einen Knopfdruck abzuwarten.
   *
   * Bei der Überdeckung genügt eine einzige veraltete Relaisstelle: die
   * gemeinsame Fläche ohne sie wäre nicht die Überdeckung dieser Planung,
   * sondern die einer anderen. Sie geht dann ganz weg.
   *
   * Gezeichnet wird nur, wenn sich etwas geändert hat – die Seitenleiste ruft
   * das bei jedem Tastendruck, und ein Rasterbild je Anschlag in ein PNG zu
   * gießen wäre die teuerste Art, nichts zu tun.
   */
  flaechenNachfuehren() {
    const stellen = gezeichneteRelaisstellen(store.projekt, this);
    for (const rid of [...this.gezeigt]) {
      const r = stellen.find(x => x.id === rid);
      if (!r || !befundLesen(r)) this.gezeigt.delete(rid);
    }
    if (this.ueberdeckungAn && (!stellen.length || stellen.some(r => !befundLesen(r)))) {
      this.ueberdeckungAn = false;
    }
    const signatur = this.ueberdeckungAn
      ? 'U|' + stellen.map(befundSchluessel).join(';')
      : stellen.filter(r => this.gezeigt.has(r.id)).map(befundSchluessel).join(';');
    if (signatur === this._gezeichnet) return;
    this._gezeichnet = signatur;
    this.flaechenZeichnen();
  }

  flaechenZeichnen() {
    this.flaechen.clearLayers();
    if (this.ueberdeckungAn) {
      const e = this.ueberdeckungBefund();
      if (e && e !== 'zu_weit') {
        this.flaechen.addLayer(zeichneAusbreitung(this.karte, e, { sw: this.sw }));
      }
      return;
    }
    for (const r of gezeichneteRelaisstellen(store.projekt, this)) {
      if (!this.gezeigt.has(r.id)) continue;
      const e = befundLesen(r);
      if (e) this.flaechen.addLayer(zeichneAusbreitung(this.karte, e, { sw: this.sw }));
    }
  }

  // -------------------------------------------------------------- Marken

  zeichne(optionen) {
    const p = store.projekt;
    const o = optionen || p.optionen;
    this.gruppe.clearLayers();
    const skala = o.symbolgroesse || 1;

    for (const r of gezeichneteRelaisstellen(p, this)) {
      const basis = symbolById(r.symbol);
      const breite = Math.round(GRUNDBREITE * skala);
      const opt = { symbol: r.symbol, drehung: 0, breite, sw: this.sw };
      const svg = symbolSVG(opt);
      const masse = symbolMasse(opt);
      const gewaehlt = r.id === this.auswahl;

      /* Die Beschriftung nennt den Namen und darunter Band, Masthöhe und
         Gegenstelle. Alle drei stehen auf der Karte, weil alle drei die Fläche
         bestimmen: wer zwei Relaisstellen nebeneinander sieht, muss sie
         unterscheiden können, ohne die Liste aufzuschlagen. */
      const farbe = this.sw ? '#000' : (r.farbe || '#6a1b9a');
      const html =
        `<div class="rl-wrap${gewaehlt ? ' gewaehlt' : ''}" style="--farbe:${farbe}">${svg}` +
        `<span class="rl-label"><b>${escapeHtml(relaisTitel(r))}</b>` +
        `<i>${escapeHtml(relaisKurz(r))}</i></span></div>`;

      const m = L.marker([r.lat, r.lng], {
        pane: 'fbp-zeichen',
        draggable: this.interaktiv,
        interactive: this.interaktiv,
        keyboard: false,
        icon: L.divIcon({
          className: 'fbp-relais-icon', html,
          iconSize: [masse.breite, masse.hoehe],
          iconAnchor: [masse.breite / 2, masse.hoehe / 2]
        })
      }).addTo(this.gruppe);

      if (!this.interaktiv) continue;

      m.on('click', e => { L.DomEvent.stop(e); this.waehle(r.id); });
      m.on('dragstart', () => store.schnappschuss());
      m.on('dragend', ev => {
        const ll = ev.target.getLatLng();
        store.aendern(() => {
          r.lat = ll.lat; r.lng = ll.lng;
          /* Die Geländehöhe gehört zum alten Standort und ist am neuen falsch.
             Sie stehen zu lassen wäre die schlechtere Wahl: sie sähe aus wie
             eine Messung an diesem Ort. Sie wird geleert und von der
             Seitenleiste neu geholt. */
          r.grundhoehe = null;
        }, 'relais', { undo: false });
        /* Die alte Fläche gehört ebenfalls zum alten Standort. Aus dem
           Zwischenspeicher fällt sie über den Schlüssel von selbst heraus – hier
           muss nur die Ebene weg, sonst läge sie neben der verschobenen Marke. */
        this.gezeigt.delete(r.id);
        this._gezeichnet = null;
        this.flaechenZeichnen();
        this.aufAenderung();
      });
      m.bindTooltip(
        `<b>${escapeHtml(relaisTitel(r))}</b><br>${escapeHtml(basis.name)}<br>` +
        escapeHtml(relaisKurz(r)) +
        (r.kanal ? `<br>Kanal ${escapeHtml(r.kanal)}` : '') +
        (r.bemerkung ? `<br>${escapeHtml(r.bemerkung)}` : ''),
        { direction: 'top', className: 'fbp-tooltip', offset: [0, -12] }
      );
    }
  }
}
