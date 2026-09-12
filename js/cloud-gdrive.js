// cloud-gdrive.js – Rückseite: Google Drive

/* Zuletzt und mit Bedacht. Drei Dinge machen Google Drive zum unbequemsten
   Anbieter dieser Reihe:

   Erstens läuft die Anmeldung ab. Ohne Serveranteil gibt Google einer
   Browser-Anwendung keine Marke zum Auffrischen – nach etwa einer Stunde ist
   Schluss und der Nutzer meldet sich neu an. Die Warteschlange des Abgleichs
   trägt das: Was nicht hochgeladen werden konnte, bleibt ausstehend stehen
   und geht nach der nächsten Anmeldung hinaus.

   Zweitens kennt Drive keine Pfade, sondern nur Kennungen mit Elternverweisen.
   Ein Ordner „Hochwasser Elbe 2026 (x7k3p9q)“ ist deshalb erst nachzuschlagen,
   bevor irgendetwas darin geschehen kann. Was einmal nachgeschlagen wurde,
   bleibt für die Sitzung gemerkt.

   Drittens gibt es hier keinen Google-Picker: der lädt Code von
   `apis.google.com` nach, und diese Anwendung holt von außen ausschließlich
   Karten- und Höhenkacheln. Ihren Ordner legt sie ohnehin selbst an.

   Der Zugriff beschränkt sich auf `drive.file` – Google zeigt dieser
   Anwendung nur, was sie selbst angelegt hat. Der übrige Inhalt des Kontos
   bleibt ihr verborgen, und das ist die engste Fassung, die die Aufgabe
   zulässt. */

import {
  WURZEL, CloudFehler, KonfliktFehler, anfrage, anmeldefenster, rueckwegAdresse, zufall
} from './cloud.js';

const ANMELDUNG = 'https://accounts.google.com/o/oauth2/v2/auth';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const ORDNERART = 'application/vnd.google-apps.folder';
const RECHTE = 'https://www.googleapis.com/auth/drive.file';

// ---------------------------------------------------------------- Anmeldung

export async function einrichten(angaben) {
  const clientId = String(angaben.clientId || '').trim();
  if (!clientId) throw new CloudFehler('Ohne Client-ID geht es nicht.');
  const neu = { clientId, ...(await anmelden(clientId)) };
  return { angaben: neu, name: await kontoName(neu.marke) };
}

/** Neu anmelden – aus einem Klick heraus, weil dabei ein Fenster aufgeht */
export async function erneuern(angaben) {
  const neu = { ...angaben, ...(await anmelden(angaben.clientId)) };
  return { angaben: neu, name: await kontoName(neu.marke) };
}

async function anmelden(clientId) {
  const zustand = zufall(32);
  const adresse = new URL(ANMELDUNG);
  adresse.search = new URLSearchParams({
    client_id: clientId,
    /* Der Code-Weg mit PKCE bräuchte beim Markentausch ein Client-Geheimnis,
       das eine Browser-Anwendung nicht haben kann. Bleibt der Weg, bei dem
       die Marke unmittelbar zurückkommt – mit ihrer Stunde Laufzeit. */
    response_type: 'token',
    redirect_uri: rueckwegAdresse(),
    scope: RECHTE,
    include_granted_scopes: 'true',
    state: zustand
  });

  const antwort = await anmeldefenster(adresse.href, zustand);
  const marke = antwort.get('access_token');
  if (!marke) throw new CloudFehler('Google hat keine Anmeldemarke zurückgegeben.');
  return {
    marke,
    laeuftAb: Date.now() + Math.max(0, (Number(antwort.get('expires_in')) || 3600) - 240) * 1000
  };
}

async function kontoName(marke) {
  try {
    const antwort = await anfrage(`${API}/about?fields=user(emailAddress,displayName)`, {
      headers: { Authorization: 'Bearer ' + marke }
    });
    if (!antwort.ok) return 'Google Drive';
    const about = await antwort.json();
    return about?.user?.emailAddress || about?.user?.displayName || 'Google Drive';
  } catch (e) { return 'Google Drive'; }
}

// ---------------------------------------------------------------- Rückseite

export function bauen(angaben) {
  const kennungen = new Map();      // Pfad → Drive-Kennung, für die Dauer der Sitzung

  function marke() {
    if (!angaben.marke || Date.now() >= (angaben.laeuftAb || 0)) {
      throw new CloudFehler(
        'Die Anmeldung bei Google ist abgelaufen. Google gibt einer Anwendung ohne ' +
        'Serveranteil keine Marke zum Auffrischen – die Anmeldung muss von Hand erneuert ' +
        'werden.', { erneuern: true });
    }
    return angaben.marke;
  }

  const ruf = (adresse, o = {}) => anfrage(adresse, {
    ...o, headers: { Authorization: 'Bearer ' + marke(), ...(o.headers || {}) }
  });

  /** Die Kennung eines Eintrags an einem Pfad; legt Ordner an, wenn gewünscht */
  async function kennungVon(pfad, anlegen, alsOrdner) {
    const voll = String(pfad || '').split('/').filter(Boolean);
    if (!voll.length) return 'root';
    const gemerkt = kennungen.get(voll.join('/'));
    if (gemerkt) return gemerkt;

    let eltern = 'root';
    for (let i = 0; i < voll.length; i++) {
      const stueck = voll.slice(0, i + 1).join('/');
      const bekannt = kennungen.get(stueck);
      if (bekannt) { eltern = bekannt; continue; }
      const letztes = i === voll.length - 1;
      const kennung = await suchen(ruf, voll[i], eltern)
        || (anlegen && (!letztes || alsOrdner) ? await ordnerAnlegen(ruf, voll[i], eltern) : null);
      if (!kennung) return null;
      kennungen.set(stueck, kennung);
      eltern = kennung;
    }
    return eltern;
  }

  return {
    async auflisten(pfad) {
      const eltern = await kennungVon(pfad, false, true);
      if (!eltern) return [];
      const raus = [];
      let weiter = null;
      do {
        const felder = new URLSearchParams({
          q: `'${eltern}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, version, size)',
          pageSize: '200'
        });
        if (weiter) felder.set('pageToken', weiter);
        const antwort = await ruf(`${API}/files?${felder}`);
        const seite = await pruefen(antwort, 'Ordner nicht lesbar');
        for (const f of seite.files || []) {
          const istOrdner = f.mimeType === ORDNERART;
          if (istOrdner) kennungen.set([pfad, f.name].filter(Boolean).join('/'), f.id);
          raus.push({
            name: f.name,
            ordner: istOrdner,
            marke: istOrdner ? null : String(f.version || ''),
            groesse: Number(f.size) || 0
          });
        }
        weiter = seite.nextPageToken || null;
      } while (weiter);
      return raus;
    },

    async lesen(pfad) {
      const kennung = await kennungVon(pfad, false, false);
      if (!kennung || kennung === 'root') return null;
      const angabe = await pruefen(
        await ruf(`${API}/files/${kennung}?fields=version`), 'Datei nicht lesbar');
      const inhalt = await ruf(`${API}/files/${kennung}?alt=media`);
      if (inhalt.status === 404) return null;
      if (!inhalt.ok) await pruefen(inhalt, 'Datei nicht lesbar');
      return { blob: await inhalt.blob(), marke: String(angabe.version || '') };
    },

    async schreiben(pfad, blob, erwartet) {
      const teile = String(pfad).split('/').filter(Boolean);
      const name = teile.pop();
      const eltern = await kennungVon(teile.join('/'), true, true);
      if (!eltern) throw new CloudFehler('Der Ordner ließ sich in Google Drive nicht anlegen.');

      const vorhanden = await suchen(ruf, name, eltern);

      /* Drive kennt kein „schreibe nur, wenn dort noch Fassung 7 liegt“ –
         die bedingten Kopfzeilen gelten hier nicht. Bleibt: nachsehen und
         dann schreiben. Der Spalt dazwischen ist schmaler als die Zeit, die
         zwei Geräte am Bauort auseinanderliegen; wo ein Anbieter es besser
         kann, nutzt seine Rückseite die Marke des Servers. */
      if (erwartet !== undefined) {
        const stand = vorhanden
          ? String((await pruefen(await ruf(`${API}/files/${vorhanden}?fields=version`),
              'Datei nicht lesbar')).version || '')
          : null;
        if (erwartet === null ? stand !== null : stand !== erwartet) throw new KonfliktFehler();
      }

      let antwort;
      if (vorhanden) {
        antwort = await ruf(`${UPLOAD}/files/${vorhanden}?uploadType=media&fields=id,version`, {
          method: 'PATCH',
          headers: { 'Content-Type': blob.type || 'application/octet-stream' },
          body: blob
        });
      } else {
        /* Eine neue Datei braucht Name und Elternordner mit demselben Aufruf –
           sonst landete sie im Hauptverzeichnis des Kontos und wäre für die
           Anwendung im nächsten Durchgang nicht mehr zu finden. */
        antwort = await ruf(`${UPLOAD}/files?uploadType=multipart&fields=id,version`, {
          method: 'POST',
          headers: { 'Content-Type': 'multipart/related; boundary=' + GRENZE },
          body: mehrteilig({ name, parents: [eltern] }, blob)
        });
      }
      const angabe = await pruefen(antwort, 'Datei ließ sich nicht ablegen');
      if (angabe.id) kennungen.set(pfad, angabe.id);
      return String(angabe.version || '');
    },

    async loeschen(pfad) {
      const kennung = await kennungVon(pfad, false, false);
      if (!kennung || kennung === 'root') return;
      const antwort = await ruf(`${API}/files/${kennung}`, { method: 'DELETE' });
      kennungen.delete(pfad);
      if (antwort.status === 404 || antwort.status === 204) { await antwort.text(); return; }
      if (!antwort.ok) await pruefen(antwort, 'Datei ließ sich nicht löschen');
    },

    beschreibung: () => `Google Drive – Ordner „${WURZEL}“`
  };
}

// ---------------------------------------------------------------- Innereien

/** Kennung eines Eintrags mit diesem Namen unter diesem Elternteil, oder `null` */
async function suchen(ruf, name, eltern) {
  const felder = new URLSearchParams({
    q: `name = '${apostroph(name)}' and '${eltern}' in parents and trashed = false`,
    fields: 'files(id, name)',
    pageSize: '5'
  });
  const treffer = await pruefen(await ruf(`${API}/files?${felder}`), 'Ordner nicht lesbar');
  return treffer.files?.[0]?.id || null;
}

async function ordnerAnlegen(ruf, name, eltern) {
  const angabe = await pruefen(await ruf(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: ORDNERART, parents: [eltern] })
  }), 'Ordner ließ sich nicht anlegen');
  return angabe.id || null;
}

/* Die Abfragesprache von Drive fasst Zeichenketten in einfache Anführungs-
   zeichen. Ein Ordner „Übung O'Brien“ bräche die Abfrage sonst auf, und zwar
   so, dass Drive sie noch als gültig ansieht – der Ordner wäre dann still
   nicht mehr zu finden. */
const apostroph = name => String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const GRENZE = 'fbp-teil-grenze';

/** Angaben und Inhalt in einem Rumpf – so will Drive eine neue Datei haben */
function mehrteilig(angaben, blob) {
  const kopf =
    `--${GRENZE}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(angaben)}\r\n` +
    `--${GRENZE}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`;
  return new Blob([kopf, blob, `\r\n--${GRENZE}--`]);
}

async function pruefen(antwort, was) {
  const text = await antwort.text();
  if (antwort.ok) {
    try { return text ? JSON.parse(text) : {}; } catch (e) { return {}; }
  }
  if (antwort.status === 401) {
    throw new CloudFehler('Die Anmeldung bei Google gilt nicht mehr.', { erneuern: true });
  }
  if (antwort.status === 403) {
    let grund = '';
    try { grund = JSON.parse(text)?.error?.message || ''; } catch (e) { /* roh */ }
    if (/quota|rate/i.test(grund)) {
      throw new CloudFehler('Google bremst gerade – der nächste Versuch folgt von selbst.');
    }
    throw new CloudFehler('Google verweigert den Zugriff. ' + grund);
  }
  let grund = '';
  try { grund = JSON.parse(text)?.error?.message || ''; } catch (e) { /* roh */ }
  throw new CloudFehler(`${was} (Google meldet ${antwort.status}). ${grund}`.trim());
}
