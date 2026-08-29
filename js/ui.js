// ui.js – Seitenleiste, Formulare, Dialoge

import {
  store, KABELTYPEN, VERLEGEARTEN, PUNKTARTEN, FARBEN,
  neuesZeichen, punktartById, kabelById,
  projektListe, speicherBelegung, id
} from './state.js';
import { kennzahlen, segmentLaengen, kumuliert, escapeHtml } from './strecken.js';
import { formatLaenge, meter, toMGRS, toDDM, alleFormate, parseKoordinate } from './geo.js';
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
    ? `<span><b>${p.strecken.length}</b> Strecken</span>
       <span>Trasse <b>${formatLaenge(ges.trasse)}</b></span>
       <span>Bedarf <b>${formatLaenge(ges.bedarf)}</b></span>
       <span><b>${ges.trommeln}</b> Trommeln</span>`
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
  const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : ''));
  karte.dataset.sid = s.id;

  const kopf = el('header', 'eintrag-kopf');
  kopf.innerHTML =
    `<span class="farbpunkt" style="--farbe:${s.farbe}"></span>
     <span class="eintrag-name">${escapeHtml(s.name)}</span>
     <span class="eintrag-wert">${formatLaenge(k.trasse)}</span>
     <button class="augen" title="Ein-/ausblenden" data-akt="sichtbar">${s.sichtbar === false ? '◌' : '◉'}</button>`;
  kopf.querySelector('.eintrag-name').onclick = () => ctx.sl.waehle(gewaehlt ? null : s.id);
  kopf.querySelector('.farbpunkt').onclick = () => ctx.sl.waehle(gewaehlt ? null : s.id);
  kopf.querySelector('.eintrag-wert').onclick = () => ctx.sl.waehle(gewaehlt ? null : s.id);
  kopf.querySelector('[data-akt="sichtbar"]').onclick = e => {
    e.stopPropagation();
    store.aendern(() => { s.sichtbar = s.sichtbar === false; }, 'strecke');
  };
  karte.appendChild(kopf);

  if (!gewaehlt) {
    karte.appendChild(el('div', 'eintrag-zeile',
      `<span>${escapeHtml(k.kabel.kurz)}</span><span>${k.punkte} Punkte</span>
       <span>Bedarf ${formatLaenge(k.bedarf)}</span>`));
    return karte;
  }

  const koerper = el('div', 'eintrag-koerper');

  // -- Kennzahlen
  const kz = el('div', 'kennzahlen');
  kz.id = 'kz-' + s.id;
  kz.innerHTML = kennzahlenHTML(k);
  koerper.appendChild(kz);

  const frisch = () => {
    const neu = kennzahlen(s);
    kz.innerHTML = kennzahlenHTML(neu);
    const kopfWert = karte.querySelector('.eintrag-wert');
    if (kopfWert) kopfWert.textContent = formatLaenge(neu.trasse);
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

  // -- Punkte
  koerper.appendChild(punktTabelle(s, frisch));

  // -- Aktionen
  const tasten = el('div', 'tastenreihe');
  tasten.append(
    knopf('Weiterzeichnen', () => ctx.weiterzeichnen(s.id), 'primaer'),
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

  const ausgabe = el('div', 'tastenreihe ausgabe');
  ausgabe.append(
    knopf('▤ Bauauftrag (PDF)', () => oeffneBauauftrag(s.id), 'primaer breit'),
    knopf('CSV', () => io.csvExportieren(s.id)),
    knopf('GPX', () => io.gpxExportieren(s.id)),
    knopf('GeoJSON', () => io.geoJSONExportieren(s.id))
  );
  koerper.appendChild(ausgabe);

  const loeschen = knopf('Strecke löschen', () => {
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
  }, 'gefahr breit');
  koerper.appendChild(loeschen);

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
    const weg = el('button', 'mini-knopf gefahr', '✕');
    weg.title = 'Punkt löschen';
    weg.onclick = () => {
      store.aendern(() => {
        s.punkte = s.punkte.filter(x => x.id !== pt.id);
        s.punkte.forEach((q, j) => {
          if (q._manuell) return;
          if (j === 0) q.art = 'start';
          else if (j === s.punkte.length - 1) q.art = 'ziel';
        });
      }, 'strecke');
    };
    kopf.append(zeigen, weg);
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
    const karte = el('article', 'eintrag' + (gewaehlt ? ' offen' : ''));

    const kopf = el('header', 'eintrag-kopf');
    kopf.innerHTML =
      `<span class="mini-symbol">${symbolSVG({ symbol: z.symbol, org: z.org, staerke: z.staerke, breite: 26 })}</span>
       <span class="eintrag-name">${escapeHtml(z.label || basis.name)}</span>
       <button class="augen" data-akt="sichtbar" title="Ein-/ausblenden">${z.sichtbar === false ? '◌' : '◉'}</button>`;
    kopf.querySelector('.eintrag-name').onclick = () => ctx.zl.waehle(gewaehlt ? null : z.id);
    kopf.querySelector('.mini-symbol').onclick = () => ctx.zl.waehle(gewaehlt ? null : z.id);
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
  const kb = Math.round(speicherBelegung() / 1024);
  sp.appendChild(el('p', 'klein',
    `Alle Planungen liegen im <b>Speicher dieses Browsers</b> (localStorage) und werden
     automatisch gesichert. Aktuell belegt: <b>${kb} kB</b>.
     Für Weitergabe und Sicherung „Planung als Datei sichern“ verwenden.`));

  const tasten = el('div', 'tastenreihe');
  tasten.append(
    knopf('Jetzt sichern', () => { store.speichern(); hinweis('Planung gespeichert'); }, 'primaer'),
    knopf('Als Datei sichern', () => io.projektExportieren()),
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
      knopf('Löschen', () => {
        if (!confirm(`„${pr.name}“ endgültig aus dem Browserspeicher löschen?`)) return;
        store.loeschen(pr.id);
        schliesseDialog();
        projektDialog();
        hinweis('Planung gelöscht');
      }, 'gefahr')
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
        <h3>Bauauftrag</h3>
        <p>In der geöffneten Strecke <b>Bauauftrag (PDF)</b> wählen. Dort A4/A3, Hoch/Quer und
           Farbe/Schwarz-Weiß einstellen und über den Druckdialog des Browsers
           <b>„Als PDF speichern“</b> wählen.</p>
        <p>Im Druckdialog dasselbe Papierformat einstellen, das oben gewählt wurde, und
           die Ränder auf „Standard“ oder „Keine“ lassen – das Blatt bringt seine Ränder
           selbst mit. Der vorgeschlagene Dateiname enthält Auftragsnummer, Strecke und Datum.</p>
        <h3>Koordinaten</h3>
        <p>Unten links stehen MGRS und GPS-Koordinaten des Mauszeigers. In der Punkttabelle
           öffnet ein Klick auf die Koordinate alle Formate zum Kopieren und erlaubt die
           Eingabe einer neuen Position.</p>
        <h3>Speichern</h3>
        <p>Alles wird laufend im Browserspeicher gesichert. Für Sicherung und Weitergabe
           <b>Datei → Planung als Datei sichern</b> verwenden.</p>
        <h3>Tastatur</h3>
        <ul class="tasten-liste">
          <li><kbd>S</kbd> neue Strecke · <kbd>T</kbd> taktisches Zeichen · <kbd>K</kbd> Koordinate</li>
          <li><kbd>Strg</kbd>+<kbd>Z</kbd> rückgängig · <kbd>Strg</kbd>+<kbd>Umschalt</kbd>+<kbd>Z</kbd> wiederholen</li>
          <li><kbd>Enter</kbd> Zeichnen beenden · <kbd>Esc</kbd> abbrechen</li>
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
