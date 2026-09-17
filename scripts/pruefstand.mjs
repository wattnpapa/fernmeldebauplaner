// pruefstand.mjs – Die Anwendung im echten Browser fernsteuern, ohne Fremdcode

/* Diese Anwendung hat keine Testsuite und soll keine Abhängigkeiten bekommen –
   damit fällt jedes übliche Prüfwerkzeug aus: Playwright, Puppeteer und
   Selenium bringen alle einen Paketbaum mit, und `package.json` gibt es hier
   bewusst nicht.

   Der Ausweg liegt seit Node 22 im Bestand: `WebSocket` ist eingebaut, und
   jeder Chromium spricht über einen WebSocket das DevTools-Protokoll. Mehr
   braucht es nicht. Was hier steht, ist deshalb kein nachgebautes Playwright,
   sondern die zwei Handvoll Befehle, die zum Durchspielen der Oberfläche
   reichen: laden, tippen, schreiben, ablesen, neu laden.

   Dazu kommt ein eigener Webserver aus `node:http`. Wegen der ES-Module reicht
   `file://` nicht – derselbe Grund, aus dem in der Anleitung
   `python3 -m http.server` steht.

   Zwei Dinge, die der Prüfstand mehr kann als ein Mensch am Schreibtisch und
   die für diese Anwendung zählen: er setzt den Gerätestandort auf eine feste
   Koordinate (sonst wäre „Punkt hier“ nicht prüfbar, und im Rechenzentrum gibt
   es keinen Standort), und er schaltet auf Schmalansicht mit Berührung um, ohne
   dass jemand ein Tablet in die Hand nimmt.

   Der Browser kommt aus `CHROMIUM` oder aus einem der bekannten Pfade. Fehlt
   er, bricht der Lauf mit einer Meldung ab, die sagt, was zu tun ist – nicht
   mit einem Stapelabzug. */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, normalize } from 'node:path';

// ---------------------------------------------------------------- Webserver

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8'
};

/**
 * Statischer Server über dem Projektbaum. Liefert den Port, auf dem er hört.
 *
 * `netzAus()` weist eingehende Verbindungen ab, statt sie zu beantworten. Das
 * ist der einzige Weg, „kein Netz“ EHRLICH zu prüfen: die Abschaltung über das
 * DevTools-Protokoll (`seite.ohneNetz()`) gilt nur für das Ziel, auf dem sie
 * gesetzt wird – der Service Worker ist ein eigenes Ziel und behält sein Netz.
 * Eine Prüfung, die sich darauf verlässt, bestätigt auch einen Wächter, der
 * gar nichts aus dem Speicher liefert. Beides zusammen ergibt erst das Bild:
 * der Server schweigt, und die Seite weiß, dass sie offline ist.
 */
export async function starteServer(wurzel, port = 0) {
  let netz = true;
  const server = createServer(async (anfrage, antwort) => {
    if (!netz) { anfrage.socket.destroy(); return; }
    /* Der Pfad wird normalisiert, bevor er an die Platte geht: ein `..` in der
       Adresse dürfte sonst aus dem Projektbaum heraus lesen. Der Prüfstand
       läuft nur lokal, aber ein Server, der das nicht tut, wandert irgendwann
       woandershin. */
    const roh = decodeURIComponent((anfrage.url || '/').split('?')[0]);
    const rein = normalize(roh).replace(/^(\.\.[/\\])+/, '');
    const pfad = join(wurzel, rein.endsWith('/') ? rein + 'index.html' : rein);
    if (!pfad.startsWith(wurzel)) { antwort.writeHead(403).end(); return; }
    try {
      const daten = await readFile(pfad);
      antwort.writeHead(200, {
        'Content-Type': TYPEN[extname(pfad).toLowerCase()] || 'application/octet-stream',
        /* Ohne das liest der Browser beim Neuladen aus seinem Zwischenspeicher
           und die eben geänderte Datei wird nicht geprüft. */
        'Cache-Control': 'no-store'
      });
      antwort.end(daten);
    } catch {
      antwort.writeHead(404, { 'Content-Type': 'text/plain' }).end('nicht gefunden');
    }
  });
  /* Auch die Verbindung selbst wird abgewiesen und nicht erst die Anfrage:
     ein Browser, der eine offene Verbindung vorfindet und dann nichts hört,
     wartet – ein abgewiesener Verbindungsversuch schlägt sofort fehl, so wie
     am Bauort. */
  server.on('connection', verbindung => { if (!netz) verbindung.destroy(); });
  await new Promise(fertig => server.listen(port, '127.0.0.1', fertig));
  return {
    port: server.address().port,
    netzAus: () => { netz = false; },
    netzAn: () => { netz = true; },
    schliessen: () => new Promise(f => server.close(f))
  };
}

// ---------------------------------------------------------------- Browser

const BROWSERPFADE = [
  process.env.CHROMIUM,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

function browserPfad() {
  const treffer = BROWSERPFADE.find(p => existsSync(p));
  if (treffer) return treffer;
  /* Der Prüfstand fällt aus, wenn kein Browser da ist – und nur dann. Die
     Meldung nennt den Ausweg, weil dieser Lauf auch auf einem Rechner startet,
     der noch nie eine Prüfung gesehen hat. */
  throw new Error(
    'Kein Chromium gefunden. Pfad über die Umgebungsvariable CHROMIUM setzen, ' +
    'etwa: CHROMIUM=/usr/bin/chromium node scripts/baumodus-pruefen.mjs'
  );
}

/** Startet den Browser und öffnet die Verbindung zum DevTools-Protokoll. */
export async function starteBrowser({ sichtbar = false } = {}) {
  const profil = await mkdtemp(join(tmpdir(), 'fmbp-pruefung-'));
  const lauf = spawn(browserPfad(), [
    sichtbar ? '--no-headless' : '--headless=new',
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    /* Port 0 heißt: der Browser sucht sich einen freien und nennt ihn auf
       stderr. Eine feste Nummer stieße mit einem zweiten Lauf zusammen, und
       zwei Prüfungen nebeneinander sind der Normalfall. */
    '--remote-debugging-port=0',
    /* Ein eigenes Profil je Lauf: sonst erbt die Prüfung den localStorage des
       vorigen, und schon der erste Fall liefe auf einer Planung, die er nicht
       angelegt hat. */
    `--user-data-dir=${profil}`,
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const adresse = await new Promise((fertig, fehler) => {
    const frist = setTimeout(() => fehler(new Error('Browser meldet sich nicht')), 20000);
    let puffer = '';
    lauf.stderr.on('data', brocken => {
      puffer += brocken.toString();
      const treffer = /ws:\/\/[^\s]+/.exec(puffer);
      if (treffer) { clearTimeout(frist); fertig(treffer[0]); }
    });
    lauf.on('exit', kode => { clearTimeout(frist); fehler(new Error(`Browser beendet (${kode})`)); });
  });

  const draht = new WebSocket(adresse);
  await new Promise((fertig, fehler) => { draht.onopen = fertig; draht.onerror = fehler; });

  let zaehler = 0;
  const offen = new Map();
  const horcher = [];
  draht.onmessage = e => {
    const nachricht = JSON.parse(e.data);
    if (nachricht.id && offen.has(nachricht.id)) {
      const { fertig, fehler } = offen.get(nachricht.id);
      offen.delete(nachricht.id);
      nachricht.error ? fehler(new Error(nachricht.error.message)) : fertig(nachricht.result);
    } else if (nachricht.method) {
      for (const h of horcher) h(nachricht);
    }
  };

  const befehl = (methode, werte = {}, sitzung) => new Promise((fertig, fehler) => {
    const nr = ++zaehler;
    offen.set(nr, { fertig, fehler });
    draht.send(JSON.stringify({ id: nr, method: methode, params: werte, sessionId: sitzung }));
  });

  return {
    befehl,
    horchen: h => horcher.push(h),
    async seite() { return neueSeite(befehl, horcher); },
    async beenden() {
      try { draht.close(); } catch { /* schon zu */ }
      lauf.kill();
      await rm(profil, { recursive: true, force: true }).catch(() => {});
    }
  };
}

// ---------------------------------------------------------------- Seite

/* Ein Ausdruck ohne `return` ist gemeint als „liefere mir dies“; einer mit
   `return` ist schon ein Rumpf und bleibt, wie er ist. */
const rumpf = a => a.includes('return') ? a : `return (${a})`;

/* Der Wert eines `Runtime.evaluate` kommt als beschriebenes Objekt zurück.
   Alles, was der Prüfstand braucht, passt durch `returnByValue` – nur muss der
   Ausdruck dann JSON-fähig sein. Ein DOM-Knoten ist es nicht, deshalb wird in
   den Ausdrücken immer schon in der Seite gelesen und nur das Ergebnis geholt. */
async function neueSeite(befehl, horcher) {
  const ziel = await befehl('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await befehl('Target.attachToTarget',
    { targetId: ziel.targetId, flatten: true });

  const meldungen = [];
  horcher.push(nachricht => {
    if (nachricht.sessionId !== sessionId) return;
    if (nachricht.method === 'Runtime.consoleAPICalled') {
      const text = (nachricht.params.args || [])
        .map(a => a.value ?? a.description ?? a.type).join(' ');
      meldungen.push({ art: nachricht.params.type, text });
    }
    if (nachricht.method === 'Runtime.exceptionThrown') {
      const d = nachricht.params.exceptionDetails;
      meldungen.push({ art: 'error', text: d.exception?.description || d.text });
    }
  });

  const an = (methode, werte) => befehl(methode, werte, sessionId);
  await an('Runtime.enable');
  await an('Page.enable');
  await an('DOM.enable');

  /* Die Anwendung fragt vor dem Verlassen nach, sobald eine Planung genug
     Arbeit trägt (`istGehaltvoll` in state.js) – und eine Baudokumentation
     trägt sie von der ersten Zeile an. Im Browser wartet diese Rückfrage auf
     einen Menschen; hier hielte sie den ganzen Lauf an. Sie wird deshalb
     bestätigt, und zwar hier und nicht im Prüffall: sie kann an jeder Stelle
     kommen. */
  const dialoge = [];
  horcher.push(nachricht => {
    if (nachricht.sessionId !== sessionId) return;
    if (nachricht.method !== 'Page.javascriptDialogOpening') return;
    dialoge.push(nachricht.params.message || '');
    an('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  });

  const seite = {
    meldungen,
    /** Rückfragen des Browsers, die der Prüfstand bestätigt hat */
    dialoge,
    /** Fehler und Warnungen, die der Browser gemeldet hat */
    fehlermeldungen: () => meldungen.filter(m => m.art === 'error' || m.art === 'assert'),

    async oeffne(adresse) {
      await an('Page.navigate', { url: adresse });
      await seite.warteAufLaden();
    },

    async warteAufLaden() {
      await seite.warteAuf('document.readyState === "complete"', 20000);
    },

    /* Gewöhnliches Neuladen, kein hartes: ein hartes umgeht den Service Worker
       vollständig – damit wäre gerade das nicht zu prüfen, wofür er da ist.
       Den Zwischenspeicher des Browsers braucht es dafür nicht: der eigene
       Server schickt zu jeder Datei `Cache-Control: no-store`. */
    async neuLaden() {
      await an('Page.reload');
      await seite.warteAufLaden();
    },

    /** Neu laden und dabei den Wächter umgehen – für den Fall, dass wirklich
     *  der Server gefragt werden soll */
    async hartNeuLaden() {
      await an('Page.reload', { ignoreCache: true });
      await seite.warteAufLaden();
    },

    /** Einen Ausdruck in der Seite auswerten und seinen Wert liefern.
     *  Der Rumpf läuft in einer asynchronen Funktion: nur so lässt sich in der
     *  Seite `await import(...)` schreiben, und genau das braucht eine Prüfung,
     *  die ein einzelnes Modul gegen die laufende Anwendung hält. */
    async auswerten(ausdruck) {
      const erg = await an('Runtime.evaluate', {
        expression: `(async () => { ${rumpf(ausdruck)} })()`,
        returnByValue: true, awaitPromise: true
      });
      if (erg.exceptionDetails) {
        throw new Error('In der Seite: ' +
          (erg.exceptionDetails.exception?.description || erg.exceptionDetails.text));
      }
      return erg.result.value;
    },

    /** Wartet, bis der Ausdruck wahr wird – der einzige Weg gegen Wackelprüfungen */
    async warteAuf(ausdruck, frist = 8000) {
      const ende = Date.now() + frist;
      let letzter = null;
      while (Date.now() < ende) {
        try { if (await seite.auswerten(ausdruck)) return true; }
        catch (f) { letzter = f; }
        await new Promise(f => setTimeout(f, 60));
      }
      throw new Error(`Wartete vergebens auf: ${ausdruck}` +
        (letzter ? ` (zuletzt: ${letzter.message})` : ''));
    },

    async sichtbar(wahl) {
      return seite.auswerten(
        `!!document.querySelector(${JSON.stringify(wahl)}) &&
         document.querySelector(${JSON.stringify(wahl)}).offsetParent !== null`);
    },

    async text(wahl) {
      return seite.auswerten(
        `(document.querySelector(${JSON.stringify(wahl)})||{}).textContent ?? null`);
    },

    async anzahl(wahl) {
      return seite.auswerten(`document.querySelectorAll(${JSON.stringify(wahl)}).length`);
    },

    /* Geklickt wird über `click()` in der Seite und nicht über einen echten
       Mauszeiger: die Oberfläche hängt ihre Ereignisse an `click`, und ein
       Zeiger müsste erst gescrollt werden, wo die Seitenleiste ohnehin scrollt.
       Für die Karte gibt es `klickeKarte`, das einen echten Zeiger führt –
       Leaflet hört auf Zeigerereignisse, nicht auf `click`. */
    async klick(wahl) {
      await seite.warteAuf(`!!document.querySelector(${JSON.stringify(wahl)})`);
      const getroffen = await seite.auswerten(
        `const e = document.querySelector(${JSON.stringify(wahl)});
         if (!e) return false; e.click(); return true;`);
      if (!getroffen) throw new Error(`Nicht gefunden: ${wahl}`);
      await seite.ruhe();
    },

    /** Echter Zeigerklick auf einen Punkt der Karte, in Bildpunkten */
    async klickeKarte(x, y) {
      for (const art of ['mousePressed', 'mouseReleased']) {
        await an('Input.dispatchMouseEvent',
          { type: art, x, y, button: 'left', clickCount: 1, buttons: art === 'mousePressed' ? 1 : 0 });
      }
      await seite.ruhe();
    },

    /* Ein Fingertipp, kein Mausklick: in der Schmalansicht mit Berührung wird
       so getippt, wie am Bauort – und was unter dem Finger liegt, entscheidet
       der Browser mit seiner Trefferprüfung, nicht `click()` auf einem Element,
       das die Prüfung sich ausgesucht hat. Nur so fällt auf, wenn eine Leiste
       oder eine Meldung den Tipp abfängt. */
    async tippe(x, y) {
      await an('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await an('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await seite.ruhe();
    },

    /* Der Wert wird gesetzt und beide Ereignisse werden ausgelöst: die
       Oberfläche hört teils auf `input`, teils auf `change`. Wer nur eines
       schickt, prüft die halbe Verdrahtung. */
    async schreibe(wahl, wert) {
      await seite.auswerten(
        `const e = document.querySelector(${JSON.stringify(wahl)});
         if (!e) throw new Error('Feld fehlt: ' + ${JSON.stringify(wahl)});
         const setzer = Object.getOwnPropertyDescriptor(
           e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
           'value').set;
         setzer.call(e, ${JSON.stringify(String(wert))});
         e.dispatchEvent(new Event('input', { bubbles: true }));
         e.dispatchEvent(new Event('change', { bubbles: true }));
         return true;`);
      await seite.ruhe();
    },

    async waehle(wahl, wert) {
      await seite.auswerten(
        `const e = document.querySelector(${JSON.stringify(wahl)});
         if (!e) throw new Error('Auswahl fehlt: ' + ${JSON.stringify(wahl)});
         e.value = ${JSON.stringify(String(wert))};
         e.dispatchEvent(new Event('change', { bubbles: true }));
         return true;`);
      await seite.ruhe();
    },

    async taste(taste) {
      await an('Input.dispatchKeyEvent', { type: 'keyDown', key: taste, windowsVirtualKeyCode: 0 });
      await an('Input.dispatchKeyEvent', { type: 'keyUp', key: taste });
      await seite.ruhe();
    },

    /* Das Netz abschalten, ohne den Server anzuhalten. Nur so ist zu prüfen,
       was am Bauort wirklich geschieht: der Browser kennt die Adresse, kommt
       aber nicht hin. Ein angehaltener Server sähe von außen ähnlich aus,
       ließe aber offen, ob der Browser oder der Server geantwortet hat. */
    async netz(eingeschaltet) {
      await an('Network.enable');
      await an('Network.emulateNetworkConditions', {
        offline: !eingeschaltet, latency: 0, downloadThroughput: -1, uploadThroughput: -1
      });
    },
    ohneNetz() { return seite.netz(false); },
    mitNetz() { return seite.netz(true); },

    /** Wartet, bis ein Service Worker die Seite führt */
    async warteAufWaechter(frist = 15000) {
      await seite.warteAuf('!!navigator.serviceWorker.controller', frist);
    },

    /** Den Dateizwischenspeicher des Browsers leeren – ohne das beantwortet er
     *  auch ohne Netz noch aus eigenem Vorrat, und die Prüfung bewiese nichts */
    async zwischenspeicherLeeren() {
      await an('Network.enable');
      await an('Network.clearBrowserCache');
    },

    /** Den Gerätestandort festsetzen – sonst ist „Punkt hier“ nicht prüfbar */
    async standort(lat, lng, genauigkeit = 8) {
      await befehl('Browser.grantPermissions',
        { permissions: ['geolocation'], origin: await seite.auswerten('location.origin') });
      await an('Emulation.setGeolocationOverride',
        { latitude: lat, longitude: lng, accuracy: genauigkeit });
    },

    async keinStandort() {
      await an('Emulation.setGeolocationOverride', {});
    },

    /** Schmalansicht mit Berührung – die Bedienung am Bauort */
    async schmal(breite = 390, hoehe = 844) {
      await an('Emulation.setDeviceMetricsOverride',
        { width: breite, height: hoehe, deviceScaleFactor: 2, mobile: true });
      await an('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await seite.ruhe();
    },

    async breit(breite = 1440, hoehe = 900) {
      await an('Emulation.setDeviceMetricsOverride',
        { width: breite, height: hoehe, deviceScaleFactor: 1, mobile: false });
      await an('Emulation.setTouchEmulationEnabled', { enabled: false });
      await seite.ruhe();
    },

    /* Die Anwendung speichert 400 ms nach der letzten Änderung und zeichnet über
       requestAnimationFrame neu. Zwei Bilder abzuwarten reicht für das
       Neuzeichnen; wer auf den Speicherstand prüft, wartet mit `warteAuf`. */
    async ruhe() {
      await seite.auswerten(
        'return new Promise(f => requestAnimationFrame(() => requestAnimationFrame(() => f(true))))');
    },

    async bildschirmfoto(pfad) {
      const { data } = await an('Page.captureScreenshot', { format: 'png' });
      const { writeFile } = await import('node:fs/promises');
      await writeFile(pfad, Buffer.from(data, 'base64'));
    },

    async schliessen() {
      await befehl('Target.closeTarget', { targetId: ziel.targetId }).catch(() => {});
    }
  };
  return seite;
}

// ---------------------------------------------------------------- Prüfungen

/* Kein Prüfrahmen, nur ein Zähler: die Fälle stehen als Aufrufe untereinander,
   und am Ende steht eine Zahl. Ein durchgefallener Fall bricht den Lauf nicht
   ab – wer eine Oberfläche prüft, will alle Befunde auf einmal sehen und nicht
   einen je Lauf. */
export function neuerBefund() {
  const fehler = [];
  let bestanden = 0;
  let abschnitt = '';

  return {
    abschnitt(titel) { abschnitt = titel; console.log(`\n  ${titel}`); },
    pruefe(bedingung, text) {
      if (bedingung) { bestanden++; console.log(`    ✓ ${text}`); }
      else { fehler.push(`${abschnitt}: ${text}`); console.log(`    ✗ ${text}`); }
    },
    gleich(ist, soll, text) {
      const gut = JSON.stringify(ist) === JSON.stringify(soll);
      this.pruefe(gut, gut ? text
        : `${text} – erwartet ${JSON.stringify(soll)}, bekam ${JSON.stringify(ist)}`);
    },
    fehlgeschlagen: () => fehler,
    abschluss() {
      console.log('');
      if (fehler.length) {
        console.error(`Prüfung fehlgeschlagen: ${fehler.length} von ${bestanden + fehler.length} Fällen`);
        for (const f of fehler) console.error(`  - ${f}`);
        process.exitCode = 1;
      } else {
        console.log(`Prüfung bestanden: ${bestanden} Fälle`);
      }
    }
  };
}
