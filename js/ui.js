// ui.js – Seitenleiste, Formulare, Dialoge

import {
  store, KABELTYPEN, VERLEGEARTEN, PUNKTARTEN, FARBEN,
  neuesZeichen, punktartById, kabelById, neueStrecke, neuerEinsatzabschnitt, abschnittById,
  neueZeichengruppe, zeichengruppeById, zeichenInGruppe,
  streckenIm, zeichenIm, zeichenSichtbar, streckeSichtbar, bilderBelegung, bildmarkenAn,
  flaechenIm, flaecheSichtbar, relaisstellenIm, relaisstelleSichtbar,
  projektListe, speicherBelegung, SPEICHER_KONTINGENT, dateisicherung, id, neuerPunkt,
  BAUSTAENDE, baustandById, mengeOderNichts
} from './state.js';
import { kennzahlen, gesamtKennzahlen, segmentLaengen, kumuliert, escapeHtml } from './strecken.js';
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
  bandById, mimoById, gueltigeBandbreite, datenrateText, funkstrecke, azimutText
} from './richtfunk.js';
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
import { zeichneFunksicht, basiskarteById } from './map.js';
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
  UMKREIS_MINDESTENS as UMKREIS_MIN, UMKREIS_HOECHSTENS as UMKREIS_MAX
} from './ausbreitung.js';
import { relaisTitel, relaisKurz, befundLesen, masthoeheFuer, rechenwerte } from './relais.js';
import {
  baukennzahlen, istPunkte, bauabschnitte, bauabschnittById, istZuSoll,
  istPunktSetzen, istArtSetzen, bauabschnittAnlegen, bauabschnittLoeschen, bauSichern,
  sollPunktGeloescht, bauUmkehren, bauBegonnen, baustandKurz, baustrecke, baustreckeSetzen,
  aktiverBauabschnitt, bauabschnittAktivId, bauabschnittAktivSetzen, punktartText,
  quelleText, uhrzeit, ABWEICHUNG_SCHWELLE,
  materialzeilen, materialzeile, materialSetzen, materialFreiAnlegen, materialZeileLoeschen,
  materialSumme, materialSoll, baumeldungen,
  baumeldungAnlegen, baumeldungLoeschen, meldungenNachZeit,
  pruefungSichern, pruefzeilen, pruefzeileAnlegen, pruefzeileLoeschen
} from './baudoku.js';
import {
  vorschlag, truppText, befund, einspielen, berichtText
} from './baumeldung.js';
import { meldungAlsLink, laengenUrteil } from './teilen.js';
/* Die Ortung liegt bei der Karte des Baumodus und wird von dort eingeführt –
   nicht umgekehrt: `baukarte.js` braucht nichts aus dieser Datei, was es nicht
   beim Start hereingereicht bekommt, und ein Ring zwischen beiden liefe beim
   Laden ins Leere. */
import { istPunktAusStandort } from './baukarte.js';
import { VERSION } from './version.js';

let ctx = null;   // { karte, sl, zl, aufAenderung }

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
  /* Reine Text-Dialoge haben im Inhalt nichts Fokussierbares – dann übernimmt
     der erste Fußknopf, sonst der Schließen-Knopf, damit die Tastatur im
     Dialog beginnt statt dahinter. */
  const ersterFokus = feld.querySelector('input,select,textarea,button')
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
    ein = document.createElement('input');
    ein.type = o.typ || 'text';
    /* Die Zifferntastatur des Geräts statt der Volltastatur: am Bauort wird
       die Menge im Stehen mit Handschuh getippt, und `type="number"` allein
       öffnet auf iOS weiter das ganze Feld. */
    if (ein.type === 'number') ein.inputMode = 'decimal';
    if (o.min !== undefined) ein.min = o.min;
    if (o.max !== undefined) ein.max = o.max;
    if (o.step !== undefined) ein.step = o.step;
    if (o.platzhalter) ein.placeholder = o.platzhalter;
  }
  if (o.typ !== 'select') ein.value = wert ?? '';
  if (o.einheit) wrap.classList.add('mit-einheit');
  ein.addEventListener(o.typ === 'select' ? 'change' : 'input', () => {
    if (ein.type === 'number') {
      /* Was keine Zahl ergibt, wurde bisher still zu `null` – und nahm im
         Materialnachweis die ganze Zeile mit. Wer „1,5“ mit Komma tippte oder
         sich um ein Minus vertat, sah seine Menge verschwinden, ohne zu
         erfahren warum. Die Eingabe wird jetzt abgewiesen: das Feld färbt
         sich, der bisherige Wert bleibt stehen, und gemeldet wird beim
         Übergang – nicht bei jedem Tastendruck, sonst stünde die Pille
         dauerhaft. */
      const schlecht = ein.validity.badInput || (ein.value !== '' && !ein.checkValidity());
      const vorher = wrap.classList.contains('feld-abgewiesen');
      wrap.classList.toggle('feld-abgewiesen', schlecht);
      if (schlecht) {
        if (!vorher) {
          hinweis(o.min !== undefined && ein.validity.rangeUnderflow
            ? `Keine Menge unter ${o.min} – der bisherige Wert bleibt stehen.`
            : 'Das ist keine Zahl – der bisherige Wert bleibt stehen.', 'warnung');
        }
        return;
      }
    }
    const v = ein.type === 'number' ? (ein.value === '' ? '' : Number(ein.value)) : ein.value;
    beiAenderung(v);
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

export function zeichneStreckenListe() {
  const p = store.projekt;
  const liste = document.getElementById('strecken-liste');
  const summe = document.getElementById('strecken-summe');
  const abschnitte = alphabetisch(p.einsatzabschnitte || [], nachName);
  liste.innerHTML = '';

  const ges = gesamtKennzahlen(p.strecken);
  /* Trasse und Bedarf sind Kabellängen; die Funkstrecke steht in beiden nicht.
     Der Hinweis hängt am Wert, weil sonst nur die Aufstellung darunter verrät,
     warum die Zeilen sich nicht zur Gesamtzahl addieren. */
  const ohneFunk = ges.funkStrecken ? ' title="ohne Funkstrecken – dort liegt kein Kabel"' : '';
  summe.innerHTML = p.strecken.length
    ? `<span><b>${p.strecken.length}</b> ${p.strecken.length === 1 ? 'Strecke' : 'Strecken'}</span>
       ${abschnitte.length ? `<span><b>${abschnitte.length}</b> ${abschnitte.length === 1 ? 'Abschnitt' : 'Abschnitte'}</span>` : ''}
       <span${ohneFunk}>Trasse <b>${formatLaenge(ges.trasse)}</b></span>
       <span${ohneFunk}>Bedarf <b>${formatLaenge(ges.bedarf)}</b></span>
       <span><b>${ges.trommeln}</b> ${ges.trommeln === 1 ? 'Trommel' : 'Trommeln'}</span>
       ${kabelSummeHTML(ges)}`
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

  if (!p.strecken.length) {
    liste.appendChild(el('div', 'leer',
      `<p><b>Noch keine Strecke geplant.</b></p>
       <p>„Neue Strecke zeichnen“ wählen und die Trasse auf der Karte anklicken –
       Punkt für Punkt vom Anfangs- zum Endpunkt. Mit Doppelklick oder <kbd>Enter</kbd> abschließen.</p>`));
    if (!abschnitte.length) return;
  }

  /* Ohne Einsatzabschnitte bleibt die Liste, was sie war: eine Reihe Strecken.
     Erst wenn welche gebildet sind, tritt die Gliederung dazwischen. */
  if (!abschnitte.length) {
    for (const s of alphabetisch(p.strecken, nachName)) liste.appendChild(streckenKarte(s));
    return;
  }

  for (const ea of abschnitte) liste.appendChild(abschnittGruppe(ea, 'strecken'));
  if (streckenIm(p, null).length) liste.appendChild(abschnittGruppe(null, 'strecken'));
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
             title="${o.oeffnenTitel}" aria-label="${o.oeffnenTitel}">⋯</button>`;

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
    if (!o.eintraege.length) inhalt.appendChild(el('p', 'klein ea-leer', o.leer));
    for (const x of o.eintraege) inhalt.appendChild(o.karte(x));
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
    wert: e => `${e.length} · ${formatLaenge(gesamtKennzahlen(e).trasse)}`,
    neu: () => zeichneStreckenListe(),
    karte: x => streckenKarte(x),
    leer: 'Keine Strecke zugeteilt. Die Zuteilung steht in der geöffneten Strecke oder unter „⋯“.'
  },
  zeichen: {
    eintraege: (p, aid) => alphabetisch(zeichenIm(p, aid), zeichenTitel),
    wert: e => `${e.length} Zeichen`,
    neu: () => zeichneZeichenListe(),
    karte: x => zeichenKarte(x),
    leer: 'Kein Zeichen zugeteilt. Nicht zugeteilte Zeichen gehören ohnehin zu jedem Abschnitt.'
  },
  flaechen: {
    eintraege: (p, aid) => alphabetisch(flaechenIm(p, aid), flaechenTitel),
    wert: e => `${e.length} ${e.length === 1 ? 'Fläche' : 'Flächen'}`,
    neu: () => zeichneFlaechenListe(),
    karte: x => flaecheKarte(x),
    leer: 'Keine Fläche zugeteilt. Nicht zugeteilte Flächen gehören ohnehin zu jedem Abschnitt.'
  },
  relais: {
    eintraege: (p, aid) => alphabetisch(relaisstellenIm(p, aid), relaisTitel),
    wert: e => `${e.length} ${e.length === 1 ? 'Relaisstelle' : 'Relaisstellen'}`,
    neu: () => zeichneRelaisListe(),
    karte: x => relaisKarte(x),
    leer: 'Keine Relaisstelle zugeteilt. Nicht zugeteilte gehören ohnehin zu jedem Abschnitt.'
  }
};

/**
 * Ein Einsatzabschnitt als Klammer über seine Einträge – dieselbe Zeile über
 * den Strecken wie über den taktischen Zeichen. `art` bestimmt, was darin
 * steht und was der Kopf zählt.
 */
function abschnittGruppe(ea, art) {
  const l = LISTENARTEN[art] || LISTENARTEN.strecken;
  const aid = ea ? ea.id : null;
  const eintraege = l.eintraege(store.projekt, aid);

  const box = klammerBox({
    hat: ea, art, ohneName: 'Ohne Einsatzabschnitt',
    wert: l.wert(eintraege),
    oeffnenTitel: 'Einsatzabschnitt öffnen',
    oeffnen: () => einsatzabschnittDialog(aid),
    grund: 'strecke',
    neu: l.neu,
    eintraege,
    leer: l.leer,
    karte: l.karte,
    neuKnopf: ea ? () => neuKnopf(ea, art) : null
  });
  if (ea) box.dataset.aid = ea.id;
  return box;
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
  const bauzeile = baustandKurz(s);
  if (bauzeile) {
    karte.appendChild(el('div', 'eintrag-zeile bau-zeile',
      `<span class="bz-marke">gebaut</span><span>${escapeHtml(bauzeile)}</span>`));
  }

  if (!gewaehlt) {
    karte.appendChild(el('div', 'eintrag-zeile',
      `<span>${escapeHtml(k.kabel.kurz)}${k.strom && k.strom.querschnitt
          ? ' ' + escapeHtml(querschnittText(k.strom.querschnitt)) : ''}</span>
       <span>${k.punkte} ${k.punkte === 1 ? 'Punkt' : 'Punkte'}</span>
       <span>${k.kabel.funk ? 'Funkstrecke' : `Bedarf ${formatLaenge(k.bedarf)}`}</span>`));
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
      typ: 'select',
      werte: [['', '— keinem zugeteilt —'],
        ...alphabetisch(store.projekt.einsatzabschnitte, nachName).map(a => [a.id, a.name])]
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
  g2.appendChild(feld('Leitungsart', s.kabeltyp, v => {
    store.aendern(() => {
      const alt = kabelById(s.kabeltyp), neu = kabelById(v);
      s.kabeltyp = v;
      // Vorgabewerte mitziehen, solange sie nicht von Hand geändert wurden
      if (s.trommellaenge === alt.trommel) s.trommellaenge = neu.trommel;
      if (s.zuschlag === alt.zuschlag) s.zuschlag = neu.zuschlag;
      if (s.verlegeleistung === alt.leistung) s.verlegeleistung = neu.leistung;
    }, 'strecke');
  }, { typ: 'select', werte: KABELTYPEN.map(k => [k.id, k.name]) }));
  /* Eine Funkstrecke wird nicht verlegt – Verlegeart und Bauansatz hätten
     dort nichts zu sagen und blieben doch als Zahlen im Weg. */
  if (!k.kabel.funk) {
    g2.appendChild(feld('Verlegeart', s.verlegeart, v => {
      schreib(() => { s.verlegeart = v; });
      frisch();          // Hoch- oder Tiefbau entscheidet über die Sprechreichweite
      ctx.aufAenderung();
    }, { typ: 'select', werte: VERLEGEARTEN.map(v => [v.id, v.name]) }));

    const zahlen = el('div', 'feld-dreier');
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
    }, { typ: 'number', min: 0, step: 1 });
    const trommelHinweis = el('p', 'klein');
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
    { platzhalter: 'z. B. FmBauTr 1' }));
  g2.appendChild(feld('Bemerkung zum Auftrag', s.bemerkung, v => schreib(() => { s.bemerkung = v; }),
    { typ: 'textarea', zeilen: 2 }));
  koerper.appendChild(g2);

  reichweiteFrisch(k);
  koerper.appendChild(rw);

  // -- Stromversorgung (nur bei Stromleitungen)
  if (s.kabeltyp === 'strom') {
    const g3 = stromGruppe(s);
    stromFrisch = g3.aktualisieren;
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
  koerper.appendChild(punktTabelle(s, frisch));

  /* -- Was die Trasse kreuzt. Nur bei einer verlegten Leitung: eine Funkstrecke
     kreuzt nichts, sie fliegt darüber – für sie steht die Freileitung als
     Hindernis in der Richtfunkprüfung. */
  if (!k.kabel.funk && s.punkte.length >= 2) koerper.appendChild(querungsGruppe(s));

  /* -- Aktionen, gestaffelt statt gleich laut:
     bearbeiten (gleichrangig) · Rohdaten (leise) · Löschen (leise, selten)
     und zuunterst die Ausgabezeile mit dem Bauauftrag – dem Ergebnis der
     ganzen Eingabe darüber. Sie hängt am unteren Rand der Karte fest. */
  const tasten = el('div', 'tastenreihe');
  tasten.append(
    knopf('Weiterzeichnen', () => ctx.weiterzeichnen(s.id)),
    knopf('Auf Karte zeigen', () => { ctx.sl.zeigeStrecke(s.id); ctx.zurKarte?.(); }),
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
    }),
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
    })
  );
  koerper.appendChild(tasten);

  const daten = el('div', 'feldgruppe rohdaten');
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
               <p class="klein">Rückgängig machen ist mit <kbd>Strg</kbd>+<kbd>Z</kbd> möglich.</p>`,
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
  gruppe.appendChild(el('h3', 'gruppen-titel', 'Richtfunkstrecke (WLAN)'));

  const v = s.richtfunk;
  const ergebnis = el('div', 'rf-ergebnis');
  const spalten = el('div', 'rf-spalten');
  const bandbreiteFeld = () => feld('Bandbreite', v.bandbreite,
    w => schreib(() => { v.bandbreite = Number(w); }, aktualisieren),
    { typ: 'select', werte: bandById(v.band).bandbreiten.map(b => [b, `${b} MHz`]) });

  const aktualisieren = () => {
    ergebnis.innerHTML = richtfunkErgebnisHTML(s);
    ablesungBinden(ergebnis, s);
    erneutBinden(ergebnis, s, aktualisieren);
    spalten.querySelectorAll('.rf-abgeleitet').forEach((el2, i) => {
      el2.innerHTML = standortAbgeleitetHTML(s, i);
    });
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
      'Strg+Z macht es rückgängig');
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

function punktTabelle(s, frisch) {
  const wrap = el('div', 'feldgruppe punkte');
  const kopf = el('div', 'gruppen-kopf');
  kopf.appendChild(el('h3', 'gruppen-titel', `Trassenpunkte (${s.punkte.length})`));
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

  const seg = segmentLaengen(s);
  const kum = kumuliert(s.punkte);
  const liste = el('div', 'punktliste');

  s.punkte.forEach((pt, i) => {
    const zeile = el('div', 'punktzeile' + (ctx.sl.aktiverPunkt === pt.id ? ' aktiv' : ''));

    const kopf = el('div', 'pz-kopf');
    kopf.appendChild(el('span', 'pz-nr', String(i + 1)));

    const sel = el('select', 'mini-select pz-art');
    PUNKTARTEN.forEach(a => {
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
    weg.onclick = () => {
      store.aendern(() => {
        s.punkte = s.punkte.filter(x => x.id !== pt.id);
        sollPunktGeloescht(s, pt.id);
        s.punkte.forEach((q, j) => {
          if (q._manuell) return;
          if (j === 0) q.art = 'start';
          else if (j === s.punkte.length - 1) q.art = 'ziel';
        });
      }, 'strecke');
      hinweis(`Punkt ${i + 1} gelöscht – Strg+Z macht es rückgängig`);
    };
    fuss.appendChild(weg);
    zeile.appendChild(fuss);

    liste.appendChild(zeile);
  });

  wrap.appendChild(liste);
  return wrap;
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

/** Neuen Einsatzabschnitt bilden und gleich zur Bearbeitung öffnen */
export function abschnittAnlegen() {
  let aid;
  store.aendern(p => {
    const ea = neuerEinsatzabschnitt(p);
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
    const strecken = streckenIm(store.projekt, aid);
    const zeichen = zeichenIm(store.projekt, aid);
    const flaechen = flaechenIm(store.projekt, aid);
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
    `Der Sammelauftrag fasst alle Strecken dieses Abschnitts in einem Dokument
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
  const klammern = alphabetisch(
    nachGruppe ? (p.zeichengruppen || []) : (p.einsatzabschnitte || []), nachName);
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
    for (const [wert, text] of [['', '— ohne —'], ...klammern.map(k => [k.id, k.name])]) {
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

/* Auflösen, nicht löschen: die Strecken bleiben, sie sind danach nur keinem
   Abschnitt mehr zugeteilt. Deshalb reicht eine Rückfrage ohne Namenseingabe –
   rückgängig machen lässt es sich ohnehin. */
function abschnittAufloesen(ea) {
  const strecken = streckenIm(store.projekt, ea.id).length;
  const zeichen = zeichenIm(store.projekt, ea.id).length;
  const flaechen = flaechenIm(store.projekt, ea.id).length;
  const anzahl = strecken + zeichen + flaechen;
  const teile = [];
  if (strecken) teile.push(`${strecken} ${strecken === 1 ? 'Strecke' : 'Strecken'}`);
  if (zeichen) teile.push(`${zeichen} Zeichen`);
  if (flaechen) teile.push(`${flaechen} ${flaechen === 1 ? 'Fläche' : 'Flächen'}`);
  dialog({
    titel: 'Einsatzabschnitt auflösen',
    inhalt: `<p>Soll <b>${escapeHtml(ea.name)}</b> aufgelöst werden?</p>
      <p class="klein">${anzahl
        ? `${teile.join(', ')} ${anzahl === 1 ? 'bleibt' : 'bleiben'} erhalten und
           ${anzahl === 1 ? 'gilt' : 'gelten'} danach als nicht zugeteilt.`
        : 'Diesem Abschnitt ist nichts zugeteilt.'}
        Rückgängig machen ist mit <kbd>Strg</kbd>+<kbd>Z</kbd> möglich.</p>`,
    fuss: [
      { text: 'Abbrechen', tun: () => { einsatzabschnittDialog(ea.id); return false; } },
      { text: 'Auflösen', gefahr: true, tun: () => {
          store.aendern(p => {
            p.strecken.forEach(s => { if (s.abschnitt === ea.id) s.abschnitt = null; });
            p.zeichen.forEach(z => { if (z.abschnitt === ea.id) z.abschnitt = null; });
            (p.flaechen || []).forEach(f => { if (f.abschnitt === ea.id) f.abschnitt = null; });
            p.einsatzabschnitte = p.einsatzabschnitte.filter(a => a.id !== ea.id);
          }, 'strecke');
          hinweis('Einsatzabschnitt aufgelöst');
        } }
    ]
  });
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
        Rückgängig machen ist mit <kbd>Strg</kbd>+<kbd>Z</kbd> möglich.</p>`,
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
  const abschnitte = alphabetisch(p.einsatzabschnitte || [], nachName);
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
      werte: [['', '— keinem zugeteilt (gilt für alle) —'],
        ...alphabetisch(store.projekt.einsatzabschnitte, nachName).map(a => [a.id, a.name])]
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
  const abschnitte = alphabetisch(p.einsatzabschnitte || [], nachName);

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
      werte: [['', '— keinem zugeteilt (gilt für alle) —'],
        ...alphabetisch(store.projekt.einsatzabschnitte, nachName).map(a => [a.id, a.name])]
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
  const abschnitte = alphabetisch(p.einsatzabschnitte || [], nachName);

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
      werte: [['', '— keinem zugeteilt (gilt für alle) —'],
        ...alphabetisch(store.projekt.einsatzabschnitte, nachName).map(a => [a.id, a.name])]
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

function zeitpunkt(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
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
  summe.innerHTML =
    `<span>Stand <b>${escapeHtml(k.stand.name)}</b></span>
     <span><b>${k.bestaetigt}</b> von ${k.sollPunkte} Punkten</span>` +
    (k.laenge ? `<span>gebaut <b>${escapeHtml(formatLaenge(k.laenge))}</b></span>` : '') +
    (k.abweichungen.length
      ? `<span class="bau-abw"><b>${k.abweichungen.length}</b> ${k.abweichungen.length === 1 ? 'Abweichung' : 'Abweichungen'}</span>`
      : '');

  const bloecke = {
    punkte: bauPunktBlock(s),
    meldungen: bauMeldungBlock(s),
    material: klappbar(bauMaterialBlock(s, k), 'material'),
    uebergabe: klappbar(bauUebergabeBlock(s, k), 'uebergabe'),
    rueckweg: bauRueckwegBlock(s),
    vorrat: klappbar(kartenvorratBlock(s), 'vorrat')
  };
  liste.appendChild(baukopfBlock(s, k));
  liste.appendChild(sprungstreifen(bloecke, s));
  liste.appendChild(bauabschnittBlock(s));
  liste.appendChild(bloecke.punkte);
  /* Die Baumeldungen stehen VOR dem Materialnachweis, obwohl der Ablauf
     andersherum liest. Der Grund ist der Daumen: gemeldet wird laufend, nach
     jeder Kabellänge, der Bogen wird einmal am Ende gefüllt. Hinter dem
     Materialnachweis läge der Griff „Meldung jetzt“ rund tausend Bildpunkte
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
function sprungstreifen(bloecke, s) {
  const streifen = el('nav', 'bau-sprung');
  streifen.setAttribute('aria-label', 'Im Bau-Reiter springen');
  const ziele = [
    ['punkte', 'Punkte'], ['meldungen', 'Meldungen'], ['material', 'Material'],
    ['uebergabe', 'Übergabe'], ['rueckweg', 'Absetzen'], ['vorrat', 'Karte']
  ];
  for (const [schluessel, text] of ziele) {
    streifen.appendChild(knopf(text, () => {
      /* Ein Sprung auf einen zugeklappten Block zeigte nur dessen Überschrift –
         der Chip klappt ihn deshalb mit auf. */
      const ziel = bloecke[schluessel];
      bauZu.delete(schluessel);
      ziel.classList.remove('zu');
      const griff = ziel.querySelector('.fg-griff');
      if (griff) griff.setAttribute('aria-expanded', 'true');
      ziel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'klein'));
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
    return strecken.flatMap(st => [...(st.punkte || []), ...istPunkte(st)]);
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
  box.appendChild(merkeFeld(feld('Stand des Baus', k.stand.id, wert => {
    store.aendern(() => { bauSichern(s).stand = wert; }, 'bau');
  }, { typ: 'select', werte: BAUSTAENDE.map(b => [b.id, b.name]), klasse: 'bau-stand' }),
    'stand'));

  const zahlen = el('div', 'bau-zahlen');
  const zeile = (titel, wert, klasse = '') =>
    `<div class="bz ${klasse}"><span class="bz-titel">${escapeHtml(titel)}</span>
     <span class="bz-wert">${wert}</span></div>`;
  zahlen.innerHTML =
    zeile('geplant', escapeHtml(formatLaenge(k.sollLaenge))) +
    zeile('gebaut', k.laenge ? escapeHtml(formatLaenge(k.laenge)) : '–') +
    zeile('Unterschied', k.laengenUnterschied
      ? `${k.laengenUnterschied > 0 ? '+' : '−'}${escapeHtml(formatLaenge(Math.abs(k.laengenUnterschied)))}`
      : '–', Math.abs(k.laengenUnterschied) > 0 ? 'bz-merken' : '');
  box.appendChild(zahlen);

  if (k.laenge) {
    box.appendChild(el('p', 'klein',
      'Die gebaute Länge ist die Trasse zwischen den aufgenommenen Punkten – ' +
      'ohne Bauzuschlag und ohne Reserve. Was an Kabel verbraucht wurde, sagt ' +
      'die Materialliste des Trupps und keine Rechnung.'));
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
      'Trupps aufeinander zu, bekommt jeder seinen Abschnitt – dann steht an ' +
      'jedem aufgenommenen Punkt, wer ihn gebaut hat.'));
  }

  for (const a of abschnitte) {
    const zeile = el('div', 'ba-eintrag');
    zeile.style.setProperty('--farbe', a.farbe);
    const kopf = el('div', 'ba-kopf');
    /* Der Zustand steht als Wort daneben und nicht nur in der Farbe: am Bauort
       gibt es keinen `title`, und ein Knopf, der wie eine Überschrift aussieht,
       wird nicht gedrückt – dann trägt kein einziger Punkt seinen Trupp. */
    const aktivHier = a.id === bauabschnittAktivId();
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
    felder.appendChild(feld('Baubeginn', a.beginn, w => schreib(() => { a.beginn = w; }),
      { typ: 'datetime-local' }));
    felder.appendChild(feld('Bauende', a.ende, w => schreib(() => { a.ende = w; }),
      { typ: 'datetime-local' }));
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
    befund.innerHTML =
      `<span class="bp-haken">✓ gebaut</span>
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
        : '');
    zeile.appendChild(befund);

    /* Alles, was über den Befund hinausgeht, steht im Formular – und das
       erscheint erst auf Tipp auf die Kopfzeile. */
    const mehr = el('div', 'bp-mehr');
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
    hinweis(`Punkt ${i + 1} bestätigt`);
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
function bauZusatzZeile(s, pt) {
  const zeile = el('div', 'bp-zeile bestaetigt bp-zusatz');
  zeile.style.setProperty('--farbe', s.farbe);
  const kopf = el('div', 'bp-kopf');
  kopf.innerHTML =
    `<span class="bp-nr">+</span>
     <span class="bp-quelle">${escapeHtml(quelleText(pt))}</span>` +
    (uhrzeit(pt.zeit) ? `<span class="bp-zeit">${escapeHtml(uhrzeit(pt.zeit))}</span>` : '');
  const zeigen = el('button', 'mini-knopf bp-karte', '◎');
  zeigen.title = 'Auf der Karte zeigen';
  zeigen.onclick = () => { ctx.karte.setView([pt.lat, pt.lng], Math.max(ctx.karte.getZoom(), 16)); ctx.zurKarte?.(); };
  kopf.appendChild(zeigen);
  zeile.appendChild(kopf);

  const felder = el('div', 'bp-felder');
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

  if (k.abweichungen.length) {
    const auf = el('ul', 'bau-abwliste');
    for (const a of k.abweichungen.slice(0, 8)) {
      const nr = s.punkte.indexOf(a.soll) + 1;
      auf.appendChild(el('li', '',
        `Punkt ${nr}: <b>${escapeHtml(formatLaenge(a.meter))}</b> vom geplanten Ort`));
    }
    box.appendChild(auf);
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
  }, { typ: 'number', min: 0, step: 1, einheit: eintrag.einheit }));

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
    { typ: 'number', min: 0 }));
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
      'mitschreibt, hat am Ende die Bauzeiten.'));
  }

  const aktiv = aktiverBauabschnitt(s);
  for (const m of meldungen) {
    const zeile = el('div', 'bm-zeile');
    const a = bauabschnittById(s, m.abschnitt);
    if (a) zeile.style.setProperty('--farbe', a.farbe);
    zeile.appendChild(el('span', 'bm-zeit', escapeHtml(uhrzeit(m.zeit) || '—')));
    zeile.appendChild(feld('', m.text, w => schreib(() => { m.text = w; }),
      { platzhalter: 'Was gemeldet wurde' }));
    const weg = el('button', 'mini-knopf gefahr', '✕');
    weg.title = 'Meldung löschen';
    weg.onclick = () => {
      store.aendern(() => baumeldungLoeschen(s, m.id), 'bau');
      hinweis('Meldung gelöscht – „Rückgängig“ in der Kopfzeile holt sie zurück');
    };
    zeile.appendChild(weg);
    if (a) zeile.appendChild(el('span', 'bm-abschnitt', escapeHtml(a.name)));
    box.appendChild(zeile);
  }

  const tasten = el('div', 'tastenreihe bau-tasten');
  tasten.appendChild(knopf('Meldung jetzt', () => {
    store.aendern(() => baumeldungAnlegen(s, '', aktiv ? aktiv.id : null), 'bau');
    hinweis('Baumeldung mit der aktuellen Uhrzeit angelegt – Text nachtragen.');
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
  felder.appendChild(merkeFeld(feld('Übergeben an', u.an,
    w => store.aendern(() => { pruefungSichern(s).uebergabeAn = w; }, 'bau'),
    { platzhalter: 'Einheit, für die gebaut wurde' }), 'uebergabe-an'));
  felder.appendChild(merkeFeld(feld('Zeitpunkt', u.zeit,
    w => store.aendern(() => { pruefungSichern(s).uebergabeZeit = w; }, 'bau'),
    { typ: 'datetime-local' }), 'uebergabe-zeit'));
  felder.appendChild(feld('Übergeben durch', u.durch,
    w => schreib(() => { pruefungSichern(s).uebergabeName = w; }),
    { platzhalter: 'Truppführer' }));
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
  } else if (u.fertig && k.stand.id !== 'uebergeben') {
    box.appendChild(el('p', 'klein',
      'Geprüft und übergeben – der Stand des Baus oben lässt sich jetzt auf ' +
      '„übergeben“ setzen.'));
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

  box.appendChild(el('p', 'klein',
    `Zurück geht nur, was am Bauort entstanden ist – die Baudokumentation von ` +
    `<b>${alle.length} ${alle.length === 1 ? 'Strecke' : 'Strecken'}</b> ` +
    `(${escapeHtml(alle.map(x => x.name).join(', '))}). Die Planung selbst reist nicht ` +
    `mit: der Planer hat sie schon, und ohne sie bleibt die Meldung klein genug für ` +
    `einen Link.`));

  /* Was der Planer wissen muss, sind nicht die Stückzahlen, sondern die
     Abweichungen: der Unterschied zwischen Plan und Bauort ist der Grund, aus
     dem überhaupt zurückgemeldet wird. Vor dem Absetzen steht deshalb hier,
     was er lesen wird – und wenn nichts abweicht, steht auch das da. */
  const abweichend = alle
    .map(x => ({ name: x.name, punkte: baukennzahlen(x).abweichungen }))
    .filter(x => x.punkte.length);
  const vorschau = el('ul', 'bau-vorschau');
  if (!abweichend.length) {
    vorschau.appendChild(el('li', 'bau-vorschau-gleich',
      'Kein Punkt weicht mehr als ' + escapeHtml(formatLaenge(ABWEICHUNG_SCHWELLE)) +
      ' vom Plan ab.'));
  } else {
    for (const x of abweichend) {
      const weiteste = x.punkte[0];
      vorschau.appendChild(el('li',
        '', `<b>${escapeHtml(x.name)}</b>: ${x.punkte.length} ` +
        `${x.punkte.length === 1 ? 'Punkt weicht' : 'Punkte weichen'} ab, ` +
        `am weitesten ${escapeHtml(formatLaenge(weiteste.meter))}.`));
    }
  }
  box.appendChild(vorschau);

  const tasten = el('div', 'tastenreihe bau-tasten');
  tasten.appendChild(knopf('Als Link', () => meldungAlsLinkZeigen(alle), 'klein primaer bau-taste'));
  tasten.appendChild(knopf('Als Datei', () => {
    if (io.baumeldungExportieren(alle)) hinweis('Baumeldung als Datei gesichert');
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
function meldungAlsLinkZeigen(strecken) {
  const box = el('div', 'meldung-link');
  const feldLink = document.createElement('textarea');
  feldLink.readOnly = true;
  feldLink.rows = 3;
  feldLink.value = 'wird erzeugt …';
  box.appendChild(feldLink);
  const ampel = el('p', 'teilen-ampel', '');
  box.appendChild(ampel);
  box.appendChild(el('p', 'klein',
    'Der Planer öffnet den Link und bekommt eine Vorschau, bevor etwas eingespielt wird.'));

  dialog({
    titel: 'Baumeldung als Link',
    inhalt: box,
    breit: true,
    fuss: [
      { text: 'Kopieren', tun: () => {
        const wert = feldLink.value;
        if (!wert || wert.startsWith('wird erzeugt')) return false;
        feldLink.select();
        const lauf = navigator.clipboard?.writeText(wert);
        if (!lauf) {
          hinweis('Kopieren nicht möglich – der Link ist markiert, Strg+C genügt.', 'fehler');
          return false;
        }
        lauf.then(() => hinweis('Baumeldung kopiert'))
          .catch(() => hinweis('Kopieren nicht möglich – der Link ist markiert, Strg+C genügt.', 'fehler'));
        return false;
      } },
      { text: 'Schließen', primaer: true }
    ]
  });

  meldungAlsLink(store.projekt, strecken).then(link => {
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
    (meldung.planung && meldung.planung !== p.name
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

      if (!b.ziel) {
        zeile.appendChild(el('p', 'klein',
          'Keine Strecke dieses Namens – oder mehrere. Von Hand zuordnen oder auslassen.'));
      } else {
        if (b.ersetzt) {
          /* Die Einzahl vollständig gebildet und nicht nur am Hauptwort:
             „Dabei weichen 1 hier schon aufgenommene Punkt“ stand in dem
             einen Satz, der sagt, dass eine vorhandene Aufnahme verloren
             geht – und ein Satz, der beim ersten Lesen stolpert, wird unter
             Zeitdruck überlesen. */
          zeile.appendChild(el('p', 'mv-ersetzt', b.ersetzt === 1
            ? 'Dabei weicht 1 hier schon aufgenommener Punkt.'
            : `Dabei weichen ${b.ersetzt} hier schon aufgenommene Punkte.`));
        }
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
            b.verdraengt.material && `${b.verdraengt.material} Materialzeilen`,
            b.verdraengt.pruefzeilen && `${b.verdraengt.pruefzeilen} Prüfzeilen`,
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

  dialog({
    titel: 'Baumeldung eingegangen',
    inhalt: box,
    breit: true,
    /* Getrennt und geschützt: die beiden Knöpfe tun das Gegenteil voneinander,
       und was hier hereinkommt, gibt es nur einmal. */
    geteilt: true,
    schutz: 'Bitte entscheiden: verwerfen oder einspielen.',
    fuss: [
      { text: 'Verwerfen', tun: () => {
        if (entschieden) entschieden();
        hinweis('Baumeldung verworfen – sie ist damit weg.', 'warnung');
      } },
      { text: 'Einspielen', primaer: true, tun: () => {
        if (entschieden) entschieden();
        let bericht;
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
    v => schreib(() => { p.kopf.stand = v; }), { platzhalter: 'z. B. 301430aug26' });
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

export function projektDialog() {
  const liste = projektListe();
  const box = el('div', 'projektliste');
  if (!liste.length) box.appendChild(el('p', 'klein', 'Noch keine gespeicherten Planungen.'));

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
        auch nicht mit <kbd>Strg</kbd>+<kbd>Z</kbd>. Liegt keine Datei vor,
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

// ---------------------------------------------------------------- Koordinatensuche

/* `punktAnfuegen` kommt aus app.js, solange eine Strecke gezeichnet wird: die
   Koordinate wird dann Trassenpunkt statt Sprungziel. Das ist der einzige Weg,
   eine Strecke ganz ohne Zeigegerät zu erfassen – und der genaueste für eine
   über Funk durchgegebene MGRS-Angabe. Der Dialog bleibt dabei offen, weil am
   Funk selten nur eine Koordinate kommt. */
export function koordinatenSuche(punktAnfuegen = null) {
  const box = el('div');
  box.innerHTML = `
    <label class="feld"><span class="feld-titel">Koordinate</span>
      <input type="text" id="ks-eingabe" placeholder="32U LB 56560 45282  ·  50.9413, 6.9583  ·  N 50 56.478 O 006 57.498">
    </label>
    <p class="klein" id="ks-status">MGRS, Dezimalgrad, Grad/Dezimalminuten und Grad/Min./Sek. werden erkannt.</p>
    <label class="feld ks-haken"><input type="checkbox" id="ks-marke"><span class="feld-titel">Zusätzlich ein taktisches Zeichen dort setzen</span></label>`;

  const lesen = () => {
    const k = parseKoordinate(box.querySelector('#ks-eingabe').value);
    if (!k) box.querySelector('#ks-status').innerHTML = '<b class="fehlertext">Koordinate nicht erkannt.</b>';
    return k;
  };
  let angefuegt = 0;

  const fuss = [
    { text: punktAnfuegen ? 'Schließen' : 'Abbrechen' },
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
    titel: punktAnfuegen ? 'Koordinate als Trassenpunkt' : 'Koordinate anspringen',
    inhalt: box, fuss
  });
}

// ---------------------------------------------------------------- Hilfe

export function hilfeDialog() {
  const inhalt = dialog({
    titel: 'Kurzanleitung', breit: true,
    inhalt: `
      <div class="hilfe">
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
          <li><b>Nicht zugeteilte Zeichen gehören allen:</b> sie erscheinen in jedem
              Abschnitt, auf dessen Karten und in dessen Datei. Ein zugeteiltes Zeichen
              nur in seinem eigenen. So bleibt das gemeinsame Lagebild – Führungsstelle,
              Bereitstellungsraum – überall stehen.</li>
          <li>Das <b>Auge</b> an der Abschnittszeile blendet alle seine Strecken und
              Zeichen zusammen aus der Karte aus – der eigene Schalter jedes Elements
              bleibt dabei erhalten.</li>
          <li><b>Als Datei sichern (.json)</b> gibt nur diesen Abschnitt heraus. Wer sie
              erhält, lädt sie über <b>Datei → Planung oder KML laden</b> und arbeitet an
              seinem Ausschnitt weiter, ohne die übrige Planung zu sehen.</li>
          <li><b>Abschnitt auflösen</b> entfernt nur die Gliederung; Strecken und Zeichen
              bleiben und gelten danach als nicht zugeteilt.</li>
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
        <p>In der Kopfzeile auf <b>Baumodus</b> schalten: die Anwendung zeigt dann, was am
           Bauort gebraucht wird, und hält fest, was gebaut wurde – die Planung bleibt
           unangetastet. Am Bauort geht es über die Karte:</p>
        <ul>
          <li>Unten <b>Punkt hier</b>: der Standort des Geräts wird als gebauter Punkt
              aufgenommen. <b>Auf Karte</b>: der nächste Tipp auf die Karte ist der Punkt.</li>
          <li>Eine <b>geplante Marke antippen</b>: <b>Wie geplant</b> bestätigt sie,
              <b>Hier</b> nimmt den Standort, <b>Auf Karte</b> die angetippte Stelle.
              Geplante Punkte lassen sich im Baumodus nicht verschieben.</li>
          <li>Nach jeder Aufnahme fragt die <b>Punktkarte</b> „Was ist hier?“ – ein Tipp auf
              Trassenpunkt, Muffe, Reserve, Mast, Querung, Verteiler oder Sonstiges genügt;
              an der Querung noch einer auf Überbau, Unterbau oder an Brücke. Dazu die
              Bemerkung. Ein Tipp auf eine gebaute Marke öffnet sie wieder.</li>
          <li>Im Reiter <b>Bau</b> steht dasselbe als Liste, dazu Bauabschnitte,
              Baumeldungen, Materialnachweis, Meldung an den S 6, Übergabe und ganz unten
              die Karte zum Mitnehmen. Der Sprungstreifen unter der Summe führt hin.</li>
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
           lässt sich mit <kbd>Strg</kbd>+<kbd>Z</kbd> wieder zurücknehmen.</p>
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
  const einstieg = el('div', 'hs-einstieg');
  for (const [text, titel] of [['▸ Planung', 'Strecke planen'], ['▸ Baumodus', 'Baumodus']]) {
    const ziel = kopfe.find(h => h.textContent.trim() === titel);
    if (ziel) einstieg.appendChild(knopf(text, springe(ziel), 'klein hs-modus'));
  }
  if (einstieg.children.length) streifen.appendChild(einstieg);

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
    streifen.appendChild(knopf(KURZ[titel] || titel, springe(h), 'klein'));
  }
  inhalt.querySelector('.hilfe').prepend(streifen);
}

// ---------------------------------------------------------------- Hilfsknopf

function knopf(text, tun, klasse = '') {
  const b = el('button', 'knopf ' + klasse, escapeHtml(text));
  b.onclick = tun;
  return b;
}
