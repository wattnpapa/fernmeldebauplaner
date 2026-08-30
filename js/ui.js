// ui.js – Seitenleiste, Formulare, Dialoge

import {
  store, KABELTYPEN, VERLEGEARTEN, PUNKTARTEN, FARBEN,
  neuesZeichen, punktartById, kabelById, neueStrecke, neuerEinsatzabschnitt, abschnittById,
  streckenIm, zeichenIm,
  projektListe, speicherBelegung, SPEICHER_KONTINGENT, dateisicherung, id
} from './state.js';
import { kennzahlen, gesamtKennzahlen, segmentLaengen, kumuliert, escapeHtml } from './strecken.js';
import { formatLaenge, meter, toMGRS, toDDM, alleFormate, parseKoordinate } from './geo.js';
import {
  NETZFORMEN, LASTEINHEITEN, netzById, MAX_QUERSCHNITT,
  querschnittText, stromText, leistungText, prozentText, grenzText, massgebendText
} from './strom.js';
import {
  QUERUNGSARTEN, VS_GRADE, querungsartById, massText, dtg
} from './vorschrift.js';
import { SYMBOLE, KATEGORIEN, symbolSVG, symbolById } from './symbols.js';
import * as io from './io.js';
import { oeffneBauauftrag, oeffneSammeldruck } from './bauauftrag.js';
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

export function dialog({ titel, inhalt, fuss = [], breit = false }) {
  const huelle = document.getElementById('dialog');
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
  huelle.hidden = false;
  const ersterFokus = feld.querySelector('input,select,textarea,button');
  if (ersterFokus) setTimeout(() => ersterFokus.focus(), 30);
  return feld;
}

export function schliesseDialog() { document.getElementById('dialog').hidden = true; }

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
function schreib(fn) {
  store.aendern(fn, 'formular');
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

// ---------------------------------------------------------------- Strecken

export function zeichneStreckenListe() {
  const p = store.projekt;
  const liste = document.getElementById('strecken-liste');
  const summe = document.getElementById('strecken-summe');
  const abschnitte = p.einsatzabschnitte || [];
  liste.innerHTML = '';

  const ges = gesamtKennzahlen(p.strecken);
  summe.innerHTML = p.strecken.length
    ? `<span><b>${p.strecken.length}</b> ${p.strecken.length === 1 ? 'Strecke' : 'Strecken'}</span>
       ${abschnitte.length ? `<span><b>${abschnitte.length}</b> ${abschnitte.length === 1 ? 'Abschnitt' : 'Abschnitte'}</span>` : ''}
       <span>Trasse <b>${formatLaenge(ges.trasse)}</b></span>
       <span>Bedarf <b>${formatLaenge(ges.bedarf)}</b></span>
       <span><b>${ges.trommeln}</b> ${ges.trommeln === 1 ? 'Trommel' : 'Trommeln'}</span>`
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
    for (const s of p.strecken) liste.appendChild(streckenKarte(s));
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
 * Ein Einsatzabschnitt als Klammer über seine Einträge – dieselbe Zeile über
 * den Strecken wie über den taktischen Zeichen. `art` bestimmt, was darin
 * steht und was der Kopf zählt.
 */
function abschnittGruppe(ea, art) {
  const p = store.projekt;
  const zeichenliste = art === 'zeichen';
  const aid = ea ? ea.id : null;
  const eintraege = zeichenliste ? zeichenIm(p, aid) : streckenIm(p, aid);
  const zu = zugeklappt.has(klappSchluessel(aid, art));

  const box = el('section', 'ea-gruppe' + (zu ? ' zu' : '') + (ea ? '' : ' ea-ohne') +
    (ea && ea.sichtbar === false ? ' verborgen' : ''));
  if (ea) box.dataset.aid = ea.id;

  const kopf = el('header', 'ea-kopf');
  kopf.innerHTML =
    `<span class="farbpunkt${ea ? '' : ' hohl'}"${ea ? ` style="--farbe:${ea.farbe}"` : ''}></span>
     <button type="button" class="ea-name" aria-expanded="${!zu}">
       <span class="ea-pfeil" aria-hidden="true">▾</span>${escapeHtml(ea ? ea.name : 'Ohne Einsatzabschnitt')}
     </button>
     <span class="ea-wert">${zeichenliste
       ? `${eintraege.length} Zeichen`
       : `${eintraege.length} · ${formatLaenge(gesamtKennzahlen(eintraege).trasse)}`}</span>
     ${ea ? augenKnopf(ea.sichtbar !== false) : ''}
     <button type="button" class="ea-mehr" data-akt="mehr"
             title="Einsatzabschnitt öffnen" aria-label="Einsatzabschnitt öffnen">⋯</button>`;

  const neuZeichnen = () => zeichenliste ? zeichneZeichenListe() : zeichneStreckenListe();
  kopf.querySelector('.ea-name').onclick = () => {
    const s = klappSchluessel(aid, art);
    zugeklappt.has(s) ? zugeklappt.delete(s) : zugeklappt.add(s);
    neuZeichnen();
  };
  kopf.querySelector('[data-akt="mehr"]').onclick = () => einsatzabschnittDialog(aid);
  if (ea) {
    kopf.querySelector('[data-akt="sichtbar"]').onclick = () => {
      store.aendern(() => { ea.sichtbar = ea.sichtbar === false; }, 'strecke');
    };
  }
  box.appendChild(kopf);

  if (!zu) {
    const inhalt = el('div', 'ea-strecken');
    if (!eintraege.length) {
      inhalt.appendChild(el('p', 'klein ea-leer', zeichenliste
        ? 'Kein Zeichen zugeteilt. Nicht zugeteilte Zeichen gehören ohnehin zu jedem Abschnitt.'
        : 'Keine Strecke zugeteilt. Die Zuteilung steht in der geöffneten Strecke oder unter „⋯“.'));
    }
    for (const x of eintraege) inhalt.appendChild(zeichenliste ? zeichenKarte(x) : streckenKarte(x));
    /* Anlegen und Zuteilen in einem Griff: sonst müsste jeder neue Eintrag
       erst gesetzt, dann gesucht und dann von Hand zugeteilt werden. */
    if (ea) inhalt.appendChild(neuKnopf(ea, art));
    box.appendChild(inhalt);
  }
  return box;
}

function neuKnopf(ea, art) {
  if (art === 'zeichen') {
    return knopf('+ Zeichen in diesem Abschnitt', () => {
      symbolPalette(sym => ctx.zeichenSetzen(sym, ea.id));
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
  const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : '') +
    (s.sichtbar === false ? ' verborgen' : ''));
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
       <span>Bedarf ${formatLaenge(k.bedarf)}</span>`));
    return karte;
  }

  const koerper = el('div', 'eintrag-koerper');

  // -- Kennzahlen
  const kz = el('div', 'kennzahlen');
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
  const frisch = () => {
    const neu = kennzahlen(s);
    kz.innerHTML = kennzahlenHTML(neu);
    const kopfWert = karte.querySelector('.eintrag-wert');
    if (kopfWert) kopfWert.textContent = formatLaenge(neu.trasse);
    stromFrisch();
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
        ...store.projekt.einsatzabschnitte.map(a => [a.id, a.name])]
    }));
  }
  g1.appendChild(farbwahl(s, karte));
  koerper.appendChild(g1);

  // -- Technik
  const g2 = el('div', 'feldgruppe');
  g2.appendChild(el('h3', 'gruppen-titel', 'Leitung und Bauansatz'));
  g2.appendChild(feld('Leitungsart', s.kabeltyp, v => {
    schreib(() => {
      const alt = kabelById(s.kabeltyp), neu = kabelById(v);
      s.kabeltyp = v;
      // Vorgabewerte mitziehen, solange sie nicht von Hand geändert wurden
      if (s.trommellaenge === alt.trommel) s.trommellaenge = neu.trommel;
      if (s.zuschlag === alt.zuschlag) s.zuschlag = neu.zuschlag;
      if (s.verlegeleistung === alt.leistung) s.verlegeleistung = neu.leistung;
    });
    zeichneStreckenListe();
  }, { typ: 'select', werte: KABELTYPEN.map(k => [k.id, k.name]) }));
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

function kennzahlenHTML(k) {
  return [
    ['Trasse', formatLaenge(k.trasse)],
    ['Bedarf', formatLaenge(k.bedarf)],
    ['Trommeln', String(k.trommeln)],
    ['Bauzeit', stundenKurz(k.bauzeitStunden)]
  ].map(([t, w]) => `<div class="kz"><span>${t}</span><b>${escapeHtml(w)}</b></div>`).join('');
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
    }

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
      /* Nur die Zeile nachziehen: die Liste bei jedem Tastendruck neu zu bauen
         verlöre Bildlauf und Tastenfokus in den offenen Strecken darunter. */
      const zeile = document.querySelector(`.ea-gruppe[data-aid="${ea.id}"] .ea-name`);
      if (zeile) zeile.lastChild.textContent = v;
      document.getElementById('dialog-titel').textContent = v || 'Einsatzabschnitt';
    }, { platzhalter: 'z. B. Einsatzabschnitt Nord' }));
    g.appendChild(feld('Leitung / Verantwortlich', ea.leiter, v => schreib(() => { ea.leiter = v; }),
      { platzhalter: 'Name, Funktion – steht auf dem Sammelauftrag' }));
    g.appendChild(abschnittFarbwahl(ea));
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
  const datei = knopf('Als Datei sichern (.json)', () => {
    if (io.abschnittExportieren(aid)) hinweis('Einsatzabschnitt als eigene Planungsdatei gesichert');
  });
  /* Ausgeben lässt sich nur, was da ist – die Knöpfe folgen der Zuteilung,
     die im selben Dialog gerade geändert wird. */
  const ausgabeAuffrischen = () => {
    const strecken = streckenIm(store.projekt, aid);
    pdf.disabled = !strecken.filter(s => s.punkte.length >= 2).length;
    // Ein Abschnitt darf auch aus Zeichen allein bestehen – etwa als Lagebild
    // eines Abschnitts, dessen Strecken erst noch geplant werden.
    datei.disabled = !strecken.length && !zeichenIm(store.projekt, aid).length;
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

  const aus = el('div', 'feldgruppe');
  aus.appendChild(el('h3', 'gruppen-titel', 'Ausgabe'));
  const tasten = el('div', 'tastenreihe');
  ausgabeAuffrischen();
  tasten.append(pdf, datei);
  aus.appendChild(tasten);
  aus.appendChild(el('p', 'klein',
    `Der Sammelauftrag fasst alle Strecken dieses Abschnitts in einem Dokument
     zusammen – Deckblatt mit Übersichtskarte, Streckenverzeichnis und je Strecke
     das gewohnte Kartenblatt. Die Datei enthält nur diesen Ausschnitt und lässt
     sich beim Empfänger über <b>Datei → Planung oder KML laden</b> öffnen.
     Beides führt die Zeichen dieses Abschnitts mit und dazu die nicht
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
 *  sie zwischen den Abschnitten, ohne dass jedes einzeln geöffnet werden muss. */
function zuteilungsliste(art, aid, stand, ausgabeAuffrischen) {
  const p = store.projekt;
  const zeichenliste = art === 'zeichen';
  const alle = zeichenliste ? p.zeichen : p.strecken;
  const box = el('div', 'ea-zuteilung');

  const standSchreiben = () => {
    const eigen = zeichenliste ? zeichenIm(store.projekt, aid) : streckenIm(store.projekt, aid);
    if (zeichenliste) {
      stand.innerHTML = eigen.length
        ? `<b>${eigen.length}</b> zugeteilt. Nicht zugeteilte Zeichen erscheinen ohnehin
           in jedem Abschnitt.`
        : 'Kein Zeichen zugeteilt – die nicht zugeteilten gelten für jeden Abschnitt.';
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
                   : 'Diese Planung enthält noch keine Strecke.'));
    standSchreiben();
    return box;
  }

  for (const x of alle) {
    const bezeichnung = zeichenliste ? (x.label || symbolById(x.symbol).name) : x.name;
    const zeile = el('div', 'ez-zeile');
    zeile.innerHTML = zeichenliste
      ? `<span class="mini-symbol">${symbolSVG({ symbol: x.symbol, breite: 24 })}</span>
         <span class="ez-name">${escapeHtml(bezeichnung)}</span>`
      : `<span class="farbpunkt" style="--farbe:${x.farbe}"></span>
         <span class="ez-name">${escapeHtml(bezeichnung)}</span>
         <span class="ez-wert">${formatLaenge(kennzahlen(x).trasse)}</span>`;

    const wahl = document.createElement('select');
    wahl.className = 'mini-select';
    wahl.setAttribute('aria-label', `Einsatzabschnitt für ${bezeichnung}`);
    for (const [wert, text] of [['', '— ohne —'], ...p.einsatzabschnitte.map(a => [a.id, a.name])]) {
      const o = document.createElement('option');
      o.value = wert; o.textContent = text; o.selected = (x.abschnitt || '') === wert;
      wahl.appendChild(o);
    }
    wahl.onchange = () => {
      store.aendern(() => { x.abschnitt = wahl.value || null; }, zeichenliste ? 'zeichen' : 'strecke');
      zeile.classList.toggle('eigen', (x.abschnitt || null) === (aid || null));
      standSchreiben();
      ausgabeAuffrischen();
    };
    zeile.classList.toggle('eigen', (x.abschnitt || null) === (aid || null));
    zeile.appendChild(wahl);
    box.appendChild(zeile);
  }
  standSchreiben();
  return box;
}

function abschnittFarbwahl(ea) {
  const wrap = el('div', 'feld');
  wrap.appendChild(el('span', 'feld-titel', 'Farbe des Abschnitts'));
  const reihe = el('div', 'farbreihe');
  FARBEN.forEach(f => {
    const b = el('button', 'farbe' + (ea.farbe === f ? ' aktiv' : ''));
    b.style.background = f;
    b.title = f;
    b.setAttribute('aria-label', 'Farbe ' + f);
    b.onclick = () => {
      schreib(() => { ea.farbe = f; });
      reihe.querySelectorAll('.farbe').forEach(x => x.classList.remove('aktiv'));
      b.classList.add('aktiv');
      const punkt = document.querySelector(`.ea-gruppe[data-aid="${ea.id}"] .farbpunkt`);
      if (punkt) punkt.style.setProperty('--farbe', f);
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
  const anzahl = streckenIm(store.projekt, ea.id).length + zeichenIm(store.projekt, ea.id).length;
  dialog({
    titel: 'Einsatzabschnitt auflösen',
    inhalt: `<p>Soll <b>${escapeHtml(ea.name)}</b> aufgelöst werden?</p>
      <p class="klein">${anzahl
        ? `Die ${anzahl} zugeteilten Strecken und Zeichen bleiben erhalten und gelten
           danach als nicht zugeteilt.`
        : 'Diesem Abschnitt ist nichts zugeteilt.'}
        Rückgängig machen ist mit <kbd>Strg</kbd>+<kbd>Z</kbd> möglich.</p>`,
    fuss: [
      { text: 'Abbrechen', tun: () => { einsatzabschnittDialog(ea.id); return false; } },
      { text: 'Auflösen', gefahr: true, tun: () => {
          store.aendern(p => {
            p.strecken.forEach(s => { if (s.abschnitt === ea.id) s.abschnitt = null; });
            p.zeichen.forEach(z => { if (z.abschnitt === ea.id) z.abschnitt = null; });
            p.einsatzabschnitte = p.einsatzabschnitte.filter(a => a.id !== ea.id);
          }, 'strecke');
          hinweis('Einsatzabschnitt aufgelöst');
        } }
    ]
  });
}

// ---------------------------------------------------------------- Taktische Zeichen

export function zeichneZeichenListe() {
  const p = store.projekt;
  const liste = document.getElementById('zeichen-liste');
  const abschnitte = p.einsatzabschnitte || [];
  liste.innerHTML = '';

  if (!p.zeichen.length) {
    liste.appendChild(el('div', 'leer',
      `<p><b>Noch keine taktischen Zeichen gesetzt.</b></p>
       <p>„Taktisches Zeichen setzen“ wählen, Symbol aus der Auswahl nehmen und
       auf der Karte platzieren.</p>`));
    if (!abschnitte.length) return;
  }

  if (!abschnitte.length) {
    for (const z of p.zeichen) liste.appendChild(zeichenKarte(z));
    return;
  }

  for (const ea of abschnitte) liste.appendChild(abschnittGruppe(ea, 'zeichen'));
  if (zeichenIm(p, null).length) liste.appendChild(abschnittGruppe(null, 'zeichen'));
}

function zeichenKarte(z) {
  const gewaehlt = ctx.zl.auswahl === z.id;
  const basis = symbolById(z.symbol);
  const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : '') +
    (z.sichtbar === false ? ' verborgen' : ''));

  const kopf = el('header', 'eintrag-kopf');
  kopf.innerHTML =
    `<span class="mini-symbol">${symbolSVG({ symbol: z.symbol, breite: 26 })}</span>
     <button type="button" class="eintrag-name" aria-expanded="${gewaehlt}">${escapeHtml(z.label || basis.name)}</button>
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
        ...store.projekt.einsatzabschnitte.map(a => [a.id, a.name])]
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
      if (io.projektExportieren()) hinweis('Planung als Datei gesichert');
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
        <span class="klein">${pr.strecken} Strecken · ${pr.zeichen} Zeichen ·
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
        ${pr.strecken === 1 ? 'Strecke' : 'Strecken'} und ${pr.zeichen}
        taktischen Zeichen
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
          if (io.projektExportieren(pr.id)) hinweis('Planung als Datei gesichert');
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

export function koordinatenSuche() {
  const box = el('div');
  box.innerHTML = `
    <label class="feld"><span class="feld-titel">Koordinate</span>
      <input type="text" id="ks-eingabe" placeholder="32U LB 56560 45282  ·  50.9413, 6.9583  ·  N 50 56.478 O 006 57.498">
    </label>
    <p class="klein" id="ks-status">MGRS, Dezimalgrad, Grad/Dezimalminuten und Grad/Min./Sek. werden erkannt.</p>
    <label class="feld ks-haken"><input type="checkbox" id="ks-marke"><span class="feld-titel">Zusätzlich ein taktisches Zeichen dort setzen</span></label>`;

  dialog({
    titel: 'Koordinate anspringen', inhalt: box,
    fuss: [
      { text: 'Abbrechen' },
      { text: 'Anspringen', primaer: true, tun: () => {
          const wert = box.querySelector('#ks-eingabe').value;
          const k = parseKoordinate(wert);
          if (!k) {
            box.querySelector('#ks-status').innerHTML = '<b class="fehlertext">Koordinate nicht erkannt.</b>';
            return false;
          }
          ctx.karte.setView([k.lat, k.lng], Math.max(ctx.karte.getZoom(), 16));
          if (box.querySelector('#ks-marke').checked) {
            store.aendern(p => p.zeichen.push(neuesZeichen(k.lat, k.lng, 'fm-messstelle')), 'zeichen');
          }
          hinweis(`Angesprungen (${k.format}) – ${toMGRS(k.lat, k.lng, 5)}`);
        } }
    ]
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
          <li>Punkte lassen sich später verschieben; die kleinen Griffe zwischen zwei Punkten
              fügen beim Ziehen einen Zwischenpunkt ein.</li>
          <li>Punktarten (Muffe, Querung, Mast …) in der Punkttabelle setzen – sie erscheinen
              in Karte und Bauauftrag.</li>
        </ol>
        <h3>Längen</h3>
        <p>Teillängen stehen an jedem Abschnitt, Name und Summe an der Strecke. Gerechnet wird
           die geodätische Direktstrecke zwischen den Punkten; der <b>Bauzuschlag</b> deckt
           Geländeverlauf und Reserve ab und ergibt den Kabelbedarf.</p>
        <h3>Stromleitungen</h3>
        <p>Bei der Leitungsart <b>Stromleitung</b> erscheint die Gruppe
           <b>Stromversorgung</b>. Aus Last, Netzform, zulässigem Spannungsfall und der
           Leitungslänge einschließlich Bauzuschlag ergibt sich der nötige
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
           <b>Datei → Planung als Datei sichern</b> verwenden.</p>
        <h3>Tastatur</h3>
        <ul class="tasten-liste">
          <li><kbd>S</kbd> neue Strecke · <kbd>T</kbd> taktisches Zeichen · <kbd>K</kbd> Koordinate</li>
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
