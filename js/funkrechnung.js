// funkrechnung.js – Geometrie der Funkstrecke: Fresnelzone, Erdstich, Masthöhe

/* Dieses Modul hört bei der Geometrie auf, und das ist eine Entscheidung.
   Fresnelradius, Erdstich und Freiraum rechnen sich aus dem, was die Planung
   ohnehin hat: Frequenz, Entfernung, Höhen über NN. Empfangspegel,
   Systemreserve, Nettodurchsatz und Verfügbarkeit rechnen sich daraus nicht.
   Die bräuchten Sendeleistung, Antennengewinn, Kabeldämpfung und
   Empfängerschwelle des Geräts, das erst am Aufbauplatz aus dem Karton kommt,
   dazu Regen- und Gasdämpfung für einen Zeitraum, den niemand kennt. Die
   Fehlerkette dieser Werte liegt bei rund 10 dB – das ist der Unterschied
   zwischen „geht“ und „geht nicht“. Eine dBm-Zahl auf dem Bauauftrag würde
   trotzdem geglaubt, weil sie wie eine Messung aussieht. Was das Gerät
   wirklich kann, steht nach dem Aufbau auf seiner eigenen Oberfläche; was die
   Geometrie hergibt, steht hier. */

import { meter, formatLaenge } from './geo.js';
import { oberflaecheVon, ARTTEXT, QUELLTEXT } from './oberflaeche.js';

// ---------------------------------------------------------------- Grundgrößen

/** Lichtgeschwindigkeit im Vakuum in m/s */
export const LICHTGESCHWINDIGKEIT = 299792458;

/** Mittlerer Erdradius in Metern */
export const ERDRADIUS = 6371000;

/* k = 4/3 steht für die Standardatmosphäre: die Luft wird nach oben dünner,
   der Strahl bricht dabei zur Erde hin und reicht weiter, als die reine
   Geometrie erlaubt. Gerechnet wird das nicht am Strahl, sondern an der Erde –
   mit einem um 4/3 vergrößerten Radius, 8.494,7 km statt 6.371 km. Das ist
   keine Feinheit: bei 10 km Abstand zu beiden Seiten bleiben so 5,89 m
   Erdstich statt 7,85 m. */
export const K_FAKTOR = 4 / 3;
export const ERDRADIUS_WIRKSAM = ERDRADIUS * K_FAKTOR;

/* 60 % des ersten Fresnelradius sind das übliche Freihaltemaß. Darunter
   beginnt die Beugung am Hindernis den Pegel zu ziehen, darüber ist der
   Gewinn gering – die restlichen 40 % kosten Masthöhe, ohne etwas zu bringen. */
export const FREIRAUM_ANTEIL = 0.6;

/* Ab hier ist ein Fehlbetrag mehr als das Rauschen der Höhendaten.
   Der Freiraum ist eine Differenz aus drei Höhenwerten desselben
   Geländemodells (beide Standorte und die geprüfte Stelle). Bei rund 2 m
   Standardabweichung je Wert summiert sich das auf σ ≈ 3,55 m, das 95-%-Band
   liegt bei ±7 m. Zum Vergleich: das 60-%-Freihaltemaß beträgt bei 5,5 GHz
   1,57 m auf 500 m und 3,13 m auf 2 km – bis rund 3 km ist die Streuung der
   Eingangsdaten also größer als die ganze geprüfte Größe. Wer unterhalb
   dieser Schwelle meldet, meldet das Rauschen. Die Zahl gehört deshalb auf
   das Blatt und nicht in eine Hilfe.

   Mit der Oberflächenschicht (oberflaeche.js) wird die Streuung nicht kleiner,
   sondern größer: die Oberflächenhöhe stammt aus einer anderen Aufnahme als
   die Geländehöhe, und über freiem Acker gehen die beiden schon deshalb um
   einige Meter auseinander. Genau davor schützt diese Schwelle. Sie bleibt
   deshalb, wo sie ist – nur mit einer Ausnahme: eine Höhe, die aus einem
   eingetragenen Gebäude oder einer Waldfläche stammt, ist keine Streuung
   zwischen zwei Modellen, sondern ein benanntes Objekt an einer bekannten
   Stelle. Dort zählt schon ein kleinerer Fehlbetrag (SCHWELLE_OBJEKT). */
export const ERKENNUNGSSCHWELLE = 7;

/* Für Hindernisse mit Namen und Umriss – Gebäude aus OpenStreetMap, Wald- und
   Gehölzflächen. Hier steckt der Fehler nicht mehr im Vergleich zweier
   Höhenmodelle, sondern nur noch in der Höhenannahme über dem Objekt; 3 m
   entsprechen einem Geschoss und liegen über der Streuung des Geländemodells
   allein. */
export const SCHWELLE_OBJEKT = 3;

/* Fehlt mehr als jeder zehnte Stützpunkt, kann hinter der Lücke ein ganzer
   Bergrücken stehen. Dann wird nicht geraten, sondern nicht geurteilt. */
export const LUECKEN_GRENZE = 0.1;

/* Halbwertsbreite einer üblichen Richtfunkantenne in Grad (8–12°, je nach
   Öffnung). Bezugsgröße für die Frage, ob eine Neigung überhaupt zählt. */
export const HALBWERTSBREITE_STANDARD = 10;

/* Eine fehlende Standorthöhe ist keine Höhe am Meeresspiegel: `Number(null)`
   und `Number('')` ergeben 0, und mit 0 m NN gerechnet meldet jede Strecke im
   Binnenland ein Hindernis. Leere Angaben müssen deshalb hier hängenbleiben. */
const zahl = w =>
  (w === null || w === undefined || w === '' || !isFinite(Number(w))) ? null : Number(w);

// ---------------------------------------------------------------- Fresnelzone

/** Wellenlänge in Metern zu einer Frequenz in MHz */
export function wellenlaenge(mhz) {
  const f = Number(mhz);
  if (!isFinite(f) || f <= 0) return null;
  return LICHTGESCHWINDIGKEIT / (f * 1e6);
}

/**
 * Radius der ersten Fresnelzone an einer Stelle der Strecke:
 * F1 = √(λ · d1 · d2 / D), mit d1 und d2 als Abstand zu den beiden Enden.
 * Am dicksten ist die Zone in Streckenmitte, an den Antennen ist sie null.
 */
export function fresnelradius(mhz, d1, d2) {
  const lam = wellenlaenge(mhz);
  const a = Math.max(0, Number(d1) || 0), b = Math.max(0, Number(d2) || 0);
  if (lam === null || a + b <= 0) return 0;
  return Math.sqrt(lam * a * b / (a + b));
}

// ---------------------------------------------------------------- Erdstich

/**
 * Erdstich an einer Stelle der Strecke in Metern: um so viel wölbt sich die
 * Erdoberfläche über die gerade Verbindung der beiden Enden.
 *
 * Die Sichtlinie bleibt hier gerade und die Krümmung wird dem Gelände
 * zugeschlagen – nicht umgekehrt. Krümmte man stattdessen den Strahl, änderte
 * sich sein Winkel an der Antenne, und genau der ist die Größe, mit der am
 * Mastfuß gearbeitet wird. So bleiben beide Enden auf ihrem Wert (d1 oder d2
 * ist dort null), und was man am Standort anpeilt, gilt auch in der Rechnung.
 */
export function senkung(d1, d2) {
  const a = Math.max(0, Number(d1) || 0), b = Math.max(0, Number(d2) || 0);
  return a * b / (2 * ERDRADIUS_WIRKSAM);
}

// ---------------------------------------------------------------- Mindeste Masthöhe

/**
 * Nötige Höhe der Antennenmitte über ebenem, freiem Gelände – beide Enden
 * gleich hoch. Erdstich in Streckenmitte plus 60 % des ersten Fresnelradius.
 * @returns {{hoehe:number, erdstich:number, fresnel:number, freiraum:number}|null}
 *
 * Das ist die belastbarste Zahl des Moduls: sie braucht keine einzige
 * Höhenkachel, sondern nur Frequenz und Entfernung, und beantwortet die Frage,
 * die am Mastfuß entschieden wird – Dreibein oder Teleskopmast.
 *
 * Sie ist eine UNTERE SCHRANKE, in beide Richtungen streng zu lesen: wer sie
 * unterschreitet, kommt auch über einem Acker nicht durch, denn schon die
 * gekrümmte Erde selbst steht dann im Weg. Wer sie einhält, hat damit nichts
 * gewonnen außer der Freiheit von der Erdkrümmung – jede Kuppe, jede Baumreihe
 * und jedes Dach dazwischen kommt obendrauf und steht nicht in dieser Rechnung.
 */
export function mindestantennenhoehe(mhz, laenge) {
  const D = Number(laenge);
  if (!isFinite(D) || D <= 0 || wellenlaenge(mhz) === null) return null;
  const erdstich = senkung(D / 2, D / 2);
  const fresnel = fresnelradius(mhz, D / 2, D / 2);
  const freiraum = FREIRAUM_ANTEIL * fresnel;
  return { hoehe: erdstich + freiraum, erdstich, fresnel, freiraum };
}

// ---------------------------------------------------------------- Geländeurteil

const ohneHoehe = p => p.h === null || p.h === undefined || !isFinite(p.h);

/* Objekte mit Umriss werden schärfer beurteilt als der Vergleich zweier
   Höhenmodelle – siehe SCHWELLE_OBJEKT. */
const schwelleFuer = art => (art === 'gebaeude' || art === 'bewuchs')
  ? SCHWELLE_OBJEKT : ERKENNUNGSSCHWELLE;

/**
 * Urteil über die Strecke zwischen zwei Antennen.
 * @param {Array<{d:number,lat:number,lng:number,h:?number,oberflaeche:?number}>} profil
 *        aus hoehe.js, möglichst durch oberflaeche.js ergänzt
 * @param {number} hoeheA  Antennenmitte am Anfang, Meter über NN
 * @param {number} hoeheB  Antennenmitte am Ende, Meter über NN
 * @param {number} mhz     Frequenz in MHz
 * @param {object} o       { dsm, gebaeude, bewuchs } – hat die Quelle geantwortet
 * @returns {object|null}  null, solange Profil oder Höhen fehlen
 *
 * Geprüft wird gegen die OBERFLÄCHE, nicht gegen das Gelände: ein Dach und
 * eine Baumreihe verdecken eine Strecke genauso wie eine Kuppe. Wo keine
 * Oberflächenhöhe vorliegt, tritt das Gelände an ihre Stelle – dann gilt
 * wieder, was vor der Oberflächenschicht galt, und der Vorbehalt sagt es.
 *
 * Das Urteil bleibt mit Absicht einseitig. „verdeckt“ trägt: was im Weg steht,
 * steht im Weg. Die Gegenrichtung trägt nicht: dass in diesen Daten nichts
 * steht, heißt nur, dass in diesen Daten nichts steht – ein Funkmast, ein
 * Silo, eine Freileitung und jeder Baum außerhalb einer kartierten Waldfläche
 * fehlen darin. Deshalb gibt es weiterhin keine Ampel und keinen Haken.
 */
export function gelaendeurteil(profil, hoeheA, hoeheB, mhz, o = {}) {
  const punkte = Array.isArray(profil) ? profil : [];
  const a = zahl(hoeheA), b = zahl(hoeheB);
  const D = punkte.length ? punkte[punkte.length - 1].d : 0;
  if (punkte.length < 2 || !(D > 0) || a === null || b === null) return null;

  const luecken = punkte.filter(ohneHoehe).length;
  let engste = null, beide = 0, nurA = 0, nurB = 0;
  let sichtlinieFrei = true, freiraumAnteil = Infinity, ohneGebaeudehoehe = 0;

  for (const p of punkte) {
    if (ohneHoehe(p)) continue;
    if (p.gebaeudeOhneHoehe) ohneGebaeudehoehe++;
    const hier = oberflaecheVon(p);
    const anteil = p.d / D;
    const sichtlinie = a + (b - a) * anteil;
    const erdstich = senkung(p.d, D - p.d);
    const f1 = fresnelradius(mhz, p.d, D - p.d);
    const freiraum = FREIRAUM_ANTEIL * f1;
    /* Höchste Oberfläche, die hier noch durchgeht. Anfang und Ende bleiben
       bewusst in der Schleife: eine Antenne, die tiefer steht als das, was um
       ihren eigenen Mastfuß steht, ist ein Befund und kein Randfall. */
    const zulaessig = sichtlinie - erdstich - freiraum;
    const fehlbetrag = hier - zulaessig;

    /* Abstand nach oben zur Sichtlinie und zur Freihaltegrenze – die beiden
       Zahlen, mit denen am Bauplatz entschieden wird. Negativ heißt: ragt
       hinein. */
    const abstandSichtlinie = sichtlinie - erdstich - hier;
    if (abstandSichtlinie < 0) sichtlinieFrei = false;
    if (f1 > 0) freiraumAnteil = Math.min(freiraumAnteil, abstandSichtlinie / f1);

    /* Maßgebend ist nicht der größte Fehlbetrag, sondern der größte Fehlbetrag
       über seiner eigenen Schwelle: ein Gebäude, das 4 m zu hoch steht, ist ein
       Befund, eine Modelldifferenz von 6 m über freiem Feld nicht. */
    const ueber = fehlbetrag - schwelleFuer(p.art);
    if (!engste || ueber > engste.ueberSchwelle) {
      engste = {
        d: p.d, lat: p.lat, lng: p.lng,
        hoehe: hier, gelaende: p.h,
        hindernis: isFinite(p.hindernis) ? p.hindernis : 0,
        art: p.art || 'gelaende', quelle: p.quelle || 'dgm', geschaetzt: !!p.geschaetzt,
        zulaessig, fehlbetrag, ueberSchwelle: ueber,
        schwelle: schwelleFuer(p.art),
        abstandSichtlinie, abstandFresnel: -fehlbetrag, fresnel: f1
      };
    }
    if (fehlbetrag > 0) {
      // Beide Enden gleich anzuheben hebt die Sichtlinie überall um denselben
      // Betrag; ein einzelnes Ende wirkt nur mit seinem Hebelarm zur Stelle hin.
      beide = Math.max(beide, fehlbetrag);
      nurA = Math.max(nurA, anteil < 1 ? fehlbetrag / (1 - anteil) : Infinity);
      nurB = Math.max(nurB, anteil > 0 ? fehlbetrag / anteil : Infinity);
    }
  }

  const gemessen = punkte.length - luecken;
  const urteil = gemessen < 2 || luecken / punkte.length > LUECKEN_GRENZE
    ? 'unbeurteilbar'
    : (engste.ueberSchwelle > 0 ? 'verdeckt' : 'unauffaellig');

  const anhebung = urteil === 'verdeckt'
    ? { beide, nurA: isFinite(nurA) ? nurA : null, nurB: isFinite(nurB) ? nurB : null }
    : null;

  const quellen = { dsm: !!o.dsm, gebaeude: !!o.gebaeude, bewuchs: !!o.bewuchs };
  return {
    urteil, engste, anhebung, quellen,
    sichtlinieFrei,
    /* Anteil der ersten Fresnelzone, der an der knappsten Stelle frei bleibt.
       Über 1 heißt: die ganze Zone ist frei; unter 0: die Oberfläche steht
       über der Sichtlinie. Gerundet wird erst in der Anzeige. */
    freiraumAnteil: isFinite(freiraumAnteil) ? freiraumAnteil : null,
    ohneGebaeudehoehe,
    stuetzpunkte: punkte.length, luecken,
    schwelle: ERKENNUNGSSCHWELLE,
    satz: urteilssatz(urteil, engste, anhebung, punkte.length, luecken, quellen, ohneGebaeudehoehe)
  };
}

/* Woher das Hindernis kommt, gehört in den Satz: „das Gelände verdeckt“ und
   „ein Gebäude verdeckt“ führen am Bauplatz zu verschiedenen Handgriffen –
   das eine heißt anderer Aufbauplatz, das andere heißt hinsehen und messen. */
function hindernisWorte(e) {
  if (!e) return { was: 'Das Gelände', fuerwort: 'es', woher: '' };
  /* Das Fürwort muss zum Hauptwort passen – „Bewuchs … steht sie“ liest sich
     wie ein Übersetzungsfehler und beschädigt einen Satz, der eine Ansage ist. */
  const worte = {
    gebaeude: ['Ein Gebäude', 'es'], bewuchs: ['Bewuchs', 'er'],
    dsm: ['Die Oberfläche', 'sie'], gelaende: ['Das Gelände', 'es']
  }[e.art] || ['Das Gelände', 'es'];
  const woher = e.quelle && e.quelle !== 'dgm' ? ` (${QUELLTEXT[e.quelle] || e.quelle})` : '';
  return { was: worte[0], fuerwort: worte[1], woher };
}

/* Der Satz gehört zum Urteil und wird hier fertig geliefert, nicht in der
   Anzeige zusammengesetzt: bei „unauffaellig“ steht der Vorbehalt mitten im
   Satz und nicht als Fußnote darunter – eine Fußnote liest am Bauort niemand,
   und ohne sie klänge das Urteil wie eine Freigabe. */
function urteilssatz(urteil, engste, anhebung, stuetzpunkte, luecken, quellen, ohneGebaeudehoehe) {
  /* Was an den Quellen gefehlt hat, steht in jedem Fall dabei – auch bei
     „verdeckt“: ein zweites Hindernis kann hinter der Lücke stehen. */
  const fehlend = [
    quellen.dsm ? null : 'das Oberflächenmodell',
    quellen.gebaeude ? null : 'die Gebäudedaten',
    quellen.bewuchs ? null : 'die Wald- und Gehölzflächen'
  ].filter(Boolean);
  const ausfall = fehlend.length
    ? ` Für diese Strecke ${fehlend.length === 1 ? 'stand' : 'standen'} ${verbinden(fehlend)} ` +
      'nicht zur Verfügung – geprüft ist insoweit nur das Gelände.'
    : '';
  const unbekannt = ohneGebaeudehoehe
    ? ` An ${stellen(ohneGebaeudehoehe)} steht ein Gebäude ohne Höhenangabe; seine Höhe ` +
      'ist hier mit nichts angesetzt und bei der Erkundung aufzunehmen.'
    : '';

  if (urteil === 'unbeurteilbar') {
    return `Für ${luecken} von ${stuetzpunkten(stuetzpunkte)} liegen keine Höhen vor – ` +
      'die Strecke lässt sich aus diesen Daten nicht beurteilen, sie ist bei der ' +
      'Erkundung in Augenschein zu nehmen.' + ausfall;
  }
  if (urteil === 'verdeckt') {
    /* Die Stelle steht in Kilometern, sobald sie welche hat: „8.173 m hinter dem
       ersten Standort“ ist am Kartentisch nicht zu verorten, „8,2 km“ schon. */
    const wo = formatLaenge(engste.d);
    const fehlt = meter(Math.round(engste.fehlbetrag));
    const hoch = meter(Math.ceil(anhebung.beide));
    const { was, fuerwort, woher } = hindernisWorte(engste);
    /* Die Anhebung an nur einem Ende wächst mit dem Hebelarm: liegt die Engstelle
       kurz vor dem Gegenende, kommen rechnerisch dreistellige Masthöhen heraus.
       Die Zahl stimmt und hilft niemandem – oberhalb dessen, was der höchste
       Mast trägt, wird sie deshalb weggelassen statt gerundet. */
    const einzeln = [
      brauchbar(anhebung.nurA) ? `nur am Anfang ${meter(Math.ceil(anhebung.nurA))}` : null,
      brauchbar(anhebung.nurB) ? `nur am Ende ${meter(Math.ceil(anhebung.nurB))}` : null
    ].filter(Boolean).join(', ');
    /* Steht die Höhe auf einer Annahme – angenommene Bestandshöhe über Wald,
       Geschosszahl statt Höhe –, muss das im selben Satz stehen wie die Zahl.
       Sonst wird aus einer Annahme beim Ablesen eine Messung. */
    const annahme = engste.geschaetzt ? ' Die Höhe des Hindernisses ist angenommen, nicht gemessen.' : '';
    return `${was}${woher} verdeckt die Strecke: ${wo} hinter dem ersten Standort ` +
      `steht ${fuerwort} ${fehlt} zu hoch. Frei wird sie erst, wenn beide ` +
      `Antennenmitten ${hoch} höher liegen${einzeln ? ` (${einzeln})` : ''}.` +
      annahme + ausfall + unbekannt;
  }
  const luecke = luecken
    ? ` Für ${luecken} von ${stuetzpunkten(stuetzpunkte)} fehlten dabei die Höhen.`
    : '';
  return 'Kein Hindernis über der Erkennungsschwelle – das ist keine Freigabe: ' +
    'Freileitungen, Masten, einzelne Bäume außerhalb kartierter Waldflächen und ' +
    'jede Bebauung ohne Höhenangabe stehen in diesen Daten nicht, entschieden wird ' +
    `bei der Erkundung.${luecke}${ausfall}${unbekannt}`;
}

const stellen = n => `${n} Stützpunkt${n === 1 ? '' : 'en'}`;
const verbinden = liste => liste.length < 2
  ? (liste[0] || '')
  : `${liste.slice(0, -1).join(', ')} und ${liste[liste.length - 1]}`;

const stuetzpunkten = n => `${n} Stützpunkt${n === 1 ? '' : 'en'}`;

/* Die Masten des THW-Fernmeldedienstes, aufsteigend nach der Höhe, in der die
   Antennenmitte steht. Sie stehen als Tabelle da und nicht als bloße
   Obergrenze, weil die Frage am Kartentisch nicht „geht es noch?“ lautet,
   sondern „womit?“ – zwischen 34 und 40 m liegt der Unterschied zwischen zwei
   Fahrzeugen, und eine nackte Zahl sagt nicht, ob eines davon auf dem Hof
   steht.

   Hier stand vorher, ein Teleskopmast des Fernmeldebaus reiche keine 40 m. Das
   war falsch: den MastKW gibt es mit 34 m und mit 40 m. Wer die Liste
   ergänzt – ein weiterer Masttyp, ein anderer Fahrzeugstand –, ändert damit
   zugleich jede Aussage, die auf sie verweist. */
export const MASTEN = [
  { name: 'MastKW', hoehe: 34, kurz: 'MastKW (34 m)' },
  { name: 'MastKW', hoehe: 40, kurz: 'MastKW (40 m)' }
];

/** Der höchste verfügbare Mast – die Grenze, jenseits derer der Standort zählt. */
export const HOECHSTER_MAST = MASTEN[MASTEN.length - 1];

/** Obergrenze für eine Anhebung, die noch als Vorschlag durchgeht. */
export const MASTHOEHE_GRENZE = HOECHSTER_MAST.hoehe;

/**
 * Der niedrigste Mast, der diese Antennenhöhe noch trägt – `null`, wenn keiner
 * es tut. Die Antwort auf „womit?“, und die einzige Stelle, an der aus einer
 * gerechneten Höhe ein Fahrzeug wird.
 */
export function mastFuer(hoehe) {
  const h = Number(hoehe);
  if (!isFinite(h)) return null;
  return MASTEN.find(m => m.hoehe >= h) || null;
}

/* Was ein Fahrzeugmast ohne eigenes Mastfahrzeug hergibt. Bis hierhin ist die
   Frage nach dem Gerät keine – darüber wird sie zur Fahrzeugfrage, und erst
   dann gehört ein Fahrzeugname in den Satz. */
export const FAHRZEUGMAST = 10;

const brauchbar = m => m !== null && isFinite(m) && m <= MASTHOEHE_GRENZE;

// ---------------------------------------------------------------- Neigung

/**
 * Elevationswinkel beider Antennen in Grad, positiv nach oben.
 * @returns {{grad:[number,number], erheblich:boolean, halbwertsbreite:number,
 *            satz:string}|null}
 *
 * Das ist der Startwert für die Grobausrichtung, nicht das Ergebnis: die
 * Neigung wird am Aufbauplatz nach bestem RX-Pegel eingedreht, und der leere
 * Auftrag sagt das auch so. Gerechnet wird sie trotzdem, weil man mit ihr
 * anfängt – wer bei −8° waagerecht ansetzt, sucht den Pegel dort, wo er nicht
 * ist. Erheblich ist sie erst, wenn sie gegen die Halbwertsbreite der Antenne
 * ins Gewicht fällt; bei einem Viertel davon liegt der Verlust nach
 * 12 · (θ/HPBW)² noch unter 1 dB und verschwindet im Eindrehen.
 */
export function neigung(hoeheA, hoeheB, laenge, halbwertsbreite = HALBWERTSBREITE_STANDARD) {
  const a = zahl(hoeheA), b = zahl(hoeheB), D = zahl(laenge);
  if (a === null || b === null || D === null || D <= 0) return null;

  /* Beide Antennen sehen einander etwas tiefer, als der Höhenunterschied
     hergibt: über die Entfernung fällt die Erdoberfläche unter der
     Waagerechten weg. Der Abzug trifft deshalb beide Seiten gleich und ist
     kein Vorzeichenfehler. */
  const abzug = (D / (2 * ERDRADIUS_WIRKSAM)) * 180 / Math.PI;
  const winkel = [
    Math.atan2(b - a, D) * 180 / Math.PI - abzug,
    Math.atan2(a - b, D) * 180 / Math.PI - abzug
  ];
  const hpbw = Number(halbwertsbreite) > 0 ? Number(halbwertsbreite) : HALBWERTSBREITE_STANDARD;
  const erheblich = Math.max(...winkel.map(Math.abs)) > hpbw / 4;

  return {
    grad: winkel, erheblich, halbwertsbreite: hpbw,
    satz: `Grobausrichtung ${neigungText(winkel[0])} am Anfang, ` +
      `${neigungText(winkel[1])} am Ende. ` + (erheblich
        ? `Bei ${gradText(hpbw)} Halbwertsbreite fällt das ins Gewicht – ` +
          'die Antennen mit dieser Neigung ansetzen und erst dann nach bestem ' +
          'RX-Pegel eindrehen.'
        : `Bei ${gradText(hpbw)} Halbwertsbreite ohne Belang – waagerecht ` +
          'ansetzen und nach bestem RX-Pegel eindrehen.')
  };
}

// ---------------------------------------------------------------- Ausgabe

const nf = (n, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/** „5,1 m“ – Zehntelmeter, weil Masthöhen so gestuft sind */
export function meterText(m, stellen = 1) {
  if (!isFinite(m)) return '–';
  return nf(m, stellen) + ' m';
}

/** „0,6°“ – ohne Vorzeichen, die Richtung sagt neigungText */
export function gradText(g) {
  if (!isFinite(g)) return '–';
  return nf(Math.abs(g), Math.abs(g) < 10 ? 1 : 0) + '°';
}

/** Neigung in Worten: „0,6° nach unten“ – am Mast wird nicht mit Vorzeichen gearbeitet */
export function neigungText(g) {
  if (!isFinite(g)) return '–';
  if (Math.abs(g) < 0.05) return 'waagerecht';
  return `${gradText(g)} nach ${g > 0 ? 'oben' : 'unten'}`;
}

// ---------------------------------------------------------------- Zwischenspeicher

/* Das Geländeurteil kostet einen Kachelabruf und wird deshalb auf Knopfdruck
   geholt, nicht bei jedem Tastendruck. Es liegt hier und nicht in der
   Oberfläche, weil auch der Bauauftrag es braucht: das Blatt soll das Urteil
   drucken, das der Planer gesehen hat, und nicht selbst nachladen.

   Gespeichert wird es NICHT – ein Urteil, das älter ist als die Planung, wäre
   schlimmer als keines. Der Schlüssel trägt deshalb die Endpunkte, das Band und
   beide Antennenmitten: verschiebt jemand einen Aufbauplatz, wechselt das Band
   oder ändert die Masthöhe, ist das alte Urteil nicht mehr gemeint und fällt
   von selbst heraus, ohne dass es jemand löschen müsste. */
const urteile = new Map();

function schluessel(strecke) {
  const p = strecke && strecke.punkte;
  if (!p || p.length < 2) return null;
  const a = p[0], b = p[p.length - 1];
  const v = strecke.richtfunk || {};
  const h = (v.standorte || []).map(o => `${o.hoehe}/${o.antennenhoehe}`).join(',');
  return `${strecke.id}|${a.lat.toFixed(5)},${a.lng.toFixed(5)}` +
    `|${b.lat.toFixed(5)},${b.lng.toFixed(5)}|${v.band}|${h}`;
}

/** Urteil zu dieser Strecke ablegen. */
export function urteilMerken(strecke, urteil) {
  const k = schluessel(strecke);
  if (k) urteile.set(k, urteil);
}

/** Urteil zu dieser Strecke, `undefined` solange keines geholt wurde. */
export function urteilLesen(strecke) {
  const k = schluessel(strecke);
  return k ? urteile.get(k) : undefined;
}
