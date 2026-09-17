// geraete-pruefen.mjs – Die Oberfläche auf Telefon und Tablet vermessen
//
// Bedient wurde diese Anwendung bis dahin am Rechner. Am Bauort steht sie auf
// einem Telefon, im Stehen, einhändig, oft mit Handschuh – und was dort nicht
// zu treffen ist, ist nicht da. Diese Prüfung misst deshalb keine Absichten,
// sondern Bildpunkte: Schriftgrößen von Eingabefeldern, wirksame Trefferzonen
// (die `::after`-Aufweitungen also eingerechnet), Überdeckungen und ob eine
// Fläche, die höher ist als der Schirm, überhaupt rollt.
//
// Vier Gerätemaße, jedes aus einem Grund:
//   360×740  kleines Android – die engste Ansicht, die vorkommt
//   390×844  iPhone hoch     – der Normalfall am Bauort
//   844×390  iPhone quer     – dort war das Dateimenü eine Sackgasse
//   820×1180 iPad hoch       – zwischen Schmal- und Breitansicht
//
// Dazu vier Fenster, bei denen die Browserleisten schon abgezogen sind – das
// Gerätemaß ist das Glas, die Anwendung bekommt weniger. Die Nutzerfotos des
// Mobil-Audits entstanden in Safari mit Adressleiste, und die meisten
// Höhenbefunde entstehen erst dort:
//   320×568  iPhone SE der ersten Generation – die engste Höhe, die vorkommt
//   375×667  iPhone 8 mit Leisten
//   390×690  iPhone 12–15 in Safari mit Adressleiste – so sahen die Fotos aus
//   667×375  iPhone 8 quer mit Leisten
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

/* Alle acht Fenster, in denen die Kartenaufsätze durchgemessen werden. Die
   Gerätemaße stehen mit dabei: was am Glas noch passt, kann mit Leisten schon
   vom Blatt fallen, und die Tabelle am Ende zeigt beides nebeneinander. */
const FENSTER = [
  [320, 568], [360, 740], [375, 667], [390, 690], [390, 844], [820, 1180],
  [667, 375], [844, 390]
];

/* Die freie Kartenfläche als Anteil der Fensterhöhe – das ist die Abnahme für
   die Pakete, die auf das Mobil-Audit folgen. Sie darf heute rot sein: sie
   benennt den Ausgangsstand, gegen den gebaut wird, und bricht den Lauf nicht
   ab. Die Zahlen kommen aus der Bauleiste: dort hält das Projekt „mehr als die
   Hälfte der Karte frei“ schon am Gerätemaß, mit Leisten bleiben davon rund
   45 %. Der Planungsmodus trägt sechs Werkzeuge statt vier, das offene Blatt
   der Punktkarte braucht selbst die Hälfte – deshalb die beiden kleineren
   Werte. */
const FREI_PLANUNG = 0.35;
const FREI_BAU = 0.45;
const FREI_PUNKTKARTE = 0.30;

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
    },
    /* Was kein Element findet, hat nichts bestanden – dieselbe Regel wie bei
       felderListe unten: eine Prüfung, die ins Leere greift, ließe genau die
       Änderung durch, die das Element umbenannt oder entfernt hat. Deshalb
       wirft jeder Zugriff der Fensterprüfungen, statt still null zu liefern;
       der Fall wird dann als durchgefallen gezählt, nicht als bestanden. */
    muss(wahl, raum) {
      const e = (raum || document).querySelector(wahl);
      if (!e) throw new Error('Nicht gefunden: ' + wahl);
      return e;
    },
    /* Das Rechteck eines Elements, das wirklich da ist – sonst null. Ein
       ausgeblendetes hat keine Client-Rechtecke, ein leeres deckt nichts. */
    kasten(el) {
      if (!el || !el.getClientRects().length) return null;
      if (getComputedStyle(el).visibility === 'hidden') return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    },
    /* Ein kurzer Name für das, was elementFromPoint geliefert hat: so steht
       im Befund, WAS den Griff verdeckt, nicht nur, dass er verdeckt ist. Ein
       namenloses span (das „+“ der Zoomsteuerung) sagt nichts – genannt wird
       der nächste Vorfahr, der eine Kennung oder Klasse trägt. Die
       Zeichenkette liegt in einem Template-Literal, deshalb der doppelte
       Rückstrich vor dem s. */
    name(p) {
      while (p && !p.id && !(typeof p.className === 'string' && p.className.trim())) {
        p = p.parentElement;
      }
      if (!p) return 'außerhalb';
      if (p.id) return '#' + p.id;
      return '.' + p.className.trim().split(/\\s+/).slice(0, 2).join('.');
    },
    /* Ein Griff ist treffbar, wenn jeder Punkt seiner Fläche ihn trifft – nicht
       nur die Mitte. Halb verdeckt heißt am Bauort: die eine Hälfte zoomt, die
       andere schließt. Getastet im 4-px-Raster; zurück kommt der Anteil und,
       was stattdessen getroffen wurde – das ist der Befund. Ein Vorfahr zählt
       nicht als Verdeckung: an einer abgerundeten Ecke liegt das Elternelement
       frei, und das ist die Form des Knopfes, nichts, was auf ihm liegt. */
    deckung(el) {
      const r = el.getBoundingClientRect();
      const fremd = new Map();
      let punkte = 0;
      for (let y = r.top + 3; y < r.bottom - 1; y += 4) {
        for (let x = r.left + 3; x < r.right - 1; x += 4) {
          punkte++;
          const p = document.elementFromPoint(x, y);
          if (p === el || el.contains(p) || (p && p.contains(el))) continue;
          const n = window._g.name(p);
          fremd.set(n, (fremd.get(n) || 0) + 1);
        }
      }
      const verdeckt = [...fremd.values()].reduce((a, b) => a + b, 0);
      return {
        anteil: punkte ? verdeckt / punkte : 1,
        durch: [...fremd.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
      };
    },
    /* Lage eines Griffs in einem Satz Zahlen: ganz im Bild (auch innerhalb
       seiner rollenden Hülle), Ober- und Unterkante, wovon er verdeckt ist –
       und welcher Rahmen ihn abschneidet, wenn er nicht im Bild ist: das
       Fenster oder eine rollende Hülle wie das Blatt der Punktkarte. Ohne
       den Rahmen liest sich „Unterkante 611 im 690 hohen Fenster“ wie ein
       Widerspruch. */
    lage(el) {
      const d = window._g.deckung(el);
      const r = el.getBoundingClientRect();
      let rahmen = 'Fenster 0–' + innerHeight;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (!/auto|scroll|hidden/.test(c.overflowY + c.overflowX)) continue;
        const h = p.getBoundingClientRect();
        if (r.top < h.top || r.bottom > h.bottom) {
          rahmen = window._g.name(p) + ' zeigt ' + Math.round(h.top) + '–' + Math.round(h.bottom);
          break;
        }
      }
      return { imBild: window._g.imBild(el), oben: Math.round(r.top), unten: Math.round(r.bottom),
               verdeckt: d.anteil, durch: d.durch, rahmen };
    },
    /* Die freie Kartenfläche: die Höhe von #karte abzüglich des Bandes, das
       oben belegt ist (Kartenoptionen, Zoomsteuerung, Popup), und dessen, was
       unten darüberliegt (Statusleiste, Werkzeuge bzw. Bauleiste, Punktkarte,
       Modusleiste, Maßstab, Quellenzeile, Hinweisbox). Gerechnet in Bändern,
       nicht in Flächen: der Streifen Karte neben der Zoomsteuerung ist keine
       Arbeitsfläche, auf der sich eine Trasse antippen ließe. Als Anteil der
       Fensterhöhe, damit die Zahl zwischen den Fenstern vergleichbar bleibt –
       und weil das Fenster ist, was der Nutzer in der Hand hat. */
    freieKarte() {
      const karte = window._g.muss('#karte').getBoundingClientRect();
      /* Aufsätze der Karte. Welcher oben und welcher unten liegt, steht nicht
         fest: die Werkzeugleiste ist schmal ein Streifen über der Statusleiste
         und breit eine Spalte oben links. Entschieden wird deshalb nach der
         gemessenen Lage – liegt die Mitte eines Aufsatzes in der oberen Hälfte
         der Karte, zehrt er von oben, sonst von unten. Fest zugeordnet ergab
         das in der Breitansicht eine Untergrenze über der Obergrenze und damit
         null freie Fläche, wo die Karte in Wahrheit fast leer war. */
      const AUFSAETZE = ['.kartenoptionen', '.leaflet-control-zoom', '.leaflet-popup',
                         '.statusleiste', '.werkzeuge', '#punktkarte', '.zeichen-hinweis',
                         '.leaflet-control-scale', '.leaflet-control-attribution', '.hinweisbox'];
      const ueberlappt = r => r.bottom > karte.top && r.top < karte.bottom &&
                              r.right > karte.left && r.left < karte.right;
      const belegt = [];
      let oben = karte.top, unten = karte.bottom;
      const mitte = karte.top + karte.height / 2;
      for (const wahl of AUFSAETZE) for (const el of document.querySelectorAll(wahl)) {
        const r = window._g.kasten(el);
        if (!r || !ueberlappt(r)) continue;
        if (r.top + r.height / 2 < mitte) {
          oben = Math.max(oben, Math.min(r.bottom, karte.bottom));
          belegt.push(wahl + ' bis ' + Math.round(r.bottom));
        } else {
          unten = Math.min(unten, Math.max(r.top, karte.top));
          belegt.push(wahl + ' ab ' + Math.round(r.top));
        }
      }
      const frei = Math.max(0, unten - oben);
      return { frei: Math.round(frei), karte: Math.round(karte.height),
               oben: Math.round(oben), unten: Math.round(unten),
               anteil: frei / innerHeight, belegt };
    },
    /* Ein freier Fleck in der oberen rechten Kartenhälfte, auf den sich tippen
       lässt: Kacheln oder der Kartenboden, keine Marke, kein Aufsatz. Gesucht
       wird in einem kleinen Raster, denn wo die Trasse liegt, hängt vom
       Fenster ab. Findet sich keiner, ist das selbst der Befund. */
    freierFleck() {
      const karte = window._g.muss('#karte').getBoundingClientRect();
      const versuche = [];
      /* Von oben nach unten: je höher der Tipp, desto eher schiebt sich das
         Popup unter die Kartenoptionen – dort fand das Audit den Fall. */
      for (const fy of [0.2, 0.3, 0.4, 0.5]) for (const fx of [0.65, 0.55, 0.8, 0.9]) {
        const x = Math.round(karte.left + karte.width * fx);
        const y = Math.round(karte.top + karte.height * fy);
        const p = document.elementFromPoint(x, y);
        const frei = !!p && !!p.closest('#karte') &&
          !p.closest('.leaflet-marker-pane, .leaflet-overlay-pane, ' +
                     '.leaflet-control, .leaflet-popup');
        if (frei) return { x, y };
        versuche.push(window._g.name(p));
      }
      return { x: null, y: null, getroffen: [...new Set(versuche)] };
    },
    kartenoptionen() {
      const tafel = window._g.muss('#kartenoptionen');
      const zeilen = [...tafel.querySelectorAll('.ko-zeile')].filter(z => window._g.kasten(z));
      if (!zeilen.length) throw new Error('Keine Zeile in den Kartenoptionen');
      const rollt = [tafel, tafel.querySelector('.ko-koerper')].some(e => e &&
        /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1);
      /* Eine Zeile im Bild muss zu treffen sein; eine außerhalb ist nur dann
         in Ordnung, wenn die Tafel rollt und sie so heranzuholen ist. */
      const fehl = zeilen
        .filter(z => window._g.imBild(z) ? window._g.deckung(z).anteil > 0 : !rollt)
        .map(z => (z.querySelector('span') || z).textContent.trim().slice(0, 22));
      return { unten: Math.round(tafel.getBoundingClientRect().bottom), schirm: innerHeight,
               rollt, zeilen: zeilen.length, fehl };
    },
    /* Jeder Eintrag des Dateimenüs auf Handschuhmaß. Getastet wird in
       Schritten wie im Bau-Reiter: das Menü ist gedeckelt und rollt, und was
       gerade über oder unter seiner Kante steht, misst sich beschnitten zu
       klein. Gewertet wird das größte Maß, das ein Eintrag in irgendeinem
       Rollstand erreicht – das ist die Fläche, die der Finger vorfindet,
       wenn er ihn ansteuert. */
    dateiGriffe() {
      const m = window._g.muss('.menu');
      if (m.hidden) throw new Error('Das Dateimenü ist zu');
      const eintraege = [...m.querySelectorAll('button, a')].filter(e => window._g.kasten(e));
      if (!eintraege.length) throw new Error('Kein Eintrag im Dateimenü');
      const beste = new Map();
      const alt = m.scrollTop;
      const schritt = Math.max(40, m.clientHeight - 60);
      for (let y = 0; y < m.scrollHeight + schritt; y += schritt) {
        m.scrollTop = y;
        for (const e of eintraege) {
          if (!window._g.imBild(e)) continue;
          const t = window._g.treffer(e);
          const kleinste = Math.min(t.breite, t.hoehe);
          if (!beste.has(e) || beste.get(e) < kleinste) beste.set(e, kleinste);
        }
      }
      m.scrollTop = alt;
      const fehl = eintraege
        .filter(e => (beste.get(e) ?? 0) < ${GRIFF - TASTFEHLER})
        .map(e => e.textContent.trim().slice(0, 16) + ' ' + (beste.get(e) ?? 0) + ' px');
      return { anzahl: eintraege.length, fehl,
               kleinster: Math.min(...eintraege.map(e => beste.get(e) ?? 0)) };
    },
    /* Kopf und Fuß eines Dialogs: beide sollen ohne Rollen im Bild stehen und
       ihre Knöpfe treffbar sein. Quer blieben dem Inhalt zwischen ihnen
       184 px – deshalb kommt die Inhaltshöhe mit, auch wenn sie keinen Fall
       entscheidet. */
    dialogRahmen() {
      const d = window._g.muss('.dialog');
      const kopf = window._g.muss('.dialog-kopf', d);
      const fuss = window._g.muss('.dialog-fuss', d);
      const inhalt = window._g.muss('.dialog-inhalt', d);
      const k = kopf.getBoundingClientRect(), f = fuss.getBoundingClientRect();
      const knoepfe = [...fuss.querySelectorAll('button')].filter(e => window._g.kasten(e));
      if (!knoepfe.length) throw new Error('Kein Knopf im Dialogfuß');
      return {
        titel: window._g.muss('#dialog-titel').textContent.trim(),
        kopfHoch: Math.round(k.height), fussHoch: Math.round(f.height),
        inhaltHoch: Math.round(inhalt.getBoundingClientRect().height),
        schirm: innerHeight,
        kopfImBild: window._g.imBild(kopf), fussImBild: window._g.imBild(fuss),
        kopfUnten: Math.round(k.bottom), fussUnten: Math.round(f.bottom),
        knoepfe: knoepfe.map(e => ({ text: e.textContent.trim(), ...window._g.lage(e) }))
      };
    },
    /* Die Großansicht eines Bildes: das Blatt selbst darf nicht rollen, und
       Kopf, Bild, Angaben und Schließen müssen nebeneinander Platz finden.
       Vorher war das Bild auf 88vh abzüglich 180 px gedeckelt und schob bei
       einer hochkant aufgenommenen Datei Bemerkung, Zeitpunkt und
       Gitterangabe unter die Kante. Das Maß steht hier ausgeschrieben statt in
       Quelltextschreibweise: die Messhilfen liegen selbst in einem
       Template-Literal, und ein Gravis darin beendete es mitten im Satz. */
    bildschau() {
      const d = window._g.muss('.dialog');
      const inhalt = window._g.muss('.dialog-inhalt', d);
      const bild = window._g.muss('.bg-bild img', d);
      const angaben = window._g.muss('.bg-angaben', d);
      const zu = [...d.querySelectorAll('.dialog-fuss button')]
        .find(k => k.textContent.trim() === 'Schließen');
      if (!zu) throw new Error('Kein „Schließen“ im Fuß');
      const bk = bild.getBoundingClientRect();
      return {
        rollt: inhalt.scrollHeight > inhalt.clientHeight + 1,
        angabenRollt: angaben.scrollHeight > angaben.clientHeight + 1,
        angabenZeilen: angaben.children.length,
        bild: Math.round(bk.width) + '×' + Math.round(bk.height),
        bildFlaeche: Math.round(bk.width * bk.height),
        angabenLage: window._g.lage(angaben),
        zuLage: window._g.lage(zu)
      };
    },
    /* Die Zeichenpalette: wie viele Zeichen stehen zugleich im Bild, und rollt
       wirklich nur ein Bereich? Zwei ineinander rollende Flächen ließen die
       Fingerbewegung zwischen ihnen überspringen, und dabei rollte der Kopf
       mit Suchfeld und Kategorie weg. */
    palette() {
      const gitter = window._g.muss('.palette-gitter');
      const inhalt = window._g.muss('.dialog-inhalt');
      const knoepfe = [...document.querySelectorAll('.palette-knopf')];
      if (!knoepfe.length) throw new Error('Kein Zeichen in der Palette');
      const gr = gitter.getBoundingClientRect();
      const ganz = knoepfe.filter(b => {
        const r = b.getBoundingClientRect();
        return r.top >= gr.top - 1 && r.bottom <= gr.bottom + 1;
      });
      const reihe = window._g.muss('.palette-reihe');
      const spalten = getComputedStyle(reihe).gridTemplateColumns.split(' ').filter(Boolean).length;
      return {
        sichtbar: ganz.length, gesamt: knoepfe.length, spalten,
        gitterRollt: gitter.scrollHeight > gitter.clientHeight + 1,
        inhaltRollt: inhalt.scrollHeight > inhalt.clientHeight + 1,
        /* Der waagerechte Überlauf des Gitters und nicht der der Seite: das
           Gitter stand bei 320 px 7 px breiter als sein Rahmen und wackelte
           seitwärts. Was die Seite sonst überlaufen lässt, misst der eigene
           Abschnitt am Ende des Laufs. */
        ueberlauf: gitter.scrollWidth - gitter.clientWidth
      };
    },
    dateimenue() {
      const m = window._g.muss('.menu');
      if (m.hidden) throw new Error('Das Dateimenü ist zu');
      /* Ans Ende gerollt: erreichbar heißt hier nicht „gerade zu sehen“,
         sondern „nach dem Rollen zu treffen“ – das Menü rollt absichtlich. */
      m.scrollTop = m.scrollHeight;
      const letzter = [...m.querySelectorAll('button, a')].filter(e => window._g.kasten(e)).pop();
      if (!letzter) throw new Error('Kein Eintrag im Dateimenü');
      return { text: letzter.textContent.trim(), ...window._g.lage(letzter) };
    },
    zoom() {
      const griffe = [...document.querySelectorAll('.leaflet-control-zoom a')]
        .filter(window._g.imBild);
      if (!griffe.length) throw new Error('Keine Zoomsteuerung im Bild');
      const masse = griffe.map(a => window._g.treffer(a));
      return {
        kleinste: Math.min(...masse.map(m => Math.min(m.breite, m.hoehe))),
        griffe: griffe.map((a, i) => (a.title || a.className).slice(0, 12) +
                                     ' ' + masse[i].breite + '×' + masse[i].hoehe)
      };
    },
    async punktkarte() {
      const pk = window._g.muss('#punktkarte');
      if (pk.hidden) throw new Error('Die Punktkarte ist zu');
      /* Das Blatt kommt von unten herein – gemessen wird, wo es steht. */
      await Promise.all(pk.getAnimations().map(a => a.finished.catch(() => {})));
      const zu = window._g.muss('.pk-zu', pk);
      /* Gesucht im ganzen Blatt und nicht in der Tastenreihe: der Abschluss
         steht seit Paket 1 in einer eigenen, festgehaltenen Zeile. */
      const fertig = [...pk.querySelectorAll('button')]
        .find(b => b.textContent.trim() === 'Fertig');
      if (!fertig) throw new Error('Kein „Fertig“ in der Punktkarte');
      return { gerollt: pk.scrollTop, zu: window._g.lage(zu), fertig: window._g.lage(fertig) };
    },
    /* „Zurücknehmen“ und „Löschen“ wirken sofort, und der Rückweg liegt oben
       in der Kopfzeile: sie dürfen keinem anderen Griff nahe kommen. Gemessen
       wird der kürzeste Abstand zu irgendeiner anderen Taste des Blattes und
       nicht nur zur nächsten in der Reihe – schmal bricht die Reihe um, und
       dann steht der Nachbar darüber statt daneben.

       Gerollt wird vorher ans Ende. Ungerollt steht der festgehaltene
       Abschluss an der Unterkante des Blattes, während die Tastenreihe noch
       weit darunter im Inhalt liegt: der Abstand wäre eine Zahl über zwei
       Griffe, die niemand zugleich sieht. Getroffen wird die Gefahrtaste
       ohnehin erst, wenn zu ihr gerollt wurde. */
    /* Eine Meldung einblenden und stehen lassen. Gemessen wird danach die
       Eigenschaft, an der es lag – ob die Pille den Tipp entgegennimmt oder
       weiterreicht –, und nicht ein echter Tipp auf das, was zufällig unter
       ihr liegt: das ist in jedem Fenster ein anderes Element, und in der
       Quellenzeile wäre es ein Link nach draußen. Der echte Tipp steht im
       Dialogfall, wo der Griff darunter bekannt ist. */
    async pilleZeigen(text) {
      const m = await import('./js/ui.js');
      m.hinweis(text);
      const box = window._g.muss('#hinweisbox');
      await Promise.all(box.getAnimations().map(a => a.finished.catch(() => {})));
      await new Promise(f => requestAnimationFrame(f));
      return true;
    },
    /* Liefert auch dann etwas, wenn gar keine Meldung steht – das ist im
       Baumodus der Regelfall und selbst ein Befund, kein Fehlschlag. Wer eine
       stehende Meldung braucht, prüft das Feld steht – in Gravis setzen
       ließe es sich nicht, dieser Block steht selbst in einem
       Template-Literal. */
    pille() {
      const box = window._g.muss('#hinweisbox');
      if (box.hidden) return { steht: false, hoehe: 0, ueber: [], abgefangen: 0 };
      const r = box.getBoundingClientRect();
      let punkte = 0, abgefangen = 0;
      for (let y = r.top + 3; y < r.bottom - 1; y += 4) {
        for (let x = r.left + 3; x < r.right - 1; x += 4) {
          punkte++;
          const p = document.elementFromPoint(x, y);
          if (p === box || box.contains(p)) abgefangen++;
        }
      }
      /* Worüber sie liegt: die Statusleiste trägt die Gitterangabe, die nach
         der Aufnahme abgelesen wird, das Blatt die Griffe. Gemeldet wird die
         Höhe der Überschneidung – daran ist zu sehen, ob sie knapp ist. */
      const ueber = [];
      for (const wahl of ['.statusleiste', '#punktkarte', '.werkzeuge',
                          '.leaflet-control-scale', '.leaflet-control-attribution']) {
        const k = window._g.kasten(document.querySelector(wahl));
        if (!k) continue;
        const dy = Math.min(r.bottom, k.bottom) - Math.max(r.top, k.top);
        const dx = Math.min(r.right, k.right) - Math.max(r.left, k.left);
        /* Kein Template-Literal: dieser Block steht selbst in einem, und die
           Einsetzung liefe in Node statt in der Seite. */
        if (dx > 0 && dy > 0) ueber.push(wahl + ' um ' + Math.round(dy) + ' px');
      }
      return { steht: true, hoehe: Math.round(r.height), ueber,
               abgefangen: punkte ? abgefangen / punkte : 1 };
    },
    /* Die Modusleiste im Ist-Setzmodus. Gemeldet werden die Knöpfe über ihre
       Kennung und nicht über die Beschriftung: das Tastenkürzel steckt als
       eigenes Element in ihr und zählt zum Text, auch wenn es am Finger vom
       Schirm ist. */
    modusleiste() {
      const box = window._g.muss('#zeichen-hinweis');
      if (box.hidden) throw new Error('Die Modusleiste steht nicht');
      const knoepfe = [...box.querySelectorAll('button')];
      if (!knoepfe.length) throw new Error('Kein Knopf in der Modusleiste');
      return { hoehe: Math.round(box.getBoundingClientRect().height),
               anzahl: knoepfe.length,
               sichtbar: knoepfe.filter(k => window._g.kasten(k)).map(k => k.dataset.akt) };
    },
    /* Die Druckvorschau in Zahlen: der Maßstab, mit dem das Blatt eingepasst
       ist, die Grundschrift des Blattes und was von beidem am Auge ankommt –
       daran hängt, ob der Hinweis auf die Lupe stehen bleiben muss. Dazu, wie
       viele Einstellungsfelder ganz im Rollfenster der Leiste stehen. */
    druckvorschau() {
      const doku = window._g.muss('.druck-doku');
      const lupe = window._g.muss('.druck-lupe');
      const blatt = window._g.muss('.blatt', doku);
      const skala = parseFloat(getComputedStyle(doku).getPropertyValue('--vorschau-skala')) || 1;
      const grund = parseFloat(getComputedStyle(blatt).fontSize) || 0;
      const kasten = window._g.muss('.ds-felder').getBoundingClientRect();
      const felder = [...document.querySelectorAll('.ds-feld')].filter(window._g.kasten);
      if (!felder.length) throw new Error('Kein Einstellungsfeld in der Leiste');
      const ganz = felder.filter(e => {
        const r = e.getBoundingClientRect();
        return r.top >= kasten.top - 1 && r.bottom <= kasten.bottom + 1;
      });
      const b = window._g.muss('.druck-buehne').getBoundingClientRect();
      return {
        skala, grund, wirksam: Math.round(grund * skala * 100) / 100,
        lupe: !lupe.hidden, gross: doku.classList.contains('gross'),
        felder: felder.length, ganzSichtbar: ganz.length,
        blattAnteil: Math.round((b.width * b.height) / (innerWidth * innerHeight) * 100)
      };
    },
    /* Befund 18: das Blatt vergrößern, dann eine Einstellung ändern. Der
       Neuaufbau überschrieb die Klassenliste des Blattes und nahm dabei den
       Lesezustand mit. */
    async druckUmstellen() {
      const doku = window._g.muss('.druck-doku');
      const buehne = window._g.muss('.druck-buehne');
      doku.click();
      await new Promise(f => requestAnimationFrame(f));
      if (!doku.classList.contains('gross')) {
        throw new Error('Der Tipp vergrößert das Blatt nicht');
      }
      buehne.scrollTop = 200;
      const haken = [...document.querySelectorAll('.ds-haken input')].filter(window._g.kasten)[0];
      if (!haken) throw new Error('Kein Haken in der Steuerleiste');
      haken.click();
      await new Promise(f => setTimeout(f, 300));
      const skala = getComputedStyle(doku).getPropertyValue('--vorschau-skala');
      const stand = { gross: doku.classList.contains('gross'),
                      skala: parseFloat(skala), gerollt: Math.round(buehne.scrollTop) };
      haken.click();
      await new Promise(f => setTimeout(f, 300));
      doku.click();
      return stand;
    },
    /* Der Bau-Reiter ist länger als jedes Fenster. Getastet wird deshalb in
       Schritten: die wirksame Trefferzone gibt es nur für das, was gerade im
       Bild steht, und ein Griff, der nie hineingerollt wurde, wäre ungeprüft
       durchgegangen. Zugeklappte Blöcke werden vorher aufgeschlagen – dass
       ihre Griffe zugeklappt nicht zu treffen sind, ist kein Befund. */
    async reiterGriffe() {
      const inh = window._g.muss('#inhalt-bau');
      /* Gemerkt, was zugeklappt war, und am Ende wieder zugeklappt: der
         Zustand steht modulweit in der Anwendung und überlebte sonst dieses
         Fenster – das nächste maß dann einen aufgeklappten Reiter. */
      const warZu = [...inh.querySelectorAll('.fg-klapp.zu .fg-griff')];
      for (const g of warZu) g.click();
      const wahl = 'button, select, textarea, ' +
        'input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color])';
      const klein = new Map();
      const alt = inh.scrollTop;
      const schritt = Math.max(60, inh.clientHeight - 60);
      for (let y = 0; y < inh.scrollHeight + schritt; y += schritt) {
        inh.scrollTop = y;
        await new Promise(f => requestAnimationFrame(f));
        for (const e of inh.querySelectorAll(wahl)) {
          if (!window._g.imBild(e)) continue;
          const m = window._g.treffer(e);
          if (m.verdeckt) continue;
          if (m.breite < 43 || m.hoehe < 43) {
            klein.set((e.id || e.className || e.tagName).toString().slice(0, 30),
                      m.breite + '×' + m.hoehe);
          }
        }
      }
      for (const g of warZu) {
        if (!g.closest('.fg-klapp').classList.contains('zu')) g.click();
      }
      inh.scrollTop = alt;
      await new Promise(f => requestAnimationFrame(f));
      return [...klein].map(([k, v]) => k + ' ' + v);
    },
    /* Drei bestätigte Punkte, gemessen und wieder zurückgenommen: die Länge
       des Reiters soll für den Stand gelten, in dem der Trupp ihn benutzt. */
    async reiterHoehe() {
      const s = window.fbp.store.projekt.strecken[0];
      const st = await import('./js/baudoku.js');
      window.fbp.store.aendern(() => {
        s.bau = s.bau || null;
        for (const pt of s.punkte) {
          st.istPunktSetzen(s, pt.lat, pt.lng, { sollPunkt: pt.id, art: pt.art, quelle: 'plan' });
        }
      }, 'bau');
      await new Promise(f => requestAnimationFrame(f));
      const inh = window._g.muss('#inhalt-bau');
      const hoehe = Math.round(inh.scrollHeight);
      const bestaetigt = document.querySelectorAll('#bau-liste .bp-zeile.bestaetigt').length;
      window.fbp.store.aendern(p => {
        if (p.strecken[0].bau) p.strecken[0].bau.punkte = [];
      }, 'bau');
      await new Promise(f => requestAnimationFrame(f));
      return { hoehe, bestaetigt, sicht: inh.clientHeight };
    },
    async gefahrAbstand() {
      const pk = window._g.muss('#punktkarte');
      const gefahr = window._g.muss('.knopf.gefahr', pk);
      const vorher = pk.scrollTop;
      pk.scrollTop = pk.scrollHeight;
      await new Promise(f => requestAnimationFrame(f));
      const r = gefahr.getBoundingClientRect();
      const abstand = Math.min(...[...pk.querySelectorAll('.knopf')]
        .filter(k => k !== gefahr && window._g.kasten(k))
        .map(k => {
          const o = k.getBoundingClientRect();
          return Math.hypot(Math.max(0, r.left - o.right, o.left - r.right),
                            Math.max(0, r.top - o.bottom, o.top - r.bottom));
        }));
      pk.scrollTop = vorher;
      await new Promise(f => requestAnimationFrame(f));
      return { text: gefahr.textContent.trim(), abstand: Math.round(abstand) };
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
      /* Die festgehaltene Ausgabezeile liegt mit Absicht über dem Durchlauf –
         sie ist der Griff, auf den die Streckenkarte zuläuft. Ein Feld, dessen
         Unterkante darunter gerät, ist deshalb nicht zu klein, sondern
         verdeckt, und ein Tipp hinein rollt es frei – dafür steht in
         css/app.css eine Rollreserve am unteren Rand jedes Feldes. Welches
         Feld das gerade trifft, hängt allein am Rollstand und ist kein Maß.
         (Ohne Gravis geschrieben: der Rumpf liegt in einem Template-Literal.) */
      .filter(e => {
        const a = document.querySelector('.tastenreihe.ausgabe');
        if (!a) return true;
        const ar = a.getBoundingClientRect(), er = e.getBoundingClientRect();
        /* Die 6 px sind die groesste Aufweitung, die ein Griff in dieser
           Anwendung traegt (.farbe::after). Ein Feld, das so nah an die
           festgehaltene Zeile heranreicht, misst sich unten beschnitten –
           gemessen waere dann der Rollstand und nicht die Trefferflaeche. */
        return er.bottom + 6 <= ar.top || er.top >= ar.bottom;
      })
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

  /* Ein Lichtbild für die Großansicht: hochkant und mit langem Namen – genau
     der Fall, in dem die Angaben unter die Blattkante rutschten. Es wird hier
     angelegt, weil jedes Fenster es später öffnet. */
  await seite.auswerten(`
    const sp = await import('./js/bildspeicher.js');
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 1600;
    const x = c.getContext('2d');
    x.fillStyle = '#41546b'; x.fillRect(0, 0, 1200, 1600);
    const blob = await new Promise(f => c.toBlob(f, 'image/jpeg', 0.6));
    await sp.ablegen('bild-pruef', blob);
    window.fbp.store.aendern(p => {
      p.bilder = [{
        id: 'bild-pruef',
        name: 'Mastfuss-an-der-Zufahrt-Nordseite-Blickrichtung-Sued-Detail',
        lat: 51.802, lng: 10.618, ortAusKamera: true, richtung: 190,
        aufgenommen: new Date('2026-09-14T16:12:00').toISOString(),
        bemerkung: 'Graben unterquert die Zufahrt, Rohr DN 100 liegt vorhanden.',
        sichtbar: true
      }];
    }, 'bild');
    return true;`);

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

  // ------------------------------------------------------------ Acht Fenster

  /* Jedes Fenster bekommt denselben Satz Messungen: erst die Planung mit
     Werkzeugleiste, dann der Baumodus mit Bauleiste, Popup und Punktkarte.
     Ein Fall, der in der Seite ins Leere greift, fällt durch und der Lauf
     geht weiter – wer acht Fenster misst, will alle Befunde sehen und nicht
     den ersten je Lauf. Die Werte sammeln sich für die Tabelle am Ende. */
  const uebersicht = new Map();
  const fensterName = (br, ho) => `${br}×${ho}`;
  async function fall(fenster, zeile, text, messen) {
    let gut = false, kurz = '';
    try {
      const erg = await messen();
      gut = erg.gut; kurz = erg.kurz || ''; text += erg.text ? ' – ' + erg.text : '';
    } catch (f) {
      kurz = 'Fehler'; text += ' – ' + f.message.replace(/^In der Seite: Error: /, '');
    }
    b.pruefe(gut, text);
    if (!uebersicht.has(zeile)) uebersicht.set(zeile, new Map());
    uebersicht.get(zeile).set(fenster, (gut ? '✓' : '✗') + (kurz ? ' ' + kurz : ''));
  }
  const prozent = a => Math.round(a * 100) + ' %';
  const freiText = m => `${m.frei} von ${m.karte} px Karte frei (${m.oben}–${m.unten}), ` +
    `${prozent(m.anteil)} des Fensters; belegt: ${m.belegt.join(', ')}`;
  const hinweisWeg = () => seite.warteAuf('document.getElementById("hinweisbox").hidden', 8000);
  const kartenoptionenZu = async zu => {
    const istZu = await seite.auswerten(
      'document.getElementById("kartenoptionen").classList.contains("zu")');
    if (istZu !== zu) await seite.klick('#ko-kopf');
    await seite.ruhe();
  };
  const karteVorn = async () => {
    await seite.auswerten('document.getElementById("aw-karte").click(); return true;');
    /* Die Liste schiebt sich in 280 ms zur Seite – gemessen wird, wo alles
       stehen bleibt. */
    await new Promise(r => setTimeout(r, 450));
  };
  const griffText = (name, l) => !l.imBild
    ? `${name} nicht ohne Rollen im Bild (${l.oben}–${l.unten}, ${l.rahmen})`
    : l.verdeckt ? `${name} im Bild, zu ${prozent(l.verdeckt)} verdeckt von ${l.durch.join(', ')}`
    : `${name} im Bild und treffbar`;
  const griffGut = l => l.imBild && l.verdeckt === 0;
  const menueWaehlen = async akt => {
    await seite.klick('#btn-datei');
    await seite.warteAuf('!document.querySelector(".menu").hidden');
    await seite.auswerten(`window._g.muss('.menu [data-akt="${akt}"]').click(); return true;`);
  };
  /* Die Baumeldung kommt aus der offenen Planung selbst – `alsBaumeldung`
     packt genau das, was über den Link reist. So braucht die Prüfung keinen
     abgelegten Beispiellink, der mit dem nächsten Schemastand veraltet. */
  const meldungsDialog = () => seite.auswerten(`
    const t = await import('./js/teilen.js');
    const ui = await import('./js/ui.js');
    const p = window.fbp.store.projekt;
    ui.baumeldungDialog(t.alsBaumeldung(p, [p.strecken[0]]), 'Datei');
    return true;`);
  const fussKnopfDruecken = text => seite.auswerten(`
    const b = [...document.querySelectorAll('#dialog-fuss button')]
      .find(e => e.textContent.trim() === ${JSON.stringify(text)});
    if (!b) throw new Error('Kein Fußknopf ' + ${JSON.stringify(text)});
    b.click();
    return true;`);
  /* Der Gerätestandort für „Punkt hier“ – ohne ihn gäbe es keine Punktkarte
     zu messen. */
  await seite.standort(51.802, 10.618, 7);

  for (const [breite, hoehe] of FENSTER) {
    const fenster = fensterName(breite, hoehe);
    b.abschnitt(`Fenster ${fenster}: Planung mit Werkzeugleiste`);
    await stelleEin(breite, hoehe);
    await karteVorn();
    await kartenoptionenZu(true);
    await hinweisWeg();

    await fall(fenster, 'Karte frei – Planung mit Werkzeugleiste',
      `Freie Kartenfläche ≥ ${prozent(FREI_PLANUNG)}`,
      async () => {
        const m = await seite.auswerten('window._g.freieKarte()');
        return { gut: m.anteil >= FREI_PLANUNG, kurz: prozent(m.anteil),
                 text: freiText(m) };
      });
    await fall(fenster, 'Zoomsteuerung ≥ 44 px',
      'Leaflet-Zoomsteuerung trägt 44 px unter pointer: coarse',
      async () => {
        if (!(await seite.auswerten('matchMedia("(pointer: coarse)").matches'))) {
          throw new Error('kein grober Zeiger – die Regeln für den Finger gelten nicht');
        }
        const z = await seite.auswerten('window._g.zoom()');
        return { gut: z.kleinste >= GRIFF - TASTFEHLER, kurz: z.kleinste + ' px',
                 text: z.griffe.join(', ') };
      });
    await kartenoptionenZu(false);
    await fall(fenster, 'Kartenoptionen (Planung) im Fenster oder rollbar',
      'Kartenoptionen aufgeklappt: ganz im Fenster oder innen rollbar',
      async () => {
        const k = await seite.auswerten('window._g.kartenoptionen()');
        const gut = k.unten <= k.schirm && k.fehl.length === 0;
        return { gut, kurz: gut ? '' : k.unten > k.schirm ? `bis ${k.unten}`
                   : `${k.fehl.length} Zeile${k.fehl.length === 1 ? '' : 'n'}`,
                 text: `Unterkante ${k.unten} im ${k.schirm} hohen Fenster, ${k.zeilen} Zeilen, ` +
                       (k.rollt ? 'rollt' : 'rollt nicht') +
                       (k.fehl.length ? `; nicht zu treffen: ${k.fehl.join(', ')}` : '') };
      });
    await kartenoptionenZu(true);

    await seite.klick('#btn-datei');
    await seite.warteAuf('!document.querySelector(".menu").hidden');
    await fall(fenster, 'Dateimenü: „Datenschutz“ treffbar',
      'Dateimenü: der letzte Eintrag „Datenschutz“ ist nach dem Rollen zu treffen',
      async () => {
        const d = await seite.auswerten('window._g.dateimenue()');
        if (!/Datenschutz/.test(d.text)) throw new Error('Letzter Eintrag ist „' + d.text + '“');
        return { gut: griffGut(d),
                 kurz: griffGut(d) ? '' : d.imBild ? 'verdeckt' : `bis ${d.unten}`,
                 text: griffText('„Datenschutz“', d) };
      });
    await fall(fenster, 'Dateimenü: jeder Eintrag trägt 44 px',
      'Jeder Eintrag des Dateimenüs ist mit dem Finger zu treffen',
      async () => {
        if (!(await seite.auswerten('matchMedia("(pointer: coarse)").matches'))) {
          throw new Error('kein grober Zeiger – die Regeln für den Finger gelten nicht');
        }
        const m = await seite.auswerten('window._g.dateiGriffe()');
        return { gut: m.fehl.length === 0,
                 kurz: m.fehl.length ? m.fehl.length + ' zu klein' : m.kleinster + ' px',
                 text: m.fehl.length
                   ? `von ${m.anzahl} Einträgen zu klein: ${m.fehl.join(', ')}`
                   : `alle ${m.anzahl} Einträge ≥ 44 px (kleinster ${m.kleinster})` };
      });
    await seite.taste('Escape');

    await fall(fenster, 'Zeichenpalette: ein Rollbereich, volle Reihen',
      'Die Zeichenpalette rollt an einer Stelle und zeigt hochkant zwei volle Reihen',
      async () => {
        await seite.auswerten(`
          const ui = await import('./js/ui.js');
          ui.symbolPalette(() => {});
          return true;`);
        await seite.warteAuf('!!document.querySelector(".palette-knopf")', 5000);
        await seite.ruhe();
        const p = await seite.auswerten('window._g.palette()');
        await seite.taste('Escape');
        await seite.warteAuf('document.getElementById("dialog").hidden', 5000);
        /* Quer trägt eine Reihe, hochkant zwei – darunter wird aus dem
           Durchsehen ein Suchen, und genau das war der Befund. */
        const soll = hoehe < breite ? p.spalten : p.spalten * 2;
        const gut = !p.inhaltRollt && p.sichtbar >= soll && p.ueberlauf <= 0;
        return { gut, kurz: p.sichtbar + ' von ' + p.gesamt,
                 text: `${p.sichtbar} Zeichen ganz im Bild (verlangt ${soll}), ` +
                       `${p.spalten} Spalten, ` +
                       (p.inhaltRollt ? 'zwei Rollbereiche' : 'ein Rollbereich') +
                       (p.ueberlauf > 0 ? `, ${p.ueberlauf} px waagerechter Überlauf` : '') };
      });

    await fall(fenster, 'Großansicht: Bild, Angaben und Schließen im Bild',
      'Die Großansicht zeigt Schließen und alle Angaben, ohne dass das Blatt rollt',
      async () => {
        await seite.auswerten(`
          const ui = await import('./js/ui.js');
          ui.bildAnsehen(window.fbp.store.projekt.bilder[0]);
          return true;`);
        await seite.warteAuf('!!document.querySelector(".bg-bild img")', 5000);
        await seite.ruhe();
        const g = await seite.auswerten('window._g.bildschau()');
        await seite.taste('Escape');
        await seite.warteAuf('document.getElementById("dialog").hidden', 5000);
        const gut = !g.rollt && !g.angabenRollt &&
                    g.angabenLage.imBild && griffGut(g.zuLage);
        return { gut, kurz: gut ? g.bild : g.rollt ? 'Blatt rollt'
                   : g.angabenRollt ? 'Angaben rollen'
                   : g.angabenLage.imBild ? 'Schließen zu' : 'Angaben weg',
                 text: `Bild ${g.bild}, ${g.angabenZeilen} Angabenzeilen` +
                       (g.rollt ? ', das Blatt rollt' : ', das Blatt rollt nicht') +
                       (g.angabenRollt ? ', die Angaben rollen in sich' : '') +
                       '; ' + griffText('„Schließen“', g.zuLage) };
      });

    /* Die drei Dialoge, an denen das Querformat gemessen wird: einer mit
       Eingabefeld, einer mit Liste, einer mit Entscheidung. Der letzte geht
       nicht per Esc zu – er verlangt eine Antwort, seit eine eingegangene
       Meldung an einem Fehlgriff verloren ging. */
    for (const [zeile, titel, oeffne, schliesse] of [
      ['Neue Planung', 'Neue Planung', () => menueWaehlen('neu'), () => seite.taste('Escape')],
      ['Gespeicherte Planungen', 'Gespeicherte Planungen',
        () => menueWaehlen('oeffnen'), () => seite.taste('Escape')],
      ['Baumeldung einspielen', 'Baumeldung eingegangen',
        () => meldungsDialog(), () => fussKnopfDruecken('Verwerfen')]
    ]) {
      await fall(fenster, `Dialog „${zeile}“: Kopf und Fuß im Bild`,
        `Dialog „${zeile}“: Kopf und Fuß stehen ohne Rollen im Bild, ` +
        'die Fußknöpfe sind treffbar',
        async () => {
          await oeffne();
          await seite.warteAuf('!document.getElementById("dialog").hidden', 5000);
          await seite.ruhe();
          const d = await seite.auswerten('window._g.dialogRahmen()');
          if (d.titel !== titel) throw new Error(`Offen ist „${d.titel}“`);
          const schlecht = d.knoepfe.filter(k => !griffGut(k));
          const gut = d.kopfImBild && d.fussImBild && schlecht.length === 0;
          await schliesse();
          await seite.warteAuf('document.getElementById("dialog").hidden', 5000);
          await hinweisWeg();
          return { gut, kurz: gut ? d.inhaltHoch + ' px' : !d.kopfImBild ? 'Kopf weg'
                     : !d.fussImBild ? 'Fuß weg' : 'Knopf zu',
                   text: `Kopf ${d.kopfHoch} px, Fuß ${d.fussHoch} px, ` +
                         `Inhalt ${d.inhaltHoch} px im ${d.schirm} hohen Fenster` +
                         (schlecht.length
                           ? '; nicht treffbar: ' +
                             schlecht.map(k => griffText(`„${k.text}“`, k)).join(', ')
                           : '') };
        });
    }

    await fall(fenster, 'Meldungspille lässt Tipps durch',
      'Eine stehende Meldung fängt keinen Tipp ab, der dem Griff darunter gilt',
      async () => {
        await seite.auswerten(
          `return await window._g.pilleZeigen('Baumodus: festhalten, was gebaut wurde.');`);
        const p = await seite.auswerten('window._g.pille()');
        if (!p.steht) throw new Error('die eingeblendete Meldung steht nicht');
        return { gut: p.abgefangen === 0,
                 kurz: p.abgefangen ? prozent(p.abgefangen) + ' zu' : '',
                 text: p.abgefangen
                   ? `${prozent(p.abgefangen)} ihrer Fläche nimmt den Tipp selbst entgegen`
                   : `Pille ${p.hoehe} px hoch, jeder Punkt ihrer Fläche reicht durch` };
      });

    await fall(fenster, 'Dialogfuß trotz Meldung treffbar',
      'Steht eine Meldung über dem Dialogfuß, löst ein Tipp den Knopf trotzdem aus',
      async () => {
        await seite.klick('#btn-hilfe');
        await seite.warteAuf('!document.getElementById("dialog").hidden');
        await seite.auswerten(`return await window._g.pilleZeigen('Planungsmodus.');`);
        const k = await seite.auswerten(`
          const f = [...document.querySelectorAll('.dialog-fuss button')]
            .filter(window._g.kasten).pop() || window._g.muss('.dialog-kopf button');
          const r = f.getBoundingClientRect();
          const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
          const p = document.elementFromPoint(x, y);
          return { text: f.textContent.trim(), x, y,
                   trifft: !!p && (p === f || f.contains(p)), was: window._g.name(p) };`);
        await seite.tippe(k.x, k.y);
        const zu = await seite.auswerten('document.getElementById("dialog").hidden');
        if (!zu) await seite.taste('Escape');
        return { gut: k.trifft && zu, kurz: k.trifft ? (zu ? '' : 'ohne Wirkung') : 'verdeckt',
                 text: `„${k.text}“ ` +
                       (k.trifft ? 'ist zu treffen' : 'liefert ' + k.was) +
                       (zu ? ' und schließt den Dialog' : ', der Dialog bleibt offen') };
      });
    await hinweisWeg();

    b.abschnitt(`Fenster ${fenster}: Bau-Reiter`);
    await seite.klick('#btn-modus');
    await seite.auswerten('document.getElementById("aw-liste").click(); return true;');
    await new Promise(r => setTimeout(r, 450));
    await fall(fenster, 'Bau-Reiter bleibt unter 2500 px',
      'Mit drei bestätigten Punkten bleibt der Reiter unter 2500 px Rollhöhe',
      async () => {
        const m = await seite.auswerten('return await window._g.reiterHoehe();');
        if (m.bestaetigt < 3) throw new Error(`nur ${m.bestaetigt} Zeilen bestätigt`);
        return { gut: m.hoehe <= 2500, kurz: m.hoehe + ' px',
                 text: `${m.hoehe} px bei ${m.sicht} px Sichthöhe, ` +
                       `also ${(m.hoehe / m.sicht).toFixed(1)} Schirme` };
      });
    await fall(fenster, 'Bau-Reiter: jeder Griff trägt 44 px',
      'Jeder Griff im Bau-Reiter ist mit dem Finger zu treffen',
      async () => {
        const klein = await seite.auswerten('return await window._g.reiterGriffe();');
        return { gut: klein.length === 0, kurz: klein.length ? klein.length + ' zu klein' : '',
                 text: klein.length ? 'zu klein: ' + klein.join(', ') : 'alle ≥ 44 px' };
      });

    b.abschnitt(`Fenster ${fenster}: Baumodus mit Bauleiste`);
    await karteVorn();
    await kartenoptionenZu(true);
    await hinweisWeg();
    await fall(fenster, 'Karte frei – Baumodus mit Bauleiste',
      `Freie Kartenfläche ≥ ${prozent(FREI_BAU)}`,
      async () => {
        const m = await seite.auswerten('window._g.freieKarte()');
        return { gut: m.anteil >= FREI_BAU, kurz: prozent(m.anteil),
                 text: freiText(m) };
      });
    await kartenoptionenZu(false);
    await fall(fenster, 'Kartenoptionen (Bau) im Fenster oder rollbar',
      'Kartenoptionen im Baumodus: ganz im Fenster oder innen rollbar',
      async () => {
        const k = await seite.auswerten('window._g.kartenoptionen()');
        const gut = k.unten <= k.schirm && k.fehl.length === 0;
        return { gut, kurz: gut ? '' : k.unten > k.schirm ? `bis ${k.unten}`
                   : `${k.fehl.length} Zeile${k.fehl.length === 1 ? '' : 'n'}`,
                 text: `Unterkante ${k.unten} im ${k.schirm} hohen Fenster, ${k.zeilen} Zeilen, ` +
                       (k.rollt ? 'rollt' : 'rollt nicht') +
                       (k.fehl.length ? `; nicht zu treffen: ${k.fehl.join(', ')}` : '') };
      });
    await kartenoptionenZu(true);

    /* Ein Tipp auf die Karte hebt zuerst eine Auswahl auf und öffnet erst
       beim zweiten das Popup – die Strecke ist seit dem Zeichnen gewählt. */
    await seite.auswerten('window.fbp.sl.waehle(null); return true;');
    /* Und die Karte auf eine feste Lage: die Breite des Popups hängt an den
       Koordinatentexten, die an der Kartenmitte hängen – und die wandert über
       den Lauf, weil `autoPan` sie beim Öffnen verschiebt. Ohne diese Zeile
       fällt derselbe Fall je nach Vorgeschichte einmal auf 0 % und einmal auf
       6 % Überdeckung, und die Tabelle wackelt von Lauf zu Lauf. */
    await seite.auswerten(
      'window.fbp.karte.setView([51.8, 10.6], 8, { animate: false }); return true;');
    await seite.ruhe();
    await fall(fenster, 'Koordinaten-Popup: Primärknopf frei',
      'Koordinaten-Popup oben rechts: „Punkt hier aufnehmen“ nicht verdeckt',
      async () => {
        const fleck = await seite.auswerten('window._g.freierFleck()');
        if (fleck.x === null) {
          throw new Error('kein freier Fleck in der oberen rechten Kartenhälfte, getroffen: ' +
                          fleck.getroffen.join(', '));
        }
        await seite.tippe(fleck.x, fleck.y);
        await seite.warteAuf('!!document.querySelector(".leaflet-popup .kp-primaer")', 3000)
          .catch(() => {
            throw new Error(`nach dem Tipp auf (${fleck.x}, ${fleck.y}) öffnet kein Popup`);
          });
        await seite.ruhe();
        const l = await seite.auswerten(
          'window._g.lage(window._g.muss(".leaflet-popup .kp-primaer"))');
        return { gut: griffGut(l),
                 kurz: griffGut(l) ? '' : l.imBild ? `${prozent(l.verdeckt)} zu` : `bis ${l.unten}`,
                 text: griffText('Primärknopf', l) + ` nach Tipp auf (${fleck.x}, ${fleck.y})` };
      });
    await seite.auswerten('window.fbp.karte.closePopup(); return true;');
    await seite.ruhe();

    /* „Auf Karte“ startet den Ist-Setzmodus: die Bauleiste weicht, und schmal
       ist die Modusleiste dann das einzige Bedienelement auf der Karte. */
    await seite.klick('#wz-punkt-karte');
    await seite.warteAuf('!document.querySelector("#zeichen-hinweis").hidden', 5000);
    await seite.ruhe();
    await fall(fenster, 'Modusleiste: nur wirksame Knöpfe',
      'Nach „Auf Karte“ steht in der Modusleiste nur der Abbruch – ' +
      'der Kartentipp ist dort das „Fertig“',
      async () => {
        const m = await seite.auswerten('window._g.modusleiste()');
        const gut = m.sichtbar.length === 1 && m.sichtbar[0] === 'abbruch';
        return { gut, kurz: m.sichtbar.join('+') || 'keiner',
                 text: `von ${m.anzahl} Knöpfen sind sichtbar: ` +
                       (m.sichtbar.join(', ') || 'keiner') };
      });
    await fall(fenster, 'Modusleiste ≤ 64 px hoch',
      'Die Modusleiste bleibt ein Streifen wie die Bauleiste an derselben Kante',
      async () => {
        const m = await seite.auswerten('window._g.modusleiste()');
        return { gut: m.hoehe <= 64, kurz: m.hoehe + ' px',
                 text: `${m.hoehe} px hoch (höchstens 64)` };
      });
    await seite.taste('Escape');
    await seite.ruhe();

    b.abschnitt(`Fenster ${fenster}: Baumodus mit offener Punktkarte`);
    /* Nicht auf das Verschwinden der Meldung „Aufgenommen: …“ warten: sie steht
       3,2 s, und genau in dieser Zeit tippt der Trupp auf „Fertig“ oder eine
       Punktart. Verdeckt sie den Griff, ist das der Befund, nicht ein Zufall
       der Messung. */
    await seite.klick('#wz-punkt-hier');
    await seite.warteAuf('!document.getElementById("punktkarte").hidden', 8000)
      .catch(() => {});
    await new Promise(r => setTimeout(r, 450));
    /* Gemessen wird der wirkliche Stand unmittelbar nach der Aufnahme und
       keine eingeblendete Meldung: dass dort gar keine steht, ist die
       Entscheidung, um die es geht – das Blatt trägt Herkunft, Gitterangabe
       und Abweichung selbst. Stünde doch eine, dürfte sie weder die
       Statusleiste noch das Blatt zudecken. */
    await fall(fenster, 'Nach „Punkt hier“ keine Pille über Leisten und Blatt',
      'Nach „Punkt hier“ deckt keine Meldung Statusleiste, Maßstab oder Blatt zu',
      async () => {
        const p = await seite.auswerten('window._g.pille()');
        return { gut: !p.steht || p.ueber.length === 0,
                 kurz: !p.steht ? 'keine' : p.ueber.length ? p.ueber.length + ' Leisten' : '',
                 text: !p.steht ? 'keine Meldung – das Blatt trägt die Auskunft'
                   : p.ueber.length ? 'Meldung liegt über ' + p.ueber.join(', ')
                   : `Meldung ${p.hoehe} px hoch, frei von Leisten und Blatt` };
      });
    const punktkarteFaelle = async zusatz => {
      const spalte = zusatz ? ' (Querung)' : '';
      await fall(fenster, 'Punktkarte: ✕ im Bild und treffbar' + spalte,
        `Nach „Punkt hier“${zusatz ? ' mit Punktart Querung' : ''}: ` +
        'das Schließkreuz steht ohne Rollen im Bild und ist zu treffen',
        async () => {
          const p = await seite.auswerten('return await window._g.punktkarte();');
          const gut = griffGut(p.zu) && p.gerollt === 0;
          return { gut,
                   kurz: gut ? '' : p.zu.imBild ? `${prozent(p.zu.verdeckt)} zu` : `bis ${p.zu.unten}`,
                   text: griffText('✕', p.zu) +
                         (p.gerollt ? `, Blatt um ${p.gerollt} px gerollt` : '') };
        });
      await fall(fenster, 'Punktkarte: ✕ nicht unter dem Zoom' + spalte,
        'Das Schließkreuz liegt nicht unter der Leaflet-Zoomsteuerung',
        async () => {
          const p = await seite.auswerten('return await window._g.punktkarte();');
          const zoom = p.zu.durch.filter(n => /leaflet-control-zoom/.test(n));
          return { gut: zoom.length === 0,
                   text: zoom.length ? 'verdeckt von ' + zoom.join(', ') : 'frei' };
        });
      await fall(fenster, 'Punktkarte: „Fertig“ im Bild und treffbar' + spalte,
        '„Fertig“ steht ohne Rollen im Bild und ist zu treffen',
        async () => {
          const p = await seite.auswerten('return await window._g.punktkarte();');
          const gut = griffGut(p.fertig) && p.gerollt === 0;
          return { gut,
                   kurz: gut ? '' : p.fertig.imBild ? `${prozent(p.fertig.verdeckt)} zu`
                                                    : `bis ${p.fertig.unten}`,
                   text: griffText('„Fertig“', p.fertig) };
        });
      await fall(fenster, 'Punktkarte: Gefahrtaste ≥ 16 px entfernt' + spalte,
        '„Zurücknehmen“ bzw. „Löschen“ hält 16 px Abstand zur nächsten Taste',
        async () => {
          const g = await seite.auswerten('return await window._g.gefahrAbstand();');
          return { gut: g.abstand >= 16, kurz: g.abstand + ' px',
                   text: `„${g.text}“ steht ${g.abstand} px von der nächsten Taste` };
        });
    };
    await punktkarteFaelle(false);
    /* Erst die Meldung abwarten: sie zählt als Aufsatz mit, und ob sie beim
       Messen noch steht, hinge sonst daran, wie lange die Fälle davor
       gebraucht haben. Die freie Fläche ist eine Aussage über die Aufteilung,
       nicht über die 3,2 s danach – die misst die Zeile darunter. */
    await hinweisWeg();
    await fall(fenster, 'Karte frei – Punktkarte offen',
      `Freie Kartenfläche bei offener Punktkarte ≥ ${prozent(FREI_PUNKTKARTE)}`,
      async () => {
        if (await seite.auswerten('document.getElementById("punktkarte").hidden')) {
          throw new Error('Die Punktkarte ist zu');
        }
        const m = await seite.auswerten('window._g.freieKarte()');
        return { gut: m.anteil >= FREI_PUNKTKARTE, kurz: prozent(m.anteil),
                 text: freiText(m) };
      });
    /* Die Querung bringt die zweite Chipreihe – „Wie gequert?“ – und damit
       die Höhe, bei der das Blatt auf dem Foto vom Blatt fiel. */
    await seite.auswerten(
      'window._g.muss("#punktkarte .pk-chip[data-wert=querung]").click(); return true;')
      .catch(() => {});
    await seite.warteAuf('!!document.querySelector("#punktkarte .pk-frage")', 3000).catch(() => {});
    await punktkarteFaelle(true);
    await seite.taste('Escape');
    /* Jedes Fenster beginnt mit derselben Planung: der eben aufgenommene
       Punkt geht wieder, sonst stapeln sich acht Marken auf einem Fleck. */
    await seite.auswerten(`
      window.fbp.store.aendern(p => {
        if (p.strecken[0].bau) p.strecken[0].bau.punkte = [];
      }, 'bau');
      return true;`);
    await seite.klick('#btn-modus');
    await hinweisWeg();

    b.abschnitt(`Fenster ${fenster}: Druckvorschau`);
    await oeffneBauauftrag();
    await fall(fenster, 'Druckvorschau: Lupenhinweis solange unlesbar',
      'Der Hinweis auf die Lupe steht genau dann, wenn die Blattschrift unter 11 px ankommt',
      async () => {
        const d = await seite.auswerten('window._g.druckvorschau()');
        const gut = d.lupe === (d.wirksam < 11);
        return { gut, kurz: d.wirksam + ' px',
                 text: `Grundschrift ${d.grund} px × Maßstab ${d.skala.toFixed(3)} = ` +
                       `${d.wirksam} px, Hinweis ${d.lupe ? 'steht' : 'ist weg'}` };
      });
    await fall(fenster, 'Druckvorschau: drei Einstellungen ganz im Bild',
      'Von den Einstellungsfeldern stehen mindestens drei vollständig im Rollfenster',
      async () => {
        const d = await seite.auswerten('window._g.druckvorschau()');
        return { gut: d.ganzSichtbar >= 3, kurz: d.ganzSichtbar + ' von ' + d.felder,
                 text: `${d.ganzSichtbar} von ${d.felder} Feldern ganz im Bild, ` +
                       `dem Blatt bleiben ${d.blattAnteil} % der Fensterfläche` };
      });
    await fall(fenster, 'Druckvorschau: Umstellen behält die Originalgröße',
      'Eine geänderte Einstellung wirft das vergrößerte Blatt nicht in die Einpassung zurück',
      async () => {
        const u = await seite.auswerten('return await window._g.druckUmstellen();');
        return { gut: u.gross && u.skala === 1, kurz: u.gross ? '' : 'eingepasst',
                 text: u.gross
                   ? `bleibt groß (Maßstab ${u.skala}), Rollstand ${u.gerollt}`
                   : `fällt auf Maßstab ${u.skala} zurück` };
      });
    await schliesseBauauftrag();
  }
  await seite.auswerten('document.getElementById("aw-liste").click(); return true;');
  await seite.ruhe();

  /* Die Tabelle: eine Zeile je Prüfung, eine Spalte je Fenster – so ist auf
     einen Blick zu sehen, ab welcher Höhe ein Griff vom Blatt fällt. „zu“
     heißt: zu diesem Anteil verdeckt; „bis“ nennt die Unterkante in einem
     Fenster, das darüber endet. */
  console.log('\n  Übersicht je Fenster (zu = Anteil verdeckt, bis = Unterkante außerhalb)');
  const spalten = FENSTER.map(([br, ho]) => fensterName(br, ho));
  const sb = 11, sz = 52;
  console.log('  ' + ''.padEnd(sz) + spalten.map(f => f.padStart(sb)).join(''));
  for (const [zeile, werte] of uebersicht) {
    console.log('  ' + zeile.padEnd(sz) +
      spalten.map(f => (werte.get(f) || '–').padStart(sb)).join(''));
  }

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

  // ------------------------------------------------------------ Tablet nebeneinander

  b.abschnitt('Tablet hochkant: Liste und Karte stehen nebeneinander');
  /* 768 px sind 372 px Seitenleiste und 396 px Karte – mehr als die Hälfte
     bleibt der Karte. Mit der alten Grenze von 900 px bekam das iPad die
     Telefonaufteilung: Liste ODER Karte, dazu ein Umschalter, der 52 px kostete,
     obwohl beides nebeneinander gepasst hätte. Der Kern der Arbeit am Bauort
     ist, zu bestätigen und zugleich zu sehen, wo der Punkt liegt. */
  for (const [breite, hoehe] of [[768, 1024], [820, 1180]]) {
    await stelleEin(breite, hoehe);
    const neben = await seite.auswerten(`
      const s = window._g.muss('.seite').getBoundingClientRect();
      const k = window._g.muss('#karte').getBoundingClientRect();
      const w = document.getElementById('ansicht-wechsel');
      return { seite: Math.round(s.width), karte: Math.round(k.width),
               neben: s.right <= k.left + 1 && s.width > 0 && k.width > 0,
               wechsel: w.getClientRects().length > 0 };`);
    b.pruefe(neben.neben,
      `${breite}×${hoehe}: Liste (${neben.seite} px) und Karte (${neben.karte} px) nebeneinander`);
    b.pruefe(!neben.wechsel, `${breite}×${hoehe}: der Umschalter unten fehlt`);
    b.pruefe(neben.karte >= 380, `${breite}×${hoehe}: der Karte bleiben ${neben.karte} px`);
  }
  /* Und die Grenze selbst: einen Bildpunkt darunter löst wieder ab. */
  await stelleEin(759, 1024);
  b.pruefe(await seite.auswerten(
    'document.getElementById("ansicht-wechsel").getClientRects().length > 0'),
    '759 px: darunter lösen Liste und Karte einander wieder ab');

  b.abschnitt('Bei 320 px passen alle sechs Reiter nebeneinander');
  await stelleEin(320, 568);
  const reiter = await seite.auswerten(`
    const n = window._g.muss('.reiter');
    const b = [...n.querySelectorAll('button')].filter(e => e.getClientRects().length);
    return { ueber: n.scrollWidth - n.clientWidth, anzahl: b.length,
             letzter: b[b.length - 1].textContent.trim(),
             schmalster: Math.min(...b.map(e => window._g.treffer(e).breite)) };`);
  b.gleich(reiter.anzahl, 6, `Sechs Reiter stehen da (letzter: „${reiter.letzter}“)`);
  b.pruefe(reiter.ueber <= 0,
    `Die Reihe läuft nicht über (${reiter.ueber} px; vorher 32 px, ` +
    '„Planung“ lag außerhalb)');
  b.pruefe(reiter.schmalster >= 40,
    `Der schmalste Reiter trägt ${reiter.schmalster} px – gezielt wird auf ` +
    'ein Wort, nicht auf ein Zeichen');

  b.abschnitt('Volle Planung: die erste Strecke steht im ersten Schirm');
  /* Zwölf Strecken in vier Einsatzabschnitten – der Fall des Audits. Sie
     werden danach wieder abgeräumt, damit die folgenden Abschnitte dieselbe
     Planung vorfinden wie bisher. */
  await stelleEin(390, 690);
  await seite.auswerten('document.getElementById("aw-liste").click(); return true;');
  await seite.ruhe();
  const erste = await seite.auswerten(`
    const zu = await import('./js/state.js');
    window.fbp.store.aendern(p => {
      const ids = [];
      for (let i = 0; i < 4; i++) {
        const a = zu.neuerEinsatzabschnitt(p);
        a.name = 'Abschnitt ' + (i + 1);
        p.einsatzabschnitte.push(a); ids.push(a.id);
      }
      for (let i = 0; i < 12; i++) {
        const s = zu.neueStrecke(p);
        s.name = 'Probestrecke ' + (i + 1);
        s.abschnitt = ids[i % 4];
        s.punkte.push(zu.neuerPunkt(51.80 + i * 0.01, 10.60),
                      zu.neuerPunkt(51.806 + i * 0.01, 10.61));
        p.strecken.push(s);
      }
    }, 'strecke');
    await new Promise(f => requestAnimationFrame(f));
    const inh = window._g.muss('#inhalt-strecken');
    const e = window._g.muss('#strecken-liste .eintrag').getBoundingClientRect();
    const r = inh.getBoundingClientRect();
    const kopf = Math.round(window._g.muss('.seite-kopf', inh).getBoundingClientRect().height);
    const sicht = Math.max(0, Math.min(e.bottom, r.bottom) - Math.max(e.top, r.top));
    return { kopf, blatt: Math.round(r.height), gerollt: Math.round(inh.scrollTop),
             anteil: Math.round(sicht / (e.bottom - e.top) * 100) };`);
  b.gleich(erste.gerollt, 0, 'Der Reiter steht ungerollt');
  b.pruefe(erste.kopf <= 120,
    `Die Knopfzeile über der Liste misst ${erste.kopf} px (vorher 216 – drei volle Zeilen)`);
  b.gleich(erste.anteil, 100,
    `Die erste Strecke steht ganz im Blatt (${erste.anteil} % bei ${erste.blatt} px Blatthöhe)`);
  await seite.auswerten(`
    window.fbp.store.aendern(p => {
      p.strecken = p.strecken.filter(s => !/^Probestrecke /.test(s.name));
      p.einsatzabschnitte = [];
      for (const s of p.strecken) s.abschnitt = null;
    }, 'strecke');
    return true;`);
  await seite.ruhe();

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

  b.abschnitt('Tablet hochkant: das Blatt behält seinen eigenen Umbruchpunkt');
  /* Anwendung und Blatt brechen seit der Senkung von `SCHMAL_BIS` nicht mehr
     bei derselben Breite um, und das ist Absicht: Liste und Karte stehen bei
     768 px nebeneinander, das Blatt aber braucht neben der 272 px breiten
     Einstellungsspalte mehr, als ein 820 px breites Tablet hergibt – 0,468
     ist keine lesbare Einpassung. Die Begründung steht in `css/print.css`. */
  await stelleEin(820, 1180);
  await oeffneBauauftrag();
  b.gleich(await seite.auswerten(
    'getComputedStyle(document.getElementById("druck")).flexDirection'), 'column',
    'Die Einstellungen stehen über dem Blatt, obwohl die Anwendung hier schon breit aufteilt');
  b.pruefe(await seite.auswerten(`
    const s = document.querySelector('.druck-doku').style.transform || '';
    const m = /scale\\(([\\d.]+)\\)/.exec(s);
    return !m || parseFloat(m[1]) > 0.55;`),
    'Das Blatt wird nicht unter 0,55 eingepasst – darunter sind die Tabellen nicht mehr zu lesen');
  await schliesseBauauftrag();

  // ------------------------------------------------------------ Kein Überlauf

  b.abschnitt('Keine Ansicht läuft waagerecht über');
  for (const [breite, hoehe] of [...FENSTER, [768, 1024]]) {
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
