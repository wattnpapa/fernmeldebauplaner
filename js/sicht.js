// sicht.js – Einfache und erweiterte Ansicht: was die Oberfläche zeigt

/* Drei Helfer aus drei Ortsverbänden haben unabhängig voneinander dasselbe
   gesagt: nicht eine Funktion hat gefehlt, sondern die Übersicht. Am Telefon
   standen 15 Werkzeuge, sieben Reiter und in der Streckenkarte 13 Felder,
   und wer nur eine Trasse einzeichnen und den Bauauftrag mitnehmen wollte,
   ist an der Navigation gescheitert, bevor er den Richtfunk gefunden hat.

   Die Sicht ist deshalb eine reine Anzeigestufe, kein Rollenkonzept: sie
   ändert nichts an der Planung, an den Vorgaben oder am Bauauftrag. Was in
   der einfachen Ansicht angelegt wird, ist ein vollwertiges Projekt mit
   denselben Vorgabewerten, und in der erweiterten Ansicht lässt es sich
   verfeinern. Umgeschaltet wird über `body.sicht-einfach`, wie beim Baumodus
   über `body.baumodus`: die Stilregeln in `css/app.css` nehmen die Elemente
   mit `.nur-erweitert` vom Schirm, `.nur-einfach` steht nur dort. Zwei
   Stufen und nicht drei – „einfach“ und „erweitert“ sind die Worte, die die
   Helfer gewählt haben, und eine dritte Stufe wäre eine Entscheidung mehr.

   Sie liegt im Gerätespeicher und nicht im Projekt: eine geteilte Planung
   darf dem Empfänger nicht die Ansicht des Absenders aufzwingen. */

const KEY_SICHT = 'fbp.sicht.v1';

export const SICHTEN = ['einfach', 'erweitert'];

let sicht = null;

/** Die gemerkte Sicht, oder null, wenn dieses Gerät noch keine gewählt hat. */
export function gemerkteSicht() {
  try {
    const s = localStorage.getItem(KEY_SICHT);
    return SICHTEN.includes(s) ? s : null;
  } catch (e) {
    return null;
  }
}

/**
 * Die Sicht beim Start bestimmen.
 *
 * Wer die Anwendung zum ersten Mal öffnet, landet in der einfachen Ansicht:
 * dort ist etwas fertigzubringen, bevor die Menüs kommen. Wer sie schon
 * benutzt – im Speicher liegen Planungen –, kennt die volle Oberfläche und
 * behält sie; ihm nach einer Aktualisierung die Hälfte der Knöpfe zu nehmen,
 * wäre derselbe Fehler in die andere Richtung. Die Wahl wird sofort
 * gemerkt, damit der Begrüßungsdialog nur einmal kommt.
 */
export function sichtStarten(erststart) {
  sicht = gemerkteSicht() || (erststart ? 'einfach' : 'erweitert');
  merken(sicht);
  anwenden();
  return sicht;
}

export function aktuelleSicht() { return sicht || 'erweitert'; }
export function istEinfach() { return aktuelleSicht() === 'einfach'; }

export function sichtSetzen(neu) {
  if (!SICHTEN.includes(neu) || neu === sicht) return false;
  sicht = neu;
  merken(neu);
  anwenden();
  return true;
}

function merken(s) {
  try { localStorage.setItem(KEY_SICHT, s); }
  catch (e) { /* ein privates Fenster: dann gilt die Wahl für diese Sitzung */ }
}

function anwenden() {
  document.body.classList.toggle('sicht-einfach', sicht === 'einfach');
}
