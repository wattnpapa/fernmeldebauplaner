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
