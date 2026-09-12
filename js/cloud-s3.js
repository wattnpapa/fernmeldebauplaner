// cloud-s3.js – Rückseite: S3-kompatibler Speicher (MinIO, Hetzner, Wasabi, B2)

/* Technisch der geradlinigste Weg von allen: keine Anmeldung mit Fenster und
   Rückweg, keine Marken, die ablaufen, und CORS lässt sich je Eimer selbst
   einstellen. Dafür liegt der Zugangsschlüssel im Browserspeicher, und die
   Zahl der Nutzer, die sich einen Eimer einrichten, ist klein.

   Die Signatur (AWS Signature Version 4) wird hier von Hand gerechnet. Das
   klingt nach mehr, als es ist: vier verkettete HMAC-Schritte über die
   Krypto-Schnittstelle des Browsers. Die fertige Bibliothek dafür wiegt
   mehrere Hundert Kilobyte und brächte einen Paketmanager mit – beides will
   dieses Projekt nicht.

   Ein Eimer braucht eine CORS-Regel, die PUT, GET, DELETE und HEAD zulässt,
   die Kopfzeilen `authorization`, `x-amz-date`, `x-amz-content-sha256`,
   `content-type`, `if-match` und `if-none-match` annimmt und `ETag`
   freigibt. Ohne die letzte Freigabe kommt zwar jede Datei an, aber ohne
   Marke – und dann kann der Abgleich zwei Geräte nicht mehr auseinanderhalten. */

import {
  WURZEL, CloudFehler, KonfliktFehler, anfrage
} from './cloud.js';

const DIENST = 's3';

/* SHA-256 der leeren Zeichenkette – steht als Inhaltsabdruck in jeder Anfrage
   ohne Körper. Ausgeschrieben statt gerechnet, weil der Wert feststeht; ein
   Tippfehler darin fiele sofort auf, denn dann ginge gar keine Anfrage durch. */
const LEER_ABDRUCK = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// ---------------------------------------------------------------- Einrichten

export async function einrichten(angaben) {
  const stand = angabenPruefen(angaben);
  /* Sofort nachsehen, ob Schlüssel, Region und CORS zusammenpassen: Alles
     anzunehmen und erst beim ersten Abgleich zu scheitern, schickt den Nutzer
     mit dem Gefühl weg, es sei erledigt. Die Liste eines leeren Eimers ist
     dafür die harmloseste Frage, die es gibt. */
  const antwort = await gezeichnet(stand, 'GET', '', { 'list-type': '2', 'max-keys': '1' });
  if (antwort.status === 403) {
    throw new CloudFehler('Der Schlüssel wird abgelehnt. Stimmen Zugriffsschlüssel, ' +
      'geheimer Schlüssel und Region?');
  }
  if (antwort.status === 404) {
    throw new CloudFehler(`Einen Eimer „${stand.eimer}“ gibt es dort nicht.`);
  }
  if (!antwort.ok) {
    throw new CloudFehler(`Der Speicher antwortet mit ${antwort.status}.`);
  }
  await antwort.text();
  return { angaben: stand, name: `${stand.eimer} auf ${new URL(stand.endpunkt).host}` };
}

function angabenPruefen(angaben) {
  const endpunkt = String(angaben.endpunkt || '').trim().replace(/\/+$/, '');
  const eimer = String(angaben.eimer || '').trim().replace(/^\/+|\/+$/g, '');
  if (!endpunkt || !eimer) throw new CloudFehler('Endpunkt und Eimer werden gebraucht.');
  if (!angaben.schluesselId || !angaben.geheim) {
    throw new CloudFehler('Ohne Zugriffsschlüssel und geheimen Schlüssel geht es nicht.');
  }
  try { new URL(endpunkt); } catch (e) { throw new CloudFehler('Der Endpunkt ist keine Adresse.'); }
  return {
    endpunkt, eimer,
    region: String(angaben.region || 'us-east-1').trim() || 'us-east-1',
    schluesselId: String(angaben.schluesselId).trim(),
    geheim: String(angaben.geheim),
    pfadstil: angaben.pfadstil === 'host' ? 'host' : 'pfad'
  };
}

// ---------------------------------------------------------------- Rückseite

export function bauen(angaben) {
  const stand = angabenPruefen(angaben);

  /** Die Marke einer abgelegten Datei, oder `null` wenn es sie nicht gibt */
  async function markeVon(schluessel) {
    const antwort = await gezeichnet(stand, 'HEAD', schluessel);
    if (antwort.status === 404) return null;
    if (!antwort.ok) await pruefen(antwort, 'Datei nicht lesbar');
    return etag(antwort.headers.get('etag'));
  }

  return {
    async auflisten(pfad) {
      /* In einem S3-Eimer gibt es keine Ordner, nur Schlüssel mit
         Schrägstrichen darin. Der Trenner macht daraus für diese Abfrage
         wieder eine Ordnerliste: was darunter liegt, kommt als gemeinsamer
         Namensanfang zurück statt als tausend einzelne Schlüssel. */
      const anfang = pfad ? pfad.replace(/\/+$/, '') + '/' : '';
      const raus = [];
      let weiter = null;
      do {
        const felder = { 'list-type': '2', prefix: anfang, delimiter: '/', 'max-keys': '1000' };
        if (weiter) felder['continuation-token'] = weiter;
        const antwort = await gezeichnet(stand, 'GET', '', felder);
        if (!antwort.ok) await pruefen(antwort, 'Ordner nicht lesbar');
        const baum = xml(await antwort.text());

        for (const p of baum.getElementsByTagName('CommonPrefixes')) {
          const voll = p.getElementsByTagName('Prefix')[0]?.textContent || '';
          const name = voll.slice(anfang.length).replace(/\/+$/, '');
          if (name) raus.push({ name, ordner: true, marke: null });
        }
        for (const e of baum.getElementsByTagName('Contents')) {
          const voll = e.getElementsByTagName('Key')[0]?.textContent || '';
          const name = voll.slice(anfang.length);
          if (!name || name.includes('/')) continue;
          raus.push({
            name, ordner: false,
            marke: etag(e.getElementsByTagName('ETag')[0]?.textContent),
            groesse: Number(e.getElementsByTagName('Size')[0]?.textContent) || 0
          });
        }
        weiter = baum.getElementsByTagName('IsTruncated')[0]?.textContent === 'true'
          ? baum.getElementsByTagName('NextContinuationToken')[0]?.textContent || null
          : null;
      } while (weiter);
      return raus;
    },

    async lesen(pfad) {
      const antwort = await gezeichnet(stand, 'GET', pfad);
      if (antwort.status === 404) return null;
      if (!antwort.ok) await pruefen(antwort, 'Datei nicht lesbar');
      return { blob: await antwort.blob(), marke: etag(antwort.headers.get('etag')) };
    },

    async schreiben(pfad, blob, erwartet) {
      /* Zwei Sicherungen gegen das zweite Gerät, weil sich auf keine allein
         verlassen werden kann: Die bedingten Kopfzeilen beim PUT kennen
         neuere S3-Dienste und MinIO, ältere übergehen sie stillschweigend.
         Deshalb steht davor der Blick auf die abgelegte Marke. Zwischen Blick
         und Schreiben bleibt ein Spalt – er ist schmaler als die Sekunden,
         die zwei Geräte am Bauort auseinanderliegen. */
      if (erwartet !== undefined) {
        const vorhanden = await markeVon(pfad);
        if (erwartet === null ? vorhanden !== null : vorhanden !== erwartet) {
          throw new KonfliktFehler();
        }
      }
      const zusatz = {};
      if (erwartet === null) zusatz['if-none-match'] = '*';
      else if (erwartet !== undefined) zusatz['if-match'] = `"${erwartet}"`;

      const antwort = await gezeichnet(stand, 'PUT', pfad, null, blob, {
        'content-type': blob.type || 'application/octet-stream', ...zusatz
      });
      if (antwort.status === 412 || antwort.status === 409) {
        await antwort.text();
        throw new KonfliktFehler();
      }
      if (!antwort.ok) await pruefen(antwort, 'Datei ließ sich nicht ablegen');
      await antwort.text();
      return etag(antwort.headers.get('etag')) || await markeVon(pfad);
    },

    async loeschen(pfad) {
      const antwort = await gezeichnet(stand, 'DELETE', pfad);
      if (antwort.status === 404 || antwort.status === 204) { await antwort.text(); return; }
      if (!antwort.ok) await pruefen(antwort, 'Datei ließ sich nicht löschen');
      await antwort.text();
    },

    beschreibung: () => `${stand.eimer} auf ${new URL(stand.endpunkt).host} – Ordner „${WURZEL}“`
  };
}

// ---------------------------------------------------------------- Signatur

/**
 * Eine signierte Anfrage stellen.
 * @param {object} stand geprüfte Verbindungsangaben
 * @param {string} art GET, PUT, HEAD oder DELETE
 * @param {string} schluessel Pfad im Eimer, ohne führenden Schrägstrich
 * @param {object|null} felder Abfragewerte (nur für die Eimerliste)
 * @param {Blob|null} koerper
 * @param {object} zusatzKopf weitere Kopfzeilen, die mitzeichnen
 */
async function gezeichnet(stand, art, schluessel, felder = null, koerper = null, zusatzKopf = {}) {
  const basis = new URL(stand.endpunkt);
  /* Zwei Adressformen: Amazon will den Eimer im Rechnernamen, MinIO und die
     meisten anderen im Pfad. Wer das falsch einstellt, bekommt ein 404 auf
     eine Datei, die sehr wohl da ist. */
  const imHost = stand.pfadstil === 'host';
  const host = imHost ? `${stand.eimer}.${basis.host}` : basis.host;
  const pfadTeile = [
    ...(imHost ? [] : [stand.eimer]),
    ...String(schluessel || '').split('/').filter(Boolean)
  ];
  const pfad = '/' + pfadTeile.map(rfc3986).join('/');

  const abfrage = felder
    ? Object.keys(felder).sort().map(k => `${rfc3986(k)}=${rfc3986(felder[k])}`).join('&')
    : '';

  const jetzt = new Date();
  const zeitstempel = jetzt.toISOString().replace(/[-:]|\.\d{3}/g, '');   // 20260912T101530Z
  const tag = zeitstempel.slice(0, 8);

  const inhaltAbdruck = koerper
    ? hex(await crypto.subtle.digest('SHA-256', await koerper.arrayBuffer()))
    : LEER_ABDRUCK;

  const kopfzeilen = {
    host,
    'x-amz-content-sha256': inhaltAbdruck,
    'x-amz-date': zeitstempel,
    ...zusatzKopf
  };
  /* Gezeichnet wird über kleingeschriebene Namen in alphabetischer Ordnung –
     genau so, wie der Dienst den Text auf seiner Seite wieder zusammensetzt. */
  const klein = {};
  for (const [name, wert] of Object.entries(kopfzeilen)) {
    klein[name.toLowerCase()] = String(wert).trim().replace(/\s+/g, ' ');
  }
  const namen = Object.keys(klein).sort();
  const kanonischeKopfzeilen = namen.map(n => `${n}:${klein[n]}\n`).join('');
  const gezeichneteNamen = namen.join(';');

  const kanonisch = [
    art, pfad, abfrage, kanonischeKopfzeilen, gezeichneteNamen, inhaltAbdruck
  ].join('\n');

  const bereich = `${tag}/${stand.region}/${DIENST}/aws4_request`;
  const zuZeichnen = [
    'AWS4-HMAC-SHA256',
    zeitstempel,
    bereich,
    hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kanonisch)))
  ].join('\n');

  /* Der Zeichenschlüssel entsteht aus vier verketteten HMAC-Schritten. Er
     hängt am Tag und nicht an der Anfrage – gemerkt wird er trotzdem nicht:
     ein Schlüssel im Arbeitsspeicher, der einen Tag lang gilt, ist genau die
     Art von Bequemlichkeit, die in einer Fehlersuche als Erstes übersehen
     wird. Vier HMACs kosten nichts. */
  let schluesselRoh = new TextEncoder().encode('AWS4' + stand.geheim);
  for (const stueck of [tag, stand.region, DIENST, 'aws4_request']) {
    schluesselRoh = new Uint8Array(await hmac(schluesselRoh, stueck));
  }
  const unterschrift = hex(await hmac(schluesselRoh, zuZeichnen));

  const adresse = `${basis.protocol}//${host}${pfad}${abfrage ? '?' + abfrage : ''}`;
  const { host: _weg, ...sendbar } = kopfzeilen;   // den Host setzt der Browser selbst
  return anfrage(adresse, {
    method: art,
    headers: {
      ...sendbar,
      Authorization: `AWS4-HMAC-SHA256 Credential=${stand.schluesselId}/${bereich}, ` +
        `SignedHeaders=${gezeichneteNamen}, Signature=${unterschrift}`
    },
    body: koerper || undefined
  });
}

async function hmac(schluesselRoh, text) {
  const schluessel = await crypto.subtle.importKey(
    'raw', schluesselRoh, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', schluessel, new TextEncoder().encode(text));
}

const hex = puffer =>
  [...new Uint8Array(puffer)].map(b => b.toString(16).padStart(2, '0')).join('');

/* `encodeURIComponent` lässt fünf Zeichen stehen, die AWS gezeichnet sehen
   will. Stimmt die Kodierung nicht bis aufs Zeichen, weicht der kanonische
   Text ab und der Dienst antwortet mit „SignatureDoesNotMatch“ – ohne zu
   sagen, woran es lag. */
const rfc3986 = text => encodeURIComponent(String(text))
  .replace(/[!'()*]/g, z => '%' + z.charCodeAt(0).toString(16).toUpperCase());

// ---------------------------------------------------------------- Innereien

const etag = wert => {
  const text = String(wert || '').trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  return text || null;
};

function xml(text) {
  const baum = new DOMParser().parseFromString(text, 'application/xml');
  if (baum.querySelector('parsererror')) {
    throw new CloudFehler('Die Antwort des Speichers ist kein gültiges XML.');
  }
  return baum;
}

async function pruefen(antwort, was) {
  const text = await antwort.text();
  if (antwort.status === 403) {
    throw new CloudFehler('Der Speicher lehnt den Schlüssel ab. Stimmen Schlüssel und Region?',
      { erneuern: true });
  }
  if (antwort.status === 404) throw new CloudFehler('Am Speicher gibt es diesen Ort nicht.');
  let grund = '';
  const treffer = /<Message>([^<]*)<\/Message>/.exec(text);
  if (treffer) grund = treffer[1];
  throw new CloudFehler(`${was} (Speicher meldet ${antwort.status}). ${grund}`.trim());
}
