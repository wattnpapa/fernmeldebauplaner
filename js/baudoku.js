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
  store, neuerBau, neuerBauabschnitt, neuerIstPunkt, baustandById, istquelleById, punktartById,
  neueMaterialzeile, neueBaumeldung, neuePruefzeile, neuePruefung,
  materialZusammenfassen, bauBegonnen, pruefungGehaltvoll
} from './state.js';
import { distanz, streckenlaenge } from './geo.js';
import { MATERIALKATALOG, PRUEFART_JE_KABEL, bauweiseById } from './vorschrift.js';
/* Der Abdruck kommt aus dem Codec und wird nicht hier gebildet: er muss über
   genau das laufen, was hinausgeht, und das weiß `teilen.js`. Kein Ring –
   `teilen.js` kennt nur `state.js`. */
import { bauAbdruck } from './teilen.js';

export { bauBegonnen, pruefungGehaltvoll };

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
     kein zweiter Punkt. Dasselbe gilt, wenn `ersetzt` einen aufgenommenen
     Punkt nennt – so wird ein zusätzlicher Punkt neu geortet oder auf der
     Karte verschoben, ohne dass er seinen Platz in der Trasse verliert.

     Was der Trupp am Bauort SELBST eingetragen hat, überlebt die Korrektur:
     die Bemerkung immer, Art und Bauweise, solange die neue Aufnahme keine
     mitbringt, die Zuordnung zum Bauabschnitt ebenso. Eine neue Koordinate ist
     eine bessere Messung desselben Punktes – kein Grund, den Satz „Muffe 6 m
     versetzt, Wurzelwerk“ wegzuwerfen, der nirgends sonst steht. */
  const alt = o.ersetzt
    ? bau.punkte.findIndex(pt => pt.id === o.ersetzt)
    : (neu.sollPunkt ? bau.punkte.findIndex(pt => pt.sollPunkt === neu.sollPunkt) : -1);
  if (alt >= 0) {
    const vorher = bau.punkte[alt];
    neu.id = vorher.id;
    neu.bemerkung = vorher.bemerkung || neu.bemerkung;
    neu.abschnitt = neu.abschnitt || vorher.abschnitt;
    neu.name = neu.name || vorher.name;
    neu.sollPunkt = neu.sollPunkt || vorher.sollPunkt;
    if (!o.art) { neu.art = vorher.art; neu.bauweise = vorher.bauweise; }
    bau.punkte[alt] = neu;
    return neu;
  }

  const stelle = einsortierStelle(strecke, bau, neu);
  bau.punkte.splice(stelle, 0, neu);
  return neu;
}

/**
 * Die Art eines aufgenommenen Punktes setzen.
 *
 * Die Bauweise hängt an der Querung und an sonst nichts: wer aus der Querung
 * wieder eine Muffe macht, nimmt den Überbau mit weg. Sonst stünde auf dem
 * Bogen eine Muffe „im Überbau“ – und am Bauort sucht jemand danach.
 *
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function istArtSetzen(pt, art) {
  pt.art = art;
  if (art !== 'querung') pt.bauweise = null;
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
  /* Materialzeilen und Meldungen hängen an derselben Zuordnung. Bliebe sie
     stehen, zählte `materialSumme()` weiter Mengen zu einem Abschnitt, den es
     nicht mehr gibt – und am Bogen fehlten sie, weil kein Abschnitt sie zeigt.
     Die freigewordenen Zeilen können jetzt auf eine gleiche treffen, die schon
     ohne Abschnitt dastand; sie werden deshalb gleich zusammengezogen. Sonst
     zeigte der Bogen die erste und rechnete mit beiden. */
  (bau.material || []).forEach(z => { if (z.abschnitt === aid) z.abschnitt = null; });
  (bau.meldungen || []).forEach(m => { if (m.abschnitt === aid) m.abschnitt = null; });
  bau.material = materialZusammenfassen(bau.material || []);
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

// -------------------------------------------------------------- Material

/* Der Materialnachweis. Der Katalog steht in `vorschrift.js`, hier steht nur,
   wie eine Zeile entsteht und vergeht.

   Eine Zeile entsteht erst, wenn jemand eine Menge einträgt, und sie vergeht
   wieder, wenn er sie loescht. Fuer jeden der 25 Katalogeintraege je
   Bauabschnitt von vornherein eine Zeile anzulegen hiesse, einen leeren Bogen
   durch Speicher und Link zu schleppen – bei drei Abschnitten 75 Zeilen, von
   denen der Trupp vielleicht sechs fuellt. Die Oberflaeche zeigt trotzdem alle
   Katalogzeilen: was angezeigt wird und was gespeichert wird, sind zwei Dinge. */

export const materialzeilen = s => (s && s.bau && s.bau.material) || [];

/** Die Zeile zu Artikel und Bauabschnitt – oder `null` */
export const materialzeile = (s, artikel, abschnitt = null) =>
  materialzeilen(s).find(z => z.artikel === artikel &&
    (z.abschnitt || null) === (abschnitt || null)) || null;

/**
 * Eine Menge eintragen, ändern oder wieder herausnehmen.
 *
 * `null` und die leere Eingabe loeschen die Zeile, sofern an ihr keine
 * Bemerkung haengt: ein leeres Feld ist keine Aussage, und eine Zeile mit der
 * Menge `null` traege im Bogen nichts bei, im Link aber ihr Gewicht. Traegt sie
 * eine Bemerkung, bleibt sie stehen – die hat jemand geschrieben.
 *
 * Die 0 ist ausdruecklich KEIN Loeschen: „nachweislich nichts verbraucht“ ist
 * eine andere Aussage als „noch nicht eingetragen“, und am Bauort ist der
 * Unterschied der Grund, warum der Bogen gefuehrt wird.
 *
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function materialSetzen(strecke, artikel, abschnitt, menge) {
  const bau = bauSichern(strecke);
  const roh = (menge === '' || menge === null || menge === undefined) ? null : Number(menge);
  const wert = Number.isFinite(roh) && roh >= 0 ? roh : null;
  const da = bau.material.find(z => z.artikel === artikel &&
    (z.abschnitt || null) === (abschnitt || null));

  if (wert === null) {
    if (!da) return null;
    if (da.bemerkung) { da.menge = null; return da; }
    bau.material = bau.material.filter(z => z !== da);
    return null;
  }
  if (da) { da.menge = wert; return da; }
  const zeile = neueMaterialzeile(artikel, { abschnitt });
  zeile.menge = wert;
  bau.material.push(zeile);
  return zeile;
}

/** Eine freie Zeile („Sonstiges“) anlegen. Nur innerhalb von `store.aendern`. */
export function materialFreiAnlegen(strecke, abschnitt = null) {
  const bau = bauSichern(strecke);
  const zeile = neueMaterialzeile('sonstiges', { abschnitt });
  bau.material.push(zeile);
  return zeile;
}

/** Eine Zeile über ihre Kennung loeschen. Nur innerhalb von `store.aendern`. */
export function materialZeileLoeschen(strecke, zid) {
  const bau = strecke.bau;
  if (!bau) return;
  bau.material = (bau.material || []).filter(z => z.id !== zid);
}

/**
 * Was ueber alle Bauabschnitte zusammenkommt, je Artikel.
 *
 * Genau dafuer ist der Katalog fest und kein Freifeld: „Bauhaken FKb“ und
 * „Bauhaken, Feldkabel“ liessen sich nicht addieren, und wo zwei Trupps an
 * einer Strecke bauen, ist die Summe die Zahl, die der Planer braucht.
 */
export function materialSumme(strecke) {
  const summe = new Map();
  for (const z of materialzeilen(strecke)) {
    if (!Number.isFinite(z.menge)) continue;
    summe.set(z.artikel, (summe.get(z.artikel) || 0) + z.menge);
  }
  return summe;
}

/**
 * Das Soll neben dem Ist – und nur dort, wo die Planung wirklich eine Zahl hat.
 *
 * Das ist genau EINE Zeile: die Kabelart dieser Strecke. Alles Uebrige des
 * Katalogs – Bauhaken, Abspannringe, Erder, Anschlussleisten – rechnet die
 * Planung nicht, und eine hergeleitete Zahl daneben zu stellen („zwei Ableiter
 * je Strecke ueber 40 m“) waere eine Erfindung, die am Bauort wie eine Vorgabe
 * aussaehe.
 *
 * `k` ist das Ergebnis von `kennzahlen()` aus `strecken.js`. Es wird
 * hereingereicht und nicht hier geholt: `strecken.js` importiert bereits aus
 * diesem Modul, und der Ring liesse sich nur mit Sorgfalt in beide Richtungen
 * lesen. Die Aufrufer haben die Zahlen ohnehin schon.
 */
export function materialSoll(k) {
  if (!k || !k.kabel || k.kabel.funk) return null;
  const zeile = MATERIALKATALOG.find(m => m.kabel === k.kabel.id);
  if (!zeile) return null;
  return { artikel: zeile.id, menge: k.bedarf, einheit: zeile.einheit };
}

// ------------------------------------------------------------- Baumeldungen

/* Nach jeder Kabellaenge oder nach befohlener Zeit ist eine Baumeldung an die
   Anfangsstelle durchzugeben (Hdb Feldfernkabelbau, 3.5). Mitgeschrieben
   ergeben sie die Bauzeiten, die sonst niemand rekonstruiert. */

export const baumeldungen = s => (s && s.bau && s.bau.meldungen) || [];

/** Eine Baumeldung anlegen. Nur innerhalb von `store.aendern` aufrufen. */
export function baumeldungAnlegen(strecke, text = '', abschnitt = null) {
  const bau = bauSichern(strecke);
  const m = neueBaumeldung({ text, abschnitt });
  if (bau.stand === 'offen') bau.stand = 'laeuft';
  bau.meldungen.push(m);
  return m;
}

export function baumeldungLoeschen(strecke, mid) {
  const bau = strecke.bau;
  if (!bau) return;
  bau.meldungen = (bau.meldungen || []).filter(m => m.id !== mid);
}

/** Die Meldungen von der aeltesten zur juengsten – die Zeitschiene des Baus */
export const meldungenNachZeit = s =>
  [...baumeldungen(s)].sort((a, b) => String(a.zeit).localeCompare(String(b.zeit)));

// --------------------------------------------------------- Pruefen, Uebergabe

/* „Entsprechen die Messwerte den Sollwerten oder war die Ruf- und Sprechprobe
   erfolgreich, wird das Kabel der Einheit uebergeben, fuer die es gebaut
   wurde“ – und erst wenn die befohlenen Uebernahmemessungen abgeschlossen sind,
   ist die Uebergabe beendet (Hdb Feldfernkabelbau, 3.5). Deshalb sind „gebaut“
   und „uebergeben“ zwei Baustaende und nicht einer, und deshalb haengt die
   Uebergabe an denselben Zeilen wie die Pruefung. */

/** Den Pruefblock anlegen, falls er fehlt. Nur innerhalb von `store.aendern`. */
export function pruefungSichern(strecke) {
  const bau = bauSichern(strecke);
  if (!bau.pruefung) bau.pruefung = neuePruefung();
  return bau.pruefung;
}

export const pruefzeilen = s => (s && s.bau && s.bau.pruefung && s.bau.pruefung.staemme) || [];

/**
 * Eine Pruefzeile anlegen.
 *
 * Die Pruefart kommt aus der Kabelart der Strecke: Feldfernkabel wird gemessen,
 * Verbindungs- und Anschlusskabel werden besprochen (3.5). Das ist ein
 * Vorschlag und keine Sperre – der Truppfuehrer kann die Art an der Zeile
 * aendern, denn befohlene Uebernahmemessungen kennt die Kabelart nicht.
 *
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function pruefzeileAnlegen(strecke) {
  const pr = pruefungSichern(strecke);
  const art = PRUEFART_JE_KABEL[strecke.kabeltyp] || 'messung';
  const z = neuePruefzeile({ art, stamm: `Stamm ${pr.staemme.length + 1}` });
  pr.staemme.push(z);
  return z;
}

export function pruefzeileLoeschen(strecke, zid) {
  const pr = strecke.bau && strecke.bau.pruefung;
  if (!pr) return;
  pr.staemme = (pr.staemme || []).filter(z => z.id !== zid);
}

/**
 * Wo die Uebergabe steht.
 *
 * `offen` heisst: noch keine Pruefzeile bestanden. `geprueft`: alle
 * eingetragenen Staemme sind bestanden, die Uebergabe steht aber noch aus.
 * `uebergeben`: Empfaenger und Zeit stehen da. Eine durchgefallene Zeile
 * blockiert – sie ist der Grund, warum nicht uebergeben wird, und darf nicht
 * unter einer Summe verschwinden.
 */
export function uebergabestand(strecke) {
  const pr = (strecke.bau && strecke.bau.pruefung) || null;
  const zeilen = pruefzeilen(strecke);
  const durchgefallen = zeilen.filter(z => z.bestanden === false).length;
  const offen = zeilen.filter(z => z.bestanden === null).length;
  const bestanden = zeilen.filter(z => z.bestanden === true).length;
  const uebergeben = !!(pr && pr.uebergabeAn && pr.uebergabeZeit);
  return {
    zeilen: zeilen.length, bestanden, durchgefallen, offen, uebergeben,
    /* Fertig heisst: geprueft UND uebergeben. Beides einzeln reicht nicht –
       eine uebergebene, ungepruefte Leitung ist genau der Fall, den 3.5
       ausschliesst. */
    fertig: uebergeben && zeilen.length > 0 && durchgefallen === 0 && offen === 0,
    an: (pr && pr.uebergabeAn) || '',
    zeit: (pr && pr.uebergabeZeit) || '',
    durch: (pr && pr.uebergabeName) || ''
  };
}

// ---------------------------------------------------------- Wer am Gerät steht

/* Trupp und Truppführer gehören nicht in die Planung: sie sagen, WER GERADE AM
   GERÄT STEHT, und nicht, was gebaut wurde – dieselbe Unterscheidung wie beim
   aktiven Bauabschnitt weiter unten. Anders als der überlebt dieser Vermerk
   aber das Neuladen, denn am Bauort wird neu geladen, und ein Trupp, der sich
   nach jedem Wackler neu benennen muss, benennt sich gar nicht.

   Gebraucht wird er, weil die Baumeldung sonst niemanden nennt. Ohne
   Bauabschnitt ging sie anonym hinaus, und beim Planer ersetzte die zweite
   Meldung die Eintragungen der ersten – gewarnt wurde nur er, nicht der Trupp.
   Wer meldet, muss am Bauort einmal gefragt werden.

   Er liegt im Gerätespeicher und nicht im Projekt: eine Planung, die
   weitergereicht wird, trägt sonst den Namen eines fremden Trupps mit sich. */
const TRUPP_SCHLUESSEL = 'fbp.trupp.v1';
let truppVermerk = null;

export function truppAmGeraet() {
  if (truppVermerk) return truppVermerk;
  try {
    const roh = JSON.parse(localStorage.getItem(TRUPP_SCHLUESSEL) || 'null');
    truppVermerk = roh && typeof roh === 'object'
      ? { trupp: String(roh.trupp || ''), fuehrer: String(roh.fuehrer || '') }
      : { trupp: '', fuehrer: '' };
  } catch {
    /* Ein privates Fenster oder ein voller Speicher darf den Baumodus nicht
       aufhalten – dann steht der Name eben nur für diese Sitzung. */
    truppVermerk = { trupp: '', fuehrer: '' };
  }
  return truppVermerk;
}

export function truppAmGeraetSetzen(o) {
  truppVermerk = { trupp: String(o.trupp || ''), fuehrer: String(o.fuehrer || '') };
  try {
    if (truppVermerk.trupp || truppVermerk.fuehrer) {
      localStorage.setItem(TRUPP_SCHLUESSEL, JSON.stringify(truppVermerk));
    } else {
      localStorage.removeItem(TRUPP_SCHLUESSEL);
    }
  } catch { /* siehe oben */ }
  return truppVermerk;
}

/** Wer die Meldung absetzt, in einer Zeile – Bauabschnitte gehen vor, denn sie
 *  stehen in der Planung und sagen, wer welchen Teil gebaut hat */
export function absenderText(strecken) {
  const ausAbschnitten = new Set();
  for (const s of strecken) {
    for (const a of bauabschnitte(s)) if (a.trupp) ausAbschnitten.add(a.trupp);
  }
  if (ausAbschnitten.size) return [...ausAbschnitten].join(', ');
  const v = truppAmGeraet();
  return [v.trupp, v.fuehrer].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------ Was hinausging

/* Der Vermerk über die abgesetzte Baumeldung. Er ist die Antwort auf die eine
   Frage, die der Truppführer nach jeder Unterbrechung stellt: „Habe ich das
   schon gemeldet?“ Vorher sah der Rückmeldeblock vor und nach dem Absetzen
   gleich aus, und der Bau-Block war zeichengleich – die Frage war am Gerät
   nicht zu beantworten. */

/** Festhalten, dass die Baumeldung dieser Strecke hinausgegangen ist.
 *  Nur innerhalb von `store.aendern` aufrufen. */
export function absetzenVermerken(strecke, weg) {
  const bau = bauSichern(strecke);
  bau.abgesetzt = {
    zeit: new Date().toISOString(),
    weg: weg === 'datei' ? 'datei' : 'link',
    abdruck: bauAbdruck(strecke)
  };
  return bau.abgesetzt;
}

/**
 * Wo das Absetzen steht.
 *
 * `nie` heißt: an dieser Strecke ist noch nichts hinausgegangen. `aktuell`:
 * abgesetzt, und seither hat sich nichts geändert. `veraltet`: seit dem
 * Absetzen ist etwas dazugekommen – das ist der Fall, der eine zweite Meldung
 * verlangt, und der einzige, in dem die Anzeige drängt.
 *
 * Fehlt der Abdruck (ein Vermerk aus einem Stand vor Schema 16 hat keinen),
 * gilt `aktuell`: „abgesetzt, ob seither geändert ist nicht bekannt“ ist die
 * ehrlichere Auskunft als eine Änderung zu behaupten, die niemand gemessen hat.
 */
export function absetzstand(strecke) {
  const a = (strecke.bau && strecke.bau.abgesetzt) || null;
  if (!a || !a.zeit) return { stand: 'nie', zeit: '', weg: '' };
  const jetzt = bauAbdruck(strecke);
  const geaendert = !!(a.abdruck && jetzt && a.abdruck !== jetzt);
  return { stand: geaendert ? 'veraltet' : 'aktuell', zeit: a.zeit, weg: a.weg };
}

/** Der jüngste Absetz-Vermerk über mehrere Strecken – der Stand des Trupps */
export function absetzstandGesamt(strecken) {
  const staende = strecken.map(absetzstand).filter(x => x.stand !== 'nie');
  if (!staende.length) return { stand: 'nie', zeit: '', weg: '' };
  const juengster = staende.reduce((a, b) => (b.zeit > a.zeit ? b : a));
  /* Eine einzige veraltete Strecke macht den ganzen Stand veraltet: gemeldet
     wird über alle zusammen, und der Planer bekäme sonst eine Strecke ohne die
     Punkte, die seit der letzten Meldung dazugekommen sind. */
  const veraltet = staende.some(x => x.stand === 'veraltet') ||
    strecken.some(s => bauBegonnen(s) && absetzstand(s).stand === 'nie');
  return { ...juengster, stand: veraltet ? 'veraltet' : 'aktuell' };
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

  /* Was der Trupp aufgenommen, aber nicht ausgesagt hat. Beides ist eine Lücke
     im Nachweis und keine Nebensache: die Art sagt, WAS an der Stelle steht,
     die Bauweise an der Querung, WIE gequert wurde – und die ist dort die
     Angabe, wegen der die Querung überhaupt aufgenommen wird. Gezählt wird
     hier, damit Liste, Rückmeldeblock und Blatt dieselbe Zahl nennen. */
  const ohneArt = ist.filter(pt => pt.art === 'offen');
  const querungOhneBauweise = ist.filter(pt => pt.art === 'querung' && !pt.bauweise);

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
    ohneArt,
    querungOhneBauweise,
    /* Eine Zahl für beides: der Trupp fragt vor dem Absetzen „fehlt noch was?“
       und nicht „wie viele Arten und wie viele Bauweisen“. */
    luecken: ohneArt.length + querungOhneBauweise.length,
    vollstaendig: soll.length > 0 && bestaetigt === soll.length,
    /* Material, Meldungen und Übergabe stehen hier nur als Zahl. Die Zeilen
       selbst holt sich, wer sie braucht – die Kennzahlen laufen bei jedem
       Neuzeichnen der Liste durch, und die ganze Materialtabelle mitzuschleppen
       kostete dort ohne Gegenwert. */
    materialzeilen: (strecke.bau && strecke.bau.material || []).length,
    meldungen: (strecke.bau && strecke.bau.meldungen || []).length,
    uebergabe: uebergabestand(strecke)
  };
}

// ---------------------------------------------------------------- Texte

/** Art des aufgenommenen Punktes in Worten – bei der Querung samt Bauweise */
export function punktartText(pt) {
  const art = punktartById(pt.art);
  const bw = pt.art === 'querung' && pt.bauweise ? bauweiseById(pt.bauweise) : null;
  return bw && bw.kurz ? `${art.name} · ${bw.name}` : art.name;
}

/** Der Buchstabe, den die Ist-Marke trägt – leer beim gewöhnlichen Trassenpunkt.
 *  An der Querung steht die Bauweise (Ü, U, B), wenn eine eingetragen ist: sie ist
 *  am Bauort die Aussage, die zählt, und dieselbe, die die geplante Raute trägt. */
export function istKurz(pt) {
  const art = punktartById(pt.art);
  if (pt.art === 'querung' && pt.bauweise) {
    const bw = bauweiseById(pt.bauweise);
    if (bw.kurz) return bw.kurz;
  }
  return art.kurz === '·' ? '' : art.kurz;
}

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

/* Welcher Bauabschnitt neue Eintragungen aufnimmt. Sitzungszustand wie die
   gewählte Strecke – er überlebt das Neuladen bewusst nicht und liegt nicht in
   der Planung: er sagt, wer gerade am Gerät steht, nicht, was gebaut wurde.
   Er steht hier und nicht in der Liste, weil auch die Karte ihn braucht: ein
   Punkt, der über die Bauleiste aufgenommen wird, trägt denselben Trupp wie
   einer aus der Liste. */
let aktiverAbschnittId = null;
export function bauabschnittAktivSetzen(aid) { aktiverAbschnittId = aid || null; }
export function bauabschnittAktivId() { return aktiverAbschnittId; }
/** Der aktive Bauabschnitt dieser Strecke – oder `null`, wenn keiner (mehr) gilt */
export function aktiverBauabschnitt(s) {
  return bauabschnittById(s, aktiverAbschnittId);
}
