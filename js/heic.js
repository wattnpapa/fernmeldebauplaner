// heic.js – HEIC-Aufnahmen entschlüsseln

/* Das iPhone nimmt seit Jahren in HEIC auf. Über die Fotoauswahl des Telefons
   kommt daraus ein JPEG an, aus dem Dateisystem eines Rechners dagegen die
   Rohdatei – und die entschlüsselt von den Browsern nur Safari. Chrome und
   Firefox lehnen sie ab; Firefox ist zugleich der Referenzbrowser dieses
   Programms.

   Deshalb liegt unter `vendor/libheif/` ein Entschlüsseler als WebAssembly
   (libheif, LGPL-3.0, siehe LIZENZEN.md). Er wiegt gut ein Megabyte und wird
   deshalb erst geholt, wenn wirklich eine HEIC-Datei ankommt: der Start der
   Anwendung bleibt so unverändert, auch über Mobilfunk am Bauort. Wer nie eine
   HEIC-Datei anfasst, lädt ihn nie. */

const SKRIPT = 'vendor/libheif/libheif.js';
const BINAER = 'vendor/libheif/libheif.wasm';

let modulLauf = null;

/** Das Entschlüsselermodul – einmal je Sitzung geholt und aufgehoben */
function libheif() {
  if (modulLauf) return modulLauf;
  modulLauf = (async () => {
    if (!window.libheif) await skriptLaden(SKRIPT);
    if (!window.libheif) throw new Error('Entschlüsseler nicht verfügbar');
    /* Der Glue-Code will das Binärstück selbst lesen, und zwar synchron – im
       Browser geht das nicht. Er nennt den Ausweg in seiner eigenen
       Fehlermeldung: vorher holen und übergeben. Das ist hier ohnehin das
       Richtige, weil der Pfad so relativ bleibt und die Anwendung auch in
       einem Unterverzeichnis läuft. */
    const wasmBinary = await hole(BINAER);
    return await window.libheif({ wasmBinary });
  })();
  modulLauf.catch(() => { modulLauf = null; });   // ein zweiter Versuch darf gelingen
  return modulLauf;
}

function skriptLaden(pfad) {
  return new Promise((fertig, fehler) => {
    const el = document.createElement('script');
    el.src = pfad;
    el.onload = fertig;
    el.onerror = () => fehler(new Error('Entschlüsseler nicht ladbar'));
    document.head.appendChild(el);
  });
}

async function hole(pfad) {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error('Entschlüsseler nicht ladbar');
  return antwort.arrayBuffer();
}

/**
 * Eine HEIC-Datei in ein Bild verwandeln, mit dem gezeichnet werden kann.
 *
 * @param {ArrayBuffer} puffer die vollständige Datei
 * @returns {Promise<ImageBitmap>}
 */
export async function heicEntschluesseln(puffer) {
  const modul = await libheif();
  const bilder = new modul.HeifDecoder().decode(new Uint8Array(puffer));
  if (!bilder || !bilder.length) throw new Error('HEIC ohne Bild');

  /* Eine HEIC-Datei kann mehrere Bilder führen – Serienaufnahme, Tiefenkarte,
     Vorschau. Gemeint ist immer das erste; die übrigen werden freigegeben. */
  const bild = bilder[0];
  try {
    const breite = bild.get_width(), hoehe = bild.get_height();
    if (!breite || !hoehe) throw new Error('HEIC ohne Bildmaße');
    const daten = new ImageData(breite, hoehe);
    await new Promise((fertig, fehler) => {
      bild.display(daten, ergebnis =>
        ergebnis ? fertig() : fehler(new Error('HEIC ließ sich nicht entschlüsseln')));
    });
    return await createImageBitmap(daten);
  } finally {
    for (const b of bilder) b.free?.();
  }
}
