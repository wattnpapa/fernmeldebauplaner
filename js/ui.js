// ui.js – Seitenleiste, Formulare, Dialoge

import {
  store, KABELTYPEN, VERLEGEARTEN, PUNKTARTEN, FARBEN,
  neuesZeichen, punktartById, kabelById, neueStrecke, neuerEinsatzabschnitt, abschnittById,
  neueZeichengruppe, zeichengruppeById, zeichenInGruppe,
  streckenIm, zeichenIm, zeichenSichtbar, streckeSichtbar, bilderBelegung, bildmarkenAn,
  flaechenIm, flaecheSichtbar,
  projektListe, speicherBelegung, SPEICHER_KONTINGENT, dateisicherung, id
} from './state.js';
import { kennzahlen, gesamtKennzahlen, segmentLaengen, kumuliert, escapeHtml } from './strecken.js';
import { formatLaenge, meter, toMGRS, toDDM, alleFormate, parseKoordinate, himmelsrichtung } from './geo.js';
import {
  NETZFORMEN, LASTEINHEITEN, netzById, MAX_QUERSCHNITT,
  querschnittText, stromText, leistungText, prozentText, grenzText, massgebendText
} from './strom.js';
import {
  QUERUNGSARTEN, QUERUNG_BAUWEISEN, VS_GRADE, querungsartById, bauweiseById, massText, dtg,
  KABELRESERVE_STANDARD
} from './vorschrift.js';
import { SYMBOLE, KATEGORIEN, symbolSVG, symbolById } from './symbols.js';
import {
  FLAECHENARTEN, AUFSTELLUNGEN, flaechenartById, flaechenVorschau, flaechenTitel, masseText
} from './flaechen.js';
import {
  FREQUENZBAENDER, MIMO_ARTEN, POLARISATIONEN, MODULATIONEN,
  bandById, mimoById, gueltigeBandbreite, datenrateText, funkstrecke, azimutText
} from './richtfunk.js';
import { hoeheAn, profil } from './hoehe.js';
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
import { oeffneBauauftrag, oeffneSammeldruck, oeffneLagekarte } from './bauauftrag.js';
import { funksicht, sichtText, UMKREIS_STANDARD } from './funksicht.js';
import { zeichneFunksicht } from './map.js';
import { VERSION } from './version.js';

let ctx = null;   // { karte, sl, zl, aufAenderung }

export function initUI(kontext) { ctx = kontext; }

// ---------------------------------------------------------------- Hinweise

let hinweisTimer = null;
export function hinweis(text, art = 'info') {
  const box = document.getElementById('hinweisbox');
  box.textContent = text;
  box.className = 'hinweisbox ' + art;
  box.hidden = false;
  clearTimeout(hinweisTimer);
  hinweisTimer = setTimeout(() => { box.hidden = true; }, art === 'fehler' ? 6000 : 3200);
}

// ---------------------------------------------------------------- Dialog

/* Wer den Dialog geöffnet hat, bekommt den Fokus beim Schließen zurück. Bei
   Dialogketten (ein Dialog öffnet den nächsten) bleibt der ursprüngliche
   Auslöser gemerkt – der Zwischenknopf existiert nach dem Umbau nicht mehr. */
let dialogOeffner = null;

export function dialog({ titel, inhalt, fuss = [], breit = false }) {
  const huelle = document.getElementById('dialog');
  const aktiv = document.activeElement;
  if (aktiv instanceof HTMLElement && !huelle.contains(aktiv)) dialogOeffner = aktiv;
  huelle.querySelector('.dialog').classList.toggle('breit', breit);
  document.getElementById('dialog-titel').textContent = titel;
  const feld = document.getElementById('dialog-inhalt');
  feld.innerHTML = '';
  if (typeof inhalt === 'string') feld.innerHTML = inhalt; else feld.appendChild(inhalt);
  const fussEl = document.getElementById('dialog-fuss');
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
  if (ersterFokus) setTimeout(() => ersterFokus.focus(), 30);
  return feld;
}

export function schliesseDialog() {
  const huelle = document.getElementById('dialog');
  if (huelle.hidden) return;
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
    if (o.min !== undefined) ein.min = o.min;
    if (o.max !== undefined) ein.max = o.max;
    if (o.step !== undefined) ein.step = o.step;
    if (o.platzhalter) ein.placeholder = o.platzhalter;
  }
  if (o.typ !== 'select') ein.value = wert ?? '';
  if (o.einheit) wrap.classList.add('mit-einheit');
  ein.addEventListener(o.typ === 'select' ? 'change' : 'input', () => {
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
  summe.innerHTML = p.strecken.length
    ? `<span><b>${p.strecken.length}</b> ${p.strecken.length === 1 ? 'Strecke' : 'Strecken'}</span>
       ${abschnitte.length ? `<span><b>${abschnitte.length}</b> ${abschnitte.length === 1 ? 'Abschnitt' : 'Abschnitte'}</span>` : ''}
       <span>Trasse <b>${formatLaenge(ges.trasse)}</b></span>
       <span>Bedarf <b>${formatLaenge(ges.bedarf)}</b></span>
       <span><b>${ges.trommeln}</b> ${ges.trommeln === 1 ? 'Trommel' : 'Trommeln'}</span>
       ${kabelSummeHTML(ges)}`
    : '';

  const sammelKnopf = document.getElementById('btn-sammel-pdf');
  if (sammelKnopf) {
    const druckbar = p.strecken.filter(s => s.punkte.length >= 2).length;
    sammelKnopf.disabled = !druckbar;
    sammelKnopf.title = druckbar
      ? `Ein Dokument mit allen ${druckbar} druckbaren Strecken der Planung`
      : 'Noch keine Strecke mit zwei Trassenpunkten';
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

/**
 * Ein Einsatzabschnitt als Klammer über seine Einträge – dieselbe Zeile über
 * den Strecken wie über den taktischen Zeichen. `art` bestimmt, was darin
 * steht und was der Kopf zählt.
 */
function abschnittGruppe(ea, art) {
  const p = store.projekt;
  const zeichenliste = art === 'zeichen';
  const flaechenliste = art === 'flaechen';
  const aid = ea ? ea.id : null;
  const eintraege = zeichenliste ? alphabetisch(zeichenIm(p, aid), zeichenTitel)
    : flaechenliste ? alphabetisch(flaechenIm(p, aid), flaechenTitel)
    : alphabetisch(streckenIm(p, aid), nachName);

  const box = klammerBox({
    hat: ea, art, ohneName: 'Ohne Einsatzabschnitt',
    wert: zeichenliste ? `${eintraege.length} Zeichen`
      : flaechenliste ? `${eintraege.length} ${eintraege.length === 1 ? 'Fläche' : 'Flächen'}`
      : `${eintraege.length} · ${formatLaenge(gesamtKennzahlen(eintraege).trasse)}`,
    oeffnenTitel: 'Einsatzabschnitt öffnen',
    oeffnen: () => einsatzabschnittDialog(aid),
    grund: 'strecke',
    neu: () => zeichenliste ? zeichneZeichenListe() : flaechenliste ? zeichneFlaechenListe() : zeichneStreckenListe(),
    eintraege,
    leer: zeichenliste
      ? 'Kein Zeichen zugeteilt. Nicht zugeteilte Zeichen gehören ohnehin zu jedem Abschnitt.'
      : flaechenliste
      ? 'Keine Fläche zugeteilt. Nicht zugeteilte Flächen gehören ohnehin zu jedem Abschnitt.'
      : 'Keine Strecke zugeteilt. Die Zuteilung steht in der geöffneten Strecke oder unter „⋯“.',
    karte: x => zeichenliste ? zeichenKarte(x) : flaechenliste ? flaecheKarte(x) : streckenKarte(x),
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
  const frisch = () => {
    const neu = kennzahlen(s);
    kz.innerHTML = kennzahlenHTML(neu);
    const kopfWert = karte.querySelector('.eintrag-wert');
    if (kopfWert) kopfWert.textContent = formatLaenge(neu.trasse);
    stromFrisch();
    funkFrisch();
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
      inhalt: `<p>Soll <b>${escapeHtml(s.name)}</b> mit ${s.punkte.length} Punkten wirklich gelöscht werden?</p>
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
    ['Trommeln', String(k.trommeln)],
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
  if (k.kabelabschnitte.length < 2) return '';
  const teile = k.kabelabschnitte.map(a =>
    `${meter(a.bedarf)} → ${a.trommeln}`).join(' · ');
  return `<p class="kz-hinweis"><b>${k.kabelabschnitte.length} Kabelabschnitte</b> durch
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
let schattenEbene = null, schattenBefund = null;

function schattenWeg() {
  if (schattenEbene && ctx && ctx.karte) ctx.karte.removeLayer(schattenEbene);
  schattenEbene = null; schattenBefund = null;
}

function schattenHTML() {
  if (!schattenBefund) return '';
  return `<p class="rf-gelaende">${escapeHtml(sichtText(schattenBefund))}</p>`;
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
  if (hoehenStand.get(s.id) !== ort || f.hoehen.some(h => h.grund === null)) {
    gelaendeLaeuft.add(s.id);
    aktualisieren();
    Promise.all([f.a, f.b].map(pt => hoeheAn(pt.lat, pt.lng)))
      .then(hoehen => {
        hoehenStand.set(s.id, ort);
        if (hoehen.every(h => h === null)) return;
        store.aendern(p => {
          const st = p.strecken.find(x => x.id === s.id);
          if (!st) return;
          hoehen.forEach((h, i) => {
            if (h !== null) st.richtfunk.standorte[i].hoehe = Math.round(h);
          });
        }, 'strecke');
      })
      .catch(() => {})
      .finally(() => { gelaendeLaeuft.delete(s.id); aktualisieren(); });
    return;
  }

  if (urteilLesen(s) !== undefined) return;
  gelaendeLaeuft.add(s.id);
  aktualisieren();
  profil(f.a, f.b, 25)
    .then(punkte => {
      const mitte = f.hoehen.map(h => h.grund + (h.antenne || 0));
      /* Mitgespeichert werden auch die Stützpunkte: das Blatt zeichnet später
         dasselbe Profil und darf dafür nicht nachladen. */
      urteilMerken(s, {
        ...gelaendeurteil(punkte, mitte[0], mitte[1], f.mhz),
        profil: punkte, mitten: mitte, mhz: f.mhz
      });
    })
    .catch(() => {})
    .finally(() => { gelaendeLaeuft.delete(s.id); aktualisieren(); });
}

function richtfunkGruppe(s, frisch) {
  const gruppe = el('div', 'feldgruppe');
  schattenWeg();   // beim Öffnen einer anderen Strecke bleibt kein alter stehen
  gruppe.appendChild(el('h3', 'gruppen-titel', 'Richtfunkstrecke (WLAN)'));

  const v = s.richtfunk;
  const ergebnis = el('div', 'rf-ergebnis');
  const spalten = el('div', 'rf-spalten');
  const bandbreiteFeld = () => feld('Bandbreite', v.bandbreite,
    w => schreib(() => { v.bandbreite = Number(w); }, aktualisieren),
    { typ: 'select', werte: bandById(v.band).bandbreiten.map(b => [b, `${b} MHz`]) });

  const aktualisieren = () => {
    ergebnis.innerHTML = richtfunkErgebnisHTML(s);
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
     keine Liste – der Umkreis steht fest, Standort und Antennenhöhe stehen
     ohnehin schon in der Spalte darüber. Gespeichert wird nichts: eine Fläche,
     die eine Planung überdauert, wäre irgendwann für eine andere Masthöhe
     gerechnet als die, die danebensteht. */
  tastenreihe.appendChild(knopf('Funksicht von Platz A', ev => {
    const f = funkstrecke(s);
    if (!f) return hinweis('Erst beide Aufbauplätze auf der Karte setzen.');
    if (schattenEbene) { schattenWeg(); return aktualisieren(); }
    const taste = ev && ev.currentTarget;
    if (taste) { taste.disabled = true; taste.textContent = 'Höhen werden geholt …'; }
    const hoch = Number(s.richtfunk.standorte[0].antennenhoehe) || 3;
    funksicht(f.a, hoch, f.mhz, UMKREIS_STANDARD, hoch).then(e => {
      if (!e) return hinweis('Für diesen Umkreis liegen keine Höhen vor.', 'fehler');
      schattenEbene = zeichneFunksicht(ctx.karte, e);
      schattenBefund = e;
      aktualisieren();
    }).catch(() => hinweis('Die Höhendaten waren nicht zu erreichen.', 'fehler'))
      .finally(() => {
        if (taste) {
          taste.disabled = false;
          taste.textContent = schattenEbene
            ? 'Funksicht ausblenden' : 'Funksicht von Platz A';
        }
      });
  }, 'klein'));
  gruppe.appendChild(tastenreihe);

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
  const u = urteilLesen(s);
  /* Solange geholt wird, steht das auch da. Ein Kasten, der sich nach ein paar
     Sekunden stillschweigend um einen Absatz erweitert, wirkt wie ein Fehler. */
  if (gelaendeLaeuft.has(s.id)) {
    return '<p class="rf-gelaende rf-laeuft">Geländehöhen werden geholt …</p>';
  }
  if (u === undefined) return '';
  if (u === null) return '<p class="rf-gelaende">Das Gelände ließ sich nicht beurteilen.</p>';
  return `${profilBildHTML(u)}
    <p class="rf-gelaende rf-${escapeHtml(u.urteil)}">${escapeHtml(u.satz)}</p>`;
}

/* Das Bild steht über dem Satz, nicht darunter: es zeigt, worauf der Satz
   beruht, und wer das Urteil liest, hat den Schnitt dann schon gesehen. Die
   Engstelle wird nur eingezeichnet, wenn sie auch gemeldet wird – sonst stünde
   eine Marke an der knappsten Stelle einer Strecke, die frei ist. */
function profilBildHTML(u) {
  if (!u.profil) return '';
  const svg = profilSVG(u.profil, u.mitten[0], u.mitten[1], u.mhz,
    { engste: u.urteil === 'verdeckt' ? u.engste : null });
  if (!svg) return '';
  return `<figure class="hp-bild">${svg}${profilLegendeHTML()}
    <figcaption>${escapeHtml(profilVorbehalt(u.profil))}</figcaption></figure>`;
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
  fuss.push('KatS-Dv 861, ' + r.fundstelle);

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
    `<span class="pz-fundstelle">KatS-Dv 861, ${escapeHtml(art.fundstelle)}</span>`];
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

  dialog({ titel: 'Taktisches Zeichen wählen', inhalt: box, breit: true, fuss: [{ text: 'Abbrechen' }] });
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

  const kopf = el('header', 'eintrag-kopf');
  kopf.innerHTML =
    `<span class="mini-bild"></span>
     <button type="button" class="eintrag-name" aria-expanded="${gewaehlt}">${escapeHtml(bildTitel(b))}</button>
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

/** Das Bild in voller Größe – am Bauort der einzige Weg, es genau anzusehen */
export function bildAnsehen(b) {
  const box = el('div', 'bild-gross');
  bildUrl(b.id).then(url => {
    if (!url || !box.isConnected) {
      box.appendChild(el('p', 'klein fehlertext', 'Zu diesem Eintrag liegen keine Bilddaten vor.'));
      return;
    }
    const bild = document.createElement('img');
    bild.src = url;
    bild.alt = bildTitel(b);
    box.insertBefore(bild, box.firstChild);
  });

  const fuss = [];
  if (b.bemerkung) fuss.push(escapeHtml(b.bemerkung));
  if (b.aufgenommen) fuss.push(escapeHtml(zeitpunkt(b.aufgenommen)));
  if (b.lat !== null) fuss.push(escapeHtml(toMGRS(b.lat, b.lng, 5)));
  if (fuss.length) box.appendChild(el('p', 'klein', fuss.join(' · ')));

  dialog({ titel: bildTitel(b), inhalt: box, breit: true, fuss: [{ text: 'Schließen', primaer: true }] });
}

/**
 * Bilddateien übernehmen und das Ergebnis in einem Satz melden.
 * Aufgerufen aus der Dateiauswahl und vom Abwurf auf die Karte.
 */
export async function bilderUebernehmen(dateien) {
  const anzahl = Array.from(dateien || []).length;
  if (!anzahl) return;
  hinweis(anzahl === 1 ? 'Bild wird übernommen …' : `${anzahl} Bilder werden übernommen …`);

  let ergebnis;
  try {
    ergebnis = await bilderAufnehmen(dateien);
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
    const zeile = el('div', 'pl-zeile' + (pr.id === store.projekt.id ? ' aktiv' : ''));
    zeile.innerHTML =
      `<div class="pl-text"><b>${escapeHtml(pr.name)}</b>
        <span class="klein">${pr.strecken} Strecken · ${pr.zeichen} Zeichen${
          pr.bilder ? ` · ${pr.bilder} Bilder` : ''} ·
        ${new Date(pr.geaendert).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span></div>`;
    const t = el('div', 'pl-tasten');
    t.append(
      knopf('Öffnen', () => {
        if (store.laden(pr.id)) { schliesseDialog(); hinweis(`„${pr.name}“ geöffnet`); }
      }, pr.id === store.projekt.id ? 'aus' : 'primaer'),
      knopf('Löschen', () => loeschDialog(pr), 'gefahr')
    );
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
  dialog({
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
           <b>Sammel-PDF (alle Strecken)</b> im Reiter „Strecken“. Er beginnt mit einem
           Deckblatt samt Übersichtskarte und Summen, danach folgen das
           Streckenverzeichnis mit dem Materialbedarf nach Leitungsarten und je Strecke
           das gewohnte Kartenblatt. Welche dieser Blätter entstehen, ist oben in der
           Gruppe <b>Blätter</b> zu wählen.</p>
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
           ist, damit die Blätter einer Lage deckungsgleich übereinander liegen. Stehen bleiben nur zwei Angaben: die Einstufung,
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
          <li><kbd>S</kbd> neue Strecke · <kbd>T</kbd> taktisches Zeichen · <kbd>F</kbd> Fläche · <kbd>K</kbd> Koordinate</li>
          <li><kbd>Strg</kbd>+<kbd>Z</kbd> rückgängig · <kbd>Strg</kbd>+<kbd>Umschalt</kbd>+<kbd>Z</kbd> wiederholen</li>
          <li><kbd>Enter</kbd> Zeichnen beenden · <kbd>Esc</kbd> abbrechen</li>
          <li><kbd>Strg</kbd>+<kbd>P</kbd> Bauauftrag der gewählten Strecke öffnen</li>
        </ul>
      </div>`,
    fuss: [{ text: 'Schließen', primaer: true }]
  });
}

// ---------------------------------------------------------------- Hilfsknopf

function knopf(text, tun, klasse = '') {
  const b = el('button', 'knopf ' + klasse, escapeHtml(text));
  b.onclick = tun;
  return b;
}
