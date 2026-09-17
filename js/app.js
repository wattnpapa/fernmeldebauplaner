// app.js – Zusammenbau: Karte, Layer, Bedienung, Tastatur

import {
  store, neueStrecke, neuerPunkt, neuesZeichen,
  dateisicherung, istGehaltvoll, ladeAlle
} from './state.js';
import { erstelleKarte, setzeBasiskarte, setzeVorrang, BASISKARTEN } from './map.js';
import { bestand as kachelBestand } from './kacheln.js';
import { StreckenLayer, escapeHtml } from './strecken.js';
import { ZeichenLayer } from './zeichen.js';
import { FlaechenLayer } from './flaechen.js';
import { RelaisLayer } from './relais.js';
import { BilderLayer, uebernahmeLaeuft } from './bilder.js';
import { aufraeumen as bilderAufraeumen } from './bildspeicher.js';
import { GitterLayer } from './gitter.js';
import { toMGRS, toDDM, alleFormate } from './geo.js';
import { hoeheAn } from './hoehe.js';
import * as io from './io.js';
import * as teilen from './teilen.js';
import {
  initUI, zeichneStreckenListe, zeichneZeichenListe, zeichneProjektReiter, zeichneBilderListe,
  zeichneFlaechenListe, flaechenPalette,
  zeichneRelaisListe, relaisZielAntwort, ueberdeckungUmschalten,
  symbolPalette, koordinatenSuche, hilfeDialog, projektDialog, dialog, schliesseDialog,
  dialogAbweisen, hinweis, hinweisAus,
  abschnittAnlegen, zeichengruppeAnlegen, bilderUebernehmen, zeichneBauListe,
  baumeldungDialog
} from './ui.js';
import { baustrecke, baustreckeSetzen } from './baudoku.js';
import {
  initBaukarte, punktkarteOeffnen, punktkarteSchliessen, punktkarteOffen, punktkarteNachfuehren,
  punktHierAufnehmen, punktAufKarteStarten, punktAusKoordinate
} from './baukarte.js';
import {
  bauauftragOffen, schliesseBauauftrag, entferneSeitenformat, oeffneSammeldruck, oeffneLagekarte
} from './bauauftrag.js';
import { VERSION } from './version.js';

const $ = s => document.querySelector(s);

store.starten();

// ---------------------------------------------------------------- Karte & Layer

const karte = erstelleKarte($('#karte'), store.projekt.ansicht);

const sl = new StreckenLayer(karte, {
  aufAuswahl: () => {
    zl.auswahl = null; fl.auswahl = null; rl.auswahl = null;
    fl.zeichne(); rl.zeichne(); zeichneSeite();
  },
  aufAenderung: () => aktualisiereKennzahlen(),
  /* Die gebaute Trasse gehört auf die Arbeitskarte – auch im Planungsmodus:
     der Planer soll sehen, was draußen entstanden ist, ohne erst umzuschalten.
     Die Druckkarten in `bauauftrag.js` bekommen sie nicht; sie zeigen den
     Auftrag. */
  mitIst: true,
  aufIstPunkt: (s, pt) => {
    if (!pt) return;
    modusAnzeigen();
    /* Gleich benennen, was da aufgenommen wurde: die Punktkarte schlägt am
       frischen Punkt auf und nennt Koordinate, Herkunft und Abweichung
       selbst – eine Pille darüber sagte dasselbe ein zweites Mal und stünde
       3,2 s über der Karte. Im Planungsmodus kommt der Weg nicht vor – der
       Setzmodus wird nur aus dem Baumodus gestartet –, dort meldet sie. */
    if (baumodus) { punktkarteOeffnen(s, { ist: pt }); hinweisAus(); }
    else hinweis('Punkt aufgenommen');
  },
  /* Im Baumodus schlägt der Tipp auf eine Marke die Punktkarte auf: am
     geplanten Punkt mit den drei Wegen ihn aufzunehmen, am gebauten mit der
     Frage, was dort ist. Am Bauort ersetzt das den Tooltip, den kein
     Touchgerät zeigt. */
  aufSollPunkt: (s, pt) => punktkarteOeffnen(s, { soll: pt }),
  aufIstPunktWahl: (s, pt) => punktkarteOeffnen(s, { ist: pt })
});

const zl = new ZeichenLayer(karte, {
  aufAuswahl: zid => {
    if (zid) {
      sl.auswahl = null; fl.auswahl = null; rl.auswahl = null;
      fl.zeichne(); rl.zeichne(); reiterWechseln('zeichen');
    }
    zeichneSeite();
  },
  aufAenderung: () => {}
});

const fl = new FlaechenLayer(karte, {
  aufAuswahl: fid => {
    if (fid) {
      sl.auswahl = null; zl.auswahl = null; rl.auswahl = null;
      zl.zeichne(); rl.zeichne(); reiterWechseln('flaechen');
    }
    modusAnzeigen();
    zeichneSeite();
  },
  aufAenderung: () => {}
});

/* Die Relaisstellen liegen als eigene Ebene neben Zeichen und Flächen: sie
   tragen ein taktisches Zeichen, führen aber zusätzlich eine gerechnete Fläche,
   und die muss beim Verschieben und Ausblenden mitgehen. `aufZiel` beantwortet
   die Rückwärtsfrage nach der Masthöhe – die Ebene fängt den Kartenklick, die
   Seitenleiste schreibt das Ergebnis. */
const rl = new RelaisLayer(karte, {
  aufAuswahl: rid => {
    if (rid) {
      sl.auswahl = null; zl.auswahl = null; fl.auswahl = null;
      zl.zeichne(); fl.zeichne(); reiterWechseln('relais');
    }
    modusAnzeigen();
    zeichneSeite();
  },
  aufZiel: (rid, ziel) => { relaisZielAntwort(rid, ziel); modusAnzeigen(); },
  aufAenderung: () => {}
});

const bl = new BilderLayer(karte, {
  aufAuswahl: bid => {
    if (bid) {
      sl.auswahl = null; zl.auswahl = null; fl.auswahl = null; rl.auswahl = null;
      fl.zeichne(); rl.zeichne(); reiterWechseln('bilder');
    }
    zeichneSeite();
  },
  aufAenderung: () => {}
});

const gl = new GitterLayer(karte);

initUI({
  karte, sl, zl, bl, fl, rl, weiterzeichnen, zeichenSetzen, flaecheSetzen, relaisSetzen,
  zurKarte, bildOrtSetzen, aufAenderung: () => {},
  /* Die Seitenleiste startet im Baumodus einen Setzmodus („Punkt auf der
     Karte“). Die Modusleiste hängt an der Werkzeugleiste und wird deshalb von
     hier aus geführt – ohne diesen Weg bliebe sie beim Setzen aus, und schmal
     stünde am Bauort kein Bedienelement mehr da. */
  modusAnzeigen: () => modusAnzeigen()
});
/* Die Karte des Baumodus bekommt, was sie aus der Oberfläche braucht, von
   hier – sie darf `ui.js` nicht einführen, weil `ui.js` sie einführt. */
initBaukarte({ karte, sl, hinweis, hinweisAus, modusAnzeigen: () => modusAnzeigen(), zurKarte });

// Der Stand steht dauerhaft im Kopf: Wer zu einem gedruckten Bauauftrag
// zurückfragt, hat dieselbe Nummer vor Augen, die im Blattfuß steht – ohne
// erst einen Reiter aufzuschlagen.
$('#marke-version').textContent = VERSION;

// ---------------------------------------------------------------- Zeichnen

function neueStreckeStarten() {
  let sid;
  store.aendern(p => { const s = neueStrecke(p); sid = s.id; p.strecken.push(s); }, 'strecke');
  reiterWechseln('strecken');
  weiterzeichnen(sid);
}

function weiterzeichnen(sid) {
  zl.beendeSetzen();
  fl.beendeSetzen();
  bl.beendeSetzen();
  sl.starteZeichnen(sid);
  zurKarte();
  modusAnzeigen();
}

function zeichnenBeenden(abbrechen = false) {
  if (!sl.zeichenModus) return;
  const sid = sl.zeichenModus;
  const s = store.strecke(sid);
  sl.beendeZeichnen();
  /* Eine Strecke ohne einen einzigen Punkt hat niemand gewollt – gleich, ob
     „Abbrechen“ oder der große „Fertig“-Knopf sie beendet. Sie stumm in der
     Liste stehen zu lassen, verfälscht auch die Zählung im Sammeldruck. */
  if (s && s.punkte.length === 0) {
    store.aendern(p => { p.strecken = p.strecken.filter(x => x.id !== sid); }, 'strecke');
  } else if (s && s.punkte.length === 1) {
    hinweis('Eine Strecke braucht mindestens zwei Trassenpunkte.', 'warnung');
  }
  modusAnzeigen();
  zeichneSeite();
}

/* Beim Zeichnen wird die Koordinate Trassenpunkt statt Sprungziel – der
   einzige Weg, eine Strecke ganz ohne Zeigegerät zu erfassen. Die Kartensicht
   folgt dem Punkt, damit der Fortschritt sichtbar bleibt. */
function koordinatenSucheOeffnen() {
  koordinatenSuche(sl.zeichenModus ? k => {
    if (!sl.punktAnfuegen(k.lat, k.lng)) return false;
    karte.setView([k.lat, k.lng], Math.max(karte.getZoom(), 15));
    modusAnzeigen();
  } : null);
}

function zeichenSetzenStarten() {
  symbolPalette(symbolId => zeichenSetzen(symbolId));
}

/** Setzmodus starten – `zuteilung` ({abschnitt, gruppe}) teilt das Zeichen
 *  gleich beim Setzen zu. Die Seitenleiste ruft das über den Kontext auf; die
 *  Modusanzeige gehört hierher, weil sie an der Werkzeugleiste hängt. */
function zeichenSetzen(symbolId, zuteilung = {}) {
  zeichnenBeenden(true);
  bl.beendeSetzen();
  fl.beendeSetzen();
  rl.beendeSetzen();
  zl.starteSetzen(symbolId, zuteilung);
  zurKarte();
  modusAnzeigen();
  hinweis('Auf die Karte klicken, um das Zeichen zu setzen.');
}

function flaecheSetzenStarten() {
  flaechenPalette(vorlage => flaecheSetzen(vorlage));
}

/** Setzmodus für eine Fläche oder eine ganze Aufstellung – der nächste Klick
 *  auf die Karte ist ihre Mitte. */
function flaecheSetzen(vorlage, zuteilung = {}) {
  zeichnenBeenden(true);
  bl.beendeSetzen();
  zl.beendeSetzen();
  rl.beendeSetzen();
  fl.starteSetzen(vorlage, zuteilung);
  zurKarte();
  modusAnzeigen();
  hinweis(vorlage.teile
    ? 'Auf die Karte klicken – dort steht die Mitte der Aufstellung. Danach am Griff drehen.'
    : 'Auf die Karte klicken – dort steht die Mitte der Fläche. Danach am Griff drehen.');
}

/** Setzmodus für eine Relaisstelle – der nächste Klick auf die Karte ist ihr
 *  Standort. `zuteilung` ({abschnitt}) teilt sie gleich beim Setzen zu. */
function relaisSetzen(zuteilung = {}) {
  zeichnenBeenden(true);
  bl.beendeSetzen();
  zl.beendeSetzen();
  fl.beendeSetzen();
  rl.starteSetzen(zuteilung);
  zurKarte();
  modusAnzeigen();
  hinweis('Auf die Karte klicken, um den Standort der Relaisstelle zu setzen.');
}

/** Ort eines Bildes auf der Karte nachtragen – der nächste Klick setzt ihn */
function bildOrtSetzen(bid) {
  zeichnenBeenden(true);
  zl.beendeSetzen();
  fl.beendeSetzen();
  rl.beendeSetzen();
  rl.beendeZielwahl();
  bl.starteSetzen(bid);
  zurKarte();
  modusAnzeigen();
  hinweis('Auf die Karte klicken, um den Aufnahmeort zu setzen.');
}

function modusAnzeigen() {
  const zeichnet = !!sl.zeichenModus;
  const setzt = !!zl.setzModus;
  const flaecht = !!fl.setzModus;
  /* Die Zielwahl zählt als Relaismodus: auch sie wartet auf einen Kartenklick,
     und das Werkzeug muss zeigen, dass der nächste Klick vergeben ist. */
  const relais = !!rl.setzModus || !!rl.zielModus;
  const istSetzen = !!sl.istSetzModus;
  $('#wz-strecke').classList.toggle('aktiv', zeichnet);
  $('#wz-zeichen').classList.toggle('aktiv', setzt);
  $('#wz-flaeche').classList.toggle('aktiv', flaecht);
  $('#wz-relais').classList.toggle('aktiv', relais);
  // schmal weicht die Werkzeugleiste der Modusleiste – beide sitzen unten
  document.body.classList.toggle('modus-aktiv',
    zeichnet || setzt || flaecht || relais || istSetzen);
  /* Die Modusleiste teilen sich zwei Lagen mit verschiedener Besetzung: beim
     Zeichnen drei Knöpfe, beim Setzen eines Ist-Punktes einer. Die Klasse
     macht den Unterschied im Stilblatt greifbar – ohne sie müsste die Leiste
     für drei Knöpfe ausgelegt bleiben, auch wenn nur einer darin steht. */
  document.body.classList.toggle('ist-setzen', istSetzen);
  /* Ein Setzmodus wartet auf den nächsten Kartentipp – die Punktkarte
     wartet auf denselben und würde ihn schlucken. Sie geht zu. */
  if (zeichnet || setzt || flaecht || relais || istSetzen) punktkarteSchliessen();

  const box = $('#zeichen-hinweis');
  /* Die Modusleiste muss auch beim Setzen eines Ist-Punktes stehen: schmal
     nimmt `body.modus-aktiv` die Werkzeugleiste vom Schirm, und ohne diese
     Leiste bliebe am Bauort kein einziges Bedienelement übrig – kein Weg
     zurück außer der Esc-Taste, die es dort nicht gibt. */
  box.hidden = !zeichnet && !istSetzen;
  /* Der Griff heißt nach seiner Wirkung. „Abbrechen“ allein liest sich beim
     Setzen eines Ist-Punktes wie „das Aufgenommene verwerfen“ – verworfen wird
     aber nur das Setzen, das noch gar nicht geschehen ist. Esc tut in beiden
     Modi dasselbe, das Kürzel bleibt deshalb stehen (und geht am Finger von
     selbst vom Schirm, siehe .zh-taste). */
  box.querySelector('[data-akt="abbruch"]').innerHTML =
    (istSetzen ? 'Setzen abbrechen' : 'Abbrechen') + '<i class="zh-taste">Esc</i>';
  if (istSetzen) {
    const s = store.strecke(sl.istSetzModus.sid);
    /* Kurz, weil die Leiste am unteren Kartenrand steht und jede Zeile dort
       Karte kostet: der ganze Satz „auf die Karte tippen, wo der Punkt
       wirklich liegt“ steht einmal als Meldung, wenn der Modus beginnt. Hier
       bleibt der Merker – und der Streckenname, weil blind an die im
       Bau-Reiter gewählte Strecke geschrieben wird. */
    box.querySelector('.zh-text').innerHTML =
      `<b>${escapeHtml(s ? s.name : '')}</b> – auf die Karte tippen`;
    box.querySelector('[data-akt="fertig"]').hidden = true;
    box.querySelector('[data-akt="zurueck"]').hidden = true;
    return;
  }
  box.querySelector('[data-akt="fertig"]').hidden = false;
  box.querySelector('[data-akt="zurueck"]').hidden = false;
  if (zeichnet) {
    const s = store.strecke(sl.zeichenModus);
    const n = s ? s.punkte.length : 0;
    box.querySelector('.zh-text').innerHTML =
      `<b>${escapeHtml(s ? s.name : '')}</b> – ${n} ${n === 1 ? 'Punkt' : 'Punkte'} gesetzt.
       Trasse auf der Karte anklicken.`;
    /* Solange kein Punkt steht, gibt es nichts fertigzustellen und nichts
       zurückzunehmen; gesperrt statt wirkungslos, damit der Fehlgriff auf den
       großen Knopf im Daumenbereich gar nicht erst passiert. */
    box.querySelector('[data-akt="fertig"]').disabled = n === 0;
    box.querySelector('[data-akt="zurueck"]').disabled = n === 0;
  }
}

$('#zeichen-hinweis').addEventListener('click', e => {
  const akt = e.target.dataset.akt;
  if (akt === 'abbruch' && sl.istSetzModus) {
    sl.beendeIstSetzen();
    return modusAnzeigen();
  }
  if (akt === 'zurueck') { sl.letztenPunktZurueck(); modusAnzeigen(); }
  if (akt === 'fertig') zeichnenBeenden(false);
  if (akt === 'abbruch') zeichnenBeenden(true);
});

// ---------------------------------------------------------------- Karten-Klick ohne Modus

karte.on('click', e => {
  if (e.originalEvent?._fbpVerbraucht) return;
  /* Ein Tipp neben die Punktkarte schließt sie – und tut sonst nichts. Wer
     die Koordinate will, tippt noch einmal. */
  if (punktkarteOffen()) return punktkarteSchliessen();
  /* Dasselbe für die offene Kartenoptionen-Tafel, und aus demselben Grund:
     schmal steht sie über dem Verlauf, und der Kopfgriff ganz oben ist sonst
     der einzige Weg zurück. Gemerkt wird das nicht – gemerkt wird nur die
     ausdrückliche Wahl am Kopf. */
  if (schmalesFenster.matches && !koTafel.classList.contains('zu')) {
    return kartenoptionenSetzen(true);
  }
  if (sl.zeichenModus || zl.setzModus || bl.setzModus || fl.setzModus) return;
  if (sl.auswahl || zl.auswahl || bl.auswahl || fl.auswahl) {
    sl.auswahl = null; zl.auswahl = null; bl.auswahl = null; fl.auswahl = null;
    zeichneAlles();
    /* Im Baumodus geht es nach dem Abwählen gleich weiter zum Popup. Die
       Auswahl hat dort für den Trupp keine sichtbare Wirkung, kostete aber
       einen Tipp, der scheinbar nichts tut – und die Antwort darauf ist der
       Doppeltipp, der die Karte zoomt. In der Planung bleibt das Abwählen ein
       eigener Schritt: dort ist die Auswahl zu sehen, und wer sie aufhebt,
       will meist nur sie aufheben. */
    if (!baumodus) return;
  }
  koordinatenPopup(e.latlng);
});

/* Wieviel oben und unten der Karte belegt ist. Leaflet braucht die Zahlen, um
   das Popup ins freie Band zu schieben; gerechnet wird aus den Rechtecken und
   nicht aus den gemessenen Variablen, weil dieselbe Kante je nach Modus von
   Werkzeugleiste, Bauleiste oder Statusleiste gehalten wird. */
function kartenRand() {
  const k = karte.getContainer().getBoundingClientRect();
  const hoch = (wahl, vonUnten) => {
    const e = document.querySelector(wahl);
    if (!e || !e.offsetHeight) return 0;
    const r = e.getBoundingClientRect();
    return Math.max(0, Math.round(vonUnten ? k.bottom - r.top : r.bottom - k.top));
  };
  return {
    oben: Math.max(hoch('.leaflet-top.leaflet-right'), hoch('.kartenoptionen')) + 12,
    unten: Math.max(hoch('.werkzeuge', true), hoch('.statusleiste', true),
                    hoch('.leaflet-bottom.leaflet-right', true)) + 12
  };
}

function koordinatenPopup(ll) {
  const f = alleFormate(ll.lat, ll.lng);
  /* Im Baumodus bietet der Tipp auf die Karte an, was dort gebraucht wird:
     den Punkt aufnehmen. „Zeichen setzen“ und „Neue Strecke“ gehören zur
     Planung – ihre Werkzeuge sind im Baumodus vom Schirm, und ein Griff, der
     einen Zeichenmodus ohne Werkzeugleiste startete, wäre eine Sackgasse. */
  const tasten = baumodus
    ? `<button data-kp="kopie">Kopieren</button>
       <button data-kp="ist" class="kp-primaer">Punkt hier aufnehmen</button>`
    : `<button data-kp="kopie">Kopieren</button>
       <button data-kp="zeichen">Zeichen setzen</button>
       <button data-kp="strecke">Neue Strecke ab hier</button>`;
  const html = `<div class="koord-popup">
      <div class="kp-zeile"><span>MGRS</span><code>${escapeHtml(f.mgrs)}</code></div>
      <div class="kp-zeile"><span>GPS</span><code>${escapeHtml(f.ddm)}</code></div>
      <div class="kp-zeile"><span>Dezimal</span><code>${escapeHtml(f.latlng)}</code></div>
      <div class="kp-tasten">${tasten}</div>
    </div>`;
  /* Das Popup öffnet nach oben und landete damit unter den Kartenaufsätzen:
     Leaflets Kartenebene bildet durch ihr `transform` einen eigenen
     Stapelkontext, und die Popup-Ebene gilt nur innerhalb davon – Werkzeuge,
     Kartenoptionen und Zoomsteuerung liegen darüber. Ein Tipp auf den
     sichtbaren Rest klappte die Tafel auf, statt den Punkt aufzunehmen. An der
     Stapelordnung zu drehen hülfe nicht: die Aufsätze SOLLEN über der Karte
     liegen. Leaflet bekommt stattdessen gesagt, wieviel belegt ist, und
     schiebt die Karte beim Öffnen so weit, dass das Popup im freien Band
     steht. */
  const rand = kartenRand();
  const popup = L.popup({
    className: 'fbp-popup', maxWidth: 320,
    autoPanPaddingTopLeft: [12, rand.oben],
    autoPanPaddingBottomRight: [12, rand.unten]
  }).setLatLng(ll).setContent(html).openOn(karte);

  setTimeout(() => {
    const wurzel = popup.getElement();
    if (!wurzel) return;
    wurzel.addEventListener('click', ev => {
      const akt = ev.target.dataset.kp;
      if (!akt) return;
      if (akt === 'kopie') {
        navigator.clipboard?.writeText(`${f.mgrs}\n${f.ddm}\n${f.latlng}`)
          .then(() => hinweis('Koordinaten kopiert')).catch(() => hinweis('Kopieren nicht möglich', 'fehler'));
      }
      if (akt === 'ist') {
        karte.closePopup();
        punktAusKoordinate(ll.lat, ll.lng);
      }
      if (akt === 'zeichen') {
        karte.closePopup();
        symbolPalette(sym => {
          store.aendern(p => {
            const z = neuesZeichen(ll.lat, ll.lng, sym);
            p.zeichen.push(z);
            zl.auswahl = z.id;
          }, 'zeichen');
          reiterWechseln('zeichen');
        });
      }
      if (akt === 'strecke') {
        karte.closePopup();
        let sid;
        store.aendern(p => {
          const s = neueStrecke(p);
          s.punkte.push(neuerPunkt(ll.lat, ll.lng, 'start'));
          sid = s.id;
          p.strecken.push(s);
        }, 'strecke');
        reiterWechseln('strecken');
        weiterzeichnen(sid);
      }
    });
  }, 0);
}

// ---------------------------------------------------------------- Statusleiste

const slMgrs = $('#sl-mgrs'), slGps = $('#sl-gps'), slDez = $('#sl-dez'), slElev = $('#sl-elev'), slQuelle = $('#sl-quelle');
const OHNE_KOORD = 'Karte antippen für die Koordinate';

/* Auf einem Touchgerät gibt es kein mousemove – die Leiste blieb dort dauerhaft
   auf „–“. Sie zeigt deshalb die zuletzt angetippte Position und sagt dazu,
   dass es die angetippte und nicht die überfahrene ist. */
let angetippt = null;

/* Die Höhe kommt asynchron aus der Kachel. Bei schnellen Mausbewegungen
   können Antworten in anderer Reihenfolge eintreffen als die Anfragen –
   nur die jüngste darf in die Leiste, sonst zeigt sie eine alte Position. */
let hoehenLauf = 0;

function koordZeigen(ll, quelle) {
  slMgrs.textContent = toMGRS(ll.lat, ll.lng, 5);
  slGps.textContent = toDDM(ll.lat, ll.lng);
  slDez.textContent = `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
  slQuelle.textContent = quelle;
  const lauf = ++hoehenLauf;
  hoeheAn(ll.lat, ll.lng).then(h => {
    if (lauf !== hoehenLauf) return;
    slElev.textContent = h === null ? '–' : `${Math.round(h)} m`;
  });
}

function koordLeeren() {
  if (angetippt) return koordZeigen(angetippt, 'zuletzt angetippte Position');
  slMgrs.textContent = slGps.textContent = slDez.textContent = '–';
  slQuelle.textContent = OHNE_KOORD;
}

/* Ohne Netz sagte die Anwendung nichts: die Karte blieb grau, die Höhe stand
   auf „–“, und was fehlte, war nicht zu erraten. Die Leiste sagt es jetzt –
   still, dauerhaft und mit der Zahl, auf die es dann ankommt: wie viele
   Kacheln im Gerät liegen. Ein Vorrat von null heißt am Bauort, dass die Karte
   grau bleibt; einer von zweitausend heißt, dass alles da ist. */
const slNetz = $('#sl-netz');
function netzstandZeigen(aus) {
  /* Die Höhe weicht, solange der Ausfall steht: sie kommt aus einer Kachel und
     zeigt ohne Netz ohnehin „–“. Ohne diesen Tausch bricht die Leiste bei
     390 px in zwei Zeilen um und nimmt der Karte 21 px – dauerhaft, denn der
     Ausfall dauert die ganze Baustelle. */
  slNetz.parentElement.classList.toggle('ohne-netz', aus);
  if (!aus) { slNetz.hidden = true; return; }
  slNetz.hidden = false;
  slNetz.textContent = 'kein Netz';
  kachelBestand().then(b => {
    slNetz.textContent = `kein Netz, Vorrat: ${b.anzahl.toLocaleString('de-DE')} Kacheln`;
  }).catch(() => { /* ohne Bestand bleibt die kurze Form stehen – sie ist die Aussage */ });
}
karte.on('fbp:kachelnot', e => netzstandZeigen(e.aus));
/* Meldet der Browser das Netz zurück, ist die Anzeige sofort falsch – auf die
   nächste geglückte Kachel zu warten hieße, sie bis zur nächsten Bewegung der
   Karte stehen zu lassen. */
window.addEventListener('online', () => netzstandZeigen(false));
window.addEventListener('offline', () => netzstandZeigen(true));
if (navigator.onLine === false) netzstandZeigen(true);

karte.on('mousemove', e => koordZeigen(e.latlng, 'Position des Mauszeigers'));
karte.on('mouseout', koordLeeren);
// feuert auch beim Antippen – und in jedem Modus, also auch beim Zeichnen
karte.on('click', e => {
  angetippt = e.latlng;
  koordZeigen(e.latlng, 'zuletzt angetippte Position');
});

/** Die Zahl, die über Funk durchgegeben wird – ein Tipp legt sie in die Zwischenablage */
function koordKopieren(wert, was) {
  if (!wert || wert === '–') return hinweis('Noch keine Koordinate – zuerst die Karte antippen.');
  const lauf = navigator.clipboard?.writeText(wert);
  if (!lauf) return hinweis('Kopieren nicht möglich', 'fehler');
  lauf.then(() => hinweis(`${was} kopiert: ${wert}`)).catch(() => hinweis('Kopieren nicht möglich', 'fehler'));
}
$('#sl-mgrs-kopie').onclick = () => koordKopieren(slMgrs.textContent, 'MGRS');
$('#sl-gps-kopie').onclick = () => koordKopieren(slGps.textContent, 'GPS-Koordinate');

/* Die Kanten der Karte sind belegt: unten Statusleiste, darüber Maßstab und
   Quellenangabe, schmal darüber die Werkzeuge; oben rechts die Zoomsteuerung,
   unter der die Kartenoptionen sitzen. Alle diese Höhen ändern sich – die
   Statusleiste bricht um, an den Leaflet-Bedienelementen kann eines dazu-
   kommen –, deshalb werden sie gemessen statt geschätzt. Festwerte hatten
   erst den Maßstab verdeckt und dann die Kartenoptionen falsch eingehängt.
   Die Kopfzeile misst hier mit: sie bricht schmal in zwei Reihen um, und an
   ihrer Unterkante hängt das Dateimenü. */
const statusLeiste = document.querySelector('.statusleiste');
const kopfLeiste = document.querySelector('.kopf');
const kartenFuss = document.querySelector('.leaflet-bottom.leaflet-right');
const kartenKopf = document.querySelector('.leaflet-top.leaflet-right');
function leistenMessen() {
  const st = document.documentElement.style;
  st.setProperty('--sl-hoehe', statusLeiste.offsetHeight + 'px');
  /* Eine eigene Variable und nicht --kopf-hoehe: die ist die Mindesthöhe der
     Kopfzeile selbst. Ihr den gemessenen Wert zu geben hieße, eine Leiste an
     ihre eigene Höhe zu binden – das Menü rechnete bisher mit 52 px, während
     die umgebrochene Kopfzeile 95 px hoch stand, und der letzte Eintrag lag
     40 px hinter dem Umschalter Liste/Karte. */
  if (kopfLeiste) st.setProperty('--kopf-ist', kopfLeiste.offsetHeight + 'px');
  if (kartenFuss) st.setProperty('--karten-fuss', kartenFuss.offsetHeight + 'px');
  if (kartenKopf) {
    st.setProperty('--karten-kopf', kartenKopf.offsetHeight + 'px');
    /* Die Breite trägt die Kartenoptionen neben die Zoomsteuerung statt unter
       sie – gemessen, weil dort ein Bedienelement dazukommen kann. */
    st.setProperty('--karten-kopf-breite', kartenKopf.offsetWidth + 'px');
  }
}
const leistenWaechter = new ResizeObserver(leistenMessen);
leistenWaechter.observe(statusLeiste);
if (kopfLeiste) leistenWaechter.observe(kopfLeiste);
if (kartenFuss) leistenWaechter.observe(kartenFuss);
if (kartenKopf) leistenWaechter.observe(kartenKopf);
leistenMessen();

karte.on('moveend zoomend', () => {
  store.still(p => {
    const c = karte.getCenter();
    p.ansicht = { ...p.ansicht, lat: c.lat, lng: c.lng, zoom: karte.getZoom() };
  });
});

// ---------------------------------------------------------------- Werkzeuge

$('#btn-neue-strecke').onclick = () => sl.zeichenModus ? zeichnenBeenden(false) : neueStreckeStarten();
$('#btn-neues-zeichen').onclick = () => zl.setzModus ? (zl.beendeSetzen(), modusAnzeigen()) : zeichenSetzenStarten();
$('#btn-neue-flaeche').onclick = () => fl.setzModus ? (fl.beendeSetzen(), modusAnzeigen()) : flaecheSetzenStarten();
$('#btn-neue-relaisstelle').onclick = () =>
  rl.setzModus ? (rl.beendeSetzen(), modusAnzeigen()) : relaisSetzen();
$('#btn-ueberdeckung').onclick = ev => ueberdeckungUmschalten(ev.currentTarget);
$('#btn-neuer-abschnitt').onclick = () => abschnittAnlegen();
$('#btn-neue-zeichengruppe').onclick = () => zeichengruppeAnlegen();
$('#btn-sammel-pdf').onclick = () => oeffneSammeldruck();
$('#btn-lagekarte').onclick = () => oeffneLagekarte();

$('#wz-strecke').onclick = () => sl.zeichenModus ? zeichnenBeenden(false) : neueStreckeStarten();
$('#wz-zeichen').onclick = () => zl.setzModus ? (zl.beendeSetzen(), modusAnzeigen()) : zeichenSetzenStarten();
$('#wz-flaeche').onclick = () => fl.setzModus ? (fl.beendeSetzen(), modusAnzeigen()) : flaecheSetzenStarten();
$('#wz-relais').onclick = () =>
  rl.setzModus ? (rl.beendeSetzen(), modusAnzeigen()) : relaisSetzen();
$('#wz-suche').onclick = () => koordinatenSucheOeffnen();
$('#wz-standort').onclick = standortUmschalten;
$('#wz-punkt-hier').onclick = punktHierAufnehmen;
$('#wz-punkt-karte').onclick = punktAufKarteStarten;

let standortMarker = null;

/* Der Standort ist ein Umschalter: wer ihn einmal geholt hat, will ihn beim
   Weiterplanen auch wieder los sein – ohne die Seite neu zu laden. */
function standortUmschalten() {
  if (standortMarker) return standortVerbergen();
  standortZeigen();
}

function standortVerbergen() {
  karte.removeLayer(standortMarker);
  standortMarker = null;
  standortKnopfAnzeigen();
}

function standortKnopfAnzeigen() {
  const b = $('#wz-standort');
  const an = !!standortMarker;
  b.classList.toggle('aktiv', an);
  b.title = an ? 'Eigenen Standort ausblenden' : 'Eigenen Standort anzeigen';
}

function standortZeigen() {
  if (!navigator.geolocation) return hinweis('Dieses Gerät liefert keine Position.', 'fehler');
  hinweis('Position wird ermittelt …');
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    if (standortMarker) karte.removeLayer(standortMarker);
    standortMarker = L.layerGroup([
      L.circle([lat, lng], { radius: accuracy, color: '#0b7bd4', weight: 1, fillOpacity: 0.12 }),
      L.circleMarker([lat, lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#0b7bd4', fillOpacity: 1 })
        .bindTooltip(`Eigener Standort (±${Math.round(accuracy)} m)<br>${toMGRS(lat, lng, 5)}`,
          { direction: 'top', className: 'fbp-tooltip' })
    ]).addTo(karte);
    karte.setView([lat, lng], Math.max(karte.getZoom(), 16));
    standortKnopfAnzeigen();
    hinweis(`Standort: ${toMGRS(lat, lng, 5)} (±${Math.round(accuracy)} m)`);
  }, err => hinweis('Position nicht verfügbar: ' + err.message, 'fehler'),
     { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
}

// ---------------------------------------------------------------- Kartenoptionen

const basisSelect = $('#basiskarte');
BASISKARTEN.forEach(b => {
  const o = document.createElement('option');
  o.value = b.id; o.textContent = b.name;
  basisSelect.appendChild(o);
});
basisSelect.value = store.projekt.ansicht.basemap;
basisSelect.onchange = () => {
  setzeBasiskarte(karte, basisSelect.value);
  store.still(p => { p.ansicht.basemap = basisSelect.value; });
};

/* Fünf Einmalschalter dürfen die Trasse nicht dauerhaft überstimmen: die
   Tafel klappt zu und merkt sich das je Sitzung (nur auf diesem Gerät, wie
   alles hier). Schmal beginnt sie geschlossen – dort ist die Kartenfläche
   das Produkt; breit offen, damit die Schalter auffindbar bleiben. */
const schmalesFenster = window.matchMedia('(max-width: 900px)');
const koTafel = $('#kartenoptionen'), koKopf = $('#ko-kopf');
function kartenoptionenSetzen(zu) {
  koTafel.classList.toggle('zu', zu);
  koKopf.setAttribute('aria-expanded', String(!zu));
}
/* Gemerkt wird nur die ausdrückliche Wahl – schriebe schon der Start den
   Vorgabezustand fest, bliebe er nach einem Größenwechsel fälschlich stehen. */
koKopf.onclick = () => {
  const zu = !koTafel.classList.contains('zu');
  kartenoptionenSetzen(zu);
  try { sessionStorage.setItem('fmbauplaner.kartenoptionen', zu ? 'zu' : 'auf'); }
  catch { /* privater Modus ohne Speicher – dann eben ohne Gedächtnis */ }
};
let koGemerkt = null;
try { koGemerkt = sessionStorage.getItem('fmbauplaner.kartenoptionen'); } catch { }
kartenoptionenSetzen(koGemerkt ? koGemerkt === 'zu' : schmalesFenster.matches);

const optionsFelder = [
  ['#opt-gitter', 'gitter'],
  ['#opt-teillaengen', 'teillaengen'],
  ['#opt-gesamtlaenge', 'gesamtlaenge'],
  ['#opt-punktnummern', 'punktnummern'],
  ['#opt-punktnamen', 'punktnamen'],
  ['#opt-bilder', 'bilder']
];
for (const [sel, schluessel] of optionsFelder) {
  const cb = $(sel);
  cb.checked = !!store.projekt.optionen[schluessel];
  cb.onchange = () => store.aendern(p => { p.optionen[schluessel] = cb.checked; }, 'option');
}
const schildAbstand = $('#opt-beschriftungsabstand');
schildAbstand.value = String(store.projekt.optionen.beschriftungsabstand || 0);
schildAbstand.onchange = () => store.aendern(p => {
  p.optionen.beschriftungsabstand = Number(schildAbstand.value) || 0;
}, 'option');

const groesse = $('#opt-symbolgroesse');
groesse.value = store.projekt.optionen.symbolgroesse || 1;
groesse.oninput = () => store.aendern(p => { p.optionen.symbolgroesse = Number(groesse.value); }, 'option');

// ---------------------------------------------------------------- Kopfleiste

const nameFeld = $('#projektname');
nameFeld.value = store.projekt.name;
nameFeld.oninput = () => store.aendern(p => { p.name = nameFeld.value; }, 'formular');

/** Planung als Datei sichern – der einzige Weg, sie aus diesem Browser herauszubekommen */
function planungSichern(pid) {
  /* Seit die Lichtbilder mitgehen, wird die Datei erst zusammengestellt und
     dann heruntergeladen – die Meldung wartet auf das Ergebnis. */
  io.projektExportieren(pid)
    .then(ok => { if (ok) hinweis('Planung als Datei gesichert'); })
    .catch(e => hinweis('Sichern fehlgeschlagen: ' + e.message, 'fehler'));
}
$('#sb-sichern').onclick = () => planungSichern();
$('#speicherstatus').onclick = () => planungSichern();

/* Die Hilfe steht in der Kopfzeile, nicht nur im Datei-Menü: der Leertext der
   Streckenliste erklärt das Zeichnen nur, solange noch keine Strecke da ist –
   danach braucht es einen bleibenden Weg dorthin. */
$('#btn-hilfe').onclick = hilfeDialog;
$('#btn-undo').onclick = () => { if (!store.undo()) hinweis('Nichts zum Rückgängigmachen.'); };
$('#btn-redo').onclick = () => { if (!store.redo()) hinweis('Nichts zum Wiederholen.'); };
/* Liste und Karte lösen einander schmal ab. Der Umschalter unten ist der einzige
   Rückweg, der immer sichtbar ist – der Kartenbereich ist ausgeblendet, solange
   die Liste davorliegt, ein Knopf darin käme nie zum Vorschein. */
const awListe = $('#aw-liste'), awKarte = $('#aw-karte');
function ansichtSetzen(karteVorn) {
  document.body.classList.toggle('seite-zu', karteVorn);
  awListe.classList.toggle('aktiv', !karteVorn);
  awKarte.classList.toggle('aktiv', karteVorn);
  awListe.setAttribute('aria-pressed', String(!karteVorn));
  awKarte.setAttribute('aria-pressed', String(karteVorn));
  if (karteVorn) setTimeout(() => karte.invalidateSize(), 0);
}
awListe.onclick = () => ansichtSetzen(false);
awKarte.onclick = () => ansichtSetzen(true);
/* Wird das Fenster über die Schmalgrenze hinaus breit (iPad-Drehung), gibt es
   den Umschalter unten nicht mehr – .seite-zu bliebe sonst gefangen und die
   Streckenliste wäre unerreichbar. Am resize-Ereignis statt am change der
   Media Query: Letzteres bleibt unter Geräte-Emulation stumm und wäre so
   nicht prüfbar; die Bedingung selbst kommt weiter aus derselben Abfrage. */
const schmalAbfrage = window.matchMedia('(max-width: 900px)');
window.addEventListener('resize', () => {
  if (!schmalAbfrage.matches && document.body.classList.contains('seite-zu')) ansichtSetzen(false);
});

const dateiKnopf = $('#btn-datei'), dateiMenu = $('#menu-datei');
dateiKnopf.onclick = e => {
  e.stopPropagation();
  const auf = dateiMenu.hidden;
  dateiMenu.hidden = !auf;
  dateiKnopf.setAttribute('aria-expanded', String(auf));
};
document.addEventListener('click', () => {
  if (!dateiMenu.hidden) { dateiMenu.hidden = true; dateiKnopf.setAttribute('aria-expanded', 'false'); }
});
dateiMenu.addEventListener('click', e => {
  const akt = e.target.dataset.akt;
  if (!akt) return;
  dateiMenu.hidden = true;
  ({
    neu: neuesProjektDialog,
    oeffnen: projektDialog,
    'export-json': () => planungSichern(),
    import: () => $('#datei-import').click(),
    teilen: teilenDialog,
    speicher: () => speicherDialogOeffnen(),
    'sammel-pdf': () => oeffneSammeldruck(),
    lagekarte: () => oeffneLagekarte(),
    'export-geojson': () => io.geoJSONExportieren(),
    'export-gpx': () => io.gpxExportieren(),
    'export-kml': () => io.kmlExportieren(),
    hilfe: hilfeDialog
  })[akt]?.();
});

function neuesProjektDialog() {
  const box = document.createElement('div');
  box.innerHTML = `<label class="feld"><span class="feld-titel">Name der neuen Planung</span>
    <input type="text" id="np-name" value="Planung ${new Date().toLocaleDateString('de-DE')}"></label>
    <p class="klein">Die aktuelle Planung bleibt gespeichert und lässt sich über
      „Gespeicherte Planungen“ wieder öffnen.</p>`;
  dialog({
    titel: 'Neue Planung', inhalt: box,
    fuss: [{ text: 'Abbrechen' }, { text: 'Anlegen', primaer: true, tun: () => {
      store.neu(box.querySelector('#np-name').value.trim() || 'Neue Planung');
      hinweis('Neue Planung angelegt');
    } }]
  });
}

// ---------------------------------------------------------------- Teilen

/* Die Planung reist im Fragment der Adresse – hinter dem `#`, das kein Server
   je zu sehen bekommt. Wie sie dorthin gepackt wird, steht in `js/teilen.js`;
   warum der Weg über das Fragment und nicht über eine Ablage im Netz führt, in
   `TEILEN.md`. Hier steht nur die Bedienung. */

const zahlwort = (n, ein, viele) => `${n.toLocaleString('de-DE')} ${n === 1 ? ein : viele}`;

function umfangText(p) {
  const punkte = (p.strecken || []).reduce((n, s) => n + (s.punkte || []).length, 0);
  const teile = [];
  if ((p.strecken || []).length)
    teile.push(`${zahlwort(p.strecken.length, 'Strecke', 'Strecken')} mit ${zahlwort(punkte, 'Punkt', 'Punkten')}`);
  if ((p.zeichen || []).length)
    teile.push(zahlwort(p.zeichen.length, 'taktisches Zeichen', 'taktische Zeichen'));
  if ((p.flaechen || []).length) teile.push(zahlwort(p.flaechen.length, 'Fläche', 'Flächen'));
  if ((p.relaisstellen || []).length)
    teile.push(zahlwort(p.relaisstellen.length, 'Relaisstelle', 'Relaisstellen'));
  /* Die Baudokumentation gehört in die Aufzählung, sobald es eine gibt: Ein
     Link, der die Rückmeldung eines Trupps trägt, meldete sonst „Noch nichts
     gezeichnet“ – und der Empfänger verwürfe ihn als leer. */
  const istPunkte = (p.strecken || []).reduce((n, s) => n + (s.bau?.punkte || []).length, 0);
  if (istPunkte) teile.push(`Baudokumentation mit ${zahlwort(istPunkte, 'Ist-Punkt', 'Ist-Punkten')}`);
  return teile.join(' · ') || 'Noch nichts gezeichnet';
}

/* Die Ampel misst nicht den Browser – der trägt ein Vielfaches –, sondern die
   Mailprogramme: sie brechen lange Zeilen um, und ein umgebrochener Link kommt
   beim Empfänger als Bruchstück an. */
function teilenDialog() {
  if (!teilen.kannPacken()) {
    dialog({
      titel: 'Planung als Link teilen',
      inhalt: `<p>Dieser Browser bringt die Packfunktion nicht mit, mit der die Planung in
          einen Link passt. Neuere Fassungen von Firefox, Chrome und Safari haben sie.</p>
        <p class="klein">Bis dahin führt der Weg über <b>Datei → Planung als Datei sichern</b>.
          Der Empfänger öffnet die Datei über „Planung oder KML laden“.</p>`,
      fuss: [{ text: 'Schließen', primaer: true }]
    });
    return;
  }

  const p = store.projekt;
  const abschnitte = p.einsatzabschnitte || [];
  const box = document.createElement('div');
  box.innerHTML = `
    <label class="feld"><span class="feld-titel">Was soll der Link enthalten?</span>
      <select id="tl-was">
        <option value="alles">Die ganze Planung – ${escapeHtml(p.name)}</option>
        ${abschnitte.map(a =>
          `<option value="ea:${escapeHtml(a.id)}">Nur den Einsatzabschnitt „${escapeHtml(a.name)}“</option>`).join('')}
        <option value="ausschnitt">Nur den Kartenausschnitt – ohne Planungsdaten</option>
      </select></label>
    <p class="teilen-umfang" id="tl-umfang"></p>
    <div class="teilen-zeile">
      <input class="teilen-link" id="tl-link" readonly spellcheck="false" value="wird erzeugt …">
      <button type="button" class="knopf" id="tl-kopieren">Kopieren</button>
    </div>
    <p class="teilen-ampel" id="tl-ampel"></p>
    <p class="teilen-merke" id="tl-merke"></p>`;

  const was = box.querySelector('#tl-was');
  const feldLink = box.querySelector('#tl-link');
  const ampel = box.querySelector('#tl-ampel');
  const merke = box.querySelector('#tl-merke');
  const umfang = box.querySelector('#tl-umfang');

  /* Der Merksatz steht bei jedem Link, nicht nur beim langen: Die Anwendung
     überträgt nichts, aber sie stellt hier etwas her, das der Nutzer selbst
     überträgt – und der Weg dorthin führt durch fremde Hände. Wer das erst im
     Kleingedruckten einer Hilfeseite läse, läse es nie. */
  const MERKSATZ = 'Wer den Link hat, hat die Planung. Er geht durch den Dienst, mit dem du ihn verschickst – dort liegt sie dann.';

  /* Jeder Wechsel des Auswahlfelds startet einen Lauf. Packt der Browser den
     vorigen langsamer als den neuen, träfe dessen Ergebnis auf einen Dialog,
     der längst etwas anderes zeigt – der Link passte dann nicht zur Anzeige.
     Nur der jüngste Lauf schreibt, und nur solange der Dialog noch steht. */
  let lauf = 0;

  async function neuBauen() {
    const meins = ++lauf;
    const gilt = () => meins === lauf && box.isConnected;
    const wahl = was.value;
    feldLink.value = 'wird erzeugt …';
    ampel.className = 'teilen-ampel';
    ampel.textContent = '';
    try {
      if (wahl === 'ausschnitt') {
        const link = teilen.ausschnittAlsLink(store.projekt.ansicht);
        feldLink.value = link;
        umfang.textContent = 'Lage, Maßstab und Basiskarte – sonst nichts.';
        const u = teilen.laengenUrteil(link.length);
        ampel.className = 'teilen-ampel ' + u.klasse;
        ampel.textContent = u.text;
        merke.textContent = 'Dieser Link enthält keine Planungsdaten – nur den Blick auf die Karte.';
        return;
      }
      const quelle = wahl === 'alles' ? store.projekt : io.abschnittAlsProjekt(wahl.slice(3));
      if (!quelle) {
        feldLink.value = '';
        umfang.textContent = 'In diesem Einsatzabschnitt ist noch nichts geplant.';
        merke.textContent = '';
        return;
      }
      const link = await teilen.alsLink(quelle);
      if (!gilt()) return;
      feldLink.value = link;
      umfang.textContent = umfangText(quelle);
      const u = teilen.laengenUrteil(link.length);
      ampel.className = 'teilen-ampel ' + u.klasse;
      ampel.textContent = u.text;
      const bilder = (quelle.bilder || []).length;
      merke.textContent = !bilder ? MERKSATZ : bilder === 1
        ? `${MERKSATZ} Das Lichtbild reist nicht mit – sein Ort und seine Beschriftung ja, die Aufnahme selbst nicht.`
        : `${MERKSATZ} Die ${bilder} Lichtbilder reisen nicht mit – ihre Orte und Beschriftungen ja, die Aufnahmen selbst nicht.`;
    } catch (e) {
      if (!gilt()) return;
      feldLink.value = '';
      hinweis(e.message, 'fehler');
    }
  }

  was.onchange = neuBauen;
  box.querySelector('#tl-kopieren').onclick = () => {
    const wert = feldLink.value;
    if (!wert || wert.startsWith('wird erzeugt')) return;
    /* Markieren in jedem Fall: Schlägt die Zwischenablage fehl – ältere
       Browser, verweigerte Berechtigung –, liegt der Link wenigstens
       griffbereit für Strg+C. */
    feldLink.select();
    const lauf = navigator.clipboard?.writeText(wert);
    if (!lauf) return hinweis('Kopieren nicht möglich – der Link ist markiert, Strg+C genügt.', 'fehler');
    lauf.then(() => hinweis('Link kopiert'))
      .catch(() => hinweis('Kopieren nicht möglich – der Link ist markiert, Strg+C genügt.', 'fehler'));
  };

  dialog({ titel: 'Planung als Link teilen', inhalt: box, breit: true,
    fuss: [{ text: 'Schließen', primaer: true }] });
  neuBauen();
}

// ---------------------------------------------------------------- Link empfangen

/* Ein Link darf nichts überschreiben: Der Empfänger sieht zuerst, was da
   ankommt, und entscheidet dann. Das Fragment wird in jedem Fall geräumt –
   sonst stünde die Planung im Verlauf des Browsers, und ein Browser mit
   Verlaufssynchronisierung trüge sie zu seinem Hersteller.

   Geräumt wird aber erst NACH der Entscheidung und nicht davor. Vorher war
   ein Fehlgriff auf den Schleier – quer 54 px breit, genau unter dem Daumen –
   das Ende der Meldung: Dialog zu, Fragment leer, ein Neuladen holte nichts
   zurück, und der Link kam über Funk. Jetzt räumt jeder der beiden Fußknöpfe,
   und solange niemand entschieden hat, bringt ein Neuladen die Meldung wieder
   herein. Die Zusage bleibt gewahrt: die Adresse trägt die Planung nur, solange
   der Dialog offen steht, und ein Verlaufseintrag entsteht dabei nicht –
   `fragmentRaeumen` schreibt mit `replaceState` in denselben. */
async function geteiltenLinkPruefen() {
  const art = teilen.artDesFragments();
  if (!art) return;

  if (art === 'ausschnitt') {
    const a = teilen.ausschnittAusFragment();
    teilen.fragmentRaeumen();
    if (!a) return;
    if (a.basemap && BASISKARTEN.some(k => k.id === a.basemap)) {
      basisSelect.value = a.basemap;
      setzeBasiskarte(karte, a.basemap);
      store.still(pr => { pr.ansicht.basemap = a.basemap; });
    }
    karte.setView([a.lat, a.lng], a.zoom);
    hinweis('Kartenausschnitt aus dem Link geöffnet');
    return;
  }

  if (art === 'meldung') {
    let meldung;
    try {
      meldung = await teilen.baumeldungAusFragment();
    } catch (e) {
      teilen.fragmentRaeumen();
      hinweis(e.message, 'fehler');
      return;
    }
    if (!meldung) return teilen.fragmentRaeumen();
    if (bauauftragOffen()) schliesseBauauftrag();
    baumeldungDialog(meldung, 'Link', () => teilen.fragmentRaeumen());
    return;
  }

  let roh;
  try {
    roh = await teilen.planungAusFragment();
  } catch (e) {
    teilen.fragmentRaeumen();
    hinweis(e.message, 'fehler');
    return;
  }
  if (!roh) return teilen.fragmentRaeumen();

  /* Der Bauauftrag legt sich über die ganze Anwendung. Käme der Link an,
     während er offen steht, stünde der Dialog unsichtbar dahinter. */
  if (bauauftragOffen()) schliesseBauauftrag();

  const bilder = (roh.bilder || []).length;
  const stand = roh.geaendert ? zeitpunktKurz(roh.geaendert) : '';
  const herkunft = roh.herkunft?.einsatzabschnitt
    ? `<p class="klein">Ausschnitt „${escapeHtml(roh.herkunft.einsatzabschnitt)}“ aus der Planung
        „${escapeHtml(roh.herkunft.projekt || '')}“.</p>` : '';

  dialog({
    titel: 'Geteilte Planung geöffnet',
    inhalt: `<p>Über den Link kommt <b>${escapeHtml(roh.name || 'eine Planung')}</b> herein.</p>
      <p class="teilen-umfang">${escapeHtml(umfangText(roh))}${stand ? ' · Stand ' + escapeHtml(stand) : ''}</p>
      ${herkunft}
      ${bilder ? `<p class="teilen-merke">${bilder === 1
          ? 'Zu dieser Planung gehört ein Lichtbild, das ein Link nicht tragen kann. Sein Ort und seine Beschriftung sind da, die Aufnahme selbst nicht'
          : `Zu dieser Planung gehören ${bilder} Lichtbilder, die ein Link nicht tragen kann. Ihre Orte und Beschriftungen sind da, die Aufnahmen selbst nicht`}
        – dafür braucht es die Planungsdatei.</p>` : ''}
      <p class="klein">Sie wird als <b>neue</b> Planung übernommen. Deine bisherige bleibt
        unter „Gespeicherte Planungen“ erhalten.</p>`,
    geteilt: true,
    schutz: 'Bitte entscheiden: verwerfen oder übernehmen.',
    fuss: [
      { text: 'Verwerfen', tun: () => {
        teilen.fragmentRaeumen();
        hinweis('Geteilte Planung verworfen – der Link ist damit verbraucht.', 'warnung');
      } },
      { text: 'Übernehmen', primaer: true, tun: () => {
        teilen.fragmentRaeumen();
        /* `uebernehmen` schickt die Planung durch `migrieren()` – dieselbe
           Strecke, die eine geladene Datei nimmt – und meldet „geladen“;
           daran hängt der vollständige Neuaufbau samt Kartensprung. */
        try {
          store.uebernehmen(roh);
          hinweis('Geteilte Planung übernommen');
        } catch (e) {
          /* Ein von Hand gebauter Link kann Werte falschen Typs mitbringen –
             `punkte` als Objekt statt als Feld etwa. Ohne diesen Fang bliebe
             der Dialog offen stehen und der Knopf ohne jede Wirkung. */
          console.error('Geteilte Planung nicht lesbar', e);
          hinweis('Die Planung in diesem Link ist beschädigt und wurde nicht übernommen.', 'fehler');
        }
      } }
    ]
  });
}

// ---------------------------------------------------------------- Lichtbilder

$('#btn-neue-bilder').onclick = () => $('#bild-import').click();
$('#bild-import').onchange = e => {
  const dateien = Array.from(e.target.files || []);
  e.target.value = '';                 // dieselbe Auswahl soll erneut möglich sein
  bilderHinzufuegen(dateien);
};

function bilderHinzufuegen(dateien) {
  bilderUebernehmen(dateien).then(ergebnis => {
    const verortet = (ergebnis?.angenommen || []).filter(b => b.lat !== null);
    /* Wartet noch ein Bild auf seinen Ort, bleibt die Liste vorn – dort steht
       der Knopf, mit dem er gesetzt wird. */
    if (!verortet.length || ergebnis.ohneOrt) return reiterWechseln('bilder');
    /* Die Bilder eines Bauorts liegen selten dort, wo die Karte gerade steht.
       Ohne den Sprung dorthin bliebe von der Übernahme nur die Meldung. */
    if (!verortet.some(b => karte.getBounds().contains([b.lat, b.lng]))) {
      karte.fitBounds(L.latLngBounds(verortet.map(b => [b.lat, b.lng])),
        { padding: [80, 80], maxZoom: 17 });
    }
    zurKarte();
  });
}

/* Aufgefangen wird der Abwurf im ganzen Fenster, nicht nur über der Karte:
   fiele eine Datei daneben, öffnete der Browser sie an Stelle der Anwendung –
   und ein halb gezeichneter Streckenzug wäre verloren. */
const abwurf = $('#abwurf');
let abwurfTiefe = 0;

function traegtDateien(e) {
  return Array.from(e.dataTransfer?.types || []).includes('Files');
}

document.addEventListener('dragenter', e => {
  if (!traegtDateien(e)) return;
  e.preventDefault();
  abwurfTiefe++;
  abwurf.hidden = false;
});
document.addEventListener('dragover', e => { if (traegtDateien(e)) e.preventDefault(); });
/* Gezählt statt geschaltet: dragleave feuert auch beim Übergang von einem
   Element zum nächsten – ein einfaches Ausblenden ließe die Fläche flackern.
   Verlässt der Griff dagegen das Fenster, wird nicht gezählt, sondern
   zurückgesetzt: dort bleibt sonst ein Zähler stehen, den nichts mehr
   herunterbringt. */
document.addEventListener('dragleave', e => {
  if (!traegtDateien(e)) return;
  const hinaus = e.clientX <= 0 || e.clientY <= 0 ||
    e.clientX >= window.innerWidth || e.clientY >= window.innerHeight;
  abwurfTiefe = hinaus ? 0 : Math.max(0, abwurfTiefe - 1);
  if (!abwurfTiefe) abwurf.hidden = true;
});
document.addEventListener('drop', e => {
  if (!traegtDateien(e)) return;
  e.preventDefault();
  abwurfTiefe = 0;
  abwurf.hidden = true;
  const dateien = Array.from(e.dataTransfer.files || []);
  /* Auch am Namen und nicht nur am gemeldeten Typ: für eine aus dem Ordner
     gezogene HEIC-Datei gibt Chrome oft gar keinen Typ an. Was danach wirklich
     kein Bild ist, meldet die Übernahme einzeln. */
  const bilder = dateien.filter(d => /^image\//.test(d.type) || /\.hei[cf]$/i.test(d.name));
  if (bilder.length) return bilderHinzufuegen(bilder);
  if (dateien.length) {
    hinweis('Hier lassen sich nur Bilder ablegen – Planungen und KML kommen über ' +
      '„Datei → Planung oder KML laden“.', 'warnung');
  }
});

$('#datei-import').onchange = e => {
  const datei = e.target.files[0];
  if (!datei) return;
  io.projektImportieren(datei)
    .then(ergebnis => {
      schliesseDialog();
      /* Eine Baumeldung wird nicht geöffnet, sondern eingespielt – und vorher
         gezeigt. Das ist die einzige Datei, für die es hier eine Vorschau gibt;
         bei einer Planung genügt das Danebenlegen, bei ihr nicht: sie
         überschreibt etwas. */
      if (ergebnis.baumeldung) baumeldungDialog(ergebnis.baumeldung, 'Datei');
      else hinweis(ergebnis.meldung);
    })
    .catch(err => hinweis('Import fehlgeschlagen: ' + err.message, 'fehler'));
  e.target.value = '';
};

// ---------------------------------------------------------------- Reiter

document.querySelectorAll('.reiter button').forEach(b => {
  b.onclick = () => reiterWechseln(b.dataset.reiter);
});
/* Die Seite öffnet auf „Strecken“, ohne dass jemand den Reiter angeklickt hat –
   ohne diesen Anstoß bliebe der Vorrang auf der Karte bis zum ersten Wechsel
   falsch gesetzt. */
setzeVorrang(karte, document.querySelector('.reiter button.aktiv')?.dataset.reiter);
/** Auf schmalen Geräten die Karte in den Vordergrund holen */
function zurKarte() {
  if (window.matchMedia('(max-width: 900px)').matches) ansichtSetzen(true);
}

// ------------------------------------------------- Planungsmodus / Baumodus

/* Zwei Modi, eine Anwendung, ein Datenbestand. Der Baumodus blendet weg, was
   am Bauort niemand braucht, und zeigt den Reiter, an dem dort gearbeitet wird.

   Umgeschaltet statt ergänzt: zu siebt wurde die Reiterreihe breiter als ein
   320-px-Fenster (siehe den Kommentar in css/app.css). So stehen nie mehr als
   sechs Reiter da – im Baumodus sogar nur drei.

   „Strecken“ bleibt auch im Baumodus stehen: dort steht der Bauauftrag mit
   Querungsauflagen und Fundstellen, und genau danach wird am Bauplatz
   gesucht. */
const REITER_BAU = new Set(['bau', 'strecken', 'projekt']);
const KEY_MODUS = 'fbp.modus.v1';

/* Der Modus überlebt das Neuladen. Das ist kein Beiwerk: am Bauort wird die
   Seite neu geladen, weil das Netz weg war oder der Browser den Reiter
   weggeräumt hat, und wer dann im Planungsmodus landet, sucht erst einmal.
   Er liegt außerhalb der Planung – er ist eine Einstellung dieses Geräts und
   gehört weder in den Undo-Stapel noch in eine geteilte Datei. */
let baumodus = (() => {
  try { return localStorage.getItem(KEY_MODUS) === 'bau'; } catch (e) { return false; }
})();

/* Nur beim allerersten Anwenden wird der Reiter erzwungen – danach ist der
   offene Reiter die Wahl des Nutzers und bleibt, wo er ist. */
let erstesAnwenden = true;

function modusAnwenden() {
  document.body.classList.toggle('baumodus', baumodus);
  /* Die Karte zeichnet im Baumodus anders: geplante Punkte werden angetippt
     statt gezogen, die Einfügegriffe fehlen. Sie muss es wissen und neu
     zeichnen – die Ziehbarkeit hängt an der Marke, nicht an einer Klasse. */
  sl.baumodus = baumodus;
  sl.zeichne();
  const schalter = $('#btn-modus');
  schalter.textContent = baumodus ? 'Planung' : 'Baumodus';
  schalter.setAttribute('aria-pressed', String(baumodus));
  schalter.title = baumodus
    ? 'Zurück zur Planung'
    : 'Dokumentieren, was am Bauort gebaut wurde';
  document.querySelectorAll('.reiter button').forEach(b => {
    b.hidden = baumodus ? !REITER_BAU.has(b.dataset.reiter) : b.dataset.reiter === 'bau';
  });
  /* Steht der offene Reiter im neuen Modus nicht mehr da, wäre die
     Seitenleiste leer und der wandernde tabindex zeigte auf einen Knopf, den
     es nicht gibt. Beim Start im Baumodus gilt dasselbe für „Strecken“: der
     Reiter ist dort zwar erlaubt, aber nach einem Neuladen am Bauort – Netz
     weg, Reiter vom Browser weggeräumt – stünde die Planungsliste da und nicht
     die Bauliste, obwohl der Modus richtig wiederhergestellt ist. */
  const offen = document.querySelector('.reiter button.aktiv');
  if (!offen || offen.hidden) reiterWechseln(baumodus ? 'bau' : 'strecken');
  else if (baumodus && erstesAnwenden) reiterWechseln('bau');
  erstesAnwenden = false;
}

function modusUmschalten() {
  /* Hinter dem gedruckten Blatt wird nicht umgeschaltet: der Bauauftrag liegt
     über der Anwendung, und ein Moduswechsel dahinter beendete still einen
     Setzmodus, wechselte den Reiter und meldete etwas, das niemand sieht.
     Dieselbe Sperre haben alle Tastenkürzel (siehe unten). */
  if (bauauftragOffen()) return;
  baumodus = !baumodus;
  try { localStorage.setItem(KEY_MODUS, baumodus ? 'bau' : 'planung'); }
  catch (e) { /* ohne Vermerk beginnt der nächste Start in der Planung */ }
  /* Ein laufender Setzmodus gehört dem verlassenen Modus: der nächste Klick
     auf die Karte täte sonst etwas, das zur gezeigten Oberfläche nicht passt. */
  zeichnenBeenden(true);
  zl.beendeSetzen(); fl.beendeSetzen(); rl.beendeSetzen(); bl.beendeSetzen();
  sl.beendeIstSetzen();
  punktkarteSchliessen();
  modusAnwenden();
  reiterWechseln(baumodus ? 'bau' : 'strecken');
  modusAnzeigen();
  hinweis(baumodus
    ? 'Baumodus: festhalten, was gebaut wurde. Die Planung bleibt unangetastet.'
    : 'Planungsmodus.');
}

$('#btn-modus').onclick = modusUmschalten;

function reiterWechseln(name) {
  document.querySelectorAll('.reiter button').forEach(b => {
    const an = b.dataset.reiter === name;
    b.classList.toggle('aktiv', an);
    b.setAttribute('aria-selected', String(an));
    /* Wandernder tabindex: Tab betritt das Reiterwerk genau einmal, die
       Pfeiltasten wechseln – erst damit hält role=tablist, was es ankündigt. */
    b.tabIndex = an ? 0 : -1;
    /* Schmal rollt die Reiterreihe (siehe app.css). Wer über die Pfeiltasten
       wechselt, wird vom Fokus mitgenommen – wer aber von anderswoher hierher
       geschickt wird, etwa nach dem Bilderimport, säße sonst vor einem
       Reiter, der außerhalb des Sichtbereichs liegt. */
    if (an) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  document.querySelectorAll('.reiter-inhalt').forEach(s =>
    s.classList.toggle('aktiv', s.dataset.inhalt === name));
  setzeVorrang(karte, name);
  ansichtSetzen(false);
}

document.querySelector('.reiter').addEventListener('keydown', e => {
  const schritt = { ArrowRight: 1, ArrowLeft: -1, Home: 0, End: 0 };
  if (!(e.key in schritt)) return;
  e.preventDefault();
  /* Nur die sichtbaren Reiter: im Baumodus sind die Planungsreiter weg, und
     der Fokus dürfte nicht auf einem Knopf landen, den niemand sieht. */
  const knoepfe = [...document.querySelectorAll('.reiter button')].filter(b => !b.hidden);
  if (!knoepfe.length) return;
  let i = knoepfe.findIndex(b => b.classList.contains('aktiv'));
  if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = knoepfe.length - 1;
  else i = (i + schritt[e.key] + knoepfe.length) % knoepfe.length;
  reiterWechseln(knoepfe[i].dataset.reiter);
  knoepfe[i].focus();
});

// ---------------------------------------------------------------- Dialog schließen

/* Nicht schliesseDialog, sondern der abweisbare Weg: über den Schleier und das
   Kreuz gingen die beiden Empfangsdialoge zu, ohne dass entschieden war – und
   mit ihnen die eingegangene Planung. */
$('#dialog').addEventListener('click', e => {
  if (e.target.id === 'dialog' || e.target.dataset.akt === 'dialog-zu') dialogAbweisen();
});

// ---------------------------------------------------------------- Tastatur

document.addEventListener('keydown', e => {
  const imFeld = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);

  if (e.key === 'Escape') {
    if (bauauftragOffen()) return schliesseBauauftrag();
    if (!$('#dialog').hidden) return void dialogAbweisen();
    /* Das Datei-Menü schließt wie der Dialog auch per Esc – der Fokus kehrt
       zum Knopf zurück, damit die Tastatur nicht ins Leere fällt. */
    if (!dateiMenu.hidden) {
      dateiMenu.hidden = true;
      dateiKnopf.setAttribute('aria-expanded', 'false');
      dateiKnopf.focus();
      return;
    }
    if (punktkarteOffen()) return punktkarteSchliessen();
    if (sl.istSetzModus) { sl.beendeIstSetzen(); return modusAnzeigen(); }
    if (sl.zeichenModus) return zeichnenBeenden(true);
    if (zl.setzModus) { zl.beendeSetzen(); return modusAnzeigen(); }
    if (fl.setzModus) { fl.beendeSetzen(); return modusAnzeigen(); }
    if (bl.setzModus) { bl.beendeSetzen(); return hinweis('Ort setzen abgebrochen.'); }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? store.redo() : store.undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault(); store.speichern(); hinweis('Planung gespeichert'); return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !bauauftragOffen()) {
    const s = gemeinteStrecke();
    if (s) { e.preventDefault(); import('./bauauftrag.js').then(m => m.oeffneBauauftrag(s.id)); }
    return;   // sonst druckt der Browser – und bekommt das Hinweisblatt vorgelegt
  }

  if (imFeld || !$('#dialog').hidden || bauauftragOffen()) return;

  if (e.key === 'Enter' && sl.zeichenModus) { e.preventDefault(); return zeichnenBeenden(false); }
  if (e.key === 'Backspace' && sl.zeichenModus) { e.preventDefault(); sl.letztenPunktZurueck(); return modusAnzeigen(); }

  const taste = e.key.toLowerCase();
  /* Die Zeichenwerkzeuge sind im Baumodus vom Schirm – ihre Tasten auch.
     Sonst startete ein Tastendruck einen Modus, dessen Leiste es dort nicht
     gibt, und der nächste Kartentipp täte etwas Unsichtbares. */
  if (baumodus && ['s', 't', 'f', 'r'].includes(taste)) return;
  if (taste === 's') { e.preventDefault(); sl.zeichenModus ? zeichnenBeenden(false) : neueStreckeStarten(); }
  if (taste === 't') { e.preventDefault(); zeichenSetzenStarten(); }
  if (taste === 'f') { e.preventDefault(); flaecheSetzenStarten(); }
  if (taste === 'r') { e.preventDefault(); rl.setzModus ? (rl.beendeSetzen(), modusAnzeigen()) : relaisSetzen(); }
  if (taste === 'k') { e.preventDefault(); koordinatenSucheOeffnen(); }
});

karte.on('dblclick', () => { if (sl.zeichenModus) zeichnenBeenden(false); });

// ---------------------------------------------------------------- Drucken

/** Die Strecke, die bei einem Druckbefehl gemeint sein kann: die gewählte,
 *  sonst – wenn es nur eine druckbare gibt – eben diese. Bei mehreren wird
 *  nicht geraten. */
function gemeinteStrecke() {
  if (sl.auswahl) {
    const s = store.strecke(sl.auswahl);
    return s && s.punkte.length >= 2 ? s : null;
  }
  const fertig = store.projekt.strecken.filter(s => s.punkte.length >= 2);
  return fertig.length === 1 ? fertig[0] : null;
}

/* Gedruckt wird im FMBauplaner der Bauauftrag, nicht die Bildschirmansicht.
   Kommt der Druckbefehl trotzdem an der Bauauftragsansicht vorbei – über das
   Browsermenü oder Strg+P ohne eindeutige Strecke –, wird statt eines leeren
   Blattes ein Blatt gedruckt, das den Weg dorthin beschreibt. */
function hinweisblattEntfernen() {
  document.getElementById('druckhinweis')?.remove();
  document.body.classList.remove('druckhinweis');
}

function hinweisblattAufbauen() {
  hinweisblattEntfernen();
  entferneSeitenformat();   // ein liegengebliebenes A3-Format wäre hier falsch

  const p = store.projekt;
  const fertig = p.strecken.filter(s => s.punkte.length >= 2);
  const gewaehlt = gemeinteStrecke();

  let lage;
  if (gewaehlt) {
    lage = `Gewählt ist zurzeit die Strecke <b>${escapeHtml(gewaehlt.name)}</b> mit
            ${gewaehlt.punkte.length} Punkten. Mit <b>Strg+P</b> öffnet sich ihr
            Bauauftrag unmittelbar.`;
  } else if (fertig.length > 1) {
    lage = `Druckbereit sind in dieser Planung:
            ${fertig.map(s => escapeHtml(s.name)).join(', ')}.`;
  } else if (p.strecken.length) {
    lage = `Keine der ${p.strecken.length} Strecken dieser Planung hat bislang zwei
            Trassenpunkte. Für den Bauauftrag werden mindestens zwei gebraucht.`;
  } else {
    lage = 'In dieser Planung ist noch keine Strecke geplant.';
  }

  const blatt = document.createElement('div');
  blatt.id = 'druckhinweis';
  blatt.innerHTML = `
    <h1>Kein Bauauftrag geöffnet</h1>
    <p class="dh-planung">Planung: <b>${escapeHtml(p.name)}</b></p>
    <p>Der FMBauplaner druckt den Bauauftrag einer Strecke, nicht die
       Bildschirmansicht. Deshalb liegt hier kein Bauauftrag vor.</p>
    <p>So entsteht er:</p>
    <ol>
      <li>Im Reiter „Strecken“ die gewünschte Strecke anklicken.</li>
      <li>In der geöffneten Strecke <b>Bauauftrag (PDF)</b> wählen.</li>
      <li>Dort Format, Ausrichtung und Farbe einstellen und
          <b>Drucken / Als PDF speichern</b> wählen.</li>
    </ol>
    <p>${lage}</p>
    <p class="dh-fuss">FMBauplaner · fmbauplaner.app · gedruckt am
       ${new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</p>`;
  document.body.appendChild(blatt);
  document.body.classList.add('druckhinweis');
}

window.addEventListener('beforeprint', () => {
  if (bauauftragOffen()) return;
  hinweisblattAufbauen();
});
window.addEventListener('afterprint', hinweisblattEntfernen);

// ---------------------------------------------------------------- Rendern

function zeichneAlles() {
  sl.zeichne();
  zl.zeichne();
  fl.zeichne();
  rl.zeichne();
  rl.flaechenZeichnen();
  bl.zeichne();
  gl.zeichne();
  zeichneSeite();
}

function zeichneSeite() {
  zeichneStreckenListe();
  zeichneZeichenListe();
  zeichneFlaechenListe();
  zeichneRelaisListe();
  zeichneBilderListe();
  zeichneBauListe();
  zeichneProjektReiter();
}

function aktualisiereKennzahlen() { /* Kennzahlen aktualisiert die Seitenleiste selbst */ }

/* Der Browserspeicher schreibt von selbst; was der Nutzer selbst tun muss, ist
   die Dateisicherung. Deshalb trägt der Kopfzeilen-Status diesen Zeitpunkt und
   meldet den laufenden Schreibvorgang nur, solange er läuft. */
function speicherstatusZeigen(zustand = 'ruhe') {
  const st = $('#speicherstatus');
  const band = $('#speicherband'), stand = $('#sb-stand');
  st.classList.remove('offen', 'fehler', 'mahnung');
  if (zustand === 'laeuft') {
    st.textContent = 'wird gespeichert …';
    st.classList.add('offen');
    return;
  }
  if (zustand === 'fehler') {
    st.textContent = 'nicht gespeichert';
    st.classList.add('fehler');
    stand.textContent = 'Browserspeicher meldet einen Fehler.';
    band.classList.add('mahnung');
    return;
  }
  const zeit = dateisicherung(store.projekt.id);
  st.textContent = 'zuletzt als Datei gesichert: ' + (zeit ? zeitpunktKurz(zeit) : '—');
  /* Schmal trägt das Band den Stand: dort ist die Kopfzeile zu eng für Worte,
     und ein Punkt allein wäre kein Hinweis, sondern ein Rätsel. */
  const mahnen = !zeit && istGehaltvoll(store.projekt);
  st.classList.toggle('mahnung', mahnen);
  band.classList.toggle('mahnung', mahnen);
  /* Immer ein ganzer Satz: schmal ist dieses Band die einzige Auskunft über
     den Verbleib der Arbeit, und eine leere Stelle liest sich wie „gesichert“. */
  stand.textContent = zeit ? 'Als Datei gesichert: ' + zeitpunktKurz(zeit)
    : 'Noch nie als Datei gesichert.';
}

function zeitpunktKurz(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const heuteGleich = d.toDateString() === new Date().toDateString();
  return d.toLocaleString('de-DE', heuteGleich
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

store.on((p, grund) => {
  if (grund === 'gespeichert') { speicherstatusZeigen('ruhe'); return; }
  if (grund === 'dateisicherung') { speicherstatusZeigen('ruhe'); zeichneProjektReiter(); return; }
  if (grund === 'speicherfehler') {
    speicherstatusZeigen('fehler');
    hinweis('Speichern im Browser fehlgeschlagen – Planung als Datei sichern.', 'fehler');
    return;
  }

  speicherstatusZeigen('laeuft');

  sl.zeichne();
  zl.zeichne();
  fl.zeichne();
  rl.zeichne();
  /* Nicht nur die Marken, auch die liegenden Flächen: sie hängen an Masthöhe,
     Band und Gegenstelle, und jede Änderung daran macht die gezeichnete Fläche
     zu einer Aussage über einen Stand, den es nicht mehr gibt. Die Nachführung
     vergleicht nur Schlüssel und zeichnet, wenn sich wirklich etwas geändert hat. */
  rl.flaechenNachfuehren();
  bl.zeichne();
  gl.zeichne();
  modusAnzeigen();
  punktkarteNachfuehren(grund);

  $('#btn-undo').disabled = !store.undoStapel.length;
  $('#btn-redo').disabled = !store.redoStapel.length;

  if (grund === 'formular') return;    // Eingabefelder nicht neu aufbauen

  /* Eine geladene oder zurückgenommene Planung bringt andere Relaisstellen mit.
     Die liegende Fläche gehört zur vorherigen und wäre auf der neuen eine
     Behauptung über einen Standort, den es dort nicht gibt. */
  if (grund === 'geladen' || grund === 'import') rl.flaechenWeg();

  if (grund === 'geladen' || grund === 'undo' || grund === 'redo' || grund === 'import') {
    nameFeld.value = p.name;
    basisSelect.value = p.ansicht.basemap;
    setzeBasiskarte(karte, p.ansicht.basemap);
    optionsFelder.forEach(([sel, k]) => { $(sel).checked = !!p.optionen[k]; });
    groesse.value = p.optionen.symbolgroesse || 1;
    schildAbstand.value = String(p.optionen.beschriftungsabstand || 0);
    if (grund === 'geladen' || grund === 'import') {
      karte.setView([p.ansicht.lat, p.ansicht.lng], p.ansicht.zoom);
      const alle = p.strecken.flatMap(s => s.punkte.map(x => [x.lat, x.lng]))
        .concat(p.zeichen.map(z => [z.lat, z.lng]))
        .concat((p.flaechen || []).map(f => [f.lat, f.lng]))
        .concat((p.relaisstellen || []).map(r => [r.lat, r.lng]));
      if (alle.length > 1) karte.fitBounds(L.latLngBounds(alle), { padding: [60, 60] });
    }
  }
  zeichneSeite();
});

window.addEventListener('beforeunload', e => {
  store.speichern();
  // Nachfragen nur, wenn eine nie gesicherte Planung mit echtem Arbeitsstand
  // im Spiel ist – bei geteilten Rechnern und beim Beenden mit Löschen des
  // Browserspeichers ist das die letzte Gelegenheit.
  if (!dateisicherung(store.projekt.id) && istGehaltvoll(store.projekt)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* Bilddaten, die keine gespeicherte Planung mehr nennt, werden beim Start
   weggeräumt – nicht schon beim Löschen des Eintrags: dort muss ein
   Rückgängig das Bild noch vorfinden. Beim Start ist der Undo-Stapel leer,
   dann ist das Wegräumen ohne Verlust. Verzögert, damit es dem ersten
   Kartenaufbau nicht in die Quere kommt. */
function bilderAufraeumenWennRuhig() {
  // Während einer Übernahme liegen Bilddaten im Speicher, zu denen es noch
  // keinen Eintrag gibt – die dürfen nicht als verwaist gelten.
  if (uebernahmeLaeuft()) return setTimeout(bilderAufraeumenWennRuhig, 4000);
  const planungen = Object.values(ladeAlle());
  // Ohne lesbare Projektliste wird nichts weggeräumt – sonst nähme ein
  // Lesefehler alle Bilder mit.
  if (!planungen.length) return;
  const behalten = new Set();
  for (const pr of planungen) for (const b of pr.bilder || []) behalten.add(b.id);
  // Die offene Planung zählt mit ihrem Stand im Arbeitsspeicher: der ist dem
  // gespeicherten immer eine Sekunde voraus.
  for (const b of store.projekt.bilder || []) behalten.add(b.id);
  bilderAufraeumen(behalten);
}
setTimeout(bilderAufraeumenWennRuhig, 4000);

// Zugriff aus der Browser-Konsole (Fehlersuche, eigene Auswertungen)
window.fbp = { store, karte, sl, zl, fl, bl, gl };

zeichneAlles();
modusAnwenden();
modusAnzeigen();
speicherstatusZeigen('ruhe');
$('#btn-undo').disabled = true;
$('#btn-redo').disabled = true;

/* ---------------------------------------------------------------- Eigener Speicher

   Die Anbindung an einen eigenen Speicher wird nachgeladen und liegt nicht im
   Startweg. Wer keine Verbindung eingerichtet hat, bezahlt für sie nichts
   außer diesem einen Abruf – und eine Rückseite eines Anbieters kommt erst
   dazu, wenn wirklich eine Verbindung besteht. Dasselbe Vorgehen wie beim
   HEIC-Entschlüsseler in `js/heic.js`.

   Verzögert, damit der Kartenaufbau und die ersten Kacheln Vorrang haben:
   über Mobilfunk am Bauort ist die Karte das, worauf jemand wartet. */
let cloudModulLauf = null;
function cloudModul() {
  if (!cloudModulLauf) {
    cloudModulLauf = Promise.all([import('./cloud-ui.js'), import('./abgleich.js')])
      .then(([ui, abgleich]) => {
        ui.cloudUiStarten();
        ui.zeichneSpeicherAbschnitt();
        /* Der Abschnitt im Reiter Projekt hängt an der geöffneten Planung und
           wird von `zeichneProjektReiter()` nicht mitgezeichnet – er liegt in
           einem eigenen Kasten, damit ui.js nichts von der Anbindung wissen
           muss. Also hier nachführen. */
        store.on((p, grund) => {
          if (grund === 'geladen' || grund === 'import') ui.zeichneSpeicherAbschnitt();
        });
        return abgleich.abgleichStarten().then(() => ui);
      });
    cloudModulLauf.catch(e => {
      cloudModulLauf = null;
      console.error('Speicheranbindung nicht verfügbar', e);
    });
  }
  return cloudModulLauf;
}

function speicherDialogOeffnen() {
  cloudModul()
    .then(ui => ui.speicherDialog())
    .catch(() => hinweis('Die Speicheranbindung ließ sich nicht laden.', 'fehler'));
}

setTimeout(cloudModul, 1500);

/* ---------------------------------------------------------------- Ohne Netz

   Der Wächter in `sw.js` legt ab, was die Anwendung lädt, und liefert es
   wieder aus, wenn keine Verbindung da ist. Registriert wird er spät und über
   einen relativen Pfad: spät, weil er für den ersten Aufbau der Seite nichts
   beiträgt; relativ, weil die Seite auch in einem Unterverzeichnis laufen muss.

   `updateViaCache: 'none'` nimmt den Wächter selbst vom HTTP-Zwischenspeicher
   aus. Ohne das kann der Browser ihn bis zu einem Tag lang aus dem eigenen
   Speicher beantworten – ein neuer Stand käme dann erst am Folgetag an. */
function waechterEinrichten() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then(anmeldung => {
      /* Ein neuer Stand übernimmt die laufende Seite nicht – sonst träfe die
         alte Oberfläche auf neu nachgeladene Module. Dass er bereitsteht, muss
         der Nutzer erfahren: die Nummer im Blattfuß jedes Bauauftrags ist die
         des Standes, mit dem gearbeitet wird. */
      /* Nicht „beim nächsten Laden“: ohne `skipWaiting` übernimmt der neue
         Stand erst, wenn keine Seite mehr am alten hängt – ein Neuladen im
         selben Reiter genügt dafür nicht. Wer der falschen Ansage folgt, lädt
         neu, arbeitet weiter auf dem alten Stand und bekommt die Meldung
         wieder. Die Nummer im Blattfuß jedes Bauauftrags ist die des Standes,
         mit dem gearbeitet wird; sie muss stimmen. */
      const melden = () => hinweis(
        'Ein neuer Stand des FMBauplaners steht bereit. Er gilt, sobald alle Fenster ' +
        'dieser Seite geschlossen waren – ein Neuladen allein genügt nicht.');
      if (anmeldung.waiting && navigator.serviceWorker.controller) melden();
      anmeldung.addEventListener('updatefound', () => {
        const neuer = anmeldung.installing;
        if (!neuer) return;
        neuer.addEventListener('statechange', () => {
          /* `controller` unterscheidet die erste Einrichtung von einer
             Auffrischung: beim ersten Mal ist der Stand der, der gerade läuft,
             und eine Meldung darüber wäre sinnlos. */
          if (neuer.state === 'installed' && navigator.serviceWorker.controller) melden();
        });
      });
    })
    .catch(e => {
      /* Ohne Wächter läuft alles wie bisher, nur eben nicht ohne Netz. Im
         privaten Fenster und über `file://` ist er gesperrt – das ist kein
         Fehler, den der Nutzer beheben könnte. */
      console.warn('Offline-Wächter nicht eingerichtet', e);
    });
}
if (document.readyState === 'complete') waechterEinrichten();
else window.addEventListener('load', waechterEinrichten);

geteiltenLinkPruefen();

/* Wer den Link in ein Fenster einfügt, in dem die Anwendung schon läuft, ändert
   nur das Fragment – der Browser lädt die Seite dabei nicht neu, und ohne
   dieses Ereignis geschähe gar nichts. `fragmentRaeumen` löst es nicht aus:
   `history.replaceState` meldet keinen Fragmentwechsel, es gibt also keine
   Schleife. */
window.addEventListener('hashchange', geteiltenLinkPruefen);

/* Kein Begrüßungsdialog beim ersten Start: Über eine leere Karte gelegt
   beschreibt die Kurzanleitung nichts, was der Nutzer schon gesehen hat.
   Der Hinweis auf die Dateisicherung steht dauerhaft unter der Kopfzeile,
   die Kurzanleitung liegt unter Datei → Kurzanleitung. */
