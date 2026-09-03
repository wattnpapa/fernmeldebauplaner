// bauauftrag.js – Druckfertige Erzeugnisse: der Bauauftrag je Strecke und als
//                 Sammelauftrag (A4/A3) und die Lagekarte der Führungsstelle
//                 (bis A0 und in freiem Maß)

import { store, punktartById, kabelById, VERLEGEARTEN, abschnittById, streckenIm } from './state.js';
import {
  StreckenLayer, kennzahlen, gesamtKennzahlen, segmentLaengen, kumuliert, escapeHtml, kabelzeichen
} from './strecken.js';
import { ZeichenLayer, gezeichneteZeichen } from './zeichen.js';
import { GitterLayer } from './gitter.js';
import { setzeBasiskarte, grauVariante, warteAufKacheln, basiskarteById, MAX_ZOOM } from './map.js';
import { toMGRS, toDDM, peilung, himmelsrichtung, formatLaenge, meter } from './geo.js';
import { HOEHEN_QUELLE } from './hoehe.js';
import {
  querschnittText, stromText, leistungText, prozentText, grenzText, massgebendText, MAX_QUERSCHNITT
} from './strom.js';
import {
  massText, BAUREGELN, SCHUTZABSTAENDE,
  SCHUTZABSTAND_ERWEITERT_MIN, SCHUTZABSTAND_ERWEITERT_STURM
} from './vorschrift.js';
import { hinweis } from './ui.js';
import { VERSION } from './version.js';

const FORMATE = {
  a4: [210, 297], a3: [297, 420], a2: [420, 594], a1: [594, 841], a0: [841, 1189]
};
const MM_PX = 96 / 25.4;         // CSS-Pixel je Millimeter
const SCHAERFE = 2;              // Karte doppelt rendern und halbieren -> ~192 dpi

/* Der Bauauftrag geht in der Tasche zum Bauplatz – dort sind A4 und A3 die
   Formate, und mehr wäre dort nur unhandlich. Das große Papier gibt es
   ausschließlich bei der Lagekarte. */
const PAPIERE_AUFTRAG = [['a4', 'A4'], ['a3', 'A3']];
const PAPIERE_LAGE = [
  ['a4', 'A4'], ['a3', 'A3'], ['a2', 'A2'], ['a1', 'A1'], ['a0', 'A0'], ['frei', 'Freies Maß']
];

/* Grenzen des freien Maßes. Nach unten das kleinste sinnvolle Blatt, nach oben
   knapp über A0: darüber wird die Karte zu einem Bild, das kein Browser mehr
   zeichnet (siehe blattmasse). 1200 mm decken A0 und die üblichen
   Plotterrollen ab. */
const FREI_MIN = 100, FREI_MAX = 1200;

/* Längste Kante der gerenderten Karte in Bildpunkten. Ein A0-Blatt mit dem
   vollen Schärfefaktor wären rund 57 Millionen Bildpunkte und über 900
   Kacheln – so viel hält kein Browser durch. Bei dieser Schranke bleiben auf
   A0 noch gut 100 dpi, und aus zwei Metern sieht man den Unterschied nicht. */
const KARTE_MAX_PX = 4800;

const STANDARD_AUFTRAG = {
  format: 'a4', ausrichtung: 'quer', farbe: 'farbe',
  punkttabelle: true, uebersicht: true, unterschrift: true,
  /* Gespeicherte Optionen werden über den Standard gelegt; neue Haken erben so
     ihren Standard, statt bei bisherigen Nutzern als „aus“ zu erscheinen. */
  querungen: true, laengenverbindungen: true,
  /* Beides gehört auf den Bauauftrag und ist deshalb an. Abschalten lohnt
     erst, wenn die Trasse eng geführt ist: dann liegen Zahl an Zahl und
     verdecken den Verlauf, den der Trupp auf dem Blatt sucht. */
  zwischenpunkte: true, teillaengen: true,
  /* Das Gitter ist im Ausdruck von vornherein an: auf dem Bauplatz ist es
     neben der Punkttabelle der einzige Weg, eine beliebige Stelle der Karte
     als MGRS-Angabe durchzugeben. */
  andereStrecken: true, zeichen: true, gitter: true, zoomVersatz: 0,
  // nur im Sammeldruck von Belang
  deckblatt: true, verzeichnis: true, einzelblaetter: true
};

/* Die Lagekarte merkt sich ihre Einstellungen getrennt vom Bauauftrag. Sonst
   stünde nach einer A0-Lagekarte auch der nächste Bauauftrag auf A0 – und der
   soll in die Tasche passen. */
const STANDARD_LAGE = {
  format: 'a1', ausrichtung: 'quer', farbe: 'farbe',
  freiBreite: 900, freiHoehe: 600,
  zeichen: true, beschriftung: true, gitter: true, punktnummern: false, zoomVersatz: 0,
  /* Jeder Streifen um die Karte lässt sich einzeln abräumen – alle fünf aus
     ergibt das nackte Kartenblatt, auf dem nur noch die Lage steht. */
  kopf: true, stammdaten: true, legende: true, kennzahlen: true, fuss: true
};

const PROFILE = {
  auftrag: { schluessel: 'fbp.druck.v1', standard: STANDARD_AUFTRAG },
  lage: { schluessel: 'fbp.lagekarte.v1', standard: STANDARD_LAGE }
};

const profilVon = auftrag => PROFILE[auftrag.modus === 'lage' ? 'lage' : 'auftrag'];

function ladeOptionen(profil) {
  try { return { ...profil.standard, ...JSON.parse(localStorage.getItem(profil.schluessel) || '{}') }; }
  catch (e) { return { ...profil.standard }; }
}
function speicherOptionen(profil, o) {
  try { localStorage.setItem(profil.schluessel, JSON.stringify(o)); } catch (e) { /* egal */ }
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

/**
 * Lagekarte: ein einziges großes Blatt für die Führungsstelle.
 * `aid` = Einsatzabschnitt, `null` die nicht zugeteilten Strecken,
 * ohne Angabe die ganze Planung.
 */
export function oeffneLagekarte(aid) {
  const p = store.projekt;
  const ganzeplanung = aid === undefined;
  const ea = ganzeplanung ? null : abschnittById(p, aid);
  if (!ganzeplanung && aid && !ea) return;

  const quelle = ganzeplanung ? p.strecken : streckenIm(p, aid);
  const strecken = sortiertNachAbschnitt(p, quelle.filter(s => s.punkte.length >= 2));
  const auftrag = {
    modus: 'lage', strecken, abschnitt: ea,
    umfang: ganzeplanung ? 'projekt' : (ea ? 'abschnitt' : 'ohne')
  };
  /* Anders als der Bauauftrag darf die Lagekarte aus Zeichen allein bestehen:
     zu Beginn einer Lage steht dort oft nur, wo die Führungsstelle und die
     Abschnitte liegen – die Trassen kommen erst. */
  if (!strecken.length && !lageZeichen(auftrag).length) {
    hinweis('Für die Lagekarte wird mindestens eine Strecke oder ein taktisches Zeichen gebraucht.', 'warnung');
    return;
  }
  oeffneDruckansicht(auftrag);
}

/** Die taktischen Zeichen, die auf dieser Lagekarte erscheinen – dieselbe
 *  Auswahl, die auch die Kartenebene zeichnet. */
function lageZeichen(auftrag) {
  return gezeichneteZeichen(store.projekt, {
    nurAbschnitt: auftrag.abschnitt ? auftrag.abschnitt.id : undefined,
    abschnittSchaltet: false
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
  if (auftrag.modus === 'lage') return 'Lagekarte Fernmeldebau';
  return auftrag.modus === 'sammel' ? 'Sammel-Bauauftrag Fernmeldebau' : 'Bauauftrag Fernmeldebau';
}

/** Name des Erzeugnisses in der Steuerleiste und im Dateinamen */
function erzeugnis(auftrag) {
  return auftrag.modus === 'lage' ? 'Lagekarte'
    : auftrag.modus === 'sammel' ? 'Sammel-Bauauftrag' : 'Bauauftrag';
}

// ---------------------------------------------------------------- Druckansicht

function oeffneDruckansicht(auftrag) {
  schliesseBauauftrag();
  const sammel = auftrag.modus === 'sammel';
  const lage = auftrag.modus === 'lage';
  const profil = profilVon(auftrag);
  const opt = ladeOptionen(profil);
  const titel = auftragTitel(auftrag);

  const wurzel = document.createElement('div');
  wurzel.id = 'druck';
  wurzel.innerHTML = `
    <div class="druck-steuerung" role="group" aria-label="Druckeinstellungen">
      <div class="ds-titel">${erzeugnis(auftrag)} · <b>${escapeHtml(titel)}</b>${
        sammel || lage ? ` <span class="ds-umfang">${umfangText(auftrag)}</span>` : ''}</div>
      <div class="ds-felder"></div>
      <div class="ds-tasten">
        <button class="knopf" data-akt="schliessen">Schließen</button>
        <div class="ds-drucken">
          <button class="knopf primaer" data-akt="drucken" aria-describedby="ds-format">Drucken / Als PDF speichern</button>
          <p class="ds-format" id="ds-format"></p>
        </div>
      </div>
    </div>
    <div class="druck-buehne"><div class="druck-doku"></div></div>
    <p class="druck-lupe" hidden></p>`;
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

  /* Freies Maß und Ausrichtung schließen einander aus: zwei Kantenlängen sagen
     bereits, wie das Blatt liegt. Es steht deshalb immer nur eines der beiden
     Felder in der Leiste – sichtbar gemacht wird das in neuAufbau. */
  const ausrichtungFeld = auswahl('Ausrichtung', 'ausrichtung',
    [['quer', 'Quer'], ['hoch', 'Hoch']], opt, neuAufbau);
  const masseFeld = lage ? freiesMassFeld(opt, neuAufbau) : null;

  felder.append(
    gruppe('Papier', [
      auswahl('Format', 'format', lage ? PAPIERE_LAGE : PAPIERE_AUFTRAG, opt, neuAufbau),
      ...(masseFeld ? [masseFeld] : []),
      ausrichtungFeld,
      auswahl('Farbe', 'farbe', [['farbe', 'Farbe'], ['sw', 'Schwarz-Weiß']], opt, neuAufbau)
    ]),
    lage
      ? gruppe('Karte', [
          haken('Taktische Zeichen', 'zeichen', opt, neuAufbau),
          /* Nimmt Name und Trassenlänge zusammen von der Karte – beide stehen
             in einem Schild, und wer die Namen loswerden will, will kein
             Schild mit einer nackten Zahl darin behalten. */
          haken('Streckenbeschriftung', 'beschriftung', opt, neuAufbau),
          haken('Koordinatengitter', 'gitter', opt, neuAufbau),
          haken('Trassenpunkte', 'punktnummern', opt, neuAufbau),
          zoomFeld(opt, neuAufbau)
        ])
      : gruppe('Kartenblatt', [
          haken('Übersichtskarte', 'uebersicht', opt, neuAufbau),
          haken('Andere Strecken', 'andereStrecken', opt, neuAufbau),
          /* „Zwischenpunkte“ meint nur die durchnumerierten Knicke der Trasse.
             Muffe, Verteiler, Querung, Mast, Reserve, Anfang und Ende bleiben
             stehen – die werden am Bauplatz gesucht und dürfen nicht mit
             einem Haken vom Blatt verschwinden. */
          haken('Zwischenpunkte', 'zwischenpunkte', opt, neuAufbau),
          haken('Teillängen', 'teillaengen', opt, neuAufbau),
          haken('Taktische Zeichen', 'zeichen', opt, neuAufbau),
          haken('Koordinatengitter', 'gitter', opt, neuAufbau),
          zoomFeld(opt, neuAufbau)
        ]),
    lage
      /* In der Reihenfolge, in der die Streifen auf dem Blatt liegen –
         von der Titelzeile oben bis zur Fußzeile unten. */
      ? gruppe('Blattrand', [
          haken('Titelzeile', 'kopf', opt, neuAufbau),
          haken('Kopfdaten', 'stammdaten', opt, neuAufbau),
          haken('Zeichenerklärung', 'legende', opt, neuAufbau),
          haken('Kennzahlen', 'kennzahlen', opt, neuAufbau),
          haken('Fußzeile', 'fuss', opt, neuAufbau)
        ])
      : gruppe('Datenblatt', [
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

  /* Ein Tipp auf das Blatt schaltet zwischen eingepasst und Originalgröße um.
     Kein eigenes Bedienelement: die Geste liegt auf dem Ding, um das es geht. */
  wurzel.querySelector('.druck-buehne').addEventListener('click', e => {
    const doku = wurzel.querySelector('.druck-doku');
    if (!doku || !doku.contains(e.target)) return;
    const gross = doku.classList.toggle('gross');
    /* Ein zentrierter Flex-Kasten schneidet überbreiten Inhalt links ab –
       in Originalgröße rückt das Blatt deshalb an den Anfang. */
    e.currentTarget.classList.toggle('gross', gross);
    passeVorschauAn(wurzel, opt);
  });

  if (sammel && auftrag.strecken.length > 8) {
    hinweis(`${streckenzahl(auftrag.strecken.length)} – der Aufbau der Kartenblätter dauert einen Augenblick.`);
  }
  /* Ein A1- oder A0-Blatt zieht ein paar hundert Kartenkacheln. Das dauert
     spürbar länger als bei einem A4-Bauauftrag, und wer nicht weiß, warum,
     hält es für einen Fehler. */
  if (lage && Math.max(...seitenmasse(opt)) > 594) {
    hinweis('Großes Blatt – die Karte wird in vielen Kacheln geladen, das dauert einen Augenblick.');
  }

  function neuAufbau() {
    speicherOptionen(profil, opt);
    formatHinweis.textContent = druckHinweisText(opt);
    if (masseFeld) {
      masseFeld.hidden = opt.format !== 'frei';
      ausrichtungFeld.hidden = opt.format === 'frei';
    }
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

/* Freies Blattmaß in Millimetern. Zwei Zahlen statt einer Formatliste: wer
   auf eine Plotterrolle druckt, kennt deren Breite und will die Länge selbst
   bestimmen. Übernommen wird erst beim Verlassen des Feldes – bei jedem
   Tastendruck neu aufzubauen hieße, die Karte für „9“, „90“ und „900“
   dreimal zu rendern. */
function freiesMassFeld(opt, aendern) {
  const el = document.createElement('div');
  el.className = 'ds-feld ds-masse';
  el.innerHTML = '<span>Blattmaß</span>';
  const box = document.createElement('div');
  box.className = 'ds-massefelder';

  const zahl = (schluessel, titel) => {
    const e = document.createElement('input');
    e.type = 'number'; e.min = FREI_MIN; e.max = FREI_MAX; e.step = 10;
    e.value = opt[schluessel];
    e.title = titel;
    e.setAttribute('aria-label', titel);
    e.onchange = () => {
      const wert = grenzeMM(e.value, opt[schluessel]);
      e.value = wert;
      if (wert === opt[schluessel]) return;
      opt[schluessel] = wert;
      aendern();
    };
    return e;
  };

  box.append(zahl('freiBreite', 'Blattbreite in Millimetern'),
    Object.assign(document.createElement('span'), { className: 'ds-mal', textContent: '×' }),
    zahl('freiHoehe', 'Blatthöhe in Millimetern'),
    Object.assign(document.createElement('span'), { className: 'ds-einheit', textContent: 'mm' }));
  el.appendChild(box);
  return el;
}

/** Eine Kantenlänge auf das Machbare bringen; unbrauchbare Eingaben behalten
 *  den bisherigen Wert, statt das Blatt auf 0 mm zu setzen. */
function grenzeMM(wert, bisher) {
  const n = Math.round(Number(wert));
  if (!isFinite(n) || n <= 0) return bisher;
  return Math.min(FREI_MAX, Math.max(FREI_MIN, n));
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
  /* Beim freien Maß steckt die Ausrichtung schon in den beiden Zahlen –
     sie noch einmal zu drehen, würde die Eingabe umdeuten. */
  if (opt.format === 'frei') {
    return [grenzeMM(opt.freiBreite, STANDARD_LAGE.freiBreite),
      grenzeMM(opt.freiHoehe, STANDARD_LAGE.freiHoehe)];
  }
  const [b, h] = FORMATE[opt.format] || FORMATE.a4;
  return opt.ausrichtung === 'quer' ? [h, b] : [b, h];
}

/**
 * Die beiden Maßzahlen, mit denen ein Blatt gezeichnet wird.
 *
 * `schaerfe` – um diesen Faktor wird die Karte überzeichnet und per CSS wieder
 * verkleinert; das ergibt den schärferen Ausdruck. Auf großem Papier muss der
 * Faktor sinken, sonst entsteht ein Bild, das kein Browser mehr zeichnet.
 *
 * `blatt` – um diesen Faktor wächst auf der Lagekarte alles Sichtbare:
 * Schrift, Kartenbeschriftung, Strichstärken, Zier am Kartenrand. Ein
 * A0-Blatt hängt an der Wand der Führungsstelle und wird aus zwei Metern
 * gelesen, ein A4-Bauauftrag liegt in der Hand. Bezugsmaß ist die kurze
 * Blattkante gegen die kurze A4-Kante – so bleibt der Faktor gleich, ob das
 * Blatt hoch oder quer liegt. Der Bauauftrag bleibt bei 1: A4 und A3 werden
 * beide aus der Hand gelesen, und ihr Satzspiegel ist erprobt.
 */
function blattmasse(auftrag, opt) {
  const [bmm, hmm] = seitenmasse(opt);
  if (auftrag.modus !== 'lage') return { schaerfe: SCHAERFE, blatt: 1, bmm, hmm };
  const langePx = Math.max(bmm, hmm) * MM_PX;
  return {
    schaerfe: Math.max(1, Math.min(SCHAERFE, KARTE_MAX_PX / langePx)),
    blatt: Math.max(1, Math.min(bmm, hmm) / 210),
    bmm, hmm
  };
}

/** Rand, den fitBounds um die Strecken frei lässt, in Kartenbildpunkten.
 *  Er hält die Beschriftung von der Blattkante fern und wächst deshalb mit
 *  ihr – aber nur bis zum Doppelten: auf großem Papier gehört die Fläche der
 *  Karte, nicht dem Rand. */
function kartenrand(mass, grund = 50) {
  return Math.round(grund * mass.schaerfe * Math.min(2, mass.blatt));
}

/** Kartenebenen in Blattgröße: Striche und Symbole werden überzeichnet wie
 *  die Karte selbst und wachsen zusätzlich mit dem Blatt. */
function strichFaktor(mass) {
  return mass.schaerfe * mass.blatt;
}

function zeichenOptionen(p, mass) {
  /* Taktische Zeichen bemisst die Ebene über `symbolgroesse`. Der Faktor
     bezieht sich auf den vollen Schärfefaktor, mit dem die Größen abgestimmt
     sind – bei A4 und A3 kommt genau 1 heraus und nichts ändert sich. */
  return { ...p.optionen, symbolgroesse: (p.optionen.symbolgroesse || 1) * strichFaktor(mass) / SCHAERFE };
}

/** Wie lange auf die Kacheln gewartet wird. Ein A0-Blatt zieht ein paar
 *  hundert Kacheln – die acht Sekunden des Bauauftrags reichen dafür nicht,
 *  und ein zu früh freigegebener Druck hätte weiße Flecken. */
function kachelfrist(mass) {
  const megapixel = mass.bmm * mass.hmm * MM_PX * MM_PX * mass.schaerfe * mass.schaerfe / 1e6;
  return Math.min(45000, Math.round(8000 + megapixel * 1600));
}

/**
 * Baut das ganze Dokument neu auf. Die Karten entstehen erst danach: sie
 * brauchen die Maße ihrer Bühne, und die stehen erst fest, wenn die Blätter
 * im Dokument liegen.
 */
function aufbauen(ziel, auftrag, opt, karten, druckKnopf) {
  const p = store.projekt;
  const sw = opt.farbe === 'sw';
  const sammel = auftrag.modus === 'sammel';
  const lage = auftrag.modus === 'lage';
  const mass = blattmasse(auftrag, opt);
  // Im Sammeldruck meint „andere Strecken“ die übrigen der Sammlung,
  // nicht alles, was sonst noch in der Planung liegt.
  const sammlung = sammel || lage ? auftrag.strecken.map(s => s.id) : null;

  ziel.style.setProperty('--seite-b', mass.bmm + 'mm');
  ziel.style.setProperty('--seite-h', mass.hmm + 'mm');
  ziel.style.setProperty('--schaerfe', mass.schaerfe.toFixed(4));
  ziel.style.setProperty('--blattfaktor', mass.blatt.toFixed(4));
  /* Die Lagekarte trägt kein Formatkennwort: die Regeln zu `.a3` gelten dem
     Satzspiegel des Bauauftrags, und auf dem Lageblatt richtet sich alles
     nach dem Blattfaktor. */
  ziel.className = 'druck-doku ' + (lage ? 'lage' : opt.format) +
    ' ' + opt.ausrichtung + (sw ? ' sw' : '');
  ziel.innerHTML = '';

  const kartenbau = [];

  if (lage) {
    lageblatt(ziel, auftrag, opt, mass, sw, karten, kartenbau);
  }
  if (sammel) {
    if (opt.deckblatt) deckblatt(ziel, auftrag, opt, mass, sw, karten, kartenbau);
    if (opt.verzeichnis) verzeichnisblaetter(ziel, auftrag, opt);
  }
  if (auftrag.modus === 'einzel' || (sammel && opt.einzelblaetter)) {
    for (const s of auftrag.strecken) {
      streckenblaetter(ziel, s, auftrag, opt, mass, sw, sammlung, karten, kartenbau);
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
function streckenblaetter(ziel, strecke, auftrag, opt, mass, sw, sammlung, karten, kartenbau) {
  const p = store.projekt;
  const k = kennzahlen(strecke);

  const b1 = blatt(ziel, opt);
  b1.innerHTML =
    streckenKopfHTML(p, strecke) +
    stammHTML(p, strecke, k) +
    kartenfeldHTML({ uebersicht: opt.uebersicht }) +
    legendeHTML(strecke, sw, opt) +
    kennzahlenHTML(k, strecke) +
    fussHTML(p, opt);

  if (datenblattNoetig(opt)) datenblaetter(ziel, p, strecke, k, opt);

  kartenbau.push(() => {
    const karte = baueDruckkarte(b1.querySelector('.karten-buehne'), strecke, opt, mass, sw, karten, sammlung);
    // erst nach fitBounds: vorher steht die Trasse noch nicht dort, wo sie druckt
    setzeUebersichtsecke(b1.querySelector('.karten-rahmen'), karte, strecke);
    const ukBuehne = b1.querySelector('.uk-buehne');
    const uk = ukBuehne ? baueUebersichtskarte(ukBuehne, strecke, mass, sw, karten, sammlung) : null;
    massstabSchreiben(b1, karte);
    return Promise.all([warteAufKacheln(karte, kachelfrist(mass)), uk ? warteAufKacheln(uk) : null])
      .then(() => massstabSchreiben(b1, karte));
  });
}

/** Deckblatt des Sammelauftrags: eine Karte über alle Strecken der Sammlung
 *  und darunter, was zusammen gebraucht wird. */
function deckblatt(ziel, auftrag, opt, mass, sw, karten, kartenbau) {
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
    kartenfeldHTML() +
    sammelLegendeHTML(auftrag, sw, 12) +
    sammelKennzahlenHTML(ges) +
    fussHTML(p, opt);

  kartenbau.push(() => {
    const karte = baueSammelkarte(el.querySelector('.karten-buehne'), auftrag, opt, mass, sw, karten);
    massstabSchreiben(el, karte);
    return warteAufKacheln(karte, kachelfrist(mass)).then(() => massstabSchreiben(el, karte));
  });
}

/**
 * Lagekarte: ein einziges Blatt, auf dem die Karte fast alles ist.
 *
 * Sie hängt in der Führungsstelle und beantwortet eine andere Frage als der
 * Bauauftrag – nicht „was baue ich hier“, sondern „wie steht die Lage“.
 * Deshalb fehlen Punkttabelle, Querungen und Unterschriften, und deshalb
 * bekommt die Karte das ganze Blatt: was am Rand steht, sagt nur, worauf man
 * sieht, wie groß es ist und wie es zu lesen ist.
 *
 * Jeder dieser Streifen lässt sich abräumen, bis nur noch die Karte übrig
 * ist. Zwei Angaben bleiben davon unberührt: die Einstufung, die auf jedes
 * Blatt gehört, und die Namensnennung der Kartengrundlage – die zieht ohne
 * Fußzeile in die Karte, statt zu verschwinden.
 */
function lageblatt(ziel, auftrag, opt, mass, sw, karten, kartenbau) {
  const p = store.projekt;
  const el = blatt(ziel, opt);
  el.classList.add('lageblatt');
  el.innerHTML =
    einstufungHTML(p) +
    (opt.kopf
      ? blattkopfHTML(p, { titel: auftragTitel(auftrag), unter: umfangText(auftrag), doktyp: doktyp(auftrag) })
      : '') +
    (opt.stammdaten ? sammelStammHTML(p, auftrag) : '') +
    kartenfeldHTML({ quelle: opt.fuss ? '' : kartenquelle(p, opt) }) +
    (opt.legende ? lageLegendeHTML(auftrag, opt, sw, mass) : '') +
    (opt.kennzahlen && auftrag.strecken.length
      ? sammelKennzahlenHTML(gesamtKennzahlen(auftrag.strecken)) : '') +
    (opt.fuss ? fussHTML(p, opt) : '');

  kartenbau.push(() => {
    const karte = baueLagekarte(el.querySelector('.karten-buehne'), auftrag, opt, mass, sw, karten);
    massstabSchreiben(el, karte);
    return warteAufKacheln(karte, kachelfrist(mass)).then(() => massstabSchreiben(el, karte));
  });
}

/** Kartenrahmen samt Nordpfeil und Maßstabsleiste – auf jedem Blatt gleich.
 *  `quelle` wird nur gesetzt, wenn die Namensnennung sonst nirgends steht. */
function kartenfeldHTML({ uebersicht = false, quelle = '' } = {}) {
  return `<div class="kartenfeld">
    <div class="karten-rahmen">
      <div class="karten-buehne"></div>
      <div class="karten-nord" aria-hidden="true">${nordpfeilSVG()}</div>
      <div class="karten-massstab"><span class="ms-balken"><i></i></span><span class="ms-text">—</span></div>
      ${quelle ? `<p class="karten-quelle">${quelle}</p>` : ''}
      ${uebersicht ? '<div class="karten-uebersicht"><div class="uk-buehne"></div><span class="uk-titel">Übersicht</span></div>' : ''}
    </div>
  </div>`;
}

/** „12 Strecken · 7 taktische Zeichen“ – der Umfang in einem Halbsatz */
function umfangText(auftrag) {
  const teile = [];
  if (auftrag.strecken.length || auftrag.modus !== 'lage') {
    teile.push(streckenzahl(auftrag.strecken.length));
  }
  if (auftrag.modus === 'lage') {
    const n = lageZeichen(auftrag).length;
    if (n) teile.push(`${n} ${n === 1 ? 'taktisches Zeichen' : 'taktische Zeichen'}`);
  }
  return teile.join(' · ');
}

function blatt(ziel, opt) {
  const el = document.createElement('section');
  el.className = 'blatt';
  ziel.appendChild(el);
  return el;
}

// ---------------------------------------------------------------- Karten

/** Leere Druckkarte in mehrfacher Pixelauflösung, per CSS wieder verkleinert –
 *  das ergibt den deutlich schärferen Ausdruck. Das Blattmaß bleibt an der
 *  Karte hängen: die Maßstabsleiste muss später wissen, wie stark verkleinert
 *  wurde, um aus Kartenpixeln Millimeter zu machen. */
function neueDruckkarte(buehne, mass, zusatz = {}) {
  const bp = buehne.offsetWidth, hp = buehne.offsetHeight;
  const inner = document.createElement('div');
  inner.className = 'karten-inner';
  inner.style.width = Math.round(bp * mass.schaerfe) + 'px';
  inner.style.height = Math.round(hp * mass.schaerfe) + 'px';
  inner.style.transform = `scale(${1 / mass.schaerfe})`;
  buehne.appendChild(inner);

  const karte = L.map(inner, {
    zoomControl: false, attributionControl: false, dragging: false, keyboard: false,
    scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, touchZoom: false,
    fadeAnimation: false, zoomAnimation: false, maxZoom: MAX_ZOOM, ...zusatz
  });
  karte.createPane('fbp-strecken').style.zIndex = 420;
  karte.createPane('fbp-griffe').style.zIndex = 470;
  const lbl = karte.createPane('fbp-labels');
  lbl.style.zIndex = 620; lbl.style.pointerEvents = 'none';
  karte.createPane('fbp-zeichen').style.zIndex = 640;
  karte._fbpMass = mass;
  return karte;
}

/* Jede Karte zeigt die Zeichen ihres eigenen Gegenstands: das Streckenblatt
   die des Abschnitts dieser Strecke, das Deckblatt die des gedruckten
   Abschnitts – und dazu jeweils die nicht zugeteilten. Ohne Abschnitt alle. */
function baueDruckkarte(buehne, strecke, opt, mass, sw, karten, sammlung) {
  const p = store.projekt;
  const karte = neueDruckkarte(buehne, mass, { zoomSnap: 0.25 });
  setzeBasiskarte(karte, sw ? grauVariante(p.ansicht.basemap) : p.ansicht.basemap);

  const sl = new StreckenLayer(karte, {
    interaktiv: false, sw, strichFaktor: strichFaktor(mass),
    hervorheben: strecke.id,
    nurStrecke: opt.andereStrecken ? null : strecke.id,
    nurStrecken: opt.andereStrecken ? sammlung : null
  });
  sl.zeichne({
    ...p.optionen, gesamtlaenge: false, punktnummern: true,
    teillaengen: opt.teillaengen !== false,
    zwischenpunkte: opt.zwischenpunkte !== false
  });

  if (opt.zeichen) {
    const zl = new ZeichenLayer(karte, {
      interaktiv: false, sw, abschnittSchaltet: false,
      nurAbschnitt: strecke.abschnitt || undefined
    });
    zl.zeichne(zeichenOptionen(p, mass));
  }

  const grenzen = L.latLngBounds(strecke.punkte.map(x => [x.lat, x.lng]));
  const rand = kartenrand(mass);
  karte.fitBounds(grenzen, { padding: [rand, rand], animate: false });
  if (opt.zoomVersatz) karte.setZoom(karte.getZoom() + opt.zoomVersatz, { animate: false });
  karte.invalidateSize({ animate: false });
  // erst nach dem endgültigen Ausschnitt – das Gitter zeichnet, was es vorfindet
  if (opt.gitter) {
    new GitterLayer(karte, { interaktiv: false, sw, strichFaktor: strichFaktor(mass) }).zeichne({ gitter: true });
  }
  karten.push(karte);
  return karte;
}

/* Die Übersichtskarte hat ihren Platz unten rechts, weil dort auf dem
   Kartenblatt sonst nichts liegt – oben rechts steht der Nordpfeil, unten
   links der Maßstab. Läuft die Trasse aber gerade durch diese Ecke, verdeckt
   das Kästchen genau das, worum es auf dem Blatt geht. Dann weicht es nach
   oben links aus – aber nur, wenn dort wirklich nichts liegt: eine Ecke gegen
   eine zweite verdeckte zu tauschen verschöbe den Schaden bloß, und den
   Anfang der Trasse zu verdecken ist nicht besser als ihr Ende. Ist auch oben
   links etwas, bleibt das Kästchen am gewohnten Ort und wird abgeschaltet,
   wem das zu viel ist. */
function setzeUebersichtsecke(rahmen, karte, strecke) {
  const kasten = rahmen?.querySelector('.karten-uebersicht');
  if (!kasten) return;
  const b = kasten.offsetWidth, h = kasten.offsetHeight;
  if (!b || !h) return;

  /* Die Karte ist um den Schärfefaktor größer gerendert und per CSS wieder
     verkleinert – ihre Bildpunkte müssen erst auf das Blattmaß zurück. */
  const f = karte._fbpMass?.schaerfe || 1;
  const roh = strecke.punkte.map(pt => {
    const q = karte.latLngToContainerPoint([pt.lat, pt.lng]);
    return { x: q.x / f, y: q.y / f };
  });

  /* Nur die Ecken zu prüfen, in denen ein Trassenpunkt liegt, reicht nicht:
     eine lange Gerade überquert sie auch ohne Knick. Der Zug wird deshalb in
     kurze Schritte zerlegt. */
  const pfad = [];
  roh.forEach((pkt, i) => {
    pfad.push(pkt);
    const naechster = roh[i + 1];
    if (!naechster) return;
    const schritte = Math.ceil(Math.hypot(naechster.x - pkt.x, naechster.y - pkt.y) / 4);
    for (let k = 1; k < schritte; k++) {
      pfad.push({
        x: pkt.x + (naechster.x - pkt.x) * k / schritte,
        y: pkt.y + (naechster.y - pkt.y) * k / schritte
      });
    }
  });

  // Ein Streifen um das Kästchen herum zählt mit: eine Trasse, die es streift,
  // ist genauso schlecht zu lesen wie eine, die darunter verschwindet.
  const luft = 4;
  const belegt = (x, y) => pfad.some(q =>
    q.x >= x - luft && q.x <= x + b + luft && q.y >= y - luft && q.y <= y + h + luft);

  if (!belegt(kasten.offsetLeft, kasten.offsetTop)) return;
  const randX = rahmen.clientWidth - kasten.offsetLeft - b;
  const randY = rahmen.clientHeight - kasten.offsetTop - h;
  if (!belegt(randX, randY)) kasten.classList.add('uk-oben-links');
}

/** Übersichtskarte des Deckblatts: alle Strecken der Sammlung gleichrangig,
 *  jede mit ihrem Namen und ihrer Länge beschriftet. */
function baueSammelkarte(buehne, auftrag, opt, mass, sw, karten) {
  const p = store.projekt;
  const karte = neueDruckkarte(buehne, mass, { zoomSnap: 0.25 });
  setzeBasiskarte(karte, sw ? grauVariante(p.ansicht.basemap) : p.ansicht.basemap);

  const sl = new StreckenLayer(karte, {
    interaktiv: false, sw, strichFaktor: strichFaktor(mass),
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
    zl.zeichne(zeichenOptionen(p, mass));
  }

  const alle = auftrag.strecken.flatMap(s => s.punkte.map(x => [x.lat, x.lng]));
  const rand = kartenrand(mass, 55);
  karte.fitBounds(L.latLngBounds(alle), { padding: [rand, rand], animate: false });
  if (opt.zoomVersatz) karte.setZoom(karte.getZoom() + opt.zoomVersatz, { animate: false });
  karte.invalidateSize({ animate: false });
  if (opt.gitter) {
    new GitterLayer(karte, { interaktiv: false, sw, strichFaktor: strichFaktor(mass) }).zeichne({ gitter: true });
  }
  karten.push(karte);
  return karte;
}

/**
 * Karte der Lagekarte: alle Strecken der Auswahl gleichrangig, dazu die
 * taktischen Zeichen – und die bestimmen den Ausschnitt mit. Auf der
 * Deckblattkarte des Bauauftrags richtet er sich allein nach den Trassen;
 * hier wäre das falsch, denn eine Lagekarte kann aus Zeichen allein bestehen,
 * und ein Zeichen außerhalb der Trassen fiele sonst vom Blatt.
 */
function baueLagekarte(buehne, auftrag, opt, mass, sw, karten) {
  const p = store.projekt;
  const karte = neueDruckkarte(buehne, mass, { zoomSnap: 0.25 });
  setzeBasiskarte(karte, sw ? grauVariante(p.ansicht.basemap) : p.ansicht.basemap);

  const sl = new StreckenLayer(karte, {
    interaktiv: false, sw, strichFaktor: strichFaktor(mass),
    nurStrecken: auftrag.strecken.map(s => s.id)
  });
  sl.zeichne({
    ...p.optionen, teillaengen: false,
    gesamtlaenge: !!opt.beschriftung, punktnummern: !!opt.punktnummern
  });

  const zeichen = opt.zeichen ? lageZeichen(auftrag) : [];
  if (opt.zeichen) {
    const zl = new ZeichenLayer(karte, {
      interaktiv: false, sw, abschnittSchaltet: false,
      nurAbschnitt: auftrag.abschnitt ? auftrag.abschnitt.id : undefined
    });
    zl.zeichne(zeichenOptionen(p, mass));
  }

  const ecken = [
    ...auftrag.strecken.flatMap(s => s.punkte.map(x => [x.lat, x.lng])),
    ...zeichen.map(z => [z.lat, z.lng])
  ];
  if (ecken.length) {
    const rand = kartenrand(mass, 55);
    karte.fitBounds(L.latLngBounds(ecken), { padding: [rand, rand], animate: false });
  } else {
    // Nichts zu umfassen: dann gilt der Ausschnitt der Arbeitskarte
    karte.setView([p.ansicht.lat, p.ansicht.lng], p.ansicht.zoom, { animate: false });
  }
  if (opt.zoomVersatz) karte.setZoom(karte.getZoom() + opt.zoomVersatz, { animate: false });
  karte.invalidateSize({ animate: false });
  if (opt.gitter) {
    new GitterLayer(karte, { interaktiv: false, sw, strichFaktor: strichFaktor(mass) }).zeichne({ gitter: true });
  }
  karten.push(karte);
  return karte;
}

function baueUebersichtskarte(buehne, strecke, mass, sw, karten, sammlung) {
  const p = store.projekt;
  const karte = neueDruckkarte(buehne, mass);
  setzeBasiskarte(karte, 'topplus_grau');

  const sl = new StreckenLayer(karte, {
    interaktiv: false, sw, strichFaktor: strichFaktor(mass),
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

/* Die Einstufung gehört auf jedes Blatt und über alles andere – ein
   eingestuftes Blatt muss sich auch einzeln erkennen lassen. Sie steht
   deshalb getrennt vom Blattkopf: auf der Lagekarte darf die Titelzeile
   weichen, die Einstufung nicht. Was abschaltbar ist, ist die Beschriftung
   des Blattes, nicht seine Einstufung. */
function einstufungHTML(p) {
  const grad = (p.kopf.vsgrad || '').trim();
  return grad ? `<p class="bl-einstufung">${escapeHtml(grad)}</p>` : '';
}

function kopfHTML(p, angaben) {
  return einstufungHTML(p) + blattkopfHTML(p, angaben);
}

function blattkopfHTML(p, { titel, unter = '', doktyp: typ }) {
  const k = p.kopf;
  return `<header class="bl-kopf">
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
    ['Verlegeart', va && !k.kabel.funk ? va.name : '–']
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
  /* Eine Funkstrecke trägt nur, was für sie gilt: Länge, Muffen und
     Querungen – Trommeln, Bauzuschlag und Bauzeit wären dort erfundene Nullen. */
  const kacheln = k.kabel.funk ? [
    ['Funkstrecke', formatLaenge(k.trasse), `${k.abschnitte} Abschnitte`],
    ['Muffen', String(k.muffen), 'Verbindungen'],
    ['Querungen', String(k.querungen), 'zu beachten']
  ] : [
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
function sammelLegendeHTML(auftrag, sw, grenze, zusatz = '',
  hinweis = 'Bezeichnung und Trassenlänge stehen an jeder Strecke') {
  if (!auftrag.strecken.length) return '';
  const zeigbar = !sw && auftrag.strecken.length <= grenze;
  const eintraege = zeigbar
    ? auftrag.strecken.map(s =>
        `<span class="lg-eintrag"><i class="lg-linie voll" style="--farbe:${s.farbe}"></i>${escapeHtml(s.name)}</span>`).join('')
    : '';
  /* Die Kabelzeichen gelten für alle Strecken gleich, deshalb steht jede
     vorkommende Kabelart nur einmal in der Erklärung. */
  const arten = [...new Set(auftrag.strecken.map(s => s.kabeltyp))];
  const zeichen = arten.map(a => kabelzeichenEintrag(a, '#000')).join('');
  return `<div class="bl-legende"><span class="lg-titel">Zeichenerklärung</span>${eintraege}${zeichen}${zusatz}
    ${hinweis ? `<span class="lg-eintrag lg-hinweis">${escapeHtml(hinweis)}</span>` : ''}</div>`;
}

/**
 * Zeichenerklärung der Lagekarte. Sie führt zusätzlich die vorkommenden
 * Punktarten auf: vor der Lagekarte steht nicht, wer sie geplant hat – dort
 * muss ablesbar sein, was ein Quadrat und was eine Raute bedeutet. Auf großem
 * Papier ist außerdem Raum für mehr Streckennamen; die Grenze, ab der die
 * Farbzuordnung der Beschriftung an der Strecke überlassen wird, wächst
 * deshalb mit dem Blatt.
 */
function lageLegendeHTML(auftrag, opt, sw, mass) {
  const arten = [...new Set(auftrag.strecken.flatMap(s => s.punkte.map(x => x.art)))]
    .filter(a => a !== 'punkt');
  const punkte = arten.map(a => {
    const pa = punktartById(a);
    return `<span class="lg-eintrag"><i class="lg-punkt art-${a}" style="--farbe:#111">${
      pa.kurz === '·' ? '' : pa.kurz}</i>${escapeHtml(pa.name)}</span>`;
  }).join('');
  /* Ohne Beschriftung auf der Karte verweist der Hinweis ins Leere – dann
     trägt allein die Farbe in dieser Liste die Zuordnung, und genau das
     muss dort stehen. */
  const hinweis = opt.beschriftung
    ? 'Bezeichnung und Trassenlänge stehen an jeder Strecke'
    : (sw ? '' : 'Die Farbe der Linie ordnet die Strecke zu');
  return sammelLegendeHTML(auftrag, sw, Math.round(12 * mass.blatt), punkte, hinweis);
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

/** Musterstück des Kabelzeichens für die Zeichenerklärung: dasselbe Zeichen,
 *  das auf der Karte im Linienzug steht, auf einem kurzen Stück Trasse. */
function kabelzeichenEintrag(kabeltyp, farbe) {
  const z = kabelzeichen(kabeltyp);
  if (!z) return '';
  const inhalt = z.text ? `<span>${z.text}</span>`
    : z.stufe ? `<svg viewBox="0 4 34 13"><path d="${z.stufe}"></path></svg>`
    : '<b></b>'.repeat(z.striche);
  return `<span class="lg-eintrag"><i class="lg-kabel${z.stufe ? ' stufe' : ''}" style="--farbe:${farbe}">${inhalt}</i>` +
         `${escapeHtml(kabelById(kabeltyp).name)}</span>`;
}

function legendeHTML(s, sw, opt) {
  /* Die Zeichenerklärung erklärt, was auf dem Blatt steht. Ausgeblendete
     Zwischenpunkte und Teillängen fallen deshalb auch aus ihr heraus. */
  const arten = [...new Set(s.punkte.map(p => p.art))]
    .filter(a => opt.zwischenpunkte !== false || a !== 'punkt');
  const punkte = arten.map(a => {
    const pa = punktartById(a);
    return `<span class="lg-eintrag"><i class="lg-punkt art-${a}" style="--farbe:${sw ? '#000' : s.farbe}">${pa.kurz === '·' ? '' : pa.kurz}</i>${pa.name}</span>`;
  }).join('');
  const linien =
    `<span class="lg-eintrag"><i class="lg-linie ${kabelById(s.kabeltyp).funk ? 'funk' : 'voll'}" style="--farbe:${sw ? '#000' : s.farbe}"></i>Auftragsstrecke</span>` +
    (opt.andereStrecken ? `<span class="lg-eintrag"><i class="lg-linie ander"></i>andere Strecken</span>` : '') +
    kabelzeichenEintrag(s.kabeltyp, sw ? '#000' : s.farbe);
  const hinweisText = opt.teillaengen === false ? ''
    : '<span class="lg-eintrag lg-hinweis">Zahlen an der Trasse = Teilstrecken in Metern</span>';
  return `<div class="bl-legende"><span class="lg-titel">Zeichenerklärung</span>${linien}${punkte}
    ${hinweisText}</div>`;
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
      <td class="q-auflage">${a.verbot && a.verbotstext
        ? `<b class="q-verbot">${escapeHtml(a.verbotstext)}.</b> ` : ''
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
  const zeilen = k.kabel.funk ? [
    ['Leitungsart', k.kabel.name],
    ['<b>Funkstrecke (Luftlinie)</b>', `<b>${formatLaenge(k.trasse)}</b>`],
    ['Muffen / Verbindungsstellen', String(k.muffen)],
    ['Verteiler / Endverzweiger', String(s.punkte.filter(p => p.art === 'verteiler').length)],
    ['Querungen (alle Arten)', String(k.querungen)],
    ['Masten / Hochführungen', String(s.punkte.filter(p => p.art === 'mast').length)]
  ] : [
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
    ['Querungen (alle Arten)', String(k.querungen)],
    ...(k.querungenGenehmigung
      ? [['davon nur mit Freigabe (Genehmigung oder Bauwerk)', String(k.querungenGenehmigung)]]
      : []),
    ['Längenverbindungen (geplant / rechnerisch)',
      `${k.laengenverbindungen.filter(v => v.quelle === 'geplant').length} / ` +
      `${k.laengenverbindungen.filter(v => v.quelle === 'rechnerisch').length}`],
    ['Auflagen mindestens', `${k.abbinden.auflagen} Stück`],
    ['Abbunde mindestens', `${k.abbinden.abbunde} Stück`],
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

/* Die Namensnennung der Kartengrundlage ist keine Zierde: die Datenlizenz
   Deutschland (dl-de/by-2-0) des BKG und die ODbL von OpenStreetMap verlangen
   sie. Sie steht deshalb als eigener Baustein da und rückt in die Karte, wenn
   die Fußzeile abgeschaltet wird – abschalten lässt sie sich nicht. */
function kartenquelle(p, opt) {
  const bk = basiskarteById(p.ansicht.basemap);
  const quelle = opt.farbe === 'sw' ? basiskarteById(grauVariante(p.ansicht.basemap)) : bk;
  return `Kartengrundlage: ${ohneMarken(quelle.attribution)} · ${escapeHtml(HOEHEN_QUELLE)}`;
}

function fussHTML(p, opt) {
  return `<footer class="bl-fuss">
    <span>${escapeHtml(p.name)} · erstellt ${new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
      mit FMBauplaner ${VERSION} (fmbauplaner.app)</span>
    <span class="bf-quelle">${kartenquelle(p, opt)}</span>
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
  const mass = karte._fbpMass || { schaerfe: SCHAERFE, blatt: 1 };
  const mitte = karte.getCenter();
  // Meter je dargestelltem CSS-Pixel (Karte wird um 1/schaerfe verkleinert)
  const mProKartenPx = 156543.03392 * Math.cos(mitte.lat * Math.PI / 180) / Math.pow(2, karte.getZoom());
  const mProAnzeigePx = mProKartenPx * mass.schaerfe;
  const mProMm = mProAnzeigePx * MM_PX;
  const nenner = Math.round(mProMm * 1000);

  /* Balken auf eine runde Länge bringen. Er wächst mit dem Blatt, sonst stünde
     auf einer A0-Lagekarte ein fingerlanger Strich neben zentimeterhoher
     Schrift – aber gedeckelt, damit er nicht das halbe Blatt quert. */
  const zielMm = 40 * Math.min(3, mass.blatt);
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
  const rand = buehne.clientWidth < 600 ? 16 : 48;
  const passend = Math.min(1, (buehne.clientWidth - rand) / breitePx);
  /* In Originalgröße bleibt das Blatt bei 1 und die Bühne scrollt – nur so ist
     die Schrift auf einem kleinen Schirm zu lesen. */
  const skala = doku.classList.contains('gross') ? 1 : passend;
  doku.style.setProperty('--vorschau-skala', skala.toFixed(4));
  /* Ein Transform verkleinert nur das Bild, nicht den Platz, den das Dokument
     im Layout beansprucht. Bei A4 fällt der Überhang kaum auf; um ein auf ein
     Drittel verkleinertes A0-Blatt stünden zwei Bildschirmlängen Leerraum, durch
     die erst zu scrollen wäre, um das Blatt überhaupt zu finden. Die eingesparten
     Maße werden deshalb wieder abgezogen – seitlich je zur Hälfte, weil das Blatt
     von der Mitte aus verkleinert wird. */
  const uebrigB = doku.offsetWidth * (1 - skala);
  const uebrigH = doku.offsetHeight * (1 - skala);
  doku.style.margin = skala < 1 ? `0 ${-uebrigB / 2}px ${-uebrigH}px` : '';
  const lupe = wurzel.querySelector('.druck-lupe');
  if (lupe) {
    lupe.hidden = passend >= 0.62;
    lupe.textContent = doku.classList.contains('gross')
      ? 'Tippen: ganzes Blatt' : 'Tippen: Originalgröße';
  }
}

/* Der Druckdialog des Betriebssystems kennt die hier gewählten Einstellungen
   nicht – er muss sie noch einmal gesagt bekommen. Der Satz dafür steht neben
   dem Druckknopf und nicht in der Kurzanleitung, und er ändert sich mit. */
function druckHinweisText(opt) {
  const [bmm, hmm] = seitenmasse(opt);
  /* Beim freien Maß und bei den großen Formaten nennt der Hinweis die
     Millimeter: kein Druckdialog führt „A0 quer“ als Wahl, dort wird ein
     eigenes Papierformat mit genau diesen Kanten angelegt. */
  if (opt.format === 'frei') return `Im Druckdialog: eigenes Format ${bmm} × ${hmm} mm · Ränder „Keine“`;
  const name = (PAPIERE_LAGE.find(([w]) => w === opt.format) || [, 'A4'])[1];
  const lage = opt.ausrichtung === 'hoch' ? 'Hoch' : 'Quer';
  const masse = FORMATE[opt.format] && Math.max(bmm, hmm) > 420 ? ` (${bmm} × ${hmm} mm)` : '';
  return `Im Druckdialog: ${name} · ${lage}${masse} · Ränder „Keine“`;
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
  document.title = [erzeugnis(auftrag),
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
