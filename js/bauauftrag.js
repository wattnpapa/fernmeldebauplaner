// bauauftrag.js – Druckfertiger Bauauftrag je Strecke (A4/A3, Farbe/SW, PDF über Druckdialog)

import { store, punktartById, VERLEGEARTEN } from './state.js';
import { StreckenLayer, kennzahlen, segmentLaengen, kumuliert, escapeHtml } from './strecken.js';
import { ZeichenLayer } from './zeichen.js';
import { setzeBasiskarte, grauVariante, warteAufKacheln, basiskarteById } from './map.js';
import { toMGRS, toDDM, peilung, himmelsrichtung, formatLaenge, meter } from './geo.js';
import {
  querschnittText, stromText, leistungText, prozentText, grenzText, massgebendText, MAX_QUERSCHNITT
} from './strom.js';
import { hinweis } from './ui.js';
import { VERSION } from './version.js';

const FORMATE = { a4: [210, 297], a3: [297, 420] };
const KEY = 'fbp.druck.v1';
const MM_PX = 96 / 25.4;         // CSS-Pixel je Millimeter
const SCHAERFE = 2;              // Karte doppelt rendern und halbieren -> ~192 dpi

const STANDARD = {
  format: 'a4', ausrichtung: 'quer', farbe: 'farbe',
  punkttabelle: true, uebersicht: true, unterschrift: true,
  andereStrecken: true, zeichen: true, zoomVersatz: 0
};

function ladeOptionen() {
  try { return { ...STANDARD, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch (e) { return { ...STANDARD }; }
}
function speicherOptionen(o) {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* egal */ }
}

let aktiv = null;   // {wurzel, karten:[], opt, sid}

export function bauauftragOffen() { return !!aktiv; }

/** Das für den Bauauftrag gesetzte @page-Format wieder aufheben.
 *  Ohne das bliebe z. B. A3 quer für jeden weiteren Druck im selben Tab stehen. */
export function entferneSeitenformat() {
  document.getElementById('druck-seitenformat')?.remove();
}

export function schliesseBauauftrag() {
  if (!aktiv) return;
  aktiv.karten.forEach(k => { try { k.remove(); } catch (e) {} });
  aktiv.wurzel.remove();
  document.body.classList.remove('druckansicht');
  window.removeEventListener('resize', aktiv.anpassen);
  entferneSeitenformat();
  aktiv = null;
}

export function oeffneBauauftrag(sid) {
  schliesseBauauftrag();
  const strecke = store.strecke(sid);
  if (!strecke) return;
  if (strecke.punkte.length < 2) {
    hinweis('Für den Bauauftrag werden mindestens zwei Trassenpunkte gebraucht.', 'warnung');
    return;
  }

  const opt = ladeOptionen();
  const wurzel = document.createElement('div');
  wurzel.id = 'druck';
  wurzel.innerHTML = `
    <div class="druck-steuerung" role="group" aria-label="Druckeinstellungen">
      <div class="ds-titel">Bauauftrag · <b>${escapeHtml(strecke.name)}</b></div>
      <div class="ds-felder"></div>
      <div class="ds-tasten">
        <button class="knopf" data-akt="schliessen">Schließen</button>
        <div class="ds-drucken">
          <button class="knopf primaer" data-akt="drucken" aria-describedby="ds-format">Drucken / Als PDF speichern</button>
          <p class="ds-format" id="ds-format"></p>
        </div>
      </div>
    </div>
    <div class="druck-buehne"><div class="druck-doku"></div></div>`;
  document.body.appendChild(wurzel);
  document.body.classList.add('druckansicht');

  /* Neun gleichrangige Bedienelemente in einer Reihe waren nicht zu überblicken.
     Sie stehen jetzt in drei benannten Gruppen, die sich am Ergebnis orientieren:
     das Papier, was auf dem Kartenblatt liegt, und was das Datenblatt füllt –
     Punkttabelle und Unterschriften sind es auch, die das zweite Blatt erzeugen. */
  const felder = wurzel.querySelector('.ds-felder');
  felder.append(
    gruppe('Papier', [
      auswahl('Format', 'format', [['a4', 'A4'], ['a3', 'A3']], opt, neuAufbau),
      auswahl('Ausrichtung', 'ausrichtung', [['quer', 'Quer'], ['hoch', 'Hoch']], opt, neuAufbau),
      auswahl('Farbe', 'farbe', [['farbe', 'Farbe'], ['sw', 'Schwarz-Weiß']], opt, neuAufbau)
    ]),
    gruppe('Kartenblatt', [
      haken('Übersichtskarte', 'uebersicht', opt, neuAufbau),
      haken('Andere Strecken', 'andereStrecken', opt, neuAufbau),
      haken('Taktische Zeichen', 'zeichen', opt, neuAufbau),
      zoomFeld(opt, neuAufbau)
    ]),
    gruppe('Datenblatt', [
      haken('Punkttabelle', 'punkttabelle', opt, neuAufbau),
      haken('Unterschriften', 'unterschrift', opt, neuAufbau)
    ])
  );

  wurzel.querySelector('[data-akt="schliessen"]').onclick = schliesseBauauftrag;
  const druckKnopf = wurzel.querySelector('[data-akt="drucken"]');
  const formatHinweis = wurzel.querySelector('#ds-format');
  druckKnopf.onclick = () => drucken(strecke, opt);

  aktiv = { wurzel, karten: [], opt, sid, anpassen: () => passeVorschauAn(wurzel, opt) };
  window.addEventListener('resize', aktiv.anpassen);

  function neuAufbau() {
    speicherOptionen(opt);
    formatHinweis.textContent = druckHinweisText(opt);
    aktiv.karten.forEach(k => { try { k.remove(); } catch (e) {} });
    aktiv.karten = [];
    aufbauen(wurzel.querySelector('.druck-doku'), strecke, opt, aktiv.karten, druckKnopf);
    passeVorschauAn(wurzel, opt);
  }
  neuAufbau();
}

// ---------------------------------------------------------------- Bedienelemente

/** Beschriftete Gruppe von Bedienelementen in der Steuerleiste.
 *  Bewusst kein fieldset/legend: die Legende lässt sich in einem Flex-Kasten
 *  nicht zuverlässig neben die Bedienelemente setzen. */
let gruppenZaehler = 0;
function gruppe(titel, teile) {
  const el = document.createElement('div');
  el.className = 'ds-gruppe';
  el.setAttribute('role', 'group');
  const tid = 'ds-gruppe-' + (++gruppenZaehler);
  el.setAttribute('aria-labelledby', tid);
  const t = document.createElement('span');
  t.className = 'ds-gruppen-titel';
  t.id = tid;
  t.textContent = titel;
  el.appendChild(t);
  const box = document.createElement('div');
  box.className = 'ds-gruppen-felder';
  teile.forEach(x => box.appendChild(x));
  el.appendChild(box);
  return el;
}

function auswahl(titel, schluessel, werte, opt, aendern) {
  const el = document.createElement('label');
  el.className = 'ds-feld';
  el.innerHTML = `<span>${titel}</span>`;
  const sel = document.createElement('select');
  werte.forEach(([w, t]) => {
    const o = document.createElement('option');
    o.value = w; o.textContent = t; o.selected = opt[schluessel] === w;
    sel.appendChild(o);
  });
  sel.onchange = () => { opt[schluessel] = sel.value; aendern(); };
  el.appendChild(sel);
  return el;
}

function haken(titel, schluessel, opt, aendern) {
  const el = document.createElement('label');
  el.className = 'ds-feld ds-haken';
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.checked = !!opt[schluessel];
  cb.onchange = () => { opt[schluessel] = cb.checked; aendern(); };
  el.append(cb, Object.assign(document.createElement('span'), { textContent: titel }));
  return el;
}

function zoomFeld(opt, aendern) {
  const el = document.createElement('div');
  el.className = 'ds-feld ds-zoom';
  el.innerHTML = `<span>Ausschnitt</span>`;
  const box = document.createElement('div');
  box.className = 'ds-zoomtasten';
  const minus = Object.assign(document.createElement('button'), { className: 'knopf klein', textContent: '−', title: 'Ausschnitt vergrößern' });
  const plus = Object.assign(document.createElement('button'), { className: 'knopf klein', textContent: '+', title: 'Näher heranzoomen' });
  const anzeige = Object.assign(document.createElement('span'), { className: 'ds-zoomwert' });
  const schreib = () => { anzeige.textContent = opt.zoomVersatz > 0 ? `+${opt.zoomVersatz}` : String(opt.zoomVersatz); };
  minus.onclick = () => { opt.zoomVersatz = Math.max(-4, opt.zoomVersatz - 1); schreib(); aendern(); };
  plus.onclick = () => { opt.zoomVersatz = Math.min(4, opt.zoomVersatz + 1); schreib(); aendern(); };
  schreib();
  box.append(minus, anzeige, plus);
  el.appendChild(box);
  return el;
}

// ---------------------------------------------------------------- Dokument

function seitenmasse(opt) {
  const [b, h] = FORMATE[opt.format] || FORMATE.a4;
  return opt.ausrichtung === 'quer' ? [h, b] : [b, h];
}

function aufbauen(ziel, strecke, opt, karten, druckKnopf) {
  const p = store.projekt;
  const [bmm, hmm] = seitenmasse(opt);
  const sw = opt.farbe === 'sw';
  const k = kennzahlen(strecke);

  ziel.style.setProperty('--seite-b', bmm + 'mm');
  ziel.style.setProperty('--seite-h', hmm + 'mm');
  ziel.className = 'druck-doku ' + opt.format + ' ' + opt.ausrichtung + (sw ? ' sw' : '');
  ziel.innerHTML = '';

  druckKnopf.disabled = true;
  druckKnopf.textContent = 'Karte wird geladen …';

  // ---- Blatt 1: Karte
  const b1 = blatt(ziel, opt);
  b1.innerHTML =
    kopfHTML(p, strecke) +
    stammHTML(p, strecke, k) +
    `<div class="kartenfeld">
       <div class="karten-rahmen">
         <div class="karten-buehne"></div>
         <div class="karten-nord" aria-hidden="true">${nordpfeilSVG()}</div>
         <div class="karten-massstab"><span class="ms-balken"><i></i></span><span class="ms-text">—</span></div>
         ${opt.uebersicht ? '<div class="karten-uebersicht"><div class="uk-buehne"></div><span class="uk-titel">Übersicht</span></div>' : ''}
       </div>
     </div>
     ${legendeHTML(strecke, sw, opt)}
     ${kennzahlenHTML(k, strecke)}` +
    fussHTML(p, opt);

  // ---- Datenblätter: so viele, wie der Inhalt braucht
  if (opt.punkttabelle || opt.unterschrift) datenblaetter(ziel, p, strecke, k, opt);
  blattzahlSchreiben(ziel);

  // ---- Karten scharf rendern
  requestAnimationFrame(() => {
    const buehne = b1.querySelector('.karten-buehne');
    const karte = baueDruckkarte(buehne, strecke, opt, sw, karten);
    const uk = b1.querySelector('.uk-buehne');
    if (uk) baueUebersichtskarte(uk, strecke, opt, sw, karten);

    massstabSchreiben(b1, karte);
    warteAufKacheln(karte).then(() => {
      massstabSchreiben(b1, karte);
      druckKnopf.disabled = false;
      druckKnopf.textContent = 'Drucken / Als PDF speichern';
    });
  });
}

function blatt(ziel, opt) {
  const el = document.createElement('section');
  el.className = 'blatt';
  ziel.appendChild(el);
  return el;
}

function baueDruckkarte(buehne, strecke, opt, sw, karten) {
  // Doppelte Pixelauflösung, per CSS halbiert -> deutlich schärferer Ausdruck
  const bp = buehne.offsetWidth, hp = buehne.offsetHeight;
  const inner = document.createElement('div');
  inner.className = 'karten-inner';
  inner.style.width = (bp * SCHAERFE) + 'px';
  inner.style.height = (hp * SCHAERFE) + 'px';
  inner.style.transform = `scale(${1 / SCHAERFE})`;
  buehne.appendChild(inner);

  const p = store.projekt;
  const karte = L.map(inner, {
    zoomControl: false, attributionControl: false, dragging: false, keyboard: false,
    scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, touchZoom: false,
    zoomSnap: 0.25, fadeAnimation: false, zoomAnimation: false, maxZoom: 19
  });
  karte.createPane('fbp-strecken').style.zIndex = 420;
  karte.createPane('fbp-griffe').style.zIndex = 470;
  const lbl = karte.createPane('fbp-labels');
  lbl.style.zIndex = 620; lbl.style.pointerEvents = 'none';
  karte.createPane('fbp-zeichen').style.zIndex = 640;

  setzeBasiskarte(karte, sw ? grauVariante(p.ansicht.basemap) : p.ansicht.basemap);

  const sl = new StreckenLayer(karte, {
    interaktiv: false, sw, strichFaktor: SCHAERFE,
    hervorheben: strecke.id,
    nurStrecke: opt.andereStrecken ? null : strecke.id
  });
  sl.zeichne({ ...p.optionen, teillaengen: true, gesamtlaenge: false, punktnummern: true });

  if (opt.zeichen) {
    const zl = new ZeichenLayer(karte, { interaktiv: false, sw });
    zl.zeichne(p.optionen);
  }

  const grenzen = L.latLngBounds(strecke.punkte.map(x => [x.lat, x.lng]));
  karte.fitBounds(grenzen, { padding: [50 * SCHAERFE, 50 * SCHAERFE], animate: false });
  if (opt.zoomVersatz) karte.setZoom(karte.getZoom() + opt.zoomVersatz, { animate: false });
  karte.invalidateSize({ animate: false });
  karten.push(karte);
  return karte;
}

function baueUebersichtskarte(buehne, strecke, opt, sw, karten) {
  const p = store.projekt;
  const bp = buehne.offsetWidth, hp = buehne.offsetHeight;
  const inner = document.createElement('div');
  inner.className = 'karten-inner';
  inner.style.width = (bp * SCHAERFE) + 'px';
  inner.style.height = (hp * SCHAERFE) + 'px';
  inner.style.transform = `scale(${1 / SCHAERFE})`;
  buehne.appendChild(inner);

  const karte = L.map(inner, {
    zoomControl: false, attributionControl: false, dragging: false, keyboard: false,
    scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, touchZoom: false,
    fadeAnimation: false, zoomAnimation: false
  });
  karte.createPane('fbp-strecken').style.zIndex = 420;
  karte.createPane('fbp-griffe').style.zIndex = 470;
  const lbl = karte.createPane('fbp-labels'); lbl.style.zIndex = 620; lbl.style.pointerEvents = 'none';
  karte.createPane('fbp-zeichen').style.zIndex = 640;
  setzeBasiskarte(karte, 'topplus_grau');

  const sl = new StreckenLayer(karte, { interaktiv: false, sw, strichFaktor: SCHAERFE, hervorheben: strecke.id });
  sl.zeichne({ teillaengen: false, gesamtlaenge: false, punktnummern: false });

  const alle = p.strecken.flatMap(s => s.punkte.map(x => [x.lat, x.lng]));
  const grenzen = alle.length > 1 ? L.latLngBounds(alle)
    : L.latLngBounds(strecke.punkte.map(x => [x.lat, x.lng]));
  karte.fitBounds(grenzen.pad(0.35), { animate: false, maxZoom: 14 });
  karte.invalidateSize({ animate: false });
  karten.push(karte);
  return karte;
}

// ---------------------------------------------------------------- Seitenumbruch

/* Ein Blatt hat feste Höhe, der Inhalt wird also nicht von selbst umbrochen.
   Die Datenblätter werden deshalb gefüllt, bis kein Platz mehr ist, danach
   beginnt ein neues Blatt – im Querformat passt rund ein Drittel weniger
   darauf als im Hochformat, dort werden es entsprechend mehr Blätter. */
function datenblaetter(ziel, p, strecke, k, opt) {
  let inhalt = null;

  const neuesBlatt = () => {
    const el = blatt(ziel, opt);
    el.innerHTML = kopfHTML(p, strecke) + '<div class="bl-inhalt"></div>' + fussHTML(p, opt);
    inhalt = el.querySelector('.bl-inhalt');
  };
  // scrollHeight meldet nie weniger als clientHeight – die Prüfung ist damit
  // genau dann wahr, wenn nichts über das Blatt hinausragt.
  const passt = () => inhalt.scrollHeight <= inhalt.clientHeight;
  const setze = el => {
    inhalt.appendChild(el);
    if (!passt() && inhalt.children.length > 1) {
      el.remove();
      neuesBlatt();
      inhalt.appendChild(el);
    }
    return el;
  };

  neuesBlatt();

  if (opt.punkttabelle) {
    const zeilen = [...elementAus(`<table><tbody>${punktzeilenHTML(strecke)}</tbody></table>`)
      .querySelectorAll('tr')];
    let abschnitt = setze(elementAus(punkttabelleRahmenHTML(false)));
    let koerper = abschnitt.querySelector('tbody');
    zeilen.forEach(zeile => {
      koerper.appendChild(zeile);
      if (passt() || koerper.children.length === 1) return;
      zeile.remove();
      const fussnote = abschnitt.querySelector('.tab-fussnote');
      if (fussnote) fussnote.remove();          // Fußnote nur unter dem letzten Teil
      neuesBlatt();
      abschnitt = elementAus(punkttabelleRahmenHTML(true));
      inhalt.appendChild(abschnitt);
      koerper = abschnitt.querySelector('tbody');
      koerper.appendChild(zeile);
    });
  }

  setze(elementAus(materialHTML(strecke, k)));
  setze(elementAus(bemerkungHTML(p, strecke)));
  if (opt.unterschrift) setze(elementAus(unterschriftHTML()));
}

function blattzahlSchreiben(ziel) {
  const blaetter = [...ziel.querySelectorAll('.blatt')];
  blaetter.forEach((el, i) => {
    const feld = el.querySelector('.bl-blattnr');
    if (feld) feld.textContent = `${i + 1} von ${blaetter.length}`;
  });
}

function elementAus(html) {
  const vorlage = document.createElement('template');
  vorlage.innerHTML = html.trim();
  return vorlage.content.firstElementChild;
}

// ---------------------------------------------------------------- Bausteine

function kopfHTML(p, s) {
  const k = p.kopf;
  return `<header class="bl-kopf">
    <div class="bl-marke">
      <span class="bl-org">${escapeHtml(k.einheit || 'THW')}</span>
      <span class="bl-doktyp">Bauauftrag Fernmeldebau</span>
    </div>
    <h1 class="bl-titel">${escapeHtml(s.name)}${s.von || s.nach
      ? `<small>${escapeHtml(s.von || '?')} → ${escapeHtml(s.nach || '?')}</small>` : ''}</h1>
    <table class="bl-kennung">
      <tr><th>Auftrag-Nr.</th><td>${escapeHtml(k.auftragNr || '–')}</td></tr>
      <tr><th>Datum</th><td>${datumDE(k.datum)}</td></tr>
      <tr><th>Blatt</th><td class="bl-blattnr">–</td></tr>
    </table>
  </header>`;
}

function stammHTML(p, s, k) {
  const va = VERLEGEARTEN.find(v => v.id === s.verlegeart);
  const zeilen = [
    ['Einsatz / Übung', p.kopf.einsatz],
    ['Ort / Abschnitt', p.kopf.ort],
    ['Auftrag an', s.trupp || 'Fernmeldebautrupp'],
    ['Erstellt von', p.kopf.ersteller],
    ['Leitungsart', k.kabel.name],
    ['Verlegeart', va ? va.name : '–']
  ];
  return `<div class="bl-stamm">${zeilen.map(([t, w]) =>
    `<div class="st-feld"><span class="st-titel">${t}</span><span class="st-wert">${escapeHtml(w || '–')}</span></div>`
  ).join('')}</div>`;
}

function kennzahlenHTML(k, s) {
  const kacheln = [
    ['Trassenlänge', formatLaenge(k.trasse), `${k.abschnitte} Abschnitte`],
    ['Bauzuschlag', `${k.zuschlag} %`, 'Gelände & Reserve'],
    ['Kabelbedarf', formatLaenge(k.bedarf), 'einzuplanen'],
    ['Trommeln', String(k.trommeln), `à ${meter(k.trommellaenge)}`],
    ['Muffen', String(k.muffen), 'Verbindungen'],
    ['Querungen', String(k.querungen), 'zu sichern'],
    ['Richtwert Bauzeit', stundenText(k.bauzeitStunden), `bei ${s.verlegeleistung} m/h`]
  ];
  // Bei Stromleitungen ist der Querschnitt die Zahl, die der Trupp mitnehmen muss
  if (k.strom && k.strom.querschnitt) {
    kacheln.push(['Querschnitt', querschnittText(k.strom.querschnitt),
      `${stromText(k.strom.strom)} · ${k.strom.netz.kurz}`]);
  }
  return `<div class="bl-kennzahlen${kacheln.length > 7 ? ' mit-strom' : ''}">${kacheln.map(([t, w, u]) =>
    `<div class="kz"><span class="kz-titel">${t}</span><span class="kz-wert">${escapeHtml(w)}</span><span class="kz-unter">${escapeHtml(u)}</span></div>`
  ).join('')}</div>`;
}

function legendeHTML(s, sw, opt) {
  const arten = [...new Set(s.punkte.map(p => p.art))];
  const punkte = arten.map(a => {
    const pa = punktartById(a);
    return `<span class="lg-eintrag"><i class="lg-punkt art-${a}" style="--farbe:${sw ? '#000' : s.farbe}">${pa.kurz === '·' ? '' : pa.kurz}</i>${pa.name}</span>`;
  }).join('');
  const linien =
    `<span class="lg-eintrag"><i class="lg-linie voll" style="--farbe:${sw ? '#000' : s.farbe}"></i>Auftragsstrecke</span>` +
    (opt.andereStrecken ? `<span class="lg-eintrag"><i class="lg-linie ander"></i>andere Strecken</span>` : '');
  return `<div class="bl-legende"><span class="lg-titel">Zeichenerklärung</span>${linien}${punkte}
    <span class="lg-eintrag lg-hinweis">Zahlen an der Trasse = Teilstrecken in Metern</span></div>`;
}

function punkttabelleRahmenHTML(fortsetzung) {
  return `<section class="bl-abschnitt">
    <h2>Trassenpunkte${fortsetzung ? ' (Fortsetzung)' : ''}</h2>
    <table class="tab-punkte">
      <thead><tr>
        <th>Nr.</th><th>Art</th><th>Bezeichnung</th><th>MGRS</th>
        <th>GPS (Grad / Dez.-Min.)</th><th>Teilstrecke</th><th>ab Anfang</th><th>Richtung</th><th>Bemerkung</th>
      </tr></thead>
      <tbody></tbody>
    </table>
    <p class="tab-fussnote">Längen sind geodätische Direktstrecken zwischen den Trassenpunkten
      (Luftlinie). Geländeverlauf, Umgehungen und Reserven deckt der Bauzuschlag ab.</p>
  </section>`;
}

function punktzeilenHTML(s) {
  const seg = segmentLaengen(s);
  const kum = kumuliert(s.punkte);
  const zeilen = s.punkte.map((p, i) => {
    const art = punktartById(p.art);
    const teil = i === 0 ? '–' : meter(seg[i - 1]);
    const richt = i === 0 ? '–'
      : `${Math.round(peilung(s.punkte[i - 1], p))}° ${himmelsrichtung(peilung(s.punkte[i - 1], p))}`;
    return `<tr>
      <td class="nr">${i + 1}</td>
      <td>${escapeHtml(art.name)}</td>
      <td>${escapeHtml(p.name || '')}</td>
      <td class="mono">${escapeHtml(toMGRS(p.lat, p.lng, 5))}</td>
      <td class="mono">${escapeHtml(toDDM(p.lat, p.lng))}</td>
      <td class="zahl">${teil}</td>
      <td class="zahl">${meter(kum[i])}</td>
      <td class="zahl">${richt}</td>
      <td>${escapeHtml(p.bemerkung || '')}</td>
    </tr>`;
  }).join('');
  return zeilen;
}

function materialHTML(s, k) {
  const va = VERLEGEARTEN.find(v => v.id === s.verlegeart);
  const zeilen = [
    ['Leitungsart', k.kabel.name],
    ['Verlegeart', va ? va.name : '–'],
    ['Trassenlänge (Summe Teilstrecken)', formatLaenge(k.trasse)],
    ['Bauzuschlag', `${k.zuschlag} %  (${meter(k.bedarf - k.trasse)})`],
    ['<b>Kabelbedarf gesamt</b>', `<b>${formatLaenge(k.bedarf)}</b>`],
    ['Trommellänge', meter(k.trommellaenge)],
    ['<b>Trommeln erforderlich</b>', `<b>${k.trommeln} Stück</b>`],
    ['Muffen / Verbindungsstellen', String(k.muffen)],
    ['Verteiler / Endverzweiger', String(s.punkte.filter(p => p.art === 'verteiler').length)],
    ['Querungen (Straße/Bahn/Gewässer)', String(k.querungen)],
    ['Masten / Hochführungen', String(s.punkte.filter(p => p.art === 'mast').length)],
    ['Richtwert Bauzeit', `${stundenText(k.bauzeitStunden)} bei ${s.verlegeleistung} m/h`]
  ];
  const a = k.strom;
  if (a) {
    zeilen.push(
      ['Netzform', a.netz.name],
      ['Angeschlossene Last', `${leistungText(a.leistung)} · ${stromText(a.strom)}` +
        (a.netz.gleich ? '' : ` (cos φ ${String(a.cosphi).replace('.', ',')})`)],
      a.querschnitt
        ? ['<b>Empfohlener Leiterquerschnitt</b>', `<b>${querschnittText(a.querschnitt)}</b>`]
        : ['<b>Leiterquerschnitt</b>', a.ueberStrom
            ? '<b>Last zu groß – aufteilen</b>'
            : `<b>über ${querschnittText(MAX_QUERSCHNITT)} – Leitung zu lang</b>`],
      ['Spannungsfall über die Leitung',
        `${a.querschnitt ? prozentText(a.spannungsfallProzent) : '–'} (zulässig ${grenzText(a.grenze)})`],
      ['Maßgebend für den Querschnitt', massgebendText(a)]
    );
  }
  return `<section class="bl-abschnitt bl-material">
    <h2>Materialbedarf und Ansatz</h2>
    <table class="tab-material"><tbody>${zeilen.map(([t, w]) =>
      `<tr><th>${t}</th><td>${w}</td></tr>`).join('')}</tbody></table>
    <div class="mat-frei">
      <span class="mf-titel">Zusätzliches Material / Werkzeug</span>
      <div class="mf-linien">${'<span></span>'.repeat(6)}</div>
    </div>
    ${a ? `<p class="tab-fussnote mat-fussnote">Querschnitt als Planungsrichtwert für Kupferleitung
      (drei belastete Adern, frei in Luft) über die Leitungslänge einschließlich Bauzuschlag.
      Aufgerollte Leitungsroller tragen deutlich weniger Strom. Die verbindliche Auslegung
      und die Prüfung der Anlage obliegen einer Elektrofachkraft.</p>` : ''}
  </section>`;
}

function bemerkungHTML(p, s) {
  const text = [s.bemerkung, p.kopf.bemerkung].filter(Boolean).join('\n');
  return `<section class="bl-abschnitt">
    <h2>Auftrag und Bemerkungen</h2>
    <div class="bl-freitext">${text ? escapeHtml(text).replace(/\n/g, '<br>') : ''}</div>
  </section>`;
}

function unterschriftHTML() {
  const felder = [
    'Auftrag erteilt (Führung)', 'Auftrag übernommen (Truppführer)',
    'Bau begonnen', 'Bau beendet, Leitung gemessen'
  ];
  return `<section class="bl-abschnitt bl-unterschrift">
    <h2>Bestätigungen</h2>
    <div class="us-gitter">${felder.map(f => `<div class="us-feld">
      <span class="us-titel">${f}</span>
      <div class="us-zeile"><span>Datum / Uhrzeit</span></div>
      <div class="us-zeile"><span>Name, Unterschrift</span></div>
    </div>`).join('')}</div>
  </section>`;
}

function fussHTML(p, opt) {
  const bk = basiskarteById(p.ansicht.basemap);
  const quelle = opt.farbe === 'sw' ? basiskarteById(grauVariante(p.ansicht.basemap)) : bk;
  return `<footer class="bl-fuss">
    <span>${escapeHtml(p.name)} · erstellt ${new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
      mit FMBauplaner ${VERSION} (fmbauplaner.app)</span>
    <span class="bf-quelle">Kartengrundlage: ${quelle.attribution.replace(/<[^>]+>/g, '')}</span>
  </footer>`;
}

function nordpfeilSVG() {
  return `<svg viewBox="0 0 40 52" width="26" height="34" aria-hidden="true">
    <path d="M20 2 L30 40 L20 32 L10 40 Z" fill="#111" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M20 2 L20 32 L10 40 Z" fill="#fff"/>
    <text x="20" y="51" text-anchor="middle" font-size="13" font-weight="700" font-family="Arial, sans-serif" fill="#111">N</text>
  </svg>`;
}

// ---------------------------------------------------------------- Maßstab

function massstabSchreiben(blattEl, karte) {
  const el = blattEl.querySelector('.karten-massstab');
  if (!el || !karte) return;
  const mitte = karte.getCenter();
  // Meter je dargestelltem CSS-Pixel (Karte wird um 1/SCHAERFE verkleinert)
  const mProKartenPx = 156543.03392 * Math.cos(mitte.lat * Math.PI / 180) / Math.pow(2, karte.getZoom());
  const mProAnzeigePx = mProKartenPx * SCHAERFE;
  const mProMm = mProAnzeigePx * MM_PX;
  const nenner = Math.round(mProMm * 1000);

  // Balken auf eine runde Länge bringen
  const zielMm = 40;
  const rohMeter = mProMm * zielMm;
  const stufe = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]
    .reduce((a, b) => Math.abs(b - rohMeter) < Math.abs(a - rohMeter) ? b : a, 10);
  const balkenMm = stufe / mProMm;

  el.querySelector('.ms-balken i').style.width = balkenMm.toFixed(2) + 'mm';
  el.querySelector('.ms-text').innerHTML =
    `<b>${stufe >= 1000 ? (stufe / 1000).toLocaleString('de-DE') + ' km' : stufe + ' m'}</b>` +
    `<span>Maßstab ca. 1 : ${rundNenner(nenner).toLocaleString('de-DE')}</span>`;
}

function rundNenner(n) {
  if (n < 1000) return Math.round(n / 50) * 50;
  if (n < 10000) return Math.round(n / 250) * 250;
  if (n < 100000) return Math.round(n / 1000) * 1000;
  return Math.round(n / 10000) * 10000;
}

// ---------------------------------------------------------------- Vorschau & Druck

function passeVorschauAn(wurzel, opt) {
  const buehne = wurzel.querySelector('.druck-buehne');
  const doku = wurzel.querySelector('.druck-doku');
  if (!buehne || !doku) return;
  const [bmm] = seitenmasse(opt);
  const breitePx = bmm * MM_PX;
  const platz = buehne.clientWidth - 48;
  const skala = Math.min(1, platz / breitePx);
  doku.style.setProperty('--vorschau-skala', skala.toFixed(4));
}

/* Der Druckdialog des Betriebssystems kennt die hier gewählten Einstellungen
   nicht – er muss sie noch einmal gesagt bekommen. Der Satz dafür steht neben
   dem Druckknopf und nicht in der Kurzanleitung, und er ändert sich mit. */
function druckHinweisText(opt) {
  const format = opt.format === 'a3' ? 'A3' : 'A4';
  const lage = opt.ausrichtung === 'hoch' ? 'Hoch' : 'Quer';
  return `Im Druckdialog: ${format} · ${lage} · Ränder „Keine“`;
}

function drucken(strecke, opt) {
  const [bmm, hmm] = seitenmasse(opt);
  let stil = document.getElementById('druck-seitenformat');
  if (!stil) {
    stil = document.createElement('style');
    stil.id = 'druck-seitenformat';
    document.head.appendChild(stil);
  }
  stil.textContent = `@page { size: ${bmm}mm ${hmm}mm; margin: 0; }`;

  const alterTitel = document.title;
  const p = store.projekt;
  document.title = ['Bauauftrag', p.kopf.auftragNr, strecke.name, p.kopf.datum]
    .filter(Boolean).join('_')
    .replace(/[^\wäöüÄÖÜß.\-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  const zurueck = () => {
    document.title = alterTitel;
    window.removeEventListener('afterprint', zurueck);
  };
  window.addEventListener('afterprint', zurueck);
  setTimeout(() => { window.print(); setTimeout(zurueck, 1500); }, 60);
}

// ---------------------------------------------------------------- Hilfen

function datumDE(iso) {
  if (!iso) return '–';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? escapeHtml(iso) : d.toLocaleDateString('de-DE');
}

function stundenText(h) {
  if (!isFinite(h) || h <= 0) return '–';
  const std = Math.floor(h);
  const min = Math.round((h - std) * 60);
  if (std === 0) return `${min} min`;
  return `${std} h${min ? ' ' + String(min).padStart(2, '0') + ' min' : ''}`;
}
