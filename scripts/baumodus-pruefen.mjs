// baumodus-pruefen.mjs – Den Baumodus im echten Browser durchspielen
//
// Der Bauauftrag wird gedruckt und am Blatt geprüft; die Baudokumentation
// entsteht am Bauort, auf einem Gerät, das hier niemand in der Hand hat. Was
// dort schiefgeht, merkt sonst erst der Trupp – und der hat die Aufnahme dann
// schon verloren. Deshalb für diesen Teil eine Prüfung, die die Anwendung
// wirklich bedient: klickt, tippt, ortet, lädt neu.
//
// Der Prüfstand steht in scripts/pruefstand.mjs und kommt ohne Fremdcode aus.
//
//     node scripts/baumodus-pruefen.mjs
//     CHROMIUM=/usr/bin/chromium node scripts/baumodus-pruefen.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { starteServer, starteBrowser, neuerBefund } from './pruefstand.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Zwei Punkte im Harz, gut 300 m auseinander – weit genug über der
   Abweichungsschwelle von 25 m, dass die Meldung anschlagen muss, und nah
   genug, dass beide auf einen Kartenausschnitt passen. */
const STANDORT = { lat: 51.8020, lng: 10.6180 };

const server = await starteServer(WURZEL);
const browser = await starteBrowser();
const seite = await browser.seite();
const b = neuerBefund();
const adresse = `http://127.0.0.1:${server.port}/index.html`;

/** Knopf mit dieser Beschriftung im angegebenen Bereich drücken */
async function taste(bereich, beschriftung) {
  const getroffen = await seite.auswerten(`
    const raum = document.querySelector(${JSON.stringify(bereich)});
    if (!raum) return 'kein Bereich';
    const k = [...raum.querySelectorAll('button')]
      .find(x => x.textContent.includes(${JSON.stringify(beschriftung)}));
    if (!k) return 'kein Knopf';
    k.click(); return 'ok';`);
  if (getroffen !== 'ok') throw new Error(`„${beschriftung}“ in ${bereich}: ${getroffen}`);
  await seite.ruhe();
}

/** In das Mengenfeld einer Katalogzeile schreiben. Gesucht wird ueber die
 *  Beschriftung und nicht ueber die Stelle im Raster: die Reihenfolge des
 *  Katalogs ist Sache von `vorschrift.js` und nicht dieser Pruefung. */
async function materialFeld(bezeichnung, wert) {
  const ok = await seite.auswerten(`
    const f = [...document.querySelectorAll('.bau-material .mat-zeile')]
      .find(x => x.querySelector('.feld-titel').textContent === ${JSON.stringify(bezeichnung)});
    if (!f) return 'keine Zeile';
    const e = f.querySelector('input');
    const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setzer.call(e, ${JSON.stringify(String(wert))});
    e.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';`);
  if (ok !== 'ok') throw new Error(`Materialzeile „${bezeichnung}“: ${ok}`);
  await seite.ruhe();
}

/** Etwas aus dem Bau-Block der ersten Strecke ablesen – `null`, wenn es ihn
 *  noch nicht gibt. Im Ausdruck steht `bau` für den Block, `s` für die Strecke. */
const bau = async ausdruck => seite.auswerten(`
  const s = window.fbp.store.projekt.strecken[0];
  const bau = s && s.bau;
  if (!bau) return null;
  return (${ausdruck});`);

try {
  // ------------------------------------------------------------ Grundlast

  b.abschnitt('Die Anwendung startet unverändert');
  await seite.breit(1440, 900);
  await seite.oeffne(adresse);
  await seite.warteAuf('!!window.fbp');
  b.pruefe(await seite.sichtbar('#karte'), 'Karte steht');
  b.pruefe(await seite.auswerten('window.fbp.store.projekt.version') === 19, 'Schema 19');
  b.gleich(await seite.text('#btn-modus.modus-schalter > .modus-name'), 'Planung',
    'Der Umschalter nennt den Modus, in dem man ist');
  /* Und klein darunter, wohin er führt: das ⇄ allein las ein Erstnutzer als
     „Planung tauschen“. Der Modusname bleibt das erste Wort. */
  b.gleich(await seite.text('#btn-modus .modus-wohin'), 'zum Bau', 'Darunter steht, wohin er führt');
  b.pruefe(await seite.auswerten('document.querySelector("#reiter-bau").hidden'),
    'Der Bau-Reiter steht im Planungsmodus nicht da');

  // ------------------------------------------------------------ Planung anlegen

  b.abschnitt('Eine Strecke planen');
  /* Im Übersichtsmaßstab holt ein Tipp beim Zeichnen nur heran (`strecken.js`,
     ZEICHNEN_AB_ZOOM). Gezeichnet wird deshalb auf der kleinsten Stufe, die
     Punkte setzt. */
  await seite.auswerten('window.fbp.karte.setZoom(12, { animate: false }); return true;');
  await seite.ruhe();
  b.gleich(await seite.auswerten('return window.fbp.karte.getZoom()'), 12,
    'Die Karte steht auf Zoom 12');
  await seite.klick('#btn-neue-strecke');
  await seite.klickeKarte(760, 380);
  await seite.klickeKarte(900, 460);
  await seite.klickeKarte(1040, 400);
  await seite.taste('Enter');
  b.gleich(await seite.auswerten('window.fbp.store.projekt.strecken[0].punkte.length'), 3,
    'Drei Trassenpunkte gesetzt');
  /* Nach „Fertig“ zeigte nichts den Weg zum Bauauftrag (Review 5). */
  const fertigPille = await seite.text('#hinweisbox') || '';
  b.pruefe(/^Strecke fertig – den Bauauftrag gibt es links in der Streckenkarte/.test(fertigPille),
    `„Fertig“ zeigt den Weg zum Bauauftrag („${fertigPille}“)`);
  b.gleich(await bau('1'), null, 'Ohne Baumodus entsteht kein Bau-Block');

  b.abschnitt('Die offene Streckenkarte folgt den Punkten');
  /* Die Karte entsteht beim ersten Punkt und führt danach nur nach, was sich
     ändert. Ausgabezeile und Kennung blieben dabei stehen: nach drei Punkten
     war der Bauauftrag noch gesperrt („mindestens zwei Trassenpunkte“), und
     nach dem Verschieben eines Punktes stand die alte Plan-Kennung da. */
  const offeneKarte = () => seite.auswerten(`
    const karte = document.querySelector('article.eintrag[data-sid]');
    const knopf = [...karte.querySelectorAll('button')].find(x => x.textContent.includes('Bauauftrag (PDF)'));
    const st = await import('./js/state.js');
    return { gesperrt: knopf.disabled, grund: !karte.querySelector('.ausgabe-grund').hidden,
             kennung: karte.querySelector('.plan-kennung b').textContent,
             soll: st.planKennung([window.fbp.store.projekt.strecken[0]]) };`);
  const nachZeichnen = await offeneKarte();
  b.pruefe(!nachZeichnen.gesperrt && !nachZeichnen.grund,
    'Nach „Fertig“ ist der Bauauftrag sofort zu haben, ohne Sperrgrund');
  b.gleich(nachZeichnen.kennung, nachZeichnen.soll, 'Die Kennung ist die der drei Punkte');
  /* Gezogen mit der Maus: am Rechner greift die Marke sofort, wie bisher
     (`js/ziehen.js`). */
  await seite.auswerten('window.fbp.sl.waehle(window.fbp.store.projekt.strecken[0].id); return true;');
  await seite.ruhe();
  const marke1 = await seite.auswerten(`
    const r = document.querySelector('.fbp-punkt.art-start').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
             lat: window.fbp.store.projekt.strecken[0].punkte[0].lat };`);
  await seite.zieheMaus(marke1.x, marke1.y, marke1.x + 40, marke1.y + 30);
  b.pruefe(await seite.auswerten('window.fbp.store.projekt.strecken[0].punkte[0].lat') !== marke1.lat,
    'Die Maus zieht den Punkt sofort');
  b.pruefe(/^Punkt 1 von .* verschoben/.test(await seite.text('#hinweisbox')),
    'Danach nennt eine Meldung Punkt und Weg');
  const nachZiehen = await offeneKarte();
  b.pruefe(nachZiehen.kennung !== nachZeichnen.kennung && nachZiehen.kennung === nachZiehen.soll,
    `Die Kennung folgt dem verschobenen Punkt (${nachZeichnen.kennung} → ${nachZiehen.kennung})`);
  await seite.klick('#btn-undo');
  b.gleich(await seite.auswerten('window.fbp.store.projekt.strecken[0].punkte[0].lat'), marke1.lat,
    'Rückgängig holt den Punkt zurück');
  b.gleich((await offeneKarte()).kennung, nachZeichnen.kennung, 'Und mit ihm die Kennung');
  /* Wird an der Strecke schon gebaut, kamen zwei Meldungen, und die zweite
     ersetzte die erste: übrig blieb die Warnung über den neuen Link, ohne
     Punkt, Weg und Rückweg. Jetzt steht beides in einer. Der Bau wird über
     eine Baumeldung angedeutet, die danach wieder geht. */
  await seite.auswerten(`
    const bd = await import('./js/baudoku.js');
    window.fbp.store.aendern(p => { bd.baumeldungAnlegen(p.strecken[0], 'Trommel 1 liegt'); }, 'bau');
    return true;`);
  await seite.ruhe();
  const marke1b = await seite.auswerten(`
    const r = document.querySelector('.fbp-punkt.art-start').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };`);
  await seite.zieheMaus(marke1b.x, marke1b.y, marke1b.x + 40, marke1b.y + 30);
  const gebautPille = await seite.text('#hinweisbox');
  b.pruefe(/^Punkt 1 von .* um .* verschoben – „↶“.* · .*neuen Link/.test(gebautPille),
    `Ist der Bau begonnen, nennt EINE Meldung Punkt, Weg, Rückweg und den neuen Link („${gebautPille}“)`);
  await seite.klick('#btn-undo');
  await seite.klick('#btn-undo');
  b.gleich(await seite.auswerten(`const s = window.fbp.store.projekt.strecken[0];
    return s.punkte[0].lat === ${marke1.lat} && !(s.bau && s.bau.meldungen.length);`), true,
    'Zweimal „↶“ holt Punkt und Planung zurück');

  /* Der Link an den Bautrupp hatte „Schließen“ als Hauptknopf und kein
     Teilen, und er hieß „Planung als Link teilen“. */
  b.abschnitt('Der Link an den Bautrupp heißt so und schickt hinaus');
  await taste('article.eintrag[data-sid]', 'Link an den Bautrupp');
  await seite.warteAuf(`!document.querySelector('#tl-link').value.startsWith('wird')`, 5000);
  b.gleich(await seite.text('#dialog-titel'), 'Link an den Bautrupp',
    'Aus der Streckenkarte heißt der Dialog „Link an den Bautrupp“');
  const teilenFuss = await seite.auswerten(`return [...document.querySelectorAll('#dialog-fuss .knopf')]
    .map(k => (k.classList.contains('primaer') ? '*' : '') + k.textContent).join('|') +
    (document.querySelector('#tl-kopieren').classList.contains('primaer') ? ' + *Kopieren' : '')`);
  b.pruefe(!/\*Schließen/.test(teilenFuss) && /\*(Teilen|Kopieren)/.test(teilenFuss),
    `Hauptknopf ist Teilen oder Kopieren, nicht Schließen (${teilenFuss})`);
  await taste('#dialog-fuss', 'Schließen');

  // ------------------------------------------------------------ Umschalten

  b.abschnitt('In den Baumodus wechseln');
  await seite.klick('#btn-modus');
  b.pruefe(await seite.auswerten('document.body.classList.contains("baumodus")'),
    'body trägt die Modusklasse');
  b.gleich(await seite.text('#btn-modus.modus-schalter > .modus-name'), 'Baumodus',
    'Der Umschalter nennt jetzt den Baumodus');
  b.gleich(await seite.text('#btn-modus .modus-wohin'), 'zur Planung', 'Und als Ziel die Planung');
  b.gleich(await seite.auswerten(
    '[...document.querySelectorAll(".reiter button")].filter(x => !x.hidden)' +
    '.map(x => x.dataset.reiter).join(",")'),
    'strecken,projekt,bau', 'Drei Reiter, die Planungsreiter sind weg');
  b.pruefe(await seite.auswerten('!document.querySelector("#wz-strecke").offsetParent'),
    'Das Streckenwerkzeug ist weg');
  b.pruefe(await seite.sichtbar('#wz-standort'), 'Das Standortwerkzeug bleibt');
  b.gleich(await seite.anzahl('.bp-zeile'), 3, 'Für jeden geplanten Punkt eine Zeile');
  /* Ohne Bauabschnitt gibt es dort nichts zu tun – der Block stand trotzdem
     offen über den Trassenpunkten und schob sie bei 390×844 an den Bildrand. */
  b.pruefe(await seite.auswerten('document.querySelector(".bau-abschnitte").classList.contains("zu")'),
    'Ohne Bauabschnitt steht der Block zugeklappt');
  b.pruefe(/keiner/.test(await seite.text('.bau-abschnitte .gruppen-titel') || ''),
    'Und seine Überschrift sagt, dass keiner da ist');
  b.pruefe(/Plan-Nr\. .+ steht auch auf dem Bauauftrag/.test(await seite.text('.bau-kennung .plan-kennung') || ''),
    'Die Plan-Nr. im Reiter sagt, was sie ist');
  b.pruefe(!(await seite.auswerten('!!document.querySelector(".bau-stand-titel .plan-kennung")')),
    'Und steht unter dem Stand, nicht in seiner Beschriftung');
  /* Plan-Nr. und Rückgabe-Code sind beide vier Zeichen lang und wurden im
     Audit verwechselt. Sie heißen verschieden und stehen verschieden da; die
     Null ist in beiden durchgestrichen, weil die Plan-Nr. 0 und O kennt. */
  const zweiCodes = await seite.auswerten(`
    const nr = document.querySelector('.bau-kennung .plan-nr');
    const st = nr && getComputedStyle(nr);
    return { null: st && st.fontVariantNumeric, rahmen: st && st.borderTopStyle };`);
  b.pruefe(/slashed-zero/.test(zweiCodes.null || ''), 'Die Plan-Nr. setzt die Null durchgestrichen');
  b.gleich(zweiCodes.rahmen, 'none', 'Und steht schlicht da, ohne den Rahmen des Rückgabe-Codes');

  b.abschnitt('Vor dem Ausrücken: Karte und Baunachweis');
  /* Wer nur über den Link arbeitet, erfuhr vom Baunachweis auf Papier nichts:
     das Wort kam im Bau-Reiter nicht vor, und der Bauauftrag war im Baumodus
     nur über den Strecken-Reiter zu erreichen. */
  b.gleich(await seite.auswerten(
    'document.querySelector(".bau-vorrat .gruppen-titel").textContent.trim()'),
    '▾Vor dem Ausrücken', 'Der Block heißt nach dem Zeitpunkt, nicht nach dem Kachelspeicher');
  /* Der Chip, der dorthin springt, heißt wie die Unterzeile, die er findet. */
  const chipName = await seite.text('.vorrat-chip');
  b.pruefe(/^Karte (mitnehmen|dabei|unvollständig)/.test(chipName),
    `Der Chip im Sprungstreifen heißt „Karte …“ („${chipName}“)`);
  b.pruefe(await seite.auswerten(`[...document.querySelectorAll('.bau-vorrat .bau-untertitel')]
    .some(h => h.textContent === 'Karte mitnehmen')`), 'Und findet dort „Karte mitnehmen“');
  /* Solange an der Strecke nichts aufgenommen ist, steht der Block oben und
     offen: am Ende und zugeklappt fand ihn ein Erstnutzer im Review nicht. */
  const vorAb = await seite.auswerten(`
    const v = document.querySelector('.bau-vorrat'), z = document.querySelector('#bau-liste .bp-zeile');
    return JSON.stringify({ vorn: !!(v && z && (v.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING)),
      offen: !v.classList.contains('zu') });`);
  b.gleich(vorAb, JSON.stringify({ vorn: true, offen: true }),
    'Vor dem ersten Punkt steht „Vor dem Ausrücken“ offen vor den Punkten');
  b.pruefe(/Baunachweis/.test(chipName), `Und der Chip nennt Karte und Baunachweis („${chipName}“)`);
  const dokuChip = await seite.auswerten(`const k = document.querySelector('.bau-sprung-doku');
    return JSON.stringify({ text: k.textContent, gesperrt: k.disabled });`);
  b.gleich(dokuChip, JSON.stringify({ text: '▤ Baudoku', gesperrt: false }),
    'Der Chip zur Baudokumentation heißt „Baudoku“ und ist nicht ausgegraut');
  /* „Karte holen“ war an einer Strecke ohne Punkte blau und sagte erst nach
     dem Tipp, dass es nichts zu holen gibt. */
  const ohnePunkte = await seite.auswerten(`
    const bd = await import('./js/baudoku.js');
    const zu = await import('./js/state.js');
    const ui = await import('./js/ui.js');
    const store = window.fbp.store;
    const vorher = bd.baustrecke().id;
    let sid = null;
    store.aendern(p => { const s = zu.neueStrecke(p); sid = s.id; s.name = 'Leerprobe'; p.strecken.push(s); }, 'strecke');
    bd.baustreckeSetzen(sid);
    ui.zeichneBauListe();
    const holen = [...document.querySelectorAll('.bau-vorrat .bau-tasten button')]
      .find(k => k.textContent.includes('Karte holen'));
    const r = { gesperrt: !!holen && holen.disabled,
      grund: document.querySelector('.bau-vorrat .vorrat-umfang').textContent };
    store.aendern(p => { p.strecken = p.strecken.filter(x => x.id !== sid); }, 'strecke');
    bd.baustreckeSetzen(vorher);
    ui.zeichneBauListe();
    return JSON.stringify(r);`);
  const op = JSON.parse(ohnePunkte);
  b.pruefe(op.gesperrt && /Ohne Trassenpunkte/.test(op.grund),
    `Ohne Trassenpunkte ist „Karte holen“ gesperrt, mit Grund („${op.grund}“)`);
  b.pruefe(await seite.auswerten(`[...document.querySelectorAll('.bau-vorrat .bau-untertitel')]
    .some(h => /^Baunachweis ausdrucken/.test(h.textContent))`),
    'Daneben steht „Baunachweis ausdrucken“');
  b.pruefe(await seite.auswerten(`!!document.querySelector('.bau-vorrat details.vorrat-mehr')
    && /schmalen Band/.test(document.querySelector('.bau-vorrat details.vorrat-mehr').textContent)`),
    'Der Datenschutzhinweis ist eingeklappt, aber da');
  await taste('.bau-vorrat', 'Bauauftrag mit Baunachweis');
  await seite.warteAuf('!!document.querySelector("#druck")', 20000);
  await seite.warteAuf('!!document.querySelector("#druck .bl-baunachweis")', 20000);
  b.pruefe(/Baunachweis zum Ausfüllen/.test(await seite.text('#druck')),
    'Der Griff schlägt den Bauauftrag mit dem Blatt „Baunachweis zum Ausfüllen“ auf');
  await seite.auswerten(
    `const m = await import('./js/bauauftrag.js'); m.schliesseBauauftrag(); return true;`);
  await seite.ruhe();

  // ------------------------------------------------------------ Bestätigen

  b.abschnitt('Punkt 1 wie geplant bestätigen');
  await taste('.bp-zeile', 'wie geplant');
  b.gleich(await bau('bau.punkte.length'), 1, 'Ein Ist-Punkt');
  b.gleich(await bau('bau.punkte[0].quelle'), 'plan', 'Quelle: aus dem Plan bestätigt');
  b.gleich(await bau('bau.stand'), 'laeuft', 'Der Baustand springt von selbst auf „im Bau“');
  b.pruefe(await bau('!!bau.punkte[0].sollPunkt'), 'Der Ist-Punkt kennt seinen geplanten Punkt');
  b.gleich(await seite.anzahl('.bp-zeile.bestaetigt'), 1, 'Eine Zeile ist als gebaut gezeichnet');

  b.abschnitt('Eine zweite Bestätigung ersetzt die erste');
  /* Sonst stünde derselbe Punkt zweimal in der gebauten Trasse und die Länge
     wäre um die Strecke dorthin und zurück zu lang. */
  await seite.auswerten(`
    const st = await import('./js/baudoku.js');
    const s = window.fbp.store.projekt.strecken[0];
    window.fbp.store.aendern(() => {
      st.istPunktSetzen(s, s.punkte[0].lat + 0.001, s.punkte[0].lng,
        { sollPunkt: s.punkte[0].id, quelle: 'karte' });
    }, 'bau');
    return true;`);
  b.gleich(await bau('bau.punkte.length'), 1, 'Weiterhin ein einziger Ist-Punkt');
  b.gleich(await bau('bau.punkte[0].quelle'), 'karte', 'Die neue Aufnahme gilt');
  await seite.ruhe();
  b.pruefe(await seite.auswerten(`
    const v = document.querySelector('.bau-vorrat');
    return v.classList.contains('zu') && v === document.querySelector('#bau-liste').lastElementChild;`),
    'Mit dem ersten Punkt rückt „Vor dem Ausrücken“ zugeklappt ans Ende');

  // ------------------------------------------------------------ Standort

  b.abschnitt('Punkt 2 aus dem Standort des Geräts');
  /* Der Standort liegt rund 45 m neben dem geplanten Punkt 2: weit genug für
     eine gemeldete Abweichung (25 m), nah genug, dass die Ortung dem Punkt
     gutgeschrieben wird – eine, die weiter weg liegt, als eine Umgehung reicht
     (ABSEITS_SCHWELLE, 300 m), wird bewusst als zusätzlicher Punkt aufgenommen. */
  const p2 = await seite.auswerten('const pt = window.fbp.store.projekt.strecken[0].punkte[1]; ' +
    'return { lat: pt.lat, lng: pt.lng };');
  STANDORT.lat = p2.lat + 0.0004;
  STANDORT.lng = p2.lng;
  await seite.standort(STANDORT.lat, STANDORT.lng, 7);
  await seite.auswerten(`
    const z = document.querySelectorAll('.bp-zeile')[1];
    const k = [...z.querySelectorAll('button')].find(x => x.textContent.includes('hier'));
    k.click(); return true;`);
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.punkte.length === 2', 10000);
  b.gleich(await bau('bau.punkte[1].quelle'), 'standort', 'Quelle: Standort des Geräts');
  b.gleich(await bau('bau.punkte[1].genauigkeit'), 7, 'Die Genauigkeit ist festgehalten');
  b.pruefe(await bau('Math.abs(bau.punkte[1].lat - ' + STANDORT.lat + ') < 1e-6'),
    'Der Punkt liegt auf der gemeldeten Koordinate');
  b.pruefe(await seite.anzahl('.bp-abweichung') >= 1,
    'Die Abweichung vom Plan wird gemeldet');

  // ------------------------------------------------------------ Karte

  b.abschnitt('Punkt 3 auf der Karte antippen');
  await seite.auswerten(`
    const z = document.querySelectorAll('.bp-zeile')[2];
    const k = [...z.querySelectorAll('button')].find(x => x.textContent.includes('Karte'));
    k.click(); return true;`);
  b.pruefe(await seite.auswerten('!document.querySelector("#zeichen-hinweis").hidden'),
    'Die Modusleiste steht – schmal das einzige Bedienelement');
  await seite.klickeKarte(1030, 420);
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.punkte.length === 3');
  b.gleich(await bau('bau.punkte[2].quelle'), 'karte', 'Quelle: auf der Karte gesetzt');
  b.pruefe(await seite.auswerten('document.querySelector("#zeichen-hinweis").hidden'),
    'Die Modusleiste verschwindet nach dem Setzen');

  b.abschnitt('Die Reihenfolge folgt der Planung, nicht der Uhr');
  b.gleich(await seite.auswerten(`
    const s = window.fbp.store.projekt.strecken[0];
    return s.bau.punkte.map(pt => s.punkte.findIndex(q => q.id === pt.sollPunkt)).join(',');`),
    '0,1,2', 'Die Ist-Punkte stehen in der Ordnung der Trasse');

  // ------------------------------------------------------------ Karte zeichnet

  b.abschnitt('Die gebaute Trasse steht auf der Karte');
  b.gleich(await seite.anzahl('.fbp-istpunkt'), 3, 'Drei Ist-Marken');
  b.pruefe(await seite.anzahl('path.fbp-ist-linie') >= 1, 'Die Ist-Linie ist gezeichnet');

  // ------------------------------------------------------------ Bauabschnitte

  b.abschnitt('Bauabschnitte für zwei Trupps');
  await taste('.bau-abschnitte', '+ Bauabschnitt');
  b.gleich(await bau('bau.abschnitte.length'), 1, 'Ein Bauabschnitt');
  b.pruefe(await seite.anzahl('.ba-marke.aktiv') === 1,
    'Der neue Abschnitt nimmt die folgenden Punkte auf');
  await seite.schreibe('.ba-eintrag .ba-felder input', 'Nordabschnitt');
  /* Formulareingaben werden 100 ms gesammelt, bevor sie in die Planung gehen
     (`schreib` in ui.js) – sonst liefe je Tastendruck ein Undo-Schritt auf.
     Wer hier sofort abliest, prüft den Stand von vorher. */
  await seite.warteAuf(
    'window.fbp.store.projekt.strecken[0].bau.abschnitte[0].name === "Nordabschnitt"', 3000);
  b.pruefe(true, 'Die Bezeichnung des Bauabschnitts wird geschrieben');
  await taste('.bau-punkte', 'Punkt hier');
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.punkte.length === 4', 10000);
  /* Gesucht wird über den fehlenden Bezug zur Planung und nicht über die
     Stelle in der Liste: ein zusätzlicher Punkt hängt sich neben seinen
     nächsten Nachbarn und nicht ans Ende – sonst liefe die gebaute Trasse über
     die ganze Strecke und wieder zurück. */
  const zusatz = 'bau.punkte.filter(pt => !pt.sollPunkt)';
  b.gleich(await bau(`${zusatz}.length`), 1, 'Genau ein zusätzlicher Punkt');
  b.pruefe(await bau(`!!${zusatz}[0].abschnitt`),
    'Der zusätzliche Punkt hängt am aktiven Bauabschnitt');
  // ------------------------------------------------------------ Undo und Speicher

  b.abschnitt('Rückgängig nimmt die Aufnahme zurück');
  await seite.auswerten('window.fbp.store.undo(); return true;');
  await seite.ruhe();
  b.gleich(await bau('bau.punkte.length'), 3, 'Der letzte Punkt ist zurückgenommen');
  await seite.auswerten('window.fbp.store.redo(); return true;');
  await seite.ruhe();
  b.gleich(await bau('bau.punkte.length'), 4, 'Wiederholen bringt ihn zurück');

  b.abschnitt('Die Aufnahme überlebt das Neuladen');
  await seite.warteAuf('!document.querySelector("#speicherstatus").classList.contains("offen")', 5000);
  /* Getippt und im selben Augenblick neu geladen: die Formulare sammeln
     100 ms, bevor sie schreiben, und beim Verlassen läuft kein Zeitgeber mehr
     ab. Ohne das Nachschreiben in `pagehide` fehlte das letzte Wort. Getippt
     und geladen wird in EINEM Schritt, sonst entschiede die Laufzeit des
     Prüfstands, ob die 100 ms schon um sind. */
  await seite.auswerten(`
    const e = document.querySelectorAll('.ba-eintrag .ba-felder input')[1];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, '1. FmTr Eile');
    e.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => location.reload(), 0);
    return true;`);
  await new Promise(r => setTimeout(r, 300));
  await seite.warteAufLaden();
  await seite.warteAuf('!!window.fbp');
  b.gleich(await bau('bau.abschnitte[0].trupp'), '1. FmTr Eile',
    'Was unmittelbar vor dem Neuladen getippt wurde, ist noch da');
  b.gleich(await bau('bau.punkte.length'), 4, 'Vier Ist-Punkte sind noch da');
  b.gleich(await bau('bau.abschnitte.length'), 1, 'Der Bauabschnitt ist noch da');
  b.pruefe(await seite.auswerten('document.body.classList.contains("baumodus")'),
    'Der Baumodus überlebt das Neuladen');
  b.pruefe(await bau('bau.punkte.every(pt => pt.sollPunkt === null || ' +
    'window.fbp.store.projekt.strecken[0].punkte.some(q => q.id === pt.sollPunkt))'),
    'Kein Verweis zeigt ins Leere');

  b.abschnitt('Ein gefüllter Bauabschnitt geht nicht mit einem Tipp');
  /* Das ✕ steht mit 44 px direkt neben der großen Marke. Ein Fehlgriff nahm
     Trupp und Zeiten mit und den Punkten ihre Zuordnung. Ein leerer Abschnitt
     geht weiter ohne Frage – er ist meist ein Doppeltipp auf „+“. */
  const dialogTitel = () => seite.auswerten(
    'return document.getElementById("dialog").hidden ? "" : document.getElementById("dialog-titel").textContent');
  const abschnittKreuz = nr => seite.auswerten(`
    const k = document.querySelectorAll('.ba-eintrag .ba-kopf .mini-knopf.gefahr')[${nr}];
    if (!k) return false; k.click(); return true;`);
  b.pruefe(await abschnittKreuz(0), 'Das ✕ des Abschnitts steht da');
  b.pruefe(/löschen\?/.test(await dialogTitel()), `Es fragt nach (${await dialogTitel()})`);
  const nennt = await seite.auswerten('document.getElementById("dialog-inhalt").textContent');
  b.pruefe(/1 Punkt/.test(nennt), `Die Rückfrage nennt, was die Zuordnung verliert (${nennt.trim().slice(0, 80)})`);
  await seite.auswerten(`[...document.querySelectorAll('#dialog-fuss button')]
    .find(e => e.textContent.trim() === 'Abbrechen').click(); return true;`);
  await seite.ruhe();
  b.gleich(await bau('bau.abschnitte.length'), 1, '„Abbrechen“ lässt den Abschnitt stehen');
  await taste('.bau-abschnitte', '+ Bauabschnitt');
  b.gleich(await bau('bau.abschnitte.length'), 2, 'Ein zweiter, leerer Abschnitt');
  await abschnittKreuz(1);
  await seite.ruhe();
  b.gleich(await dialogTitel(), '', 'Der leere geht ohne Rückfrage');
  b.gleich(await bau('bau.abschnitte.length'), 1, 'Und ist weg');
  /* Der Merker „nimmt auf“ fiel mit dem gelöschten Abschnitt; der erste nimmt
     nach dem Neuladen ohnehin nicht auf – so erwartet es der Bogen unten. */
  await seite.auswerten(`
    const bd = await import('./js/baudoku.js');
    bd.bauabschnittAktivSetzen(null);
    const ui = await import('./js/ui.js'); ui.zeichneBauListe(); return true;`);

  // ------------------------------------------------------------ Materialnachweis

  b.abschnitt('Der Materialnachweis nimmt Mengen auf');
  b.pruefe(await seite.sichtbar('.bau-material'), 'Der Bogen steht da');
  /* Welcher Bauabschnitt neue Eintragungen aufnimmt, ist Sitzungszustand und
     ueberlebt das Neuladen bewusst nicht – nach dem Neustart gilt wieder die
     ganze Strecke. Fuer den Bogen wird er hier wieder angetippt, denn gebucht
     wird auf denselben Schalter, der auch die Punkte zuordnet. */
  b.pruefe(await seite.anzahl('.ba-marke.aktiv') === 0,
    'Nach dem Neuladen nimmt kein Abschnitt mehr auf');
  b.pruefe(/ganze Strecke/.test(await seite.text('.bau-material') || ''),
    'Der Bogen sagt, dass Eintragungen dann fuer die ganze Strecke gelten');
  await seite.klick('.ba-marke');
  b.pruefe(await seite.anzahl('.ba-marke.aktiv') === 1, 'Der Abschnitt nimmt wieder auf');
  /* Alle Katalogzeilen sind zu sehen, auch die leeren: der Bogen ist eine
     Abhakliste. Wer am Bauort eine Zeile sucht, die erst erscheint, wenn etwas
     drinsteht, sucht vergeblich. */
  b.pruefe(await seite.anzahl('.bau-material .mat-zeile') >= 20,
    `Alle Katalogzeilen stehen da (${await seite.anzahl('.bau-material .mat-zeile')})`);
  b.gleich(await bau('bau.material.length'), 0, 'Gespeichert ist davon noch nichts');

  await materialFeld('Feldkabel FKb', 1450);
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.material.length === 1', 3000);
  b.gleich(await bau('bau.material[0].artikel'), 'fkb', 'Die Zeile trägt ihren Artikel');
  b.gleich(await bau('bau.material[0].menge'), 1450, 'Und die eingetragene Menge');
  b.pruefe(await bau('!!bau.material[0].abschnitt'),
    'Gebucht wird auf den aktiven Bauabschnitt');

  b.abschnitt('Das Soll steht neben dem Ist, aber nicht darin');
  const fuss = await seite.auswerten(`
    const f = [...document.querySelectorAll('.bau-material .mat-zeile')]
      .find(x => x.querySelector('.feld-titel').textContent === 'Feldkabel FKb');
    return f ? (f.querySelector('.mat-fuss')?.textContent || '') : null;`);
  b.pruefe(/Bedarf laut Planung/.test(fuss || ''),
    `Die Kabelzeile nennt den Bedarf aus der Planung (${fuss})`);
  const ohneSoll = await seite.auswerten(`
    const f = [...document.querySelectorAll('.bau-material .mat-zeile')]
      .find(x => x.querySelector('.feld-titel').textContent === 'Ankerpfahl');
    return f ? (f.querySelector('.mat-fuss')?.textContent || '') : null;`);
  b.gleich(ohneSoll, '', 'Wo die Planung nichts rechnet, steht auch kein Soll');

  b.abschnitt('Die Null ist etwas anderes als das leere Feld');
  await materialFeld('Ankerpfahl', 0);
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.material.length === 2', 3000);
  b.gleich(await bau("bau.material.find(z => z.artikel === 'ankerpfahl').menge"), 0,
    'Null wird festgehalten – „nachweislich nichts verbraucht“ ist eine Aussage');
  await materialFeld('Ankerpfahl', '');
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.material.length === 1', 3000);
  b.pruefe(true, 'Das leere Feld nimmt die Zeile wieder heraus');

  b.abschnitt('Eine ungültige Menge wird abgewiesen und nicht still verworfen');
  /* Vorher wurde jede Eingabe, die keine Zahl ergibt, zu `null` – und `null`
     nimmt die Zeile aus der Planung. Wer sich am Bauort um ein Minus vertat,
     sah seine eingetragene Menge verschwinden, ohne zu erfahren warum. */
  await materialFeld('Feldkabel FKb', -5);
  await seite.ruhe();
  b.gleich(await bau("bau.material.find(z => z.artikel === 'fkb').menge"), 1450,
    'Die eingetragene Menge bleibt stehen');
  b.pruefe(await seite.auswerten(`
    const f = [...document.querySelectorAll('.bau-material .mat-zeile')]
      .find(x => x.querySelector('.feld-titel').textContent === 'Feldkabel FKb');
    return !!f && !!f.querySelector('.feld-abgewiesen');`),
    'Das Feld zeigt sichtbar, dass die Eingabe nicht angenommen wurde');
  b.pruefe(/keine Menge unter|keine zahl/i.test(
    await seite.auswerten('document.getElementById("hinweisbox").textContent') || ''),
    'Und die Meldung sagt, warum');
  /* Zurück auf einen gültigen Wert: die Abweisung darf das Feld nicht sperren. */
  await materialFeld('Feldkabel FKb', 1450);
  await seite.ruhe();
  b.gleich(await bau("bau.material.find(z => z.artikel === 'fkb').menge"), 1450,
    'Nach der Abweisung nimmt das Feld wieder an');

  /* Eine halbe Eingabe – „1 45“, „12,“ – färbt beim Tippen nichts, weil sie
     der Weg zu einer Zahl ist. Wer das Feld so verließ, hatte aber still den
     letzten gültigen Anschlag gespeichert: aus „1 45“ wurde 1 m. */
  const halbeEingabe = async text => seite.auswerten(`
    const f = [...document.querySelectorAll('.bau-material .mat-zeile')]
      .find(x => x.querySelector('.feld-titel').textContent === 'Feldkabel FKb');
    const e = f.querySelector('input');
    const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    e.focus(); e.dispatchEvent(new Event('focus'));
    let bisher = '';
    for (const z of ${JSON.stringify(text)}) {
      bisher += z; setzer.call(e, bisher);
      e.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise(r => setTimeout(r, 200));
    e.blur(); e.dispatchEvent(new Event('blur'));
    await new Promise(r => setTimeout(r, 250));
    return { feld: e.value, pille: document.getElementById('hinweisbox').textContent };`);
  for (const text of ['1 45', '12,']) {
    const r = await halbeEingabe(text);
    b.gleich(await bau("bau.material.find(z => z.artikel === 'fkb').menge"), 1450,
      `„${text}“ und dann das Feld verlassen: die Menge von vorher bleibt`);
    b.pruefe(r.feld === '1450' && /keine vollständige Zahl/.test(r.pille),
      `Das Feld zeigt sie wieder, und die Meldung sagt warum (${r.feld} · ${r.pille.trim()})`);
  }

  b.abschnitt('Bruchteile eines Meters Kabel werden hinterfragt');
  /* „1,450“ ist die Schreibweise der Anwendung für 1.450 m – nur mit Komma.
     Gespeichert wurde still 1,45 m, und keine Warnung schlug an. */
  const kabelWarnung = () => seite.auswerten(`
    const f = [...document.querySelectorAll('.bau-material .mat-zeile')]
      .find(x => x.querySelector('.feld-titel').textContent === 'Feldkabel FKb');
    const w = f && f.querySelector('.mat-warnung');
    return { text: w && !w.hidden ? w.textContent : '',
             griff: !!(w && !w.hidden && w.querySelector('.mat-uebernehmen')) };`);
  await materialFeld('Feldkabel FKb', '1,450');
  await seite.warteAuf(
    "window.fbp.store.projekt.strecken[0].bau.material.find(z => z.artikel === 'fkb').menge === 1.45", 3000);
  const bruch = await kabelWarnung();
  b.pruefe(/1,45 m – gemeint 1\.450 m\?/.test(bruch.text),
    `Die Zeile fragt „1,45 m – gemeint 1.450 m?“ (${bruch.text || 'keine Warnung'})`);
  b.pruefe(bruch.griff, 'Und trägt den Griff zum Übernehmen');
  await seite.auswerten(`document.querySelector('.mat-warnung .mat-uebernehmen').click(); return true;`);
  await seite.warteAuf(
    "window.fbp.store.projekt.strecken[0].bau.material.find(z => z.artikel === 'fkb').menge === 1450", 3000);
  b.pruefe(true, 'Ein Tipp auf den Griff schreibt 1.450 m');
  /* Was danach steht, ist die Prüfung gegen den Bedarf wie bei jeder Menge –
     die Frage nach dem Bruchteil ist beantwortet und weg. */
  b.pruefe(!/gemeint|Bruchteil/.test((await kabelWarnung()).text),
    'Danach fragt die Zeile nicht mehr nach dem Bruchteil');
  /* „2,5“ ist kein Tausender, aber auch kein Kabelmaß – gewarnt wird, ein
     Vorschlag wäre geraten. */
  await materialFeld('Feldkabel FKb', '2,5');
  const halb = await kabelWarnung();
  b.pruefe(/Bruchteile/.test(halb.text) && !halb.griff,
    `„2,5“ wird hinterfragt, aber nichts vorgeschlagen (${halb.text || 'keine Warnung'})`);
  await materialFeld('Feldkabel FKb', 1450);
  await seite.warteAuf(
    "window.fbp.store.projekt.strecken[0].bau.material.find(z => z.artikel === 'fkb').menge === 1450", 3000);

  b.abschnitt('Eine freie Zeile für das, was der Katalog nicht kennt');
  await taste('.bau-material', '+ Zeile');
  b.gleich(await bau('bau.material.length'), 2, 'Die freie Zeile steht in der Planung');
  b.gleich(await bau("bau.material.filter(z => z.artikel === 'sonstiges').length"), 1,
    'Und trägt den Artikel „Sonstiges“');
  await seite.schreibe('.bau-material .mat-freizeile input', 'Kabelbrücke, geliehen');
  await seite.warteAuf(
    "window.fbp.store.projekt.strecken[0].bau.material" +
    ".some(z => z.bemerkung === 'Kabelbrücke, geliehen')", 3000);
  b.pruefe(true, 'Die Bezeichnung wird geschrieben');


  b.abschnitt('Ein gelöschter Bauabschnitt lässt keine doppelte Materialzeile zurück');
  /* Der Fall, der die Summe verfälscht: eine Menge steht ohne Bauabschnitt da,
     eine zweite desselben Artikels im Abschnitt. Wird der Abschnitt gelöscht,
     treffen beide auf „ohne Abschnitt“. Ungezogen zeigte der Bogen die erste
     und rechnete mit beiden – der Trupp sähe eine andere Zahl, als er meldet. */
  const doppelt = await seite.auswerten(`
    const st = await import('./js/state.js');
    const bd = await import('./js/baudoku.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    let vorher, nachher, angezeigt;
    window.fbp.store.aendern(() => {
      const bau = bd.bauSichern(s);
      bau.material = [];
      const a = bd.bauabschnittAnlegen(s);
      bd.materialSetzen(s, 'ffkb', null, 400);
      bd.materialSetzen(s, 'ffkb', a.id, 350);
      vorher = bd.materialSumme(s).get('ffkb');
      bd.bauabschnittLoeschen(s, a.id);
      nachher = bd.materialSumme(s).get('ffkb');
      angezeigt = bd.materialzeile(s, 'ffkb', null).menge;
    }, 'bau');
    const zeilen = s.bau.material.filter(z => z.artikel === 'ffkb').length;
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return { vorher, nachher, angezeigt, zeilen };`);
  b.gleich(doppelt.vorher, 750, 'Vor dem Löschen zählt die Summe beide Zeilen');
  b.gleich(doppelt.zeilen, 1, 'Danach steht nur noch eine Zeile da');
  b.gleich(doppelt.nachher, 750, 'Die Summe bleibt dieselbe – nichts geht verloren');
  b.gleich(doppelt.angezeigt, 750, 'Und der Bogen zeigt, womit gerechnet wird');

  b.abschnitt('Das Soll steht in der Einheit des Feldes');
  /* Ein Feld, das Meter nimmt, und „542,37 km“ darunter: wer das liest, tippt
     542. Deshalb steht das Soll in derselben Einheit wie die Zeile. */
  const sollText = await seite.auswerten(`
    const f = [...document.querySelectorAll('.bau-material .mat-zeile')]
      .find(x => x.querySelector('.feld-titel').textContent === 'Feldkabel FKb');
    return f ? (f.querySelector('.mat-fuss')?.textContent || '') : null;`);
  b.pruefe(/ m\b/.test(sollText || ''),
    `Der Bedarf steht in Metern (${sollText})`);
  b.pruefe(!/km/.test(sollText || ''), 'Und nicht in Kilometern');
  const einheitDrin = await seite.auswerten(`
    const f = [...document.querySelectorAll('.bau-material .mat-zeile')]
      .find(x => x.querySelector('.feld-titel').textContent === 'Feldkabel FKb');
    const e = f.querySelector('.feld-einheit');
    const i = f.querySelector('input');
    return e.getBoundingClientRect().bottom <= i.getBoundingClientRect().bottom + 1;`);
  b.pruefe(einheitDrin === true,
    'Die Einheit steht im Eingabefeld und nicht darunter neben der Fußnote');
  // ------------------------------------------------------------ Baumeldungen

  b.abschnitt('Baumeldungen als Zeitschiene');
  b.gleich(await bau('bau.meldungen.length'), 0, 'Noch keine Meldung');
  await taste('.bau-meldungen', 'Meldung mitschreiben');
  /* Seit der vierten Runde legt der Griff eine Zeile zum Schreiben auf und
     noch keine Meldung: eine Unterbrechung ließ sonst eine leere zurück, die
     beim Planer als Baumeldung ohne Inhalt ankam. */
  b.gleich(await bau('bau.meldungen.length'), 0,
    'Der Griff schlägt eine Zeile auf, legt aber noch keine leere Meldung an');
  b.gleich(await seite.anzahl('.bau-meldungen .bm-entwurf'), 1, 'Die Zeile zum Schreiben steht da');
  const tippZeit = Date.now();
  /* Ein Neuaufbau der Liste – ein Punkt kommt an, der Stand wechselt – nimmt
     die Zeile nicht mit. */
  await seite.auswerten('window.fbp.store.aendern(() => {}, "bau"); return true;');
  b.gleich(await seite.anzahl('.bau-meldungen .bm-entwurf'), 1,
    'Sie übersteht einen Neuaufbau der Liste');
  await seite.schreibe('.bm-entwurf .feld input', 'E');
  b.gleich(await bau('bau.meldungen.length'), 1, 'Mit dem ersten Zeichen wird sie eine Meldung');
  /* Wird der Text wieder ganz gelöscht, bleibt keine leere Meldung stehen:
     „Baumeldung ohne Text gibt es nicht“ gilt auch rückwärts. Je nachdem, ob
     das erste Zeichen den Stand gewechselt hat, steht die Zeile noch als
     Entwurf oder schon als Meldung da – beide Wege enden gleich. */
  const meldungFeld = () => seite.auswerten(`return document.querySelector('.bm-entwurf .feld input')
    ? '.bm-entwurf .feld input' : '.bm-zeile .feld input'`);
  await seite.schreibe(await meldungFeld(), '');
  b.gleich(await bau('bau.meldungen.length'), 0, 'Wieder geleert, ist es keine Meldung mehr');
  if (!(await seite.anzahl('.bau-meldungen .bm-entwurf'))) {
    await taste('.bau-meldungen', 'Meldung mitschreiben');
  }
  b.gleich(await seite.anzahl('.bau-meldungen .bm-entwurf'), 1, 'Die Zeile zum Schreiben steht wieder da');
  await seite.schreibe('.bm-entwurf .feld input', 'E');
  b.gleich(await bau('bau.meldungen.length'), 1, 'Das nächste Zeichen legt sie wieder an');
  b.pruefe(await bau('!!bau.meldungen[0].zeit') &&
    Math.abs(await bau('Date.parse(bau.meldungen[0].zeit)') - tippZeit) < 60000,
    'Die Uhrzeit ist die des Tipps – nachträglich geschätzt wäre sie keine Bauzeit');
  b.pruefe(await bau('!!bau.meldungen[0].abschnitt'),
    'Die Meldung hängt am aktiven Bauabschnitt');
  await seite.schreibe('.bm-zeile .feld input', 'Erste Länge verbaut, Trasse frei');
  await seite.warteAuf(
    "window.fbp.store.projekt.strecken[0].bau.meldungen[0].text.startsWith('Erste Länge')", 3000);
  b.pruefe(true, 'Der Text wird nachgetragen');
  b.gleich(await bau('bau.meldungen.length'), 1, 'Und es bleibt bei einer Meldung');

  /* Material und Meldungstext schreiben über Formularfelder, die die Liste
     nicht neu aufbauen. Im Audit stand deshalb „Noch offen: Material“ unter
     einem ausgefüllten Bogen, bis jemand neu lud. */
  b.abschnitt('Der Rückmeldeblock folgt dem Bogen, ohne dass jemand neu lädt');
  const rueckwegText = () => seite.auswerten(
    `return (document.querySelector('#bau-liste .bau-rueckweg')?.textContent || '').replace(/\\s+/g, ' ')`);
  const merkMaterial = await bau('JSON.stringify(bau.material)');
  await seite.auswerten(`window.fbp.store.aendern(() => {
    window.fbp.store.projekt.strecken[0].bau.material = []; }, 'bau'); return true;`);
  await seite.ruhe();
  b.pruefe(/Noch offen:[^.]*Material/.test(await rueckwegText()),
    'Ohne Material nennt der Block es als offen');
  const codeVorher = await seite.text('#bau-liste .bau-code .meldungscode');
  await materialFeld('Feldkabel FKb', 1450);
  await seite.warteAuf(`!/Noch offen:[^.]*Material/.test(
    document.querySelector('#bau-liste .bau-rueckweg').textContent)`, 3000);
  b.pruefe(true, 'Eingetragen verschwindet es dort sofort');
  const codeNachher = await seite.text('#bau-liste .bau-code .meldungscode');
  b.pruefe(/^[2-9A-HJ-NP-Z]{4}$/.test(codeNachher || ''),
    `Der Block nennt einen Kurzcode aus vier gut sprechbaren Zeichen (${codeNachher})`);
  /* „Meldung WQ64“ stand im Audit neben drei anderen Dingen namens „Meldung“. */
  b.pruefe(/Rückgabe-Code [2-9A-HJ-NP-Z]{4} – dem Planer über Funk nennen/.test(await rueckwegText()),
    'Er heißt Rückgabe-Code und sagt, wohin er geht');
  b.pruefe(await seite.auswerten(`const c = document.querySelector('#bau-liste .bau-code .meldungscode');
    return getComputedStyle(c).borderTopStyle !== 'none'`),
    'Und steht als umrandete Marke da, anders als die Plan-Nr.');
  b.pruefe(codeVorher && codeNachher !== codeVorher, 'Der Kurzcode ändert sich mit der Eintragung');
  /* Beim Planer wird er aus der Meldung nachgerechnet, nicht mitgeschickt –
     er muss nach dem Weg durch JSON derselbe sein. */
  b.gleich(await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const p = window.fbp.store.projekt;
    const angekommen = JSON.parse(JSON.stringify(t.alsBaumeldung(p, p.strecken, 'Trupp')));
    return t.meldungsCodeAus(angekommen);`), codeNachher,
    'Der Planer rechnet aus der angekommenen Meldung denselben Code');
  await seite.auswerten(`window.fbp.store.aendern(() => {
    window.fbp.store.projekt.strecken[0].bau.material = JSON.parse(${JSON.stringify(merkMaterial)}); },
    'bau'); return true;`);
  await seite.ruhe();

  /* Der Link-Dialog: der Weg hinaus ist der Hauptknopf, nicht „Schließen“.
     Und der Vermerk über das Kopieren ist kein Schritt, den „↶“ zurücknimmt –
     im Audit machte ein Tipp, der dem letzten Punkt galt, aus „Link erzeugt“
     wieder „noch nicht gemeldet“. */
  b.abschnitt('Der Link-Dialog schickt hinaus, und „↶“ nimmt den Versand nicht zurück');
  await seite.auswerten(`navigator.clipboard.writeText = () => Promise.resolve(); return true;`);
  const codeJetzt = await seite.text('#bau-liste .bau-code .meldungscode');
  await taste('#bau-liste .bau-rueckweg', 'Als Link');
  await seite.warteAuf(`!document.querySelector('.meldung-link textarea').value.startsWith('wird')`, 5000);
  const linkFuss = await seite.auswerten(`return [...document.querySelectorAll('#dialog-fuss .knopf')]
    .map(k => (k.classList.contains('primaer') ? '*' : '') + k.textContent).join('|')`);
  b.pruefe(!/\*Schließen/.test(linkFuss) && /\*(Kopieren|Teilen)/.test(linkFuss),
    `Hauptknopf ist Kopieren oder Teilen, nicht Schließen (${linkFuss})`);
  b.pruefe(!!codeJetzt && (await seite.text('.meldung-link') || '').includes(codeJetzt),
    'Der Dialog nennt denselben Kurzcode wie der Block');
  const undoVorher = await seite.auswerten('return window.fbp.store.undoStapel.length');
  await taste('#dialog-fuss', 'Kopieren');
  await seite.warteAuf('!!window.fbp.store.projekt.strecken[0].bau.abgesetzt', 3000);
  const pille = await seite.text('#hinweisbox');
  b.pruefe(/^Link kopiert – jetzt verschicken/.test(pille || '') && !/abgesetzt/.test(pille || ''),
    `Die Pille sagt, was jetzt zu tun ist, und nicht „abgesetzt“ (${pille})`);
  b.gleich(await seite.auswerten('return window.fbp.store.undoStapel.length'), undoVorher,
    'Der Vermerk legt keinen Rückgängig-Schritt an');
  await taste('#dialog-fuss', 'Schließen');

  /* Der Vermerk hielt den Code nicht fest: nach der nächsten Eintragung stand
     nur noch der neue da, und nannte der Planer über Funk den verschickten,
     war am Gerät nichts zu finden. */
  b.abschnitt('Der verschickte Rückgabe-Code bleibt lesbar');
  b.gleich(await bau('bau.abgesetzt.code'), codeJetzt, 'Der Vermerk hält den verschickten Code fest');
  await seite.auswerten(`window.fbp.store.aendern(() => {
    window.fbp.store.projekt.strecken[0].bau.abweichung = 'Probe für den Code'; }, 'bau'); return true;`);
  await seite.ruhe();
  const nachVersand = await rueckwegText();
  const codeNeu = await seite.text('#bau-liste .bau-code .meldungscode');
  b.pruefe(codeNeu !== codeJetzt && nachVersand.includes(`Zuletzt verschickt: ${codeJetzt}`) &&
    nachVersand.includes(`jetzt: ${codeNeu}`),
    `Nach einer Eintragung stehen beide da: verschickt ${codeJetzt}, jetzt ${codeNeu}`);
  b.pruefe(await seite.auswerten(`
    const st = await import('./js/state.js');
    return st.migrieren(JSON.parse(JSON.stringify(window.fbp.store.projekt))).strecken[0].bau.abgesetzt.code;`)
    === codeJetzt, 'Der Code übersteht Speichern und Laden – ohne neues Schema');
  await seite.auswerten('window.fbp.store.undo(); return true;');
  await seite.ruhe();

  /* Schlug das Kopieren fehl, gab der Trupp den Link von Hand weiter – und der
     Block sagte weiter „noch nicht gemeldet“. */
  b.abschnitt('Kopieren misslungen: der Versand lässt sich trotzdem vermerken');
  await seite.auswerten(`window.fbp.store.aendern(() => {
    window.fbp.store.projekt.strecken[0].bau.abgesetzt = null; }, 'bau', { undo: false });
    navigator.clipboard.writeText = () => Promise.reject(new Error('verweigert')); return true;`);
  await seite.ruhe();
  await taste('#bau-liste .bau-rueckweg', 'Als Link');
  await seite.warteAuf(`!document.querySelector('.meldung-link textarea').value.startsWith('wird')`, 5000);
  b.pruefe(await seite.auswerten(`return [...document.querySelectorAll('.meldung-link button')]
    .every(k => k.closest('[hidden]'))`), 'Vor dem Fehlschlag steht kein Griff „von Hand“ da');
  await taste('#dialog-fuss', 'Kopieren');
  await seite.warteAuf(`[...document.querySelectorAll('.meldung-link button')]
    .some(k => /von Hand/.test(k.textContent) && !k.closest('[hidden]'))`, 3000);
  b.pruefe(true, 'Nach dem Fehlschlag bietet der Dialog „Ich habe den Link von Hand weitergegeben“ an');
  await taste('.meldung-link', 'von Hand weitergegeben');
  b.pruefe(await bau('!!bau.abgesetzt && bau.abgesetzt.weg === "link"'), 'Und vermerkt den Versand');
  await taste('#dialog-fuss', 'Schließen');
  await seite.auswerten(`navigator.clipboard.writeText = () => Promise.resolve(); return true;`);
  await seite.auswerten(`window.fbp.store.aendern(() => {
    window.fbp.store.projekt.strecken[0].bau.abweichung = 'Probe'; }, 'bau'); return true;`);
  await seite.auswerten('window.fbp.store.undo(); return true;');
  await seite.ruhe();
  b.pruefe(await bau('!!bau.abgesetzt'),
    '„↶“ nimmt die Eintragung danach zurück, den Versandvermerk aber nicht');
  b.pruefe(await seite.auswerten(`const e = document.querySelector('#bau-liste .bau-abgesetzt');
    return !!e && getComputedStyle(e).color !== 'rgb(27, 122, 61)'`),
    'Der Satz „weiß dieses Gerät nicht“ steht nicht in Erfolgsgrün');
  /* Die Fälle zum Rückweg weiter unten beginnen ohne Vermerk. */
  await seite.auswerten(`window.fbp.store.aendern(() => {
    window.fbp.store.projekt.strecken[0].bau.abgesetzt = null; }, 'bau'); return true;`);

  b.abschnitt('Nachgetragen wird auch eine Woche später');
  /* Die Tagwahl bot nur die letzten vier Tage. Ein Baunachweis, der eine Woche
     im Fahrzeug lag, ließ sich damit nicht richtig datieren – „anderer Tag …“
     öffnet ein Datumsfeld, und der Tag landet am Eintrag. */
  const vorZehn = await seite.auswerten(`
    const d = new Date(); d.setDate(d.getDate() - 10);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');`);
  const tagwahl = await seite.auswerten(`
    const box = document.querySelector('#bau-liste .bau-punkte .zeit-wahl:not(.knapp)');
    if (!box) return JSON.stringify({ fehlt: true });
    const tag = box.querySelector('select.zw-tag');
    const datum = box.querySelector('input.zw-datum');
    const vorher = { verborgen: datum ? datum.hidden : null,
                     wahl: [...tag.options].some(o => o.textContent === 'anderer Tag …') };
    tag.value = 'anderer';
    tag.dispatchEvent(new Event('change', { bubbles: true }));
    const st = getComputedStyle(datum);
    const offen = { sichtbar: !datum.hidden && st.display !== 'none',
                    /* Die Zeile kann eingeklappt sein (Befund eines bestätigten
                       Punktes) – dann misst der Kasten 0, die Regel aber nicht. */
                    schrift: parseFloat(st.fontSize),
                    hoehe: Math.max(datum.getBoundingClientRect().height, parseFloat(st.minHeight) || 0),
                    max: datum.max };
    datum.value = ${JSON.stringify(vorZehn)};
    datum.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(f => setTimeout(f, 300));
    return JSON.stringify({ ...vorher, ...offen });`).then(x => JSON.parse(x));
  b.pruefe(!tagwahl.fehlt, 'Im Bau-Reiter steht eine Tagwahl');
  b.pruefe(tagwahl.wahl && tagwahl.verborgen === true,
    '„anderer Tag …“ steht in der Liste, das Datumsfeld erst auf Wahl');
  b.pruefe(tagwahl.sichtbar, 'Gewählt, erscheint das Datumsfeld');
  b.pruefe(tagwahl.schrift >= 16 && tagwahl.hoehe >= 44,
    `Es hält 16 px Schrift und 44 px Höhe (${tagwahl.schrift} px, ${Math.round(tagwahl.hoehe)} px)`);
  b.pruefe(!!tagwahl.max, 'Ein Tag in der Zukunft ist nicht wählbar');
  b.pruefe(await bau(`bau.punkte.some(p => {
      const d = new Date(p.zeit);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') === ${JSON.stringify(vorZehn)};
    })`), 'Der Eintrag trägt danach den Tag vor zehn Tagen');
  // Zurück auf den Stand davor: die Prüfungen danach rechnen mit Zeiten von heute.
  await seite.auswerten('window.fbp.store.undo(); return true;');
  await seite.ruhe();

  /* Drei Wege, auf denen „anderer Tag …“ still nichts schrieb: eine Uhrzeit,
     bevor ein Tag gewählt ist; ein Tag in der Zukunft, der auf heute
     zurücksprang; und derselbe Tag wie vorbelegt, der kein `change` auslöste. */
  b.abschnitt('„anderer Tag …“ verwirft nichts still');
  const andererTag = await seite.auswerten(`
    const box = document.querySelector('#bau-liste .bau-punkte .zeit-wahl:not(.knapp)');
    const tag = box.querySelector('select.zw-tag');
    const zeit = box.querySelector('input.bm-zeit');
    const datum = box.querySelector('input.zw-datum');
    tag.value = 'anderer';
    tag.dispatchEvent(new Event('change', { bubbles: true }));
    const leer = datum.value === '';
    const morgen = new Date(); morgen.setDate(morgen.getDate() + 2);
    datum.value = morgen.getFullYear() + '-' + String(morgen.getMonth() + 1).padStart(2, '0') + '-' +
      String(morgen.getDate()).padStart(2, '0');
    datum.dispatchEvent(new Event('change', { bubbles: true }));
    const zukunft = document.getElementById('hinweisbox').textContent;
    const offen = !datum.hidden && tag.value === 'anderer';
    zeit.value = '03:17';
    zeit.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    return { leer, zukunft, offen, pille: document.getElementById('hinweisbox').textContent };`);
  b.pruefe(andererTag.leer, 'Das Datumsfeld beginnt leer – auch der bisherige Tag ist eine Wahl');
  b.pruefe(/in der Zukunft/.test(andererTag.zukunft) && andererTag.offen,
    `Ein Tag in der Zukunft wird benannt, und das Feld bleibt offen (${andererTag.zukunft.trim()})`);
  b.pruefe(await bau(`bau.punkte.some(p => p.zeit && new Date(p.zeit).getHours() === 3 &&
      new Date(p.zeit).getMinutes() === 17)`) && /erst das Datum wählen/.test(andererTag.pille),
    `Eine Uhrzeit ohne gewählten Tag gilt auf dem bisherigen, und die Meldung sagt das (${andererTag.pille.trim()})`);
  await seite.auswerten('window.fbp.store.undo(); return true;');
  await seite.ruhe();

  /* Der Bogen verspricht, dass sich Uhrzeit und Datum so nachtragen lassen,
     wie sie dort stehen. Vorher stempelte „✓ wie geplant“ die Uhrzeit des
     Abtippens, und der Tag war an jedem Punkt einzeln zu wählen. */
  b.abschnitt('Vom Baunachweis nachtragen: ein Tag für die ganze Abschrift');
  const nachtragMerk = await bau('JSON.stringify(bau)');
  await seite.auswerten(`window.fbp.store.aendern(() => {
    const b = window.fbp.store.projekt.strecken[0].bau;
    b.punkte = []; b.meldungen = []; b.pruefung = null; }, 'bau'); return true;`);
  await seite.ruhe();
  const vorDrei = await seite.auswerten(`
    const d = new Date(); d.setDate(d.getDate() - 3);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');`);
  const tagVon = iso => seite.auswerten(`const d = new Date(${JSON.stringify(iso)});
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');`);
  b.gleich(await seite.anzahl('#bau-liste .bau-nachtrag'), 0, 'Ohne Wahl läuft kein Nachtrag');
  b.pruefe(!(await seite.auswerten(`[...document.querySelectorAll('#bau-liste .bau-punkte button')]
    .some(k => /Koordinate/.test(k.textContent))`)),
    'Der Koordinatengriff steht nur im Nachtrag – am Bauort ist „◉ hier“ der genauere Weg');
  await taste('#bau-liste .bau-punkte', 'Vom Baunachweis nachtragen');
  b.gleich(await seite.anzahl('#bau-liste .bau-nachtrag'), 1, 'Der Nachtrag steht oben im Reiter');
  const tagSetzen = async wert => {
    await seite.auswerten(`const e = document.querySelector('#bau-liste .bau-nachtrag .bn-tag input');
      e.value = ${JSON.stringify(wert)}; e.dispatchEvent(new Event('input', { bubbles: true }));
      return true;`);
    await seite.ruhe();
  };
  await tagSetzen('2099-01-01');
  b.pruefe(/in der Zukunft/.test(await seite.text('#hinweisbox') || ''),
    'Ein Baudatum in der Zukunft wird abgewiesen und benannt');
  await tagSetzen(vorDrei);
  b.gleich(await seite.auswerten(`(await import('./js/baudoku.js')).nachtragTag()`), vorDrei,
    'Der Tag vom Blatt gilt für den ganzen Nachtrag');
  await seite.auswerten(`[...document.querySelector('#bau-liste .bp-zeile:not(.bestaetigt)')
    .querySelectorAll('button')].find(k => k.textContent.includes('wie geplant')).click(); return true;`);
  await seite.ruhe();
  b.gleich(await bau('bau.punkte[0].zeit'), '',
    '„✓ wie geplant“ stempelt keine Uhrzeit – die des Abtippens wäre keine Bauzeit');
  b.pruefe(await bau('!!bau.punkte[0].nachgetragen'), 'Der Punkt trägt den Zeitpunkt der Abschrift');
  b.pruefe(/Uhrzeit fehlt/.test(await seite.text('#bau-liste .bp-zeile.bestaetigt') || ''),
    'Die Zeile sagt, dass die Uhrzeit vom Blatt noch fehlt');
  await seite.auswerten(`const e = document.querySelector('#bau-liste .bp-zeile.bestaetigt > .zeit-wahl input.bm-zeit');
    e.value = '14:20'; e.dispatchEvent(new Event('change', { bubbles: true })); return true;`);
  await seite.ruhe();
  b.gleich(await tagVon(await bau('bau.punkte[0].zeit')), `${vorDrei} 14:20`,
    'Die Uhrzeit in der Zeile gilt auf dem Tag vom Blatt');

  await taste('#bau-liste .bau-meldungen', 'Meldung mitschreiben');
  b.pruefe(await seite.anzahl('#bau-liste .bm-entwurf select.zw-tag') === 1,
    'Die Meldung bietet im Nachtrag den Tag zur Wahl, samt „anderer Tag …“');
  await seite.schreibe('.bm-entwurf .feld input', 'Zweite Länge verbaut');
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.meldungen.length === 1', 3000);
  b.gleich(await bau('bau.meldungen[0].zeit'), '', 'Sie entsteht ohne Uhrzeit des Tipps');
  await seite.auswerten(`const e = document.querySelector('#bau-liste .bm-zeile .zeit-wahl input.bm-zeit');
    e.value = '15:05'; e.dispatchEvent(new Event('change', { bubbles: true })); return true;`);
  await seite.ruhe();
  b.gleich(await tagVon(await bau('bau.meldungen[0].zeit')), `${vorDrei} 15:05`,
    'Und bekommt die Uhrzeit vom Blatt auf dessen Tag');

  await taste('.bau-uebergabe', '+ Stamm');
  b.gleich(await bau('bau.pruefung.staemme[0].zeit'), '', 'Die Prüfzeile ebenso');
  await seite.auswerten(`const e = document.querySelector('#bau-liste .pz-zeile .zeit-wahl input.bm-zeit');
    e.value = '16:40'; e.dispatchEvent(new Event('change', { bubbles: true })); return true;`);
  await seite.ruhe();
  b.gleich(await tagVon(await bau('bau.pruefung.staemme[0].zeit')), `${vorDrei} 16:40`,
    'Die Prüfzeile hat ein Zeitfeld und nimmt den Tag vom Blatt');

  b.abschnitt('Ein abweichender Punkt kommt als Koordinate vom Blatt');
  /* Der Bogen verwies auf ein Feld „Koordinate“, das es im Baumodus nicht
     gab. Geschrieben wird der Ist-Punkt mit Herkunft „Papier“; der geplante
     Punkt bleibt, wo er ist. */
  const kooDialog = async (zeile, mgrs, haken = false) => {
    await seite.auswerten(`
      const z = document.querySelectorAll('#bau-liste .bp-zeile')[${zeile}];
      [...z.querySelectorAll('button')].find(k => k.textContent.includes('Koordinate')).click(); return true;`);
    await seite.ruhe();
    return seite.auswerten(`
      const e = document.getElementById('ik-eingabe');
      e.value = ${JSON.stringify(mgrs)};
      if (${haken}) { const h = document.getElementById('ik-fern'); if (h) h.checked = true; }
      [...document.querySelectorAll('#dialog-fuss button')].find(k => k.textContent === 'Übernehmen').click();
      await new Promise(r => setTimeout(r, 200));
      return { offen: !document.getElementById('dialog').hidden,
               status: document.getElementById('ik-status')?.textContent || '' };`);
  };
  const soll2 = await bau('JSON.stringify([s.punkte[1].lat, s.punkte[1].lng])');
  const neben = await seite.auswerten(`const g = await import('./js/geo.js');
    const p = window.fbp.store.projekt.strecken[0].punkte[1];
    return { nah: g.toMGRS(p.lat + 0.0004, p.lng, 5), fern: g.toMGRS(p.lat + 0.05, p.lng, 5) };`);
  const fern = await kooDialog(1, neben.fern);
  b.pruefe(fern.offen && /Zahlendreher/.test(fern.status),
    `5 km neben dem Plan fragt der Dialog nach einem Zahlendreher (${fern.status.trim()})`);
  await seite.auswerten(`[...document.querySelectorAll('#dialog-fuss button')]
    .find(k => k.textContent === 'Abbrechen').click(); return true;`);
  await seite.ruhe();
  const nah = await kooDialog(1, neben.nah);
  b.pruefe(!nah.offen, 'Eine Koordinate 45 m daneben wird übernommen');
  b.gleich(await bau(`bau.punkte.find(p => p.sollPunkt === s.punkte[1].id)?.quelle`), 'papier',
    'Der Punkt trägt die Herkunft „Papier“');
  b.gleich(await bau('JSON.stringify([s.punkte[1].lat, s.punkte[1].lng])'), soll2,
    'Der geplante Punkt bleibt unangetastet');
  b.pruefe(await bau(`bau.punkte.find(p => p.sollPunkt === s.punkte[1].id).nachgetragen !== ''`),
    'Und den Zeitpunkt der Abschrift');
  await seite.auswerten(`[...document.querySelectorAll('#bau-liste .bau-punkte button')]
    .find(k => k.textContent.includes('Punkt nach Koordinate')).click(); return true;`);
  await seite.ruhe();
  await seite.auswerten(`document.getElementById('ik-eingabe').value = ${JSON.stringify(neben.nah)};
    [...document.querySelectorAll('#dialog-fuss button')].find(k => k.textContent === 'Übernehmen').click();
    return true;`);
  await seite.ruhe();
  b.pruefe(await bau(`bau.punkte.some(p => !p.sollPunkt && p.quelle === 'papier')`),
    'Ein zusätzlicher Punkt lässt sich ebenso nach Koordinate aufnehmen');

  b.abschnitt('Bauabschnitt von Punkt bis Punkt und der Geräteausfall');
  /* Der Bogen fragt seit der vierten Runde danach; das Gerät konnte beides
     nicht aufnehmen. */
  await seite.auswerten(`const s = window.fbp.store.projekt.strecken[0];
    const w = (marke, wert) => { const e = document.querySelector('[data-bau-feld="' + marke + '"]');
      e.value = wert; e.dispatchEvent(new Event('change', { bubbles: true })); };
    const a = s.bau.abschnitte[0];
    w('ba-von-' + a.id, s.punkte[0].id);
    w('ba-bis-' + a.id, s.punkte[2].id);
    return true;`);
  await seite.ruhe();
  await seite.auswerten(`const s = window.fbp.store.projekt.strecken[0];
    const a = s.bau.abschnitte[0];
    const e = document.querySelector('[data-bau-feld="ausfall-nach-' + a.id + '"]');
    e.value = s.punkte[1].id; e.dispatchEvent(new Event('change', { bubbles: true }));
    return true;`);
  await seite.ruhe();
  await seite.auswerten(`const z = document.querySelector('#bau-liste .ba-eintrag .bau-ausfall input.bm-zeit');
    z.value = '13:05'; z.dispatchEvent(new Event('change', { bubbles: true })); return true;`);
  await seite.ruhe();
  b.pruefe(await bau(`bau.abschnitte[0].vonPunkt === s.punkte[0].id && bau.abschnitte[0].bisPunkt === s.punkte[2].id`),
    'Der Abschnitt trägt von und bis Punkt als Kennung');
  b.pruefe(await bau(`bau.abschnitte[0].ausfallNach === s.punkte[1].id && !!bau.abschnitte[0].ausfallZeit`),
    'Und den Geräteausfall mit Uhrzeit und Punkt');
  b.gleich(await tagVon(await bau('bau.abschnitte[0].ausfallZeit')), `${vorDrei} 13:05`,
    'Der Ausfall liegt auf dem Tag vom Blatt');
  const nachtragStand = await bau('JSON.stringify(bau)');

  /* Der Nachtrag ist Sitzungszustand: wer den Reiter verlässt, beendet ihn –
     sonst nähme der Trupp am nächsten Morgen mit dem Tag von gestern auf. */
  await seite.klick('.reiter button[data-reiter="strecken"]');
  await seite.klick('.reiter button[data-reiter="bau"]');
  await seite.ruhe();
  b.gleich(await seite.anzahl('#bau-liste .bau-nachtrag'), 0,
    'Wer den Bau-Reiter verlässt, beendet den Nachtrag');
  await seite.auswerten(`window.fbp.store.aendern(() => {
    window.fbp.store.projekt.strecken[0].bau = JSON.parse(${JSON.stringify(nachtragMerk)}); }, 'bau');
    return true;`);
  await seite.ruhe();

  // ------------------------------------------------------------ Prüfen und Übergeben

  b.abschnitt('Ohne Prüfung keine Übergabe');
  b.gleich(await bau('bau.pruefung'), null, 'Der Prüfblock entsteht erst bei Bedarf');
  await taste('.bau-uebergabe', '+ Stamm');
  b.gleich(await bau('bau.pruefung.staemme.length'), 1, 'Ein Stamm');
  b.gleich(await bau('bau.pruefung.staemme[0].bestanden'), null,
    '„Noch offen“ und nicht „durchgefallen“ – das ist der Unterschied am Bauort');
  /* Die Strecke fuehrt Feldkabel (FK 1x2). Das Handbuch nennt in 3.5 nur
     Feldfernkabel (Messung) sowie Verbindungs- und Anschlusskabel
     (Sprechprobe); fuer Feldkabel steht dort nichts, es gilt also der
     Ersatzwert. Genau das wird hier geprueft – und darunter die Tabelle
     selbst, damit die Zuordnung nicht unbemerkt verschwinden kann. */
  b.gleich(await bau('bau.pruefung.staemme[0].art'), 'messung',
    'Wo das Handbuch nichts nennt, schlägt die Messung vor');
  const zuordnung = await seite.auswerten(`
    const v = await import('./js/vorschrift.js');
    return { ffk: v.PRUEFART_JE_KABEL.ffk, ak: v.PRUEFART_JE_KABEL.ak,
             vk: v.PRUEFART_JE_KABEL.vk, fk2: v.PRUEFART_JE_KABEL.fk2 || null,
             arten: v.PRUEFARTEN.map(a => a.id).join(',') };`);
  b.gleich(zuordnung.ffk, 'messung', 'Feldfernkabel wird gemessen (3.5)');
  b.gleich(zuordnung.ak, 'sprechprobe', 'Anschlusskabel wird besprochen (3.5)');
  b.gleich(zuordnung.vk, 'sprechprobe', 'Verbindungskabel ebenso (3.5)');
  b.gleich(zuordnung.fk2, null,
    'Für Feldkabel nennt das Handbuch nichts – und hier steht auch nichts');
  b.gleich(zuordnung.arten, 'messung,sprechprobe,uebernahme',
    'Drei Prüfarten, alle drei aus 3.5');

  const ergebnisWahl = '.pz-zeile .pz-felder .feld:nth-child(3) select';
  await seite.waehle(ergebnisWahl, 'nein');
  await seite.ruhe();
  b.gleich(await bau('bau.pruefung.staemme[0].bestanden'), false, 'Nicht bestanden');
  b.pruefe(/nicht bestanden/.test(await seite.text('.bau-uebergabe .bau-warnung') || ''),
    'Die Warnung nennt den Grund, warum nicht übergeben wird');

  await seite.waehle(ergebnisWahl, 'ja');
  await seite.ruhe();
  b.gleich(await bau('bau.pruefung.staemme[0].bestanden'), true, 'Bestanden');
  b.gleich(await seite.anzahl('.bau-uebergabe .bau-warnung'), 0, 'Die Warnung ist weg');

  /* Ein Stamm mit Ergebnis ist die Übernahmemessung selbst – er ging mit
     einem Tipp aufs ✕. Jetzt fragt er nach und nennt das Ergebnis. */
  await seite.auswerten(`document.querySelector('.pz-zeile .pz-abschluss .mini-knopf.gefahr').click(); return true;`);
  await seite.ruhe();
  const stammFrage = await seite.auswerten(
    'return document.getElementById("dialog").hidden ? "" : document.getElementById("dialog-inhalt").textContent');
  b.pruefe(/bestanden/.test(stammFrage),
    `Ein gefüllter Stamm fragt vor dem Löschen und nennt das Ergebnis (${stammFrage.trim() || 'keine Frage'})`);
  await seite.auswerten(`[...document.querySelectorAll('#dialog-fuss button')]
    .find(e => e.textContent.trim() === 'Abbrechen')?.click(); return true;`);
  await seite.ruhe();
  b.gleich(await bau('bau.pruefung.staemme.length'), 1, '„Abbrechen“ lässt ihn stehen');

  b.abschnitt('Die Übergabe wird festgehalten');
  await seite.schreibe('.bu-felder .feld:nth-child(1) input', 'FGr N 2. BA');
  /* Der Zeitpunkt sitzt seit dem Griff „Jetzt“ in einer eigenen Reihe neben
     ihm – gesucht wird deshalb über die Feldart und nicht über die Stelle. */
  await seite.schreibe('.bu-felder input[type="datetime-local"]', '2026-09-15T16:30');
  await seite.warteAuf(
    "window.fbp.store.projekt.strecken[0].bau.pruefung.uebergabeAn === 'FGr N 2. BA'", 3000);
  b.pruefe(await bau("!!bau.pruefung.uebergabeZeit"), 'Zeitpunkt der Übergabe steht');
  const fertig = await seite.auswerten(`
    const m = await import('./js/baudoku.js');
    return m.uebergabestand(window.fbp.store.projekt.strecken[0]).fertig;`);
  b.pruefe(fertig === true,
    'Geprüft UND übergeben – erst beides zusammen ist die Übergabe beendet (3.5)');

  b.abschnitt('Eine übergebene, ungeprüfte Leitung wird gemeldet');
  await taste('.bau-uebergabe', '+ Stamm');
  await seite.ruhe();
  b.pruefe(/noch nicht geprüft/.test(await seite.text('.bau-uebergabe .bau-warnung') || ''),
    'Der zweite, offene Stamm hebt die Übergabe wieder auf');
  await seite.auswerten(`
    const k = [...document.querySelectorAll('.pz-zeile')].pop()
      .querySelector('.mini-knopf.gefahr');
    k.click(); return true;`);
  await seite.ruhe();
  b.gleich(await bau('bau.pruefung.staemme.length'), 1, 'Der zweite Stamm ist wieder weg');

  // ------------------------------------------------------------ Karte im Baumodus

  /* Der zweite Weg zu denselben Eintragungen: nicht über die Liste, sondern
     über die Karte – Bauleiste und Punktkarte aus `js/baukarte.js`. Beides
     schreibt in denselben `bau`-Block; geprüft wird deshalb am Block. */
  const punktkarte = () => seite.auswerten('!document.getElementById("punktkarte").hidden');
  const chipWaehlen = async wert => {
    await seite.auswerten(`
      const c = [...document.querySelectorAll('#punktkarte .pk-chip')]
        .find(x => x.dataset.wert === ${JSON.stringify(wert)});
      if (!c) throw new Error('Chip fehlt: ' + ${JSON.stringify(wert)});
      c.click(); return true;`);
    await seite.ruhe();
  };
  const blattTaste = async text => {
    await seite.auswerten(`
      const k = [...document.querySelectorAll('#punktkarte button')]
        .find(x => x.textContent.includes(${JSON.stringify(text)}));
      if (!k) throw new Error('Taste fehlt auf der Punktkarte: ' + ${JSON.stringify(text)});
      k.click(); return true;`);
    await seite.ruhe();
  };

  /* Der Bauabschnitt nimmt hier nicht auf: die späteren Abschnitte zählen,
     wie viele Punkte einem Trupp zugeordnet sind, und was hier zurückgenommen
     und wieder bestätigt wird, soll dieselbe Zuordnung tragen wie vorher. */
  await seite.klick('.ba-marke.aktiv');
  b.gleich(await seite.anzahl('.ba-marke.aktiv'), 0, 'Kein Bauabschnitt nimmt auf');

  b.abschnitt('Die Bauleiste steht auf der Karte');
  b.pruefe(await seite.sichtbar('#wz-punkt-hier'), '„Punkt hier“ steht in der Werkzeugleiste');
  b.pruefe(await seite.sichtbar('#wz-punkt-karte'), '„Auf Karte“ steht in der Werkzeugleiste');
  b.pruefe(await seite.sichtbar('#wz-standort'), '„Standort“ bleibt');
  b.pruefe(await seite.auswerten('!document.querySelector("#wz-strecke").offsetParent'),
    'Die Planungswerkzeuge bleiben weg');
  b.pruefe(!(await punktkarte()), 'Die Punktkarte ist zu, solange niemand einen Punkt antippt');

  b.abschnitt('Der geplante Punkt wird angetippt, nicht gezogen');
  await seite.auswerten('window.fbp.sl.waehle(window.fbp.store.projekt.strecken[0].id); return true;');
  await seite.ruhe();
  b.gleich(await seite.anzahl('.leaflet-marker-draggable'), 0,
    'Keine Marke ist im Baumodus ziehbar – der Plan bleibt, wie er ist');
  b.gleich(await seite.anzahl('.fbp-einfuegen'), 0, 'Keine Einfügegriffe zwischen den Punkten');

  b.abschnitt('Ein Tipp auf die gebaute Marke schlägt die Punktkarte auf');
  await seite.auswerten('document.querySelector(".fbp-istpunkt").click(); return true;');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden');
  b.pruefe(true, 'Die Punktkarte steht');
  b.pruefe(await seite.anzahl('#punktkarte .pk-chip') >= 7, 'Sieben Arten zur Wahl');
  const artenVorher = await bau('bau.punkte.map(pt => pt.art).join()');
  await chipWaehlen('reserve');
  const artenNachher = await bau('bau.punkte.map(pt => pt.art).join()');
  b.pruefe(artenVorher !== artenNachher &&
           artenNachher.split(',').filter(a => a === 'reserve').length === 1,
    'Genau ein Punkt ist jetzt eine Kabelreserve');
  b.pruefe(await punktkarte(), 'Die Punktkarte bleibt nach der Wahl offen');
  /* Nicht gezählt, sondern gelesen: die Marke des Anfangspunktes trägt schon
     ein A – wird sie zur Reserve, wechselt der Buchstabe, die Zahl bleibt. */
  b.pruefe(await seite.auswerten(
    '[...document.querySelectorAll(".fbp-istpunkt.mit-kurz")].some(m => m.textContent === "R")'),
    'Eine Ist-Marke trägt jetzt das R der Kabelreserve');

  b.abschnitt('Die Querung fragt nach der Bauweise');
  b.gleich(await seite.anzahl('#punktkarte .pk-chip[data-wert="ueberbau"]'), 0,
    'Ohne Querung keine Bauweise zur Wahl');
  await chipWaehlen('querung');
  b.pruefe(await seite.anzahl('#punktkarte .pk-chip[data-wert="ueberbau"]') === 1,
    'An der Querung stehen die Bauweisen');
  await chipWaehlen('ueberbau');
  b.pruefe(await bau('bau.punkte.some(pt => pt.art === "querung" && pt.bauweise === "ueberbau")'),
    'Der Überbau ist am Punkt eingetragen');
  b.pruefe(await seite.auswerten(
    '[...document.querySelectorAll(".fbp-istpunkt.mit-kurz")].some(m => m.textContent === "Ü")'),
    'Die Marke zeigt das Ü der Bauweise');
  await chipWaehlen('punkt');
  b.pruefe(await bau('bau.punkte.every(pt => pt.art === "querung" || pt.bauweise === null)'),
    'Zurück zum Trassenpunkt nimmt die Bauweise mit weg');

  /* Die Bauweise entsteht erst mit der Wahl „Querung“, und zwar unterhalb des
     sichtbaren Ausschnitts: bei 390×690 misst das Blatt 313 px und sein Inhalt
     636. Wer die Frage nicht sieht, beantwortet sie nicht – und die Bauweise
     ist an der Querung die Angabe, um die es geht. Geprüft wird deshalb, dass
     das Blatt hinrollt, nicht nur, dass die Chips im Baum stehen. */
  b.abschnitt('Die Bauweise-Frage kommt ins Bild');
  await chipWaehlen('querung');
  await seite.warteAuf(`
    const b = document.getElementById('punktkarte');
    const f = b.querySelector('.pk-bauweise');
    if (!f) return false;
    const r = f.getBoundingClientRect(), k = b.getBoundingClientRect();
    return r.top >= k.top - 1 && r.bottom <= k.bottom + 1;`, 4000);
  b.pruefe(true, 'Nach der Wahl „Querung“ rollt das Blatt zur Frage „Wie gequert?“');
  b.pruefe(/fehlt noch/.test(await seite.text('#punktkarte .pk-bauweise') || ''),
    'Solange keine Bauweise steht, sagt die Frage das');
  await chipWaehlen('ueberbau');
  b.pruefe(!/fehlt noch/.test(await seite.text('#punktkarte .pk-bauweise') || ''),
    'Mit der Bauweise verschwindet der Zusatz');
  await chipWaehlen('punkt');

  b.abschnitt('Die Bemerkung schreibt, ohne das Blatt zu schließen');
  await seite.schreibe('#punktkarte .pk-bemerkung', 'Wurzelwerk');
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.punkte.some(pt => pt.bemerkung === "Wurzelwerk")', 3000);
  b.pruefe(true, 'Die Bemerkung steht am Punkt');
  b.pruefe(await punktkarte(), 'Das Blatt steht noch – die Eingabe hat es nicht neu aufgebaut');
  await blattTaste('Fertig');
  b.pruefe(!(await punktkarte()), '„Fertig“ schließt es');

  b.abschnitt('Der geplante Punkt: zurücknehmen und wieder bestätigen, alles auf der Karte');
  await seite.auswerten('document.querySelector(".fbp-punkt").click(); return true;');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden');
  b.pruefe(/Punkt 1/.test(await seite.text('#punktkarte .pk-titel') || ''),
    'Das Blatt zeigt Punkt 1');
  await blattTaste('Zurücknehmen');
  b.gleich(await bau('bau.punkte.length'), 3, 'Die Aufnahme ist zurückgenommen');
  b.pruefe(!(await punktkarte()), 'Das Blatt ist zu');
  await seite.auswerten('document.querySelector(".fbp-punkt").click(); return true;');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden');
  b.pruefe(/noch nicht gebaut/.test(await seite.text('#punktkarte') || ''),
    'Der offene Punkt bietet die drei Wege an');
  await blattTaste('Wie geplant');
  b.gleich(await bau('bau.punkte.length'), 4, 'Der Punkt ist wieder bestätigt');
  b.pruefe(await bau('bau.punkte.some(pt => pt.sollPunkt === s.punkte[0].id && pt.quelle === "plan")'),
    'Quelle: aus dem Plan');
  b.pruefe(await seite.anzahl('#punktkarte .pk-chip') >= 7,
    'Das Blatt zeigt jetzt die Aufnahme und fragt, was hier ist');
  await seite.taste('Escape');
  b.pruefe(!(await punktkarte()), 'Esc schließt das Blatt');

  b.abschnitt('„Auf Karte“ aus der Bauleiste');
  await seite.klick('#wz-punkt-karte');
  b.pruefe(await seite.auswerten('!document.querySelector("#zeichen-hinweis").hidden'),
    'Die Modusleiste sagt, dass der nächste Tipp zählt');
  await seite.klickeKarte(700, 560);
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.punkte.length === 5');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden');
  b.pruefe(/Zusätzlicher Punkt/.test(await seite.text('#punktkarte .pk-titel') || ''),
    'Der neue Punkt steht als zusätzlicher auf dem Blatt');
  /* Was der Trupp nicht angetippt hat, steht auch nicht da: vorher trug jeder
     so aufgenommene Punkt „Trassenpunkt“, und wer an der Muffe unterbrochen
     wurde und „Fertig“ drückte, hatte eine Muffe als Trassenpunkt
     dokumentiert – als Aussage des Trupps, nicht als Lücke. */
  /* Der jüngste Punkt und nicht der letzte der Liste: einsortiert wird nach der
     Ordnung der Planung, ein zusätzlicher hängt sich neben seine Nachbarn. */
  const juengster = 'bau.punkte.slice().sort((a, b) => a.zeit < b.zeit ? -1 : 1).pop()';
  b.gleich(await bau(juengster + '.art'), 'offen',
    'Ein auf der Karte gesetzter Punkt kommt ohne Art');
  b.pruefe(/fehlt noch/.test(await seite.text('#punktkarte .pk-frage') || ''),
    'Das Blatt sagt, dass die Art noch fehlt');
  b.gleich(await seite.anzahl('#punktkarte .pk-chip[data-wert="offen"]'), 0,
    '„Art noch offen“ steht nicht als Chip zur Wahl – sie ist keine Antwort');
  await chipWaehlen('muffe');
  b.gleich(await bau(juengster + '.art'), 'muffe', 'Ein Tipp trägt die Art ein');
  await blattTaste('Löschen');
  b.gleich(await bau('bau.punkte.length'), 4, '„Löschen“ nimmt ihn wieder weg');

  b.abschnitt('Das Koordinaten-Popup bietet im Baumodus die Aufnahme an');
  await seite.auswerten(`
    const f = window.fbp; f.sl.auswahl = null; f.zl.auswahl = null; f.fl.auswahl = null;
    f.sl.zeichne(); return true;`);
  await seite.klickeKarte(640, 620);
  await seite.warteAuf('!!document.querySelector(".koord-popup [data-kp=ist]")');
  b.gleich(await seite.anzahl('.koord-popup [data-kp=strecke]'), 0,
    '„Neue Strecke ab hier“ steht im Baumodus nicht da');
  await seite.klick('.koord-popup [data-kp=ist]');
  await seite.warteAuf('window.fbp.store.projekt.strecken[0].bau.punkte.length === 5');
  b.gleich(await bau('bau.punkte.filter(pt => pt.quelle === "karte").length >= 1'), true,
    'Der Punkt kommt von der Karte');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden');
  await blattTaste('Löschen');
  b.gleich(await bau('bau.punkte.length'), 4, 'Wieder vier Punkte');
  /* Zurück zum Stand vor diesem Abschnitt: der Bauabschnitt nimmt wieder auf,
     und genau ein Punkt – der zusätzliche – trägt ihn. Der Anfangspunkt trägt
     wieder seine Art; die Reserve war eine Probe. */
  await seite.klick('.ba-marke');
  b.gleich(await seite.anzahl('.ba-marke.aktiv'), 1, 'Der Bauabschnitt nimmt wieder auf');
  b.gleich(await bau('bau.punkte.filter(pt => pt.abschnitt).length'), 1,
    'Weiterhin trägt genau ein Punkt den Bauabschnitt');

  // ------------------------------------------------------------ Kontext der Aufnahme

  /* Eine zweite Strecke, in der Planung angelegt und umbenannt – zwei Schritte,
     die „↶“ im Baumodus nicht zurücknehmen darf. Sie liegt gut 5 km neben der
     ersten; ihr Punkt 3 steht 22 m hinter Punkt 2, damit es eine Stelle gibt,
     an der zwei offene Punkte in Ortungsnähe liegen. Am Ende des Abschnitts
     wird sie wieder entfernt: die Abschnitte danach zählen Strecken. */
  b.abschnitt('Die in der Planung gewählte Strecke wird die Baustrecke');
  const aktivVorher = await seite.auswerten(
    'return (await import("./js/baudoku.js")).bauabschnittAktivId();');
  await seite.klick('#btn-modus');
  const sued = await seite.auswerten(`
    const st = await import('./js/state.js');
    const f = window.fbp, a = f.store.projekt.strecken[0].punkte[0];
    let sid = null;
    f.store.aendern(p => {
      const s = st.neueStrecke(p);
      s.punkte.push(st.neuerPunkt(a.lat + 0.05, a.lng, 'start'),
        st.neuerPunkt(a.lat + 0.053, a.lng, 'muffe'),
        st.neuerPunkt(a.lat + 0.0532, a.lng, 'ziel'));
      p.strecken.push(s); sid = s.id;
    }, 'strecke');
    f.store.aendern(() => { f.store.strecke(sid).name = 'Strecke Süd'; }, 'strecke');
    f.sl.waehle(sid);
    const s = f.store.strecke(sid);
    return { sid, soll: JSON.stringify(s.punkte), p: s.punkte.map(x => ({ id: x.id, lat: x.lat, lng: x.lng })) };`);
  await seite.klick('#btn-modus');
  const sued2 = ausdruck => seite.auswerten(`
    const s = window.fbp.store.strecke(${JSON.stringify(sued.sid)});
    const bau = s && s.bau;
    return (${ausdruck});`);
  b.gleich(await seite.auswerten('return (await import("./js/baudoku.js")).baustrecke().id'),
    sued.sid, 'Die in der Planung gewählte Strecke ist im Baumodus die Baustrecke');
  b.pruefe(/Strecke Süd/.test(await seite.text('#bau-ziel') || ''),
    'Die Bauleiste nennt die Zielstrecke vor dem ersten Tipp');

  b.abschnitt('„Punkt hier“ neben einem geplanten Punkt schlägt ihn vor');
  /* 8 m neben Punkt 1, und der Ausschnitt steht 5 km daneben: nach der
     Aufnahme muss der Punkt im Bild sein. */
  await seite.standort(sued.p[0].lat + 0.00007, sued.p[0].lng, 6);
  await seite.auswerten(`window.fbp.karte.setView([${sued.p[0].lat - 0.05}, ${sued.p[0].lng}], 16,
    { animate: false }); return true;`);
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden', 10000);
  await seite.ruhe();
  b.gleich(await sued2('bau.punkte[0].sollPunkt'), sued.p[0].id,
    'Der Punkt in Ortungsnähe ist zugeordnet');
  b.gleich(await sued2('bau.punkte[0].art'), 'start', 'Er trägt die Art des Plans');
  b.gleich(await seite.anzahl('#punktkarte .pk-chip-vorschlag[aria-pressed="true"]'), 1,
    'Die Wahl steht gedrückt und als Vorschlag gezeichnet');
  /* „zugeordnet“ und nicht „vorgeschlagen“: Liste und Kopf zählen den Punkt
     im selben Augenblick als bestätigt, und das Kreuz behält die Zuordnung. */
  b.pruefe(/zugeordnet: Punkt 1.*ändern\?/.test(await seite.text('#punktkarte .pk-zuordnung') || ''),
    'Das Blatt nennt sie „zugeordnet: Punkt 1 – ändern?“');
  b.gleich(await seite.auswerten(
    'document.querySelector("#punktkarte .pk-zu").getAttribute("aria-label")'),
    'Schließen – Punkt bleibt', 'Das Kreuz sagt, dass der Punkt bleibt');
  b.gleich(await seite.anzahl('#punktkarte .pk-chip[data-wert=""]'), 1,
    '„zusätzlich“ steht einen Tipp daneben');
  b.pruefe(await seite.auswerten(`
    const s = window.fbp.store.strecke(${JSON.stringify(sued.sid)}), pt = s.bau.punkte[0];
    const k = window.fbp.karte, p = k.latLngToContainerPoint([pt.lat, pt.lng]);
    const r = k.getContainer().getBoundingClientRect();
    const blatt = document.getElementById('punktkarte').getBoundingClientRect();
    return p.x > 0 && p.x < r.width && p.y > 0 && r.top + p.y < blatt.top;`),
    'Der neue Punkt ist ins Bild gerückt, über dem Blatt');
  await chipWaehlen('');
  b.gleich(await sued2('bau.punkte[0].sollPunkt'), null, '„zusätzlich“ löst die Zuordnung');
  b.gleich(await sued2('bau.punkte[0].art'), 'offen', '… und nimmt die Art des Plans mit');
  await chipWaehlen(sued.p[0].id);
  b.gleich(await sued2('bau.punkte[0].art'), 'start',
    'Über die Punktkarte zugeordnet, trägt er die Art des Plans – wie über „◉ Hier“');
  b.gleich(await seite.anzahl('#punktkarte .pk-zuordnung'), 0,
    'Selbst gewählt, steht die Frage nicht mehr da');
  await blattTaste('Fertig');

  b.abschnitt('Ein zweiter Tipp während der Ortung startet keine zweite');
  await seite.standort(sued.p[0].lat + 0.0015, sued.p[0].lng, 6);
  const vorDoppel = await sued2('bau.punkte.length');
  const ortetText = await seite.auswerten(`
    const m = await import('./js/baukarte.js');
    m.punktHierAufnehmen();
    const t = document.getElementById('wz-punkt-hier').textContent;
    m.punktHierAufnehmen();
    return t;`);
  b.pruefe(/ortet/.test(ortetText), 'Der Knopf zeigt „ortet …“, solange die Ortung läuft');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden', 10000);
  await new Promise(r => setTimeout(r, 400));
  b.gleich(await sued2('bau.punkte.length'), vorDoppel + 1, 'Genau ein neuer Punkt');
  b.pruefe(/Punkt hier/.test(await seite.text('#wz-punkt-hier') || ''),
    'Danach heißt der Knopf wieder „Punkt hier“');
  await blattTaste('Fertig');

  b.abschnitt('„Punkt hier“ nimmt eine frische Position');
  /* 60 m weiter, gleich hinterher: mit einer gemerkten Position lag der
     zweite Punkt auf dem ersten. */
  await seite.standort(sued.p[0].lat + 0.00204, sued.p[0].lng, 6);
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf(`window.fbp.store.strecke(${JSON.stringify(sued.sid)}).bau.punkte.length === ${vorDoppel + 2}`, 10000);
  b.pruefe(await sued2(`bau.punkte.some(pt => Math.abs(pt.lat - ${sued.p[0].lat + 0.00204}) < 1e-7)`),
    'Der Punkt liegt auf der neuen Position');
  await blattTaste('Fertig');

  b.abschnitt('Zwei offene Punkte in Ortungsnähe: gefragt, nicht vorgeschlagen');
  await seite.standort((sued.p[1].lat + sued.p[2].lat) / 2, sued.p[1].lng, 6);
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf(`window.fbp.store.strecke(${JSON.stringify(sued.sid)}).bau.punkte.length === ${vorDoppel + 3}`, 10000);
  await seite.warteAuf('!document.getElementById("punktkarte").hidden', 5000);
  b.gleich(await seite.anzahl('#punktkarte .pk-chip-vorschlag'), 0, 'Kein Vorschlag');
  await blattTaste('Fertig');
  b.pruefe(/Zuordnung \(Punkt [23] liegt/.test(
    await seite.auswerten('document.getElementById("hinweisbox").textContent') || ''),
    '„Fertig“ nennt die fehlende Zuordnung');

  b.abschnitt('„ohne Angabe“ führt zum Punkt');
  b.gleich(await seite.anzahl('#bau-summe button.bau-luecke'), 1, 'Die Zahl steht als Griff da');
  await seite.klick('#bau-summe button.bau-luecke');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden', 3000);
  b.pruefe(/fehlt noch/.test(await seite.text('#punktkarte .pk-ist') || ''),
    'Das Blatt des Punktes ohne Art steht offen');
  await seite.taste('Escape');

  b.abschnitt('Ein Standort an einer anderen Strecke wird benannt');
  const ersteVorher = await bau('bau.punkte.length');
  const s1p2 = await seite.auswerten(
    'const pt = window.fbp.store.projekt.strecken[0].punkte[1]; return { lat: pt.lat, lng: pt.lng };');
  await seite.standort(s1p2.lat + 0.00005, s1p2.lng, 6);
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf('!!document.querySelector("#punktkarte .pk-andere")', 10000);
  b.pruefe(!/Stimmt die Ortung/.test(await seite.text('#punktkarte .pk-ist') || ''),
    'Statt „Stimmt die Ortung?“ steht da, an welcher Strecke der Standort liegt');
  await blattTaste('Zu ');
  b.gleich(await bau('bau.punkte.length'), ersteVorher + 1, 'Der Punkt hängt an der ersten Strecke');
  b.gleich(await seite.auswerten('return (await import("./js/baudoku.js")).baustrecke().id'),
    await seite.auswerten('window.fbp.store.projekt.strecken[0].id'),
    'Die Baustrecke wechselt mit');
  b.pruefe(/Strecke 1/.test(await seite.text('#bau-ziel') || ''),
    'Der Merker an der Bauleiste nennt sofort die neue Strecke');
  await seite.klick('#btn-undo');
  b.gleich(await bau('bau.punkte.length'), ersteVorher, '„↶“ hängt ihn wieder ab');
  b.pruefe(/^Umhängen nach „Strecke 1“ zurückgenommen/.test(
    await seite.auswerten('document.getElementById("hinweisbox").textContent') || ''),
    'Die Meldung nennt das Umhängen, nicht „Löschen eines Punktes“');
  b.gleich(await seite.auswerten('return (await import("./js/baudoku.js")).baustrecke().id'),
    sued.sid, '„↶“ stellt auch die Baustrecke zurück');
  b.pruefe(/Strecke Süd/.test(await seite.text('#bau-ziel') || ''),
    '… und der Merker nennt wieder die alte');
  await seite.klick('#btn-redo');
  b.gleich(await seite.auswerten('return (await import("./js/baudoku.js")).baustrecke().id'),
    await seite.auswerten('window.fbp.store.projekt.strecken[0].id'),
    '„↷“ hängt ihn samt Baustrecke wieder um');
  await seite.klick('#btn-undo');
  await seite.taste('Escape');

  b.abschnitt('Umhängen an eine Strecke, die anderen aufgetragen ist, fragt nach');
  /* Die erste Strecke wird dafür einem anderen Trupp aufgetragen – ohne
     Rückgängig-Schritt, damit „↶“ weiter unten an derselben Grenze hält. */
  const umVorher = await seite.auswerten(`
    const st = await import('./js/baudoku.js');
    const f = window.fbp, s = f.store.projekt.strecken[0];
    const vorher = { trupp: s.trupp || '', aktiv: st.bauabschnittAktivId() };
    f.store.aendern(() => { s.trupp = 'Trupp Nord'; }, 'strecke', { undo: false });
    st.bauabschnittAktivSetzen(null);
    return vorher;`);
  await seite.standort(s1p2.lat + 0.00005, s1p2.lng, 6);
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf('!!document.querySelector("#punktkarte .pk-andere")', 10000);
  await blattTaste('Zu ');
  b.gleich(await bau('bau.punkte.length'), ersteVorher, 'Der Tipp hängt noch nicht um');
  b.pruefe(/Trupp Nord/.test(await seite.text('#punktkarte .pk-umhaengen') || ''),
    'Das Blatt nennt, wem die Strecke aufgetragen ist, und fragt');
  const umWahl = await seite.auswerten(`
    const k = document.querySelector('#punktkarte .pk-umhaengen button');
    if (!k) return 'keine Antwort im Blatt';
    const s = window.fbp.store.projekt.strecken[0];
    const a = ((s.bau && s.bau.abschnitte) || []).find(x => k.textContent.includes(x.trupp || x.name));
    k.click();
    return a ? a.id : '';`);
  await seite.ruhe();
  b.gleich(await bau('bau.punkte.length'), ersteVorher + 1, 'Erst die Antwort hängt um');
  if (umWahl) {
    b.pruefe(await bau(`bau.punkte.some(pt => pt.abschnitt === ${JSON.stringify(umWahl)})`),
      'Und der Punkt trägt den gewählten Bauabschnitt');
  }
  await seite.klick('#btn-undo');
  await seite.taste('Escape');
  await seite.auswerten(`
    const st = await import('./js/baudoku.js');
    const f = window.fbp, s = f.store.projekt.strecken[0];
    f.store.aendern(() => { s.trupp = ${JSON.stringify(umVorher.trupp)}; }, 'strecke', { undo: false });
    st.bauabschnittAktivSetzen(${JSON.stringify(umVorher.aktiv)});
    return true;`);
  b.gleich(await bau('bau.punkte.length'), ersteVorher, '„↶“ nimmt auch dieses Umhängen zurück');

  b.abschnitt('Nach dem Neuladen: dieselbe Strecke, und ohne Abschnitt wird gefragt');
  const abschnittSued = await seite.auswerten(`
    const st = await import('./js/baudoku.js');
    const f = window.fbp, s = f.store.strecke(${JSON.stringify(sued.sid)});
    let a = null;
    f.store.aendern(() => { a = st.bauabschnittAnlegen(s); a.trupp = '2. FmTr'; }, 'bau');
    st.baustreckeSetzen(s.id);
    return a.id;`);
  await seite.warteAuf('!document.querySelector("#speicherstatus").classList.contains("offen")', 5000);
  await seite.neuLaden();
  await seite.warteAuf('!!window.fbp');
  b.gleich(await seite.auswerten('return (await import("./js/baudoku.js")).baustrecke().id'),
    sued.sid, 'Die Baustrecke überlebt das Neuladen');
  b.pruefe(/kein Bauabschnitt/.test(await seite.text('#bau-ziel') || ''),
    'Die Bauleiste sagt, dass kein Bauabschnitt gewählt ist');
  await seite.standort(sued.p[0].lat + 0.001, sued.p[0].lng, 6);
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf('!!document.querySelector("#punktkarte .pk-abschnitt")', 10000);
  await chipWaehlen(abschnittSued);
  b.pruefe(await sued2(`bau.punkte.some(pt => pt.abschnitt === ${JSON.stringify(abschnittSued)})`),
    'Ein Tipp in der Punktkarte gibt dem Punkt den Abschnitt');
  b.pruefe(/2\. FmTr/.test(await seite.text('#bau-ziel') || ''),
    'Und die Bauleiste nennt ihn von da an');
  await blattTaste('Fertig');

  b.abschnitt('„✓ wie geplant“ quittiert mit dem Rückweg');
  await seite.auswerten(`
    const z = document.querySelectorAll('.bp-zeile')[1];
    [...z.querySelectorAll('button')].find(x => x.textContent.includes('wie geplant')).click();
    return true;`);
  await seite.ruhe();
  b.pruefe(/↶/.test(await seite.auswerten('document.getElementById("hinweisbox").textContent') || ''),
    'Die Quittung nennt „↶“');
  const bestaetigt = `bau.punkte.some(pt => pt.sollPunkt === ${JSON.stringify(sued.p[1].id)})`;
  b.pruefe(await sued2(bestaetigt), 'Punkt 2 ist bestätigt');
  await seite.klick('#btn-undo');
  b.pruefe(!(await sued2(bestaetigt)), '„↶“ nimmt genau diese Bestätigung zurück');

  b.abschnitt('„↶“ hält im Baumodus an der Grenze zur Planung');
  for (let i = 0; i < 25; i++) await seite.klick('#btn-undo');
  b.gleich(await sued2('JSON.stringify(s.punkte)'), sued.soll,
    'Die geplanten Punkte der Strecke sind unverändert');
  b.gleich(await sued2('s.name'), 'Strecke Süd', 'Die Umbenennung aus der Planung bleibt');
  /* Die Grenze wird benannt, der Weg darüber nicht: „im Planungsmodus
     zurücknehmen“ lud den Trupp in die Planung ein. */
  const grenze = await seite.auswerten('document.getElementById("hinweisbox").textContent') || '';
  b.pruefe(/^Weiter zurück geht es hier nicht – der nächste Schritt gehört zur Planung \(Name von „Strecke Süd“\)/
    .test(grenze), `Die Meldung nennt die Grenze und den Schritt dahinter (${grenze})`);
  b.pruefe(!/Planungsmodus/.test(grenze), 'Und sie schickt nicht in den Planungsmodus');
  b.gleich(await sued2('bau ? bau.punkte.length : 0'), 0,
    'Die Aufnahmen an der Strecke sind zurückgenommen');
  b.gleich(await bau('bau.punkte.length'), ersteVorher,
    'Die Aufnahme der ersten Strecke aus diesem Lauf bleibt – sie liegt vor der Planung');

  b.abschnitt('Der Strecken-Reiter ändert im Baumodus den Plan nicht');
  await seite.klick('.reiter button[data-reiter="strecken"]');
  await seite.auswerten(`window.fbp.sl.waehle(${JSON.stringify(sued.sid)}); return true;`);
  await seite.ruhe();
  const griffe = await seite.auswerten(`
    const karte = [...document.querySelectorAll('#strecken-liste .eintrag')]
      .find(e => e.querySelector('.eintrag-koerper'));
    if (!karte) return 'keine offene Karte';
    const zu = e => !e || getComputedStyle(e).display === 'none' || !e.offsetParent;
    const knopfMit = t => [...karte.querySelectorAll('button')].find(b => b.textContent.includes(t));
    return JSON.stringify({
      weiter: zu(knopfMit('Weiterzeichnen')), umkehren: zu(knopfMit('Richtung umkehren')),
      loeschen: zu(knopfMit('Strecke löschen')), farbe: zu(karte.querySelector('.farbreihe')),
      kachel: zu(karte.querySelector('.leitungswahl')),
      punktWeg: [...karte.querySelectorAll('.pz-weg')].every(zu),
      hinweis: !zu(karte.querySelector('.bau-planhinweis')),
      bauauftrag: !zu(knopfMit('Bauauftrag')) });`);
  b.gleich(griffe, JSON.stringify({ weiter: true, umkehren: true, loeschen: true, farbe: true,
    kachel: true, punktWeg: true, hinweis: true, bauauftrag: true }),
    'Weiterzeichnen, Umkehren, Löschen, Farbe, Leitung und Punkt-✕ sind weg, der Bauauftrag bleibt');
  /* Name, von/nach, Trupp, Bemerkung, Punktart und Punktbezeichnung blieben in
     der vierten Runde Felder. Name und Punktart gehen in die Plan-Nr. ein –
     das zweite Öffnen desselben Links meldete danach „Plan hat sich geändert“.
     Einzig die Wahl des Koordinatenformats bleibt: sie ist Anzeige. */
  const planFelder = await seite.auswerten(`
    const karte = [...document.querySelectorAll('#strecken-liste .eintrag')]
      .find(e => e.querySelector('.eintrag-koerper'));
    return JSON.stringify({
      felder: [...karte.querySelectorAll('input, select, textarea')]
        .filter(e => e.getClientRects().length && !e.closest('.gruppen-kopf'))
        .map(e => (e.closest('label')?.querySelector('.feld-titel')?.textContent || e.className)),
      art: [...karte.querySelectorAll('.pz-lesen')].filter(e => e.getClientRects().length).length,
      punkte: karte.querySelectorAll('.punktzeile').length });`);
  const pf = JSON.parse(planFelder);
  b.gleich(pf.felder.join(', '), '', 'Im Baumodus ist kein Feld des Plans bedienbar');
  b.pruefe(pf.punkte > 0 && pf.art >= pf.punkte,
    `Die Punktart steht dort als Text (${pf.art} von ${pf.punkte} Zeilen)`);
  await seite.klick('#strecken-liste .koord-knopf');
  await seite.warteAuf('!document.getElementById("dialog").hidden');
  b.gleich(await seite.anzahl('#kd-neu'), 0, 'Die Koordinate eines Punktes ist nur abzulesen');
  await seite.taste('Escape');

  /* Aufräumen: die zweite Strecke geht, die erste wird wieder Baustrecke, und
     ihr Abschnitt nimmt wieder auf – wie vor diesem Abschnitt. */
  await seite.klick('#btn-modus');
  await seite.auswerten(`
    const st = await import('./js/baudoku.js');
    const f = window.fbp;
    f.store.aendern(p => {
      p.strecken = p.strecken.filter(s => s.id !== ${JSON.stringify(sued.sid)});
    }, 'strecke');
    f.sl.waehle(null);
    st.baustreckeSetzen(f.store.projekt.strecken[0].id);
    return true;`);
  await seite.auswerten(`(await import('./js/baudoku.js')).bauabschnittAktivSetzen(
    ${JSON.stringify(aktivVorher)}); return true;`);
  await seite.klick('#btn-modus');
  b.gleich(await seite.anzahl('.ba-marke.aktiv'), 1, 'Der Bauabschnitt der ersten Strecke nimmt wieder auf');

  // ------------------------------------------------------------ Schmalansicht

  b.abschnitt('Schmalansicht mit Berührung');
  await seite.schmal(390, 844);
  await seite.warteAuf('true');
  b.pruefe(await seite.sichtbar('#ansicht-wechsel'), 'Der Umschalter Liste/Karte steht');
  b.pruefe(await seite.sichtbar('#btn-modus'), 'Der Moduswechsel bleibt erreichbar');
  const reiterBreite = await seite.auswerten(`
    const r = document.querySelector('.reiter');
    return r.scrollWidth <= r.clientWidth + 1;`);
  b.pruefe(reiterBreite, 'Die Reiterreihe passt ins Fenster, ohne waagerecht zu rollen');
  b.pruefe(await seite.auswerten(`
    const k = [...document.querySelectorAll('.bp-zeile .knopf.bau-taste')];
    return k.length === 0 || k.every(x => x.getBoundingClientRect().height >= 44);`),
    'Die Griffe sind mindestens 44 px hoch');
  b.pruefe(await seite.auswerten('document.documentElement.scrollWidth <= window.innerWidth + 1'),
    'Die Seite rollt nicht waagerecht');
  /* Jedes Raster einzeln, nicht nur die Seite als ganze: ein Raster, das aus
     dem Fenster läuft, bekommt oft eine eigene Rollleiste, und die Seite
     darüber bleibt dann ruhig. Genau so fällt am Bauort die rechte Spalte
     eines Feldes unter den Daumen.

     Acht Bildpunkte Spielraum, und zwar aus einem bestimmten Grund: bei
     Bedienung mit dem Finger erweitert `.mini-knopf` seine Trefferfläche über
     ein `::after` mit `inset: -4px` nach allen Seiten. Das steht absichtlich
     über dem Rand des Knopfes und ist kein Überlauf des Rasters. Ein
     Schwellenwert von einem Bildpunkt meldete deshalb jede Zeile mit einem
     Löschgriff. */
  const ueberbreit = await seite.auswerten(`
    return [...document.querySelectorAll('#bau-liste .feldgruppe, #bau-liste [class*="raster"], ' +
      '#bau-liste .ba-felder, #bau-liste .bp-felder, #bau-liste .pz-felder, ' +
      '#bau-liste .bu-felder, #bau-liste .mat-freizeile, #bau-liste .bm-zeile')]
      .filter(e => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 8)
      .map(e => e.className + ' (' + e.scrollWidth + '/' + e.clientWidth + ')').join(' | ');`);
  b.gleich(ueberbreit, '', 'Kein Feldraster im Baumodus läuft aus dem Fenster');

  b.abschnitt('Zwei schnelle Tipps auf „Punkt hier“ lassen das Blatt offen');
  /* Echte Fingertipps und nicht `click()`: bei schneller Ortung schlug das
     Blatt dort auf, wo „Punkt hier“ stand, und der zweite Tipp eines
     Doppeltipps traf „Fertig“. 150 ms ist ein Doppeltipp mit Handschuh. */
  await seite.auswerten('document.getElementById("aw-karte").click(); return true;');
  await new Promise(r => setTimeout(r, 450));
  const vorTipps = await bau('bau.punkte.length');
  const ph = await seite.auswerten(`
    const r = document.getElementById('wz-punkt-hier').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };`);
  await seite.tippe(ph.x, ph.y);
  await new Promise(r => setTimeout(r, 150));
  await seite.tippe(ph.x, ph.y);
  await seite.warteAuf('!document.getElementById("punktkarte").hidden', 10000);
  await new Promise(r => setTimeout(r, 500));
  b.pruefe(await punktkarte(), 'Das Blatt steht nach dem zweiten Tipp offen');
  b.gleich(await bau('bau.punkte.length'), vorTipps + 1, 'Und es ist genau ein Punkt entstanden');
  await blattTaste('Löschen');

  // ------------------------------------------------------------ Doppeltipps mit dem Finger

  /* Alles hier mit echten Fingertipps (`seite.tippe`): die Sperren gelten nur
     dem, was ein Finger auslöst, und ein `click()` aus der Prüfung ginge
     durch jede von ihnen hindurch. */
  const warte = ms => new Promise(r => setTimeout(r, ms));
  const mitte = wahl => seite.auswerten(`
    const e = ${wahl};
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };`);

  b.abschnitt('Ein Doppeltipp auf „Fertig“ trifft nicht die Bauleiste darunter');
  const vorFertig = await bau('bau.punkte.length');
  const idsVorFertig = await bau('JSON.stringify(bau.punkte.map(pt => pt.id))');
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden', 10000);
  await warte(500);
  /* Wo der zweite Tipp landet, hängt an der Fenstergröße: bei 360×740 lag
     unter „Fertig“ „Punkt hier“, bei 390×844 knapp darüber. Hier trifft er
     „Punkt hier“ selbst – der Griff, der den Phantompunkt anlegte. */
  const fertigOrt = await mitte(`document.querySelector('#punktkarte .pk-abschluss button')`);
  await seite.tippe(fertigOrt.x, fertigOrt.y);
  const hierOrt = await mitte(`document.getElementById('wz-punkt-hier')`);
  b.pruefe(!!hierOrt && hierOrt.x > 0, 'Nach dem Schließen steht „Punkt hier“ wieder da');
  await seite.tippe(hierOrt.x, hierOrt.y);
  await warte(600);
  b.gleich(await bau('bau.punkte.length'), vorFertig + 1, 'Der zweite Tipp legt keinen zweiten Punkt an');
  b.pruefe(!(await punktkarte()), 'Das Blatt bleibt zu');
  const karteOrt = await mitte(`document.getElementById('wz-punkt-karte')`);
  await seite.tippe(hierOrt.x, hierOrt.y);
  await seite.warteAuf('!document.getElementById("punktkarte").hidden', 10000);
  b.gleich(await bau('bau.punkte.length'), vorFertig + 2, 'Nach der Frist nimmt „Punkt hier“ wieder an');
  await warte(500);
  const fertig2 = await mitte(`document.querySelector('#punktkarte .pk-abschluss button')`);
  await seite.tippe(fertig2.x, fertig2.y);
  await seite.tippe(karteOrt.x, karteOrt.y);
  await warte(300);
  b.pruefe(await seite.auswerten('!window.fbp.sl.istSetzModus'),
    'Auch „Auf Karte“ startet nach „Fertig“ nicht still den Setzmodus');
  await warte(300);
  await seite.tippe(karteOrt.x, karteOrt.y);
  await warte(200);
  b.pruefe(await seite.auswerten('!!window.fbp.sl.istSetzModus'), '… und danach wieder an');
  await seite.auswerten(`document.querySelector('#zeichen-hinweis [data-akt=abbruch]').click(); return true;`);
  await warte(200);
  /* Aufräumen: die zwei Punkte dieses Abschnitts gehen wieder. */
  await seite.auswerten(`const f = window.fbp, s = f.store.projekt.strecken[0];
    const ids = new Set(${idsVorFertig});
    f.store.aendern(() => { s.bau.punkte = s.bau.punkte.filter(pt => ids.has(pt.id)); }, 'bau');
    return true;`);
  await seite.warteAuf(`window.fbp.store.projekt.strecken[0].bau.punkte.length === ${vorFertig + 0}`, 3000);

  b.abschnitt('Ein zweiter „Punkt hier“ an derselben Stelle heißt „eben schon aufgenommen“');
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf(`window.fbp.store.projekt.strecken[0].bau.punkte.length === ${vorFertig + 1}`, 10000);
  await seite.warteAuf('!document.getElementById("punktkarte").hidden', 5000);
  await blattTaste('Fertig');
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf(`window.fbp.store.projekt.strecken[0].bau.punkte.length === ${vorFertig + 2}`, 10000);
  await seite.warteAuf('!document.getElementById("punktkarte").hidden', 5000);
  const zwilling = await seite.text('#punktkarte .pk-ist') || '';
  b.pruefe(/Eben schon aufgenommen \((Punkt \d+|zusätzlicher Punkt), vor \d+ s\)/.test(zwilling),
    'Das Blatt nennt den Punkt, der eben schon aufgenommen wurde, samt Sekunden');
  b.pruefe(!/Stimmt die Ortung/.test(zwilling), 'und verdächtigt nicht die Ortung');
  await blattTaste('Diesen wieder löschen');
  b.gleich(await bau('bau.punkte.length'), vorFertig + 1, '„Diesen wieder löschen“ nimmt den doppelten weg');
  b.pruefe(await punktkarte(), 'und das Blatt zeigt den ersten');

  b.abschnitt('Ein Kartentipp gleich nach dem Aufschlagen schließt das Blatt nicht');
  /* Quer und auf dem Tablet steht das Blatt seitlich, und der zweite Tipp
     eines Doppeltipps auf „Punkt hier“ traf die Karte daneben. Hier wird das
     Blatt aus dem Programm aufgeschlagen und gleich danach neben ihm getippt. */
  await blattTaste('Fertig');
  const nebenBlatt = await seite.auswerten(`
    const m = await import('./js/baukarte.js');
    const s = window.fbp.store.projekt.strecken[0];
    m.punktkarteOeffnen(s, { ist: s.bau.punkte[0] });
    /* Die Oberkante aus dem Satz und nicht aus dem Rechteck: das Blatt läuft
       gerade von unten ein, und sein Rechteck steht noch tiefer. */
    const pk = document.getElementById('punktkarte');
    const oben = pk.offsetParent.getBoundingClientRect().top + pk.offsetTop;
    for (let y = oben - 10; y > 0; y -= 6) {
      for (let x = 30; x < innerWidth - 30; x += 15) {
        const e = document.elementFromPoint(x, y);
        if (e && (e.classList.contains('leaflet-tile') || e.id === 'karte' ||
            e.classList.contains('leaflet-tile-container'))) return { x, y };
      }
    }
    return null;`);
  b.pruefe(!!nebenBlatt, `Über dem Blatt liegt freie Karte (${JSON.stringify(nebenBlatt)})`);
  if (nebenBlatt) {
    await seite.tippe(nebenBlatt.x, nebenBlatt.y);
    await warte(100);
    b.pruefe(await punktkarte(), 'Der Tipp in den ersten Augenblicken lässt das Blatt offen');
    await warte(450);
    await seite.tippe(nebenBlatt.x, nebenBlatt.y);
    await warte(150);
    b.pruefe(!(await punktkarte()), 'Danach schließt ein Kartentipp es wie bisher');
  }
  b.pruefe(await seite.auswerten(`const h = document.getElementById('hinweisbox');
    return h.hidden || !/ermittelt/.test(h.textContent) || h.classList.contains('geht');`),
    '„Position wird ermittelt …“ steht nach der Aufnahme nicht mehr');
  /* Aufräumen: die Fälle weiter unten zählen die Punkte der ersten Strecke. */
  await seite.auswerten(`const f = window.fbp, s = f.store.projekt.strecken[0];
    const ids = new Set(${idsVorFertig});
    f.store.aendern(() => { s.bau.punkte = s.bau.punkte.filter(pt => ids.has(pt.id)); }, 'bau');
    return true;`);

  b.abschnitt('Ein Dialog nimmt im ersten Augenblick keinen Fingertipp auf seine Fußknöpfe an');
  /* Die Löschrückfrage schlug dort auf, wo eben das ✕ stand, und ein
     Doppeltipp auf das Kreuz bestätigte sie. */
  await seite.auswerten(`
    const ui = await import('./js/ui.js');
    window._probeGeloescht = 0;
    ui.dialog({ titel: 'Probe löschen?', inhalt: '<p>Probe</p>',
      fuss: [{ text: 'Abbrechen' }, { text: 'Löschen', gefahr: true,
               tun: () => { window._probeGeloescht++; } }] });
    return true;`);
  const loeschOrt = await mitte(`document.querySelector('#dialog-fuss .knopf.gefahr')`);
  await seite.tippe(loeschOrt.x, loeschOrt.y);
  b.pruefe(await seite.auswerten('!document.getElementById("dialog").hidden && window._probeGeloescht === 0'),
    'Ein Tipp gleich nach dem Öffnen bestätigt nicht');
  await warte(450);
  await seite.tippe(loeschOrt.x, loeschOrt.y);
  b.pruefe(await seite.auswerten('document.getElementById("dialog").hidden && window._probeGeloescht === 1'),
    'Danach wirkt der Knopf wie gewohnt');

  b.abschnitt('Ein Doppeltipp auf „✓ wie geplant“ bestätigt genau einen Punkt');
  /* Die Liste rollt nach der Bestätigung den nächsten offenen Punkt unter den
     Finger. Für diesen Abschnitt sind die drei geplanten Punkte offen; was
     vorher dastand, kommt danach zurück – beides ohne Rückgängig-Schritt. */
  const bauGemerkt = await bau('JSON.stringify(bau)');
  await seite.auswerten(`const f = window.fbp, s = f.store.projekt.strecken[0];
    f.store.aendern(() => { s.bau.punkte = []; }, 'bau', { undo: false }); return true;`);
  await seite.auswerten('document.getElementById("aw-liste").click(); return true;');
  await seite.klick('.reiter button[data-reiter="bau"]');
  await warte(400);
  const wieGeplant = `[...document.querySelectorAll('#bau-liste .bp-zeile:not(.bestaetigt) button')]
    .find(x => x.textContent.includes('wie geplant'))`;
  await seite.auswerten(`${wieGeplant}.scrollIntoView({ block: 'center' }); return true;`);
  await warte(300);
  const wgOrt = await mitte(wieGeplant);
  await seite.tippe(wgOrt.x, wgOrt.y);
  await warte(150);
  await seite.tippe(wgOrt.x, wgOrt.y);
  await warte(500);
  b.gleich(await bau('bau.punkte.filter(pt => pt.sollPunkt).length'), 1,
    'Der zweite Tipp bestätigt nicht den nächsten Punkt');
  /* Und wenn doch zwei kurz hintereinander kommen – aus dem Programm, also an
     der Sperre vorbei –, nennt die Pille beide. */
  await seite.auswerten(`${wieGeplant}.click(); return true;`);
  b.pruefe(/^Punkte \d+ und \d+ bestätigt/.test(
    await seite.auswerten('document.getElementById("hinweisbox").textContent') || ''),
    'Zwei Bestätigungen kurz hintereinander nennt die Pille beide');

  b.abschnitt('Eine späte Ortung reißt nicht aus dem, was inzwischen getan wird');
  /* Die Ortung des Geräts wird hier verzögert nachgestellt: sie antwortet
     erst nach 900 ms, und dazwischen geschieht etwas anderes. */
  const ortungVerzoegern = (ms, lat, lng) => seite.auswerten(`
    navigator.geolocation.getCurrentPosition = (ok) => setTimeout(() => ok({
      coords: { latitude: ${lat}, longitude: ${lng}, accuracy: 6 } }), ${ms});
    return true;`);
  const offenerPunkt = await seite.auswerten(`const s = window.fbp.store.projekt.strecken[0];
    const belegt = new Set(s.bau.punkte.map(pt => pt.sollPunkt));
    const pt = s.punkte.find(x => !belegt.has(x.id));
    return { id: pt.id, lat: pt.lat, lng: pt.lng };`);
  await ortungVerzoegern(900, offenerPunkt.lat + 0.0003, offenerPunkt.lng);
  await seite.auswerten('document.getElementById("aw-karte").click(); return true;');
  await warte(400);
  const vorSpaet = await bau('bau.punkte.length');
  await seite.klick('#wz-punkt-hier');
  await seite.auswerten('document.getElementById("aw-liste").click(); return true;');
  await seite.warteAuf(`window.fbp.store.projekt.strecken[0].bau.punkte.length === ${vorSpaet + 1}`, 5000);
  await warte(200);
  b.pruefe(await seite.auswerten('!document.body.classList.contains("seite-zu")'),
    'Wer inzwischen in die Liste gewechselt hat, bleibt dort');
  b.pruefe(!(await punktkarte()), 'Es schlägt kein Blatt auf');
  b.pruefe(/aufgenommen/.test(await seite.auswerten('document.getElementById("hinweisbox").textContent') || ''),
    'Die Pille sagt still, dass der Punkt steht');
  await seite.auswerten(`const f = window.fbp, s = f.store.projekt.strecken[0];
    f.store.aendern(() => { s.bau.punkte = s.bau.punkte.filter(pt => pt.quelle !== 'standort'); },
      'bau', { undo: false });
    return true;`);
  /* „◉ Hier“ im Blatt des geplanten Punktes, und gleich danach „✓ Wie
     geplant“: die spätere ausdrückliche Wahl gilt. */
  await seite.auswerten('document.getElementById("aw-karte").click(); return true;');
  await warte(400);
  await seite.auswerten(`const m = await import('./js/baukarte.js');
    const s = window.fbp.store.projekt.strecken[0];
    m.punktkarteOeffnen(s, { soll: s.punkte.find(x => x.id === ${JSON.stringify(offenerPunkt.id)}) });
    return true;`);
  await blattTaste('◉ Hier');
  b.pruefe(/ortet/.test(await seite.text('#punktkarte .pk-tasten') || ''),
    '„◉ Hier“ im Blatt zeigt „ortet …“, solange die Ortung läuft');
  await blattTaste('Wie geplant');
  await warte(1100);
  b.gleich(await bau(`(bau.punkte.find(pt => pt.sollPunkt === ${JSON.stringify(offenerPunkt.id)}) || {}).quelle`),
    'plan', 'Die Bestätigung bleibt – die späte Ortung überschreibt sie nicht');
  b.pruefe(/verworfen/.test(await seite.auswerten('document.getElementById("hinweisbox").textContent') || ''),
    'und die Pille sagt, dass die Ortung verworfen wurde');
  await seite.auswerten('delete navigator.geolocation.getCurrentPosition; return true;');
  await seite.taste('Escape');
  await seite.auswerten(`const f = window.fbp, s = f.store.projekt.strecken[0];
    f.store.aendern(() => { s.bau = JSON.parse(${JSON.stringify(bauGemerkt)}); }, 'bau', { undo: false });
    return true;`);

  b.abschnitt('Ein Fehlschlag der Ortung: das Blatt spricht, die Pille schweigt');
  await seite.auswerten(`navigator.geolocation.getCurrentPosition = (ok, fehler) =>
    setTimeout(() => fehler({ code: 2 }), 50); return true;`);
  await seite.klick('#wz-punkt-hier');
  await seite.warteAuf('!!document.querySelector("#punktkarte .pk-fehler")', 5000);
  await warte(250);
  b.pruefe(await seite.auswerten(`const h = document.getElementById('hinweisbox');
    return h.hidden || !h.classList.contains('fehler');`),
    'Keine rote Pille über den Auswegen des Fehlerblatts');
  await seite.auswerten('history.back(); return true;');
  await warte(400);
  b.pruefe(await seite.auswerten('!!window.fbp && !document.querySelector("#punktkarte .pk-fehler")'),
    '„Zurück“ schließt das Fehlerblatt und bleibt in der Anwendung');
  await seite.auswerten('delete navigator.geolocation.getCurrentPosition; return true;');

  b.abschnitt('„Zurück“ beendet den Setzmodus „Auf Karte“');
  await seite.klick('#wz-punkt-karte');
  b.pruefe(await seite.auswerten('!!window.fbp.sl.istSetzModus'), '„Auf Karte“ wartet auf den Tipp');
  await seite.auswerten('history.back(); return true;');
  await warte(400);
  b.pruefe(await seite.auswerten('!!window.fbp && !window.fbp.sl.istSetzModus'),
    '„Zurück“ beendet das Setzen und bleibt in der Anwendung');

  b.abschnitt('Ein Neuladen mitten in der Ortung hinterlässt einen Hinweis');
  await seite.auswerten('navigator.geolocation.getCurrentPosition = () => {}; return true;');
  await seite.klick('#wz-punkt-hier');
  b.pruefe(/ortet/.test(await seite.text('#wz-punkt-hier') || ''), 'Die Ortung läuft');
  await seite.warteAuf('!document.querySelector("#speicherstatus").classList.contains("offen")', 5000);
  await seite.neuLaden();
  await seite.warteAuf('!!window.fbp');
  await seite.warteAuf(
    '/Aufnahme von \\d\\d:\\d\\d wurde unterbrochen/.test(document.getElementById("hinweisbox").textContent)',
    4000);
  b.pruefe(true, 'Nach dem Neustart steht einmal, dass die Aufnahme unterbrochen wurde');
  /* Der Start nach dem Neuladen bleibt in der Liste; die Fälle danach
     beginnen auf der Karte. */
  await seite.auswerten('document.getElementById("aw-karte").click(); return true;');
  await warte(400);

  b.abschnitt('Der Setzmodus endet, wenn die Karte der Liste weicht');
  await seite.klick('#wz-punkt-karte');
  b.pruefe(await seite.auswerten('!!window.fbp.sl.istSetzModus'), '„Auf Karte“ wartet auf den Tipp');
  await seite.auswerten('document.getElementById("aw-liste").click(); return true;');
  await new Promise(r => setTimeout(r, 300));
  b.pruefe(await seite.auswerten('!window.fbp.sl.istSetzModus'),
    'In der Liste wartet kein Kartentipp mehr');
  b.pruefe(await seite.auswerten('document.getElementById("hinweisbox").hidden'),
    'Die Pille „Auf die Karte tippen …“ steht nicht über der Liste');
  await seite.breit(1440, 900);

  // ------------------------------------------------------------ Zurück in die Planung

  b.abschnitt('Zurück in den Planungsmodus');
  await seite.klick('#btn-modus');
  b.pruefe(!(await seite.auswerten('document.body.classList.contains("baumodus")')),
    'Die Modusklasse ist weg');
  b.pruefe(await seite.sichtbar('#wz-strecke'), 'Das Streckenwerkzeug ist wieder da');
  b.pruefe(await seite.auswerten('!document.querySelector("#wz-punkt-hier").offsetParent'),
    'Die Bauleiste ist weg');
  await seite.auswerten('window.fbp.sl.waehle(window.fbp.store.projekt.strecken[0].id); return true;');
  await seite.ruhe();
  b.pruefe(await seite.anzahl('.fbp-einfuegen') >= 1,
    'Die Einfügegriffe sind in der Planung wieder da');
  /* Die Auswahl wieder lösen: die Streckenkarte in der Liste ist offen, solange
     die Strecke gewählt ist, und der nächste Abschnitt klappt sie selbst auf. */
  await seite.auswerten('window.fbp.sl.waehle(null); return true;');
  await seite.ruhe();
  b.pruefe(await seite.anzahl('.bau-zeile') >= 1,
    'Die Streckenliste meldet, dass an dieser Strecke gebaut wird');

  b.abschnitt('Das Soll bleibt unangetastet');
  b.gleich(await seite.auswerten('window.fbp.store.projekt.strecken[0].punkte.length'), 3,
    'Die geplante Trasse hat weiter drei Punkte');

  // ------------------------------------------------------------ Duplizieren

  b.abschnitt('Duplizieren lässt die Aufnahme beim Original');
  await seite.klick('.eintrag .eintrag-name');
  await seite.ruhe();
  await taste('.eintrag', 'Duplizieren');
  b.gleich(await seite.auswerten('window.fbp.store.projekt.strecken.length'), 2,
    'Zwei Strecken');
  b.gleich(await seite.auswerten('window.fbp.store.projekt.strecken[1].bau'), null,
    'Die Kopie trägt keine Baudokumentation');
  b.gleich(await bau('bau.punkte.length'), 4, 'Das Original behält seine');

  // ------------------------------------------------------------ Punkt löschen

  b.abschnitt('Ein gelöschter Trassenpunkt lässt keinen toten Verweis zurück');
  const vorher = await bau('bau.punkte.filter(pt => pt.sollPunkt).length');
  await seite.auswerten(`
    const s = window.fbp.store.projekt.strecken[0];
    const pid = s.punkte[1].id;
    window.fbp.store.aendern(() => {
      s.punkte = s.punkte.filter(x => x.id !== pid);
      s.bau.punkte.forEach(pt => { if (pt.sollPunkt === pid) pt.sollPunkt = null; });
    }, 'strecke');
    return true;`);
  await seite.ruhe();
  b.gleich(await bau('bau.punkte.filter(pt => pt.sollPunkt).length'), vorher - 1,
    'Der Verweis auf den gelöschten Punkt ist gelöst');
  b.gleich(await bau('bau.punkte.length'), 4,
    'Der am Bauort aufgenommene Punkt bleibt stehen');

  // ------------------------------------------------------------ Der Weg zurück

  b.abschnitt('Die Baudokumentation reist im Link mit');
  const rund = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const p = window.fbp.store.projekt;
    const link = await t.alsLink(p);
    const roh = await t.planungAusFragment('#' + link.split('#')[1]);
    const st = await import('./js/state.js');
    const zurueck = st.migrieren(roh);
    const a = p.strecken[0], z = zurueck.strecken[0];
    return {
      laenge: link.length,
      istPunkte: z.bau ? z.bau.punkte.length : 0,
      abschnitte: z.bau ? z.bau.abschnitte.length : 0,
      quellen: z.bau ? z.bau.punkte.map(pt => pt.quelle).join(',') : '',
      quellenVorher: a.bau.punkte.map(pt => pt.quelle).join(','),
      verweiseHeil: z.bau ? z.bau.punkte.every(pt =>
        pt.sollPunkt === null || z.punkte.some(q => q.id === pt.sollPunkt)) : false,
      zuordnungGleich:
        a.bau.punkte.map(pt => a.punkte.findIndex(q => q.id === pt.sollPunkt)).join(',') ===
        z.bau.punkte.map(pt => z.punkte.findIndex(q => q.id === pt.sollPunkt)).join(','),
      abschnittZuordnung: z.bau.punkte.filter(pt => pt.abschnitt).length,
      stand: z.bau ? z.bau.stand : null,
      material: (z.bau.material || []).map(m => m.artikel + ':' + m.menge).join(','),
      materialVorher: (a.bau.material || []).map(m => m.artikel + ':' + m.menge).join(','),
      materialAmAbschnitt: (z.bau.material || [])
        .filter(m => m.abschnitt && z.bau.abschnitte.some(x => x.id === m.abschnitt)).length,
      freieBemerkung: (z.bau.material || [])
        .filter(m => m.artikel === 'sonstiges').map(m => m.bemerkung).join('|'),
      meldungen: (z.bau.meldungen || []).length,
      meldungstext: (z.bau.meldungen || []).map(m => m.text).join('|'),
      meldungszeit: (z.bau.meldungen || []).map(m => m.zeit).join('|'),
      meldungszeitVorher: (a.bau.meldungen || []).map(m => m.zeit).join('|'),
      pruefarten: (z.bau.pruefung ? z.bau.pruefung.staemme : []).map(x => x.art).join(','),
      pruefartenVorher: (a.bau.pruefung ? a.bau.pruefung.staemme : []).map(x => x.art).join(','),
      bestanden: (z.bau.pruefung ? z.bau.pruefung.staemme : []).map(x => x.bestanden).join(','),
      uebergabeAn: z.bau.pruefung ? z.bau.pruefung.uebergabeAn : null
    };`);
  b.gleich(rund.istPunkte, 4, 'Alle vier Ist-Punkte kommen an');
  b.gleich(rund.abschnitte, 1, 'Der Bauabschnitt kommt an');
  b.gleich(rund.quellen, rund.quellenVorher, 'Die Herkunft jeder Koordinate bleibt erhalten');
  b.pruefe(rund.verweiseHeil, 'Jeder Verweis zeigt beim Empfänger auf einen echten Punkt');
  b.pruefe(rund.zuordnungGleich, 'Jeder Ist-Punkt bestätigt denselben geplanten wie vorher');
  b.gleich(rund.abschnittZuordnung, 1, 'Die Zuordnung zum Bauabschnitt bleibt');
  b.gleich(rund.stand, 'laeuft', 'Der Baustand reist mit');
  b.gleich(rund.material, rund.materialVorher, 'Jede Materialzeile kommt mit ihrer Menge an');
  /* Beide Zeilen – die Kabelzeile und die freie – sind bei aktivem Abschnitt
     eingetragen worden und müssen deshalb auch beim Empfänger an ihm hängen. */
  b.gleich(rund.materialAmAbschnitt, 2,
    'Und hängt beim Empfänger wieder am richtigen Bauabschnitt');
  b.gleich(rund.freieBemerkung, 'Kabelbrücke, geliehen',
    'Die freie Zeile behält ihre Bezeichnung');
  b.gleich(rund.meldungen, 1, 'Die Baumeldung reist mit');
  b.gleich(rund.meldungstext, 'Erste Länge verbaut, Trasse frei', 'Samt ihrem Text');
  b.gleich(rund.meldungszeit, rund.meldungszeitVorher,
    'Und samt ihrer Uhrzeit – ohne sie wäre die Zeitschiene wertlos');
  b.gleich(rund.pruefarten, rund.pruefartenVorher,
    'Die Prüfart bleibt, was sie war – nicht jede Sprechprobe wird zur Messung');
  b.gleich(rund.bestanden, 'true', 'Das Ergebnis der Prüfung reist mit');
  b.gleich(rund.uebergabeAn, 'FGr N 2. BA', 'Und die Übergabe');
  b.pruefe(rund.laenge < 8000,
    `Der Link bleibt unter der Grenze für Mailprogramme (${rund.laenge} Zeichen)`);

  b.abschnitt('Und über die Datei');
  const ueberDatei = await seite.auswerten(`
    const st = await import('./js/state.js');
    const p = window.fbp.store.projekt;
    const kopie = st.migrieren(JSON.parse(JSON.stringify(p)));
    return kopie.strecken[0].bau ? kopie.strecken[0].bau.punkte.length : 0;`);
  b.gleich(ueberDatei, 4, 'Die Sicherungsdatei trägt die Aufnahme');

  b.abschnitt('Die Plan-Kennung ist beim Trupp dieselbe wie beim Planer');
  /* Der Link trägt sechs Nachkommastellen. 51,80375474 kommt als 51,803755 an,
     und auf fünf Stellen gerundet gab das beim Trupp 51,80376, beim Planer
     51,80375 – derselbe Plan mit zwei Kennungen. Geprüft an einer Abschrift,
     die Planung selbst bleibt unberührt. */
  const kennungen = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const st = await import('./js/state.js');
    const kopie = JSON.parse(JSON.stringify(window.fbp.store.projekt));
    kopie.strecken[0].punkte[0].lat = 51.80375474;
    kopie.strecken[0].punkte[0].lng = 10.61234549;
    const link = await t.alsLink(kopie);
    const zurueck = st.migrieren(await t.planungAusFragment('#' + link.split('#')[1]));
    const angekommen = zurueck.strecken[0].punkte[0];
    return { planer: st.planKennung([kopie.strecken[0]]), trupp: st.planKennung([zurueck.strecken[0]]),
             kippt: (51.80375474).toFixed(5) !== angekommen.lat.toFixed(5) };`);
  b.pruefe(kennungen.kippt, 'Die Koordinate kippt beim Runden auf sechs Stellen über die Grenze');
  b.gleich(kennungen.trupp, kennungen.planer,
    `Trotzdem tragen Planer und Trupp dieselbe Kennung (${kennungen.planer})`);

  /* Im Audit legte ein zweites Öffnen desselben Bauauftrags still eine leere
     Kopie an: „Bau beginnen“ öffnete „0 von 4 bestätigt“, und unter
     „Gespeicherte Planungen“ standen zwei gleiche Einträge. */
  b.abschnitt('Ein zweites Mal geöffneter Bauauftrag führt zur vorhandenen Aufnahme');
  const fussText = () => seite.auswerten(`return [...document.querySelectorAll('#dialog-fuss .knopf')]
    .map(k => (k.classList.contains('primaer') ? '*' : '') + k.textContent).join('|')`);
  const auftrag = await seite.auswerten(`
    const io = await import('./js/io.js');
    const t = await import('./js/teilen.js');
    const p = window.fbp.store.projekt;
    return { link: await t.alsLink(io.streckeAlsProjekt(p.strecken[0].id)), planer: p.id,
             zahl: Object.keys(JSON.parse(localStorage.getItem('fbp.projekte.v1'))).length };`);
  await seite.auswerten(`location.hash = ${JSON.stringify(auftrag.link.split('#')[1])}; return true;`);
  await seite.warteAuf('document.getElementById("dialog-titel").textContent === "Bauauftrag geöffnet"', 8000);
  b.pruefe(!/liegt schon im Gerät/.test(await seite.text('#dialog-inhalt') || ''),
    'Beim ersten Öffnen ist von einer vorhandenen Aufnahme keine Rede');
  /* „Übernehmen“ und „Bau beginnen“ standen ohne ein Wort zur Folge da, und
     schmal rutschte der Hauptknopf unter „Verwerfen“. */
  b.gleich(await fussText(), 'Verwerfen|Nur übernehmen|*Bau beginnen',
    'Die Knöpfe heißen nach dem, was danach kommt');
  b.pruefe(/Nur übernehmen – nur ansehen und planen/.test((await seite.text('#dialog-inhalt') || '')
    .replace(/\s+/g, ' ')) && /Bau beginnen – jetzt bauen und dokumentieren/.test(
    (await seite.text('#dialog-inhalt') || '').replace(/\s+/g, ' ')),
    'Je Knopf steht eine Zeile Folge im Dialog');
  b.pruefe(await seite.auswerten(`const f = document.getElementById('dialog-fuss');
    const k = [...f.querySelectorAll('.knopf')];
    const v = k[0].getBoundingClientRect(), h = k[2].getBoundingClientRect();
    return f.classList.contains('hauptknopf-rechts') && h.left - v.right > 100;`),
    '„Bau beginnen“ steht weit weg von „Verwerfen“');
  await taste('#dialog-fuss', 'Bau beginnen');
  await seite.warteAuf('!!window.fbp.store.projekt.herkunft', 3000);
  /* „Wer baut?“ kann folgen – ein schon getippter Name bleibt bei „Später“. */
  await seite.ruhe();
  if (await seite.auswerten('return !!document.querySelector("#tf-trupp")')) {
    await seite.auswerten(`document.querySelector('#tf-trupp').value = 'Trupp Probe'; return true;`);
    await taste('#dialog-fuss', 'Später');
    b.gleich(await seite.auswerten(`return (await import('./js/baudoku.js')).truppAmGeraet().trupp`),
      'Trupp Probe', '„Später“ behält den schon getippten Namen');
  }
  const kopie = await seite.auswerten(`
    const bd = await import('./js/baudoku.js');
    const s = window.fbp.store.projekt.strecken[0];
    window.fbp.store.aendern(() => {
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng, { sollPunkt: s.punkte[0].id, quelle: 'plan' });
    }, 'bau');
    /* Und im Planungsmodus umbenannt: der Auftrag im Link ist trotzdem
       derselbe, verglichen wird mit dem Plan, wie er übernommen wurde. */
    window.fbp.store.aendern(() => { s.name = s.name + ' (umbenannt)'; }, 'strecke');
    window.fbp.store.speichern();
    return window.fbp.store.projekt.id;`);
  await seite.auswerten(`location.hash = ${JSON.stringify(auftrag.link.split('#')[1])}; return true;`);
  await seite.warteAuf('/liegt schon im Gerät/.test(document.getElementById("dialog-inhalt").textContent)', 8000);
  b.pruefe(/\d+ Punkte? aufgenommen, zuletzt/.test(await seite.text('#dialog-inhalt') || ''),
    'Das zweite Öffnen sagt, dass der Auftrag schon im Gerät liegt – samt Aufnahme');
  b.pruefe(!/Plan hat sich/.test(await seite.text('#dialog-inhalt') || ''),
    'Eine Änderung im Gerät seit der Übernahme macht daraus keinen geänderten Plan');
  b.pruefe(/^Verwerfen\|Als neue Planung übernehmen\|\*Dort weiterbauen$/.test(await fussText()),
    `„Dort weiterbauen“ ist der Hauptknopf, „Als neue Planung“ steht daneben (${await fussText()})`);
  /* Die Zurück-Taste nahm die Adresse, während der Dialog blieb – ein Neuladen
     danach fand nichts mehr. */
  await seite.auswerten('history.back(); return true;');
  await new Promise(f => setTimeout(f, 400));
  b.pruefe(await seite.auswerten('return location.hash.startsWith("#p1.")'),
    'Die Zurück-Taste nimmt den Link nicht aus der Adresse, solange der Dialog offen ist');
  await taste('#dialog-fuss', 'Dort weiterbauen');
  b.gleich(await seite.auswerten('return window.fbp.store.projekt.id'), kopie,
    '„Dort weiterbauen“ öffnet die vorhandene Planung');
  b.gleich(await seite.auswerten(`return Object.keys(JSON.parse(localStorage.getItem('fbp.projekte.v1'))).length`),
    auftrag.zahl + 1, 'Und legt keine zweite Kopie an');
  b.pruefe(!(await seite.auswerten('return !!location.hash')), 'Danach ist die Adresse geräumt');

  /* Ein geänderter Plan ist nicht derselbe Auftrag: dann wird das gesagt, und
     gebaut wird nach dem neuen. */
  const geaendert = await seite.auswerten(`
    const io = await import('./js/io.js');
    const t = await import('./js/teilen.js');
    window.fbp.store.laden(${JSON.stringify(auftrag.planer)});
    const s = window.fbp.store.projekt.strecken[0];
    const merk = s.punkte[1].lat;
    window.fbp.store.aendern(() => { s.punkte[1].lat += 0.001; }, 'strecke');
    const link = await t.alsLink(io.streckeAlsProjekt(s.id));
    window.fbp.store.aendern(() => { s.punkte[1].lat = merk; }, 'strecke');
    return link;`);
  await seite.auswerten(`location.hash = ${JSON.stringify(geaendert.split('#')[1])}; return true;`);
  await seite.warteAuf('/Plan hat sich/.test(document.getElementById("dialog-inhalt").textContent)', 8000);
  b.pruefe(/\*Bau beginnen$/.test(await fussText()) && /Bisherige öffnen/.test(await fussText()),
    `Bei geändertem Plan bleibt „Bau beginnen“ vorn, die bisherige ist einen Griff weit (${await fussText()})`);
  await taste('#dialog-fuss', 'Verwerfen');
  /* „Der Link ist damit verbraucht“ stimmte nicht. */
  b.pruefe(/derselbe Link öffnet sie wieder/.test(await seite.text('#hinweisbox') || ''),
    'Verwerfen sagt, dass derselbe Link den Auftrag wieder öffnet');
  await seite.auswerten(`(await import('./js/ui.js')).projektDialog(); return true;`);
  const planliste = (await seite.text('#dialog-inhalt') || '').replace(/\s+/g, ' ');
  b.pruefe(/Plan-Nr\. [0-9A-Z]{4}/.test(planliste) && /\d+ Punkte? aufgenommen/.test(planliste),
    'Die gespeicherten Planungen nennen Plan-Nr. und Aufnahme je Eintrag');
  /* Zwillinge gleichen Namens, von denen einer die Aufnahme trägt: der
     Löschdialog nannte Strecken und Zeichen, die Aufnahme nicht. */
  b.abschnitt('Wer eine Planung mit Bauaufnahme löscht, wird gewarnt');
  await seite.auswerten(`
    const ui = await import('./js/ui.js');
    const zeile = [...document.querySelectorAll('#dialog-inhalt .pl-zeile')]
      .find(z => /Punkte? aufgenommen/.test(z.textContent) && !/0 Punkte aufgenommen/.test(z.textContent));
    [...zeile.querySelectorAll('button')].find(k => k.textContent === 'Löschen').click();
    return true;`);
  await seite.ruhe();
  const loeschText = (await seite.text('#dialog-inhalt') || '').replace(/\s+/g, ' ');
  b.pruefe(/Darin steht eine Bauaufnahme: \d+ aufgenommene? Punkte?/.test(loeschText),
    'Der Löschdialog nennt die Bauaufnahme ausdrücklich');
  b.pruefe(/Plan-Nr\. [0-9A-Z]{4}/.test(loeschText), 'Samt Plan-Nr. und Baustand');
  await taste('#dialog-fuss', 'Abbrechen');
  await seite.auswerten(`(await import('./js/ui.js')).schliesseDialog();
    window.fbp.store.loeschen(${JSON.stringify(kopie)});
    window.fbp.store.laden(${JSON.stringify(auftrag.planer)}); return true;`);
  await seite.ruhe();
  if (await seite.auswerten('return document.body.classList.contains("baumodus")')) {
    await seite.klick('#btn-modus');
  }

  /* Fünfte Runde: der erste Trupp stand vorgewählt da, der zweite tippte
     „Weiter“ und baute unter fremdem Namen. Und wer „Später“ drückte, wurde
     nie wieder gefragt – jede Aufnahme ging ohne Abschnitt hinaus. */
  b.abschnitt('Welcher Trupp: nichts vorgewählt, und gefragt wird bei der ersten Aufnahme wieder');
  const truppVorher = await seite.auswerten(`return { ...(await import('./js/baudoku.js')).truppAmGeraet() }`);
  const zweiAuftrag = await seite.auswerten(`
    const io = await import('./js/io.js');
    const t = await import('./js/teilen.js');
    const s = window.fbp.store.projekt.strecken[0];
    const alt = s.trupp;
    window.fbp.store.aendern(() => { s.trupp = '1. FmTr und 2. FmTr'; }, 'strecke');
    const link = await t.alsLink(io.streckeAlsProjekt(s.id));
    window.fbp.store.aendern(() => { s.trupp = alt; }, 'strecke');
    return link;`);
  await seite.auswerten(`location.hash = ${JSON.stringify(zweiAuftrag.split('#')[1])}; return true;`);
  await seite.warteAuf('document.getElementById("dialog-titel").textContent === "Bauauftrag geöffnet"', 8000);
  await taste('#dialog-fuss', 'Bau beginnen');
  await seite.warteAuf('document.getElementById("dialog-titel").textContent === "Welcher Trupp seid ihr?"', 5000);
  const wahlAnfang = await seite.auswerten(`return {
    chips: [...document.querySelectorAll('.trupp-chip')].map(c => c.textContent.trim()).join('|'),
    gewaehlt: document.querySelectorAll('.trupp-chip[aria-checked="true"]').length,
    weiter: [...document.querySelectorAll('#dialog-fuss .knopf')].find(k => k.textContent === 'Weiter').disabled,
    hoehe: Math.min(...[...document.querySelectorAll('.trupp-chip')].map(c => c.getBoundingClientRect().height)) };`);
  b.gleich(wahlAnfang.chips, '1. FmTr|2. FmTr', 'Beide Trupps stehen als Chips da – „und“ trennt');
  b.gleich(wahlAnfang.gewaehlt, 0, 'Keiner ist vorgewählt');
  b.pruefe(wahlAnfang.weiter, '„Weiter“ geht erst, wenn einer gewählt ist');
  b.pruefe(wahlAnfang.hoehe >= 44, `Die Chips haben Handschuhmaß (${Math.round(wahlAnfang.hoehe)} px)`);
  await taste('#dialog-fuss', 'Später');
  await seite.ruhe();
  await seite.auswerten(`(await import('./js/ui.js')).schliesseDialog(); return true;`);
  const truppPlanung = await seite.auswerten('return window.fbp.store.projekt.id');
  await seite.auswerten(`
    const bd = await import('./js/baudoku.js');
    const s = window.fbp.store.projekt.strecken[0];
    window.fbp.store.aendern(() => bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng,
      { sollPunkt: s.punkte[0].id, quelle: 'plan' }), 'bau');
    return true;`);
  await seite.warteAuf('!document.getElementById("dialog").hidden && ' +
    'document.getElementById("dialog-titel").textContent === "Welcher Trupp seid ihr?"', 5000);
  b.pruefe(/eben aufgenommene Punkt/.test(await seite.text('#dialog-inhalt') || ''),
    'Nach „Später“ fragt die erste Aufnahme noch einmal');
  await seite.auswerten(`[...document.querySelectorAll('.trupp-chip')][1].click();
    document.querySelector('#tf-fuehrer').value = 'Schulz'; return true;`);
  await taste('#dialog-fuss', 'Weiter');
  const nachWahl = await seite.auswerten(`
    const bd = await import('./js/baudoku.js');
    const s = window.fbp.store.projekt.strecken[0];
    const eigen = s.bau.abschnitte.find(a => a.trupp === '2. FmTr');
    const punkt = s.bau.punkte.find(pt => pt.sollPunkt === s.punkte[0].id);
    return { abschnitt: eigen ? eigen.name + '/' + eigen.fuehrer : '',
             zugeordnet: !!eigen && punkt.abschnitt === eigen.id,
             absender: bd.absenderText([s]) };`);
  b.gleich(nachWahl.abschnitt, '2. FmTr/Schulz', 'Der gewählte Trupp bekommt seinen Bauabschnitt');
  b.pruefe(nachWahl.zugeordnet, 'Und der eben aufgenommene Punkt kommt nachträglich hinein');
  b.gleich(nachWahl.absender, '2. FmTr · Schulz', 'Die Meldung nennt Trupp und Truppführer');
  await seite.auswerten(`
    (await import('./js/baudoku.js')).truppAmGeraetSetzen(${JSON.stringify(truppVorher)});
    window.fbp.store.laden(${JSON.stringify(auftrag.planer)});
    window.fbp.store.loeschen(${JSON.stringify(truppPlanung)}); return true;`);
  await seite.ruhe();
  if (await seite.auswerten('return document.body.classList.contains("baumodus")')) {
    await seite.klick('#btn-modus');
  }

  // ------------------------------------------------------------ Rückweg

  b.abschnitt('Zwei Trupps melden zurück, ohne einander zu überschreiben');
  /* Der Fall, für den die Bauabschnitte da sind: zwei Trupps bauen an einer
     Strecke aufeinander zu (Hdb Feldfernkabelbau, 3.6) und melden getrennt.
     Die zweite Meldung darf die erste nicht wegnehmen – sonst wäre die Arbeit
     eines Trupps verloren, und zwar unbemerkt. */
  const zweiTrupps = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const bm = await import('./js/baumeldung.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);

    /* Trupp Nord baut und meldet. */
    let meldungNord;
    window.fbp.store.aendern(() => {
      s.bau = null;
      const a = bd.bauabschnittAnlegen(s);
      a.name = 'Nord'; a.trupp = '1. FmTr';
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng,
        { sollPunkt: s.punkte[0].id, quelle: 'plan', abschnitt: a.id });
      bd.materialSetzen(s, 'fkb', a.id, 400);
      bd.baumeldungAnlegen(s, 'Nord: erste Länge verbaut', a.id);
    }, 'bau');
    meldungNord = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s])));

    /* Trupp Süd baut am selben Auftrag, kennt Nord aber nicht. */
    let meldungSued;
    window.fbp.store.aendern(() => {
      s.bau = null;
      const a = bd.bauabschnittAnlegen(s);
      a.name = 'Süd'; a.trupp = '2. FmTr';
      const letzter = s.punkte[s.punkte.length - 1];
      bd.istPunktSetzen(s, letzter.lat, letzter.lng,
        { sollPunkt: letzter.id, quelle: 'plan', abschnitt: a.id });
      bd.materialSetzen(s, 'fkb', a.id, 350);
    }, 'bau');
    meldungSued = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s])));

    /* Beim Planer steht noch nichts. */
    window.fbp.store.aendern(() => { s.bau = null; }, 'bau');
    const ordnung = [s.id];
    window.fbp.store.aendern(pr => bm.einspielen(pr, meldungNord, ordnung), 'meldung');
    const nachNord = {
      abschnitte: bd.bauabschnitte(s).map(a => a.name).join(','),
      punkte: bd.istPunkte(s).length,
      material: bd.materialSumme(s).get('fkb')
    };
    window.fbp.store.aendern(pr => bm.einspielen(pr, meldungSued, ordnung), 'meldung');
    const nachBeiden = {
      abschnitte: bd.bauabschnitte(s).map(a => a.name).sort().join(','),
      punkte: bd.istPunkte(s).length,
      material: bd.materialSumme(s).get('fkb'),
      truppe: bd.bauabschnitte(s).map(a => a.trupp).sort().join(','),
      meldungen: bd.baumeldungen(s).length
    };

    /* Und derselbe Weg noch einmal: eine zweite Meldung zu DEMSELBEN Abschnitt
       muss als Kollision gemeldet werden, nicht stillschweigend verschmelzen. */
    const befundWieder = bm.befund(p, meldungNord, ordnung);
    const kollision = befundWieder[0].kollision.map(a => a.name).join(',');

    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return { nachNord, nachBeiden, kollision,
             gemeldetNord: meldungNord.strecken.length,
             truppNord: bm.truppText(meldungNord) };`);

  b.gleich(zweiTrupps.gemeldetNord, 1, 'Die Meldung trägt genau die bebaute Strecke');
  b.gleich(zweiTrupps.truppNord, '1. FmTr', 'Und nennt den Trupp, der gemeldet hat');
  b.gleich(zweiTrupps.nachNord.abschnitte, 'Nord', 'Nach der ersten Meldung steht Nord da');
  b.gleich(zweiTrupps.nachNord.material, 400, 'Mit seinem Material');
  b.gleich(zweiTrupps.nachBeiden.abschnitte, 'Nord,Süd',
    'Nach der zweiten stehen beide da – die erste ist nicht weggenommen');
  b.gleich(zweiTrupps.nachBeiden.punkte, 2, 'Beide aufgenommenen Punkte sind da');
  b.gleich(zweiTrupps.nachBeiden.material, 750, 'Und beide Materialmengen addieren sich');
  b.gleich(zweiTrupps.nachBeiden.truppe, '1. FmTr,2. FmTr', 'Jeder Abschnitt trägt seinen Trupp');
  b.gleich(zweiTrupps.nachBeiden.meldungen, 1, 'Die Baumeldung von Nord steht noch da');
  b.gleich(zweiTrupps.kollision, 'Nord',
    'Eine zweite Meldung zum selben Abschnitt wird als Kollision gemeldet');

  b.abschnitt('Zwei Trupps, die den Vorgabenamen stehen lassen');
  /* Der Regelfall, und der gefährlichste: niemand benennt den ersten
     Bauabschnitt um. Trägt der Name nicht mit, sucht das Einspielen erst mit
     einem leeren Namen (findet nichts, legt eine frische Kennung an) und gleich
     darauf doch mit dem hergestellten Namen (findet den vorhandenen) – der
     Bogen beider Trupps wäre weg, lautlos. */
  const vorgabename = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const bm = await import('./js/baumeldung.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    const meldungVon = (trupp, stelle) => {
      window.fbp.store.aendern(() => {
        s.bau = null;
        const a = bd.bauabschnittAnlegen(s);   // heisst „Bauabschnitt 1“
        a.trupp = trupp;
        const pt = s.punkte[stelle];
        bd.istPunktSetzen(s, pt.lat, pt.lng,
          { sollPunkt: pt.id, quelle: 'plan', abschnitt: a.id });
        bd.materialSetzen(s, 'fkb', a.id, 100);
      }, 'bau');
      return JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s])));
    };
    const a1 = meldungVon('1. FmTr', 0);
    const a2 = meldungVon('2. FmTr', s.punkte.length - 1);
    const name1 = a1.strecken[0].bau.abschnitte[0].name;

    window.fbp.store.aendern(() => { s.bau = null; }, 'bau');
    window.fbp.store.aendern(pr => bm.einspielen(pr, a1, [s.id]), 'meldung');
    const nachErster = { punkte: bd.istPunkte(s).length, material: bd.materialSumme(s).get('fkb') };
    const befundZwei = bm.befund(p, a2, [s.id])[0];
    window.fbp.store.aendern(pr => bm.einspielen(pr, a2, [s.id]), 'meldung');
    const nachZweiter = {
      abschnitte: bd.bauabschnitte(s).length,
      punkte: bd.istPunkte(s).length,
      trupp: bd.bauabschnitte(s).map(x => x.trupp).join(','),
      material: bd.materialSumme(s).get('fkb')
    };
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return { name1, nachErster, nachZweiter,
             kollision: befundZwei.kollision.map(x => x.name).join(','),
             ersetzt: befundZwei.ersetzt };`);
  b.gleich(vorgabename.name1, 'Bauabschnitt 1', 'Der Vorgabename reist mit');
  b.gleich(vorgabename.nachErster.punkte, 1, 'Die erste Meldung kommt an');
  b.gleich(vorgabename.kollision, 'Bauabschnitt 1',
    'Die zweite wird als Kollision auf demselben Abschnitt erkannt');
  b.gleich(vorgabename.ersetzt, 1, 'Und die Vorschau sagt, dass dabei ein Punkt weicht');
  b.gleich(vorgabename.nachZweiter.abschnitte, 1, 'Danach steht ein Bauabschnitt da');
  b.gleich(vorgabename.nachZweiter.punkte, 1, 'Mit dem Punkt des zweiten Trupps');
  b.gleich(vorgabename.nachZweiter.trupp, '2. FmTr', 'Und dessen Trupp');
  b.gleich(vorgabename.nachZweiter.material, 100,
    'Das Material wird ersetzt und nicht verdoppelt');

  b.abschnitt('Was ohne Bauabschnitt aufgenommen wurde, geht nicht verloren');
  const ohneZuordnung = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const bm = await import('./js/baumeldung.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    window.fbp.store.aendern(() => {
      s.bau = null;
      const a = bd.bauabschnittAnlegen(s);
      a.name = 'Nord'; a.trupp = '1. FmTr';
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng,
        { sollPunkt: s.punkte[0].id, quelle: 'plan', abschnitt: a.id });
      /* Und einer ohne Zuordnung – wer aufnimmt, ohne oben einen Abschnitt
         zu wählen, landet genau hier. */
      const letzter = s.punkte[s.punkte.length - 1];
      bd.istPunktSetzen(s, letzter.lat, letzter.lng,
        { sollPunkt: letzter.id, quelle: 'karte' });
      bd.materialSetzen(s, 'ffkb', null, 55);
      bd.baumeldungAnlegen(s, 'ohne Abschnitt gemeldet', null);
    }, 'bau');
    const meldung = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s])));
    const befundEins = bm.befund(p, meldung, [s.id])[0];
    window.fbp.store.aendern(() => { s.bau = null; }, 'bau');
    window.fbp.store.aendern(pr => bm.einspielen(pr, meldung, [s.id]), 'meldung');
    const erst = { punkte: bd.istPunkte(s).length, material: bd.materialSumme(s).get('ffkb'),
                   meldungen: bd.baumeldungen(s).length };
    /* Zweimal einspielen darf nicht verdoppeln – am Bauort wird eine Meldung
       eher zweimal geschickt als zwei Trupps ohne Zuordnung arbeiten. */
    window.fbp.store.aendern(pr => bm.einspielen(pr, meldung, [s.id]), 'meldung');
    const zweit = { punkte: bd.istPunkte(s).length, material: bd.materialSumme(s).get('ffkb'),
                    meldungen: bd.baumeldungen(s).length };
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return { unzugeordnet: befundEins.unzugeordnet, erst, zweit };`);
  b.gleich(ohneZuordnung.unzugeordnet, 3,
    'Die Vorschau zählt, was ohne Bauabschnitt mitkommt');
  b.gleich(ohneZuordnung.erst.punkte, 2, 'Beide Punkte kommen an, auch der ohne Abschnitt');
  b.gleich(ohneZuordnung.erst.material, 55, 'Die Materialzeile ohne Abschnitt ebenso');
  b.gleich(ohneZuordnung.erst.meldungen, 1, 'Und die Baumeldung ohne Abschnitt');
  b.gleich(ohneZuordnung.zweit.punkte, 2, 'Zweimal einspielen verdoppelt nichts');
  b.gleich(ohneZuordnung.zweit.material, 55, 'Auch das Material nicht');

  b.abschnitt('Der Baustand einer Teilmeldung hebt, aber nicht über „im Bau“');
  const staende = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const bm = await import('./js/baumeldung.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    window.fbp.store.aendern(() => {
      s.bau = null;
      const a = bd.bauabschnittAnlegen(s);
      a.name = 'Nord';
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng,
        { sollPunkt: s.punkte[0].id, quelle: 'plan', abschnitt: a.id });
      s.bau.stand = 'gebaut';
    }, 'bau');
    const meldung = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s])));
    window.fbp.store.aendern(() => { s.bau = null; }, 'bau');
    window.fbp.store.aendern(pr => bm.einspielen(pr, meldung, [s.id]), 'meldung');
    const nachTeil = s.bau.stand;
    /* Und die Gegenprobe: der Planer hat schon „übergeben“ gesetzt – eine
       Teilmeldung darf ihn nicht zurückwerfen. */
    window.fbp.store.aendern(() => { s.bau.stand = 'uebergeben'; }, 'bau');
    window.fbp.store.aendern(pr => bm.einspielen(pr, meldung, [s.id]), 'meldung');
    const nachUebergeben = s.bau.stand;
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return { nachTeil, nachUebergeben };`);
  b.gleich(staende.nachTeil, 'laeuft',
    'Aus „noch nicht begonnen“ wird „im Bau“ – gebaut ist erst, was der Planer feststellt');
  b.gleich(staende.nachUebergeben, 'uebergeben',
    'Und eine Teilmeldung wirft einen weiter fortgeschrittenen Stand nicht zurück');

  /* Fünfte Runde: Trupp 1 hatte Stamm 1 bestanden gemeldet, Trupp 2 meldete
     ihn durchgefallen – und weil beim Planer schon eine Prüfung stand, ging
     die Meldung still verloren. Die Baudokumentation druckte „bestanden,
     übergeben“ über einer Leitung, die nicht ging. */
  b.abschnitt('Ein durchgefallener Stamm des zweiten Trupps geht nicht verloren');
  const pruefMerge = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const bm = await import('./js/baumeldung.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    const frueh = new Date(Date.now() - 3600e3).toISOString();
    /* Beim Planer: Nord hat gemeldet, Stamm 1 bestanden, übergeben. */
    window.fbp.store.aendern(() => {
      s.bau = null;
      const a = bd.bauabschnittAnlegen(s); a.name = 'Nord'; a.trupp = '1. FmTr';
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng,
        { sollPunkt: s.punkte[0].id, quelle: 'plan', abschnitt: a.id });
      const z = bd.pruefzeileAnlegen(s); z.stamm = 'Stamm 1'; z.bestanden = true; z.zeit = frueh;
      s.bau.pruefung.uebergabeAn = 'FGr N'; s.bau.stand = 'uebergeben';
    }, 'bau');
    const planer = JSON.stringify(s.bau);
    /* Süd misst denselben Stamm und findet ihn durchgefallen. */
    window.fbp.store.aendern(() => {
      s.bau = null;
      const a = bd.bauabschnittAnlegen(s); a.name = 'Süd'; a.trupp = '2. FmTr';
      const letzter = s.punkte[s.punkte.length - 1];
      bd.istPunktSetzen(s, letzter.lat, letzter.lng, { sollPunkt: letzter.id, quelle: 'plan', abschnitt: a.id });
      const z = bd.pruefzeileAnlegen(s); z.stamm = 'Stamm 1'; z.bestanden = false;
    }, 'bau');
    const sued = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s], '2. FmTr')));
    /* Und umgekehrt: hier durchgefallen, gemeldet bestanden. */
    const suedGut = JSON.parse(JSON.stringify(sued));
    suedGut.strecken[0].bau.pruefung.staemme[0].bestanden = true;
    window.fbp.store.aendern(() => { s.bau = JSON.parse(planer); }, 'bau');
    const vorschau = bm.befund(p, sued, [s.id])[0];
    window.fbp.store.aendern(pr => bm.einspielen(pr, sued, [s.id]), 'meldung');
    const nach = { stamm: s.bau.pruefung.staemme.map(z => z.stamm + ':' + z.bestanden).join(','),
                   stand: s.bau.stand, an: s.bau.pruefung.uebergabeAn };
    const umgekehrt = bm.befund(p, suedGut, [s.id])[0];
    window.fbp.store.aendern(pr => bm.einspielen(pr, suedGut, [s.id]), 'meldung');
    const nachGut = s.bau.pruefung.staemme.map(z => z.stamm + ':' + z.bestanden).join(',');
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return JSON.stringify({ hinweise: vorschau.pruefhinweise, nach, umgekehrt: umgekehrt.pruefhinweise, nachGut });`)
    .then(x => JSON.parse(x));
  b.pruefe(pruefMerge.hinweise.some(h => h.stamm === 'Stamm 1' && h.hier === 'bestanden' &&
    h.gemeldet === 'durchgefallen' && h.uebernommen),
    'Die Vorschau nennt den Stamm: hier bestanden, gemeldet durchgefallen – übernommen');
  b.gleich(pruefMerge.nach.stamm, 'Stamm 1:false', 'Nach dem Einspielen steht der Stamm durchgefallen da');
  b.gleich(pruefMerge.nach.stand, 'gebaut',
    'Die Übergabe ist aufgehoben – übergeben wird nur mit bestandener Prüfung');
  b.pruefe(pruefMerge.hinweise.some(h => h.uebergabeAufgehoben),
    'Und die Vorschau sagt das vorher');
  b.gleich(pruefMerge.nach.an, 'FGr N', 'Wer übernommen hatte, bleibt als Vermerk stehen');
  b.pruefe(pruefMerge.umgekehrt.some(h => h.hier === 'durchgefallen' && h.gemeldet === 'bestanden' &&
    !h.uebernommen), 'Ein gemeldetes „bestanden“ gegen „durchgefallen“ hier wird genannt, nicht übernommen');
  b.gleich(pruefMerge.nachGut, 'Stamm 1:false', 'Und „durchgefallen“ bleibt stehen');

  /* Ein neu verschickter Auftrag trägt den ganzen Bau-Block, also auch den
     Abschnitt des anderen Trupps. Die nächste Meldung brachte ihn mit, nannte
     „1. FmTr, 2. FmTr“ und überschrieb beim Planer den neueren Stand von 1. */
  b.abschnitt('Kennt das Gerät seinen Trupp, meldet es nur dessen Abschnitte');
  const nurEigene = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    const vorher = { ...bd.truppAmGeraet() };
    window.fbp.store.aendern(() => {
      s.bau = null;
      const a = bd.bauabschnittAnlegen(s); a.name = '1. FmTr'; a.trupp = '1. FmTr'; a.fuehrer = 'Krause';
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng, { sollPunkt: s.punkte[0].id, quelle: 'plan', abschnitt: a.id });
      bd.materialSetzen(s, 'fkb', a.id, 400);
      const c = bd.bauabschnittAnlegen(s); c.name = '2. FmTr'; c.trupp = '2. FmTr';
      const letzter = s.punkte[s.punkte.length - 1];
      bd.istPunktSetzen(s, letzter.lat, letzter.lng, { sollPunkt: letzter.id, quelle: 'plan', abschnitt: c.id });
      bd.istPunktSetzen(s, letzter.lat + 0.001, letzter.lng, { quelle: 'karte' });
    }, 'bau');
    bd.truppAmGeraetSetzen({ trupp: '2. FmTr', fuehrer: 'Schulz' });
    const m = t.alsBaumeldung(p, [s], bd.absenderText([s]), bd.eigeneAbschnitte);
    const voll = t.alsBaumeldung(p, [s], '');
    const codeEigen = t.meldungsCodeVon([s], bd.eigeneAbschnitte);
    const codeAus = t.meldungsCodeAus(JSON.parse(JSON.stringify(m)));
    window.fbp.store.aendern(() => bd.absetzenVermerken(s, 'link', codeEigen), 'bau', { undo: false });
    /* Der fremde Abschnitt ändert sich am Gerät – etwa durch einen neuen
       Auftrag. Das ist keine Änderung an der eigenen Meldung. */
    window.fbp.store.aendern(() => { s.bau.material[0].menge = 500; }, 'bau');
    const standNachFremd = bd.absetzstand(s).stand;
    const fremd = bd.fremderAbschnitt(s, s.bau.abschnitte[0]);
    bd.truppAmGeraetSetzen(vorher);
    const ohneTrupp = t.alsBaumeldung(p, [s], '', bd.eigeneAbschnitte).strecken[0].bau.abschnitte.length;
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return JSON.stringify({
      abschnitte: m.strecken[0].bau.abschnitte.map(a => a.name).join(','),
      punkte: (m.strecken[0].bau.punkte || []).length,
      material: (m.strecken[0].bau.material || []).length,
      vollAbschnitte: voll.strecken[0].bau.abschnitte.length,
      von: m.von, gleicherCode: codeEigen === codeAus,
      codeAnders: codeEigen !== t.meldungsCodeVon([s]), standNachFremd, fremd, ohneTrupp });`)
    .then(x => JSON.parse(x));
  b.gleich(nurEigene.abschnitte, '2. FmTr', 'Die Meldung trägt nur den Abschnitt des eigenen Trupps');
  b.gleich(nurEigene.punkte, 1, 'Mit dessen Punkt – ohne den des anderen und ohne den ohne Abschnitt');
  b.gleich(nurEigene.material, 0, 'Und ohne das Material des anderen Trupps');
  b.gleich(nurEigene.vollAbschnitte, 2, 'Ohne diese Auswahl ginge der ganze Bogen hinaus');
  b.gleich(nurEigene.von, '2. FmTr · Schulz', 'Der Absender nennt Trupp und Truppführer');
  b.pruefe(nurEigene.gleicherCode, 'Der Rückgabe-Code rechnet über genau das, was hinausgeht');
  b.gleich(nurEigene.standNachFremd, 'aktuell',
    'Eine Änderung am fremden Abschnitt macht die eigene Meldung nicht veraltet');
  b.pruefe(nurEigene.fremd, 'Der fremde Abschnitt gilt am Gerät als fremd');
  b.gleich(nurEigene.ohneTrupp, 2, 'Kennt das Gerät seinen Trupp nicht, bleibt alles wie bisher');

  /* „älter“ verglich die Aufnahmezeiten über die ganze Strecke – beim
     abschnittsweisen Bau also Trupp 1 gegen Trupp 2. */
  b.abschnitt('„Älter“ vergleicht nur, was die Meldung ersetzt');
  const alter = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const bm = await import('./js/baumeldung.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    const vor = h => new Date(Date.now() - h * 3600e3).toISOString();
    window.fbp.store.aendern(() => {
      s.bau = null;
      const sued = bd.bauabschnittAnlegen(s); sued.name = 'Süd'; sued.trupp = '2. FmTr';
      const letzter = s.punkte[s.punkte.length - 1];
      bd.istPunktSetzen(s, letzter.lat, letzter.lng, { sollPunkt: letzter.id, quelle: 'plan', abschnitt: sued.id });
      s.bau.punkte[0].zeit = vor(1);
    }, 'bau');
    const meldung = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s], '2. FmTr')));
    /* Beim Planer: Süd von vor zwei Stunden, Nord eben erst. */
    window.fbp.store.aendern(() => {
      s.bau.punkte[0].zeit = vor(2);
      const nord = bd.bauabschnittAnlegen(s); nord.name = 'Nord'; nord.trupp = '1. FmTr';
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng, { sollPunkt: s.punkte[0].id, quelle: 'plan', abschnitt: nord.id });
    }, 'bau');
    const mehrtrupp = bm.befund(p, meldung, [s.id])[0].aelter;
    /* Gegenprobe: derselbe Abschnitt ist hier neuer – dann bleibt es „älter“. */
    window.fbp.store.aendern(() => { s.bau.punkte.find(x => x.abschnitt === s.bau.abschnitte[0].id).zeit = vor(0); }, 'bau');
    const wirklich = bm.befund(p, meldung, [s.id])[0].aelter;
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return { mehrtrupp, wirklich };`);
  b.gleich(alter.mehrtrupp, false,
    'Eine Meldung von Süd ist nicht „älter“, nur weil Nord zuletzt etwas eingetragen hat');
  b.gleich(alter.wirklich, true, 'Ist Süd hier neuer als gemeldet, bleibt die Warnung');

  /* Zwei Trupps ohne Bauabschnitt – in der einfachen Ansicht der Regelfall.
     Beim Planer blieb nur entweder – oder. */
  b.abschnitt('Zwei Trupps ohne Bauabschnitt: als eigener Abschnitt einspielen');
  const eigener = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const bm = await import('./js/baumeldung.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    window.fbp.store.aendern(() => {
      s.bau = null;
      const letzter = s.punkte[s.punkte.length - 1];
      bd.istPunktSetzen(s, letzter.lat, letzter.lng, { sollPunkt: letzter.id, quelle: 'plan' });
      s.bau.punkte[0].zeit = new Date(Date.now() - 3600e3).toISOString();
    }, 'bau');
    const meldungB = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s], 'Trupp B · Lange')));
    /* Beim Planer steht schon die Aufnahme von Trupp A, ohne Abschnitt, neuer. */
    window.fbp.store.aendern(() => {
      s.bau = null;
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng, { sollPunkt: s.punkte[0].id, quelle: 'plan' });
      s.bau.gemeldetVon = 'Trupp A';
    }, 'bau');
    const zuordnung = [s.id];
    const vorher = bm.befund(p, meldungB, zuordnung)[0];
    zuordnung.eigenerAbschnitt = [true];
    const mit = bm.befund(p, meldungB, zuordnung)[0];
    window.fbp.store.aendern(pr => bm.einspielen(pr, meldungB, zuordnung), 'meldung');
    const nach = {
      abschnitte: s.bau.abschnitte.map(a => a.name + '/' + a.fuehrer).join(','),
      ohne: s.bau.punkte.filter(x => !x.abschnitt).length,
      imAbschnitt: s.bau.punkte.filter(x => x.abschnitt).length,
      code: s.bau.gemeldetCode, erwartet: t.meldungsCodeAus(meldungB)
    };
    /* Die nächste Meldung desselben Trupps findet ihren Abschnitt wieder. */
    const ui = await import('./js/ui.js');
    ui.baumeldungDialog(meldungB, 'Datei');
    const vorbelegt = !!document.querySelector('.mv-eigener input:checked');
    const satz = (document.querySelector('.mv-eigener') || {}).textContent || '';
    ui.schliesseDialog();
    /* Der Inhalt bleibt nach dem Schließen stehen – die Fälle danach warten auf
       eine neue Vorschau und fänden sonst diese. */
    document.getElementById('dialog-inhalt').innerHTML = '';
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return JSON.stringify({ moeglich: vorher.eigenerAbschnittMoeglich, verlorenVorher: vorher.verloren.punkte,
      aelter: vorher.aelter, verlorenMit: mit.verloren.punkte, nach, vorbelegt, satz });`)
    .then(x => JSON.parse(x));
  b.pruefe(eigener.moeglich, 'Bei anderem Absender ohne Abschnitt wird der eigene Abschnitt angeboten');
  b.gleich(eigener.aelter, false, 'Zwei verschiedene Trupps sind nicht „älter“ als einander');
  b.pruefe(eigener.verlorenVorher >= 1 && eigener.verlorenMit === 0,
    'Ganz eingespielt ginge die Aufnahme von A verloren, als eigener Abschnitt nicht');
  b.gleich(eigener.nach.abschnitte, 'Trupp B/Lange', 'Danach steht der Abschnitt „Trupp B“ samt Truppführer');
  b.gleich(eigener.nach.ohne, 1, 'Die Aufnahme von A bleibt ohne Abschnitt stehen');
  b.gleich(eigener.nach.imAbschnitt, 1, 'Die von B steht in ihrem Abschnitt');
  b.gleich(eigener.nach.code, eigener.nach.erwartet,
    'Der Rückgabe-Code der Meldung steht danach an der Strecke');
  b.pruefe(eigener.vorbelegt && /Trupp B/.test(eigener.satz),
    'Kommt Trupp B wieder, ist „als eigenen Bauabschnitt“ schon gewählt');

  b.abschnitt('„und“ trennt aufgetragene Trupps wie das Komma');
  b.gleich(await seite.auswerten(`
    const bd = await import('./js/baudoku.js');
    return [bd.auftragsTrupps({ trupp: '1. FmTr und 2. FmTr' }).join('|'),
            bd.auftragsTrupps({ trupp: 'Trupp A u. Trupp B; Trupp C' }).join('|')].join(' / ');`),
    '1. FmTr|2. FmTr / Trupp A|Trupp B|Trupp C', '„1. FmTr und 2. FmTr“ sind zwei Trupps');

  b.abschnitt('Bei verschobener Punktliste wird der Planbezug gelöst, nicht geraten');
  const verschoben = await seite.auswerten(`
    const st = await import('./js/state.js');
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const bm = await import('./js/baumeldung.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    const merkPunkte = JSON.stringify(s.punkte);
    window.fbp.store.aendern(() => {
      s.bau = null;
      const a = bd.bauabschnittAnlegen(s);
      a.name = 'Nord';
      const zweiter = s.punkte[1] || s.punkte[0];
      bd.istPunktSetzen(s, zweiter.lat, zweiter.lng,
        { sollPunkt: zweiter.id, quelle: 'plan', abschnitt: a.id });
    }, 'bau');
    const meldung = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s])));
    /* Der Planer fügt inzwischen vorn einen Punkt ein – alle Stellen rutschen. */
    window.fbp.store.aendern(() => {
      s.punkte.unshift(st.neuerPunkt(s.punkte[0].lat + 0.01, s.punkte[0].lng));
      s.bau = null;
    }, 'strecke');
    const befundEins = bm.befund(p, meldung, [s.id])[0];
    window.fbp.store.aendern(pr => bm.einspielen(pr, meldung, [s.id]), 'meldung');
    const bezuege = bd.istPunkte(s).map(pt => pt.sollPunkt === null ? 'gelöst' : 'gesetzt').join(',');
    const punkte = bd.istPunkte(s).length;
    window.fbp.store.aendern(() => {
      s.punkte = JSON.parse(merkPunkte);
      s.bau = JSON.parse(merk);
    }, 'strecke');
    return { warnt: befundEins.planAbweicht, bezuege, punkte };`);
  b.pruefe(verschoben.warnt === true, 'Die Vorschau erkennt die verschobene Punktliste');
  b.gleich(verschoben.punkte, 1, 'Der aufgenommene Punkt bleibt stehen');
  b.gleich(verschoben.bezuege, 'gelöst',
    'Sein Bezug zum Plan wird gelöst statt auf den falschen Punkt gelegt');

  b.abschnitt('Eine präparierte Baumeldung wird gar nicht erst angenommen');
  const gefaelscht = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const faelle = {
      punkteKeineListe: { fassung: 1, strecken: [{ name: 'S', bau: { punkte: 'x' } }] },
      bauKeinObjekt:    { fassung: 1, strecken: [{ name: 'S', bau: [] }] },
      pruefungKaputt:   { fassung: 1, strecken: [{ name: 'S', bau: { pruefung: { staemme: 7 } } }] },
      nameFehlt:        { fassung: 1, strecken: [{ bau: {} }] },
      echtePlanung:     { version: 14, name: 'P', kopf: {}, ansicht: {}, strecken: [] },
      echteMeldung:     { fassung: 1, strecken: [{ name: 'S', sollPunkte: 2,
                          bau: { abschnitte: [], punkte: [], material: [], meldungen: [] } }] }
    };
    const raus = {};
    for (const [k, v] of Object.entries(faelle)) raus[k] = t.istBaumeldung(v);
    return raus;`);
  b.gleich(gefaelscht.punkteKeineListe, false, 'Eine Punktliste, die keine ist, fällt durch');
  b.gleich(gefaelscht.bauKeinObjekt, false, 'Ein bau-Block, der eine Liste ist, ebenso');
  b.gleich(gefaelscht.pruefungKaputt, false, 'Und eine Prüfung mit kaputten Stämmen');
  b.gleich(gefaelscht.nameFehlt, false, 'Eine Strecke ohne Namen ebenso');
  b.gleich(gefaelscht.echtePlanung, false, 'Eine echte Planung ist keine Baumeldung');
  b.gleich(gefaelscht.echteMeldung, true, 'Eine echte Baumeldung kommt durch');

  b.abschnitt('Die Baumeldung reist durch den Link');
  const rundMeldung = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    window.fbp.store.aendern(() => {
      s.bau = null;
      const a = bd.bauabschnittAnlegen(s);
      a.name = 'Nord'; a.trupp = '1. FmTr';
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng,
        { sollPunkt: s.punkte[0].id, quelle: 'standort', genauigkeit: 7, abschnitt: a.id });
      bd.materialSetzen(s, 'fkb', a.id, 400);
      bd.pruefzeileAnlegen(s);
    }, 'bau');
    const link = await t.meldungAlsLink(p, [s]);
    const zurueck = await t.baumeldungAusFragment('#' + link.split('#')[1]);
    const vorher = t.alsBaumeldung(p, [s]);
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    return {
      laenge: link.length,
      istMeldung: t.istBaumeldung(zurueck),
      strecken: zurueck.strecken.length,
      name: zurueck.strecken[0].name,
      sollPunkte: zurueck.strecken[0].sollPunkte,
      quelle: zurueck.strecken[0].bau.punkte[0].quelle,
      genauigkeit: zurueck.strecken[0].bau.punkte[0].genauigkeit,
      material: JSON.stringify(zurueck.strecken[0].bau.material),
      materialVorher: JSON.stringify(vorher.strecken[0].bau.material),
      pruefung: !!zurueck.strecken[0].bau.pruefung
    };`);
  b.pruefe(rundMeldung.istMeldung, 'Der Link wird als Baumeldung erkannt');
  b.gleich(rundMeldung.strecken, 1, 'Eine Strecke kommt an');
  b.gleich(rundMeldung.quelle, 'standort', 'Die Herkunft der Koordinate bleibt');
  b.gleich(rundMeldung.genauigkeit, 7, 'Samt Genauigkeit');
  b.gleich(rundMeldung.material, rundMeldung.materialVorher, 'Der Materialbogen reist mit');
  b.pruefe(rundMeldung.pruefung, 'Die Prüfzeilen reisen mit');
  b.pruefe(rundMeldung.laenge < 2000,
    `Die Meldung ist deutlich kürzer als die Planung (${rundMeldung.laenge} Zeichen)`);

  /* Nach einer Unterbrechung ist die erste Frage des Truppführers: habe ich das
     schon gemeldet? Vorher war sie am Gerät nicht zu beantworten – der Block
     sah vor und nach dem Absetzen gleich aus, und der Bau-Block war
     zeichengleich. Doppelt gemeldet ersetzt beim Planer Eintragungen, gar
     nicht gemeldet fehlt dort alles. */
  /* Schema 19: was der Bogen abfragt, muss auch beim Planer ankommen – in der
     Baumeldung UND im Link der ganzen Planung. Punktverweise reisen dabei als
     Stelle, wie `vonPunkt` seit Schema 13. */
  b.abschnitt('Abschrift, Herkunft „Papier“ und Geräteausfall reisen mit');
  const papierReise = await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bm = await import('./js/baumeldung.js');
    const st = await import('./js/state.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const merk = JSON.stringify(s.bau);
    window.fbp.store.aendern(() => {
      s.bau = st.bauNormalisieren(JSON.parse(${JSON.stringify(nachtragStand)}));
      s.bau.ausfallZeit = '2026-09-30T11:00:00.000Z';
      s.bau.ausfallNach = s.punkte[2].id;
    }, 'bau');
    const quelle = JSON.parse(JSON.stringify(s.bau));
    // Rückweg: Baumeldung als Link, beim Planer in eine Abschrift eingespielt
    const link = await t.meldungAlsLink(p, [s], 'Trupp Nord');
    const meldung = await t.baumeldungAusFragment('#' + link.split('#')[1]);
    const ziel = JSON.parse(JSON.stringify(p));
    ziel.strecken[0].bau = null;
    bm.einspielen(ziel, meldung, [ziel.strecken[0].id]);
    const an = ziel.strecken[0].bau;
    // Hinweg: die ganze Planung als Link
    const plink = await t.alsLink(p);
    const zurueck = await t.planungAusFragment('#' + plink.split('#')[1]);
    const migriert = st.migrieren(zurueck);
    const pz = migriert.strecken[0];
    window.fbp.store.aendern(() => { s.bau = JSON.parse(merk); }, 'bau');
    const nrVon = (liste, id) => liste.findIndex(x => x.id === id);
    const zusammen = (bau, punkte) => JSON.stringify({
      papier: bau.punkte.filter(x => x.quelle === 'papier').length,
      nachgetragen: bau.punkte.filter(x => x.nachgetragen).length +
        bau.meldungen.filter(x => x.nachgetragen).length +
        (bau.pruefung ? bau.pruefung.staemme.filter(x => x.nachgetragen).length : 0),
      von: nrVon(punkte, bau.abschnitte[0].vonPunkt), bis: nrVon(punkte, bau.abschnitte[0].bisPunkt),
      ausfallA: [bau.abschnitte[0].ausfallZeit, nrVon(punkte, bau.abschnitte[0].ausfallNach)],
      zeitPunkt: bau.punkte.find(x => x.nachgetragen)?.zeit || 'leer'
    });
    return JSON.stringify({
      quelle: zusammen(quelle, s.punkte),
      meldung: zusammen(an, ziel.strecken[0].punkte),
      planung: zusammen(pz.bau, pz.punkte),
      ausfallBauPlanung: [pz.bau.ausfallZeit, nrVon(pz.punkte, pz.bau.ausfallNach)]
    });`).then(JSON.parse);
  b.gleich(papierReise.meldung, papierReise.quelle,
    'Die Baumeldung bringt Herkunft, Abschrift, von–bis und Geräteausfall zum Planer');
  b.gleich(papierReise.planung, papierReise.quelle, 'Der Link der Planung ebenso');
  b.gleich(JSON.stringify(papierReise.ausfallBauPlanung), JSON.stringify(['2026-09-30T11:00:00.000Z', 2]),
    'Der Ausfall ohne Bauabschnitt reist als Stelle und kommt am selben Punkt an');

  b.abschnitt('Ein Stand von Schema 18 öffnet ohne Umweg');
  const alt18 = await seite.auswerten(`
    const st = await import('./js/state.js');
    const s = window.fbp.store.projekt.strecken[0];
    const p = st.migrieren({ version: 18, name: 'Alt', kopf: {}, ansicht: {}, strecken: [{
      name: 'A', punkte: s.punkte.map(x => ({ ...x })),
      bau: { stand: 'laeuft', abschnitte: [{ id: 'a1', name: 'Nord', vonPunkt: s.punkte[0].id }],
             punkte: [{ lat: s.punkte[0].lat, lng: s.punkte[0].lng, quelle: 'standort',
                        zeit: '2026-09-01T08:00:00.000Z', sollPunkt: s.punkte[0].id },
                      { lat: s.punkte[1].lat, lng: s.punkte[1].lng, quelle: 'unbekannt',
                        zeit: '2026-09-01T09:00:00.000Z' }],
             meldungen: [{ zeit: '2026-09-01T08:30:00.000Z', text: 'x' }] } }] });
    const b = p.strecken[0].bau;
    return JSON.stringify({ version: p.version, quellen: b.punkte.map(x => x.quelle),
      nachgetragen: b.punkte.map(x => x.nachgetragen).concat(b.meldungen.map(x => x.nachgetragen)),
      ausfall: [b.ausfallZeit, b.ausfallNach, b.abschnitte[0].ausfallZeit, b.abschnitte[0].ausfallNach],
      von: b.abschnitte[0].vonPunkt === p.strecken[0].punkte[0].id,
      zeiten: b.punkte.map(x => x.zeit) });`).then(JSON.parse);
  b.gleich(alt18.version, 19, 'Er wird auf Schema 19 gehoben');
  b.gleich(alt18.quellen.join(','), 'standort,karte',
    'Die Herkunft bleibt, eine unbekannte fällt auf „Karte“ wie bisher');
  b.pruefe(alt18.nachgetragen.every(x => x === '') && alt18.ausfall.every(x => !x),
    'Nichts gilt nachträglich als vom Papier – das wäre geraten');
  b.pruefe(alt18.von && alt18.zeiten.every(Boolean), 'Abschnitt und Zeiten bleiben, wie sie waren');

  b.abschnitt('Das Absetzen hinterlässt einen Vermerk');
  const vermerk = await seite.auswerten(`
    const bd = await import('./js/baudoku.js');
    const s = window.fbp.store.projekt.strecken[0];
    const vorher = bd.absetzstand(s).stand;
    window.fbp.store.aendern(() => bd.absetzenVermerken(s, 'link'), 'bau');
    const gleich = bd.absetzstand(s).stand;
    window.fbp.store.aendern(() => {
      bd.istPunktSetzen(s, s.punkte[0].lat + 0.004, s.punkte[0].lng + 0.004, { quelle: 'karte' });
    }, 'bau');
    const danach = bd.absetzstand(s);
    return { vorher, gleich, danach: danach.stand, weg: danach.weg, zeit: !!danach.zeit };`);
  b.gleich(vermerk.vorher, 'nie', 'Vor dem ersten Absetzen steht kein Vermerk');
  b.gleich(vermerk.gleich, 'aktuell', 'Nach dem Absetzen gilt die Meldung als aktuell');
  b.gleich(vermerk.weg, 'link', 'Der Weg ist festgehalten');
  b.pruefe(vermerk.zeit, 'Und die Uhrzeit');
  b.gleich(vermerk.danach, 'veraltet',
    'Eine Aufnahme nach dem Absetzen macht den Vermerk veraltet – der Abdruck merkt es');
  b.pruefe(await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const s = window.fbp.store.projekt.strecken[0];
    const schlank = JSON.parse(JSON.stringify(t.alsBaumeldung(window.fbp.store.projekt, [s])));
    return schlank.strecken[0].bau.abgesetzt === undefined;`),
    'Der Vermerk bleibt am Gerät und reist nicht mit der Meldung');

  b.abschnitt('Die Meldung nennt, wer sie absetzt');
  b.pruefe(await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const m = await import('./js/baumeldung.js');
    const s = window.fbp.store.projekt.strecken[0];
    const meldung = t.alsBaumeldung(window.fbp.store.projekt, [s], '2. FmTr · Gruppenführer');
    return m.truppText(meldung).includes('2. FmTr');`),
    'Der Absender des Geräts steht in der Meldung – auch ohne Bauabschnitt');

  b.abschnitt('Der Planer sieht die Vorschau, bevor etwas geschrieben wird');
  await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    window.fbp.store.aendern(() => {
      const a = bd.bauabschnittAnlegen(s);
      a.name = 'Ost'; a.trupp = '3. FmTr';
    }, 'bau');
    const link = await t.meldungAlsLink(p, [s]);
    window.fbp.store.aendern(() => {
      s.bau.abschnitte = s.bau.abschnitte.filter(a => a.name !== 'Ost');
    }, 'bau');
    location.hash = link.split('#')[1];
    return true;`);
  await seite.warteAuf('!!document.querySelector(".meldung-vorschau")', 8000);
  b.pruefe(true, 'Der Dialog steht');
  const vorschautext = (await seite.text('.meldung-vorschau') || '').replace(/\s+/g, ' ');
  b.pruefe(/3\. FmTr/.test(vorschautext), 'Er nennt den Trupp');
  b.pruefe(/Zusammengeführt wird nichts/.test(vorschautext),
    'Und sagt ausdrücklich, dass nicht verschmolzen wird');
  b.pruefe(/Ost/.test(vorschautext), 'Und welchen Bauabschnitt die Meldung betrifft');
  b.gleich(await bau('bau.abschnitte.filter(a => a.name === "Ost").length'), 0,
    'Vor dem Druck auf „Einspielen“ ist nichts geschrieben');

  /* Der Fehlgriff, der eine Meldung kostete: Esc oder ein Tipp neben den
     Dialog schlossen ihn, und weil das Fragment schon geräumt war, holte auch
     ein Neuladen nichts zurück. Beides muss abprallen, und das Fragment muss
     stehen bleiben, bis entschieden ist. */
  await seite.taste('Escape');
  await seite.auswerten('document.getElementById("dialog").click(); return true;');
  await seite.ruhe();
  /* Nicht `sichtbar`: die Hülle liegt fest im Fenster, und ein fest
     positioniertes Element hat gar kein `offsetParent` – die Probe wäre
     immer falsch. Gefragt wird nach dem Merkmal, das der Dialog selbst
     setzt. */
  b.pruefe(await seite.auswerten('!document.getElementById("dialog").hidden'),
    'Esc und Schleiertipp schließen ihn nicht');
  b.pruefe(await seite.auswerten('!!location.hash'),
    'Solange niemand entschieden hat, steht die Meldung noch in der Adresse');
  b.pruefe(await seite.auswerten(
    'document.querySelector(\'[data-akt="dialog-zu"]\').hidden'),
    'Ein Schließkreuz, das nichts täte, steht gar nicht erst da');

  await taste('#dialog-fuss', 'Einspielen');
  await seite.ruhe();
  b.gleich(await bau('bau.abschnitte.filter(a => a.name === "Ost").length'), 1,
    'Danach steht der gemeldete Bauabschnitt in der Planung');
  /* Gefragt wird nach der Sichtbarkeit und nicht nach dem Vorhandensein:
     `schliesseDialog()` blendet die Hülle aus, ohne ihren Inhalt zu leeren. */
  b.pruefe(!(await seite.sichtbar('#dialog')), 'Und der Dialog ist zu');

  b.abschnitt('Verwerfen schreibt nichts');
  await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    window.fbp.store.aendern(() => {
      const a = bd.bauabschnittAnlegen(s);
      a.name = 'West'; a.trupp = '4. FmTr';
    }, 'bau');
    const link = await t.meldungAlsLink(p, [s]);
    window.fbp.store.aendern(() => {
      s.bau.abschnitte = s.bau.abschnitte.filter(a => a.name !== 'West');
    }, 'bau');
    location.hash = link.split('#')[1];
    return true;`);
  /* Auf den offenen Dialog warten, nicht auf die Vorschau: `schliesseDialog()`
     leert den Inhalt nicht, die Vorschau der vorigen Meldung steht also schon
     da. Seit jeder Fußknopf nur einmal wirkt, traf der Griff sonst den
     gesperrten Knopf des alten Dialogs, und die neue Meldung kam erst danach. */
  await seite.warteAuf('!document.getElementById("dialog").hidden && ' +
    '!!document.querySelector(".meldung-vorschau")', 8000);
  await taste('#dialog-fuss', 'Verwerfen');
  await seite.ruhe();
  b.gleich(await bau('bau.abschnitte.filter(a => a.name === "West").length'), 0,
    'Der verworfene Bauabschnitt steht nirgends');
  b.pruefe(!(await seite.auswerten('!!location.hash')),
    'Mit der Entscheidung ist die Adresse geräumt');

  /* Vierte Runde: „Einspielen“ blieb Hauptknopf, wenn derselbe Absender
     weniger meldete, als beim Planer stand; eine Aufnahme 80 km neben der
     Trasse kam ohne Wort an; und vom Inhalt der Meldungen stand im Dialog
     nichts als ihre Zahl. */
  b.abschnitt('Der Empfangsdialog nennt, was verloren ginge, und zeigt, was kommt');
  const fussJetzt = () => seite.auswerten(`return [...document.querySelectorAll('#dialog-fuss .knopf')]
    .map(k => (k.classList.contains('primaer') ? '*' : '') + k.textContent +
      (k.disabled ? '(gesperrt)' : '')).join('|')`);
  const inhaltJetzt = async () => (await seite.text('#dialog-inhalt') || '').replace(/\s+/g, ' ');
  await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    window.fbpMerk = JSON.stringify(s.bau);
    window.fbp.store.aendern(() => { s.bau.gemeldetVon = '1. FmTr'; }, 'meldung');
    window.fbpVoll = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s], '1. FmTr')));
    return true;`);
  const varianten = await seite.auswerten(`
    const bm = await import('./js/baumeldung.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    const v = () => JSON.parse(JSON.stringify(window.fbpVoll));
    const weniger = v(); weniger.strecken[0].bau.punkte = weniger.strecken[0].bau.punkte.slice(0, 1);
    const benannt = v(); benannt.strecken[0].bau.punkte[0].name = 'Muffe 3';
    const fern = v(); fern.strecken[0].bau.punkte.forEach(pt => { pt.lat += 0.75; });
    const uebergeben = v(); uebergeben.strecken[0].bau.stand = 'uebergeben';
    uebergeben.strecken[0].bau.pruefung = { staemme: [{ stamm: '1', bestanden: false }] };
    const neu = v(); (neu.strecken[0].bau.meldungen = neu.strecken[0].bau.meldungen || [])
      .push({ zeit: new Date().toISOString(), text: 'Kabel gerissen bei der Brücke, Ersatz unterwegs' });
    const b = m => bm.befund(p, m, [s.id])[0];
    /* Derselbe Absender wie der Bestand – der Fall, in dem es vorher still blieb. */
    weniger.von = b(v()).bisherVon || weniger.von;
    window.fbpVarianten = { weniger, benannt, fern, uebergeben, neu };
    return {
      weniger: b(weniger).verloren.punkte,
      benannt: b(benannt).verloren.punkte, benanntGeaendert: b(benannt).verloren.punkteGeaendert,
      fern: b(fern).daneben, uebergeben: b(uebergeben).uebergabeFraglich,
      neu: b(neu).neueMeldungen.map(x => x.text).join('|'),
      danach: b(neu).danach && b(neu).danach.bestaetigt
    };`);
  b.pruefe(varianten.weniger >= 1, 'Meldet derselbe Trupp weniger Punkte, zählt der Befund sie als verloren');
  b.gleich(varianten.benannt, 0, 'Ein nachträglich benannter Punkt ist nicht verloren');
  b.gleich(varianten.benanntGeaendert, 1, 'Sondern geändert');
  b.pruefe(varianten.fern && varianten.fern.alle && varianten.fern.naechster > 50000,
    'Eine Aufnahme 80 km neben der Trasse wird erkannt');
  b.gleich(varianten.uebergeben, 'mit durchgefallener Prüfung',
    '„Übergeben“ mit durchgefallener Prüfung wird benannt');
  b.gleich(varianten.neu, 'Kabel gerissen bei der Brücke, Ersatz unterwegs',
    'Neu ist nur die Baumeldung, die hier noch nicht steht');

  const dialogMit = async name => {
    await seite.auswerten(`(await import('./js/ui.js')).baumeldungDialog(
      window.fbpVarianten.${name}, 'Datei'); return true;`);
    await seite.warteAuf('!!document.querySelector(".meldung-vorschau")', 4000);
  };
  await dialogMit('weniger');
  b.pruefe(/kennt \d+ aufgenommene Punkte? nicht/.test(await inhaltJetzt()),
    'Der Dialog sagt es ausdrücklich – „beim Trupp nachfragen“');
  b.pruefe(/^\*Verwerfen\|Erst als Datei sichern\|Einspielen$/.test(await fussJetzt()),
    `Und „Verwerfen“ steht vorn, auch beim selben Absender (${await fussJetzt()})`);
  await taste('#dialog-fuss', 'Verwerfen');
  await dialogMit('fern');
  b.pruefe(/neben der Strecke/.test(await inhaltJetzt()) && /^\*Verwerfen/.test(await fussJetzt()),
    'Eine Aufnahme neben der Trasse wird genannt und stellt „Verwerfen“ nach vorn');
  await taste('#dialog-fuss', 'Verwerfen');
  await dialogMit('uebergeben');
  b.pruefe(/Als übergeben gemeldet, aber mit durchgefallener Prüfung/.test(await inhaltJetzt()),
    'Eine Übergabe mit durchgefallener Prüfung steht im Dialog');
  await taste('#dialog-fuss', 'Verwerfen');
  await dialogMit('neu');
  const neuText = await inhaltJetzt();
  b.pruefe(/Kabel gerissen bei der Brücke/.test(neuText), 'Die neue Baumeldung steht im Wortlaut da');
  b.pruefe(/Bisher .* → danach /.test(neuText), 'Und eine Zeile „bisher → danach“');
  const kurz = await seite.auswerten(
    `return (await import('./js/teilen.js')).meldungsCodeAus(window.fbpVarianten.neu)`);
  b.pruefe(neuText.includes('Rückgabe-Code ' + kurz), `Der Dialog nennt den Rückgabe-Code der Meldung (${kurz})`);
  /* Ein Doppeltipp ergab im Audit zwei Rückgängig-Schritte. */
  const schritte = await seite.auswerten(`
    const vor = window.fbp.store.undoStapel.length;
    const k = [...document.querySelectorAll('#dialog-fuss .knopf')].find(x => x.textContent === 'Einspielen');
    k.click(); k.click();
    return window.fbp.store.undoStapel.length - vor;`);
  b.gleich(schritte, 1, 'Ein Doppeltipp auf „Einspielen“ spielt einmal ein');
  b.pruefe((await seite.text('#hinweisbox') || '').includes('Rückgabe-Code ' + kurz),
    'Die Meldung nach dem Einspielen nennt den Rückgabe-Code zum Zurückfunken');
  b.pruefe(await seite.auswerten(`(await import('./js/ui.js')).zeichneStreckenListe();
    return [...document.querySelectorAll('#strecken-liste .bz-code')]
    .some(e => e.textContent.includes(${JSON.stringify(kurz)}))`),
    'Und er bleibt an der Strecke stehen, nicht nur drei Sekunden in der Pille');

  /* Liegt die Planung nicht hier, wird das gesagt, und eingespielt wird nichts. */
  await seite.auswerten(`const m = JSON.parse(JSON.stringify(window.fbpVoll));
    m.strecken[0].name = 'Strecke, die es hier nicht gibt';
    (await import('./js/ui.js')).baumeldungDialog(m, 'Datei'); return true;`);
  await seite.warteAuf('!!document.querySelector(".meldung-vorschau")', 4000);
  b.pruefe(/liegt nicht in diesem Browser/.test(await inhaltJetzt()),
    'Ohne passende Strecke sagt der Dialog, dass die Planung nicht hier liegt');
  b.pruefe(/\*Verwerfen/.test(await fussJetzt()) && /Einspielen\(gesperrt\)/.test(await fussJetzt()),
    `Und „Einspielen“ ist gesperrt, bis von Hand zugeordnet ist (${await fussJetzt()})`);
  await taste('#dialog-fuss', 'Verwerfen');
  /* Der Code quittierte den Empfang, nicht die Übernahme: der Trupp hörte
     „angekommen“ und hielt die Meldung für eingespielt. */
  await seite.warteAuf('document.getElementById("dialog-titel").textContent === "Dem Trupp durchgeben"', 3000);
  b.pruefe(/Meldung [2-9A-HJ-NP-Z]{4} nicht übernommen – Grund: Planung liegt hier nicht vor/
    .test(await inhaltJetzt()), 'Nach „Verwerfen“ steht die Funkformel mit dem Grund da');
  await taste('#dialog-fuss', 'Schließen');

  /* Kamen mehrere Planungen in Frage, öffnete der Griff die zuletzt
     geänderte – im Audit die Probekopie eines Bauauftrags. */
  b.abschnitt('Kennen mehrere Planungen die Strecke, stehen alle zur Wahl');
  const kandidat = await seite.auswerten(`
    const st = await import('./js/state.js');
    const kopie = (herkunft, name) => {
      const p = JSON.parse(JSON.stringify(window.fbp.store.projekt));
      p.id = st.id(); p.name = name; p.strecken[0].name = 'Kandidatenstrecke';
      p.geaendert = new Date(Date.now() + (herkunft ? 60000 : 0)).toISOString();
      if (herkunft) p.herkunft = { projekt: 'Original', strecke: 'Kandidatenstrecke' };
      st.projektAblegen(p);
      return p.id;
    };
    const ids = [kopie(false, 'Original beim Planer'), kopie(true, 'Probekopie aus dem Auftrag')];
    const m = JSON.parse(JSON.stringify(window.fbpVoll));
    m.strecken[0].name = 'Kandidatenstrecke';
    window.fbpKandidaten = ids;
    (await import('./js/ui.js')).baumeldungDialog(m, 'Datei');
    return ids;`);
  await seite.warteAuf('!!document.querySelector(".meldung-vorschau")', 4000);
  b.pruefe(/In Frage kommen 2 Planungen/.test(await inhaltJetzt()) && /\*Planung wählen/.test(await fussJetzt()),
    `Der Dialog nennt beide und bietet die Wahl an (${await fussJetzt()})`);
  await taste('#dialog-fuss', 'Planung wählen');
  await seite.warteAuf('document.getElementById("dialog-titel").textContent === "Welche Planung?"', 3000);
  const wahlListe = await seite.auswerten(`return [...document.querySelectorAll('#dialog-inhalt .pl-zeile')]
    .map(z => z.textContent.replace(/\\s+/g, ' ').trim())`);
  b.pruefe(wahlListe.length === 2 && /^Original beim Planer/.test(wahlListe[0]) &&
    /aus Bauauftrag übernommen/.test(wahlListe[1]) && /Plan-Nr\. /.test(wahlListe[0]),
    `Die Planung des Planers steht vorn, die übernommene Kopie ist als solche benannt (${wahlListe.join(' / ')})`);
  await taste('#dialog-fuss', 'Zurück zur Meldung');
  await seite.warteAuf('document.getElementById("dialog-titel").textContent === "Baumeldung eingegangen"', 3000);
  await taste('#dialog-fuss', 'Verwerfen');
  await seite.auswerten(`(await import('./js/ui.js')).schliesseDialog();
    for (const id of ${JSON.stringify(kandidat)}) window.fbp.store.loeschen(id); return true;`);
  await seite.ruhe();

  /* Folgemeldung desselben Trupps ohne Verlust: kein Gelb. Und eine
     Teilmeldung „übergeben“ sagt, warum die Strecke im Bau bleibt. */
  b.abschnitt('Die Folgemeldung desselben Trupps ist keine Warnung, der gedeckelte Stand wird erklärt');
  await seite.auswerten(`
    const t = await import('./js/teilen.js');
    const bd = await import('./js/baudoku.js');
    const p = window.fbp.store.projekt;
    const s = p.strecken[0];
    window.fbpMerk2 = JSON.stringify(s.bau);
    window.fbp.store.aendern(() => {
      s.bau = null;
      const nord = bd.bauabschnittAnlegen(s); nord.name = 'Nord'; nord.trupp = '1. FmTr';
      bd.istPunktSetzen(s, s.punkte[0].lat, s.punkte[0].lng, { sollPunkt: s.punkte[0].id, quelle: 'plan', abschnitt: nord.id });
      const sued = bd.bauabschnittAnlegen(s); sued.name = 'Süd'; sued.trupp = '2. FmTr';
      const letzter = s.punkte[s.punkte.length - 1];
      bd.istPunktSetzen(s, letzter.lat, letzter.lng, { sollPunkt: letzter.id, quelle: 'plan', abschnitt: sued.id });
      const z = bd.pruefzeileAnlegen(s); z.stamm = 'Stamm 1'; z.bestanden = true;
      z.zeit = new Date(Date.now() - 3600e3).toISOString();
      s.bau.gemeldetVon = '1. FmTr';
    }, 'bau');
    const planer = JSON.stringify(s.bau);
    window.fbp.store.aendern(() => {
      const nord = s.bau.abschnitte[0];
      bd.istPunktSetzen(s, s.punkte[1].lat, s.punkte[1].lng, { sollPunkt: s.punkte[1].id, quelle: 'plan', abschnitt: nord.id });
      s.bau.pruefung.staemme[0].bestanden = false;
      s.bau.pruefung.staemme[0].zeit = new Date().toISOString();
      s.bau.stand = 'uebergeben';
    }, 'bau');
    const nurNord = new Set([s.bau.abschnitte[0].id]);
    window.fbpFolge = JSON.parse(JSON.stringify(t.alsBaumeldung(p, [s], '1. FmTr', () => nurNord)));
    window.fbp.store.aendern(() => { s.bau = JSON.parse(planer); }, 'bau');
    (await import('./js/ui.js')).baumeldungDialog(window.fbpFolge, 'Datei');
    return true;`);
  await seite.warteAuf('!!document.querySelector(".meldung-vorschau")', 4000);
  const folge = await seite.auswerten(`return {
    folge: (document.querySelector('.mv-folge') || {}).textContent || '',
    gelb: [...document.querySelectorAll('.mv-zeile .bau-warnung')].some(e => /hängt hier schon eine Aufnahme/.test(e.textContent)),
    gedeckelt: ((document.querySelector('.mv-gedeckelt') || {}).textContent || '').replace(/\\s+/g, ' '),
    stamm: [...document.querySelectorAll('.mv-zeile .bau-warnung')].map(e => e.textContent.replace(/\\s+/g, ' ')).join(' | ') };`);
  b.pruefe(/Folgemeldung von 1\. FmTr/.test(folge.folge) && !folge.gelb,
    'Meldet derselbe Trupp ohne Verlust nach, steht eine neutrale Zeile statt Gelb');
  b.pruefe(/Gemeldet: übergeben – die Strecke bleibt .*, weil 2\. FmTr noch offen ist/.test(folge.gedeckelt),
    `„Übergeben“ für einen Abschnitt wird erklärt (${folge.gedeckelt})`);
  b.pruefe(/Stamm 1: hier bestanden, gemeldet durchgefallen – übernommen/.test(folge.stamm),
    'Und der durchgefallene Stamm steht im Dialog');
  await taste('#dialog-fuss', 'Verwerfen');
  await seite.auswerten(`(await import('./js/ui.js')).schliesseDialog();
    window.fbp.store.aendern(() => {
    window.fbp.store.projekt.strecken[0].bau = JSON.parse(window.fbpMerk2); }, 'bau'); return true;`);
  await seite.auswerten(`window.fbp.store.aendern(() => {
    window.fbp.store.projekt.strecken[0].bau = JSON.parse(window.fbpMerk); }, 'bau'); return true;`);
  await seite.ruhe();

  b.abschnitt('Eine präparierte Datei bricht nicht aus');
  const gehaertet = await seite.auswerten(`
    const st = await import('./js/state.js');
    const boese = st.migrieren({
      name: 'Angriff', strecken: [{
        name: 'S', punkte: [{ lat: 51, lng: 10 }],
        bau: {
          stand: '"><script>', abweichung: 'x',
          abschnitte: [{ name: 'A', farbe: 'red" onmouseover="alert(1)' }],
          punkte: [{ lat: 51, lng: 10, art: 'art-boese"><img src=x>', quelle: 'erfunden' }],
          material: [
            { artikel: 'gibt-es-nicht', menge: 'viel', bemerkung: '<img src=x onerror=1>' },
            { artikel: 'fkb', menge: -5 }
          ],
          meldungen: [{ text: 'x', zeit: { boese: true } }],
          pruefung: { staemme: [{ art: 'erfunden', bestanden: 'ja' }],
                      uebergabeAn: { boese: true } }
        }
      }]
    });
    const bau = boese.strecken[0].bau;
    return { stand: bau.stand, farbe: bau.abschnitte[0].farbe,
             art: bau.punkte[0].art, quelle: bau.punkte[0].quelle,
             artikel: bau.material[0].artikel,
             mengeText: bau.material[0].menge,
             mengeNegativ: bau.material[1].menge,
             bemerkungTyp: typeof bau.material[0].bemerkung,
             meldungszeitTyp: typeof bau.meldungen[0].zeit,
             pruefart: bau.pruefung.staemme[0].art,
             bestanden: bau.pruefung.staemme[0].bestanden,
             uebergabeTyp: typeof bau.pruefung.uebergabeAn };`);
  b.gleich(gehaertet.stand, 'offen', 'Ein unbekannter Baustand fällt auf „offen“ zurück');
  b.pruefe(/^#[0-9a-f]{3,8}$/i.test(gehaertet.farbe),
    'Eine präparierte Farbe wird durch eine echte ersetzt');
  /* Seit Schema 16 fällt eine unbekannte Art auf „offen“ zurück und nicht auf
     „Trassenpunkt“: was nicht lesbar ankommt, ist keine Aussage des Trupps. */
  b.gleich(gehaertet.art, 'offen', 'Eine präparierte Punktart wird zurückgeschnitten');
  b.gleich(gehaertet.quelle, 'karte', 'Eine unbekannte Herkunft fällt auf die Vorgabe zurück');
  b.gleich(gehaertet.artikel, 'sonstiges',
    'Ein Artikel, den der Katalog nicht kennt, fällt auf „Sonstiges“ zurück');
  b.gleich(gehaertet.mengeText, null, 'Eine Menge, die keine Zahl ist, wird zu „nichts eingetragen“');
  /* Eine negative Menge ist keine Menge. Sie faellt nicht auf 0, denn 0 hiesse
     „nachweislich nichts verbraucht“ – sie faellt auf „nichts eingetragen“. */
  b.gleich(gehaertet.mengeNegativ, null, 'Und eine negative Menge ebenso');
  b.gleich(gehaertet.bemerkungTyp, 'string', 'Die Bemerkung ist in jedem Fall eine Zeichenkette');
  b.gleich(gehaertet.meldungszeitTyp, 'string', 'Die Zeit einer Meldung ebenso');
  b.gleich(gehaertet.pruefart, 'messung', 'Eine unbekannte Prüfart fällt auf die Vorgabe zurück');
  b.gleich(gehaertet.bestanden, null,
    'Ein Ergebnis, das weder wahr noch falsch ist, wird zu „noch offen“');
  b.gleich(gehaertet.uebergabeTyp, 'string', 'Der Empfänger der Übergabe ist eine Zeichenkette');

  // ------------------------------------------------------------ Einsortieren

  /* Der Fall, für den die Einsortierung da ist: ein Mast, den der Plan nicht
     kennt und der auf halbem Weg gestellt werden musste. Ans Listenende
     gehängt liefe die gebaute Trasse hin und wieder zurück, und die gerechnete
     Länge wäre doppelt so groß wie die gebaute – eine Zahl, die der Planer für
     bare Münze nähme.

     Geprüft wird an einer eigenen, geraden Strecke: die Trasse der übrigen
     Fälle ist mit der Maus über halb Deutschland geklickt, dort sagt eine
     Längenrechnung nichts. */
  b.abschnitt('Ein Punkt ohne Bezug zum Plan hängt sich neben seinen Nachbarn');
  const eingereiht = await seite.auswerten(`
    const st = await import('./js/baudoku.js');
    const zu = await import('./js/state.js');
    const store = window.fbp.store;
    let sid = null;
    store.aendern(p => {
      const s = zu.neueStrecke(p);
      sid = s.id;
      /* Drei Punkte auf einer Geraden, je rund 700 m auseinander */
      for (const lat of [51.800, 51.806, 51.812]) s.punkte.push(zu.neuerPunkt(lat, 10.600));
      p.strecken.push(s);
    }, 'strecke');
    const s = store.strecke(sid);
    store.aendern(() => {
      for (const pt of s.punkte) {
        st.istPunktSetzen(s, pt.lat, pt.lng, { sollPunkt: pt.id, quelle: 'plan' });
      }
    }, 'bau');
    const vorher = Math.round(st.baukennzahlen(s).laenge);
    store.aendern(() => {
      // ein Mast zwischen Punkt 1 und 2, 30 m neben der Trasse
      st.istPunktSetzen(s, 51.803, 10.6004, { quelle: 'karte', art: 'mast' });
    }, 'bau');
    const nachher = Math.round(st.baukennzahlen(s).laenge);
    const stelle = s.bau.punkte.findIndex(pt => !pt.sollPunkt);
    store.aendern(p => { p.strecken = p.strecken.filter(x => x.id !== sid); }, 'strecke');
    return { vorher, nachher, stelle, punkte: s.bau.punkte.length };`);
  b.gleich(eingereiht.stelle, 1, 'Der Mast steht zwischen Punkt 1 und Punkt 2');
  b.pruefe(eingereiht.nachher < eingereiht.vorher * 1.2,
    'Die gebaute Länge wächst nur um den Umweg, nicht um das Doppelte ' +
    `(${eingereiht.vorher} m → ${eingereiht.nachher} m)`);

  // ------------------------------------------------------------ Lücken im Bau

  /* Zwei Trupps bauen von beiden Enden, und in der Mitte ist noch nichts
     aufgenommen. Vorher lief die kräftige Ist-Linie über die offenen Punkte
     durch, und die gebaute Länge zählte das Stück mit – „gebaut 1,56 km“ bei
     1,57 km geplant, wo ein Drittel fehlte. Geprüft an einer eigenen,
     geraden Strecke wie beim Einsortieren. */
  b.abschnitt('Eine Lücke zwischen zwei Bauabschnitten ist keine Trasse');
  const luecke = await seite.auswerten(`
    const st = await import('./js/baudoku.js');
    const zu = await import('./js/state.js');
    const geo = await import('./js/geo.js');
    const store = window.fbp.store;
    const zaehl = sel => document.querySelectorAll(sel).length;
    const linienVorher = zaehl('#karte path.fbp-ist-linie');
    let sid = null;
    store.aendern(p => {
      const s = zu.neueStrecke(p);
      sid = s.id;
      s.name = 'Lückenprobe';
      /* Sechs Punkte auf einer Geraden, je rund 330 m auseinander */
      for (let i = 0; i < 6; i++) s.punkte.push(zu.neuerPunkt(51.700 + i * 0.003, 10.500));
      p.strecken.push(s);
    }, 'strecke');
    const s = store.strecke(sid);
    store.aendern(() => {
      const a = st.bauabschnittAnlegen(s), c = st.bauabschnittAnlegen(s);
      for (const i of [0, 1]) st.istPunktSetzen(s, s.punkte[i].lat, s.punkte[i].lng,
        { sollPunkt: s.punkte[i].id, quelle: 'plan', abschnitt: a.id });
      for (const i of [4, 5]) st.istPunktSetzen(s, s.punkte[i].lat, s.punkte[i].lng,
        { sollPunkt: s.punkte[i].id, quelle: 'plan', abschnitt: c.id });
    }, 'bau');
    await new Promise(r => setTimeout(r, 100));
    const k = st.baukennzahlen(s);
    const v = st.istVerlauf(s);
    const ergebnis = {
      laenge: Math.round(k.laenge), luecke: Math.round(k.lueckeLaenge),
      alleAbstaende: Math.round(geo.streckenlaenge(s.bau.punkte)),
      stuecke: v.stuecke.length, luecken: v.luecken.length,
      linien: zaehl('#karte path.fbp-ist-linie') - linienVorher,
      lueckenlinien: zaehl('#karte path.fbp-ist-luecke'),
      /* Die Bauzeile der Streckenliste nennt die Lücke wie der Bau-Reiter */
      bauzeileText: st.bauzeile(s).text, bauzeileWarn: st.bauzeile(s).warnungen.join(', ')
    };

    /* Bestätigen beide Trupps denselben Treffpunkt, ist das die Naht und keine
       Lücke – und ein Trupp allein mit einem Zusatzpunkt bleibt eine Linie. */
    store.aendern(() => {
      const [a, c] = s.bau.abschnitte;
      for (const i of [2, 3]) st.istPunktSetzen(s, s.punkte[i].lat, s.punkte[i].lng,
        { sollPunkt: s.punkte[i].id, quelle: 'plan', abschnitt: a.id });
      /* Der Treffpunkt: Trupp 2 bestätigt Punkt 4 noch einmal, als eigener
         Punkt seines Abschnitts – so kommt er beim Planer aus zwei Meldungen an */
      const treff = zu.neuerIstPunkt(s.punkte[3].lat, s.punkte[3].lng,
        { sollPunkt: s.punkte[3].id, quelle: 'plan', abschnitt: c.id });
      s.bau.punkte.splice(4, 0, treff);
    }, 'bau');
    ergebnis.treffStuecke = st.istVerlauf(s).stuecke.length;
    store.aendern(() => {
      s.bau.abschnitte = [];
      for (const pt of s.bau.punkte) pt.abschnitt = null;
      s.bau.punkte.splice(4, 1);
      st.istPunktSetzen(s, 51.7045, 10.5003, { quelle: 'karte', art: 'mast' });
    }, 'bau');
    ergebnis.einTruppStuecke = st.istVerlauf(s).stuecke.length;
    ergebnis.einTruppLuecke = st.baukennzahlen(s).lueckeLaenge;

    /* Dieselbe Strecke als „gebaut“ mit durchgefallener Prüfung: sie darf im
       Lageüberblick nicht als grünes „gebaut“ untergehen. */
    store.aendern(() => {
      s.bau.stand = 'gebaut';
      const pr = st.pruefungSichern(s);
      pr.staemme.push(zu.neuePruefzeile({ stamm: '1' }));
      pr.staemme[0].bestanden = false;
    }, 'bau');
    const ui = await import('./js/ui.js');
    ui.zeichneStreckenListe();
    await new Promise(r => setTimeout(r, 100));
    const bz = st.bauzeile(s);
    ergebnis.warnung = bz.warnungen[0] || '';
    ergebnis.zeile = document.querySelector(
      '#strecken-liste article.eintrag[data-sid="' + sid + '"] .bau-zeile')?.textContent || '';
    ergebnis.summe = document.getElementById('strecken-summe').textContent;
    /* Vor jeder Strecke ohne Handlungsbedarf, auch wenn der Name hinten steht */
    const karten = [...document.querySelectorAll('#strecken-liste article.eintrag[data-sid]')];
    const ohneBedarf = karten.filter(x => {
      const t = store.strecke(x.dataset.sid);
      return !(st.bauzeile(t) || { warnungen: [] }).warnungen.length;
    });
    ergebnis.vorn = karten.findIndex(x => x.dataset.sid === sid) <
      (ohneBedarf.length ? karten.indexOf(ohneBedarf[0]) : Infinity);
    ergebnis.standmarke = [...document.querySelectorAll('#karte .strecken-mass')]
      .find(x => x.textContent.includes('Lückenprobe'))?.textContent || '';

    /* „neu“ steht auch an der Standmarke auf der Karte, nicht nur in der Liste */
    const neuVorher = localStorage.getItem('fbp.neu.v1');
    localStorage.setItem('fbp.neu.v1', JSON.stringify({ [sid]: new Date().toISOString() }));
    window.fbp.sl.zeichne();
    ergebnis.neuAufKarte = [...document.querySelectorAll('#karte .strecken-mass')]
      .some(x => x.textContent.includes('Lückenprobe') && x.querySelector('.bz-neu'));
    if (neuVorher === null) localStorage.removeItem('fbp.neu.v1');
    else localStorage.setItem('fbp.neu.v1', neuVorher);
    window.fbp.sl.zeichne();

    /* Eine zweite Strecke, deren Schild genau auf das der ersten fiele: beide
       Anker liegen 40 m auseinander. Und der Einfügegriff der gewählten
       Strecke liegt nicht auf ihrer Teillänge. */
    let nid = null;
    store.aendern(p => {
      const n = zu.neueStrecke(p);
      nid = n.id; n.name = 'Nachbarprobe';
      for (let i = 0; i < 3; i++) n.punkte.push(zu.neuerPunkt(51.7072 + i * 0.001, 10.5006 + i * 0.002));
      p.strecken.push(n);
    }, 'strecke');
    const karte = window.fbp.karte;
    karte.setView([51.7075, 10.5005], 15, { animate: false });
    window.fbp.sl.waehle(sid);
    await new Promise(r => setTimeout(r, 400));
    const kasten = name => [...document.querySelectorAll('#karte .strecken-mass')]
      .find(x => x.textContent.includes(name))?.getBoundingClientRect();
    const a1 = kasten('Lückenprobe'), a2 = kasten('Nachbarprobe');
    const deckt = (a, c) => a && c && a.left < c.right && c.left < a.right &&
      a.top < c.bottom && c.top < a.bottom;
    ergebnis.schilderGetrennt = !!(a1 && a2) && !deckt(a1, a2);
    const masse = [...document.querySelectorAll('#karte .seg-mass')].map(x => x.getBoundingClientRect());
    const griffe = [...document.querySelectorAll('#karte .fbp-einfuegen')].map(x => x.getBoundingClientRect());
    ergebnis.griffe = griffe.length;
    ergebnis.griffAufMass = griffe.filter(g => masse.some(m => deckt(g, m))).length;
    window.fbp.sl.waehle(null);
    store.aendern(p => { p.strecken = p.strecken.filter(x => x.id !== sid && x.id !== nid); }, 'strecke');
    return ergebnis;`);
  b.pruefe(luecke.laenge > 0 && luecke.laenge < luecke.alleAbstaende - 900,
    `Die gebaute Länge zählt die Lücke nicht mit (${luecke.laenge} m statt ` +
    `${luecke.alleAbstaende} m über alle Punkte)`);
  b.pruefe(Math.abs(luecke.luecke - 1000) < 60,
    `Die Lücke läuft über die drei offenen Abschnitte der Planung (${luecke.luecke} m)`);
  b.gleich(luecke.stuecke, 2, 'Zwei gebaute Stücke');
  b.gleich(luecke.linien, 2, 'Auf der Karte zwei Ist-Linien statt einer durchgezogenen');
  b.pruefe(luecke.lueckenlinien >= 1, 'Die Lücke ist als eigene, gestrichelte Linie gezeichnet');
  b.pruefe(/Lücke [\d.,]+ k?m/.test(luecke.bauzeileText) && !/Lücke/.test(luecke.bauzeileWarn),
    `Die Streckenliste nennt die Lücke, ohne zu warnen (${luecke.bauzeileText})`);
  b.gleich(luecke.treffStuecke, 1,
    'Ein Treffpunkt, den beide Trupps bestätigen, verbindet die beiden Stücke');
  b.gleich(luecke.einTruppStuecke, 1, 'Ein Trupp mit Zusatzpunkt baut eine durchgehende Linie');
  b.gleich(luecke.einTruppLuecke, 0, 'Ohne offenen Planpunkt keine Lücke');

  b.abschnitt('Eine durchgefallene Prüfung steht im Lageüberblick');
  b.gleich(luecke.warnung, 'Prüfung nicht bestanden', 'Die Streckenzeile nennt sie zuerst');
  b.pruefe(/⚠ Prüfung nicht bestanden/.test(luecke.zeile),
    `In der Liste mit Warnzeichen neben „gebaut“ (${luecke.zeile.replace(/\s+/g, ' ').trim()})`);
  b.pruefe(/⚠ 1 Prüfung nicht bestanden/.test(luecke.summe), 'Das Summenband zählt sie');
  b.pruefe(luecke.vorn, 'Die Strecke steht vor allen ohne Handlungsbedarf');
  b.pruefe(/Prüfung nicht bestanden/.test(luecke.standmarke),
    'Die Standmarke auf der Karte trägt sie');
  b.pruefe(luecke.neuAufKarte, '„neu“ steht auch an der Standmarke auf der Karte');

  b.abschnitt('Schilder und Griffe decken einander nicht zu');
  b.pruefe(luecke.schilderGetrennt,
    'Zwei Streckenschilder, die aufeinanderfielen, stehen getrennt');
  b.pruefe(luecke.griffe >= 5, `Die gewählte Strecke trägt ihre Einfügegriffe (${luecke.griffe})`);
  b.gleich(luecke.griffAufMass, 0, 'Kein Einfügegriff liegt auf einer Teillänge');
  const palette = await seite.auswerten(`
    const zu = await import('./js/state.js');
    const lum = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
      .map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
    const f = zu.FARBEN;
    return Math.min(...f.map((x, i) => { const a = lum(x), c = lum(f[(i + 1) % f.length]);
      return (Math.max(a, c) + .05) / (Math.min(a, c) + .05); }));`);
  b.pruefe(palette >= 1.4,
    `Aufeinanderfolgende Streckenfarben trennen sich auch in der Helligkeit (mindestens ${palette.toFixed(2)}:1)`);

  // ------------------------------------------------------------ Lage der Führungsstelle

  /* Das Szenario der fünften Runde: neun Strecken an der Elbe, eine
     übergeben, eine mit durchgefallener Prüfung, eine mit zwei Trupps und
     Lücke, eine mit Abweichung und Meldung an den S 6. Sie stehen in einem
     eigenen Einsatzabschnitt, damit die Lagekarte nur sie zeigt – die übrigen
     Strecken dieses Laufs liegen über halb Deutschland verteilt. */
  const lage = await seite.auswerten(`
    const zu = await import('./js/state.js');
    const bd = await import('./js/baudoku.js');
    const store = window.fbp.store;
    const vor = min => new Date(Date.now() - min * 60000).toISOString();
    let aid = null;
    const sids = [];
    store.aendern(p => {
      const ea = zu.neuerEinsatzabschnitt(p); ea.name = 'Lageprobe Elbe'; p.einsatzabschnitte.push(ea);
      aid = ea.id;
      const strecke = (name, trupp, lat, lng, n = 5, dlat = 0.0025, dlng = 0.003) => {
        const s = zu.neueStrecke(p); s.name = name; s.abschnitt = aid; s.trupp = trupp;
        for (let i = 0; i < n; i++) s.punkte.push(zu.neuerPunkt(lat + i * dlat, lng + i * dlng + (i % 2) * 0.0008));
        p.strecken.push(s); sids.push(s.id); return s;
      };
      const alle = (s, ab, bis = s.punkte.length) => s.punkte.slice(0, bis).forEach((pt, i) =>
        bd.istPunktSetzen(s, pt.lat + 0.00003, pt.lng, { sollPunkt: pt.id, quelle: 'plan', zeit: vor(ab - i * 10) }));
      const a = strecke('Deichwache – Sandsackplatz', '1. FmTr', 52.030, 11.700);
      alle(a, 300); a.bau.stand = 'uebergeben';
      bd.pruefzeileAnlegen(a); a.bau.pruefung.staemme[0].bestanden = true;
      const b2 = strecke('Deichwache – Pegel Nord', '2. FmTr', 52.036, 11.716);
      alle(b2, 280); b2.bau.stand = 'gebaut';
      bd.pruefzeileAnlegen(b2); b2.bau.pruefung.staemme[0].bestanden = false;
      const c = strecke('Deichwache – EA-Leitung 1', '1. FmTr, 3. FmTr', 52.012, 11.690, 7, 0.0022, 0.0035);
      alle(c, 90, 2);
      const d = strecke('Pumpwerk – Trafostation', '4. FmTr', 51.995, 11.740);
      alle(d, 200, 2);
      const e = strecke('Pumpwerk – EA 2 Leitung', '5. FmTr', 51.990, 11.760);
      alle(e, 50, 2);
      e.punkte.slice(2, 4).forEach(pt => bd.istPunktSetzen(e, pt.lat + 0.0006, pt.lng + 0.0004,
        { sollPunkt: pt.id, quelle: 'standort', genauigkeit: 8 }));
      e.bau.abweichung = 'Straße an der Schleuse gesperrt, Trasse über Feldweg nach Osten verlegt';
      strecke('EA 2 Leitung – Notstrom', '6. FmTr', 51.985, 11.775, 4);
      const g = strecke('FüSt – EA 1', '7. FmTr', 52.005, 11.720, 6);
      alle(g, 120); g.bau.stand = 'gebaut';
      strecke('FüSt – EA 2', '', 52.000, 11.735, 4);
      strecke('Reserveleitung Fähre', '', 52.020, 11.760, 3);
    }, 'strecke');
    return { aid, sids };`);

  b.abschnitt('„gesehen“ und „erledigt“ wirken ohne Neuladen');
  /* Beides steht im Gerät und nicht in der Planung, und die Liste verglich
     ihre Karten nur mit der Strecke: der Tipp war gespeichert, zu sehen war er
     erst nach dem Neuladen. */
  const quittung = await seite.auswerten(`
    const ui = await import('./js/ui.js');
    const sid = ${JSON.stringify(lage.sids[4])};
    const neuVorher = localStorage.getItem('fbp.neu.v1');
    localStorage.setItem('fbp.neu.v1', JSON.stringify({ [sid]: new Date().toISOString() }));
    ui.zeichneStreckenListe();
    window.fbp.sl.zeichne();
    const karte = () => document.querySelector('#strecken-liste article.eintrag[data-sid="' + sid + '"]');
    const schild = () => [...document.querySelectorAll('#karte .strecken-mass')]
      .find(x => x.textContent.includes('Pumpwerk – EA 2 Leitung'));
    const r = { neuVorher: !!karte()?.querySelector('.bz-neu') };
    [...karte().querySelectorAll('.bz-gesehen')].find(x => /gesehen/.test(x.textContent)).click();
    await new Promise(z => setTimeout(z, 50));
    r.neuNachher = !!karte()?.querySelector('.bz-neu');
    r.s6Vorher = !!schild()?.querySelector('.bz-s6');
    karte().querySelector('.bz-meldung .bz-gesehen').click();
    await new Promise(z => setTimeout(z, 50));
    r.erledigt = !!karte()?.querySelector('.bz-meldung.erledigt');
    r.knopf = karte()?.querySelector('.bz-meldung .bz-gesehen')?.textContent || '';
    r.s6Nachher = !!schild()?.querySelector('.bz-s6');
    karte().querySelector('.bz-meldung .bz-gesehen').click();
    await new Promise(z => setTimeout(z, 50));
    r.wiederOffen = !karte()?.querySelector('.bz-meldung.erledigt');
    if (neuVorher === null) localStorage.removeItem('fbp.neu.v1');
    else localStorage.setItem('fbp.neu.v1', neuVorher);
    return r;`);
  b.pruefe(quittung.neuVorher && !quittung.neuNachher, '„✓ gesehen“ nimmt „neu“ sofort aus der Zeile');
  b.pruefe(quittung.erledigt && /wieder offen/.test(quittung.knopf),
    `„✓ erledigt“ hakt die Meldung an den S 6 sofort ab (Knopf jetzt „${quittung.knopf}“)`);
  b.pruefe(quittung.wiederOffen, 'Und „wieder offen“ nimmt das zurück');
  b.pruefe(quittung.s6Vorher && !quittung.s6Nachher,
    'Die Arbeitskarte trägt „✉ S 6“, bis die Meldung erledigt ist');

  b.abschnitt('Die Standmarke sagt in Worten, was los ist');
  const marken = await seite.auswerten(`
    window.fbp.sl.zeichne();
    const schild = name => [...document.querySelectorAll('#karte .strecken-mass')]
      .find(x => x.textContent.includes(name));
    const s = schild('Pumpwerk – EA 2 Leitung');
    const m = s && s.querySelector('.bz-warn');
    const pane = n => Number(getComputedStyle(window.fbp.karte.getPane(n)).zIndex);
    return {
      warn: [...(s ? s.querySelectorAll('.bz-warn') : [])].map(x => x.textContent.trim()),
      groesse: m ? parseFloat(getComputedStyle(m).fontSize) : 0,
      ebene: s ? s.closest('.leaflet-pane').classList.contains('leaflet-fbp-schilder-pane') : false,
      ueberGriffen: pane('fbp-schilder') > Math.max(pane('fbp-griffe'), 631)
    };`);
  b.pruefe(marken.warn.includes('⚠ 2 Abw.'),
    `Abweichungen stehen als Kurzwort an der Marke, nicht als nacktes ⚠ (${marken.warn.join(', ')})`);
  b.pruefe(marken.groesse >= 11, `Die Marke ist mindestens 11 px groß (${marken.groesse} px)`);
  b.pruefe(marken.ebene && marken.ueberGriffen,
    'Streckenschilder liegen über den Punktmarken, auch wenn die Griffe nach vorn rücken');

  b.abschnitt('Die Schilder der Lagekarte decken einander in keinem Format');
  /* Im Review lag „⚠ Prüfung nicht bestanden“ in allen vier Formaten unter
     dem Schild der Nachbarstrecke, und ein Schild stand über der Oberkante des
     Rahmens. Gemessen wird am Kasten selbst, nicht am Leitstrich. */
  await seite.auswerten(`const m = await import('./js/bauauftrag.js');
    m.oeffneLagekarte(${JSON.stringify(lage.aid)}); return true;`);
  await seite.warteAuf('!!document.querySelector("#druck .leaflet-container")', 20000);
  const lageText = (await seite.text('#druck') || '').replace(/\s+/g, ' ');
  b.pruefe(/Baustand.*Prüfung nicht bestanden/.test(lageText),
    'Die Kennzahl „Baustand“ nennt die durchgefallene Prüfung');
  b.pruefe(/Abw\. ?Punkte abweichend vom Plan gebaut/.test(lageText) && /S 6 ?Meldung des Trupps/.test(lageText),
    'Die Zeichenerklärung erklärt „Abw.“ und „✉ S 6“');
  for (const [format, ausrichtung] of [['A4', 'Quer'], ['A4', 'Hoch'], ['A3', 'Quer'], ['A3', 'Hoch']]) {
    await seite.auswerten(`
      const sel = [...document.querySelectorAll('.druck-steuerung select, #druck select, select')];
      const f = sel.find(s => [...s.options].some(o => o.textContent === 'A4') &&
        [...s.options].some(o => o.textContent === 'A3'));
      const a = sel.find(s => [...s.options].some(o => o.textContent === 'Quer') &&
        [...s.options].some(o => o.textContent === 'Hoch'));
      f.value = [...f.options].find(o => o.textContent === ${JSON.stringify(format)}).value;
      f.dispatchEvent(new Event('change', { bubbles: true }));
      a.value = [...a.options].find(o => o.textContent === ${JSON.stringify(ausrichtung)}).value;
      a.dispatchEvent(new Event('change', { bubbles: true }));
      return true;`);
    await seite.warteAuf('!!document.querySelector("#druck .leaflet-container .strecken-mass")', 20000);
    await new Promise(r => setTimeout(r, 2500));
    const befund = await seite.auswerten(`
      const rahmen = document.querySelector('#druck .leaflet-container').getBoundingClientRect();
      const r = [...document.querySelectorAll('#druck .strecken-mass')].map(x => ({
        n: x.querySelector('b')?.textContent || '', b: x.getBoundingClientRect(),
        warn: !!x.querySelector('.bz-warn') }));
      const paare = [];
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
        const a = r[i].b, c = r[j].b;
        const w = Math.min(a.right, c.right) - Math.max(a.left, c.left);
        const h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (w > 1 && h > 1) paare.push(r[i].n + ' × ' + r[j].n);
      }
      const draussen = r.filter(x => x.b.top < rahmen.top - 1 || x.b.left < rahmen.left - 1 ||
        x.b.bottom > rahmen.bottom + 1 || x.b.right > rahmen.right + 1).map(x => x.n);
      return JSON.stringify({ schilder: r.length, paare, draussen,
        warn: r.filter(x => x.warn).length });`);
    const ergebnis = JSON.parse(befund);
    b.pruefe(ergebnis.schilder >= 9, `${format} ${ausrichtung}: alle Schilder stehen da (${ergebnis.schilder})`);
    b.gleich(ergebnis.paare.length, 0,
      `${format} ${ausrichtung}: kein Schild deckt ein anderes (${ergebnis.paare.join('; ') || 'keins'})`);
    b.gleich(ergebnis.draussen.length, 0,
      `${format} ${ausrichtung}: jedes Schild steht im Rahmen (${ergebnis.draussen.join('; ') || 'alle'})`);
  }
  await seite.auswerten(
    `const m = await import('./js/bauauftrag.js'); m.schliesseBauauftrag(); return true;`);
  await seite.auswerten(`
    const ids = new Set(${JSON.stringify(lage.sids)});
    window.fbp.store.aendern(p => {
      p.strecken = p.strecken.filter(s => !ids.has(s.id));
      p.einsatzabschnitte = p.einsatzabschnitte.filter(a => a.id !== ${JSON.stringify(lage.aid)});
    }, 'strecke');
    return true;`);
  await seite.ruhe();

  // ------------------------------------------------------------ Der Druck

  /* Das gedruckte Blatt ist das Erzeugnis dieser Anwendung, und die drei
     bestehenden zeigen den AUFTRAG. Eine zweite Linie darin hätte weder einen
     Eintrag in der Zeichenerklärung noch ein eigenes Strichmuster für den
     Schwarz-Weiß-Druck – das Blatt der Baudokumentation ist ein eigenes und
     kommt später. Die Ist-Ebene hängt deshalb an der Option `mitIst`, die nur
     die Arbeitskarte setzt; dass das wirklich trägt, wird hier geprüft und
     nicht geglaubt. */
  b.abschnitt('Die Ist-Trasse bleibt aus den drei Druckerzeugnissen heraus');
  for (const [name, ruf] of [
    ['Bauauftrag', 'oeffneBauauftrag(window.fbp.store.projekt.strecken[0].id)'],
    ['Sammel-Bauauftrag', 'oeffneSammeldruck()'],
    ['Lagekarte', 'oeffneLagekarte()']
  ]) {
    await seite.auswerten(`const m = await import('./js/bauauftrag.js'); m.${ruf}; return true;`);
    await seite.warteAuf('!!document.querySelector("#druck")', 20000);
    await seite.warteAuf('document.querySelectorAll("#druck .leaflet-container").length >= 1', 20000);
    b.gleich(await seite.auswerten('document.querySelectorAll("#druck .fbp-istpunkt").length'), 0,
      `Keine Ist-Marke auf dem Blatt „${name}“`);
    b.gleich(await seite.auswerten('document.querySelectorAll("#druck path.fbp-ist-linie").length'), 0,
      `Keine Ist-Linie auf dem Blatt „${name}“`);
    /* Die geplante Trasse tritt neben einer gebauten zur feinen Punktreihe
       zurück – auf der Arbeitskarte. Im Auftrag wäre sie damit kaum noch zu
       sehen, und der Auftrag ist gerade das, was sie zeigt. */
    b.pruefe(!(await seite.auswerten(`
      return [...document.querySelectorAll('#druck path')]
        .some(p => (p.getAttribute('stroke-dasharray') || '').replace(/,/g, ' ').trim() === '1 7');`)),
      `Die geplante Trasse steht auf „${name}“ nicht zurückgenommen da`);
    await seite.auswerten(
      `const m = await import('./js/bauauftrag.js'); m.schliesseBauauftrag(); return true;`);
    await seite.ruhe();
  }

  b.abschnitt('Die Baudokumentation trägt beide Trassen');
  /* Das vierte Erzeugnis ist das Gegenstück zu den dreien darüber: dort darf
     die gebaute Trasse NICHT stehen, hier muss sie. Geprüft wird beides, denn
     eine Option, die überall gleich wirkt, wäre genau der Fehler. */
  await seite.auswerten(`
    const m = await import('./js/bauauftrag.js');
    m.oeffneBaudoku(window.fbp.store.projekt.strecken[0].id); return true;`);
  await seite.warteAuf('!!document.querySelector("#druck")', 20000);
  await seite.warteAuf('document.querySelectorAll("#druck .leaflet-container").length >= 1', 20000);
  b.pruefe(await seite.auswerten('document.querySelectorAll("#druck .fbp-istpunkt").length') > 0,
    'Die aufgenommenen Punkte stehen auf dem Blatt');
  b.pruefe(await seite.auswerten('document.querySelectorAll("#druck path.fbp-ist-linie").length') > 0,
    'Und die gebaute Trasse als durchgezogene Linie');
  /* Gemessen wird das VERHÄLTNIS und nicht die Zeichenkette. Genau daran ist
     die erste Fassung gescheitert: das Muster stand roh als „1 7“ im Attribut,
     während die Linie im Druck auf das Doppelte skaliert wurde – die Punkte
     liefen ineinander und druckten als durchgezogene Linie, und die Prüfung sah
     das Attribut und war zufrieden. Eine Punktreihe ist eine Punktreihe, wenn
     die Lücke breiter bleibt als die Linie dick ist. */
  const gestrichelt = (await seite.auswerten(`
    return [...document.querySelectorAll('#druck path')]
      .map(x => ({ muster: (x.getAttribute('stroke-dasharray') || '').trim(),
                   breite: parseFloat(x.getAttribute('stroke-width')) || 0,
                   kappe: getComputedStyle(x).strokeLinecap }))
      .filter(x => x.muster);`))
    /* Zerlegt wird hier und nicht in der Seite: über das DevTools-Protokoll
       kommen Zahlen aus verschachtelten Objekten nicht verlässlich zurück –
       eine Zeichenkette dagegen schon. */
    .map(x => {
      const teile = x.muster.replace(/,/g, ' ').split(/\s+/).map(Number);
      return { ...x, strich: teile[0], luecke: teile.length > 1 ? teile[1] : teile[0] };
    });
  b.pruefe(gestrichelt.length > 0, `Gestrichelte Linien auf dem Blatt (${gestrichelt.length})`);
  /* Für JEDE gestrichelte Linie, nicht nur für die geplante Trasse: dieselbe
     Rechnung entscheidet auch über die Abweichungslinie, und beide werden mit
     demselben Faktor skaliert. */
  const zugelaufen = gestrichelt.filter(x =>
    !(x.luecke - (x.kappe === 'round' ? x.breite : 0) > 0));
  b.gleich(zugelaufen.length, 0,
    `Keine gestrichelte Linie läuft im Druck zu (${gestrichelt.map(x =>
      x.muster + ' bei ' + x.breite + ' ' + x.kappe).join(', ')})`);
  const sollLinie = gestrichelt.slice().sort((a, c) => c.breite - a.breite)[0];
  b.pruefe(sollLinie && sollLinie.kappe === 'butt',
    'Die geplante Trasse trägt eine stumpfe Kappe – eine runde fräße ihre Lücke');
  b.pruefe(sollLinie && sollLinie.strich < sollLinie.luecke,
    `Und ihr Strich ist kürzer als die Lücke – eine Punktreihe, keine Strichlinie ` +
    `(${sollLinie && sollLinie.muster} bei ${sollLinie && sollLinie.breite} Breite)`);
  const blatttext = (await seite.text('#druck') || '').replace(/\s+/g, ' ');
  b.pruefe(/Baudokumentation Fernmeldebau/.test(blatttext), 'Der Kopf nennt das Erzeugnis');
  b.pruefe(/Zeichenerklärung/.test(blatttext) && /gebaute Trasse/.test(blatttext) &&
    /geplante Trasse/.test(blatttext),
    'Die Zeichenerklärung erklärt beide Linien');
  b.pruefe(/Aufgenommene Punkte/.test(blatttext), 'Die Punkttabelle steht da');
  b.pruefe(/Materialnachweis/.test(blatttext), 'Der Materialnachweis ebenso');
  b.pruefe(/Prüfung und Übergabe/.test(blatttext), 'Prüfung und Übergabe ebenso');
  b.pruefe(/Bestätigungen/.test(blatttext), 'Und die Unterschriften');
  /* MGRS und nicht das am Bildschirm gewählte Format: auf dem Blatt wird die
     Koordinate vorgelesen, und dafür gilt im THW MGRS. */
  b.pruefe(/\b\d{1,2}[A-Z] [A-Z]{2} \d+ \d+/.test(blatttext),
    'Die Koordinaten stehen als MGRS auf dem Blatt');

  b.abschnitt('Die Baudokumentation schaltet alle vier Formate');
  for (const [format, ausrichtung] of [['a4', 'hoch'], ['a4', 'quer'], ['a3', 'hoch'], ['a3', 'quer']]) {
    const mass = await seite.auswerten(`
      const w = document.querySelectorAll('#druck .ds-felder select');
      const setz = (stelle, wert) => {
        const e = w[stelle];
        e.value = wert;
        e.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setz(0, ${JSON.stringify(format)});
      setz(1, ${JSON.stringify(ausrichtung)});
      await new Promise(f => setTimeout(f, 600));
      const doku = document.querySelector('.druck-doku');
      const blatt = document.querySelector('#druck .blatt');
      return { klasse: doku.className,
               breit: Math.round(blatt.getBoundingClientRect().width),
               hoch: Math.round(blatt.getBoundingClientRect().height) };`);
    b.pruefe(mass.klasse.includes(format) && mass.klasse.includes(ausrichtung),
      `${format.toUpperCase()} ${ausrichtung}: das Blatt trägt sein Formatkennwort`);
    const quer = mass.breit > mass.hoch;
    b.gleich(quer, ausrichtung === 'quer',
      `${format.toUpperCase()} ${ausrichtung}: das Blatt liegt richtig herum (${mass.breit}×${mass.hoch})`);
  }
  b.pruefe(await seite.auswerten(`
    const d = document.querySelector('#druck .druck-doku');
    d.classList.add('sw');
    const linien = [...document.querySelectorAll('#druck path.fbp-ist-linie')];
    return linien.length > 0;`), 'Im Schwarz-Weiß-Satz bleibt die gebaute Trasse eine eigene Linie');

  /* Das Feld unter „Abweichungen vom Auftrag“ stand bei 16 mm: die Regel für
     das hohe Feld verlor gegen die allgemeine, die später kam. Gemessen wird
     die Höhe am Element (offsetHeight kennt die Vorschauskalierung nicht). */
  const bdFreitext = await seite.auswerten(`
    const f = document.querySelector('#druck .bl-freitext-hoch');
    return f ? f.offsetHeight / (96 / 25.4) : 0;`);
  b.pruefe(bdFreitext >= 33,
    `Das Feld für die Abweichungen ist hoch genug zum Schreiben (${bdFreitext.toFixed(1)} mm)`);
  /* Der Kopf nennt, was bekannt ist, statt „2 Abschnitte“ in jedes Feld zu
     schreiben – und eine Zeit, die aus den Aufnahmen kommt, sagt das. */
  const bdKopf = await seite.auswerten(`
    const felder = {};
    document.querySelectorAll('#druck .blatt .bl-stamm .st-feld').forEach(f => {
      felder[f.querySelector('.st-titel').textContent.trim()] = f.querySelector('.st-wert').textContent.trim();
    });
    return JSON.stringify(felder);`).then(JSON.parse);
  b.pruefe(!Object.values(bdKopf).some(w => /^\d+ Abschnitte$/.test(w)),
    `Kein Kopffeld sagt nur „N Abschnitte“ (${bdKopf.Trupp} · ${bdKopf.Baubeginn} · ${bdKopf.Bauende})`);
  b.pruefe(/\d{6}[A-Z]{3}\d{2}/.test(bdKopf.Baubeginn || ''),
    'Baubeginn steht als Datum-Zeit-Gruppe da, auch ohne erklärten Beginn');
  /* Solange gebaut wird, heißt das abgeleitete Ende „letzter Eintrag“ und
     nicht „Bauende“ – die Führungsstelle las sonst das Ende eines Baus, der
     noch läuft. */
  const bdEnde = bdKopf.Bauende || bdKopf['letzter Eintrag'] || '';
  b.pruefe(/\d{6}[A-Z]{3}\d{2}/.test(bdEnde) || /beendet/.test(bdEnde),
    'Bauende ebenso – oder wie viele Abschnitte beendet sind');
  const bdStand = await bau('bau.stand');
  b.pruefe(['gebaut', 'uebergeben'].includes(bdStand) || !('Bauende' in bdKopf) ||
    /beendet/.test(bdKopf.Bauende) || !/\(/.test(bdKopf.Bauende),
    `Im laufenden Bau heißt ein abgeleitetes Ende nicht „Bauende“ (${bdStand}: ` +
    `${Object.keys(bdKopf).filter(t => /ende|Eintrag/.test(t)).join(', ')})`);
  b.pruefe((bdKopf.Trupp || '').trim().length > 0 && bdKopf.Trupp !== '–',
    'Der Trupp steht im Kopf');
  await seite.auswerten(
    `const m = await import('./js/bauauftrag.js'); m.schliesseBauauftrag(); return true;`);
  await seite.ruhe();

  b.abschnitt('Der Baumodus stylt die übrigen Blätter nicht um');
  /* Der Bauauftrag haengt als `#druck` in DASSELBE Dokument wie die
     Seitenleiste, und `css/app.css` gilt fuer beide. Ein Klassenname, den der
     Baumodus neu vergibt und den es dort schon gibt, aendert also stillschweigend
     ein gedrucktes Blatt. Genau das ist passiert: `.mat-frei` traegt seit je der
     Kasten fuer handschriftliche Nachtraege im Bauauftrag. Geprueft wird deshalb
     am gerechneten Stil und nicht am Quelltext. */
  await seite.auswerten(`
    const m = await import('./js/bauauftrag.js');
    m.oeffneBauauftrag(window.fbp.store.projekt.strecken[0].id); return true;`);
  await seite.warteAuf('!!document.querySelector("#druck .mat-frei")', 20000);
  const druckstil = await seite.auswerten(`
    const k = document.querySelector('#druck .mat-frei');
    const st = getComputedStyle(k);
    const linien = k.querySelector('.mf-linien');
    return { anzeige: st.display,
             linienBreit: linien ? linien.getBoundingClientRect().width : 0,
             kastenBreit: k.getBoundingClientRect().width };`);
  b.gleich(druckstil.anzeige, 'block',
    'Der Kasten für handschriftliche Nachträge bleibt ein Block');
  b.pruefe(druckstil.linienBreit > druckstil.kastenBreit * 0.7,
    `Die Schreiblinien laufen über die volle Breite (${Math.round(druckstil.linienBreit)} ` +
    `von ${Math.round(druckstil.kastenBreit)} px)`);
  await seite.auswerten(
    `const m = await import('./js/bauauftrag.js'); m.schliesseBauauftrag(); return true;`);
  await seite.ruhe();

  /* Was vom Papier kam, sagt die Baudokumentation: Herkunft „Papier“, der
     Vermerk der Abschrift, von–bis Punkt und der Geräteausfall. In allen vier
     Formaten, Farbe und Schwarz-Weiß – die Tabelle der Bauabschnitte ist um
     zwei Spalten breiter geworden. */
  b.abschnitt('Die Baudokumentation nennt Abschrift und Geräteausfall');
  await seite.auswerten(`window.fbp.store.aendern(() => {
    const s = window.fbp.store.projekt.strecken[0];
    const b = s.bau;
    b.punkte[0].quelle = 'papier';
    b.punkte[0].nachgetragen = new Date().toISOString();
    if (b.meldungen[0]) b.meldungen[0].nachgetragen = new Date().toISOString();
    const a = b.abschnitte[0];
    a.vonPunkt = s.punkte[0].id; a.bisPunkt = s.punkte[s.punkte.length - 1].id;
    a.ausfallZeit = new Date().toISOString(); a.ausfallNach = s.punkte[1].id;
  }, 'bau'); return true;`);
  for (const [format, ausrichtung, farbe] of [
    ['a4', 'hoch', 'farbe'], ['a4', 'quer', 'sw'], ['a3', 'hoch', 'sw'], ['a3', 'quer', 'farbe']
  ]) {
    const doku = await seite.auswerten(`
      localStorage.setItem('fbp.baudoku.v1', JSON.stringify({
        ...JSON.parse(localStorage.getItem('fbp.baudoku.v1') || '{}'),
        format: ${JSON.stringify(format)}, ausrichtung: ${JSON.stringify(ausrichtung)},
        farbe: ${JSON.stringify(farbe)} }));
      const m = await import('./js/bauauftrag.js');
      m.schliesseBauauftrag();
      m.oeffneBaudoku(window.fbp.store.projekt.strecken[0].id);
      for (let i = 0; i < 100 && !document.querySelector('#druck .tab-ist'); i++) {
        await new Promise(r => setTimeout(r, 100));
      }
      const blaetter = [...document.querySelectorAll('#druck .blatt')];
      const ueber = blaetter.map((b, i) => {
        const inh = b.querySelector('.bl-inhalt');
        return inh && inh.scrollHeight > inh.clientHeight + 1 ? i + 1 : 0;
      }).filter(Boolean);
      const tabellen = [...document.querySelectorAll('#druck table')]
        .filter(t => t.scrollWidth > t.parentElement.clientWidth + 1).map(t => t.className);
      const gekappt = [...document.querySelectorAll('#druck .st-wert')]
        .filter(w => w.scrollWidth > w.clientWidth + 1).map(w => w.textContent.trim());
      const ab = document.querySelector('#druck .tab-bauabschnitte');
      return JSON.stringify({
        ueber, tabellen, gekappt,
        sw: document.querySelector('.druck-doku').classList.contains('sw'),
        herkunft: [...document.querySelectorAll('#druck .tab-ist tbody tr')]
          .map(z => z.cells[4]?.textContent.replace(/\\s+/g, ' ').trim()).join(' | '),
        meldung: !!document.querySelector('#druck .tab-meldung .bd-nachtrag'),
        abschnitte: ab ? ab.textContent.replace(/\\s+/g, ' ') : '' });`).then(JSON.parse);
    const name = `${format.toUpperCase()} ${ausrichtung} ${farbe}`;
    b.gleich(doku.sw, farbe === 'sw', `${name}: im richtigen Satz`);
    b.gleich(doku.ueber.join(', '), '', `${name}: kein Blatt der Baudokumentation läuft über`);
    b.gleich(doku.tabellen.join(', '), '', `${name}: keine Tabelle ragt aus dem Satzspiegel`);
    b.gleich(doku.gekappt.join(' | '), '', `${name}: im Kopf wird nichts abgeschnitten`);
    if (format === 'a4' && ausrichtung === 'hoch') {
      b.pruefe(/Papier/.test(doku.herkunft) && /nachgetragen/.test(doku.herkunft),
        `Die Herkunft nennt „Papier“ und die Abschrift (${doku.herkunft.slice(0, 80)})`);
      b.pruefe(doku.meldung, 'Eine abgeschriebene Meldung trägt den Vermerk ebenso');
      b.pruefe(/Pkt\. 1–\d/.test(doku.abschnitte) && /nach Pkt\. 2/.test(doku.abschnitte),
        `Die Bauabschnitte nennen von–bis Punkt und den Geräteausfall (${doku.abschnitte.slice(0, 160)})`);
      b.pruefe(/\(aus Aufnahmen\)/.test(doku.abschnitte),
        'Ohne erklärte Zeit stehen Beginn und Ende aus den Aufnahmen da, gekennzeichnet');
    }
  }
  await seite.auswerten(`const m = await import('./js/bauauftrag.js'); m.schliesseBauauftrag();
    window.fbp.store.undo(); return true;`);
  await seite.ruhe();

  b.abschnitt('Der Baunachweis bildet den Bau-Reiter ab, je Trupp ein Bogen');
  /* Zwei Trupps im Auftrag: jeder bekommt seinen Bogen, weil beide zur selben
     Zeit an verschiedenen Enden der Trasse stehen. Danach wird der Auftrag
     zurückgesetzt – die Prüfungen weiter unten kennen ihn ohne Komma. */
  await seite.auswerten(`window.fbp.store.aendern(p => { p.strecken[0].trupp = 'Trupp Nord, Trupp Süd'; },
    'strecke'); return true;`);
  const nachweisDruck = async (format, ausrichtung, farbe = 'farbe') => {
    await seite.auswerten(`
      localStorage.setItem('fbp.druck.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('fbp.druck.v1') || '{}'),
        format: ${JSON.stringify(format)}, ausrichtung: ${JSON.stringify(ausrichtung)},
        farbe: ${JSON.stringify(farbe)}, baunachweis: true }));
      const m = await import('./js/bauauftrag.js');
      m.oeffneBauauftrag(window.fbp.store.projekt.strecken[0].id); return true;`);
    await seite.warteAuf('!!document.querySelector("#druck .bl-katalog")', 20000);
  };
  const nachweisZu = async () => {
    await seite.auswerten(
      `const m = await import('./js/bauauftrag.js'); m.schliesseBauauftrag(); return true;`);
    await seite.ruhe();
  };
  await nachweisDruck('a4', 'hoch');
  const nw = await seite.auswerten(`
    const v = await import('./js/vorschrift.js');
    const st = await import('./js/state.js');
    const s = window.fbp.store.projekt.strecken[0];
    const blaetter = [...document.querySelectorAll('#druck .blatt')];
    const erstes = blaetter.findIndex(b => b.querySelector('.bl-nachweis-kopf'));
    const katalog = document.querySelector('#druck .bl-katalog');
    const zeilen = [...katalog.querySelectorAll('tbody tr:not(.gruppenzeile)')]
      .map(z => z.cells[0].textContent.trim()).filter(Boolean);
    const gruppen = [...katalog.querySelectorAll('.gruppenzeile')].map(z => z.textContent.trim());
    const eigen = st.kabelById(s.kabeltyp).id;
    const erwartet = v.MATERIALKATALOG.filter(m => !m.mehrfach && m.kabel !== eigen).map(m => m.name);
    const erwarteteGruppen = v.MATERIALGRUPPEN.map(g => g.name)
      .filter(n => n !== 'Sonstiges');
    const pruef = document.querySelector('#druck .tab-nachweis-pruefung');
    const freitext = [...document.querySelectorAll('#druck .bl-baunachweis .bl-freitext-hoch')];
    const kopftext = document.querySelector('#druck .bl-nachweis-kopf').textContent.replace(/\\s+/g, ' ');
    return JSON.stringify({
      kopfe: document.querySelectorAll('#druck .bl-nachweis-kopf').length,
      vorgedruckt: [...document.querySelectorAll('#druck .bl-nachweis-kopf td.vorgedruckt')].map(t => t.textContent),
      folgekoepfe: blaetter.slice(erstes).map(b => b.querySelector('.bl-doktyp').textContent),
      zeilen: zeilen.join('|'), erwartet: erwartet.join('|'),
      gruppen: gruppen.filter(g => !/^Sonstiges/.test(g)).join('|'), erwarteteGruppen: erwarteteGruppen.join('|'),
      sonstiges: gruppen.some(g => /^Sonstiges/.test(g)),
      einheiten: [...katalog.querySelectorAll('td.einheit')].filter(t => t.textContent.trim()).length,
      mengenspalten: katalog.querySelector('thead tr').cells.length,
      pruefKopf: [...pruef.querySelectorAll('th')].map(t => t.textContent.trim()).join('|'),
      kaestenJeStamm: [...pruef.querySelectorAll('tbody tr')].map(z => z.querySelectorAll('.kasten').length),
      freitextMM: freitext.map(f => f.offsetHeight / (96 / 25.4)),
      /* Jede Schreibzeile mit zwei Feldern nebeneinander trägt den Strich
         dazwischen – im Review fehlte er überall außer unter „Sonstiges“. */
      ohneTrenner: [...document.querySelectorAll('#druck .tab-ausfuellen td.ausfuellen + td.ausfuellen')]
        .filter(t => parseFloat(getComputedStyle(t).borderLeftWidth) < 0.5).length,
      kopfSpalten: [...document.querySelector('#druck .tab-nachweis-kopf').querySelectorAll('th')]
        .map(t => t.textContent.trim()).join('|'),
      punktSpalten: [...[...document.querySelectorAll('#druck .bl-baunachweis table')]
        .find(t => /wie geplant/.test(t.textContent)).querySelectorAll('th')].map(t => t.textContent.trim()).join('|'),
      meldSpalten: [...document.querySelector('#druck .tab-nachweis-meldungen').querySelectorAll('th')]
        .map(t => t.textContent.trim()).join('|'),
      blattnr: blaetter.slice(erstes).map(b => b.querySelector('.bl-blattnr').textContent.trim()),
      nachtragText: [...document.querySelectorAll('#druck .bl-baunachweis .tab-fussnote')]
        .map(f => f.textContent).join(' ').replace(/\\s+/g, ' '),
      kopftext });`).then(JSON.parse);
  b.gleich(nw.ohneTrenner, 0, 'Zwei Schreibfelder nebeneinander trennt ein Strich');
  b.pruefe(/\|Baudatum\|/.test(nw.kopfSpalten) && !/\|Datum\|/.test(nw.kopfSpalten),
    `Der Trupp trägt das Baudatum ein, nicht „Datum“ wie im Blattkopf (${nw.kopfSpalten})`);
  b.pruefe(/\|Datum\|Uhrzeit$/.test(nw.punktSpalten),
    `Abweichende und zusätzliche Punkte haben eine Datumsspalte (${nw.punktSpalten})`);
  b.pruefe(/^Datum\|Uhrzeit\|/.test(nw.meldSpalten), `Die Meldungen ebenso (${nw.meldSpalten})`);
  b.pruefe(/\|Datum\|Uhrzeit\|Prüfer$/.test(nw.pruefKopf), `Die Prüfung ebenso (${nw.pruefKopf})`);
  const bogenNord = nw.blattnr.filter(t => /Trupp Nord/.test(t));
  const bogenSued = nw.blattnr.filter(t => /Trupp Süd/.test(t));
  b.pruefe(bogenNord.length > 0 && bogenNord.length + bogenSued.length === nw.blattnr.length &&
    bogenNord.every((t, i) => t.endsWith(`${i + 1}/${bogenNord.length}`)) &&
    bogenSued.every((t, i) => t.endsWith(`${i + 1}/${bogenSued.length}`)),
    `Jeder Bogen zählt seine Blätter selbst (${nw.blattnr.join(' · ')})`);
  b.pruefe(/Vom Baunachweis nachtragen/.test(nw.nachtragText) && /⌖ Koordinate/.test(nw.nachtragText),
    'Die Fußnoten verweisen auf die Griffe, die es im Baumodus gibt');
  b.gleich(nw.kopfe, 2, 'Zwei Trupps im Auftrag, zwei Bögen');
  b.gleich(nw.vorgedruckt.join(', '), 'Trupp Nord, Trupp Süd', 'Jeder Bogen trägt seinen Trupp vorgedruckt');
  b.pruefe(nw.folgekoepfe.length > 1 && nw.folgekoepfe.every(t => t === 'Baunachweis Fernmeldebau'),
    `Jedes Blatt des Nachweises nennt sich Baunachweis, auch die Folgeblätter (${nw.folgekoepfe.length})`);
  b.pruefe(/Bauabschnitt von Punkt/.test(nw.kopftext) && /bis Punkt/.test(nw.kopftext) &&
    /Bau beendet/.test(nw.kopftext),
    'Der Kopf fragt nach Bauabschnitt und Bauende');
  b.pruefe(/Gerät ausgefallen um/.test(nw.kopftext) && /nach Punkt/.test(nw.kopftext),
    'Und nach dem Ausfall des Geräts – ab da gilt das Papier');
  b.gleich(nw.zeilen, nw.erwartet,
    'Der Materialkatalog steht vorgedruckt, in der Reihenfolge des Reiters, ohne die Kabelart der Strecke');
  b.gleich(nw.gruppen, nw.erwarteteGruppen, 'Gruppiert wie im Reiter');
  b.pruefe(nw.sonstiges, 'Darunter freie Zeilen für „Sonstiges“');
  b.gleich(nw.einheiten, nw.erwartet.split('|').length, 'Jede Katalogzeile trägt ihre Einheit');
  b.gleich(nw.mengenspalten, 3, 'Eine Mengenspalte, nicht drei wie auf dem Papierbogen');
  b.pruefe(/\|bestanden\|nicht bestanden\|/.test(nw.pruefKopf) &&
    nw.kaestenJeStamm.length > 0 && nw.kaestenJeStamm.every(n => n === 2),
    `Je Stamm „bestanden“ und „nicht bestanden“ zum Ankreuzen (${nw.kaestenJeStamm.join(', ')})`);
  b.pruefe(nw.freitextMM.length === 2 && nw.freitextMM.every(h => h >= 33),
    `Das Feld „Meldung an den S 6“ ist 34 mm hoch und nicht 16 ` +
    `(${nw.freitextMM.map(h => h.toFixed(1)).join(', ')} mm)`);
  await nachweisZu();

  /* Inhalte sind im Querformat schon vom Blatt gefallen (`CLAUDE.md`): in
     jedem Format darf kein Inhaltsbereich überlaufen, und im Kopf wird nichts
     abgeschnitten – auf A3 hoch stand dort „Feldfernkabel (FFK, au…“. Dazu
     die Zahl der Blätter, die der Nachweis braucht: quer standen es vier je
     Trupp, zwei davon halb leer. */
  for (const [format, ausrichtung, farbe, hoechstens] of [
    ['a4', 'hoch', 'farbe', 2], ['a4', 'quer', 'sw', 3], ['a3', 'hoch', 'sw', 2], ['a3', 'quer', 'farbe', 2]
  ]) {
    await nachweisDruck(format, ausrichtung, farbe);
    const satz = await seite.auswerten(`
      const blaetter = [...document.querySelectorAll('#druck .blatt')];
      const ueber = blaetter.map((b, i) => {
        const inh = b.querySelector('.bl-inhalt');
        return inh && inh.scrollHeight > inh.clientHeight + 1 ? i + 1 : 0;
      }).filter(Boolean);
      const gekappt = [...document.querySelectorAll('#druck .st-wert')]
        .filter(w => w.scrollWidth > w.clientWidth + 1).map(w => w.textContent.trim());
      const nachweis = blaetter.filter(b =>
        b.querySelector('.bl-doktyp')?.textContent === 'Baunachweis Fernmeldebau').length;
      return JSON.stringify({ ueber, gekappt, nachweis });`).then(JSON.parse);
    const name = `${format.toUpperCase()} ${ausrichtung}`;
    b.gleich(satz.ueber.join(', '), '', `${name}: kein Blatt läuft über`);
    b.gleich(satz.gekappt.join(' | '), '', `${name}: im Kopf wird nichts abgeschnitten`);
    b.pruefe(satz.nachweis <= 2 * hoechstens,
      `${name}: der Nachweis braucht höchstens ${hoechstens} Blätter je Trupp (${satz.nachweis} für zwei)`);
    await nachweisZu();
  }
  await seite.auswerten(`window.fbp.store.undo(); return true;`);
  await seite.ruhe();

  b.abschnitt('Aus der Nachtdarstellung gedruckt, bleibt das Blatt hell');
  /* Die Nachtdarstellung legt die Oberflächenvariablen ohne Medienbedingung
     dunkel aus, und die Gitterangabe auf der Druckkarte stand damit hellblau
     auf weißem Papier (1,49:1). Verglichen wird jede gerechnete Farbe im Blatt
     mit derselben am Tag – nicht eine Liste von Klassen, denn die nächste
     Stelle, die eine Variable liest, stünde nicht darin. */
  await nachweisDruck('a4', 'hoch');
  await seite.warteAuf('!!document.querySelector("#druck .gitter-info")', 20000);
  const farben = `
    return [...document.querySelectorAll('#druck .blatt *')].map(e => {
      const st = getComputedStyle(e);
      return st.color + '/' + st.backgroundColor + '/' + st.borderTopColor;
    }).join(';');`;
  const tagFarben = await seite.auswerten(farben);
  await seite.auswerten(`document.body.classList.add('nacht'); return true;`);
  const nachtFarben = await seite.auswerten(farben);
  const kontrast = await seite.auswerten(`
    const lum = c => {
      const [r, g, b] = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const info = document.querySelector('#druck .gitter-info');
    return String(1.05 / (lum(getComputedStyle(info).color) + .05));`).then(Number);
  /* Die Fassung unter den Linien wird nachts dunkel – aber nur auf der
     Arbeitskarte. Die Druckkarte liegt außerhalb von #karte und bleibt weiß. */
  const fassung = await seite.auswerten(`
    const strich = sel => { const e = document.querySelector(sel);
      return e ? getComputedStyle(e).stroke : ''; };
    return { druck: strich('#druck path.fbp-fassung'), karte: strich('#karte path.fbp-fassung') };`);
  await seite.auswerten(`document.body.classList.remove('nacht'); return true;`);
  const fassungTag = await seite.auswerten(`
    const e = document.querySelector('#karte path.fbp-fassung');
    return e ? getComputedStyle(e).stroke : '';`);
  const tagListe = tagFarben.split(';'), nachtListe = nachtFarben.split(';');
  const anders = tagListe.filter((f, i) => f !== nachtListe[i]).length;
  b.pruefe(tagListe.length > 100, `Das Blatt ist aufgebaut (${tagListe.length} Elemente)`);
  b.gleich(anders, 0, 'Nachts gedruckt trägt das Blatt dieselben Farben wie am Tag');
  b.pruefe(kontrast >= 4.5,
    `Die Gitterangabe hält auf weißem Papier ${kontrast.toFixed(1)}:1 (gefordert 4,5:1)`);
  b.gleich(fassung.druck, 'rgb(255, 255, 255)', 'Die Fassung der Linien bleibt auf dem Blatt weiß');
  b.gleich(fassung.karte, 'rgb(13, 18, 24)', 'Auf der Arbeitskarte wird sie nachts dunkel');
  b.gleich(fassungTag, 'rgb(255, 255, 255)', 'Bei Tag ist sie dort weiß');
  /* Das Blatt selbst war hell, aber um es herum stand im Chromium-PDF eine
     schwarze Fläche: `html:has(body.nacht)` und `body.nacht` schlugen die
     Druckregel `html, body { background: #fff }`. Gemessen wird unter den
     Druckregeln, nicht am Bildschirm. */
  await seite.auswerten(`document.body.classList.add('nacht'); return true;`);
  await seite.medium('print');
  const druckGrund = await seite.auswerten(`return {
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor };`);
  await seite.medium('');
  await seite.auswerten(`document.body.classList.remove('nacht'); return true;`);
  b.gleich(druckGrund.html, 'rgb(255, 255, 255)', 'Aus der Nacht gedruckt ist die Seite um das Blatt weiß');
  b.gleich(druckGrund.body, 'rgb(255, 255, 255)', 'Und ebenso der Grund darunter');
  await nachweisZu();

  b.abschnitt('Schild und Hauptknopf halten ihren Kontrast in jeder Streckenfarbe');
  /* Die Länge im Streckenschild stand in Streckenfarbe – Oliv auf Weiß 2,24:1,
     Braun auf dem Nachtschild 1,84:1. Gemessen wird jede Farbe der Palette,
     hell und dunkel, an einem Schild, wie die Karte es baut. Dazu der
     Hauptknopf nachts: #0b2e7a auf der Fläche war 1,38:1. */
  const schildKontrast = await seite.auswerten(`
    const zu = await import('./js/state.js');
    const lum = c => {
      const [r, g, b] = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const verh = (a, b) => { const x = lum(a), y = lum(b);
      return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    /* Der Grund des Schildes ist durchscheinend; gerechnet wird gegen die
       Farbe, die es im Mittel deckt – nachts den dunklen Grund. */
    const deckend = (bg, unter) => {
      const t = bg.match(/[\\d.]+/g).map(Number); const a = t.length > 3 ? t[3] : 1;
      const u = unter.match(/[\\d.]+/g).map(Number);
      return 'rgb(' + [0, 1, 2].map(i => Math.round(t[i] * a + u[i] * (1 - a))).join(',') + ')';
    };
    const pane = document.querySelector('#karte .leaflet-marker-pane') || document.getElementById('karte');
    const schlechteste = {};
    for (const nacht of [false, true]) {
      document.body.classList.toggle('nacht', nacht);
      let min = Infinity;
      for (const f of zu.FARBEN) {
        const h = document.createElement('span');
        h.className = 'strecken-mass';
        h.style.setProperty('--farbe', f);
        h.innerHTML = '<b>Probe</b><span class="wert">1,57 km</span>';
        pane.appendChild(h);
        const grund = deckend(getComputedStyle(h).backgroundColor, nacht ? 'rgb(13,18,24)' : 'rgb(255,255,255)');
        min = Math.min(min, verh(getComputedStyle(h.querySelector('.wert')).color, grund));
        h.remove();
      }
      schlechteste[nacht ? 'nacht' : 'tag'] = min;
    }
    const k = document.createElement('button');
    k.className = 'knopf primaer'; k.textContent = 'Fertig';
    document.body.appendChild(k);
    const flaeche = getComputedStyle(document.body).getPropertyValue('--flaeche').trim();
    const probe = document.createElement('div'); probe.style.background = flaeche;
    document.body.appendChild(probe);
    const knopf = { umriss: verh(getComputedStyle(k).backgroundColor, getComputedStyle(probe).backgroundColor),
      schrift: verh(getComputedStyle(k).backgroundColor, getComputedStyle(k).color) };
    k.remove(); probe.remove();
    document.body.classList.remove('nacht');
    return JSON.stringify({ ...schlechteste, knopf });`).then(JSON.parse);
  b.pruefe(schildKontrast.tag >= 4.5,
    `Bei Tag hält die Länge im Schild in jeder Farbe ${schildKontrast.tag.toFixed(1)}:1`);
  b.pruefe(schildKontrast.nacht >= 4.5,
    `Nachts hält sie ${schildKontrast.nacht.toFixed(1)}:1`);
  b.pruefe(schildKontrast.knopf.umriss >= 3,
    `Der Hauptknopf steht nachts mit ${schildKontrast.knopf.umriss.toFixed(2)}:1 auf der Fläche`);
  b.pruefe(schildKontrast.knopf.schrift >= 4.5,
    `Seine Schrift hält ${schildKontrast.knopf.schrift.toFixed(1)}:1`);

  b.abschnitt('Nachts trägt jede Streckenfarbe auf der dunklen Karte');
  /* Die Farbfolge der vierten Runde brachte Lila (2,29:1) und Braun (2,02:1)
     an die zweite und fünfte Stelle – gegen die dunkle Fassung der
     Nachtdarstellung fast unsichtbar. Durchgespielt wird jede Farbe der
     Palette an einer echten Strecke: Linien und Farbbalken des Schildes,
     gegen den Grund und gegen die Fassung über der hellsten abgedunkelten
     Kachel. Am Tag bleibt die gespeicherte Farbe stehen. */
  const nachtLinien = await seite.auswerten(`
    const zu = await import('./js/state.js');
    const store = window.fbp.store;
    const vorher = store.projekt.strecken[0].farbe;
    const lum = c => {
      const [r, g, b] = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const verh = (a, b) => { const x = lum(a), y = lum(b);
      return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';
    /* Die Fassung deckt zu 85 %; darunter liegt die Kachel, die
       brightness(.45) contrast(1.15) aus Weiß zu #717171 macht. */
    const grund = 'rgb(13, 18, 24)', fassung = 'rgb(28, 32, 37)';
    const bild = () => new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f)));
    const r = { grund: Infinity, fassung: Infinity, schild: Infinity, linien: 0, schilder: 0,
                schlechteste: '', tagFalsch: [] };
    for (const f of zu.FARBEN) {
      store.aendern(p => { p.strecken[0].farbe = f; }, 'strecke');
      await bild();
      const pfade = () => [...document.querySelectorAll('#karte path')]
        .filter(p => p.getAttribute('stroke') === f);
      for (const p of pfade()) {
        if (getComputedStyle(p).stroke !== rgb(f)) r.tagFalsch.push(f);
      }
      document.body.classList.add('nacht');
      for (const p of pfade()) {
        const c = getComputedStyle(p).stroke;
        r.linien++;
        const g = verh(c, grund), h = verh(c, fassung);
        if (Math.min(g, h) < Math.min(r.grund, r.fassung)) r.schlechteste = f + ' → ' + c;
        r.grund = Math.min(r.grund, g); r.fassung = Math.min(r.fassung, h);
      }
      for (const m of document.querySelectorAll('#karte .strecken-fahne')) {
        if (!m.style.getPropertyValue('--farbe').includes(f)) continue;
        r.schilder++;
        const balken = getComputedStyle(m.querySelector('.strecken-mass')).borderLeftColor;
        r.schild = Math.min(r.schild, verh(balken, getComputedStyle(m.querySelector('.strecken-mass')).backgroundColor));
      }
      document.body.classList.remove('nacht');
    }
    store.aendern(p => { p.strecken[0].farbe = vorher; }, 'strecke');
    await bild();
    return JSON.stringify(r);`).then(JSON.parse);
  b.pruefe(nachtLinien.linien >= 10, `Gemessen an ${nachtLinien.linien} Linien und ${nachtLinien.schilder} Schildern`);
  b.pruefe(nachtLinien.grund >= 3,
    `Jede Palettenfarbe hält nachts ${nachtLinien.grund.toFixed(2)}:1 gegen den Grund (schwächste ${nachtLinien.schlechteste})`);
  b.pruefe(nachtLinien.fassung >= 3,
    `Und ${nachtLinien.fassung.toFixed(2)}:1 gegen die Fassung`);
  b.pruefe(nachtLinien.schilder === 0 || nachtLinien.schild >= 3,
    `Der Farbbalken im Schild hält nachts ${nachtLinien.schild.toFixed(2)}:1`);
  b.gleich(nachtLinien.tagFalsch.join(', '), '', 'Am Tag zeichnet die Karte die gespeicherte Farbe');

  b.abschnitt('Fehler- und Warnpille sind bei Tag und Nacht lesbar');
  /* Weiß auf dem Nachtrot hielt 2,51:1, auf dem Nachtorange 2,23:1, und tags
     Weiß auf dem Mahnton 4,24:1. */
  const pillen = await seite.auswerten(`
    const ui = await import('./js/ui.js');
    const lum = c => {
      const [r, g, b] = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const verh = (a, b) => { const x = lum(a), y = lum(b);
      return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const box = document.getElementById('hinweisbox');
    const r = {};
    for (const nacht of [false, true]) {
      document.body.classList.toggle('nacht', nacht);
      for (const art of ['fehler', 'warnung']) {
        ui.hinweis('Probe', art);
        const st = getComputedStyle(box);
        r[(nacht ? 'nacht-' : 'tag-') + art] = verh(st.color, st.backgroundColor);
      }
    }
    document.body.classList.remove('nacht');
    ui.hinweisAus();
    return JSON.stringify(r);`).then(JSON.parse);
  for (const [fall, wert] of Object.entries(pillen)) {
    b.pruefe(wert >= 4.5, `${fall}: die Schrift hält ${wert.toFixed(2)}:1`);
  }

  b.abschnitt('Der Haltering ist nachts zu sehen');
  /* Der Ring stand nachts im dunklen THW-Blau, 1,32:1 gegen die Karte – wer
     eine Marke hielt, sah nicht, dass sie gegriffen war. */
  const ring = await seite.auswerten(`
    const lum = c => {
      const [r, g, b] = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const verh = (a, b) => { const x = lum(a), y = lum(b);
      return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const m = [...document.querySelectorAll('#karte .leaflet-marker-icon')]
      .find(x => x.querySelector(':scope > .fbp-punkt:not(.art-start):not(.art-ziel)'));
    if (!m) return JSON.stringify({ gefunden: false });
    document.body.classList.add('nacht');
    m.classList.add('gehalten');
    /* Der Ring ist seit der fünften Runde ein eigenes Element am Kasten der
       Marke (72 px statt einer Kontur von außen 38 px), sein Hof ein Schatten
       zu beiden Seiten. */
    const st = getComputedStyle(m, '::after');
    const kind = getComputedStyle(m.firstElementChild);
    const hof = (st.boxShadow.match(/rgba?\\([^)]*\\)/) || [''])[0];
    const breiten = [...st.boxShadow.matchAll(/0px 0px 0px ([\\d.]+)px/g)].map(x => parseFloat(x[1]));
    const r = { gefunden: true, grund: verh(st.borderTopColor, 'rgb(13, 18, 24)'),
                hof: hof ? verh(st.borderTopColor, hof) : 0,
                marke: verh(st.borderTopColor, kind.backgroundColor),
                durchmesser: parseFloat(st.width),
                /* Start und Ende tragen die Streckenfarbe als Fläche – gegen
                   jede davon hält kein einzelner Ton. Der Hof muss deshalb
                   den Ring zu beiden Seiten säumen, damit er nie an eine Marke
                   oder Kachel stößt, sondern immer an Dunkel. */
                hofReicht: breiten.length === 2 && /inset/.test(st.boxShadow) &&
                  Math.min(...breiten) >= 3 };
    m.classList.remove('gehalten');
    document.body.classList.remove('nacht');
    return JSON.stringify(r);`).then(JSON.parse);
  b.pruefe(ring.gefunden, 'Eine geplante Marke ist auf der Karte');
  b.pruefe(ring.grund >= 3, `Der Ring hält nachts ${(ring.grund || 0).toFixed(2)}:1 gegen den Grund`);
  b.pruefe(ring.hof >= 3, `Und ${(ring.hof || 0).toFixed(2)}:1 gegen seinen dunklen Hof`);
  b.pruefe(ring.marke >= 3, `Und ${(ring.marke || 0).toFixed(2)}:1 gegen die Marke`);
  b.pruefe(ring.hofReicht, 'Der Hof säumt den Ring zu beiden Seiten – auch an Start und Ende steht er auf Dunkel');
  b.pruefe(ring.durchmesser >= 64,
    `Der Ring misst ${ring.durchmesser} px und steht damit um die Handschuhkuppe herum, nicht unter ihr`);

  b.abschnitt('Die Lagekarte nennt den Lagestand mit Uhrzeit');
  /* Zwei Lagekarten desselben Tages waren an der Wand nicht zu unterscheiden:
     der Kopf trug nur das Datum. */
  await seite.auswerten(`const m = await import('./js/bauauftrag.js'); m.oeffneLagekarte(); return true;`);
  await seite.warteAuf('!!document.querySelector("#druck .blatt")', 20000);
  const lagestand = await seite.auswerten(
    `return document.querySelector('#druck .bl-lagestand')?.textContent || '';`);
  b.pruefe(/^\d{6}[A-Z]{3}\d{2}$/.test(lagestand),
    `Der Kopf trägt den Lagestand als Datum-Zeit-Gruppe (${lagestand || 'fehlt'})`);
  await nachweisZu();

  b.abschnitt('Die übrigen Ausgabewege laufen weiter');
  for (const [name, ruf] of [
    ['GeoJSON', 'geoJSONExportieren()'], ['GPX', 'gpxExportieren()'],
    ['KML', 'kmlExportieren()'],
    ['CSV', 'csvExportieren(window.fbp.store.projekt.strecken[0].id)']
  ]) {
    const ergebnis = await seite.auswerten(`
      const io = await import('./js/io.js');
      try { await io.${ruf}; return 'ok'; } catch (e) { return e.message; }`);
    b.gleich(ergebnis, 'ok', `${name} lässt sich ausgeben`);
  }

  // ------------------------------------------------------------ Konsole

  b.abschnitt('Die Konsole bleibt still');
  const fehler = seite.fehlermeldungen();
  b.pruefe(fehler.length === 0,
    fehler.length ? `Fehler in der Konsole: ${fehler.map(f => f.text).join(' | ')}`
                  : 'Kein Fehler und keine Ausnahme');
} catch (e) {
  /* Ein abgebrochener Lauf ist ein durchgefallener: ohne diese Zeile stünde
     am Ende „Prüfung bestanden“, obwohl die Hälfte nie gelaufen ist. */
  b.pruefe(false, 'Lauf abgebrochen: ' + e.message);
  console.error('\nLauf abgebrochen:', e.message);
  await seite.bildschirmfoto(join(WURZEL, 'pruefung-abbruch.png')).catch(() => {});
  process.exitCode = 1;
} finally {
  b.abschluss();
  await browser.beenden();
  await server.schliessen();
}
