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
  b.pruefe(await seite.auswerten('window.fbp.store.projekt.version') === 16, 'Schema 16');
  b.gleich(await seite.text('#btn-modus'), 'Baumodus', 'Der Umschalter bietet den Baumodus an');
  b.pruefe(await seite.auswerten('document.querySelector("#reiter-bau").hidden'),
    'Der Bau-Reiter steht im Planungsmodus nicht da');

  // ------------------------------------------------------------ Planung anlegen

  b.abschnitt('Eine Strecke planen');
  await seite.klick('#btn-neue-strecke');
  await seite.klickeKarte(760, 380);
  await seite.klickeKarte(900, 460);
  await seite.klickeKarte(1040, 400);
  await seite.taste('Enter');
  b.gleich(await seite.auswerten('window.fbp.store.projekt.strecken[0].punkte.length'), 3,
    'Drei Trassenpunkte gesetzt');
  b.gleich(await bau('1'), null, 'Ohne Baumodus entsteht kein Bau-Block');

  // ------------------------------------------------------------ Umschalten

  b.abschnitt('In den Baumodus wechseln');
  await seite.klick('#btn-modus');
  b.pruefe(await seite.auswerten('document.body.classList.contains("baumodus")'),
    'body trägt die Modusklasse');
  b.gleich(await seite.auswerten(
    '[...document.querySelectorAll(".reiter button")].filter(x => !x.hidden)' +
    '.map(x => x.dataset.reiter).join(",")'),
    'strecken,projekt,bau', 'Drei Reiter, die Planungsreiter sind weg');
  b.pruefe(await seite.auswerten('!document.querySelector("#wz-strecke").offsetParent'),
    'Das Streckenwerkzeug ist weg');
  b.pruefe(await seite.sichtbar('#wz-standort'), 'Das Standortwerkzeug bleibt');
  b.gleich(await seite.anzahl('.bp-zeile'), 3, 'Für jeden geplanten Punkt eine Zeile');

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

  // ------------------------------------------------------------ Standort

  b.abschnitt('Punkt 2 aus dem Standort des Geräts');
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
  await seite.neuLaden();
  await seite.warteAuf('!!window.fbp');
  b.gleich(await bau('bau.punkte.length'), 4, 'Vier Ist-Punkte sind noch da');
  b.gleich(await bau('bau.abschnitte.length'), 1, 'Der Bauabschnitt ist noch da');
  b.pruefe(await seite.auswerten('document.body.classList.contains("baumodus")'),
    'Der Baumodus überlebt das Neuladen');
  b.pruefe(await bau('bau.punkte.every(pt => pt.sollPunkt === null || ' +
    'window.fbp.store.projekt.strecken[0].punkte.some(q => q.id === pt.sollPunkt))'),
    'Kein Verweis zeigt ins Leere');

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
  await taste('.bau-meldungen', 'Meldung jetzt');
  b.gleich(await bau('bau.meldungen.length'), 1, 'Eine Meldung mit einem Griff');
  b.pruefe(await bau('!!bau.meldungen[0].zeit'),
    'Die Uhrzeit trägt sich selbst ein – nachträglich geschätzt wäre sie keine Bauzeit');
  b.pruefe(await bau('!!bau.meldungen[0].abschnitt'),
    'Die Meldung hängt am aktiven Bauabschnitt');
  await seite.schreibe('.bm-zeile input', 'Erste Länge verbaut, Trasse frei');
  await seite.warteAuf(
    "window.fbp.store.projekt.strecken[0].bau.meldungen[0].text.startsWith('Erste Länge')", 3000);
  b.pruefe(true, 'Der Text wird nachgetragen');

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
  await seite.warteAuf('!!document.querySelector(".meldung-vorschau")', 8000);
  await taste('#dialog-fuss', 'Verwerfen');
  await seite.ruhe();
  b.gleich(await bau('bau.abschnitte.filter(a => a.name === "West").length'), 0,
    'Der verworfene Bauabschnitt steht nirgends');
  b.pruefe(!(await seite.auswerten('!!location.hash')),
    'Mit der Entscheidung ist die Adresse geräumt');

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
