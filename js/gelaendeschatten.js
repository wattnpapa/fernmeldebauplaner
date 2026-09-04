// gelaendeschatten.js – Was das Gelände von einem Aufbauplatz aus verdeckt

/* Das Vorbild aus den Werkzeugen der Hersteller heißt „Viewshed“ und färbt
   ein, was von einem Standort aus SICHTBAR ist. Genau das wird hier nicht
   gemacht, und der Unterschied ist der ganze Zweck dieses Moduls.

   Die Höhen kommen aus einem Geländemodell ohne Bewuchs und ohne Bebauung
   (siehe hoehe.js). Wer damit „sichtbar“ einfärbt, malt über einer Ortslage
   eine Fläche, die zum weit überwiegenden Teil in Wirklichkeit hinter Häusern
   und Baumreihen liegt – und eine Flächenkarte prüft hinterher niemand Punkt
   für Punkt nach. Umgekehrt trägt dieselbe Rechnung: was schon das nackte
   Gelände verdeckt, bleibt verdeckt, denn Bewuchs und Bebauung können nur
   weiter verdecken, nie freigeben.

   Eingefärbt wird deshalb der Schatten, nicht die Sicht. Die Aussage lautet
   „von hier aus sicher nicht“ und nie „von hier aus geht es“. Das ist eine
   schwächere Aussage als die der Vorbilder, aber die einzige, die diese Daten
   hergeben – und sie beantwortet die Frage, die am Kartentisch gestellt wird:
   welche Aufbauplätze fallen weg.

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

/* Arbeitswerte im Rasterfeld: 0 heißt „noch kein Strahl darüber“, 2 heißt
   „geprüft und nicht verdeckt“. Nach außen gibt es nur 0 und 1 – die
   Unterscheidung dient allein der Frage, welche Zellen überhaupt beurteilt
   wurden, und damit der ehrlichen Bezugsgröße für den Flächenanteil. */
const VERDECKT = 1;
const GEPRUEFT = 2;

/**
 * Geländeschatten um einen Standort.
 *
 * @param {{lat:number,lng:number}} standort
 * @param {number} antennenhoehe  Höhe der Antennenmitte über Grund in Metern
 * @param {number} mhz            Mittenfrequenz des Bandes
 * @param {number} umkreis        Umkreis in Metern
 * @param {number} zielhoehe      angenommene Antennenhöhe am Gegenende
 * @returns {Promise<object|null>} `schatten[i] === 1` heißt: durch das Gelände
 *          verdeckt. `null`, wenn keine Höhen zu bekommen waren.
 */
export async function gelaendeschatten(standort, antennenhoehe, mhz, umkreis, zielhoehe = 3) {
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

  const schatten = new Uint8Array(spalten * zeilen);
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
      if (winkelZiel < maxima[bandVon(abstand[i])]) {
        if (schatten[idx] !== VERDECKT) { schatten[idx] = VERDECKT; verdeckt++; }
      } else if (schatten[idx] !== VERDECKT) {
        schatten[idx] = GEPRUEFT;
      }
      /* Fortgeschrieben wird mit der Freiraumforderung: ein Hindernis wirft
         seinen Schatten schon, bevor es die geometrische Sichtlinie berührt. */
      for (let j = 0; j < BAENDER; j++) {
        const a = (h + freiraum[j][i] - standorthoehe - erdstich[i]) * kehrwert[i];
        if (a > maxima[j]) maxima[j] = a;
      }
    }
  }

  let zellen = 0;
  for (let i = 0; i < schatten.length; i++) {
    if (schatten[i] === GEPRUEFT) { schatten[i] = 0; zellen++; }
    else if (schatten[i] === VERDECKT) zellen++;
  }

  return {
    schatten, spalten, zeilen,
    ecken: bild.ecken,
    fehlend: bild.fehlend,
    zellen, verdeckt, umkreis: r,
    meterJeZelle
  };
}

/* Der Satz, der neben der Fläche stehen muss. Er nennt beide Grenzen der
   Aussage: was sie kann – Plätze ausschließen – und was sie nicht kann. Er
   wird hier gebildet und nicht in der Oberfläche zusammengesetzt, damit auf
   Blatt und Bildschirm derselbe Wortlaut steht. */
export function schattenText(e) {
  if (!e) return 'Für diesen Umkreis liegen keine Geländehöhen vor.';
  const km = (e.umkreis / 1000).toLocaleString('de-DE');
  const anteil = e.zellen ? Math.round(e.verdeckt / e.zellen * 100) : 0;
  const luecke = e.fehlend
    ? ' Für einen Teil des Umkreises fehlten die Höhen; dort ist nichts eingefärbt.'
    : '';
  return `Geländeschatten im Umkreis von ${km} km: ${anteil} % der Fläche liegen schon ` +
    'hinter dem Gelände. Bewuchs und Bebauung stehen in diesen Höhen nicht – die ' +
    'Fläche schließt Aufbauplätze aus, sie gibt keinen frei.' + luecke;
}
