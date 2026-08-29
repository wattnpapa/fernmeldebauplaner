// ui.js – Seitenleiste, Formulare, Dialoge

import {
  store, KABELTYPEN, VERLEGEARTEN, PUNKTARTEN, FARBEN,
  neuesZeichen, punktartById, kabelById,
  projektListe, speicherBelegung, SPEICHER_KONTINGENT, dateisicherung, id
} from './state.js';
import { kennzahlen, segmentLaengen, kumuliert, escapeHtml } from './strecken.js';
import { formatLaenge, meter, toMGRS, toDDM, alleFormate, parseKoordinate } from './geo.js';
import {
  NETZFORMEN, LASTEINHEITEN, netzById, MAX_QUERSCHNITT,
  querschnittText, stromText, leistungText, prozentText, grenzText, massgebendText
} from './strom.js';
import { SYMBOLE, KATEGORIEN, ORGANISATIONEN, STAERKEN, symbolSVG, symbolById } from './symbols.js';
import * as io from './io.js';
import { oeffneBauauftrag } from './bauauftrag.js';

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
  liste.innerHTML = '';

  const ges = p.strecken.reduce((a, s) => {
    const k = kennzahlen(s);
    a.trasse += k.trasse; a.bedarf += k.bedarf; a.trommeln += k.trommeln;
    return a;
  }, { trasse: 0, bedarf: 0, trommeln: 0 });

  summe.innerHTML = p.strecken.length
    ? `<span><b>${p.strecken.length}</b> ${p.strecken.length === 1 ? 'Strecke' : 'Strecken'}</span>
       <span>Trasse <b>${formatLaenge(ges.trasse)}</b></span>
       <span>Bedarf <b>${formatLaenge(ges.bedarf)}</b></span>
       <span><b>${ges.trommeln}</b> ${ges.trommeln === 1 ? 'Trommel' : 'Trommeln'}</span>`
    : '';

  if (!p.strecken.length) {
    liste.appendChild(el('div', 'leer',
      `<p><b>Noch keine Strecke geplant.</b></p>
       <p>„Neue Strecke zeichnen“ wählen und die Trasse auf der Karte anklicken –
       Punkt für Punkt vom Anfangs- zum Endpunkt. Mit Doppelklick oder <kbd>Enter</kbd> abschließen.</p>`));
    return;
  }

  for (const s of p.strecken) liste.appendChild(streckenKarte(s));
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

  /* Der Bauzuschlag verlängert die Leitung und damit den Spannungsfall –
     die Querschnittsanzeige hängt an denselben Feldern und wird mit erneuert. */
  let stromFrisch = () => {};
  const frisch = () => {
    const neu = kennzahlen(s);
    kz.innerHTML = kennzahlenHTML(neu);
    const kopfWert = karte.querySelector('.eintrag-wert');
    if (kopfWert) kopfWert.textContent = formatLaenge(neu.trasse);
    stromFrisch();
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
    knopf('GeoJSON', () => io.geoJSONExportieren(s.id), 'klein')
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

// ---------------------------------------------------------------- Taktische Zeichen

export function zeichneZeichenListe() {
  const p = store.projekt;
  const liste = document.getElementById('zeichen-liste');
  liste.innerHTML = '';

  if (!p.zeichen.length) {
    liste.appendChild(el('div', 'leer',
      `<p><b>Noch keine taktischen Zeichen gesetzt.</b></p>
       <p>„Taktisches Zeichen setzen“ wählen, Symbol aus der Auswahl nehmen und
       auf der Karte platzieren.</p>`));
    return;
  }

  for (const z of p.zeichen) {
    const gewaehlt = ctx.zl.auswahl === z.id;
    const basis = symbolById(z.symbol);
    const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : '') +
      (z.sichtbar === false ? ' verborgen' : ''));

    const kopf = el('header', 'eintrag-kopf');
    kopf.innerHTML =
      `<span class="mini-symbol">${symbolSVG({ symbol: z.symbol, org: z.org, staerke: z.staerke, breite: 26 })}</span>
       <button type="button" class="eintrag-name" aria-expanded="${gewaehlt}">${escapeHtml(z.label || basis.name)}</button>
       ${augenKnopf(z.sichtbar !== false)}`;
    kopf.onclick = () => ctx.zl.waehle(gewaehlt ? null : z.id);
    kopf.querySelector('[data-akt="sichtbar"]').onclick = e => {
      e.stopPropagation();
      store.aendern(() => { z.sichtbar = z.sichtbar === false; }, 'zeichen');
    };
    karte.appendChild(kopf);

    if (gewaehlt) karte.appendChild(zeichenFormular(z, basis));
    liste.appendChild(karte);
  }
}

function zeichenFormular(z, basis) {
  const koerper = el('div', 'eintrag-koerper');

  const symZeile = el('div', 'feld');
  symZeile.appendChild(el('span', 'feld-titel', 'Symbol'));
  const symKnopf = el('button', 'symbol-waehler');
  symKnopf.innerHTML = `${symbolSVG({ symbol: z.symbol, org: z.org, staerke: z.staerke, breite: 34 })}
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

  const paar = el('div', 'feld-paar');
  paar.append(
    feld('Organisation', z.org, v => {
      store.aendern(p => { z.org = v; p.optionen.letzteOrg = v; }, 'zeichen');
    }, { typ: 'select', werte: ORGANISATIONEN.map(o => [o.id, o.name]) }),
    feld('Stärke', z.staerke ?? '', v => {
      store.aendern(() => { z.staerke = v; }, 'zeichen');
    }, { typ: 'select', werte: STAERKEN.map(s => [s.id, s.name]) })
  );
  g.appendChild(paar);

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

/** Symbolauswahl mit Suche und Kategorien */
export function symbolPalette(beiWahl) {
  const box = el('div', 'palette');
  box.innerHTML = `<input type="search" class="palette-suche" placeholder="Symbol suchen …" aria-label="Symbol suchen">
    <div class="palette-gitter"></div>`;
  const gitter = box.querySelector('.palette-gitter');
  const suche = box.querySelector('.palette-suche');
  const org = store.projekt.optionen.letzteOrg || 'thw';

  const bauen = (filter = '') => {
    gitter.innerHTML = '';
    const f = filter.trim().toLowerCase();
    for (const kat of KATEGORIEN) {
      const treffer = SYMBOLE.filter(s => s.kat === kat.id &&
        (!f || s.name.toLowerCase().includes(f) || s.id.includes(f)));
      if (!treffer.length) continue;
      gitter.appendChild(el('h4', 'palette-kat', escapeHtml(kat.name)));
      const reihe = el('div', 'palette-reihe');
      for (const s of treffer) {
        const b = el('button', 'palette-knopf');
        b.innerHTML = `${symbolSVG({ symbol: s.id, org, breite: s.form === 'einheit' || s.form === 'fuehrungsstelle' ? 46 : 36 })}
          <span>${escapeHtml(s.name)}</span>`;
        b.onclick = () => { beiWahl(s.id); schliesseDialog(); };
        reihe.appendChild(b);
      }
      gitter.appendChild(reihe);
    }
    if (!gitter.children.length) gitter.appendChild(el('p', 'klein', 'Kein Symbol gefunden.'));
  };
  suche.oninput = () => bauen(suche.value);
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
        <h3>Bauauftrag</h3>
        <p>In der geöffneten Strecke <b>Bauauftrag (PDF)</b> wählen. Dort A4/A3, Hoch/Quer und
           Farbe/Schwarz-Weiß einstellen und über den Druckdialog des Browsers
           <b>„Als PDF speichern“</b> wählen.</p>
        <p>Im Druckdialog dasselbe Papierformat einstellen, das oben gewählt wurde, und
           die Ränder auf „Keine“ stellen – das Blatt bringt seine Ränder selbst mit.
           Der Hinweis am Druckknopf nennt die drei Angaben. Der vorgeschlagene Dateiname
           enthält Auftragsnummer, Strecke und Datum.</p>
        <h3>Koordinaten</h3>
        <p>Unten steht die Koordinate der Stelle, über der die Maus steht oder die zuletzt
           angetippt wurde – in MGRS und als GPS-Angabe. Ein Klick auf die Angabe legt sie in
           die Zwischenablage. In der Punkttabelle öffnet ein Klick auf die Koordinate alle
           Formate zum Kopieren und erlaubt die Eingabe einer neuen Position.</p>
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
