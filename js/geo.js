// geo.js – Entfernungen, Koordinatenumrechnung und -formatierung
// MGRS über vendor/mgrs.esm.js (proj4 team, MIT)
import { forward as mgrsForward, toPoint as mgrsToPoint } from '../vendor/mgrs.esm.js';

const rad = d => d * Math.PI / 180;
const grad = r => r * 180 / Math.PI;

// WGS84
const A = 6378137, F = 1 / 298.257223563, B = A * (1 - F);

/**
 * Entfernung in Metern nach Vincenty (Ellipsoid, mm-genau).
 * Fällt bei Nicht-Konvergenz (Antipoden) auf Haversine zurück.
 */
export function distanz(a, b) {
  const L = rad(b.lng - a.lng);
  const U1 = Math.atan((1 - F) * Math.tan(rad(a.lat)));
  const U2 = Math.atan((1 - F) * Math.tan(rad(b.lat)));
  const sU1 = Math.sin(U1), cU1 = Math.cos(U1);
  const sU2 = Math.sin(U2), cU2 = Math.cos(U2);
  let lam = L, lamP, i = 0, cosSqAl, sinSig, cosSig, sig, cos2SigM;
  do {
    const sLam = Math.sin(lam), cLam = Math.cos(lam);
    sinSig = Math.sqrt((cU2 * sLam) ** 2 + (cU1 * sU2 - sU1 * cU2 * cLam) ** 2);
    if (sinSig === 0) return 0;
    cosSig = sU1 * sU2 + cU1 * cU2 * cLam;
    sig = Math.atan2(sinSig, cosSig);
    const sinAl = cU1 * cU2 * sLam / sinSig;
    cosSqAl = 1 - sinAl * sinAl;
    cos2SigM = cosSqAl === 0 ? 0 : cosSig - 2 * sU1 * sU2 / cosSqAl;
    const C = F / 16 * cosSqAl * (4 + F * (4 - 3 * cosSqAl));
    lamP = lam;
    lam = L + (1 - C) * F * sinAl *
      (sig + C * sinSig * (cos2SigM + C * cosSig * (-1 + 2 * cos2SigM ** 2)));
  } while (Math.abs(lam - lamP) > 1e-12 && ++i < 100);

  if (i >= 100) return haversine(a, b);

  const uSq = cosSqAl * (A * A - B * B) / (B * B);
  const Ac = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const Bc = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const dSig = Bc * sinSig * (cos2SigM + Bc / 4 * (cosSig * (-1 + 2 * cos2SigM ** 2) -
    Bc / 6 * cos2SigM * (-3 + 4 * sinSig ** 2) * (-3 + 4 * cos2SigM ** 2)));
  return B * Ac * (sig - dSig);
}

function haversine(a, b) {
  const R = 6371008.8;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rechtweisende Peilung a -> b in Grad (0 = Nord) */
export function peilung(a, b) {
  const dl = rad(b.lng - a.lng);
  const y = Math.sin(dl) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dl);
  return (grad(Math.atan2(y, x)) + 360) % 360;
}

/** Himmelsrichtung als Kürzel, z. B. "NO" */
export function himmelsrichtung(gradZahl) {
  const s = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO',
             'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return s[Math.round(gradZahl / 22.5) % 16];
}

/** Summe der Teilstrecken einer Punktliste (m) */
export function streckenlaenge(punkte) {
  let s = 0;
  for (let i = 1; i < punkte.length; i++) s += distanz(punkte[i - 1], punkte[i]);
  return s;
}

/** Kumulierte Längen: [0, l1, l1+l2, ...] */
export function kumuliert(punkte) {
  const out = [0];
  for (let i = 1; i < punkte.length; i++) out.push(out[i - 1] + distanz(punkte[i - 1], punkte[i]));
  return out;
}

const nf = (n, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Länge menschenlesbar: < 1000 m in Metern, darüber in km */
export function formatLaenge(m, kurz = false) {
  if (!isFinite(m)) return '–';
  if (m < 1000) return nf(Math.round(m)) + ' m';
  return nf(m / 1000, kurz ? 1 : 2) + ' km';
}

/** Immer in Metern, gerundet */
export function meter(m) { return nf(Math.round(m)) + ' m'; }

// ---------------------------------------------------------------- Ortsangaben

/**
 * Position auf dem Polygonzug bei der Bogenlänge `meterAbAnfang`.
 * Vor dem Anfang liefert sie den ersten, hinter dem Ende den letzten Punkt.
 * @returns {{lat:number,lng:number,index:number}|null} index = davorliegender Trassenpunkt
 */
export function punktBeiLaenge(punkte, meterAbAnfang) {
  if (!punkte || punkte.length < 2) return null;
  if (!(meterAbAnfang > 0)) return { lat: punkte[0].lat, lng: punkte[0].lng, index: 0 };

  let rest = meterAbAnfang;
  for (let i = 1; i < punkte.length; i++) {
    const l = distanz(punkte[i - 1], punkte[i]);
    if (rest <= l) {
      const t = l === 0 ? 0 : rest / l;
      // Lineare Interpolation in Grad: auf den hier üblichen Abschnittslängen
      // von einigen hundert Metern genau genug.
      return {
        lat: punkte[i - 1].lat + (punkte[i].lat - punkte[i - 1].lat) * t,
        lng: punkte[i - 1].lng + (punkte[i].lng - punkte[i - 1].lng) * t,
        index: i - 1
      };
    }
    rest -= l;
  }
  const letzter = punkte.length - 1;
  return { lat: punkte[letzter].lat, lng: punkte[letzter].lng, index: letzter };
}

/**
 * Ortsangabe im Sprachgebrauch der Baumeldung: "180 m NO von Punkt 7".
 * @param {string[]} [namen] Punktbezeichnungen; eine gesetzte ersetzt "Punkt N"
 */
export function standortText(punkte, meterAbAnfang, namen) {
  const stelle = punktBeiLaenge(punkte, meterAbAnfang);
  if (!stelle) return '';

  let nah = 0, abstand = Infinity;
  for (let i = 0; i < punkte.length; i++) {
    const d = distanz(punkte[i], stelle);
    if (d < abstand) { abstand = d; nah = i; }
  }

  const name = (namen && namen[nah]) ? namen[nah] : `Punkt ${nah + 1}`;
  // Unter 20 m ist die Richtungsangabe im Gelände nicht mehr auffindbar.
  if (abstand < 20) return `an ${name}`;
  return `${meter(abstand)} ${himmelsrichtung(peilung(punkte[nah], stelle))} von ${name}`;
}

// ---------------------------------------------------------------- MGRS

/**
 * MGRS-String, gruppiert: "32U MC 12345 67890"
 * @param {number} stellen 1..5 (Genauigkeit 10 km ... 1 m)
 */
export function toMGRS(lat, lng, stellen = 5) {
  try {
    const roh = mgrsForward([lng, lat], stellen);
    const m = roh.match(/^(\d{1,2}[A-Z])([A-Z]{2})(\d*)$/);
    if (!m) return roh;
    const zahlen = m[3];
    const h = zahlen.length / 2;
    return `${m[1]} ${m[2]} ${zahlen.slice(0, h)} ${zahlen.slice(h)}`.trim();
  } catch (e) {
    return '– außerhalb MGRS –';
  }
}

/** MGRS -> {lat,lng}; wirft bei ungültiger Eingabe */
export function fromMGRS(text) {
  const [lng, lat] = mgrsToPoint(text.replace(/\s+/g, '').toUpperCase());
  return { lat, lng };
}

// ---------------------------------------------------------------- GPS-Formate

/**
 * Holt die Höhe über dem Meeresspiegel (in Metern) für einen Punkt.
 * Nutzt den OpenTopoData‑Dienst (z. B. eudem25m). Gibt `null` zurück, wenn
 * kein Ergebnis vorliegt oder ein Fehler auftritt.
 */
export async function getElevation(lat, lng) {
  try {
    const url = `https://api.opentopodata.org/v1/eudem25m?locations=${lat},${lng}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const result = data.results?.[0];
    if (result && typeof result.elevation === 'number') return result.elevation;
    return null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- GPS-Formate

/** Dezimalgrad: "51.234567° N, 6.987654° O" */
export function toDezimal(lat, lng, d = 6) {
  return `${Math.abs(lat).toFixed(d)}° ${lat >= 0 ? 'N' : 'S'}, ` +
         `${Math.abs(lng).toFixed(d)}° ${lng >= 0 ? 'O' : 'W'}`;
}

/** Grad/Dezimalminuten (GPS-Standard im Einsatz): "N 51° 14.074' O 006° 59.259'" */
export function toDDM(lat, lng) {
  const teil = (w, pos, neg, stellen) => {
    const g = Math.floor(Math.abs(w));
    const min = (Math.abs(w) - g) * 60;
    return `${w >= 0 ? pos : neg} ${String(g).padStart(stellen, '0')}° ${min.toFixed(3).padStart(6, '0')}'`;
  };
  return `${teil(lat, 'N', 'S', 2)} ${teil(lng, 'O', 'W', 3)}`;
}

/** Grad/Minuten/Sekunden: "51° 14' 04.4\" N  006° 59' 15.5\" O" */
export function toDMS(lat, lng) {
  const teil = (w, pos, neg, stellen) => {
    const abs = Math.abs(w);
    const g = Math.floor(abs);
    const mFloat = (abs - g) * 60;
    const m = Math.floor(mFloat);
    const s = (mFloat - m) * 60;
    return `${String(g).padStart(stellen, '0')}° ${String(m).padStart(2, '0')}' ` +
           `${s.toFixed(1).padStart(4, '0')}" ${w >= 0 ? pos : neg}`;
  };
  return `${teil(lat, 'N', 'S', 2)}  ${teil(lng, 'O', 'W', 3)}`;
}

/** UTM als Zusatzangabe: "32U 345678 5678901" */
export function toUTM(lat, lng) {
  const m = toMGRS(lat, lng, 5);
  if (m.startsWith('–')) return m;
  try {
    const roh = mgrsForward([lng, lat], 5);
    const zone = roh.match(/^(\d{1,2}[A-Z])/)[1];
    // Ostwert/Nordwert aus dem 100-km-Quadrat rekonstruieren
    const p = mgrsToPoint(roh);
    const u = nachUTM(p[1], p[0]);
    return `${zone} ${Math.round(u.ost)} ${Math.round(u.nord)}`;
  } catch (e) { return m; }
}

/** UTM-Zonennummer eines Längengrads (Regelzuschnitt von 6°, ohne die
 *  Ausnahmen um Norwegen und Spitzbergen – dort plant niemand Feldkabel). */
export function utmZone(lng) {
  return Math.floor((lng + 180) / 6) + 1;
}

const K0 = 0.9996;   // UTM-Maßstabsfaktor am Mittelmeridian

/**
 * UTM-Werte (WGS84) mit Zone, Ostwert und Nordwert.
 * `zoneFest` rechnet in eine vorgegebene Zone statt in die eigene – das
 * Koordinatengitter braucht am Zonenrand durchgehende Werte einer Zone.
 */
export function nachUTM(lat, lng, zoneFest) {
  const zone = zoneFest || utmZone(lng);
  const lam0 = rad(6 * (zone - 1) - 180 + 3);
  const phi = rad(lat), lam = rad(lng);
  const e2 = 2 * F - F * F, ep2 = e2 / (1 - e2);
  const N = A / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2;
  const Aa = Math.cos(phi) * (lam - lam0);
  const M = A * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const ost = K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 +
    (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Aa ** 5 / 120) + 500000;
  let nord = K0 * (M + N * Math.tan(phi) * (Aa ** 2 / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 +
    (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Aa ** 6 / 720));
  if (lat < 0) nord += 10000000;
  return { zone, ost, nord };
}

/**
 * Umkehrung von nachUTM: geographische Koordinate zu Zone/Ostwert/Nordwert.
 * Reihenentwicklung nach Snyder (Map Projections, USGS PP 1395) – auf
 * Zonenbreite deutlich unter einem Millimeter genau, mehr als genug fürs Gitter.
 */
export function vonUTM(zone, ost, nord, sued = false) {
  const e2 = 2 * F - F * F, ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = ost - 500000;
  const M = (sued ? nord - 10000000 : nord) / K0;
  const mu = M / (A * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1), cos1 = Math.cos(phi1), tan1 = Math.tan(phi1);
  const C1 = ep2 * cos1 * cos1, T1 = tan1 * tan1;
  const N1 = A / Math.sqrt(1 - e2 * sin1 * sin1);
  const R1 = A * (1 - e2) / Math.pow(1 - e2 * sin1 * sin1, 1.5);
  const D = x / (N1 * K0);
  const lat = phi1 - (N1 * tan1 / R1) * (D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lng = (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / cos1;
  return { lat: grad(lat), lng: 6 * (zone - 1) - 180 + 3 + grad(lng) };
}

// ---------------------------------------------------------------- Eingabe-Parser

/**
 * Erkennt MGRS, Dezimalgrad, Grad/Dezimalminuten und Grad/Min/Sek.
 * @returns {{lat:number,lng:number,format:string}|null}
 */
export function parseKoordinate(eingabe) {
  const t = String(eingabe || '').trim();
  if (!t) return null;

  // MGRS: beginnt mit 1-2 Ziffern, Bandbuchstabe, zwei Buchstaben
  if (/^\s*\d{1,2}\s*[C-HJ-NP-X]\s*[A-HJ-NP-Z]{2}[\s\d]*$/i.test(t)) {
    try { const p = fromMGRS(t); return { ...p, format: 'MGRS' }; } catch (e) { /* weiter */ }
  }

  // Zahlenpaare mit optionalen Hemisphären-Buchstaben einsammeln
  const teile = t.toUpperCase().replace(/,(?=\s*\d)/g, ' ').replace(/[°'"´’″]/g, ' ');
  const gruppen = teile.split(/(?=[NSOEWнs])|\s{2,}/).filter(Boolean);

  const zahlen = (teile.match(/-?\d+(?:[.,]\d+)?/g) || []).map(z => parseFloat(z.replace(',', '.')));
  const hemis = teile.match(/[NSOEW]/g) || [];

  const vz = (i, wert) => {
    const h = hemis[i];
    if (h === 'S' || h === 'W') return -Math.abs(wert);
    return wert;
  };

  if (zahlen.length === 2) {
    let [x, y] = zahlen;
    let lat = x, lng = y;
    if (hemis.length === 2 && (hemis[0] === 'O' || hemis[0] === 'E' || hemis[0] === 'W')) {
      lat = y; lng = x;
      lat = vz(1, lat); lng = vz(0, lng);
    } else {
      lat = vz(0, lat); lng = vz(1, lng);
    }
    if (gueltig(lat, lng)) return { lat, lng, format: 'Dezimalgrad' };
  }

  if (zahlen.length === 4) { // Grad + Dezimalminuten
    let lat = zahlen[0] + zahlen[1] / 60;
    let lng = zahlen[2] + zahlen[3] / 60;
    lat = vz(0, lat); lng = vz(1, lng);
    if (gueltig(lat, lng)) return { lat, lng, format: 'Grad/Dezimalminuten' };
  }

  if (zahlen.length === 6) { // Grad/Minuten/Sekunden
    let lat = zahlen[0] + zahlen[1] / 60 + zahlen[2] / 3600;
    let lng = zahlen[3] + zahlen[4] / 60 + zahlen[5] / 3600;
    lat = vz(0, lat); lng = vz(1, lng);
    if (gueltig(lat, lng)) return { lat, lng, format: 'Grad/Minuten/Sekunden' };
  }

  return null;
}

function gueltig(lat, lng) {
  return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Alle Formate eines Punktes als Objekt – für Tabellen und Bauaufträge */
export function alleFormate(lat, lng) {
  return {
    mgrs: toMGRS(lat, lng, 5),
    mgrs10: toMGRS(lat, lng, 4),
    utm: toUTM(lat, lng),
    ddm: toDDM(lat, lng),
    dms: toDMS(lat, lng),
    dez: toDezimal(lat, lng),
    latlng: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  };
}
