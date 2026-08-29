// symbols.js – Taktische Zeichen (angelehnt an DV 102 / BBK "Taktische Zeichen")
// Alles als generiertes SVG: skaliert verlustfrei und lässt sich für den
// Schwarz-Weiß-Druck auf Kontur reduzieren.

export const ORGANISATIONEN = [
  { id: 'thw',       name: 'THW',                    fill: '#003399', stroke: '#002266', glyph: '#ffffff' },
  { id: 'feuerwehr', name: 'Feuerwehr',              fill: '#e2001a', stroke: '#a30012', glyph: '#ffffff' },
  { id: 'rettung',   name: 'Rettungsdienst/Sanität', fill: '#ffffff', stroke: '#e2001a', glyph: '#e2001a' },
  { id: 'polizei',   name: 'Polizei',                fill: '#1c7a3c', stroke: '#115128', glyph: '#ffffff' },
  { id: 'fuehrung',  name: 'Führung/Stab',           fill: '#ffd400', stroke: '#7a6600', glyph: '#1a1a1a' },
  { id: 'bund',      name: 'Bundeswehr',             fill: '#4a5d23', stroke: '#2e3a16', glyph: '#ffffff' },
  { id: 'neutral',   name: 'Neutral / eigene Planung', fill: '#ffffff', stroke: '#111827', glyph: '#111827' }
];

export const STAERKEN = [
  { id: '',            name: 'ohne Stärkeangabe' },
  { id: 'trupp',       name: 'Trupp' },
  { id: 'gruppe',      name: 'Gruppe' },
  { id: 'zug',         name: 'Zug' },
  { id: 'zugtrupp',    name: 'Zugtrupp' },
  { id: 'bereitschaft',name: 'Bereitschaft' }
];

export const KATEGORIEN = [
  { id: 'fernmelde', name: 'Fernmeldetechnik' },
  { id: 'bau',       name: 'Kabelbau & Trasse' },
  { id: 'fuehrung',  name: 'Führung & Einheiten' },
  { id: 'infra',     name: 'Einrichtungen & Infrastruktur' },
  { id: 'gefahr',    name: 'Gefahren & Hinweise' }
];

const SW = { fill: '#ffffff', stroke: '#000000', glyph: '#000000' };

// ---------------------------------------------------------------- Grundformen
// Jede Grundform liefert Pfad, viewBox und den nutzbaren Glyphenbereich.

const FORMEN = {
  einheit: {
    vb: [100, 70], seitenverhaeltnis: 100 / 70, feld: { cx: 50, cy: 35, r: 26 },
    pfad: c => `<rect x="3" y="3" width="94" height="64" rx="1.5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="4.5"/>`,
    staerkeY: 3
  },
  fuehrungsstelle: {
    vb: [100, 94], seitenverhaeltnis: 100 / 94, feld: { cx: 50, cy: 35, r: 26 },
    pfad: c => `<path d="M6 92 V5" stroke="${c.stroke}" stroke-width="5" stroke-linecap="round" fill="none"/>` +
               `<rect x="3" y="3" width="94" height="64" rx="1.5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="4.5"/>`,
    staerkeY: 3
  },
  stelle: { // Kreis – Stelle / Einrichtung
    vb: [72, 72], seitenverhaeltnis: 1, feld: { cx: 36, cy: 36, r: 23 },
    pfad: c => `<circle cx="36" cy="36" r="32.5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="4.5"/>`,
    staerkeY: 0
  },
  person: { // Dreieck
    vb: [72, 72], seitenverhaeltnis: 1, feld: { cx: 36, cy: 44, r: 17 },
    pfad: c => `<path d="M36 3 L69 67 H3 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="4.5" stroke-linejoin="round"/>`,
    staerkeY: 0
  },
  massnahme: { // Raute
    vb: [72, 72], seitenverhaeltnis: 1, feld: { cx: 36, cy: 36, r: 20 },
    pfad: c => `<path d="M36 3 L69 36 L36 69 L3 36 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="4.5" stroke-linejoin="round"/>`,
    staerkeY: 0
  },
  anlage: { // Quadrat – technische Anlage
    vb: [72, 72], seitenverhaeltnis: 1, feld: { cx: 36, cy: 36, r: 23 },
    pfad: c => `<rect x="4" y="4" width="64" height="64" rx="1.5" fill="${c.fill}" stroke="${c.stroke}" stroke-width="4.5"/>`,
    staerkeY: 4
  },
  gefahr: { // Dreieck, Spitze oben, Warnkontur
    vb: [72, 66], seitenverhaeltnis: 72 / 66, feld: { cx: 36, cy: 42, r: 15 },
    pfad: c => `<path d="M36 3 L69 62 H3 Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="5" stroke-linejoin="round"/>`,
    staerkeY: 0
  }
};

// ---------------------------------------------------------------- Glyphen
// Alle Glyphen zeichnen um (cx,cy) mit Radius r, Farbe col.

const g = {
  funk: (x, y, r, col) => {   // Blitz – Sprechfunk
    const s = r / 22;
    return `<path transform="translate(${x} ${y}) scale(${s})"
      d="M4 -20 L-11 3 H-2 L-6 20 L11 -4 H1 Z" fill="${col}" stroke="none"/>`;
  },
  antenne: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${col}" stroke-width="3.4" stroke-linecap="round">
      <path d="M0 20 V-14"/><path d="M-9 20 L0 4 L9 20"/>
      <path d="M-9 -18 A13 13 0 0 1 9 -18"/><path d="M-15 -23 A21 21 0 0 1 15 -23"/>
      <circle cx="0" cy="-17" r="2.6" fill="${col}" stroke="none"/></g>`;
  },
  richtfunk: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${col}" stroke-linecap="round">
      <path d="M-16 -18 A23 23 0 0 0 -16 18" stroke-width="4.2"/>
      <path d="M-16 0 H-4" stroke-width="3.2"/>
      <circle cx="-4" cy="0" r="3.2" fill="${col}" stroke="none"/>
      <path d="M4 -7 A9 9 0 0 1 4 7" stroke-width="2.8"/>
      <path d="M10 -12 A15 15 0 0 1 10 12" stroke-width="2.8"/>
      <path d="M16 -17 A21 21 0 0 1 16 17" stroke-width="2.8"/></g>`;
  },
  fernsprecher: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-17 -13 a6 6 0 0 1 8.5 -1 l4 5 a4 4 0 0 1 -0.5 5.5 l-3 2.4 a22 22 0 0 0 9.6 9.6 l2.4 -3 a4 4 0 0 1 5.5 -0.5 l5 4 a6 6 0 0 1 -1 8.5 l-2.5 2 C4 24 -14 6 -19 -10 Z"
        fill="${col}" stroke="none" transform="translate(2 -6)"/></g>`;
  },
  vermittlung: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.2" stroke-linecap="round" fill="none">
      <circle cx="0" cy="0" r="7.5" fill="${col}" stroke="none"/>
      <path d="M0 -8 V-20 M0 8 V20 M-8 0 H-20 M8 0 H20 M-6 -6 L-15 -15 M6 6 L15 15 M6 -6 L15 -15 M-6 6 L-15 15"/>
      </g>`;
  },
  kabel: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${col}" stroke-width="3.6" stroke-linecap="round">
      <path d="M-21 6 H-13 q4 0 4 -6 q0 -8 6 -8 q6 0 6 8 q0 8 6 8 q6 0 6 -8 q0 -6 4 -6 H21"/>
      </g>`;
  },
  muffe: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.6" stroke-linecap="round" fill="none">
      <path d="M-21 0 H-9 M9 0 H21"/>
      <rect x="-9.5" y="-7" width="19" height="14" rx="7" fill="${col}" stroke="none"/></g>`;
  },
  verteiler: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.2" fill="none" stroke-linecap="round">
      <rect x="-14" y="-17" width="28" height="21" rx="2" stroke-width="3.4"/>
      <path d="M-7 -12 V-1 M0 -12 V-1 M7 -12 V-1"/>
      <path d="M-11 4 V16 M0 4 V19 M11 4 V16"/></g>`;
  },
  erdung: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.4" stroke-linecap="round" fill="none">
      <path d="M0 -20 V0 M-16 0 H16 M-10 8 H10 M-4 16 H4"/></g>`;
  },
  strom: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <circle cx="0" cy="0" r="19" fill="none" stroke="${col}" stroke-width="3.2"/>
      <path d="M3 -14 L-8 2 H-1 L-4 14 L8 -2 H1 Z" fill="${col}"/></g>`;
  },
  licht: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.2" stroke-linecap="round" fill="none">
      <circle cx="0" cy="-2" r="8" fill="${col}" stroke="none"/>
      <path d="M0 -19 V-14 M0 11 V16 M-17 -2 H-12 M12 -2 H17 M-12 -14 L-8.5 -10.5 M8.5 -10.5 L12 -14 M-12 10 L-8.5 6.5 M8.5 6.5 L12 10"/></g>`;
  },
  mast: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M-11 20 L-3 -18 M11 20 L3 -18 M0 -18 V-22"/>
      <path d="M-8.4 8 H8.4 M-6.3 -2 H6.3 M-4.5 -11 H4.5"/>
      <path d="M-11 20 H11"/></g>`;
  },
  strassenquerung: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" fill="none" stroke-linecap="round">
      <path d="M-20 -9 H20 M-20 9 H20" stroke-width="3.2"/>
      <path d="M-18 0 h7 M-8 0 h4 M4 0 h4 M11 0 h7" stroke-width="2.2"/>
      <path d="M0 -20 V20" stroke-width="4.4"/></g>`;
  },
  bahnquerung: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M-20 -6 H20 M-20 6 H20"/>
      <path d="M-14 -10 V10 M-7 -10 V10 M7 -10 V10 M14 -10 V10" stroke-width="2.4"/>
      <path d="M0 -20 V20" stroke-width="4.2"/></g>`;
  },
  gewaesserquerung: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.2" fill="none" stroke-linecap="round">
      <path d="M-20 -7 q5 -5 10 0 t10 0 t10 0"/>
      <path d="M-20 3 q5 -5 10 0 t10 0 t10 0"/>
      <path d="M-20 13 q5 -5 10 0 t10 0 t10 0"/>
      <path d="M0 -20 V20" stroke-width="4.2"/></g>`;
  },
  hochfuehrung: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.2" fill="none" stroke-linecap="round">
      <path d="M-16 18 V-12 M16 18 V-12"/>
      <path d="M-16 -10 q16 16 32 0" stroke-width="3.6"/>
      <path d="M-21 18 H-11 M11 18 H21"/></g>`;
  },
  sperre: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.2" fill="none" stroke-linecap="round">
      <path d="M-20 0 H20" stroke-width="4"/>
      <path d="M-16 -8 L-8 8 M-4 -8 L4 8 M8 -8 L16 8"/></g>`;
  },
  ausruf: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-2.6 -14 h5.2 l-1 17 h-3.2 Z" fill="${col}"/>
      <circle cx="0" cy="10" r="3" fill="${col}"/></g>`;
  },
  kreuz: (x, y, r, col) => {
    const s = r / 22;
    return `<path transform="translate(${x} ${y}) scale(${s})" d="M-5 -17 h10 v12 h12 v10 h-12 v12 h-10 v-12 h-12 v-10 h12 Z" fill="${col}"/>`;
  },
  hubschrauber: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="4" fill="none" stroke-linecap="round">
      <path d="M-11 -14 V14 M11 -14 V14 M-11 0 H11"/></g>`;
  },
  akku: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.2" fill="none">
      <rect x="-18" y="-10" width="32" height="20" rx="2"/>
      <path d="M14 -4 h4 v8 h-4" fill="${col}" stroke="none"/>
      <path d="M-11 0 h8 M-7 -4 v8" stroke-linecap="round"/></g>`;
  },
  rechner: (x, y, r, col) => {
    const s = r / 22;
    return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${col}" stroke-width="3.2" fill="none">
      <rect x="-16" y="-14" width="32" height="21" rx="2"/>
      <path d="M-20 13 H20" stroke-linecap="round"/></g>`;
  }
};

/** Buchstaben-Glyph (viele Fachzeichen sind Kürzel) */
function text(txt, x, y, r, col, faktor = 1) {
  const size = (txt.length > 2 ? r * 0.86 : r * 1.16) * faktor;
  return `<text x="${x}" y="${y}" fill="${col}" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"
    font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="central"
    letter-spacing="${r * 0.02}">${txt}</text>`;
}

// ---------------------------------------------------------------- Symbolkatalog

function s(id, name, kat, form, inhalt, extra = {}) {
  return { id, name, kat, form, inhalt, ...extra };
}

export const SYMBOLE = [
  // -- Fernmeldetechnik ------------------------------------------------------
  s('fm-vermittlung', 'Fernmeldevermittlung', 'fernmelde', 'anlage', (c, f) => g.vermittlung(f.cx, f.cy, f.r, c.glyph)),
  s('fm-fernsprecher', 'Fernsprecher / Feldfernsprecher', 'fernmelde', 'anlage', (c, f) => g.fernsprecher(f.cx, f.cy, f.r, c.glyph)),
  s('fm-funk', 'Sprechfunk / Funkstelle', 'fernmelde', 'anlage', (c, f) => g.funk(f.cx, f.cy, f.r, c.glyph)),
  s('fm-relais', 'Relaisstelle / Umsetzer', 'fernmelde', 'anlage', (c, f) =>
      g.funk(f.cx, f.cy + f.r * 0.15, f.r * 0.8, c.glyph) + text('R', f.cx + f.r * 0.72, f.cy - f.r * 0.6, f.r * 0.55, c.glyph)),
  s('fm-antenne', 'Antenne / Antennenmast', 'fernmelde', 'anlage', (c, f) => g.antenne(f.cx, f.cy, f.r, c.glyph)),
  s('fm-richtfunk', 'Richtfunkstrecke', 'fernmelde', 'anlage', (c, f) => g.richtfunk(f.cx, f.cy, f.r, c.glyph)),
  s('fm-verteiler', 'Kabelverteiler / Endverzweiger', 'fernmelde', 'anlage', (c, f) => g.verteiler(f.cx, f.cy, f.r, c.glyph)),
  s('fm-muffe', 'Muffe / Kabelverbindung', 'fernmelde', 'stelle', (c, f) => g.muffe(f.cx, f.cy, f.r, c.glyph)),
  s('fm-erdung', 'Erdungspunkt', 'fernmelde', 'stelle', (c, f) => g.erdung(f.cx, f.cy, f.r, c.glyph)),
  s('fm-netz', 'Netzwerkknoten / IT', 'fernmelde', 'anlage', (c, f) => g.rechner(f.cx, f.cy, f.r, c.glyph)),
  s('fm-messstelle', 'Messstelle / Prüfpunkt', 'fernmelde', 'stelle', (c, f) => text('M', f.cx, f.cy, f.r, c.glyph)),

  // -- Kabelbau & Trasse -----------------------------------------------------
  s('bau-kabel', 'Kabelabschnitt / Leitung', 'bau', 'anlage', (c, f) => g.kabel(f.cx, f.cy, f.r, c.glyph)),
  s('bau-trommel', 'Kabeltrommel / Materialpunkt', 'bau', 'stelle', (c, f) =>
      `<circle cx="${f.cx}" cy="${f.cy}" r="${f.r * 0.72}" fill="none" stroke="${c.glyph}" stroke-width="${f.r * 0.16}"/>` +
      `<circle cx="${f.cx}" cy="${f.cy}" r="${f.r * 0.22}" fill="${c.glyph}"/>`),
  s('bau-strasse', 'Straßenquerung', 'bau', 'massnahme', (c, f) => g.strassenquerung(f.cx, f.cy, f.r, c.glyph)),
  s('bau-bahn', 'Bahnquerung', 'bau', 'massnahme', (c, f) => g.bahnquerung(f.cx, f.cy, f.r, c.glyph)),
  s('bau-gewaesser', 'Gewässerquerung', 'bau', 'massnahme', (c, f) => g.gewaesserquerung(f.cx, f.cy, f.r, c.glyph)),
  s('bau-hochfuehrung', 'Hochführung / Überspannung', 'bau', 'massnahme', (c, f) => g.hochfuehrung(f.cx, f.cy, f.r, c.glyph)),
  s('bau-mast', 'Mast / Abspannpunkt', 'bau', 'anlage', (c, f) => g.mast(f.cx, f.cy, f.r, c.glyph)),
  s('bau-grabung', 'Erdverlegung / Grabung', 'bau', 'massnahme', (c, f) => text('EV', f.cx, f.cy, f.r, c.glyph)),

  // -- Führung & Einheiten ---------------------------------------------------
  s('f-fuehrungsstelle', 'Führungsstelle', 'fuehrung', 'fuehrungsstelle', (c, f) => text('FüSt', f.cx, f.cy, f.r, c.glyph)),
  s('f-einsatzleitung', 'Einsatzleitung', 'fuehrung', 'fuehrungsstelle', (c, f) => text('EL', f.cx, f.cy, f.r, c.glyph)),
  s('f-fk', 'Fachgruppe Führung/Kommunikation', 'fuehrung', 'einheit', (c, f) => text('FK', f.cx, f.cy, f.r, c.glyph)),
  s('f-fmtrupp', 'Fernmeldetrupp', 'fuehrung', 'einheit', (c, f) => g.funk(f.cx, f.cy, f.r * 0.95, c.glyph), { staerke: 'trupp' }),
  s('f-fmbautrupp', 'Fernmeldebautrupp', 'fuehrung', 'einheit', (c, f) =>
      g.kabel(f.cx, f.cy, f.r * 0.95, c.glyph), { staerke: 'trupp' }),
  s('f-zugtrupp', 'Zugtrupp', 'fuehrung', 'einheit', (c, f) => text('ZTr', f.cx, f.cy, f.r, c.glyph), { staerke: 'zugtrupp' }),
  s('f-ov', 'Ortsverband / Einheit', 'fuehrung', 'einheit', (c, f) => text('OV', f.cx, f.cy, f.r, c.glyph)),
  s('f-person', 'Führungskraft / Person', 'fuehrung', 'person', (c, f) => text('F', f.cx, f.cy, f.r, c.glyph)),
  s('f-fahrzeug', 'Fahrzeug', 'fuehrung', 'einheit', (c, f) =>
      `<g stroke="${c.glyph}" stroke-width="4" fill="none" stroke-linecap="round" transform="translate(${f.cx} ${f.cy})">
        <path d="M-24 6 h48"/><circle cx="-13" cy="12" r="5" fill="${c.glyph}" stroke="none"/>
        <circle cx="13" cy="12" r="5" fill="${c.glyph}" stroke="none"/>
        <path d="M-24 6 V-6 h30 l10 12"/></g>`),

  // -- Einrichtungen ---------------------------------------------------------
  s('i-strom', 'Netzersatzanlage / Stromerzeuger', 'infra', 'anlage', (c, f) => g.strom(f.cx, f.cy, f.r, c.glyph)),
  s('i-akku', 'Stromversorgung / Akku', 'infra', 'anlage', (c, f) => g.akku(f.cx, f.cy, f.r, c.glyph)),
  s('i-licht', 'Beleuchtung / Lichtmast', 'infra', 'anlage', (c, f) => g.licht(f.cx, f.cy, f.r, c.glyph)),
  s('i-bereitstellung', 'Bereitstellungsraum', 'infra', 'stelle', (c, f) => text('BR', f.cx, f.cy, f.r, c.glyph)),
  s('i-sammel', 'Sammelstelle', 'infra', 'stelle', (c, f) => text('S', f.cx, f.cy, f.r, c.glyph)),
  s('i-unterkunft', 'Unterkunft', 'infra', 'stelle', (c, f) =>
      `<path d="M${f.cx - f.r} ${f.cy + f.r * 0.2} L${f.cx} ${f.cy - f.r * 0.75} L${f.cx + f.r} ${f.cy + f.r * 0.2}"
        fill="none" stroke="${c.glyph}" stroke-width="${f.r * 0.18}" stroke-linejoin="round"/>
       <rect x="${f.cx - f.r * 0.65}" y="${f.cy + f.r * 0.1}" width="${f.r * 1.3}" height="${f.r * 0.75}"
        fill="none" stroke="${c.glyph}" stroke-width="${f.r * 0.16}"/>`),
  s('i-verpflegung', 'Verpflegungsstelle', 'infra', 'stelle', (c, f) => text('V', f.cx, f.cy, f.r, c.glyph)),
  s('i-sanitaet', 'Sanitätsstelle', 'infra', 'stelle', (c, f) => g.kreuz(f.cx, f.cy, f.r * 0.9, c.glyph)),
  s('i-hubschrauber', 'Hubschrauberlandeplatz', 'infra', 'stelle', (c, f) => g.hubschrauber(f.cx, f.cy, f.r, c.glyph)),

  // -- Gefahren --------------------------------------------------------------
  s('g-gefahr', 'Gefahrenstelle', 'gefahr', 'gefahr', (c, f) => g.ausruf(f.cx, f.cy, f.r, c.glyph),
    { orgFest: { fill: '#ffd400', stroke: '#111111', glyph: '#111111' } }),
  s('g-sperre', 'Sperre / Absperrung', 'gefahr', 'massnahme', (c, f) => g.sperre(f.cx, f.cy, f.r, c.glyph)),
  s('g-strom-gefahr', 'Elektrische Gefahr', 'gefahr', 'gefahr', (c, f) => g.funk(f.cx, f.cy, f.r * 0.95, c.glyph),
    { orgFest: { fill: '#ffd400', stroke: '#111111', glyph: '#111111' } }),
  s('g-einsturz', 'Einsturzgefahr', 'gefahr', 'gefahr', (c, f) =>
      `<path d="M${f.cx - f.r} ${f.cy + f.r * 0.5} L${f.cx} ${f.cy - f.r * 0.5} L${f.cx + f.r} ${f.cy + f.r * 0.5}"
        fill="none" stroke="${c.glyph}" stroke-width="${f.r * 0.2}" stroke-linejoin="round"
        stroke-dasharray="${f.r * 0.5} ${f.r * 0.22}"/>`,
    { orgFest: { fill: '#ffd400', stroke: '#111111', glyph: '#111111' } })
];

const NACH_ID = new Map(SYMBOLE.map(x => [x.id, x]));
export const symbolById = id => NACH_ID.get(id) || SYMBOLE[0];
export const orgById = id => ORGANISATIONEN.find(o => o.id === id) || ORGANISATIONEN[0];

// ---------------------------------------------------------------- Stärkezeichen

function staerkeSVG(art, breite, y, col) {
  if (!art) return '';
  const cx = breite / 2, oy = y - 9;
  const punkt = x => `<circle cx="${x}" cy="${oy}" r="3.6" fill="${col}"/>`;
  const strich = x => `<path d="M${x} ${oy - 7} V${oy + 7}" stroke="${col}" stroke-width="3.6" stroke-linecap="round"/>`;
  switch (art) {
    case 'trupp':        return punkt(cx);
    case 'gruppe':       return punkt(cx - 10) + punkt(cx) + punkt(cx + 10);
    case 'zug':          return strich(cx);
    case 'zugtrupp':     return strich(cx - 7) + punkt(cx + 7);
    case 'bereitschaft': return strich(cx - 7) + strich(cx + 7);
    default: return '';
  }
}

// ---------------------------------------------------------------- Rendering

/**
 * Vollständiges <svg> für ein taktisches Zeichen.
 * @param {object} o {symbol, org, staerke, sw, breite, drehung}
 */
export function symbolSVG(o = {}) {
  const sym = symbolById(o.symbol);
  const form = FORMEN[sym.form] || FORMEN.einheit;
  const [vw, vh] = form.vb;

  let c = sym.orgFest ? { ...sym.orgFest } : { ...orgById(o.org) };
  if (o.sw) {
    // Schwarz-Weiß: auf Kontur reduzieren, helle Füllung behalten
    c = { ...SW };
  }

  const breite = o.breite || (sym.form === 'einheit' || sym.form === 'fuehrungsstelle' ? 52 : 40);
  const hoehe = Math.round(breite * vh / vw);
  const staerke = o.staerke !== undefined ? o.staerke : (sym.staerke || '');
  const st = staerke ? staerkeSVG(staerke, vw, form.staerkeY, c.stroke) : '';
  const rand = staerke ? 14 : 0;

  const inner = sym.inhalt(c, form.feld);
  const dreh = o.drehung ? ` transform="rotate(${o.drehung} ${vw / 2} ${vh / 2})"` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-rand} ${vw} ${vh + rand}"
    width="${breite}" height="${hoehe + Math.round(rand * breite / vw)}"
    class="tz" role="img" aria-label="${escapeAttr(sym.name)}"><g${dreh}>${form.pfad(c)}${inner}</g>${st}</svg>`;
}

/** Maße, die ein Marker mit diesem Symbol belegt (für Leaflet-Anker) */
export function symbolMasse(o = {}) {
  const sym = symbolById(o.symbol);
  const form = FORMEN[sym.form] || FORMEN.einheit;
  const [vw, vh] = form.vb;
  const breite = o.breite || (sym.form === 'einheit' || sym.form === 'fuehrungsstelle' ? 52 : 40);
  const staerke = o.staerke !== undefined ? o.staerke : (sym.staerke || '');
  const rand = staerke ? Math.round(14 * breite / vw) : 0;
  return { breite, hoehe: Math.round(breite * vh / vw) + rand };
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
