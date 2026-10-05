// offline-pruefen.mjs – Läuft die Anwendung ohne Netz?
//
// Am Bauort ist keine Verbindung, und dort wird die Anwendung gebraucht. Ob
// sie ohne Netz startet, lässt sich nicht am Quelltext ablesen: es hängt am
// Zusammenspiel von sw.js, der Registrierung in app.js und dem Kachelvorrat in
// kacheln.js. Diese Prüfung schaltet das Netz im Browser wirklich ab.
//
//     node scripts/offline-pruefen.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { starteServer, starteBrowser, neuerBefund } from './pruefstand.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

const server = await starteServer(WURZEL);
const browser = await starteBrowser();
let seite = await browser.seite();
const b = neuerBefund();
const adresse = `http://127.0.0.1:${server.port}/index.html`;

try {
  // ------------------------------------------------------------ Einrichten

  b.abschnitt('Der Wächter richtet sich ein');
  await seite.breit(1280, 860);
  await seite.oeffne(adresse);
  await seite.warteAuf('!!window.fbp', 20000);
  await seite.warteAufWaechter();
  b.pruefe(true, 'Ein Service Worker führt die Seite');
  b.gleich(await seite.auswerten(`
    const a = await navigator.serviceWorker.getRegistration();
    return new URL(a.scope).pathname;`), '/', 'Sein Geltungsbereich ist die ganze Seite');

  /* Der Wächter legt ab, was die Anwendung lädt. Ein zweiter Aufruf mit Netz
     füllt deshalb den Speicher vollständig – erst danach ist der Ausfall des
     Netzes eine ehrliche Prüfung. */
  b.abschnitt('Der Speicher füllt sich beim Laufen');
  await seite.neuLaden();
  await seite.warteAuf('!!window.fbp', 20000);
  const abgelegt = await seite.auswerten(`
    const namen = await caches.keys();
    const eigene = namen.filter(n => n.startsWith('fbp-'));
    if (!eigene.length) return { speicher: 0, eintraege: 0, hat: [] };
    const s = await caches.open(eigene[0]);
    const schluessel = (await s.keys()).map(r => new URL(r.url).pathname);
    return { speicher: eigene.length, eintraege: schluessel.length,
             hat: ['/index.html', '/js/app.js', '/js/state.js', '/css/app.css',
                   '/vendor/leaflet/leaflet.js']
               .filter(p => schluessel.some(k => k === p || k.endsWith(p))) };`);
  b.gleich(abgelegt.speicher, 1, 'Genau ein Speicherstand');
  b.pruefe(abgelegt.eintraege > 20, `Der Bestand liegt im Speicher (${abgelegt.eintraege} Einträge)`);
  b.gleich(abgelegt.hat.length, 5, 'Seite, Modulkern, Stilblatt und Leaflet sind dabei');
  b.pruefe(!(await seite.auswerten(`
    const n = (await caches.keys()).find(x => x.startsWith('fbp-'));
    const s = await caches.open(n);
    return (await s.keys()).some(r => r.url.includes('libheif'));`)),
    'libheif liegt nicht im Startweg');

  // ------------------------------------------------------------ Ohne Netz

  b.abschnitt('Die Anwendung startet ohne Netz');
  /* Drei Dinge müssen zusammenkommen, sonst beweist der Abschnitt nichts:

     1. Der Zwischenspeicher des Browsers muss weg – sonst beantwortet er die
        Anfragen selbst, und die Prüfung zeigte nur, dass Chromium einen Cache
        hat.
     2. Der Server muss die Verbindung abweisen. Die Abschaltung über das
        DevTools-Protokoll gilt nur für das Seitenziel; der Service Worker ist
        ein eigenes Ziel und behielte sein Netz. Eine Prüfung ohne diesen
        Schritt bestätigt auch einen Wächter, der nichts aus dem Speicher
        liefert – nachgewiesen bei der Durchsicht dieser Stufe.
     3. Die Seite soll trotzdem wissen, dass sie offline ist, damit sie sich
        verhält wie am Bauort. */
  await seite.zwischenspeicherLeeren();
  server.netzAus();
  await seite.ohneNetz();
  await seite.neuLaden();
  await seite.warteAuf('!!window.fbp', 25000);
  b.pruefe(await seite.sichtbar('#karte'), 'Die Karte steht');
  b.pruefe(await seite.sichtbar('#btn-modus'), 'Der Moduswechsel steht');
  b.gleich(await seite.auswerten('navigator.onLine'), false, 'Der Browser weiß, dass kein Netz da ist');
  /* Acht: die sechs Planungswerkzeuge und die zwei Griffe des Baumodus, die
     im Markup stehen und nur dort sichtbar werden. */
  b.pruefe(await seite.anzahl('.wz') === 8, 'Die Werkzeuge sind da');

  b.abschnitt('Und die Planung ist noch da');
  await seite.auswerten(`
    const zu = await import('./js/state.js');
    window.fbp.store.aendern(p => {
      const s = zu.neueStrecke(p);
      s.name = 'Ohne Netz gebaut';
      s.punkte.push(zu.neuerPunkt(51.80, 10.60), zu.neuerPunkt(51.806, 10.60));
      p.strecken.push(s);
    }, 'strecke');
    return true;`);
  await seite.ruhe();
  b.gleich(await seite.auswerten('window.fbp.store.projekt.strecken.length'), 1,
    'Ohne Netz lässt sich eine Strecke anlegen');
  await seite.neuLaden();
  await seite.warteAuf('!!window.fbp', 25000);
  b.gleich(await seite.auswerten('window.fbp.store.projekt.strecken[0].name'), 'Ohne Netz gebaut',
    'Sie überlebt das Neuladen ohne Netz');

  // ------------------------------------------------- Eine Veröffentlichung

  /* Der Fall, an dem der erste Entwurf gescheitert ist: im Ortsverband wird
     die Seite noch einmal mit Netz aufgerufen, dabei erscheint eine neue
     Fassung, der Trupp rückt aus – und am Bauort läuft nichts mehr, weil der
     neue Wächter den alten Speicher weggeräumt hatte, ohne selbst einen
     vollständigen zu haben.

     Nachgestellt wird das ehrlich: der Stempel in `sw.js` wird auf der Platte
     gewechselt, die Seite mit Netz neu geladen, das Fenster geschlossen (erst
     dann übernimmt der neue Wächter), und danach ohne Netz neu geöffnet. */
  b.abschnitt('Ein neuer Stand nimmt die Anwendung nicht mit');
  server.netzAn();
  await seite.mitNetz();
  const swPfad = join(WURZEL, 'sw.js');
  const vorher = await readFile(swPfad, 'utf8');
  try {
    await writeFile(swPfad, vorher.replace(
      "const STAND = 'Entwicklungsstand';", "const STAND = '2026.101.1200';"));
    await seite.neuLaden();
    await seite.warteAuf('!!window.fbp', 20000);
    /* Gewartet wird auf `waiting` und nicht darauf, dass ein zweiter Speicher
       auftaucht: den legt `caches.open` schon an, bevor der Bestand darin ist.
       Wer darauf misst, sieht einen leeren Stand und hält ihn für kaputt.
       `waiting` heißt: eingerichtet, vollständig, und wartet auf die Übernahme. */
    await seite.warteAuf(`
      const a = await navigator.serviceWorker.getRegistration();
      return !!(a && a.waiting);`, 40000);
    const zweiStaende = await seite.auswerten(`
      const namen = (await caches.keys()).filter(n => n.startsWith('fbp-'));
      const zahlen = {};
      for (const n of namen) zahlen[n] = (await (await caches.open(n)).keys()).length;
      return zahlen;`);
    const werte = Object.values(zweiStaende);
    b.gleich(werte.length, 2, 'Beide Stände liegen nebeneinander im Speicher');
    b.pruefe(werte.every(n => n > 20),
      `Der neue Stand ist vollständig, bevor er gilt (${JSON.stringify(zweiStaende)})`);

    /* Das Fenster schließen: erst ohne Client übernimmt der wartende Wächter
       und räumt den alten Stand weg. */
    await seite.schliessen();
    seite = await browser.seite();
    await seite.breit(1280, 860);
    await seite.zwischenspeicherLeeren();
    server.netzAus();
    await seite.ohneNetz();
    await seite.oeffne(adresse);
    await seite.warteAuf('!!window.fbp', 25000);
    b.pruefe(await seite.sichtbar('#karte'),
      'Nach der Veröffentlichung startet die Anwendung am Bauort weiterhin ohne Netz');
    /* Geprüft wird die Eigenschaft, nicht der Zeitpunkt: WANN der alte Stand
       fällt, hängt daran, wann der Browser den wartenden Wächter übernehmen
       lässt, und das ist nicht auf die Sekunde festzunageln. Was zählen muss,
       ist, dass kein halber Stand entsteht – jeder Speicher, der da ist, trägt
       den ganzen Bestand. Genau daran ist der erste Entwurf gescheitert. */
    const staende = await seite.auswerten(`
      const namen = (await caches.keys()).filter(n => n.startsWith('fbp-'));
      const zahlen = {};
      for (const n of namen) zahlen[n] = (await (await caches.open(n)).keys()).length;
      return zahlen;`);
    b.pruefe(Object.keys(staende).length <= 2,
      `Höchstens zwei Stände liegen nebeneinander (${JSON.stringify(staende)})`);
    b.pruefe(Object.values(staende).every(n => n > 20),
      'Kein halber Stand – jeder Speicher trägt den ganzen Bestand');
  } finally {
    await writeFile(swPfad, vorher);
  }

  // ------------------------------------------------------------ Kachelvorrat

  b.abschnitt('Der Kachelvorrat');
  server.netzAn();
  await seite.mitNetz();
  const gerechnet = await seite.auswerten(`
    const k = await import('./js/kacheln.js');
    const punkte = [];
    for (let i = 0; i <= 10; i++) punkte.push({ lat: 51.80 + i * 0.0045, lng: 10.60 });
    const u = k.umfang(punkte);
    const eng = k.umfang(punkte, { zoomVon: 15, zoomBis: 15 });
    return { anzahl: u.anzahl, ausgelassen: u.ausgelassen, eng: eng.anzahl,
             adresse: k.kacheladresse('https://x/{z}/{x}/{y}.png', { z: 15, x: 17, y: 10 }) };`);
  b.pruefe(gerechnet.anzahl > 100 && gerechnet.anzahl < 400,
    `Eine 5-km-Trasse kostet einen überschaubaren Vorrat (${gerechnet.anzahl} Kacheln)`);
  b.gleich(gerechnet.ausgelassen, 0, 'Der Deckel greift dabei nicht');
  b.pruefe(gerechnet.eng < gerechnet.anzahl, 'Ein engerer Zoombereich kostet weniger');
  b.gleich(gerechnet.adresse, 'https://x/15/17/10.png', 'Die Kacheladresse wird richtig gebaut');

  b.abschnitt('Eine abgelegte Kachel kommt ohne Netz zurück');
  /* Abgelegt wird über dieselbe Datenbank, die auch das Vorladen benutzt –
     geprüft wird der Leseweg der Karte, nicht der Abruf beim Anbieter. */
  const durchgereicht = await seite.auswerten(`
    const url = 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/15/17/10.png';
    const db = await new Promise((f, r) => {
      const a = indexedDB.open('fbp.kacheln', 1);
      a.onupgradeneeded = () => {
        if (!a.result.objectStoreNames.contains('kacheln')) {
          a.result.createObjectStore('kacheln', { keyPath: 'url' });
        }
      };
      a.onsuccess = () => f(a.result); a.onerror = () => r(a.error);
    });
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    await new Promise((f, r) => {
      const v = db.transaction('kacheln', 'readwrite');
      v.objectStore('kacheln').put({ url, blob, karte: 'topplus', zeit: Date.now(), groesse: blob.size });
      v.oncomplete = f; v.onerror = () => r(v.error);
    });
    const k = await import('./js/kacheln.js');
    const zurueck = await k.kachelHolen(url);
    const stand = await k.bestand();
    return { da: !!zurueck, groesse: zurueck ? zurueck.size : 0,
             anzahl: stand.anzahl, bytes: stand.bytes };`);
  b.pruefe(durchgereicht.da, 'Die Kachel kommt aus dem Vorrat zurück');
  b.gleich(durchgereicht.groesse, 4, 'Und zwar unverändert');
  b.gleich(durchgereicht.anzahl, 1, 'Der Bestand zählt sie');
  b.gleich(durchgereicht.bytes, 4, 'Und nennt ihren Platz');

  b.abschnitt('Eine Kachel aus dem Vorrat übersteht den Druck');
  /* Die Kachel hängt als Blob-Adresse am Bild. Wird die Adresse freigegeben,
     solange das Bild sie noch braucht, bleibt beim Drucken eine weiße Fläche –
     und das gedruckte Blatt ist das Erzeugnis dieser Anwendung. Geprüft wird
     deshalb an einem echten Bild und nicht am Quelltext. */
  const gedruckt = await seite.auswerten(`
    const k = await import('./js/kacheln.js');
    const karte = window.fbp.karte;
    /* Ein echtes, decodierbares PNG: 32 × 32 Bildpunkte aus einer Leinwand. */
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c8d8e8'; ctx.fillRect(0, 0, 32, 32);
    const blob = await new Promise(f => c.toBlob(f, 'image/png'));

    /* Alle Kacheln des aktuellen Ausschnitts in den Vorrat legen, damit die
       Karte sie von dort nimmt. */
    const basis = karte._fbpBasis;
    const adressen = [];
    for (const schluessel of Object.keys(basis._tiles || {})) {
      const t = basis._tiles[schluessel];
      if (t && t.el && t.el.src) adressen.push(basis.getTileUrl(t.coords));
    }
    const db = await new Promise((f, r) => {
      const a = indexedDB.open('fbp.kacheln', 1);
      a.onupgradeneeded = () => {
        if (!a.result.objectStoreNames.contains('kacheln')) {
          a.result.createObjectStore('kacheln', { keyPath: 'url' });
        }
      };
      a.onsuccess = () => f(a.result); a.onerror = () => r(a.error);
    });
    await new Promise((f, r) => {
      const v = db.transaction('kacheln', 'readwrite');
      for (const url of adressen) {
        v.objectStore('kacheln').put({ url, blob, karte: 'topplus', zeit: Date.now(), groesse: blob.size });
      }
      v.oncomplete = f; v.onerror = () => r(v.error);
    });
    if (!adressen.length) return { adressen: 0 };

    /* Neu zeichnen, damit die Kacheln aus dem Vorrat kommen */
    basis.redraw();
    await new Promise(f => setTimeout(f, 1200));
    const ausVorrat = [...document.querySelectorAll('.leaflet-tile')]
      .filter(i => i.src.startsWith('blob:'));
    return { adressen: adressen.length, ausVorrat: ausVorrat.length,
             geladen: ausVorrat.filter(i => i.complete && i.naturalWidth > 0).length };`);
  b.pruefe(gedruckt.adressen > 0, `Der Ausschnitt hat Kacheln (${gedruckt.adressen})`);
  b.pruefe(gedruckt.ausVorrat > 0, `Die Karte nimmt sie aus dem Vorrat (${gedruckt.ausVorrat} Bilder)`);
  b.gleich(gedruckt.geladen, gedruckt.ausVorrat,
    'Jede davon trägt noch ihr Bild – die Blob-Adresse ist nicht vorzeitig freigegeben');

  /* Für den Druck muss der Vorrat die GRAUSTUFENVARIANTE halten: der Bauauftrag
     zeichnet sie (`grauVariante()` in js/map.js), und das ist eine andere
     Adresse als die der farbigen Karte auf dem Schirm. Der Prüflauf legt sie
     deshalb eigens hin – im Betrieb hält der Vorrat nur die Karte, mit der
     gearbeitet wird. Das ist eine bewusste Grenze: am Bauort wird nicht
     gedruckt, und den doppelten Vorrat bezahlte sonst der Kachelserver. */
  const imDruck = await seite.auswerten(`
    const k = await import('./js/kacheln.js');
    const kartenmodul = await import('./js/map.js');
    const grau = kartenmodul.basiskarteById(
      kartenmodul.grauVariante(window.fbp.store.projekt.ansicht.basemap));

    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b4c4d4'; ctx.fillRect(0, 0, 32, 32);
    const blob = await new Promise(f => c.toBlob(f, 'image/png'));

    const s = window.fbp.store.projekt.strecken[0];
    const liste = k.kachelliste(s.punkte, { zoomVon: 10, zoomBis: 16, puffer: 1200 });
    const db = await new Promise((f, r) => {
      const a = indexedDB.open('fbp.kacheln', 1);
      a.onupgradeneeded = () => {
        if (!a.result.objectStoreNames.contains('kacheln')) {
          a.result.createObjectStore('kacheln', { keyPath: 'url' });
        }
      };
      a.onsuccess = () => f(a.result); a.onerror = () => r(a.error);
    });
    await new Promise((f, r) => {
      const v = db.transaction('kacheln', 'readwrite');
      const lager = v.objectStore('kacheln');
      for (const kachel of liste) {
        lager.put({ url: k.kacheladresse(grau.url, kachel), blob,
                    karte: grau.id, zeit: Date.now(), groesse: blob.size });
      }
      v.oncomplete = f; v.onerror = () => r(v.error);
    });

    const m = await import('./js/bauauftrag.js');
    m.oeffneBauauftrag(s.id);
    await new Promise(f => setTimeout(f, 4000));
    const kacheln = [...document.querySelectorAll('#druck img.leaflet-tile')];
    const ausVorrat = kacheln.filter(i => i.src.startsWith('blob:'));
    const leer = ausVorrat.filter(i => i.complete && i.naturalWidth === 0).length;
    m.schliesseBauauftrag();
    return { abgelegt: liste.length, kacheln: kacheln.length,
             ausVorrat: ausVorrat.length, leer };`);
  b.pruefe(imDruck.ausVorrat > 0,
    `Der Bauauftrag nimmt Kacheln aus dem Vorrat (${imDruck.ausVorrat} von ${imDruck.kacheln})`);
  b.gleich(imDruck.leer, 0,
    'Keine davon bleibt leer – die Blob-Adresse hält bis zum Rastern des Blattes');

  b.abschnitt('Eine abgebrochene Kachel lässt keine Blob-Adresse zurück');
  /* Leaflet wirft beim Zoomen unfertige Kacheln weg und feuert dabei
     `tileabort`, nicht `tileunload`. Kommt die Antwort des Vorrats erst danach,
     darf sie weder eine Adresse anlegen, die niemand mehr freigibt, noch den
     Abruf nachträglich doch ins Netz schicken. Über einen Arbeitstag mit
     Zoomen, Kartenwechseln und Druckvorschauen wäre das ein stetiges Leck. */
  const abgebrochen = await seite.auswerten(`
    const basis = window.fbp.karte._fbpBasis;
    const schluessel = Object.keys(basis._tiles || {});
    if (!schluessel.length) return { kacheln: 0 };
    const koordinaten = basis._tiles[schluessel[0]].coords;

    /* Wie Leaflets _abortLoading: die Kachel ist weg, bevor der Vorrat antwortet. */
    const fruehWeg = basis.createTile(koordinaten, () => {});
    basis.fire('tileabort', { tile: fruehWeg });

    /* Und eine, die erst fertig wird und danach abgeräumt. */
    const spaetWeg = basis.createTile(koordinaten, () => {});
    await new Promise(f => setTimeout(f, 1500));
    const hatteAdresse = !!spaetWeg._fbpBlobAdresse;
    basis.fire('tileunload', { tile: spaetWeg });

    return {
      kacheln: schluessel.length,
      frueh: { weg: !!fruehWeg._fbpWeg, quelle: fruehWeg.src,
               adresse: !!fruehWeg._fbpBlobAdresse },
      spaet: { hatteAdresse, adresse: !!spaetWeg._fbpBlobAdresse }
    };`);
  b.pruefe(abgebrochen.kacheln > 0, `Der Ausschnitt trägt Kacheln (${abgebrochen.kacheln})`);
  b.pruefe(abgebrochen.frueh.weg, 'Der Abbruch merkt die Kachel als weg vor');
  b.gleich(abgebrochen.frueh.adresse, false,
    'Danach entsteht keine Blob-Adresse, die niemand mehr freigäbe');
  b.gleich(abgebrochen.frueh.quelle, '',
    'Und kein nachgereichter Abruf aus dem Netz');
  b.pruefe(abgebrochen.spaet.hatteAdresse, 'Die fertige Kachel trug ihre Blob-Adresse');
  b.gleich(abgebrochen.spaet.adresse, false, 'Das Abräumen gibt sie frei');

  b.abschnitt('Offline bei Zoom 18 ist der Hintergrund sichtbar');
  /* Die Ebene fragt bis Stufe 18, der Vorrat reicht nach Vorgabe bis 17 –
     am Bauort war die mitgenommene Karte beim Heranzoomen auf eine Muffe
     weg. Gelegt wird nur Stufe 17, und zwar genau die Eltern der Kacheln,
     die bei Stufe 18 im Bild stehen; danach geht das Netz aus. */
  await seite.auswerten('return (await import("./js/kacheln.js")).leeren();');
  await seite.auswerten(`window.fbp.karte.setView([51.803, 10.60], 18, { animate: false }); return true;`);
  await new Promise(f => setTimeout(f, 800));
  const gelegt = await seite.auswerten(`
    const k = await import('./js/kacheln.js');
    const basis = window.fbp.karte._fbpBasis;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c8d8e8'; ctx.fillRect(0, 0, 256, 256);
    const blob = await new Promise(f => c.toBlob(f, 'image/png'));
    const eltern = new Set();
    for (const t of Object.values(basis._tiles || {})) {
      if (t.coords.z !== 18) continue;
      eltern.add(k.kacheladresse(basis._url, { z: 17, x: t.coords.x >> 1, y: t.coords.y >> 1 }));
    }
    const db = await new Promise((f, r) => {
      const a = indexedDB.open('fbp.kacheln', 1);
      a.onsuccess = () => f(a.result); a.onerror = () => r(a.error);
    });
    await new Promise((f, r) => {
      const v = db.transaction('kacheln', 'readwrite');
      for (const url of eltern) {
        v.objectStore('kacheln').put({ url, blob, karte: 'topplus', zeit: Date.now(), groesse: blob.size });
      }
      v.oncomplete = f; v.onerror = () => r(v.error);
    });
    return eltern.size;`);
  b.pruefe(gelegt > 0, `Stufe 17 liegt im Vorrat (${gelegt} Kacheln), Stufe 18 nicht`);
  await seite.auswerten('return (await import("./js/ui.js")).hinweisAus();');
  await seite.warteAuf('document.getElementById("hinweisbox").hidden', 5000);
  await seite.zwischenspeicherLeeren();
  server.netzAus();
  await seite.ohneNetz();
  await seite.auswerten('window.fbp.karte._fbpBasis.redraw(); return true;');
  await seite.warteAuf(`
    const bilder = [...document.querySelectorAll('#karte img.leaflet-tile')];
    return bilder.length > 0 && bilder.every(i => i.src.startsWith('blob:') && i.complete);`, 15000)
    .catch(() => {});
  const zoom18 = await seite.auswerten(`
    const k = window.fbp.karte;
    const bilder = [...document.querySelectorAll('#karte img.leaflet-tile')];
    const sichtbar = bilder.filter(i => i.src.startsWith('blob:') && i.complete && i.naturalWidth === 256);
    /* Das Bild muss die Farbe der gröberen Kachel tragen, nicht nur geladen
       sein: ein leeres Bild aus einer toten Adresse wäre auch „complete“. */
    let farbe = '';
    if (sichtbar[0]) {
      const c = document.createElement('canvas'); c.width = c.height = 1;
      c.getContext('2d').drawImage(sichtbar[0], 128, 128, 1, 1, 0, 0, 1, 1);
      farbe = [...c.getContext('2d').getImageData(0, 0, 1, 1).data].slice(0, 3).join(',');
    }
    return { zoom: k.getZoom(), bilder: bilder.length, sichtbar: sichtbar.length, farbe,
             leiste: document.getElementById('sl-netz').hidden ? '' : document.getElementById('sl-netz').textContent };`);
  b.gleich(zoom18.zoom, 18, 'Die Karte steht auf Stufe 18');
  b.pruefe(zoom18.bilder > 0 && zoom18.sichtbar === zoom18.bilder,
    `Jede Kachel zeigt den Ausschnitt der gröberen Stufe (${zoom18.sichtbar} von ${zoom18.bilder})`);
  b.gleich(zoom18.farbe, '200,216,232', 'Und zwar mit ihrem Bild, nicht als leere Fläche');
  b.pruefe(/kein Netz/.test(zoom18.leiste) && /feiner nicht mitgenommen/.test(zoom18.leiste),
    `Die Statusleiste sagt still, dass es feiner nicht mitgenommen ist („${zoom18.leiste}“)`);
  b.pruefe(await seite.auswerten('document.getElementById("hinweisbox").hidden'),
    'Ohne Hinweispille – die gröbere Stufe ist ein Zustand, keine Meldung');
  server.netzAn();
  await seite.mitNetz();
  await seite.auswerten(`window.fbp.karte.setView([51.803, 10.60], 15, { animate: false }); return true;`);

  b.abschnitt('Der Vorrat lässt sich löschen');
  const geleert = await seite.auswerten(`
    const k = await import('./js/kacheln.js');
    await k.leeren();
    const stand = await k.bestand();
    return stand.anzahl;`);
  b.gleich(geleert, 0, 'Danach ist er leer');

  b.abschnitt('Die Oberfläche nennt Umfang und Bestand');
  await seite.klick('#btn-modus');
  await seite.ruhe();
  const text = (await seite.text('.bau-vorrat') || '').replace(/\s+/g, ' ');
  b.pruefe(/Kacheln/.test(text), 'Der Umfang steht da');
  b.pruefe(/Noch nichts im Gerät/.test(text), 'Und der leere Bestand');
  b.pruefe(/Nutzungsbedingungen/.test(text),
    'Die Schranke der Kartenanbieter steht im Klartext daneben');
  b.pruefe(/schmalen Band/.test(text),
    'Und was der Kartenanbieter beim Mitnehmen sieht');

  b.abschnitt('Eine Karte ohne Erlaubnis wird nicht vorgeladen');
  /* OpenStreetMap untersagt das Vorabladen in seiner Tile Usage Policy. Ein
     Werkzeug, das es trotzdem täte, brächte am Ende alle Nutzer um die Karte –
     deshalb hängt das Mitnehmen am Kennzeichen `vorrat` der Basiskarte. */
  const gesperrt = await seite.auswerten(`
    const m = await import('./js/map.js');
    const ohne = m.BASISKARTEN.filter(k => !k.vorrat).map(k => k.id);
    const mit = m.BASISKARTEN.filter(k => k.vorrat).map(k => k.id);
    return { ohne, mit };`);
  b.pruefe(gesperrt.ohne.includes('osm') && gesperrt.ohne.includes('topo'),
    'OpenStreetMap und OpenTopoMap tragen kein Vorrats-Kennzeichen');
  b.pruefe(gesperrt.mit.includes('topplus') && gesperrt.mit.includes('basemapde'),
    'Die Karten des BKG tragen es');
  b.pruefe(!gesperrt.mit.some(id => ['osm', 'osm_hot', 'topo', 'luftbild', 'esri_topo', 'dop'].includes(id)),
    'Keine fremde Quelle hat sich hineingeschlichen');

  b.abschnitt('Der Bestand meldet, für welche Karte er gilt');
  const gemeldet = await seite.auswerten(`
    const k = await import('./js/kacheln.js');
    const url = 'https://sgx.geodatenzentrum.de/x/1/2/3.png';
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const db = await new Promise((f, r) => {
      const a = indexedDB.open('fbp.kacheln', 1);
      a.onupgradeneeded = () => {
        if (!a.result.objectStoreNames.contains('kacheln')) {
          a.result.createObjectStore('kacheln', { keyPath: 'url' });
        }
      };
      a.onsuccess = () => f(a.result); a.onerror = () => r(a.error);
    });
    await new Promise((f, r) => {
      const v = db.transaction('kacheln', 'readwrite');
      v.objectStore('kacheln').put({ url, blob, karte: 'osm', zeit: Date.now(), groesse: 4 });
      v.oncomplete = f; v.onerror = () => r(v.error);
    });
    const stand = await k.bestand();
    return stand.karten;`);
  b.gleich(gemeldet, ['osm'], 'Der Bestand kennt die Karte, zu der er gehört');
  /* Die eingestellte Karte ist TopPlusOpen, im Vorrat liegt OpenStreetMap –
     die Oberfläche muss das melden, sonst steht der Trupp am Bauort vor einer
     grauen Fläche, während hier ein stattlicher Bestand ausgewiesen wird. */
  await seite.auswerten('return (await import("./js/ui.js")).zeichneBauListe();');
  await seite.warteAuf('/nicht dabei/.test(document.querySelector(".vorrat-stand").textContent)', 5000);
  b.pruefe(true, 'Die Oberfläche warnt, wenn der Vorrat zur eingestellten Karte nicht passt');
  await seite.auswerten('return (await import("./js/kacheln.js")).leeren();');

  b.abschnitt('Der Kartenchip misst die Trasse, nicht den Bestand');
  /* Der Chip sagte „Karte dabei ✓“, sobald irgendeine Kachel im Gerät lag –
     eine einzige weit abseits, oder 10 von 300 nach einem abgebrochenen Lauf –,
     und am Bauort blieb die Karte grau. Gelegt wird hier unmittelbar in die
     Datenbank, an `kacheln.js` vorbei; dessen Zwischenspeicher der Abdeckung
     erfährt davon nur über `visibilitychange`, so wie von einem zweiten
     Fenster der Anwendung. Ohne dieses Ereignis prüfte der Abschnitt den
     Zwischenspeicher statt der Messung. */
  const legeKacheln = async welche => seite.auswerten(`
    const k = await import('./js/kacheln.js');
    const m = await import('./js/map.js');
    const basis = m.basiskarteById(window.fbp.store.projekt.ansicht.basemap);
    const s = window.fbp.store.projekt.strecken[0];
    const liste = ${welche === 'fern'
      ? '[{ z: 17, x: 1000, y: 1000 }]'
      : `k.kachellisteLinien([s.punkte]).slice(${welche === 'halb' ? '10' : '0'})`};
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    const db = await new Promise((f, r) => {
      const a = indexedDB.open('fbp.kacheln', 1);
      a.onsuccess = () => f(a.result); a.onerror = () => r(a.error);
    });
    await new Promise((f, r) => {
      const v = db.transaction('kacheln', 'readwrite');
      for (const kachel of liste) {
        v.objectStore('kacheln').put({ url: k.kacheladresse(basis.url, kachel), blob,
          karte: basis.id, zeit: Date.now(), groesse: 4 });
      }
      v.oncomplete = f; v.onerror = () => r(v.error);
    });
    document.dispatchEvent(new Event('visibilitychange'));
    (await import('./js/ui.js')).zeichneBauListe();
    return k.kachellisteLinien([s.punkte]).length;`);
  /* Vor dem ersten Punkt nennt der Chip den Baunachweis mit („Karte
     mitnehmen + Baunachweis“) – gemessen wird hier nur, was er zur Karte sagt. */
  const chip = () => seite.auswerten(
    'document.querySelector(".vorrat-chip").textContent.replace(/ \\+ Baunachweis/, "")');
  /* Chip und Bestandszeile schreiben jeder für sich, sobald ihre Abfrage
     zurück ist – gewartet wird deshalb auf jede einzeln. */
  const bald = ausdruck => seite.warteAuf(ausdruck, 5000).then(() => true, () => false);
  const gesamt = await legeKacheln('fern');
  await seite.warteAuf('(await import("./js/kacheln.js")).bestand().then(b => b.anzahl === 1)');
  await seite.ruhe();
  b.gleich(await chip(), 'Karte mitnehmen',
    'Eine einzige Kachel weit abseits macht keine „Karte dabei“');
  b.pruefe(await seite.auswerten('document.querySelector(".vorrat-chip").classList.contains("vorrat-leer")'),
    'Der Chip steht im Mahnton');
  await legeKacheln('halb');
  await seite.warteAuf(`/unvollständig/.test(document.querySelector(".vorrat-chip").textContent)`, 5000);
  b.gleich(await chip(), `Karte unvollständig ${gesamt - 10}/${gesamt}`,
    'Eine halbe Karte nennt ihre Zahl');
  b.pruefe(await bald('/fehlen 10 von/.test(document.querySelector(".vorrat-stand").textContent)'),
    'Der Bestand im Block nennt, was der Trasse fehlt');
  await legeKacheln('alle');
  await seite.warteAuf(`/dabei ✓/.test(document.querySelector(".vorrat-chip").textContent)`, 5000);
  b.gleich(await chip(), 'Karte dabei ✓', 'Erst die vollständige Trasse heißt „Karte dabei ✓“');
  b.pruefe(await bald('/vollständig/.test(document.querySelector(".vorrat-stand").textContent)'),
    'Und der Bestand sagt dasselbe');

  b.abschnitt('„Vorrat löschen“ fragt nach und sagt, dass es alle Karten sind');
  /* Ein Tipp leerte den ganzen Speicher, 16 px neben „Karte holen“, ohne
     Rückfrage – und „Rückgängig“ holt Kacheln nicht zurück. */
  const loeschKnopf = `[...document.querySelectorAll('.bau-vorrat button')]
    .find(k => k.textContent.includes('Vorrat löschen'))`;
  b.pruefe(await bald(`!!${loeschKnopf} && !${loeschKnopf}.hidden`),
    'Mit Vorrat steht der Knopf da');
  b.pruefe(await seite.auswerten(`!${loeschKnopf}.closest('.bau-tasten')`),
    'Er steht nicht in der Reihe von „Karte holen“');
  await seite.auswerten(`${loeschKnopf}.click(); return true;`);
  await seite.warteAuf('!document.getElementById("dialog").hidden', 5000);
  const frage = (await seite.text('#dialog-inhalt') || '').replace(/\s+/g, ' ');
  b.pruefe(/\d+ Kacheln/.test(frage), `Die Rückfrage nennt die Zahl („${frage.slice(0, 60)}…“)`);
  b.pruefe(/alle/.test(frage) && /anderer Strecken/.test(frage),
    'Und dass alle Karten im Gerät gehen, nicht nur die dieser Strecke');
  b.pruefe(/Ohne Netz ist kein Ersatz/.test(frage), 'Und dass ohne Netz kein Ersatz zu holen ist');
  b.gleich(await seite.auswerten('document.activeElement && document.activeElement.textContent'),
    'Behalten', 'Der Fokus liegt auf „Behalten“, nicht auf dem Löschen');
  await seite.auswerten(`[...document.querySelectorAll('#dialog-fuss button')]
    .find(k => k.textContent === 'Behalten').click(); return true;`);
  await seite.ruhe();
  b.gleich(await seite.auswerten('(await import("./js/kacheln.js")).bestand().then(b => b.anzahl)'),
    gesamt + 1, '„Behalten“ lässt den Vorrat stehen');
  await seite.auswerten(`${loeschKnopf}.click(); return true;`);
  await seite.warteAuf('!document.getElementById("dialog").hidden', 5000);
  await seite.auswerten(`[...document.querySelectorAll('#dialog-fuss button')]
    .find(k => k.textContent === 'Alle löschen').click(); return true;`);
  await seite.warteAuf('(await import("./js/kacheln.js")).bestand().then(b => b.anzahl === 0)', 5000);
  await seite.warteAuf(`/Karte mitnehmen/.test(document.querySelector(".vorrat-chip").textContent)`, 5000);
  b.pruefe(true, '„Alle löschen“ leert ihn, und der Chip sagt es sofort');
  b.pruefe(await bald(`!${loeschKnopf} || ${loeschKnopf}.hidden`),
    'Bei leerem Vorrat fehlt der Knopf');

  b.abschnitt('„Abbrechen“ fängt den zweiten Tipp auf „Karte holen“ nicht ab');
  /* „Karte holen“ wurde an derselben Stelle zu „Abbrechen“, und ein Doppeltipp
     mit Handschuh brach den Abruf ab, kaum dass er lief. Geholt wird von
     diesem Server, wie unten bei „ohne Netz“; die Feinheit 18 macht den Lauf
     lang genug, dass er die Sperre überdauert. */
  const abbruch = await seite.auswerten(`
    const m = await import('./js/map.js');
    const basis = m.BASISKARTEN.find(k => k.id === window.fbp.store.projekt.ansicht.basemap);
    const echt = basis.url;
    basis.url = location.origin + '/gibt-es-nicht/{z}/{x}/{y}.png';
    const warte = n => new Promise(f => setTimeout(f, n));
    const knoepfe = () => [...document.querySelectorAll('.bau-vorrat .bau-tasten button')];
    try {
      (await import('./js/ui.js')).zeichneBauListe();
      const fein = [...document.querySelectorAll('.bau-vorrat select')]
        .find(x => [...x.options].some(o => o.value === '18'));
      fein.value = '18'; fein.dispatchEvent(new Event('change'));
      const [holen] = knoepfe();
      const vorher = holen.getBoundingClientRect();
      holen.click();
      const [h2, ab] = knoepfe();
      const r = {
        holenGesperrt: h2.disabled, abbrechenDa: !ab.hidden, abbrechenGesperrt: ab.disabled,
        eigenerKnopf: ab !== h2
      };
      /* Der zweite Tipp eines Doppeltipps: auf die Stelle, an der „Karte
         holen“ eben noch stand, und auf „Abbrechen“ selbst. */
      document.elementFromPoint(vorher.right - 4, vorher.top + vorher.height / 2)?.click();
      ab.click();
      await warte(300);
      r.laeuftNachDoppeltipp = knoepfe()[0].disabled;
      await warte(900);
      r.abbrechenFrei = !knoepfe()[1].disabled;
      knoepfe()[1].click();
      const box = document.getElementById('hinweisbox');
      const ende = Date.now() + 10000;
      while (Date.now() < ende && !/Abgebrochen/.test(box.textContent || '')) await warte(100);
      r.meldung = box.textContent || '';
      r.danach = knoepfe()[0].textContent;
      return r;
    } finally {
      basis.url = echt;
    }`);
  b.pruefe(abbruch.eigenerKnopf && abbruch.abbrechenDa, 'Abbrechen ist ein eigener Knopf');
  b.pruefe(abbruch.holenGesperrt, '„Karte holen“ nimmt während des Abrufs keinen Tipp an');
  b.pruefe(abbruch.abbrechenGesperrt, '„Abbrechen“ ist in der ersten Sekunde gesperrt');
  b.pruefe(abbruch.laeuftNachDoppeltipp, 'Ein Doppeltipp bricht den Abruf nicht ab');
  b.pruefe(abbruch.abbrechenFrei, 'Nach der Sperre lässt er sich abbrechen');
  b.pruefe(/Abgebrochen/.test(abbruch.meldung), `Und meldet es („${abbruch.meldung.slice(0, 50)}“)`);
  b.gleich(abbruch.danach, '↓ Karte holen', 'Danach steht wieder „Karte holen“ da');
  await seite.auswerten('return (await import("./js/kacheln.js")).leeren();');

  b.abschnitt('Ein halber Abruf heißt „unvollständig“, und die Statusleiste zählt nach');
  /* „Karte mitgenommen: 60 von 222 Kacheln … 162 fehlen“ las sich als
     Erfolg. Und die Statusleiste zählte den Vorrat nur, wenn eine Kachel
     ausblieb – nach „Karte holen“ stand dort weiter „Vorrat leer“. Jede
     zweite Kachel kommt hier an, die übrigen nicht; `fetch` wird dafür in der
     Seite ersetzt, damit der Fall nicht an einem fremden Server hängt. */
  const halb = await seite.auswerten(`
    const ui = await import('./js/ui.js');
    const warte = n => new Promise(f => setTimeout(f, n));
    const echt = window.fetch;
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const blob = await new Promise(f => c.toBlob(f, 'image/png'));
    let n = 0;
    window.fetch = async (url, o) => (n++ % 2 ? new Response(blob) : new Response('', { status: 404 }));
    /* Die Leiste zeigen, als schwiege der Kartenserver: das Netz ist da. */
    window.fbp.karte.fire('fbp:kachelnot', { aus: true });
    await warte(400);
    const r = { leisteVorher: document.getElementById('sl-netz').textContent, zeileImLauf: '' };
    try {
      ui.zeichneBauListe();
      const knopf = [...document.querySelectorAll('.bau-vorrat button')]
        .find(k => k.textContent.includes('Karte holen'));
      knopf.click();
      const box = document.getElementById('hinweisbox');
      const ende = Date.now() + 30000;
      while (Date.now() < ende) {
        const zeile = document.querySelector('.bau-vorrat .vorrat-stand')?.textContent || '';
        if (/Wird geholt/.test(zeile)) r.zeileImLauf = zeile;
        if (/unvollständig|mitgenommen|Abgebrochen/.test(box.textContent || '')) break;
        await warte(50);
      }
      r.meldung = box.textContent || '';
      const bis = Date.now() + 5000;
      while (Date.now() < bis && !/Vorrat: \\d/.test(document.getElementById('sl-netz').textContent)) await warte(100);
      r.leisteNachher = document.getElementById('sl-netz').textContent;
    } finally {
      window.fetch = echt;
      /* Zurück auf „nichts gemeldet“, auch in der Kachelwacht: sonst hielte
         sie den Ausfall für schon bekannt und meldete den nächsten nicht. */
      window.fbp.karte._fbpKachelAus = undefined;
      window.fbp.karte.fire('fbp:kachelnot', { aus: false });
    }
    return r;`);
  b.pruefe(/^Karte unvollständig: \d+ von \d+ – noch einmal holen, solange Netz da ist/.test(halb.meldung),
    `Die Meldung beginnt mit „unvollständig“ („${halb.meldung}“)`);
  b.pruefe(/Wird geholt: \d+ von \d+ Kacheln/.test(halb.zeileImLauf),
    `Die Bestandszeile führt den Abruf mit, auch wenn die Pille sie deckt („${halb.zeileImLauf}“)`);
  b.pruefe(/Vorrat leer/.test(halb.leisteVorher), `Vorher: „${halb.leisteVorher}“`);
  b.pruefe(/Vorrat: \d+ Kacheln/.test(halb.leisteNachher),
    `Nach „Karte holen“ zählt die Statusleiste neu („${halb.leisteNachher}“)`);
  await seite.auswerten('return (await import("./js/kacheln.js")).leeren();');

  b.abschnitt('Ein hängender Abruf hat eine Frist und sagt, dass nichts kommt');
  /* Ohne Frist stand ein Abruf an schwachem Netz still, unter einem Balken,
     der sich nicht rührte. Jetzt endet jede Kachel nach zehn Sekunden, und
     nach zehn Sekunden ohne neue Kachel steht es in Pille und Zeile. Der
     ersetzte `fetch` antwortet nie – er hört nur auf den Abbruch. */
  const haengt = await seite.auswerten(`
    const ui = await import('./js/ui.js');
    const k = await import('./js/kacheln.js');
    const warte = n => new Promise(f => setTimeout(f, n));
    const echt = window.fetch;
    let abgebrochen = 0;
    window.fetch = (url, o) => new Promise((f, r) => {
      o.signal.addEventListener('abort', () => { abgebrochen++; r(new DOMException('Frist', 'AbortError')); });
    });
    const r = {};
    try {
      ui.zeichneBauListe();
      const knoepfe = () => [...document.querySelectorAll('.bau-vorrat .bau-tasten button')];
      knoepfe()[0].click();
      const box = document.getElementById('hinweisbox');
      await warte(8000);
      r.vorDerFrist = { abgebrochen, pille: box.textContent };
      const ende = Date.now() + 6000;
      while (Date.now() < ende && !/kommt nichts/.test(box.textContent || '')) await warte(100);
      r.pille = box.textContent || '';
      r.zeile = document.querySelector('.bau-vorrat .vorrat-stand')?.textContent || '';
      /* Die Frist läuft je Kachel erst ab dem Abruf, die Uhr des Hinweises
         ab dem Knopfdruck – die Abbrüche folgen also knapp danach. */
      const frist = Date.now() + 3000;
      while (Date.now() < frist && abgebrochen < 4) await warte(100);
      r.abgebrochen = abgebrochen;
      knoepfe()[1].click();
      const schluss = Date.now() + 5000;
      while (Date.now() < schluss && !/Abgebrochen/.test(box.textContent || '')) await warte(100);
      r.schluss = box.textContent || '';
      r.frist = k.FRIST;
    } finally {
      window.fetch = echt;
    }
    return r;`);
  b.gleich(haengt.frist, 10000, 'Jede Kachel hat zehn Sekunden');
  b.gleich(haengt.vorDerFrist.abgebrochen, 0, 'Vorher wird keine abgebrochen');
  b.pruefe(haengt.abgebrochen >= 4, `Danach geben die vier Abrufe auf (${haengt.abgebrochen})`);
  b.pruefe(/^Seit \d+\s?s kommt nichts – Netz schwach\. Abbrechen oder warten\./.test(haengt.pille),
    `Die Pille sagt, dass nichts kommt („${haengt.pille}“)`);
  b.pruefe(/kommt nichts/.test(haengt.zeile), `Und die Bestandszeile ebenso („${haengt.zeile}“)`);
  b.pruefe(/Abgebrochen/.test(haengt.schluss), 'Abbrechen beendet den Lauf');
  await seite.auswerten('return (await import("./js/kacheln.js")).leeren();');

  b.abschnitt('Schweigt nur der Kartenserver, sagt die Statusleiste nicht „kein Netz“');
  /* Der Browser gilt weiter als online – geprüft wird gerade der Fall, in dem
     `navigator.onLine` nichts merkt und nur die Kacheln ausbleiben: schwaches
     Netz, Funkloch, gesperrter Anbieter. Der Server schweigt dazu. */
  server.netzAus();
  /* Der Befund, um den es geht: die Karte blieb grau und die Anwendung sagte
     nichts dazu – der Ausfall ging an Leaflet und endete dort. Im Prüfstand
     kommen die Kacheln ohnehin nie an (sie liegen bei einem fremden Server),
     die Anzeige muss also von selbst stehen. Angestoßen wird sie durch ein
     Neuzeichnen, damit der Fall nicht daran hängt, wie viele Kacheln der
     Aufbau zufällig schon versucht hat. */
  /* Die Pille eines früheren Schrittes vorher abräumen: geprüft wird, dass der
     Kachelausfall selbst keine erzeugt, nicht der Nachhall von „Vorrat
     gelöscht“. */
  await seite.auswerten('return (await import("./js/ui.js")).hinweisAus();');
  await seite.warteAuf('document.getElementById("hinweisbox").hidden', 5000);
  await seite.auswerten('window.fbp.karte._fbpBasis.redraw(); return true;');
  await seite.warteAuf('!document.getElementById("sl-netz").hidden', 15000);
  const netzText = (await seite.text('#sl-netz') || '');
  /* Der Browser hat Netz, nur die Kacheln kommen nicht. „kein Netz“ stand
     hier früher auch – und wer dabei Balken auf dem Telefon sieht, glaubt der
     Anzeige danach nichts mehr. */
  b.pruefe(/Karte nicht erreichbar/.test(netzText), `Die Leiste nennt den Ausfall („${netzText}“)`);
  b.pruefe(!/kein Netz/.test(netzText), 'Und behauptet nicht, das Netz sei weg');
  b.pruefe(/Vorrat/.test(netzText),
    'Und den Vorrat – das ist die Zahl, die am Bauort darüber entscheidet, ' +
    'ob die Karte trotzdem etwas zeigt');
  b.pruefe(await seite.auswerten('document.getElementById("hinweisbox").hidden'),
    'Ohne Hinweispille: der Zustand dauert die ganze Baustelle, die Pille 3,2 s');

  b.abschnitt('„Karte holen“ ohne Netz meldet, dass nichts mitgenommen wurde');
  /* Der Abruf lief bis zum vollen Balken durch und meldete „Karte
     mitgenommen: 0 Kacheln“ – im Vorbeigehen liest man das erste Wort und
     rückt ein zweites Mal ohne Karte aus.

     Geholt wird für die Prüfung von diesem Server, nicht vom BKG: `netzAus()`
     weist seine Verbindungen sofort ab, und damit ist der Fall in Sekunden
     entschieden statt in den Zeitüberschreitungen eines fremden Servers. Die
     Adresse wird danach zurückgesetzt. */
  const holText = await seite.auswerten(`
    const m = await import('./js/map.js');
    const ui = await import('./js/ui.js');
    const basis = m.BASISKARTEN.find(k => k.id === window.fbp.store.projekt.ansicht.basemap);
    const echt = basis.url;
    basis.url = location.origin + '/gibt-es-nicht/{z}/{x}/{y}.png';
    try {
      ui.zeichneBauListe();
      const knopf = [...document.querySelectorAll('.bau-vorrat button')]
        .find(k => k.textContent.includes('Karte holen'));
      if (!knopf) throw new Error('Kein Knopf „Karte holen“ im Bau-Reiter');
      knopf.click();
      const box = document.getElementById('hinweisbox');
      const ende = Date.now() + 45000;
      while (Date.now() < ende) {
        const t = box.textContent || '';
        if (!box.hidden && /mitgenommen|voll|Abgebrochen/.test(t)) return t;
        await new Promise(f => setTimeout(f, 200));
      }
      return 'keine Schlussmeldung';
    } finally {
      basis.url = echt;
    }`);
  b.pruefe(/nicht/.test(holText), `Die Schlussmeldung sagt „nicht“ („${holText}“)`);
  b.pruefe(/nicht mitgenommen/.test(holText),
    'Und zwar in den ersten beiden Wörtern, nicht als Null hinter einem „mitgenommen“');
  b.pruefe(!/^Karte mitgenommen/.test(holText),
    'Keine Erfolgsmeldung für einen Lauf, aus dem nichts geworden ist');
  server.netzAn();

  // ------------------------------------------------------------ Konsole

  b.abschnitt('Die Konsole bleibt still');
  /* Der Ausfall des Netzes erzeugt Meldungen, die keine Fehler der Anwendung
     sind: der Zählimpuls und die Kartenkacheln kommen nicht durch. Sie werden
     ausgenommen, alles andere nicht. */
  const fremd = /goatcounter|gc\.zgo\.at|geodatenzentrum|tile\.|arcgisonline|ERR_INTERNET_DISCONNECTED|Failed to load resource/i;
  const fehler = seite.fehlermeldungen().filter(f => !fremd.test(f.text));
  b.pruefe(fehler.length === 0,
    fehler.length ? `Fehler in der Konsole: ${fehler.map(f => f.text).join(' | ')}`
                  : 'Kein Fehler, der die Anwendung beträfe');
} catch (e) {
  /* Ein abgebrochener Lauf ist ein durchgefallener: ohne diese Zeile stünde
     am Ende „Prüfung bestanden“, obwohl die Hälfte nie gelaufen ist. */
  b.pruefe(false, 'Lauf abgebrochen: ' + e.message);
  console.error('\nLauf abgebrochen:', e.message);
  await seite.bildschirmfoto(join(WURZEL, 'pruefung-abbruch.png')).catch(() => {});
  process.exitCode = 1;
} finally {
  b.abschluss();
  await browser.beenden();
  await server.schliessen();
}
