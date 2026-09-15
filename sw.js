// sw.js – Die Anwendung startet ohne Netz

/* Am Bauort ist kein Netz, und genau dort wird die Anwendung gebraucht. Ohne
   diesen Wächter lädt eine Seite ohne Verbindung überhaupt nicht – auch nicht
   die Planung, die längst im Gerät liegt.

   Der erste Entwurf legte ab, was die Anwendung im Laufen lädt, und sparte
   sich damit eine Dateiliste. Das ist beim Prüfen durchgefallen, und zwar
   genau an der Stelle, für die der Wächter da ist: nach einer Veröffentlichung
   heißt der Speicher anders, der neue ist beim Aktivieren noch leer, der alte
   wird gelöscht – und wer dann ohne Netz aufschlägt, bekommt ein totes
   HTML-Gerippe. Dasselbe Nachladen ließ außerdem eine neue Seite mit alten
   Modulen laufen.

   Deshalb jetzt umgekehrt: **ein Stand wird vollständig abgelegt, bevor er
   gilt.** `install` holt den ganzen Bestand; scheitert eine einzige Datei,
   scheitert die Einrichtung, der alte Stand bleibt und die Anwendung läuft
   weiter wie bisher. Erst wenn der neue Stand vollständig daliegt und keine
   Seite mehr am alten hängt, wird der alte weggeräumt. Ein Stand wird nie
   halb, und zwei Stände mischen sich nie.

   Die Dateiliste steht trotzdem nirgends von Hand: sie wird beim Einrichten
   aus `index.html` und der Modulkette ermittelt. Verfolgt werden nur STATISCHE
   Importe – `import()` bleibt außen vor, und damit bleibt `vendor/libheif`
   draußen, wie es in `CLAUDE.md` steht: es wird nur nachgeladen, wenn eine
   HEIC-Datei ankommt, und gehört nie in den Startweg. Aus demselben Grund
   fehlen die Rückseiten des eigenen Speichers (`js/cloud-*.js`) – ohne Netz
   haben sie ohnehin nichts zu tun.

   `STAND` setzt der Veröffentlichungs-Workflow ein, wie in `js/version.js`. Im
   Repository steht „Entwicklungsstand“; die Zeile darf nicht umbenannt werden,
   sonst liefe die Ersetzung ins Leere und jeder Stand teilte sich einen
   Speicher mit allen vorherigen. */

const STAND = 'Entwicklungsstand';
const SPEICHER = 'fbp-' + STAND;

/* Wie lange auf das Netz gewartet wird, bevor aus dem Speicher geantwortet
   wird. Am Bauort ist die Verbindung nicht weg, sondern schlecht – und ein
   Browser, der eine halbe Minute am Ladebalken hängt, ist dort unbrauchbarer
   als einer, der den abgelegten Stand zeigt. */
const NETZFRIST = 4000;

// ---------------------------------------------------------------- Einrichten

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const speicher = await caches.open(SPEICHER);
    const bestand = await bestandErmitteln();
    /* `addAll` ist hier das Richtige und nicht `add` in einer Schleife: es ist
       alles oder nichts. Ein halb gefüllter Stand wäre schlimmer als keiner –
       er sähe vollständig aus und fiele am Bauort auseinander. */
    await speicher.addAll(bestand);
  })());
});

/** Die Adresse relativ zum Geltungsbereich – die Seite muss auch in einem
 *  Unterverzeichnis laufen (`CLAUDE.md`: alle Pfade relativ). */
const imBereich = pfad => new URL(pfad, self.registration.scope).href;

/* Was kein Pfad ist, auch wenn es in einem `url()` steht. Leaflets Stilblatt
   trägt `#default#VML` – ein Überbleibsel aus der Zeit des Internet Explorer.
   Ohne diese Schranke scheiterte `addAll` daran und mit ihm die ganze
   Einrichtung. */
const istPfad = u => u && !/^(?:[a-z]+:)?\/\//i.test(u) && !u.startsWith('data:')
  && !u.startsWith('#') && !u.startsWith('mailto:');

async function bestandErmitteln() {
  const dabei = new Set();
  const nimm = adresse => { if (adresse) dabei.add(adresse); };

  /* Die Startseite und alles, was sie unmittelbar nennt: Stilblätter, das
     Kartenprogramm, die Modulvorladungen. */
  const seite = imBereich('index.html');
  nimm(seite);
  const html = await text(seite);
  for (const treffer of html.matchAll(/<(?:link|script)\b[^>]*?\b(?:href|src)=["']([^"']+)["']/gi)) {
    if (istPfad(treffer[1])) nimm(new URL(treffer[1], seite).href);
  }

  /* Die übrigen Seiten der Anwendung stehen in der Sitemap – Datenschutz,
     Impressum, Autorenseite. Sie kommen aus derselben Liste, die beim
     Veröffentlichen ohnehin gepflegt wird (`CLAUDE.md`: neue Seite heißt,
     Adresse in `sitemap.xml` eintragen), damit hier nichts zweimal steht. */
  try {
    const karte = await text(imBereich('sitemap.xml'));
    for (const treffer of karte.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      let pfad = new URL(treffer[1]).pathname.replace(/^\/+/, '');
      if (pfad === '' || pfad.endsWith('/')) pfad += 'index.html';
      nimm(imBereich(pfad));
    }
  } catch (e) {
    /* Ohne Sitemap fehlen die Nebenseiten im Speicher; die Anwendung selbst
       läuft trotzdem. Kein Grund, die Einrichtung scheitern zu lassen. */
  }

  /* Die Modulkette, statisch verfolgt. */
  const offen = [...dabei].filter(a => a.endsWith('.js'));
  const gesehen = new Set(offen);
  while (offen.length) {
    const modul = offen.pop();
    let quelle;
    try { quelle = await text(modul); } catch (e) { continue; }
    for (const spezifikation of importe(quelle)) {
      if (!spezifikation.startsWith('.')) continue;
      const ziel = new URL(spezifikation, modul).href;
      if (gesehen.has(ziel)) continue;
      gesehen.add(ziel);
      nimm(ziel);
      offen.push(ziel);
    }
  }

  /* Was die Stilblätter nachladen – die Beschriftungsschrift der taktischen
     Zeichen und die Bildchen von Leaflet. */
  for (const blatt of [...dabei].filter(a => a.endsWith('.css'))) {
    let quelle;
    try { quelle = await text(blatt); } catch (e) { continue; }
    for (const treffer of quelle.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (istPfad(treffer[1])) nimm(new URL(treffer[1], blatt).href);
    }
  }

  /* Nur der eigene Ursprung: der Zählimpuls und die Kartenkacheln gehören
     nicht in diesen Speicher. */
  return [...dabei].filter(a => new URL(a).origin === self.location.origin);
}

/* Drei Formen des statischen Imports. `import(` mit Klammer fehlt hier
   absichtlich – siehe den Kopf dieser Datei. */
const IMPORTMUSTER = [
  /(?:^|[\s;}])import\s[^;]*?from\s*['"]([^'"]+)['"]/g,
  /(?:^|[\s;}])export\s[^;]*?from\s*['"]([^'"]+)['"]/g,
  /(?:^|[\s;}])import\s*['"]([^'"]+)['"]/g
];

function* importe(quelle) {
  for (const muster of IMPORTMUSTER) {
    for (const treffer of quelle.matchAll(muster)) yield treffer[1];
  }
}

async function text(adresse) {
  /* `cache: 'reload'` umgeht den HTTP-Zwischenspeicher des Browsers: beim
     Einrichten eines neuen Standes soll wirklich der neue Stand abgelegt
     werden und nicht der, den der Browser noch herumliegen hat. */
  const antwort = await fetch(adresse, { cache: 'reload' });
  if (!antwort.ok) throw new Error(adresse + ': ' + antwort.status);
  return antwort.text();
}

// ---------------------------------------------------------------- Übernehmen

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    /* Jetzt ist der eigene Stand vollständig – `install` wäre sonst
       gescheitert –, und keine Seite hängt mehr am alten. Erst deshalb dürfen
       die früheren Speicher fallen. */
    for (const name of await caches.keys()) {
      if (name.startsWith('fbp-') && name !== SPEICHER) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// ---------------------------------------------------------------- Ausliefern

/* Der Wächter nimmt sich nur, was zur Anwendung selbst gehört. Kartenkacheln,
   Höhendaten, die Abfragen an OpenStreetMap und der Zählimpuls laufen weiter
   unmittelbar ins Netz: die Kacheln haben mit `js/kacheln.js` ihren eigenen
   Vorrat, und der Rest gehört nicht in einen Speicher, den niemand sieht. */
const eigen = url => new URL(url).origin === self.location.origin;

self.addEventListener('fetch', e => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET' || !eigen(anfrage.url)) return;

  /* Eine Adresse mit Abfrageteil wird weder beantwortet noch abgelegt. Der
     Rückweg der Speicheranbindung (`cloud-rueckweg.html?code=…`) trägt dort
     den Autorisierungscode, und der hat in einem Speicher, den niemand sieht,
     nichts verloren – die Seite räumt ihn eigens aus dem Browserverlauf. */
  if (new URL(anfrage.url).search) return;

  e.respondWith(anfrage.mode === 'navigate' ? seiteHolen(e) : ausSpeicher(e));
});

/**
 * Eine Seite ausliefern.
 *
 * Aus dem Speicher zuerst, und das ist Absicht: ein Stand ist vollständig
 * abgelegt, und ihn aus dem Netz zu übergehen hieße, eine neue Seite mit alten
 * Modulen zu zeigen. Der neue Stand kommt über den Wächter selbst – der
 * Browser prüft ihn bei jeder Navigation –, und dass er bereitsteht, meldet
 * die Anwendung dem Nutzer.
 */
async function seiteHolen(e) {
  const speicher = await caches.open(SPEICHER);
  const gespeichert = await speicher.match(e.request, { ignoreSearch: true });
  if (gespeichert) return gespeichert;

  try {
    const antwort = await mitFrist(fetch(e.request), NETZFRIST);
    if (antwort) return antwort;
  } catch (f) { /* kein Netz oder zu langsam – unten weiter */ }

  /* Nur die Startseite vertritt sich selbst. Eine unbekannte Adresse mit der
     Anwendung zu beantworten machte aus jedem Tippfehler eine scheinbar
     gültige Seite und nähme dem Hoster seine eigene Fehlerseite weg. */
  const start = await speicher.match(imBereich('index.html'));
  const istStart = e.request.url.replace(/[?#].*$/, '') === imBereich('')
    || e.request.url.replace(/[?#].*$/, '') === imBereich('index.html');
  if (istStart && start) return start;

  return new Response(
    'Diese Seite liegt nicht im Gerät, und es ist keine Verbindung da.\n'
    + 'Der FMBauplaner selbst läuft ohne Netz – zurück zur Startseite.',
    { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function ausSpeicher(e) {
  const speicher = await caches.open(SPEICHER);
  const gespeichert = await speicher.match(e.request);
  if (gespeichert) return gespeichert;

  /* Was nicht im Bestand steht, kommt aus dem Netz und wird dem eigenen Stand
     hinzugefügt: die nachgeladenen Teile der Speicheranbindung etwa, oder
     `vendor/libheif`, sobald das erste HEIC-Bild ankommt. `waitUntil` hält den
     Wächter so lange am Leben – ohne das kann der Browser ihn beenden, bevor
     das Ablegen durch ist. */
  try {
    const antwort = await fetch(e.request);
    if (antwort && antwort.ok && antwort.status === 200 && antwort.type === 'basic') {
      e.waitUntil(speicher.put(e.request, antwort.clone()));
    }
    return antwort;
  } catch (f) {
    return new Response('', { status: 504, statusText: 'Ohne Netz nicht im Speicher' });
  }
}

function mitFrist(versprechen, ms) {
  return Promise.race([
    versprechen,
    new Promise((_, fehler) => setTimeout(() => fehler(new Error('Netz zu langsam')), ms))
  ]);
}
