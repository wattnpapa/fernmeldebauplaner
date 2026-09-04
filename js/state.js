// state.js – Datenmodell, Projektverwaltung, LocalStorage, Undo

import { neueStromangabe } from './strom.js';
import { neueRichtfunkangabe } from './richtfunk.js';
import { STANDARD_SYMBOL, symbolBekannt } from './symbols.js';
import { QUERUNG_STANDARD, BAUWEISE_STANDARD } from './vorschrift.js';
import { flaechenartById } from './flaechen-vorlagen.js';

export const SCHEMA = 7;
const KEY_PROJEKTE = 'fbp.projekte.v1';
const KEY_AKTIV    = 'fbp.aktiv.v1';
const KEY_DATEI    = 'fbp.dateisicherung.v1';

/** Grobes Kontingent, das Browser je Website für den localStorage bereitstellen */
export const SPEICHER_KONTINGENT = 5 * 1024 * 1024;

export const KABELTYPEN = [
  { id: 'fk2',    name: 'Feldkabel 2-adrig (FK 1×2)', kurz: 'FK',      trommel: 800,  gewicht: 14.5, zuschlag: 15, leistung: 900 },
  { id: 'ffk',    name: 'Feldfernkabel (FFK, auch FK 2×2)', kurz: 'FFK', trommel: 400, gewicht: 60, zuschlag: 15, leistung: 700 },
  { id: 'ak',     name: 'Anschlusskabel (AK 10×2)',   kurz: 'AK',      trommel: 230,  gewicht: 56,   zuschlag: 10, leistung: 500 },
  { id: 'vk',     name: 'Verbindungskabel (VK 10×2)', kurz: 'VK',      trommel: 200,  gewicht: 56,   zuschlag: 10, leistung: 500 },
  { id: 'lwl',    name: 'Lichtwellenleiter (LWL)',    kurz: 'LWL',     trommel: 500,  zuschlag: 20, leistung: 500 },
  { id: 'lan',    name: 'Netzwerkkabel (Cat.)',       kurz: 'LAN',     trommel: 100,  zuschlag: 15, leistung: 600 },
  { id: 'koax',   name: 'Koaxialkabel / Antennenzuleitung', kurz: 'Koax', trommel: 100, zuschlag: 15, leistung: 500 },
  { id: 'strom',  name: 'Stromleitung / Leitungsroller', kurz: 'Strom', trommel: 50,  zuschlag: 15, leistung: 600 },
  { id: 'sonst',  name: 'Sonstige Leitung',           kurz: 'Sonst.',  trommel: 500,  zuschlag: 15, leistung: 700 },
  /* Die Richtfunkstrecke ist eine Leitungsart ohne Leitung: sie führt wie ein
     Kabel von Punkt zu Punkt, wird aber nicht verlegt – kein Bauzuschlag, keine
     Trommel, keine Verlegeleistung. Als eigene Art statt eines eigenen
     Objekts, damit Liste, Undo, Bauauftrag und Export sie ohne zweiten Weg
     mitnehmen. Die Nullen sind die Vorgaben, die das Formular beim Wechsel der
     Art mitzieht. */
  { id: 'richtfunk', name: 'WLAN-Richtfunk (Funkstrecke)', kurz: 'Funk', funk: true, trommel: 0, zuschlag: 0, leistung: 0 }
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

/* Kartenkennungen, die es kurz gab und die in gespeicherten Planungen liegen
   können: „GeoPortal DE" hieß die basemap.de-Ebene zwei Tage lang, „DWD Topo"
   war nie lieferfähig und ist wieder draußen. Ein unbekannter Wert würde das
   Auswahlfeld leer lassen. */
const BASISKARTE_ALIAS = { geoportal_de: 'basemapde', dwd_topo: 'topplus' };

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
      bilder: true, koordformat: 'mgrs', symbolgroesse: 1
    },
    einsatzabschnitte: [],
    zeichengruppen: [],
    strecken: [],
    zeichen: [],
    flaechen: [],
    bilder: []
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

/* Zeichengruppen liegen quer zum Einsatzabschnitt: der sagt, wer zuständig ist,
   die Gruppe, was im Lagebild zusammengehört – „Kräfte“, „Gefahrenstellen“,
   „Fernmeldemittel“. Deshalb ein eigenes Feld statt einer zweiten Bedeutung des
   Abschnitts: ein Zeichen des Abschnitts Nord kann eine Gefahrenstelle sein, und
   beim Ausblenden aller Gefahrenstellen darf der Abschnitt nicht mitgehen.
   Sie sind ebenso freiwillig wie die Abschnitte – ohne sie bleibt die
   Zeichenliste, was sie war. */
export function neueZeichengruppe(projekt) {
  const n = (projekt.zeichengruppen || []).length;
  return {
    id: id(),
    name: `Zeichengruppe ${n + 1}`,
    farbe: FARBEN[n % FARBEN.length],
    bemerkung: '',
    sichtbar: true
  };
}

export const zeichengruppeById = (p, gid) =>
  (p && gid ? (p.zeichengruppen || []).find(g => g.id === gid) : null) || null;

/** Alle Zeichen einer Gruppe; `null` liefert die nicht gruppierten. */
export function zeichenInGruppe(p, gid) {
  return p.zeichen.filter(z => (z.gruppe || null) === (gid || null));
}

const gehoertZu = (x, aid) => (x.abschnitt || null) === (aid || null);

/** Alle Strecken eines Abschnitts; `null` liefert die nicht zugeteilten. */
export function streckenIm(p, aid) { return p.strecken.filter(s => gehoertZu(s, aid)); }

/** Ebenso für die taktischen Zeichen */
export function zeichenIm(p, aid) { return p.zeichen.filter(z => gehoertZu(z, aid)); }

/** Und für die Flächen */
export function flaechenIm(p, aid) { return (p.flaechen || []).filter(f => gehoertZu(f, aid)); }

/** Nicht zugeteilt heißt: gehört allen. Ein Abschnitt bekommt seine eigenen
 *  Zeichen und dazu die des gemeinsamen Lagebildes – ohne Abschnitt alle. */
export function zeichenFuer(p, aid) {
  return aid ? p.zeichen.filter(z => !z.abschnitt || z.abschnitt === aid) : p.zeichen;
}

/** Dieselbe Regel für die Flächen: nicht zugeteilt heißt, sie gehören allen. */
export function flaechenFuer(p, aid) {
  const alle = p.flaechen || [];
  return aid ? alle.filter(f => !f.abschnitt || f.abschnitt === aid) : alle;
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

/** Zeigt die Gruppe dieses Zeichens? Ohne Gruppe: immer. */
export function zeichengruppeZeigt(p, z) {
  const g = zeichengruppeById(p, z.gruppe);
  return !g || g.sichtbar !== false;
}

/* Drei Schalter können ein Zeichen verbergen: sein eigenes Auge, das seines
   Einsatzabschnitts und das seiner Gruppe. Jeder für sich genügt – sonst
   brächte das Ausblenden einer Gruppe die Zeichen wieder hervor, die einzeln
   schon abgeschaltet waren. */
export function zeichenSichtbar(p, z) {
  return z.sichtbar !== false && abschnittZeigt(p, z) && zeichengruppeZeigt(p, z);
}

/** Eine Fläche verbergen ihr eigenes Auge und das ihres Abschnitts. */
export function flaecheSichtbar(p, f) {
  return f.sichtbar !== false && abschnittZeigt(p, f);
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
    richtfunk: neueRichtfunkangabe(),
    abschnitt: null,
    trupp: '',
    bemerkung: '',
    sichtbar: true,
    punkte: []
  };
}

/* Querungsart und Bauweise sind nur bei der Punktart 'querung' von Bedeutung,
   werden aber an jedem Punkt mitgeführt: ein späterer Wechsel der Punktart soll
   die einmal getroffene Wahl nicht verlieren. `querungszeit` null heißt: der
   Richtwert der Bauweise gilt (Schema 6). */
export function neuerPunkt(lat, lng, art = 'punkt') {
  return {
    id: id(), lat, lng, art, name: '', bemerkung: '',
    querungsart: QUERUNG_STANDARD, bauweise: BAUWEISE_STANDARD, querungszeit: null
  };
}

export function neuesZeichen(lat, lng, symbol = STANDARD_SYMBOL) {
  return {
    id: id(), lat, lng, symbol, abschnitt: null, gruppe: null,
    drehung: 0, groesse: 1, label: '', bemerkung: '', sichtbar: true
  };
}

/* Eine Fläche mit festen Maßen: Fahrzeug, Anhänger, Zelt oder ein freier
   Bereich. `lat`/`lng` ist die Mitte, `breite` und `laenge` stehen in Metern,
   `drehung` in Grad im Uhrzeigersinn. Die Maße kommen aus der Vorlage und
   bleiben am Eintrag: wer sie ändert, ändert nur diese Fläche. `verbund`
   fasst die Teile einer gemeinsam gesetzten Aufstellung zusammen – sie
   werden zusammen verschoben und gedreht (siehe `js/flaechen.js`). */
export function neueFlaeche(lat, lng, art = 'frei') {
  const vorlage = flaechenartById(art);
  return {
    id: id(), art: vorlage.id, name: '', lat, lng, drehung: 0,
    breite: vorlage.breite, laenge: vorlage.laenge, farbe: '#003399',
    abschnitt: null, verbund: null, bemerkung: '', sichtbar: true
  };
}

/* Ein Lichtbild vom Bauort. Hier steht nur, was das Bild zeigt und wo es
   aufgenommen wurde – die Bilddaten selbst liegen im Bildspeicher des Geräts
   (`js/bildspeicher.js`) und nicht im Projekt: sonst spränge jeder
   Undo-Abzug um das Vielfache an.

   `lat`/`lng` dürfen `null` sein: ein Bild ohne Ortsangabe der Kamera wird
   nicht verworfen, sondern wartet in der Liste darauf, auf der Karte gesetzt
   zu werden. */
export function neuesBild(o = {}) {
  /* Nur der Weg über den EXIF-Block gibt hier Koordinaten mit. Ein Ort, den die
     Kamera beim Auslösen aufgezeichnet hat, ist eine Messung und keine Setzung –
     er wird auf der Karte gegen das Verschieben gesichert (siehe `js/bilder.js`).
     Für Bestandsplanungen fällt daraus zugleich die vorsichtige Annahme: ein
     Bild, das schon einen Ort hat, gilt als gemessen und ist geschützt. */
  const ausKamera = Number.isFinite(o.lat) && Number.isFinite(o.lng);
  return {
    id: o.id || id(),
    lat: ausKamera ? o.lat : null,
    lng: ausKamera ? o.lng : null,
    ortAusKamera: ausKamera,
    name: o.name || '',
    bemerkung: '',
    aufgenommen: o.aufgenommen || '',
    richtung: Number.isFinite(o.richtung) ? o.richtung : null,
    breite: o.breite || 0, hoehe: o.hoehe || 0,
    groesse: o.groesse || 0,
    sichtbar: true
  };
}

/** Ein Bild erscheint auf der Karte, sobald es einen Ort hat und sein Auge offen steht. */
export const bildAufKarte = b => b.sichtbar !== false && b.lat !== null && b.lng !== null;

/* Der Schalter in den Kartenoptionen nimmt alle Bildmarken auf einmal von der
   Karte, ohne die Augen der einzelnen Bilder anzurühren: wer vor dem Ausdruck
   oder zum Zeichnen der Trasse freie Sicht will, soll danach nicht zwanzig
   Augen einzeln wieder öffnen müssen. Ältere Stände kennen den Schlüssel
   nicht – dort gilt „an“, sonst verschwänden ihre Bilder beim Laden. */
export const bildmarkenAn = p => p.optionen.bilder !== false;

/** Belegter Platz aller Bilder einer Planung in Bytes */
export const bilderBelegung = p => (p.bilder || []).reduce((n, b) => n + (b.groesse || 0), 0);

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
  flaeche(fid) { return (this.projekt.flaechen || []).find(f => f.id === fid); }

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
      strecken: (p.strecken || []).length, zeichen: (p.zeichen || []).length,
      bilder: (p.bilder || []).length
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
  /* Auch aufgenommene Lichtbilder sind geleistete Arbeit: sie sind vom Bauort
     mitgebracht und in keiner Kamerarolle wiederzufinden, wenn der
     Browserspeicher fällt. */
  return punkte >= 4 || (p.zeichen || []).length >= 3 || (p.bilder || []).length >= 2 ||
    (p.flaechen || []).length >= 2;
}

/** Ältere/fremde Projektdateien auf das aktuelle Schema heben */
export function migrieren(p) {
  const v = neuesProjekt(p.name || 'Import');
  const ansicht = { ...v.ansicht, ...(p.ansicht || {}) };
  ansicht.basemap = BASISKARTE_ALIAS[ansicht.basemap] || ansicht.basemap;
  const out = {
    ...v, ...p,
    version: SCHEMA,
    kopf: { ...v.kopf, ...(p.kopf || {}) },
    ansicht,
    optionen: { ...v.optionen, ...(p.optionen || {}) },
    einsatzabschnitte: (p.einsatzabschnitte || []).map((a, i) => ({
      id: a.id || id(),
      name: a.name || `Einsatzabschnitt ${i + 1}`,
      leiter: a.leiter || '',
      farbe: a.farbe || FARBEN[i % FARBEN.length],
      bemerkung: a.bemerkung || '',
      sichtbar: a.sichtbar !== false
    })),
    /* Schema 2 hat die Zeichengruppen eingeführt. Ältere Stände bringen das
       Feld nicht mit – sie öffnen dann ungegliedert, so wie sie zuletzt
       aussahen. */
    zeichengruppen: (p.zeichengruppen || []).map((g, i) => ({
      id: g.id || id(),
      name: g.name || `Zeichengruppe ${i + 1}`,
      farbe: g.farbe || FARBEN[i % FARBEN.length],
      bemerkung: g.bemerkung || '',
      sichtbar: g.sichtbar !== false
    })),
    strecken: (p.strecken || []).map(s => {
      const v = neueStrecke({ strecken: [] });
      return {
        ...v, ...s,
        id: s.id || id(),
        kabeltyp: KABEL_ALIAS[s.kabeltyp] || s.kabeltyp || v.kabeltyp,
        strom: { ...v.strom, ...(s.strom || {}) },
        /* Schema 7 hat die Angaben der Richtfunkstrecke eingeführt. Ältere
           Stände bringen sie nicht mit und öffnen mit dem leeren Formular –
           die beiden Aufbauplätze müssen dabei einzeln aufgefüllt werden,
           sonst stünde dort ein Feld ohne Standorte. */
        richtfunk: {
          ...v.richtfunk, ...(s.richtfunk || {}),
          standorte: v.richtfunk.standorte.map((leer, i) =>
            ({ ...leer, ...(((s.richtfunk || {}).standorte || [])[i] || {}) }))
        },
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
    }),
    /* Schema 5 hat die Flächen eingeführt. Ältere Stände bringen das Feld
       nicht mit und öffnen ohne Flächen; was da ist, wird auf die Vorgaben
       gelegt, damit kein Eintrag ohne Maß auf die Karte kommt. */
    flaechen: (p.flaechen || []).map(f => ({
      ...neueFlaeche(f.lat, f.lng, f.art), ...f, id: f.id || id(),
      breite: Number(f.breite) > 0 ? Number(f.breite) : neueFlaeche(0, 0, f.art).breite,
      laenge: Number(f.laenge) > 0 ? Number(f.laenge) : neueFlaeche(0, 0, f.art).laenge
    })),
    /* Schema 3 hat die Lichtbilder eingeführt, Schema 4 den Vermerk, woher ihr
       Ort stammt – für ältere Stände setzt ihn `neuesBild` aus den vorhandenen
       Koordinaten. `daten` und `mini` tragen sie
       nur in der Sicherungsdatei; im Browserspeicher haben sie nichts zu
       suchen – dort liegen die Bilddaten im Bildspeicher, und der localStorage
       wäre mit dem ersten Bild voll. */
    bilder: (p.bilder || []).map(b => {
      const { daten, mini, ...rest } = b;
      return { ...neuesBild(rest), ...rest, id: b.id || id(),
        lat: Number.isFinite(b.lat) ? b.lat : null,
        lng: Number.isFinite(b.lng) ? b.lng : null };
    })
  };
  out.id = p.id || id();
  /* Eine Teilplanung kann Strecken und Zeichen mitbringen, deren Abschnitt
     nicht in der Datei steht. Ein Verweis ins Leere wäre eine unsichtbare
     Gruppe – sie gelten dann als nicht zugeteilt. */
  const bekannt = new Set(out.einsatzabschnitte.map(a => a.id));
  out.strecken.forEach(s => { if (!bekannt.has(s.abschnitt)) s.abschnitt = null; });
  out.zeichen.forEach(z => { if (!bekannt.has(z.abschnitt)) z.abschnitt = null; });
  out.flaechen.forEach(f => { if (!bekannt.has(f.abschnitt)) f.abschnitt = null; });
  // Ebenso für die Gruppen: ein Verweis ins Leere wäre ein Zeichen, das kein
  // Auge mehr erreicht.
  const gruppen = new Set(out.zeichengruppen.map(g => g.id));
  out.zeichen.forEach(z => { if (!gruppen.has(z.gruppe)) z.gruppe = null; });
  return out;
}

export const store = new Store();
