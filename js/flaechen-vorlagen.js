// flaechen-vorlagen.js – Maße der Flächenvorlagen: Fahrzeuge, Anhänger, Zelt, Aufbauplatz

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
  { id: 'frei',        name: 'Freie Fläche (eigene Maße)',       kurz: 'Fläche',           breite: 10,   laenge: 10, umriss: true }
];

export const flaechenartById = id =>
  FLAECHENARTEN.find(a => a.id === id) || FLAECHENARTEN[FLAECHENARTEN.length - 1];

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
