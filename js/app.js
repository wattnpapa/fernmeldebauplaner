// app.js – Zusammenbau: Karte, Layer, Bedienung, Tastatur

import {
  store, neueStrecke, neuerPunkt, neuesZeichen,
  dateisicherung, istGehaltvoll
} from './state.js';
import { erstelleKarte, setzeBasiskarte, BASISKARTEN } from './map.js';
import { StreckenLayer, escapeHtml } from './strecken.js';
import { ZeichenLayer } from './zeichen.js';
import { toMGRS, toDDM, alleFormate } from './geo.js';
import * as io from './io.js';
import {
  initUI, zeichneStreckenListe, zeichneZeichenListe, zeichneProjektReiter,
  symbolPalette, koordinatenSuche, hilfeDialog, projektDialog, dialog, schliesseDialog, hinweis,
  abschnittAnlegen
} from './ui.js';
import {
  bauauftragOffen, schliesseBauauftrag, entferneSeitenformat, oeffneSammeldruck
} from './bauauftrag.js';
import { VERSION } from './version.js';

const $ = s => document.querySelector(s);

store.starten();

// ---------------------------------------------------------------- Karte & Layer

const karte = erstelleKarte($('#karte'), store.projekt.ansicht);

const sl = new StreckenLayer(karte, {
  aufAuswahl: () => { zl.auswahl = null; zeichneSeite(); },
  aufAenderung: () => aktualisiereKennzahlen()
});

const zl = new ZeichenLayer(karte, {
  aufAuswahl: zid => { if (zid) { sl.auswahl = null; reiterWechseln('zeichen'); } zeichneSeite(); },
  aufAenderung: () => {}
});

initUI({ karte, sl, zl, weiterzeichnen, zeichenSetzen, zurKarte, aufAenderung: () => {} });

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

function zeichenSetzenStarten() {
  symbolPalette(symbolId => zeichenSetzen(symbolId));
}

/** Setzmodus starten – `abschnitt` teilt das Zeichen gleich beim Setzen zu.
 *  Die Seitenleiste ruft das über den Kontext auf; die Modusanzeige gehört
 *  hierher, weil sie an der Werkzeugleiste hängt. */
function zeichenSetzen(symbolId, abschnitt = null) {
  zeichnenBeenden(true);
  zl.starteSetzen(symbolId, abschnitt);
  zurKarte();
  modusAnzeigen();
  hinweis('Auf die Karte klicken, um das Zeichen zu setzen.');
}

function modusAnzeigen() {
  const zeichnet = !!sl.zeichenModus;
  const setzt = !!zl.setzModus;
  $('#wz-strecke').classList.toggle('aktiv', zeichnet);
  $('#wz-zeichen').classList.toggle('aktiv', setzt);
  // schmal weicht die Werkzeugleiste der Modusleiste – beide sitzen unten
  document.body.classList.toggle('modus-aktiv', zeichnet || setzt);

  const box = $('#zeichen-hinweis');
  box.hidden = !zeichnet;
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
  if (akt === 'zurueck') { sl.letztenPunktZurueck(); modusAnzeigen(); }
  if (akt === 'fertig') zeichnenBeenden(false);
  if (akt === 'abbruch') zeichnenBeenden(true);
});

// ---------------------------------------------------------------- Karten-Klick ohne Modus

karte.on('click', e => {
  if (sl.zeichenModus || zl.setzModus) return;
  if (sl.auswahl || zl.auswahl) { sl.auswahl = null; zl.auswahl = null; zeichneAlles(); return; }
  koordinatenPopup(e.latlng);
});

function koordinatenPopup(ll) {
  const f = alleFormate(ll.lat, ll.lng);
  const html = `<div class="koord-popup">
      <div class="kp-zeile"><span>MGRS</span><code>${escapeHtml(f.mgrs)}</code></div>
      <div class="kp-zeile"><span>GPS</span><code>${escapeHtml(f.ddm)}</code></div>
      <div class="kp-zeile"><span>Dezimal</span><code>${escapeHtml(f.latlng)}</code></div>
      <div class="kp-tasten">
        <button data-kp="kopie">Kopieren</button>
        <button data-kp="zeichen">Zeichen setzen</button>
        <button data-kp="strecke">Neue Strecke ab hier</button>
      </div>
    </div>`;
  const popup = L.popup({ className: 'fbp-popup', maxWidth: 320 })
    .setLatLng(ll).setContent(html).openOn(karte);

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

const slMgrs = $('#sl-mgrs'), slGps = $('#sl-gps'), slDez = $('#sl-dez'), slQuelle = $('#sl-quelle');
const OHNE_KOORD = 'Karte antippen für die Koordinate';

/* Auf einem Touchgerät gibt es kein mousemove – die Leiste blieb dort dauerhaft
   auf „–“. Sie zeigt deshalb die zuletzt angetippte Position und sagt dazu,
   dass es die angetippte und nicht die überfahrene ist. */
let angetippt = null;

function koordZeigen(ll, quelle) {
  slMgrs.textContent = toMGRS(ll.lat, ll.lng, 5);
  slGps.textContent = toDDM(ll.lat, ll.lng);
  slDez.textContent = `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
  slQuelle.textContent = quelle;
}

function koordLeeren() {
  if (angetippt) return koordZeigen(angetippt, 'zuletzt angetippte Position');
  slMgrs.textContent = slGps.textContent = slDez.textContent = '–';
  slQuelle.textContent = OHNE_KOORD;
}

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
   erst den Maßstab verdeckt und dann die Kartenoptionen falsch eingehängt. */
const statusLeiste = document.querySelector('.statusleiste');
const kartenFuss = document.querySelector('.leaflet-bottom.leaflet-right');
const kartenKopf = document.querySelector('.leaflet-top.leaflet-right');
function kartenKantenMessen() {
  const st = document.documentElement.style;
  st.setProperty('--sl-hoehe', statusLeiste.offsetHeight + 'px');
  if (kartenFuss) st.setProperty('--karten-fuss', kartenFuss.offsetHeight + 'px');
  if (kartenKopf) st.setProperty('--karten-kopf', kartenKopf.offsetHeight + 'px');
}
const kantenWaechter = new ResizeObserver(kartenKantenMessen);
kantenWaechter.observe(statusLeiste);
if (kartenFuss) kantenWaechter.observe(kartenFuss);
if (kartenKopf) kantenWaechter.observe(kartenKopf);
kartenKantenMessen();

karte.on('moveend zoomend', () => {
  store.still(p => {
    const c = karte.getCenter();
    p.ansicht = { ...p.ansicht, lat: c.lat, lng: c.lng, zoom: karte.getZoom() };
  });
});

// ---------------------------------------------------------------- Werkzeuge

$('#btn-neue-strecke').onclick = () => sl.zeichenModus ? zeichnenBeenden(false) : neueStreckeStarten();
$('#btn-neues-zeichen').onclick = () => zl.setzModus ? (zl.beendeSetzen(), modusAnzeigen()) : zeichenSetzenStarten();
$('#btn-neuer-abschnitt').onclick = () => abschnittAnlegen();
$('#btn-sammel-pdf').onclick = () => oeffneSammeldruck();

$('#wz-strecke').onclick = () => sl.zeichenModus ? zeichnenBeenden(false) : neueStreckeStarten();
$('#wz-zeichen').onclick = () => zl.setzModus ? (zl.beendeSetzen(), modusAnzeigen()) : zeichenSetzenStarten();
$('#wz-suche').onclick = koordinatenSuche;
$('#wz-standort').onclick = standortZeigen;

let standortMarker = null;
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

const optionsFelder = [
  ['#opt-teillaengen', 'teillaengen'],
  ['#opt-gesamtlaenge', 'gesamtlaenge'],
  ['#opt-punktnummern', 'punktnummern']
];
for (const [sel, schluessel] of optionsFelder) {
  const cb = $(sel);
  cb.checked = !!store.projekt.optionen[schluessel];
  cb.onchange = () => store.aendern(p => { p.optionen[schluessel] = cb.checked; }, 'option');
}
const groesse = $('#opt-symbolgroesse');
groesse.value = store.projekt.optionen.symbolgroesse || 1;
groesse.oninput = () => store.aendern(p => { p.optionen.symbolgroesse = Number(groesse.value); }, 'option');

// ---------------------------------------------------------------- Kopfleiste

const nameFeld = $('#projektname');
nameFeld.value = store.projekt.name;
nameFeld.oninput = () => store.aendern(p => { p.name = nameFeld.value; }, 'formular');

/** Planung als Datei sichern – der einzige Weg, sie aus diesem Browser herauszubekommen */
function planungSichern(pid) {
  if (io.projektExportieren(pid)) hinweis('Planung als Datei gesichert');
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
    'sammel-pdf': () => oeffneSammeldruck(),
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

$('#datei-import').onchange = e => {
  const datei = e.target.files[0];
  if (!datei) return;
  io.projektImportieren(datei)
    .then(({ meldung }) => { schliesseDialog(); hinweis(meldung); })
    .catch(err => hinweis('Import fehlgeschlagen: ' + err.message, 'fehler'));
  e.target.value = '';
};

// ---------------------------------------------------------------- Reiter

document.querySelectorAll('.reiter button').forEach(b => {
  b.onclick = () => reiterWechseln(b.dataset.reiter);
});
/** Auf schmalen Geräten die Karte in den Vordergrund holen */
function zurKarte() {
  if (window.matchMedia('(max-width: 900px)').matches) ansichtSetzen(true);
}

function reiterWechseln(name) {
  document.querySelectorAll('.reiter button').forEach(b => {
    const an = b.dataset.reiter === name;
    b.classList.toggle('aktiv', an);
    b.setAttribute('aria-selected', String(an));
  });
  document.querySelectorAll('.reiter-inhalt').forEach(s =>
    s.classList.toggle('aktiv', s.dataset.inhalt === name));
  ansichtSetzen(false);
}

// ---------------------------------------------------------------- Dialog schließen

$('#dialog').addEventListener('click', e => {
  if (e.target.id === 'dialog' || e.target.dataset.akt === 'dialog-zu') schliesseDialog();
});

// ---------------------------------------------------------------- Tastatur

document.addEventListener('keydown', e => {
  const imFeld = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);

  if (e.key === 'Escape') {
    if (bauauftragOffen()) return schliesseBauauftrag();
    if (!$('#dialog').hidden) return schliesseDialog();
    if (sl.zeichenModus) return zeichnenBeenden(true);
    if (zl.setzModus) { zl.beendeSetzen(); return modusAnzeigen(); }
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
  if (taste === 's') { e.preventDefault(); sl.zeichenModus ? zeichnenBeenden(false) : neueStreckeStarten(); }
  if (taste === 't') { e.preventDefault(); zeichenSetzenStarten(); }
  if (taste === 'k') { e.preventDefault(); koordinatenSuche(); }
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
  zeichneSeite();
}

function zeichneSeite() {
  zeichneStreckenListe();
  zeichneZeichenListe();
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
  modusAnzeigen();

  $('#btn-undo').disabled = !store.undoStapel.length;
  $('#btn-redo').disabled = !store.redoStapel.length;

  if (grund === 'formular') return;    // Eingabefelder nicht neu aufbauen

  if (grund === 'geladen' || grund === 'undo' || grund === 'redo' || grund === 'import') {
    nameFeld.value = p.name;
    basisSelect.value = p.ansicht.basemap;
    setzeBasiskarte(karte, p.ansicht.basemap);
    optionsFelder.forEach(([sel, k]) => { $(sel).checked = !!p.optionen[k]; });
    groesse.value = p.optionen.symbolgroesse || 1;
    if (grund === 'geladen' || grund === 'import') {
      karte.setView([p.ansicht.lat, p.ansicht.lng], p.ansicht.zoom);
      const alle = p.strecken.flatMap(s => s.punkte.map(x => [x.lat, x.lng]))
        .concat(p.zeichen.map(z => [z.lat, z.lng]));
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

// Zugriff aus der Browser-Konsole (Fehlersuche, eigene Auswertungen)
window.fbp = { store, karte, sl, zl };

zeichneAlles();
modusAnzeigen();
speicherstatusZeigen('ruhe');
$('#btn-undo').disabled = true;
$('#btn-redo').disabled = true;

/* Kein Begrüßungsdialog beim ersten Start: Über eine leere Karte gelegt
   beschreibt die Kurzanleitung nichts, was der Nutzer schon gesehen hat.
   Der Hinweis auf die Dateisicherung steht dauerhaft unter der Kopfzeile,
   die Kurzanleitung liegt unter Datei → Kurzanleitung. */
