// Prüft die von scripts/taktische-zeichen-holen.py erzeugte Zeichendatei.
//
// Diese Anwendung hat keine Testsuite; dieser Lauf ist der Wächter, der im
// Workflow zwischen „neu geholt" und „nach main committet" steht. Er soll
// genau die Fälle abfangen, in denen ein neues Release der Sammlung die
// Anwendung stillschweigend verschlechtern würde.
//
//     node scripts/zeichen-pruefen.mjs

import { ZEICHEN, DRUCK, KATEGORIEN, SAMMLUNG } from '../js/zeichen-daten.js';
import { SYMBOLE, symbolSVG, symbolById, symbolBekannt, STANDARD_SYMBOL } from '../js/symbols.js';

// Untergrenze: die Sammlung wächst, sie schrumpft nicht. Fiele der Bestand
// darunter, wäre etwas beim Entpacken oder Auslesen schiefgegangen.
const MINDESTBESTAND = 800;

const fehler = [];
const pruefe = (bedingung, text) => { if (!bedingung) fehler.push(text); };

pruefe(/^v?\d/.test(SAMMLUNG), `Versionsangabe sieht falsch aus: ${SAMMLUNG}`);
pruefe(SYMBOLE.length >= MINDESTBESTAND,
  `Nur ${SYMBOLE.length} Zeichen, erwartet mindestens ${MINDESTBESTAND}`);
pruefe(KATEGORIEN.length > 0, 'Keine Kategorien');
pruefe(symbolBekannt(STANDARD_SYMBOL), `Standardzeichen ${STANDARD_SYMBOL} fehlt`);

// Jede Kategorie muss mindestens ein Zeichen tragen, sonst stünde in der
// Auswahl eine leere Überschrift.
for (const kat of KATEGORIEN) {
  pruefe(SYMBOLE.some(s => s.kat === kat.id), `Kategorie ohne Zeichen: ${kat.id}`);
}

// Jedes Zeichen einmal rendern — farbig, in Schwarz-Weiß und gedreht.
for (const s of SYMBOLE) {
  const daten = ZEICHEN[s.id];
  if (!daten?.i?.trim()) { fehler.push(`Zeichen ohne Inhalt: ${s.id}`); continue; }
  if (!s.name?.trim()) fehler.push(`Zeichen ohne Namen: ${s.id}`);
  if (!KATEGORIEN.some(k => k.id === s.kat)) fehler.push(`Unbekannte Kategorie bei ${s.id}: ${s.kat}`);
  if (symbolById(s.id).id !== s.id) fehler.push(`Nachschlagen schlägt fehl: ${s.id}`);

  for (const opt of [{}, { sw: true }, { drehung: 45 }]) {
    const svg = symbolSVG({ symbol: s.id, breite: 44, ...opt });
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
      fehler.push(`Kaputtes SVG bei ${s.id} (${JSON.stringify(opt)})`);
    }
  }
}

// Die Druckfassungen dürfen nur Zeichen benennen, die es auch gibt.
for (const id of Object.keys(DRUCK)) {
  if (!ZEICHEN[id]) fehler.push(`Druckfassung ohne Zeichen: ${id}`);
}

if (fehler.length) {
  console.error(`Prüfung fehlgeschlagen (${fehler.length}):`);
  for (const f of fehler.slice(0, 40)) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `Sammlung ${SAMMLUNG}: ${SYMBOLE.length} Zeichen in ${KATEGORIEN.length} Kategorien, ` +
  `${Object.keys(DRUCK).length} mit eigener Druckfassung — alles in Ordnung.`
);
