// vorschrift.js – Werte und Regeln aus der KatS-Dv 861 Feldkabelbau, Ausgabe 1990
// (Bundesamt für Zivilschutz). Reines Nachschlagewerk: nur Daten und reine
// Funktionen, keine Karte, kein Zustand, keine Oberfläche.
//
// Die Fundstellen sind die Gliederungsnummern der Vorschrift. Sie gehören überall
// mit in die Ausgabe – am Bauort wird nach der Nummer gesucht, nicht nach dem Satz.

/* Querungen nach KatS-Dv 861, Abschnitt 8. „verbot“ meint das Bauverbot der
   Vorschrift (Überbauen bzw. freies Kreuzen), nicht das Kreuzen an Bauwerken.
   Was stattdessen zulässig bleibt, ist je Art verschieden und steht deshalb
   als „verbotstext“ daneben – ein gemeinsamer Satz verböte bei Starkstrom das
   von 8.3 vorgesehene Unterqueren im Tiefbau. Der Kurztext wird der „regel“
   vorangestellt; die „regel“ trägt deshalb nur, was er nicht schon sagt. */
export const QUERUNGSARTEN = [
  {
    id: 'strasse',
    name: 'Weg / Straße (befestigt)',
    kurz: 'Str',
    mindestmass: 4.5,
    massBezug: 'über der Fahrbahn',
    regel: 'Im rechten Winkel kreuzen, möglichst Brücken, Überführungen, Unterführungen und Durchlässe ausnutzen; Kabel über der Straße durch auffallende Hinweiszeichen kenntlich machen und beiderseits sorgfältig abbinden.',
    genehmigung: null,
    verbot: false,
    fundstelle: '8.1'
  },
  {
    id: 'weg_unbefestigt',
    name: 'Unbefestigter Weg (Tiefbau)',
    kurz: 'Weg',
    mindestmass: null,
    massBezug: null,
    regel: 'Kabelgraben schräg über den Weg und so tief, dass der Fahrzeugverkehr das Feldkabel nicht beschädigt; beidseitig des Weges festlegen, während der Arbeiten Warnposten aufstellen.',
    genehmigung: null,
    verbot: false,
    fundstelle: '8.1'
  },
  {
    id: 'autobahn',
    name: 'Autobahn',
    kurz: 'BAB',
    mindestmass: null,
    massBezug: null,
    regel: 'Das Verbot gilt für jede Bauweise: auch im Tiefbau darf die Autobahn nicht gekreuzt werden.',
    genehmigung: null,
    verbot: true,
    verbotstext: 'Überbauen verboten – nur an Über- oder Unterführung',
    fundstelle: '8.1'
  },
  {
    id: 'gewaesser_schiffbar',
    name: 'Gewässer, schiffbar',
    kurz: 'Gew s',
    mindestmass: null,
    massBezug: 'Durchfahrtshöhe nach Auflage der Verwaltung',
    regel: 'An Brücken, Staustufen oder ähnlichen Bauten überqueren und dafür Umwege in Kauf nehmen; ausnahmsweise Überspannung bis 75 m Breite oder auf dem Grunde verlegtes Feldkabel. Schiffsverkehr nicht behindern, Ankerplätze und Anlegeplätze meiden.',
    genehmigung: 'Wasser- und Schiffahrtsverwaltung',
    verbot: false,
    fundstelle: '8.2'
  },
  {
    id: 'gewaesser',
    name: 'Gewässer, nicht schiffbar',
    kurz: 'Gew',
    mindestmass: null,
    massBezug: 'Höhe und Breite nach Vorgabe des Eigentümers',
    regel: 'Verlegen auf dem Grunde oder Überspannen in der vom Eigentümer vorgeschriebenen Höhe und Breite; auf dem Grund liegendes Kabel beschweren, nur einwandfrei isoliertes Feldkabel verwenden.',
    genehmigung: 'Eigentümer des Gewässers',
    verbot: false,
    fundstelle: '8.2'
  },
  {
    id: 'starkstrom_nieder',
    name: 'Starkstrom-Freileitung bis 1000 V',
    kurz: '≤1 kV',
    mindestmass: 1.5,
    massBezug: 'zu allen Teilen der Anlage',
    regel: 'Im Hochbau darf Feldkabel darunter hindurchgeführt werden; zu allen Teilen der Anlage 1,50 m einhalten. Erkennungsmerkmal Ortsnetz: 4 Leitungen (3 Leiter, 1 Nulleiter) auf Holz- oder Stahlbetonmasten oder Dachständern.',
    genehmigung: null,
    verbot: false,
    fundstelle: '8.3'
  },
  {
    id: 'starkstrom_hoch',
    name: 'Starkstrom-Freileitung über 1 kV',
    kurz: '>1 kV',
    mindestmass: null,
    massBezug: 'Schutzabstand nach Nennspannung, siehe Fußnote',
    regel: 'Möglichst an Straßenüber- oder -unterführungen sowie Durchlässen kreuzen, sonst unterqueren. Im erweiterten Schutzabstand vor und hinter der Leitung ist das Feldkabel einzugraben und mit Ringübertragern abzuschließen.',
    genehmigung: null,
    verbot: true,
    verbotstext: 'Überbauen verboten – nur Tiefbau im rechten Winkel oder Über-/Unterführung',
    fundstelle: '8.3'
  },
  {
    id: 'fahrleitung',
    name: 'Straßenbahn- / O-Bus-Fahrleitung',
    kurz: 'Fahrl',
    mindestmass: 2.0,
    massBezug: 'über der Fahrleitung',
    regel: 'Grundsätzlich als Anlage über 1 kV zu betrachten; an Über- und Unterführungen sowie Durchlässen kreuzen. Überbau nur mit Genehmigung des Betriebsleiters, Anlage freigeschaltet, gegen Wiedereinschalten gesichert, geerdet und kurzgeschlossen. Isolierende Unterlagen benutzen, nur trockenes Ankerseil über die Fahrleitung werfen, Schutzschalter besetzen.',
    genehmigung: 'Betriebsleiter der Anlage',
    verbot: false,
    fundstelle: '8.4'
  },
  {
    id: 'bahn',
    name: 'Eisenbahn ohne Oberleitung',
    kurz: 'Bahn',
    mindestmass: 6.0,
    massBezug: 'zwischen Schienenoberkante und Kabel',
    regel: 'An Über- und Unterführungen oder Durchlässen kreuzen. Nur ausnahmsweise überspannen oder im Tiefbau unter den Schienen kreuzen; rechtwinklig, beidseitig abbinden, vor oder hinter der Kreuzung eine Längenverbindung herstellen. Warnposten mit akustischen und optischen Warnmitteln – rote und grüne Lichtsignale sind verboten.',
    genehmigung: 'zuständige Bahndienststelle',
    verbot: false,
    fundstelle: '8.5'
  },
  {
    id: 'bahn_oberleitung',
    name: 'Eisenbahn mit Oberleitung',
    kurz: 'Bahn OL',
    mindestmass: null,
    massBezug: null,
    regel: 'Auch das Unterqueren ist nur an Brücken und Unterführungen zulässig.',
    genehmigung: 'zuständige Bahndienststelle',
    verbot: true,
    verbotstext: 'Überbauen verboten – nur an Brücke oder Unterführung',
    fundstelle: '8.5'
  },
  {
    id: 'fernsprech',
    name: 'Fernsprech-Freileitung',
    kurz: 'Fspr',
    mindestmass: 0.5,
    massBezug: 'Abstand zur nächstgelegenen Freileitung',
    regel: 'Darf im Hoch- oder Tiefbau gekreuzt werden; bei Über- oder Unterquerung mindestens 50 cm Abstand einhalten. Bestimmungen über die Mitbenutzung fremder Fernmeldegestänge beachten.',
    genehmigung: null,
    verbot: false,
    fundstelle: '8.6'
  },
  {
    id: 'sonstige',
    name: 'Sonstige Querung',
    kurz: 'Q',
    mindestmass: null,
    massBezug: null,
    regel: 'Auflage vor Ort festlegen und im Bauauftrag vermerken.',
    genehmigung: null,
    verbot: false,
    fundstelle: '8'
  }
];

export const QUERUNG_STANDARD = 'sonstige';

/* Bauweise am Hindernis. Die Vorschrift lässt eine Straße überbauen (Kabel
   auf Baustangen, 4,50 m über der Fahrbahn), im Graben unterqueren oder an
   Brücke und Durchlass entlangführen (8.1). Für die Trasse ist das ein Wechsel
   der Bauart: ein Tiefbau-Trupp stellt für den Überbau Stangen, ein Hochbau-
   Trupp gräbt für den Unterbau. Das kostet Zeit, die die Verlegeleistung nicht
   kennt – deshalb trägt jede Bauweise einen Zeitansatz in Minuten. Die
   Minuten sind Erfahrungswerte des Feldkabelbaus, keine Zahlen der
   Vorschrift, und lassen sich am Punkt überschreiben. */
export const QUERUNG_BAUWEISEN = [
  { id: 'trasse',   name: 'Wie die Trasse',           kurz: '',  bauart: null,   minuten: 10 },
  { id: 'ueberbau', name: 'Überbau (Hochbau)',        kurz: 'Ü', bauart: 'hoch', minuten: 45 },
  { id: 'unterbau', name: 'Unterbau (Tiefbau)',       kurz: 'U', bauart: 'tief', minuten: 60 },
  { id: 'bauwerk',  name: 'An Brücke / Unterführung', kurz: 'B', bauart: null,   minuten: 20 }
];

export const BAUWEISE_STANDARD = 'trasse';

/** Bauweise zu einer Kennung; unbekannte Kennungen gelten als „wie die Trasse“. */
export const bauweiseById = id =>
  QUERUNG_BAUWEISEN.find(b => b.id === id) ||
  QUERUNG_BAUWEISEN.find(b => b.id === BAUWEISE_STANDARD);

/** Zeitansatz einer Querung in Minuten: der Wert am Punkt, sonst der der Bauweise. */
export function querungsMinuten(pt) {
  const eigen = Number(pt.querungszeit);
  if (pt.querungszeit !== null && pt.querungszeit !== '' && isFinite(eigen) && eigen >= 0) return eigen;
  return bauweiseById(pt.bauweise).minuten;
}

/** Querungsart zu einer Kennung; unbekannte Kennungen fallen auf „Sonstige“ zurück. */
export const querungsartById = id =>
  QUERUNGSARTEN.find(q => q.id === id) ||
  QUERUNGSARTEN.find(q => q.id === QUERUNG_STANDARD);

// ------------------------------------------------- Starkstrom (KatS-Dv 861, 8.3)

/** Schutzabstand nach Nennspannung – Stufen der Vorschrift, nicht interpoliert */
export const SCHUTZABSTAENDE = [
  { kv: 1,   meter: 1 },
  { kv: 110, meter: 3 },
  { kv: 220, meter: 4 },
  { kv: 380, meter: 5 }
];

/* Erweiterter Schutzabstand = Höhe des Strommastes + Höhe der Baustange +
   Schutzabstand. Unabhängig vom errechneten Wert sind mindestens 20 m einzuhalten,
   bei Sturm oder hügeligem Gelände mindestens 50 m (KatS-Dv 861, 8.3). */
export const SCHUTZABSTAND_ERWEITERT_MIN = 20;
export const SCHUTZABSTAND_ERWEITERT_STURM = 50;

// ------------------------------------------------ Sprechreichweite (Kap. 3.2)

export const SPRECHREICHWEITE = {
  tief: { min: 10000, max: 15000, bauart: 'Tiefbau', fundstelle: '3.2.1' },
  hoch: { min: 25000, max: 40000, bauart: 'Hochbau', fundstelle: '3.2.2' }
};

/** Reichweitenangaben der Vorschrift gelten nur für Feldkabel */
export const REICHWEITE_KABEL = ['fk2', 'ffk'];

/* Beim gemischten Bau wird der Tiefbau angesetzt – das ist die sichere Seite,
   weil der Erdschluss der tief verlegten Abschnitte die Reichweite bestimmt. */
export const BAUART_JE_VERLEGEART = { boden: 'tief', erd: 'tief', ober: 'hoch', gem: 'tief' };

/**
 * Sprechreichweite einer Strecke nach Bauart.
 * @param {string} kabeltypId   Kennung des Kabeltyps
 * @param {string} verlegeartId Kennung der Verlegeart
 * @param {number} laengeMeter  Kabellänge in Metern
 * @returns {object|null} null, wenn die Vorschrift für diesen Kabeltyp nichts hergibt
 */
export function reichweite(kabeltypId, verlegeartId, laengeMeter, unterbau = false) {
  const l = Number(laengeMeter);
  if (!REICHWEITE_KABEL.includes(kabeltypId) || !isFinite(l) || l <= 0) return null;

  /* Eine oberirdische Strecke mit einem Unterbau an der Querung liegt dort im
     Boden – für die Reichweite ist sie damit gemischter Bau, und der zählt als
     Tiefbau. Ein Überbau in einer Tiefbaustrecke ändert dagegen nichts. */
  const gemischt = verlegeartId === 'gem' || (unterbau && BAUART_JE_VERLEGEART[verlegeartId] === 'hoch');
  const r = SPRECHREICHWEITE[gemischt ? 'tief' : (BAUART_JE_VERLEGEART[verlegeartId] || 'tief')];
  return {
    bauart: r.bauart,
    min: r.min,
    max: r.max,
    laenge: l,
    stufe: l <= r.min ? 'ok' : (l <= r.max ? 'grenze' : 'darueber'),
    fundstelle: r.fundstelle,
    gemischt
  };
}

// ------------------------------------------------------- Feldkabel (Kap. 4)

/* Anhaltswerte einer Länge Feldkabel: etwa 850 m auf der Trommel, mit Trommel
   etwa 14 kg, Schleifen-Gleichstromwiderstand etwa 100 Ω, Aderdurchmesser
   2,1 mm, Bruchlast etwa 40 kp/mm². Maßgebend bleibt die an der Strecke
   eingetragene Trommellänge – die Vorschriftswerte sind nur der Vergleich. */
export const FELDKABEL = {
  laenge: 850,
  gewicht: 14,
  schleifenwiderstand: 100,
  aderdurchmesser: 2.1,
  bruchlast: 40
};

// ------------------------------------------------------------- Bauregeln

/** Merksätze für den Bauauftrag – jeweils mit Fundstelle, damit sie nachprüfbar bleiben */
export const BAUREGELN = [
  { text: 'Kabel mindestens alle 50 m auflegen und längstens alle 150 m abbinden.', fundstelle: '7.3' },
  { text: 'An Anfangs- und Endstellen 20 bis 30 m Kabelreserve belassen; Kabel auf der Trommel gilt als Reserve und wird nicht abgeschnitten.', fundstelle: '6.5.1' },
  { text: 'Baumeldung nach jeder Länge, spätestens alle 30 Minuten; dabei das Kabel überprüfen.', fundstelle: '7.1' },
  { text: 'Warnposten mindestens 30 bis 50 m vor dem Überweg in beiden Fahrtrichtungen aufstellen.', fundstelle: '8.1' },
  { text: 'Bei Gewitter Bau unterbrechen, Feldkabeltrommel ablegen und mindestens 30 m Abstand halten.', fundstelle: '13.2.2' }
];

/* Der Vorgabewert einer Kabelreserve. Die Vorschrift nennt 20 bis 30 m, meint
   damit aber die Anfangs- und die Endstelle; eine Reserve mitten auf der Trasse
   – an der Muffe, vor der Querung, am Verteiler – wird kürzer angesetzt. 10 m
   ist der Wert, mit dem ein neuer Reservepunkt anfängt: wer die volle Reserve
   der Endstelle meint, trägt sie am Punkt ein. */
export const KABELRESERVE_STANDARD = 10;

/** Kabelreserve eines Punktes in Metern: der Wert am Punkt, sonst der Vorgabewert.
 *  Nur die Punktart „Kabelreserve“ bringt Länge mit – an jeder anderen liegt der
 *  Wert zwar am Punkt, wartet dort aber auf einen Wechsel der Art zurück. */
export function kabelreserve(pt) {
  if (!pt || pt.art !== 'reserve') return 0;
  const eigen = Number(pt.reserve);
  if (pt.reserve !== null && pt.reserve !== '' && isFinite(eigen) && eigen >= 0) return eigen;
  return KABELRESERVE_STANDARD;
}

/** Auflagen und Abbunde einer Strecke (KatS-Dv 861, 7.3) */
export function abbindeBedarf(laengeMeter) {
  const l = Number(laengeMeter);
  if (!isFinite(l) || l <= 0) return { auflagen: 0, abbunde: 0 };
  return { auflagen: Math.ceil(l / 50), abbunde: Math.ceil(l / 150) };
}

// ------------------------------------------------------ Kopfangaben, Ausgabe

export const VS_GRADE = [
  ['', 'ohne Einstufung'],
  ['VS – NUR FÜR DEN DIENSTGEBRAUCH', 'VS – NUR FÜR DEN DIENSTGEBRAUCH'],
  ['VS – VERTRAULICH', 'VS – VERTRAULICH']
];

const MONATSKUERZEL = ['jan', 'feb', 'mrz', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'];

const zwei = n => String(n).padStart(2, '0');

/** Datum-Zeit-Gruppe im Muster der Anlage 7, Ortszeit: „301430aug26“ */
export function dtg(datum = new Date()) {
  return zwei(datum.getDate()) + zwei(datum.getHours()) + zwei(datum.getMinutes()) +
    MONATSKUERZEL[datum.getMonth()] + zwei(datum.getFullYear() % 100);
}

/**
 * Mindestmaß einer Querungsart als Kurztext: „4,50 m über der Fahrbahn“.
 * Ohne Zahlenmaß bleibt der Bezugstext stehen, sonst „–“ – so steht auch bei
 * Gewässern und Hochspannung im Ausdruck, woran das Maß hängt.
 */
export function massText(art) {
  const mass = art ? art.mindestmass : null;
  const bezug = (art && art.massBezug) || '';
  if (typeof mass !== 'number' || !isFinite(mass) || mass <= 0) return bezug || '–';

  const stellen = mass % 1 ? 2 : 0;
  const zahl = mass.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  return bezug ? zahl + ' m ' + bezug : zahl + ' m';
}

/** Nächstgrößere Schutzabstands-Stufe zu einer Nennspannung in kV */
export function schutzabstandText(kv) {
  const n = Number(kv);
  if (!isFinite(n) || n <= 0) return null;
  return SCHUTZABSTAENDE.find(s => s.kv >= n) || null;
}
