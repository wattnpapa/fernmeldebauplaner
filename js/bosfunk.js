// bosfunk.js – Bänder des BOS-Sprechfunks und der λ/4-Rundstrahler dazu

/* Was js/frequenzen.js für den WLAN-Richtfunk ist, ist dieses Modul für den
   BOS-Sprechfunk: die Bandgrenzen, die in die Ausbreitungsrechnung eingehen,
   und die Maße des Strahlers, der am Mast hochgeht.

   Eine Grenze, die dieses Modul nicht überschreitet: es nennt keinen Kanal und
   keine Kanalhälfte. Welcher Kanal einer Relaisstelle zusteht und ob sie im
   Unter- oder Oberband sendet, steht in der Frequenzzuteilung der zuständigen
   Stelle und in nichts sonst – eine Anwendung, die das aus einer Tabelle
   ableitete, führte auf einen Kanal, den es für diesen Einsatz nicht gibt. Für
   die Ausbreitung ist es ohnehin ohne Belang: die beiden Hälften des 2-m-Bandes
   liegen keine 5 % auseinander, und die Wellenlänge geht in die Beugung nur
   unter der Wurzel ein. Für die Länge des Strahlers ist es dagegen zu merken –
   deshalb steht dort die Spanne über das ganze Band und nicht nur der Wert zur
   Bandmitte.

   Redaktionsstand der Bandgrenzen: September 2026. */

import { LICHTGESCHWINDIGKEIT, ERDRADIUS_WIRKSAM } from './funkrechnung.js';

/* Ein Bandeintrag trägt, was am Entscheidungsort gebraucht wird:

     von, bis     Bandgrenzen in MHz
     mhz          Rechenfrequenz der Ausbreitung – die Bandmitte
     betriebsart  wie die Relaisstelle arbeitet, in einem Satz
     umkreis      Vorgabe für den gerechneten Umkreis in Metern

   Die Vorgabe des Umkreises steht am Band, weil sie an ihm hängt: ein
   4-m-Relais trägt über dasselbe Gelände weiter als ein DMO-Repeater, und ein
   Umkreis über der tatsächlichen Reichweite kostet Kacheln und Wartezeit für
   eine Fläche, die niemand braucht. */
export const BOS_BAENDER = [
  {
    id: '4m',
    name: '4-m-Band (analog FM)',
    kurz: '4 m',
    von: 74.215, bis: 87.275,
    mhz: 80.745,
    betriebsart: 'Analoger Sprechfunk in Gegenverkehr über die Relaisstelle; ' +
      'ortsfeste und bewegliche Funkstellen arbeiten in verschiedenen Bandhälften.',
    umkreis: 15000,
    hinweise: [
      'Kanal und Bandhälfte stehen in der Frequenzzuteilung – sie werden hier nicht abgeleitet.',
      'Von den drei Bändern trägt das 4-m-Band am weitesten über Gelände: die längere ' +
        'Welle beugt sich stärker um Kuppen und Waldränder.'
    ],
    fundstelle: 'Frequenzbereich BOS 74,215–87,275 MHz'
  },
  {
    id: '2m',
    name: '2-m-Band (analog FM)',
    kurz: '2 m',
    von: 165.210, bis: 173.980,
    mhz: 169.595,
    betriebsart: 'Analoger Sprechfunk im Einsatzstellenfunk, überwiegend mit ' +
      'Handfunkgeräten; die Relaisstelle setzt den Verkehr über das Gelände um.',
    umkreis: 10000,
    hinweise: [
      'Kanal und Bandhälfte stehen in der Frequenzzuteilung – sie werden hier nicht abgeleitet.',
      'Handfunkgeräte am Mann sind der Regelfall: die Gegenstelle steht bei 1,5 m ' +
        'über Grund, und das kostet gegenüber einer Fahrzeugantenne spürbar Fläche.'
    ],
    fundstelle: 'Frequenzbereich BOS 165,210–173,980 MHz'
  },
  {
    id: 'tetra-dmo',
    name: 'TETRA DMO (Digitalfunk, netzunabhängig)',
    kurz: 'DMO',
    von: 380, bis: 385,
    mhz: 382.5,
    betriebsart: 'Direktbetrieb ohne Netz, von Endgerät zu Endgerät; ein ' +
      'DMO-Repeater setzt den Verkehr um und wirkt wie eine Relaisstelle.',
    umkreis: 8000,
    hinweise: [
      'DMO läuft in dem Bereich, in dem im Netzbetrieb die Endgeräte senden – ' +
        'Betriebsart und DMO-Kanal kommen von der Autorisierten Stelle.',
      'Digitalfunk bricht schroffer ab als analoger: wo der Analogkanal noch rauscht ' +
        'und trägt, ist TETRA schon stumm. Der Randbereich der Fläche ist hier ' +
        'deshalb weniger wert als im 2-m- und 4-m-Band.'
    ],
    fundstelle: 'Frequenzbereich BOS-Digitalfunk 380–385 MHz'
  }
];

export const BAND_STANDARD = '2m';

/** Band zu einer Kennung; unbekannte Kennungen fallen auf das 2-m-Band zurück. */
export const bosBandById = id =>
  BOS_BAENDER.find(b => b.id === id) ||
  BOS_BAENDER.find(b => b.id === BAND_STANDARD);

// ---------------------------------------------------------------- Gegenstelle

/* Die Höhe der Gegenstelle ist nach der eigenen Masthöhe die stärkste
   Stellschraube der Fläche, und sie wird beim Planen regelmäßig übersehen: eine
   Fläche, die für eine Fahrzeugantenne gerechnet ist, gilt für das
   Handfunkgerät am Mann nicht mehr. Deshalb steht sie als eigene Wahl da und
   nicht als stille Annahme.

   `hoehe: null` heißt „so hoch wie die Relaisstelle selbst“ – für die zweite
   Relaisstelle oder eine Feststation am Mast. */
export const GEGENSTELLEN = [
  { id: 'hand',        name: 'Handfunkgerät am Mann',           kurz: 'Handfunkgerät', hoehe: 1.5 },
  { id: 'fahrzeug',    name: 'Fahrzeugantenne',                 kurz: 'Fahrzeug',      hoehe: 2.5 },
  { id: 'feststation', name: 'Zweite Relais- oder Feststation', kurz: 'Feststation',   hoehe: null }
];

export const GEGENSTELLE_STANDARD = 'hand';

export const gegenstelleById = id =>
  GEGENSTELLEN.find(g => g.id === id) ||
  GEGENSTELLEN.find(g => g.id === GEGENSTELLE_STANDARD);

/** Höhe der Gegenstelle über Grund; `eigene` gilt für die zweite Feststation. */
export function gegenstellenhoehe(id, eigene) {
  const g = gegenstelleById(id);
  if (g.hoehe !== null) return g.hoehe;
  const h = Number(eigene);
  return isFinite(h) && h > 0 ? h : 10;
}

// ------------------------------------------------------------ λ/4-Rundstrahler

/* Der Verkürzungsfaktor eines stabförmigen Strahlers gegenüber der freien
   Wellenlänge. Er hängt am Verhältnis von Länge zu Durchmesser und liegt für
   die üblichen Stäbe zwischen 0,94 und 0,98; 0,95 ist der Wert, mit dem
   zugeschnitten wird. Was danach zählt, ist das Stehwellenmessgerät – die Zahl
   hier ist das Maß zum Ablängen und nicht das Ergebnis des Abgleichs. */
export const VERKUERZUNG = 0.95;

/** Wellenlänge in Metern zu einer Frequenz in MHz */
export const wellenlaenge = mhz => LICHTGESCHWINDIGKEIT / (Number(mhz) * 1e6);

/**
 * Maße des λ/4-Rundstrahlers für ein Band.
 *
 * Geliefert wird die Länge zur Bandmitte und die Spanne über das ganze Band:
 * im 4-m-Band liegen zwischen unterem und oberem Ende gut 14 cm, und wer den
 * Stab zur Bandmitte ablängt, steht am Bandende daneben. Ohne den zugeteilten
 * Kanal ist die Bandmitte die beste Ansage, die zu machen ist – die Spanne
 * sagt, wie viel dabei offen bleibt.
 *
 * @returns {{mitte:number, kurz:number, lang:number, lambda:number}} in Metern
 */
export function strahlermasse(band) {
  const b = typeof band === 'string' ? bosBandById(band) : band;
  const viertel = mhz => VERKUERZUNG * wellenlaenge(mhz) / 4;
  return {
    lambda: wellenlaenge(b.mhz),
    mitte: viertel(b.mhz),
    /* Die hohe Frequenz gibt den kurzen Stab. Die Namen stehen für den Stab und
       nicht für die Frequenz, weil am Bauort der Stab in der Hand liegt. */
    kurz: viertel(b.bis),
    lang: viertel(b.von)
  };
}

/* Der Satz, der neben den Maßen stehen muss. Der λ/4-Strahler ist ein halber
   Dipol: seine zweite Hälfte ist die leitende Fläche unter ihm. Fehlt sie, ist
   der Strahler verstimmt, ein Teil der Leistung läuft am Mast herunter, und das
   Strahlungsdiagramm kippt nach oben – die Reichweite über Grund bricht ein,
   ohne dass am Gerät etwas davon anzeigt. Auf dem Fahrzeugdach besorgt das die
   Karosserie; am Mast muss es besorgt werden. */
export const GEGENGEWICHT_HINWEIS =
  'Der λ/4-Rundstrahler braucht eine leitende Gegengewichtsfläche: auf dem ' +
  'Fahrzeug das Dach, am Mast mindestens drei bis vier Radiale derselben Länge, ' +
  'waagerecht oder leicht nach unten abgespreizt. Ohne sie ist der Strahler ' +
  'verstimmt und strahlt in den Mast statt über das Gelände – am Gerät zeigt ' +
  'das nichts an, an der Reichweite alles.';

/** „42,0 cm“ – Zentimeter, weil in Zentimetern abgelängt wird */
export function strahlerText(m) {
  if (!isFinite(m)) return '–';
  const cm = Math.round(m * 1000) / 10;
  return cm.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' cm';
}

// ---------------------------------------------------------------- Funkhorizont

/* Wie weit die Sichtlinie über einer glatten Kugel reicht, bevor die Erde
   selbst im Weg steht: d = √(2·R·h) mit dem um k = 4/3 vergrößerten Erdradius
   aus funkrechnung.js. Das sind die bekannten 4,12·√h in Kilometern.

   Die Zahl ist eine OBERE SCHRANKE und nichts anderes: sie gilt über einer
   Kugel ohne Berge, ohne Wald und ohne Häuser. Sie steht trotzdem in der
   Ausgabe, weil sie die einzige Reichweitenangabe ist, die keine Höhenkachel
   braucht – und weil sie die Frage beantwortet, die vor dem Aufbau kommt: lohnt
   der höhere Mast überhaupt? Bei 10 m sind es 13 km, bei 20 m 18,4 km; die
   doppelte Masthöhe bringt nicht die doppelte Weite, sondern das 1,41-fache.
   Wer das weiß, sucht die Reichweite eher im Standort als im Mast. */
export const funkhorizont = hoehe => {
  const h = Number(hoehe);
  return isFinite(h) && h > 0 ? Math.sqrt(2 * ERDRADIUS_WIRKSAM * h) : 0;
};

/** Funkhorizont zweier Funkstellen zusammen – beide Bögen addieren sich. */
export const sichtweite = (h1, h2) => funkhorizont(h1) + funkhorizont(h2);
