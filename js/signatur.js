// signatur.js – Woran eine Kartenebene erkennt, dass sie neu zeichnen muss

/* Jede Änderung an der Planung meldet der Speicher an alle Ebenen, und jede
   baute daraufhin ihre Marker vollständig neu – auch die, die von der
   Änderung gar nichts hatte. Bei zwanzig Strecken und sechzig Lichtbildern
   sind das 850 Marker je Tastendruck, und schon die Beschriftung eines Bildes
   ließ die Karte stocken. Das Gitter hält es von Anfang an anders
   (`_signatur` in gitter.js): es merkt sich, woraus es zuletzt gezeichnet hat,
   und zeichnet nur, wenn sich daran etwas geändert hat. Hier steht das Muster
   für alle Ebenen.

   Verglichen wird der Inhalt UND die Identität der Objekte. Der Inhalt allein
   reichte nicht: die Marker halten in ihren Ereignishorchern die Objekte der
   Planung fest – der Griff an einem Trassenpunkt schreibt in `pt` –, und
   Rückgängig, Wiederherstellen und das Laden einer Planung ersetzen diese
   Objekte durch gleich aussehende neue. Bliebe die Ebene dann stehen, schriebe
   der nächste Griff in ein Objekt, das in keiner Planung mehr liegt, und die
   Änderung wäre still verloren. Dasselbe droht, wo ein Teil der Planung durch
   eine Abschrift ersetzt wird (`einspielen` in baumeldung.js setzt `s.bau`
   neu). Eine Kennung je Objekt fängt beides: die Abschrift ist ein anderes
   Objekt und bekommt eine andere. */

const kennungen = new WeakMap();
let naechste = 0;

/** Eine Zahl je Objekt, die es behält, solange es lebt – eine Abschrift bekommt eine neue. */
function identitaet(o) {
  if (o === null || typeof o !== 'object') return 0;
  let k = kennungen.get(o);
  if (k === undefined) { k = ++naechste; kennungen.set(o, k); }
  return k;
}

/**
 * Signatur eines Zeichenlaufs.
 *
 * `inhalt` ist alles, was in die Zeichnung eingeht – Planungsdaten, Optionen,
 * Auswahl, Zoomstufe – und wird als JSON verglichen. `objekte` sind die
 * Objekte der Planung, die die Marker in ihren Horchern festhalten; sie gehen
 * mit ihrer Identität ein. Zwei Läufe mit gleicher Signatur ergäben dieselbe
 * Zeichnung mit denselben Horchern – dann bleibt die stehende.
 *
 * Was NICHT in die Signatur eingeht, darf die Zeichnung auch nicht verändern:
 * wer einer Ebene eine neue Eingabe gibt, trägt sie in deren Signatur ein,
 * sonst bleibt die Karte bei genau dieser Änderung alt.
 */
export function signatur(inhalt, objekte = []) {
  let s = JSON.stringify(inhalt) + '|';
  for (const o of objekte) s += identitaet(o) + ',';
  return s;
}
