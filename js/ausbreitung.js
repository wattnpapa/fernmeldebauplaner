// ausbreitung.js – Wohin eine Relaisstelle über das Gelände trägt, und wo nicht

/* Der Unterschied zu js/funksicht.js ist nicht die Frequenz, sondern die Frage.
   Beim Richtfunk auf 5,5 GHz will man wissen, ob die erste Fresnelzone frei
   bleibt – darunter fällt der Pegel, und die Strecke steht oder steht nicht.
   Im 2-m- und 4-m-Band ist dieselbe Forderung sinnlos: bei 80,7 MHz ist die
   erste Fresnelzone in der Mitte einer 5-km-Strecke rund 68 m dick, 60 % davon
   sind gut 40 m Freiraum. Über deutschem Mittelgebirge wäre danach fast alles
   „verdeckt“, während der 4-m-Kanal in Wirklichkeit weit in den Schatten hinein
   trägt. Eine Karte, die durchweg zu schwarz ist, wird nicht gelesen, und das
   ist schlimmer als gar keine.

   Was die lange Welle wirklich tut, ist beugen. Wie stark, hängt allein an der
   Geometrie: der Fresnel-Kirchhoff-Parameter ν setzt die Höhe der verdeckenden
   Kante über der Sichtlinie ins Verhältnis zur Wellenlänge und zu den beiden
   Abständen. Aus ν folgt die Beugungsdämpfung in Dezibel (ITU-R P.526, eine
   Kante). Das bleibt dieselbe Art Aussage, die funkrechnung.js zulässt – reine
   Geometrie, keine Sendeleistung, keine Empfängerschwelle, keine erfundene
   Empfangsfeldstärke. Ein Dezibel Beugungsdämpfung ist eine Folge der Form des
   Geländes und keine Behauptung über ein Gerät.

   Daraus werden drei Zonen statt zweier Farben:

     frei         bis  6 dB – die Sichtlinie streift die Kante oder läuft darüber
     Randbereich  bis 15 dB – die Kante steht im Weg, die Beugung trägt noch
     Schatten     darüber   – hier ist der Standort das Mittel, nicht der Mast

   Die Schwellen sind in Dezibel gesetzt und nicht in ν, weil Dezibel die Größe
   ist, über die zu reden ist: 15 dB sind der Bereich, in dem ein analoger Kanal
   rauscht und trägt und ein TETRA-DMO-Kanal schon abbricht. Dieser Unterschied
   steht deshalb im Begleitsatz und nicht in der Farbe – die Geometrie ist für
   beide dieselbe, die Folgerung daraus nicht.

   Was auch hier gilt und was auch hier dabeistehen muss: die Höhen kommen aus
   einem Geländemodell ohne Bewuchs und ohne Bebauung. Wald, Ortslage und
   Freileitungen dämpfen zusätzlich und stehen in keiner dieser Zahlen. Die
   Fläche ist die günstigste Annahme und kein Empfangsnachweis. */

import { raster, profil, eckenFuer } from './hoehe.js';
import { ERDRADIUS_WIRKSAM, LUECKEN_GRENZE } from './funkrechnung.js';
import { wellenlaenge } from './bosfunk.js';
import { formatLaenge } from './geo.js';

// ---------------------------------------------------------------- Zonen

/* Die Reihenfolge ist Absicht: je höher der Wert, desto besser die Zone. So ist
   die Überdeckung mehrerer Relaisstellen schlicht das Maximum je Zelle – von
   zwei Relaisstellen zählt für einen Ort die bessere und nicht die zuletzt
   gerechnete. Die Null liegt unten und heißt „nicht beurteilt“: sie trifft
   Zellen jenseits des Umkreises und solche ohne Höhendaten und fällt damit auf
   die vorsichtige Seite. */
export const NICHT_BEURTEILT = 0;
export const SCHATTEN = 1;
export const RANDBEREICH = 2;
export const FREI = 3;

/** Beugungsdämpfung, bis zu der eine Zelle als frei gilt */
export const FREI_BIS_DB = 6;
/** … und bis zu der sie noch als Randbereich gilt */
export const RAND_BIS_DB = 15;

/* Die Schwelle in ν, aus J(ν) zurückgerechnet. Sie steht hier als Zahl, weil
   die Zellenschleife sonst je Zelle einen Logarithmus zöge: die Zone folgt aus
   einem Vergleich und nicht aus dem Dezibelwert selbst.

     J(ν) = 6,9 + 20·log10( √((ν−0,1)² + 1) + ν − 0,1 )   für ν > −0,78

   J(0) = 6,03 dB – dort streift die Sichtlinie die Kante gerade. Die erste
   Schwelle ist deshalb schlicht ν ≤ 0 und braucht keine Wurzel: sie ist
   dasselbe wie „die Kante steht nicht über der Sichtlinie“. */
const NU_RAND = 1.1738;   // J(1,1738) = 15,0 dB

/** Beugungsdämpfung einer Kante in dB nach ITU-R P.526 – für die Ausgabe. */
export function beugungsdaempfung(nu) {
  const v = Number(nu);
  if (!isFinite(v) || v <= -0.78) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) * (v - 0.1) + 1) + v - 0.1);
}

// ---------------------------------------------------------------- Umkreis

/* Vorgabe und Höchstmaß. Anders als beim Richtfunk sind hier große Umkreise die
   Regel: ein 4-m-Relais auf einer Kuppe trägt über 20 km, und eine Fläche, die
   bei 3 km aufhört, beantwortet die Frage nicht. Bezahlt wird das in Kacheln –
   bei 20 km sind es 64 Höhenkacheln, genau so viele, wie der Cache in hoehe.js
   hält. Darüber verdrängte sich der Block beim Rechnen selbst, deshalb ist dort
   Schluss. */
export const UMKREIS_STANDARD = 10000;
export const UMKREIS_HOECHSTENS = 20000;
export const UMKREIS_MINDESTENS = 1000;

/** Umkreis auf das zulässige Fenster bringen */
export const gueltigerUmkreis = m =>
  Math.min(Math.max(UMKREIS_MINDESTENS, Math.round(Number(m) || UMKREIS_STANDARD)),
    UMKREIS_HOECHSTENS);

/* Höchstmaß des gemeinsamen Feldes der Überdeckung in Zellen. Bei 25 m
   Zellenmaß ist das eine Kantenlänge von rund 87 km – drei Relaisstellen über
   einen Einsatzraum von 40 km verteilt bleiben darunter, zwei Stellen in
   verschiedenen Landesteilen nicht.

   Maßgebend ist nicht das Zonenfeld selbst – ein Byte je Zelle –, sondern das
   Bild, das daraus wird: die ImageData der Kartenüberlagerung braucht vier Byte
   je Zelle und muss anschließend noch in ein PNG gegossen werden. Die Schranke
   steht deshalb dort, wo dieses Bild rund 48 MB groß wird, und nicht dort, wo
   das Feld es täte. */
const UEBERDECKUNG_HOECHSTENS = 12e6;

/* Strahlen je Randzelle – derselbe Grund wie in funksicht.js: mit einem Strahl
   je Randzelle bleiben in Standortnähe Zellen unbesucht, und es entsteht ein
   Sprenkelmuster, das wie ein Befund aussieht und keiner ist. */
const STRAHLDICHTE = 2;

// ---------------------------------------------------------------- Rechnung

/**
 * Ausbreitung einer Relaisstelle über das Gelände.
 *
 * @param {{lat:number,lng:number}} standort
 * @param {number} antennenhoehe  Antennenmitte über Grund in Metern
 * @param {number} mhz            Rechenfrequenz des Bandes
 * @param {number} umkreis        Umkreis in Metern
 * @param {number} zielhoehe      Antennenhöhe der Gegenstelle über Grund
 * @returns {Promise<object|null>} `zonen[i]` ist FREI, RANDBEREICH, SCHATTEN
 *          oder NICHT_BEURTEILT. `null`, wenn keine Höhen zu bekommen waren.
 */
export async function ausbreitung(standort, antennenhoehe, mhz, umkreis, zielhoehe = 1.5) {
  const r = gueltigerUmkreis(umkreis);
  const bild = await raster(standort, r);
  if (!bild || bild.fehlend === bild.werte.length) return null;

  const { werte, spalten, zeilen, mitteX, mitteY, meterJeZelle } = bild;
  const rZellen = mitteX;
  const grund = werte[mitteY * spalten + mitteX];
  if (!isFinite(grund)) return null;

  const lambda = wellenlaenge(mhz);
  const hAntenne = Number(antennenhoehe) || 0;
  const hZiel = Number(zielhoehe) || 0;

  /* Gerechnet wird in der Tangentialebene am Standort: die Erdoberfläche fällt
     in der Entfernung d um d²/(2R) unter diese Ebene weg, und wenn dieser
     Betrag von jeder Geländehöhe abgezogen wird, sind alle Sichtlinien wieder
     Geraden. Der Vorteil gegenüber dem Erdstich der Streckenrechnung
     (`senkung(d1,d2)` in funkrechnung.js) ist für diese Schleife entscheidend:
     der Abzug hängt nur an der Entfernung und nicht am Ziel, das der Strahl
     erst noch finden muss. Damit trägt ein einziges Laufmaximum über den ganzen
     Strahl, und die acht Zielentfernungsbänder, die funksicht.js für die
     Fresnelforderung braucht, entfallen ersatzlos. */
  const abstand = new Float32Array(rZellen + 1);
  const kehrwert = new Float32Array(rZellen + 1);
  const senkung = new Float32Array(rZellen + 1);
  for (let i = 1; i <= rZellen; i++) {
    abstand[i] = i * meterJeZelle;
    kehrwert[i] = 1 / abstand[i];
    senkung[i] = abstand[i] * abstand[i] / (2 * ERDRADIUS_WIRKSAM);
  }
  const zAntenne = grund + hAntenne;

  const feld = new Uint8Array(spalten * zeilen);
  const strahlen = Math.max(8, Math.round(2 * Math.PI * rZellen * STRAHLDICHTE));

  for (let k = 0; k < strahlen; k++) {
    const w = 2 * Math.PI * k / strahlen;
    const dx = Math.cos(w), dy = Math.sin(w);
    /* Das Laufmaximum ist der Winkel der bisher höchsten Kante über dem Strahl
       und die Entfernung, in der sie steht. Beides zusammen ist die maßgebende
       Kante der Beugungsrechnung – ohne ihre Entfernung wäre ν nicht zu
       bilden, und genau deshalb genügt hier kein einzelner Winkel wie bei der
       reinen Sichtprüfung. */
    let maxWinkel = -Infinity, maxAbstand = 0;
    let x = mitteX + 0.5, y = mitteY + 0.5;

    for (let i = 1; i <= rZellen; i++) {
      x += dx; y += dy;
      const sx = x | 0, sy = y | 0;
      if (sx < 0 || sy < 0 || sx >= spalten || sy >= zeilen) break;
      const idx = sy * spalten + sx;
      const h = werte[idx];
      /* Eine Lücke im Höhenmodell darf keinen Schatten werfen und auch keinen
         aufheben: der Strahl läuft weiter, das Laufmaximum bleibt stehen. */
      if (!isFinite(h)) continue;

      const z = h - senkung[i];
      const winkelZiel = (z + hZiel - zAntenne) * kehrwert[i];

      /* Die Kante steht so weit über der Sichtlinie zum Ziel, wie die beiden
         Winkel auf ihre Entfernung auseinanderlaufen. Ist der Wert negativ,
         läuft die Sichtlinie über die Kante hinweg – dann ist ν negativ, die
         Beugungsdämpfung unter 6 dB und die Zelle frei. Für diesen häufigsten
         Fall wird deshalb keine Wurzel gezogen. */
      let zone = FREI;
      if (maxAbstand > 0) {
        const hoch = (maxWinkel - winkelZiel) * maxAbstand;
        if (hoch > 0) {
          const d2 = abstand[i] - maxAbstand;
          const nu = hoch * Math.sqrt(2 * abstand[i] / (lambda * maxAbstand * d2));
          zone = nu <= NU_RAND ? RANDBEREICH : SCHATTEN;
        }
      }
      /* Zwei Strahlen streifen dieselbe Zelle aus leicht verschiedenen
         Richtungen. Stehen bleibt die ungünstigere Aussage – sie ist die
         belastbare. */
      if (feld[idx] === NICHT_BEURTEILT || zone < feld[idx]) feld[idx] = zone;

      /* Fortgeschrieben wird mit dem Gelände selbst, ohne die Höhe der
         Gegenstelle: die Kante wirft ihren Schatten aus ihrer eigenen Höhe und
         nicht aus der einer Antenne, die dahinter erst noch kommt. */
      const winkelKante = (z - zAntenne) * kehrwert[i];
      if (winkelKante > maxWinkel) { maxWinkel = winkelKante; maxAbstand = abstand[i]; }
    }
  }

  return {
    ...zaehlen(feld, bild),
    umkreis: r, meterJeZelle, mhz,
    standorthoehe: grund, antennenhoehe: hAntenne, zielhoehe: hZiel
  };
}

/* Zählwerk und Rahmen eines Zonenfeldes – dieselbe Form für die einzelne
   Relaisstelle und für die Überdeckung mehrerer, damit Karte, Seitenleiste und
   Blatt nicht zwei Ausgaben brauchen. */
function zaehlen(zonen, rahmen) {
  let frei = 0, rand = 0, schatten = 0;
  for (let i = 0; i < zonen.length; i++) {
    if (zonen[i] === FREI) frei++;
    else if (zonen[i] === RANDBEREICH) rand++;
    else if (zonen[i] === SCHATTEN) schatten++;
  }
  const kante = rahmen.meterJeZelle || 0;
  return {
    zonen,
    spalten: rahmen.spalten, zeilen: rahmen.zeilen,
    x0: rahmen.x0, y0: rahmen.y0,
    ecken: rahmen.ecken,
    fehlend: rahmen.fehlend || 0,
    zellen: frei + rand + schatten,
    frei, rand, schatten,
    /* Fläche in Quadratkilometern: die Zellenzahl ist eine Rechengröße, aber
       „18 km² frei“ ist die Größe, in der ein Einsatzabschnitt gemessen wird. */
    flaecheFrei: frei * kante * kante / 1e6,
    flaecheRand: rand * kante * kante / 1e6
  };
}

// ------------------------------------------------------------ Überdeckung

/**
 * Mehrere Ausbreitungsflächen zu einer zusammenlegen.
 *
 * Die Rasterblöcke aller Relaisstellen liegen auf demselben Weltpixelgitter –
 * hoehe.js rechnet auf einer festen Zoomstufe –, deshalb genügt ein
 * ganzzahliger Versatz je Block; es wird nichts umgerechnet und nichts
 * interpoliert. Je Zelle zählt die beste Zone: wo eine Relaisstelle frei hat,
 * hilft es nicht, dass eine zweite dort im Schatten liegt.
 *
 * @param {Array<object>} befunde  Ergebnisse aus `ausbreitung`
 * @returns {object|null} dieselbe Form wie ein einzelner Befund; `'zu_weit'`,
 *          wenn die Relaisstellen zu weit auseinanderliegen
 */
export function ueberdeckung(befunde) {
  const teile = (befunde || []).filter(Boolean);
  if (!teile.length) return null;
  if (teile.length === 1) return teile[0];

  const x0 = Math.min(...teile.map(b => b.x0));
  const y0 = Math.min(...teile.map(b => b.y0));
  const x1 = Math.max(...teile.map(b => b.x0 + b.spalten));
  const y1 = Math.max(...teile.map(b => b.y0 + b.zeilen));
  const spalten = x1 - x0, zeilen = y1 - y0;

  /* Das gemeinsame Feld spannt sich über alle Relaisstellen, auch über den
     leeren Zwischenraum. Zwei Stellen in derselben Planung, aber verschiedenen
     Landesteilen – etwa aus einer Vorlage übernommen – ergäben so ein Feld von
     Hunderten Millionen Zellen; die Belegung schlüge fehl und nähme den Reiter
     mit. Eine gemeinsame Fläche über 150 km ist ohnehin keine Aussage mehr:
     zwei Relaisstellen, die so weit auseinanderstehen, überdecken einander
     nicht, sie stehen nebeneinander. Deshalb nicht rechnen, sondern es sagen. */
  if (spalten * zeilen > UEBERDECKUNG_HOECHSTENS) return 'zu_weit';

  const zonen = new Uint8Array(spalten * zeilen);
  for (const b of teile) {
    const vx = b.x0 - x0, vy = b.y0 - y0;
    for (let j = 0; j < b.zeilen; j++) {
      const von = j * b.spalten, nach = (j + vy) * spalten + vx;
      for (let i = 0; i < b.spalten; i++) {
        const z = b.zonen[von + i];
        if (z > zonen[nach + i]) zonen[nach + i] = z;
      }
    }
  }

  const meterJeZelle = teile[0].meterJeZelle;
  return {
    ...zaehlen(zonen, {
      spalten, zeilen, x0, y0, meterJeZelle,
      ecken: eckenFuer(x0, y0, spalten, zeilen),
      fehlend: teile.reduce((n, b) => n + (b.fehlend || 0), 0)
    }),
    umkreis: Math.max(...teile.map(b => b.umkreis || 0)),
    meterJeZelle,
    stellen: teile.length
  };
}

// ---------------------------------------------------------- Masthöhe rückwärts

/**
 * Welche Antennenhöhe die Relaisstelle braucht, damit ein bestimmter Ort in der
 * freien Zone liegt.
 *
 * Gerechnet wird auf dem Höhenprofil zwischen beiden Orten und nicht auf dem
 * Rasterblock: die Frage gilt einer einzelnen Richtung, und die 25-m-Schritte
 * des Profils treffen die Kante genauer als ein Strahl durch das Zellenraster.
 *
 * Maß ist die streifende Sichtlinie – ν = 0, also 6 dB. Darüber hinaus Freiraum
 * zu fordern, wie es der Richtfunk mit 60 % der Fresnelzone tut, führte im
 * 4-m-Band auf zweistellige Zusatzmeter für den letzten halben Dezibel: die
 * trägt kein Teleskopmast, und sie sind es auch nicht wert.
 *
 * @returns {Promise<object|null>} `urteil` ist 'reicht', 'hoeher' oder
 *          'unbeurteilbar'.
 */
export async function noetigeMasthoehe(standort, ziel, mhz, antennenhoehe, zielhoehe = 1.5) {
  const punkte = await profil(standort, ziel, 25);
  if (!punkte || punkte.length < 2) return null;
  const D = punkte[punkte.length - 1].d;
  const hStandort = punkte[0].h, hZiel = punkte[punkte.length - 1].h;
  if (!(D > 0) || !isFinite(hStandort) || !isFinite(hZiel)) {
    return { urteil: 'unbeurteilbar', distanz: D, grund: 'ende' };
  }

  const luecken = punkte.filter(p => !isFinite(p.h)).length;
  if (luecken / punkte.length > LUECKEN_GRENZE) {
    return {
      urteil: 'unbeurteilbar', distanz: D, grund: 'luecken',
      luecken, stuetzpunkte: punkte.length
    };
  }

  const zZiel = hZiel + (Number(zielhoehe) || 0);
  let noetigNN = -Infinity, engste = null;

  for (const p of punkte) {
    if (!isFinite(p.h) || p.d <= 0 || p.d >= D) continue;
    const t = p.d / D;
    /* Hier ist die Strecke bekannt, deshalb steht hier die genaue Form des
       Erdstichs d1·d2/(2R) gegen die Sehne zwischen beiden Enden und nicht die
       Tangentialebene, mit der die Flächenrechnung oben arbeiten muss. */
    const kante = p.h + p.d * (D - p.d) / (2 * ERDRADIUS_WIRKSAM);
    /* Höhe der Antennenmitte über NN, ab der die Sichtlinie diese Kante
       streift: A·(1−t) + zZiel·t ≥ kante. */
    const noetig = (kante - zZiel * t) / (1 - t);
    if (noetig > noetigNN) { noetigNN = noetig; engste = { ...p, kante, noetig }; }
  }

  const jetzt = Number(antennenhoehe) || 0;
  /* Ohne eine einzige Kante dazwischen bleibt die Richtung frei, sobald die
     Antenne über dem Boden steht – dann ist die Frage schon beantwortet. */
  const noetigUeberGrund = engste ? Math.max(0, noetigNN - hStandort) : 0;

  return {
    urteil: noetigUeberGrund <= jetzt ? 'reicht' : 'hoeher',
    distanz: D,
    noetig: noetigUeberGrund,
    jetzt,
    fehlt: Math.max(0, noetigUeberGrund - jetzt),
    engste,
    standorthoehe: hStandort,
    zielhoehe: Number(zielhoehe) || 0,
    zielgrund: hZiel,
    luecken, stuetzpunkte: punkte.length
  };
}

/* Obergrenze für eine Masthöhe, die noch als Vorschlag durchgeht – dieselbe
   Grenze wie beim Richtfunk (funkrechnung.js). Darüber ist die Antwort nicht
   „höherer Mast“, sondern „anderer Standort“, und genau das soll der Satz sagen
   statt eine Zahl zu nennen, die niemand aufbauen kann. */
export const MASTHOEHE_GRENZE = 40;

/** Der Satz zur Rückwärtsrechnung – fertig, damit Blatt und Bildschirm gleich lauten. */
export function masthoeheText(m, ziel = 'dieser Ort') {
  if (!m) return 'Für diese Richtung liegen keine Geländehöhen vor.';
  if (m.urteil === 'unbeurteilbar') {
    return m.grund === 'ende'
      ? `Für ${ziel} oder für den Standort selbst fehlt die Geländehöhe – die ` +
        'Richtung lässt sich aus diesen Daten nicht beurteilen.'
      : `Für ${m.luecken} von ${m.stuetzpunkte} Stützpunkten liegen keine Höhen vor – ` +
        'die Richtung ist bei der Erkundung in Augenschein zu nehmen.';
  }
  const weit = formatLaenge(m.distanz);
  if (m.urteil === 'reicht') {
    /* Unterhalb eines Meters steht rechnerisch „ab 0 m Antennenhöhe“ da, und
       das liest sich wie ein Rechenfehler statt wie die Auskunft, die es ist:
       zwischen hier und dort steht überhaupt nichts. Dann wird der Sachverhalt
       genannt und nicht die Zahl. */
    if (m.noetig < 1) {
      return `${gross(ziel)} liegt ${weit} entfernt und frei in Sicht – dorthin ` +
        `verdeckt das Gelände nichts, dafür braucht es keine Masthöhe.`;
    }
    return `${gross(ziel)} liegt ${weit} entfernt und schon ab ` +
      `${meterText(m.noetig)} Antennenhöhe in der freien Zone; aufgebaut sind ` +
      `${meterText(m.jetzt)}.`;
  }
  const wo = `${formatLaenge(m.engste.d)} vor dem Standort`;
  if (m.noetig > MASTHOEHE_GRENZE) {
    return `${gross(ziel)} liegt ${weit} entfernt hinter einer Kante ${wo}. ` +
      `Rechnerisch wären über ${meterText(MASTHOEHE_GRENZE)} Antennenhöhe nötig – so ` +
      'viel trägt kein Teleskopmast des Fernmeldebaus. Hier hilft nur ein anderer ' +
      'Standort oder eine zweite Relaisstelle.';
  }
  return `${gross(ziel)} liegt ${weit} entfernt im Schatten einer Kante ${wo}. Frei ` +
    `wird die Richtung ab ${meterText(m.noetig)} Antennenhöhe – das sind ` +
    `${meterText(m.fehlt)} mehr als die aufgebauten ${meterText(m.jetzt)}. Gemeint ist ` +
    'die streifende Sichtlinie, kein Freiraum darüber hinaus.';
}

const gross = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- Ausgabe

const nf = (n, d = 0) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/** „12,5 m“ – Antennenhöhen sind in halben Metern gestuft */
export function meterText(m) {
  if (!isFinite(m)) return '–';
  const g = Math.round(m * 10) / 10;
  return nf(g, g % 1 ? 1 : 0) + ' m';
}

/** „18 km²“ – ganze Quadratkilometer, darunter mit einer Stelle */
export function flaecheText(km2) {
  if (!isFinite(km2)) return '–';
  return nf(km2, km2 < 10 ? 1 : 0) + ' km²';
}

/* Der Satz, der neben der Fläche stehen muss – aus demselben Grund wie bei der
   Funksicht des Richtfunks: die eingefärbte Fläche sieht aus wie eine Zusage,
   und sie ist keine. Er wird hier gebildet und nicht in der Oberfläche
   zusammengesetzt, damit auf Blatt und Bildschirm derselbe Wortlaut steht.

   Der Randbereich bekommt einen eigenen Halbsatz, weil er die eigentliche
   Planungsaussage trägt: dort entscheidet sich, ob eine zweite Relaisstelle
   nötig wird, und dort liegt auch der Unterschied zwischen analogem und
   digitalem Betrieb. */
export function ausbreitungText(e, band) {
  if (!e) return 'Für diesen Umkreis liegen keine Geländehöhen vor.';
  const km = nf(e.umkreis / 1000, e.umkreis % 1000 ? 1 : 0);
  const anteil = n => e.zellen ? Math.round(n / e.zellen * 100) : 0;
  const luecke = e.fehlend ? ' Wo Höhen fehlten, bleibt die Fläche ungefärbt.' : '';
  const digital = band && band.id === 'tetra-dmo'
    ? ' Im Digitalfunk ist auf den Randbereich wenig Verlass: TETRA bricht ab, wo ein ' +
      'analoger Kanal noch rauscht und trägt.'
    : '';
  const wo = e.stellen
    ? `Überdeckung von ${e.stellen} Relaisstellen`
    : `Ausbreitung im Umkreis von ${km} km`;
  return `${wo}: ${anteil(e.frei)} % der Fläche (${flaecheText(e.flaecheFrei)}) haben ` +
    `freie Sicht über das Gelände, weitere ${anteil(e.rand)} % ` +
    `(${flaecheText(e.flaecheRand)}) liegen im Randbereich – dort verdeckt eine Kante ` +
    `die Sichtlinie, die Beugung trägt aber noch (bis ${RAND_BIS_DB} dB).${digital} ` +
    'Bewuchs, Bebauung und Freileitungen stehen in diesen Höhen nicht – die eingefärbte ' +
    'Fläche ist die günstigste Annahme, kein Empfangsnachweis.' + luecke;
}

/** Zeichenerklärung der drei Zonen – Seitenleiste und Blatt nehmen denselben Text. */
export const ZONEN_ERKLAERUNG = [
  {
    zone: FREI, name: 'Freie Sicht',
    text: `Sichtlinie über dem Gelände, Beugungsdämpfung unter ${FREI_BIS_DB} dB.`
  },
  {
    zone: RANDBEREICH, name: 'Randbereich',
    text: `Eine Kante steht im Weg, die Beugung trägt noch – ${FREI_BIS_DB} bis ` +
      `${RAND_BIS_DB} dB. Hier hilft Masthöhe oder ein Schritt aus der Deckung.`
  },
  {
    zone: SCHATTEN, name: 'Funkschatten',
    text: `Über ${RAND_BIS_DB} dB Beugungsdämpfung – bleibt ungefärbt. Hier hilft ein ` +
      'anderer Standort oder eine zweite Relaisstelle, nicht der höhere Mast.'
  }
];
