// bildspeicher.js – Bilddaten im Gerätespeicher (IndexedDB)

/* Warum nicht der localStorage wie alles andere: dort liegen je Website rund
   5 MB, und ein einziges verkleinertes Lichtbild belegt davon schon 200 kB.
   Zweitens legt der Undo-Stapel in `state.js` bis zu 60 Abzüge der Planung als
   Zeichenkette ab – lägen die Bilddaten im Projekt, kostete jeder Klick das
   Vielfache davon an Arbeitsspeicher.

   Deshalb die Trennung: das Projekt führt zu jedem Bild nur die Angaben
   (Ort, Zeit, Beschriftung, Maße), die Bilddaten selbst liegen hier. Sie
   verlassen das Gerät so wenig wie die Planung selbst. */

const DATENBANK = 'fbp.bilder';
const LAGER = 'bilder';

let lauf = null;

function db() {
  if (lauf) return lauf;
  lauf = new Promise((fertig, fehler) => {
    if (!window.indexedDB) return fehler(new Error('Dieser Browser stellt keinen Bildspeicher bereit.'));
    const antrag = indexedDB.open(DATENBANK, 1);
    antrag.onupgradeneeded = () => {
      if (!antrag.result.objectStoreNames.contains(LAGER)) {
        antrag.result.createObjectStore(LAGER, { keyPath: 'id' });
      }
    };
    antrag.onsuccess = () => fertig(antrag.result);
    /* Im privaten Fenster mancher Browser ist IndexedDB gesperrt. Der Fehler
       wird nicht verschluckt: wer ein Bild hinzufügt, muss erfahren, dass es
       nicht bleiben wird. */
    antrag.onerror = () => fehler(new Error('Bildspeicher des Browsers nicht verfügbar.'));
    antrag.onblocked = () => fehler(new Error('Bildspeicher ist von einem anderen Fenster belegt.'));
  });
  lauf.catch(() => { lauf = null; });   // beim nächsten Versuch neu öffnen
  return lauf;
}

/** Einen Vorgang auf dem Lager ausführen und sein Ergebnis liefern */
async function imLager(modus, tun) {
  const verbindung = await db();
  return new Promise((fertig, fehler) => {
    const vorgang = verbindung.transaction(LAGER, modus);
    const lager = vorgang.objectStore(LAGER);
    let ergebnis;
    try { ergebnis = tun(lager); } catch (e) { return fehler(e); }
    // Ein nicht gefundener Eintrag liefert `undefined` – deshalb am Typ und
    // nicht am Wert entscheiden, ob hier eine Anfrage oder ein Ergebnis steht.
    vorgang.oncomplete = () => fertig(ergebnis instanceof IDBRequest ? ergebnis.result : ergebnis);
    vorgang.onerror = () => fehler(vorgang.error || new Error('Bildspeicher meldet einen Fehler.'));
    vorgang.onabort = () => fehler(vorgang.error || new Error('Bildspeicher hat abgebrochen.'));
  });
}

/** Bild und Vorschaubild unter einer Kennung ablegen */
export async function ablegen(kennung, bild, mini) {
  await imLager('readwrite', lager => lager.put({ id: kennung, bild, mini }));
  /* Eine gemerkte Adresse zeigte weiter auf die alten Daten – das trifft die
     Kennung, die beim Laden einer Sicherungsdatei schon belegt war. */
  urlVergessen(kennung);
}

/** Ablage eines Bildes; `null`, wenn es sie nicht (mehr) gibt */
export async function holen(kennung) {
  try { return (await imLager('readonly', lager => lager.get(kennung))) || null; }
  catch (e) { return null; }
}

export async function alleKennungen() {
  try { return (await imLager('readonly', lager => lager.getAllKeys())) || []; }
  catch (e) { return []; }
}

/**
 * Bilddaten wegräumen, die keine Planung mehr nennt.
 *
 * Gelöscht wird beim Aufräumen und nicht beim Löschen des Bildes: sonst nähme
 * ein Rückgängig zwar den Eintrag zurück, das Bild dazu wäre aber fort. Nach
 * dem Neuladen ist der Undo-Stapel ohnehin leer – dann ist das Wegräumen ohne
 * Verlust möglich.
 */
export async function aufraeumen(behalten) {
  try {
    const alle = await alleKennungen();
    const weg = alle.filter(k => !behalten.has(k));
    if (!weg.length) return 0;
    await imLager('readwrite', lager => { for (const k of weg) lager.delete(k); });
    for (const k of weg) urlVergessen(k);
    return weg.length;
  } catch (e) { return 0; }
}

// ---------------------------------------------------------------- Adressen

/* Ein <img> braucht eine Adresse, kein Blob. Die einmal erzeugten Adressen
   bleiben in dieser Karte, weil die Bilderliste bei jeder Änderung der Planung
   neu aufgebaut wird – jedes Mal neue Adressen zu erzeugen hieße, den
   Arbeitsspeicher mit Leichen zu füllen.

   Gemerkt wird der laufende Abruf und nicht erst sein Ergebnis: sonst legten
   zwei Aufrufe kurz hintereinander – ein Neuaufbau der Liste, während der
   erste noch aus dem Lager liest – zwei Adressen auf denselben Blob an, von
   denen nur eine je wieder freigegeben würde. */
const adressen = new Map();

function url(kennung, art) {
  const schluessel = `${art}:${kennung}`;
  if (!adressen.has(schluessel)) {
    adressen.set(schluessel, holen(kennung).then(eintrag => {
      const blob = eintrag && eintrag[art];
      return blob ? URL.createObjectURL(blob) : null;
    }));
  }
  return adressen.get(schluessel);
}

/** Adresse des großen Bildes (Vorschau auf der Karte, Ansicht im Dialog) */
export const bildUrl = kennung => url(kennung, 'bild');
/** Adresse des Vorschaubildes für die Liste */
export const miniUrl = kennung => url(kennung, 'mini');

/** Adressen eines Bildes freigeben – beim Neubelegen und beim Wegräumen */
export function urlVergessen(kennung) {
  for (const art of ['bild', 'mini']) {
    const schluessel = `${art}:${kennung}`;
    const lauf = adressen.get(schluessel);
    if (!lauf) continue;
    adressen.delete(schluessel);
    // Ein noch laufender Abruf wird abgewartet, sonst bliebe seine Adresse stehen
    Promise.resolve(lauf).then(adresse => { if (adresse) URL.revokeObjectURL(adresse); });
  }
}

// ---------------------------------------------------------------- Sicherungsdatei

/* Für die Sicherungsdatei werden die Bilddaten in Text umgeschrieben: die
   Datei ist der einzige Weg, eine Planung aus diesem Browser herauszubekommen,
   und eine Sicherung ohne die Bilder wäre keine. */

const alsText = blob => new Promise((fertig, fehler) => {
  const leser = new FileReader();
  leser.onload = () => fertig(leser.result);
  leser.onerror = () => fehler(leser.error || new Error('Bild nicht lesbar.'));
  leser.readAsDataURL(blob);
});

/** Bild und Vorschau als `data:`-Adressen, oder `null` */
export async function alsDatenUrls(kennung) {
  const eintrag = await holen(kennung);
  if (!eintrag || !eintrag.bild) return null;
  try {
    return {
      daten: await alsText(eintrag.bild),
      mini: eintrag.mini ? await alsText(eintrag.mini) : ''
    };
  } catch (e) { return null; }
}

/* Von Hand statt über `fetch('data:…')`: der FMBauplaner ruft nach außen nur
   Kartenkacheln ab, und ein Netzaufruf im Ladeweg einer Datei wäre – auch wenn
   er das Gerät nie verlässt – genau die Stelle, an der diese Zusage später
   niemand mehr nachvollzieht. */
function ausDatenUrl(adresse) {
  const teile = /^data:([^;,]*);base64,(.*)$/s.exec(adresse || '');
  if (!teile) return null;
  try {
    const roh = atob(teile[2]);
    const feld = new Uint8Array(roh.length);
    for (let i = 0; i < roh.length; i++) feld[i] = roh.charCodeAt(i);
    return new Blob([feld], { type: teile[1] || 'image/jpeg' });
  } catch (e) { return null; }
}

/**
 * Bilddaten aus einer geladenen Planungsdatei übernehmen.
 * @returns {Promise<number>} wie viele Bilder tatsächlich abgelegt wurden
 */
export async function ausDatei(bilder = []) {
  let uebernommen = 0;
  for (const b of bilder) {
    const bild = ausDatenUrl(b.daten);
    if (!bild) continue;
    try {
      await ablegen(b.id, bild, ausDatenUrl(b.mini) || bild);
      uebernommen++;
    } catch (e) { break; }   // ist der Speicher zu, bleibt er es auch beim nächsten
  }
  return uebernommen;
}
