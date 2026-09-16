// geraete-pruefen.mjs – Die Oberfläche auf Telefon und Tablet vermessen
//
// Bedient wurde diese Anwendung bis dahin am Rechner. Am Bauort steht sie auf
// einem Telefon, im Stehen, einhändig, oft mit Handschuh – und was dort nicht
// zu treffen ist, ist nicht da. Diese Prüfung misst deshalb keine Absichten,
// sondern Bildpunkte: Schriftgrößen von Eingabefeldern, wirksame Trefferzonen
// (die `::after`-Aufweitungen also eingerechnet), Überdeckungen und ob eine
// Fläche, die höher ist als der Schirm, überhaupt rollt.
//
// Vier Größen, jede aus einem Grund:
//   360×740  kleines Android – die engste Ansicht, die vorkommt
//   390×844  iPhone hoch     – der Normalfall am Bauort
//   844×390  iPhone quer     – dort war das Dateimenü eine Sackgasse
//   820×1180 iPad hoch       – zwischen Schmal- und Breitansicht
//
//     node scripts/geraete-pruefen.mjs
//     CHROMIUM=/usr/bin/chromium node scripts/geraete-pruefen.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { starteServer, starteBrowser, neuerBefund } from './pruefstand.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Apple nennt 44 pt, Android 48 dp. Gemessen wird gegen 44: das ist die
   Untergrenze, unter der ein Griff nachweislich danebengeht, und die Zahl,
   auf die die Regeln in `@media (pointer: coarse)` gesetzt sind. */
const GRIFF = 44;

/* Getastet wird in ganzen Bildpunkten von einem gerundeten Mittelpunkt aus –
   eine Zone von genau 44 px misst sich je nach Bruchteil ihrer Lage als 43
   oder 44. Ein Bildpunkt Nachsicht, damit die Prüfung nicht an der Rundung
   hängt statt an der Trefferfläche. */
const TASTFEHLER = 1;

/* Unter 16 px zoomt Safari auf iOS beim Fokus in ein Feld hinein und kehrt
   nicht von selbst zurück. Das ist keine Empfehlung, sondern eine Grenze. */
const SCHRIFT = 16;

const server = await starteServer(WURZEL);
const browser = await starteBrowser();
const seite = await browser.seite();
const b = neuerBefund();
const adresse = `http://127.0.0.1:${server.port}/index.html`;

/* Die Messhilfen werden einmal in die Seite gelegt und von dort aus gerufen.
   In Node zu rechnen ginge nicht: gemessen wird mit `elementFromPoint`, und
   das kennt nur der Browser. */
const MESSHILFEN = `
  window._g = {
    /* Die wirksame Trefferfläche, nicht der sichtbare Kasten: eine
       ::after-Zone mit negativem inset vergrößert sie, ohne dass sie in
       getBoundingClientRect auftaucht. Getastet wird deshalb vom Mittelpunkt
       aus nach außen, solange elementFromPoint noch dasselbe Element (oder
       eines seiner Kinder) liefert. */
    treffer(el) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return { breite: 0, hoehe: 0 };
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const meins = (x, y) => {
        const p = document.elementFromPoint(x, y);
        return !!p && (p === el || el.contains(p));
      };
      if (!meins(cx, cy)) return { breite: 0, hoehe: 0, verdeckt: true };
      const weit = (dx, dy) => { let n = 0; while (n < 40 && meins(cx + dx * (n + 1), cy + dy * (n + 1))) n++; return n; };
      return {
        breite: weit(-1, 0) + weit(1, 0) + 1,
        hoehe: weit(0, -1) + weit(0, 1) + 1
      };
    },
    /* Sichtbar heißt: im Bild, nicht null groß, nicht ausgeblendet. Was
       außerhalb steht, wird nicht bemängelt – es ist nicht zu treffen, weil
       es nicht da ist, und das ist eine andere Frage. */
    imBild(el) {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return false;
      if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) return false;
      /* Auch innerhalb jeder rollenden Hülle ganz zu sehen: ein Griff, der zur
         Hälfte über der Kante einer Liste steht, wird beim Tasten von der
         Hülle abgeschnitten und misst sich zu klein. Halb weggerollt ist aber
         kein Fehler der Aufteilung – es ist eine Rollbewegung weit weg. */
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (!/auto|scroll|hidden/.test(c.overflowY + c.overflowX)) continue;
        const h = p.getBoundingClientRect();
        if (r.top < h.top || r.bottom > h.bottom || r.left < h.left || r.right > h.right) return false;
      }
      return true;
    },
    /* Felder, die Schrift tragen. Bereichsregler, Haken, Farbfelder und
       Dateiwähler nicht: ihre Maße hängen nicht an der Schriftgröße. */
    felder(raum) {
      return [...(raum || document).querySelectorAll('input, select, textarea')]
        .filter(e => !['range', 'checkbox', 'radio', 'color', 'file', 'hidden'].includes(e.type))
        /* Nicht offsetParent: in der Schmalansicht steht über der Liste ein
           fest positionierter Vorfahr, und dann ist offsetParent fuer jedes
           Feld darunter null – die Pruefung faende kein einziges Feld und
           bestuende genau deshalb. */
        .filter(e => e.getClientRects().length > 0 &&
                     getComputedStyle(e).visibility !== 'hidden');
    },
    zuKlein(raum) {
      return window._g.felder(raum)
        .filter(e => parseFloat(getComputedStyle(e).fontSize) < ${SCHRIFT})
        .map(e => (e.id || e.className || e.tagName) + ' ' + getComputedStyle(e).fontSize);
    },
    /* Ob irgendeine Regel des Stylesheets für diesen Wähler den sicheren Rand
       des Geräts berücksichtigt. Messen ließe sich das nicht: Chromium gibt
       keine Kerbe her, und env() ist von außen nicht zu setzen. Geprüft wird
       deshalb die Quelle – das hält die Regel fest, auch wenn es sie nicht
       beweist. */
    sichererRand(wahl) {
      for (const bogen of document.styleSheets) {
        let regeln; try { regeln = bogen.cssRules; } catch { continue; }
        /* Erst der Wähler, dann die Verschachtelung: seit CSS-Nesting trägt
           auch eine gewöhnliche Stilregel eine – leere – cssRules-Liste, und
           eine leere Liste ist wahr. Wer auf sie zuerst prüft, sieht keine
           einzige Regel mehr. */
        const suche = liste => {
          for (const r of liste) {
            if (r.selectorText === wahl && r.style && r.style.cssText.includes('safe-area-inset')) return true;
            if (r.cssRules && r.cssRules.length && suche(r.cssRules)) return true;
          }
          return false;
        };
        if (suche(regeln)) return true;
      }
      return false;
    }
  };
  return true;`;

/** Alle Griffe eines Bereichs messen und die zu kleinen benennen */
async function zuKleineGriffe(raum, wahl) {
  return seite.auswerten(`
    const r = document.querySelector(${JSON.stringify(raum)});
    if (!r) return ['Bereich fehlt: ' + ${JSON.stringify(raum)}];
    return [...r.querySelectorAll(${JSON.stringify(wahl)})]
      .filter(e => !(e.closest('.eintrag-kopf') && !e.classList.contains('eintrag-kopf')))
      .filter(e => window._g.imBild(e))
      .map(e => ({ e, m: window._g.treffer(e) }))
      .filter(x => !x.m.verdeckt &&
        (x.m.breite < ${GRIFF - 1} || x.m.hoehe < ${GRIFF - 1}))
      .map(x => (x.e.id || x.e.className || x.e.tagName).toString().slice(0, 44) +
                ' ' + x.m.breite + '×' + x.m.hoehe);`);
}

async function oeffneBauauftrag() {
  await seite.auswerten(`
    const m = await import('./js/bauauftrag.js');
    m.oeffneBauauftrag(window.fbp.store.projekt.strecken[0].id);
    return true;`);
  await seite.warteAuf('!!document.querySelector("#druck")', 20000);
  await seite.warteAuf('document.querySelectorAll("#druck .leaflet-container").length >= 1', 20000);
  await seite.auswerten(MESSHILFEN);
  await seite.ruhe();
}

async function schliesseBauauftrag() {
  await seite.auswerten(
    `const m = await import('./js/bauauftrag.js'); m.schliesseBauauftrag(); return true;`);
  await seite.ruhe();
}

async function stelleEin(breite, hoehe) {
  await seite.schmal(breite, hoehe);
  await seite.auswerten(MESSHILFEN);
  await seite.ruhe();
}

try {
  // ------------------------------------------------------------ Grundlast

  b.abschnitt('Eine Planung anlegen, am Rechner wie bisher');
  await seite.breit(1440, 900);
  await seite.oeffne(adresse);
  await seite.warteAuf('!!window.fbp');
  await seite.klick('#btn-neue-strecke');
  await seite.klickeKarte(760, 380);
  await seite.klickeKarte(900, 460);
  await seite.klickeKarte(1040, 400);
  await seite.taste('Enter');
  b.gleich(await seite.auswerten('window.fbp.store.projekt.strecken[0].punkte.length'), 3,
    'Drei Trassenpunkte stehen');

  // ------------------------------------------------------------ Schriftgröße

  b.abschnitt('Kein Eingabefeld unter 16 px – sonst zoomt iOS hinein');
  await stelleEin(390, 844);
  /* Die Streckenkarte steht schon offen – das Zeichnen klappt sie auf. Ein
     Klick auf die Kopfzeile schlösse sie wieder, und die Prüfung hätte kein
     Feld mehr zu messen. */
  const kleinListe = await seite.auswerten('window._g.zuKlein(document.querySelector(".seite"))');
  /* Ohne diese Zahl bestünde die Prüfung auch dann, wenn sie kein einziges
     Feld gefunden hätte – und genau so hätte sie eine Änderung durchgelassen. */
  const felderListe = await seite.auswerten('window._g.felder(document.querySelector(".seite")).length');
  b.pruefe(felderListe >= 8, `${felderListe} Felder stehen in der Streckenkarte`);
  b.gleich(kleinListe.length, 0, 'Streckenkarte: alle Felder tragen 16 px' +
    (kleinListe.length ? ' – zu klein: ' + kleinListe.join(', ') : ''));

  await seite.klick('#btn-hilfe');
  await seite.warteAuf('!document.getElementById("dialog").hidden');
  b.gleich(await seite.auswerten('document.querySelector(".dialog-inhalt").scrollTop'), 0,
    'Der Dialog öffnet ungerollt – der Fokus schiebt den Text nicht hinaus');
  await seite.taste('Escape');

  // ------------------------------------------------------------ Sichere Bereiche

  b.abschnitt('Sichere Bereiche überall, nicht nur in der Schmalansicht');
  for (const wahl of ['.kopf', '.statusleiste', '.werkzeuge', '.kartenoptionen',
                      '.zeichen-hinweis', '.punktkarte', '.dialog-huelle', '.hinweisbox', '#druck']) {
    b.pruefe(await seite.auswerten(`window._g.sichererRand(${JSON.stringify(wahl)})`),
      `${wahl} berücksichtigt den Rand des Geräts`);
  }

  // ------------------------------------------------------------ Trefferflächen

  b.abschnitt('Trefferflächen in der Kopfzeile und der Streckenkarte');
  const kopf = await zuKleineGriffe('.kopf', 'button');
  b.gleich(kopf.length, 0, 'Kopfzeile: jeder Knopf trägt 44 px' +
    (kopf.length ? ' – zu klein: ' + kopf.join(', ') : ''));
  /* Haken, Regler und Farbfelder tragen ihren Griff in der Beschriftung, die
   sie umhüllt – gemessen wird dort die Hülle, nicht das Kästchen. Und die
   Knöpfe innerhalb einer Eintragskopfzeile nicht: dort ist die ganze Zeile
   der Griff, gemessen 364×50. */
const seitenGriffe = await zuKleineGriffe('.seite',
  'button, select, input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color])');
  b.gleich(seitenGriffe.length, 0, 'Streckenkarte: jeder Griff trägt 44 px' +
    (seitenGriffe.length ? ' – zu klein: ' + seitenGriffe.join(', ') : ''));

  b.abschnitt('Die Marken auf der Karte sind mit dem Finger zu greifen');
  /* Breit, aber mit Finger: gemessen wird `pointer: coarse`, nicht die
     Fensterbreite. Schmal lägen die Marken unter Werkzeugleiste und
     Statusleiste – dann misst die Prüfung die Überdeckung und nicht die
     Trefferfläche, um die es hier geht. */
  await stelleEin(1440, 900);
  /* Die Einfügegriffe stehen nur an der gewählten Strecke – das Aufklappen
     der Karte in der Liste wählt sie nicht mit aus. */
  await seite.auswerten('window.fbp.sl.waehle(window.fbp.store.projekt.strecken[0].id); return true;');
  await seite.warteAuf('document.querySelectorAll(".fbp-einfuegen").length >= 1');
  const marken = await seite.auswerten(`
    /* Sichtbar bleiben die Marken so groß wie geplant – gemessen wird, was
       der Finger trifft, nicht was das Auge sieht. Der Einfügegriff steht
       bewusst kleiner: er sitzt zwischen zwei Trassenpunkten und dürfte sie
       bei kurzen Abschnitten nicht verschlucken. */
    const frei = e => { const m = window._g.treffer(e); return m.verdeckt ? null : m; };
    const punkt = [...document.querySelectorAll('.fbp-punkt')].filter(window._g.imBild)[0];
    const griff = [...document.querySelectorAll('.fbp-einfuegen')].filter(window._g.imBild)[0];
    return {
      punkt: punkt ? frei(punkt) : null,
      griff: griff ? frei(griff) : null
    };`);
  b.pruefe(marken.punkt && marken.punkt.breite >= GRIFF - TASTFEHLER &&
           marken.punkt.hoehe >= GRIFF - TASTFEHLER,
    'Trassenpunkt: ' + JSON.stringify(marken.punkt));
  b.pruefe(marken.griff && marken.griff.breite >= 30 && marken.griff.hoehe >= 30,
    'Einfügegriff: mindestens 30 px statt der 14, die er zeigt – ' + JSON.stringify(marken.griff));
  await stelleEin(390, 844);

  b.abschnitt('Die Hinweisbox steht über dem Umschalter, nicht darauf');
  const lage = await seite.auswerten(`
    (await import('./js/ui.js')).hinweis('Angemerkt');
    /* Sie kommt von unten herauf; gemessen wird, wo sie stehen bleibt, nicht
       wo sie unterwegs war. */
    const box = document.querySelector('.hinweisbox');
    await Promise.all(box.getAnimations().map(a => a.finished.catch(() => {})));
    await new Promise(f => requestAnimationFrame(f));
    const h = box.getBoundingClientRect();
    const w = document.querySelector('.ansicht-wechsel').getBoundingClientRect();
    return { hUnten: Math.round(h.bottom), wOben: Math.round(w.top) };`);
  b.pruefe(lage.hUnten <= lage.wOben,
    `Unterkante ${lage.hUnten} liegt über der Oberkante des Umschalters ${lage.wOben}`);

  // ------------------------------------------------------------ Dateimenü über der Liste

  b.abschnitt('Das Dateimenü liegt schmal über der Liste, nicht dahinter');
  /* Die Kopfzeile lag mit 900 unter der Seitenleiste (1100): sichtbar waren
     zwei Einträge im Band darunter, der Rest stand hinter der Liste. Gemessen
     wird mit elementFromPoint – ein verdeckter Eintrag gibt die Liste zurück. */
  await seite.auswerten('document.getElementById("aw-liste").click(); return true;');
  await seite.ruhe();
  await seite.klick('#btn-datei');
  await seite.warteAuf('!document.querySelector(".menu").hidden');
  const menueFrei = await seite.auswerten(`
    const eintraege = [...document.querySelectorAll('.menu button')].filter(window._g.imBild);
    return { anzahl: eintraege.length,
             verdeckt: eintraege.filter(e => window._g.treffer(e).verdeckt).length };`);
  b.pruefe(menueFrei.anzahl >= 5 && menueFrei.verdeckt === 0,
    `${menueFrei.anzahl} Einträge im Bild, ${menueFrei.verdeckt} davon verdeckt`);
  await seite.taste('Escape');

  // ------------------------------------------------------------ Baumodus auf dem Telefon

  b.abschnitt('Baumodus auf dem Telefon: die Karte bleibt frei');
  await seite.klick('#btn-modus');
  await seite.auswerten('document.getElementById("aw-karte").click(); return true;');
  /* Die Liste schiebt sich in 280 ms zur Seite – gemessen wird, wo alles
     stehen bleibt. */
  await new Promise(r => setTimeout(r, 450));
  if (await seite.auswerten('document.getElementById("ko-kopf").getAttribute("aria-expanded") === "true"')) {
    await seite.klick('#ko-kopf');
  }
  const bauKarte = await seite.auswerten(`
    const k = document.getElementById('karte').getBoundingClientRect();
    const w = document.querySelector('.werkzeuge').getBoundingClientRect();
    const ko = document.querySelector('.kartenoptionen').getBoundingClientRect();
    const sl = document.querySelector('.statusleiste').getBoundingClientRect();
    return { karte: Math.round(k.height), werkzeuge: Math.round(w.height),
             frei: Math.round(w.top - ko.bottom), statusleiste: Math.round(sl.height) };`);
  b.pruefe(bauKarte.werkzeuge <= 64,
    `Die Bauleiste ist ein Streifen: ${bauKarte.werkzeuge} px hoch (höchstens 64)`);
  /* Gemessen: rund 350 von 676 px. Oben stehen Zoomsteuerung und der Kopf
     der Kartenoptionen, unten Bauleiste, Maßstab, Quellenzeile und
     Statusleiste – die Hälfte der Karte bleibt frei, und eine Zeile mehr an
     einer dieser Leisten fiele hier durch. */
  b.pruefe(bauKarte.frei >= bauKarte.karte * 0.5,
    `Zwischen Kartenoptionen und Bauleiste bleiben ${bauKarte.frei} von ${bauKarte.karte} px frei`);
  /* Eine Zeile misst 34 px, zwei rund 60. */
  b.pruefe(bauKarte.statusleiste <= 36, `Die Statusleiste ist einzeilig (${bauKarte.statusleiste} px)`);
  const bauGriffe = await zuKleineGriffe('.werkzeuge', 'button');
  b.gleich(bauGriffe.length, 0, 'Bauleiste: jeder Griff trägt 44 px' +
    (bauGriffe.length ? ' – zu klein: ' + bauGriffe.join(', ') : ''));
  await seite.klick('#ko-kopf');
  await seite.ruhe();
  const koZeilen = await seite.auswerten(
    '[...document.querySelectorAll(".ko-zeile")].filter(z => z.getClientRects().length).length');
  b.gleich(koZeilen, 4, `Die Kartenoptionen zeigen im Baumodus vier Zeilen (${koZeilen})`);
  await seite.klick('#ko-kopf');

  b.abschnitt('Die Punktkarte ist mit dem Finger zu bedienen');
  await seite.auswerten('document.querySelector(".fbp-punkt").click(); return true;');
  await seite.warteAuf('!document.getElementById("punktkarte").hidden');
  const aufnahme = await zuKleineGriffe('#punktkarte', 'button');
  b.gleich(aufnahme.length, 0, 'Offener Punkt: jeder Griff trägt 44 px' +
    (aufnahme.length ? ' – zu klein: ' + aufnahme.join(', ') : ''));
  await seite.auswerten(`
    [...document.querySelectorAll('#punktkarte button')]
      .find(b => b.textContent.includes('Wie geplant')).click(); return true;`);
  await seite.warteAuf('!!document.querySelector("#punktkarte .pk-chip")');
  const pkGriffe = await zuKleineGriffe('#punktkarte', 'button, input');
  b.gleich(pkGriffe.length, 0, 'Aufgenommener Punkt: jeder Griff trägt 44 px' +
    (pkGriffe.length ? ' – zu klein: ' + pkGriffe.join(', ') : ''));
  const pkFelder = await seite.auswerten('window._g.zuKlein(document.getElementById("punktkarte"))');
  b.gleich(pkFelder.length, 0, 'Punktkarte: alle Felder tragen 16 px' +
    (pkFelder.length ? ' – zu klein: ' + pkFelder.join(', ') : ''));
  const pkLage = async () => seite.auswerten(`
    const p = document.getElementById('punktkarte');
    const r = p.getBoundingClientRect();
    const k = document.getElementById('karte').getBoundingClientRect();
    return { oben: Math.round(r.top), unten: Math.round(r.bottom), karteOben: Math.round(k.top),
             schirm: innerHeight, rollt: getComputedStyle(p).overflowY === 'auto' };`);
  const hoch = await pkLage();
  b.pruefe(hoch.unten <= hoch.schirm && hoch.oben >= hoch.karteOben,
    `Hochkant steht das Blatt ganz im Kartenbereich (${hoch.oben}–${hoch.unten}, Karte ab ${hoch.karteOben})`);
  await stelleEin(844, 390);
  const quer = await pkLage();
  b.pruefe(quer.unten <= quer.schirm && quer.oben >= quer.karteOben && quer.rollt,
    `Quer bleibt es im Kartenbereich und rollt (${quer.oben}–${quer.unten} im ${quer.schirm} hohen Fenster)`);
  await stelleEin(390, 844);
  await seite.taste('Escape');
  b.pruefe(await seite.auswerten('document.getElementById("punktkarte").hidden'), 'Esc schließt das Blatt');
  await seite.klick('#btn-modus');
  await seite.auswerten('document.getElementById("aw-liste").click(); return true;');
  await seite.ruhe();

  // ------------------------------------------------------------ Querformat

  b.abschnitt('Querformat: das Dateimenü war eine Sackgasse');
  await stelleEin(844, 390);
  await seite.klick('#btn-datei');
  await seite.warteAuf('!document.querySelector(".menu").hidden');
  const menue = await seite.auswerten(`
    const m = document.querySelector('.menu');
    const r = m.getBoundingClientRect();
    const eintraege = [...m.querySelectorAll('button, a')];
    /* Erreichbar heißt: die Fläche rollt und der Eintrag liegt in ihrem
       Rollbereich – nicht, dass er gerade zu sehen ist. */
    const rollt = getComputedStyle(m).overflowY === 'auto' || m.scrollHeight <= m.clientHeight;
    return { unten: Math.round(r.bottom), schirm: innerHeight, rollt, anzahl: eintraege.length };`);
  b.pruefe(menue.unten <= menue.schirm,
    `Das Menü endet bei ${menue.unten} im ${menue.schirm} hohen Fenster`);
  b.pruefe(menue.rollt, `Alle ${menue.anzahl} Einträge sind durch Rollen erreichbar`);
  await seite.taste('Escape');

  b.abschnitt('Querformat: ein hoher Dialog verliert seinen Fuß nicht');
  await seite.klick('#btn-hilfe');
  await seite.warteAuf('!document.getElementById("dialog").hidden');
  const dialog = await seite.auswerten(`
    const h = document.querySelector('.dialog-huelle');
    const f = document.querySelector('.dialog-fuss button') ||
              document.querySelector('.dialog-kopf button');
    /* Erzwungen zu hoch: auf dem Gerät entsteht dieselbe Lage von selbst,
       sobald die Adressleiste die sichtbare Höhe unter die gemessene drückt.
       Hier wird sie hergestellt, statt auf sie zu warten. */
    document.querySelector('.dialog').style.maxHeight = '108vh';
    await new Promise(r => requestAnimationFrame(r));
    const r = f.getBoundingClientRect();
    return { rollt: getComputedStyle(h).overflowY === 'auto',
             erreichbar: Math.round(r.bottom) <= innerHeight + h.scrollHeight - h.clientHeight,
             unten: Math.round(r.bottom), schirm: innerHeight };`);
  b.pruefe(dialog.rollt, 'Die Hülle nimmt eine Rollbewegung an');
  b.pruefe(dialog.erreichbar,
    `Der Fußknopf ist erreichbar (Unterkante ${dialog.unten}, Fenster ${dialog.schirm})`);
  await seite.taste('Escape');

  // ------------------------------------------------------------ Druckansicht

  b.abschnitt('Die Druckansicht wird im Fahrzeug mit dem Finger freigegeben');
  await stelleEin(390, 844);
  await oeffneBauauftrag();
  const druckFelder = await seite.auswerten('window._g.zuKlein(document.querySelector("#druck"))');
  b.gleich(druckFelder.length, 0, 'Steuerleiste: alle Felder tragen 16 px' +
    (druckFelder.length ? ' – zu klein: ' + druckFelder.join(', ') : ''));
  const druckGriffe = await zuKleineGriffe('.druck-steuerung',
    'button, select, input:not([type=range]):not([type=checkbox]):not([type=color]), .ds-haken');
  b.gleich(druckGriffe.length, 0, 'Steuerleiste: jeder Griff trägt 44 px' +
    (druckGriffe.length ? ' – zu klein: ' + druckGriffe.join(', ') : ''));
  b.pruefe(await seite.auswerten(`
    const t = document.querySelector('.ds-tasten').getBoundingClientRect();
    return Math.round(t.bottom) <= innerHeight;`),
    'Drucken und Schließen stehen im Fenster');
  /* Der Griff ist die ganze Beschriftung, gezielt wird aber auf das Kästchen –
     und mit 13 px ist es das kleinste Ziel der Anwendung gewesen. */
  const haken = await seite.auswerten(`
    return [...document.querySelectorAll('.ds-haken input, .ko-haken input, .ks-haken input')]
      .filter(e => e.getClientRects().length)
      .map(e => Math.round(e.getBoundingClientRect().width))
      .filter(w => w < 20);`);
  b.gleich(haken.length, 0, 'Kein Haken unter 20 px' +
    (haken.length ? ' – gemessen: ' + haken.join(', ') : ''));
  await schliesseBauauftrag();

  b.abschnitt('Tablet hochkant: ein Umbruchpunkt für Anwendung und Blatt');
  await stelleEin(820, 1180);
  await oeffneBauauftrag();
  b.gleich(await seite.auswerten(
    'getComputedStyle(document.getElementById("druck")).flexDirection'), 'column',
    'Die Einstellungen stehen über dem Blatt wie im Rest der Anwendung');
  b.pruefe(await seite.auswerten(`
    const s = document.querySelector('.druck-doku').style.transform || '';
    const m = /scale\\(([\\d.]+)\\)/.exec(s);
    return !m || parseFloat(m[1]) > 0.55;`),
    'Das Blatt wird nicht unter 0,55 eingepasst – darunter sind die Tabellen nicht mehr zu lesen');
  await schliesseBauauftrag();

  // ------------------------------------------------------------ Kein Überlauf

  b.abschnitt('Keine Ansicht läuft waagerecht über');
  for (const [breite, hoehe] of [[360, 740], [390, 844], [844, 390], [768, 1024], [820, 1180]]) {
    await stelleEin(breite, hoehe);
    const ueber = await seite.auswerten(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth');
    b.pruefe(ueber <= 0, `${breite}×${hoehe}: kein waagerechter Überlauf (${ueber} px)`);
  }

  b.abschnitt('Keine Fehler in der Konsole');
  const fehler = seite.fehlermeldungen();
  b.gleich(fehler.length, 0, 'Konsole still' + (fehler.length ? ': ' + fehler[0].text : ''));

} catch (f) {
  console.error('\n  Abbruch:', f.message);
  b.pruefe(false, 'Der Lauf ist durchgefallen: ' + f.message);
} finally {
  b.abschluss();
  await seite.schliessen();
  await browser.beenden();
  await server.schliessen();
}
