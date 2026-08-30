// io.js – Sichern, Laden und Austauschformate

import {
  store, migrieren, neueStrecke, neuerPunkt, id, ladeAlle, dateisicherungVermerken,
  abschnittById, streckenIm
} from './state.js';
import { kennzahlen, segmentLaengen, kumuliert } from './strecken.js';
import { toMGRS, toDDM, peilung } from './geo.js';
import { symbolById, symbolBekannt, STANDARD_SYMBOL } from './symbols.js';
import { querungsartById } from './vorschrift.js';

/* Klartext der Querungsart. An allen anderen Punktarten bleibt die Angabe leer –
   der mitgeführte Wert gehört dort nicht in die Ausgabe. */
const querungsartText = pt => pt.art === 'querung' ? querungsartById(pt.querungsart).name : '';

function dateiname(teile, endung) {
  return teile.filter(Boolean).join('_')
    .replace(/[^\wäöüÄÖÜß.\- ]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) + '.' + endung;
}

function herunterladen(inhalt, name, typ = 'application/json') {
  const blob = new Blob([inhalt], { type: typ + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------- Projektdatei

/** Planung als .json sichern. Ohne Angabe die geöffnete, sonst eine beliebige
 *  aus dem Browserspeicher (z. B. vor dem Löschen aus der Planungsliste). */
export function projektExportieren(pid) {
  const p = (!pid || pid === store.projekt.id) ? store.projekt : ladeAlle()[pid];
  if (!p) return false;
  herunterladen(JSON.stringify(p, null, 2),
    dateiname(['Fernmeldebauplanung', p.name, p.kopf?.datum], 'json'));
  dateisicherungVermerken(p.id);
  store.melden('dateisicherung');
  return true;
}

/** Einen Einsatzabschnitt als eigenständige Planungsdatei sichern – `null`
 *  nimmt die nicht zugeteilten Strecken. Der Empfänger lädt sie über
 *  „Planung aus Datei laden“ und arbeitet nur an seinem Ausschnitt weiter.
 *
 *  Die taktischen Zeichen gehen vollständig mit: sie sind das gemeinsame
 *  Lagebild und nicht einem Abschnitt zugeteilt. Der Vermerk über die letzte
 *  Dateisicherung bleibt unberührt – ein Ausschnitt sichert nicht die Planung. */
export function abschnittExportieren(aid) {
  const p = store.projekt;
  const ea = abschnittById(p, aid);
  const strecken = streckenIm(p, aid);
  if (!strecken.length) return false;
  const bezeichnung = ea ? ea.name : 'Ohne Einsatzabschnitt';
  const jetzt = new Date().toISOString();

  const teil = {
    ...p,
    id: id(),
    name: `${p.name} – ${bezeichnung}`,
    erstellt: jetzt,
    geaendert: jetzt,
    einsatzabschnitte: ea ? [ea] : [],
    strecken,
    herkunft: {
      projekt: p.name,
      projektId: p.id,
      einsatzabschnitt: bezeichnung,
      erzeugt: jetzt
    }
  };
  herunterladen(JSON.stringify(teil, null, 2),
    dateiname(['Fernmeldebauplanung', p.name, bezeichnung, p.kopf?.datum], 'json'));
  return true;
}

export function projektImportieren(datei) {
  return new Promise((erfolg, fehler) => {
    const leser = new FileReader();
    leser.onload = () => {
      try {
        const roh = JSON.parse(leser.result);
        if (roh.type === 'FeatureCollection') return erfolg(geoJSONUebernehmen(roh, datei.name));
        if (!roh.strecken && !roh.zeichen) throw new Error('Keine Planungsdaten in der Datei gefunden.');
        const p = migrieren(roh);
        p.id = id();                     // als eigene Kopie ablegen
        p.name = roh.name || datei.name.replace(/\.json$/i, '');
        store.uebernehmen(p);
        erfolg(p);
      } catch (e) { fehler(e); }
    };
    leser.onerror = () => fehler(new Error('Datei konnte nicht gelesen werden.'));
    leser.readAsText(datei);
  });
}

function geoJSONUebernehmen(fc, name) {
  store.aendern(p => {
    for (const f of fc.features || []) {
      const g = f.geometry || {};
      const eig = f.properties || {};
      if (g.type === 'LineString' && g.coordinates.length >= 2) {
        const s = neueStrecke(p);
        s.name = eig.name || eig.Name || s.name;
        if (eig.farbe) s.farbe = eig.farbe;
        s.punkte = g.coordinates.map(([lng, lat]) => neuerPunkt(lat, lng));
        if (s.punkte.length) { s.punkte[0].art = 'start'; s.punkte[s.punkte.length - 1].art = 'ziel'; }
        p.strecken.push(s);
      } else if (g.type === 'Point') {
        p.zeichen.push({
          id: id(), lat: g.coordinates[1], lng: g.coordinates[0],
          symbol: symbolBekannt(eig.symbol) ? eig.symbol : STANDARD_SYMBOL,
          drehung: 0, groesse: 1,
          label: eig.name || eig.label || '', bemerkung: eig.bemerkung || '', sichtbar: true
        });
      }
    }
  }, 'import');
  return store.projekt;
}

// ---------------------------------------------------------------- GeoJSON

export function geoJSON(nurStrecke = null) {
  const p = store.projekt;
  const features = [];
  for (const s of p.strecken) {
    if (nurStrecke && s.id !== nurStrecke) continue;
    const k = kennzahlen(s);
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: s.punkte.map(x => [x.lng, x.lat]) },
      properties: {
        name: s.name, von: s.von, nach: s.nach, farbe: s.farbe,
        kabeltyp: k.kabel.name, verlegeart: s.verlegeart,
        trassenlaenge_m: Math.round(k.trasse), zuschlag_prozent: k.zuschlag,
        kabelbedarf_m: Math.round(k.bedarf), trommeln: k.trommeln,
        ...(k.strom ? {
          netzform: k.strom.netz.name,
          betriebsstrom_a: Math.round(k.strom.strom * 10) / 10,
          querschnitt_mm2: k.strom.querschnitt
        } : {}),
        stroke: s.farbe, 'stroke-width': 4
      }
    });
    s.punkte.forEach((pt, i) => features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
      properties: {
        strecke: s.name, nummer: i + 1, art: pt.art, querungsart: querungsartText(pt),
        name: pt.name, bemerkung: pt.bemerkung, mgrs: toMGRS(pt.lat, pt.lng, 5)
      }
    }));
  }
  if (!nurStrecke) {
    for (const z of p.zeichen) features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [z.lng, z.lat] },
      properties: {
        name: z.label || symbolById(z.symbol).name, symbol: z.symbol,
        bemerkung: z.bemerkung, mgrs: toMGRS(z.lat, z.lng, 5)
      }
    });
  }
  return { type: 'FeatureCollection', name: p.name, features };
}

export function geoJSONExportieren(nurStrecke = null) {
  const p = store.projekt;
  const s = nurStrecke ? store.strecke(nurStrecke) : null;
  herunterladen(JSON.stringify(geoJSON(nurStrecke), null, 2),
    dateiname(['Fernmeldebau', p.name, s && s.name], 'geojson'));
}

// ---------------------------------------------------------------- GPX (Hand-GPS)

export function gpxExportieren(sid = null) {
  const p = store.projekt;
  const strecken = sid ? [store.strecke(sid)] : p.strecken;
  const esc = t => String(t ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

  const wpts = strecken.flatMap(s => s.punkte.map((pt, i) =>
    `  <wpt lat="${pt.lat.toFixed(7)}" lon="${pt.lng.toFixed(7)}">
    <name>${esc(s.name)} ${i + 1}</name>
    <desc>${esc([pt.name, pt.art, querungsartText(pt), toMGRS(pt.lat, pt.lng, 5)].filter(Boolean).join(' · '))}</desc>
    <sym>Waypoint</sym>
  </wpt>`)).join('\n');

  const trks = strecken.map(s => `  <trk>
    <name>${esc(s.name)}</name>
    <desc>${esc(`${kennzahlen(s).kabel.name} · Trasse ${Math.round(kennzahlen(s).trasse)} m`)}</desc>
    <trkseg>
${s.punkte.map(pt => `      <trkpt lat="${pt.lat.toFixed(7)}" lon="${pt.lng.toFixed(7)}"/>`).join('\n')}
    </trkseg>
  </trk>`).join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Fernmeldebauplaner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(p.name)}</name><time>${new Date().toISOString()}</time></metadata>
${wpts}
${trks}
</gpx>`;
  const s = sid ? store.strecke(sid) : null;
  herunterladen(gpx, dateiname(['Fernmeldebau', p.name, s && s.name], 'gpx'), 'application/gpx+xml');
}

// ---------------------------------------------------------------- CSV

export function csvExportieren(sid) {
  const p = store.projekt;
  const s = store.strecke(sid);
  if (!s) return;
  const seg = segmentLaengen(s), kum = kumuliert(s.punkte);
  const zeilen = [[
    'Nr', 'Art', 'Querungsart', 'Bezeichnung', 'MGRS', 'GPS Grad/Dez.-Min.', 'Breite', 'Länge',
    'Teilstrecke_m', 'ab_Anfang_m', 'Richtung_Grad', 'Bemerkung'
  ]];
  s.punkte.forEach((pt, i) => zeilen.push([
    i + 1, pt.art, querungsartText(pt), pt.name || '',
    toMGRS(pt.lat, pt.lng, 5), toDDM(pt.lat, pt.lng),
    pt.lat.toFixed(6).replace('.', ','), pt.lng.toFixed(6).replace('.', ','),
    i === 0 ? '' : Math.round(seg[i - 1]),
    Math.round(kum[i]),
    i === 0 ? '' : Math.round(peilung(s.punkte[i - 1], pt)),
    pt.bemerkung || ''
  ]));
  const csv = '﻿' + zeilen.map(z => z.map(w => {
    const t = String(w);
    return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }).join(';')).join('\r\n');
  herunterladen(csv, dateiname(['Punktliste', p.name, s.name], 'csv'), 'text/csv');
}
