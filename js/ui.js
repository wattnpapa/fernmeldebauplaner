// ui.js – Seitenleiste, Formulare, Dialoge

import {
  store, KABELTYPEN, VERLEGEARTEN, PUNKTARTEN, FARBEN,
  neuesZeichen, punktartById, kabelById, neueStrecke, neuerEinsatzabschnitt, abschnittById,
  neueZeichengruppe, zeichengruppeById, zeichenInGruppe,
  streckenIm, zeichenIm, zeichenSichtbar, streckeSichtbar, bilderBelegung, bildmarkenAn,
  flaechenIm, flaecheSichtbar, relaisstellenIm, relaisstelleSichtbar,
  streckenUnter, zeichenUnter, flaechenUnter, relaisstellenUnter,
  unterabschnitte, abschnitteGeordnet, abschnittTiefe, abschnittEltern, abschnittBaum,
  astHoehe, ABSCHNITT_EBENEN,
  projektListe, speicherBelegung, SPEICHER_KONTINGENT, dateisicherung, id, neuerPunkt,
  BAUSTAENDE, baustandById, mengeOderNichts, PLANPUNKTARTEN, planKennung
} from './state.js';
import { kennzahlen, gesamtKennzahlen, segmentLaengen, kumuliert, escapeHtml } from './strecken.js';
import { signatur } from './signatur.js';
import {
  formatLaenge, meter, toMGRS, toDDM, alleFormate, parseKoordinate, himmelsrichtung, distanz
} from './geo.js';
import {
  NETZFORMEN, LASTEINHEITEN, netzById, MAX_QUERSCHNITT,
  querschnittText, stromText, leistungText, prozentText, grenzText, massgebendText
} from './strom.js';
import {
  QUERUNGSARTEN, QUERUNG_BAUWEISEN, VS_GRADE, querungsartById, bauweiseById, massText, dtg,
  KABELRESERVE_STANDARD, fundstelleText,
  MATERIALGRUPPEN, MATERIALKATALOG, PRUEFARTEN
} from './vorschrift.js';
import { SYMBOLE, KATEGORIEN, symbolSVG, symbolById } from './symbols.js';
import {
  FLAECHENARTEN, AUFSTELLUNGEN, flaechenartById, flaechenVorschau, flaechenTitel, masseText
} from './flaechen.js';
import {
  FREQUENZBAENDER, MIMO_ARTEN, POLARISATIONEN, MODULATIONEN,
  bandById, mimoById, gueltigeBandbreite, datenrateText, funkstrecke, azimutText,
  neuerFunkstandort
} from './richtfunk.js';
import { zwischenstandorte, zwischenText, kandidatText } from './richtfunkrelais.js';
import { ortSuchen, trefferKurz, ORTSSUCHE_QUELLE } from './ortssuche.js';
import { hoeheAn, profil, kachelbedarf, kachelfehlerVergessen } from './hoehe.js';
import { oberflaechenprofil, QUELLTEXT, ARTTEXT } from './oberflaeche.js';
import {
  eirpPruefung, bandById as regelBandById,
  leistungText as eirpLeistungText, massgebendText as eirpMassgebendText, abstandText
} from './frequenzen.js';
import { gelaendeurteil, meterText, urteilMerken, urteilLesen } from './funkrechnung.js';
import { profilSVG, profilLegendeHTML, profilVorbehalt } from './hoehenprofil.js';
import { peilungText, nordbezugText } from './missweisung.js';
import { bilderAufnehmen } from './bilder.js';
import { bildUrl, miniUrl } from './bildspeicher.js';
import * as io from './io.js';
import {
  oeffneBauauftrag, oeffneSammeldruck, oeffneLagekarte, oeffneBaudoku
} from './bauauftrag.js';
import { funksicht, sichtText, UMKREIS_STANDARD, UMKREIS_HOECHSTENS } from './funksicht.js';
/* `befundLesen` heißt in relais.js schon etwas anderes – hier umbenannt, damit
   an der Aufrufstelle steht, um welchen Befund es geht. */
import {
  pruefeQuerungen, schonEingetragen, QUERUNGS_QUELLE,
  befundLesen as querungsbefund, befundText as querungsbefundText
} from './querungspruefung.js';
import { zeichneFunksicht, zeichneZwischenraum, basiskarteById } from './map.js';
import {
  umfang as kachelUmfang, vorladen as kachelVorladen, bestand as kachelBestand,
  leeren as kachelVorratLeeren, HOECHSTENS as KACHEL_HOECHSTENS, PUFFER, ZOOM_VON, ZOOM_BIS
} from './kacheln.js';
import {
  BOS_BAENDER, GEGENSTELLEN, bosBandById, gegenstelleById, gegenstellenhoehe,
  strahlermasse, strahlerText, sichtweite, funkhorizont, GEGENGEWICHT_HINWEIS
} from './bosfunk.js';
import {
  ausbreitungText, masthoeheText, flaecheText, bestandText, ZONEN_ERKLAERUNG,
  UMKREIS_MINDESTENS as UMKREIS_MIN, UMKREIS_HOECHSTENS as UMKREIS_MAX, noetigeMasthoehe
} from './ausbreitung.js';
import { relaisTitel, relaisKurz, befundLesen, masthoeheFuer, rechenwerte } from './relais.js';
import {
  baukennzahlen, istPunkte, bauabschnitte, bauabschnittById, istZuSoll,
  istPunktSetzen, istArtSetzen, bauabschnittAnlegen, bauabschnittLoeschen, bauSichern,
  sollPunktGeloescht, bauUmkehren, bauBegonnen, bauzeile, baustrecke, baustreckeSetzen,
  aktiverBauabschnitt, bauabschnittAktivId, bauabschnittAktivSetzen, punktartText,
  quelleText, uhrzeit, ABWEICHUNG_SCHWELLE, ABSEITS_SCHWELLE, istSollZuordnen, offeneSollPunkte,
  materialzeilen, materialzeile, materialSetzen, materialFreiAnlegen, materialZeileLoeschen,
  materialSumme, materialSoll, baumeldungen,
  baumeldungAnlegen, baumeldungLoeschen, meldungenNachZeit,
  pruefungSichern, pruefzeilen, pruefzeileAnlegen, pruefzeileLoeschen, uebergabestand,
  absetzenVermerken, absetzstandGesamt, absenderText, truppAmGeraet, truppAmGeraetSetzen
} from './baudoku.js';
import {
  vorschlag, truppText, befund, einspielen, berichtText
} from './baumeldung.js';
import { meldungAlsLink, laengenUrteil } from './teilen.js';
/* Die Ortung liegt bei der Karte des Baumodus und wird von dort eingeführt –
   nicht umgekehrt: `baukarte.js` braucht nichts aus dieser Datei, was es nicht
   beim Start hereingereicht bekommt, und ein Ring zwischen beiden liefe beim
   Laden ins Leere. */
import { istPunktAusStandort, punktkarteOeffnen } from './baukarte.js';
import { VERSION } from './version.js';

let ctx = null;   // { karte, sl, zl, aufAenderung }

/* Wie man zurücknimmt, in den Worten des Geräts. „Strg+Z“ stand auch auf dem
   Telefon da, das keine Strg-Taste hat; der Knopf „↶“ oben ist dort der Weg.
   Und ehrlich über die Grenze: der Verlauf übersteht das Neuladen, aber nicht
   das Schließen des Fensters (`verlaufSichern` in state.js). */
const NUR_TOUCH = window.matchMedia('(pointer: coarse)').matches &&
  !window.matchMedia('(any-pointer: fine)').matches;
const RUECKGAENGIG_TEXT = NUR_TOUCH ? '„↶“ oben holt es zurück' : '„↶“ oben oder Strg+Z holt es zurück';
const RUECKGAENGIG_HTML = (NUR_TOUCH
  ? 'Rückgängig machen geht mit dem Knopf <b>↶</b> oben'
  : 'Rückgängig machen geht mit <b>↶</b> oben oder <kbd>Strg</kbd>+<kbd>Z</kbd>') +
  ' – auch nach dem Neuladen, solange das Browserfenster offen bleibt.';

export function initUI(kontext) { ctx = kontext; }

// ---------------------------------------------------------------- Hinweise

let hinweisTimer = null, hinweisWeg = null;
export function hinweis(text, art = 'info') {
  const box = document.getElementById('hinweisbox');
  box.textContent = text;
  box.className = 'hinweisbox ' + art;
  box.hidden = false;
  /* Die Einblendung soll auch bei der zweiten Meldung in Folge anlaufen. Die
     Zeile darüber hat `an` bereits abgeräumt; dass sie gleich wieder gesetzt
     wird, sähe der Browser sonst als gar keine Änderung und startete nichts.
     Das Auslesen einer Maßangabe erzwingt die Neuberechnung dazwischen. */
  void box.offsetWidth;
  box.classList.add('an');
  clearTimeout(hinweisTimer);
  clearTimeout(hinweisWeg);
  /* Die Pille geht schneller, als sie kam, und `hidden` fällt erst danach:
     vorher wäre sie schlagartig weg, und das liest sich wie ein Aussetzer der
     Anzeige statt wie eine Meldung, die ihre Zeit hatte. Die Frist ist die
     Dauer aus --zeit-tipp mit etwas Luft. */
  hinweisTimer = setTimeout(() => {
    box.classList.add('geht');
    hinweisWeg = setTimeout(() => { box.hidden = true; box.classList.remove('an', 'geht'); }, 160);
  }, art === 'fehler' ? 6000 : 3200);
}

/**
 * Die Pille sofort abräumen, weil ihre Auskunft inzwischen an einer besseren
 * Stelle steht. Gebraucht wird das, wo eine Ankündigung läuft und das
 * Ergebnis kein Wort mehr braucht: „Position wird ermittelt …“ bliebe sonst
 * stehen, nachdem der Punkt längst steht und die Punktkarte ihn zeigt. Sie
 * geht denselben Weg wie nach Ablauf der Frist, damit kein Aussetzer der
 * Anzeige daraus wird.
 */
export function hinweisAus() {
  const box = document.getElementById('hinweisbox');
  clearTimeout(hinweisTimer);
  clearTimeout(hinweisWeg);
  if (box.hidden) return;
  box.classList.add('geht');
  hinweisWeg = setTimeout(() => { box.hidden = true; box.classList.remove('an', 'geht'); }, 160);
}

/**
 * Eine laufende Arbeit in derselben Pille zeigen wie die Meldungen – mit Balken
 * und ohne Frist. Eine Übernahme von zwanzig Bildern dauert länger als jede
 * Meldung stehen bleibt; verschwände die Ankündigung vorher, sähe es aus, als
 * sei nichts geschehen. Die abschließende Meldung über `hinweis()` ersetzt sie.
 *
 * @param {number} anteil zwischen 0 und 1
 */
export function fortschritt(text, anteil) {
  const box = document.getElementById('hinweisbox');
  clearTimeout(hinweisTimer);
  clearTimeout(hinweisWeg);
  let balken = box.querySelector('.fortschritt-balken');
  /* Beim ersten Stand wird die Pille aufgebaut und läuft ein; die folgenden
     Stände rücken nur Text und Balken weiter, sonst zuckte sie bei jedem Bild. */
  if (!balken || box.hidden || box.classList.contains('geht')) {
    box.innerHTML = '<span class="fortschritt-text"></span>' +
      '<span class="fortschritt-balken" role="progressbar" aria-valuemin="0" aria-valuemax="100">' +
      '<i></i></span>';
    box.className = 'hinweisbox info fortschritt';
    box.hidden = false;
    void box.offsetWidth;
    box.classList.add('an');
    balken = box.querySelector('.fortschritt-balken');
  }
  const prozent = Math.round(Math.max(0, Math.min(1, anteil)) * 100);
  box.querySelector('.fortschritt-text').textContent = text;
  balken.setAttribute('aria-valuenow', String(prozent));
  balken.firstChild.style.width = prozent + '%';
}

// ---------------------------------------------------------------- Dialog

/* Wer den Dialog geöffnet hat, bekommt den Fokus beim Schließen zurück. Bei
   Dialogketten (ein Dialog öffnet den nächsten) bleibt der ursprüngliche
   Auslöser gemerkt – der Zwischenknopf existiert nach dem Umbau nicht mehr. */
let dialogOeffner = null;

/* Ein Dialog, der eine Entscheidung verlangt, geht nicht beiläufig zu. Steht
   hier ein Satz, weisen Esc, der Tipp auf den Schleier und das Schließkreuz
   den Schließversuch ab und sagen stattdessen diesen Satz. Gebraucht wird das
   für die beiden Empfangsdialoge: was über den Link hereinkommt, gibt es nur
   dieses eine Mal, und der Schleier bot quer 54 px genau dort an, wo beim
   Querhalten die Daumen liegen. */
let dialogSchutz = '';

export function dialog({ titel, inhalt, fuss = [], breit = false, geteilt = false,
                         schutz = '', fuellend = false }) {
  const huelle = document.getElementById('dialog');
  const aktiv = document.activeElement;
  if (aktiv instanceof HTMLElement && !huelle.contains(aktiv)) dialogOeffner = aktiv;
  huelle.querySelector('.dialog').classList.toggle('breit', breit);
  /* Ein füllender Dialog nimmt die erlaubte Höhe ganz ein, statt sich auf
     seinen Inhalt zusammenzuziehen. Nur so kann ein Bild „den Rest“ füllen:
     ohne feste Höhe hätte der Rest kein Maß, und `max-height: 100%` am Bild
     liefe ins Leere. */
  huelle.querySelector('.dialog').classList.toggle('fuellend', fuellend);
  document.getElementById('dialog-titel').textContent = titel;
  dialogSchutz = schutz;
  /* Ein Kreuz, das nichts tut, ist schlimmer als keines: bei einem
     geschützten Dialog fällt es weg, und es bleiben die beiden Fußknöpfe. */
  huelle.querySelector('[data-akt="dialog-zu"]').hidden = !!schutz;
  const feld = document.getElementById('dialog-inhalt');
  feld.innerHTML = '';
  if (typeof inhalt === 'string') feld.innerHTML = inhalt; else feld.appendChild(inhalt);
  /* Der Rollstand gehört zum alten Inhalt. Ohne diese Zeile übernahm ihn der
     neue: wer in der Kurzanleitung zum Baumodus gesprungen war und danach
     „Eigener Speicher“ öffnete, sah dort den zugeklappten Schluss statt der
     Anbieterliste – am Telefon ist der Unterschied der ganze Dialog. */
  feld.scrollTop = 0;
  const fussEl = document.getElementById('dialog-fuss');
  fussEl.className = 'dialog-fuss' + (geteilt ? ' geteilt' : '');
  fussEl.innerHTML = '';
  for (const f of fuss) {
    const b = document.createElement('button');
    b.className = 'knopf' + (f.primaer ? ' primaer' : '') + (f.gefahr ? ' gefahr' : '');
    b.textContent = f.text;
    b.onclick = () => { if (f.tun ? f.tun() !== false : true) schliesseDialog(); };
    fussEl.appendChild(b);
  }
  /* aria-modal verspricht Abschottung – inert löst sie ein: die Anwendung
     dahinter ist für Tab und Screenreader nicht mehr erreichbar. Dialog und
     Hinweisbox liegen außerhalb von #app und bleiben bedienbar. */
  document.getElementById('app').inert = true;
  huelle.hidden = false;
  /* Die Zurück-Taste des Telefons soll den Dialog schließen und nicht die
     Anwendung verlassen – `app.js` legt dafür einen Verlaufseintrag an. Ein
     geschützter Dialog bekommt keinen: er geht nicht beiläufig zu, und er steht
     über einem Link, dessen Adresse sonst im Verlauf landete. */
  if (!schutz) document.dispatchEvent(new CustomEvent('fbp:ebene'));
  /* Reine Text-Dialoge haben im Inhalt nichts Fokussierbares – dann übernimmt
     der erste Fußknopf, sonst der Schließen-Knopf, damit die Tastatur im
     Dialog beginnt statt dahinter. */
  /* Im Fuß der Hauptknopf und nicht der erste: im Audit trug „Trotzdem
     übergeben“ den Fokus, und Enter löste genau die riskante Wahl aus – im
     Link-Dialog ebenso „Verwerfen“. */
  const ersterFokus = feld.querySelector('input,select,textarea,button')
    || fussEl.querySelector('.knopf.primaer:not(.gefahr)')
    || fussEl.querySelector('button')
    || huelle.querySelector('[data-akt="dialog-zu"]');
  /* `preventScroll`, weil der Fokus sonst sein Feld ins Bild holt und damit
     den Text darüber hinausschiebt: die Vorschau einer Baumeldung öffnete auf
     dem Telefon bereits 117 px weggerollt, und weg war genau der Satz
     „Zusammengeführt wird nichts“ – der Planer entschied über ein
     Überschreiben, ohne den Hinweis gelesen zu haben. */
  if (ersterFokus) setTimeout(() => ersterFokus.focus({ preventScroll: true }), 30);
  /* Ein einzelnes Textfeld und ein Hauptknopf: dann ist die Eingabetaste der
     Abschluss, und zwar überall gleich. Am Telefon steht auf ihr „Los“, und
     sie blieb bisher ohne Wirkung – der Nutzer tippte sie, das Feld verlor
     den Fokus, die Tastatur ging zu, und der Knopf war ungedrückt. Bei
     mehreren Feldern nicht: dort ist unklar, welches gemeint war. Der
     Gefahrknopf zählt nie als Hauptknopf – „Endgültig löschen“ soll gedrückt
     und nicht getippt werden. */
  const hauptknopf = fussEl.querySelector('.knopf.primaer:not(.gefahr)');
  const einzeln = feld.querySelectorAll(
    'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file])');
  if (hauptknopf && einzeln.length === 1) {
    einzeln[0].addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing || hauptknopf.disabled) return;
      e.preventDefault();
      hauptknopf.click();
    });
  }
  return feld;
}

/**
 * Der beiläufige Schließversuch – Esc, Tipp auf den Schleier, Schließkreuz.
 * Ein geschützter Dialog geht so nicht zu; er sagt stattdessen, was zu
 * entscheiden ist.
 *
 * @returns {boolean} ob der Dialog geschlossen wurde
 */
export function dialogAbweisen() {
  if (document.getElementById('dialog').hidden) return false;
  if (dialogSchutz) { hinweis(dialogSchutz, 'warnung'); return false; }
  schliesseDialog();
  return true;
}

export function schliesseDialog() {
  const huelle = document.getElementById('dialog');
  if (huelle.hidden) return;
  dialogSchutz = '';
  huelle.hidden = true;
  document.getElementById('app').inert = false;
  if (dialogOeffner && document.contains(dialogOeffner)) dialogOeffner.focus();
  dialogOeffner = null;
}

// ---------------------------------------------------------------- Bausteine

function el(tag, klasse, inhalt) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (inhalt !== undefined) e.innerHTML = inhalt;
  return e;
}

/* Eine Zahl, wie sie hier getippt wird: Komma als Trenner, und der Punkt
   daneben weiter erlaubt – der Bogen kommt auch einmal aus einer Tabelle.
   Geliefert wird, was aus dem Feld zu machen ist:
     `unfertig`  die Eingabe ist auf dem Weg („2,“, „-“) – nichts tun
     `zahl`      die gelesene Zahl, oder `null`, wenn es keine ist
     `text`      die bereinigte Eingabe; leer heißt „nichts eingetragen“ */
function zahlLesen(roh, tausender = false) {
  const text = String(roh ?? '').trim();
  if (text === '') return { unfertig: false, zahl: null, text: '' };
  /* Mengen schreibt die Anwendung selbst mit Tausenderpunkt („Bedarf laut
     Planung 2.023 m“), und wer es ihr gleichtut, tippt „3.120“. Das wurde
     still zu 3,12 m – im Audit der Zahlendreher in die Richtung, vor der
     keine Warnung schützt. Nur für Mengenfelder: in einem Frequenzfeld ist
     „146.250“ ein Dezimalpunkt. Die erste Gruppe beginnt nicht mit 0, damit
     „0.125“ nicht zu 125 wird. */
  if (tausender && /^[1-9]\d{0,2}([. ]\d{3})+(,\d+)?$/.test(text)) {
    const zahl = Number(text.replace(/[. ]/g, '').replace(',', '.'));
    return { unfertig: false, zahl, text: text.replace(/[. ]/g, '') };
  }
  /* Das Leerzeichen als Tausendertrenner ist auf der Zifferntastatur mancher
     Telefone erreichbar; „3 1“ ist dann der Weg zu „3 120“ und kein Fehler. */
  if (tausender && /^[1-9]\d{0,2}( \d{0,3})+$/.test(text)) return { unfertig: true, zahl: null, text };
  if (/^[-+]?$/.test(text) || /^[-+]?\d*[.,]$/.test(text)) return { unfertig: true, zahl: null, text };
  if (!/^[-+]?(\d+([.,]\d+)?|[.,]\d+)$/.test(text)) return { unfertig: false, zahl: null, text };
  const zahl = Number(text.replace(',', '.'));
  return { unfertig: false, zahl: Number.isFinite(zahl) ? zahl : null, text };
}

/** Eine Zahl für das Eingabefeld: deutsch mit Komma, leer bleibt leer */
function zahlText(wert) {
  if (wert === null || wert === undefined || wert === '') return '';
  return Number.isFinite(Number(wert)) ? String(wert).replace('.', ',') : String(wert);
}

/** Beschriftetes Eingabefeld, das direkt in den Store schreibt */
function feld(titel, wert, beiAenderung, o = {}) {
  const wrap = el('label', 'feld' + (o.klasse ? ' ' + o.klasse : ''));
  wrap.appendChild(el('span', 'feld-titel', escapeHtml(titel)));
  let ein;
  if (o.typ === 'textarea') {
    ein = document.createElement('textarea');
    ein.rows = o.zeilen || 3;
  } else if (o.typ === 'select') {
    ein = document.createElement('select');
    for (const [w, t] of o.werte) {
      const op = document.createElement('option');
      op.value = w; op.textContent = t; op.selected = String(wert) === String(w);
      ein.appendChild(op);
    }
  } else {
    /* Eine Zahl wird als `text` mit Zifferntastatur eingegeben, nicht als
       `number` – zwei Fehler am Bauort hängen daran, und beide waren nicht zu
       sehen:

       Das Komma. Die deutsche Tastatur liefert „2,5“, und ein
       `type="number"` wirft das Komma weg: aus „2,5“ wird der Wert „25“, ohne
       Warnung, ohne rote Umrandung. Im Materialnachweis stand damit die
       zehnfache Menge auf dem Bogen. Erst als `text` ist das Komma überhaupt
       zu sehen und in einen Punkt zu setzen.

       Das Raster. `step` galt als Gültigkeitsregel, und `min` ist dabei der
       Anfang des Rasters: bei `min: 1, step: 10` waren nur 1, 11, 21 … gültig
       und ausgerechnet die runden Betriebswerte 250, 500, 1000 nicht. Sie
       wurden mit „Das ist keine Zahl“ abgewiesen, und gerechnet wurde still
       mit dem alten Wert weiter – der Bauauftrag trug eine Trommellänge, die
       im Feld nicht stand. `o.step` ist deshalb nur noch eine Angabe über die
       sinnvolle Feinheit und keine Regel; geprüft werden Zahl, `min` und
       `max`.

       Was dabei wegfällt, ist das Pfeilchen am Feld. Auf dem Zielgerät gibt
       es das nicht, und am Rechner hat es Werte verstellt, wenn das Rad über
       dem Feld lief. */
    ein = document.createElement('input');
    ein.type = o.typ === 'number' ? 'text' : (o.typ || 'text');
    if (o.typ === 'number') {
      ein.inputMode = 'decimal';
      ein.autocomplete = 'off';
      /* Die Grenzen bleiben am Element stehen, damit die Prüfung in
         `geraete-pruefen.mjs` und der Blick in die Entwicklerwerkzeuge sie
         weiter finden – ausgewertet werden sie hier, nicht vom Browser. */
      if (o.min !== undefined) ein.dataset.min = o.min;
      if (o.max !== undefined) ein.dataset.max = o.max;
    } else {
      if (o.min !== undefined) ein.min = o.min;
      if (o.max !== undefined) ein.max = o.max;
      if (o.step !== undefined) ein.step = o.step;
    }
    if (o.platzhalter) ein.placeholder = o.platzhalter;
  }
  /* Angezeigt wird deutsch, mit Komma: das Feld nimmt jetzt beides an, und ein
     Punkt in einem Feld, in das der Trupp Komma tippt, sähe nach Tausender
     aus. */
  if (o.typ === 'number') ein.value = zahlText(wert);
  else if (o.typ !== 'select') ein.value = wert ?? '';
  if (o.einheit) wrap.classList.add('mit-einheit');

  /* Der letzte angenommene Wert, und der Grund, dass er mitgeführt wird: ein
     abgewiesener Text blieb im Feld stehen, während weiter mit dem alten Wert
     gerechnet wurde. Auf dem Schirm stand dann „500“ und im Bauauftrag 800 –
     ein Blatt, das dem Trupp eine Trommellänge nennt, die er nirgends
     eingestellt hat. Beim Verlassen des Feldes zählt deshalb wieder, was
     wirklich gespeichert ist. */
  let angenommen = o.typ === 'number' ? zahlText(wert) : null;
  /* Und der Wert, der beim Betreten des Feldes galt. Geschrieben wird bei
     jedem gültigen Anschlag – aus „3l20“ stand nach dem „3“ also schon 3 in
     der Planung, und das Zurücksetzen auf „den bisherigen Wert“ setzte auf
     genau diese 3. Im Audit wurden aus 2100 m Feldkabel so 3 m, unter der
     Meldung, der bisherige Wert bleibe stehen. Bisher heißt jetzt: vor der
     Eingabe, und er wird beim Verlassen auch wieder geschrieben. */
  let vorEingabe = angenommen;
  if (o.typ === 'number') {
    ein.addEventListener('focus', () => { vorEingabe = ein.value; });
    ein.addEventListener('blur', () => {
      if (!wrap.classList.contains('feld-abgewiesen')) return;
      wrap.classList.remove('feld-abgewiesen');
      ein.value = vorEingabe;
      angenommen = vorEingabe;
      const zurueck = zahlLesen(vorEingabe, !!o.tausender);
      beiAenderung(zurueck.text === '' ? '' : zurueck.zahl);
    });
  }

  ein.addEventListener(o.typ === 'select' ? 'change' : 'input', () => {
    if (o.typ === 'number') {
      /* Was keine Zahl ergibt, wurde einmal still zu `null` – und nahm im
         Materialnachweis die ganze Zeile mit. Wer sich um ein Minus vertat,
         sah seine Menge verschwinden, ohne zu erfahren warum. Die Eingabe wird
         deshalb abgewiesen: das Feld färbt sich, der bisherige Wert bleibt
         stehen, und gemeldet wird beim Übergang – nicht bei jedem Tastendruck,
         sonst stünde die Pille dauerhaft.

         Eine halb getippte Zahl ist dabei kein Fehler: „2,“ und das einzelne
         Minus sind der Weg zu „2,5“ und „-3“. Sie färben nichts und schreiben
         nichts; der nächste Anschlag entscheidet. */
      const gelesen = zahlLesen(ein.value, !!o.tausender);
      const vorher = wrap.classList.contains('feld-abgewiesen');
      if (gelesen.unfertig) { wrap.classList.remove('feld-abgewiesen'); return; }

      const untenDrunter = gelesen.zahl !== null && o.min !== undefined && gelesen.zahl < o.min;
      const obenDrueber  = gelesen.zahl !== null && o.max !== undefined && gelesen.zahl > o.max;
      const schlecht = gelesen.zahl === null && gelesen.text !== '' || untenDrunter || obenDrueber;
      wrap.classList.toggle('feld-abgewiesen', schlecht);
      if (schlecht) {
        if (!vorher) {
          const bleibt = vorEingabe ? `es bleibt bei ${vorEingabe}` : 'das Feld bleibt leer';
          hinweis(untenDrunter ? `Keine Menge unter ${o.min} – ${bleibt}.`
            : obenDrueber ? `Keine Menge über ${o.max} – ${bleibt}.`
            : `Das ist keine Zahl – ${bleibt}.`, 'warnung');
        }
        return;
      }
      angenommen = gelesen.text;
      beiAenderung(gelesen.text === '' ? '' : gelesen.zahl);
      return;
    }
    beiAenderung(ein.value);
  });
  wrap.appendChild(ein);
  if (o.einheit) wrap.appendChild(el('span', 'feld-einheit', o.einheit));
  return wrap;
}

/** Änderung aus einem Formular: kein Neuaufbau der Seitenleiste */
let _debounceTimer = null;
let _debounceQueue = [];
let _debounceDanach = [];
/* Die Eingabe wird gesammelt und erst nach 100 ms geschrieben – sonst liefe je
   Tastendruck ein Undo-Schritt auf. Was aus ihr gerechnet wird, darf deshalb
   nicht sofort nachziehen: zum Zeitpunkt des Tastendrucks steht der neue Wert
   noch nirgends, und die Anzeige zeigte den vorherigen. Genau daran hinkten
   die abgeleiteten Felder bisher um eine Eingabe hinterher. `danach` läuft
   deshalb erst, wenn geschrieben ist. */
function debounceAendern(fn, danach) {
  _debounceQueue.push(fn);
  if (danach) _debounceDanach.push(danach);
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    const combined = () => { _debounceQueue.forEach(f => f()); };
    store.aendern(combined, 'formular');
    const nachlauf = _debounceDanach;
    _debounceQueue = [];
    _debounceDanach = [];
    _debounceTimer = null;
    nachlauf.forEach(f => f());
  }, 100);
}
function schreib(fn, danach) {
  debounceAendern(fn, danach);
}

/* Eine Sicherungsdatei wird erst zusammengestellt und dann heruntergeladen –
   seit die Lichtbilder mitgehen, dauert das einen Augenblick. Gemeldet wird
   deshalb das Ergebnis, nicht der Knopfdruck. */
function sicherungMelden(lauf, meldung) {
  lauf.then(ok => { if (ok) hinweis(meldung); })
      .catch(e => hinweis('Sichern fehlgeschlagen: ' + e.message, 'fehler'));
}

/* Sichtbar oder nicht ist ein Zustand, den man auf einen Blick erkennen muss,
   ohne beide nebeneinander zu halten: dasselbe Auge, ausgeblendet
   durchgestrichen – und dazu der zurückgenommene Zeilenton (.verborgen). */
const AUGE_OFFEN =
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
     <path d="M1.6 8S4 4.2 8 4.2 14.4 8 14.4 8 12 11.8 8 11.8 1.6 8 1.6 8Z"/>
     <circle cx="8" cy="8" r="1.8"/></svg>`;
const AUGE_ZU =
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
     <path d="M1.6 8S4 4.2 8 4.2 14.4 8 14.4 8 12 11.8 8 11.8 1.6 8 1.6 8Z"/>
     <circle cx="8" cy="8" r="1.8"/>
     <path d="M2.7 13.3 13.3 2.7"/></svg>`;

/** Schalter „auf der Karte zeigen“ – die Beschriftung nennt die Handlung */
function augenKnopf(sichtbar) {
  const was = sichtbar ? 'Auf der Karte ausblenden' : 'Auf der Karte einblenden';
  return `<button type="button" class="augen" data-akt="sichtbar" title="${was}" aria-label="${was}"
          >${sichtbar ? AUGE_OFFEN : AUGE_ZU}</button>`;
}

/**
 * Die Listen der Seitenleiste sind Nachschlagewerke: gesucht wird nach dem
 * Namen, nicht nach der Reihenfolge des Setzens. Sortiert wird deshalb nur die
 * Anzeige – die Reihenfolge im Projekt bleibt die des Anlegens, an ihr hängen
 * Farbvergabe, Ausgabe und Export.
 *
 * Verglichen wird der Text, der auch in der Zeile steht: Zeichen und Flächen
 * tragen einen eigenen Namen erst, wenn einer eingetragen wurde, und heißen
 * sonst nach ihrem Symbol bzw. ihrer Art. Nach dem leeren Feld zu sortieren
 * brächte die Liste in eine Ordnung, die auf ihr niemand sieht.
 *
 * `numeric` hält „FW 2“ vor „FW 10“, `sensitivity: 'base'` stellt Groß- und
 * Kleinschreibung gleich – und die deutsche Sortierung stellt „Ölhafen“ zu O
 * statt hinter Z.
 */
const alphabetisch = (liste, titel) => liste.slice().sort((a, b) =>
  titel(a).localeCompare(titel(b), 'de', { numeric: true, sensitivity: 'base' }));

/** Strecken, Einsatzabschnitte und Zeichengruppen tragen ihren Namen unmittelbar */
const nachName = x => x.name || '';
/** Beschriftung eines Zeichens in der Liste – ohne eigene der Name des Symbols */
const zeichenTitel = z => z.label || symbolById(z.symbol).name;

// ---------------------------------------------------------------- Strecken

/**
 * Bedarf und Trommeln je Kabelart, unter der Gesamtzeile. Bestellt und auf den
 * Bauplatz gefahren wird nach Leitungsart – die Gesamtsumme sagt, wie viel
 * Kabel gebraucht wird, aber nicht wovon. Aufgeschlüsselt werden dieselben
 * zwei Größen wie darüber, damit sich Teil und Ganzes gegeneinander lesen
 * lassen; gerechnet wird mit dem Bedarf einschließlich Bauzuschlag, denn
 * danach richtet sich die Trommelzahl.
 *
 * Bei einer einzigen Kabelart entfällt die Aufstellung: sie wiederholte dann
 * Wort für Wort die Zahlen der Zeile darüber.
 */
function kabelSummeHTML(ges) {
  if (ges.nachKabel.length < 2) return '';
  const zeilen = ges.nachKabel.map(e =>
    `<i title="${escapeHtml(e.kabel.name)}">${escapeHtml(e.kabel.kurz)}</i>
     <b>${formatLaenge(e.bedarf)}</b>
     ${e.kabel.funk ? '<span>Funkstrecke</span>'
       : `<span><b>${e.trommeln}</b> ${e.trommeln === 1 ? 'Trommel' : 'Trommeln'}</span>`}`).join('');
  return `<div class="summe-kabel">${zeilen}</div>`;
}

/* Woraus die Streckenliste zuletzt gebaut wurde – ihre Gliederung, siehe
   `zeichneStreckenListe`. */
let streckenListeStand = null;

export function zeichneStreckenListe() {
  const p = store.projekt;
  const liste = document.getElementById('strecken-liste');
  const abschnitte = abschnitteGeordnet(p);
  streckenSummeZeichnen(p, abschnitte);

  /* Die Liste wird nachgeführt, nicht neu gebaut, solange ihre Gliederung
     steht: welche Klammern in welcher Reihenfolge, welche Karten darin, welche
     offen, welche zugeklappt. Beim Zeichnen einer Trasse kommt jeder Punkt als
     Änderung an, und die Liste mit einer offenen Strecke von hundert Punkten
     jedes Mal neu aufzubauen kostete das Dreifache des Punktes selbst – nicht
     im Skript, sondern im Layout der hundert Zeilen mit ihren Feldern. Erst
     eine andere Gliederung räumt ab und baut neu. */
  const gliederung = signatur([
    abschnitte.map(a => [a.id, a.sichtbar !== false, a.uebergeordnet || null]),
    abschnitte.length
      ? [...abschnitte.map(a => a.id), null]
          .map(aid => alphabetisch(streckenIm(p, aid), nachName).map(s => s.id))
      : alphabetisch(p.strecken, nachName).map(s => s.id),
    [...zugeklappt], ctx.sl.auswahl, p.strecken.length > 0
  ]);
  if (gliederung === streckenListeStand && liste.children.length) {
    streckenListeNachfuehren(liste);
    return;
  }
  streckenListeStand = gliederung;
  liste.innerHTML = '';

  if (!p.strecken.length) {
    liste.appendChild(el('div', 'leer',
      NUR_TOUCH
        ? `<p><b>Noch keine Strecke geplant.</b></p>
           <p>Erst den Ort suchen oder heranzoomen, dann „Neue Strecke zeichnen“ wählen und
           die Trasse Punkt für Punkt antippen – vom Anfangs- zum Endpunkt. „Fertig“ schließt ab.</p>`
        : `<p><b>Noch keine Strecke geplant.</b></p>
           <p>Erst den Ort suchen oder heranzoomen, dann „Neue Strecke zeichnen“ wählen und
           die Trasse auf der Karte anklicken – Punkt für Punkt vom Anfangs- zum Endpunkt.
           Mit Doppelklick oder <kbd>Enter</kbd> abschließen.</p>`));
    if (!abschnitte.length) return;
  }

  /* Ohne Einsatzabschnitte bleibt die Liste, was sie war: eine Reihe Strecken.
     Erst wenn welche gebildet sind, tritt die Gliederung dazwischen. */
  if (!abschnitte.length) {
    for (const s of alphabetisch(p.strecken, nachName)) liste.appendChild(streckenKarte(s));
    return;
  }

  for (const ea of obersteAbschnitte(p)) liste.appendChild(abschnittGruppe(ea, 'strecken'));
  if (streckenIm(p, null).length) liste.appendChild(abschnittGruppe(null, 'strecken'));
}

/** Die Abschnitte der obersten Ebene, alphabetisch – die Liste beginnt mit
 *  ihnen, alles Tiefere hängt als Klammer in der Klammer darunter. */
const obersteAbschnitte = p => alphabetisch(unterabschnitte(p, null), nachName);

/**
 * Wie viele Strecken auf welchem Baustand stehen, als eine Zeile – oder leer,
 * solange an keiner gebaut wird. Eine Planung, die nie in den Baumodus kommt,
 * soll kein „9 offen“ vor sich hertragen.
 *
 * Die Frage der Lagebesprechung ist „wie viele stehen?“, und die ließ sich
 * vorher nur durch Aufklappen jeder Strecke beantworten.
 */
function baustandZaehlung(strecken) {
  if (!strecken.some(bauBegonnen)) return '';
  const zahl = {};
  for (const s of strecken) {
    const id = bauBegonnen(s) && s.bau ? s.bau.stand : 'offen';
    zahl[id] = (zahl[id] || 0) + 1;
  }
  /* Neu Eingegangenes und Überfälliges stehen mit in der Zählung – sie ist
     das, was bei zugeklappten Abschnitten übrig bleibt. Im Audit war ein
     Trupp, der seit fast drei Stunden nicht gemeldet hatte, im Überblick
     unsichtbar, weil beides nur in der aufgeklappten Zeile stand. */
  const neu = strecken.filter(s => meldungNeu(s.id)).length;
  const spaet = strecken.filter(s => {
    if (!bauBegonnen(s) || !['offen', 'laeuft'].includes(s.bau.stand)) return false;
    const z = (bauzeile(s) || {}).zuletzt;
    return z && (Date.now() - Date.parse(z)) / 60000 >= MELDUNG_UEBERFAELLIG_MIN;
  }).length;
  return [
    ...[...BAUSTAENDE].reverse().filter(b => zahl[b.id]).map(b => `${zahl[b.id]} ${b.kurz}`),
    ...(neu ? [`${neu} neu`] : []),
    ...(spaet ? [`⚠ ${spaet} ohne Meldung seit 2 h`] : [])
  ].join(', ');
}

/** Die Summenzeile über der Liste und der Sammeldruck-Knopf. */
function streckenSummeZeichnen(p, abschnitte) {
  const summe = document.getElementById('strecken-summe');
  const ges = gesamtKennzahlen(p.strecken);
  /* Trasse und Bedarf sind Kabellängen; die Funkstrecke steht in beiden nicht.
     Der Hinweis hängt am Wert, weil sonst nur die Aufstellung darunter verrät,
     warum die Zeilen sich nicht zur Gesamtzahl addieren. */
  const ohneFunk = ges.funkStrecken ? ' title="ohne Funkstrecken – dort liegt kein Kabel"' : '';
  const bauSumme = baustandZaehlung(p.strecken);
  summe.innerHTML = p.strecken.length
    ? `<span><b>${p.strecken.length}</b> ${p.strecken.length === 1 ? 'Strecke' : 'Strecken'}</span>
       ${abschnitte.length ? `<span><b>${abschnitte.length}</b> ${abschnitte.length === 1 ? 'Abschnitt' : 'Abschnitte'}</span>` : ''}
       <span${ohneFunk}>Trasse <b>${formatLaenge(ges.trasse)}</b></span>
       <span${ohneFunk}>Bedarf <b>${formatLaenge(ges.bedarf)}</b></span>
       <span><b>${ges.trommeln}</b> ${ges.trommeln === 1 ? 'Trommel' : 'Trommeln'}</span>
       ${kabelSummeHTML(ges)}
       ${bauSumme ? `<span class="summe-bau">Bau: <b>${escapeHtml(bauSumme)}</b></span>` : ''}`
    : '';

  const sammelKnopf = document.getElementById('btn-sammel-pdf');
  const sammelGrund = document.getElementById('sammel-grund');
  if (sammelKnopf) {
    const druckbar = p.strecken.filter(s => s.punkte.length >= 2).length;
    sammelKnopf.disabled = !druckbar;
    sammelKnopf.title = druckbar
      ? `Ein Dokument mit allen ${druckbar} druckbaren Strecken der Planung`
      : 'Noch keine Strecke mit zwei Trassenpunkten';
    /* Der Grund gehört neben den Knopf und nicht in den title: auf dem
       Telefon gibt es kein Verweilen, und der gesperrte Knopf stand dort
       grau da, ohne zu sagen, was ihm fehlt. Dieselbe Zeile wie am
       Bauauftrag der einzelnen Strecke. */
    if (sammelGrund) {
      sammelGrund.hidden = !!druckbar;
      sammelGrund.textContent = druckbar ? ''
        : 'Für den Sammel-Bauauftrag wird mindestens eine Strecke mit zwei ' +
          'Trassenpunkten gebraucht.';
    }
  }
}

/**
 * Die stehende Liste an die Planung angleichen: Zähler der Klammern, dann
 * jede Karte – eine geschlossene wird ersetzt, wenn sich ihre Strecke geändert
 * hat, die offene führt sich selbst nach (`offeneKarteNachfuehren`).
 */
function streckenListeNachfuehren(liste) {
  const p = store.projekt;
  const art = LISTENARTEN.strecken;
  for (const box of liste.querySelectorAll('.ea-gruppe')) {
    const wert = box.querySelector('.ea-wert');
    const e = art.unter(p, box.dataset.aid || null);
    if (wert) wert.textContent = art.wert(e);
    const bau = box.querySelector('.ea-bau');
    if (bau) { bau.textContent = art.bau(e); bau.hidden = !bau.textContent; }
  }
  for (const karte of liste.querySelectorAll('article.eintrag[data-sid]')) {
    const s = store.strecke(karte.dataset.sid);
    if (!s) continue;
    if (karte._fbpOffen) offeneKarteNachfuehren(karte, s);
    else if (karte._fbpStand !== geschlosseneKarteStand(s)) karte.replaceWith(streckenKarte(s));
  }
}

/* Die geschlossene Karte zeigt nur die Strecke selbst und ob ihr Abschnitt sie
   zeigt. Die offene zeigt dazu Formular und Punkttabelle; die Punkte führt sie
   zeilenweise nach, alles andere geht in diese Signatur. */
const geschlosseneKarteStand = s => signatur([s, streckeSichtbar(store.projekt, s)], [s]);
const offeneKarteStand = s => signatur(
  [{ ...s, punkte: undefined }, streckeSichtbar(store.projekt, s), store.projekt.einsatzabschnitte],
  [s]);

function offeneKarteNachfuehren(karte, s) {
  const o = karte._fbpOffen;
  if (o.stand !== offeneKarteStand(s)) { karte.replaceWith(streckenKarte(s)); return; }
  const punkteStand = signatur(
    [s.punkte, ctx.sl.aktiverPunkt, store.projekt.optionen.koordformat], s.punkte);
  if (punkteStand === o.punkteStand) return;
  o.punkteStand = punkteStand;
  o.frisch();
  if (!punktTabelleNachfuehren(o.tabelle, s)) { karte.replaceWith(streckenKarte(s)); return; }
  /* Die Querungsprüfung hängt an der Trasse und entsteht mit jedem Punkt neu –
     so war es auch, als die ganze Karte neu entstand. */
  if (o.querung) o.querung.remove();
  o.querung = !kabelById(s.kabeltyp).funk && s.punkte.length >= 2 ? querungsGruppe(s) : null;
  if (o.querung) o.tabelle.after(o.querung);
}

/* Zugeklappte Abschnitte sind Ansichtssache und keine Planungsdaten: sie
   stehen deshalb hier und nicht im Projekt – sonst reisten sie in jeder
   exportierten Datei mit. */
const zugeklappt = new Set();
/* Welche bestätigte Punktzeile im Bau-Reiter ihr Formular zeigt. Modulweit und
   nicht in der Planung: das ist eine Sicht auf die Liste, keine Eintragung, und
   das Datenmodell trägt sie nicht mit in die Baumeldung. Die Liste wird bei
   jeder Änderung neu gebaut – ohne diesen Satz klappte jede Zeile dabei wieder
   zu, in die der Trupp gerade etwas schreibt. */
const bpOffen = new Set();
/* Drei Blöcke des Bau-Reiters stehen eingeklappt, und zwar die, die am Bauort
   nicht laufend gebraucht werden: der Materialnachweis wird einmal am Ende
   gefüllt, die Übernahmemessung steht am Schluss, und der Kachelvorrat wird im
   Depot geholt – das sagt der Kommentar an seiner Stelle selbst. Zusammen
   maßen sie 2.370 der 4.337 px des Reiters. Wer sie braucht, hat den Sprung
   dorthin oben im Streifen, und der klappt sie mit auf. */
const bauZu = new Set(['material', 'uebergabe', 'vorrat']);

/**
 * Einen Block des Bau-Reiters auf seine Überschrift zusammenfalten. Die
 * Überschrift bleibt eine Überschrift und bekommt den Griff hinein – so trägt
 * sie weiter die Gliederung für die Sprachausgabe und ist zugleich zu tippen.
 */
function klappbar(box, schluessel) {
  const titel = box.querySelector('.gruppen-titel');
  if (!titel) return box;
  const zu = bauZu.has(schluessel);
  box.classList.add('fg-klapp');
  box.classList.toggle('zu', zu);
  const koerper = el('div', 'fg-koerper');
  while (titel.nextSibling) koerper.appendChild(titel.nextSibling);
  box.appendChild(koerper);
  const griff = el('button', 'fg-griff',
    `<span class="fg-pfeil" aria-hidden="true">▾</span><span>${titel.innerHTML}</span>`);
  griff.type = 'button';
  griff.setAttribute('aria-expanded', String(!zu));
  griff.onclick = () => {
    bauZu.has(schluessel) ? bauZu.delete(schluessel) : bauZu.add(schluessel);
    const jetztZu = box.classList.toggle('zu');
    griff.setAttribute('aria-expanded', String(!jetztZu));
  };
  titel.textContent = '';
  titel.appendChild(griff);
  return box;
}
const klappSchluessel = (aid, art) => art + ':' + (aid || '\u0000ohne');

/**
 * Eine Klammer über ihre Einträge: Farbpunkt, Name zum Auf- und Zuklappen,
 * Zählwert, Auge und „⋯“. Einsatzabschnitte und Zeichengruppen teilen sich
 * diese Zeile – beide Gliederungen sollen gleich aussehen und gleich zu
 * bedienen sein, deshalb steht sie nur einmal hier.
 *
 * @param o.hat          Abschnitt bzw. Gruppe; `null` steht für „nicht zugeteilt“
 * @param o.art          Merker des Klappzustandes, je Liste eigen
 * @param o.ohneName     Überschrift der Klammer ohne Zuteilung
 * @param o.wert         erzeugter Text rechts im Kopf (kein Nutzertext)
 * @param o.oeffnenTitel Beschriftung des „⋯“-Knopfes
 * @param o.oeffnen      was „⋯“ aufschlägt
 * @param o.grund        Änderungsgrund des Augenschalters
 * @param o.neu          baut die Liste nach dem Auf- und Zuklappen neu auf
 * @param o.eintraege    Strecken bzw. Zeichen dieser Klammer
 * @param o.unter        Klammern der Unterabschnitte, fertig gebaut; sie
 *                       stehen hinter den eigenen Einträgen
 * @param o.leer         Satz, wenn nichts zugeteilt ist
 * @param o.karte        baut den einzelnen Eintrag
 * @param o.neuKnopf     liefert den Knopf zum Anlegen darin; ohne Zuteilung `null`
 */
function klammerBox(o) {
  const hat = o.hat;
  const schluessel = klappSchluessel(hat ? hat.id : null, o.art);
  const zu = zugeklappt.has(schluessel);

  const box = el('section', 'ea-gruppe' + (zu ? ' zu' : '') + (hat ? '' : ' ea-ohne') +
    (hat && hat.sichtbar === false ? ' verborgen' : ''));

  const kopf = el('header', 'ea-kopf');
  kopf.innerHTML =
    `<span class="farbpunkt${hat ? '' : ' hohl'}"${hat ? ` style="--farbe:${hat.farbe}"` : ''}></span>
     <button type="button" class="ea-name" aria-expanded="${!zu}">
       <span class="ea-pfeil" aria-hidden="true">▾</span>${escapeHtml(hat ? hat.name : o.ohneName)}
     </button>
     <span class="ea-wert">${o.wert}</span>
     ${hat ? augenKnopf(hat.sichtbar !== false) : ''}
     <button type="button" class="ea-mehr" data-akt="mehr"
             title="${o.oeffnenTitel}" aria-label="${o.oeffnenTitel}">⋯</button>
     <span class="ea-bau"${o.bau ? '' : ' hidden'}>${escapeHtml(o.bau || '')}</span>`;

  kopf.querySelector('.ea-name').onclick = () => {
    zugeklappt.has(schluessel) ? zugeklappt.delete(schluessel) : zugeklappt.add(schluessel);
    o.neu();
  };
  kopf.querySelector('[data-akt="mehr"]').onclick = o.oeffnen;
  if (hat) {
    kopf.querySelector('[data-akt="sichtbar"]').onclick = () => {
      store.aendern(() => { hat.sichtbar = hat.sichtbar === false; }, o.grund);
    };
  }
  box.appendChild(kopf);

  if (!zu) {
    const inhalt = el('div', 'ea-strecken');
    const unter = o.unter || [];
    /* Ein Abschnitt, der nur aus Unterabschnitten besteht, ist nicht leer –
       der Satz stünde sonst über einer Liste voller Klammern. */
    if (!o.eintraege.length && !unter.length) inhalt.appendChild(el('p', 'klein ea-leer', o.leer));
    for (const x of o.eintraege) inhalt.appendChild(o.karte(x));
    for (const box of unter) inhalt.appendChild(box);
    /* Anlegen und Zuteilen in einem Griff: sonst müsste jeder neue Eintrag
       erst gesetzt, dann gesucht und dann von Hand zugeteilt werden. */
    if (hat && o.neuKnopf) inhalt.appendChild(o.neuKnopf());
    box.appendChild(inhalt);
  }
  return box;
}

/* Was eine Listenart in der Abschnittsklammer beisteuert. Als Tabelle und
   nicht als Kette von Bedingungen: mit der vierten Art – den Relaisstellen –
   wäre jede Zeile darin ein dreifach geschachteltes Fragezeichen geworden, und
   an drei verschiedenen Stellen dieselbe Reihenfolge zu treffen ist genau die
   Art Fehler, die niemand beim Lesen sieht. */
const LISTENARTEN = {
  strecken: {
    eintraege: (p, aid) => alphabetisch(streckenIm(p, aid), nachName),
    unter: streckenUnter,
    wert: e => `${e.length} · ${formatLaenge(gesamtKennzahlen(e).trasse)}`,
    /* Der Baustand steht in einer eigenen Zeile unter dem Namen: neben dem
       Zähler drückte er am Tablet den Abschnittsnamen auf zwei Buchstaben
       zusammen, und genau der ist in der Klammer das, wonach gesucht wird. */
    bau: e => baustandZaehlung(e),
    neu: () => zeichneStreckenListe(),
    karte: x => streckenKarte(x),
    leer: 'Keine Strecke zugeteilt. Die Zuteilung steht in der geöffneten Strecke oder unter „⋯“.'
  },
  zeichen: {
    eintraege: (p, aid) => alphabetisch(zeichenIm(p, aid), zeichenTitel),
    unter: zeichenUnter,
    wert: e => `${e.length} Zeichen`,
    neu: () => zeichneZeichenListe(),
    karte: x => zeichenKarte(x),
    leer: 'Kein Zeichen zugeteilt. Nicht zugeteilte Zeichen gehören ohnehin zu jedem Abschnitt.'
  },
  flaechen: {
    eintraege: (p, aid) => alphabetisch(flaechenIm(p, aid), flaechenTitel),
    unter: flaechenUnter,
    wert: e => `${e.length} ${e.length === 1 ? 'Fläche' : 'Flächen'}`,
    neu: () => zeichneFlaechenListe(),
    karte: x => flaecheKarte(x),
    leer: 'Keine Fläche zugeteilt. Nicht zugeteilte Flächen gehören ohnehin zu jedem Abschnitt.'
  },
  relais: {
    eintraege: (p, aid) => alphabetisch(relaisstellenIm(p, aid), relaisTitel),
    unter: relaisstellenUnter,
    wert: e => `${e.length} ${e.length === 1 ? 'Relaisstelle' : 'Relaisstellen'}`,
    neu: () => zeichneRelaisListe(),
    karte: x => relaisKarte(x),
    leer: 'Keine Relaisstelle zugeteilt. Nicht zugeteilte gehören ohnehin zu jedem Abschnitt.'
  }
};

/**
 * Ein Einsatzabschnitt als Klammer über seine Einträge – dieselbe Zeile über
 * den Strecken wie über den taktischen Zeichen. `art` bestimmt, was darin
 * steht und was der Kopf zählt. Die Unterabschnitte hängen als Klammern in
 * der Klammer; der Kopf zählt den ganzen Ast, denn das ist auch, was „⋯“
 * darunter druckt und sichert.
 */
function abschnittGruppe(ea, art) {
  const l = LISTENARTEN[art] || LISTENARTEN.strecken;
  const aid = ea ? ea.id : null;
  const eintraege = l.eintraege(store.projekt, aid);
  const unter = ea ? alphabetisch(unterabschnitte(store.projekt, aid), nachName)
    .map(u => abschnittGruppe(u, art)) : [];

  const box = klammerBox({
    hat: ea, art, ohneName: 'Ohne Einsatzabschnitt',
    wert: l.wert(l.unter(store.projekt, aid)),
    bau: l.bau ? l.bau(l.unter(store.projekt, aid)) : '',
    oeffnenTitel: 'Einsatzabschnitt öffnen',
    oeffnen: () => einsatzabschnittDialog(aid),
    grund: 'strecke',
    neu: l.neu,
    eintraege,
    unter,
    leer: l.leer,
    karte: l.karte,
    neuKnopf: ea ? () => neuKnopf(ea, art) : null
  });
  if (ea) box.dataset.aid = ea.id;
  return box;
}

/** Die Auswahlwerte eines Abschnittsfeldes: alle Abschnitte in Baumfolge, die
 *  tieferen eingerückt – ein Auswahlfeld kennt keine Klammern, die Einrückung
 *  ist alles, was von der Gliederung darin zu sehen ist. */
function abschnittWerte(p, ohne = '— keinem zugeteilt —') {
  return [['', ohne], ...abschnitteGeordnet(p)
    .map(a => [a.id, '\u2003'.repeat(abschnittTiefe(p, a.id) - 1) + a.name])];
}

/** Dieselbe Klammer über einer Zeichengruppe. Sie zählt und schaltet nur
 *  Zeichen – Strecken kennt diese Gliederung nicht. */
function zeichengruppenGruppe(gr) {
  const eintraege = alphabetisch(zeichenInGruppe(store.projekt, gr ? gr.id : null), zeichenTitel);
  const box = klammerBox({
    hat: gr, art: 'zeichengruppe', ohneName: 'Ohne Gruppe',
    wert: `${eintraege.length} Zeichen`,
    oeffnenTitel: 'Zeichengruppe öffnen',
    oeffnen: () => zeichengruppeDialog(gr ? gr.id : null),
    grund: 'zeichen',
    neu: zeichneZeichenListe,
    eintraege,
    leer: 'Kein Zeichen in dieser Gruppe. Die Zuteilung steht im geöffneten Zeichen oder unter „⋯“.',
    karte: zeichenKarte,
    neuKnopf: gr ? () => knopf('+ Zeichen in dieser Gruppe', () => {
      symbolPalette(sym => ctx.zeichenSetzen(sym, { gruppe: gr.id }));
    }, 'klein ea-neu') : null
  });
  if (gr) box.dataset.gid = gr.id;
  return box;
}

function neuKnopf(ea, art) {
  if (art === 'zeichen') {
    return knopf('+ Zeichen in diesem Abschnitt', () => {
      symbolPalette(sym => ctx.zeichenSetzen(sym, { abschnitt: ea.id }));
    }, 'klein ea-neu');
  }
  if (art === 'flaechen') {
    return knopf('+ Fläche in diesem Abschnitt', () => {
      flaechenPalette(vorlage => ctx.flaecheSetzen(vorlage, { abschnitt: ea.id }));
    }, 'klein ea-neu');
  }
  if (art === 'relais') {
    return knopf('+ Relaisstelle in diesem Abschnitt', () => {
      ctx.relaisSetzen({ abschnitt: ea.id });
    }, 'klein ea-neu');
  }
  return knopf('+ Strecke in diesem Abschnitt', () => {
    let sid;
    store.aendern(p => {
      const s = neueStrecke(p);
      s.abschnitt = ea.id;
      sid = s.id;
      p.strecken.push(s);
    }, 'strecke');
    ctx.weiterzeichnen(sid);
  }, 'klein ea-neu');
}

/* Die vier Arten, die am Bauort vorkommen, als Kacheln auf Handschuhmaß.
   Der Richtfunk stand in der Liste als zehnter Eintrag hinter neun Kabeln und
   wurde nicht gefunden – das war das Feedback. Trägt die Strecke eine andere
   Art, in der erweiterten Ansicht gewählt, steht sie als fünfte Kachel
   gedrückt dabei: die Kacheln dürfen nie etwas anderes zeigen als die
   Planung. */
const KACHEL_ARTEN = [
  ['fk2',       'Feldkabel',       'FK 1×2 – Trommel 800 m'],
  ['ffk',       'Feldfernkabel',   'FFK – Trommel 400 m'],
  ['richtfunk', 'WLAN-Richtfunk',  'Funkstrecke, keine Leitung'],
  ['sonst',     'Sonstige Leitung', 'weitere Arten in der erweiterten Ansicht']
];
function leitungswahl(s, setzen) {
  const wahl = el('div', 'leitungswahl nur-einfach');
  wahl.setAttribute('role', 'group');
  wahl.setAttribute('aria-label', 'Leitungsart');
  const arten = KACHEL_ARTEN.some(([id]) => id === s.kabeltyp) ? KACHEL_ARTEN
    : [...KACHEL_ARTEN, [s.kabeltyp, kabelById(s.kabeltyp).name, 'in der erweiterten Ansicht gewählt']];
  for (const [id, name, hinweis] of arten) {
    const b = el('button', 'lw-kachel', `${escapeHtml(name)}<small>${escapeHtml(hinweis)}</small>`);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(id === s.kabeltyp));
    b.onclick = () => setzen(id);
    wahl.appendChild(b);
  }
  return wahl;
}

/* Die Kennung des Plans (`planKennung` in state.js) – dieselbe steht im Kopf
   des gedruckten Bauauftrags. Weicht sie ab, baut der Trupp nach einem
   anderen Stand als dem auf dem Papier. */
function kennungHTML(s) {
  return `<span class="plan-kennung" title="Steht auch im Kopf des gedruckten Bauauftrags">` +
    `Plan <b class="mono">${escapeHtml(planKennung([s]))}</b></span>`;
}

/* Wie lange die letzte Meldung her ist. Die Spanne steht neben der Uhrzeit,
   nicht an ihrer Stelle: am Funk wird die Uhrzeit genannt, in der Lage zählt
   das Alter. Nach zwei Stunden ohne Eintrag wird eine Strecke im Bau
   hervorgehoben – ein Trupp, der so lange nicht meldet, ist eine Nachfrage
   wert. Die Zahl wird minütlich nachgeführt (`altersUhr`). */
const MELDUNG_UEBERFAELLIG_MIN = 120;
function alterText(iso) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
  return `vor ${Math.floor(h / 24)} d`;
}
function alterHTML(iso, laeuft) {
  const min = (Date.now() - Date.parse(iso)) / 60000;
  const spaet = laeuft && min >= MELDUNG_UEBERFAELLIG_MIN;
  return `<span class="bz-alter${spaet ? ' spaet' : ''}" data-zeit="${escapeHtml(iso)}"
    data-laeuft="${laeuft ? 1 : 0}">zuletzt ${escapeHtml(uhrzeit(iso))} · ${escapeHtml(alterText(iso))}</span>`;
}
setInterval(() => {
  for (const s of document.querySelectorAll('.bz-alter')) {
    const iso = s.dataset.zeit;
    s.textContent = `zuletzt ${uhrzeit(iso)} · ${alterText(iso)}`;
    s.classList.toggle('spaet', s.dataset.laeuft === '1' &&
      (Date.now() - Date.parse(iso)) / 60000 >= MELDUNG_UEBERFAELLIG_MIN);
  }
}, 60000);

const KEY_NEU = 'fbp.neu.v1';
function neuListe() {
  try { return JSON.parse(localStorage.getItem(KEY_NEU) || '{}') || {}; } catch (e) { return {}; }
}
function meldungNeu(sid) { return !!neuListe()[sid]; }
function meldungGesehen(sid) {
  const l = neuListe(); delete l[sid];
  try { localStorage.setItem(KEY_NEU, JSON.stringify(l)); } catch (e) { /* gilt dann nur jetzt */ }
}
const KEY_S6 = 'fbp.s6.v1';
function s6Liste() {
  try { return JSON.parse(localStorage.getItem(KEY_S6) || '{}') || {}; } catch (e) { return {}; }
}
function s6Erledigt(sid, text) { return s6Liste()[sid] === text; }
function s6Merken(sid, text) {
  const l = s6Liste();
  if (text) l[sid] = text; else delete l[sid];
  try { localStorage.setItem(KEY_S6, JSON.stringify(l)); } catch (e) { /* gilt dann nur jetzt */ }
}
function meldungenNeuMerken(sids) {
  const l = neuListe();
  for (const sid of sids) if (sid) l[sid] = new Date().toISOString();
  try { localStorage.setItem(KEY_NEU, JSON.stringify(l)); } catch (e) { /* gilt dann nur jetzt */ }
}

function streckenKarte(s) {
  const gewaehlt = ctx.sl.auswahl === s.id;
  const k = kennzahlen(s);
  /* Wie beim Zeichen: „verborgen“ meint den eigenen Schalter, „entzogen“ den
     des Einsatzabschnitts – sonst sieht eine Strecke, die der Abschnitt
     abgeschaltet hat, aus wie eine auf der Karte. */
  const zustand = s.sichtbar === false ? ' verborgen'
    : (streckeSichtbar(store.projekt, s) ? '' : ' entzogen');
  const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : '') + zustand);
  karte.dataset.sid = s.id;

  /* Der Handler sitzt auf der Kopfzeile, nicht auf einzelnen Feldern darin:
     sonst tut ein Klick auf die Polsterung nichts, obwohl die ganze Zeile
     anklickbar aussieht. Der Name ist zusätzlich ein Knopf – damit führt auch
     die Tabulatortaste in die Strecke hinein. */
  const kopf = el('header', 'eintrag-kopf');
  kopf.innerHTML =
    `<span class="farbpunkt" style="--farbe:${s.farbe}"></span>
     <button type="button" class="eintrag-name" aria-expanded="${gewaehlt}">${escapeHtml(s.name)}</button>
     <span class="eintrag-wert">${formatLaenge(k.trasse)}</span>
     ${augenKnopf(s.sichtbar !== false)}`;
  kopf.onclick = () => ctx.sl.waehle(gewaehlt ? null : s.id);
  kopf.querySelector('[data-akt="sichtbar"]').onclick = e => {
    e.stopPropagation();
    store.aendern(() => { s.sichtbar = s.sichtbar === false; }, 'strecke');
  };
  karte.appendChild(kopf);

  /* Der Baustand steht schon in der zugeklappten Zeile: wer im Planungsmodus
     über die Liste geht, muss sehen können, an welcher Strecke draußen schon
     gearbeitet wird – sonst plant er auf einer Trasse weiter, die ein Trupp
     gerade anders baut. */
  const bz = bauzeile(s);
  if (bz) {
    const neu = meldungNeu(s.id);
    const zeile = el('div', 'eintrag-zeile bau-zeile',
      (neu ? '<span class="bz-marke bz-neu">neu</span>' : '') +
      `<span class="bz-marke bz-${bz.stand.id}">${escapeHtml(bz.stand.kurz)}</span>` +
      (bz.text ? `<span>${escapeHtml(bz.text)}</span>` : '') +
      (bz.zuletzt ? alterHTML(bz.zuletzt, !['gebaut', 'uebergeben'].includes(bz.stand.id)) : '') +
      bz.warnungen.map(w => `<span class="bz-warnung">⚠ ${escapeHtml(w)}</span>`).join(''));
    /* Was neu eingegangen ist, bleibt markiert, bis es jemand gesehen hat. Im
       Audit war die eben eingespielte Strecke nach einem Hinweis von drei
       Sekunden von den anderen nicht mehr zu unterscheiden – bei mehreren
       Meldungen und bei der Schichtübergabe wusste niemand, was bearbeitet
       ist. Gemerkt wird im Gerät, nicht in der Planung: „gesehen“ sagt, wer
       an diesem Platz sitzt. */
    if (neu) {
      const gesehen = el('button', 'mini-knopf bz-gesehen', '✓ gesehen');
      gesehen.title = 'Als gesehen markieren';
      gesehen.onclick = e => { e.stopPropagation(); meldungGesehen(s.id); zeichneStreckenListe(); };
      zeile.appendChild(gesehen);
    }
    karte.appendChild(zeile);
    /* Die Meldung an den S 6 steht im Wortlaut da und nicht als Zahl: sie ist
       die eine Auskunft, die der Trupp ausdrücklich an die Führung richtet –
       „Deich überflutet, Trasse nach Osten verlegt“. Bisher stand sie nur im
       Baumodus, also überall dort nicht, wo die Führungsstelle hinsieht. */
    /* Sie lässt sich als erledigt abhaken – gemerkt im Gerät wie „gesehen“,
       und zwar für genau diesen Wortlaut: ändert der Trupp die Meldung, steht
       sie wieder offen da. Im Audit blieb der gelbe Kasten für immer gleich,
       und die Liste wurde mit der Zeit zu einer Wand gleich aussehender
       Kästen, von denen niemand wusste, welcher bearbeitet ist. */
    if (bz.meldung) {
      const erledigt = s6Erledigt(s.id, bz.meldung);
      const m = el('div', 'eintrag-zeile bz-meldung' + (erledigt ? ' erledigt' : ''));
      m.appendChild(el('span', 'bz-meldung-text', escapeHtml((erledigt ? '✓ ' : '✉ ') + bz.meldung)));
      const griff = el('button', 'mini-knopf bz-gesehen', erledigt ? 'wieder offen' : '✓ erledigt');
      griff.onclick = e => { e.stopPropagation(); s6Merken(s.id, erledigt ? null : bz.meldung); zeichneStreckenListe(); };
      m.appendChild(griff);
      karte.appendChild(m);
    }
  }

  /* Wird in der Lage schon gebaut, trägt auch die noch nicht begonnene
     Strecke ihre Marke: ohne sie sah sie aus wie reine Planung und fiel beim
     Überfliegen nicht auf. Der Trupp, dem sie aufgetragen ist, steht daneben. */
  if (!bz && store.projekt.strecken.some(bauBegonnen)) {
    karte.appendChild(el('div', 'eintrag-zeile bau-zeile',
      '<span class="bz-marke bz-offen">offen</span>' +
      (s.trupp ? `<span>${escapeHtml(s.trupp)}</span>` : '')));
  }

  if (!gewaehlt) {
    karte.appendChild(el('div', 'eintrag-zeile',
      `<span>${escapeHtml(k.kabel.kurz)}${k.strom && k.strom.querschnitt
          ? ' ' + escapeHtml(querschnittText(k.strom.querschnitt)) : ''}</span>
       <span>${k.punkte} ${k.punkte === 1 ? 'Punkt' : 'Punkte'}</span>
       <span>${k.kabel.funk ? 'Funkstrecke' : `Bedarf ${formatLaenge(k.bedarf)}`}</span>`));
    karte._fbpStand = geschlosseneKarteStand(s);
    return karte;
  }

  const koerper = el('div', 'eintrag-koerper');

  // -- Kennzahlen
  const kz = el('div', 'kennzahlen' + (k.kabel.funk ? ' zweispaltig' : ''));
  kz.id = 'kz-' + s.id;
  kz.innerHTML = kennzahlenHTML(k);
  koerper.appendChild(kz);

  /* Die Sprechreichweite hängt an Kabelart, Verlegeart und der liegenden
     Kabellänge – also an denselben Feldern wie die Kennzahlen darüber. */
  const rw = el('div', 'reichweite');
  const reichweiteFrisch = kz2 => {
    const r = kz2.reichweite;
    rw.hidden = !r;
    rw.className = 'reichweite' + (r ? ' rw-' + r.stufe : '') +
      (r && r.stufe === 'darueber' ? ' warnung' : '');
    rw.innerHTML = reichweiteHTML(r);
  };

  /* Der Bauzuschlag verlängert die Leitung und damit den Spannungsfall –
     die Querschnittsanzeige hängt an denselben Feldern und wird mit erneuert. */
  let stromFrisch = () => {};
  /* Distanz und Azimut der Funkstrecke hängen an den gezeichneten Punkten –
     sie werden mit denselben Anlässen erneuert wie die Kennzahlen. */
  let funkFrisch = () => {};
  /* Das Trommelfeld zeigt die gerechnete Zahl als Platzhalter – sie ändert sich
     mit Bauzuschlag, Trommellänge und jedem gesetzten Punkt und muss deshalb
     mitlaufen, sonst stünde dort der Stand von vor drei Eingaben. */
  let trommelFrisch = () => {};
  const frisch = () => {
    const neu = kennzahlen(s);
    kz.innerHTML = kennzahlenHTML(neu);
    const kopfWert = karte.querySelector('.eintrag-wert');
    if (kopfWert) kopfWert.textContent = formatLaenge(neu.trasse);
    stromFrisch();
    funkFrisch();
    trommelFrisch(neu);
    reichweiteFrisch(neu);
  };

  // -- Stammdaten
  const g1 = el('div', 'feldgruppe');
  g1.appendChild(feld('Bezeichnung der Strecke', s.name, v => {
    schreib(() => { s.name = v; });
    karte.querySelector('.eintrag-name').textContent = v;
  }));
  const vn = el('div', 'feld-paar');
  vn.append(
    feld('von', s.von, v => schreib(() => { s.von = v; }), { platzhalter: 'z. B. FüSt' }),
    feld('nach', s.nach, v => schreib(() => { s.nach = v; }), { platzhalter: 'z. B. Abschnitt Nord' })
  );
  g1.appendChild(vn);
  /* Das Feld erscheint erst, wenn es etwas zu wählen gibt – ohne gebildete
     Abschnitte wäre es eine Auswahl mit einem einzigen Eintrag. */
  if ((store.projekt.einsatzabschnitte || []).length) {
    g1.appendChild(feld('Einsatzabschnitt', s.abschnitt || '', v => {
      store.aendern(() => { s.abschnitt = v || null; }, 'strecke');
    }, {
      typ: 'select', klasse: 'nur-erweitert',
      werte: abschnittWerte(store.projekt)
    }));
  }
  g1.appendChild(farbwahl(s, karte));
  koerper.appendChild(g1);

  // -- Technik
  const g2 = el('div', 'feldgruppe');
  g2.appendChild(el('h3', 'gruppen-titel', 'Leitung und Bauansatz'));
  /* Sofort und nicht über die gesammelte Formulareingabe: die Leitungsart
     entscheidet, welche Felder das Formular überhaupt zeigt (Bauansatz,
     Stromversorgung). Ein verzögertes Schreiben baute die Liste noch mit der
     alten Art auf. */
  const leitungSetzen = v => {
    if (v === s.kabeltyp) return;
    /* An einer Strecke im Bau ist die Leitungsart der Auftrag: der Trupp baut
       Feldkabel, und im Plan stünde danach Feldfernkabel, samt Trommellänge
       und Materialbedarf. Im Audit ging das mit einem Tipp auf eine Kachel –
       dieselbe Rückfrage wie beim Löschen eines Punktes. */
    if (bauBegonnen(s)) {
      dialog({
        titel: 'Leitungsart ändern?',
        /* Was mitzieht, steht dabei: Trommellänge und Bauzuschlag folgen der
           Leitungsart, solange sie nicht von Hand geändert waren. */
        inhalt: `<p>An <b>${escapeHtml(s.name)}</b> wird schon gebaut, mit
            ${escapeHtml(kabelById(s.kabeltyp).name)}. Ändert sich der Auftrag, gehört dem Trupp
            ein neuer Link.</p>
          <p class="klein">Trommellänge ${escapeHtml(meter(s.trommellaenge))} →
            ${escapeHtml(meter(s.trommellaenge === kabelById(s.kabeltyp).trommel
              ? kabelById(v).trommel : s.trommellaenge))}; Materialbedarf und Bauzeit
            werden neu gerechnet.</p>`,
        fuss: [
          { text: 'Abbrechen', tun: () => zeichneStreckenListe() },
          { text: `${kabelById(v).name} eintragen`, primaer: true, tun: () => {
            leitungSchreiben(v);
          } }
        ]
      });
      return;
    }
    leitungSchreiben(v);
  };
  const leitungSchreiben = v => {
    store.aendern(() => {
      const alt = kabelById(s.kabeltyp), neu = kabelById(v);
      s.kabeltyp = v;
      // Vorgabewerte mitziehen, solange sie nicht von Hand geändert wurden
      if (s.trommellaenge === alt.trommel) s.trommellaenge = neu.trommel;
      if (s.zuschlag === alt.zuschlag) s.zuschlag = neu.zuschlag;
      if (s.verlegeleistung === alt.leistung) s.verlegeleistung = neu.leistung;
    }, 'strecke');
  };
  /* Zwei Eingaben für dasselbe Feld, je Sicht eine (`js/sicht.js`): die
     Kacheln in der einfachen Ansicht, die volle Liste in der erweiterten.
     Beide schreiben über denselben Weg, und beide stehen im Blatt – so
     braucht ein Wechsel der Sicht keinen Neuaufbau der Karte. */
  g2.appendChild(leitungswahl(s, leitungSetzen));
  g2.appendChild(feld('Leitungsart', s.kabeltyp, leitungSetzen,
    { typ: 'select', klasse: 'nur-erweitert', werte: KABELTYPEN.map(k => [k.id, k.name]) }));
  /* Eine Funkstrecke wird nicht verlegt – Verlegeart und Bauansatz hätten
     dort nichts zu sagen und blieben doch als Zahlen im Weg. */
  if (!k.kabel.funk) {
    g2.appendChild(feld('Verlegeart', s.verlegeart, v => {
      schreib(() => { s.verlegeart = v; });
      frisch();          // Hoch- oder Tiefbau entscheidet über die Sprechreichweite
      ctx.aufAenderung();
    }, { typ: 'select', klasse: 'nur-erweitert', werte: VERLEGEARTEN.map(v => [v.id, v.name]) }));

    const zahlen = el('div', 'feld-dreier nur-erweitert');
    zahlen.append(
      feld('Bauzuschlag', s.zuschlag, v => { schreib(() => { s.zuschlag = v; }); frisch(); ctx.aufAenderung(); },
        { typ: 'number', min: 0, max: 100, step: 1, einheit: '%' }),
      feld('Trommellänge', s.trommellaenge, v => { schreib(() => { s.trommellaenge = v; }); frisch(); },
        { typ: 'number', min: 1, step: 10, einheit: 'm' }),
      feld('Verlegeleistung', s.verlegeleistung, v => { schreib(() => { s.verlegeleistung = v; }); frisch(); },
        { typ: 'number', min: 1, step: 50, einheit: 'm/h' })
    );
    g2.appendChild(zahlen);

    /* Die gerechnete Trommelzahl ist ein Vorschlag, kein Befund: sie kennt nur
       die Trasse. Wer am Bauplatz weiß, dass mehr gebraucht wird – eine
       Trommel als Rückhalt, angebrochene Reste, ein Umweg, der nicht in der
       Planung steht –, trägt seine Zahl hier ein; leer heißt weiter gerechnet.
       Die Zahl geht durch die ganze Ausgabe bis ins Materialblatt des
       Bauauftrags, deshalb bleibt daneben stehen, was gerechnet worden wäre. */
    const trommelFeld = feld('Trommeln abweichend (Stück)', s.trommelnVorgabe, v => {
      /* Auffrischen erst, wenn geschrieben ist: die Eingabe wird gesammelt, und
         eine gleich danach gerechnete Kachel zeigte den Stand davor. */
      schreib(() => {
        s.trommelnVorgabe = v === '' ? null : Math.max(0, Math.round(Number(v) || 0));
      }, frisch);
    }, { typ: 'number', min: 0, step: 1, klasse: 'nur-erweitert' });
    const trommelHinweis = el('p', 'klein nur-erweitert');
    g2.append(trommelFeld, trommelHinweis);
    const trommelEingabe = trommelFeld.querySelector('input');
    trommelFrisch = kz2 => {
      trommelEingabe.placeholder = `gerechnet: ${kz2.trommelnGerechnet}`;
      trommelHinweis.textContent = kz2.trommelnVonHand
        ? `Von Hand gesetzt: ${kz2.trommeln} statt gerechnet ${kz2.trommelnGerechnet}. `
          + 'Feld leeren, um wieder zu rechnen.'
        : 'Leer lassen heißt: aus Kabelbedarf und Trommellänge gerechnet.';
    };
    trommelFrisch(k);
  }
  g2.appendChild(feld('Auftrag an (Trupp)', s.trupp, v => schreib(() => { s.trupp = v; }),
    { platzhalter: 'z. B. FmBauTr 1, FmBauTr 2', klasse: 'nur-erweitert' }));
  /* Mehrere Trupps an einer Strecke bekamen bisher keine Bauabschnitte vom
     Planer – die legte nur der Trupp an, und wer es nicht tat, ersetzte beim
     Einspielen die Aufnahme des anderen. Stehen hier mehrere, wählt jeder
     beim Übernehmen seinen Namen und baut in einem eigenen Abschnitt. */
  g2.appendChild(el('p', 'klein nur-erweitert',
    'Mehrere Trupps mit Komma trennen: jeder wählt beim Übernehmen seinen Namen und baut ' +
    'in einem eigenen Bauabschnitt – ihre Meldungen ersetzen sich dann nicht.'));
  g2.appendChild(feld('Bemerkung zum Auftrag', s.bemerkung, v => schreib(() => { s.bemerkung = v; }),
    { typ: 'textarea', zeilen: 2, klasse: 'nur-erweitert' }));
  koerper.appendChild(g2);

  reichweiteFrisch(k);
  koerper.appendChild(rw);

  // -- Stromversorgung (nur bei Stromleitungen)
  if (s.kabeltyp === 'strom') {
    const g3 = stromGruppe(s);
    stromFrisch = g3.aktualisieren;
    /* Leistungsfaktor, Netzform und Spannungsfall sind Rechnung für den
       Planer; in der einfachen Ansicht bleibt die Stromleitung eine Leitung. */
    g3.gruppe.classList.add('nur-erweitert');
    koerper.appendChild(g3.gruppe);
  }

  /* -- Richtfunk (nur bei der Funkstrecke). Die Angaben füllen den
     „Einzelauftrag Richtfunkstrecke WLAN“ des Bauauftrags – zwei Aufbauplätze
     und darunter, was für die Strecke als Ganzes gilt. */
  if (k.kabel.funk) {
    const g4 = richtfunkGruppe(s, frisch);
    funkFrisch = g4.aktualisieren;
    koerper.appendChild(g4.gruppe);
  }

  // -- Punkte
  const tabelle = punktTabelle(s);
  koerper.appendChild(tabelle);

  /* -- Was die Trasse kreuzt. Nur bei einer verlegten Leitung: eine Funkstrecke
     kreuzt nichts, sie fliegt darüber – für sie steht die Freileitung als
     Hindernis in der Richtfunkprüfung. */
  const querung = !k.kabel.funk && s.punkte.length >= 2 ? querungsGruppe(s) : null;
  if (querung) koerper.appendChild(querung);

  /* Was die stehende Karte zum Nachführen braucht (`offeneKarteNachfuehren`):
     die Signatur, die Auffrischung der Kennzahlen und die beiden Blöcke, die
     an den Punkten hängen. */
  karte._fbpOffen = {
    stand: offeneKarteStand(s),
    punkteStand: signatur(
      [s.punkte, ctx.sl.aktiverPunkt, store.projekt.optionen.koordformat], s.punkte),
    frisch, tabelle, querung
  };

  /* -- Aktionen, gestaffelt statt gleich laut:
     bearbeiten (gleichrangig) · Rohdaten (leise) · Löschen (leise, selten)
     und zuunterst die Ausgabezeile mit dem Bauauftrag – dem Ergebnis der
     ganzen Eingabe darüber. Sie hängt am unteren Rand der Karte fest. */
  /* Dieselbe Kennung steht im Kopf des gedruckten Bauauftrags und im
     Bau-Reiter des Trupps (`planKennung` in state.js): meldet der Trupp eine
     andere, baut er nach einem älteren Stand. */
  koerper.appendChild(el('p', 'klein', kennungHTML(s)));
  const tasten = el('div', 'tastenreihe');
  tasten.append(
    knopf('Weiterzeichnen', () => ctx.weiterzeichnen(s.id)),
    knopf('Auf Karte zeigen', () => { ctx.sl.zeigeStrecke(s.id); ctx.zurKarte?.(); }),
    /* Der kurze Weg zum Bautrupp: der Teilen-Dialog öffnet mit dieser Strecke
       vorgewählt. Er steht hier und nicht nur im Dateimenü, weil dort die
       Strecke erst wieder aus einer Liste zu suchen wäre – und weil der Trupp
       an der Strecke hängt, nicht an der Planung. */
    knopf('Link an den Bautrupp', () => ctx.teilenDialog?.('st:' + s.id)),
    knopf('Richtung umkehren', () => {
      store.aendern(() => {
        s.punkte.reverse();
        bauUmkehren(s);
        s.punkte.forEach((p, i) => {
          if (i === 0) p.art = 'start';
          else if (i === s.punkte.length - 1) p.art = 'ziel';
          else if (p.art === 'start' || p.art === 'ziel') p.art = 'punkt';
        });
        const h = s.von; s.von = s.nach; s.nach = h;
      }, 'strecke');
    }, 'nur-erweitert'),
    knopf('Duplizieren', () => {
      store.aendern(p => {
        const kopie = JSON.parse(JSON.stringify(s));
        kopie.id = id();
        kopie.name = s.name + ' (Kopie)';
        kopie.punkte.forEach(pt => pt.id = id());
        /* Die Baudokumentation bleibt beim Original. Dupliziert wird eine
           Planung – eine zweite Trasse derselben Art –, und die ist noch nicht
           gebaut. Mitkopiert stünde dieselbe Aufnahme vom Bauort zweimal in der
           Planung, und ihre Verweise zeigten auf die alten Punktkennungen, die
           die Zeile darüber gerade ersetzt hat. */
        kopie.bau = null;
        kopie.farbe = FARBEN[p.strecken.length % FARBEN.length];
        p.strecken.push(kopie);
      }, 'strecke');
    }, 'nur-erweitert')
  );
  koerper.appendChild(tasten);

  const daten = el('div', 'feldgruppe rohdaten nur-erweitert');
  daten.appendChild(el('h3', 'gruppen-titel', 'Daten für andere Programme'));
  const datenTasten = el('div', 'tastenreihe');
  datenTasten.append(
    knopf('CSV', () => io.csvExportieren(s.id), 'klein'),
    knopf('GPX', () => io.gpxExportieren(s.id), 'klein'),
    knopf('GeoJSON', () => io.geoJSONExportieren(s.id), 'klein'),
    knopf('KML', () => io.kmlExportieren(s.id), 'klein')
  );
  daten.appendChild(datenTasten);
  koerper.appendChild(daten);

  /* Löschen ist selten und endgültig. Es bekommt die leiseste Stufe und
     Abstand nach oben – nicht die volle Breite neben dem Bauauftrag. */
  const entfernen = el('div', 'streckenfuss');
  entfernen.appendChild(knopf('Strecke löschen', () => {
    dialog({
      titel: 'Strecke löschen',
      /* Die Baudokumentation wird ausdrücklich genannt: sie ist am Bauort
         entstanden und nicht zu wiederholen, und dies ist die einzige Stelle
         im Programm, die eine ganze auf einmal wegnimmt. */
      inhalt: `<p>Soll <b>${escapeHtml(s.name)}</b> mit ${s.punkte.length} Punkten wirklich gelöscht werden?</p>
               ${bauBegonnen(s) ? `<p class="bau-warnung">Dabei geht auch die Baudokumentation
                 dieser Strecke verloren: ${escapeHtml(bauUmfangText(s))}.</p>` : ''}
               <p class="klein">${RUECKGAENGIG_HTML}</p>`,
      fuss: [
        { text: 'Abbrechen' },
        { text: 'Löschen', gefahr: true, tun: () => {
            store.aendern(p => { p.strecken = p.strecken.filter(x => x.id !== s.id); }, 'strecke');
            ctx.sl.auswahl = null;
            hinweis('Strecke gelöscht');
          } }
      ]
    });
  }, 'gefahr klein'));
  koerper.appendChild(entfernen);

  const ausgabe = el('div', 'tastenreihe ausgabe');
  const bauKnopf = knopf('▤ Bauauftrag (PDF)', () => oeffneBauauftrag(s.id), 'primaer breit');
  ausgabe.appendChild(bauKnopf);
  if (s.punkte.length < 2) {
    bauKnopf.disabled = true;
    ausgabe.appendChild(el('p', 'ausgabe-grund',
      'Für den Bauauftrag werden mindestens zwei Trassenpunkte gebraucht.'));
  }
  koerper.appendChild(ausgabe);

  karte.appendChild(koerper);
  return karte;
}

/* Eine Funkstrecke wird nicht verlegt: Bedarf, Trommeln und Bauzeit wären
   dort dieselben erfundenen Nullen, die der Bauauftrag schon weglässt
   (siehe `kennzahlenHTML` in `bauauftrag.js`). Sie trägt zwei Kacheln – die
   Luftlinie und die Zahl ihrer Abschnitte. */
function kennzahlenHTML(k) {
  const kacheln = k.kabel.funk ? [
    ['Luftlinie', formatLaenge(k.trasse)],
    ['Abschnitte', String(k.abschnitte)]
  ] : [
    ['Trasse', formatLaenge(k.trasse)],
    ['Bedarf', formatLaenge(k.bedarf)],
    ['Trommeln', String(k.trommeln) + (k.trommelnVonHand ? '*' : '')],
    ['Bauzeit', stundenKurz(k.bauzeitStunden)]
  ];
  return kacheln.map(([t, w]) =>
    `<div class="kz"><span>${t}</span><b>${escapeHtml(w)}</b></div>`).join('') +
    kabelabschnitteHTML(k);
}

/* Ein Verteiler mitten auf der Strecke schließt das Kabel ab; dahinter beginnt
   eine neue Trommel, der Rest der alten bleibt aufgewickelt. Ohne den Hinweis
   sähe die Trommelzahl nach einem Rechenfehler aus – durch die Trommellänge
   geteilt geht der Gesamtbedarf nicht auf. */
function kabelabschnitteHTML(k) {
  /* Steht eine Zahl von Hand in der Kachel, geht die Aufstellung der Abschnitte
     nicht mehr auf – der Stern wird deshalb zuerst erklärt, sonst sucht der
     Leser den Fehler in der Teilung. */
  const vonHand = k.trommelnVonHand
    ? `<p class="kz-hinweis">* Trommelzahl von Hand gesetzt –
       gerechnet wären es ${k.trommelnGerechnet}.</p>`
    : '';
  if (k.kabelabschnitte.length < 2) return vonHand;
  const teile = k.kabelabschnitte.map(a =>
    `${meter(a.bedarf)} → ${a.trommeln}`).join(' · ');
  return vonHand + `<p class="kz-hinweis"><b>${k.kabelabschnitte.length} Kabelabschnitte</b> durch
    Verteiler getrennt – je Abschnitt ganze Trommeln: ${teile}</p>`;
}

function stundenKurz(h) {
  if (!isFinite(h) || h <= 0) return '–';
  return h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1).replace('.', ',')} h`;
}

/* Stromleitungen tragen eine Last. Aus ihr, der Leitungslänge und dem
   zulässigen Spannungsfall folgt der Querschnitt – die Rechnung, die sonst
   auf dem Zettel neben der Planung landet. Die Felder erscheinen nur bei der
   Leitungsart „Stromleitung“; für LWL und Fernmeldekabel sind sie ohne Sinn. */
function stromGruppe(s) {
  const gruppe = el('div', 'feldgruppe');
  gruppe.appendChild(el('h3', 'gruppen-titel', 'Stromversorgung und Querschnitt'));

  const ergebnis = el('div', 'strom-ergebnis');
  const aktualisieren = () => { ergebnis.innerHTML = stromErgebnisHTML(kennzahlen(s).strom); };

  /* Bei Gleichstrom gibt es keinen Leistungsfaktor. Das Feld bleibt stehen und
     wird gesperrt – so springt die Gruppe beim Umschalten nicht in der Höhe. */
  const cosFeld = feld('Leistungsfaktor cos φ', s.strom.cosphi,
    v => { schreib(() => { s.strom.cosphi = v; }); aktualisieren(); },
    { typ: 'number', min: 0.3, max: 1, step: 0.05 });
  const cosEingabe = cosFeld.querySelector('input');
  const cosPflegen = () => {
    const gleich = !!netzById(s.strom.netz).gleich;
    cosEingabe.disabled = gleich;
    cosFeld.classList.toggle('gesperrt', gleich);
    cosFeld.title = gleich ? 'Bei Gleichstrom ohne Bedeutung' : '';
  };
  cosPflegen();

  const oben = el('div', 'feld-paar');
  oben.append(
    feld('Netzform', s.strom.netz, v => {
      schreib(() => { s.strom.netz = v; });
      cosPflegen();
      aktualisieren();
    }, { typ: 'select', werte: NETZFORMEN.map(n => [n.id, n.name]) }),
    cosFeld
  );
  gruppe.appendChild(oben);

  const unten = el('div', 'feld-dreier');
  unten.append(
    feld('Last', s.strom.last, v => { schreib(() => { s.strom.last = v; }); aktualisieren(); },
      { typ: 'number', min: 0, step: 0.5, platzhalter: 'z. B. 3,5' }),
    feld('Einheit', s.strom.einheit, v => { schreib(() => { s.strom.einheit = v; }); aktualisieren(); },
      { typ: 'select', werte: LASTEINHEITEN }),
    feld('Zul. Spannungsfall', s.strom.spannungsfall,
      v => { schreib(() => { s.strom.spannungsfall = v; }); aktualisieren(); },
      { typ: 'number', min: 0.5, max: 20, step: 0.5, einheit: '%' })
  );
  gruppe.appendChild(unten);

  aktualisieren();
  gruppe.appendChild(ergebnis);
  return { gruppe, aktualisieren };
}

function stromErgebnisHTML(a) {
  if (!a) {
    return `<p class="se-leer">Last eintragen – daraus ergibt sich der nötige
            Leiterquerschnitt für diese Leitung.</p>`;
  }
  if (a.ueberLast) {
    const grenze = querschnittText(MAX_QUERSCHNITT);
    return `<p class="se-leer warnung">${a.ueberStrom
      ? `Betriebsstrom ${escapeHtml(stromText(a.strom))} – mehr, als ${escapeHtml(grenze)} tragen.
         Last aufteilen oder höhere Spannung wählen.`
      : `Auf ${escapeHtml(formatLaenge(a.laenge))} hält selbst ${escapeHtml(grenze)} den
         Spannungsfall von ${escapeHtml(grenzText(a.grenze))} nicht. Höhere Spannung wählen,
         Last verringern oder unterwegs einspeisen.`}</p>`;
  }
  const zeilen = [
    ['Betriebsstrom', stromText(a.strom)],
    ['Leistung', leistungText(a.leistung)],
    ['Spannungsfall', `${prozentText(a.spannungsfallProzent)} von ${grenzText(a.grenze)}`],
    ['Maßgebend', massgebendText(a)]
  ];
  return `<div class="se-kopf">
      <span class="se-titel">Empfohlener Querschnitt</span>
      <b class="se-wert">${escapeHtml(querschnittText(a.querschnitt))}</b>
    </div>
    <div class="se-zeilen">${zeilen.map(([t, w]) =>
      `<span><i>${t}</i><b>${escapeHtml(w)}</b></span>`).join('')}</div>
    ${a.laenge > 0 ? '' : `<p class="se-fuss">Noch keine Trasse gezeichnet – gerechnet ist
       allein die Belastbarkeit, ohne Spannungsfall über die Länge.</p>`}
    <p class="se-fuss">Richtwert für Kupferleitung, drei belastete Adern, frei in Luft.
       Aufgerollte Leitungsroller tragen deutlich weniger. Die verbindliche Auslegung
       trifft eine Elektrofachkraft.</p>`;
}

/* ---------------------------------------------------------------- Richtfunk
   Die Angaben des „Einzelauftrags Richtfunkstrecke WLAN“. Sie stehen in der
   Ordnung des Formulars: erst beide Aufbauplätze nebeneinander, dann die
   Funkparameter, die für die ganze Strecke gelten.

   Was die Planung schon weiß, wird nicht abgefragt: Koordinate, Distanz und
   Abstrahlrichtung stehen als gerechnete Werte an der jeweiligen Spalte. Die
   Geländehöhe ist der Zwitter – sie käme aus derselben Quelle wie das
   Höhenprofil, muss aber im Auftrag festgeschrieben stehen. Sie wird deshalb
   auf Knopfdruck geholt und dann als Zahl gehalten. */
/* Es gibt immer höchstens eine Funksichtfläche auf der Karte. Zwei übereinander
   wären nicht mehr auseinanderzuhalten – beide sind dasselbe Violett –, und der
   Satz daneben könnte nur für eine von beiden gelten. Der Zustand steht deshalb
   hier und nicht in der Gruppe: er muss auch dann noch erreichbar sein, wenn die
   Gruppe für eine andere Strecke neu gebaut wird. */
let schattenEbene = null, schattenBefund = null, schattenPlatz = null, schattenName = '';
/* Wofür die liegende Fläche gerechnet wurde: Strecke und Lage beider
   Aufbauplätze. Die Gruppe wird bei jeder Änderung an der Strecke neu gebaut –
   auch dann, wenn die Höhen sich selbst nachtragen –, und eine Fläche, die
   dabei jedes Mal verschwände, wäre nach dem Öffnen einer Strecke nicht
   aufzurufen. Verschwinden muss sie trotzdem, sobald sie nicht mehr gilt:
   Wechsel der Strecke oder ein verschobener Aufbauplatz. */
let schattenStrecke = null, schattenOrt = '';

/* Der Umkreis gehört zur Ansicht, nicht zur Planung: er sagt nichts über die
   Strecke aus, sondern nur, wie weit man gerade hinausschaut. Er wandert
   deshalb nicht in den Store – steht aber modulweit, damit ein Neuaufbau der
   Gruppe die eingestellte Weite nicht auf die Vorgabe zurückwirft. */
let schattenUmkreis = UMKREIS_STANDARD;

function schattenWeg() {
  if (schattenEbene && ctx && ctx.karte) ctx.karte.removeLayer(schattenEbene);
  schattenEbene = null; schattenBefund = null; schattenPlatz = null; schattenName = '';
  schattenStrecke = null; schattenOrt = '';
}

function schattenHTML() {
  if (!schattenBefund) return '';
  return `<p class="rf-gelaende">${escapeHtml(sichtText(schattenBefund, schattenName))}</p>`;
}

/* Der Zwischenstandort folgt denselben Regeln wie die Funksicht darüber: eine
   Fläche zur Zeit, nichts wird gespeichert, und ein verschobener Aufbauplatz
   räumt sie ab. Die Kandidaten stehen in der Gruppe als Liste, auf der Karte
   als Nummern – wer eine wählt, bekommt die Vorschau der beiden Teilstrecken
   und den Knopf, der sie anlegt. */
let zwischenEbene = null, zwischenBefund = null, zwischenStrecke = null, zwischenOrt = '';
let zwischenWahl = null, zwischenVorschau = null, zwischenLaeuft = false;

function zwischenWeg() {
  if (ctx && ctx.karte) {
    if (zwischenEbene) ctx.karte.removeLayer(zwischenEbene);
    if (zwischenVorschau) ctx.karte.removeLayer(zwischenVorschau);
  }
  zwischenEbene = null; zwischenBefund = null; zwischenStrecke = null; zwischenOrt = '';
  zwischenWahl = null; zwischenVorschau = null;
}

/* Die Rückwärtsfrage der Richtfunkstrecke: welche Antennenhöhe braucht das
   Ende, damit ein angetippter Ort frei wird. Sie hängt am nächsten Kartenklick
   und wird als eigener Horcher davorgelegt – der allgemeine Klickhorcher der
   Karte käme sonst zuerst an die Reihe und nähme der Strecke die Auswahl. Ein
   Tipp auf die Kartenbedienung (Zoom, Ebenen) ist keine Zielwahl. */
let rfMast = null;   // { strecke, platz, name, ziel, ergebnis }
let rfZielwahlAus = null;

function rfZielwahl(tun) {
  if (rfZielwahlAus) rfZielwahlAus();
  const c = ctx.karte.getContainer();
  L.DomUtil.addClass(c, 'modus-relais');
  const weg = () => {
    c.removeEventListener('click', h, true);
    L.DomUtil.removeClass(c, 'modus-relais');
    rfZielwahlAus = null;
  };
  const h = ev => {
    if (ev.target.closest('.leaflet-control')) return;
    weg();
    ev._fbpVerbraucht = true;
    tun(ctx.karte.mouseEventToLatLng(ev));
  };
  c.addEventListener('click', h, true);
  rfZielwahlAus = weg;
}

function rfMastHTML(s) {
  if (!rfMast || rfMast.strecke !== s.id) return '';
  const von = `Von ${rfMast.name} aus: `;
  if (rfMast.ergebnis === null) {
    return `<p class="rf-gelaende rf-laeuft">${escapeHtml(von)}Höhen werden geholt …</p>`;
  }
  const m = rfMast.ergebnis;
  const klasse = m && m.urteil === 'hoeher' ? ' rf-verdeckt'
    : m && m.urteil === 'unbeurteilbar' ? ' rf-unbeurteilbar' : '';
  return `<p class="rf-gelaende${klasse}">${escapeHtml(von + masthoeheText(m, 'der angetippte Ort'))}</p>`;
}

function zwischenHTML(s) {
  if (zwischenStrecke !== s.id) return '';
  if (zwischenLaeuft) {
    return '<p class="rf-gelaende rf-laeuft">Funksicht von beiden Aufbauplätzen wird gerechnet …</p>';
  }
  if (!zwischenBefund) return '';
  return `<p class="rf-gelaende">${escapeHtml(zwischenText(zwischenBefund))}</p>`;
}

/* Die Wahl zeichnet die beiden Teilstrecken als Vorschau in der Farbe der
   Strecke, gestrichelt wie jede Funkstrecke – so sieht man, worüber sie
   laufen, bevor sie etwas in der Planung sind. */
function zwischenWaehlen(k, i, aktualisieren) {
  const s = store.strecke(zwischenStrecke);
  const f = s && funkstrecke(s);
  if (!f) return;
  if (zwischenVorschau) ctx.karte.removeLayer(zwischenVorschau);
  zwischenWahl = i;
  zwischenVorschau = L.polyline([[f.a.lat, f.a.lng], [k.lat, k.lng], [f.b.lat, f.b.lng]], {
    pane: 'fbp-strecken', color: s.farbe, weight: 3, dashArray: '6 6', opacity: 0.9,
    interactive: false
  }).addTo(ctx.karte);
  aktualisieren();
}

/**
 * Aus der Strecke und dem gewählten Zwischenstandort zwei Funkstrecken machen.
 * Die direkte Strecke bleibt stehen: sie zu löschen wäre eine Entscheidung
 * über fremde Planung, und Undo deckt das Anlegen ohnehin ab. Die Angaben der
 * Enden wandern mit – Einheit, Rufname, Antenne –, der Zwischenstandort
 * bekommt die angenommene Masthöhe und sonst leere Felder: wer dort steht,
 * ist noch nicht entschieden.
 */
function teilstreckenAnlegen(s, k, mast) {
  const f = funkstrecke(s);
  if (!f) return;
  let erste = null;
  store.aendern(p => {
    const orig = p.strecken.find(x => x.id === s.id);
    if (!orig) return;
    const idx = p.strecken.indexOf(orig);
    const kopie = o => JSON.parse(JSON.stringify(o));
    const zwischen = () => ({ ...neuerFunkstandort(), platz: 'Zwischenstandort', antennenhoehe: mast });
    const teil = (nr, von, nach, pA, pB, standA, standB) => {
      const t = neueStrecke(p);
      Object.assign(t, {
        name: `${orig.name} – Teil ${nr}`, von, nach, farbe: orig.farbe,
        kabeltyp: 'richtfunk', abschnitt: orig.abschnitt, trupp: orig.trupp,
        punkte: [neuerPunkt(pA.lat, pA.lng), neuerPunkt(pB.lat, pB.lng)],
        richtfunk: { ...kopie(orig.richtfunk), standorte: [standA, standB] }
      });
      return t;
    };
    const st = orig.richtfunk.standorte;
    const t1 = teil(1, orig.von, 'Zwischenstandort', f.a, k, kopie(st[0]), zwischen());
    const t2 = teil(2, 'Zwischenstandort', orig.nach, k, f.b, zwischen(), kopie(st[1]));
    p.strecken.splice(idx + 1, 0, t1, t2);
    erste = t1.id;
  }, 'strecke');
  zwischenWeg();
  if (erste) ctx.sl.waehle(erste);
  hinweis('Zwei Teilstrecken angelegt – die direkte Strecke bleibt stehen, bis du sie löschst.');
}

/* Höhen und Geländeurteil führen sich selbst nach. Das hing vorher an zwei
   Knöpfen, und das war die falsche Frage an den Nutzer: er hat die
   Aufbauplätze gesetzt, damit er weiß, ob die Strecke trägt – nicht, damit er
   danach noch zweimal auslöst.

   Angestoßen wird trotzdem nicht bei jedem Tastendruck. Der Abruf holt Kacheln
   entlang der ganzen Strecke, und beim Ziehen eines Endpunkts liefe er sonst
   je Mausbewegung erneut. Deshalb eine Wartezeit nach der letzten Änderung und
   eine Sperre je Strecke: was schon läuft, wird nicht zweimal angestoßen.

   Der Ablauf ist zweistufig und läuft von selbst aus. Erst fehlen die
   Geländehöhen, sie werden geholt und geschrieben – das baut die Gruppe neu
   auf und stößt einen zweiten Lauf an. Der findet die Höhen vor, holt das
   Profil und legt das Urteil ab, ohne den Zustand anzufassen. Ein dritter Lauf
   findet das Urteil im Zwischenspeicher und tut nichts mehr. */
const HOEHEN_WARTEZEIT = 500;
const gelaendeLaeuft = new Set();
const hoehenStand = new Map();
let gelaendeTimer = null;

/* Wie lange der Abruf dauert, hängt an fremden Diensten: die Höhenkacheln
   kommen in Sekundenbruchteilen, die Gebäudeabfrage bei Overpass braucht über
   einer Stadt auch einmal zwanzig Sekunden. Ein Satz „wird geholt …“ ließ dabei
   offen, ob noch etwas läuft oder etwas hängt, und ein Ausfall war überhaupt
   nicht zu sehen: der Kasten verschwand wieder, und die Strecke stand ohne
   Geländeurteil da, als hätte niemand danach gefragt.

   Der Anteil zählt erledigte Teilschritte und ist keine Zeitschätzung – er
   springt. Gewichtet ist er nach Erfahrung: das Profil braucht die Kacheln
   entlang der Strecke, die Oberfläche drei Dienste nebeneinander, und der
   letzte davon bestimmt die Wartezeit. */
const gelaendeStand = new Map();    // s.id → { anteil, schritt }
const gelaendeFehler = new Map();   // s.id → Meldung, solange der Abruf ausfiel

function standSetzen(s, anteil, schritt, aktualisieren) {
  const alt = gelaendeStand.get(s.id);
  /* Der Balken läuft nie zurück. Die drei Oberflächenquellen melden
     nebeneinander, und ein Anteil, der dabei kurz kleiner wird, liest sich wie
     ein Rückschritt. */
  const wert = Math.max(anteil, alt ? alt.anteil : 0);
  if (alt && alt.anteil === wert && alt.schritt === schritt) return;
  gelaendeStand.set(s.id, { anteil: wert, schritt });
  aktualisieren();
}

function gelaendeFehlgeschlagen(s, meldung) {
  gelaendeStand.delete(s.id);
  gelaendeFehler.set(s.id, meldung);
}

const ortSignatur = f =>
  `${f.a.lat.toFixed(5)},${f.a.lng.toFixed(5)}|${f.b.lat.toFixed(5)},${f.b.lng.toFixed(5)}`;

function gelaendePlanen(s, aktualisieren) {
  if (gelaendeTimer) clearTimeout(gelaendeTimer);
  gelaendeTimer = setTimeout(() => gelaendeNachfuehren(s, aktualisieren), HOEHEN_WARTEZEIT);
}

function gelaendeNachfuehren(s, aktualisieren) {
  const f = funkstrecke(s);
  if (!f || gelaendeLaeuft.has(s.id)) return;
  const ort = ortSignatur(f);

  /* Die Geländehöhe gehört zum Ort, nicht zum Formular: zieht jemand einen
     Aufbauplatz um, ist die alte Höhe falsch und wird ersetzt. Geschrieben
     wird über das übergebene Projekt und nicht über den mitgeschleppten
     Schnappschuss – zwischen Anstoß und Antwort kann die Strecke gelöscht
     worden sein. */
  /* Eine fehlende Geländehöhe stößt den Abruf erneut an – jemand kann das Feld
     geleert haben, ohne den Aufbauplatz zu verschieben. Nach einem gemeldeten
     Ausfall gilt das nicht mehr: der Abruf würde sich sonst alle halbe Sekunde
     selbst wiederholen, solange der Dienst nicht antwortet. Weiter geht es dann
     über den Knopf im Fehlerkasten oder über einen verschobenen Aufbauplatz. */
  const hoeheOffen = f.hoehen.some(h => h.grund === null) && !gelaendeFehler.has(s.id);
  if (hoehenStand.get(s.id) !== ort || hoeheOffen) {
    gelaendeLaeuft.add(s.id);
    gelaendeFehler.delete(s.id);
    standSetzen(s, 0.02, 'Geländehöhen der Aufbauplätze', aktualisieren);
    let da = 0;
    Promise.all([f.a, f.b].map(pt => hoeheAn(pt.lat, pt.lng)
      .finally(() => standSetzen(s, 0.02 + 0.13 * (++da / 2),
        'Geländehöhen der Aufbauplätze', aktualisieren))))
      .then(hoehen => {
        hoehenStand.set(s.id, ort);
        if (hoehen.some(h => h !== null)) {
          store.aendern(p => {
            const st = p.strecken.find(x => x.id === s.id);
            if (!st) return;
            hoehen.forEach((h, i) => {
              if (h !== null) st.richtfunk.standorte[i].hoehe = Math.round(h);
            });
          }, 'strecke');
        }
        /* Ohne beide Geländehöhen steht die Antennenmitte nicht fest, und ohne
           sie ist kein Urteil zu bilden – das ist der Ausfall, nicht erst der
           leere Kachelabruf. Gemeldet wird auch der halbe Fall: eine Strecke,
           deren eines Ende eine Höhe hat und das andere nicht, sähe sonst aus
           wie eine, an der niemand gerechnet hat. */
        const fehlt = hoehen.filter((h, i) => h === null && f.hoehen[i].grund === null).length;
        if (fehlt === 2) {
          gelaendeFehlgeschlagen(s, 'Die Geländehöhen der Aufbauplätze waren nicht zu holen.');
        } else if (fehlt === 1) {
          gelaendeFehlgeschlagen(s, 'Für einen der beiden Aufbauplätze war keine Geländehöhe zu holen.');
        }
      })
      .catch(() => gelaendeFehlgeschlagen(s, 'Die Geländehöhen der Aufbauplätze waren nicht zu holen.'))
      /* Nach einem Ausfall verschwindet der Balken, sonst bleibt er stehen:
         gleich läuft der zweite Durchgang, und ein Balken, der dazwischen für
         eine halbe Sekunde verschwindet, sieht aus wie ein Abbruch. Angestoßen
         wird der zweite Durchgang vom Neuaufbau, den das Schreiben der Höhen
         auslöst – von hier aus ginge er mit dieser Fassung der Strecke los, und
         die hat die eben geholten Höhen noch nicht. */
      .finally(() => {
        gelaendeLaeuft.delete(s.id);
        if (gelaendeFehler.has(s.id)) gelaendeStand.delete(s.id);
        aktualisieren();
      });
    return;
  }

  if (urteilLesen(s) !== undefined) { gelaendeStand.delete(s.id); return; }
  /* Ohne beide Geländehöhen stünde die Antennenmitte auf NaN und das Urteil
     gälte für eine Strecke, die es so nicht gibt. Gemeldet ist der Ausfall an
     dieser Stelle längst – hier bleibt nur, das Profil nicht zu holen. */
  if (f.hoehen.some(h => h.grund === null)) return;
  gelaendeLaeuft.add(s.id);
  gelaendeFehler.delete(s.id);
  standSetzen(s, 0.15, 'Höhenprofil der Strecke', aktualisieren);
  profil(f.a, f.b, 25, (fertig, gesamt) => standSetzen(s, 0.15 + 0.35 * (fertig / gesamt),
    'Höhenprofil der Strecke', aktualisieren))
    /* Erst das Gelände, dann die Oberfläche darauf: die Oberflächenquellen
       brauchen die Stützpunkte, und ohne Geländehöhe wäre eine Hindernishöhe
       über Grund gar nicht zu bilden. Fällt die Ergänzung aus, wird mit dem
       Gelände allein geurteilt – wie vor der Oberflächenschicht, und der
       Vorbehalt sagt es dann auch. */
    .then(async punkte => {
      /* Kein einziger Stützpunkt mit Höhe heißt: die Kacheln sind nicht
         angekommen. Ein Profil aus lauter Lücken zu zeichnen wäre schlimmer als
         keines – es sähe aus wie ebenes Gelände. */
      if (punkte.every(p => p.h === null)) {
        return gelaendeFehlgeschlagen(s, 'Für diese Strecke waren keine Höhen zu holen.');
      }
      let teile = 0;
      standSetzen(s, 0.5, 'Oberfläche: Modell, Gebäude und Bewuchs', aktualisieren);
      const ergaenzt = await oberflaechenprofil(punkte, () =>
        standSetzen(s, 0.5 + 0.45 * (++teile / 3),
          'Oberfläche: Modell, Gebäude und Bewuchs', aktualisieren))
        .catch(() => ({ punkte, dsm: false, gebaeude: false, bewuchs: false }));
      standSetzen(s, 0.95, 'Sichtlinie wird beurteilt', aktualisieren);
      const mitte = f.hoehen.map(h => h.grund + (h.antenne || 0));
      /* Mitgespeichert werden auch die Stützpunkte: das Blatt zeichnet später
         dasselbe Profil und darf dafür nicht nachladen. */
      urteilMerken(s, {
        ...gelaendeurteil(ergaenzt.punkte, mitte[0], mitte[1], f.mhz, ergaenzt),
        profil: ergaenzt.punkte, mitten: mitte, mhz: f.mhz,
        quellen: {
          dsm: ergaenzt.dsm, gebaeude: ergaenzt.gebaeude, bewuchs: ergaenzt.bewuchs
        }
      });
    })
    .catch(() => gelaendeFehlgeschlagen(s, 'Das Höhenprofil der Strecke war nicht zu holen.'))
    .finally(() => { gelaendeLaeuft.delete(s.id); gelaendeStand.delete(s.id); aktualisieren(); });
}

function richtfunkGruppe(s, frisch) {
  const gruppe = el('div', 'feldgruppe');
  const jetzt = funkstrecke(s);
  if (schattenStrecke !== s.id || (jetzt && schattenOrt !== ortSignatur(jetzt))) schattenWeg();
  if (zwischenStrecke !== s.id || (jetzt && zwischenOrt !== ortSignatur(jetzt))) zwischenWeg();
  if (rfMast && (rfMast.strecke !== s.id || (jetzt && rfMast.ort !== ortSignatur(jetzt)))) rfMast = null;
  gruppe.appendChild(el('h3', 'gruppen-titel', 'Richtfunkstrecke (WLAN)'));

  const v = s.richtfunk;
  const ergebnis = el('div', 'rf-ergebnis');
  const spalten = el('div', 'rf-spalten');
  const bandbreiteFeld = () => feld('Bandbreite', v.bandbreite,
    w => schreib(() => { v.bandbreite = Number(w); }, aktualisieren),
    { typ: 'select', werte: bandById(v.band).bandbreiten.map(b => [b, `${b} MHz`]) });

  /* Die Kandidatenliste des Zwischenstandorts hängt am selben Befund wie der
     Ergebniskasten und zieht deshalb mit ihm nach; sie wird erst weiter unten
     gebaut und hängt sich hier ein. */
  let nachErgebnis = () => {};
  const aktualisieren = () => {
    ergebnis.innerHTML = richtfunkErgebnisHTML(s);
    ablesungBinden(ergebnis, s);
    erneutBinden(ergebnis, s, aktualisieren);
    spalten.querySelectorAll('.rf-abgeleitet').forEach((el2, i) => {
      el2.innerHTML = standortAbgeleitetHTML(s, i);
    });
    nachErgebnis();
  };

  // -- Die beiden Aufbauplätze, in der Spaltenordnung des Formulars
  for (const [i, ort] of v.standorte.entries()) {
    const spalte = el('div', 'rf-spalte');
    const titel = (i === 0 ? s.von : s.nach) || `Aufbauplatz ${i === 0 ? 'A' : 'B'}`;
    spalte.appendChild(el('h4', 'rf-spalten-titel', escapeHtml(titel)));

    spalte.appendChild(feld('Einheit', ort.einheit, w => schreib(() => { ort.einheit = w; }),
      { platzhalter: 'z. B. OV Musterstadt' }));
    const kontakt = el('div', 'feld-paar');
    kontakt.append(
      feld('Ansprechpartner', ort.ansprechpartner, w => schreib(() => { ort.ansprechpartner = w; })),
      feld('Erreichbarkeit', ort.erreichbarkeit, w => schreib(() => { ort.erreichbarkeit = w; }),
        { platzhalter: 'Rufnummer' })
    );
    spalte.appendChild(kontakt);
    spalte.appendChild(feld('Rufname', ort.rufname, w => schreib(() => { ort.rufname = w; }),
      { platzhalter: 'z. B. Heros Musterstadt 21' }));
    spalte.appendChild(feld('Aufbauplatz / Adresse', ort.platz,
      w => schreib(() => { ort.platz = w; }), { typ: 'textarea', zeilen: 2 }));
    /* Die Adresse steht schon im Feld – von hier aus den Aufbauplatz auf die
       Karte zu bringen ist ein Knopf, kein zweites Formular. Er geht nach
       außen (Nominatim) und deshalb nur auf Tipp, nie beim Tippen. */
    spalte.appendChild(knopf('Adresse suchen, Platz setzen', () => {
      const text = (ort.platz || '').trim();
      if (!text) return hinweis('Erst eine Adresse oder einen Ortsnamen ins Feld schreiben.');
      ortsDialog(text, tr => {
        store.aendern(p => {
          const st = p.strecken.find(x => x.id === s.id);
          if (!st) return;
          const pt = neuerPunkt(tr.lat, tr.lng);
          if (st.punkte.length === 0) st.punkte.push(pt);
          else if (st.punkte.length === 1) i === 0 ? st.punkte.unshift(pt) : st.punkte.push(pt);
          else {
            const ziel = i === 0 ? st.punkte[0] : st.punkte[st.punkte.length - 1];
            ziel.lat = tr.lat; ziel.lng = tr.lng;
          }
        }, 'strecke');
        ctx.karte.setView([tr.lat, tr.lng], Math.max(ctx.karte.getZoom(), 15));
        hinweis(`${titel} gesetzt: ${trefferKurz(tr)}`);
      });
    }, 'klein'));

    const masse = el('div', 'feld-paar');
    masse.append(
      feld('Höhe über NN', ort.hoehe ?? '',
        w => schreib(() => { ort.hoehe = w === '' ? null : Number(w); }, aktualisieren),
        { typ: 'number', step: 1, einheit: 'm' }),
      feld('Antennenhöhe', ort.antennenhoehe,
        w => schreib(() => { ort.antennenhoehe = w === '' ? null : Number(w); }, aktualisieren),
        { typ: 'number', min: 0, step: 0.5, einheit: 'm' })
    );
    spalte.appendChild(masse);
    /* Gewinn und Zuleitungsdämpfung stehen neben der Antennenhöhe, weil sie
       dieselbe Frage beantworten: was oben am Mast hängt. Beide gehen in die
       EIRP-Prüfung ein, beide bleiben leer, solange niemand das Datenblatt
       aufgeschlagen hat. */
    const leistung = el('div', 'feld-paar');
    leistung.append(
      feld('Antennengewinn', ort.antennengewinn ?? '',
        w => schreib(() => { ort.antennengewinn = w === '' ? null : Number(w); }, aktualisieren),
        { typ: 'number', step: 0.5, einheit: 'dBi', platzhalter: 'lt. Datenblatt' }),
      feld('Zuleitungsdämpfung', ort.kabeldaempfung ?? '',
        w => schreib(() => { ort.kabeldaempfung = w === '' ? null : Number(w); }, aktualisieren),
        { typ: 'number', min: 0, step: 0.5, einheit: 'dB' })
    );
    spalte.appendChild(leistung);
    spalte.appendChild(feld('Neigung (Elevation)', ort.neigung,
      w => schreib(() => { ort.neigung = w; })));

    const abgeleitet = el('div', 'rf-abgeleitet');
    spalte.appendChild(abgeleitet);
    spalten.appendChild(spalte);
  }
  gruppe.appendChild(spalten);

  /* Höhen und Geländeurteil laufen von selbst, sobald beide Aufbauplätze
     stehen: es war ein Formular mit zwei Knöpfen, die man drücken musste, um
     die Angaben zu bekommen, die man ohnehin wollte. Nicht bei jedem
     Tastendruck – die Nachführung hängt an der Geometrie und wird abgewartet
     (siehe gelaendePlanen). */
  const tastenreihe = el('div', 'tastenreihe');

  /* Die Funksichtfläche ist ein Blick, kein Planungsinhalt: sie wird angestoßen,
     angesehen und wieder weggenommen. Deshalb kein Dialog, keine Farbwahl und
     keine Liste – Standort und Antennenhöhe stehen ohnehin schon in der Spalte
     darüber. Gespeichert wird nichts: eine Fläche, die eine Planung überdauert,
     wäre irgendwann für eine andere Masthöhe gerechnet als die, die danebensteht.

     Beide Enden bekommen eine eigene Taste. Gefragt ist nicht nur, wohin Platz A
     kommt: liegt eine Strecke schief, entscheidet sich am Gegenende, ob der
     Mast dort ein paar hundert Meter weiter besser steht – und das sieht man
     nur an dessen eigener Fläche. Sichtbar bleibt trotzdem immer nur eine.
     Zwei übereinander wären nicht zu unterscheiden, beide sind dasselbe
     Violett, und der Satz daneben könnte nur für eine von beiden gelten. */
  const plaetze = [0, 1].map(i => (i === 0 ? s.von : s.nach) ||
    `Platz ${i === 0 ? 'A' : 'B'}`);
  const tasten = [];

  const tastenNachziehen = () => tasten.forEach((t, i) => {
    t.disabled = false;
    t.textContent = schattenPlatz === i
      ? `${plaetze[i]} ausblenden`
      : `Funksicht von ${plaetze[i]}`;
    t.classList.toggle('an', schattenPlatz === i);
  });

  const funksichtZeigen = i => {
    const f = funkstrecke(s);
    if (!f) return hinweis('Erst beide Aufbauplätze auf der Karte setzen.');
    const war = schattenPlatz;
    schattenWeg();
    if (war === i) return (tastenNachziehen(), aktualisieren());
    tasten.forEach(t => { t.disabled = true; });
    tasten[i].textContent = 'Höhen werden geholt …';
    const ort = i === 0 ? f.a : f.b;
    /* Gerechnet wird mit der Antennenhöhe dieses Endes, und dieselbe Höhe gilt
       als Annahme für das Gegenüber: eine Fläche, in der man mit 3 m stünde,
       sagt einem Mast von 10 m nichts. */
    const hoch = Number(s.richtfunk.standorte[i].antennenhoehe) || 3;
    const weite = schattenUmkreis;
    funksicht(ort, hoch, f.mhz, weite, hoch).then(e => {
      if (!e) return hinweis('Für diesen Umkreis liegen keine Höhen vor.', 'fehler');
      schattenEbene = zeichneFunksicht(ctx.karte, e);
      schattenBefund = e;
      schattenPlatz = i;
      schattenName = plaetze[i];
      schattenStrecke = s.id;
      schattenOrt = ortSignatur(f);
      aktualisieren();
    }).catch(() => hinweis('Die Höhendaten waren nicht zu erreichen.', 'fehler'))
      .finally(() => { tastenNachziehen(); aktualisieren(); });
  };

  /* Der Umkreis ist ein Regler und kein Zahlenfeld: „wie weit komme ich von
     hier“ beantwortet man, indem man schiebt und zusieht, nicht indem man
     8000 tippt. Er steht über den Tasten, weil er für beide Enden gilt.

     Gerechnet wird beim Loslassen, nicht beim Schieben – jeder Zwischenwert
     wäre ein eigener Kachelabruf. Und er sagt an, was er kostet: der Abruf
     wächst mit dem Quadrat der Weite, 30 km sind über hundert Kacheln. Diese
     Zahl steht am Regler, damit niemand in eine Wartezeit läuft, deren Grund
     er nicht sieht. */
  const umkreisZeile = el('div', 'rf-umkreis');
  umkreisZeile.appendChild(el('span', 'rf-umkreis-titel', 'Umkreis'));
  const regler = document.createElement('input');
  regler.type = 'range';
  regler.min = 1; regler.max = Math.round(UMKREIS_HOECHSTENS / 1000); regler.step = 1;
  regler.value = Math.round(schattenUmkreis / 1000);
  regler.setAttribute('aria-label', 'Umkreis der Funksicht in Kilometern');
  const umkreisWert = el('b', 'rf-umkreis-wert');
  const umkreisFuss = el('p', 'rf-umkreis-fuss');
  const weiteNachziehen = () => {
    umkreisWert.textContent = `${Math.round(schattenUmkreis / 1000)} km`;
    const f = funkstrecke(s);
    const kacheln = f ? kachelbedarf(f.a.lat, schattenUmkreis) : 0;
    umkreisFuss.textContent = kacheln > 25
      ? `Rund ${kacheln} Höhenkacheln – der Abruf dauert entsprechend.` : '';
  };
  regler.addEventListener('input', () => {
    schattenUmkreis = Number(regler.value) * 1000;
    weiteNachziehen();
  });
  /* Steht schon eine Fläche, wird sie mit der neuen Weite neu gerechnet: eine
     stehengebliebene Fläche neben einem verschobenen Regler behauptete einen
     Umkreis, für den sie nicht gilt. */
  regler.addEventListener('change', () => {
    if (schattenPlatz !== null) {
      const i = schattenPlatz;
      schattenWeg(); tastenNachziehen();
      funksichtZeigen(i);
    }
  });
  umkreisZeile.append(regler, umkreisWert);
  weiteNachziehen();

  for (const i of [0, 1]) {
    const t = knopf('', () => funksichtZeigen(i), 'klein');
    tasten.push(t);
    tastenreihe.appendChild(t);
  }
  tastenNachziehen();
  gruppe.append(umkreisZeile, umkreisFuss, tastenreihe);

  /* Zwei weitere Fragen an dasselbe Höhenmodell. „Masthöhe bis hierhin“
     beantwortet, was die Funksicht nur färbt: wie viel Mast fehlt, damit ein
     bestimmter Ort frei wird – gerechnet auf dem Profil und mit dem Freiraum
     der Richtfunkplanung. „Zwischenstandort suchen“ ist die Frage danach, wenn
     kein Mast mehr reicht: von wo aus sind beide Enden frei. Beide stehen
     immer da, nicht erst nach einem verdeckten Urteil – auch eine knappe
     Strecke will wissen, wo der Mast besser stünde. */
  const fragen = el('div', 'tastenreihe');
  const mastTaste = knopf('Masthöhe bis hierhin', () => {
    const f = funkstrecke(s);
    if (!f) return hinweis('Erst beide Aufbauplätze auf der Karte setzen.');
    /* Gefragt wird vom Ende aus, dessen Fläche gerade liegt – sonst von A. */
    const i = schattenPlatz === null ? 0 : schattenPlatz;
    if (f.hoehen[i].grund === null) {
      return hinweis('Für diesen Aufbauplatz fehlt noch die Geländehöhe.', 'warnung');
    }
    hinweis(`Auf der Karte antippen, wohin die Sicht von ${plaetze[i]} reichen soll.`);
    mastTaste.classList.add('an');
    rfZielwahl(ziel => {
      mastTaste.classList.remove('an');
      hinweisAus();
      rfMast = { strecke: s.id, platz: i, name: plaetze[i], ziel, ergebnis: null, ort: ortSignatur(f) };
      aktualisieren();
      const hoch = Number(s.richtfunk.standorte[i].antennenhoehe) || 3;
      const gegen = Number(s.richtfunk.standorte[1 - i].antennenhoehe) || 3;
      noetigeMasthoehe(i === 0 ? f.a : f.b, ziel, f.mhz, hoch, gegen, { freiraum: true })
        .then(m => { if (rfMast && rfMast.ziel === ziel) rfMast.ergebnis = m; })
        .catch(() => { rfMast = null; hinweis('Die Höhendaten waren nicht zu erreichen.', 'fehler'); })
        .finally(aktualisieren);
    });
  }, 'klein');
  const zwischenTaste = knopf('', () => {
    if (zwischenStrecke === s.id && (zwischenBefund || zwischenLaeuft)) {
      zwischenWeg(); zwischenNachziehen(); aktualisieren();
      return;
    }
    const f = funkstrecke(s);
    if (!f) return hinweis('Erst beide Aufbauplätze auf der Karte setzen.');
    const hA = Number(s.richtfunk.standorte[0].antennenhoehe) || 3;
    const hB = Number(s.richtfunk.standorte[1].antennenhoehe) || 3;
    /* Der dritte Mast wird so hoch angenommen wie der höhere der beiden
       Enden: das ist das Gerät, das der Trupp ohnehin dabeihat. */
    const mast = Math.max(hA, hB);
    zwischenWeg();
    zwischenStrecke = s.id; zwischenOrt = ortSignatur(f); zwischenLaeuft = true;
    zwischenNachziehen(); aktualisieren();
    zwischenstandorte(f.a, hA, f.b, hB, f.mhz, mast).then(e => {
      zwischenLaeuft = false;
      if (zwischenStrecke !== s.id) return;
      zwischenBefund = e;
      if (e && e.zellen) {
        zwischenEbene = zeichneZwischenraum(ctx.karte, e,
          (k, i) => zwischenWaehlen(k, i, aktualisieren));
      }
    }).catch(() => {
      zwischenLaeuft = false;
      zwischenWeg();
      hinweis('Die Höhendaten waren nicht zu erreichen.', 'fehler');
    }).finally(() => { zwischenNachziehen(); aktualisieren(); });
  }, 'klein');
  const zwischenNachziehen = () => {
    const an = zwischenStrecke === s.id && (zwischenBefund || zwischenLaeuft);
    zwischenTaste.textContent = zwischenLaeuft && an ? 'Höhen werden geholt …'
      : an ? 'Zwischenstandort ausblenden' : 'Zwischenstandort suchen';
    zwischenTaste.classList.toggle('an', !!an);
    zwischenTaste.disabled = !!(zwischenLaeuft && an);
  };
  zwischenNachziehen();
  fragen.append(mastTaste, zwischenTaste);
  gruppe.appendChild(fragen);

  /* Die Kandidatenliste steht unter den Tasten und nicht im Ergebniskasten:
     sie hat Knöpfe, und der Kasten wird als HTML neu gesetzt. */
  const kandidatenListe = el('div', 'rf-kandidaten');
  const kandidatenNachziehen = () => {
    kandidatenListe.innerHTML = '';
    if (zwischenStrecke !== s.id || !zwischenBefund || !zwischenBefund.kandidaten.length) return;
    zwischenBefund.kandidaten.forEach((k, i) => {
      const zeile = el('button', 'rf-kandidat' + (zwischenWahl === i ? ' an' : ''));
      zeile.type = 'button';
      zeile.innerHTML = `<span class="rf-kandidat-nr">${i + 1}</span>` +
        `<span>${escapeHtml(kandidatText(k))}</span>`;
      zeile.onclick = () => zwischenWaehlen(k, i, aktualisieren);
      kandidatenListe.appendChild(zeile);
    });
    if (zwischenWahl !== null && zwischenBefund.kandidaten[zwischenWahl]) {
      const k = zwischenBefund.kandidaten[zwischenWahl];
      kandidatenListe.appendChild(knopf(`Kandidat ${zwischenWahl + 1} als zwei Teilstrecken anlegen`,
        () => teilstreckenAnlegen(s, k, zwischenBefund.mast), 'klein rf-anlegen'));
    }
  };
  gruppe.appendChild(kandidatenListe);
  nachErgebnis = kandidatenNachziehen;

  // -- Was für die Strecke als Ganzes gilt
  const betrieb = el('div', 'feld-paar');
  betrieb.append(
    feld('Betriebsbereit bis', v.betriebsbereit, w => schreib(() => { v.betriebsbereit = w; }),
      { platzhalter: 'z. B. 200800jun24' }),
    feld('Betriebszeit', v.betriebszeit, w => schreib(() => { v.betriebszeit = w; }),
      { platzhalter: 'z. B. rund um die Uhr' })
  );
  gruppe.appendChild(betrieb);

  const geraet = el('div', 'feld-paar');
  geraet.append(
    feld('Typ Access Point', v.accesspoint, w => schreib(() => { v.accesspoint = w; }),
      { platzhalter: 'z. B. LANCOM OAP 1702B' }),
    feld('Typ Antenne', v.antenne, w => schreib(() => { v.antenne = w; }),
      { platzhalter: 'z. B. 9° Sektor' })
  );
  gruppe.appendChild(geraet);

  /* Sendeleistung und TPC gelten für die Strecke: beide Enden werden gleich
     eingestellt. Ohne TPC verlangt die Zuteilung 3 dB weniger – das ist keine
     Feinheit, sondern die Hälfte der Leistung, und es steht deshalb als
     eigenes Feld da statt in einer Fußnote. */
  const leistungStrecke = el('div', 'feld-paar');
  leistungStrecke.append(
    feld('Sendeleistung am Gerät', v.sendeleistung ?? '',
      w => schreib(() => { v.sendeleistung = w === '' ? null : Number(w); }, aktualisieren),
      { typ: 'number', step: 1, einheit: 'dBm', platzhalter: 'z. B. 20' }),
    feld('Leistungsregelung (TPC)', v.tpc ? 'ja' : 'nein',
      w => schreib(() => { v.tpc = w === 'ja'; }, aktualisieren),
      { typ: 'select', werte: [['ja', 'vorhanden'], ['nein', 'nicht vorhanden']] })
  );
  gruppe.appendChild(leistungStrecke);

  /* Nicht jedes Band kennt jede Bandbreite. Der Bandwechsel baut das
     Bandbreitenfeld deshalb neu und rückt den Wert mit – sonst stünde nach
     dem Wechsel auf 2,4 GHz dort eine Bandbreite, die es dort nicht gibt. */
  const funkA = el('div', 'feld-dreier');
  const bandbreite = bandbreiteFeld();
  funkA.append(
    feld('Frequenzband', v.band, w => {
      store.aendern(() => {
        v.band = w;
        v.bandbreite = gueltigeBandbreite(w, v.bandbreite);
      }, 'strecke');
    }, { typ: 'select', werte: FREQUENZBAENDER.map(b => [b.id, b.name]) }),
    bandbreite,
    feld('Kanal Strecke', v.kanal, w => schreib(() => { v.kanal = w; }), { platzhalter: 'z. B. 44' })
  );
  gruppe.appendChild(funkA);

  const funkB = el('div', 'feld-dreier');
  funkB.append(
    feld('MIMO', v.mimo, w => schreib(() => { v.mimo = w; }, aktualisieren),
      { typ: 'select', werte: MIMO_ARTEN.map(m => [m.id, m.name]) }),
    feld('Polarisation', v.polarisation, w => schreib(() => { v.polarisation = w; }),
      { typ: 'select', werte: POLARISATIONEN.map(pl => [pl.id, pl.name]) }),
    feld('Modulation', v.modulation, w => schreib(() => { v.modulation = w; }, aktualisieren),
      { typ: 'select', werte: MODULATIONEN.map(m => [m.id, m.name]) })
  );
  gruppe.appendChild(funkB);

  gruppe.appendChild(feld('Kommentar', v.kommentar, w => schreib(() => { v.kommentar = w; }),
    { typ: 'textarea', zeilen: 2 }));

  aktualisieren();
  gruppe.appendChild(ergebnis);
  gelaendePlanen(s, aktualisieren);
  return { gruppe, aktualisieren };
}

/** Koordinate, Abstrahlrichtung und Antennenmitte eines Aufbauplatzes –
 *  alles gerechnet, nichts davon einzutragen. */
function standortAbgeleitetHTML(s, i) {
  const f = funkstrecke(s);
  if (!f) return '<p class="rf-leer">Noch nicht auf der Karte gesetzt.</p>';
  const pt = i === 0 ? f.a : f.b;
  const zeilen = [
    ['Koordinate', toMGRS(pt.lat, pt.lng, 5)],
    ['Abstrahlrichtung', azimutText(f.azimut[i], f.richtung[i])],
    /* Am Aufbauplatz liegt eine Bussole, keine Nordreferenz: ohne die
       missweisende Peilung ist die rechtweisende dort nicht zu gebrauchen.
       Beide stehen mit Kürzel da, weil eine nackte Gradzahl in einem Werkzeug,
       das drei Norde kennt, eine Falle wäre. */
    ['Peilung', peilungText(f.peilungen[i])]
  ];
  if (f.hoehen[i].grund !== null) {
    zeilen.push(['Antenne über NN', meter(f.hoehen[i].grund + (f.hoehen[i].antenne || 0))]);
  }
  return zeilen.map(([t, w]) =>
    `<span><i>${t}</i><b>${escapeHtml(w)}</b></span>`).join('');
}

function richtfunkErgebnisHTML(s) {
  const f = funkstrecke(s);
  const v = s.richtfunk;
  if (!f) {
    return `<p class="se-leer">Beide Aufbauplätze auf der Karte setzen – daraus ergeben
            sich Distanz und Abstrahlrichtung der Strecke.</p>`;
  }
  const zeilen = [
    ['Distanz (Luftlinie)', formatLaenge(f.distanz)],
    ['Frequenz / Bandbreite', `${bandById(v.band).kurz} · ${v.bandbreite} MHz`],
    /* Die Mindesthöhe ist die eine Zahl, die ohne jede Höhenkachel belastbar
       ist: sie entscheidet am Kartentisch zwischen Dreibein und Teleskopmast. */
    ['Antennenhöhe mindestens', meterText(f.mindesthoehe.hoehe)],
    ['Höhenunterschied', f.hoehenunterschied === null
      ? 'Geländehöhen fehlen' : meter(Math.abs(f.hoehenunterschied))]
  ];
  if (f.neigung) zeilen.push(['Neigung rechnerisch', f.neigung.satz.split('.')[0] + '.']);

  return `<div class="se-kopf">
      <span class="se-titel">Datenrate der Funkschnittstelle</span>
      <b class="se-wert">${escapeHtml(datenrateText(v))}</b>
    </div>
    <div class="se-zeilen">${zeilen.map(([t, w]) =>
      `<span><i>${t}</i><b>${escapeHtml(w)}</b></span>`).join('')}</div>
    ${bandHinweisHTML(v)}
    ${eirpHTML(s, f)}
    ${gelaendeHTML(s)}
    ${schattenHTML()}
    ${rfMastHTML(s)}
    ${zwischenHTML(s)}
    <p class="se-fuss">Bruttorate der Funkschnittstelle bei höchstem Modulationsschema –
       nicht der Durchsatz über die Strecke. Die Mindesthöhe gilt über ebenem, freiem
       Gelände; sie ist eine untere Schranke, keine Zusage.</p>`;
}

/* Ein Band, das eine ortsfeste Strecke im Freien nicht trägt, ist kein
   Randfall, sondern der häufigste Planungsfehler: 6 GHz und 5250–5350 MHz
   stehen im Gerät zur Wahl und sind draußen unzulässig. Der Hinweis steht
   deshalb über der Leistungsrechnung – wer erst die Leistung einstellt und
   dann das Band verwirft, hat zweimal gerechnet. */
function bandHinweisHTML(v) {
  const b = regelBandById(v.band);
  if (!b || b.ortsfestDraussen) return '';
  return `<p class="rf-auflage"><b>Im Freien nicht zulässig.</b>
    ${escapeHtml(b.ausschluss || b.auflagen[0] || '')}
    <span class="rf-fundstelle">${escapeHtml(b.fundstelle)}</span></p>`;
}

/* Die EIRP-Grenze bindet schärfer, als sie aussieht: sie gilt einschließlich
   Antennengewinn, und bei MIMO zählt die Summe über alle Ketten. Ausgegeben
   wird deshalb nicht nur „passt/passt nicht“, sondern die Zahl, die am Gerät
   eingestellt wird – alles andere müsste der Planer selbst zurückrechnen. */
function eirpHTML(s, f) {
  const v = s.richtfunk;
  const o = v.standorte;
  const gewinn = o.map(x => x.antennengewinn).find(x => x !== null && x !== '');
  const p = eirpPruefung({
    band: v.band, sendeleistung: v.sendeleistung,
    antennengewinn: gewinn, kabeldaempfung: o[0].kabeldaempfung,
    bandbreite: v.bandbreite, ketten: mimoById(v.mimo).streams, tpc: v.tpc
  });
  if (!p) return '';
  const kopf = p.passt
    ? `<b>${escapeHtml(eirpLeistungText(p.eirp))} EIRP</b> – innerhalb der Grenze
       von ${escapeHtml(eirpLeistungText(p.grenze))}.`
    : `<b>${escapeHtml(eirpLeistungText(p.eirp))} EIRP – ${escapeHtml(abstandText(p.ueber))}
       über der Grenze</b> von
       ${escapeHtml(eirpLeistungText(p.grenze))}. Sendeleistung höchstens
       ${escapeHtml(eirpLeistungText(p.hoechstSendeleistung))}.`;
  return `<p class="rf-auflage${p.passt ? '' : ' rf-ueber'}">${kopf}
    <span class="rf-fundstelle">${escapeHtml(eirpMassgebendText(p))} · ${escapeHtml(p.fundstelle)}</span></p>`;
}

/* Das Geländeurteil erscheint erst, wenn es geholt wurde – und es spricht nur
   in eine Richtung. „Kein Hindernis“ ist keine Freigabe: Bewuchs und Bebauung
   stehen in diesen Höhen nicht. Der Vorbehalt steht deshalb im Satz selbst
   (funkrechnung.js), nicht als Fußnote darunter. */
function gelaendeHTML(s) {
  /* Ein Ausfall geht dem Urteil vor: das alte Urteil kann von einem früheren
     Ort stammen, und ein Balken, der nach einem Abbruch weiterläuft, verspricht
     etwas, das nicht mehr kommt. */
  const fehler = gelaendeFehler.get(s.id);
  if (fehler) return gelaendeFehlerHTML(fehler);
  /* Solange geholt wird, steht das auch da. Ein Kasten, der sich nach ein paar
     Sekunden stillschweigend um einen Absatz erweitert, wirkt wie ein Fehler. */
  const stand = gelaendeStand.get(s.id);
  if (stand) return gelaendeFortschrittHTML(stand);
  const u = urteilLesen(s);
  if (u === undefined) return '';
  if (u === null) return '<p class="rf-gelaende">Das Gelände ließ sich nicht beurteilen.</p>';
  return `${profilBildHTML(u)}
    <p class="rf-gelaende rf-${escapeHtml(u.urteil)}">${escapeHtml(u.satz)}</p>
    ${engstelleHTML(u)}`;
}

/* Der Fortschritt in Worten und als Balken. Beides zusammen, weil beides etwas
   anderes beantwortet: der Balken, ob überhaupt etwas vorangeht, der Schritt,
   worauf gerade gewartet wird – bleibt die Anzeige bei „Gebäude und Bewuchs“
   stehen, liegt es an Overpass und nicht am Gerät. Die Zahl steht groß daneben,
   weil am Kartentisch aus zwei Metern Abstand auf den Schirm gesehen wird.
   Der Balken selbst trägt kein aria-live: er würde bei jeder Kachel vorlesen. */
function gelaendeFortschrittHTML(stand) {
  const v = Math.round(stand.anteil * 100);
  return `<div class="rf-gelaende rf-laeuft">
    <p class="rf-laeuft-kopf"><span>Gelände- und Oberflächenhöhen werden geholt …</span>
      <b>${v} %</b></p>
    <div class="rf-balken" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${v}" aria-valuetext="${v} % – ${escapeHtml(stand.schritt)}"
      ><i style="width:${v}%"></i></div>
    <p class="rf-laeuft-schritt">${escapeHtml(stand.schritt)}</p>
  </div>`;
}

/* Was der Kasten nach einem Ausfall sagen muss, ist nicht „Fehler“, sondern
   woran es lag und was jetzt gilt: die Strecke rechnet weiter, nur das Gelände
   ist unbeurteilt. Der Knopf steht dabei, weil der Ausfall meistens der Dienst
   ist und der zweite Versuch kurz darauf durchgeht. */
function gelaendeFehlerHTML(meldung) {
  return `<div class="rf-gelaende rf-fehlgeschlagen" role="status">
    <p class="rf-fehler-text">${escapeHtml(meldung)}</p>
    <p class="rf-fehler-fuss">Höhen und Oberfläche kommen von fremden Diensten – ohne
      Netzverbindung oder bei deren Überlastung bleibt das Gelände unbeurteilt. Die
      übrigen Werte der Strecke sind davon nicht berührt.</p>
    <button type="button" class="knopf klein" data-gelaende-erneut>Erneut versuchen</button>
  </div>`;
}

/* Die knappste Stelle in Zahlen – das, was der Satz oben in Worte fasst. Sie
   steht auch dann da, wenn die Strecke unauffällig ist: „wie knapp ist knapp“
   entscheidet, ob man den Mast eine Stufe höher stellt, und das ist am
   Kartentisch die eigentliche Frage. Der Abstand zur Fresnelzone kann negativ
   sein; dann ragt die Oberfläche hinein, ohne die Sichtlinie zu berühren. */
function engstelleHTML(u) {
  const e = u && u.engste;
  if (!e || !isFinite(e.abstandSichtlinie)) return '';
  const anteil = u.freiraumAnteil === null ? null : Math.round(u.freiraumAnteil * 100);
  /* Steht die Oberfläche über der Sichtlinie, ist der Anteil der Fresnelzone
     keine Aussage mehr – er wäre negativ und läse sich wie ein Maß. Dann sagt
     die Zeile nur noch, wie weit darüber. */
  const daneben = e.abstandSichtlinie < 0;
  const teile = [
    `knappste Stelle ${formatLaenge(e.d, true)}`,
    `Oberfläche ${meterText(e.hoehe)}`,
    `${meterText(Math.abs(e.abstandSichtlinie))} ${daneben ? 'über' : 'unter'} der Sichtlinie`,
    daneben || anteil === null ? null : `erste Fresnelzone zu ${anteil} % frei`
  ].filter(Boolean);
  return `<p class="rf-engstelle">${escapeHtml(teile.join(' · '))}</p>`;
}

/* Das Bild steht über dem Satz, nicht darunter: es zeigt, worauf der Satz
   beruht, und wer das Urteil liest, hat den Schnitt dann schon gesehen. Die
   Engstelle wird nur eingezeichnet, wenn sie auch gemeldet wird – sonst stünde
   eine Marke an der knappsten Stelle einer Strecke, die frei ist. */
function profilBildHTML(u) {
  if (!u.profil) return '';
  const svg = profilSVG(u.profil, u.mitten[0], u.mitten[1], u.mhz,
    { engste: u.urteil === 'verdeckt' ? u.engste : null, schirm: true });
  if (!svg) return '';
  /* Die Ablesezeile steht zwischen Bild und Erklärung und trägt im Ruhezustand
     den Hinweis, dass es sie gibt – ein leeres Feld, das erst beim Überfahren
     etwas anzeigt, findet niemand. */
  /* aria-live, weil die Zeile die Antwort des Bildes ist: wer mit den
     Pfeiltasten durch das Profil geht, hört den Wert sonst nie. Sie ändert
     sich nur auf eine Handlung hin, wird also kein Dauerton. */
  return `<figure class="hp-bild">${svg}
    <p class="hp-ablesung" data-ablesung aria-live="polite"><span class="hp-ruhe">Zum Ablesen
      über das Profil fahren oder mit den Pfeiltasten gehen.</span></p>
    ${profilLegendeHTML()}
    <figcaption>${escapeHtml(profilVorbehalt(u.profil, u.quellen))}</figcaption></figure>`;
}

/* Der zweite Versuch nach einem Ausfall. Er beginnt beim Anfang und nicht beim
   Rest: der gemerkte Ort wird vergessen, damit auch die Geländehöhen der
   Aufbauplätze neu geholt werden – wer den Knopf drückt, hat den ganzen Abruf
   gemeint. Gebunden wird wie das Ablesen nach jedem Neuaufbau der Anzeige. */
function erneutBinden(wurzel, s, aktualisieren) {
  const knopf = wurzel.querySelector('[data-gelaende-erneut]');
  if (!knopf) return;
  knopf.addEventListener('click', () => {
    gelaendeFehler.delete(s.id);
    hoehenStand.delete(s.id);
    kachelfehlerVergessen();
    gelaendeNachfuehren(s, aktualisieren);
  });
}

/* Das Ablesen am Profil. Am Kartentisch wird auf eine Stelle gezeigt und
   gefragt „was steht da“ – bisher konnte das Bild darauf nicht antworten, weil
   es eine reine Zeichenkette ist. Die Zahlen kommen deshalb nicht aus dem SVG,
   sondern aus denselben Stützpunkten, aus denen es gezeichnet wurde; das Bild
   liefert nur die Umrechnung von der Zeigerstelle in eine Entfernung.

   Gebunden wird nach jedem Neuaufbau der Ergebnisanzeige – sie wird über
   innerHTML ersetzt, und damit sind alte Ereignisbindungen ohnehin fort. */
function ablesungBinden(wurzel, s) {
  const u = urteilLesen(s);
  const svg = wurzel.querySelector('.hp-bild .hp-svg');
  const zeile = wurzel.querySelector('[data-ablesung]');
  if (!svg || !zeile || !u || !u.profil) return;

  const punkte = u.profil.filter(p => isFinite(p.h));
  if (punkte.length < 2) return;
  const x0 = Number(svg.dataset.x0), x1 = Number(svg.dataset.x1);
  const D = Number(svg.dataset.d);
  const zeiger = svg.querySelector('.hp-zeiger');
  const ruhe = zeile.innerHTML;
  if (!(D > 0) || !(x1 > x0)) return;

  /* Ein Stützpunkt, eine Anzeige – Zeiger und Tastatur laufen beide hier
     hinein und unterscheiden sich nur darin, wie sie den Punkt finden. */
  let stelle = -1;
  const anStelle = i => {
    stelle = Math.min(punkte.length - 1, Math.max(0, i));
    const p = punkte[stelle];
    if (zeiger) {
      const x = x0 + p.d / D * (x1 - x0);
      zeiger.setAttribute('x1', x); zeiger.setAttribute('x2', x);
      zeiger.hidden = false;
    }
    zeile.innerHTML = ablesungHTML(p);
  };

  const zeigen = ev => {
    const kasten = svg.getBoundingClientRect();
    if (!kasten.width) return;
    /* Von Bildschirmpixeln in die Maße des viewBox. Das Bild füllt seine
       Breite und behält sein Seitenverhältnis, deshalb genügt ein Faktor. */
    const xv = (ev.clientX - kasten.left) * (svg.viewBox.baseVal.width / kasten.width);
    const d = Math.min(D, Math.max(0, (xv - x0) / (x1 - x0) * D));
    let nah = 0;
    punkte.forEach((p, i) => { if (Math.abs(p.d - d) < Math.abs(punkte[nah].d - d)) nah = i; });
    anStelle(nah);
  };
  const ruhen = () => { stelle = -1; if (zeiger) zeiger.hidden = true; zeile.innerHTML = ruhe; };

  /* Zeigerereignisse statt Mausereignisse: auf dem Tablett am Kartentisch wird
     mit dem Finger gezeigt, und `pointer` deckt beides ab. */
  svg.addEventListener('pointermove', zeigen);
  svg.addEventListener('pointerdown', zeigen);
  svg.addEventListener('pointerleave', ruhen);

  /* Derselbe Weg ohne Zeiger. Am Kartentisch wird gezeigt, am Schreibtisch
     aber auch mit der Tastatur gearbeitet – und wer keine Maus führen kann,
     kam an die Höhen entlang der Strecke bisher gar nicht heran. Die
     Pfeiltasten gehen von Stützpunkt zu Stützpunkt, Umschalt springt in
     Zehnerschritten über die 260 Punkte eines langen Profils. */
  svg.tabIndex = 0;
  svg.addEventListener('keydown', e => {
    const weite = e.shiftKey ? 10 : 1;
    const schritt = { ArrowRight: weite, ArrowLeft: -weite };
    if (e.key === 'Home') { e.preventDefault(); return anStelle(0); }
    if (e.key === 'End') { e.preventDefault(); return anStelle(punkte.length - 1); }
    if (!(e.key in schritt)) return;
    e.preventDefault();
    anStelle(stelle < 0 ? (schritt[e.key] > 0 ? 0 : punkte.length - 1) : stelle + schritt[e.key]);
  });
  svg.addEventListener('blur', ruhen);
}

/* Was an einem Stützpunkt abzulesen ist. Die Herkunft steht dabei, und wo
   nichts über dem Boden bekannt ist, steht das ausdrücklich – „0 m Hindernis“
   wäre an dieser Stelle eine Behauptung. */
function ablesungHTML(p) {
  const teile = [
    `Entfernung <b>${escapeHtml(formatLaenge(p.d, true))}</b>`,
    `Gelände <b>${escapeHtml(meterText(p.h))}</b>`
  ];
  if (isFinite(p.oberflaeche)) {
    teile.push(`Oberfläche <b>${escapeHtml(meterText(p.oberflaeche))}</b>`);
    teile.push(`Hindernis über Gelände <b>${escapeHtml(meterText(p.hindernis))}</b>` +
      (p.hindernis > 0.05
        ? ` (${escapeHtml(ARTTEXT[p.art] || '')}, ${escapeHtml(QUELLTEXT[p.quelle] || '')})`
        : ''));
  } else {
    teile.push('Oberflächendaten: <b>nicht verfügbar</b>');
  }
  if (p.gebaeudeOhneHoehe) teile.push('hier steht ein <b>Gebäude ohne Höhenangabe</b>');
  return teile.join(' · ');
}

/* Die Vorschrift nennt für die Sprechreichweite eine Erfahrungsspanne, keinen
   gerechneten Wert (KatS-Dv 861, 3.2). Deshalb „etwa“, deshalb runde Kilometer
   und deshalb drei Tonlagen statt einer Zahl. */
const kmSpanne = (min, max) => `${Math.round(min / 1000)}–${Math.round(max / 1000)} km`;

function reichweiteHTML(r) {
  if (!r) return '';
  const spanne = 'etwa ' + kmSpanne(r.min, r.max);
  const bedarf = formatLaenge(r.laenge, true);

  /* Im Hochbau ist der Hochbau kein Ausweg mehr; dann bleibt nur die
     Vermittlung. */
  const rat = r.bauart === 'Hochbau'
    ? 'Eine Vermittlung zwischenschalten.'
    : 'Hochbau vorsehen oder eine Vermittlung zwischenschalten.';

  const satz = r.stufe === 'darueber'
    ? `Kabelbedarf ${bedarf} überschreitet die Sprechreichweite des ${r.bauart}s (${spanne}). ${rat}`
    : `Sprechreichweite ${r.bauart}: ${spanne}. Kabelbedarf ${bedarf} liegt ` +
      (r.stufe === 'grenze' ? 'im Grenzbereich.' : 'darunter.');

  const fuss = [];
  if (r.gemischt) fuss.push('Bei gemischtem Bau ist der Tiefbau angesetzt.');
  fuss.push(fundstelleText(r));

  return `<p class="rw-satz">${escapeHtml(satz)}</p>
          <p class="rw-fuss">${escapeHtml(fuss.join(' · '))}</p>`;
}

function farbwahl(s, karte) {
  const wrap = el('div', 'feld');
  wrap.appendChild(el('span', 'feld-titel', 'Farbe auf der Karte'));
  const reihe = el('div', 'farbreihe');
  for (const f of FARBEN) {
    const b = el('button', 'farbe' + (f === s.farbe ? ' aktiv' : ''));
    b.style.setProperty('--farbe', f);
    b.title = f;
    b.onclick = () => {
      store.aendern(() => { s.farbe = f; }, 'strecke');
    };
    reihe.appendChild(b);
  }
  wrap.appendChild(reihe);
  return wrap;
}

// -------------------------------------------------- Querungen aus OpenStreetMap

/* Der Befund ist ein Vorschlag und wird es auch bleiben: übernommen wird jede
   Kreuzung einzeln oder auf einmal, aber immer durch einen Griff des Planers.
   Selbsttätig gesetzte Punkte stünden mit der Verbindlichkeit des Bauauftrags
   auf dem Blatt, ohne dass jemand sie angesehen hätte – und die Kartierung
   sagt nichts darüber, ob die Leitung an dieser Stelle 8 m oder 25 m hoch
   hängt. Genau das ist die Frage, die der Erkunder beantwortet. */
function querungsGruppe(s) {
  const gruppe = el('div', 'feldgruppe querungspruefung');
  gruppe.appendChild(el('h3', 'gruppen-titel', 'Querungen aus OpenStreetMap'));

  const inhalt = el('div', 'qp-inhalt');
  gruppe.appendChild(inhalt);
  let laeuft = false;

  const uebernehmen = funde => {
    /* Von hinten nach vorn eingefügt: jeder Punkt verschiebt die Nummern der
       Segmente hinter sich. Wer vorne anfängt, setzt den zweiten Punkt eine
       Ecke zu früh. */
    const reihe = [...funde].sort((a, b) => b.abAnfang - a.abAnfang);
    store.aendern(p => {
      const st = p.strecken.find(x => x.id === s.id);
      if (!st) return;
      for (const f of reihe) {
        const pt = neuerPunkt(f.lat, f.lng, 'querung');
        pt.querungsart = f.art.id;
        pt.name = f.bezeichnung;
        /* Von Hand gesetzt heißt es hier auch: die Punktart darf nicht später
           beim Löschen eines Nachbarn auf Anfang oder Ende umspringen. */
        pt._manuell = true;
        st.punkte.splice(Math.min(f.segment + 1, st.punkte.length), 0, pt);
      }
    }, 'strecke');
    hinweis(`${reihe.length} Querung${reihe.length === 1 ? '' : 'en'} übernommen – ` +
      RUECKGAENGIG_TEXT);
  };

  const pruefen = () => {
    if (laeuft) return;
    laeuft = true;
    zeichnen();
    pruefeQuerungen(s)
      .catch(() => hinweis('OpenStreetMap war nicht zu erreichen.', 'fehler'))
      .finally(() => { laeuft = false; zeichnen(); });
  };

  function zeichnen() {
    inhalt.innerHTML = '';
    const b = querungsbefund(s);

    const satz = el('p', 'klein qp-befund');
    satz.textContent = laeuft
      ? 'Die Trasse wird bei OpenStreetMap abgefragt …'
      : querungsbefundText(b);
    inhalt.appendChild(satz);

    if (b && !b.aktuell) {
      inhalt.appendChild(el('p', 'qp-veraltet',
        'Die Trasse wurde seit dieser Prüfung verändert – der Befund gilt für ihren ' +
        'früheren Verlauf.'));
    }

    const tasten = el('div', 'tastenreihe');
    const pruefTaste = knopf(b ? 'Erneut prüfen' : 'Trasse auf Querungen prüfen', pruefen);
    pruefTaste.disabled = laeuft;
    if (laeuft) pruefTaste.textContent = 'wird geprüft …';
    tasten.appendChild(pruefTaste);

    const offen = b
      ? b.funde.filter(f => f.klasse === 'kreuzung' && !schonEingetragen(s, f))
      : [];
    if (offen.length > 1) {
      tasten.appendChild(knopf(`Alle ${offen.length} Kreuzungen übernehmen`,
        () => uebernehmen(offen)));
    }
    inhalt.appendChild(tasten);

    if (!b || !b.funde.length) return;

    const liste = el('div', 'qp-liste');
    for (const f of b.funde) {
      const zeile = el('div', 'qp-fund qp-' + f.klasse);
      const kopf = el('div', 'qp-kopf');
      kopf.appendChild(el('span', 'qp-marke',
        f.klasse === 'kreuzung' ? 'Kreuzung' : 'Abstand'));
      kopf.appendChild(el('span', 'qp-art', escapeHtml(f.art.name)));
      zeile.appendChild(kopf);
      zeile.appendChild(el('p', 'qp-satz', escapeHtml(f.satz)));

      const fuss = el('div', 'qp-fuss');
      const zeigen = el('button', 'mini-knopf', '⌖');
      zeigen.title = 'Stelle auf der Karte zeigen';
      zeigen.onclick = () => {
        ctx.karte.setView([f.lat, f.lng], Math.max(ctx.karte.getZoom(), 16));
        ctx.zurKarte?.();
      };
      fuss.appendChild(zeigen);

      if (f.klasse === 'kreuzung') {
        if (schonEingetragen(s, f)) {
          fuss.appendChild(el('span', 'qp-schon', 'als Querung eingetragen'));
        } else {
          fuss.appendChild(knopf('Als Querung übernehmen', () => uebernehmen([f]), 'klein'));
        }
      } else {
        /* Eine Unterschreitung des Mindestabstands ist keine Kreuzung: sie
           bekommt keinen Punkt, weil sie keine Stelle hat, sondern eine
           Strecke. Sie gehört in die Bemerkung zum Auftrag. */
        fuss.appendChild(el('span', 'qp-schon', 'kein Querungspunkt – Auflage prüfen'));
      }
      zeile.appendChild(fuss);
      liste.appendChild(zeile);
    }
    inhalt.appendChild(liste);
    inhalt.appendChild(el('p', 'qp-quelle', escapeHtml(QUERUNGS_QUELLE)));
  }

  zeichnen();
  return gruppe;
}

function punktTabelle(s) {
  const wrap = el('div', 'feldgruppe punkte');
  const kopf = el('div', 'gruppen-kopf');
  const titel = el('h3', 'gruppen-titel', `Trassenpunkte (${s.punkte.length})`);
  kopf.appendChild(titel);
  const format = el('select', 'mini-select');
  [['mgrs', 'MGRS'], ['ddm', 'GPS Grad/Min.'], ['dez', 'Dezimalgrad']].forEach(([w, t]) => {
    const o = document.createElement('option');
    o.value = w; o.textContent = t;
    o.selected = store.projekt.optionen.koordformat === w;
    format.appendChild(o);
  });
  format.onchange = () => {
    store.aendern(p => { p.optionen.koordformat = format.value; }, 'formular');
    zeichneStreckenListe();
  };
  kopf.appendChild(format);
  wrap.appendChild(kopf);

  if (!s.punkte.length) {
    wrap.appendChild(el('p', 'klein', 'Noch keine Punkte. Über „Weiterzeichnen“ die Trasse auf der Karte aufnehmen.'));
    return wrap;
  }

  const liste = el('div', 'punktliste');
  /* Die Zeilen bleiben mit ihrer Signatur an der Tabelle hängen: beim
     nächsten Punkt werden nur die ersetzt, deren Punkt, Nummer oder Maß sich
     geändert hat (`punktTabelleNachfuehren`). */
  wrap._fbpPunkte = { titel, liste, zeilen: new Map() };
  punktTabelleNachfuehren(wrap, s);
  wrap.appendChild(liste);
  return wrap;
}

/**
 * Die Zeilen der Punkttabelle an die Strecke angleichen. `false`, wenn die
 * Tabelle dafür nicht steht – ohne Punkte gebaut oder ohne Punkte gefragt –,
 * dann muss die Karte neu entstehen.
 */
function punktTabelleNachfuehren(wrap, s) {
  const t = wrap._fbpPunkte;
  if (!t || !s.punkte.length) return false;
  t.titel.textContent = `Trassenpunkte (${s.punkte.length})`;
  const seg = segmentLaengen(s);
  const kum = kumuliert(s.punkte);
  const format = store.projekt.optionen.koordformat;
  const bleiben = new Set();
  s.punkte.forEach((pt, i) => {
    bleiben.add(pt.id);
    const aktiv = ctx.sl.aktiverPunkt === pt.id;
    /* Die Summe hängt an allen Punkten davor, die Nummer an der Stellung:
       ein eingefügter Punkt ersetzt deshalb auch die Zeilen hinter sich. */
    const stand = signatur([pt, i, aktiv, seg[i - 1], kum[i], format], [pt, s]);
    let z = t.zeilen.get(pt.id);
    if (!z || z.stand !== stand) {
      z = { zeile: punktZeile(s, pt, i, aktiv, seg, kum), stand };
      t.zeilen.set(pt.id, z);
    }
    if (t.liste.children[i] !== z.zeile) t.liste.insertBefore(z.zeile, t.liste.children[i] || null);
  });
  while (t.liste.children.length > s.punkte.length) t.liste.lastChild.remove();
  for (const id of [...t.zeilen.keys()]) if (!bleiben.has(id)) t.zeilen.delete(id);
  return true;
}

function punktZeile(s, pt, i, aktiv, seg, kum) {
  const zeile = el('div', 'punktzeile' + (aktiv ? ' aktiv' : ''));

  const kopf = el('div', 'pz-kopf');
  kopf.appendChild(el('span', 'pz-nr', String(i + 1)));

  const sel = el('select', 'mini-select pz-art');
  /* Die PLANpunktarten: „Art noch offen“ gibt es nur am Bauort (Schema 16).
     Ein geplanter Punkt ohne Art stünde im Bauauftrag, und den kann niemand
     ansteuern. */
  PLANPUNKTARTEN.forEach(a => {
    const o = document.createElement('option');
    o.value = a.id; o.textContent = a.name; o.selected = pt.art === a.id;
    sel.appendChild(o);
  });
  /* Der Grund „strecke“ baut die Streckenliste neu auf (siehe app.js) – nur
     deshalb kommt und geht die Querungsauswahl darunter beim Umschalten. */
  sel.onchange = () => store.aendern(() => { pt.art = sel.value; pt._manuell = true; }, 'strecke');
  kopf.appendChild(sel);

  const zeigen = el('button', 'mini-knopf', '⌖');
  zeigen.title = 'Punkt auf der Karte zeigen';
  zeigen.onclick = () => {
    ctx.karte.setView([pt.lat, pt.lng], Math.max(ctx.karte.getZoom(), 16));
    ctx.sl.waehle(s.id, pt.id);
    ctx.zurKarte?.();
  };
  kopf.appendChild(zeigen);
  zeile.appendChild(kopf);

  if (pt.art === 'querung') {
    const art = querungsartById(pt.querungsart);
    zeile.appendChild(feld('Art der Querung', art.id,
      v => store.aendern(() => { pt.querungsart = v; }, 'strecke'),
      { typ: 'select', werte: QUERUNGSARTEN.map(a => [a.id, a.name]), klasse: 'pz-querung' }));
    zeile.appendChild(auflagenZeile(art));
    zeile.appendChild(bauweiseZeile(pt));
  }
  if (pt.art === 'reserve') zeile.appendChild(reserveZeile(pt));

  const name = document.createElement('input');
  name.type = 'text'; name.className = 'mini-input pz-name';
  name.value = pt.name || ''; name.placeholder = 'Bezeichnung des Punktes';
  name.oninput = () => schreib(() => { pt.name = name.value; });
  zeile.appendChild(name);

  const fuss = el('div', 'pz-fuss');
  const kb = el('button', 'koord-knopf', escapeHtml(koordText(pt)));
  kb.title = 'Alle Koordinatenformate anzeigen oder Position ändern';
  kb.onclick = () => koordinatenDialog(s, pt, i);
  fuss.appendChild(kb);
  fuss.appendChild(el('span', 'pz-mass',
    (i === 0 ? '<span class="pz-start">Anfang</span>' : meter(seg[i - 1])) +
    ` <span class="pz-summe">Σ ${meter(kum[i])}</span>`));

  /* Löschen sitzt am rechten Rand hinter der Koordinatenzeile, nicht neben
     „auf Karte zeigen“ – mit Handschuhen waren die beiden nicht zu trennen. */
  const weg = el('button', 'mini-knopf gefahr pz-weg', '✕');
  weg.title = `Punkt ${i + 1} löschen`;
  weg.setAttribute('aria-label', `Punkt ${i + 1} löschen`);
  const loeschen = () => {
    store.aendern(() => {
      s.punkte = s.punkte.filter(x => x.id !== pt.id);
      sollPunktGeloescht(s, pt.id);
      s.punkte.forEach((q, j) => {
        if (q._manuell) return;
        if (j === 0) q.art = 'start';
        else if (j === s.punkte.length - 1) q.art = 'ziel';
      });
    }, 'strecke');
    hinweis(`Punkt ${i + 1} gelöscht – ${RUECKGAENGIG_TEXT}`);
  };
  /* An einer Strecke, an der schon gebaut wird, ist ein gelöschter Punkt kein
     Tippfehler der Planung mehr: der Trupp hat den Auftrag mit diesem Punkt in
     der Hand, und seine Aufnahme dort verliert ihren Bezug. Im Audit reichte
     ein Tipp auf das ✕ neben der Koordinate, und aus „3/3 Punkte“ wurde still
     „2/2“. Dort wird gefragt – beim Planen ohne Bau bleibt es beim Tipp. */
  weg.onclick = () => {
    if (!bauBegonnen(s)) { loeschen(); return; }
    const ist = istZuSoll(s, pt.id);
    dialog({
      titel: `Punkt ${i + 1} löschen?`,
      inhalt: `<p>An <b>${escapeHtml(s.name)}</b> wird schon gebaut. Der Trupp hat den Auftrag
          mit diesem Punkt; ändert sich die Planung, gehört ihm ein neuer Link.</p>
        ${ist ? '<p class="bau-warnung">Der Punkt ist am Bauort schon bestätigt – die Aufnahme bleibt, ' +
          'verliert aber ihren Bezug zum Plan.</p>' : ''}`,
      fuss: [
        { text: 'Abbrechen' },
        { text: 'Punkt löschen', gefahr: true, tun: loeschen }
      ]
    });
  };
  fuss.appendChild(weg);
  zeile.appendChild(fuss);

  return zeile;
}

/* Am Bauort wird nach dem Maß gefragt, nicht nach dem Namen der Querungsart:
   die Auflage steht deshalb ungefragt unter der Auswahl. Der volle Wortlaut der
   Vorschrift hängt am title – eine Zeile trägt ihn nicht. */
const AUFLAGE_ZEICHEN = 110;

/** Regeltext auf Zeilenlänge, gekürzt am Satzende statt mitten im Wort */
function kurzRegel(text) {
  const t = String(text || '').trim();
  if (t.length <= AUFLAGE_ZEICHEN) return t;
  const satz = t.lastIndexOf('. ', AUFLAGE_ZEICHEN);
  if (satz > 40) return t.slice(0, satz + 1);
  const luecke = t.lastIndexOf(' ', AUFLAGE_ZEICHEN);
  return t.slice(0, luecke > 40 ? luecke : AUFLAGE_ZEICHEN).trim() + ' …';
}

function auflagenZeile(art) {
  /* Wo die Vorschrift das Überbauen verbietet, ist das Mindestmaß
     gegenstandslos – dann steht dort das Verbot der Art und sonst nichts. */
  const mass = massText(art);
  const kern = art.verbot && art.verbotstext
    ? art.verbotstext
    : (mass !== '–' ? mass : kurzRegel(art.regel));

  const stuecke = [`<b>${escapeHtml(kern)}</b>`,
    `<span class="pz-fundstelle">${escapeHtml(fundstelleText(art))}</span>`];
  if (art.genehmigung) {
    stuecke.push(`<span class="pz-genehmigung">Genehmigung: ${escapeHtml(art.genehmigung)}</span>`);
  }

  const p = el('p', 'pz-auflage' + (art.verbot ? ' warnung' : ''), stuecke.join(' · '));
  p.title = art.regel;
  return p;
}

/* Die Bauweise am Hindernis und ihr Zeitansatz stehen nebeneinander: der
   Zeitansatz ist die Folge der Bauweise, und wer sie umstellt, sieht sofort,
   was das die Bauzeit kostet. Ein leeres Zeitfeld heißt „Richtwert der
   Bauweise“ – der steht als Platzhalter darin. Der Grund „strecke“ baut die
   Liste neu auf, damit der Platzhalter der neuen Bauweise folgt. */
function bauweiseZeile(pt) {
  const zeile = el('div', 'pz-bauweise');
  zeile.appendChild(feld('Bauweise am Hindernis', bauweiseById(pt.bauweise).id,
    v => store.aendern(() => { pt.bauweise = v; }, 'strecke'),
    { typ: 'select', werte: QUERUNG_BAUWEISEN.map(b => [b.id, b.name]), klasse: 'pz-querung' }));
  const zeit = feld('Zeitansatz', pt.querungszeit ?? '',
    v => schreib(() => { pt.querungszeit = v === '' ? null : Math.max(0, v); }),
    { typ: 'number', min: 0, step: 5, einheit: 'min', klasse: 'pz-querung pz-zeit',
      platzhalter: String(bauweiseById(pt.bauweise).minuten) });
  zeile.appendChild(zeit);
  return zeile;
}

/* Die Kabelreserve steht als Länge am Punkt und nicht nur als Merkzeichen auf
   der Karte: sie ist Kabel, das gebraucht, aber nicht verlegt wird, und war
   bisher in keiner Zahl des Bauauftrags enthalten – der Trupp fuhr mit dem
   Bedarf los, den die Trasse ergab, und legte die Schleifen davon ab. Ein
   leeres Feld heißt „Vorgabewert“, der steht als Platzhalter darin. */
function reserveZeile(pt) {
  return feld('Kabelreserve am Punkt', pt.reserve ?? '',
    v => schreib(() => { pt.reserve = v === '' ? null : Math.max(0, v); }),
    { typ: 'number', min: 0, step: 5, einheit: 'm', klasse: 'pz-querung pz-reserve',
      platzhalter: String(KABELRESERVE_STANDARD) });
}

function koordText(pt) {
  const f = store.projekt.optionen.koordformat;
  if (f === 'ddm') return toDDM(pt.lat, pt.lng);
  if (f === 'dez') return `${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`;
  return toMGRS(pt.lat, pt.lng, 5);
}

function koordinatenDialog(s, pt, i) {
  const f = alleFormate(pt.lat, pt.lng);
  const box = el('div', 'koord-dialog');
  box.innerHTML =
    `<div class="koord-liste">
      ${[['MGRS', f.mgrs], ['MGRS 10 m', f.mgrs10], ['UTM', f.utm],
         ['GPS Grad/Dez.-Min.', f.ddm], ['GPS Grad/Min./Sek.', f.dms],
         ['Dezimalgrad', f.dez], ['Roh (lat, lon)', f.latlng]]
        .map(([t, w]) => `<div class="kd-zeile"><span>${t}</span><code>${escapeHtml(w)}</code>
          <button class="mini-knopf" data-kopie="${escapeHtml(w)}" title="Kopieren">⧉</button></div>`).join('')}
     </div>
     <label class="feld"><span class="feld-titel">Punkt auf neue Koordinate setzen</span>
       <input type="text" id="kd-neu" placeholder="MGRS, Dezimalgrad oder Grad/Minuten">
     </label>
     <p class="klein" id="kd-status">Erkannt werden z. B. <code>32U LB 56560 45282</code>,
       <code>50.9413, 6.9583</code> oder <code>N 50 56.478 O 006 57.498</code>.</p>`;

  /* Die beiden Wege per Tipp stehen hier, am Punkt, und nicht als weitere
     Griffe in jeder Tabellenzeile: dort stehen schon Art, Zeigen und Löschen,
     und ein vierter Griff pro Zeile machte die Tabelle zum Suchbild. */
  if (ctx.planTipp && !document.body.classList.contains('baumodus')) {
    const tasten = el('div', 'tastenreihe kd-tipp');
    tasten.appendChild(knopf('✛ Auf der Karte neu setzen', () => {
      schliesseDialog(); ctx.planTipp(s.id, pt.id, 'verschieben');
    }, 'klein'));
    tasten.appendChild(knopf('⊕ Danach einen Punkt einfügen', () => {
      schliesseDialog(); ctx.planTipp(s.id, pt.id, 'einfuegen');
    }, 'klein'));
    box.prepend(tasten);
  }
  /* Dieselbe Einsicht wie beim Löschen eines Punktes: an einer Strecke, an der
     gebaut wird, ändert jede Verschiebung den Auftrag, den der Trupp in der
     Hand hat. Gefragt wird hier nicht – verschieben ist umkehrbar und kein
     Verlust –, aber gesagt. */
  if (bauBegonnen(s)) {
    box.prepend(el('p', 'bau-warnung',
      'An dieser Strecke wird schon gebaut. Nach einer Änderung braucht der Trupp einen neuen Link.'));
  }

  box.addEventListener('click', e => {
    const b = e.target.closest('[data-kopie]');
    if (!b) return;
    navigator.clipboard?.writeText(b.dataset.kopie)
      .then(() => hinweis('Koordinate kopiert'))
      .catch(() => hinweis('Kopieren nicht möglich', 'fehler'));
  });

  dialog({
    titel: `Punkt ${i + 1} – ${punktartById(pt.art).name}`,
    inhalt: box,
    fuss: [
      { text: 'Schließen' },
      { text: 'Übernehmen', primaer: true, tun: () => {
          const wert = box.querySelector('#kd-neu').value.trim();
          if (!wert) return true;
          const k = parseKoordinate(wert);
          if (!k) {
            box.querySelector('#kd-status').innerHTML =
              '<b class="fehlertext">Diese Koordinate wurde nicht erkannt.</b>';
            return false;
          }
          store.aendern(() => { pt.lat = k.lat; pt.lng = k.lng; }, 'strecke');
          ctx.karte.setView([k.lat, k.lng], Math.max(ctx.karte.getZoom(), 15));
          hinweis(`Punkt gesetzt (${k.format})`);
        } }
    ]
  });
}

// ---------------------------------------------------------------- Einsatzabschnitte

/* Die Zuteilungsliste im selben Dialog trägt den Namen ein zweites Mal – in
   jedem Auswahlfeld. Wird oben umbenannt, muss sie nachziehen, ohne dass die
   Liste neu gebaut wird: das verlöre den Bildlauf mitten in der Eingabe. */
function benenneAuswahlNach(kennung, name) {
  document.querySelectorAll(`#dialog-inhalt .mini-select option[value="${kennung}"]`)
    .forEach(o => { o.textContent = name; });
}

/** Neuen Einsatzabschnitt bilden und gleich zur Bearbeitung öffnen –
 *  `uebergeordnet` legt ihn als Unterabschnitt darunter an. */
export function abschnittAnlegen(uebergeordnet = null) {
  let aid;
  store.aendern(p => {
    const ea = neuerEinsatzabschnitt(p, uebergeordnet);
    aid = ea.id;
    p.einsatzabschnitte.push(ea);
  }, 'strecke');
  einsatzabschnittDialog(aid);
}

/**
 * Ein Einsatzabschnitt an einem Ort: benennen, Strecken zuteilen, als
 * Teilplanung weitergeben und als Sammelauftrag drucken.
 * `aid = null` öffnet dieselbe Ansicht für die nicht zugeteilten Strecken;
 * dort gibt es nichts zu benennen, wohl aber zuzuteilen und auszugeben.
 */
export function einsatzabschnittDialog(aid) {
  const p = store.projekt;
  const ea = abschnittById(p, aid);
  if (aid && !ea) return;

  const box = el('div', 'ea-dialog');

  if (ea) {
    const g = el('div', 'feldgruppe');
    g.appendChild(feld('Bezeichnung', ea.name, v => {
      schreib(() => { ea.name = v; });
      /* Nur die Zeilen nachziehen: die Liste bei jedem Tastendruck neu zu bauen
         verlöre Bildlauf und Tastenfokus in den offenen Strecken darunter.
         Der Abschnitt steht in beiden Listen – Strecken und Zeichen –, beide
         stehen gleichzeitig im DOM. */
      document.querySelectorAll(`.ea-gruppe[data-aid="${ea.id}"] .ea-name`)
        .forEach(zeile => { zeile.lastChild.textContent = v; });
      benenneAuswahlNach(ea.id, v);
      document.getElementById('dialog-titel').textContent = v || 'Einsatzabschnitt';
    }, { platzhalter: 'z. B. Einsatzabschnitt Nord' }));
    g.appendChild(feld('Leitung / Verantwortlich', ea.leiter, v => schreib(() => { ea.leiter = v; }),
      { platzhalter: 'Name, Funktion – steht auf dem Sammelauftrag' }));
    g.appendChild(klammerFarbwahl(ea, 'Farbe des Abschnitts', 'aid'));
    g.appendChild(feld('Bemerkung', ea.bemerkung, v => schreib(() => { ea.bemerkung = v; }),
      { typ: 'textarea', zeilen: 2 }));
    box.appendChild(g);
    box.appendChild(gliederungsFeldgruppe(ea));
  } else {
    box.appendChild(el('p', 'klein',
      `Diese Strecken und Zeichen gehören zu keinem Einsatzabschnitt. Sie bleiben auf
       der Karte sichtbar; nicht zugeteilte Zeichen erscheinen zudem in jedem Abschnitt.`));
  }

  const pdf = knopf('▤ Sammel-Bauauftrag (PDF)', () => {
    schliesseDialog();
    oeffneSammeldruck(aid);
  }, 'primaer');
  const lage = knopf('▦ Lagekarte (PDF)', () => {
    schliesseDialog();
    oeffneLagekarte(aid);
  });
  const datei = knopf('Als Datei sichern (.json)', () => {
    sicherungMelden(io.abschnittExportieren(aid),
      'Einsatzabschnitt als eigene Planungsdatei gesichert');
  });
  /* Ausgeben lässt sich nur, was da ist – die Knöpfe folgen der Zuteilung,
     die im selben Dialog gerade geändert wird. */
  const ausgabeAuffrischen = () => {
    /* Gedruckt und gesichert wird der ganze Ast – die Knöpfe zählen ihn mit. */
    const strecken = streckenUnter(store.projekt, aid);
    const zeichen = zeichenUnter(store.projekt, aid);
    const flaechen = flaechenUnter(store.projekt, aid);
    pdf.disabled = !strecken.filter(s => s.punkte.length >= 2).length;
    // Ein Abschnitt darf auch aus Zeichen oder Flächen allein bestehen – etwa
    // als Lagebild eines Abschnitts, dessen Strecken erst noch geplant werden.
    // Die Lagekarte gibt genau das aus, der Sammelauftrag braucht Trassen.
    lage.disabled = datei.disabled = !strecken.length && !zeichen.length && !flaechen.length;
  };

  const zut = el('div', 'feldgruppe');
  zut.appendChild(el('h3', 'gruppen-titel', 'Strecken zuteilen'));
  const stand = el('p', 'klein ea-stand');
  zut.appendChild(zuteilungsliste('strecken', aid, stand, ausgabeAuffrischen));
  zut.appendChild(stand);
  box.appendChild(zut);

  if (p.zeichen.length) {
    const zz = el('div', 'feldgruppe');
    zz.appendChild(el('h3', 'gruppen-titel', 'Taktische Zeichen zuteilen'));
    const zstand = el('p', 'klein ea-stand');
    zz.appendChild(zuteilungsliste('zeichen', aid, zstand, ausgabeAuffrischen));
    zz.appendChild(zstand);
    box.appendChild(zz);
  }

  if ((p.flaechen || []).length) {
    const ff = el('div', 'feldgruppe');
    ff.appendChild(el('h3', 'gruppen-titel', 'Flächen zuteilen'));
    const fstand = el('p', 'klein ea-stand');
    ff.appendChild(zuteilungsliste('flaechen', aid, fstand, ausgabeAuffrischen));
    ff.appendChild(fstand);
    box.appendChild(ff);
  }

  const aus = el('div', 'feldgruppe');
  aus.appendChild(el('h3', 'gruppen-titel', 'Ausgabe'));
  const tasten = el('div', 'tastenreihe');
  ausgabeAuffrischen();
  tasten.append(pdf, lage, datei);
  aus.appendChild(tasten);
  aus.appendChild(el('p', 'klein',
    `Der Sammelauftrag fasst alle Strecken dieses Abschnitts${
       ea && unterabschnitte(p, ea.id).length ? ' samt seinen Unterabschnitten' : ''
     } in einem Dokument
     zusammen – Deckblatt mit Übersichtskarte, Streckenverzeichnis und je Strecke
     das gewohnte Kartenblatt. Die Lagekarte ist dagegen ein einzelnes Blatt,
     auf dem die Karte alles ist – bis A0 und in freiem Maß, zum Aushängen in
     der Führungsstelle. Die Datei enthält nur diesen Ausschnitt und lässt
     sich beim Empfänger über <b>Datei → Planung oder KML laden</b> öffnen.
     Alle drei führen die Zeichen dieses Abschnitts mit und dazu die nicht
     zugeteilten – die gehören zum gemeinsamen Lagebild.`));
  box.appendChild(aus);

  const fuss = [];
  if (ea) fuss.push({ text: 'Abschnitt auflösen', gefahr: true,
    tun: () => { abschnittAufloesen(ea); return false; } });
  fuss.push({ text: 'Schließen', primaer: true });

  dialog({
    titel: ea ? (ea.name || 'Einsatzabschnitt') : 'Strecken ohne Einsatzabschnitt',
    inhalt: box, breit: true, fuss
  });
}

/** Liste aller Strecken bzw. Zeichen mit ihrer Zuteilung – von hier aus wandern
 *  sie zwischen den Klammern, ohne dass jede einzeln geöffnet werden muss.
 *  `art`: 'strecken' und 'zeichen' teilen einem Einsatzabschnitt zu,
 *  'zeichengruppe' einer Zeichengruppe. */
function zuteilungsliste(art, ziel, stand, danach = () => {}) {
  const p = store.projekt;
  const flaechenliste = art === 'flaechen';
  const zeichenliste = art !== 'strecken' && !flaechenliste;
  const nachGruppe = art === 'zeichengruppe';
  const titel = zeichenliste ? zeichenTitel : flaechenliste ? flaechenTitel : nachName;
  const alle = alphabetisch(
    zeichenliste ? p.zeichen : flaechenliste ? (p.flaechen || []) : p.strecken, titel);
  const feldname = nachGruppe ? 'gruppe' : 'abschnitt';
  const klammern = nachGruppe
    ? alphabetisch(p.zeichengruppen || [], nachName).map(k => [k.id, k.name])
    : abschnittWerte(p).slice(1);
  const bezeichner = nachGruppe ? 'Zeichengruppe' : 'Einsatzabschnitt';
  const box = el('div', 'ea-zuteilung');

  const eigene = () => {
    if (nachGruppe) return zeichenInGruppe(store.projekt, ziel);
    if (flaechenliste) return flaechenIm(store.projekt, ziel);
    return zeichenliste ? zeichenIm(store.projekt, ziel) : streckenIm(store.projekt, ziel);
  };

  const standSchreiben = () => {
    const eigen = eigene();
    if (nachGruppe) {
      stand.innerHTML = eigen.length
        ? `<b>${eigen.length}</b> in dieser Gruppe. Das Auge der Gruppe blendet sie
           gemeinsam ein und aus.`
        : 'Noch kein Zeichen in dieser Gruppe.';
      return;
    }
    if (zeichenliste || flaechenliste) {
      const was = flaechenliste ? 'Flächen' : 'Zeichen';
      stand.innerHTML = eigen.length
        ? `<b>${eigen.length}</b> zugeteilt. Nicht zugeteilte ${was} erscheinen ohnehin
           in jedem Abschnitt.`
        : `Keine ${was} zugeteilt – die nicht zugeteilten gelten für jeden Abschnitt.`;
      return;
    }
    const ges = gesamtKennzahlen(eigen);
    stand.innerHTML = eigen.length
      ? `<b>${eigen.length}</b> ${eigen.length === 1 ? 'Strecke' : 'Strecken'} ·
         Trasse <b>${formatLaenge(ges.trasse)}</b> · Bedarf <b>${formatLaenge(ges.bedarf)}</b> ·
         <b>${ges.trommeln}</b> ${ges.trommeln === 1 ? 'Trommel' : 'Trommeln'}`
      : 'Noch keine Strecke zugeteilt.';
  };

  if (!alle.length) {
    box.appendChild(el('p', 'klein',
      zeichenliste ? 'Diese Planung enthält noch kein taktisches Zeichen.'
        : flaechenliste ? 'Diese Planung enthält noch keine Fläche.'
        : 'Diese Planung enthält noch keine Strecke.'));
    standSchreiben();
    return box;
  }

  for (const x of alle) {
    const bezeichnung = titel(x);
    const zeile = el('div', 'ez-zeile');
    zeile.innerHTML = zeichenliste
      ? `<span class="mini-symbol">${symbolSVG({ symbol: x.symbol, breite: 24 })}</span>
         <span class="ez-name">${escapeHtml(bezeichnung)}</span>`
      : flaechenliste
      ? `<span class="mini-flaeche">${flaechenVorschau(x.art, 24)}</span>
         <span class="ez-name">${escapeHtml(bezeichnung)}</span>
         <span class="ez-wert">${masseText(x)}</span>`
      : `<span class="farbpunkt" style="--farbe:${x.farbe}"></span>
         <span class="ez-name">${escapeHtml(bezeichnung)}</span>
         <span class="ez-wert">${formatLaenge(kennzahlen(x).trasse)}</span>`;

    const wahl = document.createElement('select');
    wahl.className = 'mini-select';
    wahl.setAttribute('aria-label', `${bezeichner} für ${bezeichnung}`);
    for (const [wert, text] of [['', '— ohne —'], ...klammern]) {
      const o = document.createElement('option');
      o.value = wert; o.textContent = text; o.selected = (x[feldname] || '') === wert;
      wahl.appendChild(o);
    }
    wahl.onchange = () => {
      store.aendern(() => { x[feldname] = wahl.value || null; },
        zeichenliste ? 'zeichen' : flaechenliste ? 'flaeche' : 'strecke');
      zeile.classList.toggle('eigen', (x[feldname] || null) === (ziel || null));
      standSchreiben();
      danach();
    };
    zeile.classList.toggle('eigen', (x[feldname] || null) === (ziel || null));
    zeile.appendChild(wahl);
    box.appendChild(zeile);
  }
  standSchreiben();
  return box;
}

/** Farbwahl für eine Klammer – `merkmal` benennt das Datenattribut, an dem die
 *  offenen Listen ihren Farbpunkt tragen (`aid` Abschnitt, `gid` Gruppe).
 *  Die Strecken haben ihre eigene `farbwahl`: dort hängt an der Farbe auch die
 *  Linie auf der Karte, hier nur der Punkt in der Kopfzeile. */
function klammerFarbwahl(hat, titel, merkmal) {
  const wrap = el('div', 'feld');
  wrap.appendChild(el('span', 'feld-titel', titel));
  const reihe = el('div', 'farbreihe');
  FARBEN.forEach(f => {
    const b = el('button', 'farbe' + (hat.farbe === f ? ' aktiv' : ''));
    b.style.background = f;
    b.title = f;
    b.setAttribute('aria-label', 'Farbe ' + f);
    b.onclick = () => {
      schreib(() => { hat.farbe = f; });
      reihe.querySelectorAll('.farbe').forEach(x => x.classList.remove('aktiv'));
      b.classList.add('aktiv');
      // Ebenso in beiden Listen; der Punkt im Gruppenkopf, nicht die der Einträge.
      document.querySelectorAll(`.ea-gruppe[data-${merkmal}="${hat.id}"] .ea-kopf .farbpunkt`)
        .forEach(punkt => { punkt.style.setProperty('--farbe', f); });
    };
    reihe.appendChild(b);
  });
  wrap.appendChild(reihe);
  return wrap;
}

/* Auflösen, nicht löschen: die Strecken bleiben, sie gehören danach dem
   Abschnitt darüber – auf der obersten Ebene heißt das: keinem mehr. Ebenso
   rücken die Unterabschnitte eine Ebene hinauf; ihr Inhalt bleibt ihnen.
   Deshalb reicht eine Rückfrage ohne Namenseingabe – rückgängig machen lässt
   es sich ohnehin. */
function abschnittAufloesen(ea) {
  const p = store.projekt;
  const oben = abschnittById(p, ea.uebergeordnet);
  const strecken = streckenIm(p, ea.id).length;
  const zeichen = zeichenIm(p, ea.id).length;
  const flaechen = flaechenIm(p, ea.id).length;
  const relais = relaisstellenIm(p, ea.id).length;
  const unter = unterabschnitte(p, ea.id).length;
  const anzahl = strecken + zeichen + flaechen + relais;
  const teile = [];
  if (strecken) teile.push(`${strecken} ${strecken === 1 ? 'Strecke' : 'Strecken'}`);
  if (zeichen) teile.push(`${zeichen} Zeichen`);
  if (flaechen) teile.push(`${flaechen} ${flaechen === 1 ? 'Fläche' : 'Flächen'}`);
  if (relais) teile.push(`${relais} ${relais === 1 ? 'Relaisstelle' : 'Relaisstellen'}`);
  const wohin = oben ? `zu <b>${escapeHtml(oben.name)}</b>` : 'als nicht zugeteilt';
  dialog({
    titel: 'Einsatzabschnitt auflösen',
    inhalt: `<p>Soll <b>${escapeHtml(ea.name)}</b> aufgelöst werden?</p>
      <p class="klein">${anzahl
        ? `${teile.join(', ')} ${anzahl === 1 ? 'bleibt' : 'bleiben'} erhalten und
           ${anzahl === 1 ? 'gehört' : 'gehören'} danach ${wohin}.`
        : 'Diesem Abschnitt ist nichts zugeteilt.'}
        ${unter ? `${unter} ${unter === 1 ? 'Unterabschnitt rückt' : 'Unterabschnitte rücken'}
           ${oben ? `unter <b>${escapeHtml(oben.name)}</b>` : 'auf die oberste Ebene'}.` : ''}
        ${RUECKGAENGIG_HTML}</p>`,
    fuss: [
      { text: 'Abbrechen', tun: () => { einsatzabschnittDialog(ea.id); return false; } },
      { text: 'Auflösen', gefahr: true, tun: () => {
          store.aendern(p => {
            const ziel = ea.uebergeordnet || null;
            const um = x => { if (x.abschnitt === ea.id) x.abschnitt = ziel; };
            p.strecken.forEach(um);
            p.zeichen.forEach(um);
            (p.flaechen || []).forEach(um);
            (p.relaisstellen || []).forEach(um);
            p.einsatzabschnitte.forEach(a => {
              if (a.uebergeordnet === ea.id) a.uebergeordnet = ziel;
            });
            p.einsatzabschnitte = p.einsatzabschnitte.filter(a => a.id !== ea.id);
          }, 'strecke');
          hinweis('Einsatzabschnitt aufgelöst');
        } }
    ]
  });
}

/**
 * Wo der Abschnitt in der Führungsorganisation steht: der Abschnitt darüber,
 * die Unterabschnitte darunter, und ein Knopf für einen neuen. Vier Ebenen
 * sind die Grenze – als Elternabschnitt steht nur zur Wahl, worunter der
 * ganze Ast noch Platz hat; der eigene Ast selbst nie, das wäre ein Kreis.
 */
function gliederungsFeldgruppe(ea) {
  const p = store.projekt;
  const g = el('div', 'feldgruppe');
  g.appendChild(el('h3', 'gruppen-titel', 'Gliederung'));

  const eigener = abschnittBaum(p, ea.id);
  const hoehe = astHoehe(p, ea.id);
  const waehlbar = abschnitteGeordnet(p).filter(a =>
    !eigener.has(a.id) && abschnittTiefe(p, a.id) + hoehe <= ABSCHNITT_EBENEN);
  g.appendChild(feld('Gehört zu', ea.uebergeordnet || '', v => {
    store.aendern(() => { ea.uebergeordnet = v || null; }, 'strecke');
    /* Der Dialog zeigt Ebene und Unterabschnitte – nach dem Umhängen stimmt
       beides nicht mehr, deshalb wird er neu aufgeschlagen. */
    einsatzabschnittDialog(ea.id);
  }, {
    typ: 'select',
    werte: [['', '— oberste Ebene —'],
      ...waehlbar.map(a => [a.id, '\u2003'.repeat(abschnittTiefe(p, a.id) - 1) + a.name])]
  }));

  const tiefe = abschnittTiefe(p, ea.id);
  const unter = alphabetisch(unterabschnitte(p, ea.id), nachName);
  const stand = el('p', 'klein');
  stand.innerHTML = `Ebene <b>${tiefe}</b> von ${ABSCHNITT_EBENEN}` + (unter.length
    ? ` · <b>${unter.length}</b> ${unter.length === 1 ? 'Unterabschnitt' : 'Unterabschnitte'}`
    : '');
  g.appendChild(stand);

  if (unter.length) {
    const liste = el('div', 'ea-unterliste');
    for (const u of unter) {
      const zeile = el('button', 'ea-unter',
        `<span class="farbpunkt" style="--farbe:${u.farbe}"></span>
         <span class="ez-name">${escapeHtml(u.name)}</span>
         <span class="ez-wert">${streckenUnter(p, u.id).length} · ${
           formatLaenge(gesamtKennzahlen(streckenUnter(p, u.id)).trasse)}</span>`);
      zeile.type = 'button';
      zeile.title = 'Unterabschnitt öffnen';
      zeile.onclick = () => einsatzabschnittDialog(u.id);
      liste.appendChild(zeile);
    }
    g.appendChild(liste);
  }

  if (tiefe < ABSCHNITT_EBENEN) {
    g.appendChild(knopf('+ Unterabschnitt', () => abschnittAnlegen(ea.id), 'klein ea-neu'));
  } else {
    g.appendChild(el('p', 'klein',
      `Die vierte Ebene ist die unterste – tiefer lässt sich nicht gliedern.`));
  }
  return g;
}

// ---------------------------------------------------------------- Zeichengruppen

/** Neue Zeichengruppe bilden und gleich zur Bearbeitung öffnen */
export function zeichengruppeAnlegen() {
  let gid;
  store.aendern(p => {
    const gr = neueZeichengruppe(p);
    gid = gr.id;
    /* Ältere Stände kennen das Feld nicht; die Migration legt es an, ein per
       Rückgängig zurückgeholter Zwischenstand aber nicht zwingend. */
    p.zeichengruppen = p.zeichengruppen || [];
    p.zeichengruppen.push(gr);
  }, 'zeichen');
  zeichengruppeDialog(gid);
}

/**
 * Eine Zeichengruppe an einem Ort: benennen, einfärben, Zeichen zuteilen.
 * `gid = null` öffnet dieselbe Ansicht für die nicht gruppierten Zeichen –
 * dort gibt es nichts zu benennen, wohl aber zuzuteilen.
 *
 * Anders als der Einsatzabschnitt gibt die Gruppe nichts aus: sie ordnet das
 * Lagebild auf dem Schirm, sie ist keine Zuständigkeit, für die ein eigener
 * Bauauftrag oder eine Teildatei entstünde.
 */
export function zeichengruppeDialog(gid) {
  const p = store.projekt;
  const gr = zeichengruppeById(p, gid);
  if (gid && !gr) return;

  const box = el('div', 'ea-dialog');

  if (gr) {
    const g = el('div', 'feldgruppe');
    g.appendChild(feld('Bezeichnung', gr.name, v => {
      schreib(() => { gr.name = v; });
      // Nur die Zeile nachziehen – ein Neuaufbau verlöre Bildlauf und Fokus.
      document.querySelectorAll(`.ea-gruppe[data-gid="${gr.id}"] .ea-name`)
        .forEach(zeile => { zeile.lastChild.textContent = v; });
      benenneAuswahlNach(gr.id, v);
      document.getElementById('dialog-titel').textContent = v || 'Zeichengruppe';
    }, { platzhalter: 'z. B. Gefahrenstellen, Kräfte, Fernmeldemittel' }));
    g.appendChild(klammerFarbwahl(gr, 'Farbe der Gruppe', 'gid'));
    g.appendChild(feld('Bemerkung', gr.bemerkung, v => schreib(() => { gr.bemerkung = v; }),
      { typ: 'textarea', zeilen: 2 }));
    box.appendChild(g);
  } else {
    box.appendChild(el('p', 'klein',
      `Diese Zeichen gehören zu keiner Gruppe. Sie bleiben auf der Karte sichtbar –
       nur wer in einer Gruppe steht, lässt sich mit ihr gemeinsam ausblenden.`));
  }

  const zut = el('div', 'feldgruppe');
  zut.appendChild(el('h3', 'gruppen-titel', 'Zeichen zuteilen'));
  const stand = el('p', 'klein ea-stand');
  zut.appendChild(zuteilungsliste('zeichengruppe', gid, stand));
  zut.appendChild(stand);
  box.appendChild(zut);

  const fuss = [];
  if (gr) fuss.push({ text: 'Gruppe auflösen', gefahr: true,
    tun: () => { zeichengruppeAufloesen(gr); return false; } });
  fuss.push({ text: 'Schließen', primaer: true });

  dialog({
    titel: gr ? (gr.name || 'Zeichengruppe') : 'Zeichen ohne Gruppe',
    inhalt: box, breit: true, fuss
  });
}

/* Auflösen, nicht löschen: die Zeichen bleiben stehen und sind danach nur
   ungruppiert. Ein ausgeblendetes Zeichen käme dabei unbemerkt zurück – deshalb
   sagt die Rückfrage es an, wenn die Gruppe gerade ausgeblendet ist. */
function zeichengruppeAufloesen(gr) {
  const anzahl = zeichenInGruppe(store.projekt, gr.id).length;
  dialog({
    titel: 'Zeichengruppe auflösen',
    inhalt: `<p>Soll <b>${escapeHtml(gr.name)}</b> aufgelöst werden?</p>
      <p class="klein">${anzahl
        ? `${anzahl} ${anzahl === 1 ? 'Zeichen bleibt' : 'Zeichen bleiben'} erhalten und
           ${anzahl === 1 ? 'gilt' : 'gelten'} danach als ungruppiert.` +
          (gr.sichtbar === false
            ? ` Da die Gruppe ausgeblendet ist, ${anzahl === 1 ? 'erscheint es' : 'erscheinen sie'}
               danach wieder auf der Karte.`
            : '')
        : 'Dieser Gruppe ist kein Zeichen zugeteilt.'}
        ${RUECKGAENGIG_HTML}</p>`,
    fuss: [
      { text: 'Abbrechen', tun: () => { zeichengruppeDialog(gr.id); return false; } },
      { text: 'Auflösen', gefahr: true, tun: () => {
          store.aendern(p => {
            p.zeichen.forEach(z => { if (z.gruppe === gr.id) z.gruppe = null; });
            p.zeichengruppen = p.zeichengruppen.filter(g => g.id !== gr.id);
          }, 'zeichen');
          hinweis('Zeichengruppe aufgelöst');
        } }
    ]
  });
}

// ---------------------------------------------------------------- Taktische Zeichen

/* Zwei Gliederungen liegen quer zueinander: der Einsatzabschnitt sagt, wer
   zuständig ist, die Zeichengruppe, was im Lagebild zusammengehört. Ineinander
   geschachtelt wäre die Liste in der schmalen Seitenleiste nicht mehr zu lesen –
   sie zeigt deshalb eine von beiden. Wonach gegliedert wird, ist Ansichtssache
   und steht wie der Klappzustand außerhalb des Projekts. */
let zeichenGliederung = 'gruppen';

export function zeichneZeichenListe() {
  const p = store.projekt;
  const liste = document.getElementById('zeichen-liste');
  const wahlbox = document.getElementById('zeichen-gliederung');
  const abschnitte = obersteAbschnitte(p);
  const gruppen = alphabetisch(p.zeichengruppen || [], nachName);
  liste.innerHTML = '';

  /* Der Umschalter darf nicht auf eine Gliederung zeigen, die es nicht mehr
     gibt – die letzte Gruppe kann eben aufgelöst worden sein. */
  if (!gruppen.length) zeichenGliederung = 'abschnitte';
  else if (!abschnitte.length) zeichenGliederung = 'gruppen';

  wahlbox.innerHTML = '';
  wahlbox.hidden = !(gruppen.length && abschnitte.length);
  if (!wahlbox.hidden) wahlbox.appendChild(gliederungsWahl());

  if (!p.zeichen.length) {
    liste.appendChild(el('div', 'leer',
      `<p><b>Noch keine taktischen Zeichen gesetzt.</b></p>
       <p>„Taktisches Zeichen setzen“ wählen, Symbol aus der Auswahl nehmen und
       auf der Karte platzieren.</p>`));
    if (!abschnitte.length && !gruppen.length) return;
  }

  if (zeichenGliederung === 'gruppen' && gruppen.length) {
    for (const gr of gruppen) liste.appendChild(zeichengruppenGruppe(gr));
    if (zeichenInGruppe(p, null).length) liste.appendChild(zeichengruppenGruppe(null));
    return;
  }

  if (!abschnitte.length) {
    for (const z of alphabetisch(p.zeichen, zeichenTitel)) liste.appendChild(zeichenKarte(z));
    return;
  }

  for (const ea of abschnitte) liste.appendChild(abschnittGruppe(ea, 'zeichen'));
  if (zeichenIm(p, null).length) liste.appendChild(abschnittGruppe(null, 'zeichen'));
}

/** Umschalter zwischen den beiden Gliederungen der Zeichenliste */
function gliederungsWahl() {
  const reihe = el('div', 'gl-wahl');
  reihe.appendChild(el('span', 'gl-titel', 'Gliedern nach'));
  for (const [wert, text] of [['gruppen', 'Gruppen'], ['abschnitte', 'Einsatzabschnitten']]) {
    const b = el('button', 'gl-knopf' + (zeichenGliederung === wert ? ' aktiv' : ''), text);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(zeichenGliederung === wert));
    b.onclick = () => { zeichenGliederung = wert; zeichneZeichenListe(); };
    reihe.appendChild(b);
  }
  return reihe;
}

function zeichenKarte(z) {
  const gewaehlt = ctx.zl.auswahl === z.id;
  const basis = symbolById(z.symbol);
  /* Ein Zeichen kann auch dann von der Karte verschwunden sein, wenn sein
     eigenes Auge offen steht – dann hat es seine Gruppe oder sein Abschnitt
     ausgeblendet. Das muss die Zeile zeigen, sonst wird es auf der Karte
     vergeblich gesucht. „entzogen“ dämpft dafür wie „verborgen“, lässt aber
     das Auge in Ruhe: dieser Schalter steht ja weiter offen. */
  const zustand = z.sichtbar === false ? ' verborgen'
    : (zeichenSichtbar(store.projekt, z) ? '' : ' entzogen');
  const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : '') + zustand);

  const kopf = el('header', 'eintrag-kopf');
  kopf.innerHTML =
    `<span class="mini-symbol">${symbolSVG({ symbol: z.symbol, breite: 26 })}</span>
     <button type="button" class="eintrag-name" aria-expanded="${gewaehlt}">${escapeHtml(zeichenTitel(z))}</button>
     ${augenKnopf(z.sichtbar !== false)}`;
  kopf.onclick = () => ctx.zl.waehle(gewaehlt ? null : z.id);
  kopf.querySelector('[data-akt="sichtbar"]').onclick = e => {
    e.stopPropagation();
    store.aendern(() => { z.sichtbar = z.sichtbar === false; }, 'zeichen');
  };
  karte.appendChild(kopf);

  if (gewaehlt) karte.appendChild(zeichenFormular(z, basis));
  return karte;
}

function zeichenFormular(z, basis) {
  const koerper = el('div', 'eintrag-koerper');

  const symZeile = el('div', 'feld');
  symZeile.appendChild(el('span', 'feld-titel', 'Symbol'));
  const symKnopf = el('button', 'symbol-waehler');
  symKnopf.innerHTML = `${symbolSVG({ symbol: z.symbol, breite: 34 })}
    <span>${escapeHtml(basis.name)}</span><span class="pfeil">▾</span>`;
  symKnopf.onclick = () => symbolPalette(sym => {
    store.aendern(() => { z.symbol = sym; }, 'zeichen');
  });
  symZeile.appendChild(symKnopf);
  koerper.appendChild(symZeile);

  const g = el('div', 'feldgruppe');
  g.appendChild(feld('Beschriftung auf der Karte', z.label, v => {
    schreib(() => { z.label = v; });
    ctx.zl.zeichne();
  }, { platzhalter: basis.name }));

  /* Wie bei den Strecken: erst wenn Abschnitte gebildet sind, gibt es hier
     etwas zu wählen. Nicht zugeteilt heißt „gehört zu jedem Abschnitt“. */
  if ((store.projekt.einsatzabschnitte || []).length) {
    g.appendChild(feld('Einsatzabschnitt', z.abschnitt || '', v => {
      store.aendern(() => { z.abschnitt = v || null; }, 'zeichen');
    }, {
      typ: 'select',
      werte: abschnittWerte(store.projekt, '— keinem zugeteilt (gilt für alle) —')
    }));
  }

  /* Die Gruppe steht neben dem Abschnitt, nicht an seiner Stelle: das eine sagt,
     wer zuständig ist, das andere, was zusammen ein- und ausgeblendet wird. */
  if ((store.projekt.zeichengruppen || []).length) {
    g.appendChild(feld('Zeichengruppe', z.gruppe || '', v => {
      store.aendern(() => { z.gruppe = v || null; }, 'zeichen');
    }, {
      typ: 'select',
      werte: [['', '— ohne Gruppe —'],
        ...alphabetisch(store.projekt.zeichengruppen, nachName).map(gr => [gr.id, gr.name])]
    }));
  }

  const paar2 = el('div', 'feld-paar');
  paar2.append(
    feld('Drehung', z.drehung || 0, v => {
      schreib(() => { z.drehung = v; });
      ctx.zl.zeichne();
    }, { typ: 'number', min: 0, max: 359, step: 5, einheit: '°' }),
    feld('Größe', z.groesse || 1, v => {
      schreib(() => { z.groesse = v; });
      ctx.zl.zeichne();
    }, { typ: 'number', min: 0.5, max: 2.5, step: 0.1, einheit: '×' })
  );
  g.appendChild(paar2);
  g.appendChild(feld('Bemerkung', z.bemerkung, v => schreib(() => { z.bemerkung = v; }),
    { typ: 'textarea', zeilen: 2 }));
  koerper.appendChild(g);

  koerper.appendChild(el('p', 'klein mono koord-hinweis',
    `${toMGRS(z.lat, z.lng, 5)}<br>${toDDM(z.lat, z.lng)}`));

  const tasten = el('div', 'tastenreihe');
  tasten.append(
    knopf('Auf Karte zeigen', () => {
      ctx.karte.setView([z.lat, z.lng], Math.max(ctx.karte.getZoom(), 15));
      ctx.zurKarte?.();
    }),
    knopf('Duplizieren', () => {
      store.aendern(p => {
        const k = { ...z, id: id(), lat: z.lat + 0.0004, lng: z.lng + 0.0006 };
        p.zeichen.push(k);
      }, 'zeichen');
    }),
    knopf('Löschen', () => {
      store.aendern(p => { p.zeichen = p.zeichen.filter(x => x.id !== z.id); }, 'zeichen');
      ctx.zl.auswahl = null;
      hinweis('Zeichen gelöscht');
    }, 'gefahr')
  );
  koerper.appendChild(tasten);
  return koerper;
}

/**
 * Symbolauswahl mit Suche und Kategorien.
 *
 * Die Sammlung bringt rund 900 Zeichen mit. Alle gleichzeitig als SVG in den
 * Dialog zu hängen macht das Öffnen spürbar zäh, deshalb zeigt die Auswahl
 * immer nur eine Kategorie — und schaltet erst bei einer Suche über den
 * gesamten Bestand.
 */
export function symbolPalette(beiWahl) {
  const box = el('div', 'palette');
  box.innerHTML = `<div class="palette-kopf">
      <input type="search" class="palette-suche" placeholder="Alle Zeichen durchsuchen …" aria-label="Zeichen suchen">
      <select class="palette-kat-wahl" aria-label="Kategorie"></select>
    </div>
    <div class="palette-gitter"></div>`;
  const gitter = box.querySelector('.palette-gitter');
  const suche = box.querySelector('.palette-suche');
  const katWahl = box.querySelector('.palette-kat-wahl');

  for (const kat of KATEGORIEN) {
    const opt = document.createElement('option');
    opt.value = kat.id;
    opt.textContent = kat.name;
    katWahl.appendChild(opt);
  }
  const start = KATEGORIEN.find(k => k.id === 'fernmeldewesen') || KATEGORIEN[0];
  katWahl.value = start.id;

  const abschnitt = (titel, treffer) => {
    gitter.appendChild(el('h4', 'palette-kat', escapeHtml(titel)));
    const reihe = el('div', 'palette-reihe');
    for (const s of treffer) {
      const b = el('button', 'palette-knopf');
      b.innerHTML = `${symbolSVG({ symbol: s.id, breite: 40 })}<span>${escapeHtml(s.name)}</span>`;
      b.title = s.name;
      b.onclick = () => { beiWahl(s.id); schliesseDialog(); };
      reihe.appendChild(b);
    }
    gitter.appendChild(reihe);
  };

  const bauen = () => {
    gitter.innerHTML = '';
    const f = suche.value.trim().toLowerCase();
    katWahl.disabled = !!f;

    if (!f) {
      const kat = KATEGORIEN.find(k => k.id === katWahl.value) || KATEGORIEN[0];
      abschnitt(kat.name, SYMBOLE.filter(s => s.kat === kat.id));
      return;
    }

    let gefunden = 0;
    for (const kat of KATEGORIEN) {
      const treffer = SYMBOLE.filter(s => s.kat === kat.id &&
        (s.name.toLowerCase().includes(f) || s.id.includes(f)));
      if (!treffer.length) continue;
      abschnitt(kat.name, treffer);
      gefunden += treffer.length;
    }
    if (!gefunden) gitter.appendChild(el('p', 'klein', 'Kein Zeichen gefunden.'));
  };

  suche.oninput = bauen;
  katWahl.onchange = bauen;
  bauen();

  /* Füllend, damit es bei EINEM Rollbereich bleibt: der Dialoginhalt rollte
     bisher selbst, und das Gitter darin noch einmal. Beim Fingerrollen sprang
     die Bewegung zwischen beiden hin und her, und dabei rollten Suchfeld und
     Kategorie weg – die Palette ist zum Durchsehen gedacht, und das Suchfeld
     war nach dem ersten Rollen nicht mehr da. */
  dialog({ titel: 'Taktisches Zeichen wählen', inhalt: box, breit: true, fuellend: true,
           fuss: [{ text: 'Abbrechen' }] });
}

// ---------------------------------------------------------------- Flächen

/* Eine Fläche sagt, wie viel Platz etwas braucht: der FüKomKW mit Ausschub,
   der Anhänger mit Mast und Deichsel, das Zelt, der ganze Aufbauplatz. Sie
   ist kein taktisches Zeichen – das sagt, *was* dort steht, die Fläche, wie
   groß es ist – und wird deshalb maßstäblich gezeichnet. Zugeteilt wird sie
   wie ein Zeichen dem Einsatzabschnitt; Zeichengruppen kennt sie nicht. */

export function zeichneFlaechenListe() {
  const p = store.projekt;
  const liste = document.getElementById('flaechen-liste');
  const summe = document.getElementById('flaechen-summe');
  if (!liste) return;
  liste.innerHTML = '';
  const flaechen = p.flaechen || [];
  const abschnitte = obersteAbschnitte(p);

  const qm = flaechen.reduce((n, f) => n + f.breite * f.laenge, 0);
  summe.innerHTML = flaechen.length
    ? `<span><b>${flaechen.length}</b> ${flaechen.length === 1 ? 'Fläche' : 'Flächen'}</span>
       <span>zusammen <b>${Math.round(qm).toLocaleString('de-DE')} m²</b></span>`
    : '';

  if (!flaechen.length) {
    liste.appendChild(el('div', 'leer',
      `<p><b>Noch keine Fläche eingezeichnet.</b></p>
       <p>„Fläche einzeichnen“ wählen – FüKomKW, Anhänger FüLa, Zelt SG 300, den
       Aufbauplatz der Führungsstelle oder eine freie Fläche mit eigenen Maßen –
       und auf der Karte die Mitte anklicken. Die Fläche steht dann maßstäblich
       da; am Griff über der Fläche lässt sie sich drehen, am Eintrag die Maße
       anpassen.</p>
       <p class="klein">Die Maße stammen aus dem Erkundungsblatt „Aufbauplatz
       THW-FüSt“: jeweils aufgebaut, mit Ausschub, Mast und Deichsel.</p>`));
    if (!abschnitte.length) return;
  }

  if (!abschnitte.length) {
    for (const f of alphabetisch(flaechen, flaechenTitel)) liste.appendChild(flaecheKarte(f));
    return;
  }
  for (const ea of abschnitte) liste.appendChild(abschnittGruppe(ea, 'flaechen'));
  if (flaechenIm(p, null).length) liste.appendChild(abschnittGruppe(null, 'flaechen'));
}

function flaecheKarte(f) {
  const gewaehlt = ctx.fl.auswahl === f.id;
  const zustand = f.sichtbar === false ? ' verborgen'
    : (flaecheSichtbar(store.projekt, f) ? '' : ' entzogen');
  const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : '') + zustand);

  const kopf = el('header', 'eintrag-kopf');
  kopf.innerHTML =
    `<span class="mini-flaeche">${flaechenVorschau(f.art, 26)}</span>
     <button type="button" class="eintrag-name" aria-expanded="${gewaehlt}">${escapeHtml(flaechenTitel(f))}</button>
     <span class="eintrag-wert">${masseText(f)}</span>
     ${augenKnopf(f.sichtbar !== false)}`;
  kopf.onclick = () => ctx.fl.waehle(gewaehlt ? null : f.id);
  kopf.querySelector('[data-akt="sichtbar"]').onclick = e => {
    e.stopPropagation();
    store.aendern(() => { f.sichtbar = f.sichtbar === false; }, 'flaeche');
  };
  karte.appendChild(kopf);

  if (gewaehlt) karte.appendChild(flaecheFormular(f));
  return karte;
}

function flaecheFormular(f) {
  const koerper = el('div', 'eintrag-koerper');
  const art = flaechenartById(f.art);
  const g = el('div', 'feldgruppe');

  g.appendChild(feld('Beschriftung auf der Karte', f.name, v => {
    schreib(() => { f.name = v; });
    ctx.fl.zeichne();
  }, { platzhalter: art.kurz }));

  /* Der Wechsel der Vorlage setzt die Maße auf ihre Werte – wer vom Zelt zum
     Anhänger wechselt, will den Anhänger und nicht ein Zelt mit anderem Bild. */
  g.appendChild(feld('Vorlage', f.art, v => {
    const neu = flaechenartById(v);
    store.aendern(() => { f.art = neu.id; f.breite = neu.breite; f.laenge = neu.laenge; }, 'flaeche');
  }, { typ: 'select', werte: FLAECHENARTEN.map(a => [a.id, a.name]) }));

  const masse = el('div', 'feld-paar');
  masse.append(
    feld('Breite', f.breite, v => {
      if (!(v > 0)) return;
      schreib(() => { f.breite = v; });
      ctx.fl.zeichne();
    }, { typ: 'number', min: 0.5, max: 500, step: 0.1, einheit: 'm' }),
    feld('Länge', f.laenge, v => {
      if (!(v > 0)) return;
      schreib(() => { f.laenge = v; });
      ctx.fl.zeichne();
    }, { typ: 'number', min: 0.5, max: 500, step: 0.1, einheit: 'm' })
  );
  g.appendChild(masse);

  g.appendChild(feld('Drehung', Math.round(f.drehung || 0), v => {
    schreib(() => { f.drehung = ((Number(v) || 0) % 360 + 360) % 360; });
    ctx.fl.zeichne();
  }, { typ: 'number', min: 0, max: 359, step: 5, einheit: '°' }));

  const farbe = el('div', 'feld');
  farbe.appendChild(el('span', 'feld-titel', 'Farbe auf der Karte'));
  const reihe = el('div', 'farbreihe');
  for (const c of ['#003399', ...FARBEN]) {
    const b = el('button', 'farbe' + (c === f.farbe ? ' aktiv' : ''));
    b.style.setProperty('--farbe', c);
    b.style.background = c;
    b.title = c;
    b.onclick = () => store.aendern(() => { f.farbe = c; }, 'flaeche');
    reihe.appendChild(b);
  }
  farbe.appendChild(reihe);
  g.appendChild(farbe);

  if ((store.projekt.einsatzabschnitte || []).length) {
    g.appendChild(feld('Einsatzabschnitt', f.abschnitt || '', v => {
      store.aendern(() => { f.abschnitt = v || null; }, 'flaeche');
    }, {
      typ: 'select',
      werte: abschnittWerte(store.projekt, '— keinem zugeteilt (gilt für alle) —')
    }));
  }

  g.appendChild(feld('Bemerkung', f.bemerkung, v => schreib(() => { f.bemerkung = v; }),
    { typ: 'textarea', zeilen: 2 }));
  koerper.appendChild(g);

  const qm = Math.round(f.breite * f.laenge * 10) / 10;
  koerper.appendChild(el('p', 'klein',
    `${escapeHtml(art.name)} · ${qm.toLocaleString('de-DE')} m²` +
    (f.verbund ? ' · Teil einer Aufstellung: wird mit den anderen Teilen verschoben und gedreht.' : '')));
  koerper.appendChild(el('p', 'klein mono koord-hinweis',
    `${toMGRS(f.lat, f.lng, 5)}<br>${toDDM(f.lat, f.lng)}`));

  const tasten = el('div', 'tastenreihe');
  tasten.append(
    knopf('Auf Karte zeigen', () => {
      ctx.karte.setView([f.lat, f.lng], Math.max(ctx.karte.getZoom(), 18));
      ctx.zurKarte?.();
    }),
    knopf('Duplizieren', () => {
      store.aendern(p => {
        /* Die Kopie steht neben dem Original und gehört zu keinem Verbund –
           sonst zöge sie beim nächsten Griff die Aufstellung mit. */
        const k = { ...f, id: id(), verbund: null, lat: f.lat, lng: f.lng + 0.00006 * f.breite };
        p.flaechen.push(k);
        ctx.fl.auswahl = k.id;
      }, 'flaeche');
    })
  );
  if (f.verbund) {
    tasten.append(knopf('Aus der Aufstellung lösen', () => {
      store.aendern(() => { f.verbund = null; }, 'flaeche');
      hinweis('Die Fläche steht jetzt für sich.');
    }));
  }
  tasten.append(knopf('Löschen', () => {
    store.aendern(p => { p.flaechen = p.flaechen.filter(x => x.id !== f.id); }, 'flaeche');
    ctx.fl.auswahl = null;
    hinweis('Fläche gelöscht');
  }, 'gefahr'));
  koerper.appendChild(tasten);
  return koerper;
}

/**
 * Auswahl der Vorlage: erst die beiden Aufstellungen des Erkundungsblatts,
 * dann die einzelnen Flächen. `beiWahl` bekommt die gewählte Vorlage –
 * eine Art (`{id, …}`) oder eine Aufstellung (`{teile, …}`).
 */
export function flaechenPalette(beiWahl) {
  const box = el('div', 'fl-palette');
  const gruppe = (titel, eintraege) => {
    const teil = el('div');
    teil.appendChild(el('h4', '', escapeHtml(titel)));
    const reihe = el('div', 'fl-reihe');
    for (const e of eintraege) {
      const b = el('button', 'fl-knopf');
      b.type = 'button';
      b.innerHTML = `${e.bild}<span><b>${escapeHtml(e.name)}</b><small>${escapeHtml(e.masse)}</small></span>`;
      b.onclick = () => { beiWahl(e.vorlage); schliesseDialog(); };
      reihe.appendChild(b);
    }
    teil.appendChild(reihe);
    box.appendChild(teil);
  };

  gruppe('Führungsstelle nach Erkundungsblatt', AUFSTELLUNGEN.map(a => ({
    name: a.name, masse: a.masse, vorlage: a,
    bild: `<span class="fl-bild fl-reihe-bild">${a.teile.map(t => flaechenVorschau(t.art, 40)).join('')}</span>`
  })));
  gruppe('Einzelne Flächen', FLAECHENARTEN.map(a => ({
    name: a.name, masse: masseText(a), vorlage: a,
    bild: `<span class="fl-bild">${flaechenVorschau(a.id, 44)}</span>`
  })));
  box.appendChild(el('p', 'klein',
    `Die Fläche steht nach dem Klick auf die Karte maßstäblich dort; am Griff
     über der Fläche lässt sie sich drehen, im Eintrag die Maße ändern. Eine
     Aufstellung setzt ihre Teile Kante an Kante und hält sie beim Verschieben
     und Drehen zusammen.`));

  dialog({ titel: 'Fläche einzeichnen', inhalt: box, breit: true, fuss: [{ text: 'Abbrechen' }] });
}

// ---------------------------------------------------------------- Relaisstellen

/* Eine Relaisstelle beantwortet eine andere Frage als die Richtfunkstrecke.
   Dort steht fest, wohin es gehen soll, und gefragt ist, ob die eine Strecke
   trägt. Hier steht fest, wo der Mast steht, und gefragt ist, wohin man von
   dort überhaupt kommt – die Antwort ist eine Fläche und keine Linie.

   Das prägt das Formular: die Stellschrauben stehen oben (Band, Masthöhe,
   Gegenstelle, Umkreis), darunter, was sich daraus rechnet, und ganz unten die
   Fläche. Wer an der Masthöhe dreht, sieht die Strahlerlänge und den
   Funkhorizont sofort mitgehen; die Fläche kostet dagegen einen Kachelabruf und
   wird deshalb auf Knopfdruck geholt – aber nicht gespeichert (siehe den
   Zwischenspeicher in relais.js). */

/* Antwort der Rückwärtsrechnung je Relaisstelle: welchen Ort jemand angeklickt
   hat und was dabei herauskam. Flüchtig wie der Befund selbst – sie gilt für
   eine Masthöhe, und die kann im nächsten Griff eine andere sein. */
const masthoehen = new Map();

/* Die Geländehöhe führt sich selbst nach, wie beim Richtfunk auch: sie ist eine
   Angabe, die der Nutzer nicht abtippen soll, aber im Auftrag festgeschrieben
   stehen muss. Angestoßen wird sie beim Aufbau des Formulars und nur, solange
   sie fehlt – die Sperre verhindert, dass der Neuaufbau, den das Schreiben
   auslöst, den Abruf gleich noch einmal anwirft. */
const hoehenLaeuft = new Set();

function grundhoehePlanen(r) {
  if (r.grundhoehe !== null && r.grundhoehe !== undefined) return;
  if (hoehenLaeuft.has(r.id)) return;
  hoehenLaeuft.add(r.id);
  hoeheAn(r.lat, r.lng)
    .then(h => {
      if (h === null || !isFinite(h)) return;
      /* Ohne Undo-Punkt: der Nutzer hat diese Zahl nicht eingegeben, und ein
         Rückgängig, das nur eine nachgeschlagene Höhe zurücknimmt, ginge ins
         Leere. */
      store.aendern(() => { r.grundhoehe = Math.round(h); }, 'relais', { undo: false });
      zeichneRelaisListe();
    })
    .catch(() => { /* ohne Höhe bleibt das Feld leer und ist von Hand zu füllen */ })
    .finally(() => hoehenLaeuft.delete(r.id));
}

export function zeichneRelaisListe() {
  const p = store.projekt;
  const liste = document.getElementById('relais-liste');
  const summe = document.getElementById('relais-summe');
  if (!liste) return;
  liste.innerHTML = '';
  const stellen = p.relaisstellen || [];
  const abschnitte = obersteAbschnitte(p);

  /* Vor allem anderen: die liegenden Flächen an den Stand angleichen. Wer die
     Masthöhe ändert, ändert den Befund – und die Fläche zur alten Höhe darf
     nicht liegen bleiben, während das Formular schon die neue zeigt. Erst
     danach steht fest, was die Kopfzeile und die Knöpfe zu melden haben. */
  if (ctx.rl) ctx.rl.flaechenNachfuehren();

  /* Die Kopfzeile trägt die Überdeckung, sobald sie liegt: sie ist die Aussage
     über die Planung als Ganzes und gehört deshalb über die Liste und nicht in
     einen einzelnen Eintrag. */
  const roh = ctx.rl && ctx.rl.ueberdeckungAn ? ctx.rl.ueberdeckungBefund() : null;
  const gesamt = roh === 'zu_weit' ? null : roh;
  summe.innerHTML = !stellen.length ? ''
    : gesamt
      ? `<span><b>${stellen.length}</b> ${stellen.length === 1 ? 'Relaisstelle' : 'Relaisstellen'}</span>
         <span>frei <b>${escapeHtml(flaecheText(gesamt.flaecheFrei))}</b></span>
         <span>Rand <b>${escapeHtml(flaecheText(gesamt.flaecheRand))}</b></span>`
      : `<span><b>${stellen.length}</b> ${stellen.length === 1 ? 'Relaisstelle' : 'Relaisstellen'}</span>`;

  if (roh === 'zu_weit') {
    liste.appendChild(el('p', 'rl-befund rl-warnung',
      'Die Relaisstellen liegen zu weit auseinander für eine gemeinsame Fläche. ' +
      'Sie überdecken einander dann ohnehin nicht – die Flächen sind einzeln zu ' +
      'betrachten.'));
  } else if (gesamt) {
    liste.appendChild(el('p', 'rl-befund', escapeHtml(ausbreitungText(gesamt))));
    liste.appendChild(zonenErklaerung());
  }

  if (!stellen.length) {
    liste.appendChild(el('div', 'leer',
      `<p><b>Noch keine Relaisstelle gesetzt.</b></p>
       <p>„Relaisstelle setzen“ wählen und den Standort auf der Karte anklicken.
       Band, Antennenhöhe über Grund und die Höhe der Gegenstelle stehen dann im
       Eintrag; auf Knopfdruck wird die Fläche gerechnet, die von dort über das
       Gelände erreicht wird.</p>
       <p class="klein">Gerechnet wird Sichtlinie mit Erdkrümmung und dazu die
       Beugung an der Geländekante. Bewuchs und Bebauung stehen in den Höhendaten
       nicht – die Fläche ist die günstigste Annahme und kein Empfangsnachweis.</p>`));
    if (!abschnitte.length) return;
  }

  if (!abschnitte.length) {
    for (const r of alphabetisch(stellen, relaisTitel)) liste.appendChild(relaisKarte(r));
    return;
  }
  for (const ea of abschnitte) liste.appendChild(abschnittGruppe(ea, 'relais'));
  if (relaisstellenIm(p, null).length) liste.appendChild(abschnittGruppe(null, 'relais'));
}

/** Die drei Zonen in Worten – neben jeder Fläche, nie in einer Hilfe. */
function zonenErklaerung() {
  const box = el('div', 'rl-zonen');
  const klasse = { 3: 'z-frei', 2: 'z-rand', 1: 'z-schatten' };
  for (const z of ZONEN_ERKLAERUNG) {
    box.appendChild(el('p', 'rl-zone ' + klasse[z.zone],
      `<span></span><span><b>${escapeHtml(z.name)}</b> <i>${escapeHtml(z.text)}</i></span>`));
  }
  return box;
}

function relaisKarte(r) {
  const gewaehlt = ctx.rl.auswahl === r.id;
  const zustand = r.sichtbar === false ? ' verborgen'
    : (relaisstelleSichtbar(store.projekt, r) ? '' : ' entzogen');
  const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : '') + zustand);

  const kopf = el('header', 'eintrag-kopf');
  kopf.innerHTML =
    `<span class="farbpunkt" style="--farbe:${r.farbe || '#6a1b9a'}"></span>
     <button type="button" class="eintrag-name" aria-expanded="${gewaehlt}">${escapeHtml(relaisTitel(r))}</button>
     <span class="eintrag-wert">${escapeHtml(relaisKurz(r))}</span>
     ${augenKnopf(r.sichtbar !== false)}`;
  kopf.onclick = () => ctx.rl.waehle(gewaehlt ? null : r.id);
  kopf.querySelector('[data-akt="sichtbar"]').onclick = e => {
    e.stopPropagation();
    store.aendern(() => { r.sichtbar = r.sichtbar === false; }, 'relais');
    ctx.rl.flaechenZeichnen();
  };
  karte.appendChild(kopf);

  if (gewaehlt) karte.appendChild(relaisFormular(r));
  return karte;
}

function relaisFormular(r) {
  grundhoehePlanen(r);
  const koerper = el('div', 'eintrag-koerper');
  const band = bosBandById(r.band);
  const aktualisieren = () => zeichneRelaisListe();

  const g = el('div', 'feldgruppe');
  /* Das Neuzeichnen der Marke gehört in den Nachlauf von `schreib` und nicht
     daneben: die Eingabe wird gesammelt und erst nach 100 ms geschrieben: eine
     Marke, die sofort neu gezeichnet wird, trägt noch den vorigen Wert und
     hinkt der Eingabe um einen Anschlag hinterher. */
  g.appendChild(feld('Bezeichnung', r.name, v => {
    schreib(() => { r.name = v; }, () => ctx.rl.zeichne());
  }, { platzhalter: 'z. B. Relais Kuppe Nord' }));

  const funk = el('div', 'feld-paar');
  funk.append(
    /* Der Bandwechsel zieht den Umkreis NICHT mit: er ist beim Anlegen eine
       Vorgabe des Bandes, danach eine Entscheidung des Planers, und eine
       Entscheidung soll ein Wechsel des Bandes nicht überschreiben. */
    feld('Frequenzband', r.band, v => {
      store.aendern(() => { r.band = bosBandById(v).id; }, 'relais');
      ctx.rl.zeichne();
    }, { typ: 'select', werte: BOS_BAENDER.map(b => [b.id, b.name]) }),
    feld('Kanal', r.kanal, v => schreib(() => { r.kanal = v; }),
      { platzhalter: 'lt. Frequenzzuteilung' })
  );
  g.appendChild(funk);

  const masse = el('div', 'feld-paar');
  masse.append(
    feld('Antennenhöhe über Grund', r.antennenhoehe, v => {
      if (!(v > 0)) return;
      schreib(() => { r.antennenhoehe = v; }, () => { ctx.rl.zeichne(); aktualisieren(); });
    }, { typ: 'number', min: 1, max: 100, step: 0.5, einheit: 'm' }),
    feld('Mast / Träger', r.mast, v => schreib(() => { r.mast = v; }),
      { platzhalter: 'z. B. Teleskopmast 10 m' })
  );
  g.appendChild(masse);

  const umgebung = el('div', 'feld-paar');
  umgebung.append(
    /* Die Gegenstelle steht als eigene Wahl da und nicht als stille Annahme:
       eine Fläche für die Fahrzeugantenne gilt für das Handfunkgerät am Mann
       nicht mehr, und der Unterschied ist erheblich. */
    feld('Gegenstelle', r.gegenstelle, v => {
      store.aendern(() => { r.gegenstelle = gegenstelleById(v).id; }, 'relais');
      ctx.rl.zeichne();
    }, { typ: 'select', werte: GEGENSTELLEN.map(x => [x.id, x.name]) }),
    feld('Umkreis der Rechnung', Math.round(r.umkreis / 1000), v => {
      if (!(v > 0)) return;
      schreib(() => {
        r.umkreis = Math.min(UMKREIS_MAX, Math.max(UMKREIS_MIN, Math.round(v) * 1000));
      }, aktualisieren);
    }, { typ: 'number', min: 1, max: UMKREIS_MAX / 1000, step: 1, einheit: 'km' })
  );
  g.appendChild(umgebung);

  /* Der Schalter steht bei den Stellschrauben und nicht bei den Anzeigen: er
     ändert die Rechnung und nicht die Darstellung. Beide Stellungen sind
     brauchbar – die Fläche ohne Bewuchs sagt, was das Gelände allein hergibt,
     und der Unterschied zwischen beiden sagt, was der Wald kostet. */
  g.appendChild(feld('Bewuchs und Bebauung', r.mitBewuchs === false ? 'nein' : 'ja', v => {
    store.aendern(() => { r.mitBewuchs = v === 'ja'; }, 'relais');
  }, {
    typ: 'select',
    werte: [['ja', 'verdecken mit (Oberflächenmodell)'], ['nein', 'nur nacktes Gelände']]
  }));

  g.appendChild(feld('Geländehöhe am Standort', r.grundhoehe ?? '', v => {
    schreib(() => { r.grundhoehe = v === '' ? null : Number(v); }, aktualisieren);
  }, {
    typ: 'number', step: 1, einheit: 'm NN',
    platzhalter: hoehenLaeuft.has(r.id) ? 'wird geholt …' : 'aus dem Geländemodell'
  }));

  if ((store.projekt.einsatzabschnitte || []).length) {
    g.appendChild(feld('Einsatzabschnitt', r.abschnitt || '', v => {
      store.aendern(() => { r.abschnitt = v || null; }, 'relais');
    }, {
      typ: 'select',
      werte: abschnittWerte(store.projekt, '— keinem zugeteilt (gilt für alle) —')
    }));
  }

  g.appendChild(feld('Trupp / Betreiber', r.trupp, v => schreib(() => { r.trupp = v; })));

  /* Dieselbe Bedienform wie beim taktischen Zeichen: ein Knopf mit Vorschau und
     Namen, nicht ein schreibgeschütztes Textfeld. Das Zeichen wird gewählt und
     nicht getippt – und der Name ist lang genug, dass er in der Schmalansicht
     in einem halbbreiten Feld abgeschnitten würde. */
  const symZeile = el('div', 'feld');
  symZeile.appendChild(el('span', 'feld-titel', 'Taktisches Zeichen'));
  const symKnopf = el('button', 'symbol-waehler');
  symKnopf.type = 'button';
  symKnopf.innerHTML = `${symbolSVG({ symbol: r.symbol, breite: 34 })}
    <span>${escapeHtml(symbolById(r.symbol).name)}</span><span class="pfeil">▾</span>`;
  symKnopf.onclick = () => symbolPalette(sym => {
    store.aendern(() => { r.symbol = sym; }, 'relais');
    ctx.rl.zeichne();
  });
  symZeile.appendChild(symKnopf);
  g.appendChild(symZeile);

  g.appendChild(feld('Bemerkung', r.bemerkung, v => schreib(() => { r.bemerkung = v; }),
    { typ: 'textarea', zeilen: 2 }));
  koerper.appendChild(g);

  // -- Was sich aus den Angaben rechnet, ohne eine einzige Höhenkachel
  koerper.appendChild(werteHTML(r, band));
  koerper.appendChild(el('p', 'klein', escapeHtml(GEGENGEWICHT_HINWEIS)));
  for (const h of band.hinweise) koerper.appendChild(el('p', 'klein', escapeHtml(h)));

  koerper.appendChild(el('p', 'klein mono koord-hinweis',
    `${toMGRS(r.lat, r.lng, 5)}<br>${toDDM(r.lat, r.lng)}`));

  // -- Die Fläche und die Rückwärtsrechnung
  const tasten = el('div', 'tastenreihe');
  const liegt = ctx.rl.zeigtFlaeche(r.id);
  tasten.append(
    knopf(liegt ? 'Ausbreitung ausblenden' : 'Ausbreitung zeigen', ev => {
      const taste = ev && ev.currentTarget;
      if (taste && !liegt) { taste.disabled = true; taste.textContent = 'Höhen werden geholt …'; }
      ctx.rl.flaecheUmschalten(r)
        .then(e => {
          if (e === null) hinweis('Für diesen Umkreis liegen keine Höhen vor.', 'fehler');
          aktualisieren();
        })
        .catch(() => {
          hinweis('Die Höhendaten waren nicht zu erreichen.', 'fehler');
          aktualisieren();
        });
    }, 'klein'),
    knopf(ctx.rl.zielModus === r.id ? 'Zielwahl abbrechen' : 'Masthöhe bis zu einem Ort …', () => {
      if (ctx.rl.zielModus === r.id) { ctx.rl.beendeZielwahl(); return aktualisieren(); }
      ctx.rl.starteZielwahl(r.id);
      ctx.zurKarte?.();
      hinweis('Den Ort auf der Karte anklicken, der erreicht werden soll.');
      aktualisieren();
    }, 'klein')
  );
  koerper.appendChild(tasten);

  const befund = befundLesen(r);
  if (liegt && befund) {
    /* Der Ausfall des Oberflächenmodells bekommt die Warnfarbe: die Fläche
       sieht dann aus wie eine mit Bewuchs und ist keine. */
    const ausgefallen = befund.bewuchsGewuenscht && !befund.mitBewuchs;
    koerper.appendChild(el('p', 'rl-befund' + (ausgefallen ? ' rl-warnung' : ''),
      escapeHtml(ausbreitungText(befund, band))));
    /* Steht der Mast im Bestand, ist das die Ursache einer schwarzen Karte –
       und dieser Satz erspart die Suche nach dem Fehler an der falschen Stelle. */
    const bestand = bestandText(befund);
    if (bestand) koerper.appendChild(el('p', 'rl-befund rl-warnung', escapeHtml(bestand)));
    koerper.appendChild(zonenErklaerung());
  }

  const mh = masthoehen.get(r.id);
  if (mh) {
    const warnt = mh.ergebnis && mh.ergebnis.urteil === 'hoeher';
    const schwach = !mh.ergebnis || mh.ergebnis.urteil === 'unbeurteilbar';
    const kasten = el('p', 'rl-befund' + (warnt ? ' rl-warnung' : schwach ? ' rl-schwach' : ''),
      escapeHtml(masthoeheText(mh.ergebnis, 'der Ort ' + toMGRS(mh.ziel.lat, mh.ziel.lng, 4))));
    koerper.appendChild(kasten);
  }

  const weiter = el('div', 'tastenreihe');
  weiter.append(
    knopf('Auf Karte zeigen', () => {
      ctx.karte.setView([r.lat, r.lng], Math.max(ctx.karte.getZoom(), 14));
      ctx.zurKarte?.();
    }),
    knopf('Duplizieren', () => {
      store.aendern(p => {
        /* Die Kopie steht daneben und trägt keine Geländehöhe: die gehört zum
           Standort des Originals und wäre hier eine Behauptung. */
        const k = { ...r, id: id(), name: r.name + ' (Kopie)', lng: r.lng + 0.002, grundhoehe: null };
        p.relaisstellen.push(k);
        ctx.rl.auswahl = k.id;
      }, 'relais');
      ctx.rl.zeichne();
    }),
    knopf('Löschen', () => {
      store.aendern(p => { p.relaisstellen = p.relaisstellen.filter(x => x.id !== r.id); }, 'relais');
      ctx.rl.auswahl = null;
      masthoehen.delete(r.id);
      ctx.rl.gezeigt.delete(r.id);
      ctx.rl.flaechenZeichnen();
      ctx.rl.zeichne();
      hinweis('Relaisstelle gelöscht');
    }, 'gefahr')
  );
  koerper.appendChild(weiter);
  return koerper;
}

/* Die abgeleiteten Werte. Alle vier brauchen keine einzige Höhenkachel und
   stehen deshalb sofort da – sie sind die Zahlen, mit denen am Mastfuß
   gearbeitet wird, während die Fläche noch geholt wird.

   Der Funkhorizont ist eine obere Schranke über glatter Kugel und wird auch so
   benannt: „bis“ und nicht „reicht“. Ohne dieses Wort läse er sich als
   Reichweitenzusage, und das ist er nicht (siehe bosfunk.js). */
function werteHTML(r, band) {
  const st = strahlermasse(band);
  const zielhoehe = gegenstellenhoehe(r.gegenstelle, r.antennenhoehe);
  const horizont = sichtweite(r.antennenhoehe, zielhoehe);
  const nn = r.grundhoehe === null || r.grundhoehe === undefined
    ? null : Number(r.grundhoehe) + Number(r.antennenhoehe || 0);
  const km = m => (Math.round(m / 100) / 10).toLocaleString('de-DE',
    { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';

  const zeilen = [
    ['λ/4-Strahler', `${strahlerText(st.mitte)}`],
    ['Spanne über das Band', `${strahlerText(st.kurz)} – ${strahlerText(st.lang)}`],
    ['Antennenmitte', nn === null ? '–' : `${Math.round(nn).toLocaleString('de-DE')} m NN`],
    ['Sichtweite bis', km(horizont)]
  ];
  const box = el('div', 'rl-werte');
  box.innerHTML = zeilen.map(([t, w]) =>
    `<span><i>${escapeHtml(t)}</i><b>${escapeHtml(w)}</b></span>`).join('');
  return box;
}

/**
 * Antwort auf die Zielwahl: welche Masthöhe die Relaisstelle bis zu diesem Ort
 * bräuchte. Wird von der Kartenebene über app.js hereingereicht.
 */
export function relaisZielAntwort(rid, ziel) {
  const r = store.relaisstelle(rid);
  if (!r) return;
  masthoehen.set(rid, { ziel, ergebnis: null });
  zeichneRelaisListe();
  masthoeheFuer(r, ziel)
    .then(m => { masthoehen.set(rid, { ziel, ergebnis: m }); zeichneRelaisListe(); })
    .catch(() => {
      masthoehen.delete(rid);
      hinweis('Die Höhendaten waren nicht zu erreichen.', 'fehler');
      zeichneRelaisListe();
    });
}

/** Überdeckung aller sichtbaren Relaisstellen ein- und ausschalten. */
export function ueberdeckungUmschalten(taste) {
  const an = ctx.rl.ueberdeckungAn;
  if (taste && !an) { taste.disabled = true; taste.textContent = 'Höhen werden geholt …'; }
  const fertig = () => {
    if (taste) {
      taste.disabled = false;
      taste.textContent = ctx.rl.ueberdeckungAn ? '◍ Überdeckung ausblenden' : '◍ Überdeckung aller';
    }
    zeichneRelaisListe();
  };
  ctx.rl.ueberdeckungUmschalten()
    .then(e => {
      if (e === 'zu_weit') {
        hinweis('Die Relaisstellen liegen zu weit auseinander für eine gemeinsame Fläche.', 'warnung');
      } else if (e === null) {
        hinweis('Keine sichtbare Relaisstelle, oder keine Höhen zu bekommen.', 'warnung');
      }
      fertig();
    })
    .catch(() => { hinweis('Die Höhendaten waren nicht zu erreichen.', 'fehler'); fertig(); });
}

// ---------------------------------------------------------------- Lichtbilder

/* Ein Lichtbild vom Bauort beantwortet Fragen, für die es keine Zeichenerklärung
   gibt: wie der Mast steht, wo die Einführung sitzt, wie breit der Graben werden
   muss. Es tritt deshalb neben die taktischen Zeichen und nicht in sie hinein –
   ein Bild ist keine Aussage über die Lage, sondern ein Beleg.

   Bewusst ohne Zuteilung zu Einsatzabschnitt und Zeichengruppe: die beiden
   Gliederungen tragen das Lagebild, und ein Beleg gehört zu jedem, der an der
   Stelle baut. */

export function zeichneBilderListe() {
  const p = store.projekt;
  const liste = document.getElementById('bilder-liste');
  const summe = document.getElementById('bilder-summe');
  if (!liste) return;
  liste.innerHTML = '';

  const bilder = p.bilder || [];
  const ohneOrt = bilder.filter(b => b.lat === null).length;
  summe.innerHTML = bilder.length
    ? `<span><b>${bilder.length}</b> ${bilder.length === 1 ? 'Bild' : 'Bilder'}</span>
       <span>Belegt <b>${Math.round(bilderBelegung(p) / 1024)} kB</b></span>
       ${ohneOrt ? `<span class="summe-mahnung"><b>${ohneOrt}</b> ohne Ort</span>` : ''}
       ${bildmarkenAn(p) ? '' : `<span class="summe-mahnung" title="Kartenoptionen → Bildmarken">Auf der Karte ausgeblendet</span>`}`
    : '';

  if (!bilder.length) {
    liste.appendChild(el('div', 'leer',
      `<p><b>Noch keine Bilder in dieser Planung.</b></p>
       <p>„Bilder vom Gerät hinzufügen“ wählen – oder Bilddateien aus einem Ordner
       auf die Karte ziehen. Jedes Bild setzt sich an den Ort, den die Kamera beim
       Auslösen aufgezeichnet hat; auf der Karte steht dort ein Punkt, der beim
       Überfahren aufgeht.</p>
       <p class="klein">JPEG und HEIC vom iPhone. Die Bilder bleiben wie die Planung
       auf diesem Gerät. Sie gehen in die Sicherungsdatei ein, erscheinen aber nicht
       im Bauauftrag und nicht in den Austauschformaten.</p>`));
    return;
  }

  for (const b of alphabetisch(bilder, bildSchluessel)) liste.appendChild(bildKarte(b));
}

function bildKarte(b) {
  const gewaehlt = ctx.bl.auswahl === b.id;
  /* Ohne Ort steht das Bild nicht auf der Karte – das ist kein Ausblenden,
     sondern eine offene Aufgabe und wird als solche benannt. */
  const zustand = b.sichtbar === false ? ' verborgen' : (b.lat === null ? ' ortlos' : '');
  const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : '') + zustand);

  /* Zweizeilig: abgeschnitten wird am Ende, und dort steht bei einer
     zusammengesetzten Ortsbezeichnung das Unterscheidende – „…-Nordseite“
     gegen „…-Suedseite“, „…-vorher“ gegen „…-nachher“. Bei 320 px fehlten
     210 px des Namens. Darunter steht, was zwei Aufnahmen desselben Ortes
     ebenfalls trennt: die Uhrzeit und die Gitterangabe. */
  const kennung = [
    b.aufgenommen ? zeitpunkt(b.aufgenommen) : '',
    b.lat === null ? '' : toMGRS(b.lat, b.lng, 3)
  ].filter(Boolean).join(' · ');
  const kopf = el('header', 'eintrag-kopf');
  kopf.innerHTML =
    `<span class="mini-bild"></span>
     <button type="button" class="eintrag-name bild-name" aria-expanded="${gewaehlt}">
       <b>${escapeHtml(bildTitel(b))}</b>
       ${kennung ? `<span class="bild-kennung">${escapeHtml(kennung)}</span>` : ''}
     </button>
     ${b.lat === null ? '<span class="eintrag-wert ortlos-marke">ohne Ort</span>' : ''}
     ${augenKnopf(b.sichtbar !== false)}`;
  vorschauEinsetzen(kopf.querySelector('.mini-bild'), b, miniUrl);
  kopf.onclick = () => ctx.bl.waehle(gewaehlt ? null : b.id);
  kopf.querySelector('[data-akt="sichtbar"]').onclick = e => {
    e.stopPropagation();
    store.aendern(() => { b.sichtbar = b.sichtbar === false; }, 'bild');
  };
  karte.appendChild(kopf);

  if (gewaehlt) karte.appendChild(bildFormular(b));
  return karte;
}

/** Beschriftung, unter der ein Bild in Liste und Vorschau steht */
const bildTitel = b => b.name || (b.aufgenommen ? zeitpunkt(b.aufgenommen) : 'Lichtbild');

/* Sortiert wird wie überall nach dem Text der Zeile – nur trägt ein Bild ohne
   eigenen Namen dort seine Aufnahmezeit, und die steht deutsch mit dem Tag
   voran. Nach dieser Schreibweise zu sortieren stellte den 5. März vor den
   12. Januar; verglichen wird deshalb der ISO-Zeitpunkt. Er beginnt mit einer
   Ziffer und bringt die noch unbenannten Bilder damit gemeinsam an den Anfang
   der Liste, untereinander in der Reihenfolge des Auslösens. */
const bildSchluessel = b => b.name || b.aufgenommen || 'Lichtbild';

/* Einmal angelegt: `toLocaleString` mit Optionen baut je Aufruf einen neuen
   Formatierer, und die Liste ruft das je Bild – bei sechzig Bildern war das
   ein Zwanzigstel des ganzen Neuzeichnens. */
const zeitFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });
function zeitpunkt(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : zeitFormat.format(d);
}

/* Die Bilddaten kommen aus dem Bildspeicher und damit erst nach dem Aufbau der
   Zeile. Das Feld hat deshalb schon vorher seine Größe – sonst zuckte die
   ganze Liste, sobald die Bilder eintreffen. */
function vorschauEinsetzen(halter, b, adresse) {
  if (!halter) return;
  adresse(b.id).then(url => {
    if (!url || !halter.isConnected) return;
    const bild = document.createElement('img');
    bild.src = url;
    bild.alt = '';
    halter.appendChild(bild);
  }).catch(() => { /* fehlt das Bild, bleibt das Feld leer – die Angaben stehen weiter */ });
}

function bildFormular(b) {
  const koerper = el('div', 'eintrag-koerper');

  const schau = el('button', 'bild-schau');
  schau.type = 'button';
  schau.title = 'Bild groß ansehen';
  vorschauEinsetzen(schau, b, bildUrl);
  schau.onclick = () => bildAnsehen(b);
  koerper.appendChild(schau);

  const g = el('div', 'feldgruppe');
  g.appendChild(feld('Beschriftung', b.name, v => schreib(() => { b.name = v; }),
    { platzhalter: 'z. B. Mastfuß an der Einfahrt' }));
  g.appendChild(feld('Bemerkung', b.bemerkung, v => schreib(() => { b.bemerkung = v; }),
    { typ: 'textarea', zeilen: 2 }));
  koerper.appendChild(g);

  const angaben = [];
  if (b.aufgenommen) angaben.push(`Aufgenommen ${escapeHtml(zeitpunkt(b.aufgenommen))}`);
  if (b.richtung !== null) {
    angaben.push(`Blickrichtung ${Math.round(b.richtung)}° (${himmelsrichtung(b.richtung)})`);
  }
  if (angaben.length) koerper.appendChild(el('p', 'klein', angaben.join(' · ')));

  koerper.appendChild(el('p', 'klein mono koord-hinweis', b.lat === null
    ? 'Die Kamera hat keinen Ort aufgezeichnet.'
    : `${toMGRS(b.lat, b.lng, 5)}<br>${toDDM(b.lat, b.lng)}`));

  /* Woher der Ort stammt, entscheidet, ob die Marke am Griff hängt. Das gehört
     an die Koordinate und nicht nur in die Sperre selbst – sonst sucht man auf
     der Karte nach einem Griff, den es aus gutem Grund nicht gibt. */
  if (b.lat !== null) {
    koerper.appendChild(el('p', 'klein', b.ortAusKamera
      ? 'Ort <b>von der Kamera aufgezeichnet</b>. Er ist auf der Karte gegen Verschieben '
        + 'gesichert – zu ändern nur über „Ort von Hand setzen“.'
      : 'Ort <b>von Hand gesetzt</b>. Die Marke lässt sich auf der Karte verschieben.'));
  }

  const tasten = el('div', 'tastenreihe');
  tasten.append(knopf('Groß ansehen', () => bildAnsehen(b)));
  if (b.lat === null) {
    tasten.append(knopf('Ort auf Karte setzen', () => ctx.bildOrtSetzen(b.id), 'primaer'));
  } else {
    tasten.append(
      knopf('Auf Karte zeigen', () => {
        ctx.karte.setView([b.lat, b.lng], Math.max(ctx.karte.getZoom(), 16));
        ctx.zurKarte?.();
      }),
      knopf(b.ortAusKamera ? 'Ort von Hand setzen' : 'Ort neu setzen',
        () => ctx.bildOrtSetzen(b.id))
    );
  }
  tasten.append(knopf('Löschen', () => {
    store.aendern(p => { p.bilder = p.bilder.filter(x => x.id !== b.id); }, 'bild');
    ctx.bl.auswahl = null;
    hinweis('Bild gelöscht');
  }, 'gefahr'));
  koerper.appendChild(tasten);
  return koerper;
}

/**
 * Das Bild in voller Größe – am Bauort der einzige Weg, es genau anzusehen.
 *
 * Ein Blatt und kein gewöhnlicher Dialog: das Bild bekommt, was zwischen Kopf
 * und Angaben übrig bleibt, und die Angaben stehen fest darunter. Vorher war
 * das Bild auf `88vh - 180px` gedeckelt und die Angaben rutschten bei einem
 * hochkant aufgenommenen Bild unter die Blattkante – dort, wo niemand sie
 * sucht. Quer war es überdies kleiner als die Vorschau in der Liste, aus der
 * man es geöffnet hatte.
 */
export function bildAnsehen(b) {
  const box = el('div', 'bild-gross');
  const flaeche = el('div', 'bg-bild');
  box.appendChild(flaeche);
  bildUrl(b.id).then(url => {
    if (!url || !box.isConnected) {
      flaeche.appendChild(el('p', 'klein fehlertext',
        'Zu diesem Eintrag liegen keine Bilddaten vor.'));
      return;
    }
    const bild = document.createElement('img');
    bild.src = url;
    bild.alt = bildTitel(b);
    flaeche.appendChild(bild);
  });

  /* Untereinander und nicht in einem Satz mit Mittelpunkten: die Bemerkung
     vom Bauort ist ein Satz und keine Angabe, und zwischen zwei Angaben
     gelesen geht sie unter. */
  const angaben = el('div', 'bg-angaben');
  if (b.bemerkung) angaben.appendChild(el('p', 'bg-bemerkung', escapeHtml(b.bemerkung)));
  const zeilen = [];
  if (b.aufgenommen) zeilen.push(`Aufgenommen ${escapeHtml(zeitpunkt(b.aufgenommen))}`);
  if (b.richtung !== null) {
    zeilen.push(`Blick ${Math.round(b.richtung)}° (${himmelsrichtung(b.richtung)})`);
  }
  if (zeilen.length) angaben.appendChild(el('p', 'klein', zeilen.join(' · ')));
  angaben.appendChild(el('p', 'klein mono', b.lat === null
    ? 'Ohne Ort – die Kamera hat keinen aufgezeichnet.'
    : escapeHtml(toMGRS(b.lat, b.lng, 5))));
  box.appendChild(angaben);

  dialog({ titel: bildTitel(b), inhalt: box, breit: true, fuellend: true,
           fuss: [{ text: 'Schließen', primaer: true }] });
}

/**
 * Bilddateien übernehmen und das Ergebnis in einem Satz melden.
 * Aufgerufen aus der Dateiauswahl und vom Abwurf auf die Karte.
 */
export async function bilderUebernehmen(dateien) {
  const anzahl = Array.from(dateien || []).length;
  if (!anzahl) return;

  let ergebnis;
  try {
    ergebnis = await bilderAufnehmen(dateien, ({ nr, anteil }) => fortschritt(
      anzahl === 1 ? 'Bild wird übernommen …' : `Bild ${nr} von ${anzahl} wird übernommen …`,
      anteil));
  } catch (e) {
    return hinweis('Bilder konnten nicht übernommen werden: ' + e.message, 'fehler');
  }

  const { angenommen, ohneOrt, abgewiesen } = ergebnis;
  if (!angenommen.length) {
    // Der Grund kommt aus verschiedenen Quellen und bringt seinen Punkt teils mit
    const grund = (abgewiesen[0]?.grund || '').replace(/\.$/, '');
    hinweis(grund ? `Kein Bild übernommen – ${grund}.` : 'Kein Bild übernommen.', 'fehler');
    return ergebnis;
  }

  /* Der Satz nennt beides: was angekommen ist und was fehlt. Ein Bild ohne
     Ortsangabe verschwindet sonst still in der Liste, und der Nutzer sucht es
     auf der Karte. */
  const teile = [`${angenommen.length} ${angenommen.length === 1 ? 'Bild' : 'Bilder'} übernommen`];
  if (ohneOrt) teile.push(`${ohneOrt} davon ohne Ortsangabe der Kamera`);
  if (abgewiesen.length) teile.push(`${abgewiesen.length} nicht lesbar`);
  hinweis(teile.join(' – '), ohneOrt || abgewiesen.length ? 'warnung' : 'info');
  return ergebnis;
}

// ---------------------------------------------------------------- Baudokumentation

/* Der Reiter des Baumodus. Er sieht anders aus als die übrigen Listen, weil er
   woanders bedient wird: mit Handschuh, bei Tageslicht, einhändig, oft im
   Stehen. Deshalb keine aufklappbaren Einträge und keine Dialoge für den
   Normalfall – die Punkte stehen untereinander, und an jedem hängen die drei
   Griffe, die es gibt: bestätigen, hier peilen, auf der Karte setzen.

   Die Reihenfolge folgt der Planung, nicht der Uhrzeit: beim abschnittsweisen
   Bau laufen zwei Trupps aufeinander zu (Hdb Feldfernkabelbau, 3.6), und der eine
   beginnt am Ende der Trasse. */

export function zeichneBauListe() {
  const p = store.projekt;
  const liste = document.getElementById('bau-liste');
  const summe = document.getElementById('bau-summe');
  const wahl = document.getElementById('bau-strecke');
  if (!liste || !wahl) return;

  /* Die Liste wird bei jeder Änderung neu gebaut, und ein Auswahlfeld, das
     dabei den Fokus verliert, ist mit der Tastatur nicht in einem Zug zu
     bedienen: „offen“ → „im Bau“ → „gebaut“ verlangte drei Mal neu zugreifen.
     Textfelder trifft es nicht, die schreiben über `schreib()` mit dem Grund
     „formular“ und lösen keinen Neuaufbau aus. Gerettet wird über die Marke am
     Feld und nicht über das Element – nach dem Neuaufbau gibt es das alte
     nicht mehr. */
  const warFokus = document.activeElement;
  const marke = warFokus && liste.contains(warFokus) ? warFokus.dataset.bauFeld : null;

  const s = baustrecke();
  wahl.innerHTML = '';
  for (const st of p.strecken) {
    const op = document.createElement('option');
    op.value = st.id;
    op.textContent = st.name + (bauBegonnen(st) ? ` · ${baustandById(st.bau.stand).kurz}` : '');
    op.selected = s && st.id === s.id;
    wahl.appendChild(op);
  }
  wahl.onchange = () => {
    /* Ein laufender Setzmodus gehört der bisherigen Strecke: der nächste Tipp
       auf die Karte landete sonst in der Baudokumentation einer Strecke, die
       der Trupp gerade nicht baut – und die einzige Stelle, die noch die alte
       nennt, ist die Modusleiste, die schmal hinter der Liste liegt. */
    ctx.sl.beendeIstSetzen();
    ctx.modusAnzeigen?.();
    baustreckeSetzen(wahl.value);
    zeichneBauListe();
    ctx.sl.zeichne();
  };

  liste.innerHTML = '';
  /* Das Auswahlfeld geht mit, solange es nichts zu wählen gibt: ein leeres
     Feld mit der Überschrift „Diese Strecke wird gebaut“ behauptet eine Wahl,
     die es nicht gibt, und lässt den Nutzer daran ziehen. */
  const wahlFeld = wahl.closest('.bau-wahl');
  if (wahlFeld) wahlFeld.hidden = !p.strecken.length || !s;
  if (!p.strecken.length || !s) {
    summe.innerHTML = '';
    const leer = el('div', 'leer',
      `<p><b>Noch keine Strecke in dieser Planung.</b></p>
       <p>Der Baumodus schreibt fest, was an einer geplanten Strecke gebaut wurde.
       Ohne Planung gibt es nichts zu dokumentieren – im Planungsmodus eine
       Strecke zeichnen oder eine Planung laden.</p>`);
    /* Der Weg dorthin steht als Griff da und nicht nur als Satz: der
       Moduswechsel sitzt oben in der Kopfzeile, und wer hier landet, sucht
       ihn. Gegriffen wird derselbe Knopf, den auch die Kopfzeile trägt – ein
       zweiter Weg in denselben Zustand wäre einer zu viel. */
    leer.appendChild(knopf('Zur Planung', () => {
      document.getElementById('btn-modus').click();
    }, 'primaer breit'));
    liste.appendChild(leer);
    /* Der Vorratsblock bleibt trotzdem stehen. Sonst wäre „Vorrat löschen“
       genau dann unerreichbar, wenn es darauf ankommt: wer seine Planung
       gelöscht hat und die mitgenommenen Kacheln loswerden will, stünde vor
       einem leeren Reiter – und die Zusage in `datenschutz.html`, dass sich der
       Vorrat hier wegräumen lässt, wäre nicht eingelöst. */
    liste.appendChild(kartenvorratBlock(null));
    return;
  }

  const k = baukennzahlen(s);
  /* Der Zähler nennt BEIDE Zahlen. Vorher stand dort „0 von 4 Punkten“ neben
     „gebaut 65 m“, wenn der Trupp zwei zusätzliche Punkte aufgenommen hatte –
     zwei Angaben über denselben Sachverhalt, die einander widersprechen. Wer
     vor dem Absetzen am Zähler prüft, ob alles drin ist, las die Null.
     „Bestätigt“ statt bloß „von“: die Zahl sagt, wie viele GEPLANTE Punkte
     angesteuert wurden, und nicht, wie viel aufgenommen ist. */
  summe.innerHTML =
    `<span>Stand <b>${escapeHtml(k.stand.name)}</b></span>
     <span><b>${k.bestaetigt}</b> von ${k.sollPunkte} geplanten bestätigt</span>` +
    (k.zusaetzlich
      ? `<span><b>${k.zusaetzlich}</b> zusätzlich aufgenommen</span>` : '') +
    /* Die oberste Zeile ist die, die abgelesen und per Funk durchgegeben wird –
       sie trägt die Warnung selbst. Im Audit stand dort „gebaut 81,26 km“ in
       normaler Zahlenfarbe, während die Kachel weiter unten „prüfen“ sagte. */
    (k.laenge ? ((k.laengeFraglich || k.abseits.length)
      ? `<span class="bau-abw">gebaut <b>⚠ ${escapeHtml(formatLaenge(k.laenge))} – prüfen</b></span>`
      : `<span>gebaut <b>${escapeHtml(formatLaenge(k.laenge))}</b></span>`) : '') +
    (k.abweichungen.length
      ? `<span class="bau-abw"><b>${k.abweichungen.length}</b> ${k.abweichungen.length === 1 ? 'Abweichung' : 'Abweichungen'}</span>`
      : '') +
    (k.abseits.length
      ? `<span class="bau-abw"><b>${k.abseits.length}</b> ${k.abseits.length === 1 ? 'Punkt' : 'Punkte'} abseits der Trasse</span>`
      : '') +
    /* Was aufgenommen, aber nicht ausgesagt ist, steht neben den Abweichungen
       und nicht darunter: beides ist eine Nachfrage an den Trupp, und diese
       hier lässt sich am Bauort noch beantworten. */
    (k.luecken
      ? `<span class="bau-abw"><b>${k.luecken}</b> ohne Angabe</span>` : '');

  const bloecke = {
    punkte: bauPunktBlock(s),
    meldungen: bauMeldungBlock(s),
    material: klappbar(bauMaterialBlock(s, k), 'material'),
    uebergabe: klappbar(bauUebergabeBlock(s, k), 'uebergabe'),
    rueckweg: bauRueckwegBlock(s),
    vorrat: klappbar(kartenvorratBlock(s), 'vorrat')
  };
  /* Der Sprungstreifen steht VOR dem Kopfblock. Dahinter lag er bei 390×690 in
     der Grundstellung des Reiters mit seiner zweiten Reihe – „Absetzen“,
     „Karte mitnehmen“, „▤ Doku“ – halb unter dem Umschalter Liste/Karte, der
     dort festliegt: sichtbar genug, um danach zu greifen, und ein Tipp darauf
     traf den Umschalter und warf den Trupp auf die Karte. Betroffen war
     ausgerechnet der Chip, der am häufigsten gebraucht wird.

     Die Reihenfolge stimmt auch sachlich: erst wohin, dann die Zahlen. Wer den
     Reiter öffnet, sucht eine Stelle darin – die Kennzahlen liest er, wenn er
     dort ist. */
  liste.appendChild(sprungstreifen(bloecke, s));
  liste.appendChild(baukopfBlock(s, k));
  liste.appendChild(bauabschnittBlock(s));
  liste.appendChild(bloecke.punkte);
  /* Die Baumeldungen stehen VOR dem Materialnachweis, obwohl der Ablauf
     andersherum liest. Der Grund ist der Daumen: gemeldet wird laufend, nach
     jeder Kabellänge, der Bogen wird einmal am Ende gefüllt. Hinter dem
     Materialnachweis läge der Griff „Meldung mitschreiben“ rund tausend Bildpunkte
     tief im Blatt – genau der Griff, der am häufigsten gebraucht wird. */
  liste.appendChild(bloecke.meldungen);
  liste.appendChild(bloecke.material);
  liste.appendChild(bauSchlussBlock(s, k));
  liste.appendChild(bloecke.uebergabe);
  liste.appendChild(bloecke.rueckweg);
  /* Der Kachelvorrat steht ganz am Ende. Er stand zuerst vorn – anderthalb
     Bildschirme, bevor der erste Trassenpunkt kam –, dabei geschieht das
     Mitnehmen im Depot und nie am Bauort. Wer es braucht, hat den Sprung
     dorthin oben im Streifen. */
  liste.appendChild(bloecke.vorrat);

  if (marke) {
    const wieder = liste.querySelector(`[data-bau-feld="${CSS.escape(marke)}"]`);
    if (wieder) wieder.focus();
  }
}

/* Der Sprungstreifen: die Liste des Bau-Reiters ist tausende Bildpunkte lang,
   und am Bauort wird darin nach einer Stelle gesucht, nicht gelesen. Die Chips
   springen an die Blöcke, die dort gebraucht werden; gerollt wird im
   Reiterinhalt, in dem die Liste steht.

   Zwei Chips sind dazugekommen. „Absetzen“ führt zum Rückmeldeblock – der
   Abschluss jedes Bauabschnitts, nach Vorschrift wiederholt abzusetzen, und
   ausgerechnet er fehlte in der Reihe; vom ersten Punkt aus lagen fast sieben
   Schirmhöhen dazwischen. „▤ Doku“ springt nicht, sondern schlägt die
   Baudokumentation auf: sie ist das Blatt, das beim Trupp verbleibt, und ihr
   einziger Aufruf stand am Ende der Liste – eine Stelle, die mit jeder
   Eintragung weiter wandert und an der niemand suchen kann.

   Die Chips brechen um, statt waagerecht zu rollen. Vorher ragte die Reihe
   469 px in eine 296 px breite Ansicht, ohne Rollbalken: bei 320 px war vom
   letzten Chip nichts zu sehen, bei 390 px zwei Buchstaben. Wer den Chip nicht
   sieht, rollt doch – dann verfehlt die Leiste ihren Zweck, ohne dass es
   auffällt. */
window.addEventListener('online', () => document.querySelectorAll('.vorrat-chip').forEach(vorratChip));
window.addEventListener('offline', () => document.querySelectorAll('.vorrat-chip').forEach(vorratChip));
function vorratChip(chip) {
  chip.classList.add('vorrat-chip');
  kachelBestand().then(b => {
    const netz = navigator.onLine !== false;
    chip.classList.toggle('vorrat-leer', !b.anzahl);
    /* Kurz, denn der Streifen soll in wenigen Zeilen stehen: die Marke sagt
       den Zustand, der Mahnton den Handlungsbedarf. */
    /* Derselbe Name wie im Hinweis nach „Bau beginnen“ („oben ‚Karte
       mitnehmen‘“) – im Audit suchten vier Prüfer einen Knopf, der auf dem
       Schirm „Karte fehlt“ hieß. Ohne Netz steht das im Chip selbst: der
       Titel erscheint am Finger nie, und die Statusleiste liegt in der
       Listenansicht unter dem Umschalter. */
    chip.textContent = (b.anzahl ? 'Karte dabei ✓' : 'Karte mitnehmen') + (netz ? '' : ' · kein Netz');
    chip.title = b.anzahl ? `${b.anzahl} Kacheln im Gerät${netz ? '' : ' · kein Netz'}`
      : netz ? 'Noch keine Karte im Gerät – mitnehmen, solange Netz da ist' : 'Keine Karte im Gerät und kein Netz';
  }).catch(() => { /* dann bleibt die Beschriftung */ });
}

function sprungstreifen(bloecke, s) {
  const streifen = el('nav', 'bau-sprung');
  streifen.setAttribute('aria-label', 'Im Bau-Reiter springen');
  /* „Karte mitnehmen“ und nicht „Karte“: der Umschalter zwischen Liste und
     Karte steht schmal gleichzeitig im Bild und heißt ebenso. Ein Tipp auf den
     falschen der beiden führte in den Kachelvorrat statt auf die Karte – und
     der Rückweg kostete am Bauort zwei weitere Griffe. */
  /* „Zurückmelden“ statt „Absetzen“: neben „Meldungen“ las sich „Absetzen“ wie
     ein zweiter Weg zu denselben Funkmeldungen, und das Wort versprach, dass
     etwas beim Empfänger ankommt. Der Chip führt zum Rückweg an den Planer.
     „Karte mitnehmen“ steht vorn: sie ist der erste Handgriff, solange noch
     Netz da ist, und nicht der letzte. */
  const ziele = [
    ['vorrat', 'Karte mitnehmen'], ['punkte', 'Punkte'], ['meldungen', 'Meldungen'],
    ['material', 'Material'], ['uebergabe', 'Übergabe'], ['rueckweg', 'Zurückmelden']
  ];
  for (const [schluessel, text] of ziele) {
    const chip = knopf(text, () => {
      /* Ein Sprung auf einen zugeklappten Block zeigte nur dessen Überschrift –
         der Chip klappt ihn deshalb mit auf. */
      const ziel = bloecke[schluessel];
      bauZu.delete(schluessel);
      ziel.classList.remove('zu');
      const griff = ziel.querySelector('.fg-griff');
      if (griff) griff.setAttribute('aria-expanded', 'true');
      ziel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'klein');
    streifen.appendChild(chip);
    /* Der Chip der Karte sagt, was im Gerät liegt – und ob gerade Netz da ist.
       Im Audit sah er mit leerem Vorrat genauso aus wie mit vollem, und der
       Trupp konnte in der Liste nicht sagen, ob er die Karte dabei hat. */
    if (schluessel === 'vorrat') vorratChip(chip);
  }
  const doku = knopf('▤ Doku', () => oeffneBaudoku(s.id), 'klein bau-sprung-doku');
  doku.title = 'Baudokumentation als PDF';
  if (!bauBegonnen(s)) {
    doku.disabled = true;
    doku.title = `An „${s.name}“ ist noch nichts aufgenommen.`;
  }
  streifen.appendChild(doku);
  return streifen;
}

/* Datum und Uhrzeit sind am Bauplatz die teuerste Eingabe überhaupt: ein
   schmales Feld, ein Kalenderaufsatz darüber, zwei Hände. Baubeginn, Bauende
   und der Zeitpunkt der Übergabe blieben deshalb leer – und damit fehlten im
   Kopf der Baudokumentation genau die Zeiten, die sie belegen soll. Den Griff
   gab es im Bestand schon, aber nur am Planungskopf.

   Gerechnet wird mit der ORTSZEIT und nicht über `toISOString()`: das Feld
   `datetime-local` erwartet sie so, wie die Uhr sie zeigt, und eine
   UTC-Angabe säße im Sommer zwei Stunden daneben. */
const jetztFuerFeld = () => {
  const d = new Date();
  const zwei = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}` +
         `T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
};

/** Ein Zeitfeld mit dem Griff „Jetzt“ daneben */
function zeitfeld(titel, wert, beiAenderung, marke = '') {
  const reihe = el('div', 'zeit-reihe');
  const f = feld(titel, wert, beiAenderung, { typ: 'datetime-local' });
  const ein = f.querySelector('input');
  if (marke) ein.dataset.bauFeld = marke;
  reihe.appendChild(f);
  reihe.appendChild(knopf('Jetzt', () => {
    const jetzt = jetztFuerFeld();
    ein.value = jetzt;
    beiAenderung(jetzt);
  }, 'klein'));
  return reihe;
}

/** Ein Feld, das den Fokus über den Neuaufbau der Liste behält */
function merkeFeld(el, marke) {
  const ein = el.querySelector('input,select,textarea');
  if (ein) ein.dataset.bauFeld = marke;
  return el;
}

/* Rund 20 kB je Kachel – ab einem Megabyte wird in MB gerechnet, darunter
   bliebe eine fünfstellige Kilobytezahl stehen, die niemand liest. */
const mengenText = bytes => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })}\u00a0MB`
  : `${Math.round(bytes / 1024)}\u00a0kB`;

/* Der laufende Abruf steht modulweit und nicht im Block: die Liste wird bei
   jeder Änderung an der Planung neu gebaut, und ein Griff, der dabei verloren
   geht, lässt sich nicht mehr abbrechen – der Abruf liefe im Hintergrund bis
   zum Deckel weiter, während der Knopf schon wieder Bereitschaft meldet. */
let vorratLaeuft = null;

/* Der Kachelvorrat. Er steht im Baumodus und nicht in den Kartenoptionen:
   geholt wird er vor dem Ausrücken, und wer ihn braucht, ist schon hier.

   Ohne ihn ist der Baumodus am Bauort blind – die Anwendung startet dank des
   Wächters in `sw.js` zwar ohne Netz, aber die Karte bliebe grau, und
   „antippen, wo der Punkt wirklich liegt“ ginge ins Leere. */
function kartenvorratBlock(s) {
  const box = el('div', 'feldgruppe bau-vorrat');
  box.appendChild(el('h3', 'gruppen-titel', 'Karte für den Bauort mitnehmen'));

  const umfangZeile = el('p', 'klein vorrat-umfang');
  const standZeile = el('p', 'klein vorrat-stand');
  const basis = basiskarteById(store.projekt.ansicht.basemap);
  box.appendChild(umfangZeile);

  const punkteFuer = alles => {
    const strecken = alles ? store.projekt.strecken : (s ? [s] : []);
    /* Ein Ist-Punkt weit abseits der Trasse – eine Ortung 80 km daneben –
       zog den Korridor bis dorthin, und die Deckelung fraß die feinen Stufen
       der echten Trasse. Er kommt nicht mit; genommen wird, was plausibel am
       Bauort liegt. */
    return strecken.flatMap(st => {
      const fern = new Set(baukennzahlen(st).abseits.map(a => a.ist));
      return [...(st.punkte || []), ...istPunkte(st).filter(pt => !fern.has(pt))];
    });
  };
  let allesMitnehmen = !s;
  let bisZoom = ZOOM_BIS;

  if (s) {
    box.appendChild(feld('Umfang', 'diese', w => { allesMitnehmen = w === 'alle'; umfangZeigen(); }, {
      typ: 'select',
      werte: [['diese', 'nur diese Strecke'], ['alle', 'alle Strecken der Planung']]
    }));
  }
  /* Die Feinheit ist eine echte Entscheidung und kein Feinschliff: über der
     obersten mitgenommenen Stufe bleibt die Karte am Bauort grau, und der
     FMBauplaner lässt bis Stufe 22 zoomen – beim Einmessen einer Muffe wird
     genau dorthin gezoomt. Eine Stufe mehr kostet dabei das Vierfache. */
  box.appendChild(feld('Feinheit', String(ZOOM_BIS), w => { bisZoom = Number(w); umfangZeigen(); }, {
    typ: 'select',
    werte: [[String(ZOOM_BIS), `bis Stufe ${ZOOM_BIS} – Häuser erkennbar`],
            [String(ZOOM_BIS + 1), `bis Stufe ${ZOOM_BIS + 1} – viermal so viele Kacheln`]]
  }));

  function umfangZeigen() {
    const punkte = punkteFuer(allesMitnehmen);
    if (!punkte.length) {
      umfangZeile.innerHTML = 'Ohne Trassenpunkte gibt es keinen Ausschnitt zum Mitnehmen.';
      return;
    }
    const u = kachelUmfang(punkte, { zoomBis: bisZoom });
    umfangZeile.innerHTML =
      `<b>${escapeHtml(basis.name)}</b> entlang der Trasse, ${PUFFER}&nbsp;m beiderseits, ` +
      `Zoomstufen ${ZOOM_VON} bis ${bisZoom}: ` +
      `etwa <b>${u.anzahl.toLocaleString('de-DE')} Kacheln</b> (geschätzt ${escapeHtml(mengenText(u.bytes))})` +
      (u.ausgelassen
        ? `. <b class="vorrat-warnung">${u.ausgelassen.toLocaleString('de-DE')} Kacheln bleiben liegen</b> – ` +
          `mehr als ${KACHEL_HOECHSTENS.toLocaleString('de-DE')} werden nicht geholt.`
        : '.') +
      `<br>Feiner als Stufe ${bisZoom} bleibt die Karte am Bauort leer.`;
  }
  umfangZeigen();

  const tasten = el('div', 'tastenreihe bau-tasten');
  const holen = knopf(vorratLaeuft ? 'Abbrechen' : '↓ Karte holen', () => {
    if (vorratLaeuft) { vorratLaeuft.abbrechen(); return; }
    const punkte = punkteFuer(allesMitnehmen);
    if (!punkte.length) return hinweis('Diese Strecke hat noch keine Trassenpunkte.', 'warnung');
    /* Ohne Netz lief der Abruf bis zum vollen Balken durch und meldete danach
       „Karte mitgenommen: 0 Kacheln“ – im Vorbeigehen liest man das erste
       Wort und rückt ein zweites Mal ohne Karte aus. Die Kacheln kommen aus
       dem Netz, auch wenn sie danach im Gerät liegen. */
    if (navigator.onLine === false) {
      return hinweis('Ohne Netz ist nichts zu holen – die Kacheln kommen von außen, ' +
        'auch wenn sie danach im Gerät liegen.', 'warnung');
    }
    /* Nicht jede Karte darf mitgenommen werden – siehe das Kennzeichen
       `vorrat` in `js/map.js`. Die Meldung nennt den Ausweg, weil der Nutzer
       ihn sonst suchen müsste. */
    if (!basis.vorrat) {
      return hinweis(`„${basis.name}“ lässt sich nicht mitnehmen: ihre Nutzungs-` +
        'bedingungen erlauben kein Vorabladen. In den Kartenoptionen auf eine ' +
        'Karte des BKG wechseln – TopPlusOpen oder basemap.de.', 'warnung');
    }
    holen.textContent = 'Abbrechen';
    vorratLaeuft = kachelVorladen(basis.url, basis.id, punkte, {
      zoomBis: bisZoom,
      /* Gezählt werden die Kacheln, die wirklich im Gerät liegen, und nicht
         die erledigten Abrufe. Ohne Netz lief der Balken sonst bis ans Ende
         durch, während nichts ankam – und wer daneben steht, liest den vollen
         Balken als „fertig“ und rückt aus. */
      beiFortschritt: (fertig, gesamt, stand) => {
        const da = stand.geholt + stand.vorhanden;
        fortschritt(`Karte wird geholt … ${da} von ${gesamt} Kacheln im Gerät` +
          (stand.fehler ? ` · ${stand.fehler} ohne Antwort` : ''), da / gesamt);
      }
    });
    vorratLaeuft.lauf.then(e => {
      vorratLaeuft = null;
      holen.textContent = '↓ Karte holen';
      /* Was am Ende zählt, ist die Zahl im Gerät – das Geholte und das, was
         schon dalag. Wer denselben Ausschnitt ein zweites Mal mitnimmt, hört
         sonst „0 Kacheln“, obwohl die Karte vollständig da ist. */
      const da = e.geholt + e.vorhanden;
      if (e.speicherVoll) {
        hinweis(`Das Gerät ist voll – ${da} Kacheln liegen da, der Rest fehlt. ` +
          'Platz schaffen und noch einmal holen.', 'fehler');
      } else {
        /* Der Kopf der Meldung richtet sich nach dem Ergebnis: ist keine
           Kachel angekommen, ist die Karte NICHT mitgenommen – und das gehört
           in die ersten beiden Wörter. Im Vorbeigehen liest man nicht weiter,
           und eine Null hinter einem „mitgenommen“ schickt den Trupp ein
           zweites Mal ohne Karte los. */
        hinweis(e.abgebrochen
          ? `Abgebrochen – ${da} von ${e.gesamt} Kacheln liegen im Gerät.`
          : !da
            ? `Karte nicht mitgenommen – keine von ${e.gesamt} Kacheln angekommen, ` +
              `${e.fehler} Abrufe ohne Antwort. Das Netz ist weg oder die Karte ` +
              'lässt sich nicht mitnehmen.'
            : `Karte mitgenommen: ${da} von ${e.gesamt} Kacheln, ${mengenText(e.bytes)}` +
              (e.fehler ? ` · ${e.fehler} fehlen` : ''),
          !da ? 'fehler' : e.fehler ? 'warnung' : 'info');
      }
      standZeigen();
    }).catch(f => {
      vorratLaeuft = null;
      holen.textContent = '↓ Karte holen';
      hinweis('Karte konnte nicht geholt werden: ' + f.message, 'fehler');
    });
  }, 'bau-taste primaer');
  tasten.append(holen, knopf('Vorrat löschen', () => {
    kachelVorratLeeren().then(() => { hinweis('Kachelvorrat gelöscht'); standZeigen(); })
      .catch(f => hinweis('Löschen fehlgeschlagen: ' + f.message, 'fehler'));
  }, 'klein'));
  box.appendChild(tasten);
  box.appendChild(standZeile);

  function standZeigen() {
    kachelBestand().then(b => {
      if (!b.anzahl) { standZeile.innerHTML = 'Noch nichts im Gerät.'; return; }
      /* Welche Karte im Vorrat liegt, gehört dazu: der Vorrat hängt an der
         Kartenwahl, und wer nach dem Holen die Karte wechselt, steht am Bauort
         vor einer grauen Fläche, während hier ein stattlicher Bestand steht. */
      const namen = b.karten.map(id => basiskarteById(id).name);
      const passt = b.karten.includes(basis.id);
      standZeile.innerHTML =
        `Im Gerät: <b>${b.anzahl.toLocaleString('de-DE')} Kacheln</b> ` +
        `(${escapeHtml(mengenText(b.bytes))})` +
        (namen.length ? ` für ${escapeHtml(namen.join(', '))}` : '') + '.' +
        (passt ? '' : ` <b class="vorrat-warnung">Die eingestellte Karte „${escapeHtml(basis.name)}“ ` +
          'ist nicht dabei – am Bauort bliebe sie leer.</b>');
    });
  }
  standZeigen();

  box.appendChild(el('p', 'klein',
    'Geholt wird nur der Korridor der Trasse, mit Bedacht und gedeckelt: die ' +
    'Nutzungsbedingungen der Kartenanbieter untersagen das massenhafte ' +
    'Vorabladen, und wer dort auffällt, steht am Ende ganz ohne Karte da. ' +
    'Mitnehmen lassen sich deshalb nur die Karten des BKG. Die Karte im ' +
    'Bauauftrag und auf der Lagekarte bleibt ohne Netz leer – sie wird in ' +
    'Graustufen gezeichnet, und die sind nicht im Vorrat. Das Blatt kommt aus ' +
    'der Unterkunft mit.'));
  /* Beim Betrachten sieht der Anbieter den Ausschnitt, in dem gearbeitet wird.
     Beim Vorladen sieht er mehr: die Kacheln kommen in einem Zug und liegen in
     einem schmalen Band – und dieses Band ist die Trasse, auf Kachelbreite
     gerundet. Das ist ein Unterschied, den der Nutzer vor dem Knopfdruck
     kennen muss und nicht danach. */
  box.appendChild(el('p', 'klein vorrat-hinweis',
    'Der Kartenanbieter sieht dabei mehr als beim gewöhnlichen Betrachten: die ' +
    'Kacheln kommen in einem Zug und liegen in einem schmalen Band. Daraus ist ' +
    'der Verlauf der Trasse auf einige hundert Meter genau abzulesen – nicht ' +
    'ihre Punkte, aber ihr Weg; und wo Ist-Punkte aufgenommen sind, zählen die ' +
    'mit. Wer das nicht möchte, nimmt die Karte nicht mit und baut ohne sie.'));
  return box;
}

/* Kopf: der Baustand und die Zahlen, die ihn stützen. Der Stand ist ein
   Auswahlfeld und kein Knopfweg – er springt nicht nur vorwärts: eine Leitung,
   die bei der Übernahmemessung durchfällt, geht von „übergeben“ zurück auf
   „gebaut“ (Hdb Feldfernkabelbau, 3.5). */
function baukopfBlock(s, k) {
  const box = el('div', 'feldgruppe bau-kopf');

  /* Die Warnung steht über allem, nicht bei den Zahlen: sie ist das, was der
     Truppführer vor dem Absetzen sehen muss, und wer unter Zeitdruck auf den
     Schirm sieht, liest die erste Zeile und nicht die vierte. Im Audit stand
     „gebaut 143,49 km“ bei 2,71 km Plan in derselben Schrift wie jede andere
     Zahl – ein Zusatzpunkt war 82 km neben der Trasse geortet worden. */
  if (k.abseits.length || k.laengeFraglich) {
    const w = el('div', 'bau-warnung bau-kopf-warnung');
    const a = k.abseits[0];
    /* Sind es mehrere, sagt der Kasten das: im Audit meldete der Kopf „3 Punkte
       abseits“, und der Kasten darunter nannte nur einen. */
    const weitere = k.abseits.length > 1
      ? ` Dazu ${k.abseits.length - 1} ${k.abseits.length === 2 ? 'weiterer' : 'weitere'} – siehe „Abweichungen“.` : '';
    w.innerHTML = a && a.soll
      ? `<b>Prüfen:</b> Punkt ${s.punkte.indexOf(a.soll) + 1} ist ` +
        `${escapeHtml(formatLaenge(a.meter))} neben seinem geplanten Ort bestätigt. ` +
        'Stimmt die Ortung?' + weitere
      : a
      ? `<b>Prüfen:</b> ein zusätzlicher Punkt liegt ${escapeHtml(formatLaenge(a.meter))} ` +
        'neben der geplanten Trasse. Stimmt der Standort?' + weitere
      : `<b>Prüfen:</b> die gebaute Trasse ist mit ${escapeHtml(formatLaenge(k.laenge))} ` +
        `weit länger als die geplante (${escapeHtml(formatLaenge(k.sollLaenge))}).`;
    if (a) {
      w.appendChild(knopf('Auf der Karte zeigen', () => {
        ctx.karte.setView([a.ist.lat, a.ist.lng], Math.max(ctx.karte.getZoom(), 16));
        ctx.zurKarte?.();
      }, 'klein'));
    }
    box.appendChild(w);
  }

  const standFeld = feld('Stand des Baus', k.stand.id, wert => {
    /* „Übergeben“ ist ein Abschluss mit Unterschrift, kein Zwischenstand. Er
       geht mit der Baumeldung an den Planer, und dort las er sich als geprüfte
       Leitung. Im Audit ließ er sich wählen, ohne dass jemand, irgendwann oder
       irgendetwas gemessen war. Gesperrt wird nicht – die Übergabe kann auf
       Papier geschehen sein –, aber gefragt, mit dem, was fehlt. */
    const ue = uebergabestand(s);
    const fehlt = [];
    if (wert === 'uebergeben') {
      if (!ue.an) fehlt.push('an wen übergeben wurde');
      if (!ue.zeit) fehlt.push('wann übergeben wurde');
      if (!ue.zeilen) fehlt.push('eine Messung oder Sprechprobe');
      else if (ue.offen) fehlt.push(`${ue.offen} ungeprüfte ${ue.offen === 1 ? 'Leitung' : 'Leitungen'}`);
      if (ue.durchgefallen) fehlt.push(`${ue.durchgefallen} durchgefallene Prüfung`);
    }
    const setzen = () => store.aendern(() => { bauSichern(s).stand = wert; }, 'bau');
    if (!fehlt.length) { setzen(); return; }
    /* Das Feld springt sofort zurück: geht der Dialog über Esc oder den
       Schleier zu, stünde sonst „übergeben“ im Feld und etwas anderes in der
       Planung. */
    standFeld.querySelector('select').value = k.stand.id;
    dialog({
      titel: 'Als übergeben melden?',
      inhalt: `<p>Für eine Übergabe fehlt noch:</p>
               <ul>${fehlt.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
               <p class="klein">Der Stand geht mit der nächsten Baumeldung an den Planer
               und steht dort als fertige Leitung.</p>`,
      /* Hervorgehoben ist der Weg zur Übergabe, nicht an ihr vorbei: unter
         Zeitdruck wird der blaue Knopf getippt, und im Audit war das
         „Trotzdem übergeben“. */
      fuss: [
        { text: 'Trotzdem übergeben', tun: setzen },
        { text: 'Übergabe erfassen', primaer: true, tun: () => {
          bauZu.delete('uebergabe');
          zeichneBauListe();
          setTimeout(() => document.querySelector('.bau-uebergabe')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        } }
      ]
    });
  }, { typ: 'select', werte: BAUSTAENDE.map(b => [b.id, b.name]), klasse: 'bau-stand' });
  /* Wo es weitergeht. Nach einer Unterbrechung – Anruf, Funk, der Browser hat
     den Reiter weggeräumt – stand im Audit die Liste wieder von oben, und
     niemand wusste, welcher Punkt zuletzt dran war. Der letzte Eintrag steht
     deshalb in der Beschriftung des Standes, mit der Plan-Kennung daneben –
     dort kostet er keine eigene Zeile. Ein Tipp darauf öffnet sein Blatt. */
  const letzter = istPunkte(s).reduce((a, b) => (!a || (b.zeit || '') > (a.zeit || '') ? b : a), null);
  const titel = standFeld.querySelector('.feld-titel');
  if (titel) {
    titel.classList.add('bau-stand-titel');
    if (letzter) {
      const nr = letzter.sollPunkt ? s.punkte.findIndex(p => p.id === letzter.sollPunkt) + 1 : 0;
      /* Ein `span` mit Knopfrolle und kein `button`: ein Knopf im Label wäre
         dessen erstes beschriftbares Element und nähme dem Auswahlfeld seine
         Beschriftung. */
      const z = el('span', 'bau-zuletzt',
        `zuletzt ${escapeHtml(nr ? `Punkt ${nr}` : punktartText(letzter))}` +
        `${letzter.zeit ? ` · ${escapeHtml(uhrzeit(letzter.zeit))}` : ''}`);
      z.setAttribute('role', 'button');
      z.tabIndex = 0;
      z.title = 'Dieses Blatt öffnen';
      const oeffnen = e => {
        e.preventDefault();
        ctx.karte.setView([letzter.lat, letzter.lng], Math.max(ctx.karte.getZoom(), 16));
        ctx.zurKarte?.();
        punktkarteOeffnen(s, { ist: letzter });
      };
      z.onclick = oeffnen;
      z.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') oeffnen(e); };
      titel.appendChild(z);
    }
    titel.insertAdjacentHTML('beforeend', kennungHTML(s));
  }
  box.appendChild(merkeFeld(standFeld, 'stand'));

  const zahlen = el('div', 'bau-zahlen');
  const zeile = (titel, wert, klasse = '') =>
    `<div class="bz ${klasse}"><span class="bz-titel">${escapeHtml(titel)}</span>
     <span class="bz-wert">${wert}</span></div>`;
  /* Hervorgehoben wird der Unterschied erst, wenn die Aufnahme steht. Während
     des Baus ist er keine Abweichung, sondern der Rest des Weges: bei zwei von
     vier aufgenommenen Punkten stand dort „−702 m“ in Warnfarbe, und das las
     sich wie ein Befund über eine Trasse, die noch gar nicht fertig
     dokumentiert ist. Maßgeblich ist der Baustand und nicht die Punktzahl – der
     Trupp setzt ihn, wenn er fertig ist, und nur er weiß das. */
  const fertigGebaut = k.stand.id === 'gebaut' || k.stand.id === 'uebergeben';
  const fraglich = k.laengeFraglich || k.abseits.length > 0;
  zahlen.innerHTML =
    zeile('geplant', escapeHtml(formatLaenge(k.sollLaenge))) +
    /* Ist die gebaute Länge unplausibel, steht sie selbst als fraglich da und
       nicht in derselben Zahlenfarbe wie jede andere. Im Audit wurde „81 km
       gebaut“ abgelesen und so durchgegeben. */
    (fraglich
      ? zeile('gebaut – prüfen', `⚠ ${escapeHtml(formatLaenge(k.laenge))}`, 'bz-fraglich')
      : zeile('gebaut', k.laenge ? escapeHtml(formatLaenge(k.laenge)) : '–')) +
    /* Die Beschriftung sagt, dass die Zahl noch nicht gilt – das spart den
       Erklärsatz darunter, den der Reiter am Bauort nicht auch noch tragen
       kann. */
    zeile(fertigGebaut ? 'Unterschied' : 'Unterschied (offen)', k.laengenUnterschied
      ? `${k.laengenUnterschied > 0 ? '+' : '−'}${escapeHtml(formatLaenge(Math.abs(k.laengenUnterschied)))}`
      : '–', fraglich ? 'bz-fraglich' : fertigGebaut && Math.abs(k.laengenUnterschied) > 0 ? 'bz-merken' : '');
  box.appendChild(zahlen);


  if (k.laenge) {
    box.appendChild(el('p', 'klein',
      'Gebaut = Trasse zwischen den aufgenommenen Punkten, ohne Zuschlag und Reserve. ' +
      'Den Kabelverbrauch sagt der Materialnachweis.'));
  }
  return box;
}

/* Bauabschnitte: die Aufteilung EINER Strecke unter mehrere Trupps. Sie ist
   freiwillig – eine Strecke, die ein Trupp allein baut, braucht keine. */
function bauabschnittBlock(s) {
  const box = el('div', 'feldgruppe bau-abschnitte');
  const abschnitte = bauabschnitte(s);
  box.appendChild(el('h3', 'gruppen-titel', 'Bauabschnitte und Trupps'));

  if (!abschnitte.length) {
    box.appendChild(el('p', 'klein',
      'Ohne Bauabschnitt gilt die ganze Strecke als ein Auftrag. Bauen zwei ' +
      'Trupps aufeinander zu, bekommt jeder seinen.'));
  }

  for (const a of abschnitte) {
    const zeile = el('div', 'ba-eintrag');
    zeile.style.setProperty('--farbe', a.farbe);
    const kopf = el('div', 'ba-kopf');
    /* Der Zustand steht als Wort daneben und nicht nur in der Farbe: am Bauort
       gibt es keinen `title`, und ein Knopf, der wie eine Überschrift aussieht,
       wird nicht gedrückt – dann trägt kein einziger Punkt seinen Trupp. */
    const aktivHier = a.id === (aktiverBauabschnitt(s) || {}).id;
    const marke = el('button', 'ba-marke' + (aktivHier ? ' aktiv' : ''),
      `<span class="ba-name">${escapeHtml(a.name)}</span>` +
      `<span class="ba-zustand">${aktivHier
        ? 'nimmt neue Punkte auf' : 'antippen, um hier einzutragen'}</span>`);
    marke.type = 'button';
    marke.setAttribute('aria-pressed', String(aktivHier));
    marke.onclick = () => {
      bauabschnittAktivSetzen(aktivHier ? null : a.id);
      zeichneBauListe();
    };
    kopf.appendChild(marke);
    const weg = el('button', 'mini-knopf gefahr', '✕');
    weg.title = `${a.name} löschen`;
    weg.onclick = () => {
      store.aendern(() => bauabschnittLoeschen(s, a.id), 'bau');
      if (bauabschnittAktivId() === a.id) bauabschnittAktivSetzen(null);
      hinweis(`${a.name} gelöscht – die aufgenommenen Punkte bleiben stehen. ` +
        '„Rückgängig“ in der Kopfzeile holt die Zuordnung zurück.');
    };
    kopf.appendChild(weg);
    zeile.appendChild(kopf);

    const felder = el('div', 'ba-felder');
    felder.appendChild(feld('Bezeichnung', a.name, w => schreib(() => { a.name = w; }), {}));
    felder.appendChild(feld('Trupp', a.trupp, w => schreib(() => { a.trupp = w; }),
      { platzhalter: 'z. B. 1. FmTr' }));
    felder.appendChild(feld('Truppführer', a.fuehrer, w => schreib(() => { a.fuehrer = w; }), {}));
    felder.appendChild(zeitfeld('Baubeginn', a.beginn, w => schreib(() => { a.beginn = w; })));
    felder.appendChild(zeitfeld('Bauende', a.ende, w => schreib(() => { a.ende = w; })));
    zeile.appendChild(felder);
    box.appendChild(zeile);
  }

  const tasten = el('div', 'tastenreihe');
  tasten.appendChild(knopf('+ Bauabschnitt', () => {
    let neu = null;
    store.aendern(() => { neu = bauabschnittAnlegen(s); }, 'bau');
    if (neu) bauabschnittAktivSetzen(neu.id);
    zeichneBauListe();
  }, 'klein'));
  box.appendChild(tasten);
  return box;
}

/**
 * Wer an diesem Gerät baut – zwei Felder im Rückmeldeblock.
 *
 * Die Frage wurde vorher nirgends gestellt: Trupp und Truppführer standen nur
 * am Bauabschnitt, und der ist freiwillig. Wer ohne Abschnitt baute – der
 * Regelfall bei einer Strecke, die ein Trupp allein macht –, setzte eine
 * Meldung ab, die niemanden nennt. Beim Planer hieß sie dann „ohne
 * Bauabschnitt“, und meldete ein zweiter Trupp an derselben Strecke, trat
 * dessen Aufnahme an die Stelle der ersten. Gewarnt wurde nur der Planer.
 *
 * Sie steht hier und nicht oben bei den Bauabschnitten, und zwar aus zwei
 * Gründen: hier WIRKT der Name – er geht in diesem Augenblick hinaus –, und
 * der Reiter trägt am Bauort keine Zeile, die nur ein Feld weiter oben
 * ankündigt. Wer Abschnitte angelegt hat, braucht ihn nicht: dann sagt der
 * Abschnitt, wer gebaut hat.
 *
 * Der Name liegt im GERÄTESPEICHER und nicht in der Planung (siehe
 * `truppAmGeraet` in `baudoku.js`) – er sagt, wer gerade am Gerät steht, und
 * geht mit der Baumeldung hinaus, nicht mit der weitergereichten Planung.
 */
function truppAmGeraetFelder() {
  const v = truppAmGeraet();
  const box = el('div', 'bau-geraet' + (v.trupp || v.fuehrer ? '' : ' bau-geraet-offen'));
  const felder = el('div', 'ba-felder');
  /* Geschrieben wird sofort und nicht über `schreib()`: der Vermerk liegt im
     Gerätespeicher und nicht in der Planung – es gibt keinen Undo-Schritt, der
     hier aufliefe. Die Liste wird erst beim nächsten Neuaufbau nachgezogen,
     damit das Feld den Fokus behält; beim Absetzen steht der Name richtig da. */
  felder.appendChild(feld('Trupp', v.trupp,
    w => truppAmGeraetSetzen({ ...truppAmGeraet(), trupp: w }),
    { platzhalter: 'z. B. 1. FmTr' }));
  felder.appendChild(feld('Truppführer', v.fuehrer,
    w => truppAmGeraetSetzen({ ...truppAmGeraet(), fuehrer: w }), {}));
  box.appendChild(felder);
  return box;
}

/* Die Punktliste – das Stück, an dem am Bauort wirklich gearbeitet wird. Jeder
   geplante Punkt steht da, ob er bestätigt ist oder nicht; darunter, was
   zusätzlich aufgenommen wurde. */
function bauPunktBlock(s) {
  const box = el('div', 'feldgruppe bau-punkte');
  box.appendChild(el('h3', 'gruppen-titel', 'Trassenpunkte'));
  const aktiv = aktiverBauabschnitt(s);
  if (aktiv) {
    box.appendChild(el('p', 'klein bau-zuschlag',
      `Neue Punkte gehen an <b>${escapeHtml(aktiv.name)}</b>` +
      (aktiv.trupp ? ` (${escapeHtml(aktiv.trupp)})` : '') + '.'));
  }

  s.punkte.forEach((pt, i) => box.appendChild(bauPunktZeile(s, pt, i)));

  const zusaetzlich = istPunkte(s).filter(x => !x.sollPunkt);
  if (zusaetzlich.length) {
    box.appendChild(el('h4', 'bau-untertitel', 'Zusätzlich aufgenommen'));
    for (const pt of zusaetzlich) box.appendChild(bauZusatzZeile(s, pt));
  }

  const tasten = el('div', 'tastenreihe bau-tasten');
  tasten.appendChild(knopf('◉ Punkt hier', () => istPunktAusStandort(s.id, null),
    'bau-taste'));
  tasten.appendChild(knopf('✛ Punkt auf Karte', () => {
    ctx.sl.starteIstSetzen(s.id, { abschnitt: aktiv ? aktiv.id : null });
    ctx.modusAnzeigen?.();
    ctx.zurKarte?.();
    hinweis('Auf die Karte tippen, wo der Punkt wirklich liegt.');
  }, 'bau-taste'));
  box.appendChild(tasten);
  box.appendChild(el('p', 'klein',
    'Ein zusätzlicher Punkt ist einer, den der Plan nicht kennt – ein Mast, der ' +
    'gestellt werden musste, eine Muffe, die dazukam.'));
  return box;
}

/** Eine Zeile je geplantem Punkt: bestätigt oder mit den drei Griffen */
function bauPunktZeile(s, pt, i) {
  const ist = istZuSoll(s, pt.id);
  /* Eine bestätigte Zeile zeigt ihr Formular erst auf Tipp. Aufgeklappt maß
     sie 298 bis 427 px statt 116 – bei drei bestätigten Punkten wuchs der
     Reiter dadurch von 4.002 auf 4.473 px, und der Griff des nächsten Punktes
     rutschte nach jeder Bestätigung aus dem Bild. Was eingeklappt stehen
     bleibt, ist der Befund: Nummer, Art, Herkunft der Koordinate und die
     Abweichung – genau das, was der Trupp beim Überfliegen sucht. */
  const zu = !!ist && !bpOffen.has(ist.id);
  const zeile = el('div', 'bp-zeile' + (ist ? ' bestaetigt' : '') + (zu ? ' zu' : ''));
  zeile.style.setProperty('--farbe', s.farbe);
  const art = punktartById(pt.art);

  const kopf = el('div', 'bp-kopf');
  const titel =
    `<span class="bp-nr">${i + 1}</span>
     <span class="bp-art">${escapeHtml(art.name)}</span>` +
    (pt.name ? `<span class="bp-name">${escapeHtml(pt.name)}</span>` : '');
  if (ist) {
    const auf = el('button', 'bp-auf',
      titel + '<span class="bp-pfeil" aria-hidden="true">▾</span>');
    auf.type = 'button';
    auf.setAttribute('aria-expanded', String(!zu));
    auf.onclick = () => {
      bpOffen.has(ist.id) ? bpOffen.delete(ist.id) : bpOffen.add(ist.id);
      const jetztZu = zeile.classList.toggle('zu');
      auf.setAttribute('aria-expanded', String(!jetztZu));
    };
    kopf.appendChild(auf);
  } else {
    kopf.innerHTML = titel;
  }
  const zeigen = el('button', 'mini-knopf bp-karte', '◎');
  zeigen.title = 'Auf der Karte zeigen';
  zeigen.onclick = () => { ctx.sl.waehle(s.id, pt.id); ctx.sl.zeigeStrecke(s.id); ctx.zurKarte?.(); };
  kopf.appendChild(zeigen);
  zeile.appendChild(kopf);

  if (ist) {
    const abw = distanz(pt, ist);
    const abschnitt = bauabschnittById(s, ist.abschnitt);
    const befund = el('div', 'bp-befund');
    /* Ein Punkt, der weiter als die Abseits-Schwelle vom geplanten liegt, ist
       nicht „gebaut“, sondern zu prüfen. Im Audit stand grünes „✓ gebaut“
       neben „82,49 km abweichend“ – die Farbe sagte das Gegenteil der Zahl. */
    const fraglich = abw >= ABSEITS_SCHWELLE;
    befund.innerHTML =
      (fraglich ? '<span class="bp-haken bp-pruefen">⚠ prüfen</span>'
        : '<span class="bp-haken">✓ gebaut</span>') +
      `
       <span class="bp-quelle">${escapeHtml(quelleText(ist))}</span>` +
      (uhrzeit(ist.zeit) ? `<span class="bp-zeit">${escapeHtml(uhrzeit(ist.zeit))}</span>` : '') +
      /* Wurde am Bauort etwas anderes gebaut als geplant – eine Muffe, wo ein
         Trassenpunkt stand –, steht es hier: die Art des Ist-Punktes ist die
         Aussage des Trupps, die Zeile darüber die des Plans. */
      (punktartText(ist) !== punktartText(pt)
        ? `<span class="bp-istart">gebaut als ${escapeHtml(punktartText(ist))}</span>` : '') +
      (abschnitt ? `<span class="bp-trupp">${escapeHtml(abschnitt.trupp || abschnitt.name)}</span>` : '') +
      (abw >= ABWEICHUNG_SCHWELLE
        ? `<span class="bp-abweichung">${escapeHtml(formatLaenge(abw))} abweichend</span>`
        : '') +
      /* Was aufgenommen, aber nicht ausgesagt ist, steht im eingeklappten
         Befund und nicht erst im Formular darunter: sonst fiele es beim
         Überfliegen der Liste durch, und genau dort wird vor dem Absetzen
         gesucht, was noch fehlt. */
      luecketext(ist);
    zeile.appendChild(befund);

    /* Alles, was über den Befund hinausgeht, steht im Formular – und das
       erscheint erst auf Tipp auf die Kopfzeile. */
    const mehr = el('div', 'bp-mehr');
    mehr.appendChild(zeitWahl(ist.zeit, 'Gebaut um', iso =>
      store.aendern(() => { ist.zeit = iso; }, 'bau')));
    mehr.appendChild(feld('Bemerkung', ist.bemerkung,
      w => schreib(() => { ist.bemerkung = w; }),
      { typ: 'textarea', zeilen: 2, klasse: 'bp-bemerkung',
        platzhalter: 'Was hier anders war' }));

    /* Der Trupp lässt sich am aufgenommenen Punkt nachtragen. Ohne diesen Griff
       wäre die Zuordnung nur im Augenblick der Aufnahme zu setzen – und der
       aktive Bauabschnitt ist eine Einstellung dieser Sitzung, die ein
       Neuladen am Bauort zurücksetzt. Die Hälfte derselben Arbeit stünde dann
       ohne Trupp da, und niemand käme mehr heran. */
    if (bauabschnitte(s).length) {
      mehr.appendChild(merkeFeld(feld('Gebaut von', ist.abschnitt || '', w => {
        store.aendern(() => { ist.abschnitt = w || null; }, 'bau');
      }, { typ: 'select', klasse: 'bp-trupp-wahl',
           werte: [['', 'ohne Bauabschnitt'],
                   ...bauabschnitte(s).map(a => [a.id, a.trupp || a.name])] }),
        'trupp-' + ist.id));
    }

    const tasten = el('div', 'tastenreihe');
    /* Beide Griffe ERSETZEN die Aufnahme, sie legen keine zweite an – und
       lassen, was der Trupp am Punkt eingetragen hat (`istPunktSetzen`). */
    tasten.appendChild(knopf('Standort neu holen', () =>
      istPunktAusStandort(s.id, pt.id, { ersetzt: ist.id }), 'klein'));
    tasten.appendChild(knopf('Auf Karte verschieben', () => {
      ctx.sl.starteIstSetzen(s.id, { sollPunkt: pt.id, ersetzt: ist.id,
        abschnitt: ist.abschnitt || (aktiverBauabschnitt(s) || {}).id || null });
      ctx.modusAnzeigen?.();
      ctx.zurKarte?.();
      hinweis('Auf die Karte tippen, wo der Punkt wirklich liegt.');
    }, 'klein'));
    const weg = knopf('Zurücknehmen', () => {
      store.aendern(() => {
        s.bau.punkte = s.bau.punkte.filter(x => x.id !== ist.id);
      }, 'bau');
      hinweis(`Punkt ${i + 1} wieder offen – „Rückgängig“ in der Kopfzeile holt ihn zurück`);
    }, 'klein gefahr');
    tasten.appendChild(weg);
    mehr.appendChild(tasten);
    zeile.appendChild(mehr);
    return zeile;
  }

  const tasten = el('div', 'tastenreihe bau-tasten');
  /* Die Bauweise der geplanten Querung geht mit: „wie geplant“ heißt auch
     „so gequert wie geplant“. An jeder anderen Art gibt es keine. */
  const bauweise = pt.art === 'querung' ? pt.bauweise : null;
  tasten.appendChild(knopf('✓ wie geplant', () => {
    const a = aktiverBauabschnitt(s);
    store.aendern(() => {
      istPunktSetzen(s, pt.lat, pt.lng,
        { sollPunkt: pt.id, art: pt.art, bauweise, name: pt.name, quelle: 'plan',
          abschnitt: a ? a.id : null });
    }, 'bau');
    /* Die Standortaufnahme quittiert jede Aufnahme, die Bestätigung tat es
       nicht – obwohl sie denselben Eintrag erzeugt. Ohne Beleg und mit
       wanderndem Griff tippt der Trupp zweimal an dieselbe Stelle und trifft
       zwei verschiedene Punkte. */
    /* Der Rückweg steht in der Quittung: „Zurücknehmen“ selbst liegt im
       eingeklappten Befund, und im Audit fand ihn niemand, der sich eben
       vertippt hatte. Ein Knopf in der Pille wäre der falsche Ort – sie darf
       keinen Tipp abfangen (`geraete-pruefen.mjs`). */
    hinweis(`Punkt ${i + 1} bestätigt – ${NUR_TOUCH ? '„↶“ oben' : '„↶“ oder Strg+Z'} nimmt es zurück`);
    naechsteOffeneZeigen();
  }, 'bau-taste primaer'));
  tasten.appendChild(knopf('◉ hier', () => istPunktAusStandort(s.id, pt.id), 'bau-taste'));
  tasten.appendChild(knopf('✛ Karte', () => {
    const a = aktiverBauabschnitt(s);
    ctx.sl.starteIstSetzen(s.id, { sollPunkt: pt.id, art: pt.art, bauweise,
      abschnitt: a ? a.id : null });
    ctx.modusAnzeigen?.();
    ctx.zurKarte?.();
    hinweis('Auf die Karte tippen, wo der Punkt wirklich liegt.');
  }, 'bau-taste'));
  zeile.appendChild(tasten);
  return zeile;
}

/* Nach jeder Bestätigung rückt der nächste offene Punkt ins Bild. Die Liste
   ist zu diesem Zeitpunkt schon neu gebaut – `store.aendern` benachrichtigt
   sofort –, gesucht wird deshalb im fertigen Baum. */
function naechsteOffeneZeigen() {
  const offen = document.querySelector('#bau-liste .bp-zeile:not(.bestaetigt)');
  if (offen) offen.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Eine Zeile je zusätzlich aufgenommenem Punkt */
/* Tag und Uhrzeit eines Eintrags, nachträglich zu setzen – für alles, was
   vom Meldeblock oder vom Baunachweis abgeschrieben wird. Die Uhrzeit allein
   genügte nicht: wer nach Mitternacht oder am nächsten Morgen nachträgt, bekam
   das Datum des Eintippens, und ein Bau über zwei Tage stand mit falschen
   Zeiten in der Dokumentation. Zur Wahl stehen die letzten Tage und der Tag
   des Eintrags selbst – mehr braucht der Nachtrag vom Bauort nicht, und ein
   Kalender wäre am Handy ein Umweg. Geändert wird bei `change`, nicht bei
   jedem Anschlag: die Liste sortiert nach der Zeit und zöge die Zeile sonst
   unter dem Finger weg. */
function zeitWahl(iso, titel, setzen, knapp = false) {
  if (knapp) return zeitWahlKnapp(iso, titel, setzen);
  const box = el('div', 'zeit-wahl');
  box.appendChild(el('span', 'feld-titel', escapeHtml(titel)));
  const basis = iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso) : new Date();
  const tage = new Map();
  const heute = new Date();
  for (let i = 3; i >= 0; i--) {
    const d = new Date(heute); d.setDate(d.getDate() - i);
    tage.set(d.toDateString(), d);
  }
  if (!tage.has(basis.toDateString())) tage.set(basis.toDateString(), basis);
  const tag = document.createElement('select');
  tag.className = 'zw-tag';
  tag.setAttribute('aria-label', `${titel}: Tag`);
  const gestern = new Date(heute); gestern.setDate(gestern.getDate() - 1);
  [...tage.values()].sort((a, b) => a - b).forEach(d => {
    const op = document.createElement('option');
    op.value = d.toDateString();
    op.textContent = d.toDateString() === heute.toDateString() ? 'heute'
      : d.toDateString() === gestern.toDateString() ? 'gestern'
      : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    op.selected = d.toDateString() === basis.toDateString();
    tag.appendChild(op);
  });
  const zeit = document.createElement('input');
  zeit.type = 'time';
  zeit.className = 'bm-zeit';
  zeit.value = iso ? uhrzeit(iso) || '' : '';
  zeit.setAttribute('aria-label', `${titel}: Uhrzeit`);
  const uebernehmen = () => {
    const [h, min] = zeit.value.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(min)) { zeit.value = iso ? uhrzeit(iso) || '' : ''; return; }
    const d = new Date(tag.value);
    d.setHours(h, min, 0, 0);
    setzen(d.toISOString());
  };
  tag.addEventListener('change', () => { if (zeit.value) uebernehmen(); });
  zeit.addEventListener('change', uebernehmen);
  box.append(tag, zeit);
  return box;
}

/* In der Meldungszeile ist kein Platz für ein Tagesfeld: gestapelt machte es
   jede Zeile doppelt so hoch, und der Bau-Reiter lief über seine Schwelle.
   Dort gilt eine Regel statt einer Wahl: eine Meldung liegt nie in der
   Zukunft. Wer um 8 Uhr morgens „14:20“ nachträgt, meint gestern – genau
   der Fall aus dem Audit, der Nachtrag nach Mitternacht oder am nächsten Tag.
   Liegt der Tag nicht heute, steht er klein unter der Uhrzeit. */
function zeitWahlKnapp(iso, titel, setzen) {
  const box = el('span', 'zeit-wahl knapp');
  const zeit = document.createElement('input');
  zeit.type = 'time';
  zeit.className = 'bm-zeit';
  zeit.value = iso ? uhrzeit(iso) || '' : '';
  zeit.setAttribute('aria-label', `${titel}: Uhrzeit`);
  zeit.addEventListener('change', () => {
    const [h, min] = zeit.value.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(min)) { zeit.value = iso ? uhrzeit(iso) || '' : ''; return; }
    /* Gerechnet wird von heute aus, nicht vom bisherigen Tag der Meldung: wer
       sich um 07:15 zu 23:50 vertippte, landete auf gestern, und die
       Berichtigung auf 07:00 blieb dort stehen – zurück kam man nur über ↶. */
    const d = new Date();
    d.setHours(h, min, 0, 0);
    if (d.getTime() > Date.now() + 60000) d.setDate(d.getDate() - 1);
    setzen(d.toISOString());
  });
  box.appendChild(zeit);
  const d = iso ? new Date(iso) : null;
  if (d && !Number.isNaN(d.getTime()) && d.toDateString() !== new Date().toDateString()) {
    const gestern = new Date(); gestern.setDate(gestern.getDate() - 1);
    box.appendChild(el('span', 'zw-tagtext', d.toDateString() === gestern.toDateString() ? 'gestern'
      : escapeHtml(d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }))));
  }
  return box;
}

/** Die offene Angabe eines aufgenommenen Punktes als Marke für die Liste –
 *  leer, wenn nichts fehlt */
function luecketext(ist) {
  if (ist.art === 'offen') return '<span class="bp-luecke">Art fehlt</span>';
  if (ist.art === 'querung' && !ist.bauweise) {
    return '<span class="bp-luecke">Bauweise fehlt</span>';
  }
  return '';
}

function bauZusatzZeile(s, pt) {
  const zeile = el('div', 'bp-zeile bestaetigt bp-zusatz');
  zeile.style.setProperty('--farbe', s.farbe);
  const kopf = el('div', 'bp-kopf');
  kopf.innerHTML =
    `<span class="bp-nr">+</span>
     <span class="bp-art">${escapeHtml(punktartText(pt))}</span>
     <span class="bp-quelle">${escapeHtml(quelleText(pt))}</span>` +
    (uhrzeit(pt.zeit) ? `<span class="bp-zeit">${escapeHtml(uhrzeit(pt.zeit))}</span>` : '') +
    luecketext(pt);
  const zeigen = el('button', 'mini-knopf bp-karte', '◎');
  zeigen.title = 'Auf der Karte zeigen';
  zeigen.onclick = () => { ctx.karte.setView([pt.lat, pt.lng], Math.max(ctx.karte.getZoom(), 16)); ctx.zurKarte?.(); };
  kopf.appendChild(zeigen);
  zeile.appendChild(kopf);

  const felder = el('div', 'bp-felder');
  /* Zuerst die Frage, ob der Punkt überhaupt ein zusätzlicher ist. Über die
     Bauleiste aufgenommen, landet jede Aufnahme hier – sie kann nicht wissen,
     welchen geplanten Punkt der Trupp meint. Wer den Bogen später durchgeht,
     räumt es hier auf: die offenen Punkte stehen mit ihrer Entfernung zu
     diesem, der nächstliegende zuerst. Gewählt bleibt „zusätzlicher Punkt“,
     bis jemand etwas anderes sagt. */
  const offeneSoll = offeneSollPunkte(s, pt);
  if (offeneSoll.length) {
    felder.appendChild(merkeFeld(feld('Gehört zu', '', w => {
      store.aendern(() => istSollZuordnen(s, pt, w || null), 'bau');
    }, { typ: 'select', klasse: 'bp-soll-wahl',
         werte: [['', 'zusätzlicher Punkt'],
                 ...offeneSoll.map(e => [e.punkt.id,
                   `Punkt ${e.nr}${e.punkt.name ? ' ' + e.punkt.name : ''} – ${formatLaenge(e.weg)}`])] }),
      'sollwahl-' + pt.id));
  }
  /* Hier steht „Art noch offen“ mit zur Wahl: der aufgenommene Punkt kommt mit
     ihr aus der Aufnahme, und sie muss im Feld lesbar dastehen – als Lücke, die
     jemand füllt, und nicht als Wert, der zufällig oben in der Liste steht. */
  felder.appendChild(merkeFeld(feld('Art', pt.art, w => {
    store.aendern(() => istArtSetzen(pt, w), 'bau');
  }, { typ: 'select', werte: PUNKTARTEN.map(a => [a.id, a.name]) }), 'art-' + pt.id));
  /* Die Bauweise nur an der Querung – dieselbe Regel wie am geplanten Punkt
     und auf der Punktkarte. „nicht angegeben“ ist eine eigene Wahl: der Trupp
     hat sie dann nicht eingetragen, und das steht so auf dem Bogen. */
  if (pt.art === 'querung') {
    felder.appendChild(merkeFeld(feld('Bauweise', pt.bauweise || '', w => {
      store.aendern(() => { pt.bauweise = w || null; }, 'bau');
    }, { typ: 'select', werte: [['', 'nicht angegeben'],
                                 ...QUERUNG_BAUWEISEN.map(b => [b.id, b.name])] }),
      'bauweise-' + pt.id));
  }
  felder.appendChild(feld('Bezeichnung', pt.name, w => schreib(() => { pt.name = w; }),
    { platzhalter: 'z. B. Mast an der Scheune' }));
  felder.appendChild(zeitWahl(pt.zeit, 'Aufgenommen um', iso =>
    store.aendern(() => { pt.zeit = iso; }, 'bau')));
  zeile.appendChild(felder);
  zeile.appendChild(feld('Bemerkung', pt.bemerkung, w => schreib(() => { pt.bemerkung = w; }),
    { typ: 'textarea', zeilen: 2, klasse: 'bp-bemerkung' }));

  const tasten = el('div', 'tastenreihe');
  tasten.appendChild(knopf('Löschen', () => {
    store.aendern(() => { s.bau.punkte = s.bau.punkte.filter(x => x.id !== pt.id); }, 'bau');
    hinweis('Punkt gelöscht – „Rückgängig“ in der Kopfzeile holt ihn zurück');
  }, 'klein gefahr'));
  zeile.appendChild(tasten);
  return zeile;
}

/* Was der Truppführer dem S 6 meldet, steht am Ende der Liste: die Abweichung
   im Klartext. Sie ist keine Bemerkung zu einem Punkt, sondern die Aussage
   über den Auftrag – „zwingend nötige Abweichungen muß er umgehend dem S 6
   melden“ (Hdb Feldfernkabelbau, 1.3.2). */
function bauSchlussBlock(s, k) {
  const box = el('div', 'feldgruppe bau-schluss');
  box.appendChild(el('h3', 'gruppen-titel', 'Abweichungen vom Auftrag'));

  if (k.abweichungen.length || k.abseits.length) {
    const auf = el('ul', 'bau-abwliste');
    for (const a of k.abweichungen.slice(0, 8)) {
      const nr = s.punkte.indexOf(a.soll) + 1;
      auf.appendChild(el('li', '',
        `Punkt ${nr}: <b>${escapeHtml(formatLaenge(a.meter))}</b> vom geplanten Ort`));
    }
    for (const a of k.abseits.filter(x => !x.soll).slice(0, 8)) {
      const name = a.ist.name || `${punktartText(a.ist)} ${uhrzeit(a.ist.zeit)}`.trim();
      auf.appendChild(el('li', '',
        `Zusätzlich (${escapeHtml(name)}): <b>${escapeHtml(formatLaenge(a.meter))}</b> neben der Trasse`));
    }
    box.appendChild(auf);
  } else if (k.laengeFraglich) {
    box.appendChild(el('p', 'bau-warnung',
      `Die gebaute Trasse ist mit ${escapeHtml(formatLaenge(k.laenge))} weit länger als die geplante.`));
  } else if (k.istPunkte) {
    box.appendChild(el('p', 'klein',
      `Kein aufgenommener Punkt liegt mehr als ${ABWEICHUNG_SCHWELLE} m vom geplanten entfernt.`));
  }

  box.appendChild(feld('Meldung an den S 6', (s.bau && s.bau.abweichung) || '',
    w => schreib(() => { bauSichern(s).abweichung = w; }),
    { typ: 'textarea', zeilen: 3,
      platzhalter: 'Was vom Auftrag abweicht und warum' }));

  if (k.fehlend && k.stand.id !== 'offen') {
    box.appendChild(el('p', 'bau-warnung',
      `${k.fehlend} ${k.fehlend === 1 ? 'geplanter Punkt ist' : 'geplante Punkte sind'} ` +
      'noch nicht bestätigt.'));
  }
  return box;
}

/* Was an einer Strecke an Baudokumentation hängt, in einem Satzteil. Gebraucht
   beim Löschen: „0 aufgenommene Punkte“ stimmte zwar, verschwieg aber den
   gefüllten Materialbogen, die Meldungen und die Übergabe – und die sind am
   Bauort entstanden und nicht zu wiederholen. */
function bauUmfangText(s) {
  const teile = [];
  const zaehl = (n, ein, viele) => { if (n) teile.push(`${n} ${n === 1 ? ein : viele}`); };
  zaehl(istPunkte(s).length, 'aufgenommener Punkt', 'aufgenommene Punkte');
  zaehl(materialzeilen(s).length, 'Materialzeile', 'Materialzeilen');
  zaehl(baumeldungen(s).length, 'Baumeldung', 'Baumeldungen');
  zaehl(pruefzeilen(s).length, 'geprüfter Stamm', 'geprüfte Stämme');
  const u = s.bau && s.bau.pruefung;
  if (u && (u.uebergabeAn || u.uebergabeZeit)) teile.push('die Übergabe');
  if (s.bau && s.bau.abweichung) teile.push('die Meldung an den S 6');
  return teile.length ? teile.join(', ') : 'der begonnene Bogen';
}

// --------------------------------------------------- Materialnachweis

/* Der Bogen des Bautrupps: was wirklich verbaut wurde. Alle Katalogzeilen
   stehen da, auch die leeren – er ist eine Abhakliste und kein Formular, und
   wer am Bauort eine Zeile sucht, die nicht angezeigt wird, weil noch nichts
   drinsteht, sucht vergeblich. Gespeichert wird trotzdem nur, was ausgefüllt
   ist (`materialSetzen` in `baudoku.js`).

   Gebucht wird auf den Bauabschnitt, der oben aktiv ist. Das ist derselbe
   Schalter, der auch die aufgenommenen Punkte zuordnet – zwei getrennte
   Umschalter für dieselbe Frage („wer trägt hier ein?“) wären am Bauort einer
   zu viel. */
function bauMaterialBlock(s, k) {
  const box = el('div', 'feldgruppe bau-material');
  box.appendChild(el('h3', 'gruppen-titel', 'Materialnachweis'));

  const aktiv = aktiverBauabschnitt(s);
  const abschnitte = bauabschnitte(s);
  if (abschnitte.length) {
    box.appendChild(el('p', 'klein',
      aktiv
        ? `Eintragungen gehen auf <b>${escapeHtml(aktiv.name)}</b>. Unter „Bauabschnitte“ umschalten.`
        : 'Kein Bauabschnitt gewählt – Eintragungen gelten für die ganze Strecke. ' +
          'Unter „Bauabschnitte“ lässt sich einer wählen.'));
  }

  const abschnittId = aktiv ? aktiv.id : null;
  const summe = abschnitte.length ? materialSumme(s) : null;
  const soll = materialSoll(kennzahlen(s));

  for (const gruppe of MATERIALGRUPPEN) {
    const zeilen = MATERIALKATALOG.filter(m => m.gruppe === gruppe.id && !m.mehrfach);
    if (!zeilen.length) continue;
    box.appendChild(el('h4', 'bau-untertitel', escapeHtml(gruppe.name)));
    const raster = el('div', 'mat-raster');
    for (const eintrag of zeilen) {
      raster.appendChild(materialFeld(s, eintrag, abschnittId, soll, summe));
    }
    box.appendChild(raster);
  }

  /* Die freien Zeilen stehen am Ende und werden einzeln angelegt: „Sonstiges“
     ist keine Menge, sondern ein Gegenstand, der im Katalog fehlt – und davon
     können mehrere anfallen. */
  box.appendChild(el('h4', 'bau-untertitel', 'Sonstiges'));
  const frei = materialzeilen(s).filter(z => z.artikel === 'sonstiges' &&
    (z.abschnitt || null) === abschnittId);
  for (const z of frei) box.appendChild(freieMaterialZeile(s, z));

  /* Die freien Zeilen der ÜBRIGEN Bauabschnitte stehen nur als Hinweis da.
     Eine Katalogzeile verrät sich über die Fußnote „über alle Abschnitte“;
     eine freie hat keine Zeile, in der das stünde, und wäre sonst vom Bogen
     verschwunden, während sie in Datei und Link weiterreist. */
  const fremd = materialzeilen(s).filter(z => z.artikel === 'sonstiges' &&
    (z.abschnitt || null) !== abschnittId);
  if (fremd.length) {
    const wo = z => {
      const a = bauabschnittById(s, z.abschnitt);
      return a ? a.name : 'ohne Bauabschnitt';
    };
    box.appendChild(el('p', 'klein',
      `Anderswo eingetragen: ` + fremd.map(z =>
        `${escapeHtml(z.bemerkung || 'ohne Bezeichnung')} ` +
        `(${escapeHtml(wo(z))}${Number.isFinite(z.menge) ? ', ' + z.menge : ''})`
      ).join(', ') + '.'));
  }

  const tasten = el('div', 'tastenreihe');
  tasten.appendChild(knopf('+ Zeile', () => {
    store.aendern(() => materialFreiAnlegen(s, abschnittId), 'bau');
  }, 'klein'));
  box.appendChild(tasten);
  return box;
}

/* Ein Mengenfeld einer Katalogzeile. Nicht vorbelegt: eine vorausgefüllte
   Menge, die niemand ändert, ist keine Dokumentation, sondern eine Abschrift
   des Plans. Das Soll steht deshalb NEBEN dem Feld und nicht darin – und nur
   an der Kabelzeile, denn nur dort hat die Planung wirklich eine Zahl. */
function materialFeld(s, eintrag, abschnittId, soll, summe) {
  const zeile = materialzeile(s, eintrag.id, abschnittId);
  const wert = zeile && Number.isFinite(zeile.menge) ? zeile.menge : '';
  /* Die Fussnote steht NEBEN dem Feld und nicht in ihm: `.feld-einheit` hängt
     absolut am unteren Rand des Labels, und ein weiteres Kind darin schöbe die
     Einheit aus dem Eingabefeld heraus nach unten. */
  const rahmen = el('div', 'mat-zeile');
  rahmen.appendChild(feld(eintrag.name, wert, w => {
    schreib(() => materialSetzen(s, eintrag.id, abschnittId, w));
  }, { typ: 'number', min: 0, step: 1, einheit: eintrag.einheit, tausender: true }));

  const fuss = [];
  if (soll && soll.artikel === eintrag.id) {
    /* In der Einheit der Zeile und nicht über `formatLaenge()`: das Feld
       darüber nimmt Meter, und „542,37 km“ daneben verleitete dazu, 542 zu
       tippen. Gerundet wird auf ganze Meter – der Bedarf ist eine Schätzung
       mit Bauzuschlag, Nachkommastellen täuschten Genauigkeit vor. */
    fuss.push(`Bedarf laut Planung ${materialMengeText(Math.round(soll.menge), eintrag.einheit)}`);
  }
  /* Die Summe über alle Bauabschnitte steht nur dann daneben, wenn sie etwas
     anderes sagt als das Feld darüber – sonst wiederholte sie es. */
  if (summe && summe.has(eintrag.id) && summe.get(eintrag.id) !== wert) {
    fuss.push(`über alle Abschnitte ${materialMengeText(summe.get(eintrag.id), eintrag.einheit)}`);
  }
  if (fuss.length) rahmen.appendChild(el('span', 'mat-fuss', escapeHtml(fuss.join(' · '))));

  /* Ein Zahlendreher fällt neben dem Bedarf auf – wenn jemand hinsieht. Im
     Audit stand 31.200 m Feldkabel ohne Wimpernzucken neben „Bedarf 3.120 m“
     und wäre so in die Baudokumentation gegangen. Gewarnt wird ab dem
     Doppelten: darunter liegen Reserven und Umwege, darüber fast immer eine
     Null zu viel. Gesperrt wird nichts – der Trupp weiß, was verbraucht ist. */
  if (soll && soll.artikel === eintrag.id && soll.menge > 0) {
    const warn = el('span', 'mat-warnung');
    /* Auch nach unten: eine Null zu wenig („312“ statt „3.120“) blieb ohne
       jede Warnung. Solange gebaut wird, ist weniger als der Bedarf aber der
       Normalfall – gewarnt wird deshalb, wenn die Zehnfache Menge genau in den
       Bedarf fiele, oder wenn die Strecke als fertig gemeldet ist. */
    const fertig = ['gebaut', 'uebergeben'].includes(s.bau && s.bau.stand);
    const pruefen = text => {
      const gelesen = zahlLesen(text, true);
      const z = gelesen.zahl;
      const zuViel = Number.isFinite(z) && z > 2 * soll.menge + 100;
      const nullFehlt = Number.isFinite(z) && z > 0 && z * 10 >= soll.menge * 0.7 &&
        z * 10 <= soll.menge * 2;
      const zuWenig = Number.isFinite(z) && z > 0 && z < soll.menge / 2 && (nullFehlt || fertig);
      warn.hidden = !zuViel && !zuWenig;
      warn.textContent = zuViel
        ? `⚠ ${String(Math.round(z / soll.menge * 10) / 10).replace('.', ',')}-fach des Bedarfs – Zahlendreher?`
        : zuWenig
          ? `⚠ nur ${Math.round(z / soll.menge * 100)} % des Bedarfs – ${nullFehlt ? 'eine Null vergessen?' : 'stimmt die Menge?'}`
          : '';
    };
    const ein = rahmen.querySelector('input');
    if (ein) ein.addEventListener('input', () => pruefen(ein.value));
    /* Nach einer abgewiesenen Eingabe setzt das Feld beim Verlassen den alten
       Wert zurück – ohne `input`-Ereignis. Die Warnung, die an diesem Wert
       hing, war dann weg, obwohl der Zahlendreher noch dastand. */
    if (ein) ein.addEventListener('blur', () => setTimeout(() => pruefen(ein.value), 0));
    pruefen(String(wert));
    rahmen.appendChild(warn);
  }
  return rahmen;
}

/* Eine freie Zeile: Bezeichnung, Menge, und der Griff zum Löschen. Sie trägt
   ihre Bezeichnung in der Bemerkung – der Katalog kennt sie ja nicht. */
function freieMaterialZeile(s, z) {
  const rahmen = el('div', 'mat-freizeile');
  rahmen.appendChild(feld('Bezeichnung', z.bemerkung,
    w => schreib(() => { z.bemerkung = w; }),
    { platzhalter: 'was im Katalog fehlt' }));
  /* Dieselbe Prüfung wie bei einer Katalogzeile, nur an der Zeile statt am
     Artikel: eine negative Menge schriebe sich hier sonst ungeprüft in die
     Planung und fiele beim nächsten Laden still wieder heraus. */
  rahmen.appendChild(feld('Menge', Number.isFinite(z.menge) ? z.menge : '',
    w => schreib(() => { z.menge = mengeOderNichts(w); }),
    { typ: 'number', min: 0, tausender: true }));
  const weg = el('button', 'mini-knopf gefahr', '✕');
  weg.title = 'Zeile löschen';
  /* Das Kreuz steht 8 px neben dem Mengenfeld und wirkt sofort. Die Meldung
     nennt deshalb den Rückweg – dieselbe Zusage wie beim Löschen eines
     Bauabschnitts. Eine Rückfrage steht hier nicht: sie käme bei jeder
     Freizeile, und am Bauort ist ein Dialog teurer als ein Satz. */
  weg.onclick = () => {
    store.aendern(() => materialZeileLoeschen(s, z.id), 'bau');
    hinweis('Zeile gelöscht – „Rückgängig“ in der Kopfzeile holt sie zurück');
  };
  rahmen.appendChild(weg);
  return rahmen;
}

/* Menge mit Einheit, geschütztes Leerzeichen dazwischen. Nicht mit
   `mengenText()` weiter oben zu verwechseln – das rechnet Bytes in kB und MB
   um und hat mit dem Materialnachweis nichts zu tun. */
function materialMengeText(zahl, einheit) {
  const n = Number(zahl).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return einheit ? `${n} ${einheit}` : n;
}

// ------------------------------------------------------ Baumeldungen

/* „Nach einer abgesprochenen Anzahl Kabellängen oder nach befohlener Zeit ist
   eine Baumeldung an die Anfangsstelle durchzugeben“ (Hdb Feldfernkabelbau,
   3.5). Der Knopf trägt die Uhrzeit von selbst ein: am Bauort wird gemeldet
   und weitergebaut, und eine Zeit, die jemand nachträglich schätzt, ist keine
   Bauzeit. Der Text kommt danach – oder gar nicht. */
function bauMeldungBlock(s) {
  const box = el('div', 'feldgruppe bau-meldungen');
  box.appendChild(el('h3', 'gruppen-titel', 'Baumeldungen'));

  const meldungen = meldungenNachZeit(s);
  if (!meldungen.length) {
    box.appendChild(el('p', 'klein',
      'Nach jeder Kabellänge oder nach befohlener Zeit ist eine Baumeldung an ' +
      'die Anfangsstelle durchzugeben (Hdb Feldfernkabelbau, 3.5). Wer sie hier ' +
      'mitschreibt, hat am Ende die Bauzeiten. Vermerkt wird nur auf diesem Gerät – ' +
      'die Meldung selbst geht per Funk.'));
  }

  const aktiv = aktiverBauabschnitt(s);
  for (const m of meldungen) {
    const zeile = el('div', 'bm-zeile');
    zeile.dataset.mid = m.id;
    const a = bauabschnittById(s, m.abschnitt);
    if (a) zeile.style.setProperty('--farbe', a.farbe);
    /* Die Uhrzeit ist vorbelegt, aber nicht fest. Wer am Bauort ohne Gerät
       gebaut und auf dem Meldeblock mitgeschrieben hat, trägt abends nach –
       und bekam bisher die Uhrzeit des Eintippens statt der Bauzeit, alle
       Meldungen mit derselben Abendzeit. Geändert wird beim Verlassen des
       Feldes (`change`), nicht bei jedem Tastendruck: die Liste sortiert nach
       der Zeit und zöge die Zeile sonst unter dem Finger weg. */
    zeile.appendChild(zeitWahl(m.zeit, 'Meldung', iso =>
      store.aendern(() => { m.zeit = iso; }, 'bau'), true));
    zeile.appendChild(feld('', m.text, w => schreib(() => { m.text = w; }),
      { platzhalter: 'Was gemeldet wurde' }));
    const weg = el('button', 'mini-knopf gefahr', '✕');
    weg.title = 'Meldung löschen';
    const loeschen = () => {
      store.aendern(() => baumeldungLoeschen(s, m.id), 'bau');
      hinweis(`Meldung gelöscht – ${RUECKGAENGIG_TEXT}`);
    };
    /* Eine leere Zeile geht ohne Frage – sie ist meist ein Doppeltipp. Eine
       mit Text ist mitgeschriebene Bauzeit und wird nachgefragt: im Audit war
       genau die gefüllte Zeile mit einem Tipp fort, weil das ✕ der leeren
       daneben stand. */
    weg.onclick = () => {
      if (!String(m.text || '').trim()) { loeschen(); return; }
      dialog({
        titel: 'Meldung löschen?',
        inhalt: `<p>${escapeHtml(uhrzeit(m.zeit) || '')} – „${escapeHtml(m.text)}“</p>`,
        fuss: [{ text: 'Abbrechen' }, { text: 'Löschen', gefahr: true, tun: loeschen }]
      });
    };
    zeile.appendChild(weg);
    if (a) zeile.appendChild(el('span', 'bm-abschnitt', escapeHtml(a.name)));
    box.appendChild(zeile);
  }

  const tasten = el('div', 'tastenreihe bau-tasten');
  /* „Meldung jetzt“ las sich wie ein Funkspruch, der hinausgeht – im Audit
     glaubte der Trupp, die Anfangsstelle habe die Meldung. Der Knopf schreibt
     aber nur die Uhrzeit auf diesem Gerät mit. Das sagen Knopf und Pille. */
  /* Ein zweiter Tipp legt keine zweite leere Zeile an: steht eine eben
     angelegte noch leer da, bekommt sie das Schreibzeichen. Im Audit ergab ein
     Doppeltipp zwei leere Meldungen, 160 ms auseinander. Die Uhrzeit bleibt
     die des ersten Tipps – sie ist die Bauzeit.

     Kein Hinweis in der Pille mehr: sie lag im Audit über dem Feld „Meldung an
     den S 6“. Was der Knopf tut, steht im Einführungstext des Blocks. */
  tasten.appendChild(knopf('Meldung mitschreiben', () => {
    const jetzt = Date.now();
    let m = (s.bau && s.bau.meldungen || []).find(x => !String(x.text || '').trim() &&
      jetzt - Date.parse(x.zeit) < 60000);
    if (!m) store.aendern(() => { m = baumeldungAnlegen(s, '', aktiv ? aktiv.id : null); }, 'bau');
    setTimeout(() => {
      const f = document.querySelector(`.bm-zeile[data-mid="${CSS.escape(m.id)}"] .feld input`);
      if (f) f.focus();
    }, 60);
  }, 'klein primaer bau-taste'));
  box.appendChild(tasten);
  return box;
}

// -------------------------------------------------- Prüfen und Übergeben

/* Der Nachweis, ohne den die Baudokumentation eine Notiz bleibt. Nach 3.5 sind
   bei fertiggestellter Kabelleitung auf allen Leitungsstämmen des
   Feldfernkabels Messungen vorzunehmen, bei Verbindungs- und Anschlusskabel
   alle Stämme durch Sprechproben zu prüfen; erst wenn die befohlenen
   Übernahmemessungen abgeschlossen sind, ist die Übergabe beendet.

   Deshalb stehen Prüfung und Übergabe in EINEM Block: zwei getrennte ließen
   offen, worauf sich das „abgeschlossen“ bezieht. */
function bauUebergabeBlock(s, k) {
  const box = el('div', 'feldgruppe bau-uebergabe');
  box.appendChild(el('h3', 'gruppen-titel', 'Prüfung und Übergabe'));

  const zeilen = pruefzeilen(s);
  if (!zeilen.length) {
    box.appendChild(el('p', 'klein',
      'Auf allen Leitungsstämmen sind Messungen vorzunehmen, bei Verbindungs- ' +
      'und Anschlusskabel alle Stämme durch Sprechproben zu prüfen ' +
      '(Hdb Feldfernkabelbau, 3.5).'));
  }

  for (const z of zeilen) {
    box.appendChild(pruefZeile(s, z));
  }

  const tasten = el('div', 'tastenreihe');
  tasten.appendChild(knopf('+ Stamm', () => {
    store.aendern(() => pruefzeileAnlegen(s), 'bau');
  }, 'klein'));
  box.appendChild(tasten);

  const u = k.uebergabe;
  const felder = el('div', 'bu-felder');
  /* Empfänger und Zeitpunkt zeichnen die Liste neu: an ihnen hängt die
     Warnung darunter. Über `schreib()` geschrieben (Grund „formular“) bliebe
     sie stehen, bis etwas anderes einen Neuaufbau auslöst – der Truppführer
     trüge die Übergabe ein und sähe nicht, dass ein Stamm noch offen ist.
     Der Fokus wird über die Marke gerettet, sonst wäre kein Feld in einem Zug
     zu tippen. */
  /* Wer übergibt, ist aus „Wer baut?“ schon bekannt. Im Audit blieb
     „Übergeben durch“ leer, und die Baudokumentation ging ohne
     Verantwortlichen hinaus. Eingetragen wird der Truppführer mit dem
     Empfänger, solange das Feld leer ist – änderbar bleibt es. */
  const geraet = truppAmGeraet();
  felder.appendChild(merkeFeld(feld('Übergeben an', u.an,
    w => store.aendern(() => {
      const pr = pruefungSichern(s);
      pr.uebergabeAn = w;
      if (w && !pr.uebergabeName && geraet.fuehrer) pr.uebergabeName = geraet.fuehrer;
    }, 'bau'),
    { platzhalter: 'Einheit, für die gebaut wurde' }), 'uebergabe-an'));
  felder.appendChild(zeitfeld('Zeitpunkt', u.zeit,
    w => store.aendern(() => { pruefungSichern(s).uebergabeZeit = w; }, 'bau'),
    'uebergabe-zeit'));
  felder.appendChild(feld('Übergeben durch', u.durch,
    w => schreib(() => { pruefungSichern(s).uebergabeName = w; }),
    { platzhalter: geraet.fuehrer || 'Truppführer' }));
  box.appendChild(felder);

  /* Die Warnung nennt den Grund und nicht nur den Zustand: „noch nicht
     übergeben“ sagt dem Truppführer nicht, was ihm fehlt. */
  if (u.durchgefallen) {
    box.appendChild(el('p', 'bau-warnung',
      `${u.durchgefallen} ${u.durchgefallen === 1 ? 'Stamm ist' : 'Stämme sind'} ` +
      'nicht bestanden – die Leitung wird nicht übergeben, bevor das behoben ist.'));
  } else if (u.uebergeben && u.offen) {
    box.appendChild(el('p', 'bau-warnung',
      `${u.offen} ${u.offen === 1 ? 'Stamm ist' : 'Stämme sind'} noch nicht geprüft. ` +
      'Übergeben ist die Leitung erst, wenn die befohlenen Übernahmemessungen ' +
      'abgeschlossen sind (3.5).'));
  } else if (u.uebergeben && !u.zeilen) {
    box.appendChild(el('p', 'bau-warnung',
      'Übergeben ohne eine einzige Prüfzeile. Nach 3.5 gehört die Messung oder ' +
      'die Sprechprobe vor die Übergabe.'));
  }
  /* Der Weg zurück zum Stand. Nach „Übergabe erfassen“ springt der Reiter
     hierher, und der Stand blieb „im Bau“ – der Trupp musste nach oben und
     „übergeben“ neu wählen, und eine vollständig erfasste Übergabe kam beim
     Planer als Bau ohne Abschluss an. Steht Empfänger und Zeitpunkt da, wird
     der Stand hier angeboten; fehlt die Prüfung, fragt die bekannte Rückfrage
     oben (sie hängt am Auswahlfeld und nennt, was fehlt). */
  if (u.uebergeben && k.stand.id !== 'uebergeben') {
    const r = el('div', 'tastenreihe');
    r.appendChild(knopf('Stand auf „übergeben“ setzen', () => {
      const wahl = document.querySelector('.bau-stand select');
      if (wahl) {
        wahl.value = 'uebergeben';
        wahl.dispatchEvent(new Event('change', { bubbles: true }));
        wahl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 'klein primaer'));
    box.appendChild(r);
  }
  return box;
}

/* Eine Prüfzeile. `bestanden` ist dreiwertig, und das Auswahlfeld zeigt das
   auch so: „noch offen“ ist ein Zustand und nicht die Abwesenheit einer
   Entscheidung. Zwei Werte zwängen eine ungeprüfte Leitung in eines der beiden
   Lager, und am Bauort ist genau dieser Unterschied der Punkt. */
function pruefZeile(s, z) {
  const zeile = el('div', 'pz-zeile' + (z.bestanden === false ? ' gefallen' : ''));
  const felder = el('div', 'pz-felder');
  felder.appendChild(feld('Stamm', z.stamm, w => schreib(() => { z.stamm = w; }),
    { platzhalter: 'z. B. Stamm 1' }));
  felder.appendChild(merkeFeld(feld('Art', z.art,
    w => store.aendern(() => { z.art = w; }, 'bau'),
    { typ: 'select', werte: PRUEFARTEN.map(a => [a.id, a.name]) }), 'pruefart-' + z.id));
  felder.appendChild(merkeFeld(feld('Ergebnis',
    z.bestanden === true ? 'ja' : (z.bestanden === false ? 'nein' : 'offen'),
    w => store.aendern(() => {
      z.bestanden = w === 'ja' ? true : (w === 'nein' ? false : null);
    }, 'bau'),
    { typ: 'select', werte: [['offen', 'noch offen'], ['ja', 'bestanden'], ['nein', 'nicht bestanden']] }),
    'bestanden-' + z.id));
  felder.appendChild(feld('Messwert / Bemerkung', z.ergebnis,
    w => schreib(() => { z.ergebnis = w; }),
    { platzhalter: 'z. B. 96 Ω' }));
  felder.appendChild(feld('Prüfer', z.pruefer, w => schreib(() => { z.pruefer = w; }), {}));
  zeile.appendChild(felder);

  const fuss = el('div', 'pz-abschluss');
  fuss.appendChild(el('span', 'klein', escapeHtml(uhrzeit(z.zeit) || '')));
  const weg = el('button', 'mini-knopf gefahr', '✕');
  weg.title = 'Stamm löschen';
  weg.onclick = () => {
    store.aendern(() => pruefzeileLoeschen(s, z.id), 'bau');
    hinweis('Stamm gelöscht – „Rückgängig“ in der Kopfzeile holt ihn zurück');
  };
  fuss.appendChild(weg);
  zeile.appendChild(fuss);
  return zeile;
}

// ---------------------------------------------------- Baumeldung schicken

/* Der Rückweg. Er steht im Baumodus ganz unten, weil er ans Ende des Bauens
   gehört – und er steht dort auch dann, wenn an dieser Strecke noch gar nichts
   aufgenommen ist: die Meldung geht über ALLE Strecken, an denen der Trupp
   gearbeitet hat, nicht nur über die gerade gewählte. Ein Trupp, der drei
   Strecken gebaut hat, soll nicht drei Meldungen schicken müssen. */
function bauRueckwegBlock(s) {
  const box = el('div', 'feldgruppe bau-rueckweg');
  box.appendChild(el('h3', 'gruppen-titel', 'Baumeldung an den Planer'));

  const alle = (store.projekt.strecken || []).filter(bauBegonnen);
  if (!alle.length) {
    box.appendChild(el('p', 'klein',
      'Sobald etwas aufgenommen ist, lässt sich von hier zurückmelden, was gebaut wurde.'));
    return box;
  }

  const einleitung = el('p', 'klein',
    `Zurück geht die Baudokumentation von ` +
    `<b>${escapeHtml(alle.map(x => x.name).join(', '))}</b>, nicht die Planung.`);
  box.appendChild(einleitung);

  /* Was noch fehlt, bevor die Meldung eine Abschlussmeldung ist. Im Audit ging
     „Als Link“ ohne Material, Messung und Übergabe durch, und der Dialog nannte
     nur die Länge des Links – Zwischen- und Abschlussmeldung sahen gleich aus.
     Gesperrt wird nichts: eine Zwischenmeldung ist ausdrücklich erwünscht. */
  for (const x of alle) {
    const ue = uebergabestand(x);
    const fehlt = [
      !(x.bau.material || []).some(z => Number.isFinite(z.menge)) && 'Material',
      !ue.zeilen && 'Prüfung',
      ue.zeilen && ue.offen && `${ue.offen} ${ue.offen === 1 ? 'Stamm' : 'Stämme'} ungeprüft`,
      !ue.uebergeben && 'Übergabe',
      /* Leere Meldungszeilen gingen bisher unbemerkt mit hinaus – beim Planer
         zählten sie als Baumeldungen. */
      (() => {
        const leer = (x.bau.meldungen || []).filter(m => !String(m.text || '').trim()).length;
        return leer && `${leer} leere ${leer === 1 ? 'Meldung' : 'Meldungen'}`;
      })()
    ].filter(Boolean);
    if (fehlt.length) {
      const satz = `${alle.length > 1 ? `<b>${escapeHtml(x.name)}</b>: ` : ''}Noch offen: ` +
        `${escapeHtml(fehlt.join(', '))}.`;
      if (alle.length === 1) einleitung.insertAdjacentHTML('beforeend', ` <span class="bau-fehlt">${satz}</span>`);
      else box.appendChild(el('p', 'klein bau-fehlt', satz));
    }
  }

  /* Unter welchem Namen die Meldung hinausgeht – die Frage, die der Planer als
     erste stellt und die vorher niemand beantwortete. Steht kein Name da,
     spiegelt der Block, was der Planer dann liest, und sagt, was das für den
     anderen Trupp bedeutet. */
  const absender = absenderText(alle);
  if (absender) {
    box.appendChild(el('p', 'klein bau-absender',
      `Die Meldung nennt als Absender <b>${escapeHtml(absender)}</b>.`));
  } else {
    box.appendChild(el('p', 'klein',
      'Diese Meldung nennt bisher keinen Trupp – meldet ein zweiter an ' +
      'derselben Strecke, tritt seine Aufnahme an die Stelle dieser hier.'));
  }
  /* Die Felder stehen auch dann da, wenn schon ein Name gefunden wurde: der
     Truppführer wechselt, das Gerät bleibt. Aus Bauabschnitten gelesene Namen
     überschreiben sie nicht – dort steht, wer welchen Teil gebaut hat. */
  if (!bauabschnitte(s).some(a => a.trupp)) box.appendChild(truppAmGeraetFelder());

  /* Was aufgenommen, aber nicht ausgesagt wurde. Am Bauort lässt sich das noch
     beantworten, beim Planer nicht mehr – deshalb steht es VOR den beiden
     Absetzgriffen und nicht hinter ihnen. */
  const luecken = alle.map(x => ({ name: x.name, k: baukennzahlen(x) })).filter(x => x.k.luecken);
  if (luecken.length) {
    const ul = el('ul', 'bau-vorschau');
    for (const x of luecken) {
      const teile = [];
      if (x.k.ohneArt.length) {
        teile.push(`${x.k.ohneArt.length} ${x.k.ohneArt.length === 1
          ? 'Punkt ohne Art' : 'Punkte ohne Art'}`);
      }
      if (x.k.querungOhneBauweise.length) {
        teile.push(`${x.k.querungOhneBauweise.length} ` +
          `${x.k.querungOhneBauweise.length === 1 ? 'Querung' : 'Querungen'} ohne Bauweise`);
      }
      ul.appendChild(el('li', 'bau-vorschau-luecke',
        `<b>${escapeHtml(x.name)}</b>: ${escapeHtml(teile.join(', '))}.`));
    }
    box.appendChild(ul);
  }

  /* Was der Planer wissen muss, sind nicht die Stückzahlen, sondern die
     Abweichungen: der Unterschied zwischen Plan und Bauort ist der Grund, aus
     dem überhaupt zurückgemeldet wird. Vor dem Absetzen steht deshalb hier,
     was er lesen wird – und wenn nichts abweicht, steht auch das da. */
  const abweichend = alle
    .map(x => ({ name: x.name, k: baukennzahlen(x) }))
    .filter(x => !x.k.stimmig);
  const vorschau = el('ul', 'bau-vorschau');
  if (!abweichend.length) {
    vorschau.appendChild(el('li', 'bau-vorschau-gleich',
      'Kein Punkt weicht mehr als ' + escapeHtml(formatLaenge(ABWEICHUNG_SCHWELLE)) +
      ' vom Plan ab.'));
  } else {
    for (const x of abweichend) {
      const teile = [];
      if (x.k.abweichungen.length) {
        teile.push(`${x.k.abweichungen.length} ` +
          `${x.k.abweichungen.length === 1 ? 'Punkt weicht' : 'Punkte weichen'} ab, ` +
          `am weitesten ${formatLaenge(x.k.abweichungen[0].meter)}`);
      }
      const fern = x.k.abseits.filter(a => !a.soll);
      if (fern.length) {
        teile.push(`${fern.length} ${fern.length === 1 ? 'zusätzlicher Punkt liegt'
          : 'zusätzliche Punkte liegen'} bis ${formatLaenge(fern[0].meter)} neben der Trasse`);
      }
      if (x.k.laengeFraglich && !x.k.abseits.length) {
        teile.push(`gebaute Trasse ${formatLaenge(x.k.laenge)} statt ${formatLaenge(x.k.sollLaenge)}`);
      }
      vorschau.appendChild(el('li', x.k.abseits.length || x.k.laengeFraglich ? 'bau-warnung' : '',
        `<b>${escapeHtml(x.name)}</b>: ${escapeHtml(teile.join('; '))}.`));
    }
  }
  box.appendChild(vorschau);

  /* Was zuletzt hinausging. Vorher sah der Block vor und nach dem Absetzen
     gleich aus, und der Bau-Block war zeichengleich – nach einer Unterbrechung
     war am Gerät nicht zu entscheiden, ob gemeldet ist. Dann wird entweder
     doppelt gemeldet, und beim Planer ersetzt die zweite Meldung Eintragungen,
     oder gar nicht. „Veraltet“ ist dabei kein Zustand des Absetzens, sondern
     einer der Aufnahme: seit der Meldung ist etwas dazugekommen. */
  /* „Abgesetzt“ stand hier nach dem bloßen Kopieren – auch im Funkloch, in
     dem der Link noch in der Zwischenablage lag. Das Wort ist Funksprache und
     heißt „beim Empfänger“; das Gerät weiß davon nichts. Gesagt wird deshalb,
     was das Gerät weiß: wann der Link kopiert oder die Datei gesichert wurde,
     und dass der Versand beim Trupp liegt. */
  const ab = absetzstandGesamt(alle);
  if (ab.stand !== 'nie') {
    const was = ab.weg === 'datei' ? 'Als Datei gesichert' : 'Link erzeugt';
    const wann = zeitpunkt(ab.zeit);
    box.appendChild(ab.stand === 'veraltet'
      ? el('p', 'bau-warnung',
          `${was} ${escapeHtml(wann)} – seither ist etwas dazugekommen. ` +
          'Noch einmal zurückmelden, sonst fehlt es beim Planer.')
      : el('p', 'klein bau-abgesetzt',
          `${was} ${escapeHtml(wann)}, seither unverändert. Ob die Meldung beim Planer ` +
          'angekommen ist, weiß dieses Gerät nicht – verschicken und im Zweifel nachfragen.'));
  }

  /* Was der Trupp beim Absetzen tut, wird festgehalten: Zeit, Weg und ein
     Fingerabdruck der Aufnahme. Der Vermerk hängt an jeder Strecke, die in der
     Meldung steckt – sonst stünde er an einer, die gar nicht mitging. */
  const vermerken = weg => store.aendern(() => {
    for (const s of alle) absetzenVermerken(s, weg);
  }, 'bau');

  const tasten = el('div', 'tastenreihe bau-tasten');
  tasten.appendChild(knopf('Als Link', () => meldungAlsLinkZeigen(alle, absender, vermerken),
    'klein primaer bau-taste'));
  tasten.appendChild(knopf('Als Datei', () => {
    if (io.baumeldungExportieren(alle, absender)) {
      vermerken('datei');
      hinweis('Baumeldung als Datei gesichert – jetzt dem Planer schicken');
    }
  }, 'klein bau-taste'));
  box.appendChild(tasten);

  /* Das gedruckte Blatt steht hier und nicht bei den Ausgabewegen der
     Streckenliste: es ist das Erzeugnis des TRUPPS – es ersetzt die Technische
     Fernmeldeskizze und verbleibt bei ihm –, und gegriffen wird danach am
     Bauort, wo der Baumodus läuft. Es gilt der gewählten Strecke und nicht
     allen: ein Blatt je Trasse, so wie der Bauauftrag. */
  const druck = el('div', 'tastenreihe');
  const druckKnopf = knopf('▤ Baudokumentation (PDF)', () => oeffneBaudoku(s.id), 'breit');
  druck.appendChild(druckKnopf);
  if (!bauBegonnen(s)) {
    druckKnopf.disabled = true;
    druck.appendChild(el('p', 'ausgabe-grund',
      `An „${escapeHtml(s.name)}“ ist noch nichts aufgenommen.`));
  }
  box.appendChild(druck);
  return box;
}

/* Der Link steht in einem Feld und wird nicht stillschweigend in die
   Zwischenablage gelegt: am Bauort ist oft kein Mailprogramm zur Hand, und der
   Truppführer diktiert ihn dann über Funk ab – dafür muss er ihn sehen. */
function meldungAlsLinkZeigen(strecken, absender = '', vermerken = null) {
  const box = el('div', 'meldung-link');
  const feldLink = document.createElement('textarea');
  feldLink.readOnly = true;
  feldLink.rows = 3;
  feldLink.value = 'wird erzeugt …';
  box.appendChild(feldLink);
  const ampel = el('p', 'teilen-ampel', '');
  box.appendChild(ampel);
  /* Zwischen- oder Abschlussmeldung – im Audit sah beides im Dialog gleich
     aus, und der Planer las es erst am Stand ab. Abschluss heißt: gebaut oder
     übergeben, mit Übergabe. */
  const offen = strecken.filter(x => {
    const ue = uebergabestand(x);
    return !['gebaut', 'uebergeben'].includes(x.bau && x.bau.stand) || !ue.uebergeben;
  });
  box.appendChild(el('p', offen.length ? 'klein' : 'klein bau-abschluss',
    offen.length
      ? `<b>Zwischenmeldung</b> – ${offen.length === strecken.length ? 'noch nicht abgeschlossen' :
        `offen: ${escapeHtml(offen.map(x => x.name).join(', '))}`}. Später noch einmal zurückmelden.`
      : '<b>Abschlussmeldung</b> – gebaut und übergeben.'));
  box.appendChild(el('p', 'klein',
    'Der Planer öffnet den Link und bekommt eine Vorschau, bevor etwas eingespielt wird.'));

  /* Abgesetzt ist die Meldung, wenn sie das Gerät verlassen hat – kopiert oder
     weitergegeben. Beides vermerkt es, und der Vermerk läuft nur einmal: ein
     zweiter Griff im selben Dialog änderte sonst nichts als die Uhrzeit. */
  let vermerkt = false;
  const abgesetzt = () => {
    if (vermerkt || !vermerken) return;
    vermerkt = true;
    vermerken('link');
  };

  /* „Teilen“ übergibt den Link an das Gerät – Messenger, Mail, was der Trupp
     ohnehin benutzt. Vorher endete der Weg beim Kopieren: die richtige App
     suchen und einfügen sind zwei weitere Griffe, und zwar in dem Augenblick,
     in dem die Meldung unter Zeitdruck hinausgeht. Wo der Browser das nicht
     kennt (Firefox auf dem Rechner), steht der Griff gar nicht erst da –
     „Kopieren“ bleibt in jedem Fall. */
  const kannTeilen = typeof navigator.share === 'function';
  const fuss = [];
  if (kannTeilen) {
    fuss.push({ text: 'Teilen', tun: () => {
      const wert = feldLink.value;
      if (!wert || wert.startsWith('wird erzeugt')) return false;
      navigator.share({ title: 'Baumeldung', text: 'Baumeldung vom Bauort', url: wert })
        .then(() => { abgesetzt(); hinweis('Baumeldung weitergegeben und als abgesetzt vermerkt'); })
        /* Ein Abbruch im Teilen-Blatt des Geräts ist kein Fehler und wird
           deshalb auch nicht gemeldet – der Trupp hat sich anders entschieden. */
        .catch(() => {});
      return false;
    } });
  }
  fuss.push({ text: 'Kopieren', tun: () => {
    const wert = feldLink.value;
    if (!wert || wert.startsWith('wird erzeugt')) return false;
    feldLink.select();
    const lauf = navigator.clipboard?.writeText(wert);
    if (!lauf) {
      hinweis('Kopieren nicht möglich – der Link ist markiert, Strg+C genügt.', 'fehler');
      return false;
    }
    lauf.then(() => { abgesetzt(); hinweis('Baumeldung kopiert und als abgesetzt vermerkt'); })
      .catch(() => hinweis('Kopieren nicht möglich – der Link ist markiert, Strg+C genügt.', 'fehler'));
    return false;
  } });
  fuss.push({ text: 'Schließen', primaer: true });

  dialog({ titel: 'Baumeldung als Link', inhalt: box, breit: true, fuss });

  meldungAlsLink(store.projekt, strecken, absender).then(link => {
    if (!box.isConnected) return;
    feldLink.value = link;
    /* Dieselbe Ampel wie beim Planungslink, aus derselben Quelle: nicht der
       Browser ist die Grenze, sondern die Mailprogramme – sie brechen lange
       Zeilen um, und ein umgebrochener Link kommt beim Planer kaputt an. */
    const u = laengenUrteil(link.length);
    ampel.className = 'teilen-ampel ' + u.klasse;
    ampel.textContent = u.text;
  }).catch(e => {
    if (!box.isConnected) return;
    feldLink.value = '';
    hinweis(e.message, 'fehler');
  });
}

// ---------------------------------------------------- Baumeldung empfangen

/**
 * Was der Trupp zurückschickt – vor dem Einspielen zur Ansicht.
 *
 * Eine Baumeldung ist die einzige Datei und der einzige Link, die etwas
 * ÜBERSCHREIBEN: eine Planung wird danebengelegt, eine Baumeldung tritt an die
 * Stelle dessen, was beim Planer an diesen Bauabschnitten hängt. Deshalb sieht
 * er zuerst, was ankommt, wem es zugeordnet wird und was dabei weicht – und
 * kann die Zuordnung ändern, bevor irgendetwas geschrieben wird.
 */
/**
 * @param {Function} [entschieden] wird gerufen, sobald die Entscheidung
 *   gefallen ist – gleich wie sie ausfällt. Der Empfangsweg räumt daran das
 *   Fragment der Adresse: vorher geräumt war die Meldung nach einem Fehlgriff
 *   spurlos weg, und der Link kam über Funk und nicht noch einmal.
 */
export function baumeldungDialog(meldung, herkunft, entschieden = null) {
  const p = store.projekt;
  const zuordnung = (meldung.strecken || []).map(m => {
    const v = vorschlag(p, m.name);
    return v ? v.id : null;
  });

  const box = el('div', 'meldung-vorschau');
  const trupp = truppText(meldung);
  const zeit = meldung.gemeldet ? zeitpunkt(meldung.gemeldet) : '';
  const kopf = el('div', '');
  kopf.innerHTML =
    `<p>Über ${escapeHtml(herkunft === 'Datei' ? 'die Datei' : 'den Link')} kommt eine
        <b>Baumeldung</b> herein${trupp ? ` von <b>${escapeHtml(trupp)}</b>` : ''}${
        zeit ? `, gemeldet ${escapeHtml(zeit)}` : ''}.</p>` +
    /* Der Name der Planung reist als Text mit, nicht als Kennung – die gibt es
       auf beiden Seiten nicht gemeinsam (siehe `baumeldung.js`). Stimmt er
       nicht, ist das ein Hinweis und keine Sperre: der Planer kann die Planung
       zwischenzeitlich umbenannt haben. */
    /* Der Trupp arbeitet in „Planung – Strecke“: so benennt die Anwendung
       selbst eine über den Link übernommene Strecke. Das ist dieselbe Planung
       und kein Grund zur Warnung – im Audit kam sie bei jeder gewöhnlichen
       Rückmeldung und wurde so zu einer, die man wegklickt. */
    (meldung.planung && meldung.planung !== p.name &&
     !String(meldung.planung).startsWith(p.name + ' – ')
      ? `<p class="bau-warnung">Die Meldung nennt die Planung
           „${escapeHtml(meldung.planung)}“ – offen ist „${escapeHtml(p.name)}“.
           Zuordnung unten prüfen.</p>`
      : '') +
    `<p class="klein"><b>Zusammengeführt wird nichts.</b> Eine Baumeldung ersetzt
        genau die Bauabschnitte, die sie nennt; die geplante Trasse bleibt
        unangetastet.</p>`;
  box.appendChild(kopf);

  const liste = el('div', 'meldung-liste');
  box.appendChild(liste);

  /* Zwei Strecken dürfen im Auswahlfeld denselben Namen tragen – dann ist
     genau das die Frage, die der Planer beantworten muss, und zwei gleich
     beschriftete Zeilen helfen ihm nicht. Unterschieden wird über die Zahl der
     geplanten Punkte; sie steht ohnehin vor ihm auf der Karte. */
  const wahlText = st => {
    const gleichnamig = (p.strecken || []).filter(x => x.name === st.name).length > 1;
    return gleichnamig
      ? `${st.name} (${(st.punkte || []).length} Punkte)` : st.name;
  };

  const zeichne = () => {
    /* Die Liste wird bei jeder Änderung neu gebaut, und ein Auswahlfeld, das
       dabei den Fokus verliert, ist mit der Tastatur nicht zu bedienen: jede
       Zuordnung verlangte neu zuzugreifen. Gerettet wird über die Stelle und
       nicht über das Element – nach dem Neuaufbau gibt es das alte nicht mehr. */
    const warFokus = document.activeElement;
    const marke = warFokus && liste.contains(warFokus) ? warFokus.dataset.mvStelle : null;
    const befunde = befund(p, meldung, zuordnung);
    liste.innerHTML = '';
    befunde.forEach((b, i) => {
      const zeile = el('div', 'mv-zeile' + (b.kollision.length ? ' kollision' : ''));
      const bringt = [
        b.istPunkte && `${b.istPunkte} ${b.istPunkte === 1 ? 'Punkt' : 'Punkte'}`,
        b.materialzeilen && `${b.materialzeilen} ${b.materialzeilen === 1 ? 'Materialzeile' : 'Materialzeilen'}`,
        b.meldungen && `${b.meldungen} ${b.meldungen === 1 ? 'Baumeldung' : 'Baumeldungen'}`,
        /* Prüfzeilen und Übergabe gehören dazu: eine Meldung, die nur die
           Übernahmemessung nachreicht, stünde sonst mit „nichts“ da. */
        b.pruefzeilen && `${b.pruefzeilen} ${b.pruefzeilen === 1 ? 'Prüfzeile' : 'Prüfzeilen'}`,
        b.uebergabe && 'Übergabe'
      ].filter(Boolean).join(' · ');
      zeile.innerHTML =
        `<div class="mv-kopf"><b>${escapeHtml(b.name)}</b>
           <span class="klein">${escapeHtml(bringt || 'nichts')}</span></div>` +
        `<p class="klein">${b.ganzeStrecke
          ? 'Ohne Bauabschnitt – die Meldung gilt für die ganze Strecke.'
          : 'Bauabschnitte: ' + escapeHtml(b.abschnitte.join(', '))}</p>`;

      const wahl = feld('Einspielen in', b.ziel ? b.ziel.id : '', wert => {
        zuordnung[i] = wert || null;
        zeichne();
      }, { typ: 'select', werte: [['', '– nicht einspielen –']]
        .concat((p.strecken || []).map(st => [st.id, wahlText(st)])) });
      const auswahl = wahl.querySelector('select');
      if (auswahl) auswahl.dataset.mvStelle = String(i);
      zeile.appendChild(wahl);

      /* Die Meldung an den S 6 steht vorn: sie ist der eine Satz, den der
         Trupp ausdrücklich an die Führungsstelle richtet. Im Audit war sie im
         Dialog nicht zu lesen und erschien erst nach dem Einspielen in der
         Liste – entschieden wurde also ohne sie. */
      if (b.s6) {
        zeile.appendChild(el('p', 'mv-s6',
          `<span class="klein">Meldung an den S 6</span><br>${escapeHtml(b.s6)}`));
      }
      if (b.ganzeStrecke && b.standNeu && b.ziel && b.standNeu !== b.standAlt) {
        zeile.appendChild(el('p', 'klein',
          `Stand: ${escapeHtml(baustandById(b.standAlt || 'offen').name)} → ` +
          `<b>${escapeHtml(baustandById(b.standNeu).name)}</b>`));
      }
      if (!b.ziel) {
        zeile.appendChild(el('p', 'klein',
          'Keine Strecke dieses Namens – oder mehrere. Von Hand zuordnen oder auslassen.'));
      } else {
        if (b.schonDa) {
          /* Gesagt wird das nur noch, wenn es stimmt: ausprobiert an einer
             Abschrift (`befund()` in `baumeldung.js`). */
          zeile.appendChild(el('p', 'bau-warnung',
            'Genau dieser Stand ist hier schon eingespielt. Einspielen ändert nichts – ' +
            'verwerfen genügt.'));
        } else if (b.aelter) {
          /* Der Abstand steht als Spanne da: zwei Zeitpunkte in derselben
             Minute lasen sich im Audit als „07:10 ist älter als 07:10“. */
          const sek = Math.round((Date.parse(b.standHier) - Date.parse(b.standMeldung)) / 1000);
          const spanne = sek < 60 ? `${sek} s` : sek < 3600 ? `${Math.round(sek / 60)} min`
            : `${Math.floor(sek / 3600)} h ${Math.round((sek % 3600) / 60)} min`;
          zeile.appendChild(el('p', 'bau-warnung',
            `Diese Meldung ist <b>${escapeHtml(spanne)} älter</b> als der Stand hier ` +
            `(${escapeHtml(zeitpunkt(b.standHier))}). Einspielen ersetzt den neueren Stand.`));
        }
        if (!b.schonDa && b.geaendert.length) {
          const mengeText = (w, e) => w === null || w === undefined ? '–'
            : `${Number(w).toLocaleString('de-DE')}${e ? ' ' + e : ''}`;
          zeile.appendChild(el('p', 'mv-geaendert', 'Geändert: ' + b.geaendert.map(g =>
            `${escapeHtml(g.name)} <b>${escapeHtml(mengeText(g.alt, g.einheit))} → ` +
            `${escapeHtml(mengeText(g.neu, g.einheit))}</b>`).join(', ')));
        }
        const v = b.verloren;
        if (!b.schonDa && (v.punkte || v.meldungen || v.material)) {
          /* Gezählt wird, was danach WIRKLICH fehlt, und gesagt, von wem es
             stammt. Im Audit spielte der Planer die Meldung von Trupp 2 ein,
             las „3 Punkte weichen“ – und die Aufnahme von Trupp 1 samt seiner
             Baumeldung war fort. Stammt der Bestand von einem anderen Absender,
             ist das kein Hinweis mehr, sondern eine Warnung. */
          const was = [
            v.punkte && (v.punkte === 1 ? '1 aufgenommener Punkt' : `${v.punkte} aufgenommene Punkte`),
            v.meldungen && (v.meldungen === 1 ? '1 Baumeldung' : `${v.meldungen} Baumeldungen`),
            v.material && (v.material === 1 ? '1 Materialzeile' : `${v.material} Materialzeilen`)
          ].filter(Boolean).join(', ');
          const absender = String(meldung.von || '');
          const fremd = b.bisherVon && absender && b.bisherVon !== absender;
          zeile.appendChild(el('p', fremd ? 'bau-warnung' : 'mv-ersetzt',
            `Dabei ${v.punkte + v.meldungen + v.material === 1 ? 'geht' : 'gehen'} hier verloren: ` +
            `${escapeHtml(was)}${b.bisherVon ? ` – gemeldet von <b>${escapeHtml(b.bisherVon)}</b>` : ''}.` +
            (fremd ? ' Das ist ein anderer Absender: seine Aufnahme wird ersetzt, nicht ergänzt. ' +
              'Vorher als Datei sichern, wenn beide gebraucht werden.' : '')));
        }
        /* Ist alles schon da, schweigen die Warnungen darunter: sie beschrieben,
           was das Einspielen ersetzt, und das ist hier nichts. Im Audit stand
           „ändert nichts“ über „Dabei gehen verloren …“. */
        if (b.schonDa) { liste.appendChild(zeile); return; }
        if (b.kollision.length) {
          zeile.appendChild(el('p', 'bau-warnung',
            `An ${b.kollision.length === 1 ? 'dem Bauabschnitt' : 'den Bauabschnitten'} ` +
            `${escapeHtml(b.kollision.map(a => a.name).join(', '))} hängt hier schon eine ` +
            'Aufnahme. Sie wird ersetzt und nicht verschmolzen – wenn zwei Trupps ' +
            'denselben Abschnitt gemeldet haben, vorher die ältere Meldung sichern.'));
        }
        if (b.unzugeordnet) {
          zeile.appendChild(el('p', 'klein',
            `Davon ${b.unzugeordnet} ${b.unzugeordnet === 1 ? 'Eintragung' : 'Eintragungen'} ` +
            'ohne Bauabschnitt. Sie treten an die Stelle dessen, was hier ohne ' +
            'Bauabschnitt steht.'));
        }
        if (b.verdraengt) {
          const weg = [
            b.verdraengt.abschnitte && `${b.verdraengt.abschnitte} ` +
              `${b.verdraengt.abschnitte === 1 ? 'Bauabschnitt' : 'Bauabschnitte'}`,
            b.verdraengt.pruefzeilen && `${b.verdraengt.pruefzeilen} ` +
              `${b.verdraengt.pruefzeilen === 1 ? 'Prüfzeile' : 'Prüfzeilen'}`,
            b.verdraengt.uebergabe && 'die Übergabe',
            b.verdraengt.abweichung && 'die Meldung an den S 6'
          ].filter(Boolean);
          if (weg.length) {
            zeile.appendChild(el('p', 'bau-warnung',
              'Diese Meldung nennt keinen Bauabschnitt und tritt deshalb an die Stelle ' +
              `des ganzen Bogens. Dabei gehen verloren: ${escapeHtml(weg.join(', '))}.`));
          }
        }
        if (b.planAbweicht) {
          zeile.appendChild(el('p', 'bau-warnung',
            'Die geplante Trasse hat seit der Übergabe an den Trupp eine andere Zahl ' +
            'von Punkten. Der Bezug zum Plan wird deshalb bei ALLEN aufgenommenen ' +
            'Punkten gelöst statt geraten – sie bleiben stehen, bestätigen aber ' +
            'keinen geplanten Punkt mehr.'));
        }
      }
      liste.appendChild(zeile);
    });
    if (marke) {
      const wieder = liste.querySelector(`[data-mv-stelle="${CSS.escape(marke)}"]`);
      if (wieder) wieder.focus();
    }
  };
  zeichne();
  /* Ist alles schon da, ist Verwerfen der richtige Griff und steht auch so da.
     Im Audit blieb „Einspielen“ blau, während der Satz darüber „verwerfen
     genügt“ sagte. */
  const anfang = befund(p, meldung, zuordnung);
  const nichtsNeues = anfang.every(b => b.ziel && b.schonDa);
  /* Und ebenso, wenn Einspielen etwas Neueres oder die Aufnahme eines
     anderen Absenders ersetzen würde. Drei Prüfungen fanden im Audit
     „Einspielen“ blau unter genau diesen beiden Warnungen – unter Zeitdruck
     wird der blaue Knopf getippt. Eingespielt werden kann weiter; es ist nur
     nicht mehr der naheliegende Griff. */
  const riskant = anfang.some(b => b.ziel && !b.schonDa && (b.aelter ||
    (b.bisherVon && meldung.von && b.bisherVon !== String(meldung.von) &&
     (b.verloren.punkte || b.verloren.meldungen || b.verloren.material))));
  const verwerfenVorn = nichtsNeues || riskant;

  dialog({
    titel: 'Baumeldung eingegangen',
    inhalt: box,
    breit: true,
    /* Getrennt und geschützt: die beiden Knöpfe tun das Gegenteil voneinander,
       und was hier hereinkommt, gibt es nur einmal. */
    geteilt: true,
    schutz: 'Bitte entscheiden: verwerfen oder einspielen.',
    fuss: [
      { text: 'Verwerfen', primaer: verwerfenVorn, tun: () => {
        if (entschieden) entschieden();
        /* „Sie ist damit weg“ stimmte nicht: derselbe Link lässt sich wieder
           öffnen, und wer das glaubte, rief den Trupp an. */
        hinweis('Baumeldung verworfen – derselbe Link öffnet sie wieder.', 'warnung');
      } },
      /* Die Warnung „vorher als Datei sichern“ hatte keinen Griff im Dialog:
         wer beide Stände behalten wollte, musste verwerfen, sichern und den
         Link neu öffnen. Der Dialog bleibt beim Sichern offen. */
      ...(riskant ? [{ text: 'Erst als Datei sichern', tun: () => {
        io.projektExportieren()
          .then(ok => { if (ok) hinweis('Planung als Datei gesichert – jetzt entscheiden'); })
          .catch(e => hinweis('Sichern fehlgeschlagen: ' + e.message, 'fehler'));
        return false;
      } }] : []),
      { text: 'Einspielen', primaer: !verwerfenVorn, tun: () => {
        if (entschieden) entschieden();
        let bericht;
        /* Vor dem Einspielen gemerkt: die Liste baut sich mit der Änderung neu
           auf und soll die Marke dabei schon tragen. */
        meldungenNeuMerken(zuordnung);
        store.aendern(pr => { bericht = einspielen(pr, meldung, zuordnung); }, 'meldung');
        ctx.sl.zeichne();
        zeichneStreckenListe();
        zeichneBauListe();
        hinweis(berichtText(bericht) +
          (bericht.uebersprungen ? ` – ${bericht.uebersprungen} ausgelassen` : ''));
      } }
    ]
  });
}

// ---------------------------------------------------------------- Projekt

export function zeichneProjektReiter() {
  const p = store.projekt;
  const kopf = document.getElementById('projekt-kopf');
  kopf.innerHTML = '';
  kopf.appendChild(el('h3', 'gruppen-titel', 'Kopfdaten für den Bauauftrag'));

  const felder = [
    ['Einsatz / Übung', 'einsatz', 'z. B. Übung Fernmeldeausbildung'],
    ['Ort / Abschnitt', 'ort', 'z. B. Musterstadt, Abschnitt West'],
    ['Einheit / Ortsverband', 'einheit', 'z. B. THW OV Musterstadt'],
    ['Auftrag-Nr.', 'auftragNr', 'z. B. FM-2026-014'],
    ['Erstellt von', 'ersteller', 'Name, Funktion']
  ];
  for (const [titel, schluessel, ph] of felder) {
    kopf.appendChild(feld(titel, p.kopf[schluessel], v => schreib(() => { p.kopf[schluessel] = v; }),
      { platzhalter: ph }));
  }
  kopf.appendChild(feld('Datum', p.kopf.datum, v => schreib(() => { p.kopf.datum = v; }), { typ: 'date' }));

  /* Stand, „Für die Richtigkeit“ und Einstufung stehen im Kopf der technischen
     Fernmeldeskizze beieinander und werden auch zusammen ausgefüllt. */
  kopf.appendChild(el('h3', 'gruppen-titel', 'Angaben der Fernmeldeskizze (KatS-Dv 861, Anlage 7)'));

  const standReihe = el('div', 'kopf-stand');
  const standFeld = feld('Stand (Datum-Zeit-Gruppe)', p.kopf.stand,
    v => schreib(() => { p.kopf.stand = v; }), { platzhalter: 'z. B. 301430AUG26' });
  const standEingabe = standFeld.querySelector('input');
  standReihe.append(standFeld, knopf('Jetzt', () => {
    const jetzt = dtg();
    schreib(() => { p.kopf.stand = jetzt; });
    standEingabe.value = jetzt;
  }, 'klein'));
  kopf.appendChild(standReihe);

  kopf.appendChild(feld('Für die Richtigkeit (F.d.R.)', p.kopf.fdr,
    v => schreib(() => { p.kopf.fdr = v; }), { platzhalter: 'Name, Funktion' }));
  kopf.appendChild(feld('Einstufung', p.kopf.vsgrad,
    v => schreib(() => { p.kopf.vsgrad = v; }), { typ: 'select', werte: VS_GRADE }));
  kopf.appendChild(el('p', 'klein',
    `Diese Angaben stehen im Kopf des Bauauftrags; die Einstufung wird zusätzlich
     auf jedem Blatt oben ausgegeben.`));

  kopf.appendChild(feld('Allgemeine Bemerkung', p.kopf.bemerkung,
    v => schreib(() => { p.kopf.bemerkung = v; }), { typ: 'textarea', zeilen: 3 }));

  const sp = document.getElementById('projekt-speicher');
  sp.innerHTML = '';
  sp.appendChild(el('h3', 'gruppen-titel', 'Speicher'));

  const belegt = speicherBelegung();
  const anteil = belegt / SPEICHER_KONTINGENT * 100;
  const anteilText = anteil < 1 ? 'unter 1 %' : `rund ${Math.round(anteil)} %`;
  sp.appendChild(el('p', 'klein',
    `Alle Planungen liegen im <b>Speicher dieses Browsers</b> (localStorage) und werden
     automatisch gespeichert. Belegt sind <b>${Math.round(belegt / 1024)} kB</b> von den
     rund <b>5 MB</b>, die ein Browser je Website bereitstellt – ${anteilText}.`));

  /* Die Bilddaten zählen nicht in dieses Kontingent: sie liegen im Bildspeicher
     des Browsers, der weit mehr fasst. Genannt werden sie trotzdem – es ist
     der Posten, der eine Planung schwer macht. */
  const bilder = (p.bilder || []).length;
  if (bilder) {
    sp.appendChild(el('p', 'klein',
      `Dazu kommen <b>${bilder} ${bilder === 1 ? 'Bild' : 'Bilder'}</b> mit
       <b>${Math.round(bilderBelegung(p) / 1024)} kB</b> im Bildspeicher des Browsers
       (IndexedDB). Sie gehen in die Sicherungsdatei ein und machen sie entsprechend groß.`));
  }

  const gesichert = dateisicherung(store.projekt.id);
  sp.appendChild(el('p', 'klein',
    gesichert
      ? `Zuletzt als Datei gesichert: <b>${new Date(gesichert).toLocaleString('de-DE',
          { dateStyle: 'short', timeStyle: 'short' })}</b>.`
      : `Diese Planung wurde <b>noch nie als Datei gesichert</b>. Wird der Browserspeicher
         geleert – beim Beenden, im privaten Fenster oder auf einem geteilten Rechner –,
         ist sie verloren.`));

  const tasten = el('div', 'tastenreihe');
  tasten.append(
    knopf('Als Datei sichern', () => {
      sicherungMelden(io.projektExportieren(), 'Planung als Datei gesichert');
    }, 'primaer'),
    knopf('Jetzt im Browser speichern', () => { store.speichern(); hinweis('Planung gespeichert'); }),
    knopf('Gespeicherte Planungen', () => projektDialog())
  );
  sp.appendChild(tasten);

  // Version im Blick behalten: Auf dem gedruckten Bauauftrag steht sie ohnehin
  // im Blattfuß – wer eine Rückfrage stellt oder einen Fehler meldet, soll sie
  // auch in der Oberfläche finden, ohne ein Blatt drucken zu müssen.
  const ueber = document.getElementById('projekt-ueber');
  ueber.innerHTML = '';
  ueber.appendChild(el('h3', 'gruppen-titel', 'Über FMBauplaner'));
  ueber.appendChild(el('p', 'klein',
    `Version <b>${escapeHtml(VERSION)}</b>. Der Quelltext steht unter der
     <b>EUPL-1.2</b> auf
     <a href="https://github.com/wattnpapa/fernmeldebauplaner" target="_blank"
        rel="noopener noreferrer">GitHub</a>.`));
  // In neuem Tab: die Planung liegt zwar im Browserspeicher und ginge auch beim
  // Wegnavigieren nicht verloren, aber ein halb gezeichneter Streckenzug schon.
  ueber.appendChild(el('p', 'klein',
    `Wer dahintersteht und woher die Bauregeln stammen:
     <a href="autor/" target="_blank" rel="noopener">Über den Autor</a>.`));
}

/* Die Liste hier ist der Browserspeicher dieses Geräts, nicht der angebundene
   Speicher – der lädt nur hinauf und legt nichts still an (siehe den Kopf von
   abgleich.js). Nach einem geleerten Browser sieht das wie Datenverlust aus,
   obwohl alles noch in der Dropbox liegt. Deshalb meldet cloud-ui.js hier
   einen Öffner für seine Liste an; ui.js selbst weiß weiter nichts von der
   Anbindung und lädt sie auch nicht mit. */
let speicherlisteOeffner = null;
export function speicherlisteAnmelden(fn) { speicherlisteOeffner = fn; }

export function projektDialog() {
  const liste = projektListe();
  const amSpeicher = speicherlisteOeffner && speicherlisteOeffner();
  const box = el('div', 'projektliste');
  if (!liste.length) {
    box.appendChild(el('p', 'klein', amSpeicher
      ? `In diesem Browser liegt noch keine Planung. Was am angebundenen Speicher
         liegt, steht unter „Planungen am Speicher“ und lässt sich von dort holen.`
      : 'Noch keine gespeicherten Planungen.'));
  }

  for (const pr of liste) {
    /* Die schon offene Planung lässt sich nicht noch einmal öffnen. Ihr Knopf
       wird dafür wirklich gesperrt und nicht nur blass gestellt: mit
       `pointer-events: none` hielt es allein die Maus auf – über die Tastatur
       ließ er sich weiter auslösen und warf dabei Undo- und Redo-Stapel weg,
       und die Sprachausgabe meldete einen gewöhnlichen, benutzbaren Knopf.
       Der Grund steht im Klartext in der Zeile daneben und nicht im title:
       den zeigt kein Touchgerät. */
    const offen = pr.id === store.projekt.id;
    const zeile = el('div', 'pl-zeile' + (offen ? ' aktiv' : ''));
    zeile.innerHTML =
      `<div class="pl-text"><b>${escapeHtml(pr.name)}</b>
        <span class="klein">${pr.strecken} Strecken · ${pr.zeichen} Zeichen${
          pr.bilder ? ` · ${pr.bilder} Bilder` : ''} ·
        ${new Date(pr.geaendert).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}${
          offen ? ' · <b class="pl-offen">gerade geöffnet</b>' : ''}</span></div>`;
    const t = el('div', 'pl-tasten');
    const oeffnen = knopf('Öffnen', () => {
      if (store.laden(pr.id)) { schliesseDialog(); hinweis(`„${pr.name}“ geöffnet`); }
    }, offen ? '' : 'primaer');
    oeffnen.disabled = offen;
    t.append(oeffnen, knopf('Löschen', () => loeschDialog(pr), 'gefahr'));
    zeile.appendChild(t);
    box.appendChild(zeile);
  }

  dialog({
    titel: 'Gespeicherte Planungen', inhalt: box, breit: true,
    fuss: [
      { text: 'Aus Datei laden', tun: () => { document.getElementById('datei-import').click(); } },
      ...(amSpeicher
        ? [{ text: 'Planungen am Speicher …', tun: () => { amSpeicher(); return false; } }]
        : []),
      { text: 'Schließen', primaer: true }
    ]
  });
}

/* Eine gespeicherte Planung zu löschen ist die einzige Handlung im Programm,
   die sich nicht rückgängig machen lässt – der Undo-Stapel wird dabei geleert.
   Deshalb der Name zur Bestätigung und die Dateisicherung als Ausweg. */
function loeschDialog(pr) {
  const zielwort = (pr.name || '').trim() || 'löschen';   // notfalls ein Ersatzwort
  const box = el('div');
  box.innerHTML =
    `<p>Die Planung <b>${escapeHtml(pr.name || '(ohne Namen)')}</b> mit ${pr.strecken}
        ${pr.strecken === 1 ? 'Strecke' : 'Strecken'}, ${pr.zeichen}
        taktischen Zeichen${pr.bilder ? ` und ${pr.bilder} ${pr.bilder === 1 ? 'Bild' : 'Bildern'}` : ''}
        wird endgültig aus dem Browserspeicher entfernt.</p>
     <p class="klein"><b>Rückgängig machen ist danach nicht mehr möglich</b> –
        auch nicht mit <b>↶</b>. Liegt keine Datei vor,
        ist die Planung weg.</p>
     <label class="feld"><span class="feld-titel">Zur Bestätigung
         <b>${escapeHtml(zielwort)}</b> eingeben</span>
       <input type="text" id="ld-name" autocomplete="off" spellcheck="false"
              placeholder="${escapeHtml(zielwort)}"></label>`;

  dialog({
    titel: 'Planung endgültig löschen',
    inhalt: box,
    fuss: [
      { text: 'Vorher als Datei sichern', tun: () => {
          sicherungMelden(io.projektExportieren(pr.id), 'Planung als Datei gesichert');
          return false;                       // Dialog bleibt offen
        } },
      { text: 'Abbrechen', tun: () => { projektDialog(); return false; } },
      { text: 'Endgültig löschen', gefahr: true, tun: () => {
          store.loeschen(pr.id);
          hinweis(`„${pr.name}“ gelöscht`);
          projektDialog();                    // zurück in die Liste
          return false;
        } }
    ]
  });

  // Der Löschknopf bleibt gesperrt, bis der Name genau dasteht
  const loeschKnopf = document.querySelector('#dialog-fuss .knopf.gefahr');
  const eingabe = box.querySelector('#ld-name');
  const pruefen = () =>
    loeschKnopf.disabled = eingabe.value.trim().toLowerCase() !== zielwort.toLowerCase();
  eingabe.addEventListener('input', pruefen);
  pruefen();
}

// ---------------------------------------------------------------- Ortssuche

/* Die Trefferliste ist an zwei Stellen dieselbe: im Koordinatendialog und am
   Aufbauplatz. Jeder Treffer ist ein Knopf auf Handschuhmaß; die Quelle steht
   darunter, weil die Lizenz von OpenStreetMap die Nennung verlangt. */
function trefferListe(ziel, treffer, aufWahl) {
  ziel.innerHTML = '';
  if (!treffer.length) {
    ziel.innerHTML = '<p class="klein"><b class="fehlertext">Nichts gefunden.</b> Ortsname und Straße anders schreiben oder den Ort auf der Karte antippen.</p>';
    return;
  }
  const liste = el('div', 'ort-treffer');
  treffer.forEach(tr => {
    const b = el('button', 'ort-treffer-zeile');
    b.type = 'button';
    b.innerHTML = `<b>${escapeHtml(trefferKurz(tr))}</b><span>${escapeHtml(tr.name)}</span>`;
    b.onclick = () => aufWahl(tr);
    liste.appendChild(b);
  });
  ziel.appendChild(liste);
  ziel.appendChild(el('p', 'klein', escapeHtml(ORTSSUCHE_QUELLE)));
}

/* Suche anstoßen und die Treffer in `ziel` schreiben; Fehler landen dort
   ebenfalls, nicht nur in der Pille – der Dialog steht offen, die Pille geht. */
function ortsSucheIn(ziel, text, aufWahl) {
  ziel.innerHTML = '<p class="klein">Wird bei Nominatim gesucht …</p>';
  return ortSuchen(text)
    .then(tr => trefferListe(ziel, tr, aufWahl))
    .catch(() => {
      /* Ohne Netz bleibt mehr als der Tipp auf die Karte: die Koordinate im
         selben Feld geht ohne jede Verbindung – und bei leerem Kartenvorrat ist
         sie der einzige Weg, der etwas trifft. */
      ziel.innerHTML = '<p class="klein"><b class="fehlertext">Die Ortssuche war nicht zu erreichen.</b> Ohne Netz: eine Koordinate eingeben (MGRS oder Grad) oder auf die Karte tippen.</p>';
    });
}

/** Dialog mit Trefferliste zu einem Suchtext; `aufWahl(treffer)` schließt ihn. */
function ortsDialog(text, aufWahl) {
  const box = el('div');
  box.innerHTML = `<p class="klein">Gesucht: <b>${escapeHtml(text)}</b> – der Suchtext geht dafür an Nominatim (OpenStreetMap).</p><div id="od-treffer"></div>`;
  dialog({ titel: 'Ort suchen', inhalt: box, fuss: [{ text: 'Abbrechen' }] });
  ortsSucheIn(box.querySelector('#od-treffer'), text, tr => {
    schliesseDialog();
    aufWahl(tr);
  });
}

// ---------------------------------------------------------------- Koordinatensuche

/* Was an einer nicht erkannten Eingabe falsch ist, so genau wie möglich. Über
   Funk kommt die Koordinate diktiert, und die häufigsten Fehler sind eine
   vergessene Ziffer und ein Buchstabe zu viel – „Koordinate nicht erkannt“
   ließ den Helfer raten, welcher Teil nicht passt. */
function koordinateFehlerText(roh) {
  const text = String(roh || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const mgrs = text.match(/^(\d{1,2}[C-X])\s?([A-Z]{2})\s?(\d+)\s?(\d*)$/);
  if (mgrs) {
    const [, zone, feld, a, b] = mgrs;
    if (b && a.length !== b.length) {
      return `Ostwert und Nordwert brauchen gleich viele Ziffern – hier ${a.length} und ` +
        `${b.length}. Beispiel: ${zone} ${feld} 56560 45282.`;
    }
    if (!b && a.length % 2) {
      return `Ostwert und Nordwert brauchen gleich viele Ziffern – ${a.length} Ziffern ` +
        'lassen sich nicht teilen.';
    }
    if (a.length + (b || '').length > 10) return 'Höchstens fünf Ziffern je Wert (auf den Meter genau).';
  }
  if (/[A-ZÄÖÜ]{3,}/.test(text) && !/^[NSOEW]\s?\d/.test(text)) {
    return 'Keine Koordinate erkannt. Ist es ein Ort oder eine Adresse, dann „Ort suchen“.';
  }
  return 'Koordinate nicht erkannt. Beispiel MGRS: 32U LB 56560 45282, Grad: 50.9413, 6.9583.';
}

/* `punktAnfuegen` kommt aus app.js, solange eine Strecke gezeichnet wird: die
   Koordinate wird dann Trassenpunkt statt Sprungziel. Das ist der einzige Weg,
   eine Strecke ganz ohne Zeigegerät zu erfassen – und der genaueste für eine
   über Funk durchgegebene MGRS-Angabe. Der Dialog bleibt dabei offen, weil am
   Funk selten nur eine Koordinate kommt. */
export function koordinatenSuche(punktAnfuegen = null) {
  const box = el('div');
  box.innerHTML = `
    <label class="feld"><span class="feld-titel">Ort oder Koordinate</span>
      <input type="text" id="ks-eingabe" placeholder="Hildesheim Bahnhof  ·  32U LB 56560 45282  ·  50.9413, 6.9583">
    </label>
    <p class="klein" id="ks-status">Ein Ort oder eine Adresse: „Ort suchen“. Eine Koordinate – MGRS, Dezimalgrad,
      Grad/Dezimalminuten oder Grad/Min./Sek.: „Anspringen“.</p>
    <div id="ks-treffer"></div>
    <label class="feld ks-haken nur-erweitert"><input type="checkbox" id="ks-marke"><span class="feld-titel">Zusätzlich ein taktisches Zeichen dort setzen</span></label>`;

  const ortSuchen = () => {
    const eingabe = box.querySelector('#ks-eingabe');
    const text = eingabe.value.trim();
    if (!text) { box.querySelector('#ks-status').innerHTML = '<b class="fehlertext">Erst einen Ort oder eine Adresse eingeben.</b>'; return; }
    ortsSucheIn(box.querySelector('#ks-treffer'), text, tr => {
      eingabe.value = `${tr.lat.toFixed(6)}, ${tr.lng.toFixed(6)}`;
      box.querySelector('#ks-treffer').innerHTML = '';
      box.querySelector('#ks-status').innerHTML =
        `<b>${escapeHtml(trefferKurz(tr))}</b> – ${toMGRS(tr.lat, tr.lng, 5)}. Jetzt anspringen${punktAnfuegen ? ' oder als Trassenpunkt anfügen' : ''}.`;
    });
  };
  const lesen = () => {
    const roh = box.querySelector('#ks-eingabe').value;
    const k = parseKoordinate(roh);
    if (!k) {
      const status = box.querySelector('#ks-status');
      status.innerHTML = `<b class="fehlertext">${escapeHtml(koordinateFehlerText(roh))}</b>`;
      /* Sieht die Eingabe nach einem Ort aus, steht der Griff zur Suche gleich
         in der Meldung – ein Tipp statt eines Fehlers. Im Audit gab
         „Hildesheim“ mit Enter nur die Fehlermeldung. Von selbst gesucht wird
         weiter nicht: der Suchtext geht nach außen, und das geschieht nur auf
         ausdrücklichen Griff (`datenschutz.html`). */
      if (/[A-Za-zÄÖÜäöüß]{3,}/.test(roh) && !/^[NSOEW]\s?\d/i.test(roh.trim())) {
        /* Als Frage und nicht als Fehler, und der Griff steht als Hauptknopf
           da: im Audit las sich das rote „Keine Koordinate“ wie ein Irrtum,
           und blau blieb „Anspringen“ – also genau der Weg, der eben
           gescheitert war. */
        status.innerHTML = '<b>Keine Koordinate – ist es ein Ort?</b> ';
        const suchen = knopf(`„${roh.trim().slice(0, 40)}“ als Ort suchen`, ortSuchen, 'klein primaer');
        status.appendChild(suchen);
        setTimeout(() => suchen.focus(), 0);
      }
    }
    return k;
  };
  let angefuegt = 0;

  const fuss = [
    { text: punktAnfuegen ? 'Schließen' : 'Abbrechen' },
    /* Der Suchtext geht nach außen – deshalb ein eigener Knopf und keine
       stille Suche, sobald die Eingabe keine Koordinate ist. Der Treffer wird
       als Dezimalkoordinate ins Feld geschrieben: danach gilt derselbe Weg
       wie für eine getippte Koordinate, Anspringen oder Anfügen. */
    { text: 'Ort suchen', tun: () => { ortSuchen(); return false; } },
    { text: 'Anspringen', primaer: !punktAnfuegen, tun: () => {
        const k = lesen();
        if (!k) return false;
        ctx.karte.setView([k.lat, k.lng], Math.max(ctx.karte.getZoom(), 16));
        if (box.querySelector('#ks-marke').checked) {
          store.aendern(p => p.zeichen.push(neuesZeichen(k.lat, k.lng, 'fm-messstelle')), 'zeichen');
        }
        hinweis(`Angesprungen (${k.format}) – ${toMGRS(k.lat, k.lng, 5)}`);
      } }
  ];
  if (punktAnfuegen) fuss.push({ text: 'Als Trassenpunkt anfügen', primaer: true, tun: () => {
    const k = lesen();
    if (!k) return false;
    if (punktAnfuegen(k) === false) return true;   // Zeichnen wurde beendet – Dialog zu
    angefuegt += 1;
    box.querySelector('#ks-status').innerHTML =
      `<b>${angefuegt === 1 ? 'Punkt angefügt' : angefuegt + ' Punkte angefügt'}</b> –
       ${toMGRS(k.lat, k.lng, 5)}. Nächste Koordinate eingeben oder schließen.`;
    const eingabe = box.querySelector('#ks-eingabe');
    eingabe.value = ''; eingabe.focus();
    return false;   // offen bleiben: die nächste Angabe kommt gleich
  } });

  dialog({
    titel: punktAnfuegen ? 'Koordinate als Trassenpunkt' : 'Ort oder Koordinate anspringen',
    inhalt: box, fuss
  });
}

// ---------------------------------------------------------------- Hilfe

export function hilfeDialog() {
  const inhalt = dialog({
    titel: 'Kurzanleitung', breit: true,
    inhalt: `
      <div class="hilfe">
        <h3>Einfache und erweiterte Ansicht</h3>
        <p>Die <b>einfache Ansicht</b> zeigt, was ein Trupp braucht: Strecken zeichnen,
           Leitungsart wählen, Bauauftrag mitnehmen, Baumodus. Die <b>erweiterte Ansicht</b>
           bringt das Lagebild dazu – taktische Zeichen, Flächen, Relaisstellen, Bilder – und
           alle Bauansatzwerte, die Lagekarte, den Sammeldruck und den eigenen Speicher.
           Umgeschaltet wird oben in der linken Leiste; die Planung bleibt in beiden Ansichten
           dieselbe.</p>
        <h3>Strecke planen</h3>
        <ol>
          <li><b>Neue Strecke zeichnen</b> wählen und die Trasse auf der Karte anklicken –
              vom Anfangs- zum Endpunkt.</li>
          <li>Mit <kbd>Enter</kbd> oder Doppelklick abschließen, <kbd>Rücktaste</kbd> nimmt
              den letzten Punkt zurück.</li>
          <li>Beim Zeichnen fügt <b>Koordinate</b> (<kbd>K</kbd>) einen Punkt exakt an –
              etwa eine über Funk durchgegebene MGRS-Angabe, ganz ohne Kartenklick.</li>
          <li>Punkte lassen sich später verschieben; die kleinen Griffe zwischen zwei Punkten
              fügen beim Ziehen einen Zwischenpunkt ein.</li>
          <li>Punktarten (Muffe, Querung, Mast …) in der Punkttabelle setzen – sie erscheinen
              in Karte und Bauauftrag.</li>
          <li>An einer <b>Querung</b> die Bauweise am Hindernis wählen: Überbau (Ü, Stangen
              über die Straße), Unterbau (U, Graben oder Durchlass) oder an einem Bauwerk
              entlang. Jede Querung bringt einen Zeitansatz in Minuten mit, der in die
              Bauzeit einfließt und sich je Punkt anpassen lässt.</li>
          <li><b>Trasse auf Querungen prüfen</b> sucht bei OpenStreetMap nach
              Freileitungen, Bahnstrecken und Umspannwerken entlang der Trasse. Jede
              Kreuzung lässt sich als Querungspunkt übernehmen, die Art ist dann schon
              gesetzt. Der Befund ist ein Vorschlag: Hochspannungsleitungen sind dort
              weitgehend vollständig verzeichnet, Ortsnetz-Freileitungen nicht, und wie
              hoch eine Leitung über Grund hängt, sagt keine Quelle – das bleibt Sache
              der Erkundung.</li>
        </ol>
        <h3>Längen</h3>
        <p>Teillängen stehen an jedem Abschnitt, Name und Summe an der Strecke. Gerechnet wird
           die geodätische Direktstrecke zwischen den Punkten; der <b>Bauzuschlag</b> deckt
           Geländeverlauf und Umwege ab. Ein Punkt der Art <b>Kabelreserve</b> bringt
           zusätzlich eine feste Länge mit – vorgegeben sind 10 m, am Punkt lässt sie sich
           ändern; die Vorschrift verlangt an Anfangs- und Endstelle 20 bis 30 m
           (KatS-Dv 861, 6.5.1). Zuschlag und Reserven zusammen ergeben den
           <b>Kabelbedarf</b>, aus dem die Trommelzahl folgt.</p>
        <h3>Stromleitungen</h3>
        <p>Bei der Leitungsart <b>Stromleitung</b> erscheint die Gruppe
           <b>Stromversorgung</b>. Aus Last, Netzform, zulässigem Spannungsfall und der
           Leitungslänge einschließlich Bauzuschlag und Kabelreserve ergibt sich der nötige
           Leiterquerschnitt; er steht auch auf dem Bauauftrag. Der Wert ist ein
           Planungsrichtwert für Kupferleitung – die verbindliche Auslegung trifft eine
           Elektrofachkraft.</p>
        <h3>Einsatzabschnitte</h3>
        <p>Große Planungen lassen sich in Einsatzabschnitte gliedern – sie sind freiwillig,
           ohne sie bleibt alles wie bisher. Über <b>+ Einsatzabschnitt</b> im Reiter
           „Strecken“ einen anlegen; die Zuteilung steht dann in jeder geöffneten Strecke,
           in jedem geöffneten taktischen Zeichen und gesammelt im Abschnitt selbst
           (Knopf <b>⋯</b> an der Abschnittszeile).</p>
        <ul class="tasten-liste">
          <li><b>Bis zu vier Ebenen:</b> im geöffneten Abschnitt legt <b>+ Unterabschnitt</b>
              einen Abschnitt darunter an, <b>Gehört zu</b> hängt ihn um. Vier Ebenen sind
              die Führungsorganisation eines Einsatzes – tiefer geht es nicht. In der Liste
              hängen die Unterabschnitte als Klammer in der Klammer; der Kopf zählt den
              ganzen Ast, und Sammelauftrag, Lagekarte und Datei eines Abschnitts nehmen
              seine Unterabschnitte mit.</li>
          <li><b>Zeichen gelten nach unten und nach oben:</b> ein Zeichen des Abschnitts
              Nord erscheint auf jedem Blatt seiner Unterabschnitte, und deren Zeichen auf
              dem Blatt von Nord. Nur der Nachbarabschnitt sieht sie nicht.</li>
          <li><b>Nicht zugeteilte Zeichen gehören allen:</b> sie erscheinen in jedem
              Abschnitt, auf dessen Karten und in dessen Datei. Ein zugeteiltes Zeichen
              nur in seinem eigenen. So bleibt das gemeinsame Lagebild – Führungsstelle,
              Bereitstellungsraum – überall stehen.</li>
          <li>Das <b>Auge</b> an der Abschnittszeile blendet alle seine Strecken und
              Zeichen zusammen aus der Karte aus, die Unterabschnitte mit – der eigene
              Schalter jedes Elements bleibt dabei erhalten.</li>
          <li><b>Als Datei sichern (.json)</b> gibt nur diesen Abschnitt heraus. Wer sie
              erhält, lädt sie über <b>Datei → Planung oder KML laden</b> und arbeitet an
              seinem Ausschnitt weiter, ohne die übrige Planung zu sehen.</li>
          <li><b>Abschnitt auflösen</b> entfernt nur die Gliederung; Strecken und Zeichen
              bleiben und gehören danach dem Abschnitt darüber – auf der obersten Ebene
              keinem mehr. Unterabschnitte rücken eine Ebene hinauf.</li>
        </ul>
        <h3>Zeichengruppen</h3>
        <p>Zeichengruppen fassen taktische Zeichen zu einem Lagebild zusammen –
           „Gefahrenstellen“, „Kräfte“, „Fernmeldemittel“ – und blenden sie gemeinsam
           ein und aus. Über <b>+ Zeichengruppe</b> im Reiter „Taktische Zeichen“ eine
           anlegen; die Zuteilung steht dann in jedem geöffneten Zeichen und gesammelt
           in der Gruppe selbst (Knopf <b>⋯</b> an der Gruppenzeile).</p>
        <ul class="tasten-liste">
          <li>Sie liegen <b>quer zum Einsatzabschnitt</b>: der sagt, wer zuständig ist,
              die Gruppe, was zusammengehört. Ein Zeichen kann beides tragen.</li>
          <li>Das <b>Auge</b> an der Gruppenzeile nimmt alle ihre Zeichen von der Karte –
              auch aus dem Bauauftrag. Der eigene Schalter jedes Zeichens bleibt dabei
              erhalten. Ein Zeichen, das nur die Gruppe verbirgt, steht blass in der
              Liste, sein Auge aber offen.</li>
          <li>Bestehen Gruppen <b>und</b> Einsatzabschnitte, wählt <b>Gliedern nach</b>
              über der Liste, welche der beiden sie zeigt.</li>
          <li><b>Gruppe auflösen</b> entfernt nur die Gliederung; die Zeichen bleiben und
              sind danach ungruppiert.</li>
        </ul>
        <h3>Bauauftrag</h3>
        <p>In der geöffneten Strecke <b>Bauauftrag (PDF)</b> wählen. Dort A4/A3, Hoch/Quer und
           Farbe/Schwarz-Weiß einstellen und über den Druckdialog des Browsers
           <b>„Als PDF speichern“</b> wählen.</p>
        <p>Für mehrere Strecken in einem Dokument gibt es den <b>Sammel-Bauauftrag</b>:
           für einen Einsatzabschnitt über dessen <b>⋯</b>, für die ganze Planung über
           <b>Sammel-PDF (alle Strecken)</b> im Reiter „Strecken“ – auf dem Telefon
           über <b>Datei → Sammel-Bauauftrag aller Strecken</b>, dort steht der Weg
           auch dann, wenn der Knopf der schmalen Ansicht weicht. Er beginnt mit einem
           Deckblatt samt Übersichtskarte und Summen, danach folgen das
           Streckenverzeichnis mit dem Materialbedarf nach Leitungsarten und je Strecke
           das gewohnte Kartenblatt. Welche dieser Blätter entstehen, ist oben in der
           Gruppe <b>Blätter</b> zu wählen.</p>
        <p>Die <b>Strichstärke</b> der Karteninhalte stellt ein Schieberegler von
           30 bis 200 % ein; sie gilt für Strecken, Flächenumrisse und
           Koordinatengitter. Nach unten hilft er, wenn zwei Trassen dieselbe Straße
           entlanglaufen und sonst zu einem Balken zusammenwachsen, nach oben für den
           Ausdruck, der bei Regen und im Halbdunkel gelesen wird, und für das Blatt an
           der Wand der Führungsstelle. Die Vorschau baut sich beim Loslassen des
           Reglers neu auf. Die Einstellung merkt sich das Gerät getrennt für
           Bauauftrag und Lagekarte.</p>
        <p>Im Druckdialog dasselbe Papierformat einstellen, das oben gewählt wurde, und
           die Ränder auf „Keine“ stellen – das Blatt bringt seine Ränder selbst mit.
           Der Hinweis am Druckknopf nennt die drei Angaben. Der vorgeschlagene Dateiname
           enthält Auftragsnummer, Strecke und Datum.</p>
        <h3>Lagekarte</h3>
        <p>Für die Führungsstelle gibt es ein einzelnes großes Blatt, auf dem die Karte
           alles ist: <b>Lagekarte (PDF)</b> im Reiter „Strecken“ oder im Menü „Datei“,
           für einen Einsatzabschnitt über dessen <b>⋯</b>. Sie zeigt alle Strecken mit
           Namen und Länge, die taktischen Zeichen und das Koordinatengitter; am Rand
           stehen Titelzeile, Kopfdaten, Zeichenerklärung, Kennzahlen und Fußzeile –
           jeder dieser Streifen einzeln abschaltbar. Alle fünf aus ergibt das nackte
           Kartenblatt; auch die Streckenbeschriftung lässt sich von der Karte nehmen,
           wenn nur die Lage zählt. Auch die <b>Strecken</b> selbst lassen sich
           ganz von der Karte nehmen – für das Blatt eines Aufbauplatzes mit
           Zeichen und Flächen allein. Der Ausschnitt bleibt dabei unverändert:
           er umfasst immer die ganze Auswahl, gleich was gerade abgeschaltet
           ist, damit die Blätter einer Lage deckungsgleich übereinander liegen.
           Gibt es Einsatzabschnitte, steht in der Gruppe <b>Einsatzabschnitte</b>
           je Abschnitt ein Haken, dazu <b>Ohne Abschnitt</b> für alles, was
           keinem zugeteilt ist – Führungsstelle, Bereitstellungsraum, das
           gemeinsame Lagebild. Abgehakt heißt: steht auf dem Blatt. So lässt
           sich jede Zusammenstellung drucken, ein Abschnitt allein ebenso wie
           zwei benachbarte. Bleibt genau einer übrig, wird das Blatt seine
           Lagekarte: Titel, Kopfdaten, Zeichenerklärung und Kennzahlen gehen
           mit. Die Augen der Abschnitte auf der Arbeitskarte reden dabei nicht
           mehr mit – gedruckt wird, was hier angehakt ist.
           <b>Eingemittet auf</b> engt zusätzlich Blattmitte und Maßstab auf
           einen der gewählten Abschnitte ein, ohne etwas von der Karte zu
           nehmen: die Nachbarschaft bleibt ringsum zu sehen. Einmal je
           Abschnitt gedruckt, ergibt das den Satz Blätter für die
           Abschnittsleitungen; welcher gemeint ist, steht in den Kopfdaten.
           Stehen bleiben nur zwei Angaben: die Einstufung,
           die auf jedes Blatt gehört, und die Nennung der Kartengrundlage – sie
           rückt ohne Fußzeile in die Kartenecke, weil die Lizenz sie verlangt.</p>
        <p>Formate sind <b>A4 bis A0</b> und ein <b>freies Maß</b> in Millimetern – für
           Plotterrollen. Schrift, Beschriftung und Strichstärken wachsen mit dem Blatt,
           damit eine A0-Karte auch aus zwei Metern zu lesen ist. Große Blätter kennt
           kein Druckdialog von sich aus: dort ein eigenes Papierformat mit den
           Kantenlängen anlegen, die der Hinweis am Druckknopf nennt. In der Regel wird
           die Lagekarte als PDF gespeichert und beim Plotter ausgegeben.</p>
        <h3>Flächen und Aufbauplatz</h3>
        <p>Im Reiter <b>Flächen</b> (<kbd>F</kbd>) lassen sich Grundrisse maßstäblich
           einzeichnen: der <b>FüKomKW</b> und der <b>Anhänger FüLa</b> jeweils
           aufgebaut, das <b>Zelt SG 300</b>, der <b>Aufbauplatz</b> der Führungsstelle
           von etwa 25 × 15 m oder eine <b>freie Fläche</b> mit eigenen Maßen. Die
           beiden Aufstellungen des Erkundungsblatts – Fahrzeug, ein oder zwei
           Anhänger und Zelt – kommen mit einem Klick Kante an Kante auf die Karte.</p>
        <ul class="tasten-liste">
          <li>Der Klick auf die Karte setzt die <b>Mitte</b>; der Ring über der Fläche
              <b>dreht</b> sie, im Eintrag stehen Drehung und Maße auch als Zahl.</li>
          <li>Eine Aufstellung bleibt beim Verschieben und Drehen zusammen. <b>Aus der
              Aufstellung lösen</b> gibt ein Teil frei, wenn der Platz es verlangt.</li>
          <li>Herausgezoomt schrumpft die Fläche bis zu einer kleinen eckigen Marke –
              sie bleibt findbar, wird aber nie größer gezeichnet, als sie ist.</li>
          <li>Flächen erscheinen im Bauauftrag, auf der Lagekarte und in GeoJSON und
              KML als Grundriss; wie Zeichen lassen sie sich Einsatzabschnitten zuteilen.</li>
        </ul>
        <h3>Relaisstellen des Sprechfunks</h3>
        <p>Im Reiter <b>Relais</b> (<kbd>R</kbd>) wird geplant, wohin eine Relaisstelle
           über das Gelände trägt – im <b>4-m-</b> und <b>2-m-Band</b> analog und in
           <b>TETRA DMO</b>. Standort auf der Karte setzen, Band und Antennenhöhe über
           Grund eintragen, dann zeigt <b>Ausbreitung zeigen</b> die Fläche in drei
           Zonen: <b>freie Sicht</b>, <b>Randbereich</b> – dort steht eine Kante im Weg,
           die Beugung trägt aber noch – und der ungefärbte <b>Funkschatten</b>.</p>
        <ul class="tasten-liste">
          <li>Die <b>Gegenstelle</b> entscheidet mit: eine Fläche für die Fahrzeugantenne
              gilt für das <b>Handfunkgerät am Mann</b> nicht mehr. Sie steht deshalb als
              eigene Wahl im Formular und nicht als stille Annahme.</li>
          <li><b>Masthöhe bis zu einem Ort …</b> und dann auf die Karte klicken: das sagt,
              ab welcher Antennenhöhe dieser Ort frei liegt und welcher Mast das trägt –
              oder dass auch der höchste nicht reicht und der Standort zu wechseln ist.</li>
          <li><b>Überdeckung aller</b> legt die Flächen aller Relaisstellen zusammen und
              weist die versorgte Fläche in Quadratkilometern aus.</li>
          <li>Die Länge des <b>λ/4-Rundstrahlers</b> steht im Eintrag, dazu die Spanne
              über das Band – ohne zugeteilten Kanal gilt die Bandmitte. Der Strahler
              braucht eine <b>Gegengewichtsfläche</b>: auf dem Fahrzeug das Dach, am Mast
              drei bis vier Radiale derselben Länge.</li>
          <li><b>Bewuchs und Bebauung</b> verdecken standardmäßig mit – im 2-m- und
              4-m-Band ist der Wald kein Nebenumstand. Abschalten zeigt, was das Gelände
              allein hergibt; der Unterschied zwischen beiden Flächen ist das, was der
              Wald kostet.</li>
          <li>Die Fläche ist die <b>günstigste Annahme</b> und kein Empfangsnachweis.
              Sie wird deshalb auch <b>nicht gespeichert</b> – wer die Masthöhe ändert,
              rechnet neu.</li>
        </ul>
        <h3>Bilder vom Bauort</h3>
        <p>Lichtbilder, die ein Telefon aufgenommen hat, tragen ihren Aufnahmeort in sich.
           Im Reiter <b>Bilder</b> über <b>Bilder vom Gerät hinzufügen</b> auswählen – am
           Telefon öffnet das unmittelbar die Fotoauswahl – oder Bilddateien aus einem
           Ordner auf die Karte ziehen. Jedes Bild setzt sich an seinen Aufnahmeort; dort
           steht ein kleiner Punkt, der beim Überfahren die Aufnahme aufgehen lässt. Ein
           Klick darauf zeigt sie groß.</p>
        <ul class="tasten-liste">
          <li>Bilder <b>ohne Ortsangabe</b> der Kamera gehen nicht verloren: sie stehen in
              der Liste und warten auf <b>Ort auf Karte setzen</b>.</li>
          <li>Was die Kamera aufgezeichnet hat, ist eine <b>Messung</b> und wird auf der
              Karte <b>nicht verschoben</b> – ein Rutscher mit der Maus darf daraus keine
              Behauptung machen. Weicht der Ort ab, setzt ihn <b>Ort von Hand setzen</b>
              im geöffneten Bild ausdrücklich neu. Von Hand gesetzte Orte hängen danach
              am Griff und lassen sich auf der Karte nachjustieren.</li>
          <li>Beschriftung und Bemerkung erklären, was zu sehen ist; Aufnahmezeit,
              Blickrichtung und Gitterangabe stehen darunter, soweit die Kamera sie
              aufgezeichnet hat.</li>
          <li><b>HEIC</b> vom iPhone wird gelesen – auch die Rohdatei aus einem Ordner,
              die sonst kein Browser außer Safari öffnet. Beim ersten HEIC-Bild lädt
              die Anwendung dafür einmalig einen Entschlüsseler nach; das dauert einen
              Augenblick und geschieht nur, wenn wirklich eine solche Datei kommt.</li>
          <li>Die Bilder werden auf handliche Größe gebracht und liegen im
              <b>Bildspeicher dieses Browsers</b>, nicht im Netz. In die
              <b>Sicherungsdatei</b> gehen sie mit ein – sie wird dadurch entsprechend groß.</li>
          <li>Sie erscheinen <b>nicht</b> im Bauauftrag, nicht auf der Lagekarte und nicht
              in GeoJSON, GPX oder KML.</li>
        </ul>
        <h3>Baumodus</h3>
        <p>Der Schalter links oben nennt den Modus, in dem man gerade ist – in der
           Planung steht <b>Planung ⇄</b> darauf, ein Tipp darauf führt in den
           <b>Baumodus</b>. Dort zeigt die Anwendung, was am Bauort gebraucht wird, und
           hält fest, was gebaut wurde – die Planung bleibt unangetastet. Am Bauort geht
           es über die Karte:</p>
        <ul>
          <li>Unten <b>Punkt hier</b>: der Standort des Geräts wird als gebauter Punkt
              aufgenommen. <b>Auf Karte</b>: der nächste Tipp auf die Karte ist der Punkt.</li>
          <li>Eine <b>geplante Marke antippen</b>: <b>Wie geplant</b> bestätigt sie,
              <b>Hier</b> nimmt den Standort, <b>Auf Karte</b> die angetippte Stelle.
              Geplante Punkte lassen sich im Baumodus nicht verschieben.</li>
          <li>Nach jeder Aufnahme fragt die <b>Punktkarte</b> „Was ist hier?“ – ein Tipp auf
              Trassenpunkt, Muffe, Reserve, Mast, Querung, Verteiler oder Sonstiges genügt;
              an der Querung noch einer auf Überbau, Unterbau oder an Brücke. Dazu die
              Bemerkung. Ohne Tipp bleibt die Art offen: der Punkt steht dann mit einem
              Fragezeichen auf der Karte und als Lücke in der Liste – so ist am Ende zu
              sehen, wo noch etwas fehlt. Ein Tipp auf eine gebaute Marke öffnet sie wieder.</li>
          <li>Im Reiter <b>Bau</b> steht dasselbe als Liste, dazu Bauabschnitte,
              Baumeldungen, Materialnachweis, Meldung an den S 6, Übergabe und ganz unten
              die Karte zum Mitnehmen. Der Sprungstreifen oben führt hin.</li>
          <li>Unter <b>Zurückmelden</b> entsteht die Baumeldung an den Planer – als Link,
              zum Teilen oder als Datei. Verschicken muss sie der Trupp selbst: das Gerät
              weiß nicht, ob sie ankommt. Dort stehen auch <b>Trupp</b> und
              <b>Truppführer</b>: ohne sie nennt die Meldung niemanden. Danach steht dort,
              wann der Link erzeugt wurde und ob seither etwas dazugekommen ist.</li>
        </ul>
        <h3>Koordinaten</h3>
        <p>Unten steht die Koordinate der Stelle, über der die Maus steht oder die zuletzt
           angetippt wurde – in MGRS und als GPS-Angabe. Ein Klick auf die Angabe legt sie in
           die Zwischenablage. In der Punkttabelle öffnet ein Klick auf die Koordinate alle
           Formate zum Kopieren und erlaubt die Eingabe einer neuen Position.</p>
        <h3>Google Earth</h3>
        <p><b>Herein:</b> Die Vorplanung dort als <b>.kml</b> oder <b>.kmz</b> sichern und über
           <b>Datei → Planung oder KML laden</b> öffnen. Pfade werden zu Strecken,
           Ortsmarken zu taktischen Zeichen; beides tritt zur geöffneten Planung hinzu und
           lässt sich mit <b>↶</b> oben wieder zurücknehmen.</p>
        <p><b>Hinaus:</b> <b>Datei → Alles als KML</b>, für eine einzelne Trasse der Knopf
           <b>KML</b> in der geöffneten Strecke. Jede Strecke wird ein Pfad in ihrer Farbe,
           dazu Ortsmarken für Anfang, Ende und jede bauliche Besonderheit; die
           Einsatzabschnitte werden Ordner. Kabelart, Trassenlänge und Bedarf stehen in der
           Sprechblase des Pfades.</p>
        <h3>Speichern</h3>
        <p>Alles wird laufend im Browserspeicher gespeichert. Für Sicherung und Weitergabe
           <b>Datei → Planung als Datei sichern</b> verwenden – die Bilder gehen mit ein.</p>
        <h3>Tastatur</h3>
        <ul class="tasten-liste">
          <li><kbd>S</kbd> neue Strecke · <kbd>T</kbd> taktisches Zeichen · <kbd>F</kbd> Fläche ·
              <kbd>R</kbd> Relaisstelle · <kbd>K</kbd> Koordinate</li>
          <li><kbd>Strg</kbd>+<kbd>Z</kbd> rückgängig · <kbd>Strg</kbd>+<kbd>Umschalt</kbd>+<kbd>Z</kbd> wiederholen</li>
          <li><kbd>Enter</kbd> Zeichnen beenden · <kbd>Esc</kbd> abbrechen</li>
          <li><kbd>Strg</kbd>+<kbd>P</kbd> Bauauftrag der gewählten Strecke öffnen</li>
        </ul>
      </div>`,
    fuss: [
      /* Der Rückweg zur Sprungliste, ohne dass sie Höhe kostet: quer bleiben
         dem Inhalt rund 240 px, und eine festgehaltene Leiste nähme davon ein
         Drittel. Im Fuß steht sie ohnehin – der bleibt stehen. */
      { text: '↑ Zur Übersicht', tun: () => { inhalt.scrollTop = 0; return false; } },
      { text: 'Schließen', primaer: true }
    ]
  });

  /* 6.662 px Text – „Baumodus“ lag zwölf Schirme tief, und wer ihn suchte,
     rollte an vierzehn Abschnitten vorbei. Die Sprungliste wird aus den
     Überschriften gebaut und nicht daneben gepflegt: sonst nennt sie nach der
     nächsten Ergänzung einen Abschnitt zu wenig. */
  const kopfe = [...inhalt.querySelectorAll('.hilfe h3')];
  const streifen = el('nav', 'hilfe-sprung');
  streifen.setAttribute('aria-label', 'In der Kurzanleitung springen');
  const springe = ziel => () => ziel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /* Zwei Einstiege vorweg, einer je Modus: die Anwendung hat genau diese zwei
     Zustände, und am Bauort wird der zweite gesucht. Sie stehen über der
     Liste und nicht in ihr – in der Reihe der fünfzehn Abschnitte wären sie
     zwei Chips unter fünfzehn. */
  /* Die Einstiege sprechen die Lage des Lesers an und nicht den Modus: wer
     einen Link vom Planer bekommen hat, weiß nicht, dass das, was er sucht,
     „Baumodus“ heißt. */
  const einstieg = el('div', 'hs-einstieg');
  const EINSTIEGE = [['▸ Ich plane eine Strecke', 'Strecke planen'],
                     ['▸ Ich habe einen Link vom Planer', 'Baumodus']];
  for (const [text, titel] of EINSTIEGE) {
    const ziel = kopfe.find(h => h.textContent.trim() === titel);
    if (ziel) einstieg.appendChild(knopf(text, springe(ziel), 'klein hs-modus'));
  }
  if (einstieg.children.length) streifen.appendChild(einstieg);

  /* Was nur die erweiterte Ansicht zeigt, steht in der einfachen nicht als
     Sprungziel da – im Audit fand ein Erstnutzer dort „Relais“ und „Tastatur“
     und suchte sie danach vergeblich auf dem Schirm. Der Text bleibt, nur die
     Einstiege dazu treten zurück. */
  const NUR_ERWEITERT = new Set(['Einsatzabschnitte', 'Zeichengruppen', 'Lagekarte',
    'Flächen und Aufbauplatz', 'Relaisstellen des Sprechfunks', 'Bilder vom Bauort', 'Tastatur']);

  /* Vier Überschriften tragen im Text ihren vollen Namen und im Chip das
     Wort, das am Reiter steht. Ohne diese Abkürzung stand der Streifen bei
     390 px 406 px hoch – die Übersicht wäre selbst ein Schirm zum Durchrollen
     gewesen. Was hier nicht steht, behält seinen vollen Titel. */
  const KURZ = {
    'Strecke planen': 'Strecke', 'Flächen und Aufbauplatz': 'Flächen',
    'Relaisstellen des Sprechfunks': 'Relais', 'Bilder vom Bauort': 'Bilder'
  };
  for (const h of kopfe) {
    const titel = h.textContent.trim();
    streifen.appendChild(knopf(KURZ[titel] || titel, springe(h),
      'klein' + (NUR_ERWEITERT.has(titel) ? ' nur-erweitert' : '')));
  }
  inhalt.querySelector('.hilfe').prepend(streifen);
}

// ---------------------------------------------------------------- Hilfsknopf

function knopf(text, tun, klasse = '') {
  const b = el('button', 'knopf ' + klasse, escapeHtml(text));
  b.onclick = tun;
  return b;
}
