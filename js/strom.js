// strom.js – Auslegung von Stromleitungen: aus Last und Länge den Querschnitt

/* Rechenweg (Kupferleitung, Spannungsfall als maßgebendes Kriterium):
     ΔU = (f · L · I · cos φ) / (κ · A)      f = 2 bei Wechsel-/Gleichstrom, √3 bei Drehstrom
   nach A umgestellt und auf den nächstgrößeren genormten Querschnitt aufgerundet.
   Zusätzlich muss der Querschnitt den Betriebsstrom thermisch tragen; maßgebend
   ist, was den größeren Querschnitt verlangt. */

/** Leitfähigkeit von Kupfer bei Betriebstemperatur in m/(Ω·mm²) */
const KAPPA = 56;

export const NETZFORMEN = [
  { id: 'ac230', name: '230 V Wechselstrom (1~)', kurz: '230 V 1~', spannung: 230, phasen: 1 },
  { id: 'ac400', name: '400 V Drehstrom (3~)',    kurz: '400 V 3~', spannung: 400, phasen: 3 },
  { id: 'dc24',  name: '24 V Gleichstrom',        kurz: '24 V DC',  spannung: 24,  phasen: 1, gleich: true },
  { id: 'dc12',  name: '12 V Gleichstrom',        kurz: '12 V DC',  spannung: 12,  phasen: 1, gleich: true }
];

export const netzById = id => NETZFORMEN.find(n => n.id === id) || NETZFORMEN[0];

/* Genormte Leiterquerschnitte mit Richtwert der Strombelastbarkeit:
   Gummischlauchleitung (H07RN-F o. ä.), drei belastete Adern, frei in Luft
   bei 30 °C. Aufgerollte Leitungsroller tragen deutlich weniger – der Hinweis
   dazu steht in der Anzeige. */
export const QUERSCHNITTE = [
  { mm2: 1.5, ampere: 18 },  { mm2: 2.5, ampere: 25 },  { mm2: 4,   ampere: 34 },
  { mm2: 6,   ampere: 43 },  { mm2: 10,  ampere: 60 },  { mm2: 16,  ampere: 80 },
  { mm2: 25,  ampere: 101 }, { mm2: 35,  ampere: 126 }, { mm2: 50,  ampere: 153 },
  { mm2: 70,  ampere: 196 }, { mm2: 95,  ampere: 238 }, { mm2: 120, ampere: 276 },
  { mm2: 150, ampere: 319 }, { mm2: 185, ampere: 364 }, { mm2: 240, ampere: 430 }
];

export const LASTEINHEITEN = [['kw', 'kW'], ['a', 'A']];

/** Größter Querschnitt der Tabelle – Grenze beider Prüfungen */
export const MAX_QUERSCHNITT = QUERSCHNITTE[QUERSCHNITTE.length - 1].mm2;

/** Vorgabewerte einer neuen Stromstrecke */
export function neueStromangabe() {
  return { last: '', einheit: 'kw', netz: 'ac230', spannungsfall: 3, cosphi: 0.8 };
}

const klemm = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Auslegung einer Stromleitung.
 * @param {object} v   Angaben der Strecke (last, einheit, netz, spannungsfall, cosphi)
 * @param {number} laenge  Leitungslänge in Metern (Kabelbedarf, nicht Trassenlänge)
 * @returns {object|null}  null, solange keine Last angegeben ist
 */
export function auslegung(v, laenge) {
  const last = Number(v && v.last);
  if (!isFinite(last) || last <= 0) return null;

  const netz = netzById(v.netz);
  const cos = netz.gleich ? 1 : klemm(Number(v.cosphi) || 0.8, 0.3, 1);
  const dreh = netz.phasen === 3;
  const faktor = dreh ? Math.sqrt(3) : 2;

  const strom = v.einheit === 'a'
    ? last
    : (last * 1000) / (netz.spannung * cos * (dreh ? Math.sqrt(3) : 1));
  const leistung = v.einheit === 'a'
    ? last * netz.spannung * cos * (dreh ? Math.sqrt(3) : 1)
    : last * 1000;

  const grenze = klemm(Number(v.spannungsfall) || 3, 0.5, 20);
  const fallVolt = netz.spannung * grenze / 100;
  const L = Math.max(0, Number(laenge) || 0);

  // Mindestquerschnitt aus dem zulässigen Spannungsfall …
  const ausFall = (faktor * L * strom * cos) / (KAPPA * fallVolt);
  const qFall = QUERSCHNITTE.find(q => q.mm2 >= ausFall) || null;
  // … und aus der Strombelastbarkeit
  const qStrom = QUERSCHNITTE.find(q => q.ampere >= strom) || null;

  const gewaehlt = qFall && qStrom
    ? (qFall.mm2 >= qStrom.mm2 ? qFall : qStrom)
    : null;

  const istVolt = gewaehlt ? (faktor * L * strom * cos) / (KAPPA * gewaehlt.mm2) : 0;

  return {
    netz, strom, leistung, cosphi: cos, laenge: L,
    grenze,
    querschnitt: gewaehlt ? gewaehlt.mm2 : null,
    belastbarkeit: gewaehlt ? gewaehlt.ampere : null,
    mindestFall: ausFall,
    spannungsfallVolt: istVolt,
    spannungsfallProzent: netz.spannung ? istVolt / netz.spannung * 100 : 0,
    massgebend: !gewaehlt ? null
      : (qFall.mm2 > qStrom.mm2 ? 'fall' : (qStrom.mm2 > qFall.mm2 ? 'strom' : 'beide')),
    /* Reicht die Tabelle nicht, muss die Anzeige den wahren Grund nennen:
       ein zu großer Strom ist etwas anderes als eine zu lange Leitung. */
    ueberLast: !gewaehlt,
    ueberStrom: !qStrom,
    ueberFall: !qFall
  };
}

// ---------------------------------------------------------------- Ausgabe

const nf = (n, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/** „1,5 mm²“ – halbe Millimeter nur, wo es sie gibt */
export function querschnittText(mm2) {
  if (!mm2) return '–';
  return nf(mm2, mm2 < 3 ? 1 : 0) + ' mm²';
}

export function stromText(a) {
  if (!isFinite(a)) return '–';
  return nf(a, a < 100 ? 1 : 0) + ' A';
}

export function leistungText(w) {
  if (!isFinite(w)) return '–';
  return w < 1000 ? nf(Math.round(w)) + ' W' : nf(w / 1000, w < 10000 ? 2 : 1) + ' kW';
}

export function prozentText(p) {
  return nf(p, 1) + ' %';
}

/** Eingestellte Grenze: „3 %“, „2,5 %“ – ohne erfundene Nachkommastelle */
export function grenzText(p) {
  return nf(p, p % 1 ? 1 : 0) + ' %';
}

/** Was den Querschnitt bestimmt hat – in Worten für Anzeige und Bauauftrag */
export function massgebendText(a) {
  if (!a || !a.querschnitt) return '–';
  if (a.massgebend === 'fall') return 'Spannungsfall';
  if (a.massgebend === 'strom') return 'Strombelastbarkeit';
  return 'Spannungsfall und Belastbarkeit';
}
