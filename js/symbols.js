// symbols.js – Taktische Zeichen aus der Sammlung jonas-koeritz/Taktische-Zeichen
//
// Die Zeichen selbst stehen in js/zeichen-daten.js und werden von
// scripts/taktische-zeichen-holen.py aus dem Release-Archiv erzeugt. Hier steht
// nur, wie daraus ein fertiges <svg> für Karte, Seitenleiste und Druck wird.
//
// Alle Zeichen der Sammlung sind auf eine quadratische Fläche 256×256 gezeichnet.
// Das macht die Maßrechnung einfach: ein Zeichen ist immer so hoch wie breit,
// solange es nicht gedreht wird.

import { ZEICHEN, DRUCK, KATEGORIEN as KAT, SAMMLUNG } from './zeichen-daten.js';

export const SAMMLUNG_VERSION = SAMMLUNG;
export const KATEGORIEN = KAT;

/** Voreinstellung, wenn ein Plan ein Zeichen nennt, das es nicht (mehr) gibt. */
export const STANDARD_SYMBOL = 'fernmeldewesen/funkstation';

/** Flache Liste für Auswahl und Suche — ohne die SVG-Rümpfe. */
export const SYMBOLE = Object.entries(ZEICHEN).map(([id, z]) => ({ id, name: z.n, kat: z.k }));

const NACH_ID = new Map(SYMBOLE.map(s => [s.id, s]));

/** Stammdaten eines Zeichens; nie undefined, damit Aufrufer nicht prüfen müssen. */
export const symbolById = id => NACH_ID.get(id) || NACH_ID.get(STANDARD_SYMBOL);

/** Gibt es dieses Zeichen wirklich? Für Import und Migration alter Pläne. */
export const symbolBekannt = id => NACH_ID.has(id);

const SEITE = 256;
/** Kantenlänge eines ungedrehten Zeichens auf der Karte, vor Größenfaktor. */
export const GRUNDBREITE = 44;

/**
 * Wie viel größer die Fläche durch die Drehung wird.
 * Bei 45° braucht ein Quadrat die Diagonale — sonst schnitte die Drehung die
 * Ecken der Zeichnung ab. Der Faktor hält die Zeichnung selbst gleich groß und
 * lässt statt dessen den Rahmen wachsen.
 */
function drehfaktor(grad) {
  const bogen = (grad % 90) * Math.PI / 180;
  return Math.abs(Math.cos(bogen)) + Math.abs(Math.sin(bogen));
}

function winkel(o) {
  const d = Number(o.drehung) || 0;
  return ((d % 360) + 360) % 360;
}

/**
 * Vollständiges <svg> für ein taktisches Zeichen.
 * @param {object} o {symbol, breite, drehung, sw}
 */
export function symbolSVG(o = {}) {
  const sym = symbolById(o.symbol);
  const inhalt = (o.sw && DRUCK[sym.id]) || ZEICHEN[sym.id].i;

  const grad = winkel(o);
  const f = drehfaktor(grad);
  // Auf zwei Nachkommastellen: die Zahl landet im Markup jedes Markers und
  // jedes gedruckten Zeichens, volle Fließkommagenauigkeit bringt dort nichts.
  const feld = Math.round(SEITE * f * 100) / 100;
  const rand = Math.round((feld - SEITE) / 2 * 100) / 100;
  const kante = Math.round((o.breite || GRUNDBREITE) * f);

  const dreh = grad ? ` transform="rotate(${grad} ${SEITE / 2} ${SEITE / 2})"` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-rand} ${-rand} ${feld} ${feld}"
    width="${kante}" height="${kante}" class="tz" role="img"
    aria-label="${escapeAttr(sym.name)}"><g${dreh}>${inhalt}</g></svg>`;
}

/** Maße, die ein Marker mit diesem Symbol belegt (für Leaflet-Anker) */
export function symbolMasse(o = {}) {
  const kante = Math.round((o.breite || GRUNDBREITE) * drehfaktor(winkel(o)));
  return { breite: kante, hoehe: kante };
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
