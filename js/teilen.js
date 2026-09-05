// teilen.js – Planungen als Link weitergeben, ohne Server

/* Die Planung reist im Fragment der Adresse, hinter dem `#`. Das ist der
   einzige Platz, der ohne Server auskommt und die Zusage aus `datenschutz.html`
   hält: ein Fragment steht in keinem HTTP-Request, in keinem Zugriffsprotokoll
   bei GitHub und in keinem `Referer`, wenn die Seite danach Kartenkacheln holt.

   Der Rückweg ist nicht neu geschrieben. Was hier wegfällt, füllt `migrieren()`
   in `state.js` wieder auf – dieselbe Funktion, die jede geladene Datei
   durchläuft. Deshalb gibt es kein zweites Datenformat, das bei einer
   Schemaänderung nachzupflegen wäre. Wer hier einen Schlüssel weglässt, muss
   nur sicher sein, dass `migrieren()` ihn aus den Vorgaben wiederherstellt.

   Warum es so und nicht anders gebaut ist – samt der gemessenen Längen und der
   verworfenen Wege – steht in `TEILEN.md`. */

import {
  SCHEMA, neuesProjekt, neueStrecke, neuerPunkt, neuesZeichen, neueFlaeche, neuesBild
} from './state.js';

/* Kennung der Linkfassung, nicht des Datenschemas: sie sagt, wie das Fragment
   zu lesen ist, das Schema steht darin. Eine spätere Fassung bekommt `p2.`
   und wird an dieser Stelle unterschieden, statt alte Links zu brechen. */
export const KENNUNG_PLANUNG = 'p1.';
export const KENNUNG_AUSSCHNITT = 'k1.';

/* Ab wann ein Link unhandlich wird. Nicht der Browser ist die Grenze – der
   trägt weit mehr –, sondern die Mailprogramme: sie brechen lange Zeilen um,
   und ein umgebrochener Link kommt beim Empfänger kaputt an. */
export const LAENGE_UNBEDENKLICH = 2000;
export const LAENGE_GRENZE = 8000;

// ---------------------------------------------------------------- Entrümpeln

/* Sechs Nachkommastellen sind 11 cm – weit unterhalb dessen, was ein
   Handempfänger hergibt, und ein Viertel der Länge gegenüber den 15 Stellen,
   die JSON sonst ausschreibt. */
const rund = n => Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : n;

/* Tiefer Vergleich gegen den Vorgabewert. Im Datenmodell kommen nur Zahlen,
   Zeichenketten, Wahrheitswerte, null sowie flache Felder und Objekte vor –
   mehr muss das hier nicht können. */
function gleich(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const schluessel = Object.keys(a);
  if (schluessel.length !== Object.keys(b).length) return false;
  return schluessel.every(s => gleich(a[s], b[s]));
}

/** Was der Vorgabe entspricht, fällt weg; was in `behalten` steht, bleibt. */
function entruempeln(objekt, vorgabe, behalten = []) {
  const raus = {};
  for (const [schluessel, wert] of Object.entries(objekt || {})) {
    if (behalten.includes(schluessel)) { raus[schluessel] = wert; continue; }
    if (gleich(wert, vorgabe[schluessel])) continue;
    raus[schluessel] = wert;
  }
  return raus;
}

/* Name und Farbe hängen an der Nummer des Eintrags: `neueStrecke` vergibt
   „Strecke 1“ und die erste Farbe, `migrieren()` füllt aber jede Strecke aus
   ein und derselben Vorgabe auf. Ließe man sie weg, hieße die dritte Strecke
   beim Empfänger wieder „Strecke 1“ und trüge deren Farbe. Sie reisen mit. */
const IMMER = ['name', 'farbe'];

/* Quer verwiesen wird nur auf Einsatzabschnitte, Zeichengruppen und den
   Verbund zusammengehöriger Flächen – diese drei behalten eine Kennung, kurz
   durchnumeriert. Alle übrigen (Punkte, Strecken, Zeichen, Flächen, Bilder)
   vergibt `migrieren()` beim Empfänger neu; sie mitzuschleppen kostete rund
   ein Achtel der Länge, ohne dass sie jemand liest. */
function kennungen(liste, praefix) {
  const karte = new Map();
  (liste || []).forEach((x, i) => { if (x && x.id) karte.set(x.id, praefix + (i + 1)); });
  return karte;
}

const verweis = (karte, wert) => (wert && karte.get(wert)) || undefined;

/**
 * Eine Planung auf das eindampfen, was der Empfänger nicht selbst herstellen
 * kann. Das Ergebnis trägt dieselben Schlüsselnamen wie das Projekt, nur
 * lückenhaft – es ist kein eigenes Format, sondern eine sparsame Fassung.
 */
export function verschlanken(projekt) {
  const p = projekt;
  const vorgabe = neuesProjekt(p.name || '');
  const abschnitte = kennungen(p.einsatzabschnitte, 'a');
  const gruppen = kennungen(p.zeichengruppen, 'g');

  /* Der Verbund ist kein eigenes Objekt, sondern eine Kennung, die mehrere
     Flächen teilen – gesammelt wird sie deshalb aus den Flächen selbst. */
  const verbuende = new Map();
  for (const f of p.flaechen || []) {
    if (f.verbund && !verbuende.has(f.verbund)) verbuende.set(f.verbund, 'v' + (verbuende.size + 1));
  }

  const vorgabeStrecke = neueStrecke({ strecken: [] });

  const schlank = {
    version: SCHEMA,
    name: p.name,
    geaendert: p.geaendert,
    /* `datum` reist immer mit: seine Vorgabe ist der heutige Tag. Fiele es als
       „Vorgabewert“ weg, füllte `migrieren()` es beim Empfänger mit DESSEN Tag
       wieder auf – der gedruckte Bauauftrag trüge dann ein anderes Datum als
       das Original. Dasselbe gilt für jedes Feld, dessen Vorgabe aus der Uhr
       kommt; zur Zeit ist `datum` das einzige. */
    kopf: entruempeln(p.kopf, vorgabe.kopf, ['datum']),
    ansicht: { ...entruempeln(p.ansicht, vorgabe.ansicht),
               lat: rund(p.ansicht.lat), lng: rund(p.ansicht.lng) },
    optionen: entruempeln(p.optionen, vorgabe.optionen),

    einsatzabschnitte: (p.einsatzabschnitte || []).map((a, i) => ({
      ...entruempeln(a,
        { id: null, name: '', leiter: '', farbe: '', bemerkung: '', sichtbar: true }, IMMER),
      id: abschnitte.get(a.id) || 'a' + (i + 1)
    })),
    zeichengruppen: (p.zeichengruppen || []).map((g, i) => ({
      ...entruempeln(g, { id: null, name: '', farbe: '', bemerkung: '', sichtbar: true }, IMMER),
      id: gruppen.get(g.id) || 'g' + (i + 1)
    })),

    strecken: (p.strecken || []).map(s => {
      const raus = entruempeln(s, vorgabeStrecke, IMMER);
      delete raus.id;
      delete raus.punkte;
      if (s.abschnitt) raus.abschnitt = verweis(abschnitte, s.abschnitt);
      else delete raus.abschnitt;
      /* Die Angaben zur Funkstrecke gehören nur an eine Funkstrecke. Bei einem
         Kabel bleiben sie zwar im Datensatz stehen (ein Wechsel der Art soll
         die einmal getroffene Wahl nicht verlieren), im Link haben sie aber
         nichts zu suchen – dort füllt sie das leere Formular wieder auf. */
      if (!s.kabeltyp || s.kabeltyp !== 'richtfunk') delete raus.richtfunk;
      raus.punkte = (s.punkte || []).map(pt => {
        const p1 = entruempeln(pt, neuerPunkt(pt.lat, pt.lng));
        delete p1.id;
        return { ...p1, lat: rund(pt.lat), lng: rund(pt.lng) };
      });
      return raus;
    }),

    zeichen: (p.zeichen || []).map(z => {
      const raus = entruempeln(z, neuesZeichen(z.lat, z.lng));
      delete raus.id;
      if (z.abschnitt) raus.abschnitt = verweis(abschnitte, z.abschnitt); else delete raus.abschnitt;
      if (z.gruppe) raus.gruppe = verweis(gruppen, z.gruppe); else delete raus.gruppe;
      return { ...raus, lat: rund(z.lat), lng: rund(z.lng) };
    }),

    flaechen: (p.flaechen || []).map(f => {
      /* Die Maße kommen aus der Vorlage der Flächenart – deshalb wird gegen
         eine Fläche derselben Art verglichen, sonst reiste jedes Zelt mit
         seinen Standardmaßen mit. */
      const raus = entruempeln(f, neueFlaeche(f.lat, f.lng, f.art), ['art']);
      delete raus.id;
      if (f.abschnitt) raus.abschnitt = verweis(abschnitte, f.abschnitt); else delete raus.abschnitt;
      if (f.verbund) raus.verbund = verbuende.get(f.verbund); else delete raus.verbund;
      return { ...raus, lat: rund(f.lat), lng: rund(f.lng) };
    }),

    /* Die Bilddaten liegen im Bildspeicher des Geräts und sind für einen Link
       zu schwer: ein einziges verkleinertes Lichtbild wiegt kodiert mehr als
       eine ganze Planung. Was das Bild zeigt und wo es aufgenommen wurde,
       reist trotzdem mit – der Empfänger sieht die Marke auf der Karte und
       weiß, dass es dazu ein Bild gibt. */
    bilder: (p.bilder || []).map(b => {
      /* Verglichen wird gegen ein LEERES Bild, nicht gegen dieses: eine Vorgabe,
         die aus dem Eintrag selbst gebaut wird, ist ihm in jedem Feld gleich –
         Beschriftung, Aufnahmezeitpunkt, Blickrichtung und Maße fielen dann
         sämtlich als „Vorgabewert“ heraus, und der Empfänger bekäme eine
         namenlose Marke. `ortAusKamera` bleibt darüber hinaus in jedem Fall
         stehen: `neuesBild` schließt aus vorhandenen Koordinaten auf eine
         Kameramessung und sichert die Marke dann gegen Verschieben – ein von
         Hand gesetzter Ort käme sonst als gemessener an und wäre festgenagelt. */
      const raus = entruempeln(b, neuesBild({}), ['ortAusKamera']);
      delete raus.id; delete raus.daten; delete raus.mini;
      return { ...raus, lat: rund(b.lat), lng: rund(b.lng) };
    })
  };

  // Leere Listen und leere Blöcke haben im Link nichts verloren.
  for (const [schluessel, wert] of Object.entries(schlank)) {
    const leer = wert === undefined || wert === '' ||
      (Array.isArray(wert) && !wert.length) ||
      (wert && typeof wert === 'object' && !Array.isArray(wert) && !Object.keys(wert).length);
    if (leer) delete schlank[schluessel];
  }
  return schlank;
}

// ---------------------------------------------------------------- Packen

/* Dieselbe Schnittstelle, mit der `kml.js` ein KMZ auspackt, nur in der
   Gegenrichtung. Kein Fremdcode, keine Abhängigkeit – der Browser kann es. */
export const kannPacken = () =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function packen(text) {
  const strom = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const roh = new Uint8Array(await new Response(strom).arrayBuffer());
  /* In Blöcken über `String.fromCharCode`: der Aufruf mit einem Feld aus
     zwanzigtausend Zahlen sprengt bei manchen Browsern den Aufrufstapel. */
  let binaer = '';
  for (let i = 0; i < roh.length; i += 8192) {
    binaer += String.fromCharCode.apply(null, roh.subarray(i, i + 8192));
  }
  return btoa(binaer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Die größte je gemessene Planung wiegt als JSON rund 325 kB. Vier Megabyte
   sind also reichlich Luft – und zugleich die Grenze, an der ein absichtlich
   aufgeblähtes Fragment abbricht, statt den Arbeitsspeicher zu füllen. Deshalb
   stückweise gelesen und nicht in einem Zug: bei `Response.text()` wäre der
   Schaden schon angerichtet, bevor man die Größe kennt. */
const HOECHSTENS = 4 * 1024 * 1024;

async function entpacken(kurz) {
  const binaer = atob(kurz.replace(/-/g, '+').replace(/_/g, '/'));
  const roh = Uint8Array.from(binaer, z => z.charCodeAt(0));
  const strom = new Blob([roh]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const leser = strom.getReader();
  const stuecke = [];
  let summe = 0;
  for (;;) {
    const { value, done } = await leser.read();
    if (done) break;
    summe += value.length;
    if (summe > HOECHSTENS) {
      await leser.cancel();
      const zuGross = new Error('Der Link ist unglaubwürdig groß und wurde nicht geöffnet.');
      zuGross.zuGross = true;
      throw zuGross;
    }
    stuecke.push(value);
  }
  return new TextDecoder().decode(await new Blob(stuecke).arrayBuffer());
}

// ---------------------------------------------------------------- Link bauen

/** Die eigene Adresse ohne Fragment und ohne Abfrageteil – die Grundlage jedes
 *  Links. Absolut, denn sie wird verschickt; aus `origin` und `pathname`
 *  zusammengesetzt, damit sie auch aus einem Unterverzeichnis stimmt. */
export function eigeneAdresse() {
  return location.origin + location.pathname;
}

/** Eine Planung als vollständigen Link. Wirft, wenn der Browser nicht packen kann. */
export async function alsLink(projekt) {
  if (!kannPacken()) throw new Error('Dieser Browser kann keine Links erzeugen – Planung als Datei sichern.');
  return eigeneAdresse() + '#' + KENNUNG_PLANUNG + await packen(JSON.stringify(verschlanken(projekt)));
}

/** Nur der Kartenausschnitt: Lage, Maßstab, Basiskarte. Rund fünfzig Zeichen
 *  und ohne jede Planungsangabe – „schau dir mal die Stelle an“. */
export function ausschnittAlsLink(ansicht) {
  const teile = [rund(ansicht.lat), rund(ansicht.lng), ansicht.zoom, ansicht.basemap];
  return eigeneAdresse() + '#' + KENNUNG_AUSSCHNITT + teile.join(',');
}

// ---------------------------------------------------------------- Link lesen

/** Was steckt im Fragment? `null`, wenn nichts für uns dabei ist. */
export function artDesFragments(fragment = location.hash) {
  const roh = String(fragment || '').replace(/^#/, '');
  if (roh.startsWith(KENNUNG_PLANUNG)) return 'planung';
  if (roh.startsWith(KENNUNG_AUSSCHNITT)) return 'ausschnitt';
  return null;
}

/**
 * Die Planung aus dem Fragment holen – roh, noch nicht durch `migrieren()`.
 * Der Aufrufer entscheidet, was damit geschieht; hier wird nichts übernommen.
 */
export async function planungAusFragment(fragment = location.hash) {
  const roh = String(fragment || '').replace(/^#/, '');
  if (!roh.startsWith(KENNUNG_PLANUNG)) return null;
  if (!kannPacken())
    throw new Error('Dieser Browser kann geteilte Links nicht lesen – ' +
      'bitte die Planung als Datei anfordern.');
  let objekt;
  try {
    objekt = JSON.parse(await entpacken(roh.slice(KENNUNG_PLANUNG.length)));
  } catch (e) {
    /* Die Größengrenze nennt ihren eigenen Grund: ein aufgeblähtes Fragment ist
       kein Bruchstück, sondern ein Link, dem nicht zu trauen ist. */
    if (e.zuGross) throw e;
    throw new Error('Der Link ist unvollständig oder beschädigt – oft hat ihn ein Mailprogramm umgebrochen.');
  }
  if (!objekt || typeof objekt !== 'object' || !Array.isArray(objekt.strecken || []))
    throw new Error('Der Link enthält keine Planung.');
  /* Eine mitgeschickte Projektkennung wird verworfen. `verschlanken` schreibt
     keine hinein, ein von Hand gebauter Link aber könnte – und `migrieren()`
     übernähme sie, worauf die empfangene Planung eine gleichnamige im
     Browserspeicher überschriebe. Der Dateiweg vergibt aus demselben Grund
     eine neue Kennung (`jsonUebernehmen` in `io.js`). */
  delete objekt.id;
  return objekt;
}

/** Den Kartenausschnitt aus dem Fragment holen, oder `null`. */
export function ausschnittAusFragment(fragment = location.hash) {
  const roh = String(fragment || '').replace(/^#/, '');
  if (!roh.startsWith(KENNUNG_AUSSCHNITT)) return null;
  const [lat, lng, zoom, basemap] = roh.slice(KENNUNG_AUSSCHNITT.length).split(',');
  if (!Number.isFinite(+lat) || !Number.isFinite(+lng)) return null;
  return { lat: +lat, lng: +lng, zoom: Number.isFinite(+zoom) ? +zoom : 14, basemap: basemap || undefined };
}

/* Das Fragment gehört nach dem Lesen aus der Adresszeile geräumt. Das ist
   nicht Kosmetik: eine Adresse mit der Planung darin stünde sonst im
   Verlauf des Browsers – und ein Browser mit Verlaufssynchronisierung trüge
   sie zu seinem Hersteller. Ein Neuladen soll den Dialog außerdem nicht
   ein zweites Mal bringen. */
export function fragmentRaeumen() {
  try { history.replaceState(null, '', eigeneAdresse()); } catch (e) { location.hash = ''; }
}
