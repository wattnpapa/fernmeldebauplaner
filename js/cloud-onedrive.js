// cloud-onedrive.js – Rückseite: OneDrive über Microsoft Graph

/* Vermutlich die größte Reichweite bei den Windows-Rechnern der Helfer, und
   privates wie dienstliches Konto laufen über dieselbe Schnittstelle. Die
   Registrierung einer eigenen Anwendung ist kostenlos und ohne Prüfverfahren.

   Ein Haken bleibt: bei einem Geschäftskonto kann die Zustimmung beim
   Administrator des Ortsverbands liegen. Dann meldet Microsoft die Anmeldung
   ab, und daran ist von hier aus nichts zu ändern – das gehört in den
   Einrichtungstext und nicht in eine Fehlermeldung.

   Die registrierte Anwendung muss als „Single-page application“ eingetragen
   sein und nicht als „Web“: nur dann gibt Microsoft die CORS-Kopfzeilen frei,
   ohne die der Browser den Markentausch abbricht. */

import {
  WURZEL, CloudFehler, KonfliktFehler, anfrage, anmeldefenster, rueckwegAdresse,
  zufall, pkceAbdruck
} from './cloud.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const RECHTE = 'Files.ReadWrite offline_access User.Read';

/* Über dieser Grenze nimmt Graph keine einzelne Anfrage mehr an, sondern will
   eine Ladesitzung. Die Lichtbilder dieser Anwendung liegen weit darunter –
   ein Bild mit 1600 px Kante wiegt ein paar Hundert Kilobyte –, aber eine
   Planung mit vielen Punkten kann die Grenze erreichen, und dann darf nicht
   ausgerechnet die Planungsdatei liegenbleiben. */
const EINZELGRENZE = 4 * 1024 * 1024;
const BROCKEN = 3200 * 1024;         // Vielfaches von 320 KiB, wie Graph es verlangt

const anmeldeAdresse = mandant =>
  `https://login.microsoftonline.com/${encodeURIComponent(mandant || 'common')}/oauth2/v2.0`;

// ---------------------------------------------------------------- Anmeldung

export async function einrichten(angaben) {
  const clientId = String(angaben.clientId || '').trim();
  if (!clientId) throw new CloudFehler('Ohne Anwendungs-ID geht es nicht.');
  const mandant = angaben.mandant || 'common';

  const pruefwert = zufall();
  const zustand = zufall(32);
  const adresse = new URL(anmeldeAdresse(mandant) + '/authorize');
  adresse.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: rueckwegAdresse(),
    response_mode: 'query',
    scope: RECHTE,
    code_challenge: await pkceAbdruck(pruefwert),
    code_challenge_method: 'S256',
    state: zustand
  });

  const antwort = await anmeldefenster(adresse.href, zustand);
  const code = antwort.get('code');
  if (!code) throw new CloudFehler('Microsoft hat keinen Anmeldecode zurückgegeben.');

  const marken = await markenHolen(mandant, {
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: rueckwegAdresse(),
    code_verifier: pruefwert,
    scope: RECHTE
  });

  const neu = {
    clientId, mandant,
    auffrischen: marken.refresh_token || '',
    marke: marken.access_token,
    laeuftAb: ablaufZeit(marken.expires_in)
  };
  return { angaben: neu, name: await kontoName(marken.access_token) };
}

async function markenHolen(mandant, felder) {
  const antwort = await anfrage(anmeldeAdresse(mandant) + '/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(felder)
  });
  const text = await antwort.text();
  if (!antwort.ok) {
    let grund = text;
    try { grund = JSON.parse(text).error_description || text; } catch (e) { /* roh */ }
    throw new CloudFehler('Microsoft hat die Anmeldung abgelehnt: ' + String(grund).slice(0, 300));
  }
  return JSON.parse(text);
}

const ablaufZeit = sekunden => Date.now() + Math.max(0, (Number(sekunden) || 3600) - 240) * 1000;

async function kontoName(marke) {
  try {
    const antwort = await anfrage(`${GRAPH}/me`, { headers: { Authorization: 'Bearer ' + marke } });
    if (!antwort.ok) return 'OneDrive';
    const konto = await antwort.json();
    return konto.userPrincipalName || konto.mail || konto.displayName || 'OneDrive';
  } catch (e) { return 'OneDrive'; }
}

// ---------------------------------------------------------------- Rückseite

export function bauen(angaben, angabenSchreiben) {
  let stand = { ...angaben };

  async function marke() {
    if (stand.marke && Date.now() < (stand.laeuftAb || 0)) return stand.marke;
    if (!stand.auffrischen) {
      throw new CloudFehler('Die Anmeldung bei Microsoft ist abgelaufen.', { erneuern: true });
    }
    const neu = await markenHolen(stand.mandant, {
      client_id: stand.clientId,
      grant_type: 'refresh_token',
      refresh_token: stand.auffrischen,
      scope: RECHTE
    });
    stand = {
      ...stand,
      marke: neu.access_token,
      /* Microsoft gibt bei jedem Auffrischen eine neue Marke zum Auffrischen
         aus und zieht die alte ein. Wer sie nicht mitschreibt, steht beim
         übernächsten Mal ohne da. */
      auffrischen: neu.refresh_token || stand.auffrischen,
      laeuftAb: ablaufZeit(neu.expires_in)
    };
    await angabenSchreiben({
      marke: stand.marke, auffrischen: stand.auffrischen, laeuftAb: stand.laeuftAb
    });
    return stand.marke;
  }

  async function ruf(adresse, o = {}) {
    const kopf = { Authorization: 'Bearer ' + await marke(), ...(o.headers || {}) };
    const antwort = await anfrage(adresse, { ...o, headers: kopf });
    if (antwort.status !== 401) return antwort;
    stand = { ...stand, laeuftAb: 0 };
    return anfrage(adresse, {
      ...o, headers: { ...(o.headers || {}), Authorization: 'Bearer ' + await marke() }
    });
  }

  return {
    async auflisten(pfad) {
      const raus = [];
      let adresse = `${GRAPH}/me/drive/root:/${graphPfad(pfad)}:/children?$top=200`;
      while (adresse) {
        const antwort = await ruf(adresse);
        if (antwort.status === 404) return [];
        const seite = await pruefen(antwort, 'Ordner nicht lesbar');
        for (const e of seite.value || []) {
          raus.push({
            name: e.name,
            ordner: !!e.folder,
            marke: e.cTag || e.eTag || null,
            groesse: e.size || 0
          });
        }
        adresse = seite['@odata.nextLink'] || null;
      }
      return raus;
    },

    async lesen(pfad) {
      /* Zwei Abrufe: die Marke steht in den Angaben zur Datei, nicht am
         Inhalt. Der Inhaltsabruf landet über eine Weiterleitung auf einem
         Speicherserver, dessen Kopfzeilen mit der Datei in OneDrive nichts
         mehr zu tun haben. */
      const angabeAntwort = await ruf(`${GRAPH}/me/drive/root:/${graphPfad(pfad)}`);
      if (angabeAntwort.status === 404) return null;
      const angabe = await pruefen(angabeAntwort, 'Datei nicht lesbar');
      const inhalt = await ruf(`${GRAPH}/me/drive/root:/${graphPfad(pfad)}:/content`);
      if (inhalt.status === 404) return null;
      if (!inhalt.ok) await pruefen(inhalt, 'Datei nicht lesbar');
      return { blob: await inhalt.blob(), marke: angabe.cTag || angabe.eTag || null };
    },

    async schreiben(pfad, blob, erwartet) {
      if (blob.size > EINZELGRENZE) return grossSchreiben(ruf, pfad, blob, erwartet);
      const kopf = { 'Content-Type': blob.type || 'application/octet-stream' };
      /* „nur wenn dort noch genau das liegt, was ich kenne“ – Graph prüft das
         selbst und antwortet mit 412, wenn ein zweites Gerät da war. */
      if (erwartet === null) kopf['if-none-match'] = '*';
      else if (erwartet !== undefined) kopf['if-match'] = erwartet;
      const antwort = await ruf(`${GRAPH}/me/drive/root:/${graphPfad(pfad)}:/content`,
        { method: 'PUT', headers: kopf, body: blob });
      if (antwort.status === 412 || antwort.status === 409) {
        await antwort.text();
        throw new KonfliktFehler();
      }
      const angabe = await pruefen(antwort, 'Datei ließ sich nicht ablegen');
      return angabe.cTag || angabe.eTag || null;
    },

    async loeschen(pfad) {
      const antwort = await ruf(`${GRAPH}/me/drive/root:/${graphPfad(pfad)}`, { method: 'DELETE' });
      if (antwort.status === 404) return;
      if (antwort.status === 204) return;
      await pruefen(antwort, 'Datei ließ sich nicht löschen');
    },

    beschreibung: () => `OneDrive – Ordner „${WURZEL}“`
  };
}

// ---------------------------------------------------------------- Ladesitzung

/* Für alles über vier Megabyte: eine Sitzung eröffnen und die Datei in
   Brocken hineinschieben. Die Marke wird dabei schon beim Eröffnen geprüft –
   danach hält Graph die Datei, und ein Konflikt käme zu spät. */
async function grossSchreiben(ruf, pfad, blob, erwartet) {
  const kopf = { 'Content-Type': 'application/json' };
  if (erwartet === null) kopf['if-none-match'] = '*';
  else if (erwartet !== undefined) kopf['if-match'] = erwartet;

  const start = await ruf(`${GRAPH}/me/drive/root:/${graphPfad(pfad)}:/createUploadSession`, {
    method: 'POST', headers: kopf,
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } })
  });
  if (start.status === 412 || start.status === 409) { await start.text(); throw new KonfliktFehler(); }
  const sitzung = await pruefen(start, 'Ladesitzung ließ sich nicht eröffnen');

  for (let ab = 0; ab < blob.size; ab += BROCKEN) {
    const bis = Math.min(ab + BROCKEN, blob.size);
    /* Die Ladeadresse trägt ihre eigene Berechtigung im Pfad – ein
       Authorization-Kopf würde hier abgewiesen, deshalb ein schlichter Abruf. */
    const antwort = await anfrage(sitzung.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes ${ab}-${bis - 1}/${blob.size}` },
      body: blob.slice(ab, bis)
    });
    if (bis < blob.size) {
      if (antwort.status !== 202) await pruefen(antwort, 'Datei ließ sich nicht ablegen');
      await antwort.text();
      continue;
    }
    const angabe = await pruefen(antwort, 'Datei ließ sich nicht ablegen');
    return angabe.cTag || angabe.eTag || null;
  }
  return null;
}

// ---------------------------------------------------------------- Innereien

async function pruefen(antwort, was) {
  const text = await antwort.text();
  if (antwort.ok) {
    try { return text ? JSON.parse(text) : {}; } catch (e) { return {}; }
  }
  if (antwort.status === 401) {
    throw new CloudFehler('Die Anmeldung bei Microsoft gilt nicht mehr.', { erneuern: true });
  }
  if (antwort.status === 403) {
    throw new CloudFehler(
      'Microsoft verweigert den Zugriff. Bei einem dienstlichen Konto muss der ' +
      'Administrator der Anwendung zustimmen.');
  }
  if (antwort.status === 507) throw new CloudFehler('Der OneDrive-Speicher ist voll.');
  if (antwort.status === 429) {
    throw new CloudFehler('OneDrive bremst gerade – der nächste Versuch folgt von selbst.');
  }
  let grund = '';
  try { grund = JSON.parse(text)?.error?.message || ''; } catch (e) { /* roh */ }
  throw new CloudFehler(`${was} (OneDrive meldet ${antwort.status}). ${grund}`.trim());
}

/* Jedes Pfadstück einzeln kodieren: der Schrägstrich muss stehenbleiben, und
   der Doppelpunkt, mit dem Graph Pfad und Befehl trennt, darf im Namen nicht
   vorkommen – dafür sorgt schon `ordnerName()` in `cloud.js`. */
const graphPfad = pfad =>
  String(pfad || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
