// state.js – Datenmodell, Projektverwaltung, LocalStorage, Undo

import { neueStromangabe } from './strom.js';
import { STANDARD_SYMBOL, symbolBekannt } from './symbols.js';
import { QUERUNG_STANDARD } from './vorschrift.js';

export const SCHEMA = 1;
const KEY_PROJEKTE = 'fbp.projekte.v1';
const KEY_AKTIV    = 'fbp.aktiv.v1';
const KEY_DATEI    = 'fbp.dateisicherung.v1';

/** Grobes Kontingent, das Browser je Website für den localStorage bereitstellen */
export const SPEICHER_KONTINGENT = 5 * 1024 * 1024;

export const KABELTYPEN = [
  { id: 'fk2',    name: 'Feldkabel 2-adrig (FK 1×2)', kurz: 'FK 1×2',  trommel: 800,  gewicht: 14.5, zuschlag: 15, leistung: 900 },
  { id: 'ffk',    name: 'Feldfernkabel (FFK, auch FK 2×2)', kurz: 'FFK', trommel: 400, gewicht: 60, zuschlag: 15, leistung: 700 },
  { id: 'ak',     name: 'Anschlusskabel (AK 10×2)',   kurz: 'AK',      trommel: 230,  gewicht: 56,   zuschlag: 10, leistung: 500 },
  { id: 'vk',     name: 'Verbindungskabel (VK 10×2)', kurz: 'VK',      trommel: 200,  gewicht: 56,   zuschlag: 10, leistung: 500 },
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
  { id: 'querung',   name: 'Querung / Kreuzung',          kurz: 'Q'  },
  { id: 'mast',      name: 'Mast / Hochführung',        kurz: 'H'  },
  { id: 'reserve',   name: 'Kabelreserve',              kurz: 'R'  },
  { id: 'ziel',      name: 'Endpunkt',                  kurz: 'E'  }
];

export const FARBEN = [
  '#d32f2f', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2',
  '#0097a7', '#c2185b', '#5d4037', '#455a64', '#afb42b'
];

/* Früher wurde das Feldfernkabel zusätzlich als eigener Typ „FK 2×2“ geführt.
   Beides ist dasselbe Kabel, der alte Schlüssel bleibt nur als Verweis erhalten. */
export const KABEL_ALIAS = { fk4: 'ffk' };

const kabelById = id => {
  const schluessel = KABEL_ALIAS[id] || id;
  return KABELTYPEN.find(k => k.id === schluessel) || KABELTYPEN[0];
};
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
      einheit: '', auftragNr: '', fernmeldezone: '',
      /* Kopfangaben der technischen Fernmeldeskizze nach KatS-Dv 861, Anlage 7:
         Datum-Zeit-Gruppe des Planungsstandes, „Für die Richtigkeit“, Einstufung. */
      stand: '', fdr: '', vsgrad: '',
      bemerkung: ''
    },
    ansicht: { lat: 51.1657, lng: 10.4515, zoom: 6, basemap: 'topplus' },
    optionen: {
      teillaengen: true, gesamtlaenge: true, punktnummern: true, gitter: false,
      koordformat: 'mgrs', symbolgroesse: 1
    },
    einsatzabschnitte: [],
    strecken: [],
    zeichen: []
  };
}

/* Einsatzabschnitte gliedern eine große Planung in Zuständigkeiten. Sie sind
   freiwillig: eine Planung ohne Abschnitte verhält sich wie bisher, jede
   Strecke steht dann für sich. */
export function neuerEinsatzabschnitt(projekt) {
  const n = (projekt.einsatzabschnitte || []).length;
  return {
    id: id(),
    name: `Einsatzabschnitt ${n + 1}`,
    leiter: '',
    farbe: FARBEN[n % FARBEN.length],
    bemerkung: '',
    sichtbar: true
  };
}

export const abschnittById = (p, aid) =>
  (p && aid ? (p.einsatzabschnitte || []).find(a => a.id === aid) : null) || null;

const gehoertZu = (x, aid) => (x.abschnitt || null) === (aid || null);

/** Alle Strecken eines Abschnitts; `null` liefert die nicht zugeteilten. */
export function streckenIm(p, aid) { return p.strecken.filter(s => gehoertZu(s, aid)); }

/** Ebenso für die taktischen Zeichen */
export function zeichenIm(p, aid) { return p.zeichen.filter(z => gehoertZu(z, aid)); }

/** Nicht zugeteilt heißt: gehört allen. Ein Abschnitt bekommt seine eigenen
 *  Zeichen und dazu die des gemeinsamen Lagebildes – ohne Abschnitt alle. */
export function zeichenFuer(p, aid) {
  return aid ? p.zeichen.filter(z => !z.abschnitt || z.abschnitt === aid) : p.zeichen;
}

/* Der Abschnitt schaltet seine Strecken und Zeichen gemeinsam ab, ohne ihren
   eigenen Schalter zu überschreiben – wird er wieder eingeblendet, steht jedes
   Element so da, wie es der Nutzer verlassen hat. */
const abschnittZeigt = (p, x) => {
  const ea = abschnittById(p, x.abschnitt);
  return !ea || ea.sichtbar !== false;
};

export function streckeSichtbar(p, s) {
  return s.sichtbar !== false && abschnittZeigt(p, s);
}

export function zeichenSichtbar(p, z) {
  return z.sichtbar !== false && abschnittZeigt(p, z);
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
    strom: neueStromangabe(),
    abschnitt: null,
    trupp: '',
    bemerkung: '',
    sichtbar: true,
    punkte: []
  };
}

/* Die Querungsart ist nur bei der Punktart 'querung' von Bedeutung, wird aber an
   jedem Punkt mitgeführt: ein späterer Wechsel der Punktart soll die einmal
   getroffene Wahl nicht verlieren. */
export function neuerPunkt(lat, lng, art = 'punkt') {
  return { id: id(), lat, lng, art, name: '', bemerkung: '', querungsart: QUERUNG_STANDARD };
}

export function neuesZeichen(lat, lng, symbol = STANDARD_SYMBOL) {
  return {
    id: id(), lat, lng, symbol, abschnitt: null,
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
    /* Der Erststart-Schalter des früheren Begrüßungsdialogs. Der Dialog ist
       fort; in Browsern, die ihn einmal gesehen haben, liegt der Schlüssel
       noch. Er wird beim nächsten Start still weggeräumt. */
    try { localStorage.removeItem('fbp.begruessung'); } catch (e) { /* ohne Belang */ }
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

// ---------------------------------------------------------------- Dateisicherung

/* Wann eine Planung zuletzt als Datei gesichert wurde. Bewusst außerhalb des
   Projekts abgelegt: der Zeitpunkt darf nicht mit Rückgängig verschwinden und
   gehört nicht in die exportierte Datei. Fehlt der Eintrag – bei allen
   Bestandsplanungen –, gilt „noch nie gesichert“. */

function ladeDateisicherungen() {
  try { return JSON.parse(localStorage.getItem(KEY_DATEI) || '{}') || {}; } catch (e) { return {}; }
}

/** ISO-Zeitpunkt der letzten Dateisicherung oder null */
export function dateisicherung(pid) {
  return ladeDateisicherungen()[pid] || null;
}

/** Dateisicherung vermerken (wird beim Export der Planungsdatei aufgerufen) */
export function dateisicherungVermerken(pid) {
  try {
    const alle = ladeDateisicherungen();
    alle[pid] = new Date().toISOString();
    localStorage.setItem(KEY_DATEI, JSON.stringify(alle));
  } catch (e) { /* ohne Vermerk gilt weiter „nie gesichert“ – die sichere Seite */ }
}

/** Enthält die Planung genug Arbeit, dass ein Verlust weh täte?
 *  Maßstab ist die geleistete Arbeit, nicht die Zahl der Strecken: der
 *  häufigste Auftrag ist eine einzige lange Trasse von der Führungsstelle zum
 *  Abschnitt – zählte man Strecken, wäre gerade sie von jeder Warnung
 *  ausgenommen. Eine Strecke mit einem einzelnen Punkt bleibt ein Versehen
 *  und zählt gar nicht mit. */
export function istGehaltvoll(p) {
  if (!p) return false;
  const punkte = p.strecken.reduce(
    (n, s) => n + ((s.punkte || []).length >= 2 ? s.punkte.length : 0), 0);
  return punkte >= 4 || (p.zeichen || []).length >= 3;
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
    einsatzabschnitte: (p.einsatzabschnitte || []).map((a, i) => ({
      id: a.id || id(),
      name: a.name || `Einsatzabschnitt ${i + 1}`,
      leiter: a.leiter || '',
      farbe: a.farbe || FARBEN[i % FARBEN.length],
      bemerkung: a.bemerkung || '',
      sichtbar: a.sichtbar !== false
    })),
    strecken: (p.strecken || []).map(s => {
      const v = neueStrecke({ strecken: [] });
      return {
        ...v, ...s,
        id: s.id || id(),
        kabeltyp: KABEL_ALIAS[s.kabeltyp] || s.kabeltyp || v.kabeltyp,
        strom: { ...v.strom, ...(s.strom || {}) },
        punkte: (s.punkte || []).map(pt => ({ ...neuerPunkt(pt.lat, pt.lng), ...pt, id: pt.id || id() }))
      };
    }),
    // Die Zeichen kamen früher aus einem selbst gezeichneten Satz mit eigenen
    // Kennungen. Wer so einen Plan lädt, bekommt statt eines leeren Markers das
    // Standardzeichen — Ort, Beschriftung und Bemerkung bleiben erhalten.
    zeichen: (p.zeichen || []).map(z => {
      const { org, staerke, ...rest } = z;
      return {
        ...neuesZeichen(z.lat, z.lng), ...rest, id: z.id || id(),
        symbol: symbolBekannt(z.symbol) ? z.symbol : STANDARD_SYMBOL
      };
    })
  };
  out.id = p.id || id();
  /* Eine Teilplanung kann Strecken und Zeichen mitbringen, deren Abschnitt
     nicht in der Datei steht. Ein Verweis ins Leere wäre eine unsichtbare
     Gruppe – sie gelten dann als nicht zugeteilt. */
  const bekannt = new Set(out.einsatzabschnitte.map(a => a.id));
  out.strecken.forEach(s => { if (!bekannt.has(s.abschnitt)) s.abschnitt = null; });
  out.zeichen.forEach(z => { if (!bekannt.has(z.abschnitt)) z.abschnitt = null; });
  return out;
}

export const store = new Store();
