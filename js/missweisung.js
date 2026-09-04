// missweisung.js – Missweisung und Meridiankonvergenz für die Bussolenpeilung

/* Der rechtweisende Azimut steht schon auf dem Auftrag (richtfunk.js über
   geo.js peilung). Eindrehen lässt sich die Antenne damit nicht: die Bussole
   zeigt auf den magnetischen Pol, und wer die Peilung ans gedruckte
   UTM-Kilometergitter anlegt (gitter.js), arbeitet gegen ein drittes Nord.
   Dieses Modul liefert die beiden Winkel, die dazwischenstehen – Missweisung
   und Meridiankonvergenz – und rechnet den rechtweisenden Azimut in das um,
   was am Gerät eingestellt wird.

   Reines Rechenmodul nach dem Muster von strom.js: Zahlen und reine
   Funktionen, keine Karte, kein Zustand, keine Oberfläche. */

import { utmZone } from './geo.js';

const rad = d => d * Math.PI / 180;
const grad = r => r * 180 / Math.PI;

// ---------------------------------------------------------------- Weltmagnetmodell

/* Weltmagnetmodell WMM 2025 (NOAA/NCEI und British Geological Survey),
   Kugelfunktionsentwicklung bis Grad 12, Epoche 2025,0.

   Die Koeffizienten stehen hier im Modul und nicht unter vendor/: das ist
   kein Fremdcode, den man unverändert mitschleppt und dessen Lizenz man
   einhält, sondern die Zahlenliste einer Formel – so wie die Leitfähigkeit
   von Kupfer in strom.js oder die Trommellängen in state.js. Der Rechenweg
   daneben ist eigener Quelltext; ein Verzeichnis für Fremdcode würde hier
   nur die Herkunft verschleiern, die im Quellenhinweis ohnehin steht.

   WMM und nicht IGRF, obwohl das IGRF für Deutschland etwas genauer ist:
   Kompasse, Handpeilgeräte und Navigationsempfänger rechnen mit dem WMM.
   Wer die gedruckte Missweisung gegen die Anzeige seines Geräts hält, soll
   dieselbe Zahl sehen – eine um Zehntelgrad „bessere“ weckt am Bauort einen
   Fehlerverdacht statt Vertrauen.

   Je Ordnung vier Zahlen: g und h zur Epoche in nT, danach ihre jährliche
   Änderung in nT je Jahr. Reihenfolge n = 1…12, darin m = 0…n – dieselbe,
   in der die Feldsummation sie abarbeitet. */
const KOEFFIZIENTEN = [
   -29350,      0, 12.6,    0, -1410.3, 4545.5,   10,-21.5,                              // n = 1
  -2556.2,      0,-11.2,    0,  2950.9,-3133.6, -5.3,-27.3,  1648.7, -814.2, -8.3,-11.1, // n = 2
   1360.9,      0, -1.5,    0, -2404.2,  -56.9, -4.4,  3.8,  1243.8,  237.6,  0.4, -0.2, // n = 3
    453.4, -549.6,-15.6, -3.9,
    894.7,      0, -1.7,    0,   799.6,  278.6, -2.3, -1.3,    55.8,   -134, -5.8,  4.1, // n = 4
   -281.1,    212,  5.4,  1.6,      12, -375.4, -6.8, -4.1,
   -232.9,      0,  0.6,    0,     369,   45.3,  1.3, -0.5,   187.2,    220,    0,  2.1, // n = 5
   -138.7, -122.9,  0.7,  0.5,  -141.9,   42.9,  2.3,  1.7,    20.9,  106.2,    1,  1.9,
     64.3,      0, -0.2,    0,    63.8,  -18.4, -0.3,  0.3,    76.7,   16.8,  0.8, -1.6, // n = 6
   -115.7,   48.9,  1.2, -0.4,   -40.9,  -59.8, -0.8,  0.8,    14.9,   10.9,  0.4,  0.7,
    -60.8,   72.8,  0.9,  0.9,
     79.6,      0, -0.1,    0,   -76.9,  -48.9, -0.1,  0.6,    -8.8,  -14.4, -0.1,  0.5, // n = 7
     59.3,     -1,  0.5, -0.7,    15.8,   23.5, -0.1,    0,     2.5,   -7.4, -0.8, -0.9,
    -11.2,  -25.1, -0.8,  0.5,    14.3,   -2.2,  0.9, -0.3,
     23.1,      0, -0.1,    0,    10.9,    7.2,  0.2, -0.3,   -17.5,  -12.6,    0,  0.4, // n = 8
        2,   11.5,  0.4, -0.3,   -21.8,   -9.7, -0.1,  0.4,    16.9,   12.7,  0.3, -0.5,
     14.9,    0.7,  0.1, -0.6,   -16.8,   -5.2,    0,  0.3,       1,    3.9,  0.3,  0.2,
      4.7,      0,    0,    0,       8,  -24.8,    0,    0,       3,   12.1,    0,    0, // n = 9
     -0.2,    8.3,    0,    0,    -2.5,   -3.4,    0,    0,   -13.1,   -5.3,    0,    0,
      2.4,    7.2,    0,    0,     8.6,   -0.6,    0,    0,    -8.7,    0.8,    0,    0,
    -12.8,    9.8,    0,    0,
     -1.3,      0,    0,    0,    -6.4,    3.3,    0,    0,     0.2,    0.1,    0,    0, // n = 10
        2,    2.5,    0,    0,      -1,    5.4,    0,    0,    -0.5,     -9,    0,    0,
     -0.9,    0.4,    0,    0,     1.5,   -4.2,    0,    0,     0.9,   -3.8,    0,    0,
     -2.6,    0.9,    0,    0,    -3.9,     -9,    0,    0,
        3,      0,    0,    0,    -1.4,      0,    0,    0,    -2.5,    2.8,    0,    0, // n = 11
      2.4,   -0.6,    0,    0,    -0.6,    0.1,    0,    0,       0,    0.5,    0,    0,
     -0.6,   -0.3,    0,    0,    -0.1,   -1.2,    0,    0,     1.1,   -1.7,    0,    0,
       -1,   -2.9,    0,    0,    -0.1,   -1.8,    0,    0,     2.6,   -2.3,    0,    0,
       -2,      0,    0,    0,    -0.1,   -1.2,    0,    0,     0.4,    0.6,    0,    0, // n = 12
      1.2,      1,    0,    0,    -1.2,   -1.5,    0,    0,     0.6,      0,    0,    0,
      0.5,    0.6,    0,    0,     0.5,   -0.2,    0,    0,    -0.1,    0.8,    0,    0,
     -0.5,    0.1,    0,    0,    -0.2,   -0.9,    0,    0,    -1.2,    0.1,    0,    0,
     -0.7,    0.2,    0,    0
];

const NMAX = 12;
const R_REF = 6371.2;                                  // Bezugsradius des Modells in km
const A = 6378.137, F = 1 / 298.257223563;             // WGS84 in km
const B = A * (1 - F);
const E2 = 2 * F - F * F, EP2 = E2 / (1 - E2);

/** Gültigkeitszeitraum des Modells als Dezimaljahre. */
export const MODELL_ZEITRAUM = { von: 2025.0, bis: 2030.0 };

/* Ein abgelaufenes Modell wirft keinen Fehler, es rechnet weiter – und liefert
   Zahlen, die von Jahr zu Jahr weiter danebenliegen, ohne dass man es ihnen
   ansieht. Genau das ist die Gefahr: Der Bauauftrag wird ausgedruckt und auf
   den Bauplatz mitgenommen; dort steht niemand, der die Missweisung
   nachschlagen könnte. Deshalb wird die Zeitüberschreitung als Kennzeichen
   durchgereicht und mit ausgegeben, statt die Rechnung abzubrechen: eine
   grobe Peilung mit Vermerk ist brauchbar, eine fehlende gar nicht. */
export function modellGueltig(jahr) {
  return jahr >= MODELL_ZEITRAUM.von && jahr <= MODELL_ZEITRAUM.bis;
}

/** Datum als Dezimaljahr – der Zeitbezug kommt von außen, nie aus dem Modul. */
export function dezimaljahr(datum = new Date()) {
  const jahr = datum.getFullYear();
  const anfang = Date.UTC(jahr, 0, 1), naechstes = Date.UTC(jahr + 1, 0, 1);
  return jahr + (Date.UTC(jahr, datum.getMonth(), datum.getDate()) - anfang) /
                (naechstes - anfang);
}

// ---------------------------------------------------------------- Feldrechnung

/* Schmidt-halbnormierte Legendre-Funktionen und ihre Ableitung nach dem
   Polabstand, aufsteigend rekursiv. Die geschlossene Form der Funktionen
   überläuft schon bei Grad 12 den Wertebereich doppelter Genauigkeit; die
   Rekursion bleibt durchweg in handlichen Zahlen. */
function legendre(theta) {
  const ct = Math.cos(theta), st = Math.sin(theta);
  const P = [], dP = [];
  for (let n = 0; n <= NMAX; n++) {
    P.push(new Float64Array(NMAX + 1));
    dP.push(new Float64Array(NMAX + 1));
  }
  P[0][0] = 1;
  for (let n = 1; n <= NMAX; n++) {
    for (let m = 0; m <= n; m++) {
      if (m === n) {
        if (n === 1) { P[1][1] = st; dP[1][1] = ct; }
        else {
          const k = Math.sqrt((2 * n - 1) / (2 * n));
          P[n][n] = k * st * P[n - 1][n - 1];
          dP[n][n] = k * (st * dP[n - 1][n - 1] + ct * P[n - 1][n - 1]);
        }
      } else {
        const d = Math.sqrt(n * n - m * m);
        const c2 = Math.sqrt((n - 1) * (n - 1) - m * m);
        const p2 = n - 2 >= m ? P[n - 2][m] : 0;
        const d2 = n - 2 >= m ? dP[n - 2][m] : 0;
        P[n][m] = ((2 * n - 1) * ct * P[n - 1][m] - c2 * p2) / d;
        dP[n][m] = ((2 * n - 1) * (ct * dP[n - 1][m] - st * P[n - 1][m]) - c2 * d2) / d;
      }
    }
  }
  return { P, dP };
}

/* Feldstärke in nT, zerlegt in Nord, Ost und Lot. Das Modell ist in
   geozentrischen Kugelkoordinaten aufgestellt, die Planung liegt in WGS84 –
   deshalb erst der Wechsel auf den geozentrischen Breitenwinkel und am Ende
   die Rückdrehung der Komponenten um denselben Winkel. Wer diesen Schritt
   überspringt und die geodätische Breite direkt einsetzt, liegt in unseren
   Breiten um gut ein Zehntelgrad daneben – in derselben Größenordnung wie
   die gesamte Modellunsicherheit. */
function feld(lat, lng, hoeheM, jahr) {
  const dt = jahr - MODELL_ZEITRAUM.von;
  const phi = rad(lat), lam = rad(lng), hkm = hoeheM / 1000;
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const a2 = A * A, b2 = B * B;
  const N = a2 / Math.sqrt(a2 * cp * cp + b2 * sp * sp);
  const r = Math.sqrt((N + hkm) ** 2 * cp * cp + ((b2 / a2) * N + hkm) ** 2 * sp * sp);
  const phiGeo = Math.asin((((b2 / a2) * N + hkm) * sp) / r);
  const theta = Math.PI / 2 - phiGeo;

  const { P, dP } = legendre(theta), st = Math.sin(theta);
  let Br = 0, Btheta = 0, Bphi = 0, i = 0;
  for (let n = 1; n <= NMAX; n++) {
    const f = Math.pow(R_REF / r, n + 2);
    for (let m = 0; m <= n; m++, i += 4) {
      const g = KOEFFIZIENTEN[i] + dt * KOEFFIZIENTEN[i + 2];
      const h = KOEFFIZIENTEN[i + 1] + dt * KOEFFIZIENTEN[i + 3];
      const cm = Math.cos(m * lam), sm = Math.sin(m * lam);
      const c = g * cm + h * sm;
      Br += f * (n + 1) * c * P[n][m];
      Btheta -= f * c * dP[n][m];
      if (m > 0) Bphi -= f * m * (-g * sm + h * cm) * P[n][m] / st;
    }
  }
  const psi = phiGeo - phi;
  return {
    nord: -Btheta * Math.cos(psi) + Br * Math.sin(psi),
    ost: Bphi,
    lot: -Btheta * Math.sin(psi) - Br * Math.cos(psi)
  };
}

// ---------------------------------------------------------------- Missweisung

/**
 * Missweisung (magnetische Deklination) an einem Ort zu einem Zeitpunkt.
 * @param {{lat:number,lng:number,h?:number}} ort  Höhe optional, wie sie
 *        hoehe.js liefert – sie verschiebt die Missweisung erst in der
 *        dritten Nachkommastelle, kostet aber nichts, weil das Modell den
 *        Abstand zum Erdmittelpunkt ohnehin braucht.
 * @param {Date} datum
 * @returns {{grad:number, aenderung:number, jahr:number, gueltig:boolean}}
 *          grad positiv = östliche Missweisung
 */
export function missweisung(ort, datum = new Date()) {
  const jahr = dezimaljahr(datum);
  const hoehe = Number.isFinite(ort.h) ? ort.h : 0;
  const jetzt = feld(ort.lat, ort.lng, hoehe, jahr);
  const spaeter = feld(ort.lat, ort.lng, hoehe, jahr + 1);
  const winkel = f => grad(Math.atan2(f.ost, f.nord));
  /* Die jährliche Änderung als Differenz zweier Rechnungen statt aus den
     Änderungsraten der Koeffizienten: die Missweisung ist ein Arkustangens
     zweier Feldkomponenten, ihre Änderung damit nicht die Summe der
     Koeffizientenänderungen. Eine Rechnung mehr ist billiger als die
     Ableitung von Hand – und ohne Fallunterscheidung am Datumssprung. */
  return {
    grad: winkel(jetzt),
    aenderung: winkel(spaeter) - winkel(jetzt),
    jahr,
    gueltig: modellGueltig(jahr)
  };
}

// ---------------------------------------------------------------- Meridiankonvergenz

/**
 * Meridiankonvergenz: Winkel zwischen Gitternord und rechtweisend Nord,
 * positiv = Gitternord liegt östlich von rechtweisend Nord.
 *
 * Der Bauauftrag druckt ein UTM-Kilometergitter und führt durchgängig MGRS.
 * Wer das Winkelmaß ans Gitter anlegt statt an den Meridian, misst gegen
 * Gitternord – und das ist über Deutschland bis zu rund 2,5° gegen
 * rechtweisend Nord verdreht, also in derselben Größenordnung wie die
 * Missweisung selbst. Die beiden heben sich stellenweise fast auf und
 * addieren sich anderswo; keiner der beiden Winkel darf deshalb fehlen.
 *
 * @param {{lat:number,lng:number}} ort
 * @param {number} [zoneFest] wie in geo.js nachUTM: am Zonenrand rechnet das
 *        Gitter durchgehend in einer Zone, dann gilt deren Mittelmeridian
 *        auch für die Konvergenz.
 */
export function meridiankonvergenz(ort, zoneFest) {
  const zone = zoneFest || utmZone(ort.lng);
  const mittelmeridian = 6 * (zone - 1) - 180 + 3;
  const phi = rad(ort.lat);
  const p = rad(ort.lng - mittelmeridian);
  const cp = Math.cos(phi), t = Math.tan(phi);
  const eta2 = EP2 * cp * cp;
  /* Reihenentwicklung der transversalen Mercatorabbildung. Das erste Glied
     Δλ·sin φ trägt über Deutschland schon alles bis auf gut eine
     Bogenminute; die beiden folgenden kosten nichts und ersparen die Frage,
     ab welcher Zonenrandnähe die Näherung nicht mehr trägt. */
  return grad(p * Math.sin(phi) * (
    1 + (p * p * cp * cp / 3) * (1 + 3 * eta2 + 2 * eta2 * eta2)
      + (p ** 4 * cp ** 4 / 15) * (2 - t * t)));
}

// ---------------------------------------------------------------- Peilungen

const normiert = a => ((a % 360) + 360) % 360;

/**
 * Zu einem rechtweisenden Azimut die beiden Peilungen, die am Bauort
 * gebraucht werden: die missweisende für die Bussole und die Gitterpeilung
 * für das Winkelmaß am Kartengitter.
 *
 * @param {number} azimutRw  rechtweisender Azimut in Grad (geo.js peilung)
 * @param {{lat:number,lng:number,h?:number}} ort  der Aufbauplatz
 * @param {Date} datum
 * @param {number} [zoneFest]  UTM-Zone des gedruckten Gitters
 */
export function peilungen(azimutRw, ort, datum = new Date(), zoneFest) {
  const m = missweisung(ort, datum);
  const konvergenz = meridiankonvergenz(ort, zoneFest);
  return {
    rw: normiert(azimutRw),
    mw: normiert(azimutRw - m.grad),
    gt: normiert(azimutRw - konvergenz),
    missweisung: m.grad,
    aenderung: m.aenderung,
    konvergenz,
    jahr: m.jahr,
    gueltig: m.gueltig
  };
}

// ---------------------------------------------------------------- Ausgabe

/* Wie genau die Missweisung am Ende ist, entscheidet nicht das Modell.
   Der Größe nach:
     – örtliche Störung am Aufbauplatz: Fahrzeug, Mast, Bewehrung im Beton,
       Oberleitung. 1° bis über 10°, nicht rechenbar, hängt davon ab, wo der
       Trupp steht. Das ist der größte Posten und der einzige, den man am
       Bauort selbst beeinflusst – Abstand halten.
     – Krustenfeld: örtliche Magnetisierung des Gesteins, in Deutschland
       0,55° bis 0,82°. Kein Kugelfunktionsmodell dieses Grades erfasst sie.
     – Unsicherheit des Modells selbst: ±0,36° bis 0,40°.
     – Abschneiden der Reihe bei Grad 12: darunter, ohne praktische Folge.

   Daraus folgt die Ausgabe: volle Grad, keine Nachkommastellen. Die Bussole
   hat eine Teilung von 1° oder 2°, wird freihändig gehalten und liest nicht
   genauer; eine Zahl wie „7,8°“ auf dem Blatt verspricht eine Schärfe, die
   an keinem Punkt der Kette vorhanden ist. Die Rechenfunktionen liefern
   weiterhin ungerundet – gerundet wird erst hier, damit sich die Rundung
   nicht durch zwei Winkelsubtraktionen fortpflanzt. */

const gradText = w => `${Math.round(normiert(w))}°`;
const komma = (w, stellen) => w.toFixed(stellen).replace('.', ',');

/* Die Textfassungen nehmen den Winkel als Zahl, nicht das Ergebnisobjekt:
   dieselbe Missweisung kommt einmal aus missweisung() und einmal aus
   peilungen() und hieße dort grad und hier missweisung. Eine Funktion, die
   beide Formen annehmen soll, liefert bei der falschen still „NaN°“ aufs
   Blatt statt zu scheitern. */

/** „4° Ost“ – Missweisung mit Richtungssinn, nie als bloße Zahl. */
export function missweisungText(gradWert) {
  const betrag = Math.round(Math.abs(gradWert));
  if (betrag === 0) return '0° (rechtweisend Nord)';
  return `${betrag}° ${gradWert > 0 ? 'Ost' : 'West'}`;
}

/** „0,13° Ost je Jahr“ – wie schnell der Wert wegläuft. */
export function aenderungText(gradProJahr) {
  const betrag = Math.abs(gradProJahr);
  if (betrag < 0.005) return 'nahezu unverändert';
  return `${komma(betrag, 2)}° ${gradProJahr > 0 ? 'Ost' : 'West'} je Jahr`;
}

/** „0,2° Ost“ – Meridiankonvergenz; sie bleibt in Zehnteln, weil sie eine
 *  gerechnete Größe der Abbildung ist und keine gemessene. */
export function konvergenzText(gradWert) {
  if (Math.abs(gradWert) < 0.05) return '0° (Gitternord ≈ rechtweisend Nord)';
  return `${komma(Math.abs(gradWert), 1)}° ${gradWert > 0 ? 'Ost' : 'West'}`;
}

/* Kein Peilungswert erscheint ohne das Nord, auf das er sich bezieht: rw
   rechtweisend, mw missweisend, gt Gitter. Die Kürzel sind die des
   Kartenwesens und stehen vor der Zahl, damit beim Ablesen unter Zeitdruck
   zuerst der Bezug im Blick ist und nicht der Winkel. */

/** „rw 12° · mw 8° · gt 11°“ – eine Zeile für Liste und Datenblatt. */
export function peilungText(p) {
  return `rw ${gradText(p.rw)} · mw ${gradText(p.mw)} · gt ${gradText(p.gt)}`;
}

/** Nur die Bussolenpeilung, für die Zeile am Aufbauplatz. */
export function bussolenText(p) {
  return `mw ${gradText(p.mw)}`;
}

/**
 * Fußzeile unter der Peilung: worauf sie beruht und ab wann sie zu
 * erneuern ist. Ein abgelaufenes Modell wird hier benannt – auf dem Papier
 * ist das die einzige Stelle, an der es noch auffallen kann.
 */
export function nordbezugText(p) {
  const teile = [
    `Missweisung ${missweisungText(p.missweisung)} (${aenderungText(p.aenderung)})`,
    `Meridiankonvergenz ${konvergenzText(p.konvergenz)}`
  ];
  if (!p.gueltig) {
    // Beide Richtungen ansprechen: ein zu altes Modell ist so falsch wie ein
    // abgelaufenes, und der gerechnete Zeitpunkt zeigt, welcher Fall vorliegt.
    teile.push(`WMM 2025 gilt ${komma(MODELL_ZEITRAUM.von, 1)} bis ` +
      `${komma(MODELL_ZEITRAUM.bis, 1)}, gerechnet für ${komma(p.jahr, 1)} – ` +
      'Missweisung vor Ort prüfen');
  }
  return teile.join(' · ');
}

/** Quellenangabe für Blattfuß und LIZENZEN.md, wie HOEHEN_QUELLE in hoehe.js. */
export const MISSWEISUNG_QUELLE =
  'Missweisung: World Magnetic Model 2025 (NOAA/NCEI, British Geological Survey), ' +
  'gültig 2025,0–2030,0; Meridiankonvergenz aus UTM/WGS84';
