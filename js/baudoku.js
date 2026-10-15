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
  materialZusammenfassen, bauBegonnen, pruefungGehaltvoll, bildAufKarte
} from './state.js';
import { distanz, streckenlaenge, peilung, himmelsrichtung, meter, formatLaenge } from './geo.js';
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

/* Ab welchem Abstand zur geplanten Trasse ein ZUSÄTZLICHER Punkt fraglich ist.
   Die 25 m oben taugen hier nicht: ein zusätzlicher Punkt ist gerade der, den
   der Plan nicht kennt – die Umgehung um eine Baugrube, der Mast hinter der
   Scheune. Das sind Dutzende, selten ein paar hundert Meter. Was darüber
   liegt, ist fast immer eine Ortung am falschen Platz: im Audit stand ein
   Zusatzpunkt 82 km neben der Trasse, die gebaute Länge sprang von 2,7 auf
   143 km – und darunter stand „Kein Punkt weicht mehr als 25 m ab“, weil
   Zusatzpunkte gar nicht geprüft wurden. */
export const ABSEITS_SCHWELLE = 300;

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
  /* Im Nachtrag vom Papier trägt der Punkt keine Uhrzeit des Abtippens,
     sondern die Abschrift (`nachtragFelder`). Die Ortung durch das Gerät ist
     davon ausgenommen: sie misst jetzt und hier, abgeschrieben ist an ihr
     nichts. */
  const neu = neuerIstPunkt(lat, lng,
    { ...(o.quelle === 'standort' ? {} : nachtragFelder()), ...o });
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
  /* Bestätigt ein ANDERER Bauabschnitt denselben geplanten Punkt, ist das
     der Treffpunkt zweier Trupps und keine Korrektur: beide stehen dort, und
     dass beide dort standen, schließt die Lücke zwischen ihnen
     (`istVerlauf`). Ersetzt würde die Bestätigung des ersten Trupps still
     durch die des zweiten, und aus dem gemeinsamen Punkt wurde eine Lücke. */
  const anderer = pt => !o.ersetzt && o.abschnitt && pt.abschnitt && pt.abschnitt !== o.abschnitt;
  const alt = o.ersetzt
    ? bau.punkte.findIndex(pt => pt.id === o.ersetzt)
    : (neu.sollPunkt
      ? bau.punkte.findIndex(pt => pt.sollPunkt === neu.sollPunkt && !anderer(pt)) : -1);
  if (alt >= 0) {
    const vorher = bau.punkte[alt];
    /* Wird ein Punkt im Nachtrag NEU GESETZT (Auf Karte verschieben), trägt die
       neue Aufnahme die Abschrift – Uhrzeit leer, „nachgetragen“ gesetzt – und
       vernichtete die Bauzeit eines Punktes, der draußen entstand: genau das,
       was ein Papierbogen nicht wiedergibt. Korrigiert wird die LAGE; die Zeit
       und ob der Eintrag abgeschrieben ist, bleiben die des Vorgängers. */
    if (o.ersetzt && o.zeit === undefined && neu.nachgetragen && o.quelle !== 'standort') {
      neu.zeit = vorher.zeit;
      neu.nachgetragen = vorher.nachgetragen || '';
      neu.nachtragTag = vorher.nachtragTag || '';
    }
    neu.id = vorher.id;
    neu.bemerkung = vorher.bemerkung || neu.bemerkung;
    neu.abschnitt = neu.abschnitt || vorher.abschnitt;
    neu.name = neu.name || vorher.name;
    neu.sollPunkt = neu.sollPunkt || vorher.sollPunkt;
    if (!o.art) { neu.art = vorher.art; neu.bauweise = vorher.bauweise; }
    abschnittNachtragen(strecke, neu);
    bau.punkte[alt] = neu;
    truppFrageVormerken(strecke, neu);
    return neu;
  }

  abschnittNachtragen(strecke, neu);
  const stelle = einsortierStelle(strecke, bau, neu);
  bau.punkte.splice(stelle, 0, neu);
  truppFrageVormerken(strecke, neu);
  return neu;
}

/* Kam der Punkt ohne Abschnitt an, bekommt er den des Geräts. Jeder Aufnahmeweg
   reicht den aktiven Abschnitt mit, aber einer, der es vergisst, ließ den
   Punkt aus der Meldung fallen – das Netz hier fängt alle, auch die künftigen. */
function abschnittNachtragen(strecke, neu) {
  if (neu.abschnitt) return;
  const a = aktiverBauabschnitt(strecke);
  if (a) neu.abschnitt = a.id;
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

/**
 * Einen aufgenommenen Punkt nachträglich einem geplanten zuordnen – oder die
 * Zuordnung wieder lösen (`pid === null`).
 *
 * Der Grund, dass es diesen Griff gibt: die Bauleiste nimmt den Standort auf,
 * ohne zu wissen, welcher geplante Punkt gemeint ist. Sie KANN es nicht wissen
 * – und raten darf sie nicht, denn bei eng gesetzten Punkten rät die
 * Entfernung falsch. Jede Aufnahme über „Punkt hier“ und „Auf Karte“ war
 * deshalb ein zusätzlicher Punkt, und „0 von 3 Punkten“ blieb stehen, auch
 * wenn der Trupp auf dem geplanten Punkt stand. Der Weg heraus ist nicht die
 * Automatik, sondern der Tipp: die Anwendung stellt die offenen Punkte nach
 * Entfernung sortiert hin, der Trupp sagt, welcher es ist.
 *
 * Ein geplanter Punkt trägt genau eine Aufnahme. Eine bereits bestätigte wird
 * hier nicht verdrängt – sonst verschwände sie ohne Meldung; angeboten werden
 * deshalb nur offene Punkte, und diese Prüfung ist der Riegel dahinter.
 *
 * Neu einsortiert wird in jedem Fall: die Stelle in der Liste folgt der
 * Ordnung der Planung, und mit der Zuordnung ändert sich diese Stelle.
 *
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function istSollZuordnen(strecke, ist, pid) {
  const bau = bauSichern(strecke);
  if (!bau.punkte.includes(ist)) return ist;
  /* Was vom bisher zugeordneten Punkt stammt, geht mit der Zuordnung. Ob eine
     Art „vom Plan“ ist, steht nirgends – erkannt wird es daran, dass sie der
     Art dieses Plans gleicht. Wer am Plan-Punkt „Muffe“ selbst angetippt hat,
     verliert dadurch nichts, was er nicht eben dort abgelesen hätte. */
  const bisher = sollZuIst(strecke, ist);
  if (bisher) {
    if (ist.art === bisher.art &&
        (ist.art !== 'querung' || (ist.bauweise || null) === (bisher.bauweise || null))) {
      ist.art = 'offen';
      ist.bauweise = null;
    }
    if (ist.name && ist.name === bisher.name) ist.name = '';
  }
  if (pid) {
    const soll = strecke.punkte.find(pt => pt.id === pid);
    if (!soll) return ist;
    if (bau.punkte.some(pt => pt !== ist && pt.sollPunkt === pid)) return ist;
    ist.sollPunkt = pid;
    /* Der bestätigte Punkt heißt, wie er im Bauauftrag heißt – so wird er am
       Bauort gesucht. Was der Trupp selbst eingetragen hat, bleibt: er stand
       davor und hat den Namen mit Absicht vergeben. */
    if (!ist.name) ist.name = soll.name || '';
    /* Und er trägt die Art des Plans, solange der Trupp keine gesetzt hat –
       wie bei „◉ Hier“ am geplanten Punkt. Vorher waren das zwei Wege zu
       derselben Bestätigung mit verschiedenem Ergebnis: über die Punktkarte
       zugeordnet blieb die geplante Muffe „Art noch offen“, und am Ende stand
       sie als Lücke in der Nachfrage an den Trupp. */
    if (ist.art === 'offen') {
      ist.art = soll.art;
      ist.bauweise = soll.art === 'querung' ? (soll.bauweise || null) : null;
    }
  } else {
    ist.sollPunkt = null;
  }
  const i = bau.punkte.indexOf(ist);
  bau.punkte.splice(i, 1);
  bau.punkte.splice(einsortierStelle(strecke, bau, ist), 0, ist);
  return ist;
}

/**
 * Die geplanten Punkte, die noch keine Aufnahme tragen – zu `bei` hin
 * aufsteigend sortiert, damit der nächstliegende zuerst zur Wahl steht.
 * Jeder Eintrag nennt seine Stelle in der Planung (`nr`, ab 1) und die
 * Entfernung in Metern; ohne `bei` bleibt die Reihenfolge die der Planung.
 */
export function offeneSollPunkte(strecke, bei = null) {
  if (!strecke) return [];
  const belegt = new Set(istPunkte(strecke).map(pt => pt.sollPunkt).filter(Boolean));
  const offen = strecke.punkte
    .map((pt, i) => ({ punkt: pt, nr: i + 1, weg: bei ? distanz(pt, bei) : null }))
    .filter(e => !belegt.has(e.punkt.id));
  if (bei) offen.sort((a, b) => a.weg - b.weg);
  return offen;
}

/**
 * Der offene geplante Punkt, den eine Ortung an dieser Stelle meint – oder
 * `null`, wenn das nicht ohne Raten feststeht.
 *
 * Vorgeschlagen wird nur, was innerhalb der Abweichungsschwelle liegt, also
 * dort, wo die Ortung selbst nicht genauer ist. Im Audit stand der Trupp 6 bis
 * 11 m neben Punkt 2, tippte „Fertig“, und es blieb „0 von 3 geplanten
 * bestätigt“ mit einem Zusatzpunkt ohne Art. Liegen ZWEI offene Punkte so nah,
 * bleibt es beim Fragen: dort wüsste auch die Entfernung nicht, welcher
 * gemeint ist – das ist der Fall, für den „geraten wird nichts“ steht.
 */
export function sollVorschlag(strecke, bei) {
  const nahe = offeneSollPunkte(strecke, bei).filter(e => e.weg < ABWEICHUNG_SCHWELLE);
  return nahe.length === 1 ? nahe[0] : null;
}

/**
 * Eine ANDERE Strecke, an der die Ortung liegt – der nächste geplante Punkt
 * dort, mit Nummer und Entfernung, oder `null`.
 *
 * Genannt wird sie, wenn sie näher liegt als die gewählte Strecke und dabei
 * entweder in Ortungsnähe (Abweichungsschwelle) oder die gewählte jenseits
 * jeder Umgehung (Abseitsschwelle). Im Audit landete „Punkt hier“ nach dem
 * Neuladen an Strecke 1, und das Blatt fragte „5,86 km … Stimmt die
 * Ortung?“ – die Ortung stimmte, die Strecke nicht. `offen` sagt, ob der
 * Punkt dort noch eine Aufnahme braucht.
 */
export function andereStreckeNahe(projekt, strecke, bei) {
  const eigene = strecke && strecke.punkte.length
    ? Math.min(...strecke.punkte.map(pt => distanz(pt, bei))) : Infinity;
  let best = null;
  for (const s of (projekt && projekt.strecken) || []) {
    if (s === strecke) continue;
    const belegt = new Set(istPunkte(s).map(pt => pt.sollPunkt).filter(Boolean));
    s.punkte.forEach((pt, i) => {
      const weg = distanz(pt, bei);
      if (!best || weg < best.weg) {
        best = { strecke: s, punkt: pt, nr: i + 1, weg, offen: !belegt.has(pt.id) };
      }
    });
  }
  if (!best || best.weg >= eigene || best.weg >= ABSEITS_SCHWELLE) return null;
  return best.weg < ABWEICHUNG_SCHWELLE || eigene >= ABSEITS_SCHWELLE ? best : null;
}

/**
 * Einen aufgenommenen Punkt an eine andere Strecke hängen – samt allem, was
 * der Trupp an ihm eingetragen hat. Ein offener geplanter Punkt dort wird ihm
 * zugeordnet, sonst steht er dort als zusätzlicher.
 *
 * Gelöscht und neu angelegt statt verschoben: die Stelle in der Liste folgt
 * der Ordnung der Zielstrecke, und der Bauabschnitt der alten gilt dort nicht.
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function istPunktUmhaengen(von, nach, ist, sollPid, abschnittId) {
  if (!von.bau || !von.bau.punkte.includes(ist)) return null;
  von.bau.punkte = von.bau.punkte.filter(pt => pt !== ist);
  const soll = sollPid ? nach.punkte.find(pt => pt.id === sollPid) : null;
  const frei = soll && !istPunkte(nach).some(pt => pt.sollPunkt === soll.id);
  /* Die Zuordnung erst danach und über denselben Weg wie in der Punktkarte –
     so bekommt der Punkt dort die Art des Plans, wenn er noch keine hat. */
  const neu = istPunktSetzen(nach, ist.lat, ist.lng, {
    quelle: ist.quelle, genauigkeit: ist.genauigkeit, zeit: ist.zeit,
    art: ist.art, bauweise: ist.bauweise, name: ist.name,
    abschnitt: abschnittId || null
  });
  neu.bemerkung = ist.bemerkung || '';
  if (frei) istSollZuordnen(nach, neu, soll.id);
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
    if (a.ausfallNach === pid) a.ausfallNach = null;
  });
  if (bau.ausfallNach === pid) bau.ausfallNach = null;
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
  /* Ohne Angabe der Abschnitt des Geräts, aus demselben Grund wie beim Punkt
     (`abschnittNachtragen`): eine Meldung ohne Abschnitt ging nicht hinaus. */
  const eigener = abschnitt || (aktiverBauabschnitt(strecke) || {}).id || null;
  const m = neueBaumeldung({ text, abschnitt: eigener, ...nachtragFelder() });
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
  const z = neuePruefzeile({ art, stamm: `Stamm ${pr.staemme.length + 1}`, ...nachtragFelder() });
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
      ? { trupp: String(roh.trupp || ''), fuehrer: String(roh.fuehrer || ''),
          frueher: frueherLesen(roh.frueher) }
      : { trupp: '', fuehrer: '', frueher: [] };
  } catch {
    /* Ein privates Fenster oder ein voller Speicher darf den Baumodus nicht
       aufhalten – dann steht der Name eben nur für diese Sitzung. */
    truppVermerk = { trupp: '', fuehrer: '', frueher: [] };
  }
  return truppVermerk;
}

const frueherLesen = x =>
  (Array.isArray(x) ? x : []).map(y => String(y || '').trim()).filter(Boolean).slice(-8);

/* `frueher`: die Namen, unter denen dieses Gerät vorher baute. Gebraucht wird
   das, damit der Rückmeldeblock einen Abschnitt, der nach „Neuer Abschnitt“
   beim alten Namen stehen blieb, nicht als „das meldet der andere Trupp
   selbst“ ausgibt – den anderen Trupp gibt es nicht, es war dieses Gerät. */
export function truppAmGeraetSetzen(o) {
  const vorher = truppVermerk || truppAmGeraet();
  const neu = String(o.trupp || '').trim();
  let frueher = o.frueher !== undefined ? frueherLesen(o.frueher) : frueherLesen(vorher.frueher);
  if (o.frueher === undefined && vorher.trupp.trim() &&
      truppSchluessel(vorher.trupp) !== truppSchluessel(neu) &&
      !frueher.some(x => truppSchluessel(x) === truppSchluessel(vorher.trupp))) {
    frueher = frueherLesen([...frueher, vorher.trupp]);
  }
  truppVermerk = { trupp: String(o.trupp || ''), fuehrer: String(o.fuehrer || ''), frueher };
  try {
    if (truppVermerk.trupp || truppVermerk.fuehrer) {
      localStorage.setItem(TRUPP_SCHLUESSEL, JSON.stringify(truppVermerk));
    } else {
      localStorage.removeItem(TRUPP_SCHLUESSEL);
    }
  } catch { /* siehe oben */ }
  return truppVermerk;
}

/* Gehört der Abschnitt dem Trupp `ich`? Eigen ist einer, dessen Trupp (oder,
   ohne Trupp, dessen Name) der Trupp am Gerät ist; so legt ihn auch „Welcher
   Trupp seid ihr?“ an. */
const gehoertZu = (a, ich) =>
  truppSchluessel(a.trupp ? a.trupp : a.name) === truppSchluessel(ich);

/**
 * Der Vergleichsschlüssel eines Truppnamens: ohne Groß-/Kleinschreibung,
 * Leerzeichen und Punkte. „1. fmtr“, „1.FmTr“ und „1. FmTr“ sind derselbe
 * Trupp – am Telefon tippt niemand die Schreibweise des Planers nach, und
 * der genaue Vergleich machte aus einem Tippfehler im Namen einen „nicht
 * aufgetragenen“ Trupp mit eigenem Abschnitt, dessen Meldung beim Planer
 * neben der des richtigen stand. Die Anzeige behält die Schreibweise, die
 * jemand eingegeben hat; verglichen wird nur hierüber. Ein Vergleich in
 * anderen Modulen (Absender in `baumeldung.js`) darf diese Funktion nutzen –
 * sie hängt von nichts ab.
 */
export function truppSchluessel(name) {
  /* Ziffer, Punkt, Ziffer ist eine Nummer („1.2 FmTr“), kein Gliederungspunkt:
     der Schlüssel strich ihn mit allen anderen Punkten und machte „1.2 FmTr“
     zu „12 FmTr“. Er bleibt hier als Komma stehen. Der Bindestrich gilt wie
     das Leerzeichen („FmTr-1“ = „FmTr 1“), zwischen Ziffern aber ebenso als
     Trenner. Bestehende Zuordnungen bleiben: alles, was vorher gleich war,
     und nichts als diese Nummern, ist weiter gleich. */
  return String(name || '').normalize('NFKC').toLowerCase()
    .replace(/(\d)[.\-–](?=\d)/g, '$1,')
    .replace(/[\s.\u00a0\-–_\u00ad]+/g, '');
}

/** Hieß dieses Gerät früher so? (Siehe `truppAmGeraetSetzen`.) */
export const warTruppDieses = name =>
  truppAmGeraet().frueher.some(x => truppSchluessel(x) === truppSchluessel(name));

/** Der aufgetragene Trupp, den diese Eingabe meint – in der Schreibweise des
 *  Planers, oder `null`, wenn sie keinen der aufgetragenen trifft */
export function aufgetragenerTrupp(s, eingabe) {
  const k = truppSchluessel(eingabe);
  return k ? auftragsTrupps(s).find(x => truppSchluessel(x) === k) || null : null;
}

/* Derselbe Vergleich unter dem Namen, den `gleicherTrupp` in baumeldung.js
   benutzt: Absendererkennung und Abschnittszuordnung müssen dasselbe Maß
   anlegen, sonst gilt ein Abschnitt hier als fremd und dort als eigen. */
export const truppName = truppSchluessel;

/**
 * Die Bauabschnitte, die diesem Gerät gehören – oder `null`, wenn sich nicht
 * entscheiden lässt, was fremd ist.
 *
 * Gebraucht wird das auf dem Rückweg: ein zweiter Auftrag an denselben Trupp
 * trägt den ganzen Bau-Block, wie ihn der Planer zuletzt hatte – samt dem
 * Abschnitt des anderen Trupps. Ging der mit der nächsten Meldung zurück,
 * überschrieb beim Planer der alte Stand von „1. FmTr“ den neuen, gemeldet von
 * „2. FmTr“ (`alsBaumeldung` in teilen.js). Kennt das Gerät seinen Trupp
 * nicht, bleibt alles wie bisher: dann ist nicht zu entscheiden, was fremd ist.
 *
 * Kennt es seinen Trupp, und die Strecke trägt nur Abschnitte ANDERER Trupps
 * (Gerät „3. FmTr“, aufgetragen „1. FmTr und 2. FmTr“), ist das Ergebnis eine
 * LEERE Menge und nicht `null`: vorher hieß das „alles geht hinaus“, und beim
 * Planer ersetzte die Meldung die Aufnahme beider anderen Trupps. Ein
 * Abschnitt ohne Trupp unter anderem Namen zählt dabei nicht als fremd – er
 * nennt keinen Trupp, und wer ein Gerät mit Namen und selbst angelegte
 * Abschnitte hat, meldet sie weiter wie bisher.
 */
export function eigeneAbschnitte(s) {
  const ich = truppAmGeraet().trupp.trim();
  if (!ich) return null;
  const alle = bauabschnitte(s);
  const eigene = alle.filter(a => gehoertZu(a, ich));
  if (eigene.length) return new Set(eigene.map(a => a.id));
  return alle.some(a => a.trupp && a.trupp.trim()) ? new Set() : null;
}

/** Ein Bauabschnitt, der nach `eigeneAbschnitte` einem anderen Trupp gehört –
 *  auf diesem Gerät nur zur Ansicht, er geht mit der Meldung nicht hinaus */
export function fremderAbschnitt(s, a) {
  const eigene = eigeneAbschnitte(s);
  return !!eigene && !eigene.has(a.id);
}

/** Wer die Meldung absetzt, in einer Zeile – Bauabschnitte gehen vor, denn sie
 *  stehen in der Planung und sagen, wer welchen Teil gebaut hat */
export function absenderText(strecken) {
  const v = truppAmGeraet();
  const ausAbschnitten = new Set();
  for (const s of strecken) {
    /* Nur die Abschnitte, die auch hinausgehen: der Planer las sonst „1. FmTr,
       2. FmTr“ über der Meldung eines einzigen Trupps. */
    const eigene = eigeneAbschnitte(s);
    for (const a of bauabschnitte(s)) {
      if (!a.trupp || (eigene && !eigene.has(a.id))) continue;
      /* Der Truppführer reist mit. Ohne ihn war beim Planer „1. FmTr“ vom
         „1. FmTr“ eines anderen Geräts nicht zu unterscheiden – im Audit
         baute ein zweiter Trupp unter der vorgewählten Bezeichnung des ersten,
         und die Warnung vor einem anderen Absender schlug nicht an. */
      const fuehrer = a.fuehrer ||
        (truppSchluessel(a.trupp) === truppSchluessel(v.trupp) ? v.fuehrer : '');
      ausAbschnitten.add([a.trupp, fuehrer].filter(Boolean).join(' · '));
    }
  }
  if (ausAbschnitten.size) return [...ausAbschnitten].join(', ');
  return [v.trupp, v.fuehrer].filter(Boolean).join(' · ');
}

// ------------------------------------- Ein Trupp-Wechsel hat zwei Hälften

/* „Trupp wechseln“ und die erste Wahl stellen zweierlei um: den Abschnitt in
   der Planung (im Rückgängig-Verlauf) und den Trupp am Gerät (im Gerätespeicher,
   dort gehört er hin – siehe `truppAmGeraet`). „↶“ nahm nur die erste Hälfte
   zurück: der Abschnitt hieß wieder „1. FmTr“, das Gerät blieb „2. FmTr“, der
   Abschnitt galt als fremd, und die Baumeldung trug null Punkte. Dieselbe
   Zweiteilung ist beim Umhängen eines Punktes in `rueckgaengig` (app.js)
   gelöst; hier wird der Gerätetrupp mit dem Schritt zurückgeholt.

   Erkannt wird der Schritt am Zeitstempel der Planung: der Stand vor ihm und
   der Stand nach ihm tragen je ihr eigenes `geaendert`. Ein Verbund im
   Schrittstapel selbst hätte `state.js` und das Format des Verlaufs berührt.
   Gemerkt wird im Sitzungsspeicher, wie der Verlauf – ein Neuladen mitten im
   Zurücknehmen soll den Gerätetrupp nicht vom Abschnitt trennen. */
const SCHRITTE_SCHLUESSEL = 'fbp.truppschritte.v1';
let truppSchritte = null;

function truppSchritteLaden() {
  if (truppSchritte) return truppSchritte;
  try {
    const roh = JSON.parse(sessionStorage.getItem(SCHRITTE_SCHLUESSEL) || '[]');
    truppSchritte = Array.isArray(roh) ? roh : [];
  } catch { truppSchritte = []; }
  return truppSchritte;
}

/** Festhalten, dass ein Schritt der Planung zugleich den Gerätetrupp umstellte.
 *  `vorherGeaendert` ist der Zeitstempel VOR `store.aendern`, `projekt` der
 *  Stand danach; `vorher` und `nachher` sind die Gerätevermerke. */
export function truppSchrittMerken(projekt, vorherGeaendert, vorher, nachher) {
  if (!projekt || !vorherGeaendert || vorherGeaendert === projekt.geaendert) return;
  const liste = truppSchritteLaden();
  liste.push({ id: projekt.id, vor: vorherGeaendert, nach: projekt.geaendert,
    vorher: { trupp: vorher.trupp || '', fuehrer: vorher.fuehrer || '',
      frueher: [...(vorher.frueher || [])] },
    nachher: { trupp: nachher.trupp || '', fuehrer: nachher.fuehrer || '',
      frueher: [...(nachher.frueher || [])] } });
  if (liste.length > 20) liste.shift();
  try { sessionStorage.setItem(SCHRITTE_SCHLUESSEL, JSON.stringify(liste)); } catch { /* ohne */ }
}

/** Nach „↶“ oder „↷“: gehört der Stand zu einem Trupp-Wechsel, den Gerätetrupp
 *  mitnehmen. Gibt den Trupp zurück, auf den das Gerät jetzt steht, sonst `null`. */
export function truppSchrittNachfuehren(projekt) {
  if (!projekt) return null;
  const r = truppSchritteLaden().find(x => x.id === projekt.id &&
    (x.vor === projekt.geaendert || x.nach === projekt.geaendert));
  if (!r) return null;
  const ziel = r.vor === projekt.geaendert ? r.vorher : r.nachher;
  const jetzt = truppAmGeraet();
  if (jetzt.trupp === ziel.trupp && jetzt.fuehrer === ziel.fuehrer) return null;
  truppAmGeraetSetzen(ziel);
  return ziel;
}

// ------------------------------------------------- Welcher Trupp, rechtzeitig

/* Hat der Planer mehrere Trupps aufgetragen, fragt „Bau beginnen“, welcher
   dieses Gerät ist. Wer dort „Später“ drückte, wurde nie wieder gefragt – und
   jede Aufnahme danach lief ohne Bauabschnitt hinaus und trat beim Planer an
   die Stelle der Aufnahme des anderen Trupps. Gefragt wird deshalb noch einmal
   bei der ersten Aufnahme, und zwar HIER, wo jeder Aufnahmeweg vorbeikommt –
   Liste, Bauleiste, Punktkarte, Kartentipp. Ein Haken an jedem dieser Wege
   wäre spätestens beim nächsten neuen Weg vergessen worden.

   Der Punkt entsteht dabei trotzdem: die Frage kommt danach und nicht davor,
   denn wer an der Muffe steht, soll die Ortung nicht verlieren, weil ein
   Dialog dazwischenkam. Fällt die Wahl, bekommt er seinen Abschnitt
   nachträglich. Die Frage selbst stellt die Oberfläche
   (`truppFrageAnmelden`) – hier steht nur, wann. */
let truppFrage = null;
export function truppFrageAnmelden(fn) { truppFrage = fn; }

/** Muss dieses Gerät noch sagen, welcher der aufgetragenen Trupps es ist?
 *  Auch dann, wenn es einen Trupp kennt, der nicht darunter ist (siehe
 *  `truppNichtAufgetragen`): eigene Abschnitte hat es an dieser Strecke nicht. */
export const truppWahlOffen = s => {
  const eigene = eigeneAbschnitte(s);
  return auftragsTrupps(s).length >= 2 && !(eigene && eigene.size);
};

/** Kennt das Gerät seinen Trupp, und der Planer hat der Strecke mehrere andere
 *  aufgetragen? Dann ist „3. FmTr“ weder „1. FmTr“ noch „2. FmTr“, und die
 *  Frage lautet nicht „welcher von beiden“, sondern „eigener Abschnitt?“ –
 *  vorher blieb nur, sich unter fremdem Namen einzutragen. */
export function truppNichtAufgetragen(s) {
  const ich = truppAmGeraet().trupp.trim();
  const trupps = auftragsTrupps(s);
  return !!ich && trupps.length >= 2 && !aufgetragenerTrupp(s, ich);
}

/* Zweimal „Später“ an derselben Strecke, und die Frage ruht. Sie kam nach
   jedem Punkt wieder – ein Modal nach jeder Aufnahme, bei zwanzig Punkten am
   Tag zwanzigmal, und der Trupp, der „Später“ meint, drückte es zwanzigmal.
   Dagegen steht die Festlegung, dass die Frage wiederkommt, weil ohne Wahl der
   Abschnitt fehlt und die Meldung beim Planer die des anderen Trupps ersetzt.
   Verträglich ist beides so: gefragt wird weiter, nur nicht mehr mit einem
   Dialog nach jedem Punkt, sondern über die feste Marke „Trupp wählen“ (Leiste
   und Bau-Reiter) – die verschwindet erst mit der Wahl, und das Neuladen holt
   die Frage ohnehin zurück. Der Zähler lebt nur in der Sitzung, mit Absicht. */
const truppFrageSpaeter = new Map();

/** „Später“ wurde gedrückt: einmal mehr vertagt */
export function truppFrageVertagen(strecke) {
  truppFrageSpaeter.set(strecke.id, (truppFrageSpaeter.get(strecke.id) || 0) + 1);
}

/** Hat der Trupp die Frage an dieser Strecke schon zweimal vertagt? Dann
 *  kommt sie nicht mehr von selbst, sondern über die Marke „Trupp wählen“. */
export const truppFrageRuht = strecke => (truppFrageSpaeter.get(strecke.id) || 0) >= 2;

/* Die Frage kommt bei JEDER Aufnahme ohne Abschnitt wieder, solange keine
   Wahl getroffen ist – nicht nur einmal je Sitzung und Strecke: wer einmal
   „Später“ sagte oder den Dialog mit einem Fehltipp verlor, baute sonst bis
   zum Neuladen ohne Abschnitt, und beim Planer ersetzte seine Meldung die
   Aufnahme des anderen Trupps. Höchstens einmal je Aufnahme und nie über einer
   Eingabe regelt die Oberfläche (`truppFrageAnmelden` in app.js). */
function truppFrageVormerken(strecke, neu) {
  if (neu.abschnitt || !truppFrage || !truppWahlOffen(strecke)) return;
  if (truppFrageRuht(strecke)) return;
  const sid = strecke.id;
  setTimeout(() => truppFrage && truppFrage(sid), 0);
}

// ---------------------------------------------- Was ohne Abschnitt dasteht

/* Einträge ohne Bauabschnitt gehen mit einer Meldung dieses Geräts nicht
   hinaus, sobald das Gerät eigene Abschnitte kennt (`bauVerschlanken`): sie
   könnten der Bestand des Planers sein, und der gehört nicht in die Meldung
   dieses Trupps. Still weglassen durfte das Gerät sie trotzdem nie – im Review
   gingen zwei Punkte und eine Meldung am Gerät als null in die Baumeldung. Hier
   steht, wie viele es sind und wie sie zu einem Abschnitt kommen. */

/** Wie viel an dieser Strecke keinem Bauabschnitt angehört */
export function ohneAbschnitt(s) {
  const bau = s && s.bau;
  const zahl = liste => (liste || []).filter(x => !x.abschnitt).length;
  const r = bau ? { punkte: zahl(bau.punkte), material: zahl(bau.material),
    meldungen: zahl(bau.meldungen) } : { punkte: 0, material: 0, meldungen: 0 };
  r.summe = r.punkte + r.material + r.meldungen;
  return r;
}

/** Was ohne Abschnitt dasteht, in einem Satzteil: „2 Punkte, 1 Meldung“ */
export function ohneAbschnittText(s) {
  const r = ohneAbschnitt(s);
  const z = (n, eins, viele) => n ? `${n} ${n === 1 ? eins : viele}` : '';
  return [z(r.punkte, 'Punkt', 'Punkte'), z(r.material, 'Materialzeile', 'Materialzeilen'),
    z(r.meldungen, 'Meldung', 'Meldungen')].filter(Boolean).join(', ');
}

/** Alles ohne Abschnitt dem Abschnitt `aid` zuordnen. Die Materialzeilen
 *  werden danach zusammengezogen – eine gleiche Zeile im Abschnitt zählte
 *  sonst doppelt. Nur innerhalb von `store.aendern` aufrufen. */
export function ohneAbschnittZuordnen(s, aid) {
  const bau = s && s.bau;
  if (!bau || !aid) return 0;
  let n = 0;
  for (const liste of [bau.punkte, bau.material, bau.meldungen]) {
    for (const x of liste || []) if (!x.abschnitt) { x.abschnitt = aid; n++; }
  }
  bau.material = materialZusammenfassen(bau.material || []);
  return n;
}

/** Den Abschnitt dieses Trupps an der Strecke – gibt es ihn nicht, wird er
 *  angelegt. Nur innerhalb von `store.aendern` aufrufen. */
export function eigenenAbschnittSichern(strecke, trupp, fuehrer = '') {
  const name = String(trupp || '').trim();
  let a = bauabschnitte(strecke).find(x => gehoertZu(x, name));
  if (!a) {
    a = bauabschnittAnlegen(strecke);
    a.name = name; a.trupp = name; a.fuehrer = fuehrer;
  } else if (fuehrer && !a.fuehrer) a.fuehrer = fuehrer;
  return a;
}

/** Die Abschnitte, in die dieses Gerät eintragen darf: die eigenen, und
 *  solange es keinen Trupp kennt, alle. Fremde sind nicht wählbar – wer unter
 *  dem Abschnitt eines anderen Trupps aufnimmt, ersetzt beim Planer dessen
 *  Aufnahme. */
export function waehlbareAbschnitte(s) {
  const eigene = eigeneAbschnitte(s);
  return eigene ? bauabschnitte(s).filter(a => eigene.has(a.id)) : bauabschnitte(s);
}

// ------------------------------------------------------------ Was hinausging

/* Der Vermerk über die abgesetzte Baumeldung. Er ist die Antwort auf die eine
   Frage, die der Truppführer nach jeder Unterbrechung stellt: „Habe ich das
   schon gemeldet?“ Vorher sah der Rückmeldeblock vor und nach dem Absetzen
   gleich aus, und der Bau-Block war zeichengleich – die Frage war am Gerät
   nicht zu beantworten. */

/** Festhalten, dass die Baumeldung dieser Strecke hinausgegangen ist.
 *  Nur innerhalb von `store.aendern` aufrufen. */
export function absetzenVermerken(strecke, weg, code = '') {
  const bau = bauSichern(strecke);
  bau.abgesetzt = {
    zeit: new Date().toISOString(),
    weg: weg === 'datei' ? 'datei' : 'link',
    abdruck: bauAbdruck(strecke, eigeneAbschnitte(strecke)),
    /* Der Rückgabe-Code, wie er hinausging. Der Rückmeldeblock zeigt sonst nur
       den von JETZT – nach der nächsten Eintragung war der verschickte weg,
       und nannte der Planer über Funk „5QVV“, stand am Gerät „VHTP“ und kein
       Weg, die beiden zusammenzubringen. */
    code: String(code || '')
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
  if (!a || !a.zeit) return { stand: 'nie', zeit: '', weg: '', code: '' };
  const jetzt = bauAbdruck(strecke, eigeneAbschnitte(strecke));
  const geaendert = !!(a.abdruck && jetzt && a.abdruck !== jetzt);
  return { stand: geaendert ? 'veraltet' : 'aktuell', zeit: a.zeit, weg: a.weg, code: a.code || '' };
}

/** Der jüngste Absetz-Vermerk über mehrere Strecken – der Stand des Trupps */
export function absetzstandGesamt(strecken) {
  const staende = strecken.map(absetzstand).filter(x => x.stand !== 'nie');
  if (!staende.length) return { stand: 'nie', zeit: '', weg: '', code: '' };
  const juengster = staende.reduce((a, b) => (b.zeit > a.zeit ? b : a));
  /* Eine einzige veraltete Strecke macht den ganzen Stand veraltet: gemeldet
     wird über alle zusammen, und der Planer bekäme sonst eine Strecke ohne die
     Punkte, die seit der letzten Meldung dazugekommen sind. */
  const veraltet = staende.some(x => x.stand === 'veraltet') ||
    strecken.some(s => bauBegonnen(s) && absetzstand(s).stand === 'nie');
  return { ...juengster, stand: veraltet ? 'veraltet' : 'aktuell' };
}

// ---------------------------------------------------------------- Lichtbilder

/* Wie weit ein Lichtbild neben der Trasse aufgenommen sein darf, um noch zu
   ihr zu gehören. Ein Bild hängt an keiner Strecke, sondern nur an seinem
   Aufnahmeort – die Zuordnung ergibt sich deshalb aus dem Abstand. Die Ortung
   des Telefons streut um 5 bis 30 m, und wer eine Querung oder einen Mast
   fotografiert, tritt dafür einige Schritte zurück. Bei 25 m wie für die
   Abweichung fehlte ausgerechnet die Übersichtsaufnahme; bei mehreren hundert
   Metern stünden die Bilder der Nachbarstrecke mit auf dem Nachweis. */
export const BILD_KORRIDOR = 100;

/* Lotabstand auf ein Trassenstück in Metern, in einer ebenen Näherung um den
   Bildort. Auf die hier gefragten hundert Meter ist das genauer als die
   Ortung, von der das Bild kommt. */
function lotMeter(b, a, c) {
  const kx = 111320 * Math.cos(b.lat * Math.PI / 180), ky = 110540;
  const ax = (a.lng - b.lng) * kx, ay = (a.lat - b.lat) * ky;
  const cx = (c.lng - b.lng) * kx, cy = (c.lat - b.lat) * ky;
  const dx = cx - ax, dy = cy - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function abstandZurLinie(b, punkte) {
  if (!punkte.length) return Infinity;
  if (punkte.length === 1) return distanz(punkte[0], b);
  let min = Infinity;
  for (let i = 1; i < punkte.length; i++) min = Math.min(min, lotMeter(b, punkte[i - 1], punkte[i]));
  return min;
}

/**
 * Die Lichtbilder, die zu einer Strecke gehören: aufgenommen innerhalb von
 * `BILD_KORRIDOR` um die geplante ODER die gebaute Trasse. Beide zählen, denn
 * gerade an der Stelle, an der der Trupp ausgewichen ist, entsteht das Bild,
 * das die Abweichung begründet – und sie liegt fern der Planung.
 *
 * Ein Bild ohne Ort lässt sich keiner Strecke zuordnen, ein verborgenes hat
 * jemand bewusst von der Karte genommen; beide bleiben weg.
 *
 * Geordnet nach dem nächsten geplanten Punkt und darin nach der Aufnahmezeit –
 * so, wie das Blatt die Trasse abläuft.
 *
 * @returns {{bild:object, nah:number, ort:string}[]} `nah` ist der Index des
 *   nächsten geplanten Punktes, `ort` die Angabe „40 m NO von Punkt 7“
 */
export function bilderAnStrecke(p, s) {
  const soll = s.punkte || [];
  const ist = istPunkte(s);
  const treffer = [];
  for (const b of (p && p.bilder) || []) {
    if (!bildAufKarte(b)) continue;
    const abstand = Math.min(abstandZurLinie(b, soll), abstandZurLinie(b, ist));
    if (abstand > BILD_KORRIDOR) continue;
    treffer.push({ bild: b, ...ortZurTrasse(b, soll.length ? soll : ist, !soll.length) });
  }
  return treffer.sort((a, c) =>
    a.nah - c.nah || (a.bild.aufgenommen || '').localeCompare(c.bild.aufgenommen || ''));
}

/* Der Ort im Sprachgebrauch der Baumeldung, bezogen auf den nächsten Punkt.
   Unter 20 m ist die Richtungsangabe im Gelände nicht mehr auffindbar – wie
   bei `standortText()` in `js/geo.js`. */
function ortZurTrasse(b, punkte, nurIst) {
  if (!punkte.length) return { nah: 0, ort: '' };
  let nah = 0, abstand = Infinity;
  punkte.forEach((pt, i) => {
    const d = distanz(pt, b);
    if (d < abstand) { abstand = d; nah = i; }
  });
  const pt = punkte[nah];
  const name = pt.name || `${nurIst ? 'aufgenommenem Punkt' : 'Punkt'} ${nah + 1}`;
  const ort = abstand < 20 ? `an ${name}`
    : `${meter(abstand)} ${himmelsrichtung(peilung(pt, b))} von ${name}`;
  return { nah, ort };
}

// ---------------------------------------------------------------- Kennzahlen

/**
 * Die gebaute Trasse, zerlegt in die Stücke, die zusammenhängend gebaut sind,
 * und die Lücken dazwischen.
 *
 * Vorher wurde jeder Ist-Punkt mit dem nächsten verbunden. Beim
 * abschnittsweisen Bau (Hdb Feldfernkabelbau, 3.6) zog das die kräftige Linie
 * von Trupp 1 quer über die noch offenen Punkte bis zu Trupp 2 – auf der Karte
 * und im Nachweis gebaut, was niemand gebaut hat, und in der Länge mitgezählt.
 *
 * Getrennt wird zwischen zwei Punkten, die einen Planbezug haben, wenn
 *  - zwischen ihren geplanten Stellen ein Planpunkt liegt, den niemand
 *    bestätigt hat – dort ist entweder nichts gebaut oder nichts aufgenommen,
 *    und beides ist dieselbe Nachfrage wie „fehlend“ im Zähler; oder
 *  - sie verschiedenen Bauabschnitten angehören und keinen gemeinsamen Punkt
 *    haben. Bestätigen beide Trupps denselben Treffpunkt, stehen zwei Punkte an
 *    derselben Planstelle, und das Stück zwischen ihnen ist die Naht und keine
 *    Lücke. Ohne gemeinsamen Punkt weiß niemand, wer das Stück dazwischen
 *    gebaut hat. Ein Punkt OHNE Bauabschnitt erhebt keinen Anspruch und trennt
 *    nichts: wer ohne Abschnitt aufnimmt, baut allein.
 *
 * Ein Punkt ohne Planbezug trennt nie: er hängt an seinem Vorgänger, wie in
 * `istPunkteOrdnen()` (baumeldung.js). Deshalb bleibt ein Bau mit
 * Zusatzpunkten eine Linie, solange die geplanten Punkte davor und dahinter
 * bestätigt sind. Fällt eine Trennung in eine Folge von Zusatzpunkten, liegt
 * sie dort, wo der Bauabschnitt wechselt, sonst vor dem nächsten bestätigten
 * Punkt.
 *
 * Die Lücke läuft über die offenen Planpunkte und nicht als Luftlinie: sie ist
 * das, was nach dem Auftrag noch zu bauen ist, und so lang ist sie auch.
 *
 * @returns {{stuecke: object[][], luecken: {von:object, bis:object,
 *   punkte:object[], laenge:number}[], laenge:number, lueckeLaenge:number,
 *   treffpunkte: {nummer:number, abschnitte:string[]}[]}}
 */
export function istVerlauf(strecke) {
  const ist = istPunkte(strecke);
  const soll = strecke.punkte || [];
  const ordnung = new Map(soll.map((pt, i) => [pt.id, i]));
  const rang = pt => (pt.sollPunkt && ordnung.has(pt.sollPunkt)) ? ordnung.get(pt.sollPunkt) : null;
  const bestaetigt = new Set(ist.map(rang).filter(r => r !== null));
  /* Welche Planpunkte jeder Bauabschnitt bestätigt hat. Haben zwei Abschnitte
     einen davon gemeinsam, ist der Treffpunkt erreicht und das Stück zwischen
     ihnen zusammenhängend gebaut – gleich, in welcher Reihenfolge ihre
     Punkte in der Liste stehen. Gemessen wurde vorher nur am unmittelbaren
     Nachbarn: lagen die beiden Bestätigungen des Treffpunkts hintereinander,
     stand davor „Abschnitt 1, Punkt 3“ neben „Abschnitt 2, Punkt 4“, und aus
     dem Treffpunkt wurden zwei Lücken (262 m, im Review 524 m Unterschied). */
  const geteilt = new Map();
  for (const pt of ist) {
    const r = rang(pt);
    if (r === null || !pt.abschnitt) continue;
    if (!geteilt.has(pt.abschnitt)) geteilt.set(pt.abschnitt, new Set());
    geteilt.get(pt.abschnitt).add(r);
  }
  const treffpunkt = (x, y) => {
    const a = geteilt.get(x), b = geteilt.get(y);
    return !!(a && b && [...a].some(r => b.has(r)));
  };

  /* Nach welchem Punkt der Liste getrennt wird – und über welche Planpunkte */
  const trennung = new Map();
  let vorher = -1;
  for (let i = 0; i < ist.length; i++) {
    const r = rang(ist[i]);
    if (r === null) continue;
    if (vorher >= 0) {
      const a = ist[vorher], b = ist[i], ra = rang(a);
      const schritt = r >= ra ? 1 : -1;
      const zwischen = [];
      if (r !== ra) for (let j = ra + schritt; j !== r; j += schritt) zwischen.push(j);
      const offen = zwischen.some(j => !bestaetigt.has(j));
      const naht = a.abschnitt && b.abschnitt && a.abschnitt !== b.abschnitt &&
        !treffpunkt(a.abschnitt, b.abschnitt);
      if (offen || naht) {
        let k = i - 1;
        for (let j = vorher; j < i; j++) {
          if ((ist[j].abschnitt || null) !== (ist[j + 1].abschnitt || null)) { k = j; break; }
        }
        trennung.set(k, zwischen.map(j => soll[j]));
      }
    }
    vorher = i;
  }

  const stuecke = [];
  const luecken = [];
  let stueck = [];
  ist.forEach((pt, i) => {
    stueck.push(pt);
    if (!trennung.has(i)) return;
    stuecke.push(stueck);
    stueck = [];
    const punkte = [pt, ...trennung.get(i), ist[i + 1]];
    luecken.push({ von: pt, bis: ist[i + 1], punkte, laenge: streckenlaenge(punkte) });
  });
  if (stueck.length) stuecke.push(stueck);

  const laenge = stuecke.reduce((n, st) => n + (st.length >= 2 ? streckenlaenge(st) : 0), 0);
  const lueckeLaenge = luecken.reduce((n, l) => n + l.laenge, 0);
  /* Die Treffpunkte: Planpunkte, die zwei Bauabschnitte bestätigt haben. Auf
     dem Blatt der Baudokumentation stand bisher nur die Lücke – wo sich die
     Trupps trafen, war dort so wenig zu lesen wie, wer welches Stück gebaut
     hat. `nummer` ist die Nummer des Planpunktes (ab 1), `abschnitte` die
     Kennungen der Abschnitte, in der Reihenfolge ihrer Bauabschnitte. */
  const bestaetiger = new Map();
  for (const pt of ist) {
    const r = rang(pt);
    if (r === null || !pt.abschnitt) continue;
    if (!bestaetiger.has(r)) bestaetiger.set(r, new Set());
    bestaetiger.get(r).add(pt.abschnitt);
  }
  const treffpunkte = [...bestaetiger.entries()].filter(([, a]) => a.size > 1)
    .sort((a, b) => a[0] - b[0]).map(([r, a]) => ({ nummer: r + 1, abschnitte: [...a] }));
  return { stuecke, luecken, laenge, lueckeLaenge, treffpunkte };
}

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
  /* Gezählt wird, was zusammenhängend gebaut ist – die Lücke zwischen zwei
     Bauabschnitten ist keine Trasse (siehe `istVerlauf`). */
  const verlauf = istVerlauf(strecke);
  const laenge = verlauf.laenge;
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

  const abseits = [];
  if (soll.length) {
    for (const pt of ist) {
      /* Auch ein BESTÄTIGTER Punkt kann weit weg liegen – eine Ortung 80 km
         daneben, zweimal angetippt. Im Audit nannte die Warnung oben nur den
         Zusatzpunkt, der bestätigte stand mit grünem Haken darunter. Gemessen
         wird er gegen seinen geplanten Punkt, nicht gegen die Linie. */
      const s = pt.sollPunkt ? sollZuIst(strecke, pt) : null;
      const meter = s ? distanz(s, pt) : abstandZurLinie(pt, soll);
      if (meter >= ABSEITS_SCHWELLE) abseits.push({ ist: pt, meter, soll: s });
    }
    abseits.sort((a, b) => b.meter - a.meter);
  }

  /* Eine gebaute Trasse, die mehr als doppelt so lang ist wie die geplante,
     ist keine Umgehung mehr, sondern ein Punkt am falschen Ort. Der Sockel
     von einem Kilometer hält kurze Strecken heraus, bei denen zwei Umwege
     die Länge ehrlich verdoppeln. */
  const laengeFraglich = !!(laenge && sollLaenge && laenge > 2 * sollLaenge + 1000);

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
    /* Was zwischen den gebauten Stücken offen ist, entlang der Planung. Steht
       neben „gebaut“, damit beide zusammen erklären, warum die gebaute Länge
       kleiner ist als die geplante. */
    bauluecken: verlauf.luecken,
    lueckeLaenge: verlauf.lueckeLaenge,
    treffpunkte: verlauf.treffpunkte,
    /* Der Unterschied der Trassenlängen – die Zahl, die im Bauauftrag neben der
       geplanten steht. Ohne Vorzeichenspiel: kürzer ist so wenig „besser“ wie
       länger „schlechter“, beides ist eine Abweichung vom Auftrag. */
    laengenUnterschied: (laenge && sollLaenge) ? laenge - sollLaenge : 0,
    abweichungen,
    groessteAbweichung: abweichungen.length ? abweichungen[0].meter : 0,
    abseits,
    laengeFraglich,
    /* Ob der beruhigende Satz stehen darf. Er stand vorher schon, wenn nur die
       bestätigten Punkte passten – neben einer um 140 km zu langen Trasse. */
    stimmig: !abweichungen.length && !abseits.length && !laengeFraglich,
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

/** Der jüngste Eintrag vom Bauort – Meldung oder aufgenommener Punkt */
export function zuletztVomBau(strecke) {
  let zeit = '';
  for (const pt of istPunkte(strecke)) if (pt.zeit > zeit) zeit = pt.zeit;
  for (const m of baumeldungen(strecke)) if (m.zeit > zeit) zeit = m.zeit;
  return zeit;
}

/**
 * Was die Streckenzeile im Planungsmodus über den Bau sagt – oder `null`,
 * solange an der Strecke nichts gebaut wird.
 *
 * Die Marke IST der Baustand. Vorher trug jede Strecke mit einem einzigen
 * bestätigten Punkt dasselbe grüne „gebaut“ wie eine übergebene, und die
 * Führungsstelle zählte beim Überfliegen sechs fertige Leitungen, wo eine
 * übergeben war. Trupp, letzter Eintrag und die Meldung an den S 6 stehen
 * mit darin, weil sie die Fragen der Lagebesprechung sind: wer baut, wann
 * kam zuletzt etwas, und gibt es etwas, das ich wissen muss.
 */
export function bauzeile(strecke) {
  if (!bauBegonnen(strecke)) return null;
  const ausfallDa = geraeteAusfall(strecke);
  const k = baukennzahlen(strecke);
  const teile = [];
  if (k.sollPunkte) teile.push(`${k.bestaetigt}/${k.sollPunkte} Punkte`);
  /* Die Lücke zwischen zwei Bauabschnitten steht hier wie im Bau-Reiter und
     auf der Baudokumentation. Ohne sie las sich „4/7 Punkte“ zweier Trupps
     in der Liste wie ein Stück am Anfang der Trasse, nicht wie ein offenes
     Stück in der Mitte. Ohne ⚠: sie ist der Fortschritt beim abschnittsweisen
     Bau, kein Fehler. */
  if (k.lueckeLaenge) teile.push(`Lücke ${formatLaenge(k.lueckeLaenge)}`);
  const trupps = [...new Set(bauabschnitte(strecke).map(a => a.trupp).filter(Boolean))];
  /* Ohne Bauabschnitt nennt der Absender der letzten Meldung den Trupp – im
     Audit stand sonst nur „zuletzt 06:13“, und nach einer zweiten Meldung war
     nicht zu sehen, wessen Stand in der Liste steht. */
  if (!trupps.length && strecke.bau.gemeldetVon) trupps.push(strecke.bau.gemeldetVon);
  if (!trupps.length && strecke.trupp) trupps.push(strecke.trupp);
  if (trupps.length) teile.push(trupps.join(', '));
  /* Der Trupp auch einzeln: das Schild der Lagekarte trägt ihn in einer
     eigenen Zeile, nicht im Fließtext mit Punkten und Lücke. */
  const truppText = trupps.join(', ');
  /* Die Zeit des letzten Eintrags steht nicht mehr im Text: die Liste setzt
     sie mit ihrem Alter daneben („vor 2 h 50 min“). Eine bloße Uhrzeit las
     sich im Audit wie eine frische Meldung, auch drei Stunden später. */
  const zuletzt = zuletztVomBau(strecke);
  const warnungen = [];
  if (k.abweichungen.length) {
    warnungen.push(`${k.abweichungen.length} ${k.abweichungen.length === 1 ? 'Abweichung' : 'Abweichungen'}`);
  }
  if (k.abseits.length) {
    warnungen.push(`${k.abseits.length} ${k.abseits.length === 1 ? 'Punkt' : 'Punkte'} abseits`);
  }
  /* Vorne, weil sie schwerer wiegt als jede Abweichung: eine Leitung, die
     die Übernahmemessung nicht bestanden hat, ist nicht zu übergeben (Hdb
     Feldfernkabelbau, 3.5).
     Im Review stand eine solche Strecke in Liste, Summenband und Lagekarte
     als grünes „gebaut“ – der Baustand sagt, was der Trupp gemeldet hat, nicht
     ob es trägt. */
  if (k.uebergabe.durchgefallen) warnungen.unshift('Prüfung nicht bestanden');
  const meldung = ((strecke.bau && strecke.bau.abweichung) || '').trim();
  /* Der Geräteausfall steht an der Strecke und nicht nur im Rückmeldeblock des
     Trupps: ohne ihn war „seit 3 h ohne Meldung“ derselbe Satz für einen
     Trupp, der schweigt, und einen, der planmäßig auf Papier baut. */
  const ausfall = ausfallDa
    ? `Gerät ausgefallen${ausfallDa.zeit ? ` ab ${uhrzeit(ausfallDa.zeit)}` : ''} – Papier` : '';
  /* Die letzte Meldung hat eine Übergabe aufgehoben (`einspielen` in
     baumeldung.js). Der Stand sagt dann wieder „gebaut“ – ohne diese Zeile
     blieb von „1 übergeben“ im Summenband keine Spur, und niemand erfuhr, dass
     die Strecke zurückgefallen war. Nur solange sie nicht wieder übergeben ist. */
  const b = strecke.bau || {};
  const zurueck = b.uebergabeZurueckZeit && b.stand !== 'uebergeben'
    ? { zeit: b.uebergabeZurueckZeit,
        staemme: String(b.uebergabeZurueckStaemme || '').split('\n').filter(Boolean) } : null;
  /* Die Länge der Lücke auch einzeln: die Lagekarte trägt sie im Schild, und
     dort lässt sich aus dem Fließtext oben nichts herauslesen. */
  return { stand: k.stand, text: teile.join(' · '), warnungen, meldung, zuletzt, trupp: truppText,
    ausfall, zurueck, luecke: k.lueckeLaenge || 0 };
}

/** Ist das Gerät ausgefallen – am Bau-Block oder an einem Bauabschnitt? Dann
 *  schweigt es planmäßig: der Trupp baut auf Papier, und nachgetragen wird
 *  später. */
export function geraeteAusfall(strecke) {
  const bau = strecke && strecke.bau;
  if (!bau) return null;
  const q = [bau, ...(bau.abschnitte || [])].find(x => x && (x.ausfallZeit || x.ausfallNach));
  return q ? { zeit: q.ausfallZeit || '', nach: q.ausfallNach || null } : null;
}

/* Die Strecke, die im Baumodus gerade bearbeitet wird – am Gerät gemerkt wie
   „Wer baut?“ und aus demselben Grund: am Bauort wird neu geladen. Vorher war
   sie Sitzungszustand, und nach dem Neuladen nahm `baustrecke()` die zuletzt
   gebaute – im Audit landete „Punkt hier“ damit an Strecke 1, während der
   Trupp an Strecke 2 stand. Nicht in der Planung: sie sagt, woran dieses
   Gerät gerade baut, und reiste sonst mit jeder weitergereichten Datei. */
const BAUSTRECKE_SCHLUESSEL = 'fbp.baustrecke.v1';
let gewaehlteStrecke;
function gemerkteBaustrecke() {
  if (gewaehlteStrecke === undefined) {
    try { gewaehlteStrecke = localStorage.getItem(BAUSTRECKE_SCHLUESSEL) || null; }
    catch { gewaehlteStrecke = null; }
  }
  return gewaehlteStrecke;
}
/** Die Strecke, die im Baumodus gerade bearbeitet wird – merkt sich die Wahl */
export function baustrecke() {
  const p = store.projekt;
  if (!p) return null;
  const sid = gemerkteBaustrecke();
  const gemerkt = sid && p.strecken.find(s => s.id === sid);
  return gemerkt || zuletztGebaut(p) || p.strecken[0] || null;
}
export function baustreckeSetzen(sid) {
  gewaehlteStrecke = sid || null;
  /* Ein privates Fenster oder ein voller Speicher hält den Baumodus nicht
     auf – dann gilt die Wahl eben nur bis zum Neuladen, wie vorher. */
  try {
    if (gewaehlteStrecke) localStorage.setItem(BAUSTRECKE_SCHLUESSEL, gewaehlteStrecke);
    else localStorage.removeItem(BAUSTRECKE_SCHLUESSEL);
  } catch { /* siehe oben */ }
}

/* Welcher Bauabschnitt neue Eintragungen aufnimmt. Sitzungszustand wie die
   gewählte Strecke – er überlebt das Neuladen bewusst nicht und liegt nicht in
   der Planung: er sagt, wer gerade am Gerät steht, nicht, was gebaut wurde.
   Er steht hier und nicht in der Liste, weil auch die Karte ihn braucht: ein
   Punkt, der über die Bauleiste aufgenommen wird, trägt denselben Trupp wie
   einer aus der Liste. */
let aktiverAbschnittId = null;
export function bauabschnittAktivSetzen(aid) { aktiverAbschnittId = aid || null; }
export function bauabschnittAktivId() { return aktiverAbschnittId; }
/* Das Nachtragen vom Baunachweis: der Tag, von dem abgeschrieben wird, als
   „2026-10-04“, sonst `null`. Solange er steht, bekommt jeder neue Eintrag
   diesen Tag und KEINE Uhrzeit – die steht auf dem Blatt und wird von dort
   übernommen –, dazu den Zeitpunkt der Abschrift. Vorher stempelte „✓ wie
   geplant“ beim Abtippen die Zeit des Abtippens, das Bauende der
   Dokumentation war die Uhrzeit am Küchentisch, und der Tag musste an jedem
   Punkt neu gewählt werden.

   Sitzungszustand wie der aktive Abschnitt und nicht in der Planung: er sagt,
   was gerade am Gerät geschieht, nicht, was gebaut wurde. Ein Neuladen und das
   Verlassen des Bau-Reiters beenden ihn – wer am nächsten Morgen weiterbaut,
   soll nicht still mit dem Tag von gestern aufnehmen.

   Das Ende darf aber nichts mitnehmen: jeder abgeschriebene Eintrag trägt den
   Bautag selbst (`nachtragTag`), und seine Uhrzeit gilt auf diesem Tag, auch
   wenn sie erst nach dem Neuladen eingetragen wird. Davor galt für eine Zeile
   ohne Uhrzeit „heute“ – „14:20“ stand am 05.10. statt am 03.10. Und das Ende
   wird gesagt, nicht verschwiegen (`nachtragEndeSagen` in `ui.js`). */
let nachtragTagWert = null;
/* Wer den Zustand anzeigt, ohne ihn zu ändern (Bauleiste und Punktkarte der
   Karte), lässt sich rufen, statt dass jede Stelle, die ihn setzt, die Karte
   kennen müsste – der Nachtrag wird in der Liste geschaltet und gilt auf der
   Karte. */
const nachtragBeobachter = [];
export const nachtragBeobachten = fn => { nachtragBeobachter.push(fn); };
export function nachtragSetzen(tag) {
  const neu = /^\d{4}-\d{2}-\d{2}$/.test(String(tag || '')) ? tag : null;
  const geaendert = neu !== nachtragTagWert;
  nachtragTagWert = neu;
  if (geaendert) nachtragBeobachter.forEach(fn => fn());
}
export const nachtragTag = () => nachtragTagWert;
/** „03.10.“ für einen Tag „2026-10-03“ – so steht er auf dem Blatt */
export const tagKurz = tag => {
  const [, m, d] = String(tag || '').split('-');
  return m && d ? `${d}.${m}.` : '';
};
/** Was ein neuer Eintrag im Nachtrag mitbekommt – leer, wenn keiner läuft.
 *  `zeit` ist dabei leer und nicht „jetzt“: eine Uhrzeit, die niemand vom
 *  Blatt übernommen hat, ist keine Bauzeit. */
export const nachtragFelder = () => nachtragTagWert
  ? { zeit: '', nachgetragen: new Date().toISOString(), nachtragTag: nachtragTagWert } : {};

/** Die Einträge einer Strecke, die vom Papier stammen und noch keine Uhrzeit
 *  tragen – Punkte, Meldungen und Prüfzeilen. */
export function nachtragOffene(strecke) {
  const bau = strecke && strecke.bau;
  if (!bau) return [];
  return [...(bau.punkte || []), ...(bau.meldungen || []),
    ...((bau.pruefung && bau.pruefung.staemme) || [])]
    .filter(e => e && e.nachgetragen && !e.zeit);
}

const tagIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-` +
  String(d.getDate()).padStart(2, '0');

/**
 * Der Tag, auf dem die Uhrzeit dieses Eintrags gilt, solange sie fehlt – nie
 * „heute“. Der Eintrag trägt den Bautag vom Blatt selbst (`nachtragTag`,
 * Schema 20). Ein Eintrag von Schema 19 trägt keinen: dann gilt der Tag der
 * anderen offenen Einträge und zuletzt der des jüngsten Eintrags vom Bauort,
 * wie ihn der Nachtrag auch vorschlägt (`nachtragVorschlag` in `ui.js`).
 */
export function nachtragTagVon(strecke, eintrag) {
  if (eintrag && eintrag.nachtragTag) return eintrag.nachtragTag;
  const andere = nachtragOffene(strecke).map(e => e.nachtragTag).filter(Boolean).sort();
  if (andere.length) return andere.at(-1);
  const z = zuletztVomBau(strecke);
  const d = z && !Number.isNaN(Date.parse(z)) ? new Date(z) : new Date();
  return tagIso(d > new Date() ? new Date() : d);
}

/** Der Tag, an dem ein beendeter Nachtrag fortgesetzt würde – der jüngste Tag
 *  unter den offenen Einträgen, sonst `null` */
export function nachtragFortsetzTag(strecke) {
  const offene = nachtragOffene(strecke);
  return offene.length ? nachtragTagVon(strecke, offene[0]) : null;
}

/** Der aktive Bauabschnitt dieser Strecke – oder `null`, wenn keiner (mehr) gilt */
export function aktiverBauabschnitt(s) {
  const gewaehlt = bauabschnittById(s, aktiverAbschnittId);
  const eigene = eigeneAbschnitte(s);
  /* Eine Wahl gilt nur, solange der Abschnitt dem Gerät gehört: wechselt der
     Trupp am Gerät („Trupp wechseln“, ein anderer Auftrag), blieb sonst der
     Abschnitt des alten Namens aktiv – und die Punkte gingen unter fremdem
     Namen hinein. */
  if (gewaehlt && (!eigene || eigene.has(gewaehlt.id))) return gewaehlt;
  /* Ohne Wahl in dieser Sitzung nimmt kein Abschnitt auf – mit einer
     Ausnahme: kennt das Gerät seinen Trupp und gibt es an der Strecke einen
     Abschnitt dieses Trupps, ist DER der Abschnitt des Geräts. Die Wahl
     überlebte das Neuladen sonst nicht, und die Punkte danach ersetzten beim
     Planer, was dort ohne Abschnitt steht.

     Früher galt das nur, wenn der Planer mehrere Trupps aufgetragen hatte
     (`auftragsTrupps`). Ohne „Auftrag an“ – der Normalfall der einfachen
     Ansicht, und ebenso nach „als eigenen Bauabschnitt einspielen“ und dem
     nächsten Link zurück – entstanden neue Punkte ohne Abschnitt, und die
     Meldung ließ sie weg (`bauVerschlanken`): zwei Punkte und eine Meldung am
     Gerät, null in der Baumeldung. */
  if (eigene && eigene.size) return bauabschnitte(s).find(a => eigene.has(a.id)) || null;
  return null;
}

/**
 * Die Trupps, die der Planer der Strecke aufgetragen hat – „Auftrag an
 * (Trupp)“, mehrere durch Komma oder Semikolon getrennt. Sind es mehrere,
 * wählt jeder Trupp beim Übernehmen seinen Namen und baut in einem eigenen
 * Bauabschnitt dieses Namens. So ersetzen sich ihre Meldungen beim Planer
 * nicht: eingeordnet wird über den Namen des Abschnitts (`baumeldung.js`).
 */
export function auftragsTrupps(s) {
  /* „1. FmTr und 2. FmTr“ schreibt man so hin, und es ergab einen einzigen
     Trupp dieses Namens – keiner wurde gefragt, beide meldeten ohne Abschnitt
     und ersetzten einander. „und“ und „u.“ trennen deshalb wie das Komma. */
  return String((s && s.trupp) || '').split(/[,;]|\s+und\s+|\s+u\.\s+/)
    .map(x => x.trim()).filter(Boolean);
}
