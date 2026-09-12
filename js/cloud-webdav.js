// cloud-webdav.js – Rückseite: Nextcloud und anderes WebDAV

/* Fachlich am nächsten an der Zielgruppe – viele Ortsverbände betreiben eine
   eigene Nextcloud –, technisch am zickigsten.

   Der Grund steht in einer einzigen Kopfzeile, die nicht kommt: Nextcloud
   sendet über WebDAV keine CORS-Kopfzeilen. Der Browser bricht die Anfrage
   dann ab, bevor sie überhaupt beim Server ankommt – nicht erst bei der
   Anmeldung, sondern schon beim Vorabruf. Bei einer selbst betriebenen
   Instanz ist das zu lösen (Kopfzeilen im Webserver setzen oder die
   Nextcloud-App „WebAppPassword“ installieren), bei einer fremden Instanz ist
   es das Ende. Das gehört in den Einrichtungstext, nicht in eine
   Fehlermeldung, die erst kommt, wenn schon alles eingetragen ist.

   Angemeldet wird mit einem App-Passwort und nicht mit dem Kennwort des
   Kontos: es lässt sich einzeln widerrufen, und es öffnet nicht die
   Zwei-Faktor-Anmeldung. */

import {
  WURZEL, CloudFehler, KonfliktFehler, anfrage
} from './cloud.js';

// ---------------------------------------------------------------- Einrichten

export async function einrichten(angaben) {
  const adresse = basisAdresse(angaben.adresse);
  const benutzer = String(angaben.benutzer || '').trim();
  const passwort = String(angaben.passwort || '');
  if (!adresse || !benutzer || !passwort) {
    throw new CloudFehler('Adresse, Benutzername und App-Passwort werden gebraucht.');
  }
  if (!/^https:/i.test(adresse) && location.protocol === 'https:') {
    throw new CloudFehler(
      'Die Adresse muss mit https beginnen. Aus einer über HTTPS geladenen Seite ' +
      'lässt der Browser keinen unverschlüsselten Zugriff zu.');
  }

  const neu = { adresse, benutzer, passwort };
  /* Sofort nachsehen, ob der Server antwortet: Ein Einrichtungsvorgang, der
     alles annimmt und erst beim ersten Abgleich scheitert, schickt den Nutzer
     mit dem Gefühl weg, es sei erledigt. */
  const antwort = await anfrage(adresse, {
    method: 'PROPFIND',
    headers: { ...KOPF_XHR, Authorization: ausweis(neu), Depth: '0',
               'Content-Type': 'application/xml' },
    body: ANFRAGE_EIGENSCHAFTEN
  });
  if (antwort.status === 401) {
    throw new CloudFehler('Benutzername oder App-Passwort werden nicht angenommen.');
  }
  if (!antwort.ok && antwort.status !== 207) {
    throw new CloudFehler(`Der Server antwortet mit ${antwort.status}. ` +
      'Stimmt die Adresse des WebDAV-Ordners?');
  }
  await antwort.text();
  return { angaben: neu, name: `${benutzer} auf ${new URL(adresse).host}` };
}

// ---------------------------------------------------------------- Rückseite

export function bauen(angaben) {
  const basis = angaben.adresse;
  const kopf = () => ({ ...KOPF_XHR, Authorization: ausweis(angaben) });
  const url = pfad => basis + String(pfad || '').split('/').filter(Boolean)
    .map(encodeURIComponent).join('/');

  return {
    async auflisten(pfad) {
      const antwort = await anfrage(url(pfad) + '/', {
        method: 'PROPFIND',
        headers: { ...kopf(), Depth: '1', 'Content-Type': 'application/xml' },
        body: ANFRAGE_EIGENSCHAFTEN
      });
      if (antwort.status === 404) return [];
      if (antwort.status !== 207) await pruefen(antwort, 'Ordner nicht lesbar');
      return eintraegeLesen(await antwort.text(), url(pfad));
    },

    async lesen(pfad) {
      const antwort = await anfrage(url(pfad), { headers: kopf() });
      if (antwort.status === 404) return null;
      if (!antwort.ok) await pruefen(antwort, 'Datei nicht lesbar');
      return { blob: await antwort.blob(), marke: etag(antwort.headers.get('etag')) };
    },

    async schreiben(pfad, blob, erwartet) {
      /* Anders als bei den Anbietern mit eigener Schnittstelle legt ein PUT
         hier keine fehlenden Ordner an – es scheitert an ihnen. Also vorher
         anlegen, von oben nach unten. */
      await ordnerSichern(basis, kopf(), pfad);
      const zusatz = {};
      if (erwartet === null) zusatz['If-None-Match'] = '*';
      else if (erwartet !== undefined) zusatz['If-Match'] = erwartet;
      const antwort = await anfrage(url(pfad), {
        method: 'PUT',
        headers: { ...kopf(), ...zusatz, 'Content-Type': blob.type || 'application/octet-stream' },
        body: blob
      });
      if (antwort.status === 412) { await antwort.text(); throw new KonfliktFehler(); }
      if (!antwort.ok) await pruefen(antwort, 'Datei ließ sich nicht ablegen');
      await antwort.text();

      /* Manche Server geben beim PUT kein ETag zurück – dann muss es einzeln
         geholt werden. Ohne Marke fiele der nächste Schreibvorgang auf
         „blind überschreiben“ zurück, und genau das soll er nicht. */
      const gemeldet = etag(antwort.headers.get('etag'));
      if (gemeldet) return gemeldet;
      const nach = await anfrage(url(pfad), { method: 'HEAD', headers: kopf() });
      return etag(nach.headers.get('etag'));
    },

    async loeschen(pfad) {
      const antwort = await anfrage(url(pfad), { method: 'DELETE', headers: kopf() });
      if (antwort.status === 404) return;
      if (!antwort.ok && antwort.status !== 204) {
        await pruefen(antwort, 'Datei ließ sich nicht löschen');
      }
      await antwort.text();
    },

    beschreibung: () => `${new URL(basis).host} – Ordner „${WURZEL}“`
  };
}

// ---------------------------------------------------------------- Innereien

const ANFRAGE_EIGENSCHAFTEN =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<d:propfind xmlns:d="DAV:"><d:prop>' +
  '<d:resourcetype/><d:getetag/><d:getcontentlength/>' +
  '</d:prop></d:propfind>';

/** Adresse auf die Form „https://host/pfad/“ bringen – mit Schrägstrich am Ende */
function basisAdresse(roh) {
  const text = String(roh || '').trim();
  if (!text) return '';
  try {
    const adresse = new URL(text);
    if (!/\/$/.test(adresse.pathname)) adresse.pathname += '/';
    adresse.search = ''; adresse.hash = '';
    return adresse.href;
  } catch (e) { return ''; }
}

/* Jede Anfrage trägt diese Kopfzeile mit. Sie sieht nach Altlast aus, ist hier
   aber der Unterschied zwischen einer Fehlermeldung und einem Abbruch: Auf ein
   401 mit `WWW-Authenticate: Basic` bricht der Browser einen Abruf über
   Herkunftsgrenzen hinweg ab, statt die Antwort durchzureichen – ein falsches
   App-Passwort käme dann als „Server nicht erreichbar“ an, und der Nutzer
   suchte den Fehler an der falschen Stelle. Nextcloud lässt die Kopfzeile
   genau dann weg, wenn diese hier mitkommt. */
const KOPF_XHR = { 'X-Requested-With': 'XMLHttpRequest' };

/* `btoa` kann nur Bytes. Ein Kennwort mit Umlaut ist in JavaScript eine Folge
   von Zeichen jenseits davon und ließe die Anmeldung ohne diesen Umweg mit
   einem Ausnahmefehler statt mit einer Meldung scheitern. */
function ausweis({ benutzer, passwort }) {
  const bytes = new TextEncoder().encode(`${benutzer}:${passwort}`);
  let roh = '';
  for (const b of bytes) roh += String.fromCharCode(b);
  return 'Basic ' + btoa(roh);
}

/* Ein ETag kommt mal mit, mal ohne Anführungszeichen und bei manchen Servern
   mit vorangestelltem W/ für „schwach“. Verglichen wird der nackte Wert –
   sonst gälte dieselbe Datei je nach Tageslaune als geändert. */
const etag = wert => {
  const text = String(wert || '').trim().replace(/^W\//, '').replace(/^"|"$/g, '');
  return text || null;
};

function eintraegeLesen(xml, eigeneAdresse) {
  const baum = new DOMParser().parseFromString(xml, 'application/xml');
  if (baum.querySelector('parsererror')) {
    throw new CloudFehler('Die Antwort des Servers ist kein WebDAV.');
  }
  const eigen = entpackt(eigeneAdresse);
  const raus = [];
  for (const antwort of baum.getElementsByTagNameNS('DAV:', 'response')) {
    const href = antwort.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent || '';
    const pfad = entpackt(href);
    if (pfad === eigen) continue;                 // der Ordner selbst steht mit in der Liste
    const name = pfad.split('/').pop() || '';
    if (!name) continue;
    const ordner = !!antwort.getElementsByTagNameNS('DAV:', 'collection').length;
    raus.push({
      name,
      ordner,
      marke: ordner ? null : etag(antwort.getElementsByTagNameNS('DAV:', 'getetag')[0]?.textContent),
      groesse: Number(antwort.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent) || 0
    });
  }
  return raus;
}

/* Der href einer Antwort ist mal absolut, mal nur der Pfad. Verglichen wird
   deshalb nur der Pfadteil – und zwar entpackt.

   Auf die Entpackung kommt es an: Server und Browser kodieren nicht dieselben
   Zeichen. Eine Klammer im Ordnernamen – und jeder Planungsordner trägt die
   Kennung in Klammern – schreibt Nextcloud als `%28`, `encodeURIComponent`
   lässt sie stehen. Verglichen man die rohen Zeichenketten, gälte der Ordner
   sich selbst nicht als sich selbst und stünde in seiner eigenen Liste. */
function entpackt(adresse) {
  let pfad;
  try { pfad = new URL(adresse, location.href).pathname; }
  catch (e) { pfad = String(adresse || ''); }
  pfad = pfad.replace(/\/+$/, '');
  try { return decodeURIComponent(pfad); } catch (e) { return pfad; }
}

/** Die Ordner über einer Datei anlegen, soweit sie fehlen */
async function ordnerSichern(basis, kopf, pfad) {
  const teile = String(pfad).split('/').filter(Boolean);
  teile.pop();                                    // der Dateiname selbst
  let hier = basis;
  for (const stueck of teile) {
    hier += encodeURIComponent(stueck) + '/';
    const antwort = await anfrage(hier, { method: 'MKCOL', headers: kopf });
    /* 405 heißt „gibt es schon“ – der Normalfall bei jedem Abgleich nach dem
       ersten. 401 dagegen ist ein echter Ausfall und darf nicht durchrutschen,
       sonst scheitert erst das PUT und meldet den falschen Grund. */
    if (antwort.status === 401) {
      throw new CloudFehler('Die Anmeldung am Server gilt nicht mehr.', { erneuern: true });
    }
    await antwort.text();
  }
}

async function pruefen(antwort, was) {
  if (antwort.ok || antwort.status === 207) return;
  await antwort.text();
  if (antwort.status === 401) {
    throw new CloudFehler('Die Anmeldung am Server gilt nicht mehr.', { erneuern: true });
  }
  if (antwort.status === 403) {
    throw new CloudFehler('Der Server verweigert den Zugriff auf diesen Ordner.');
  }
  if (antwort.status === 507) throw new CloudFehler('Der Speicherplatz auf dem Server ist voll.');
  throw new CloudFehler(`${was} (Server meldet ${antwort.status}).`);
}
