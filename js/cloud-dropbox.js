// cloud-dropbox.js – Rückseite: Dropbox

/* Der geradlinigste echte Anbieter: die Anmeldung läuft mit PKCE vollständig
   im Browser, die Schnittstelle ist eine gewöhnliche REST-Schnittstelle und
   braucht keine fremde Bibliothek. Und Dropbox führt zu jeder Datei eine `rev`
   – damit lässt sich schreiben, ohne die Arbeit eines zweiten Geräts zu
   überfahren: „nimm das nur an, wenn dort noch genau diese rev liegt.“

   Was der FMBauplaner nicht mitbringt, ist eine eigene registrierte Anwendung.
   Der Nutzer legt sich eine an (kostenlos, ohne Prüfverfahren) und trägt ihren
   App-Schlüssel ein. Ein hier eingetragener Schlüssel wäre ohnehin öffentlich
   – bei einer Anwendung ohne Serveranteil ist er kein Geheimnis, sondern eine
   Kennung. */

import {
  WURZEL, CloudFehler, KonfliktFehler, anfrage, anmeldefenster, rueckwegAdresse,
  zufall, pkceAbdruck
} from './cloud.js';

const ANMELDUNG = 'https://www.dropbox.com/oauth2/authorize';
const MARKEN    = 'https://api.dropboxapi.com/oauth2/token';
const API       = 'https://api.dropboxapi.com/2';
const INHALT    = 'https://content.dropboxapi.com/2';

/* Weniger geht nicht: lesen, schreiben und die Ordnerliste. Ein Zugriff auf
   das ganze Konto ist nicht dabei – wird die Anwendung als „App folder“
   registriert, sieht sie ohnehin nur ihren eigenen Ordner. */
const RECHTE = 'files.content.write files.content.read files.metadata.read account_info.read';

// ---------------------------------------------------------------- Anmeldung

/**
 * Anmelden und die Marken holen. Läuft aus einem Klick heraus, weil dabei ein
 * Fenster aufgeht.
 */
export async function einrichten(angaben) {
  const appKey = String(angaben.appKey || '').trim();
  if (!appKey) throw new CloudFehler('Ohne App-Schlüssel geht es nicht.');

  const pruefwert = zufall();
  const zustand = zufall(32);
  const adresse = new URL(ANMELDUNG);
  adresse.search = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    redirect_uri: rueckwegAdresse(),
    code_challenge: await pkceAbdruck(pruefwert),
    code_challenge_method: 'S256',
    /* Ohne „offline“ gäbe es nur eine Marke mit vier Stunden Laufzeit und
       keine zum Auffrischen – die Verbindung wäre am nächsten Tag tot. */
    token_access_type: 'offline',
    scope: RECHTE,
    state: zustand
  });

  const antwort = await anmeldefenster(adresse.href, zustand);
  const code = antwort.get('code');
  if (!code) throw new CloudFehler('Dropbox hat keinen Anmeldecode zurückgegeben.');

  const marken = await markenHolen({
    code,
    grant_type: 'authorization_code',
    client_id: appKey,
    code_verifier: pruefwert,
    redirect_uri: rueckwegAdresse()
  });

  const neu = {
    appKey,
    auffrischen: marken.refresh_token || '',
    marke: marken.access_token,
    laeuftAb: ablaufZeit(marken.expires_in)
  };
  return { angaben: neu, name: await kontoName(marken.access_token) };
}

async function markenHolen(felder) {
  const antwort = await anfrage(MARKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(felder)
  });
  const text = await antwort.text();
  if (!antwort.ok) {
    let grund = text;
    try { grund = JSON.parse(text).error_description || JSON.parse(text).error || text; } catch (e) { /* roh */ }
    throw new CloudFehler('Dropbox hat die Anmeldung abgelehnt: ' + grund);
  }
  return JSON.parse(text);
}

/* Vier Minuten vor dem rechnerischen Ende gilt die Marke als abgelaufen: die
   Uhr des Geräts geht nicht immer richtig, und eine Anfrage, die unterwegs in
   den Ablauf läuft, scheitert sonst mitten im Hochladen. */
const ablaufZeit = sekunden => Date.now() + Math.max(0, (Number(sekunden) || 14400) - 240) * 1000;

async function kontoName(marke) {
  try {
    const antwort = await anfrage(`${API}/users/get_current_account`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + marke }
    });
    if (!antwort.ok) return 'Dropbox';
    const konto = await antwort.json();
    return konto?.email || konto?.name?.display_name || 'Dropbox';
  } catch (e) { return 'Dropbox'; }
}

// ---------------------------------------------------------------- Rückseite

export function bauen(angaben, angabenSchreiben) {
  let stand = { ...angaben };

  /** Eine gültige Zugangsmarke – frischt selbst auf, wenn sie abgelaufen ist */
  async function marke() {
    if (stand.marke && Date.now() < (stand.laeuftAb || 0)) return stand.marke;
    if (!stand.auffrischen) {
      throw new CloudFehler('Die Anmeldung bei Dropbox ist abgelaufen.', { erneuern: true });
    }
    const neu = await markenHolen({
      grant_type: 'refresh_token',
      refresh_token: stand.auffrischen,
      client_id: stand.appKey
    });
    stand = { ...stand, marke: neu.access_token, laeuftAb: ablaufZeit(neu.expires_in) };
    await angabenSchreiben({ marke: stand.marke, laeuftAb: stand.laeuftAb });
    return stand.marke;
  }

  async function ruf(adresse, o = {}, argument = null) {
    const kopf = { Authorization: 'Bearer ' + await marke(), ...(o.headers || {}) };
    if (argument) kopf['Dropbox-API-Arg'] = nurAscii(JSON.stringify(argument));
    const antwort = await anfrage(adresse, { ...o, headers: kopf });
    if (antwort.status === 401) {
      /* Die Marke ist vorzeitig ungültig geworden – einmal auffrischen und
         denselben Aufruf wiederholen, bevor der Nutzer behelligt wird. */
      stand = { ...stand, laeuftAb: 0 };
      const kopf2 = { Authorization: 'Bearer ' + await marke(), ...(o.headers || {}) };
      if (argument) kopf2['Dropbox-API-Arg'] = nurAscii(JSON.stringify(argument));
      return anfrage(adresse, { ...o, headers: kopf2 });
    }
    return antwort;
  }

  return {
    async auflisten(pfad) {
      const raus = [];
      let antwort = await ruf(`${API}/files/list_folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dropboxPfad(pfad), limit: 500 })
      });
      /* Ein Ordner, den es nicht gibt, ist kein Fehler, sondern eine leere
         Liste: vor der ersten abgelegten Planung gibt es ihn nicht. */
      if (antwort.status === 409) return [];
      let seite = await pruefen(antwort, 'Ordner nicht lesbar');
      for (;;) {
        for (const e of seite.entries || []) {
          raus.push({
            name: e.name,
            ordner: e['.tag'] === 'folder',
            marke: e.rev || null,
            groesse: e.size || 0
          });
        }
        if (!seite.has_more) return raus;
        antwort = await ruf(`${API}/files/list_folder/continue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor: seite.cursor })
        });
        seite = await pruefen(antwort, 'Ordner nicht lesbar');
      }
    },

    async lesen(pfad) {
      const antwort = await ruf(`${INHALT}/files/download`, { method: 'POST' },
        { path: dropboxPfad(pfad) });
      if (antwort.status === 409) return null;              // gibt es dort nicht
      if (!antwort.ok) await pruefen(antwort, 'Datei nicht lesbar');
      let angabe = {};
      try { angabe = JSON.parse(antwort.headers.get('dropbox-api-result') || '{}'); }
      catch (e) { /* ohne Marke fällt der Abgleich auf den Vergleich zurück */ }
      return { blob: await antwort.blob(), marke: angabe.rev || null };
    },

    async schreiben(pfad, blob, erwartet) {
      /* Hier steckt der eigentliche Schutz gegen das zweite Gerät: „update“
         mit der zuletzt gesehenen rev nimmt Dropbox nur an, wenn dort noch
         genau diese liegt. Sonst kommt 409 zurück – und das ist kein Ausfall,
         sondern die Nachricht, dass jemand anderes da war. `add` heißt: die
         Datei darf es noch gar nicht geben. */
      const modus = erwartet === undefined ? 'overwrite'
        : erwartet === null ? 'add'
        : { '.tag': 'update', update: erwartet };
      const antwort = await ruf(`${INHALT}/files/upload`,
        { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob },
        { path: dropboxPfad(pfad), mode: modus, autorename: false, mute: true });
      if (antwort.status === 409) {
        await antwort.text();
        throw new KonfliktFehler();
      }
      const angabe = await pruefen(antwort, 'Datei ließ sich nicht ablegen');
      return angabe.rev || null;
    },

    async loeschen(pfad) {
      const antwort = await ruf(`${API}/files/delete_v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dropboxPfad(pfad) })
      });
      if (antwort.status === 409) return;                   // war schon fort
      await pruefen(antwort, 'Datei ließ sich nicht löschen');
    },

    beschreibung: () => `Dropbox – Ordner „${WURZEL}“`
  };
}

// ---------------------------------------------------------------- Innereien

async function pruefen(antwort, was) {
  if (antwort.ok) {
    const text = await antwort.text();
    try { return text ? JSON.parse(text) : {}; } catch (e) { return {}; }
  }
  const text = await antwort.text();
  if (antwort.status === 401) {
    throw new CloudFehler('Die Anmeldung bei Dropbox gilt nicht mehr.', { erneuern: true });
  }
  if (antwort.status === 507) {
    throw new CloudFehler('Die Dropbox ist voll.');
  }
  if (antwort.status === 429) {
    throw new CloudFehler('Dropbox bremst gerade – der nächste Versuch folgt von selbst.');
  }
  throw new CloudFehler(`${was} (Dropbox meldet ${antwort.status}). ${kurz(text)}`.trim());
}

const kurz = text => String(text || '').slice(0, 200);

/** Dropbox will den Pfad mit führendem Schrägstrich und ohne einen am Ende */
const dropboxPfad = pfad => '/' + String(pfad || '').replace(/^\/+|\/+$/g, '');

/* Der Kopfzeilenwert `Dropbox-API-Arg` darf nur ASCII enthalten – ein Ordner
   „Hochwasser Elbe (Süd)“ ließe den Abruf sonst schon im Browser scheitern.
   Dropbox nimmt an dieser Stelle JSON mit \u-Folgen entgegen. */
function nurAscii(text) {
  return text.replace(/[-￿]/g,
    z => '\\u' + z.charCodeAt(0).toString(16).padStart(4, '0'));
}
