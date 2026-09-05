// strecken.js – Darstellung, Zeichnen und Bearbeiten der Bau-Strecken

import { distanz, kumuliert, formatLaenge, meter, punktBeiLaenge, standortText } from './geo.js';
import { store, neuerPunkt, punktartById, kabelById, streckeSichtbar } from './state.js';
import { auslegung, querschnittText } from './strom.js';
import { querungsartById, bauweiseById, querungsMinuten, reichweite, abbindeBedarf,
         kabelreserve } from './vorschrift.js';
import { symbolSVG, GRUNDBREITE } from './symbols.js';

/* Eine rechnerische Trommelstelle so dicht an einer geplanten Muffe ist
   dieselbe Verbindung und wird nicht zusätzlich aufgeführt. */
const MUFFEN_NAEHE = 30;

/* Obergrenze der Trommelstöße je Kabelabschnitt. Die Schleife endet von sich aus
   am Abschnittsende; die Schranke fängt nur den Fall einer versehentlich winzigen
   Trommellänge ab – kennzahlen() läuft in der Seitenleiste bei jedem Tastendruck. */
const MAX_STOESSE = 500;

/* Kartografische Zeichen der Kabelarten (KatS-Dv 861): das Kabel wird nicht als
   nackte Linie geführt, sondern trägt in Abständen sein Zeichen – Querstrich,
   Doppelquerstrich oder die Aderzahl im Linienzug. */
const KABELZEICHEN = {
  fk2: { striche: 1 },
  ffk: { striche: 2 },
  ak:  { text: '10″' },
  vk:  { text: '30′' },
  lwl: { text: 'LWL' },
  /* Die Datenverbindung ist keine Marke auf der Linie, sondern eine Stufe im
     Linienzug – sie bringt ihr Stück Trasse deshalb selbst mit. Der Weg liegt
     senkrecht mittig, damit das Zeichen auf der Linie sitzt. */
  lan: { stufe: 'M0,10 H12 V18 H22 V10 H34' }
};

/* Abstand der Kabelzeichen, in Bildschirmpunkten. In Metern gerechnet würden
   sie beim Herauszoomen zu einem Balken verschmelzen. Kurze Trassen bekommen
   erst ab MIND_LAENGE überhaupt ein Zeichen, sonst sitzt es auf den Punkten. */
const ZEICHEN_ABSTAND = 140;
const MIND_LAENGE = 46;

/** Das Kabelzeichen einer Kabelart – auch die Zeichenerklärung des
 *  Bauauftrags baut sich daraus ihr Musterstück. */
export function kabelzeichen(kabeltyp) {
  return KABELZEICHEN[kabelById(kabeltyp).id] || null;
}

/** Kennzahlen einer Strecke – überall gleich gerechnet */
export function kennzahlen(strecke) {
  const p = strecke.punkte;
  /* Die kumulierten Längen tragen die Trassenlänge in ihrem letzten Wert; so
     fallen die teuren Entfernungsrechnungen nur einmal an. */
  const kum = kumuliert(p);
  const kabel = kabelById(strecke.kabeltyp);
  /* Eine Funkstrecke wird nicht verlegt: ihr Bedarf ist die Luftlinie selbst,
     alles Trommel- und Bauzeitrechnen fällt weg – sonst stünden im Bauauftrag
     Trommeln für eine Strecke, auf der kein Meter Kabel liegt. */
  const funk = !!kabel.funk;
  /* Und ihre Länge ist die Luftlinie zwischen Anfang und Ende, nicht die Summe
     der Teilstrecken: die Verbindung geht durch die Luft, auch wenn die Linie
     auf der Karte über einen Knick gezeichnet wurde. Ohne diese Unterscheidung
     nennt dasselbe Blatt zwei Zahlen für dieselbe Größe – das Kennzahlenfeld
     die Summe der Abschnitte, der Einzelauftrag die Luftlinie. */
  const trasse = funk && p.length >= 2
    ? distanz(p[0], p[p.length - 1])
    : kum[kum.length - 1];
  const zuschlag = funk ? 0 : Math.max(0, Number(strecke.zuschlag) || 0);
  /* Der Bauzuschlag dehnt die Trasse, die Kabelreserve kommt als feste Länge
     obendrauf: sie ist eine Schleife an einer Stelle und wird nicht länger,
     weil das Gelände zwischen den Punkten Umwege erzwingt. Ein Zuschlag auf die
     Reserve wäre ein Zuschlag auf eine Zahl, die der Planer selbst gesetzt hat. */
  const verlegt = trasse * (1 + zuschlag / 100);
  const reserve = funk ? 0 : p.reduce((m, pt) => m + kabelreserve(pt), 0);
  const bedarf = verlegt + reserve;
  const tl = Math.max(1, Number(strecke.trommellaenge) || 500);
  const leistung = Math.max(1, Number(strecke.verlegeleistung) || 800);
  /* Ein Verteiler mitten auf der Strecke schließt das Kabel ab, dahinter
     beginnt ein neues. Der Rest der angebrochenen Trommel bleibt dabei auf der
     Trommel – abgeschnitten wird nicht (KatS-Dv 861, 6.5.1). Über die ganze
     Trasse gerechnet fehlte deshalb Kabel: zwei Abschnitte von je 450 m
     brauchen bei 500 m Trommellänge zwei Trommeln, ihre Summe von 900 m nur
     eine – und der Trupp stünde mit 450 m zu wenig am Bauplatz. */
  const ka = funk ? [] : kabelabschnitte(p, kum, zuschlag, tl);
  const trommeln = ka.reduce((n, a) => n + a.trommeln, 0);
  const querungsliste = querungen(p, kum);
  /* Die Verlegeleistung kennt nur laufende Meter. Was an einer Querung
     dazukommt – Stangen stellen für den Überbau, Graben ziehen für den
     Unterbau, Warnposten –, steht als Zeitansatz am Punkt und wird der
     Bauzeit aufgeschlagen. */
  const querungszeitStunden = funk ? 0 : querungsliste.reduce((sum, q) => sum + q.minuten, 0) / 60;
  /* Die Verlegeleistung zählt laufende Meter der Trasse. Die Reserveschleife
     wird an ihrer Stelle abgelegt und nicht verlegt – sie in die Bauzeit zu
     rechnen hieße, für 100 m Reserve eine Viertelstunde Marsch anzusetzen. */
  const verlegezeitStunden = funk ? 0 : verlegt / leistung;
  const unterbau = querungsliste.some(q => q.bauweise.id === 'unterbau');
  let lv = null;
  return {
    trasse,
    zuschlag,
    /* Getrennt ausgewiesen, weil beides verschieden zustande kommt: der
       Zuschlag ist geschätzt, die Reserve steht an ihren Punkten. */
    reserve,
    bedarf,
    trommellaenge: tl,
    trommeln,
    /* Die Abschnitte zwischen den Verteilern, jeder mit eigener Trommelzahl.
       Bei einer Strecke ohne Verteiler ist es genau einer. */
    kabelabschnitte: ka,
    /* Nur belegte Kabelarten tragen ein Trommelgewicht; sonst bleibt das Feld leer,
       damit im Bauauftrag keine erfundene Traglast steht. */
    trommelgewicht: kabel.gewicht,
    transportgewicht: kabel.gewicht ? trommeln * kabel.gewicht : null,
    punkte: p.length,
    abschnitte: Math.max(0, p.length - 1),
    verlegezeitStunden,
    querungszeitStunden,
    bauzeitStunden: verlegezeitStunden + querungszeitStunden,
    muffen: p.filter(x => x.art === 'muffe').length,
    querungen: querungsliste.length,
    querungsliste,
    /* Wechsel der Bauart am Hindernis: der Trupp braucht dafür anderes Gerät
       als für die übrige Trasse – Baustangen oder Grabwerkzeug. */
    ueberbauten: querungsliste.filter(q => q.bauweise.id === 'ueberbau').length,
    unterbauten: querungsliste.filter(q => q.bauweise.id === 'unterbau').length,
    /* Genehmigungspflichtig ist auch, was die Vorschrift nur an Bauwerken
       zulässt – der Trupp braucht dafür ebenso eine Freigabe. */
    querungenGenehmigung: querungsliste.filter(q => q.art.genehmigung || q.art.verbot).length,
    /* Jeder Trommelstoß kostet eine Suche über die ganze Trasse, gebraucht
       werden die Stellen aber nur im Bauauftrag – deshalb erst beim Zugriff
       rechnen und dann merken. */
    get laengenverbindungen() {
      if (!lv) lv = funk ? [] : laengenverbindungen(p, kum, ka, tl, zuschlag);
      return lv;
    },
    /* Aufgelegt und abgebunden wird das liegende Kabel; die Reserveschleife
       bekommt keine Auflage alle 50 m. */
    abbinden: abbindeBedarf(funk ? 0 : verlegt),
    /* Maßgebend ist die tatsächlich am Draht liegende Kabellänge, also der
       Bedarf einschließlich Bauzuschlag und Reserve – so wie es beim
       Spannungsfall der Stromleitung schon gehandhabt wird, nicht über die
       Trassenlänge. Die Reserveschleife hängt in der Leitung und trägt ihren
       Schleifenwiderstand mit, auch wenn sie aufgerollt am Punkt liegt. */
    reichweite: reichweite(strecke.kabeltyp, strecke.verlegeart, bedarf, unterbau),
    kabel,
    /* Der Querschnitt wird über die tatsächlich liegende Leitung gerechnet,
       also über den Bedarf einschließlich Bauzuschlag und Reserve – nicht über
       die Trasse. Auch die aufgerollte Reserve steht im Stromkreis. */
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
      bauweise: bauweiseById(pt.bauweise),
      minuten: querungsMinuten(pt),
      lat: pt.lat,
      lng: pt.lng,
      abAnfang: kum[i]
    });
  });
  return out;
}

/**
 * Kabelabschnitte einer Trasse: an jedem Verteiler endet das Kabel, dahinter
 * beginnt ein neues. Jeder Abschnitt bekommt seine eigene, aufgerundete
 * Trommelzahl – ganze Trommeln, weil das Kabel nicht abgeschnitten wird.
 * Ein Verteiler an Anfang oder Ende teilt nichts, dort liegt ohnehin kein
 * Kabel weiter.
 * @returns {object[]} ein Eintrag je Abschnitt, leer bei weniger als zwei Punkten
 */
function kabelabschnitte(punkte, kum, zuschlag, trommellaenge) {
  if (punkte.length < 2) return [];

  const grenzen = [0];
  for (let i = 1; i < punkte.length - 1; i++) {
    if (punkte[i].art === 'verteiler') grenzen.push(i);
  }
  grenzen.push(punkte.length - 1);

  const streckung = 1 + zuschlag / 100;
  const out = [];
  let kabelVon = 0;
  for (let g = 1; g < grenzen.length; g++) {
    const vonIdx = grenzen[g - 1], bisIdx = grenzen[g];
    const trasse = kum[bisIdx] - kum[vonIdx];
    /* Die Reserven des Abschnitts, jede an ihrer Stelle auf der Trasse. Ein
       Punkt an der Abschnittsgrenze ist ein Verteiler und bringt keine mit –
       nur Anfang und Ende der Trasse können selbst Reservepunkte sein, und die
       liegen in genau einem Abschnitt. Doppelt gezählt wird deshalb nichts. */
    const reserven = [];
    for (let i = vonIdx; i <= bisIdx; i++) {
      const m = kabelreserve(punkte[i]);
      if (m > 0) reserven.push({ abAnfang: kum[i], meter: m });
    }
    const reserve = reserven.reduce((m, r) => m + r.meter, 0);
    const verlegt = trasse * streckung;
    const bedarf = verlegt + reserve;
    out.push({
      nr: g,
      vonNr: vonIdx + 1,
      bisNr: bisIdx + 1,
      von: kum[vonIdx],
      bis: kum[bisIdx],
      /* Wo der Abschnitt auf dem durchlaufend gezählten Kabel beginnt – die
         Längenverbindungen geben ihre Lage in dieser Zählung an. Aufsummiert
         statt aus der Trassenlänge gerechnet: die Reserven der Abschnitte davor
         stehen in keiner Trassenlänge, verschieben die Zählung aber. */
      kabelVon,
      trasse,
      verlegt,
      reserve,
      reserven,
      bedarf,
      trommeln: bedarf > 0 ? Math.ceil(bedarf / trommellaenge) : 0
    });
    kabelVon += bedarf;
  }
  return out;
}

/**
 * Von einer Länge auf dem Kabel des Abschnitts zurück auf den Trassenmeter.
 *
 * Ohne Reserven ist das eine Division durch die Streckung des Bauzuschlags.
 * Jede Reserve ist dagegen ein Sprung: dort wächst das Kabel um ihre Länge,
 * ohne dass die Trasse weitergeht. Wer das übergeht, meldet den Trommelstoß um
 * die Summe der Reserven davor zu weit vorn – und der Trupp sucht die Muffe an
 * der falschen Stelle. Fällt der Stoß in die Schleife selbst, ist die Stelle
 * der Reservepunkt: dort wird die Trommel gewechselt.
 */
function trasseBeiKabel(a, kabelImAbschnitt, streckung) {
  let rest = kabelImAbschnitt;
  let pos = a.von;
  for (const r of a.reserven) {
    const bisReserve = (r.abAnfang - pos) * streckung;
    if (rest < bisReserve) break;
    rest -= bisReserve + r.meter;
    pos = r.abAnfang;
    if (rest < 0) return r.abAnfang;
  }
  return pos + rest / streckung;
}

/**
 * Stellen, an denen eine Längenverbindung entsteht: geplante Muffen und die
 * rechnerischen Trommelstöße, zusammengeführt und nach Lage durchnumeriert.
 * @returns {object[]} leer, solange die Strecke keine zwei Punkte hat
 */
function laengenverbindungen(punkte, kum, abschnitte, trommellaenge, zuschlag) {
  if (punkte.length < 2 || !abschnitte.length) return [];

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
     länger ist als die Trasse und an jeder Reserve einen Sprung macht. Nur
     zurückgerechnet (siehe trasseBeiKabel) lässt sich der Stoß als Trassenmeter
     und damit als Ort auf der Karte angeben. */
  const streckung = 1 + zuschlag / 100;
  const muffen = liste.map(v => v.abAnfang);
  /* Gezählt wird je Kabelabschnitt neu: hinter einem Verteiler liegt eine
     frische Trommel, der Stoß der vorigen wandert nicht über ihn hinweg. */
  for (const a of abschnitte) {
    const stoesse = Math.min(MAX_STOESSE, Math.ceil(a.bedarf / trommellaenge));
    for (let k = 1; k <= stoesse; k++) {
      const kabelImAbschnitt = k * trommellaenge;
      if (kabelImAbschnitt >= a.bedarf) break;
      const abAnfang = trasseBeiKabel(a, kabelImAbschnitt, streckung);
      // Dort ist die Verbindung schon geplant, sie wird nicht doppelt gezählt.
      if (muffen.some(m => Math.abs(m - abAnfang) < MUFFEN_NAEHE)) continue;
      const stelle = punktBeiLaenge(punkte, abAnfang);
      if (!stelle) continue;
      liste.push({
        nr: 0,
        quelle: 'rechnerisch',
        abAnfang,
        kabelAbAnfang: a.kabelVon + kabelImAbschnitt,
        lat: stelle.lat,
        lng: stelle.lng,
        punktNr: stelle.index + 1,
        name: '',
        lage: standortText(punkte, abAnfang, namen)
      });
    }
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
    anzahl: strecken.length, trasse: 0, reserve: 0, bedarf: 0, trommeln: 0,
    gewicht: 0, gewichtVollstaendig: true,
    bauzeitStunden: 0, muffen: 0, querungen: 0, punkte: 0,
    nachKabel: []
  };
  const je = new Map();
  for (const s of strecken) {
    const k = kennzahlen(s);
    ges.trasse += k.trasse;
    ges.reserve += k.reserve;
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

/* Was aus der Trassenlänge den Kabelbedarf macht – auf Kartenschild und
   Kurzhinweis in der Reihenfolge, in der gerechnet wird: erst der Zuschlag auf
   die Trasse, dann die Reserven obendrauf. Stünde dort weiter nur der
   Prozentsatz, zeigte der Pfeil auf eine Zahl, die sich damit nicht nachrechnen
   lässt – und die erste Frage am Bauplatz wäre, wo die Meter herkommen. */
function bedarfsHerkunft(k) {
  const teile = [];
  if (k.zuschlag) teile.push(`+${k.zuschlag}%`);
  if (k.reserve > 0) teile.push(`+${meter(k.reserve)} Res.`);
  return teile.join(' ');
}

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
    /* Die Kabelzeichen liegen in einer eigenen Gruppe: ihr Abstand wird am
       Bildschirm gemessen und muss nach jedem Zoom neu gesetzt werden, ohne
       dass dafür die ganze Karte neu entsteht. */
    this.zeichenGruppe = L.layerGroup().addTo(karte);
    this._zeichenAuftraege = [];
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
    /* Die Übersichtskarte im Eck des Streckenblatts ist keine vier Zentimeter
       breit und soll nur zeigen, wo die Trasse überhaupt liegt – ein taktisches
       Zeichen in Kartengröße stellt sie zu. */
    this.punktzeichen = opt.punktzeichen !== false;
    // Die Druckkarte wird doppelt so groß gerendert und per CSS halbiert;
    // damit die Linien im Ausdruck gleich stark wirken, werden sie mitskaliert.
    this.strichFaktor = opt.strichFaktor || 1;
    this._vorschau = null;
    this._vorschauLabel = null;
    this._zoomWaechter = () => this._kabelzeichenSetzen();
    this.karte.on('zoomend', this._zoomWaechter);
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
    this.karte.off('zoomend', this._zoomWaechter);
    this.gruppe.remove();
    this.zeichenGruppe.remove();
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

  /* Öffentlich, nicht nur Klickfolge: die Koordinatensuche fügt beim Zeichnen
     exakt durchgegebene Angaben an – der Tastaturweg zum Punktesetzen. */
  punktAnfuegen(lat, lng) {
    if (!this.zeichenModus) return false;
    const s = store.strecke(this.zeichenModus);
    if (!s) return false;
    store.aendern(() => {
      s.punkte.push(neuerPunkt(lat, lng));
      this._artenAktualisieren(s);
    }, 'strecke');
    return true;
  }

  _kartenKlick(e) {
    if (!this.zeichenModus) return;
    if (!store.strecke(this.zeichenModus)) return this.beendeZeichnen();
    this.punktAnfuegen(e.latlng.lat, e.latlng.lng);
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
    this._zeichenAuftraege = [];

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
    this._kabelzeichenSetzen();
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
    /* Die Funkstrecke ist gestrichelt, was auch die Verlegeart sagt: sie liegt
       nirgends, die Strichlücken sollen das schon auf der Karte zeigen. Das
       Muster liegt zwischen Erd- und Oberverlegung, damit alle drei
       im S/W-Druck auseinanderzuhalten bleiben. */
    const funk = !!kabelById(s.kabeltyp).funk;
    if (this.sw) {
      return {
        farbe: nebensache ? '#8a8a8a' : '#000000',
        breite: nebensache ? 2.4 : 5,
        strich: nebensache ? '5 5' : (funk ? '8 8' : (s.verlegeart === 'erd' ? '16 6' : (s.verlegeart === 'ober' ? '2 7' : null))),
        deckkraft: nebensache ? 0.85 : 1,
        fassung: nebensache ? 0 : 8.5
      };
    }
    return {
      farbe: s.farbe,
      breite: nebensache ? 2.6 : (betont && this.hervorheben ? 6 : (s.id === this.auswahl ? 6 : 4.5)),
      strich: funk ? '8 9' : (s.verlegeart === 'erd' ? '14 7' : (s.verlegeart === 'ober' ? '2 8' : null)),
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

      /* Blass gezeichnete Nebenstrecken bleiben ohne Kabelzeichen – auf ihnen
         käme es nur zur Unruhe, gefragt ist dort der Verlauf. */
      const zeichen = kabelzeichen(s.kabeltyp);
      if (zeichen && !nebensache) {
        this._zeichenAuftraege.push({ punkte: s.punkte, zeichen, farbe: st.farbe });
      }
    }

    // Teillängen
    /* Bei der Funkstrecke sagt die Teillänge nichts: die Verbindung geht durch
       die Luft von Anfang zu Ende, auch wenn die Linie auf der Karte über einen
       Knick gezeichnet wurde. Statt Abschnittsmaßen, die niemand abschreitet,
       steht dort einmal die Luftlinie – dieselbe Zahl, mit der Formular und
       Bauauftrag rechnen. */
    if (o.teillaengen && pfad.length >= 2 && !nebensache && kabelById(s.kabeltyp).funk) {
      const a = s.punkte[0], b = s.punkte[s.punkte.length - 1];
      L.marker(mitte(a, b), {
        pane: 'fbp-labels', interactive: false,
        icon: L.divIcon({
          className: 'fbp-label',
          html: `<span class="seg-mass" style="--farbe:${st.farbe}">${meter(distanz(a, b))}</span>`,
          iconSize: null
        })
      }).addTo(this.gruppe);
    } else if (o.teillaengen && pfad.length >= 2 && !nebensache) {
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
    if (!nebensache) {
      /* Die Punktmarken hängen am Haken; das taktische Zeichen des Verteilers
         nicht. Es sagt nicht, der wievielte Punkt das ist, sondern dass dort
         eine Anlage steht – und genau dafür wird die Lagekarte ohne
         Trassenpunkte gedruckt. Ohne Marke darunter rückt es auf den Punkt. */
      const marken = o.punktnummern !== false || gewaehlt;
      s.punkte.forEach((pt, i) => {
        const art = punktartById(pt.art);
        if (this.punktzeichen && art.zeichen) this._punktzeichen(pt, art, o, marken);
        if (!marken) return;
        /* Abgeschaltete Zwischenpunkte nehmen nur die reine Geometrie heraus.
           Alles, was am Bauplatz aufgesucht wird – Anfang, Ende, Muffe,
           Verteiler, Querung, Mast, Reserve –, bleibt stehen: sonst nennt die
           Punkttabelle eine Muffe, die auf der Karte nicht zu finden ist. Die
           Numerierung bleibt die des ganzen Zuges, damit beides zusammenpasst.
           Bei ausgewählter Strecke greift der Haken nicht – was man ziehen
           können soll, muss man auch sehen. */
        if (o.zwischenpunkte === false && pt.art === 'punkt' && !gewaehlt) return;
        this._zeichnePunkt(s, pt, i, gewaehlt, o, st);
      });
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
                   ${k.zuschlag || k.reserve ? `<span class="zus">${bedarfsHerkunft(k)} → ${formatLaenge(k.bedarf)}</span>` : ''}
                 </span>`,
          iconSize: null
        })
      }).addTo(this.gruppe);
    }
  }

  /**
   * Setzt die Kabelzeichen aller gezeichneten Strecken neu. Wird nach jedem
   * Zeichnen und nach jedem Zoom aufgerufen.
   */
  _kabelzeichenSetzen() {
    this.zeichenGruppe.clearLayers();
    const mpp = this._meterJePixel();
    if (!mpp) return;
    for (const auftrag of this._zeichenAuftraege) this._kabelzeichen(auftrag, mpp);
  }

  /** Meter je Bildschirmpunkt – ohne gesetzte Ansicht (Druckkarte vor
   *  fitBounds) gibt es noch keinen Maßstab, dann wartet das Zeichen aufs
   *  nächste zoomend. */
  _meterJePixel() {
    const k = this.karte;
    if (k.getZoom() === undefined) return null;
    const mitte = k.getCenter();
    const punkt = k.latLngToLayerPoint(mitte);
    return k.distance(mitte, k.layerPointToLatLng([punkt.x + 100, punkt.y])) / 100;
  }

  _kabelzeichen({ punkte, zeichen, farbe }, mpp) {
    if (punkte.length < 2) return;
    const f = this.strichFaktor;
    const kum = kumuliert(punkte);
    const laenge = kum[kum.length - 1];
    const bildlaenge = laenge / mpp;
    if (!(bildlaenge >= MIND_LAENGE * f)) return;

    const anzahl = Math.max(1, Math.round(bildlaenge / (ZEICHEN_ABSTAND * f)));
    for (let i = 0; i < anzahl; i++) {
      const pos = punktBeiLaenge(punkte, laenge * (i + 0.5) / anzahl);
      if (!pos) continue;
      const a = punkte[pos.index], b = punkte[pos.index + 1] || a;
      const pa = this.karte.latLngToLayerPoint([a.lat, a.lng]);
      const pb = this.karte.latLngToLayerPoint([b.lat, b.lng]);
      let winkel = Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180 / Math.PI;
      // Beschriftete Zeichen dürfen nicht auf dem Kopf stehen
      if (zeichen.text && (winkel > 90 || winkel < -90)) winkel += 180;

      const stil = `--farbe:${farbe};--winkel:${winkel.toFixed(1)}deg;--mass:${f}`;
      const inhalt = zeichen.text
        ? `<span class="kabel-zeichen schrift" style="${stil}">${zeichen.text}</span>`
        : zeichen.stufe
          /* Die weiße Leiste nimmt die durchlaufende Linie unter dem Zeichen
             heraus; gezeichnet wird sie hier mitsamt der Stufe neu. */
          ? `<span class="kabel-zeichen stufe" style="${stil}"><svg viewBox="0 0 34 20">` +
            `<rect x="0" y="7.5" width="34" height="5"></rect><path d="${zeichen.stufe}"></path></svg></span>`
          : `<span class="kabel-zeichen" style="${stil}">${'<i></i>'.repeat(zeichen.striche)}</span>`;
      L.marker([pos.lat, pos.lng], {
        pane: 'fbp-strecken', interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'fbp-kabelzeichen', html: inhalt, iconSize: null })
      }).addTo(this.zeichenGruppe);
    }
  }

  _zeichnePunkt(s, pt, i, gewaehlt, o, st = this._stil(s)) {
    const art = punktartById(pt.art);
    const nr = i + 1;
    const aktiv = gewaehlt && pt.id === this.aktiverPunkt;
    /* Die Raute der Querung trägt ihre Bauweise als Buchstaben: ob der Trupp
       dort Stangen stellt oder gräbt, muss auf der Karte ablesbar sein. */
    const bauweise = pt.art === 'querung' ? bauweiseById(pt.bauweise) : null;
    const klassen = ['fbp-punkt', `art-${pt.art}`, bauweise && bauweise.kurz ? `bw-${bauweise.id}` : '',
      gewaehlt ? 'gewaehlt' : '', aktiv ? 'aktiv' : ''].join(' ');
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

    /* Die Bezeichnung steht unter der Marke – über ihr sitzt das taktische
       Zeichen, und die Nummer trägt die Marke selbst. Stünde der Name nur in
       der Punkttabelle, müsste am Bauplatz nachgeschlagen werden, welcher der
       gezeichneten Punkte „Rathaus“ ist. Abschaltbar bleibt sie trotzdem: auf
       einer eng geführten Trasse liegen die Schilder ineinander und verdecken
       den Verlauf, den der Trupp auf dem Blatt sucht. */
    if (pt.name && o.punktnamen !== false) {
      L.marker([pt.lat, pt.lng], {
        pane: 'fbp-labels', interactive: false, keyboard: false,
        icon: L.divIcon({
          className: 'fbp-label',
          html: `<span class="punkt-name" style="--farbe:${st.farbe}">${escapeHtml(pt.name)}</span>`,
          iconSize: null
        })
      }).addTo(this.gruppe);
    }

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
    const zusatz = bauweise && bauweise.kurz ? ` · ${escapeHtml(bauweise.name)}` : '';
    m.bindTooltip(
      `<b>Punkt ${nr}</b> – ${art.name}${zusatz}${pt.name ? '<br>' + escapeHtml(pt.name) : ''}`,
      { direction: 'top', className: 'fbp-tooltip', offset: [0, -10] }
    );
  }

  /**
   * Taktisches Zeichen einer Punktart.
   *
   * Mit Punktmarke steht es über dem Punkt und nicht auf ihm: die Marke trägt
   * die Nummer, nach der am Bauplatz gesucht wird, und die darf das Zeichen
   * nicht zudecken. Die Zeichnung der Sammlung füllt nur das mittlere Viertel
   * ihrer Fläche – der Anker am unteren Rand setzt das Kästchen damit von selbst
   * bündig auf die Marke, ohne gerechneten Abstand. Ohne Marke gibt es nichts,
   * worauf es aufsitzen könnte; dann sitzt es mittig auf dem Punkt und ist die
   * Marke.
   *
   * Es hängt am Linienzug, nicht am Lagebild: es bleibt deshalb stehen, wenn die
   * taktischen Zeichen des Plans abgeschaltet sind, und wächst im Druck mit dem
   * Strichfaktor wie das Kabelzeichen und die Punktmarke – ein frei gesetztes
   * Zeichen wird statt dessen mit dem Blatt kleiner. Bei der halben Größe der
   * frei gesetzten Zeichen bliebe vom Kästchen auf A4 knapp drei Millimeter,
   * und die Verzweigung darin wäre auf dem Bauplatz nicht mehr zu erkennen.
   * Die Zeichengröße der Kartenoptionen gilt trotzdem: wer die Zeichen größer
   * stellt, meint auch dieses.
   *
   * Ein Schlagschatten steht bewusst nicht darauf: Firefox gibt Seitenbereiche
   * mit CSS-`filter` beim Drucken nicht aus, und das Zeichen deckt sich mit
   * seiner weißen Fläche ohnehin selbst frei.
   */
  _punktzeichen(pt, art, o, aufMarke) {
    const breite = Math.round(GRUNDBREITE * (o.symbolgroesse || 1) * this.strichFaktor);
    L.marker([pt.lat, pt.lng], {
      pane: 'fbp-zeichen', interactive: false, keyboard: false,
      icon: L.divIcon({
        className: 'fbp-punktzeichen',
        html: symbolSVG({ symbol: art.zeichen, breite, sw: this.sw }),
        iconSize: [breite, breite],
        iconAnchor: [breite / 2, aufMarke ? breite : breite / 2]
      })
    }).addTo(this.gruppe);
  }

  _tooltipText(s) {
    const k = kennzahlen(s);
    return `<b>${escapeHtml(s.name)}</b><br>${k.kabel.kurz} · ${formatLaenge(k.trasse)} Trasse` +
           `<br>Bedarf ${bedarfsHerkunft(k)}: ${formatLaenge(k.bedarf)}` +
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
