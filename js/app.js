// app.js – Zusammenbau: Karte, Layer, Bedienung, Tastatur

import { store, neueStrecke, neuerPunkt, neuesZeichen } from './state.js';
import { erstelleKarte, setzeBasiskarte, BASISKARTEN } from './map.js';
import { StreckenLayer, escapeHtml } from './strecken.js';
import { ZeichenLayer } from './zeichen.js';
import { toMGRS, toDDM, alleFormate } from './geo.js';
import * as io from './io.js';
import {
  initUI, zeichneStreckenListe, zeichneZeichenListe, zeichneProjektReiter,
  symbolPalette, koordinatenSuche, hilfeDialog, projektDialog, dialog, schliesseDialog, hinweis
} from './ui.js';
import { bauauftragOffen, schliesseBauauftrag } from './bauauftrag.js';

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

initUI({ karte, sl, zl, weiterzeichnen, zurKarte, aufAenderung: () => {} });

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
  if (abbrechen && s && s.punkte.length === 0) {
    store.aendern(p => { p.strecken = p.strecken.filter(x => x.id !== sid); }, 'strecke');
  } else if (s && s.punkte.length === 1) {
    hinweis('Eine Strecke braucht mindestens zwei Punkte.', 'warnung');
  }
  modusAnzeigen();
  zeichneSeite();
}

function zeichenSetzenStarten() {
  symbolPalette(symbolId => {
    zeichnenBeenden(true);
    zl.starteSetzen(symbolId);
    zurKarte();
    modusAnzeigen();
    hinweis('Auf die Karte klicken, um das Zeichen zu setzen.');
  });
}

function modusAnzeigen() {
  const zeichnet = !!sl.zeichenModus;
  const setzt = !!zl.setzModus;
  $('#wz-strecke').classList.toggle('aktiv', zeichnet);
  $('#wz-zeichen').classList.toggle('aktiv', setzt);

  const box = $('#zeichen-hinweis');
  box.hidden = !zeichnet;
  if (zeichnet) {
    const s = store.strecke(sl.zeichenModus);
    const n = s ? s.punkte.length : 0;
    box.querySelector('.zh-text').innerHTML =
      `<b>${escapeHtml(s ? s.name : '')}</b> – ${n} ${n === 1 ? 'Punkt' : 'Punkte'} gesetzt.
       Trasse auf der Karte anklicken.`;
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
            z.org = p.optionen.letzteOrg || 'thw';
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

const slMgrs = $('#sl-mgrs'), slGps = $('#sl-gps'), slDez = $('#sl-dez');
karte.on('mousemove', e => {
  slMgrs.textContent = toMGRS(e.latlng.lat, e.latlng.lng, 5);
  slGps.textContent = toDDM(e.latlng.lat, e.latlng.lng);
  slDez.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
});
karte.on('mouseout', () => { slMgrs.textContent = slGps.textContent = slDez.textContent = '–'; });

karte.on('moveend zoomend', () => {
  store.still(p => {
    const c = karte.getCenter();
    p.ansicht = { ...p.ansicht, lat: c.lat, lng: c.lng, zoom: karte.getZoom() };
  });
});

// ---------------------------------------------------------------- Werkzeuge

$('#btn-neue-strecke').onclick = () => sl.zeichenModus ? zeichnenBeenden(false) : neueStreckeStarten();
$('#btn-neues-zeichen').onclick = () => zl.setzModus ? (zl.beendeSetzen(), modusAnzeigen()) : zeichenSetzenStarten();

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

$('#btn-undo').onclick = () => { if (!store.undo()) hinweis('Nichts zum Rückgängigmachen.'); };
$('#btn-redo').onclick = () => { if (!store.redo()) hinweis('Nichts zum Wiederholen.'); };
$('#btn-seite').onclick = () => document.body.classList.toggle('seite-zu');

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
    'export-json': io.projektExportieren,
    'import-json': () => $('#datei-import').click(),
    'export-geojson': () => io.geoJSONExportieren(),
    'export-gpx': () => io.gpxExportieren(),
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
    .then(p => { schliesseDialog(); hinweis(`„${p.name}“ geladen`); })
    .catch(err => hinweis('Import fehlgeschlagen: ' + err.message, 'fehler'));
  e.target.value = '';
};

// ---------------------------------------------------------------- Reiter

document.querySelectorAll('.reiter button').forEach(b => {
  b.onclick = () => reiterWechseln(b.dataset.reiter);
});
/** Auf schmalen Geräten die Karte in den Vordergrund holen */
function zurKarte() {
  if (window.matchMedia('(max-width: 900px)').matches) {
    document.body.classList.add('seite-zu');
  }
}

function reiterWechseln(name) {
  document.querySelectorAll('.reiter button').forEach(b =>
    b.classList.toggle('aktiv', b.dataset.reiter === name));
  document.querySelectorAll('.reiter-inhalt').forEach(s =>
    s.classList.toggle('aktiv', s.dataset.inhalt === name));
  document.body.classList.remove('seite-zu');
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
    if (sl.auswahl) { e.preventDefault(); import('./bauauftrag.js').then(m => m.oeffneBauauftrag(sl.auswahl)); }
    return;
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

let speicherTimer = null;
store.on((p, grund) => {
  if (grund === 'gespeichert') {
    const st = $('#speicherstatus');
    st.textContent = 'gespeichert';
    st.classList.remove('offen');
    return;
  }
  if (grund === 'speicherfehler') {
    const st = $('#speicherstatus');
    st.textContent = 'nicht gespeichert!';
    st.classList.add('fehler');
    hinweis('Speichern im Browser fehlgeschlagen – Planung als Datei sichern!', 'fehler');
    return;
  }

  const st = $('#speicherstatus');
  st.textContent = 'wird gesichert …';
  st.classList.add('offen');

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

window.addEventListener('beforeunload', () => store.speichern());

// Zugriff aus der Browser-Konsole (Fehlersuche, eigene Auswertungen)
window.fbp = { store, karte, sl, zl };

zeichneAlles();
modusAnzeigen();
$('#btn-undo').disabled = true;
$('#btn-redo').disabled = true;

// Beim allerersten Start eine kurze Orientierung anbieten
if (!store.projekt.strecken.length && !store.projekt.zeichen.length &&
    !localStorage.getItem('fbp.begruessung')) {
  localStorage.setItem('fbp.begruessung', '1');
  setTimeout(hilfeDialog, 400);
}
