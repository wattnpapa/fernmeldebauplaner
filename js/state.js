// state.js – Datenmodell, Projektverwaltung, LocalStorage, Undo

export const SCHEMA = 1;
const KEY_PROJEKTE = 'fbp.projekte.v1';
const KEY_AKTIV    = 'fbp.aktiv.v1';

export const KABELTYPEN = [
  { id: 'fk2',    name: 'Feldkabel 2-adrig (FK 1×2)', kurz: 'FK 1×2',  trommel: 500,  zuschlag: 15, leistung: 900 },
  { id: 'fk4',    name: 'Feldkabel 4-adrig (FK 2×2)', kurz: 'FK 2×2',  trommel: 500,  zuschlag: 15, leistung: 800 },
  { id: 'ffk',    name: 'Feldfernkabel',              kurz: 'FFK',     trommel: 1000, zuschlag: 15, leistung: 700 },
  { id: 'lwl',    name: 'Lichtwellenleiter (LWL)',    kurz: 'LWL',     trommel: 500,  zuschlag: 20, leistung: 500 },
  { id: 'lan',    name: 'Netzwerkkabel (Cat.)',       kurz: 'LAN',     trommel: 100,  zuschlag: 15, leistung: 600 },
  { id: 'koax',   name: 'Koaxialkabel / Antennenzuleitung', kurz: 'Koax', trommel: 100, zuschlag: 15, leistung: 500 },
  { id: 'strom',  name: 'Stromleitung / Leitungsroller', kurz: 'Strom', trommel: 50,  zuschlag: 15, leistung: 600 },
  { id: 'sonst',  name: 'Sonstige Leitung',           kurz: 'Sonst.',  trommel: 500,  zuschlag: 15, leistung: 700 }
];

export const VERLEGEARTEN = [
  { id: 'boden', name: 'Bodenverlegung (offen)' },
  { id: 'erd',   name: 'Erdverlegung / Graben' },
  { id: 'ober',  name: 'Oberirdisch / Abspannung' },
  { id: 'gem',   name: 'Gemischt' }
];

export const PUNKTARTEN = [
  { id: 'start',     name: 'Anfangspunkt',              kurz: 'A'  },
  { id: 'punkt',     name: 'Trassenpunkt',              kurz: '·'  },
  { id: 'muffe',     name: 'Muffe / Verbindung',        kurz: 'M'  },
  { id: 'verteiler', name: 'Verteiler / Endverzweiger', kurz: 'V'  },
  { id: 'querung',   name: 'Querung (Straße/Bahn/Gewässer)', kurz: 'Q' },
  { id: 'mast',      name: 'Mast / Hochführung',        kurz: 'H'  },
  { id: 'reserve',   name: 'Kabelreserve',              kurz: 'R'  },
  { id: 'ziel',      name: 'Endpunkt',                  kurz: 'E'  }
];

export const FARBEN = [
  '#d32f2f', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2',
  '#0097a7', '#c2185b', '#5d4037', '#455a64', '#afb42b'
];

const kabelById = id => KABELTYPEN.find(k => k.id === id) || KABELTYPEN[0];
export { kabelById };
export const punktartById = id => PUNKTARTEN.find(p => p.id === id) || PUNKTARTEN[1];

export function id() {
  return 'x' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

const heute = () => new Date().toISOString().slice(0, 10);

export function neuesProjekt(name = 'Neue Planung') {
  return {
    version: SCHEMA,
    id: id(),
    name,
    erstellt: new Date().toISOString(),
    geaendert: new Date().toISOString(),
    kopf: {
      einsatz: '', ort: '', datum: heute(), ersteller: '',
      einheit: '', auftragNr: '', fernmeldezone: '', bemerkung: ''
    },
    ansicht: { lat: 51.1657, lng: 10.4515, zoom: 6, basemap: 'topplus' },
    optionen: {
      teillaengen: true, gesamtlaenge: true, punktnummern: true,
      koordformat: 'mgrs', symbolgroesse: 1
    },
    strecken: [],
    zeichen: []
  };
}

export function neueStrecke(projekt) {
  const n = projekt.strecken.length;
  const k = KABELTYPEN[0];
  return {
    id: id(),
    name: `Strecke ${n + 1}`,
    von: '', nach: '',
    farbe: FARBEN[n % FARBEN.length],
    kabeltyp: k.id,
    verlegeart: 'boden',
    zuschlag: k.zuschlag,
    trommellaenge: k.trommel,
    verlegeleistung: k.leistung,
    trupp: '',
    bemerkung: '',
    sichtbar: true,
    punkte: []
  };
}

export function neuerPunkt(lat, lng, art = 'punkt') {
  return { id: id(), lat, lng, art, name: '', bemerkung: '' };
}

export function neuesZeichen(lat, lng, symbol = 'fm-funk') {
  return {
    id: id(), lat, lng, symbol, org: 'thw', staerke: undefined,
    drehung: 0, groesse: 1, label: '', bemerkung: '', sichtbar: true
  };
}

// ---------------------------------------------------------------- Store

class Store {
  constructor() {
    this.projekt = null;
    this.horcher = new Set();
    this.undoStapel = [];
    this.redoStapel = [];
    this._speicherTimer = null;
    this._letzterSchnappschuss = null;
  }

  on(fn) { this.horcher.add(fn); return () => this.horcher.delete(fn); }

  melden(grund = 'aenderung') {
    for (const fn of this.horcher) fn(this.projekt, grund);
  }

  /** Änderung ausführen: Undo-Punkt setzen, mutieren, speichern, melden */
  aendern(fn, grund = 'aenderung', { undo = true } = {}) {
    if (undo) this.schnappschuss();
    fn(this.projekt);
    this.projekt.geaendert = new Date().toISOString();
    this.speichernVerzoegert();
    this.melden(grund);
  }

  /** Nur melden, ohne Undo-Punkt (z. B. Kartenausschnitt) */
  still(fn) {
    fn(this.projekt);
    this.speichernVerzoegert();
  }

  schnappschuss() {
    const s = JSON.stringify(this.projekt);
    if (s === this._letzterSchnappschuss) return;
    this._letzterSchnappschuss = s;
    this.undoStapel.push(s);
    if (this.undoStapel.length > 60) this.undoStapel.shift();
    this.redoStapel.length = 0;
  }

  undo() {
    if (!this.undoStapel.length) return false;
    this.redoStapel.push(JSON.stringify(this.projekt));
    this.projekt = JSON.parse(this.undoStapel.pop());
    this._letzterSchnappschuss = null;
    this.speichernVerzoegert();
    this.melden('undo');
    return true;
  }

  redo() {
    if (!this.redoStapel.length) return false;
    this.undoStapel.push(JSON.stringify(this.projekt));
    this.projekt = JSON.parse(this.redoStapel.pop());
    this._letzterSchnappschuss = null;
    this.speichernVerzoegert();
    this.melden('redo');
    return true;
  }

  // -------------------------------------------------------------- Zugriffe

  strecke(sid) { return this.projekt.strecken.find(s => s.id === sid); }
  zeichen(zid) { return this.projekt.zeichen.find(z => z.id === zid); }

  // -------------------------------------------------------------- Speicher

  speichernVerzoegert() {
    clearTimeout(this._speicherTimer);
    this._speicherTimer = setTimeout(() => this.speichern(), 400);
  }

  speichern() {
    try {
      const alle = ladeAlle();
      alle[this.projekt.id] = this.projekt;
      localStorage.setItem(KEY_PROJEKTE, JSON.stringify(alle));
      localStorage.setItem(KEY_AKTIV, this.projekt.id);
      this.melden('gespeichert');
      return true;
    } catch (e) {
      console.error('Speichern fehlgeschlagen', e);
      this.melden('speicherfehler');
      return false;
    }
  }

  laden(pid) {
    const alle = ladeAlle();
    const p = alle[pid];
    if (!p) return false;
    this.projekt = migrieren(p);
    this.undoStapel.length = 0; this.redoStapel.length = 0;
    localStorage.setItem(KEY_AKTIV, pid);
    this.melden('geladen');
    return true;
  }

  neu(name) {
    this.projekt = neuesProjekt(name);
    this.undoStapel.length = 0; this.redoStapel.length = 0;
    this.speichern();
    this.melden('geladen');
  }

  uebernehmen(projekt) {
    this.projekt = migrieren(projekt);
    this.projekt.id = this.projekt.id || id();
    this.undoStapel.length = 0; this.redoStapel.length = 0;
    this.speichern();
    this.melden('geladen');
  }

  loeschen(pid) {
    const alle = ladeAlle();
    delete alle[pid];
    localStorage.setItem(KEY_PROJEKTE, JSON.stringify(alle));
    if (this.projekt && this.projekt.id === pid) {
      const rest = Object.values(alle);
      if (rest.length) this.uebernehmen(rest.sort((a, b) => (b.geaendert || '').localeCompare(a.geaendert || ''))[0]);
      else this.neu('Neue Planung');
    }
    this.melden('projektliste');
  }

  starten() {
    const alle = ladeAlle();
    const aktiv = localStorage.getItem(KEY_AKTIV);
    if (aktiv && alle[aktiv]) this.projekt = migrieren(alle[aktiv]);
    else {
      const liste = Object.values(alle).sort((a, b) => (b.geaendert || '').localeCompare(a.geaendert || ''));
      this.projekt = liste.length ? migrieren(liste[0]) : neuesProjekt('Neue Planung');
    }
    this.speichern();
    return this.projekt;
  }
}

export function ladeAlle() {
  try {
    const roh = localStorage.getItem(KEY_PROJEKTE);
    return roh ? JSON.parse(roh) : {};
  } catch (e) {
    console.error('Projektliste unlesbar', e);
    return {};
  }
}

export function projektListe() {
  return Object.values(ladeAlle())
    .map(p => ({
      id: p.id, name: p.name, geaendert: p.geaendert,
      strecken: (p.strecken || []).length, zeichen: (p.zeichen || []).length
    }))
    .sort((a, b) => (b.geaendert || '').localeCompare(a.geaendert || ''));
}

/** Belegter LocalStorage-Platz in Bytes (grobe Schätzung) */
export function speicherBelegung() {
  try { return (localStorage.getItem(KEY_PROJEKTE) || '').length * 2; } catch (e) { return 0; }
}

/** Ältere/fremde Projektdateien auf das aktuelle Schema heben */
export function migrieren(p) {
  const v = neuesProjekt(p.name || 'Import');
  const out = {
    ...v, ...p,
    version: SCHEMA,
    kopf: { ...v.kopf, ...(p.kopf || {}) },
    ansicht: { ...v.ansicht, ...(p.ansicht || {}) },
    optionen: { ...v.optionen, ...(p.optionen || {}) },
    strecken: (p.strecken || []).map(s => ({
      ...neueStrecke({ strecken: [] }), ...s,
      id: s.id || id(),
      punkte: (s.punkte || []).map(pt => ({ ...neuerPunkt(pt.lat, pt.lng), ...pt, id: pt.id || id() }))
    })),
    zeichen: (p.zeichen || []).map(z => ({ ...neuesZeichen(z.lat, z.lng), ...z, id: z.id || id() }))
  };
  out.id = p.id || id();
  return out;
}

export const store = new Store();
