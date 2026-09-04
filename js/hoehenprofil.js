// hoehenprofil.js – Geländeschnitt mit Sichtlinie und Fresnelzone als SVG

/* Das Bild beantwortet die eine Frage, die man am Kartentisch sonst nicht
   beantworten kann: liegt zwischen den beiden Aufbauplätzen etwas im Weg.

   Es ist bewusst ein SVG und kein Canvas: der Bauauftrag wird gedruckt, und
   ein Canvas käme als Pixelbild auf das Blatt. Die Zeichenmittel sind auf das
   beschränkt, was im Firefox-Druck nachweislich heil herauskommt – volle
   Füllung, `fill-opacity`, `stroke-dasharray` und `<text>`. Verläufe fehlen
   hier deshalb ganz: ein `repeating-linear-gradient` hat im Bauauftrag schon
   einmal schwarze Balken erzeugt (siehe print.css), und ein Verlauf mit
   `transparent` kommt aus dem macOS-Druckweg invertiert heraus.

   Gerechnet wird in der flachen Erde: die Erdkrümmung wird auf die
   Geländehöhen aufaddiert, statt die Sichtlinie zu biegen. Dadurch bleibt die
   Sichtlinie eine Gerade, und das Blatt kommt mit einer Linie weniger aus –
   wer eine gebogene Sichtlinie sieht, sucht nach dem Grund für die Biegung. */

import { fresnelradius, senkung, FREIRAUM_ANTEIL } from './funkrechnung.js';
import { formatLaenge } from './geo.js';

/* Blattmaße statt Sachmaße im viewBox. Ein viewBox in Metern und Kilometern
   bräuchte `preserveAspectRatio="none"`, und dann stünde die Beschriftung
   verzerrt und die Strichstärken liefen auseinander. So rechnet der Erzeuger
   um, und Text und Striche bleiben, wie sie gesetzt sind. */
const BREITE = 190;
const HOEHE = 62;
const RAND = { links: 13, rechts: 3, oben: 5, unten: 9 };

/* Wie viele Stützpunkte in den Pfad gehen. 260 Punkte sind auf der Blattbreite
   keine 0,8 mm je Punkt – jenseits davon wächst nur die Dateigröße des PDF,
   nicht die Aussage. */
const PUNKTE_HOECHSTENS = 260;

const rnd = (n, s = 2) => Number(n.toFixed(s));

function ausduennen(punkte) {
  if (punkte.length <= PUNKTE_HOECHSTENS) return punkte;
  const schritt = (punkte.length - 1) / (PUNKTE_HOECHSTENS - 1);
  const aus = [];
  for (let i = 0; i < PUNKTE_HOECHSTENS; i++) aus.push(punkte[Math.round(i * schritt)]);
  return aus;
}

/* Eine runde Schrittweite für die Höhenachse. Krumme Beschriftungen („372,4 m“)
   liest am Bauplatz niemand ab; die Achse steht auf glatten Zahlen, auch wenn
   dafür oben und unten etwas Luft bleibt. */
function achsenschritt(spanne) {
  const roh = spanne / 4;
  const stufen = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  return stufen.find(s => s >= roh) || 1000;
}

/**
 * Geländeschnitt als SVG-Zeichenkette.
 *
 * @param {Array}  profil  Stützpunkte aus hoehe.js profil(): { d, h }
 * @param {number} mitteA  Antennenmitte über NN am Anfang
 * @param {number} mitteB  Antennenmitte über NN am Ende
 * @param {number} mhz     Mittenfrequenz des Bandes
 * @param {object} o       { sw, engste }
 * @returns {string} `''`, wenn zu wenige Höhen vorliegen
 */
export function profilSVG(profil, mitteA, mitteB, mhz, o = {}) {
  const alle = (profil || []).filter(p => isFinite(p.h));
  if (alle.length < 2 || !isFinite(mitteA) || !isFinite(mitteB)) return '';
  const D = profil[profil.length - 1].d;
  if (!(D > 0)) return '';
  const sw = !!o.sw;

  /* Die Kurven werden einmal gerechnet und danach nur noch abgebildet. Das
     Gelände trägt die Erdkrümmung; Sichtlinie und Fresnelgrenzen sind reine
     Funktionen der Entfernung. */
  const punkte = ausduennen(alle).map(p => {
    const sicht = mitteA + (mitteB - mitteA) * (p.d / D);
    const f1 = fresnelradius(mhz, p.d, D - p.d);
    return {
      d: p.d,
      gelaende: p.h + senkung(p.d, D - p.d),
      oben: sicht + f1,
      unten: sicht - f1,
      grenze: sicht - FREIRAUM_ANTEIL * f1
    };
  });

  const werte = punkte.flatMap(p => [p.gelaende, p.unten, p.oben]);
  const roh = { min: Math.min(...werte), max: Math.max(...werte) };
  const schritt = achsenschritt(Math.max(20, roh.max - roh.min));
  const yMin = Math.floor((roh.min - schritt * 0.2) / schritt) * schritt;
  const yMax = Math.ceil((roh.max + schritt * 0.2) / schritt) * schritt;

  const iB = BREITE - RAND.links - RAND.rechts;
  const iH = HOEHE - RAND.oben - RAND.unten;
  const X = d => RAND.links + d / D * iB;
  const Y = h => RAND.oben + (yMax - h) / (yMax - yMin) * iH;

  /* Die Überhöhung ist kein Nebenprodukt der Skalierung, sondern eine Zahl,
     die dabeistehen muss: aus einem 20-fach überhöhten Bild liest man eine
     Steilwand, wo eine Kuppe ist. */
  const ueberhoehung = (iH / (yMax - yMin)) / (iB / D);

  const linie = feld => punkte
    .map((p, i) => `${i ? 'L' : 'M'}${rnd(X(p.d))} ${rnd(Y(p[feld]))}`).join(' ');

  const flaeche = `${linie('gelaende')} L${rnd(X(D))} ${rnd(Y(yMin))} ` +
    `L${rnd(X(0))} ${rnd(Y(yMin))} Z`;

  /* Der Fresnelbauch als geschlossener Zug: obere Grenze hin, untere zurück.
     In Farbe trägt die Fläche das Bild, das man aus den Herstellerwerkzeugen
     kennt. Im Schwarz-Weiß-Druck entfällt sie: gegen die Geländefläche wäre
     eine zweite, noch blassere Fläche nicht zu unterscheiden – dort tragen
     allein die Strichmuster. */
  const bauch = punkte.map((p, i) => `${i ? 'L' : 'M'}${rnd(X(p.d))} ${rnd(Y(p.oben))}`).join(' ')
    + ' ' + [...punkte].reverse().map(p => `L${rnd(X(p.d))} ${rnd(Y(p.unten))}`).join(' ') + ' Z';

  const gitter = [];
  for (let h = yMin; h <= yMax + 0.001; h += schritt) {
    gitter.push(`<line class="hp-gitter" x1="${RAND.links}" y1="${rnd(Y(h))}" ` +
      `x2="${rnd(BREITE - RAND.rechts)}" y2="${rnd(Y(h))}"/>` +
      `<text class="hp-achse" x="${rnd(RAND.links - 1.5)}" y="${rnd(Y(h) + 1)}" ` +
      `text-anchor="end">${Math.round(h)}</text>`);
  }

  const marken = [];
  const teile = D > 4000 ? 5 : 4;
  for (let i = 0; i <= teile; i++) {
    const d = D * i / teile;
    marken.push(`<text class="hp-achse" x="${rnd(X(d))}" y="${rnd(HOEHE - RAND.unten + 4)}" ` +
      `text-anchor="middle">${formatLaenge(d, true)}</text>`);
  }

  /* Die Engstelle bekommt eine Senkrechte und ihre Entfernung als Zahl – das
     ist die Stelle, die am Bauplatz aufgesucht wird. Sie wird nur gezeichnet,
     wenn das Urteil sie auch meldet: eine Marke an der jeweils knappsten
     Stelle stünde sonst auch dann da, wenn die Strecke frei ist, und läse sich
     als Befund. */
  const e = o.engste;
  const engstelle = e && isFinite(e.d) ? `
    <line class="hp-engstelle" x1="${rnd(X(e.d))}" y1="${RAND.oben}"
          x2="${rnd(X(e.d))}" y2="${rnd(HOEHE - RAND.unten)}"/>
    <text class="hp-marke" x="${rnd(X(e.d))}" y="${rnd(RAND.oben - 1.2)}"
          text-anchor="${e.d > D * 0.7 ? 'end' : (e.d < D * 0.3 ? 'start' : 'middle')}"
          >${formatLaenge(e.d, true)}</text>` : '';

  return `<svg class="hp-svg${sw ? ' hp-sw' : ''}" viewBox="0 0 ${BREITE} ${HOEHE}"
      preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="Geländeschnitt zwischen den Aufbauplätzen">
    <g>${gitter.join('')}</g>
    ${sw ? '' : `<path class="hp-bauch" d="${bauch}"/>`}
    <path class="hp-gelaende" d="${flaeche}"/>
    <path class="hp-kante" d="${linie('gelaende')}"/>
    <path class="hp-fresnel" d="${linie('oben')}"/>
    <path class="hp-fresnel" d="${linie('unten')}"/>
    <path class="hp-grenze" d="${linie('grenze')}"/>
    <line class="hp-sicht" x1="${rnd(X(0))}" y1="${rnd(Y(mitteA))}"
          x2="${rnd(X(D))}" y2="${rnd(Y(mitteB))}"/>
    ${engstelle}
    ${marken.join('')}
    <text class="hp-achse hp-einheit" x="${rnd(RAND.links - 1.5)}" y="${rnd(RAND.oben - 1.4)}"
          text-anchor="end">m NN</text>
    <text class="hp-fuss" x="${rnd(BREITE - RAND.rechts)}" y="${rnd(HOEHE - 1)}"
          text-anchor="end">Höhen ${Math.round(ueberhoehung)}-fach überhöht · Erdkrümmung k = 4/3</text>
  </svg>`;
}

/* Die Zeichenerklärung gehört neben das Bild: vier Linienarten hält man ohne
   sie nicht auseinander. Sie benennt auch, was die Freihaltelinie bedeutet –
   „60 % der ersten Fresnelzone“ sagt am Bauplatz niemandem etwas. */
export function profilLegendeHTML(sw = false) {
  /* Die Musterproben sind kleine SVG und keine CSS-Rahmen: eine gestrichelte
     Rahmenkante von zwei Pixeln zeichnet der Browser mit so kurzen Strichen,
     dass sie neben der durchgezogenen nicht mehr zu unterscheiden ist – genau
     das, was die Erklärung leisten soll, fiel damit aus. Als SVG trägt die
     Probe dasselbe `stroke-dasharray` wie die Linie im Bild. */
  const probe = klasse =>
    `<svg class="hp-probe" viewBox="0 0 24 4" aria-hidden="true">` +
    `<line class="${klasse}" x1="0" y1="2" x2="24" y2="2"/></svg>`;
  return `<ul class="hp-legende${sw ? ' hp-sw' : ''}">
    <li>${probe('hp-sicht')}Sichtlinie zwischen den Antennenmitten</li>
    <li>${probe('hp-fresnel')}erste Fresnelzone</li>
    <li>${probe('hp-grenze')}Freihaltemaß – darunter trägt die Strecke nicht</li>
    <li>${probe('hp-kante')}Gelände einschließlich Erdkrümmung</li>
  </ul>`;
}

/* Der Satz unter dem Bild. Er sagt, worauf es beruht – und was es nicht zeigt.
   Ohne ihn liest sich ein freier Korridor als Freigabe, und genau die geben
   diese Höhen nicht her: sie kennen weder Bewuchs noch Bebauung. */
export function profilVorbehalt(punkte) {
  const ohne = (punkte || []).filter(p => !isFinite(p.h)).length;
  const luecke = ohne ? ` Für ${ohne} Stützpunkte fehlten die Höhen.` : '';
  return 'Geländehöhen aus dem Höhenmodell, rund 25 m Rasterweite. Bewuchs, Bebauung ' +
    'und Freileitungen sind darin nicht enthalten – sie liegen über dem gezeichneten ' +
    'Gelände und entscheiden bei der Erkundung.' + luecke;
}
