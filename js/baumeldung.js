// baumeldung.js – Der Rückweg vom Bauort: eine Meldung einordnen und einspielen

/* Hin geht die Planung, zurück geht eine Baumeldung. Sie trägt nur die
   `bau`-Blöcke der Strecken, an denen ein Trupp gearbeitet hat – gepackt wird
   sie in `teilen.js`, eingeordnet und eingespielt wird sie hier.

   Warum das ein eigenes Modul ist und nicht in `baudoku.js` steht: dort geht es
   um die EIGENE Baustelle, hier um eine FREMDE Meldung. Alles in dieser Datei
   rechnet damit, dass die andere Seite etwas anderes gesehen hat als wir – eine
   andere Strecke gleichen Namens, einen inzwischen eingefügten Punkt, einen
   Bauabschnitt, an dem schon ein anderer Trupp gemeldet hat. Diese Vorsicht
   gehört nicht in die Fachlogik des eigenen Bauens.

   Verschmolzen wird NICHT. Das ist dieselbe Festlegung wie in `CLOUD.md`: eine
   falsch verschmolzene Trasse ist schlimmer als zwei, zwischen denen jemand
   entscheidet. Eine Baumeldung ERSETZT genau die Bauabschnitte, die sie nennt,
   und rührt die Soll-Geometrie nicht an. Wo zwei Meldungen denselben
   Bauabschnitt betreffen, wird gefragt. */

import { bauNormalisieren, BAUSTAENDE, id as neueKennung } from './state.js';
import { bauabschnitte, istPunkte } from './baudoku.js';

/* Die Reihenfolge der Baustände, um den niedrigeren zu bestimmen. Meldet ein
   Trupp „gebaut“ für seinen Abschnitt, ist die STRECKE deshalb noch nicht
   gebaut – der andere Trupp kann noch unterwegs sein. */
const STAND_RANG = new Map(BAUSTAENDE.map((b, i) => [b.id, i]));
const niedrigererStand = (a, b) =>
  (STAND_RANG.get(a) ?? 0) <= (STAND_RANG.get(b) ?? 0) ? a : b;

// ------------------------------------------------------------- Einordnen

/**
 * Welche Strecke der Planung ist gemeint?
 *
 * Über den Namen, denn mehr teilen die beiden Seiten nicht: `verschlanken()`
 * wirft die Streckenkennungen weg, der Empfänger vergibt neue. Gefunden wird
 * nur, was EINDEUTIG ist – trägt die Planung zwei Strecken desselben Namens,
 * bleibt der Vorschlag leer und der Planer entscheidet. Ein Zufallstreffer
 * legte die Aufnahme eines Trupps auf die falsche Trasse.
 */
export function vorschlag(projekt, name) {
  const treffer = (projekt.strecken || []).filter(s => s.name === name);
  return treffer.length === 1 ? treffer[0] : null;
}

/** Wer gemeldet hat – aus den Bauabschnitten der Meldung, für die Vorschau */
export function truppText(meldung) {
  const namen = new Set();
  for (const m of meldung.strecken || []) {
    for (const a of (m.bau && m.bau.abschnitte) || []) {
      if (a && a.trupp) namen.add(a.trupp);
    }
  }
  return [...namen].join(', ');
}

/**
 * Was das Einspielen bedeuten würde – die Grundlage der Vorschau.
 *
 * Gerechnet wird gegen eine Zuordnung, die der Planer noch ändern kann:
 * `zuordnung[i]` ist die Kennung der Zielstrecke für die i-te Meldung, oder
 * `null` für „nicht einspielen“. Es wird nichts geschrieben.
 */
export function befund(projekt, meldung, zuordnung) {
  return (meldung.strecken || []).map((m, i) => {
    const zielId = zuordnung ? zuordnung[i] : undefined;
    const ziel = zielId === null ? null
      : (projekt.strecken || []).find(s => s.id === zielId) || vorschlag(projekt, m.name);
    const abschnitteDerMeldung = ((m.bau && m.bau.abschnitte) || []).map(a => String(a.name || ''));
    const ganzeStrecke = abschnitteDerMeldung.length === 0;

    /* Ein Bauabschnitt gleichen Namens, an dem beim Planer schon etwas hängt,
       ist der Kollisionsfall: zwei Trupps haben denselben Abschnitt gemeldet,
       oder derselbe Trupp zweimal. Entschieden wird das nicht hier. */
    const vorhandene = ziel ? bauabschnitte(ziel) : [];
    const kollision = ziel ? vorhandene.filter(a =>
      abschnitteDerMeldung.includes(a.name) && traegtEintraege(ziel, a.id)) : [];

    /* Die Stellen der Verweise stimmen nur, solange der Plan derselbe ist.
       Weicht die Zahl der geplanten Punkte ab, hat jemand eingefügt oder
       gelöscht – dann zeigen Bestätigungen möglicherweise auf den falschen
       Punkt, und wir lösen sie lieber ganz. */
    const planAbweicht = !!ziel && Number.isInteger(m.sollPunkte) &&
      m.sollPunkte !== (ziel.punkte || []).length;

    return {
      stelle: i,
      name: m.name,
      ziel,
      ganzeStrecke,
      abschnitte: abschnitteDerMeldung,
      istPunkte: ((m.bau && m.bau.punkte) || []).length,
      materialzeilen: ((m.bau && m.bau.material) || []).length,
      meldungen: ((m.bau && m.bau.meldungen) || []).length,
      kollision,
      planAbweicht,
      /* Was beim Planer verlorenginge. Bei der ganzen Strecke ist das der
         ganze Bogen, bei einzelnen Abschnitten nur deren Eintragungen. */
      ersetzt: ziel ? (ganzeStrecke ? istPunkte(ziel).length
        : istPunkte(ziel).filter(pt => pt.abschnitt &&
            vorhandene.some(a => a.id === pt.abschnitt &&
              abschnitteDerMeldung.includes(a.name))).length) : 0
    };
  });
}

/** Hängt an diesem Bauabschnitt überhaupt etwas? */
function traegtEintraege(strecke, aid) {
  const bau = strecke.bau;
  if (!bau) return false;
  return (bau.punkte || []).some(pt => pt.abschnitt === aid) ||
         (bau.material || []).some(z => z.abschnitt === aid) ||
         (bau.meldungen || []).some(m => m.abschnitt === aid);
}

// ------------------------------------------------------------- Einspielen

/**
 * Eine Baumeldung einspielen.
 *
 * `zuordnung[i]` ist die Kennung der Zielstrecke oder `null`. Zurück kommt,
 * was geschehen ist – die Oberfläche meldet es dem Planer.
 *
 * Nur innerhalb von `store.aendern` aufrufen.
 */
export function einspielen(projekt, meldung, zuordnung) {
  const bericht = { strecken: 0, punkte: 0, abschnitte: 0, uebersprungen: 0 };
  (meldung.strecken || []).forEach((m, i) => {
    const zielId = zuordnung ? zuordnung[i] : undefined;
    const ziel = zielId === null ? null
      : (projekt.strecken || []).find(s => s.id === zielId) || vorschlag(projekt, m.name);
    if (!ziel) { bericht.uebersprungen++; return; }

    const frisch = aufloesen(ziel, m);
    if (!frisch) { bericht.uebersprungen++; return; }

    if (!frisch.abschnitte.length) ganzeStreckeErsetzen(ziel, frisch);
    else abschnitteErsetzen(ziel, frisch);

    bericht.strecken++;
    bericht.punkte += frisch.punkte.length;
    bericht.abschnitte += frisch.abschnitte.length;
  });
  return bericht;
}

/**
 * Den `bau`-Block der Meldung auf die Zielstrecke umrechnen.
 *
 * Die Verweise stehen als Stelle in der Punktliste – aufgelöst wird gegen die
 * Punkte des ZIELS, denn dort wird eingespielt. Was sich nicht auflösen lässt,
 * wird `null`: ein Ist-Punkt ohne Bezug zum Plan ist ein eigenständiger Punkt
 * und bleibt stehen, während ein falsch aufgelöster Verweis behauptete, ein
 * bestimmter geplanter Punkt sei bestätigt worden.
 *
 * Danach läuft alles durch dieselbe Weißliste wie jede fremde Datei
 * (`bauNormalisieren` in `state.js`) – eine Baumeldung kommt aus derselben
 * Fremde wie ein Link.
 */
function aufloesen(ziel, m) {
  if (!m || !m.bau || typeof m.bau !== 'object') return null;
  const roh = JSON.parse(JSON.stringify(m.bau));
  const punkte = ziel.punkte || [];
  const abschnitte = Array.isArray(roh.abschnitte) ? roh.abschnitte : [];

  /* Jeder Bauabschnitt der Meldung bekommt hier seine Kennung, und zwar VOR dem
     Auflösen: die Verweise von Punkten, Materialzeilen und Meldungen zeigen als
     Stelle auf ihn, und die Stelle muss sich in eine Kennung übersetzen lassen.
     `bauNormalisieren()` vergäbe sie erst danach – die Verweise stünden dann
     schon auf `undefined`, und der ganze Bogen des Trupps fiele an einen
     Abschnitt, den es nicht gibt. Genauso macht es `bauAuffuellen()` in
     `teilen.js` für den Weg über den Link.

     Ein vorhandener Abschnitt gleichen Namens gibt seine Kennung her: sonst
     hinge alles, was beim Planer sonst noch auf ihn zeigt, in der Luft. */
  const vorhandene = bauabschnitte(ziel);
  abschnitte.forEach(a => {
    const alt = vorhandene.find(x => x.name === String(a.name || ''));
    a.id = alt ? alt.id : (a.id || neueKennung());
  });

  const punktKennung = i => (Number.isInteger(i) && punkte[i] ? punkte[i].id : null);
  const abschnittKennung = i => (Number.isInteger(i) && abschnitte[i] ? abschnitte[i].id : null);
  abschnitte.forEach(a => {
    a.vonPunkt = punktKennung(a.vonPunkt);
    a.bisPunkt = punktKennung(a.bisPunkt);
  });
  for (const pt of (Array.isArray(roh.punkte) ? roh.punkte : [])) {
    if (!pt) continue;
    pt.sollPunkt = punktKennung(pt.sollPunkt);
    pt.abschnitt = abschnittKennung(pt.abschnitt);
  }
  for (const z of (Array.isArray(roh.material) ? roh.material : [])) {
    if (z) z.abschnitt = abschnittKennung(z.abschnitt);
  }
  for (const mm of (Array.isArray(roh.meldungen) ? roh.meldungen : [])) {
    if (mm) mm.abschnitt = abschnittKennung(mm.abschnitt);
  }
  return bauNormalisieren(roh);
}

/* Eine Meldung ohne Bauabschnitt betrifft die ganze Strecke: ein Trupp, eine
   Trasse. Dann tritt ihr Bogen an die Stelle des vorhandenen – alles andere
   liefe darauf hinaus, zwei Bögen zu verschmelzen. */
function ganzeStreckeErsetzen(ziel, frisch) {
  ziel.bau = frisch;
}

/* Eine Meldung MIT Bauabschnitten ersetzt genau die, die sie nennt. Was beim
   Planer an anderen Abschnitten hängt, bleibt unangetastet – das ist der ganze
   Zweck der Abschnitte: dass zwei Trupps nie in dasselbe Feld schreiben. */
function abschnitteErsetzen(ziel, frisch) {
  const bau = ziel.bau || (ziel.bau = bauNormalisieren({}));
  const betroffen = new Set();

  for (const neu of frisch.abschnitte) {
    const alt = (bau.abschnitte || []).find(a => a.name === neu.name);
    if (alt) {
      betroffen.add(alt.id);
      /* Die Farbe bleibt die des Planers: an ihr hängt die Karte, die er vor
         sich hat, und der Trupp hat sie nie gesehen. */
      Object.assign(alt, neu, { id: alt.id, farbe: alt.farbe });
    } else {
      betroffen.add(neu.id);
      bau.abschnitte.push(neu);
    }
  }

  bau.punkte = (bau.punkte || []).filter(pt => !betroffen.has(pt.abschnitt))
    .concat(frisch.punkte.filter(pt => betroffen.has(pt.abschnitt)));
  bau.material = (bau.material || []).filter(z => !betroffen.has(z.abschnitt))
    .concat(frisch.material.filter(z => betroffen.has(z.abschnitt)));
  bau.meldungen = (bau.meldungen || []).filter(mm => !betroffen.has(mm.abschnitt))
    .concat(frisch.meldungen.filter(mm => betroffen.has(mm.abschnitt)));

  /* Die Ist-Punkte folgen wieder der Ordnung der Planung und nicht der Uhr –
     sonst liefe die gebaute Trasse nach dem Einspielen zweier Meldungen einmal
     hin und zurück, weil der zweite Trupp am anderen Ende angefangen hat. */
  const ordnung = new Map((ziel.punkte || []).map((pt, i) => [pt.id, i]));
  bau.punkte.sort((a, b) =>
    (ordnung.has(a.sollPunkt) ? ordnung.get(a.sollPunkt) : Number.MAX_SAFE_INTEGER) -
    (ordnung.has(b.sollPunkt) ? ordnung.get(b.sollPunkt) : Number.MAX_SAFE_INTEGER));

  /* Der Stand der STRECKE ist der niedrigere: meldet ein Trupp „gebaut“ für
     seinen Abschnitt, kann der andere noch unterwegs sein. */
  bau.stand = niedrigererStand(bau.stand, frisch.stand);

  /* Prüfung und Übergabe gehören der ganzen Leitung und nicht einem Abschnitt.
     Eine Meldung über einen Teil der Strecke überschreibt sie deshalb nicht –
     sie trägt nur ein, wo beim Planer noch nichts steht. */
  if (!bau.pruefung && frisch.pruefung) bau.pruefung = frisch.pruefung;

  /* Zwei Abweichungsmeldungen werden aneinandergehängt und nicht ersetzt: was
     der eine Trupp gemeldet hat, geht den anderen nichts an, und der S 6
     braucht beides. */
  if (frisch.abweichung && frisch.abweichung !== bau.abweichung) {
    bau.abweichung = bau.abweichung
      ? bau.abweichung + '\n\n' + frisch.abweichung : frisch.abweichung;
  }
}

/** Kurzfassung für die Meldung nach dem Einspielen */
export function berichtText(bericht) {
  const teile = [];
  const zaehl = (n, ein, viele) => { if (n) teile.push(`${n} ${n === 1 ? ein : viele}`); };
  zaehl(bericht.strecken, 'Strecke', 'Strecken');
  zaehl(bericht.abschnitte, 'Bauabschnitt', 'Bauabschnitte');
  zaehl(bericht.punkte, 'aufgenommener Punkt', 'aufgenommene Punkte');
  if (!teile.length) return 'Nichts eingespielt';
  return teile.join(', ') + ' eingespielt';
}
