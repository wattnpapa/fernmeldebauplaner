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
  b.pruefe(await seite.auswerten('window.fbp.store.projekt.version') === 13, 'Schema 13');
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
  await taste('.bau-punkte', '⌖ Punkt hier');
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
  await seite.breit(1440, 900);

  // ------------------------------------------------------------ Zurück in die Planung

  b.abschnitt('Zurück in den Planungsmodus');
  await seite.klick('#btn-modus');
  b.pruefe(!(await seite.auswerten('document.body.classList.contains("baumodus")')),
    'Die Modusklasse ist weg');
  b.pruefe(await seite.sichtbar('#wz-strecke'), 'Das Streckenwerkzeug ist wieder da');
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
      stand: z.bau ? z.bau.stand : null
    };`);
  b.gleich(rund.istPunkte, 4, 'Alle vier Ist-Punkte kommen an');
  b.gleich(rund.abschnitte, 1, 'Der Bauabschnitt kommt an');
  b.gleich(rund.quellen, rund.quellenVorher, 'Die Herkunft jeder Koordinate bleibt erhalten');
  b.pruefe(rund.verweiseHeil, 'Jeder Verweis zeigt beim Empfänger auf einen echten Punkt');
  b.pruefe(rund.zuordnungGleich, 'Jeder Ist-Punkt bestätigt denselben geplanten wie vorher');
  b.gleich(rund.abschnittZuordnung, 1, 'Die Zuordnung zum Bauabschnitt bleibt');
  b.gleich(rund.stand, 'laeuft', 'Der Baustand reist mit');
  b.pruefe(rund.laenge < 8000,
    `Der Link bleibt unter der Grenze für Mailprogramme (${rund.laenge} Zeichen)`);

  b.abschnitt('Und über die Datei');
  const ueberDatei = await seite.auswerten(`
    const st = await import('./js/state.js');
    const p = window.fbp.store.projekt;
    const kopie = st.migrieren(JSON.parse(JSON.stringify(p)));
    return kopie.strecken[0].bau ? kopie.strecken[0].bau.punkte.length : 0;`);
  b.gleich(ueberDatei, 4, 'Die Sicherungsdatei trägt die Aufnahme');

  b.abschnitt('Eine präparierte Datei bricht nicht aus');
  const gehaertet = await seite.auswerten(`
    const st = await import('./js/state.js');
    const boese = st.migrieren({
      name: 'Angriff', strecken: [{
        name: 'S', punkte: [{ lat: 51, lng: 10 }],
        bau: {
          stand: '"><script>', abweichung: 'x',
          abschnitte: [{ name: 'A', farbe: 'red" onmouseover="alert(1)' }],
          punkte: [{ lat: 51, lng: 10, art: 'art-boese"><img src=x>', quelle: 'erfunden' }]
        }
      }]
    });
    const bau = boese.strecken[0].bau;
    return { stand: bau.stand, farbe: bau.abschnitte[0].farbe,
             art: bau.punkte[0].art, quelle: bau.punkte[0].quelle };`);
  b.gleich(gehaertet.stand, 'offen', 'Ein unbekannter Baustand fällt auf „offen“ zurück');
  b.pruefe(/^#[0-9a-f]{3,8}$/i.test(gehaertet.farbe),
    'Eine präparierte Farbe wird durch eine echte ersetzt');
  b.gleich(gehaertet.art, 'punkt', 'Eine präparierte Punktart wird zurückgeschnitten');
  b.gleich(gehaertet.quelle, 'karte', 'Eine unbekannte Herkunft fällt auf die Vorgabe zurück');

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
