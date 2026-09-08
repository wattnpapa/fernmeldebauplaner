// vorschrift.js – Werte und Regeln des Feldkabelbaus. Reines Nachschlagewerk:
// nur Daten und reine Funktionen, keine Karte, kein Zustand, keine Oberfläche.
//
// Zwei Stände stehen nebeneinander: die KatS-Dv 861 von 1990 und das
// THW-Ausbildungshandbuch Kabelbau von 2026. Das Handbuch hebt die alte
// Vorschrift nicht förmlich auf, ist aber die neuere Auskunft – wo beide
// dieselbe Sache regeln, steht hier der Handbuchstand, wo nur die KatS-Dv 861
// etwas beziffert (Abbindeabstände, Kabelreserve, Sprechreichweite), bleibt sie.
//
// Die Fundstellen gehören überall mit in die Ausgabe – am Bauort wird nach der
// Nummer gesucht, nicht nach dem Satz. Seit es zwei Quellen sind, muss die
// Fundstelle auch sagen, in welchem Heft die Nummer steht: `quelle` wählt das
// Kürzel, `fundstelleText()` setzt beides zusammen.

export const QUELLEN = {
  kats: {
    kurz: 'KatS-Dv 861',
    lang: 'KatS-Dv 861 Feldkabelbau, Ausgabe 1990 (Bundesamt für Zivilschutz)'
  },
  hdb: {
    kurz: 'Hdb Kabelbau',
    lang: 'Ausbildungshandbuch „Übertragung/Transport von Daten – Kabelbau“, ' +
          'THW Aus- und Fortbildungszentrum, Version 1.0, Stand 07/26'
  },
  meb: {
    kurz: 'Meb Sicherheit',
    lang: 'Merkblatt „Sicherheitsbestimmungen bei Kabelbau (IuK-Netze)“, ' +
          'THW Aus- und Fortbildungszentrum, Version 1.0, Stand 07/26'
  }
};

export const QUELLE_STANDARD = 'kats';

/** Vollständige Fundstelle eines Datums: „Hdb Kabelbau, 4.2“. */
export function fundstelleText(o) {
  if (!o || !o.fundstelle) return '';
  return (QUELLEN[o.quelle] || QUELLEN[QUELLE_STANDARD]).kurz + ', ' + o.fundstelle;
}

/* Querungen. „verbot“ meint das Bauverbot der Vorschrift (Überbauen bzw.
   freies Kreuzen), nicht das Kreuzen an Bauwerken. Was stattdessen zulässig
   bleibt, ist je Art verschieden und steht deshalb als „verbotstext“ daneben –
   ein gemeinsamer Satz verböte bei Starkstrom das im Tiefbau vorgesehene
   Unterqueren. Der Kurztext wird der „regel“ vorangestellt; die „regel“ trägt
   deshalb nur, was er nicht schon sagt.

   Wo das Handbuch von 2026 dieselbe Querung regelt, steht sein Stand: bei
   Straße, unbefestigtem Weg, Starkstrom und Bahn. Gewässer, Fahrleitung und
   Fernsprechfreileitung beziffert nur die KatS-Dv 861 – das Handbuch behandelt
   sie unter dem Gesichtspunkt der Eigensicherung, nicht der Bauweise. */
export const QUERUNGSARTEN = [
  {
    id: 'strasse',
    name: 'Weg / Straße (befestigt)',
    kurz: 'Str',
    mindestmass: 4.5,
    massBezug: 'über der Fahrbahn',
    regel: 'Verkehrswege im rechten Winkel kreuzen, möglichst Brücken, Überführungen, Unterführungen und Durchlässe ausnutzen; Fahrbahn nur in Verkehrslücken betreten. Überweg verkehrssicher und fest verankern, mit Folienabsperrband rot/weiß kennzeichnen und beiderseits sorgfältig abbinden; im Hochbau auf Abstand zum Fahrbahnrand achten, damit umfallende Baustangen nicht in die Fahrbahn geraten.',
    genehmigung: null,
    verbot: false,
    quelle: 'hdb',
    fundstelle: '4.1'
  },
  {
    id: 'weg_unbefestigt',
    name: 'Unbefestigter Weg (Tiefbau)',
    kurz: 'Weg',
    mindestmass: null,
    massBezug: null,
    regel: 'Beim Kreuzen unbefestigter Wege und Fahrbahnen einschließlich der Randstreifen das Kabel eingraben oder mit Kabelkanälen schützen; beidseitig mit Ankerpfählen festlegen, so dass keine Zugbelastung auf das Kabel kommt. Ist ein Eingraben nicht möglich, Kabelbrücken verwenden – nicht auf vielbefahrenen Straßen.',
    genehmigung: null,
    verbot: false,
    quelle: 'hdb',
    fundstelle: '2.3.1'
  },
  {
    id: 'autobahn',
    name: 'Autobahn',
    kurz: 'BAB',
    mindestmass: null,
    massBezug: null,
    regel: 'Das Verbot gilt für jede Bauweise: auch im Tiefbau darf die Autobahn nicht gekreuzt werden. Typische Verkehrsadern sind ohnehin zu meiden.',
    genehmigung: null,
    verbot: true,
    verbotstext: 'Überbauen verboten – nur an Über- oder Unterführung',
    quelle: 'kats',
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
    quelle: 'kats',
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
    quelle: 'kats',
    fundstelle: '8.2'
  },
  {
    id: 'starkstrom_nieder',
    name: 'Starkstrom-Freileitung bis 1000 V',
    kurz: '≤1 kV',
    mindestmass: 1.5,
    massBezug: 'zu allen Teilen der Anlage',
    regel: 'Im Hochbau darf das Kabel darunter hindurchgeführt werden; zu allen Teilen der Anlage 1,50 m einhalten. Erkennungsmerkmal Ortsnetz: Holz-, Beton- oder Stahlrohrmasten und Dachständer. Kein Nachtbau in der Nähe von Energieanlagen.',
    genehmigung: null,
    verbot: false,
    quelle: 'hdb',
    fundstelle: '4.2'
  },
  {
    id: 'starkstrom_hoch',
    name: 'Starkstrom-Freileitung über 1 kV',
    kurz: '>1 kV',
    mindestmass: null,
    massBezug: 'Mindestabstände nach Nennspannung, siehe Fußnote',
    regel: 'Im Tiefbau im rechten Winkel unterqueren oder an Straßenüber- und -unterführungen sowie Durchlässen kreuzen. Zu Hochspannungsmasten 20 m, zu Umspannwerken 300 m ab der Umzäunung einhalten. Über 100 kV zusätzlich beidseits der Querung 50 m Mindestabstand und je ein eigens geerdeter Überspannungsschutz an der Längenverbindung vor und hinter der Kreuzung.',
    genehmigung: null,
    verbot: true,
    verbotstext: 'Überbauen verboten – nur Tiefbau im rechten Winkel oder Über-/Unterführung',
    quelle: 'hdb',
    fundstelle: '4.2'
  },
  {
    id: 'fahrleitung',
    name: 'Straßenbahn- / O-Bus-Fahrleitung',
    kurz: 'Fahrl',
    mindestmass: 2.0,
    massBezug: 'über der Fahrleitung',
    regel: 'Grundsätzlich als Anlage über 1 kV zu behandeln; an Über- und Unterführungen sowie Durchlässen kreuzen. Überbau nur mit Genehmigung des Betriebsleiters, Anlage freigeschaltet, gegen Wiedereinschalten gesichert, geerdet und kurzgeschlossen. Isolierende Unterlagen benutzen, nur trockenes Ankerseil über die Fahrleitung werfen, Schutzschalter besetzen.',
    genehmigung: 'Betriebsleiter der Anlage',
    verbot: false,
    quelle: 'kats',
    fundstelle: '8.4'
  },
  {
    id: 'bahn',
    name: 'Eisenbahn ohne Oberleitung',
    kurz: 'Bahn',
    mindestmass: null,
    massBezug: null,
    /* Die KatS-Dv 861 ließ eine Bahn ohne Oberleitung ausnahmsweise überspannen
       oder unter den Schienen kreuzen (8.5). Handbuch und Merkblatt lassen das
       Kreuzen mit Kabel nur noch an Brücken und Unterführungen zu, und zwar
       ohne nach der Oberleitung zu unterscheiden – deshalb steht hier jetzt
       dasselbe Verbot wie bei der Strecke mit Oberleitung. */
    regel: 'Nicht im Gleisbett aufhalten und nicht entlang der Bahnstrecke im Gleisbett bauen. Den Bahnkörper nur mit Erlaubnis des zuständigen Bahnpersonals und ohne Kabelführung überqueren; dessen Anweisungen sind strengstens einzuhalten.',
    genehmigung: 'zuständige Bahndienststelle',
    verbot: true,
    verbotstext: 'Überbauen verboten – nur an Brücke oder Unterführung',
    quelle: 'hdb',
    fundstelle: '4.1'
  },
  {
    id: 'bahn_oberleitung',
    name: 'Eisenbahn mit Oberleitung',
    kurz: 'Bahn OL',
    mindestmass: null,
    massBezug: null,
    regel: 'Zusätzlich als Anlage über 1 kV zu behandeln: auch das Unterqueren ist nur an Brücken und Unterführungen zulässig. Vor Unterführungen ist die Höhe der Fahrleitung angeschrieben – sie ist zu beachten.',
    genehmigung: 'zuständige Bahndienststelle',
    verbot: true,
    verbotstext: 'Überbauen verboten – nur an Brücke oder Unterführung',
    quelle: 'hdb',
    fundstelle: '4.1'
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
    quelle: 'kats',
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
    quelle: 'kats',
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

// ------------------------------------- Mindestabstände Starkstrom (Hdb, 4.2)

/* Das Handbuch beziffert die Abstände nicht mehr über eine kV-Staffel, sondern
   über den Gegenstand: Mast, Umspannwerk, Querung einer Höchstspannungsleitung.
   Die Staffel darüber bleibt trotzdem stehen – sie ist die einzige Auskunft
   darüber, wie sich der erweiterte Schutzabstand errechnet. */
export const MINDESTABSTAND_MAST = 20;
export const MINDESTABSTAND_UMSPANNWERK = 300;

/** Ab dieser Nennspannung gelten die verschärften Auflagen der Querung. */
export const HOECHSTSPANNUNG_KV = 100;
export const QUERUNG_HOECHSTSPANNUNG_BEIDSEITIG = 50;

/* Parallelführung: was einzuhalten ist, wenn sich das Bauen neben der Leitung
   nicht vermeiden lässt. `bis` ist die obere Grenze der Stufe in kV. */
export const PARALLELABSTAENDE = [
  { bis: 1, meter: 20,
    zusatz: 'beim Bau entlang von Straßen die gegenüberliegende Straßenseite nutzen' },
  { bis: 100, meter: 50,
    zusatz: 'gilt ebenso beim Bau entlang von Straßenbahnen' },
  { bis: Infinity, meter: 200, zusatz: null }
];

/** Mindestabstand einer Parallelführung zu einer Nennspannung in kV. */
export function parallelabstand(kv) {
  const n = Number(kv);
  if (!isFinite(n) || n <= 0) return null;
  return PARALLELABSTAENDE.find(a => n <= a.bis) || null;
}

/* Länge einer Parallelführung, ab der der Überspannungsschutz nicht mehr an der
   Längenverbindung vor und hinter der Führung sitzt, sondern an deren Enden.
   Beides gilt über 100 kV und beim Bau entlang von Straßenbahnen bis 500 m
   Abstand; darüber hinaus entfällt der Überspannungsschutz. */
export const PARALLELFUEHRUNG_LANG = 5000;
export const PARALLELFUEHRUNG_BAHN_ABSTAND = 500;

// ------------------------------------------------ Sprechreichweite (Kap. 3.2)

export const SPRECHREICHWEITE = {
  tief: { min: 10000, max: 15000, bauart: 'Tiefbau', quelle: 'kats', fundstelle: '3.2.1' },
  hoch: { min: 25000, max: 40000, bauart: 'Hochbau', quelle: 'kats', fundstelle: '3.2.2' }
};

/* Das Handbuch nennt für das Feldkabel eine Reichweite von etwa 30 km im
   OB-Betrieb und unterscheidet dabei nicht nach Bauart. Maßgebend bleiben die
   Spannen darüber – sie sind die feinere Auskunft, weil der Erdschluss des
   Tiefbaus die Reichweite drückt. Der Handbuchwert steht daneben, damit im
   Bauauftrag nachvollziehbar ist, woran die Spanne gemessen wird. */
export const REICHWEITE_OB = { meter: 30000, quelle: 'hdb', fundstelle: '3.1.1' };

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
    quelle: r.quelle,
    fundstelle: r.fundstelle,
    gemischt
  };
}

// ------------------------------------------------------- Feldkabel (Kap. 4)

/* Anhaltswerte einer Länge Feldkabel: etwa 800 m auf der Trommel, mit Trommel
   etwa 14 kg, Schleifen-Gleichstromwiderstand etwa 100 Ω (Hdb, Tabelle 1),
   Aderdurchmesser 2,1 mm, Bruchlast etwa 40 kp/mm² (KatS-Dv 861). Die alte
   Vorschrift nannte 850 m; das Handbuch und der Pflegezettel der Anlage 3
   rechnen mit 800 m, und danach wird der Schleifenwiderstand beurteilt.
   Maßgebend bleibt die an der Strecke eingetragene Trommellänge – die
   Vorschriftswerte sind nur der Vergleich. */
export const FELDKABEL = {
  laenge: 800,
  gewicht: 14,
  schleifenwiderstand: 100,
  aderdurchmesser: 2.1,
  bruchlast: 40
};

// ------------------------------------------------------------- Bauregeln

/* Merksätze für den Bauauftrag, in der Reihenfolge des Bauens: prüfen,
   verlegen, sichern, melden, kontrollieren. Jeder trägt seine Fundstelle, damit
   er am Bauort nachzuschlagen ist. `nurBeiQuerung` steht an den Sätzen, die
   ohne Querung auf der Strecke keinen Anlass hätten. */
export const BAUREGELN = [
  { text: 'Kabel vor dem Verlegen Länge für Länge durchmessen; defekte Längen beschriften und beiseitelegen.',
    quelle: 'hdb', fundstelle: '2.2.2' },
  { text: 'Kabel mindestens alle 50 m auflegen und längstens alle 150 m abbinden.',
    quelle: 'kats', fundstelle: '7.3' },
  { text: 'Im Tiefbau höchstens 20 m zwischen zwei Festlegepunkten; bei Richtungsänderung und Querung grundsätzlich festlegen.',
    quelle: 'hdb', fundstelle: '2.3.1' },
  { text: 'An Anfangs- und Endstellen 20 bis 30 m Kabelreserve belassen; Kabel auf der Trommel gilt als Reserve und wird nicht abgeschnitten.',
    quelle: 'kats', fundstelle: '6.5.1' },
  { text: 'Jede im Freien gebaute Strecke über 40 m mit Blitzschutzeinrichtung versehen; Überspannungsableiter nur am ersten und letzten Punkt der Strecke belassen.',
    quelle: 'hdb', fundstelle: '2.2.3.2' },
  { text: 'Überwege mindestens 4,50 m hoch bauen, mit Folienabsperrband rot/weiß kennzeichnen und im Tiefbau beidseits mit Ankerpfählen festlegen.',
    quelle: 'hdb', fundstelle: '4.1', nurBeiQuerung: true },
  { text: 'Einsatzstelle mit dreiseitigen Warnschildern und Leitkegeln mit Warnblitzleuchte absichern: 100 m innerhalb, 200 m außerhalb geschlossener Ortschaften vor Anfang und Ende des Bauabschnitts, hinter Kurve oder Kuppe 200 m davor. Nach jeder verbauten Länge nachziehen.',
    quelle: 'meb', fundstelle: 'Absicherung' },
  { text: 'Baumeldung nach jeder Länge, spätestens alle 30 Minuten; dabei das Kabel überprüfen.',
    quelle: 'kats', fundstelle: '7.1' },
  { text: 'Strecke je nach Witterung morgens und abends kontrollieren, bei Sturm häufiger: Durchhang, Spannung, Beschädigung, Absicherung.',
    quelle: 'hdb', fundstelle: '2.2.3.6' },
  { text: 'Bei Gewitter Bau unterbrechen, Feldkabeltrommel ablegen und mindestens 30 m Abstand halten.',
    quelle: 'kats', fundstelle: '13.2.2' },
  { text: 'Berührt ein Kabel eine Starkstrom-Freileitung: Betrieb sofort an allen Endstellen einstellen, nicht erneut berühren, EVU verständigen, mindestens 30 m weiträumig absperren.',
    quelle: 'hdb', fundstelle: '4.2' },
  { text: 'An Gewässern Rettungsweste anlegen; Wathosen nur bis 1,10 m Wassertiefe im stehenden und 0,40 m im fließenden Gewässer.',
    quelle: 'hdb', fundstelle: '4.3' }
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
