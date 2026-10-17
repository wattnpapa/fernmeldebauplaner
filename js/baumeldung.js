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
   Bauabschnitt betreffen, wird gefragt.

   Zwei Ausnahmen, beide eng geschnitten: die Prüfung wird je Stamm
   zusammengeführt, mit und ohne Bauabschnitt (`pruefungZusammenfuehren`), und
   was der Planer vom Papier abgeschrieben hat, bleibt beim Ersetzen eines
   Abschnitts stehen (`papierBehalten`). In beiden Fällen gäbe es sonst nur die
   Wahl zwischen Verlust und Verschmelzen, und die Meldung des Geräts weiß
   von beidem nichts. */

import {
  bauNormalisieren, BAUSTAENDE, id as neueKennung, neuerBauabschnitt, bauBegonnen
} from './state.js';
import {
  bauabschnitte, istPunkte, baukennzahlen, abstandZurLinie, ABSEITS_SCHWELLE, truppName, uhrzeit
} from './baudoku.js';
import { bauAbdruck, meldungsCodeAus } from './teilen.js';
import { materialById } from './vorschrift.js';

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
      /* „Trupp 3 · Krause, Trupp 3“ stand im Audit da: der Abschnitt nennt
         den Trupp, den der Absender schon enthält. */
      if (a && a.trupp && !String(meldung.von || '').includes(a.trupp)) namen.add(a.trupp);
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
    /* Hat der Planer „als eigenen Bauabschnitt“ gewählt, wird die Meldung
       genau so gerechnet, wie sie eingespielt würde. */
    const wahl = wahlVon(zuordnung, i);
    const alsEigener = wahl.alsEigener;
    if (alsEigener) m = alsEigenerAbschnitt(m, meldung.von);
    const zielId = zuordnung ? zuordnung[i] : undefined;
    const ziel = zielId === null ? null
      : (projekt.strecken || []).find(s => s.id === zielId) || vorschlag(projekt, m.name);
    /* Der Name wird hier genauso hergestellt, wie `bauNormalisieren()` ihn
       später herstellt – sonst sähe die Vorschau leere Namen, meldete nie eine
       Kollision und zeigte „0 weichen“, während das Einspielen sehr wohl
       etwas ersetzte. */
    /* Und die Abschnitte desselben Trupps, die hier unter anderem Namen
       stehen, tragen den Namen, den sie HIER haben (`abschnittZuordnen`) –
       sonst zählte die Vorschau einen dritten Abschnitt, den das Einspielen
       nie anlegt. */
    const rohAbschnitte = (m.bau && Array.isArray(m.bau.abschnitte)) ? m.bau.abschnitte : [];
    const abschnitteDerMeldung = abschnittZuordnen(ziel ? bauabschnitte(ziel) : [], rohAbschnitte)
      .map(e => e.name);
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

    /* Der jüngste Eintrag auf beiden Seiten. Im Messenger stehen mehrere Links
       untereinander, und wer den falschen antippt, spielt einen älteren Stand
       über einen neueren; ein zweimal geöffneter Link kam als gewöhnliche
       Meldung daher. Beides wird jetzt benannt – entschieden wird weiter vom
       Planer. */
    /* Verglichen wird nur, was die Meldung auch ersetzt. Über die ganze
       Strecke gerechnet stand beim abschnittsweisen Bau die Aufnahmezeit von
       Trupp 1 gegen die von Trupp 2 – und die Meldung des einen hieß „älter“,
       weil der andere zuletzt etwas eingetragen hatte. Gezählt wird beim
       Trupp, was an den gemeldeten Abschnitten hängt, hier, was an den
       gleichnamigen hängt, und auf beiden Seiten, was ohne Abschnitt steht,
       wenn die Meldung solches mitbringt. */
    const juengster = (bau, zaehlt) => {
      let z = '';
      for (const x of [...((bau && bau.punkte) || []), ...((bau && bau.meldungen) || [])]) {
        if (x && zaehlt(x) && typeof x.zeit === 'string' && x.zeit > z) z = x.zeit;
      }
      return z;
    };
    const ohneTeilt = unzugeordnet > 0;
    const standMeldung = juengster(m.bau, x => ganzeStrecke ||
      (nichtZugeordnet(x) ? ohneTeilt : Number.isInteger(x.abschnitt)));
    const namenHier = new Map(bauabschnitte(ziel).map(a => [a.id, a.name]));
    const standHier = ziel ? juengster(ziel.bau, x => ganzeStrecke ||
      (nichtZugeordnet(x) ? ohneTeilt : abschnitteDerMeldung.includes(namenHier.get(x.abschnitt)))) : '';

    /* Ob das Einspielen etwas ändert, wird ausprobiert und nicht an den
       Zeitstempeln abgelesen: an einer Abschrift der Zielstrecke, und
       verglichen wird, was danach hinausginge. Vorher galt eine Meldung als
       „schon eingespielt“, sobald ihr jüngster Eintrag mit dem hiesigen
       übereinstimmte – im Audit genau die BERICHTIGTE Meldung, in der der
       Trupp 31.200 m auf 3.120 m korrigiert hatte. „Verwerfen genügt“ stand
       darüber, und der Zahlendreher blieb in der Dokumentation. */
    const versuch = ziel ? probeEinspielen(ziel, m, ctxVon(meldung, wahl)) : null;
    const probe = versuch ? versuch.kopie : null;
    const gleichAbdruck = !!(probe && bauAbdruck(ziel) && bauAbdruck(probe) === bauAbdruck(ziel));
    /* „Schon eingespielt“ sagt mehr als „ändert nichts“: im Audit blieb die
       Nachmessung oder Übergabe eines ANDEREN Trupps ohne jede Wirkung (hier
       steht „durchgefallen“, die Übernahme bleibt Sache des Planers), und der
       Dialog behauptete, genau dieser Stand sei schon da – samt unterdrücktem
       Häkchen „Messung übernehmen“ und einer Funkformel „bereits übernommen“.
       Ist die Prüfung der Grund, ist es NICHT derselbe Stand, sondern eine
       Meldung, die an der Prüfung scheitert; sie bleibt mit ihren Hinweisen
       sichtbar (`nichtsGeaendert`). */
    const abgelehnt = versuch ? versuch.pruefhinweise.filter(h =>
      (h.stamm && !h.uebernommen) || h.uebergabeNichtUebernommen || h.uebergabeVeraltet) : [];
    const schonDa = gleichAbdruck && !abgelehnt.length;
    const nichtsGeaendert = gleichAbdruck && abgelehnt.length > 0;
    /* Ohne Bauabschnitt und von einem anderen Absender sagen zwei Zeitpunkte
       nichts über „älter“: es sind die Aufnahmen zweier Trupps, und welcher
       zuletzt getippt hat, macht den anderen nicht veraltet. Was dabei weicht,
       nennt die Verlustzeile mit dem Namen des anderen Absenders. */
    /* Verglichen wird der Trupp und nicht der Truppführer: wechselt in der
       Schicht nur der Führer, ist es dieselbe Aufnahme eines Trupps – im Audit
       bot der Dialog dafür „als eigenen Bauabschnitt“ an, und die Punkte
       standen doppelt da. Der Wechsel bleibt sichtbar (`fuehrerWechsel`). */
    /* Steht hier nur, was der Planer vom Papier ohne Abschnitt abgeschrieben
       hat, fehlt `gemeldetVon` – und der Dialog bot „als eigenen Bauabschnitt“
       nicht an: die Meldung der ganzen Strecke nahm die Abschrift heraus. Die
       Abschrift ist ebenso ein anderer Bestand als die Aufnahme des Geräts. */
    const hierAbsender = ziel && ziel.bau ? ziel.bau.gemeldetVon : '';
    const hierPapier = papierOhneAbschnitt(ziel && ziel.bau);
    const andererAbsender = ganzeStrecke && !!ziel && !!ziel.bau && !!meldung.von &&
      (hierAbsender ? !gleicherTrupp(hierAbsender, meldung.von) : hierPapier);
    /* „Älter“ erst ab spürbarem Abstand: „0 s älter als der Stand hier“ stand
       im Audit über einer Meldung, die der Trupp unmittelbar nach dem Planer-
       Stand aufgenommen hatte – zwei Uhren, die um eine Sekunde auseinander
       liegen, sagen nichts über veraltet. */
    const aelter = !schonDa && !andererAbsender && !!(standMeldung && standHier) &&
      Date.parse(standHier) - Date.parse(standMeldung) >= AELTER_ABSTAND;
    /* Ändert das Einspielen nichts, WEIL hier inzwischen ein jüngerer Stand
       steht, ist es nicht „genau dieser Stand“: nach der neueren Meldung C gilt
       die ältere A als „schon eingespielt“, obwohl der Stand hier ein anderer
       ist. Der Dialog und die Funkformel sagen dann „älter als der Stand hier“. */
    const ueberholt = schonDa && !!(standMeldung && standHier) &&
      Date.parse(standHier) - Date.parse(standMeldung) >= AELTER_ABSTAND;
    /* Was danach nicht mehr dasteht – gezählt über den Inhalt der Einträge und
       nicht über ihre Zahl. „Dabei weichen 3 Punkte“ stand auch dann da, wenn
       dieselben drei Punkte gleich wieder hereinkamen, und wer das einmal
       gesehen hat, liest es beim nächsten Mal nicht mehr. */
    const verloren = probe ? verlust(ziel.bau, probe.bau, ziel.punkte)
      : { punkte: 0, meldungen: 0, material: 0, punkteGeaendert: 0, meldungenGeaendert: 0,
          papier: 0, orte: [] };
    /* Eine Materialzeile desselben Artikels ist kein Verlust, sondern eine
       Änderung – und die Änderung ist genau das, was der Planer sehen muss:
       im Audit nannte der Dialog bei der berichtigten Meldung „1 Materialzeile
       geht verloren“ und nirgends „31.200 → 3.120 m“. */
    const geaendert = probe ? mengenAenderung(ziel.bau, probe.bau) : [];
    verloren.material = Math.max(0, verloren.material - geaendert.length);

    /* Wie weit die gemeldete Aufnahme neben der Trasse liegt, der sie
       zugeordnet wird. Zugeordnet wird über den Namen, und „Strecke 1“ in
       „Neue Planung“ heißt in jedem Ortsverband so: im Audit kam die Meldung
       eines fremden Trupps an, 80 km entfernt, und ersetzte ohne ein Wort die
       eigene Aufnahme. Liegt schon der NÄCHSTE Punkt weiter als
       `ABSEITS_SCHWELLE` daneben, gehört die Meldung nicht hierher; liegen nur
       einzelne daneben, ist es eine Ortung am falschen Platz, und das ist eine
       Nachfrage, kein Grund zu verwerfen. */
    const daneben = danebenVon(ziel, m);

    /* „Übergeben“ ohne Messung kam beim Planer als fertige Leitung an. Beim
       Trupp fragt die Auswahl nach (`bauUebergabeBlock` in ui.js) – sie lässt
       „trotzdem übergeben“ aber zu, und dann stand im Empfangsdialog nur der
       Standwechsel. */
    const staemme = (m.bau && m.bau.pruefung && m.bau.pruefung.staemme) || [];
    const uebergabeFraglich = !(m.bau && m.bau.stand === 'uebergeben') ? ''
      : !staemme.length ? 'ohne Prüfzeile'
      : staemme.some(z => z && z.bestanden === false) ? 'mit durchgefallener Prüfung'
      : '';

    /* Was der Planer lesen will, bevor er einspielt: die neuen Baumeldungen im
       Wortlaut und wie sich der Stand verschiebt. Vorher stand im Dialog nur
       „3 Punkte · 2 Baumeldungen“ – ob eine davon „Deich überflutet“ hieß,
       erfuhr er erst danach in der Liste. Neu ist, was die Abschrift nach dem
       Einspielen trägt und hier noch nicht steht. */
    const neueMeldungen = probe ? neuNachInhalt(ziel.bau, probe.bau, 'meldungen')
      .filter(x => String(x.text || '').trim())
      .sort((a, b) => String(a.zeit || '').localeCompare(String(b.zeit || ''))) : [];
    const kurz = k => ({ stand: k.stand.id, bestaetigt: k.bestaetigt, soll: k.sollPunkte,
      ist: k.istPunkte, abweichungen: k.abweichungen.length + k.abseits.length });
    const bisher = ziel ? kurz(baukennzahlen(ziel)) : null;
    const danach = probe ? kurz(baukennzahlen(probe)) : null;

    /* Ein Trupp ohne Bauabschnitt meldet an einer Strecke, an der schon ein
       ANDERER ohne Abschnitt gemeldet hat – zwei Trupps in der einfachen
       Ansicht, in der „Auftrag an“ nicht zu sehen ist. Dann gab es nur
       entweder – oder. Angeboten wird, die Meldung als eigenen Bauabschnitt
       dieses Absenders einzuspielen; der Bestand bleibt, wie er ist. */
    const eigenerAbschnittMoeglich = alsEigener || (!!ziel && !!meldung.von && andererAbsender);

    /* Eine Teilmeldung hebt den Stand höchstens auf „im Bau“
       (`standNachTeilmeldung`). Der Trupp meldete „übergeben“, beim Planer
       stand danach „im Bau“, und niemand sagte, warum. */
    const gemeldeterStand = m.bau && typeof m.bau.stand === 'string' ? m.bau.stand : '';
    const gedeckelt = !ganzeStrecke && !!probe && rang(gemeldeterStand) > rang('laeuft') &&
      rang(probe.bau.stand) < rang(gemeldeterStand);
    const offeneAbschnitte = gedeckelt
      ? bauabschnitte(probe).filter(a => !abschnitteDerMeldung.includes(a.name))
        .map(a => a.trupp || a.name) : [];

    /* Der Absender hier und was daraus folgt. `ersteName` ist der Trupp, dessen
       Aufnahme ohne Abschnitt hier steht und auf Wunsch zum Abschnitt wird
       (`ersteInAbschnitt`) – nur wenn ein einzelner Absender dahintersteht. */
    const bisherAbsender = ziel && ziel.bau ? String(ziel.bau.gemeldetVon || '') : '';
    const ersteName = (alsEigener && ziel && ziel.bau && ohneAbschnitt(ziel.bau) &&
      bisherAbsender && !bisherAbsender.includes(',') && bisherAbsender !== 'unbekannter Absender' &&
      !gleicherTrupp(bisherAbsender, meldung.von)) ? absenderTrupp(bisherAbsender) : '';
    /* Derselbe geplante Punkt in mehr als einem Abschnitt (oder einmal im
       Abschnitt und einmal ohne): die Aufnahme steht doppelt, im Audit 5 bis 6
       Ist bei 3 Soll – nach „Trupp wechseln“ unter neuem Namen, nach einer
       geänderten Bezeichnung und bei zwei Abschnitten desselben Trupps.
       Gezählt wird, was die Meldung NEU so macht; was schon vorher doppelt
       stand, ist nicht ihre Sache. */
    const mitWahl = wahl.ersetzen.length > 0;
    const ohneWahl = (mitWahl && ziel)
      ? probeEinspielen(ziel, m, { ...ctxVon(meldung, wahl), ersetzen: [] }) : versuch;
    const verdacht = probe ? Math.max(0,
      mehrfachBelegt(probe.bau).length - mehrfachBelegt(ziel.bau).length) : 0;
    /* Was das Ersetzen kostet, steht VOR dem Haken: ausprobiert mit genau diesem
       Abschnitt. Der Verlust erschien im Audit erst, nachdem der Planer
       angekreuzt hatte. */
    const ersetzbar = (ziel && ohneWahl)
      ? ersetzbareAbschnitte(ziel, ohneWahl.kopie, abschnitteDerMeldung)
        .map(a => {
          const mit = probeEinspielen(ziel, m, { ...ctxVon(meldung, wahl), ersetzen: [a.id] });
          const v = mit ? verlust(ziel.bau, mit.kopie.bau) : null;
          if (v) v.material = Math.max(0, v.material - mengenAenderung(ziel.bau, mit.kopie.bau).length);
          return { ...a, gewaehlt: wahl.ersetzen.includes(a.id),
            kostet: v ? { punkte: v.punkte, meldungen: v.meldungen, material: v.material } : null };
        }) : [];
    const verdachtOrte = (probe && verdacht) ? ortsnamen(probe.bau, mehrfachBelegt(probe.bau)) : [];
    const hinweisArt = art => (versuch ? versuch.pruefhinweise : []).find(h => h[art]);

    return {
      ersteName, ersteAls: wahl.ersteAlsAbschnitt && !!ersteName,
      fuehrerWechsel: fuehrerWechsel(bisherAbsender, meldung.von),
      ohneTrupp: !meldung.von,
      /* Hier hat ein benannter Trupp gemeldet, und diese Meldung nennt
         niemanden: weder als eigener Abschnitt noch als Folgemeldung
         zuzuordnen, und einspielen ersetzte seine Aufnahme. */
      ohneTruppKonflikt: !meldung.von && ganzeStrecke && !!ziel && !!ziel.bau &&
        !!bisherAbsender && bisherAbsender !== 'unbekannter Absender' && bauBegonnen(ziel),
      verdopplung: { entfernt: (hinweisArt('doppeltEntfernt') || { doppeltEntfernt: { punkte: 0, meldungen: 0 } })
          .doppeltEntfernt, verdacht, orte: verdachtOrte },
      ersetzbar,
      papierBehalten: (hinweisArt('papierBehalten') || {}).papierBehalten || null,
      papierVerdraengt: (hinweisArt('papierVerdraengt') || {}).papierVerdraengt || [],
      standUebergeben: !!hinweisArt('standUebergeben'),
      hierPapier,
      /* Steht hier etwas ohne Abschnitt? Sonst träte nichts „an die Stelle“. */
      hierOhneAbschnitt: !!(ziel && ziel.bau && ohneAbschnitt(ziel.bau)),
      pruefAbgelehnt: abgelehnt, nichtsGeaendert, papierGemeldet: papierDerMeldung(m),
      standMeldung, standHier, schonDa, ueberholt, aelter, verloren, geaendert,
      daneben, uebergabeFraglich, neueMeldungen, bisher, danach,
      eigenerAbschnittMoeglich, alsEigener, gedeckelt, offeneAbschnitte,
      pruefhinweise: versuch ? versuch.pruefhinweise : [],
      /* Wessen Aufnahme hier steht. Ohne den Namen war „Dabei weichen 3
         Punkte“ nicht von „mein eigener älterer Stand“ zu unterscheiden – und
         im Audit verschwand so die Aufnahme des ANDEREN Trupps. */
      bisherVon: ziel ? bisherVon(ziel, abschnitteDerMeldung, ganzeStrecke) : '',
      standAlt: ziel && ziel.bau ? ziel.bau.stand : '',
      standNeu: m.bau && typeof m.bau.stand === 'string' ? m.bau.stand : '',
      s6: m.bau && typeof m.bau.abweichung === 'string' ? m.bau.abweichung.trim() : '',
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
      /* Auch hier nach dem Inhalt und nicht nach der Zahl: was die Abschrift
         nach dem Einspielen noch trägt, geht nicht verloren. Vorher stand
         „Dabei gehen verloren: 1 Materialzeilen“ auch dann, wenn dieselbe
         Zeile gleich wieder hereinkam. */
      verdraengt: (ziel && ganzeStrecke && probe) ? verdraengtNachInhalt(ziel.bau, probe.bau, verloren) : null,
      /* Was beim Planer verlorenginge. Bei der ganzen Strecke ist das der
         ganze Bogen, bei einzelnen Abschnitten nur deren Eintragungen. */
      ersetzt: ziel ? (ganzeStrecke ? istPunkte(ziel).length
        : istPunkte(ziel).filter(pt => pt.abschnitt &&
            vorhandene.some(a => a.id === pt.abschnitt &&
              abschnitteDerMeldung.includes(a.name))).length) : 0
    };
  });
}

/* Ab wann eine Meldung „älter“ als der Stand hier heißt (ms). Eine Minute: so
   fein stellt am Bauort niemand zwei Geräte, und darunter ist es dieselbe
   Aufnahme. */
const AELTER_ABSTAND = 60 * 1000;

/* Wie weit die Punkte einer Meldung neben der Trasse liegen – für die Vorschau
   und für die Rückfragen nach dem Einspielen. */
function danebenVon(ziel, m) {
  const lage = (ziel && (ziel.punkte || []).length)
    ? ((m.bau && m.bau.punkte) || [])
        .filter(pt => pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng))
        .map(pt => abstandZurLinie(pt, ziel.punkte))
    : [];
  return lage.length ? {
    naechster: Math.min(...lage),
    weitester: Math.max(...lage),
    zahl: lage.filter(d => d >= ABSEITS_SCHWELLE).length,
    alle: lage.every(d => d >= ABSEITS_SCHWELLE)
  } : null;
}

/* Was die Meldung selbst vom Papier mitbringt (Nachtrag am Gerät): der Planer
   liest „3 Punkte“ und hält sie für Aufnahmen vom Bauort. */
function papierDerMeldung(m) {
  const bau = (m && m.bau) || {};
  const papier = [...(Array.isArray(bau.punkte) ? bau.punkte : []),
    ...(Array.isArray(bau.meldungen) ? bau.meldungen : [])].filter(x => x && x.nachgetragen);
  return { zahl: papier.length, ohneZeit: papier.filter(x => !x.zeit).length };
}

/** „davon 1 Eintrag vom Papier, ohne Uhrzeit“ – oder leer, wenn nichts vom Papier ist */
export function papierText(pa) {
  if (!pa || !pa.zahl) return '';
  return `davon ${pa.zahl} ${pa.zahl === 1 ? 'Eintrag' : 'Einträge'} vom Papier` + (pa.ohneZeit
    ? (pa.ohneZeit === pa.zahl ? ', ohne Uhrzeit' : `, ${pa.ohneZeit} ohne Uhrzeit`) : '');
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

/* Steht hier Abgeschriebenes (`nachgetragen`) ohne Abschnitt? Das ist der
   eigene Bestand des Planers und kein Fund vom Bauort. */
const papierOhneAbschnitt = bau => !!bau &&
  [...(bau.punkte || []), ...(bau.meldungen || [])]
    .some(x => nichtZugeordnet(x) && x.nachgetragen);

/* Die geplanten Punkte, die in mehr als einem Abschnitt (null zählt als einer)
   bestätigt sind – je Punkt die Abschnitte, in denen er steht. */
function mehrfachBelegt(bau) {
  const je = new Map();
  for (const u of (bau && bau.punkte) || []) {
    if (!u || !u.sollPunkt) continue;
    if (!je.has(u.sollPunkt)) je.set(u.sollPunkt, new Set());
    je.get(u.sollPunkt).add(u.abschnitt ?? null);
  }
  return [...je].filter(([, orte]) => orte.size > 1);
}
const ortsnamen = (bau, doppelte) => {
  const namen = new Map(((bau && bau.abschnitte) || []).map(a => [a.id, a.name]));
  const aus = new Set();
  for (const [, orte] of doppelte) {
    for (const o of orte) aus.add(o === null ? 'ohne Bauabschnitt' : `„${namen.get(o) || '?'}“`);
  }
  return [...aus];
};

/* Welche hiesigen Abschnitte die Meldung ersetzen könnte, weil sie dieselben
   geplanten Punkte tragen: derselbe Trupp unter anderem Namen (nach „Trupp
   wechseln“, bei geänderter Bezeichnung). Nicht angeboten wird ein Abschnitt,
   der Abgeschriebenes trägt – ihn zu ersetzen nähme die Abschrift des Planers
   heraus, und dafür gibt es `papierBehalten` und keinen Haken. */
function ersetzbareAbschnitte(ziel, probeKopie, namenDerMeldung) {
  const vorher = new Set(mehrfachBelegt(ziel.bau).map(([punkt]) => punkt));
  const hier = new Map(bauabschnitte(ziel).map(a => [a.id, a]));
  const ids = new Set();
  for (const [punkt, orte] of mehrfachBelegt(probeKopie.bau)) {
    if (vorher.has(punkt)) continue;
    for (const o of orte) if (o !== null && hier.has(o)) ids.add(o);
  }
  const traegtPapier = id => [...(ziel.bau.punkte || []), ...(ziel.bau.meldungen || [])]
    .some(x => x.abschnitt === id && x.nachgetragen);
  return [...ids].map(id => hier.get(id))
    .filter(a => !namenDerMeldung.includes(a.name) && !traegtPapier(a.id))
    .map(a => ({ id: a.id, name: a.name, trupp: a.trupp || '' }));
}

function abschnitteEntfernen(ziel, ids) {
  const bau = ziel.bau;
  if (!bau || !ids.length) return;
  const weg = new Set(ids);
  bau.abschnitte = (bau.abschnitte || []).filter(a => !weg.has(a.id));
  for (const feld of ['punkte', 'material', 'meldungen']) {
    bau[feld] = (bau[feld] || []).filter(x => !weg.has(x.abschnitt));
  }
}

/* Was der Planer im Dialog entschieden hat, als Satz Werte – `zuordnung` ist
   ein Feld mit der Zielstrecke je Meldung, und die Entscheidungen hängen als
   Felder daran: `eigenerAbschnitt[i]`, `ersteAlsAbschnitt[i]` und
   `messung[i]` (Stammschlüssel → Messung dieses Absenders übernehmen) und
   `ersetzeAlt[i]` (Kennungen hiesiger Abschnitte, die diese Meldung ersetzt –
   derselbe Trupp unter anderem Namen). */
const wahlVon = (zuordnung, i) => ({
  alsEigener: !!(zuordnung && zuordnung.eigenerAbschnitt && zuordnung.eigenerAbschnitt[i]),
  ersteAlsAbschnitt: !!(zuordnung && zuordnung.ersteAlsAbschnitt && zuordnung.ersteAlsAbschnitt[i]),
  messung: (zuordnung && zuordnung.messung && zuordnung.messung[i]) || {},
  ersetzen: (zuordnung && zuordnung.ersetzeAlt && zuordnung.ersetzeAlt[i]) || []
});
const ctxVon = (meldung, wahl) => ({ von: String((meldung && meldung.von) || ''), ...wahl });

/* Das Einspielen an einer Abschrift – dieselben Schritte wie in
   `einspielen()`, nur ohne Folgen. */
function probeEinspielen(ziel, m, ctx) {
  const kopie = JSON.parse(JSON.stringify(ziel));
  const getan = anwenden(kopie, m, ctx);
  if (!getan) return null;
  return { kopie, frisch: getan.frisch, pruefhinweise: getan.hinweise };
}

/**
 * Die eine Stelle, an der eine Meldung auf eine Strecke trifft – für die
 * Vorschau und für das Einspielen. Zwei Wege, die dasselbe tun sollen, laufen
 * sonst auseinander: die Vorschau erklärte im Audit ein Ergebnis, das das
 * Einspielen nie hergestellt hat.
 *
 * Zurück kommen die Hinweise, die der Planer lesen muss (Prüfung, Übergabe,
 * abgeschriebene Einträge, Doppeltes).
 */
function anwenden(ziel, m, ctx) {
  const planAbweicht = Number.isInteger(m.sollPunkte) &&
    m.sollPunkte !== (ziel.punkte || []).length;
  /* Die erste Meldung ohne Abschnitt wird VOR dem Auflösen in einen Abschnitt
     ihres Absenders gestellt: danach gibt es sie als Abschnitt, und die
     nächste Meldung dieses Trupps findet ihn wieder. */
  if (ctx.ersteAlsAbschnitt) ersteInAbschnitt(ziel);
  abschnitteEntfernen(ziel, ctx.ersetzen || []);
  /* Wer vorher gemeldet hat, wird gemerkt, bevor die Strecke sich ändert. */
  const gleich = !!(ctx.von && ziel.bau && ziel.bau.gemeldetVon &&
    gleicherTrupp(ziel.bau.gemeldetVon, ctx.von));
  const sperreVorher = uebergabeSperre(ziel.bau);
  const frisch = aufloesen(ziel, m, planAbweicht);
  if (!frisch) return null;
  /* Eine Übergabe, die diese Strecke schon einmal aufgehoben hat, gilt nur
     durch eine NEUERE Eintragung wieder (`pruefungZusammenfuehren`). Gemerkt
     wird sie hier, vor dem Ersetzen: bei der Meldung der ganzen Strecke tritt
     ihr Bogen an die Stelle des alten und brächte den Vermerk nicht mit. */
  const c = { ...ctx, gleich, sperre: sperreVorher };
  const hinweise = !frisch.abschnitte.length
    ? ganzeStreckeErsetzen(ziel, frisch, c)
    : abschnitteErsetzen(ziel, frisch, { ...c, ersetzeOhne: ctx.alsEigener && gleich });
  return { frisch, hinweise };
}

/* Ein Eintrag ohne das, was beim Einspielen neu vergeben wird: Kennungen und
   Verweise. Übrig bleibt, was der Trupp ausgesagt hat. */
const inhaltVon = x => {
  const { id, abschnitt, sollPunkt, ...rest } = x || {};
  return JSON.stringify(rest, Object.keys(rest).sort());
};
/* Paart die Einträge von vorher und nachher über ihren Inhalt. Übrig bleiben,
   was vorher stand und danach nicht mehr (`weg`), und was danach neu dasteht
   (`neu`). */
function paaren(vorher, nachher, feld) {
  const da = new Map();
  for (const x of (nachher && nachher[feld]) || []) {
    const k = inhaltVon(x);
    if (!da.has(k)) da.set(k, []);
    da.get(k).push(x);
  }
  const weg = [];
  for (const x of (vorher && vorher[feld]) || []) {
    const liste = da.get(inhaltVon(x));
    if (liste && liste.length) liste.pop();
    else weg.push(x);
  }
  return { weg, neu: [].concat(...da.values()) };
}

const neuNachInhalt = (vorher, nachher, feld) => paaren(vorher, nachher, feld).neu;

function verlust(vorher, nachher, plan = []) {
  /* Ein Punkt, dem der Trupp nach der ersten Meldung eine Bezeichnung
     nachgetragen hat, ist nicht verloren, sondern geändert. Seit ein Verlust
     „Verwerfen“ nach vorn stellt, wäre das sonst bei jeder gewöhnlichen
     zweiten Meldung so gewesen. Erkannt wird er an der Aufnahmezeit – sie
     setzt das Gerät beim Aufnehmen und reist mit.

     Ebenso, wenn die Meldung denselben geplanten Punkt im selben Abschnitt
     trägt: die Abschrift vom Papier und die Aufnahme des Geräts am Punkt 3
     sind zwei Fassungen DERSELBEN Stelle (`papierBehalten` entscheidet, welche
     gilt), und „kennt 1 aufgenommenen Punkt nicht“ stellte einen Verlust fest,
     wo keiner ist. */
  let papier = 0;
  /* Welche Punkte es sind, mit der Nummer in der Planung: die Funkformel nennt
     sie („Punkt 4 und 5“), und der Trupp weiß damit, was er erneut melden soll. */
  const orte = [];
  const nummerIn = id => (plan || []).findIndex(pt => pt.id === id) + 1;
  const zaehle = (feld, ueberZeit) => {
    const { weg, neu } = paaren(vorher, nachher, feld);
    if (!ueberZeit) return { weg: weg.length, geaendert: 0 };
    let verloren = 0, geaendert = 0;
    for (const x of weg) {
      const i = neu.findIndex(n => n && x && n.zeit && n.zeit === x.zeit);
      if (i >= 0) { neu.splice(i, 1); geaendert++; continue; }
      const gleicheStelle = feld === 'punkte' && x && x.sollPunkt &&
        ((nachher && nachher.punkte) || []).some(n => n && n.sollPunkt === x.sollPunkt &&
          (n.abschnitt ?? null) === (x.abschnitt ?? null));
      if (gleicheStelle) { geaendert++; continue; }
      verloren++;
      if (x && x.nachgetragen) papier++;
      if (feld === 'punkte') orte.push({ nr: x && x.sollPunkt ? nummerIn(x.sollPunkt) : 0, papier: !!(x && x.nachgetragen) });
    }
    return { weg: verloren, geaendert };
  };
  const p = zaehle('punkte', true), m = zaehle('meldungen', true), z = zaehle('material', false);
  return { punkte: p.weg, meldungen: m.weg, material: z.weg,
           punkteGeaendert: p.geaendert, meldungenGeaendert: m.geaendert, papier, orte };
}

function mengenAenderung(vorher, nachher) {
  const schluessel = z => `${z.artikel}|${z.abschnitt || ''}|${z.artikel === 'sonstiges' ? z.bemerkung : ''}`;
  const neu = new Map(((nachher && nachher.material) || []).map(z => [schluessel(z), z]));
  const liste = [];
  for (const z of (vorher && vorher.material) || []) {
    const n = neu.get(schluessel(z));
    if (n && n.menge !== z.menge) {
      const m = materialById(z.artikel);
      liste.push({ name: (z.artikel === 'sonstiges' && z.bemerkung) || (m ? m.name : z.artikel),
        einheit: m ? m.einheit : '', alt: z.menge, neu: n.menge });
    }
  }
  return liste;
}

function verdraengtNachInhalt(vorher, nachher, verloren) {
  const v = vorher || {}, n = nachher || {};
  const pv = v.pruefung || {}, pn = n.pruefung || {};
  const namen = new Set((n.abschnitte || []).map(a => a.name));
  const zeilenNachher = new Set((pn.staemme || []).map(inhaltVon));
  /* Eine Prüfzeile desselben Stammes mit neuem Ergebnis oder neuer Zeit ist
     berichtigt und nicht verloren – bei Material gibt es den Abzug „geändert“
     längst, die Prüfzeile stand im Audit als „⚠ Verlust … 1 Prüfzeile“ da, wo
     der Trupp nur nachgemessen hatte. Ein Stamm ohne Namen zählt nicht als
     Treffer: „leer“ passt zu jedem anderen leeren. */
  const stammVon = z => String((z && z.stamm) || '').trim().toLowerCase();
  const staemmeNachher = new Set((pn.staemme || []).map(stammVon).filter(Boolean));
  return {
    abschnitte: (v.abschnitte || []).filter(a => !namen.has(a.name)).length,
    pruefzeilen: (pv.staemme || []).filter(z => !zeilenNachher.has(inhaltVon(z)) &&
      !staemmeNachher.has(stammVon(z))).length,
    uebergabe: !!pv.uebergabeAn && (pv.uebergabeAn !== pn.uebergabeAn || pv.uebergabeZeit !== pn.uebergabeZeit),
    material: verloren.material,
    abweichung: !!v.abweichung && v.abweichung !== n.abweichung
  };
}

/* Wer den Stand gemeldet hat, der ersetzt würde: der Trupp der betroffenen
   Bauabschnitte, sonst der Absender der letzten eingespielten Meldung. */
function bisherVon(ziel, namen, ganzeStrecke) {
  const bau = ziel.bau;
  if (!bau) return '';
  /* Mit Truppführer, wie ihn auch die Meldung nennt (`absenderText` in
     baudoku.js) – verglichen wird über `gleicherAbsender`. */
  const trupps = (bau.abschnitte || [])
    .filter(a => ganzeStrecke || namen.includes(a.name))
    .filter(a => a.trupp).map(a => [a.trupp, a.fuehrer].filter(Boolean).join(' · '));
  if (trupps.length) return [...new Set(trupps)].join(', ');
  return String(bau.gemeldetVon || '');
}

/**
 * Stammen zwei Absenderangaben vom selben Trupp?
 *
 * Verglichen wird je Trupp und nicht die Zeichenkette: „1. FmTr · Krause“ und
 * „1. FmTr“ sind derselbe, sobald eine Seite den Truppführer nicht kennt. Nennen
 * beide einen, und es ist ein anderer, ist es ein anderer Absender – im Audit
 * baute der zweite Trupp unter der vorgewählten Bezeichnung des ersten, und
 * nur der Truppführer verriet ihn.
 */
export function gleicherAbsender(a, b) {
  const teile = t => String(t || '').split(',').map(x => {
    const [trupp, fuehrer = ''] = x.split(' · ').map(truppName);
    return { trupp, fuehrer };
  }).filter(x => x.trupp);
  const x = teile(a), y = teile(b);
  if (!x.length || !y.length) return !x.length && !y.length;
  return x.length === y.length && x.every(p => y.some(q => q.trupp === p.trupp &&
    (!p.fuehrer || !q.fuehrer || p.fuehrer === q.fuehrer)));
}

/**
 * Derselbe TRUPP, gleich wer ihn führt?
 *
 * Für die Frage „ist das eine andere Aufnahme als die hier?“ zählt der Trupp.
 * Wechselt in der Schicht nur der Truppführer, baut weiter derselbe Trupp an
 * derselben Strecke – im Audit galt er als anderer Absender, der Dialog bot
 * „als eigenen Bauabschnitt“ an, und dieselben Punkte standen doppelt da. Der
 * Wechsel selbst bleibt sichtbar (`fuehrerWechsel`).
 */
export function gleicherTrupp(a, b) {
  const teile = t => String(t || '').split(',')
    .map(x => truppName(x.split(' · ')[0])).filter(Boolean);
  const x = teile(a), y = teile(b);
  if (!x.length || !y.length) return !x.length && !y.length;
  return x.length === y.length && x.every(p => y.includes(p));
}

/* Der Trupp am Anfang einer Absenderangabe – „1. FmTr“ aus „1. FmTr · Krause“ */
const absenderTrupp = von => String(von || '').split(',')[0].split(' · ')[0].trim();

/** Wechselt bei gleichem Trupp der Truppführer? `{ alt, neu }` oder `null`. */
export function fuehrerWechsel(bisher, jetzt) {
  const teile = t => String(t || '').split(',')[0].split(' · ').map(x => x.trim());
  if (!bisher || !jetzt || String(bisher).includes(',') || String(jetzt).includes(',')) return null;
  const [t1, f1 = ''] = teile(bisher), [t2, f2 = ''] = teile(jetzt);
  if (!t1 || t1.toLowerCase() !== t2.toLowerCase() || !f1 || !f2) return null;
  return f1.toLowerCase() === f2.toLowerCase() ? null : { alt: f1, neu: f2 };
}

/**
 * Eine Meldung ohne Bauabschnitt als eigenen Abschnitt ihres Absenders.
 *
 * Alles, was sie ohne Abschnitt mitbringt, wird diesem zugeordnet; danach
 * läuft sie den gewöhnlichen Weg (`abschnitteErsetzen`) und lässt den Bestand
 * ohne Abschnitt stehen. Der Name ist der Trupp – so heißt der Abschnitt auch,
 * den „Welcher Trupp seid ihr?“ am Gerät anlegt, und die nächste Meldung
 * desselben Trupps findet ihn wieder.
 */
export function alsEigenerAbschnitt(m, von) {
  const kopie = JSON.parse(JSON.stringify(m));
  const bau = kopie.bau || (kopie.bau = {});
  const [trupp = '', fuehrer = ''] = String(von || '').split(',')[0].split(' · ').map(x => x.trim());
  const name = trupp || 'Bauabschnitt';
  const liste = Array.isArray(bau.abschnitte) ? bau.abschnitte : (bau.abschnitte = []);
  let stelle = liste.findIndex(a => a && (a.name === name || a.trupp === name));
  if (stelle < 0) {
    liste.push({ name, trupp: name, fuehrer });
    stelle = liste.length - 1;
  }
  for (const feld of ['punkte', 'material', 'meldungen']) {
    for (const x of Array.isArray(bau[feld]) ? bau[feld] : []) {
      if (x && nichtZugeordnet(x)) x.abschnitt = stelle;
    }
  }
  return kopie;
}

/**
 * Die Aufnahme ohne Bauabschnitt, die hier steht, rückwirkend zum Abschnitt
 * ihres Absenders machen.
 *
 * Zwei Trupps ohne Abschnitt (die einfache Ansicht kennt „Auftrag an“ nicht):
 * kommt die zweite Meldung als eigener Abschnitt herein, stünde die erste
 * weiter ohne Abschnitt da – und eine Folgemeldung des ersten Trupps hätte
 * entweder den Abschnitt des zweiten überschrieben oder die eigenen Punkte
 * verdoppelt (6 Ist bei 3 Soll, ohne ein Wort). Mit dem Abschnitt hat jeder
 * Trupp sein Feld, und die nächste Meldung findet es wieder.
 *
 * Es geht nur, wenn EIN Absender dahintersteht: bei „1. FmTr, 2. FmTr“ oder
 * ohne Namen wäre der Abschnitt geraten.
 */
function ersteInAbschnitt(ziel) {
  const bau = ziel.bau;
  if (!bau || !ohneAbschnitt(bau)) return null;
  const von = String(bau.gemeldetVon || '');
  const trupp = absenderTrupp(von);
  if (!trupp || von.includes(',') || von === 'unbekannter Absender') return null;
  if (!Array.isArray(bau.abschnitte)) bau.abschnitte = [];
  let a = bau.abschnitte.find(x => x.name === trupp || (x.trupp && gleicherTrupp(x.trupp, trupp)));
  if (!a) {
    a = neuerBauabschnitt(bau);
    a.name = trupp; a.trupp = trupp;
    a.fuehrer = (von.split(' · ')[1] || '').trim();
    bau.abschnitte.push(a);
  }
  for (const feld of ['punkte', 'material', 'meldungen']) {
    for (const x of Array.isArray(bau[feld]) ? bau[feld] : []) {
      if (x && nichtZugeordnet(x)) x.abschnitt = a.id;
    }
  }
  return a;
}

/**
 * Soll „als eigenen Bauabschnitt einspielen“ schon gewählt sein?
 *
 * Ja, wenn es den Abschnitt dieses Absenders hier gibt – dann hat der Planer
 * es bei der vorigen Meldung so entschieden –, und ja, wenn hier die Aufnahme
 * eines ANDEREN Trupps ohne Abschnitt steht: ohne das Häkchen ersetzte die
 * Meldung sie, und der Hauptknopf hieß „Verwerfen“. Im Audit setzte das
 * Folgemeldungen des ersten Trupps ebenso auf „aus“ und löschte den zweiten.
 */
export function eigenerVorgabe(projekt, meldung, i, zielId) {
  const m = (meldung.strecken || [])[i];
  if (!m || ((m.bau && m.bau.abschnitte) || []).length) return false;
  const ziel = zielId === null ? null
    : (projekt.strecken || []).find(s => s.id === zielId) || vorschlag(projekt, m.name);
  const von = String(meldung.von || '');
  const trupp = absenderTrupp(von);
  if (!ziel || !trupp) return false;
  if (bauabschnitte(ziel).some(a => a.name === trupp || (a.trupp && gleicherTrupp(a.trupp, trupp)))) {
    return true;
  }
  const hier = ziel.bau && ziel.bau.gemeldetVon;
  /* Steht hier nur die Abschrift des Planers ohne Abschnitt, hat niemand
     gemeldet – und die Meldung der ganzen Strecke nähme sie heraus. */
  if (!hier) return papierOhneAbschnitt(ziel.bau);
  return hier !== 'unbekannter Absender' && !gleicherTrupp(hier, von) && bauBegonnen(ziel);
}

// ------------------------------------------------ Aufgehobene Übergabe merken

/* Die zuletzt aufgehobene Übergabe dieser Strecke, `{ an, name, zeit }`, oder
   `null`. Sie steht in `uebergabeZurueckWar` und bleibt dort stehen, auch wenn
   der sichtbare Vermerk längst erledigt ist: erst sie verhindert, dass dieselbe
   alte Meldung die Übergabe später still zurückbringt. */
export function uebergabeSperre(bau) {
  const t = String((bau && bau.uebergabeZurueckWar) || '').split('\n');
  return (t[0] || t[1] || t[2]) ? { an: t[0] || '', name: t[1] || '', zeit: t[2] || '' } : null;
}

/* Zu welchem Trupp gehört der Truppführer, der die aufgehobene Übergabe
   gemacht hat? Der Planer soll „Schulz (2. FmTr)“ funken können: die Übergabe
   gehörte nicht dem Melder, und ohne Trupp weiß der Funker nicht, wen er ruft. */
function truppDesFuehrers(name, boegen) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return '';
  for (const bau of boegen) {
    if (!bau) continue;
    for (const a of bau.abschnitte || []) {
      if (a.trupp && String(a.fuehrer || '').trim().toLowerCase() === n) return a.trupp;
    }
    const quellen = [bau.gemeldetVon, ...codesLesen(bau).map(z => z.von),
      ...((bau.pruefung && bau.pruefung.staemme) || []).map(z => z.von)];
    for (const q of quellen) {
      for (const teil of String(q || '').split(',')) {
        const [t, f = ''] = teil.split(' · ').map(x => x.trim());
        if (t && f.toLowerCase() === n) return t;
      }
    }
  }
  return '';
}

// ---------------------------------------------------- Rückgabe-Codes je Absender

/* Je Absender der zuletzt eingespielte Code, als Zeilen „CODE Absender“ in
   `bau.gemeldetCodes`. Ein Feld je Strecke ließ zwei Trupps einander den Code
   überschreiben – fragte der erste später über Funk „ist JE2F angekommen?“,
   stand dort der des zweiten. Älter als sechs Absender werden vergessen. */
const MAX_CODES = 6;

export function codesLesen(bau) {
  const zeilen = String((bau && bau.gemeldetCodes) || '').split('\n')
    .map(z => z.trim()).filter(Boolean)
    .map(z => ({ code: z.slice(0, 4), von: z.slice(4).trim() }));
  if (!zeilen.length && bau && bau.gemeldetCode) zeilen.push({ code: bau.gemeldetCode, von: '' });
  return zeilen;
}

export function codesVermerken(bau, code, von) {
  const nr = absenderTrupp(von);
  const liste = codesLesen(bau).filter(z => !(nr ? gleicherTrupp(z.von, von) : !z.von));
  liste.push({ code, von: nr ? String(von).slice(0, 50) : '' });
  return liste.slice(-MAX_CODES).map(z => (z.code + ' ' + z.von).trim()).join('\n');
}

/* Alles, was `einspielen` neben dem Inhalt der Strecke an ihr vermerkt – zum
   Vergleichen vorher/nachher, ob das Einspielen irgendetwas getan hat. */
const notizenVon = bau => JSON.stringify(bau ? [bau.gemeldetVon, bau.gemeldetCode,
  bau.gemeldetCodes, bau.uebergabeZurueckZeit, bau.uebergabeZurueckStaemme,
  bau.uebergabeZurueckWar, bau.letzteMeldungNichtUebernommen || null] : null);

const uebergabeDa = pr => !!(pr && (pr.uebergabeAn || pr.uebergabeZeit || pr.uebergabeName));

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
  const bericht = { strecken: 0, punkte: 0, bestand: 0, abschnitte: 0, uebersprungen: 0,
    unveraendert: 0, pruefhinweise: [], ausgelassen: [], verluste: [], rueckfragen: [],
    /* `geaendert`: steht danach irgendetwas anderes in der Planung als vorher –
       der Inhalt der Strecken oder auch nur die Notizen des Empfangs (Code, Vermerke).
       Ist es `false`, hat das Einspielen nichts getan, und es gehört kein Schritt
       in den Verlauf. `wirksam`/`unwirksam`: die Strecken, an denen die Meldung etwas
       bewirkt hat – nur an ihnen ist etwas „neu“. `von`: wer gemeldet hat. */
    geaendert: false, wirksam: [], unwirksam: [], von: String(meldung.von || '') };
  const code = meldungsCodeAus(meldung);
  (meldung.strecken || []).forEach((m, i) => {
    const zielId = zuordnung ? zuordnung[i] : undefined;
    const ziel = zielId === null ? null
      : (projekt.strecken || []).find(s => s.id === zielId) || vorschlag(projekt, m.name);
    if (!ziel) { bericht.uebersprungen++; bericht.ausgelassen.push(String(m.name || '')); return; }
    const wahl = wahlVon(zuordnung, i);
    if (wahl.alsEigener) m = alsEigenerAbschnitt(m, meldung.von);

    const vorher = istPunkte(ziel).length;
    const abdruckVorher = bauAbdruck(ziel);
    /* Die Codes der anderen Absender gehören der Strecke und nicht dem Bogen:
       bei der Meldung ohne Abschnitt tritt der ganze Bogen an die Stelle des
       alten und brächte sie nicht mit. Deshalb vorher gemerkt. */
    const codesAlt = { gemeldetCode: ziel.bau && ziel.bau.gemeldetCode,
      gemeldetCodes: ziel.bau && ziel.bau.gemeldetCodes };
    const bauVorher = ziel.bau ? JSON.parse(JSON.stringify(ziel.bau)) : null;
    const notizenVorher = notizenVon(bauVorher);
    const zurueckAlt = { zeit: (bauVorher && bauVorher.uebergabeZurueckZeit) || '',
      staemme: (bauVorher && bauVorher.uebergabeZurueckStaemme) || '',
      war: (bauVorher && bauVorher.uebergabeZurueckWar) || '' };
    const nichtAlt = (bauVorher && bauVorher.letzteMeldungNichtUebernommen) || null;
    const absenderAlt = ziel.bau ? ziel.bau.gemeldetVon : '';
    const getan = anwenden(ziel, m, ctxVon(meldung, wahl));
    if (!getan) { bericht.uebersprungen++; bericht.ausgelassen.push(String(m.name || '')); return; }
    const frisch = getan.frisch;
    bericht.pruefhinweise.push(...getan.hinweise);
    /* Der Absender bleibt an der Strecke stehen: die Streckenliste nennt ihn,
       und die nächste Meldung sagt damit, WESSEN Aufnahme sie ersetzt. */
    /* Ohne Absender steht das auch so da: ein leeres Feld ließ die nächste
       Meldung nicht mehr sagen, wessen Aufnahme sie ersetzt. */
    /* Aber nur, wenn die Meldung hier etwas bewirkt hat: eine, die nichts
       änderte (ihre Prüfung wurde nicht übernommen, der Rest war schon da),
       machte ihren Absender sonst zum „letzten“ und damit eine Nachmessung des
       Trupps, dessen Aufnahme weiter hier steht, zu der eines Fremden. */
    const wirkte = !(abdruckVorher && bauAbdruck(ziel) === abdruckVorher);
    ziel.bau.gemeldetVon = (!wirkte && absenderAlt) ? absenderAlt
      : meldung.von ? String(meldung.von).slice(0, 120) : 'unbekannter Absender';
    /* Und der Rückgabe-Code, gerechnet über die Meldung, wie sie ankam – derselbe,
       den der Trupp am Gerät sieht. Er steht danach an der Strecke neben
       „zuletzt“, damit eine Nachfrage über Funk auch Stunden später noch zu
       beantworten ist. `gemeldetCode` ist der jüngste, `gemeldetCodes` hält
       einen je Absender: zwei Trupps an einer Strecke überschrieben sonst
       einander den Code. */
    ziel.bau.gemeldetCode = code;
    ziel.bau.gemeldetCodes = codesVermerken(codesAlt, code, meldung.von);
    /* Hat diese Meldung eine Übergabe aufgehoben, steht das an der Strecke –
       die Pille nannte es nur kurz, und der Stand sagte danach wieder bloß
       „gebaut“. Der Vermerk bleibt, bis die Strecke wieder übergeben ist oder
       die durchgefallene Prüfung besteht: jede weitere Meldung überschrieb ihn
       bisher, auch die harmlose eines anderen Trupps oder derselbe Link noch
       einmal – die Strecke stand weiter auf „gebaut, nicht übergeben“, und die
       Führung verlor die Warnung. Ersetzt wird er nur von einer Meldung, die
       selbst eine Rücknahme enthält. */
    const aufgehoben = getan.hinweise.find(h => h.uebergabeAufgehoben);
    /* Auch die nicht übernommene Übergabe kann eine hiesige aufgehoben haben
       (`war` am Hinweis). Die veraltete (`uebergabeVeraltet`) hebt nichts auf. */
    const hatWar = aufgehoben ||
      getan.hinweise.find(h => h.uebergabeNichtUebernommen && !h.uebergabeVeraltet && h.war);
    if (hatWar && hatWar.war) hatWar.war.trupp = truppDesFuehrers(hatWar.war.name, [bauVorher, ziel.bau]);
    const bauJetzt = ziel.bau;
    if (hatWar) {
      bauJetzt.uebergabeZurueckZeit = new Date().toISOString();
      bauJetzt.uebergabeZurueckStaemme = hatWar.staemme.join('\n');
      /* Die Notiz, WAS aufgehoben wurde, bleibt auch dann, wenn diese Rücknahme
         nichts Eingetragenes traf: sie ist die Sperre gegen die Wiederkehr. */
      bauJetzt.uebergabeZurueckWar = hatWar.war
        ? [hatWar.war.an, hatWar.war.name, hatWar.war.zeit].join('\n') : zurueckAlt.war;
    } else {
      bauJetzt.uebergabeZurueckZeit = zurueckAlt.zeit;
      bauJetzt.uebergabeZurueckStaemme = zurueckAlt.staemme;
      bauJetzt.uebergabeZurueckWar = zurueckAlt.war;
      const pr = bauJetzt.pruefung;
      if (bauJetzt.stand === 'uebergeben' && uebergabeDa(pr)) {
        /* Wieder übergeben: durch eine neuere Eintragung (die Sperre lässt keine
           andere durch), der Vermerk ist erledigt – und die Sperre mit ihm. */
        bauJetzt.uebergabeZurueckZeit = ''; bauJetzt.uebergabeZurueckStaemme = '';
        bauJetzt.uebergabeZurueckWar = '';
      } else if (!((pr && pr.staemme) || []).some(z => z.bestanden === false)) {
        /* Die Prüfung besteht wieder: die Warnung hat ihren Grund verloren. Die
           Sperre (`uebergabeZurueckWar`) bleibt, bis eine neuere Übergabe kommt. */
        bauJetzt.uebergabeZurueckZeit = ''; bauJetzt.uebergabeZurueckStaemme = '';
      }
    }
    /* Eine Meldung, die nichts übernommen hat, ist nicht angekommen im Sinne
       der Planung: der Code gehört trotzdem an die Strecke, aber mit der
       Kennzeichnung, dass sie nachzufragen ist. Ein Wiederholer mit gleichem
       Code und Absender frischt die Zeit nicht auf (kein neuer Verlaufsschritt).
       Eine wirksame Meldung desselben Trupps erledigt die Notiz. */
    const abgewiesen = getan.hinweise.some(h =>
      (h.stamm && !h.uebernommen) || h.uebergabeNichtUebernommen);
    const vonText = meldung.von ? String(meldung.von).slice(0, 120) : '';
    if (!wirkte && abgewiesen) {
      bauJetzt.letzteMeldungNichtUebernommen = (nichtAlt && nichtAlt.code === code && nichtAlt.von === vonText)
        ? nichtAlt : { code, zeit: new Date().toISOString(), von: vonText };
    } else if (wirkte && nichtAlt && vonText && nichtAlt.von && gleicherTrupp(nichtAlt.von, vonText)) {
      bauJetzt.letzteMeldungNichtUebernommen = null;
    } else {
      bauJetzt.letzteMeldungNichtUebernommen = nichtAlt;
    }
    bericht[wirkte ? 'wirksam' : 'unwirksam'].push(ziel.id);
    if (wirkte || notizenVon(bauJetzt) !== notizenVorher) bericht.geaendert = true;

    /* Was der Trupp wissen muss und die Pille nicht trägt: was beim Planer
       entfallen ist und was beim Trupp nachzufragen bleibt. Gerechnet an den
       Ständen vor und nach dem Einspielen – dieselben Zahlen, die der Dialog
       vorher nannte, nur jetzt für die Funkformel. */
    if (bauVorher) {
      const v = verlust(bauVorher, ziel.bau, ziel.punkte);
      v.material = Math.max(0, v.material - mengenAenderung(bauVorher, ziel.bau).length);
      if (v.punkte || v.meldungen || v.material) {
        bericht.verluste.push({ strecke: ziel.name, ...v,
          von: bisherVon({ bau: bauVorher }, [], true) });
      }
      const doppelt = Math.max(0, mehrfachBelegt(ziel.bau).length - mehrfachBelegt(bauVorher).length);
      if (doppelt) bericht.rueckfragen.push({ strecke: ziel.name, doppelt });
    }
    const abseits = danebenVon(ziel, m);
    if (abseits && abseits.zahl) {
      bericht.rueckfragen.push({ strecke: ziel.name, abseits: abseits.zahl, weit: abseits.weitester });
    }

    bericht.strecken++;
    if (abdruckVorher && bauAbdruck(ziel) === abdruckVorher) bericht.unveraendert++;
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
 * Welcher hiesige Bauabschnitt ist der der gemeldeten?
 *
 * Zuerst über den Namen. Trägt keiner den Namen, dann über den Trupp – aber nur,
 * wenn es hier genau EINEN freien Abschnitt dieses Trupps gibt: das Gerät legt
 * „Bauabschnitt 1“ an, der Planer hat dieselbe Aufnahme vom Papier unter
 * „Nord“ abgeschrieben, beide nennen „Trupp Nord“. Ohne den zweiten Schritt
 * entstand ein dritter Abschnitt desselben Trupps, und die Baudokumentation
 * führte ihn doppelt. Sind es zwei, wird nicht geraten.
 *
 * Zurück kommt je Abschnitt der Meldung `{ name, alt }`; `name` ist der, den der
 * Abschnitt danach trägt – bei einem Treffer über den Trupp der hiesige.
 */
function abschnittZuordnen(vorhandene, roh) {
  const vergeben = new Set();
  const liste = roh.map((a, n) => {
    const name = String((a && a.name) || `Bauabschnitt ${n + 1}`);
    const alt = vorhandene.find(x => x.name === name && !vergeben.has(x.id)) || null;
    if (alt) vergeben.add(alt.id);
    return { name, alt };
  });
  liste.forEach((e, n) => {
    const trupp = roh[n] && roh[n].trupp;
    if (e.alt || !trupp) return;
    const gleichnamig = roh.filter(r => r && r.trupp && gleicherTrupp(r.trupp, trupp)).length;
    const frei = vorhandene.filter(x => !vergeben.has(x.id) && x.trupp && gleicherTrupp(x.trupp, trupp));
    if (gleichnamig === 1 && frei.length === 1) {
      vergeben.add(frei[0].id);
      e.alt = frei[0];
      e.name = frei[0].name;
    }
  });
  return liste;
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
  const zuordnungen = abschnittZuordnen(bauabschnitte(ziel), abschnitte);
  abschnitte.forEach((a, n) => {
    /* Der Name wird festgeschrieben, BEVOR gesucht wird, und zwar genauso, wie
       `bauNormalisieren()` ihn gleich darauf herstellen wird. Sonst suchte
       diese Zeile mit einem leeren Namen, fände nichts, und der Namensvergleich
       in `abschnitteErsetzen()` träfe eine Zeile später doch – auf eine andere
       Kennung. Der Bogen beider Trupps wäre dann weg. */
    const z = zuordnungen[n];
    a.name = z.name;
    a.id = z.alt ? z.alt.id : (a.id || neueKennung());
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
    a.ausfallNach = punktKennung(a.ausfallNach);
  });
  roh.ausfallNach = punktKennung(roh.ausfallNach);
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
   liefe darauf hinaus, zwei Bögen zu verschmelzen.

   Mit einer Ausnahme: die Prüfung gehört der Leitung und nicht dem Bogen, und
   dieselbe Je-Stamm-Regel wie bei der Teilmeldung gilt auch hier
   (`pruefungZusammenfuehren`): im Audit ersetzte die Meldung ohne Abschnitt den
   ganzen Bogen samt Prüfung, ein durchgefallener Stamm verschwand hinter einem
   „bestanden nach Reparatur“ des zweiten Trupps, und im Gegenfall stand
   „übergeben“ neben „Prüfung nicht bestanden“. */
function ganzeStreckeErsetzen(ziel, frisch, ctx = {}) {
  const alt = ziel.bau;
  ziel.bau = frisch;
  const hinweise = pruefungZusammenfuehren(frisch, frisch, ctx, alt ? alt.pruefung : null, true);
  /* Die Übergabe steht aus der Prüfung hier weiter da, der Stand aber kommt
     aus der Meldung – „im Bau“ neben einer eingetragenen Übergabe, und der
     Planer erfuhr nicht, welches von beiden gilt. Eine Übergabe ist geschehen
     (3.5) und geht vor, solange kein Stamm durchgefallen ist; sonst hat
     `pruefungZusammenfuehren` den Stand schon auf „gebaut“ gesetzt. */
  const pr = frisch.pruefung;
  const uebergeben = !!(pr && (pr.uebergabeAn || pr.uebergabeZeit || pr.uebergabeName));
  if (uebergeben && rang(frisch.stand) < rang('uebergeben') &&
      !(pr.staemme || []).some(z => z.bestanden === false)) {
    frisch.stand = 'uebergeben';
    hinweise.push({ standUebergeben: true });
  }
  return hinweise;
}

/* Eine Meldung MIT Bauabschnitten ersetzt genau die, die sie nennt. Was beim
   Planer an anderen Abschnitten hängt, bleibt unangetastet – das ist der ganze
   Zweck der Abschnitte: dass zwei Trupps nie in dasselbe Feld schreiben. */
function abschnitteErsetzen(ziel, frisch, ctx = {}) {
  const bau = ziel.bau || (ziel.bau = bauNormalisieren({}));
  const betroffen = new Set();
  const vergeben = new Set();
  const paare = [];

  for (const neu of frisch.abschnitte) {
    /* Jeder vorhandene Abschnitt wird höchstens EINMAL vergeben: trüge eine
       Meldung zwei Abschnitte desselben Namens, fielen sonst beide auf
       denselben Eintrag, und der zweite verlöre seine Eintragungen. */
    const alt = (bau.abschnitte || []).find(a => a.name === neu.name && !vergeben.has(a.id));
    if (alt) {
      vergeben.add(alt.id);
      betroffen.add(alt.id);
      paare.push({ alt, neu, vorher: { ...alt } });
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
     nennt diesen Bestand eigens.

     Ebenso, wenn dieselbe Aufnahme als eigener Abschnitt hereinkommt
     (`ersetzeOhne`): was derselbe Trupp zuvor ohne Abschnitt gemeldet hat, ist
     der ältere Stand DESSELBEN Bogens und geht in den Abschnitt über, statt
     neben ihm zu stehen. */
  if (ohneAbschnitt(frisch) || ctx.ersetzeOhne) betroffen.add(null);

  const behalten = papierBehalten(bau, frisch, betroffen, ziel);

  /* Dieselbe Aufnahme, die hier schon ohne Abschnitt steht, wird nicht
     doppelt geführt – bei einer Folgemeldung nach „als eigenen Abschnitt“ der
     Fall, wenn der Bestand dem Absender nicht (mehr) zuzuordnen war. Exakt
     Gleiches fällt weg; Ähnliches nennt der Dialog (`verdopplung`). */
  let doppelt = { punkte: 0, meldungen: 0 };
  if (!betroffen.has(null)) {
    const gleich = (liste, x) => liste.some(n => inhaltVon(n) === inhaltVon(x));
    const mitPunkten = frisch.punkte.filter(pt => betroffen.has(pt.abschnitt));
    const mitMeldungen = frisch.meldungen.filter(mm => betroffen.has(mm.abschnitt));
    const punkteVorher = bau.punkte.length, meldungenVorher = bau.meldungen.length;
    bau.punkte = bau.punkte.filter(pt => !(nichtZugeordnet(pt) && gleich(mitPunkten, pt)));
    bau.meldungen = bau.meldungen.filter(mm => !(nichtZugeordnet(mm) && gleich(mitMeldungen, mm)));
    doppelt = { punkte: punkteVorher - bau.punkte.length,
      meldungen: meldungenVorher - bau.meldungen.length };
  }

  bau.punkte = istPunkteOrdnen(ziel, behalten.punkte(bau.punkte, frisch.punkte));
  bau.material = behalten.material(bau.material, frisch.material);
  bau.meldungen = behalten.meldungen(bau.meldungen, frisch.meldungen);

  /* Erst jetzt die Abschnitte selbst: ob einer abgeschriebene Einträge trägt,
     steht erst nach dem Zusammenführen der Listen fest. Trägt er welche, ist
     die Abschrift die vollständigere Auskunft über Beginn, Ende und Ausfall –
     das Gerät, das ausfiel, kennt sie nicht –, und leere Felder der Meldung
     löschen sie nicht. */
  for (const { alt, neu, vorher } of paare) {
    /* Die Farbe bleibt die des Planers: an ihr hängt die Karte, die er vor
       sich hat, und der Trupp hat sie nie gesehen. */
    Object.assign(alt, neu, { id: alt.id, farbe: alt.farbe });
    if (behalten.abschnitte.has(alt.id)) {
      for (const f of ['trupp', 'fuehrer', 'beginn', 'ende', 'ausfallZeit', 'ausfallNach',
        'vonPunkt', 'bisPunkt']) {
        if (!alt[f] && vorher[f]) alt[f] = vorher[f];
      }
    }
  }

  bau.stand = standNachTeilmeldung(bau.stand, frisch.stand);

  const hinweise = pruefungZusammenfuehren(bau, frisch, ctx, bau.pruefung, false);
  if (behalten.zahl) hinweise.push({ papierBehalten: behalten.zahl });
  if (behalten.verdraengt.length) hinweise.push({ papierVerdraengt: behalten.verdraengt });
  if (doppelt.punkte || doppelt.meldungen) hinweise.push({ doppeltEntfernt: doppelt });

  /* Zwei Abweichungsmeldungen werden aneinandergehängt und nicht ersetzt: was
     der eine Trupp gemeldet hat, geht den anderen nichts an, und der S 6
     braucht beides. */
  if (frisch.abweichung && frisch.abweichung !== bau.abweichung) {
    bau.abweichung = bau.abweichung
      ? bau.abweichung + '\n\n' + frisch.abweichung : frisch.abweichung;
  }
  return hinweise;
}

/**
 * Was vom Papier abgeschrieben wurde, bleibt beim Ersetzen eines Abschnitts.
 *
 * Fällt das Gerät eines Trupps aus (Schema 19), schreibt der Planer den Rest
 * vom Baunachweis ab; später meldet das Gerät doch noch seinen Teil – die
 * Punkte VOR dem Ausfall. Ersetzte die Meldung den Abschnitt wie gewohnt,
 * nähme sie die abgeschriebenen Punkte, Meldungen und die 620 m Kabel heraus,
 * und die Warnung darüber hieß „beim Trupp nachfragen“ – der hat sie nie
 * gesehen. Behalten wird deshalb, was `nachgetragen` trägt, und je Eintrag mit
 * der Meldung zusammengeführt:
 *
 *  - Punkte mit demselben geplanten Punkt: das Gerät gewinnt nur mit der
 *    späteren Zeit, sonst bleibt die Abschrift. Ein Punkt ohne Planbezug
 *    (ein Mast) ist derselbe, wenn Art und Zeit übereinstimmen.
 *  - Meldungen mit gleicher Zeit und gleichem Wortlaut sind eine.
 *  - Material: der Abschnitt hat Abschriften, also gilt seine Menge – das
 *    Gerät, das ausfiel, hat nach dem Ausfall nichts mehr gezählt. Ein Artikel,
 *    den nur die Abschrift kennt, bleibt; hat die Abschrift keine Menge, gilt
 *    die des Geräts. Material trägt keine Marke `nachgetragen`, der Abschnitt
 *    gilt als abgeschrieben, sobald ein Punkt oder eine Meldung es ist.
 *
 * Geliefert werden Griffe, die der Aufrufer in der Reihenfolge seiner Schritte
 * auf die Listen anwendet (alte Liste, Liste der Meldung → neue Liste).
 */
function papierBehalten(bau, frisch, betroffen, ziel) {
  const abschnitte = new Set();
  const zahl = { punkte: 0, meldungen: 0, material: 0 };
  /* Wo Abschrift und Gerät denselben Punkt tragen, gilt eine von beiden – und
     die andere Zeile verschwindet. Das wird genannt: bei leerer Uhrzeit der
     Abschrift (der Nachtrag lässt sie freiwillig) gewann das Gerät still. */
  const verdraengt = [];
  const nummer = id => (ziel.punkte || []).findIndex(pt => pt.id === id) + 1;
  const hierP = (bau.punkte || []).filter(x => betroffen.has(x.abschnitt) && x.nachgetragen);
  const hierM = (bau.meldungen || []).filter(x => betroffen.has(x.abschnitt) && x.nachgetragen);
  const neuP = (frisch.punkte || []).filter(x => betroffen.has(x.abschnitt));
  const neuM = (frisch.meldungen || []).filter(x => betroffen.has(x.abschnitt));
  const behaltenP = [], behaltenM = [], ersetzt = new Map();
  for (const k of hierP) {
    const gegen = k.sollPunkt
      ? neuP.findIndex(n => n.sollPunkt === k.sollPunkt && n.abschnitt === k.abschnitt)
      : neuP.findIndex(n => !n.sollPunkt && n.zeit && n.zeit === k.zeit && n.art === k.art &&
          n.abschnitt === k.abschnitt);
    if (gegen >= 0) {
      /* Das Gerät gewinnt nur mit der späteren Zeit – bei Gleichstand ist es
         derselbe Eintrag, und der steht schon in der Meldung. */
      if (!k.sollPunkt || (neuP[gegen].zeit || '') >= (k.zeit || '')) {
        if (k.sollPunkt && (neuP[gegen].zeit || '') !== (k.zeit || '')) {
          verdraengt.push({ nr: nummer(k.sollPunkt), gewinnt: 'geraet', ohneZeit: !k.zeit });
        }
        continue;
      }
      verdraengt.push({ nr: nummer(k.sollPunkt), gewinnt: 'papier', ohneZeit: false });
      ersetzt.set(neuP[gegen], k);
    } else behaltenP.push(k);
    abschnitte.add(k.abschnitt);
    zahl.punkte++;
  }
  for (const k of hierM) {
    if (neuM.some(n => n.zeit === k.zeit && n.text === k.text)) continue;
    behaltenM.push(k);
    abschnitte.add(k.abschnitt);
    zahl.meldungen++;
  }
  const schluessel = z =>
    `${z.artikel}|${z.abschnitt || ''}|${z.artikel === 'sonstiges' ? z.bemerkung : ''}`;
  return {
    abschnitte, verdraengt,
    zahl: (zahl.punkte || zahl.meldungen) ? zahl : null,
    punkte: (liste, frischeListe) => liste.filter(x => !betroffen.has(x.abschnitt))
      .concat(frischeListe.filter(x => betroffen.has(x.abschnitt)).map(x => ersetzt.get(x) || x),
        behaltenP),
    meldungen: (liste, frischeListe) => liste.filter(x => !betroffen.has(x.abschnitt))
      .concat(frischeListe.filter(x => betroffen.has(x.abschnitt)), behaltenM),
    material: (liste, frischeListe) => {
      const neu = frischeListe.filter(z => betroffen.has(z.abschnitt));
      const hier = (liste || []).filter(z => abschnitte.has(z.abschnitt));
      const zeilen = neu.map(z => {
        const h = hier.find(x => schluessel(x) === schluessel(z));
        return h && h.menge !== null && h.menge !== undefined ? h : z;
      });
      for (const h of hier) if (!neu.some(z => schluessel(z) === schluessel(h))) zeilen.push(h);
      zahl.material = hier.length;
      return (liste || []).filter(z => !betroffen.has(z.abschnitt)).concat(zeilen);
    }
  };
}

/* Ein Prüfergebnis in Worten, für die Hinweise des Empfangsdialogs */
const ergebnisWort = z => z.bestanden === false ? 'durchgefallen'
  : z.bestanden === true ? 'bestanden' : 'offen';

/**
 * Prüfung und Übergabe einer Meldung mit dem Stand hier zusammenführen –
 * mit oder ohne Bauabschnitt.
 *
 * Prüfung und Übergabe gehören der ganzen Leitung und nicht einem Abschnitt.
 * Bisher trug eine Teilmeldung sie nur ein, wo beim Planer noch nichts stand –
 * ganz oder gar nicht. Im Audit meldete der zweite Trupp „Stamm 1
 * durchgefallen“, beim Planer stand schon „bestanden“ vom ersten, und die
 * Meldung verschwand ohne ein Wort; die Baudokumentation druckte „bestanden,
 * übergeben“ über einer Leitung, die nicht ging.
 *
 * Jetzt je Stamm, mit drei Regeln:
 *
 *  1. Eine Nachmessung DESSELBEN Trupps ersetzt seine frühere Messung, wie
 *     auch immer sie ausfiel. Wer eine durchgefallene Leitung repariert und neu
 *     misst, meldet „bestanden“ – und das darf nicht an der eigenen alten
 *     Messung scheitern, sonst ist die Übergabe nie zu erreichen.
 *  2. Sonst gewinnt ein „durchgefallen“ immer gegen „bestanden“: wer eine
 *     Leitung für gut hält, die ein anderer gerade als schlecht gemessen hat,
 *     übergibt sonst eine kaputte.
 *  3. Sonst ersetzt die neuere Messung desselben Stammes die ältere.
 *
 * Ein gemeldetes „bestanden“ eines ANDEREN Trupps gegen ein „durchgefallen“
 * hier wird nicht übernommen, sondern genannt – ob repariert und neu gemessen
 * wurde, weiß nur der Trupp; der Planer kann die Messung ausdrücklich
 * übernehmen (`ctx.messung`).
 *
 * Eine Übergabe setzt eine bestandene Prüfung voraus (3.5). Steht nach dem
 * Zusammenführen ein durchgefallener Stamm da, wird eine gemeldete Übergabe
 * nicht übernommen, und der Stand fällt von „übergeben“ auf „gebaut“. Wer an
 * wen übergeben hat, bleibt stehen, wo es schon dastand – es ist geschehen und
 * gehört in die Dokumentation, nur gilt es nicht mehr.
 *
 * `bau` ist der Bogen, der danach gilt, `hier` die Prüfung, gegen die
 * zusammengeführt wird. Bei der Meldung ohne Abschnitt (`ganze`) ist `bau` die
 * Meldung selbst, bei der Teilmeldung der Bogen hier.
 *
 * Zurück kommt, was der Planer lesen muss – je Stamm ein Eintrag.
 */
function pruefungZusammenfuehren(bau, frisch, ctx, hier, ganze) {
  const hinweise = [];
  const neu = frisch.pruefung;
  const hatUebergabe = pr => !!(pr && (pr.uebergabeAn || pr.uebergabeZeit || pr.uebergabeName));
  const name = z => String((z && z.stamm) || '').trim();
  const schluessel = z => name(z).toLowerCase();
  const gemessen = z => z.bestanden !== null || !!String(z.ergebnis || '').trim();
  const vonHier = new Set(hier ? hier.staemme : []);
  let ergebnis = hier || neu || null;
  /* Jede Zeile, die hier danach gilt, trägt den Absender der Meldung, aus der
     sie kommt. „Derselbe Trupp“ hing vorher am letzten Absender der ganzen
     Strecke – meldete der zweite Trupp dazwischen, galt die Nachmessung des
     ersten als fremd (und, umgekehrt, die abgelehnte Messung des zweiten beim
     nächsten Einspielen als eigene). Die Zeile weiß selbst, wessen Messung sie
     ist. Zeilen aus der Zeit davor tragen keinen Absender; für sie gilt wie
     bisher der letzte Absender an der Strecke (`ctx.gleich`). */
  const absender = String(ctx.von || '').slice(0, 120);
  const gemerkt = z => { z.von = absender; return z; };
  const desselben = h => !!ctx.von && (h.von ? gleicherTrupp(h.von, ctx.von) : !!ctx.gleich);
  if (!hier && neu) (neu.staemme || []).forEach(gemerkt);

  if (hier && neu) {
    for (const g of neu.staemme || []) {
      const stelle = hier.staemme.findIndex(h => schluessel(h) === schluessel(g));
      if (stelle < 0) { hier.staemme.push(gemerkt(g)); continue; }
      const h = hier.staemme[stelle];
      let nehmen, fraglich = false, nachmessung = false;
      if (desselben(h) && gemessen(g) && gemessen(h) && g.zeit) {
        /* Gleiche oder spätere Zeit: dieselbe Zeile desselben Trupps, deren
           Ergebnis er geändert hat, ist die NEUE Messung. Die Zeile behielt
           bisher die Zeit der ersten (die Oberfläche setzte sie beim Ändern des
           Ergebnisses nicht nach), und bei Gleichstand blieb „durchgefallen“
           beim Planer stehen. Trägt die Meldung keine Zeit, gelten die Regeln darunter. */
        nehmen = g.zeit >= (h.zeit || '');
        nachmessung = nehmen;
      } else if (g.bestanden === false && h.bestanden !== false) nehmen = true;
      else if (h.bestanden === false && g.bestanden !== false) {
        nehmen = !!(ctx.messung && ctx.messung[schluessel(g)]);
        fraglich = g.bestanden === true;
      } else if (!gemessen(g)) nehmen = false;
      else if (!gemessen(h)) nehmen = true;
      else nehmen = (g.zeit || '') > (h.zeit || '');
      if (ergebnisWort(g) !== ergebnisWort(h)) {
        /* `hierVon`: wessen Messung hier steht – bei einer fremden Messung
           verlangt die Funkformel nicht, neu zu messen, sondern nennt sie. */
        hinweise.push({ stamm: name(g) || 'Stamm ohne Namen', schluessel: schluessel(g),
          hier: ergebnisWort(h), gemeldet: ergebnisWort(g), uebernommen: nehmen, fraglich,
          nachmessung, hierVon: String(h.von || '') });
      }
      if (nehmen) hier.staemme[stelle] = gemerkt(g);
    }
  }

  const durchgefallen = ergebnis ? ergebnis.staemme.filter(z => z.bestanden === false) : [];
  /* Bei der Meldung ohne Abschnitt sperrt nur, was von hier stammt: ein Trupp,
     der „trotzdem übergeben“ wählt, steht mit seiner eigenen Messung da – das
     sagt der Dialog schon vorher (`uebergabeFraglich`). */
  const sperrend = ganze ? durchgefallen.filter(z => vonHier.has(z)) : durchgefallen;

  /* Die aufgehobene Übergabe kommt nicht durch das Wiedereinspielen eines
     älteren Standes zurück: Meier misst nach, die Prüfung besteht – und
     Schulz schickt seine alte, unveränderte Meldung noch einmal. Ohne die
     Sperre stand die Übergabe still wieder da, der Planer wurde nicht gefragt.
     Gilt nur eine Eintragung mit späterer Zeit als die aufgehobene. */
  const sperre = ctx.sperre || null;
  const veraltet = !!(sperre && neu && hatUebergabe(neu) &&
    !(neu.uebergabeZeit && neu.uebergabeZeit > sperre.zeit));
  let blockiert = false;
  if (veraltet) {
    if (!hier) { neu.uebergabeAn = ''; neu.uebergabeZeit = ''; neu.uebergabeName = ''; }
    if (!hier || !hatUebergabe(hier)) {
      blockiert = true;
      hinweise.push({ uebergabeNichtUebernommen: true, uebergabeVeraltet: true, staemme: [],
        war: sperre });
    }
  } else if (neu && hatUebergabe(neu)) {
    const staemme = sperrend.map(z => name(z) || 'ein Stamm');
    if (!hier) {
      if (sperrend.length) {
        neu.uebergabeAn = ''; neu.uebergabeZeit = ''; neu.uebergabeName = '';
        hinweise.push({ uebergabeNichtUebernommen: true, staemme });
      }
    } else if (ganze || !hatUebergabe(hier)) {
      if (sperrend.length) {
        hinweise.push({ uebergabeNichtUebernommen: true, staemme });
      } else {
        hier.uebergabeAn = neu.uebergabeAn;
        hier.uebergabeZeit = neu.uebergabeZeit;
        hier.uebergabeName = neu.uebergabeName;
      }
    }
  }

  if (ergebnis) bau.pruefung = ergebnis;
  /* Stand und Übergabe bleiben synchron: die alte Meldung nannte „übergeben“,
     die Übergabe gilt aber nicht mehr. */
  if (blockiert && bau.stand === 'uebergeben' && !hatUebergabe(ergebnis)) bau.stand = 'gebaut';
  /* Neben einem durchgefallenen Stamm gilt keine Übergabe (3.5). Der Stand fiel
     bisher auf „gebaut“, die Übergabe aber blieb eingetragen – die Dokumentation
     führte „übergeben an …“ neben „Prüfung nicht bestanden“, und im Abschnittsfall
     (Stand schon vorher „gebaut“, Übergabe aus einer früheren Meldung) erfuhr der
     Planer von der Aufhebung gar nichts. Jetzt wird sie geleert und als `war`
     festgehalten: nicht still gelöscht, aber auch nicht als gültige Übergabe
     weitergeführt. */
  if (durchgefallen.length && (bau.stand === 'uebergeben' || hatUebergabe(ergebnis))) {
    const war = hatUebergabe(ergebnis) ? {
      an: ergebnis.uebergabeAn, name: ergebnis.uebergabeName, zeit: ergebnis.uebergabeZeit } : null;
    if (war) { ergebnis.uebergabeAn = ''; ergebnis.uebergabeZeit = ''; ergebnis.uebergabeName = ''; }
    if (bau.stand === 'uebergeben') bau.stand = 'gebaut';
    const staemme = durchgefallen.map(z => name(z) || 'ein Stamm');
    /* Wurde die gemeldete Übergabe ohnehin nicht übernommen, sagt das schon der
       Hinweis darüber – zweimal dasselbe liest niemand. Was hier stand, trägt
       er dann mit. */
    const schon = hinweise.find(h => h.uebergabeNichtUebernommen && !h.uebergabeVeraltet);
    if (schon) { if (war) schon.war = war; }
    else hinweise.push({ uebergabeAufgehoben: true, staemme, war });
  }
  return hinweise;
}

/** Was vom Gemeldeten NICHT übernommen wurde, in Stichworten für die Pille */
function teilText(bericht) {
  const teile = [];
  for (const h of bericht.pruefhinweise || []) {
    if (h.stamm && !h.uebernommen) teile.push(`Prüfung ${h.stamm} nicht übernommen`);
    else if (h.uebergabeNichtUebernommen) teile.push('Übergabe nicht übernommen');
    else if (h.uebergabeAufgehoben) teile.push('Übergabe aufgehoben');
  }
  if (bericht.uebersprungen) {
    teile.push(`${bericht.uebersprungen} ${bericht.uebersprungen === 1
      ? 'Strecke ausgelassen' : 'Strecken ausgelassen'}`);
  }
  return teile.join(', ');
}

/**
 * Was vom Gemeldeten NICHT übernommen wurde, einzeln und im Klartext – für die
 * Funkformel nach dem Einspielen. Die Pille nennt es in Stichworten
 * (`teilText`) und ist nach drei Sekunden weg; der Trupp, der „angekommen“ hört,
 * hält die Übergabe sonst für verbucht.
 */
export function nichtUebernommen(bericht) {
  return [...pruefungNicht(bericht), ...ausgelasseneStrecken(bericht)];
}

/** Die Übergabe, die aufgehoben wurde, in einem Satzteil – leer, wenn nichts stand */
export function uebergabeWarText(war) {
  if (!war) return '';
  return [war.an && `an ${war.an}`, war.name && `durch ${war.name}`,
    war.zeit && uhrzeit(war.zeit)].filter(Boolean).join(', ');
}

/* „Meier (1. FmTr)“ aus „1. FmTr · Meier“ – so wird ein Trupp über Funk gerufen */
const absenderKurz = von => {
  const [trupp = '', fuehrer = ''] = String(von || '').split(',')[0].split(' · ').map(x => x.trim());
  return fuehrer && trupp ? `${fuehrer} (${trupp})` : (fuehrer || trupp);
};

const esc = t => String(t).replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Wem gehörte die aufgehobene Übergabe? `war.name` ist, wer sie gemacht hat;
   der Trupp dazu steht dabei, wenn die Strecke ihn kennt (`truppDesFuehrers`). */
const warBesitzer = war => !war || !war.name ? ''
  : (war.trupp ? `${war.name} (${war.trupp})` : war.name);

/* Prüfung und Übergabe, die nicht galten – das, was der Trupp neu messen oder
   neu melden muss. */
function pruefungNicht(bericht) {
  const liste = [];
  const staemme = h => h.staemme.join(', ');
  const ist = h => (h.staemme.length === 1 ? 'ist' : 'sind');
  const war = h => { const t = uebergabeWarText(h.war); return t ? ` – eingetragen war: ${t}` : ''; };
  for (const h of bericht.pruefhinweise || []) {
    if (h.stamm && !h.uebernommen) {
      /* Eine fremde Messung wird genannt, nicht nur das Ergebnis: bei „hier
         durchgefallen, gemeldet bestanden“ zählt, WESSEN Messung beim Planer steht. */
      const fremd = h.fraglich && h.hierVon
        ? `hier gilt die Messung von ${absenderKurz(h.hierVon)}: ` : 'hier ';
      liste.push(`Prüfung ${h.stamm} (${fremd}${h.hier}, gemeldet ${h.gemeldet})`);
    } else if (h.uebergabeVeraltet) {
      liste.push('Übergabe (die aufgehobene Übergabe kehrt nicht durch eine ' +
        `ältere Meldung zurück)${war(h)}`);
    } else if (h.uebergabeNichtUebernommen) {
      liste.push(`Übergabe (${staemme(h)} ${ist(h)} durchgefallen)${war(h)}`);
    } else if (h.uebergabeAufgehoben) {
      const von = warBesitzer(h.war);
      liste.push(`Übergabe${von ? ' von ' + von : ''} aufgehoben ` +
        `(${staemme(h)} ${ist(h)} durchgefallen)${war(h)}`);
    }
  }
  return liste;
}

/* Was welcher Trupp jetzt tun soll, getrennt nach Adressat. Die Formel sprach
   bei aufgehobener Übergabe den MELDER an („muss neu messen“) – die Übergabe
   gehörte aber einem anderen Trupp, und der erfuhr nichts. Bei einer fremden
   Messung hieß es „neu messen“, obwohl die Messung beim Planer steht und nur
   übernommen werden muss. */
function aufgaben(bericht) {
  const liste = [];
  const melder = absenderKurz(bericht.von) || 'Der Melder';
  const gleich = war => !!war && !!war.name &&
    String(bericht.von || '').toLowerCase().includes(String(war.name).toLowerCase());
  for (const h of bericht.pruefhinweise || []) {
    if (h.stamm && !h.uebernommen) {
      if (h.fraglich) {
        liste.push(`${melder}: Neu messen ist nicht nötig – beim Planer gilt ${h.hierVon
          ? 'die Messung von ' + absenderKurz(h.hierVon) : 'eine andere Messung'} (${h.hier}); ` +
          `der Planer kann „${h.stamm}“ übernehmen, wenn er die Meldung noch einmal öffnet`);
      } else {
        liste.push(`${melder}: Prüfung „${h.stamm}“ neu messen und melden`);
      }
    } else if (h.uebergabeVeraltet) {
      const von = warBesitzer(h.war);
      liste.push(`${von || melder}: Die Übergabe${h.war && h.war.an ? ' an ' + h.war.an : ''} ` +
        'ist beim Planer aufgehoben und gilt nur durch eine neue Übergabe – ' +
        'nach bestandener Prüfung neu übergeben und melden');
    } else if (h.uebergabeNichtUebernommen || h.uebergabeAufgehoben) {
      const ist = h.staemme.length === 1 ? 'ist' : 'sind';
      liste.push(`${melder}: ${h.staemme.join(', ')} ${ist} durchgefallen – ` +
        'nach der Reparatur neu messen und melden');
      const von = warBesitzer(h.war);
      if (h.war && !gleich(h.war) && von) {
        liste.push(`${von}: Die Übergabe${h.war.an ? ' an ' + h.war.an : ''} ist beim Planer ` +
          'aufgehoben – erst nach bestandener Prüfung neu übergeben und melden');
      } else if (h.uebergabeAufgehoben) {
        liste.push(`${melder}: Danach die Übergabe neu melden`);
      }
    }
  }
  return liste;
}

/* Eine Strecke, die der Planer im Dialog bewusst abgewählt hat, wird mit
   Namen genannt: „1 Strecke ausgelassen“ ließ den Trupp raten, welche – und
   schien zu verlangen, dass er etwas neu misst. */
function ausgelasseneStrecken(bericht) {
  if (!bericht.uebersprungen) return [];
  const namen = (bericht.ausgelassen || []).filter(Boolean);
  if (namen.length === bericht.uebersprungen) {
    return namen.map(n => `Strecke „${n}“ nicht eingespielt (ausgelassen)`);
  }
  return [`${bericht.uebersprungen} ${bericht.uebersprungen === 1
    ? 'Strecke ausgelassen' : 'Strecken ausgelassen'}`];
}

/** „3 aufgenommene Punkte, 1 Baumeldung und 2 Materialzeilen“ aus einem Verlust */
export const zaehlText = v => [
  v.punkte && `${v.punkte} ${v.punkte === 1 ? 'aufgenommener Punkt' : 'aufgenommene Punkte'}`,
  v.meldungen && `${v.meldungen} ${v.meldungen === 1 ? 'Baumeldung' : 'Baumeldungen'}`,
  v.material && `${v.material} ${v.material === 1 ? 'Materialzeile' : 'Materialzeilen'}`
].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' und $1');

/* Was beim Planer entfallen ist, in einem Satz je Strecke: welche Punkte (mit
   der Nummer in der Planung), und woher sie stammten. „1 aufgenommener Punkt
   entfällt“ ließ den Trupp raten, welcher – und dass es die Abschrift des
   Planers vom Papier war, stand nirgends. Der Name der Strecke steht ohne
   Anführungszeichen: „Strecke „Strecke 1““ ließ sich nicht sprechen. */
function verlustSatz(e) {
  const orte = e.orte || [];
  const nummern = [...new Set(orte.filter(o => o.nr).map(o => o.nr))].sort((a, b) => a - b);
  const ohne = orte.filter(o => !o.nr).length;
  const teile = [];
  if (nummern.length) teile.push('Punkt ' + nummern.join(', ').replace(/, ([^,]*)$/, ' und $1'));
  if (ohne) teile.push(`${ohne} ${ohne === 1 ? 'Punkt' : 'Punkte'} ohne Planbezug`);
  if (!orte.length && e.punkte) {
    teile.push(`${e.punkte} ${e.punkte === 1 ? 'aufgenommener Punkt' : 'aufgenommene Punkte'}`);
  }
  if (e.meldungen) teile.push(`${e.meldungen} ${e.meldungen === 1 ? 'Baumeldung' : 'Baumeldungen'}`);
  if (e.material) teile.push(`${e.material} ${e.material === 1 ? 'Materialzeile' : 'Materialzeilen'}`);
  const papier = orte.filter(o => o.papier).length;
  const quelle = !e.punkte ? ''
    : (papier && papier === orte.length) ? ' (Abschrift vom Papier)'
    : papier ? ` (davon ${papier} Abschrift vom Papier)`
    : e.von ? ` (Aufnahme von ${String(e.von).replace(/ · /g, ", ")})` : '';
  return `Strecke ${e.strecke}: ${teile.join(', ').replace(/, ([^,]*)$/, ' und $1')}${quelle}`;
}

/**
 * Alles, was der Trupp nach dem Einspielen über Funk hören muss, nach Gewicht
 * geordnet: zuerst, was beim Planer entfallen ist (`verlust`), dann Prüfung und
 * Übergabe, die nicht galten (`nicht`), dann die abgewählten Strecken
 * (`ausgelassen`) und zuletzt die Rückfragen. Die Formel „übernommen“ kannte
 * nur Prüfung und Übergabe – eine Meldung, die einen Punkt beim Planer
 * verdrängte oder einen geplanten Punkt doppelt bestätigte, kam als „übernommen“
 * zurück, und die Nachfrage blieb beim Planer liegen, der sie nicht stellen kann.
 *
 * `aufgaben` sagt je Adressat, was zu tun ist. `neuMessen` gilt nur, wo wirklich
 * eine eigene Messung fehlt: eine bewusst ausgelassene Strecke verlangt vom
 * Trupp nichts, und eine fremde Messung beim Planer verlangt keine neue.
 */
export function durchgabe(bericht) {
  const nicht = pruefungNicht(bericht);
  const frage = (bericht.rueckfragen || []).map(e => e.doppelt
    ? `Strecke ${e.strecke}: ${e.doppelt} ${e.doppelt === 1 ? 'geplanter Punkt wäre' : 'geplante Punkte wären'} ` +
      'doppelt bestätigt – ist es dieselbe Aufnahme?'
    : `Strecke ${e.strecke}: ${e.abseits} ${e.abseits === 1 ? 'Punkt liegt' : 'Punkte liegen'} bis ` +
      `${Math.round(e.weit).toLocaleString('de-DE')} m neben der Trasse – stimmt die Ortung?`);
  const neuMessen = (bericht.pruefhinweise || []).some(h =>
    (h.stamm && !h.uebernommen && !h.fraglich) || h.uebergabeNichtUebernommen || h.uebergabeAufgehoben);
  return { verlust: (bericht.verluste || []).map(verlustSatz), nicht,
    aufgaben: aufgaben(bericht), ausgelassen: ausgelasseneStrecken(bericht),
    rueckfragen: frage, neuMessen };
}

/**
 * Der Funkspruch nach „Einspielen“: `{ satz, hilfe, laut }`, beides als HTML.
 * Gebaut wird er hier und nicht in der Oberfläche, damit Wortlaut und Befund
 * an einer Stelle stehen. Ein Verlust steht in der Kopfzeile selbst („angekommen,
 * ABER beim Planer entfallen“) und nicht dahinter: die Kopfzeile „übernommen“
 * mit einem Entfallen dahinter widersprach sich und war schlecht zu sprechen.
 */
export function funkformel(bericht, code) {
  const d = durchgabe(bericht);
  const mitCode = `Meldung <b class="meldungscode">${esc(code)}</b>`;
  const nichtsNeu = bericht.strecken && bericht.unveraendert === bericht.strecken;
  const absatz = (titel, eintraege) => eintraege.length
    ? ` <b>${titel}</b> ${esc(eintraege.join('; '))}.` : '';
  const verlustImKopf = !!bericht.strecken && d.verlust.length > 0 && !d.nicht.length;
  /* Was fehlt, nennt der Handlungssatz: nur die Arten, die wirklich entfallen. */
  const v = bericht.verluste || [];
  const arten = [v.some(e => e.punkte) && 'Punkte', v.some(e => e.meldungen) && 'Baumeldungen',
    v.some(e => e.material) && 'Materialzeilen'].filter(Boolean)
    .join(', ').replace(/, ([^,]*)$/, ' und $1');
  const bitte = ` Bitte ${arten} erneut melden oder mit dem Papier abgleichen.`;
  const kopf = !bericht.strecken
    ? `${mitCode} NICHT übernommen – keine Strecke zugeordnet.`
    : d.nicht.length && nichtsNeu
    ? `${mitCode} angekommen, aber <b>NICHTS übernommen</b> – der Stand hier ist unverändert.`
    : d.nicht.length
    ? `${mitCode} nur teilweise übernommen.`
    : verlustImKopf
    ? `${mitCode} angekommen, <b>ABER beim Planer entfallen:</b> ${esc(d.verlust.join('; '))}.${bitte}`
    : nichtsNeu
    ? `${mitCode} angekommen – nichts Neues, dieser Stand war schon eingespielt.`
    : `${mitCode} übernommen.`;
  const satz = kopf
    + (verlustImKopf ? '' : absatz('Beim Planer entfallen:', d.verlust) + (d.verlust.length ? bitte : ''))
    + absatz('NICHT übernommen:', d.nicht)
    + absatz('Bitte:', d.aufgaben)
    + absatz('Ausgelassen:', d.ausgelassen)
    + absatz('Rückfrage an den Trupp:', d.rueckfragen);
  /* „Rückfrage“ nur, wo es eine gibt: bei bloßem Verlust ist keine zu beantworten. */
  const hilfe = d.nicht.length
    ? 'Sonst hält der Trupp Prüfung oder Übergabe für verbucht.'
    : d.verlust.length
    ? 'Sonst weiß der Trupp nicht, dass seine Einträge beim Planer fehlen.'
    : d.rueckfragen.length ? 'Der Trupp soll die Rückfrage beantworten.' : '';
  return { satz, hilfe, laut: !!(d.nicht.length || d.verlust.length || !bericht.strecken) };
}

/* Der Grund nach „Verwerfen“, wenn die Meldung genau den Stand brachte, der
   schon da war. */
export const GRUND_SCHON_DA = 'schon eingespielt';

/** Das, was nach „Verwerfen“ über Funk zu sagen ist – `{ satz, hilfe }` als HTML */
export function verwerfFormel(grund, code, herkunft) {
  const mitCode = `Meldung <b class="meldungscode">${esc(code)}</b>`;
  /* „Übernommen“ stimmte nicht: der Planer hat verworfen. Der Stand war nur
     schon da – das ist die ganze Aussage. */
  if (grund === GRUND_SCHON_DA) {
    return { satz: `${mitCode} nicht eingespielt – dieser Stand war schon eingespielt.`, hilfe: '' };
  }
  return { satz: `${mitCode} nicht übernommen – Grund: ${esc(grund)}.`,
    hilfe: (herkunft === 'Datei' ? 'Dieselbe Datei lässt sich noch einmal laden,'
      : 'Derselbe Link öffnet die Meldung wieder,') + ' falls doch eingespielt werden soll.' };
}

/** Was nach einer abgelehnten Prüfung zu tun ist (für „Verwerfen“) */
export function ablehnungsHinweis(pruefhinweise) {
  if ((pruefhinweise || []).some(h => h.uebergabeVeraltet)) {
    return 'nach bestandener Prüfung neu übergeben und melden';
  }
  const liste = (pruefhinweise || []).filter(h => h.stamm && !h.uebernommen);
  if (liste.length && liste.every(h => h.fraglich)) {
    return 'neu messen ist nicht nötig, der Planer kann die Messung übernehmen (Meldung noch einmal öffnen)';
  }
  return 'bitte neu messen und melden';
}

/** Kurzfassung für die Meldung nach dem Einspielen */
export function berichtText(bericht) {
  const teile = [];
  const zaehl = (n, ein, viele) => { if (n) teile.push(`${n} ${n === 1 ? ein : viele}`); };
  zaehl(bericht.strecken, 'Strecke', 'Strecken');
  zaehl(bericht.abschnitte, 'Bauabschnitt', 'Bauabschnitte');
  if (!teile.length) return 'Nichts eingespielt';
  /* Ein zweites Mal eingespielt, was schon da war: „1 Strecke eingespielt“
     las sich, als wäre etwas gekommen, und der Planer suchte es. */
  const teil = teilText(bericht);
  if (bericht.strecken && bericht.unveraendert === bericht.strecken) {
    return 'Nichts geändert' + (teil ? ` – ${teil}` : ' – dieser Stand war schon eingespielt');
  }
  /* Der Bestand und nicht der Zuwachs: eine Meldung, die vorhandene Punkte
     ERSETZT, bringt netto null neue – „0 Punkte“ danebenzuschreiben wäre
     irreführend, „12 Punkte stehen jetzt an dieser Strecke“ ist die Aussage,
     die der Planer prüfen kann. „In der Baudokumentation“ und nicht „in der
     Planung“: der Empfangsdialog hatte zwei Schritte vorher versichert, die
     geplante Trasse bleibe unangetastet, und der Satz danach klang, als sei
     sie es nicht. */
  const satz = teile.join(', ') + ' eingespielt';
  const kern = bericht.bestand
    ? `${satz} – ${bericht.bestand} ${bericht.bestand === 1
        ? 'aufgenommener Punkt steht' : 'aufgenommene Punkte stehen'} jetzt in der Baudokumentation`
    : satz;
  /* Eine Teilübernahme gehört in dieselbe Zeile: „2 Strecken eingespielt“ ließ
     offen, dass die Prüfung des einen Stamms nicht dabei war. */
  return teil ? `${kern} – ${teil}` : kern;
}
