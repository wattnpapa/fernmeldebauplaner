// funksicht.js – Wohin vom Aufbauplatz aus freie Funksicht über das Gelände besteht

/* Eingefärbt wird die Fläche mit freier Funksicht – das ist die Frage, die man
   auf einer Karte stellt: wohin komme ich von hier. Die Rechnung selbst ist
   trotzdem eine Schattenrechnung, und das bleibt der Grund, warum die Fläche
   vorsichtig zu lesen ist.

   Die Höhen kommen aus einem Geländemodell ohne Bewuchs und ohne Bebauung
   (siehe hoehe.js). Belastbar ist deshalb nur die eine Richtung: was schon das
   nackte Gelände verdeckt, bleibt verdeckt, denn Bewuchs und Bebauung können
   nur weiter verdecken, nie freigeben. Die gefärbte Fläche ist damit die
   GÜNSTIGSTE ANNAHME und kein Empfangsnachweis – über einer Ortslage liegt ein
   großer Teil von ihr in Wirklichkeit hinter Häusern und Baumreihen. Das muss
   der Satz neben der Fläche sagen, und er sagt es (siehe sichtText).

   Ein Vorteil dieser Richtung wiegt den Nachteil teilweise auf: Zellen ohne
   Höhendaten bleiben ungefärbt. Beim umgekehrten Anstrich fielen sie mit der
   freien Fläche zusammen und läsen sich als Sicht; so fallen sie mit der
   verdeckten zusammen und liegen damit auf der vorsichtigen Seite.

   Gerechnet wird mit Funksicht, nicht mit Augensicht: Erdkrümmung und die
   Freiraumforderung der ersten Fresnelzone gehen mit ein, sonst stünde die
   Fläche für eine Sichtverbindung, die kein Funk trägt. */

import { raster } from './hoehe.js';
import { senkung, fresnelradius, FREIRAUM_ANTEIL } from './funkrechnung.js';

/* Umkreis und Höchstmaß. Der Vorgabewert ist bewusst klein: bei 3 m
   Antennenhöhe – der Vorgabe einer neuen Funkstrecke – liegt der Funkhorizont
   zweier Standorte bei gut 14 km, aber schon jenseits von 5 km verspricht ein
   25-m-Raster ohne Bewuchs mehr, als es halten kann. Über 10 km wird deshalb
   nicht gerechnet; dort kostet allein der Kachelabruf mehr, als die Aussage
   wert ist. */
export const UMKREIS_STANDARD = 3000;
export const UMKREIS_HOECHSTENS = 10000;

/* Strahlen je Randzelle. Mit einem Strahl je Randzelle bleiben in
   Standortnähe einige Prozent der Zellen unbesucht, weil benachbarte Strahlen
   dort dieselbe Zelle treffen und die Nachbarzelle überspringen – das ergibt
   ein Sprenkelmuster, das wie ein Befund aussieht und keiner ist. Mit
   doppelter Dichte verschwindet es. */
const STRAHLDICHTE = 2;

/* Zielentfernungsbänder für die Fresnelforderung. Der Fresnelradius hängt
   nicht nur davon ab, wie weit das Hindernis entfernt ist, sondern auch davon,
   wie weit das Ziel dahinter noch liegt – ein Laufmaximum kennt sein Ziel aber
   noch nicht. Statt je Zelle den ganzen Strahl neu zu prüfen, laufen mehrere
   Maxima nebeneinander, eines je Zielband. Mit einem einzigen Maximum würde
   für nahe Ziele ein Vielfaches an Freiraum gefordert und die Schattenfläche
   größer, als sie ist. */
const BAENDER = 8;

/* Arbeitswerte im Rasterfeld. 0 heißt „noch kein Strahl darüber“ – das trifft
   Zellen jenseits des Umkreises und solche ohne Höhendaten. Nach außen bleibt
   nur die Sicht stehen; die Unterscheidung dient der Frage, welche Zellen
   überhaupt beurteilt wurden, und damit der ehrlichen Bezugsgröße für den
   Flächenanteil. */
const VERDECKT = 1;
const SICHT = 2;

/**
 * Fläche mit freier Funksicht um einen Standort.
 *
 * @param {{lat:number,lng:number}} standort
 * @param {number} antennenhoehe  Höhe der Antennenmitte über Grund in Metern
 * @param {number} mhz            Mittenfrequenz des Bandes
 * @param {number} umkreis        Umkreis in Metern
 * @param {number} zielhoehe      angenommene Antennenhöhe am Gegenende
 * @returns {Promise<object|null>} `sicht[i] === 1` heißt: freie Funksicht über
 *          das Gelände. `null`, wenn keine Höhen zu bekommen waren.
 */
export async function funksicht(standort, antennenhoehe, mhz, umkreis, zielhoehe = 3) {
  const r = Math.min(Math.max(200, umkreis || UMKREIS_STANDARD), UMKREIS_HOECHSTENS);
  const bild = await raster(standort, r);
  if (!bild || bild.fehlend === bild.werte.length) return null;

  const { werte, spalten, zeilen, mitteX, mitteY, meterJeZelle } = bild;
  const rZellen = mitteX;
  const h0 = werte[mitteY * spalten + mitteX];
  if (!isFinite(h0)) return null;
  const standorthoehe = h0 + (Number(antennenhoehe) || 0);

  /* Alles, was nur vom Schrittindex abhängt, wird einmal vorgerechnet: die
     Absenkung durch die Erdkrümmung, die Freiraumforderung je Zielband und der
     Kehrwert der Entfernung. In der inneren Schleife bleiben dadurch ein
     Tabellenzugriff und eine Addition – Erdkrümmung und Fresnelzone kosten so
     kaum mehr als die reine Sichtprüfung. */
  const abstand = new Float32Array(rZellen + 1);
  const kehrwert = new Float32Array(rZellen + 1);
  const erdstich = new Float32Array(rZellen + 1);
  for (let i = 1; i <= rZellen; i++) {
    abstand[i] = i * meterJeZelle;
    kehrwert[i] = 1 / abstand[i];
    /* Die Absenkung gilt gegen den Rest bis zum Ziel: der Strahl wird vom
       Standort aus beurteilt, nicht von der Mitte der Strecke. */
    erdstich[i] = senkung(abstand[i], Math.max(1, r - abstand[i]));
  }
  const freiraum = [];
  const bandZiel = new Float32Array(BAENDER);
  for (let b = 0; b < BAENDER; b++) {
    bandZiel[b] = r * (b + 1) / BAENDER;
    const f = new Float32Array(rZellen + 1);
    for (let i = 1; i <= rZellen; i++) {
      const d2 = bandZiel[b] - abstand[i];
      f[i] = d2 > 0 ? FREIRAUM_ANTEIL * fresnelradius(mhz, abstand[i], d2) : 0;
    }
    freiraum.push(f);
  }
  const bandVon = d => Math.min(BAENDER - 1, Math.floor(d / r * BAENDER));

  const feld = new Uint8Array(spalten * zeilen);
  const maxima = new Float32Array(BAENDER);
  const strahlen = Math.max(8, Math.round(2 * Math.PI * rZellen * STRAHLDICHTE));
  let verdeckt = 0;

  for (let k = 0; k < strahlen; k++) {
    const w = 2 * Math.PI * k / strahlen;
    const dx = Math.cos(w), dy = Math.sin(w);
    maxima.fill(-Infinity);
    let x = mitteX + 0.5, y = mitteY + 0.5;

    for (let i = 1; i <= rZellen; i++) {
      x += dx; y += dy;
      const sx = x | 0, sy = y | 0;
      if (sx < 0 || sy < 0 || sx >= spalten || sy >= zeilen) break;
      const h = werte[sy * spalten + sx];
      /* Eine Lücke im Höhenmodell darf keinen Schatten werfen und auch keinen
         aufheben: der Strahl läuft weiter, das Laufmaximum bleibt stehen. */
      if (!isFinite(h)) continue;

      const idx = sy * spalten + sx;
      /* Der Gegenstandort steht auf einem Mast, nicht auf dem Boden – geprüft
         wird die Antennenmitte, nicht die Geländeoberfläche. */
      const winkelZiel = (h + zielhoehe - standorthoehe - erdstich[i]) * kehrwert[i];
      /* Eine Zelle, die schon einmal verdeckt war, bleibt es: zwei Strahlen
         streifen dieselbe Zelle aus leicht verschiedenen Richtungen, und die
         ungünstigere Aussage ist die belastbare. */
      if (winkelZiel < maxima[bandVon(abstand[i])]) {
        if (feld[idx] !== VERDECKT) { feld[idx] = VERDECKT; verdeckt++; }
      } else if (feld[idx] !== VERDECKT) {
        feld[idx] = SICHT;
      }
      /* Fortgeschrieben wird mit der Freiraumforderung: ein Hindernis wirft
         seinen Schatten schon, bevor es die geometrische Sichtlinie berührt. */
      for (let j = 0; j < BAENDER; j++) {
        const a = (h + freiraum[j][i] - standorthoehe - erdstich[i]) * kehrwert[i];
        if (a > maxima[j]) maxima[j] = a;
      }
    }
  }

  /* Nach außen bleibt genau ein Bit stehen: 1 für freie Funksicht. Verdeckte
     Zellen und solche ohne Höhen fallen beide auf 0 – das ist die vorsichtige
     Seite und der Grund, warum die Karte diese Richtung einfärbt. */
  const sicht = new Uint8Array(feld.length);
  let zellen = 0, mitSicht = 0;
  for (let i = 0; i < feld.length; i++) {
    if (feld[i] === SICHT) { sicht[i] = 1; zellen++; mitSicht++; }
    else if (feld[i] === VERDECKT) zellen++;
  }

  return {
    sicht, spalten, zeilen,
    ecken: bild.ecken,
    fehlend: bild.fehlend,
    zellen, mitSicht, verdeckt, umkreis: r,
    meterJeZelle
  };
}

/* Der Satz, der neben der Fläche stehen muss. Die eingefärbte Fläche sieht aus
   wie eine Zusage, und genau das ist sie nicht: gerechnet ist sie über nacktem
   Gelände. „Günstigste Annahme“ steht deshalb im Satz und nicht in einer
   Fußnote – eine Fußnote liest am Kartentisch niemand. Er wird hier gebildet
   und nicht in der Oberfläche zusammengesetzt, damit auf Blatt und Bildschirm
   derselbe Wortlaut steht. */
export function sichtText(e) {
  if (!e) return 'Für diesen Umkreis liegen keine Geländehöhen vor.';
  const km = (e.umkreis / 1000).toLocaleString('de-DE');
  const anteil = e.zellen ? Math.round(e.mitSicht / e.zellen * 100) : 0;
  const luecke = e.fehlend
    ? ' Wo Höhen fehlten, bleibt die Fläche ebenfalls ungefärbt.'
    : '';
  return `Funksicht im Umkreis von ${km} km: ${anteil} % der Fläche haben über das ` +
    'Gelände freie Sicht zum Aufbauplatz. Bewuchs, Bebauung und Freileitungen stehen ' +
    'in diesen Höhen nicht – die eingefärbte Fläche ist die günstigste Annahme, kein ' +
    'Empfangsnachweis.' + luecke;
}
