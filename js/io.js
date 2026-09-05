// io.js – Sichern, Laden und Austauschformate

import {
  store, migrieren, neueStrecke, neuerPunkt, neuesZeichen, id, ladeAlle, dateisicherungVermerken,
  abschnittById, zeichengruppeById, streckenIm, zeichenIm, zeichenFuer, flaechenIm, flaechenFuer,
  punktartById, VERLEGEARTEN, KABELTYPEN
} from './state.js';
import { kennzahlen, segmentLaengen, kumuliert } from './strecken.js';
import { toMGRS, toDDM, peilung } from './geo.js';
import { bandById, funkstrecke, azimutText } from './richtfunk.js';
import { symbolById, symbolBekannt, STANDARD_SYMBOL } from './symbols.js';
import { querungsartById, bauweiseById, querungsMinuten } from './vorschrift.js';
import { kmlLesen, kmlSchreiben, kmlAusKMZ, istKMZ, alsText } from './kml.js';
import { alsDatenUrls, ausDatei as bilderAusDatei } from './bildspeicher.js';
import { flaechenEcken, flaechenTitel, flaechenartById, masseText } from './flaechen.js';

/* Klartext der Querungsart. An allen anderen Punktarten bleibt die Angabe leer –
   der mitgeführte Wert gehört dort nicht in die Ausgabe. */
const querungsartText = pt => pt.art === 'querung' ? querungsartById(pt.querungsart).name : '';
/* Bauweise und Zeitansatz gehören zur Querung wie ihre Art: ohne sie wüsste
   der Empfänger der Datei nicht, wo Stangen zu stellen sind. */
const bauweiseText = pt => pt.art === 'querung' ? bauweiseById(pt.bauweise).name : '';
const querungszeitText = pt => pt.art === 'querung' ? `${querungsMinuten(pt)} min` : '';

/* Was eine Funkstrecke in einer Austauschdatei ausmacht. Sie führt wie ein Kabel
   von Punkt zu Punkt, aber ohne Trasse: maßgebend ist die Luftlinie zwischen
   Anfangs- und Endpunkt, nicht die Summe der Teilstrecken. Der Azimut steht dabei
   als rechtweisend gekennzeichnet – in einer Datei, die auch in einem Hand-GPS
   landet, wäre eine nackte Gradzahl neben der Missweisung eine Falle. */
function funkAngaben(s, k) {
  const f = funkstrecke(s);
  const v = s.richtfunk || {};
  return {
    luftlinie_m: f ? Math.round(f.distanz) : Math.round(k.trasse),
    band: bandById(v.band).kurz,
    bandbreite_mhz: v.bandbreite,
    kanal: v.kanal || '',
    mimo: v.mimo,
    polarisation: v.polarisation,
    ...(f ? { azimut_grad_rechtweisend: Math.round(f.azimut[0]) } : {})
  };
}

function funkZeilen(s) {
  const f = funkstrecke(s);
  const v = s.richtfunk || {};
  return [
    f && `Luftlinie ${Math.round(f.distanz)} m · ${azimutText(f.azimut[0], f.richtung[0])} rw`,
    `${bandById(v.band).kurz} · ${v.bandbreite} MHz${v.kanal ? ` · Kanal ${v.kanal}` : ''}`
  ].filter(Boolean);
}

/* Der eigene Export soll wieder hereinkommen, sonst ist der Umweg über Google
   Earth eine Einbahnstraße: eine Funkstrecke käme als Kabelstrecke zurück und
   bekäme Trommeln und Bauzuschlag angehängt. Erkannt wird über den ausgegebenen
   Klartextnamen, weil der auch in einer von Hand bearbeiteten Datei stehen bleibt;
   die Kennung selbst steht dort nicht. */
function kabeltypAusText(text) {
  if (!text) return null;
  const gesucht = String(text).trim().toLowerCase();
  const treffer = KABELTYPEN.find(k =>
    k.name.toLowerCase() === gesucht || k.kurz.toLowerCase() === gesucht || k.id === gesucht);
  return treffer ? treffer.id : null;
}

function gpxStreckenText(s) {
  const k = kennzahlen(s);
  if (!k.kabel.funk) return `${k.kabel.name} · Trasse ${Math.round(k.trasse)} m`;
  const f = funkstrecke(s);
  return `${k.kabel.name} · Luftlinie ${Math.round(f ? f.distanz : k.trasse)} m`;
}

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
export async function projektExportieren(pid) {
  const p = (!pid || pid === store.projekt.id) ? store.projekt : ladeAlle()[pid];
  if (!p) return false;
  const gesichert = { ...p, bilder: await bilderEinpacken(p.bilder) };
  herunterladen(JSON.stringify(gesichert, null, 2),
    dateiname(['Fernmeldebauplanung', p.name, p.kopf?.datum], 'json'));
  dateisicherungVermerken(p.id);
  store.melden('dateisicherung');
  return true;
}

/* Die Bilddaten liegen im Bildspeicher des Geräts, nicht in der Planung. In
   die Sicherungsdatei gehören sie trotzdem: sie ist der einzige Weg, eine
   Planung aus diesem Browser herauszubekommen, und die Anwendung mahnt zu ihr.
   Eine Sicherung, die die Bilder vom Bauort zurückließe, wäre keine.
   Fehlt zu einem Eintrag das Bild – etwa nach dem Aufräumen –, reist er ohne
   Bilddaten mit; der Ort und die Beschriftung bleiben so erhalten. */
async function bilderEinpacken(liste = []) {
  const raus = [];
  for (const b of liste) {
    const daten = await alsDatenUrls(b.id);
    raus.push(daten ? { ...b, ...daten } : b);
  }
  return raus;
}

/** Einen Einsatzabschnitt zu einer eigenständigen Planung zuschneiden – `null`
 *  nimmt die nicht zugeteilten Strecken. Ohne Lichtbilddaten; wer sie tragen
 *  kann, hängt sie selbst an. Liefert `false`, wenn der Ausschnitt leer wäre.
 *  Von hier führen zwei Wege weiter: als Datei über `abschnittExportieren()`
 *  oder als Link über `js/teilen.js`. Der Empfänger arbeitet in beiden Fällen
 *  nur an seinem Ausschnitt weiter.
 *
 *  Mit gehen die Zeichen dieses Abschnitts und dazu die nicht zugeteilten:
 *  die sind das gemeinsame Lagebild und würden dem Empfänger sonst fehlen.
 *  Ohne Abschnitt bleiben genau die nicht zugeteilten übrig – Zeichen fremder
 *  Abschnitte gehören nicht in einen Ausschnitt, der weitergegeben wird.
 *  Der Vermerk über die letzte Dateisicherung bleibt unberührt – ein Ausschnitt
 *  sichert nicht die Planung. */
export function abschnittAlsProjekt(aid) {
  const p = store.projekt;
  const ea = abschnittById(p, aid);
  const strecken = streckenIm(p, aid);
  if (!strecken.length && !zeichenIm(p, aid).length && !flaechenIm(p, aid).length) return false;
  const bezeichnung = ea ? ea.name : 'Ohne Einsatzabschnitt';
  const jetzt = new Date().toISOString();
  const zeichen = aid ? zeichenFuer(p, aid) : zeichenIm(p, aid);
  /* Nur die Gruppen, die in diesem Ausschnitt vorkommen: eine leere Gruppe
     träfe beim Empfänger auf nichts, ihr Auge schaltete ins Leere. */
  const benutzt = new Set(zeichen.map(z => z.gruppe).filter(Boolean));

  const teil = {
    ...p,
    id: id(),
    name: `${p.name} – ${bezeichnung}`,
    erstellt: jetzt,
    geaendert: jetzt,
    einsatzabschnitte: ea ? [ea] : [],
    zeichengruppen: (p.zeichengruppen || []).filter(g => benutzt.has(g.id)),
    strecken,
    zeichen,
    // Die Flächen folgen derselben Regel wie die Zeichen.
    flaechen: aid ? flaechenFuer(p, aid) : flaechenIm(p, aid),
    herkunft: {
      projekt: p.name,
      projektId: p.id,
      einsatzabschnitt: bezeichnung,
      erzeugt: jetzt
    }
  };
  return teil;
}

/** Denselben Ausschnitt als Datei sichern. Die Lichtbilder kommen erst hier
 *  dazu: sie sind keinem Abschnitt zugeteilt und gehören deshalb – wie die
 *  nicht zugeteilten Zeichen – zu jedem Ausschnitt. Der Ausschnitt wird dadurch
 *  so schwer wie die ganze Planung; das ist der Preis dafür, dass der Empfänger
 *  sieht, wie es an der Stelle aussieht. Ein Link kann diesen Preis nicht
 *  zahlen und nimmt darum nur den Zuschnitt oben. */
export async function abschnittExportieren(aid) {
  const p = store.projekt;
  const teil = abschnittAlsProjekt(aid);
  if (!teil) return false;
  teil.bilder = await bilderEinpacken(p.bilder);
  herunterladen(JSON.stringify(teil, null, 2),
    dateiname(['Fernmeldebauplanung', p.name, teil.herkunft.einsatzabschnitt, p.kopf?.datum], 'json'));
  return true;
}

/**
 * Nimmt eine Datei entgegen und erkennt am Inhalt, was darin steht: eine eigene
 * Planung, GeoJSON, KML oder ein gepacktes KMZ. Die Endung entscheidet bewusst
 * nicht mit – Dateien aus fremden Werkzeugen tragen oft eine andere.
 * @returns {Promise<{projekt: object, meldung: string}>}
 */
export async function projektImportieren(datei) {
  let puffer;
  try { puffer = await datei.arrayBuffer(); }
  catch { throw new Error('Datei konnte nicht gelesen werden.'); }

  if (istKMZ(puffer)) return kmlUebernehmen(await kmlAusKMZ(puffer), datei.name);

  const inhalt = alsText(puffer);
  if (/^\s*[[{]/.test(inhalt)) return await jsonUebernehmen(inhalt, datei.name);
  if (/<kml[\s>]/i.test(inhalt)) return kmlUebernehmen(inhalt, datei.name);
  throw new Error('Unbekanntes Format – erwartet werden .json, .geojson, .kml oder .kmz.');
}

async function jsonUebernehmen(inhalt, dateiname) {
  const roh = JSON.parse(inhalt);
  if (roh.type === 'FeatureCollection') return geoJSONUebernehmen(roh);
  if (!roh.strecken && !roh.zeichen && !roh.flaechen) throw new Error('Keine Planungsdaten in der Datei gefunden.');
  /* Erst die Bilddaten in den Bildspeicher, dann die Planung öffnen: sonst
     stünden für einen Augenblick Bildpunkte auf der Karte, hinter denen nichts
     liegt. Bilder, die der Speicher nicht annimmt, fehlen – der Eintrag bleibt
     und lässt sich später neu belegen. */
  const bilder = (roh.bilder || []).length;
  const uebernommen = bilder ? await bilderAusDatei(roh.bilder) : 0;
  const p = migrieren(roh);
  p.id = id();                       // als eigene Kopie ablegen
  p.name = roh.name || dateiname.replace(/\.json$/i, '');
  store.uebernehmen(p);
  const fehlend = bilder - uebernommen;
  return {
    projekt: p,
    meldung: `„${p.name}“ geladen` +
      (fehlend > 0 ? ` – ${fehlend} ${fehlend === 1 ? 'Bild' : 'Bilder'} ohne Bilddaten` : '')
  };
}

/** „2 Strecken und 5 Zeichen“ – die Rückmeldung nach einem Import. */
function bericht(strecken, zeichen) {
  return [
    strecken && (strecken === 1 ? '1 Strecke' : `${strecken} Strecken`),
    zeichen && (zeichen === 1 ? '1 Zeichen' : `${zeichen} Zeichen`)
  ].filter(Boolean).join(' und ');
}

function geoJSONUebernehmen(fc) {
  const brauchbar = (fc.features || []).filter(f => {
    const g = f.geometry || {};
    return g.type === 'Point' || (g.type === 'LineString' && g.coordinates?.length >= 2);
  });
  if (!brauchbar.length) throw new Error('Keine Linien und keine Punkte in der Datei gefunden.');

  let strecken = 0, zeichen = 0;
  store.aendern(p => {
    for (const f of brauchbar) {
      const g = f.geometry || {};
      const eig = f.properties || {};
      if (g.type === 'LineString' && g.coordinates.length >= 2) {
        const s = neueStrecke(p);
        s.name = eig.name || eig.Name || s.name;
        if (eig.farbe) s.farbe = eig.farbe;
        if (eig.von) s.von = eig.von;
        if (eig.nach) s.nach = eig.nach;
        const art = kabeltypAusText(eig.kabeltyp);
        if (art) s.kabeltyp = art;
        if (eig.verlegeart && VERLEGEARTEN.some(v => v.id === eig.verlegeart)) {
          s.verlegeart = eig.verlegeart;
        }
        s.punkte = g.coordinates.map(([lng, lat]) => neuerPunkt(lat, lng));
        if (s.punkte.length) { s.punkte[0].art = 'start'; s.punkte[s.punkte.length - 1].art = 'ziel'; }
        p.strecken.push(s);
        strecken++;
      } else if (g.type === 'Point') {
        p.zeichen.push({
          id: id(), lat: g.coordinates[1], lng: g.coordinates[0],
          symbol: symbolBekannt(eig.symbol) ? eig.symbol : STANDARD_SYMBOL,
          drehung: 0, groesse: 1,
          label: eig.name || eig.label || '', bemerkung: eig.bemerkung || '', sichtbar: true
        });
        zeichen++;
      }
    }
  }, 'import');
  return { projekt: store.projekt, meldung: `${bericht(strecken, zeichen)} übernommen` };
}

// ---------------------------------------------------------------- KML / KMZ

/**
 * Eine Ortsmarke aus Google Earth sagt nichts über ihren Zweck. „Stelle“ ist
 * das Zeichen, das am wenigsten behauptet; im Reiter „Zeichen“ ist es mit zwei
 * Griffen gegen das richtige getauscht.
 */
const KML_ZEICHEN = symbolBekannt('einrichtungen/stelle') ? 'einrichtungen/stelle' : STANDARD_SYMBOL;

/** Pfade werden Strecken, Ortsmarken Zeichen – beides kommt zur offenen Planung hinzu. */
function kmlUebernehmen(inhalt, dateiname) {
  const kml = kmlLesen(inhalt);
  if (!kml.linien.length && !kml.punkte.length) throw new Error(kml.netzverweise
    ? 'Diese KML verweist nur auf andere Dateien (NetworkLink) und enthält selbst nichts.'
    : 'Keine Pfade und keine Ortsmarken in der Datei gefunden.');

  store.aendern(p => {
    for (const linie of kml.linien) {
      const s = neueStrecke(p);
      if (linie.name) s.name = linie.name;
      if (linie.farbe) s.farbe = linie.farbe;
      s.bemerkung = linie.beschreibung;
      s.punkte = linie.koordinaten.map(([lat, lng]) => neuerPunkt(lat, lng));
      s.punkte[0].art = 'start';
      s.punkte[s.punkte.length - 1].art = 'ziel';
      p.strecken.push(s);
    }
    for (const pt of kml.punkte) {
      const z = neuesZeichen(pt.lat, pt.lng, KML_ZEICHEN);
      z.label = pt.name;
      z.bemerkung = pt.beschreibung;
      p.zeichen.push(z);
    }
  }, 'import');

  return {
    projekt: store.projekt,
    meldung: `${bericht(kml.linien.length, kml.punkte.length)} aus „${dateiname}“ übernommen`
  };
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
        kabeltyp: k.kabel.name,
        /* Die Funkstrecke wird nicht verlegt: Verlegeart, Bauzuschlag, Bedarf und
           Trommeln wären dort erfundene Werte – der Empfänger der Datei läse sie
           als Materialansatz. An ihrer Stelle steht, was die Strecke ausmacht. */
        ...(k.kabel.funk ? funkAngaben(s, k) : {
          verlegeart: s.verlegeart,
          trassenlaenge_m: Math.round(k.trasse), zuschlag_prozent: k.zuschlag,
          kabelreserve_m: Math.round(k.reserve),
          kabelbedarf_m: Math.round(k.bedarf), trommeln: k.trommeln
        }),
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
        bauweise: bauweiseText(pt), querungszeit: querungszeitText(pt),
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
        gruppe: (zeichengruppeById(p, z.gruppe) || {}).name || '',
        bemerkung: z.bemerkung, mgrs: toMGRS(z.lat, z.lng, 5)
      }
    });
    /* Eine Fläche wird zum Polygon aus ihren vier Ecken – so sieht sie in
       jedem GIS so aus wie hier; Maße und Drehung stehen dazu in den
       Eigenschaften, damit sich der Grundriss auch nachrechnen lässt. */
    for (const f of p.flaechen || []) {
      const ecken = flaechenEcken(f).map(([lat, lng]) => [lng, lat]);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...ecken, ecken[0]]] },
        properties: {
          name: flaechenTitel(f), art: flaechenartById(f.art).name,
          breite_m: f.breite, laenge_m: f.laenge, drehung_grad: f.drehung || 0,
          bemerkung: f.bemerkung, mgrs: toMGRS(f.lat, f.lng, 5),
          stroke: f.farbe, fill: f.farbe, 'fill-opacity': 0.25
        }
      });
    }
  }
  return { type: 'FeatureCollection', name: p.name, features };
}

export function geoJSONExportieren(nurStrecke = null) {
  const p = store.projekt;
  const s = nurStrecke ? store.strecke(nurStrecke) : null;
  herunterladen(JSON.stringify(geoJSON(nurStrecke), null, 2),
    dateiname(['Fernmeldebau', p.name, s && s.name], 'geojson'));
}

// ---------------------------------------------------------------- KML (Google Earth)

/* Was eine Strecke ausmacht, steht in Google Earth in der Sprechblase des Pfades –
   dieselben Angaben, die im Bauauftrag über der Punktliste stehen. */
function streckenAngaben(s) {
  const k = kennzahlen(s);
  const ea = abschnittById(store.projekt, s.abschnitt);
  return [
    s.von && s.nach ? `${s.von} → ${s.nach}` : (s.von || s.nach),
    k.kabel.funk ? k.kabel.name
      : `${k.kabel.name} · ${(VERLEGEARTEN.find(v => v.id === s.verlegeart) || {}).name || ''}`,
    ...(k.kabel.funk ? funkZeilen(s) : [
      `Trasse ${Math.round(k.trasse)} m · Bedarf ${Math.round(k.bedarf)} m (${k.zuschlag} % Zuschlag` +
        `${k.reserve > 0 ? `, ${Math.round(k.reserve)} m Reserve` : ''})`,
      `${k.trommeln} ${k.trommeln === 1 ? 'Trommel' : 'Trommeln'} à ${k.trommellaenge} m`
    ]),
    k.strom && `${k.strom.netz.name} · ${Math.round(k.strom.strom * 10) / 10} A · ${k.strom.querschnitt} mm²`,
    ea && `Einsatzabschnitt: ${ea.name}`,
    s.trupp && `Trupp: ${s.trupp}`,
    s.bemerkung
  ];
}

/* Jeder Stützpunkt der Linie als eigene Ortsmarke wäre ein Nadelwald über der
   Trasse. Mit kommen die Punkte, die etwas zu sagen haben: Anfang und Ende, jede
   bauliche Besonderheit und jeder Punkt, den der Planer benannt oder mit einer
   Bemerkung versehen hat. */
const punktZeigen = (pt, i, anzahl) =>
  i === 0 || i === anzahl - 1 || pt.art !== 'punkt' || pt.name || pt.bemerkung;

function punktEintraege(s) {
  const kum = kumuliert(s.punkte);
  return s.punkte
    .map((pt, i) => ({ pt, i }))
    .filter(({ pt, i }) => punktZeigen(pt, i, s.punkte.length))
    .map(({ pt, i }) => ({
      art: 'punkt',
      name: `${i + 1} ${pt.name || punktartById(pt.art).name}`,
      farbe: s.farbe,
      lat: pt.lat, lng: pt.lng,
      beschreibung: [
        `${punktartById(pt.art).name}${querungsartText(pt) ? ` · ${querungsartText(pt)}` : ''}${
          bauweiseText(pt) ? ` · ${bauweiseText(pt)} (${querungszeitText(pt)})` : ''}`,
        `MGRS ${toMGRS(pt.lat, pt.lng, 5)}`,
        toDDM(pt.lat, pt.lng),
        i === 0 ? null : `${Math.round(kum[i])} m ab Anfang der Strecke`,
        pt.bemerkung
      ]
    }));
}

/* Ein Ordner je Strecke: in Google Earth lässt sich damit eine einzelne Trasse
   samt ihren Punkten ein- und ausblenden. */
const streckenOrdner = s => ({
  name: s.name,
  sichtbar: s.sichtbar,
  /* Die Angaben stehen am Pfad selbst – dort öffnet der Klick in Google Earth
     die Sprechblase. Am Ordner wären sie ein zweites Mal dasselbe. */
  eintraege: [
    {
      art: 'linie', name: s.name, farbe: s.farbe, sichtbar: s.sichtbar,
      beschreibung: streckenAngaben(s),
      koordinaten: s.punkte.map(pt => [pt.lat, pt.lng])
    },
    ...punktEintraege(s)
  ]
});

const zeichenEintraege = (zeichen, farbe) => zeichen.map(z => ({
  art: 'punkt',
  name: z.label || symbolById(z.symbol).name,
  farbe: farbe || '#455a64',
  sichtbar: z.sichtbar,
  lat: z.lat, lng: z.lng,
  beschreibung: [symbolById(z.symbol).name, `MGRS ${toMGRS(z.lat, z.lng, 5)}`, z.bemerkung]
}));

/* Je Zeichengruppe ein Unterordner: in Google Earth schaltet ihn derselbe Haken
   ein und aus wie im Planer das Auge der Gruppe. Innerhalb der Gruppe trägt ihre
   eigene Farbe – sie ist es, die den Ordner benennt; was ungruppiert bleibt,
   behält die Farbe des Abschnitts. Leere Ordner lässt `kmlSchreiben` weg. */
function zeichenOrdner(zeichen, farbe) {
  const gruppen = store.projekt.zeichengruppen || [];
  const ordner = { name: 'Taktische Zeichen', offen: false };
  if (!gruppen.length) return { ...ordner, eintraege: zeichenEintraege(zeichen, farbe) };
  return {
    ...ordner,
    ordner: gruppen.map(g => ({
      name: g.name,
      sichtbar: g.sichtbar,
      beschreibung: [g.bemerkung],
      eintraege: zeichenEintraege(zeichen.filter(z => z.gruppe === g.id), g.farbe)
    })),
    eintraege: zeichenEintraege(zeichen.filter(z => !z.gruppe), farbe)
  };
}

/* Die Flächen als Polygone in einem eigenen Ordner – Google Earth zeigt sie
   als eingefärbte Grundrisse, dieselbe Fläche wie auf der Karte hier. */
function flaechenOrdner(flaechen) {
  return {
    name: 'Flächen', offen: false,
    eintraege: flaechen.map(f => ({
      art: 'flaeche',
      name: flaechenTitel(f),
      farbe: f.farbe,
      sichtbar: f.sichtbar,
      koordinaten: flaechenEcken(f),
      beschreibung: [flaechenartById(f.art).name, masseText(f), `MGRS ${toMGRS(f.lat, f.lng, 5)}`, f.bemerkung]
    }))
  };
}

/* Kopf der Planung als Beschreibung des Dokuments – wer die Datei weitergibt,
   soll in Google Earth sehen, zu welchem Einsatz und welchem Stand sie gehört. */
function planungsAngaben(p) {
  const k = p.kopf || {};
  return [
    k.einsatz && `Einsatz: ${k.einsatz}`,
    k.ort && `Ort: ${k.ort}`,
    k.einheit && `Einheit: ${k.einheit}`,
    k.auftragNr && `Auftrag Nr. ${k.auftragNr}`,
    k.datum && `Datum: ${k.datum}`,
    k.stand && `Stand: ${k.stand}`,
    k.ersteller && `Erstellt von: ${k.ersteller}`,
    k.vsgrad && `Einstufung: ${k.vsgrad}`,
    'Erzeugt mit dem Fernmeldebauplaner'
  ];
}

/** Ordnerbaum der ganzen Planung – mit Einsatzabschnitten als oberste Ebene. */
function planungsOrdner(p) {
  const abschnitte = p.einsatzabschnitte || [];
  if (!abschnitte.length)
    return [...p.strecken.map(streckenOrdner), zeichenOrdner(p.zeichen), flaechenOrdner(p.flaechen || [])];

  const ordner = abschnitte.map(ea => ({
    name: ea.name,
    sichtbar: ea.sichtbar,
    beschreibung: [ea.leiter && `Abschnittsleiter: ${ea.leiter}`, ea.bemerkung],
    ordner: [...streckenIm(p, ea.id).map(streckenOrdner), zeichenOrdner(zeichenIm(p, ea.id), ea.farbe),
      flaechenOrdner(flaechenIm(p, ea.id))]
  }));
  /* Was keinem Abschnitt zugeteilt ist, gehört allen – und darf deshalb nicht
     unter den Tisch fallen, wenn die Planung gegliedert ist. */
  ordner.push({
    name: 'Ohne Einsatzabschnitt',
    ordner: [...streckenIm(p, null).map(streckenOrdner), zeichenOrdner(zeichenIm(p, null)),
      flaechenOrdner(flaechenIm(p, null))]
  });
  return ordner;
}

/** Ganze Planung oder eine einzelne Strecke als KML für Google Earth. */
export function kmlExportieren(sid = null) {
  const p = store.projekt;
  const s = sid ? store.strecke(sid) : null;
  const kml = kmlSchreiben({
    name: s ? `${p.name} – ${s.name}` : p.name,
    beschreibung: planungsAngaben(p),
    ordner: s ? [streckenOrdner(s)] : planungsOrdner(p)
  });
  herunterladen(kml, dateiname(['Fernmeldebau', p.name, s && s.name], 'kml'),
    'application/vnd.google-earth.kml+xml');
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
    <desc>${esc(gpxStreckenText(s))}</desc>
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
    'Nr', 'Art', 'Querungsart', 'Bauweise', 'Zeitansatz', 'Bezeichnung', 'MGRS', 'GPS Grad/Dez.-Min.', 'Breite', 'Länge',
    'Teilstrecke_m', 'ab_Anfang_m', 'Richtung_Grad_rechtweisend', 'Bemerkung'
  ]];
  s.punkte.forEach((pt, i) => zeilen.push([
    i + 1, pt.art, querungsartText(pt), bauweiseText(pt), querungszeitText(pt), pt.name || '',
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
