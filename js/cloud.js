// cloud.js – Schnittstelle zu einem eigenen Speicher und die Angaben dazu

/* Der Gerätespeicher bleibt die Wahrheit; was hier steht, legt sich darüber.
   Am Bauort ist kein Netz – gearbeitet wird deshalb immer im localStorage und
   im Bildspeicher, hochgeladen wird, wenn Netz da ist. Die Begründung dieser
   Aufteilung und die Auswahl der Anbieter stehen in `CLOUD.md`; der Abgleich
   selbst liegt in `js/abgleich.js`, die Oberfläche dazu in `js/cloud-ui.js`.

   Hier steht nur die Schnittstelle: auflisten, lesen, schreiben, löschen,
   dazu die Marke jeder Datei. Was ein Anbieter darüber hinaus kann – Freigaben,
   Papierkorb, Versionen – bleibt seiner eigenen Oberfläche überlassen.

   Solange niemand eine Verbindung einrichtet, wird von alldem nichts geladen:
   die Rückseiten kommen erst beim Einrichten dazu, so wie der HEIC-
   Entschlüsseler in `js/heic.js` erst kommt, wenn eine HEIC-Datei ankommt. */

/** Ordner, in dem die Anwendung ihre Planungen ablegt – bei jedem Anbieter gleich */
export const WURZEL = 'fmbauplaner.app';

/** Die Planungsdatei in einem Planungsordner */
export const PLANUNGSDATEI = 'planung.json';

/** Unterordner der Lichtbilder */
export const BILDORDNER = 'bilder';

// ---------------------------------------------------------------- Fehler

/* Zwei Fehler werden unterschieden, weil der Abgleich verschieden auf sie
   antwortet: ein Konflikt ist kein Ausfall, sondern ein zweites Gerät. */

/** Die Datei am Ziel trägt nicht mehr die Marke, gegen die geschrieben wurde. */
export class KonfliktFehler extends Error {
  constructor(nachricht = 'Am Speicher liegt ein neuerer Stand.') {
    super(nachricht);
    this.name = 'KonfliktFehler';
  }
}

/** Der Anbieter lehnt ab oder ist nicht erreichbar. `erneuern` heißt: die
 *  Anmeldung ist abgelaufen und der Nutzer muss sich neu anmelden. */
export class CloudFehler extends Error {
  constructor(nachricht, { erneuern = false } = {}) {
    super(nachricht);
    this.name = 'CloudFehler';
    this.erneuern = erneuern;
  }
}

// ---------------------------------------------------------------- Ablage

/* Nicht der localStorage wie sonst alles: der Ordner auf dem Gerät wird über
   ein `FileSystemDirectoryHandle` angesprochen, und das überlebt nur die
   IndexedDB – als Zeichenkette gibt es ihn nicht. Da die Marken ohnehin
   daneben liegen müssen, liegt hier alles zusammen, was zur Anbindung gehört.

   Zugangsschlüssel und Anmeldemarken liegen damit im Browserspeicher. Das ist
   ohne Serveranteil nicht anders zu haben und steht so im Einrichtungstext –
   wer den Rechner teilt, trennt die Verbindung. */

const DATENBANK = 'fbp.cloud';
const LAGER = 'zustand';

let lauf = null;

function db() {
  if (lauf) return lauf;
  lauf = new Promise((fertig, fehler) => {
    if (!window.indexedDB) return fehler(new Error('Dieser Browser stellt keinen Speicher bereit.'));
    const antrag = indexedDB.open(DATENBANK, 1);
    antrag.onupgradeneeded = () => {
      if (!antrag.result.objectStoreNames.contains(LAGER)) {
        antrag.result.createObjectStore(LAGER);
      }
    };
    antrag.onsuccess = () => fertig(antrag.result);
    antrag.onerror = () => fehler(new Error('Speicher des Browsers nicht verfügbar.'));
    antrag.onblocked = () => fehler(new Error('Speicher ist von einem anderen Fenster belegt.'));
  });
  lauf.catch(() => { lauf = null; });
  return lauf;
}

async function imLager(modus, tun) {
  const verbindung = await db();
  return new Promise((fertig, fehler) => {
    const vorgang = verbindung.transaction(LAGER, modus);
    let ergebnis;
    try { ergebnis = tun(vorgang.objectStore(LAGER)); } catch (e) { return fehler(e); }
    vorgang.oncomplete = () => fertig(ergebnis instanceof IDBRequest ? ergebnis.result : ergebnis);
    vorgang.onerror = () => fehler(vorgang.error || new Error('Speicher meldet einen Fehler.'));
    vorgang.onabort = () => fehler(vorgang.error || new Error('Speicher hat abgebrochen.'));
  });
}

/** Wert aus der Ablage; `null`, wenn nichts da ist */
export async function ablageLesen(schluessel) {
  try { return (await imLager('readonly', l => l.get(schluessel))) ?? null; }
  catch (e) { return null; }
}

export async function ablageSchreiben(schluessel, wert) {
  await imLager('readwrite', l => l.put(wert, schluessel));
}

export async function ablageLoeschen(schluessel) {
  try { await imLager('readwrite', l => l.delete(schluessel)); } catch (e) { /* dann bleibt er stehen */ }
}

// ---------------------------------------------------------------- Anbieter

/* Die Reihenfolge ist die aus `CLOUD.md` und zugleich die der Empfehlung: Wer
   einen Sync-Ordner auf dem Gerät hat, braucht kein Konto und keinen Schlüssel
   – über ihn sind iCloud Drive, OneDrive, Dropbox, Nextcloud und Synology
   Drive miterledigt, ohne dass die Anwendung selbst etwas überträgt.

   `felder` beschreibt, was der Nutzer beim Einrichten eintragen muss. Keiner
   dieser Werte ist hier fest verdrahtet: der FMBauplaner hat bei keinem
   Anbieter eine eigene Anwendung registriert, und eine erfundene Kennung wäre
   eine, die nicht funktioniert. Wer einen Anbieter mit Anmeldung nutzen will,
   registriert dort eine eigene Anwendung – das ist bei allen dreien kostenlos
   und dauert wenige Minuten. */

export const ANBIETER = [
  {
    id: 'ordner',
    name: 'Ordner auf diesem Gerät',
    kurz: 'Ohne Konto. Zeigt der Ordner in einen Sync-Ordner (iCloud Drive, OneDrive, ' +
          'Dropbox, Nextcloud, Synology Drive), erledigt dessen Programm den Rest.',
    modul: './cloud-ordner.js',
    verfuegbar: () => typeof window.showDirectoryPicker === 'function',
    fehlt: 'Dieser Browser kann keinen Ordner freigeben. Es geht in Chrome und Edge – ' +
           'Firefox und Safari können es nicht.',
    felder: []
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    kurz: 'Anmeldung im Browser, ohne Serveranteil. Braucht einen eigenen App-Schlüssel.',
    modul: './cloud-dropbox.js',
    verfuegbar: () => true,
    felder: [
      { schluessel: 'appKey', titel: 'App-Schlüssel (App key)', pflicht: true,
        platzhalter: 'z. B. a1b2c3d4e5f6g7h' }
    ]
  },
  {
    id: 'onedrive',
    name: 'OneDrive (Microsoft Graph)',
    kurz: 'Privates und dienstliches Microsoft-Konto. Bei Geschäftskonten kann die ' +
          'Zustimmung beim Administrator liegen.',
    modul: './cloud-onedrive.js',
    verfuegbar: () => true,
    felder: [
      { schluessel: 'clientId', titel: 'Anwendungs-ID (Client ID)', pflicht: true,
        platzhalter: '00000000-0000-0000-0000-000000000000' },
      { schluessel: 'mandant', titel: 'Konten', typ: 'select', vorgabe: 'common',
        werte: [['common', 'Privat und dienstlich (common)'],
                ['consumers', 'Nur privates Konto (consumers)'],
                ['organizations', 'Nur dienstliches Konto (organizations)']] }
    ]
  },
  {
    id: 'webdav',
    name: 'Nextcloud oder WebDAV',
    kurz: 'Eigene Instanz. Der Server muss CORS-Kopfzeilen senden – Nextcloud tut das ' +
          'von sich aus nicht.',
    modul: './cloud-webdav.js',
    verfuegbar: () => true,
    felder: [
      { schluessel: 'adresse', titel: 'Adresse des WebDAV-Ordners', pflicht: true,
        platzhalter: 'https://wolke.example.de/remote.php/dav/files/benutzer/' },
      { schluessel: 'benutzer', titel: 'Benutzername', pflicht: true },
      { schluessel: 'passwort', titel: 'App-Passwort', typ: 'password', pflicht: true,
        hinweis: 'In Nextcloud unter Einstellungen → Sicherheit → App-Passwort erzeugen. ' +
                 'Nicht das Kennwort des Kontos eintragen.' }
    ]
  },
  {
    id: 's3',
    name: 'S3-kompatibler Speicher',
    kurz: 'MinIO, Hetzner, Wasabi, Backblaze B2. CORS je Eimer einstellbar – dafür liegt ' +
          'der Zugangsschlüssel im Browser.',
    modul: './cloud-s3.js',
    verfuegbar: () => !!(window.crypto && window.crypto.subtle),
    fehlt: 'Die Signatur braucht die Krypto-Schnittstelle des Browsers. Sie steht nur ' +
           'über HTTPS bereit.',
    felder: [
      { schluessel: 'endpunkt', titel: 'Endpunkt', pflicht: true,
        platzhalter: 'https://s3.eu-central-1.example.com' },
      { schluessel: 'eimer', titel: 'Eimer (Bucket)', pflicht: true },
      { schluessel: 'region', titel: 'Region', vorgabe: 'us-east-1', platzhalter: 'us-east-1' },
      { schluessel: 'schluesselId', titel: 'Zugriffsschlüssel (Access Key ID)', pflicht: true },
      { schluessel: 'geheim', titel: 'Geheimer Schlüssel (Secret Access Key)',
        typ: 'password', pflicht: true },
      { schluessel: 'pfadstil', titel: 'Adressform', typ: 'select', vorgabe: 'pfad',
        werte: [['pfad', 'Eimer im Pfad (MinIO, die meisten)'],
                ['host', 'Eimer im Rechnernamen (Amazon S3)']] }
    ]
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    kurz: 'Ohne Serveranteil läuft die Anmeldung nach etwa einer Stunde ab und muss ' +
          'erneuert werden.',
    modul: './cloud-gdrive.js',
    verfuegbar: () => true,
    felder: [
      { schluessel: 'clientId', titel: 'Client-ID', pflicht: true,
        platzhalter: '000000000000-xxxxxxxx.apps.googleusercontent.com' }
    ]
  }
];

export const anbieterById = kennung => ANBIETER.find(a => a.id === kennung) || null;

// ---------------------------------------------------------------- Verbindung

/* Eine Planung ist an einen Ort gebunden, nicht an mehrere: zwei Speicher
   zugleich hießen zwei Marken je Datei und zwei Konfliktfälle, die sich
   gegenseitig auslösen. Vorerst gilt deshalb: eine Verbindung, ein Ort. */

const SCHLUESSEL_VERBINDUNG = 'verbindung';

let gemerkt = null;      // der geladene Stand, damit die Oberfläche synchron fragen kann
let geladen = false;

/**
 * Die eingerichtete Verbindung, oder `null`.
 * @returns {Promise<{anbieter: string, angaben: object, name: string, seit: string}|null>}
 */
export async function verbindungLaden() {
  if (!geladen) {
    gemerkt = await ablageLesen(SCHLUESSEL_VERBINDUNG);
    geladen = true;
  }
  return gemerkt;
}

/** Der zuletzt geladene Stand, ohne zu warten – `null`, solange nichts geladen ist */
export const verbindung = () => gemerkt;

export async function verbindungSetzen(v) {
  gemerkt = v;
  geladen = true;
  rueckseiteVergessen();
  await ablageSchreiben(SCHLUESSEL_VERBINDUNG, v);
}

/** Angaben einer bestehenden Verbindung fortschreiben – etwa eine neue Anmeldemarke */
export async function angabenSchreiben(angaben) {
  if (!gemerkt) return;
  gemerkt = { ...gemerkt, angaben: { ...gemerkt.angaben, ...angaben } };
  await ablageSchreiben(SCHLUESSEL_VERBINDUNG, gemerkt);
}

/**
 * Verbindung trennen. Die Dateien am Speicher bleiben liegen – sie zu löschen
 * ist Sache des Nutzers, und ein Programm, das beim Trennen fremde Ordner
 * leert, wäre das Gegenteil dessen, was hier zugesagt wird.
 */
export async function verbindungTrennen() {
  const alt = gemerkt;
  gemerkt = null;
  geladen = true;
  rueckseiteVergessen();
  await ablageLoeschen(SCHLUESSEL_VERBINDUNG);
  if (!alt) return;
  try {
    const anbieter = anbieterById(alt.anbieter);
    const modul = anbieter && await import(anbieter.modul);
    await modul?.abmelden?.(alt.angaben);
  } catch (e) { /* der Zugriff beim Anbieter wird ohnehin dort widerrufen */ }
}

// ---------------------------------------------------------------- Rückseite

/* Die Rückseite wird verworfen, sobald sich die Angaben ändern: sie hält
   Anmeldemarken, und eine aufgehobene trüge nach der Neuanmeldung noch die
   abgelaufene. Das Modul selbst holt der Browser nur einmal. */

let rueckseiteLauf = null;
let rueckseiteFuer = null;

/**
 * Die Rückseite zur eingerichteten Verbindung.
 * @returns {Promise<object|null>} `null`, wenn nichts eingerichtet ist
 */
export async function rueckseite() {
  const v = await verbindungLaden();
  if (!v) { rueckseiteVergessen(); return null; }
  const kennzeichen = JSON.stringify([v.anbieter, v.angaben]);
  if (rueckseiteLauf && rueckseiteFuer === kennzeichen) return rueckseiteLauf;
  rueckseiteFuer = kennzeichen;
  rueckseiteLauf = (async () => {
    const anbieter = anbieterById(v.anbieter);
    if (!anbieter) throw new CloudFehler('Dieser Anbieter ist der Anwendung nicht bekannt.');
    const modul = await import(anbieter.modul);
    return imWurzelordner(modul.bauen(v.angaben, angabenSchreiben));
  })();
  rueckseiteLauf.catch(() => { rueckseiteVergessen(); });
  return rueckseiteLauf;
}

/* Jede Rückseite arbeitet unterhalb desselben Ordners. Das hier einmal zu
   setzen statt in jedem der sechs Module spart nicht nur die Wiederholung: eine
   Rückseite, die es vergäße, schriebe ihre Planungsordner still ins
   Hauptverzeichnis des Kontos – und das fiele erst auf, wenn dort zwanzig
   Ordner liegen, die dort nicht hingehören. */
function imWurzelordner(rs) {
  const unten = p => (p ? `${WURZEL}/${p}` : WURZEL);
  return {
    auflisten: p => rs.auflisten(unten(p)),
    lesen: p => rs.lesen(unten(p)),
    schreiben: (p, blob, erwartet) => rs.schreiben(unten(p), blob, erwartet),
    loeschen: p => rs.loeschen(unten(p)),
    beschreibung: () => rs.beschreibung?.() || ''
  };
}

/** Nach einer Neuanmeldung ist die gebaute Rückseite überholt */
export function rueckseiteVergessen() {
  rueckseiteLauf = null;
  rueckseiteFuer = null;
}

// ---------------------------------------------------------------- Pfade

/* Der Ordnername trägt beides: den Namen für den Menschen und die Kennung für
   die Maschine. Wer seine Cloud aufräumt, soll erkennen, was da liegt; benennt
   er den Ordner dabei um, findet der Abgleich die Planung an der Kennung in
   `planung.json` wieder. Der Ordnername ist Beschriftung, nicht Schlüssel. */

/* Was in einem Ordnernamen nichts zu suchen hat: die Zeichen, an denen Windows
   die Datei gar nicht erst anlegt, und dazu die, die in einer Adresse Ärger
   machen. Steuerzeichen kommen über den Bereich am Ende mit. */
const VERBOTEN = new RegExp('[\\\\/:*?"<>|#%&{}\\x00-\\x1f]', 'g');

/** „Hochwasser Elbe 2026 (x7k3p9q)“ – Beschriftung und Kennung in einem */
export function ordnerName(projekt) {
  const roh = String(projekt.name || 'Planung').replace(VERBOTEN, ' ').replace(/\s+/g, ' ').trim();
  /* Ein Punkt am Ende macht den Ordner unter Windows unanlegbar, und ein leerer
     Name entstünde aus einer Planung, die nur Sonderzeichen heißt. */
  const name = (roh.replace(/[. ]+$/, '') || 'Planung').slice(0, 80);
  return `${name} (${projekt.id})`;
}

/** Die Kennung aus einem Ordnernamen, oder `null` */
export function kennungAusOrdner(name) {
  const treffer = /\(([A-Za-z0-9_-]{4,})\)\s*$/.exec(String(name || ''));
  return treffer ? treffer[1] : null;
}

/** Pfadstücke zu einem Pfad zusammensetzen – ohne führenden Schrägstrich */
export const pfad = (...teile) => teile.filter(Boolean).join('/');

// ---------------------------------------------------------------- Anmeldung

/* Die Anmeldung läuft in einem eigenen Fenster und nicht als Sprung der ganzen
   Seite: ein Sprung verlöre den halb gezeichneten Streckenzug und schriebe die
   Anmeldemarke ausgerechnet in die Adresszeile, in der sonst der geteilte Link
   steht. Das kleine Fenster landet auf `cloud-rueckweg.html`, das nichts
   weiter tut, als seine eigene Adresse zurückzureichen. */

/** Die Adresse, die beim Anbieter als Rückweg (Redirect URI) einzutragen ist */
export function rueckwegAdresse() {
  return new URL('cloud-rueckweg.html', location.href).href;
}

/**
 * Ein Anmeldefenster öffnen und auf seine Rückgabe warten.
 * @param {string} adresse die Anmeldeadresse des Anbieters
 * @param {string} zustand der `state`-Wert, gegen den die Antwort geprüft wird
 * @returns {Promise<URLSearchParams>} die Werte aus Abfrage und Fragment
 */
export function anmeldefenster(adresse, zustand) {
  const fenster = window.open(adresse, 'fbp-anmeldung', 'width=520,height=680,menubar=no,toolbar=no');
  if (!fenster) {
    return Promise.reject(new CloudFehler(
      'Das Anmeldefenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.'));
  }
  return new Promise((fertig, fehler) => {
    let wache = null;
    const aufraeumen = () => { window.removeEventListener('message', hoeren); clearInterval(wache); };

    function hoeren(e) {
      if (e.origin !== location.origin || !e.data || e.data.art !== 'fbp-cloud-rueckweg') return;
      const werte = new URLSearchParams(e.data.werte || '');
      /* Der `state` ist der Schutz davor, dass eine fremde Antwort als die
         eigene durchgeht – ohne ihn nähme die Anwendung jede Marke an, die
         irgendjemand ihr ins Fenster schiebt. */
      if (zustand && werte.get('state') !== zustand) return;
      aufraeumen();
      try { fenster.close(); } catch (x) { /* schließt sich selbst */ }
      const fehlercode = werte.get('error');
      if (fehlercode) {
        return fehler(new CloudFehler(
          werte.get('error_description') || `Anmeldung abgelehnt (${fehlercode}).`));
      }
      fertig(werte);
    }

    window.addEventListener('message', hoeren);
    /* Wer das Fenster wegklickt, wartet sonst ewig auf eine Antwort, die nicht
       mehr kommt. Ein Ereignis dafür gibt es nicht – also nachsehen. */
    wache = setInterval(() => {
      if (!fenster.closed) return;
      aufraeumen();
      fehler(new CloudFehler('Die Anmeldung wurde abgebrochen.'));
    }, 700);
  });
}

const ZEICHENVORRAT = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/** Zufallszeichenkette für `state` und den PKCE-Prüfwert */
export function zufall(laenge = 64) {
  const roh = new Uint8Array(laenge);
  crypto.getRandomValues(roh);
  return [...roh].map(b => ZEICHENVORRAT[b % ZEICHENVORRAT.length]).join('');
}

/** Der PKCE-Prüfwert als S256-Abdruck, base64url */
export async function pkceAbdruck(pruefwert) {
  const abdruck = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pruefwert));
  return base64url(new Uint8Array(abdruck));
}

export function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------- Netz

/**
 * Eine Anfrage stellen und die üblichen Fehlerbilder in Sätze übersetzen.
 * Ein abgewiesener Abruf ohne Antwort ist im Browser nicht von einem fehlenden
 * Netz zu unterscheiden – deshalb nennt die Meldung beide Fälle.
 */
export async function anfrage(adresse, o = {}) {
  try {
    return await fetch(adresse, o);
  } catch (e) {
    throw new CloudFehler(
      'Der Speicher ist nicht erreichbar – kein Netz, oder der Server lässt den Zugriff ' +
      'aus dem Browser nicht zu (CORS).');
  }
}

/** 412 und 409 heißen bei allen hier bedienten Anbietern: die Marke stimmt nicht mehr */
export function aufKonfliktPruefen(antwort) {
  if (antwort.status === 412 || antwort.status === 409) throw new KonfliktFehler();
}

/** 401 heißt: die Anmeldung ist fort und muss erneuert werden */
export function aufAnmeldungPruefen(antwort) {
  if (antwort.status === 401) {
    throw new CloudFehler('Die Anmeldung am Speicher gilt nicht mehr.', { erneuern: true });
  }
}
