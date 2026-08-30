// bauauftrag.js – Druckfertiger Bauauftrag: je Strecke und als Sammelauftrag
//                 (A4/A3, Farbe/SW, PDF über den Druckdialog)

import { store, punktartById, VERLEGEARTEN, abschnittById, streckenIm } from './state.js';
import {
  StreckenLayer, kennzahlen, gesamtKennzahlen, segmentLaengen, kumuliert, escapeHtml
} from './strecken.js';
import { ZeichenLayer } from './zeichen.js';
import { setzeBasiskarte, grauVariante, warteAufKacheln, basiskarteById } from './map.js';
import { toMGRS, toDDM, peilung, himmelsrichtung, formatLaenge, meter } from './geo.js';
import {
  querschnittText, stromText, leistungText, prozentText, grenzText, massgebendText, MAX_QUERSCHNITT
} from './strom.js';
import {
  massText, BAUREGELN, SCHUTZABSTAENDE,
  SCHUTZABSTAND_ERWEITERT_MIN, SCHUTZABSTAND_ERWEITERT_STURM
} from './vorschrift.js';
import { hinweis } from './ui.js';
import { VERSION } from './version.js';

const FORMATE = { a4: [210, 297], a3: [297, 420] };
const KEY = 'fbp.druck.v1';
const MM_PX = 96 / 25.4;         // CSS-Pixel je Millimeter
const SCHAERFE = 2;              // Karte doppelt rendern und halbieren -> ~192 dpi

const STANDARD = {
  format: 'a4', ausrichtung: 'quer', farbe: 'farbe',
  punkttabelle: true, uebersicht: true, unterschrift: true,
  /* Gespeicherte Optionen werden über STANDARD gelegt; neue Haken erben so
     ihren Standard, statt bei bisherigen Nutzern als „aus“ zu erscheinen. */
  querungen: true, laengenverbindungen: true,
  andereStrecken: true, zeichen: true, zoomVersatz: 0,
  // nur im Sammeldruck von Belang
  deckblatt: true, verzeichnis: true, einzelblaetter: true
};

function ladeOptionen() {
  try { return { ...STANDARD, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch (e) { return { ...STANDARD }; }
}
function speicherOptionen(o) {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* egal */ }
}

let aktiv = null;   // {wurzel, karten:[], opt, auftrag}

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
  const strecke = store.strecke(sid);
  if (!strecke) return;
  if (strecke.punkte.length < 2) {
    hinweis('Für den Bauauftrag werden mindestens zwei Trassenpunkte gebraucht.', 'warnung');
    return;
  }
  oeffneDruckansicht({ modus: 'einzel', strecken: [strecke], abschnitt: null, umfang: 'strecke' });
}

/**
 * Sammel-Bauauftrag über mehrere Strecken in einem Dokument.
 * `aid` = Einsatzabschnitt, `null` die nicht zugeteilten Strecken,
 * ohne Angabe die ganze Planung.
 */
export function oeffneSammeldruck(aid) {
  const p = store.projekt;
  const ganzeplanung = aid === undefined;
  const ea = ganzeplanung ? null : abschnittById(p, aid);
  if (!ganzeplanung && aid && !ea) return;

  const quelle = ganzeplanung ? p.strecken : streckenIm(p, aid);
  const strecken = sortiertNachAbschnitt(p, quelle.filter(s => s.punkte.length >= 2));
  if (!strecken.length) {
    hinweis(quelle.length
      ? 'Für den Sammelauftrag wird mindestens eine Strecke mit zwei Trassenpunkten gebraucht.'
      : 'In dieser Auswahl liegt noch keine Strecke.', 'warnung');
    return;
  }
  oeffneDruckansicht({
    modus: 'sammel', strecken, abschnitt: ea,
    umfang: ganzeplanung ? 'projekt' : (ea ? 'abschnitt' : 'ohne')
  });
}

/** Reihenfolge des Sammeldrucks: nach Einsatzabschnitten in der Reihenfolge
 *  der Planung, die nicht zugeteilten Strecken zuletzt. */
function sortiertNachAbschnitt(p, strecken) {
  const rang = new Map((p.einsatzabschnitte || []).map((a, i) => [a.id, i]));
  return [...strecken].sort((a, b) => {
    const ra = rang.has(a.abschnitt) ? rang.get(a.abschnitt) : Number.MAX_SAFE_INTEGER;
    const rb = rang.has(b.abschnitt) ? rang.get(b.abschnitt) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return p.strecken.indexOf(a) - p.strecken.indexOf(b);
  });
}

/** Überschrift des ganzen Dokuments – sie steht im Kopf jedes Blattes. */
function auftragTitel(auftrag) {
  if (auftrag.modus === 'einzel') return auftrag.strecken[0].name;
  if (auftrag.umfang === 'abschnitt') return auftrag.abschnitt.name;
  if (auftrag.umfang === 'ohne') return 'Strecken ohne Einsatzabschnitt';
  return store.projekt.name;
}

const streckenzahl = n => `${n} ${n === 1 ? 'Strecke' : 'Strecken'}`;

function doktyp(auftrag) {
  return auftrag.modus === 'sammel' ? 'Sammel-Bauauftrag Fernmeldebau' : 'Bauauftrag Fernmeldebau';
}

// ---------------------------------------------------------------- Druckansicht

function oeffneDruckansicht(auftrag) {
  schliesseBauauftrag();
  const sammel = auftrag.modus === 'sammel';
  const opt = ladeOptionen();
  const titel = auftragTitel(auftrag);

  const wurzel = document.createElement('div');
  wurzel.id = 'druck';
  wurzel.innerHTML = `
    <div class="druck-steuerung" role="group" aria-label="Druckeinstellungen">
      <div class="ds-titel">${sammel ? 'Sammel-Bauauftrag' : 'Bauauftrag'} · <b>${escapeHtml(titel)}</b>${
        sammel ? ` <span class="ds-umfang">${streckenzahl(auftrag.strecken.length)}</span>` : ''}</div>
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
     Sie stehen jetzt in benannten Gruppen, die sich am Ergebnis orientieren:
     im Sammeldruck zuerst, welche Blätter überhaupt entstehen, dann das Papier,
     was auf dem Kartenblatt liegt, und was das Datenblatt füllt – Punkttabelle
     und Unterschriften sind es auch, die das zweite Blatt erzeugen. */
  const felder = wurzel.querySelector('.ds-felder');
  if (sammel) {
    felder.appendChild(gruppe('Blätter', [
      haken('Deckblatt', 'deckblatt', opt, neuAufbau),
      haken('Streckenverzeichnis', 'verzeichnis', opt, neuAufbau),
      haken('Blätter je Strecke', 'einzelblaetter', opt, neuAufbau)
    ]));
  }
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
      haken('Querungstabelle', 'querungen', opt, neuAufbau),
      haken('Längenverbindungen', 'laengenverbindungen', opt, neuAufbau),
      haken('Unterschriften', 'unterschrift', opt, neuAufbau)
    ])
  );

  wurzel.querySelector('[data-akt="schliessen"]').onclick = schliesseBauauftrag;
  const druckKnopf = wurzel.querySelector('[data-akt="drucken"]');
  const formatHinweis = wurzel.querySelector('#ds-format');
  druckKnopf.onclick = () => drucken(auftrag, opt);

  aktiv = { wurzel, karten: [], opt, auftrag, anpassen: () => passeVorschauAn(wurzel, opt) };
  window.addEventListener('resize', aktiv.anpassen);

  if (sammel && auftrag.strecken.length > 8) {
    hinweis(`${streckenzahl(auftrag.strecken.length)} – der Aufbau der Kartenblätter dauert einen Augenblick.`);
  }

  function neuAufbau() {
    speicherOptionen(opt);
    formatHinweis.textContent = druckHinweisText(opt);
    aktiv.karten.forEach(k => { try { k.remove(); } catch (e) {} });
    aktiv.karten = [];
    aufbauen(wurzel.querySelector('.druck-doku'), auftrag, opt, aktiv.karten, druckKnopf);
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

/* Die Karten entstehen erst, wenn die Blätter im Dokument liegen und ihre
   Bühnen vermessen sind. Ein verborgenes Fenster – ein Hintergrundtab, ein
   Fenster im Druckvorgang – liefert aber keine Animationsbilder, und der
   Aufbau bliebe für immer bei „Karte wird geladen …“ stehen. Dort tut es der
   nächste Zeitgeber: das Layout steht zu dem Zeitpunkt ohnehin. */
function nachLayout(fn) {
  if (document.hidden) setTimeout(fn, 0);
  else requestAnimationFrame(fn);
}

function seitenmasse(opt) {
  const [b, h] = FORMATE[opt.format] || FORMATE.a4;
  return opt.ausrichtung === 'quer' ? [h, b] : [b, h];
}

/**
 * Baut das ganze Dokument neu auf. Die Karten entstehen erst danach: sie
 * brauchen die Maße ihrer Bühne, und die stehen erst fest, wenn die Blätter
 * im Dokument liegen.
 */
function aufbauen(ziel, auftrag, opt, karten, druckKnopf) {
  const p = store.projekt;
  const [bmm, hmm] = seitenmasse(opt);
  const sw = opt.farbe === 'sw';
  const sammel = auftrag.modus === 'sammel';
  // Im Sammeldruck meint „andere Strecken“ die übrigen der Sammlung,
  // nicht alles, was sonst noch in der Planung liegt.
  const sammlung = sammel ? auftrag.strecken.map(s => s.id) : null;

  ziel.style.setProperty('--seite-b', bmm + 'mm');
  ziel.style.setProperty('--seite-h', hmm + 'mm');
  ziel.className = 'druck-doku ' + opt.format + ' ' + opt.ausrichtung + (sw ? ' sw' : '');
  ziel.innerHTML = '';

  const kartenbau = [];

  if (sammel) {
    if (opt.deckblatt) deckblatt(ziel, auftrag, opt, sw, karten, kartenbau);
    if (opt.verzeichnis) verzeichnisblaetter(ziel, auftrag, opt);
  }
  if (!sammel || opt.einzelblaetter) {
    for (const s of auftrag.strecken) {
      streckenblaetter(ziel, s, auftrag, opt, sw, sammlung, karten, kartenbau);
    }
  }

  if (!ziel.children.length) {
    ziel.innerHTML = `<p class="druck-leer">Es ist keine Blattart gewählt –
      oben mindestens eine einschalten.</p>`;
    druckKnopf.disabled = true;
    druckKnopf.textContent = 'Drucken / Als PDF speichern';
    return;
  }

  blattzahlSchreiben(ziel);

  const anzahl = kartenbau.length;
  druckKnopf.disabled = true;
  druckKnopf.textContent = anzahl > 1 ? `Karten werden geladen … (0/${anzahl})` : 'Karte wird geladen …';

  nachLayout(() => {
    let fertig = 0;
    const gezaehlt = () => {
      fertig++;
      if (anzahl > 1 && fertig < anzahl) druckKnopf.textContent = `Karten werden geladen … (${fertig}/${anzahl})`;
    };
    Promise.all(kartenbau.map(bau => bau().then(gezaehlt, gezaehlt))).then(() => {
      druckKnopf.disabled = false;
      druckKnopf.textContent = 'Drucken / Als PDF speichern';
    });
  });
}

/** Kartenblatt und Datenblätter einer einzelnen Strecke */
function streckenblaetter(ziel, strecke, auftrag, opt, sw, sammlung, karten, kartenbau) {
  const p = store.projekt;
  const k = kennzahlen(strecke);

  const b1 = blatt(ziel, opt);
  b1.innerHTML =
    streckenKopfHTML(p, strecke) +
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

  if (datenblattNoetig(opt)) datenblaetter(ziel, p, strecke, k, opt);

  kartenbau.push(() => {
    const karte = baueDruckkarte(b1.querySelector('.karten-buehne'), strecke, opt, sw, karten, sammlung);
    const ukBuehne = b1.querySelector('.uk-buehne');
    const uk = ukBuehne ? baueUebersichtskarte(ukBuehne, strecke, opt, sw, karten, sammlung) : null;
    massstabSchreiben(b1, karte);
    return Promise.all([warteAufKacheln(karte), uk ? warteAufKacheln(uk) : null])
      .then(() => massstabSchreiben(b1, karte));
  });
}

/** Deckblatt des Sammelauftrags: eine Karte über alle Strecken der Sammlung
 *  und darunter, was zusammen gebraucht wird. */
function deckblatt(ziel, auftrag, opt, sw, karten, kartenbau) {
  const p = store.projekt;
  const ges = gesamtKennzahlen(auftrag.strecken);

  const el = blatt(ziel, opt);
  el.innerHTML =
    kopfHTML(p, {
      titel: auftragTitel(auftrag),
      unter: streckenzahl(auftrag.strecken.length) +
             (auftrag.umfang === 'projekt' ? ' der Planung' : ''),
      doktyp: doktyp(auftrag)
    }) +
    sammelStammHTML(p, auftrag) +
    `<div class="kartenfeld">
       <div class="karten-rahmen">
         <div class="karten-buehne"></div>
         <div class="karten-nord" aria-hidden="true">${nordpfeilSVG()}</div>
         <div class="karten-massstab"><span class="ms-balken"><i></i></span><span class="ms-text">—</span></div>
       </div>
     </div>
     ${sammelLegendeHTML(auftrag, sw)}
     ${sammelKennzahlenHTML(ges)}` +
    fussHTML(p, opt);

  kartenbau.push(() => {
    const karte = baueSammelkarte(el.querySelector('.karten-buehne'), auftrag, opt, sw, karten);
    massstabSchreiben(el, karte);
    return warteAufKacheln(karte).then(() => massstabSchreiben(el, karte));
  });
}

function blatt(ziel, opt) {
  const el = document.createElement('section');
  el.className = 'blatt';
  ziel.appendChild(el);
  return el;
}

// ---------------------------------------------------------------- Karten

/** Leere Druckkarte in doppelter Pixelauflösung, per CSS halbiert –
 *  das ergibt den deutlich schärferen Ausdruck. */
function neueDruckkarte(buehne, zusatz = {}) {
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
    fadeAnimation: false, zoomAnimation: false, maxZoom: 19, ...zusatz
  });
  karte.createPane('fbp-strecken').style.zIndex = 420;
  karte.createPane('fbp-griffe').style.zIndex = 470;
  const lbl = karte.createPane('fbp-labels');
  lbl.style.zIndex = 620; lbl.style.pointerEvents = 'none';
  karte.createPane('fbp-zeichen').style.zIndex = 640;
  return karte;
}

/* Jede Karte zeigt die Zeichen ihres eigenen Gegenstands: das Streckenblatt
   die des Abschnitts dieser Strecke, das Deckblatt die des gedruckten
   Abschnitts – und dazu jeweils die nicht zugeteilten. Ohne Abschnitt alle. */
function baueDruckkarte(buehne, strecke, opt, sw, karten, sammlung) {
  const p = store.projekt;
  const karte = neueDruckkarte(buehne, { zoomSnap: 0.25 });
  setzeBasiskarte(karte, sw ? grauVariante(p.ansicht.basemap) : p.ansicht.basemap);

  const sl = new StreckenLayer(karte, {
    interaktiv: false, sw, strichFaktor: SCHAERFE,
    hervorheben: strecke.id,
    nurStrecke: opt.andereStrecken ? null : strecke.id,
    nurStrecken: opt.andereStrecken ? sammlung : null
  });
  sl.zeichne({ ...p.optionen, teillaengen: true, gesamtlaenge: false, punktnummern: true });

  if (opt.zeichen) {
    const zl = new ZeichenLayer(karte, {
      interaktiv: false, sw, abschnittSchaltet: false,
      nurAbschnitt: strecke.abschnitt || undefined
    });
    zl.zeichne(p.optionen);
  }

  const grenzen = L.latLngBounds(strecke.punkte.map(x => [x.lat, x.lng]));
  karte.fitBounds(grenzen, { padding: [50 * SCHAERFE, 50 * SCHAERFE], animate: false });
  if (opt.zoomVersatz) karte.setZoom(karte.getZoom() + opt.zoomVersatz, { animate: false });
  karte.invalidateSize({ animate: false });
  karten.push(karte);
  return karte;
}

/** Übersichtskarte des Deckblatts: alle Strecken der Sammlung gleichrangig,
 *  jede mit ihrem Namen und ihrer Länge beschriftet. */
function baueSammelkarte(buehne, auftrag, opt, sw, karten) {
  const p = store.projekt;
  const karte = neueDruckkarte(buehne, { zoomSnap: 0.25 });
  setzeBasiskarte(karte, sw ? grauVariante(p.ansicht.basemap) : p.ansicht.basemap);

  const sl = new StreckenLayer(karte, {
    interaktiv: false, sw, strichFaktor: SCHAERFE,
    nurStrecken: auftrag.strecken.map(s => s.id)
  });
  /* Teillängen und Punktnummern aller Strecken übereinander wären auf einem
     Blatt nicht mehr zu lesen – auf dem Deckblatt zählt, welche Strecke wo
     liegt und wie lang sie ist. */
  sl.zeichne({ teillaengen: false, gesamtlaenge: true, punktnummern: false });

  if (opt.zeichen) {
    const zl = new ZeichenLayer(karte, {
      interaktiv: false, sw, abschnittSchaltet: false,
      nurAbschnitt: auftrag.abschnitt ? auftrag.abschnitt.id : undefined
    });
    zl.zeichne(p.optionen);
  }

  const alle = auftrag.strecken.flatMap(s => s.punkte.map(x => [x.lat, x.lng]));
  karte.fitBounds(L.latLngBounds(alle), { padding: [55 * SCHAERFE, 55 * SCHAERFE], animate: false });
  if (opt.zoomVersatz) karte.setZoom(karte.getZoom() + opt.zoomVersatz, { animate: false });
  karte.invalidateSize({ animate: false });
  karten.push(karte);
  return karte;
}

function baueUebersichtskarte(buehne, strecke, opt, sw, karten, sammlung) {
  const p = store.projekt;
  const karte = neueDruckkarte(buehne);
  setzeBasiskarte(karte, 'topplus_grau');

  const sl = new StreckenLayer(karte, {
    interaktiv: false, sw, strichFaktor: SCHAERFE,
    hervorheben: strecke.id, nurStrecken: sammlung
  });
  sl.zeichne({ teillaengen: false, gesamtlaenge: false, punktnummern: false });

  const umfeld = sammlung ? p.strecken.filter(s => sammlung.includes(s.id)) : p.strecken;
  const alle = umfeld.flatMap(s => s.punkte.map(x => [x.lat, x.lng]));
  const grenzen = alle.length > 1 ? L.latLngBounds(alle)
    : L.latLngBounds(strecke.punkte.map(x => [x.lat, x.lng]));
  karte.fitBounds(grenzen.pad(0.35), { animate: false, maxZoom: 14 });
  karte.invalidateSize({ animate: false });
  karten.push(karte);
  return karte;
}

// ---------------------------------------------------------------- Seitenumbruch

/* Ein Blatt hat feste Höhe, der Inhalt wird also nicht von selbst umbrochen.
   Die Folgeblätter werden deshalb gefüllt, bis kein Platz mehr ist, danach
   beginnt ein neues Blatt – im Querformat passt rund ein Drittel weniger
   darauf als im Hochformat, dort werden es entsprechend mehr Blätter. */
function blattfluss(ziel, opt, kopf, fuss) {
  let inhalt = null;

  const neuBlatt = () => {
    const el = blatt(ziel, opt);
    el.innerHTML = kopf + '<div class="bl-inhalt"></div>' + fuss;
    inhalt = el.querySelector('.bl-inhalt');
  };
  // scrollHeight meldet nie weniger als clientHeight – die Prüfung ist damit
  // genau dann wahr, wenn nichts über das Blatt hinausragt.
  const passt = () => inhalt.scrollHeight <= inhalt.clientHeight;

  const setze = el => {
    inhalt.appendChild(el);
    if (!passt() && inhalt.children.length > 1) {
      el.remove();
      neuBlatt();
      inhalt.appendChild(el);
    }
    return el;
  };

  neuBlatt();
  return { setze, neuBlatt, passt, anhaengen: el => (inhalt.appendChild(el), el) };
}

/**
 * Eine Tabelle Zeile für Zeile über so viele Blätter verteilen, wie sie
 * braucht. `rahmen(fortsetzung)` liefert den leeren Tabellenkopf.
 * Eine Gruppenüberschrift wandert mit ihrer ersten Zeile aufs nächste Blatt
 * mit – allein am Blattende stünde sie über nichts.
 */
function tabelleFliessen(fluss, rahmen, zeilenHTML) {
  const zeilen = [...elementAus(`<table><tbody>${zeilenHTML}</tbody></table>`).querySelectorAll('tr')];
  let abschnitt = fluss.setze(elementAus(rahmen(false)));
  let koerper = abschnitt.querySelector('tbody');

  zeilen.forEach(zeile => {
    koerper.appendChild(zeile);
    if (fluss.passt() || koerper.children.length === 1) return;
    zeile.remove();
    const davor = koerper.lastElementChild;
    const mitnehmen = davor && davor.classList.contains('gruppenzeile') ? davor : null;
    if (mitnehmen) mitnehmen.remove();
    abschnitt.querySelector('.tab-fussnote')?.remove();   // Fußnote nur unter dem letzten Teil
    fluss.neuBlatt();
    abschnitt = fluss.anhaengen(elementAus(rahmen(true)));
    koerper = abschnitt.querySelector('tbody');
    if (mitnehmen) koerper.appendChild(mitnehmen);
    koerper.appendChild(zeile);
  });
}

/* Materialbedarf, Hinweise und Bemerkungen hängen an den Datenblättern. Ist
   keine ihrer Tabellen gewählt, entsteht auch kein Datenblatt. */
function datenblattNoetig(opt) {
  return !!(opt.punkttabelle || opt.querungen || opt.laengenverbindungen || opt.unterschrift);
}

function datenblaetter(ziel, p, strecke, k, opt) {
  const fluss = blattfluss(ziel, opt, streckenKopfHTML(p, strecke), fussHTML(p, opt));

  if (opt.punkttabelle) tabelleFliessen(fluss, punkttabelleRahmenHTML, punktzeilenHTML(strecke));
  if (opt.querungen && k.querungsliste.length) {
    tabelleFliessen(fluss, querungenRahmenHTML(k), querungszeilenHTML(k));
  }
  if (opt.laengenverbindungen && k.laengenverbindungen.length) {
    tabelleFliessen(fluss, laengenverbindungenRahmenHTML(k), laengenverbindungszeilenHTML(k));
  }

  fluss.setze(elementAus(materialHTML(strecke, k)));
  fluss.setze(elementAus(regelnHTML(k)));
  fluss.setze(elementAus(bemerkungHTML(p, strecke)));
  if (opt.unterschrift) fluss.setze(elementAus(unterschriftHTML(p)));
}

/** Streckenverzeichnis des Sammelauftrags: eine Zeile je Strecke, darunter
 *  der Materialbedarf nach Leitungsarten. */
function verzeichnisblaetter(ziel, auftrag, opt) {
  const p = store.projekt;
  const ges = gesamtKennzahlen(auftrag.strecken);
  const kopf = kopfHTML(p, {
    titel: auftragTitel(auftrag), unter: 'Streckenverzeichnis', doktyp: doktyp(auftrag)
  });
  const fluss = blattfluss(ziel, opt, kopf, fussHTML(p, opt));

  tabelleFliessen(fluss, verzeichnisRahmenHTML, verzeichnisZeilenHTML(auftrag, ges));
  fluss.setze(elementAus(materialGesamtHTML(ges)));
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

function kopfHTML(p, { titel, unter = '', doktyp: typ }) {
  const k = p.kopf;
  /* Die Einstufung gehört auf jedes Blatt und über alles andere – ein
     eingestuftes Blatt muss sich auch einzeln erkennen lassen. */
  const einstufung = (k.vsgrad || '').trim();
  return `${einstufung ? `<p class="bl-einstufung">${escapeHtml(einstufung)}</p>` : ''}
  <header class="bl-kopf">
    <div class="bl-marke">
      <span class="bl-org">${escapeHtml(k.einheit || 'THW')}</span>
      <span class="bl-doktyp">${escapeHtml(typ)}</span>
    </div>
    <h1 class="bl-titel">${escapeHtml(titel)}${unter ? `<small>${escapeHtml(unter)}</small>` : ''}</h1>
    <table class="bl-kennung">
      <tr><th>Auftrag-Nr.</th><td>${escapeHtml(k.auftragNr || '–')}</td></tr>
      <tr><th>Datum</th><td>${datumDE(k.datum)}</td></tr>
      <tr><th>Stand</th><td class="mono">${escapeHtml(k.stand || '–')}</td></tr>
      <tr><th>Blatt</th><td class="bl-blattnr">–</td></tr>
    </table>
  </header>`;
}

function streckenKopfHTML(p, s) {
  return kopfHTML(p, {
    titel: s.name,
    unter: (s.von || s.nach) ? `${s.von || '?'} → ${s.nach || '?'}` : '',
    doktyp: 'Bauauftrag Fernmeldebau'
  });
}

function stammFelderHTML(zeilen) {
  return `<div class="bl-stamm">${zeilen.map(([t, w]) =>
    `<div class="st-feld"><span class="st-titel">${escapeHtml(t)}</span><span class="st-wert">${escapeHtml(w || '–')}</span></div>`
  ).join('')}</div>`;
}

function stammHTML(p, s, k) {
  const va = VERLEGEARTEN.find(v => v.id === s.verlegeart);
  const ea = abschnittById(p, s.abschnitt);
  return stammFelderHTML([
    ['Einsatz / Übung', p.kopf.einsatz],
    ['Ort / Abschnitt', p.kopf.ort],
    ...(ea ? [['Einsatzabschnitt', ea.leiter ? `${ea.name} (${ea.leiter})` : ea.name]] : []),
    ['Auftrag an', s.trupp || 'Fernmeldebautrupp'],
    ['Erstellt von', p.kopf.ersteller],
    ['Leitungsart', k.kabel.name],
    ['Verlegeart', va ? va.name : '–']
  ]);
}

function sammelStammHTML(p, auftrag) {
  const ea = auftrag.abschnitt;
  return stammFelderHTML([
    ['Einsatz / Übung', p.kopf.einsatz],
    ['Ort / Abschnitt', p.kopf.ort],
    ['Planung', p.name],
    ...(ea
      ? [['Einsatzabschnitt', ea.name], ['Leitung Einsatzabschnitt', ea.leiter]]
      : [['Umfang', auftrag.umfang === 'ohne'
          ? 'Strecken ohne Einsatzabschnitt' : 'alle Strecken der Planung']]),
    ['Erstellt von', p.kopf.ersteller]
  ]);
}

/** Trommel- und Transportgewichte, kaufmännisch auf halbe Kilogramm gerundet */
function gewichtText(kg) {
  const gerundet = Math.round(kg * 2) / 2;
  return `${String(gerundet).replace('.', ',')} kg`;
}

function kennzahlenHTML(k, s) {
  const kacheln = [
    ['Trassenlänge', formatLaenge(k.trasse), `${k.abschnitte} Abschnitte`],
    ['Bauzuschlag', `${k.zuschlag} %`, 'Gelände & Reserve'],
    ['Kabelbedarf', formatLaenge(k.bedarf), 'einzuplanen'],
    ['Trommeln', String(k.trommeln), k.transportgewicht
      ? `à ${meter(k.trommellaenge)} · ${gewichtText(k.transportgewicht)}`
      : `à ${meter(k.trommellaenge)}`],
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

/** Zeichenerklärung des Deckblatts. In Farbe trägt die Linienfarbe die
 *  Zuordnung; im Schwarz-Weiß-Druck und bei vielen Strecken tut das allein
 *  die Beschriftung an der Strecke. */
function sammelLegendeHTML(auftrag, sw) {
  const zeigbar = !sw && auftrag.strecken.length <= 12;
  const eintraege = zeigbar
    ? auftrag.strecken.map(s =>
        `<span class="lg-eintrag"><i class="lg-linie voll" style="--farbe:${s.farbe}"></i>${escapeHtml(s.name)}</span>`).join('')
    : '';
  return `<div class="bl-legende"><span class="lg-titel">Zeichenerklärung</span>${eintraege}
    <span class="lg-eintrag lg-hinweis">Bezeichnung und Trassenlänge stehen an jeder Strecke</span></div>`;
}

function sammelKennzahlenHTML(ges) {
  const kacheln = [
    ['Strecken', String(ges.anzahl), `${ges.punkte} Trassenpunkte`],
    ['Trassenlänge', formatLaenge(ges.trasse), 'Summe aller Strecken'],
    ['Kabelbedarf', formatLaenge(ges.bedarf), 'mit Bauzuschlag'],
    ['Trommeln', String(ges.trommeln), ges.gewicht
      ? gewichtText(ges.gewicht) + (ges.gewichtVollstaendig ? '' : ' (soweit bekannt)')
      : 'je Strecke aufgerundet'],
    ['Muffen', String(ges.muffen), 'Verbindungen'],
    ['Querungen', String(ges.querungen), 'zu sichern'],
    ['Richtwert Bauzeit', stundenText(ges.bauzeitStunden), 'Summe, ohne Parallelbau']
  ];
  return `<div class="bl-kennzahlen">${kacheln.map(([t, w, u]) =>
    `<div class="kz"><span class="kz-titel">${t}</span><span class="kz-wert">${escapeHtml(w)}</span><span class="kz-unter">${escapeHtml(u)}</span></div>`
  ).join('')}</div>`;
}

// ---------------------------------------------------------------- Streckenverzeichnis

function verzeichnisRahmenHTML(fortsetzung) {
  return `<section class="bl-abschnitt">
    <h2>Streckenverzeichnis${fortsetzung ? ' (Fortsetzung)' : ''}</h2>
    <table class="tab-punkte tab-verzeichnis">
      <thead><tr>
        <th>Nr.</th><th>Strecke</th><th>von → nach</th><th>Leitungsart</th><th>Trupp</th>
        <th>Trasse</th><th>Bedarf</th><th>Trommeln</th><th>Bauzeit</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  </section>`;
}

function verzeichnisZeilenHTML(auftrag, ges) {
  const p = store.projekt;
  /* Nur die planungsweite Sammlung wird nach Abschnitten gegliedert – bei
     einem einzelnen Abschnitt stünde über jeder Zeile derselbe Name. */
  const gliedern = auftrag.umfang === 'projekt' && (p.einsatzabschnitte || []).length > 0;
  const zeilen = [];
  let letzte;
  let nr = 0;

  for (const s of auftrag.strecken) {
    const aid = s.abschnitt || null;
    if (gliedern && aid !== letzte) {
      letzte = aid;
      const ea = abschnittById(p, aid);
      const teil = gesamtKennzahlen(auftrag.strecken.filter(x => (x.abschnitt || null) === aid));
      zeilen.push(`<tr class="vz-gruppe gruppenzeile"><td colspan="9">
        <b>${escapeHtml(ea ? ea.name : 'Ohne Einsatzabschnitt')}</b>${
          ea && ea.leiter ? ' · ' + escapeHtml(ea.leiter) : ''}
        <span class="vz-teilsumme">${streckenzahl(teil.anzahl)} ·
          Trasse ${formatLaenge(teil.trasse)} · Bedarf ${formatLaenge(teil.bedarf)} ·
          ${teil.trommeln} ${teil.trommeln === 1 ? 'Trommel' : 'Trommeln'}</span>
      </td></tr>`);
    }
    const k = kennzahlen(s);
    zeilen.push(`<tr>
      <td class="nr">${++nr}</td>
      <td class="vz-name"><i class="vz-farbe" style="--farbe:${s.farbe}"></i>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.von || s.nach ? `${s.von || '?'} → ${s.nach || '?'}` : '')}</td>
      <td>${escapeHtml(k.kabel.kurz)}${k.strom && k.strom.querschnitt
        ? ' · ' + escapeHtml(querschnittText(k.strom.querschnitt)) : ''}</td>
      <td>${escapeHtml(s.trupp || '')}</td>
      <td class="zahl">${formatLaenge(k.trasse)}</td>
      <td class="zahl">${formatLaenge(k.bedarf)}</td>
      <td class="zahl">${k.trommeln}</td>
      <td class="zahl">${stundenText(k.bauzeitStunden)}</td>
    </tr>`);
  }

  zeilen.push(`<tr class="vz-summe">
    <td></td><td colspan="4"><b>Summe</b> · ${streckenzahl(ges.anzahl)}</td>
    <td class="zahl"><b>${formatLaenge(ges.trasse)}</b></td>
    <td class="zahl"><b>${formatLaenge(ges.bedarf)}</b></td>
    <td class="zahl"><b>${ges.trommeln}</b></td>
    <td class="zahl"><b>${stundenText(ges.bauzeitStunden)}</b></td>
  </tr>`);
  return zeilen.join('');
}

/** Was für die Sammlung insgesamt bereitzustellen ist – nach Leitungsart,
 *  denn danach wird ausgegeben, nicht nach Strecken. */
function materialGesamtHTML(ges) {
  const zeilen = ges.nachKabel.map(e => `<tr>
    <td>${escapeHtml(e.kabel.name)}</td>
    <td class="zahl">${e.strecken}</td>
    <td class="zahl">${formatLaenge(e.bedarf)}</td>
    <td class="zahl">${e.trommeln}</td>
    <td class="zahl">${e.gewicht ? gewichtText(e.gewicht) : '–'}</td>
  </tr>`).join('');

  return `<section class="bl-abschnitt">
    <h2>Materialbedarf gesamt</h2>
    <table class="tab-punkte tab-gesamt">
      <thead><tr>
        <th>Leitungsart</th><th>Strecken</th><th>Kabelbedarf</th><th>Trommeln</th><th>Transportgewicht</th>
      </tr></thead>
      <tbody>${zeilen}</tbody>
      <tfoot><tr class="vz-summe">
        <td><b>Zusammen</b></td>
        <td class="zahl"><b>${ges.anzahl}</b></td>
        <td class="zahl"><b>${formatLaenge(ges.bedarf)}</b></td>
        <td class="zahl"><b>${ges.trommeln}</b></td>
        <td class="zahl"><b>${ges.gewicht ? gewichtText(ges.gewicht) : '–'}</b></td>
      </tr></tfoot>
    </table>
    <p class="tab-fussnote">Die Trommelzahl ist je Strecke aufgerundet: eine angebrochene
      Trommel bleibt bei ihrer Strecke.${ges.gewichtVollstaendig ? ''
        : ' Ein Transportgewicht steht nur bei den Leitungsarten, für die es hinterlegt ist.'}</p>
  </section>`;
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

// ---------------------------------------------------------------- Querungen

/* Die Staffel steht nur dort, wo sie gebraucht wird: bei Freileitungen über
   1 kV und bei Fahrleitungen, die wie eine solche Anlage zu behandeln sind. */
const SCHUTZABSTAND_ARTEN = ['starkstrom_hoch', 'fahrleitung'];

function schutzabstandZeileHTML(k) {
  if (!k.querungsliste.some(q => SCHUTZABSTAND_ARTEN.includes(q.art.id))) return '';
  const staffel = SCHUTZABSTAENDE.map(s => `${s.kv} kV ${s.meter} m`).join(' · ');
  return `<p class="tab-fussnote q-schutzabstaende">Schutzabstände: ${staffel}.
    Erweiterter Schutzabstand = Höhe Strommast + Höhe Baustange + Schutzabstand,
    mindestens ${SCHUTZABSTAND_ERWEITERT_MIN} m, bei Sturm oder hügeligem Gelände
    ${SCHUTZABSTAND_ERWEITERT_STURM} m (KatS-Dv 861, 8.3).</p>`;
}

/** Tabellenrahmen der Querungen; die Staffel steht nur unter dem letzten Teil. */
function querungenRahmenHTML(k) {
  return fortsetzung => `<section class="bl-abschnitt bl-querungen">
    <h2>Querungen und Kreuzungen${fortsetzung ? ' (Fortsetzung)' : ''}</h2>
    <table class="tab-punkte tab-querungen">
      <thead><tr>
        <th>Nr.</th><th>Punkt</th><th>Bezeichnung</th><th>Art der Querung</th>
        <th>Mindestmaß</th><th>MGRS</th><th>ab Anfang</th><th>Auflage</th>
      </tr></thead>
      <tbody></tbody>
    </table>
    ${schutzabstandZeileHTML(k)}
  </section>`;
}

function querungszeilenHTML(k) {
  return k.querungsliste.map(q => {
    const a = q.art;
    return `<tr>
      <td class="nr">${q.nr}</td>
      <td class="nr">${q.punktNr}</td>
      <td>${escapeHtml(q.name)}</td>
      <td>${escapeHtml(a.name)}</td>
      <td>${escapeHtml(massText(a))}</td>
      <td class="mono">${escapeHtml(toMGRS(q.lat, q.lng, 5))}</td>
      <td class="zahl">${meter(q.abAnfang)}</td>
      <td class="q-auflage">${a.verbot
        ? '<b class="q-verbot">Überbauen/Kreuzen nur an Über- oder Unterführung.</b> ' : ''
        }${escapeHtml(a.regel)}${a.genehmigung
        ? ` <b class="q-genehmigung">Genehmigung: ${escapeHtml(a.genehmigung)}</b>` : ''
        }<span class="q-fundstelle">KatS-Dv 861, ${escapeHtml(a.fundstelle)}</span></td>
    </tr>`;
  }).join('');
}

// ---------------------------------------------------------------- Längenverbindungen

function laengenverbindungenRahmenHTML(k) {
  return fortsetzung => `<section class="bl-abschnitt bl-laengen">
    <h2>Längenverbindungen${fortsetzung ? ' (Fortsetzung)' : ''}</h2>
    <table class="tab-punkte tab-laengen">
      <thead><tr>
        <th>Nr.</th><th>Art</th><th>ab Anfang (Trasse)</th><th>Kabel ab Anfang</th>
        <th>MGRS</th><th>Lage</th>
      </tr></thead>
      <tbody></tbody>
    </table>
    <p class="tab-fussnote">Rechnerische Längenverbindungen ergeben sich aus der Trommellänge
      von ${meter(k.trommellaenge)} einschließlich Bauzuschlag; die tatsächliche Lage verschiebt
      sich mit dem Gelände. Baumeldung nach jeder Länge, spätestens alle 30 Minuten
      (KatS-Dv 861, 7.1).</p>
  </section>`;
}

function laengenverbindungszeilenHTML(k) {
  return k.laengenverbindungen.map(v => `<tr>
    <td class="nr">${v.nr}</td>
    <td>${v.quelle === 'geplant' ? 'geplante Muffe' : 'rechnerisch'}</td>
    <td class="zahl">${meter(v.abAnfang)}</td>
    <td class="zahl">${v.kabelAbAnfang ? meter(v.kabelAbAnfang) : '–'}</td>
    <td class="mono">${escapeHtml(toMGRS(v.lat, v.lng, 5))}</td>
    <td>${escapeHtml(v.name ? `${v.name} (${v.lage})` : v.lage)}</td>
  </tr>`).join('');
}

// ---------------------------------------------------------------- Material

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
    ...(k.transportgewicht
      ? [['Transportgewicht (mit Trommeln)', `${gewichtText(k.transportgewicht)}  (${gewichtText(k.trommelgewicht)} je Trommel)`]]
      : []),
    ['Muffen / Verbindungsstellen', String(k.muffen)],
    ['Verteiler / Endverzweiger', String(s.punkte.filter(p => p.art === 'verteiler').length)],
    ['Querungen (Straße/Bahn/Gewässer)', String(k.querungen)],
    ...(k.querungenGenehmigung
      ? [['davon genehmigungspflichtig', String(k.querungenGenehmigung)]]
      : []),
    ['Längenverbindungen (geplant / rechnerisch)',
      `${k.laengenverbindungen.filter(v => v.quelle === 'geplant').length} / ` +
      `${k.laengenverbindungen.filter(v => v.quelle === 'rechnerisch').length}`],
    ['Auflagen mindestens', `${k.abbinden.auflagen} Stück`],
    ['Abbunde längstens', `${k.abbinden.abbunde} Stück`],
    ['Kabelreserve Anfangs-/Endstelle', 'je 20 bis 30 m (6.5.1)'],
    ...(k.reichweite ? [reichweiteZeile(k.reichweite)] : []),
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
    <p class="tab-fussnote">Auflagen und Abbunde nach der Kabellänge: mindestens alle 50 m
      auflegen, längstens alle 150 m abbinden (KatS-Dv 861, 7.3).</p>
    ${a ? `<p class="tab-fussnote mat-fussnote">Querschnitt als Planungsrichtwert für Kupferleitung
      (drei belastete Adern, frei in Luft) über die Leitungslänge einschließlich Bauzuschlag.
      Aufgerollte Leitungsroller tragen deutlich weniger Strom. Die verbindliche Auslegung
      und die Prüfung der Anlage obliegen einer Elektrofachkraft.</p>` : ''}
  </section>`;
}

/* Die Reichweite ist ein Befund, keine Bestellmenge: die Spanne der Vorschrift
   steht neben der gebauten Länge, damit der Trupp beides vergleichen kann. */
function reichweiteZeile(r) {
  const km = m => (m / 1000).toLocaleString('de-DE');
  const befund = r.stufe === 'darueber' ? 'Kabellänge über der Reichweite'
    : (r.stufe === 'grenze' ? 'Kabellänge im oberen Bereich' : 'Kabellänge innerhalb der Reichweite');
  const text = `etwa ${km(r.min)}–${km(r.max)} km · ${befund}` +
    (r.gemischt ? ' (gemischter Bau, Tiefbau angesetzt)' : '') +
    ` (KatS-Dv 861, ${r.fundstelle})`;
  return [`Sprechreichweite ${escapeHtml(r.bauart)}`,
    r.stufe === 'darueber' ? `<b class="mat-warnung">${text}</b>` : text];
}

// ---------------------------------------------------------------- Hinweise

/** Merksätze der Vorschrift, jeder mit seiner Fundstelle. Ohne Querung auf der
 *  Strecke entfällt die Warnposten-Regel – sie hätte dort keinen Anlass. */
function regelnHTML(k) {
  const regeln = BAUREGELN.filter(r => k.querungen > 0 || !r.text.startsWith('Warnposten'));
  return `<section class="bl-abschnitt bl-regeln">
    <h2>Hinweise nach KatS-Dv 861</h2>
    <ul class="rg-liste">${regeln.map(r =>
      `<li>${escapeHtml(r.text)}<span class="rg-fundstelle">${escapeHtml(r.fundstelle)}</span></li>`
    ).join('')}</ul>
  </section>`;
}

function bemerkungHTML(p, s) {
  const text = [s.bemerkung, p.kopf.bemerkung].filter(Boolean).join('\n');
  return `<section class="bl-abschnitt">
    <h2>Auftrag und Bemerkungen</h2>
    <div class="bl-freitext">${text ? escapeHtml(text).replace(/\n/g, '<br>') : ''}</div>
  </section>`;
}

function unterschriftHTML(p) {
  const felder = [
    'Auftrag erteilt (Führung)', 'Auftrag übernommen (Truppführer)',
    'Bau begonnen', 'Bau beendet, Leitung gemessen'
  ];
  // „Für die Richtigkeit“ zeichnet, wer die Ausfertigung verantwortet – der
  // Name steht im Kopf, die Unterschrift gehört unter die Bestätigungen.
  const fdr = (p.kopf.fdr || '').trim();
  return `<section class="bl-abschnitt bl-unterschrift">
    <h2>Bestätigungen</h2>
    <div class="us-gitter">${felder.map(f => `<div class="us-feld">
      <span class="us-titel">${f}</span>
      <div class="us-zeile"><span>Datum / Uhrzeit</span></div>
      <div class="us-zeile"><span>Name, Unterschrift</span></div>
    </div>`).join('')}</div>
    ${fdr ? `<div class="us-fdr">
      <span class="us-titel">F.d.R. ${escapeHtml(fdr)}</span>
      <div class="us-zeile"><span>Unterschrift</span></div>
    </div>` : ''}
  </section>`;
}

// Kartenhinweis fürs Papier: Verweise sind im Ausdruck nutzlos, also fallen die
// Marken weg. So lange ersetzen, bis nichts mehr wegfällt – ein einzelner
// Durchlauf kann aus ineinandergeschobenen Marken eine neue entstehen lassen –
// und das Ergebnis maskieren, damit Reste keine Marke mehr ergeben.
function ohneMarken(html) {
  let text = String(html ?? ''), vorher;
  do { vorher = text; text = text.replace(/<[^>]*>/g, ''); } while (text !== vorher);
  return escapeHtml(text);
}

function fussHTML(p, opt) {
  const bk = basiskarteById(p.ansicht.basemap);
  const quelle = opt.farbe === 'sw' ? basiskarteById(grauVariante(p.ansicht.basemap)) : bk;
  return `<footer class="bl-fuss">
    <span>${escapeHtml(p.name)} · erstellt ${new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
      mit FMBauplaner ${VERSION} (fmbauplaner.app)</span>
    <span class="bf-quelle">Kartengrundlage: ${ohneMarken(quelle.attribution)}</span>
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

function drucken(auftrag, opt) {
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
  document.title = [auftrag.modus === 'sammel' ? 'Sammel-Bauauftrag' : 'Bauauftrag',
    p.kopf.auftragNr, auftragTitel(auftrag), p.kopf.datum]
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
