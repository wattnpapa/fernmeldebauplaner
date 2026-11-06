// flaechen-vorlagen.js – Maße der Flächenvorlagen: Fahrzeuge, Zelt, Container, Aufbauplatz

/* Eigene Datei ohne Leaflet und ohne Store: das Datenmodell (state.js) braucht
   die Maße für neue Einträge und die Migration, die Kartenebene (flaechen.js)
   für die Zeichnung – keine der beiden soll die andere einführen müssen. */

/* Die Maße stammen aus dem Blatt „Erkundungskriterien Aufbauplatz THW-FüSt“:
   Fahrzeug und Anhänger jeweils aufgebaut, also mit Ausschub, Mast und
   Deichsel – das ist der Platz, der auf dem Aufbauplatz freizuhalten ist.
   `laenge` liegt in der Zeichnung senkrecht, `breite` waagerecht; die
   Aufstellungen unten reihen die Teile in der Breite aneinander. */
export const FLAECHENARTEN = [
  { id: 'fuekomkw',    name: 'FüKomKW (Serie 3), aufgebaut',    kurz: 'FüKomKW',          breite: 4.12, laenge: 9.71 },
  { id: 'anh_fuela',   name: 'Anh FüLa (Serie 2/3), aufgebaut', kurz: 'Anh FüLa',         breite: 5.21, laenge: 8.37 },
  /* Das SG 300 hat rund 30 m² Grundfläche; das Blatt nennt 6,00 m Breite.
     Die zweite Kante ist daraus abgeleitet und im Eintrag änderbar. */
  { id: 'zelt_sg300',  name: 'Zelt SG 300 (ca. 30 m²)',          kurz: 'Zelt SG 300',      breite: 6.00, laenge: 5.00 },
  { id: 'aufbauplatz', name: 'Aufbauplatz FüSt (ca. 25 × 15 m)', kurz: 'Aufbauplatz FüSt', breite: 25,   laenge: 15, umriss: true },
  { id: 'frei',        name: 'Freie Fläche (eigene Maße)',       kurz: 'Fläche',           breite: 10,   laenge: 10, umriss: true },

  /* Was um die Führungsstelle herum Platz braucht, aber nicht auf dem
     Erkundungsblatt steht. Container nach ISO 668 (Außenmaß, Breite 8 Fuß),
     die lange Seite wie beim Fahrzeug senkrecht, die Türen unten. */
  { id: 'container_10', name: 'Container 10 Fuß',                kurz: 'Container 10′',    breite: 2.44, laenge: 2.99,  gruppe: 'lager' },
  { id: 'container_20', name: 'Container 20 Fuß',                kurz: 'Container 20′',    breite: 2.44, laenge: 6.06,  gruppe: 'lager' },
  { id: 'container_40', name: 'Container 40 Fuß',                kurz: 'Container 40′',    breite: 2.44, laenge: 12.19, gruppe: 'lager' },
  /* Die gängige Mietkabine steht auf gut einem Quadratmeter; die Tür liegt
     unten, damit beim Drehen zu sehen ist, wohin sie aufgeht. */
  { id: 'toilette',     name: 'Toilettenkabine („Dixi“)',        kurz: 'Dixi',             breite: 1.10, laenge: 1.20,  gruppe: 'lager' },
  /* Der Bauzaun ist als Umzäunung angelegt und nicht als einzelne Reihe: eine
     Reihe hätte nur die Tiefe der Füße und wäre auf der Karte weder zu sehen
     noch zu greifen. Vorgabe sind 7 × 4 Felder zu 3,50 m; wer die Kanten
     ändert, bekommt die Füße im passenden Abstand neu verteilt. */
  { id: 'bauzaun',      name: 'Bauzaun umlaufend (Feld 3,50 m)',  kurz: 'Bauzaun',          breite: 24.5, laenge: 14,    gruppe: 'lager', zaun: true }
];

/* Die freie Fläche fängt alles auf, was diese Fassung nicht kennt – mit
   Kennung gesucht und nicht als letzter Eintrag, sonst verschöbe jede neue
   Art am Ende der Liste den Auffang. */
export const flaechenartById = id =>
  FLAECHENARTEN.find(a => a.id === id) || FLAECHENARTEN.find(a => a.id === 'frei');

/** Feldlänge eines Bauzauns in Metern, nach der Fundamentreihe des Mietzauns. */
export const ZAUNFELD = 3.5;

/* Die beiden Aufstellungen des Erkundungsblatts, mit einem Klick gesetzt.
   `dx` ist der Versatz der Teilmitte in Metern nach rechts, gemessen von der
   Mitte der ganzen Reihe – Fahrzeug, Anhänger und Zelt stehen Kante an Kante
   mit den Lücken des Blatts (0,15 m hinter dem Fahrzeug, 0,20 m zwischen
   gekoppelten Anhängern). Die Teile bleiben eigene Flächen in einem Verbund:
   gemeinsam verschieben und drehen, einzeln lösen, wenn der Platz es verlangt. */
export const AUFSTELLUNGEN = [
  {
    id: 'fuest_1',
    name: 'FüSt: FüKomKW + Anh FüLa + Zelt SG 300',
    masse: '15,48 × 9,71 m',
    teile: [
      { art: 'fuekomkw',   dx: -5.68 },
      { art: 'anh_fuela',  dx: -0.865 },
      { art: 'zelt_sg300', dx: 4.74 }
    ]
  },
  {
    id: 'fuest_2',
    name: 'FüSt: FüKomKW + 2 × Anh FüLa gekoppelt + Zelt SG 300',
    masse: '20,89 × 9,71 m',
    teile: [
      { art: 'fuekomkw',   dx: -8.385 },
      { art: 'anh_fuela',  dx: -3.57 },
      { art: 'anh_fuela',  dx: 1.845 },
      { art: 'zelt_sg300', dx: 7.445 }
    ]
  }
];
