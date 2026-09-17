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

/* Die Reihenfolge der Baustände, um sie vergleichen zu können. */
const STAND_RANG = new Map(BAUSTAENDE.map((b, i) => [b.id, i]));
const rang = id => STAND_RANG.get(id) ?? 0;
const nachRang = r => BAUSTAENDE[Math.max(0, Math.min(BAUSTAENDE.length - 1, r))].id;

/**
 * Der Baustand der STRECKE nach einer Meldung über einen Teil von ihr.
 *
 * Zwei Fehler liegen hier nahe, und beide wären schlimm. Den gemeldeten Stand
 * einfach zu übernehmen hieße: Trupp Nord meldet „gebaut“ für seine Hälfte, und
 * die ganze Strecke gilt als gebaut, während Süd noch im Gelände steht.
 * Umgekehrt immer den niedrigeren zu nehmen hieße: die Strecke bliebe für immer
 * auf „noch nicht begonnen“, denn dort fängt sie an – keine Meldung könnte sie
 * je bewegen.
 *
 * Deshalb: eine Teilmeldung hebt den Stand, senkt ihn nie, und hebt ihn
 * höchstens auf „im Bau“. Dass die Strecke fertig ist, entscheidet der Planer –
 * er ist der Einzige, der alle Abschnitte vor sich hat.
 */
function standNachTeilmeldung(bisher, gemeldet) {
  const gedeckelt = Math.min(rang(gemeldet), rang('laeuft'));
  return nachRang(Math.max(rang(bisher), gedeckelt));
}

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
  /* Der Absender, den der Trupp am Gerät eingetragen hat, geht vor: er steht
     auch dann da, wenn die Strecke ohne Bauabschnitt gebaut wurde – der Fall,
     in dem der Planer vorher niemanden genannt bekam. */
  if (meldung.von) namen.add(String(meldung.von));
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
    /* Der Name wird hier genauso hergestellt, wie `bauNormalisieren()` ihn
       später herstellt – sonst sähe die Vorschau leere Namen, meldete nie eine
       Kollision und zeigte „0 weichen“, während das Einspielen sehr wohl
       etwas ersetzte. */
    const abschnitteDerMeldung = ((m.bau && m.bau.abschnitte) || [])
      .map((a, n) => String((a && a.name) || `Bauabschnitt ${n + 1}`));
    const ganzeStrecke = abschnitteDerMeldung.length === 0;
    const unzugeordnet = m.bau ? zaehleOhneAbschnitt(m.bau) : 0;

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
      pruefzeilen: ((m.bau && m.bau.pruefung && m.bau.pruefung.staemme) || []).length,
      uebergabe: !!(m.bau && m.bau.pruefung && m.bau.pruefung.uebergabeAn),
      /* Was die Meldung ohne Bauabschnitt mitbringt. Es wird mit eingespielt und
         ersetzt den unzugeordneten Bestand des Planers – der Planer muss das
         vorher sehen. */
      unzugeordnet,
      kollision,
      planAbweicht,
      /* Was eine Meldung über die ganze Strecke beim Planer wegnimmt: sie tritt
         an die Stelle des ganzen Bogens, also auch an die von Bauabschnitten,
         die sie gar nicht nennt, und von Prüfung und Übergabe. */
      verdraengt: (ziel && ganzeStrecke) ? {
        abschnitte: vorhandene.length,
        pruefzeilen: ((ziel.bau && ziel.bau.pruefung && ziel.bau.pruefung.staemme) || []).length,
        uebergabe: !!(ziel.bau && ziel.bau.pruefung && ziel.bau.pruefung.uebergabeAn),
        material: ((ziel.bau && ziel.bau.material) || []).length,
        abweichung: !!(ziel.bau && ziel.bau.abweichung)
      } : null,
      /* Was beim Planer verlorenginge. Bei der ganzen Strecke ist das der
         ganze Bogen, bei einzelnen Abschnitten nur deren Eintragungen. */
      ersetzt: ziel ? (ganzeStrecke ? istPunkte(ziel).length
        : istPunkte(ziel).filter(pt => pt.abschnitt &&
            vorhandene.some(a => a.id === pt.abschnitt &&
              abschnitteDerMeldung.includes(a.name))).length) : 0
    };
  });
}

/* Wie viele Eintragungen dieses Bogens keinem Bauabschnitt zugeordnet sind.
   Gilt für den ROHEN Bogen einer Meldung, und dort steht die Zuordnung als
   STELLE in der Abschnittsliste. Die erste Stelle ist die 0, und die ist falsch
   – ein `!z.abschnitt` zählte die Eintragungen des ersten Bauabschnitts
   allesamt als unzugeordnet und meldete dem Planer, sie träten an die Stelle
   seines eigenen unzugeordneten Bestands. */
const nichtZugeordnet = x => x.abschnitt === undefined || x.abschnitt === null;
const zaehleOhneAbschnitt = bau =>
  (bau.punkte || []).filter(nichtZugeordnet).length +
  (bau.material || []).filter(nichtZugeordnet).length +
  (bau.meldungen || []).filter(nichtZugeordnet).length;

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
  const bericht = { strecken: 0, punkte: 0, bestand: 0, abschnitte: 0, uebersprungen: 0 };
  (meldung.strecken || []).forEach((m, i) => {
    const zielId = zuordnung ? zuordnung[i] : undefined;
    const ziel = zielId === null ? null
      : (projekt.strecken || []).find(s => s.id === zielId) || vorschlag(projekt, m.name);
    if (!ziel) { bericht.uebersprungen++; return; }

    const planAbweicht = Number.isInteger(m.sollPunkte) &&
      m.sollPunkte !== (ziel.punkte || []).length;
    const frisch = aufloesen(ziel, m, planAbweicht);
    if (!frisch) { bericht.uebersprungen++; return; }

    const vorher = istPunkte(ziel).length;
    if (!frisch.abschnitte.length) ganzeStreckeErsetzen(ziel, frisch);
    else abschnitteErsetzen(ziel, frisch);

    bericht.strecken++;
    /* Gezählt wird, was danach WIRKLICH in der Planung steht, und nicht, was die
       Meldung mitbrachte. Beides auseinanderlaufen zu lassen wäre die
       schlimmste Sorte Fehler: der Planer läse „7 Punkte eingespielt“ und hätte
       drei – und suchte den Fehler beim Trupp. */
    bericht.punkte += Math.max(0, istPunkte(ziel).length - vorher);
    bericht.bestand += istPunkte(ziel).length;
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
function aufloesen(ziel, m, planAbweicht) {
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
  const vergeben = new Set();
  abschnitte.forEach((a, n) => {
    /* Der Name wird festgeschrieben, BEVOR gesucht wird, und zwar genauso, wie
       `bauNormalisieren()` ihn gleich darauf herstellen wird. Sonst suchte
       diese Zeile mit einem leeren Namen, fände nichts, und der Namensvergleich
       in `abschnitteErsetzen()` träfe eine Zeile später doch – auf eine andere
       Kennung. Der Bogen beider Trupps wäre dann weg. */
    a.name = String((a && a.name) || `Bauabschnitt ${n + 1}`);
    const alt = vorhandene.find(x => x.name === a.name && !vergeben.has(x.id));
    if (alt) vergeben.add(alt.id);
    a.id = alt ? alt.id : (a.id || neueKennung());
  });

  /* Weicht die Zahl der geplanten Punkte ab, hat jemand eingefügt oder gelöscht,
     und die Stellen zeigen auf eine andere Liste als die, gegen die sie
     geschrieben wurden. Dann wird JEDER Planbezug gelöst und keiner geraten:
     ein Ist-Punkt ohne Bezug ist ein eigenständiger Punkt und bleibt stehen,
     ein falsch aufgelöster behauptete, ein bestimmter geplanter Punkt sei
     bestätigt worden – und genau darauf beruht die ganze Abweichungsrechnung.
     Die Vorschau sagt das vorher zu; hier wird es eingelöst. */
  const punktKennung = i =>
    (!planAbweicht && Number.isInteger(i) && punkte[i] ? punkte[i].id : null);
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

/* Trägt dieser Bogen etwas, das keinem Bauabschnitt zugeordnet ist?
   Gilt für den AUFGELÖSTEN Bogen, dort ist die Zuordnung eine Kennung oder
   `null` – eine Stelle 0 kann hier nicht mehr vorkommen. Derselbe Test steht
   für den rohen Bogen weiter oben unter `nichtZugeordnet`. */
const ohneAbschnitt = bau =>
  (bau.punkte || []).some(nichtZugeordnet) ||
  (bau.material || []).some(nichtZugeordnet) ||
  (bau.meldungen || []).some(nichtZugeordnet);

/**
 * Die Ist-Punkte wieder in die Ordnung der Planung bringen.
 *
 * Nötig, weil zwei Trupps aufeinander zu bauen und der eine am Ende der Trasse
 * anfängt – nach der Eintragungszeit sortiert liefe die gebaute Trasse sonst
 * verkehrt herum über die Karte.
 *
 * Ein Punkt OHNE Planbezug bekommt dabei den Rang seines Vorgängers und nicht
 * den letzten: ans Listenende geschoben liefe die gebaute Trasse über die ganze
 * Strecke und wieder zurück, und die gerechnete Länge wäre doppelt so groß wie
 * die gebaute. Denselben Fehler vermeidet `nebenDenNachbarn()` in `baudoku.js`
 * beim Aufnehmen – hier darf er nicht durch die Hintertür zurückkommen.
 */
function istPunkteOrdnen(ziel, punkte) {
  const ordnung = new Map((ziel.punkte || []).map((pt, i) => [pt.id, i]));
  let zuletzt = -1;
  const mitRang = punkte.map((pt, i) => {
    if (ordnung.has(pt.sollPunkt)) zuletzt = ordnung.get(pt.sollPunkt);
    return { pt, rang: zuletzt, stelle: i };
  });
  mitRang.sort((a, b) => a.rang - b.rang || a.stelle - b.stelle);
  return mitRang.map(x => x.pt);
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
  const vergeben = new Set();

  for (const neu of frisch.abschnitte) {
    /* Jeder vorhandene Abschnitt wird höchstens EINMAL vergeben: trüge eine
       Meldung zwei Abschnitte desselben Namens, fielen sonst beide auf
       denselben Eintrag, und der zweite verlöre seine Eintragungen. */
    const alt = (bau.abschnitte || []).find(a => a.name === neu.name && !vergeben.has(a.id));
    if (alt) {
      vergeben.add(alt.id);
      betroffen.add(alt.id);
      /* Die Farbe bleibt die des Planers: an ihr hängt die Karte, die er vor
         sich hat, und der Trupp hat sie nie gesehen. */
      Object.assign(alt, neu, { id: alt.id, farbe: alt.farbe });
    } else {
      betroffen.add(neu.id);
      bau.abschnitte.push(neu);
    }
  }

  /* Was der Trupp OHNE Bauabschnitt aufgenommen hat, gehört ebenso zu seiner
     Meldung – und fiele sonst lautlos weg, weil `null` in keiner Menge von
     Abschnittskennungen steht. Das ist kein Randfall: wer aufnimmt, ohne oben
     einen Abschnitt zu wählen, landet hier, und `bauabschnittLoeschen()` setzt
     die Zuordnung beim Umgliedern ausdrücklich zurück.

     Der unzugeordnete Bestand des Planers wird dabei ERSETZT und nicht
     ergänzt. Sonst stünde nach einem zweiten Einspielen derselben Meldung alles
     doppelt da – und eine Meldung zweimal einzuspielen ist am Bauort
     wahrscheinlicher als zwei Trupps, die beide nichts zuordnen. Die Vorschau
     nennt diesen Bestand eigens. */
  if (ohneAbschnitt(frisch)) betroffen.add(null);

  bau.punkte = (bau.punkte || []).filter(pt => !betroffen.has(pt.abschnitt))
    .concat(frisch.punkte.filter(pt => betroffen.has(pt.abschnitt)));
  bau.material = (bau.material || []).filter(z => !betroffen.has(z.abschnitt))
    .concat(frisch.material.filter(z => betroffen.has(z.abschnitt)));
  bau.meldungen = (bau.meldungen || []).filter(mm => !betroffen.has(mm.abschnitt))
    .concat(frisch.meldungen.filter(mm => betroffen.has(mm.abschnitt)));
  bau.punkte = istPunkteOrdnen(ziel, bau.punkte);

  bau.stand = standNachTeilmeldung(bau.stand, frisch.stand);

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
  if (!teile.length) return 'Nichts eingespielt';
  /* Der Bestand und nicht der Zuwachs: eine Meldung, die vorhandene Punkte
     ERSETZT, bringt netto null neue – „0 Punkte“ danebenzuschreiben wäre
     irreführend, „12 Punkte stehen jetzt an dieser Strecke“ ist die Aussage,
     die der Planer prüfen kann. */
  const satz = teile.join(', ') + ' eingespielt';
  return bericht.bestand
    ? `${satz} – ${bericht.bestand} ${bericht.bestand === 1
        ? 'aufgenommener Punkt steht' : 'aufgenommene Punkte stehen'} jetzt in der Planung`
    : satz;
}
