// baudoku.js – Was gebaut wurde: Ist-Trasse, Bauabschnitte, Abweichung

/* Das Gegenstück zu `strecken.js`: dort wird gerechnet, was gebaut werden soll,
   hier, was gebaut wurde. Beides liegt nebeneinander an derselben Strecke – der
   Soll-Verlauf in `strecke.punkte`, die Ausführung in `strecke.bau`.

   Die Abweichung ist der eigentliche Ertrag dieser Ebene. Der Truppführer muss
   zwingende Abweichungen vom Auftrag melden (Hdb Feldfernkabelbau, 1.3.2), und der
   Planer braucht sie, wenn er den nächsten Auftrag auf dieselbe Trasse legt.
   Sie ist deshalb keine Nebenrechnung, sondern der Grund, warum das Ist neben
   dem Soll steht und nicht an seiner Stelle.

   Gerechnet wird hier und nicht in der Oberfläche, weil dieselben Zahlen an
   drei Stellen gebraucht werden: in der Liste am Bauort, auf der Karte und –
   ab Stufe 5 – auf dem gedruckten Blatt. */

import {
  store, neuerBau, neuerBauabschnitt, neuerIstPunkt, baustandById, istquelleById,
  bauBegonnen
} from './state.js';
import { distanz, streckenlaenge } from './geo.js';

export { bauBegonnen };

/* Ab welcher Entfernung zwischen geplantem und gebautem Punkt von einer
   Abweichung die Rede ist. Darunter liegt die Streuung der Ortung
   selbst: unter freiem Himmel 5 bis 10 m, unter Bewuchs mehr. Eine Schwelle
   von 10 m meldete an jedem zweiten Punkt eine Abweichung, die keine ist –
   und eine Meldung, die immer kommt, liest niemand mehr. */
export const ABWEICHUNG_SCHWELLE = 25;

// ---------------------------------------------------------------- Zugriff

/** Den Bau-Block einer Strecke anlegen, falls er noch fehlt. Nur innerhalb
 *  von `store.aendern` aufrufen – er schreibt in die Planung. */
export function bauSichern(strecke) {
  if (!strecke.bau) strecke.bau = neuerBau();
  return strecke.bau;
}

/** Die Ist-Punkte einer Strecke, in der Reihenfolge, in der sie stehen */
export const istPunkte = s => (s && s.bau && s.bau.punkte) || [];

/** Die Bauabschnitte einer Strecke */
export const bauabschnitte = s => (s && s.bau && s.bau.abschnitte) || [];

export const bauabschnittById = (s, aid) =>
  aid ? bauabschnitte(s).find(a => a.id === aid) || null : null;

/** Der Ist-Punkt, der diesen geplanten Punkt bestätigt – oder `null` */
export const istZuSoll = (s, pid) =>
  istPunkte(s).find(pt => pt.sollPunkt === pid) || null;

/** Der geplante Punkt, den dieser Ist-Punkt bestätigt – oder `null` */
export const sollZuIst = (s, istPunkt) =>
  (istPunkt && istPunkt.sollPunkt && s.punkte.find(pt => pt.id === istPunkt.sollPunkt)) || null;

// ---------------------------------------------------------------- Erfassen

/**
 * Einen Ist-Punkt anlegen und einsortieren.
 *
 * Einsortiert wird nach der Ordnung der Planung und nicht nach der Uhrzeit:
 * der Trupp arbeitet sich nicht zwingend von Punkt 1 nach Punkt 12 vor – beim
 * abschnittsweisen Bau laufen zwei Trupps aufeinander zu (Hdb Feldfernkabelbau, 3.6),
 * und der eine beginnt am Ende. Nach der Eintragungszeit sortiert stünde die
 * gebaute Trasse dann verkehrt herum auf der Karte.
 *
 * Ein Punkt ohne Bezug zur Planung hängt sich hinter den letzten Punkt, der
 * einen hat – das ist die Stelle, an der der Trupp gerade steht.
 *
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function istPunktSetzen(strecke, lat, lng, o = {}) {
  const bau = bauSichern(strecke);
  const neu = neuerIstPunkt(lat, lng, o);
  if (bau.stand === 'offen') bau.stand = 'laeuft';

  /* Bestätigt der Punkt einen geplanten, ersetzt er eine frühere Bestätigung
     desselben: zweimal „wie geplant“ am selben Punkt ist eine Korrektur und
     kein zweiter Punkt.

     Was der Trupp am Bauort SELBST eingetragen hat, überlebt die Korrektur:
     die Bemerkung immer, die Zuordnung zum Bauabschnitt, solange die neue
     Aufnahme keine mitbringt. Eine neue Koordinate ist eine bessere Messung
     desselben Punktes – kein Grund, den Satz „Muffe 6 m versetzt, Wurzelwerk“
     wegzuwerfen, der nirgends sonst steht. */
  if (neu.sollPunkt) {
    const alt = bau.punkte.findIndex(pt => pt.sollPunkt === neu.sollPunkt);
    if (alt >= 0) {
      const vorher = bau.punkte[alt];
      neu.id = vorher.id;
      neu.bemerkung = vorher.bemerkung || neu.bemerkung;
      neu.abschnitt = neu.abschnitt || vorher.abschnitt;
      neu.name = neu.name || vorher.name;
      bau.punkte[alt] = neu;
      return neu;
    }
  }

  const stelle = einsortierStelle(strecke, bau, neu);
  bau.punkte.splice(stelle, 0, neu);
  return neu;
}

/** Wohin der neue Ist-Punkt in der Liste gehört (Index) */
function einsortierStelle(strecke, bau, neu) {
  const ordnung = new Map(strecke.punkte.map((pt, i) => [pt.id, i]));
  const rang = pt => (pt.sollPunkt && ordnung.has(pt.sollPunkt)) ? ordnung.get(pt.sollPunkt) : null;
  const meiner = rang(neu);
  if (meiner === null) return nebenDenNachbarn(bau, neu);
  /* Vor den ersten Punkt, dessen geplante Stelle hinter der eigenen liegt.
     Punkte ohne Bezug zur Planung bleiben dabei stehen, wo sie sind – sie
     hängen an dem Punkt, hinter dem sie eingetragen wurden. */
  let letzterMitRang = -1;
  for (let i = 0; i < bau.punkte.length; i++) {
    const r = rang(bau.punkte[i]);
    if (r === null) continue;
    if (r > meiner) return letzterMitRang + 1;
    letzterMitRang = i;
  }
  return bau.punkte.length;
}

/**
 * Wohin ein Punkt gehört, den der Plan nicht kennt.
 *
 * Er wird neben seinen nächsten Nachbarn gehängt und nicht ans Listenende.
 * Ans Ende gehängt liefe die gebaute Trasse über die ganze Strecke und wieder
 * zurück: ein Mast, der auf halbem Weg gestellt werden musste, stünde hinter
 * dem Endpunkt, und die gerechnete Länge wäre doppelt so groß wie die gebaute.
 *
 * Die Seite wird an der Entfernung zu den beiden Nachbarn des Nächsten
 * entschieden – der neue Punkt liegt auf der Seite, zu der er näher steht. Das
 * ist eine Annahme, aber die einzige, die aus den Koordinaten folgt, und sie
 * lässt sich am Bauort am Verlauf auf der Karte ablesen und berichtigen.
 */
function nebenDenNachbarn(bau, neu) {
  if (bau.punkte.length < 2) return bau.punkte.length;
  let naechster = 0, kuerzeste = Infinity;
  bau.punkte.forEach((pt, i) => {
    const d = distanz(pt, neu);
    if (d < kuerzeste) { kuerzeste = d; naechster = i; }
  });
  const davor = bau.punkte[naechster - 1];
  const danach = bau.punkte[naechster + 1];
  if (!davor) return danach && distanz(danach, neu) < distanz(bau.punkte[naechster], danach)
    ? 1 : 0;
  if (!danach) return bau.punkte.length;
  return distanz(davor, neu) < distanz(danach, neu) ? naechster : naechster + 1;
}

/** Einen Bauabschnitt anlegen. Nur innerhalb von `store.aendern` aufrufen. */
export function bauabschnittAnlegen(strecke) {
  const bau = bauSichern(strecke);
  const a = neuerBauabschnitt(bau);
  bau.abschnitte.push(a);
  return a;
}

/**
 * Einen Bauabschnitt löschen und seine Ist-Punkte freigeben.
 *
 * Die Punkte werden nicht mitgelöscht: sie sind am Bauort aufgenommen worden,
 * der Abschnitt ist nur die Zuordnung zu einem Trupp. Wer die Gliederung
 * ändert, will nicht die Aufnahme verlieren.
 */
export function bauabschnittLoeschen(strecke, aid) {
  const bau = strecke.bau;
  if (!bau) return;
  bau.abschnitte = bau.abschnitte.filter(a => a.id !== aid);
  bau.punkte.forEach(pt => { if (pt.abschnitt === aid) pt.abschnitt = null; });
}

/**
 * Einen gelöschten Trassenpunkt aus der Baudokumentation lösen.
 *
 * Der Ist-Punkt bleibt stehen: er wurde am Bauort aufgenommen, und dass der
 * Plan dahinter verschwindet, macht ihn nicht falsch – er bestätigt nur nichts
 * mehr. Ihn mitzulöschen hieße, eine Messung wegen einer Planungsänderung zu
 * verwerfen.
 *
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function sollPunktGeloescht(strecke, pid) {
  const bau = strecke.bau;
  if (!bau) return;
  bau.punkte.forEach(pt => { if (pt.sollPunkt === pid) pt.sollPunkt = null; });
  bau.abschnitte.forEach(a => {
    if (a.vonPunkt === pid) a.vonPunkt = null;
    if (a.bisPunkt === pid) a.bisPunkt = null;
  });
}

/**
 * Die Baudokumentation mit der Trasse umkehren.
 *
 * Die Kennungen der Punkte bleiben beim Umkehren erhalten, die Verweise stimmen
 * also weiter. Die Reihenfolge der Ist-Punkte muss trotzdem mitgehen: sie folgt
 * der Ordnung der Planung, und ohne das Umkehren liefe die gebaute Trasse
 * danach gegen die geplante.
 *
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function bauUmkehren(strecke) {
  if (strecke.bau) strecke.bau.punkte.reverse();
}

// ---------------------------------------------------------------- Kennzahlen

/**
 * Was die Baudokumentation dieser Strecke hergibt.
 *
 * `laenge` ist die Länge der gebauten Trasse – sie wird wie die geplante aus
 * den Direktstrecken zwischen den Punkten gerechnet und trägt deshalb dieselbe
 * Einschränkung: sie misst die Trasse, nicht das Kabel. Der Bauzuschlag steht
 * bewusst NICHT darauf. Er ist eine Planungsgröße, und was wirklich an Kabel
 * verbraucht wurde, sagt die Materialliste des Trupps und keine Rechnung.
 */
export function baukennzahlen(strecke) {
  const ist = istPunkte(strecke);
  const soll = strecke.punkte || [];
  const laenge = ist.length >= 2 ? streckenlaenge(ist) : 0;
  const sollLaenge = soll.length >= 2 ? streckenlaenge(soll) : 0;

  const bestaetigt = soll.filter(pt => istZuSoll(strecke, pt.id)).length;
  const zusaetzlich = ist.filter(pt => !pt.sollPunkt).length;

  const abweichungen = [];
  for (const pt of ist) {
    const s = sollZuIst(strecke, pt);
    if (!s) continue;
    const meter = distanz(s, pt);
    if (meter >= ABWEICHUNG_SCHWELLE) abweichungen.push({ soll: s, ist: pt, meter });
  }
  abweichungen.sort((a, b) => b.meter - a.meter);

  return {
    bau: strecke.bau || null,
    stand: baustandById(strecke.bau ? strecke.bau.stand : 'offen'),
    istPunkte: ist.length,
    sollPunkte: soll.length,
    bestaetigt,
    zusaetzlich,
    /* Fehlend heißt: geplant, aber noch nicht bestätigt. Am Ende eines Baus
       ist diese Zahl die Nachfrage an den Trupp. */
    fehlend: Math.max(0, soll.length - bestaetigt),
    laenge,
    sollLaenge,
    /* Der Unterschied der Trassenlängen – die Zahl, die im Bauauftrag neben der
       geplanten steht. Ohne Vorzeichenspiel: kürzer ist so wenig „besser“ wie
       länger „schlechter“, beides ist eine Abweichung vom Auftrag. */
    laengenUnterschied: (laenge && sollLaenge) ? laenge - sollLaenge : 0,
    abweichungen,
    groessteAbweichung: abweichungen.length ? abweichungen[0].meter : 0,
    vollstaendig: soll.length > 0 && bestaetigt === soll.length
  };
}

// ---------------------------------------------------------------- Texte

/** Woher die Koordinate stammt, in einem Wort – mit Genauigkeit, wenn es eine gibt */
export function quelleText(pt) {
  const q = istquelleById(pt.quelle);
  return q.kurz + (pt.genauigkeit ? ` ±${pt.genauigkeit} m` : '');
}

/** Uhrzeit für die Liste – am Bauort wird nach ihr gesucht, nicht nach dem Datum */
export function uhrzeit(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** Die Strecke, an der zuletzt gebaut wurde – der Einstieg in den Baumodus */
function zuletztGebaut(projekt) {
  let beste = null, zeit = '';
  for (const s of projekt.strecken || []) {
    for (const pt of istPunkte(s)) {
      if (pt.zeit > zeit) { zeit = pt.zeit; beste = s; }
    }
  }
  return beste || (projekt.strecken || []).find(bauBegonnen) || null;
}

/** Kurzfassung für die Streckenzeile im Planungsmodus */
export function baustandKurz(strecke) {
  if (!bauBegonnen(strecke)) return '';
  const k = baukennzahlen(strecke);
  const teile = [k.stand.kurz];
  if (k.sollPunkte) teile.push(`${k.bestaetigt}/${k.sollPunkte} Punkte`);
  if (k.abweichungen.length) {
    teile.push(`${k.abweichungen.length} ${k.abweichungen.length === 1 ? 'Abweichung' : 'Abweichungen'}`);
  }
  return teile.join(' · ');
}

/** Die Strecke, die im Baumodus gerade bearbeitet wird – merkt sich die Wahl */
let gewaehlteStrecke = null;
export function baustrecke() {
  const p = store.projekt;
  if (!p) return null;
  const gemerkt = gewaehlteStrecke && p.strecken.find(s => s.id === gewaehlteStrecke);
  return gemerkt || zuletztGebaut(p) || p.strecken[0] || null;
}
export function baustreckeSetzen(sid) { gewaehlteStrecke = sid; }
