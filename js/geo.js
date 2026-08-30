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
    return `${zone} ${utmWerte(p[1], p[0])}`;
  } catch (e) { return m; }
}

function utmWerte(lat, lng) {
  const zone = Math.floor((lng + 180) / 6) + 1;
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
  const k0 = 0.9996;
  const ost = k0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 +
    (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Aa ** 5 / 120) + 500000;
  let nord = k0 * (M + N * Math.tan(phi) * (Aa ** 2 / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 +
    (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Aa ** 6 / 720));
  if (lat < 0) nord += 10000000;
  return `${Math.round(ost)} ${Math.round(nord)}`;
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
