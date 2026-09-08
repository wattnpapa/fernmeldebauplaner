// oberflaeche.js – Oberflächenhöhen: Gelände plus das, was darauf steht

/* Das Geländemodell in hoehe.js kennt keinen Baum und kein Dach – das steht so
   auch im Vorbehalt unter jedem Höhenprofil. Für die Richtfunkplanung ist genau
   das die Lücke: eine Baumreihe von 25 m verdeckt eine Strecke, die über dem
   nackten Boden frei aussieht. Dieses Modul füllt sie, so weit frei zugängliche
   Daten es hergeben – und macht kenntlich, wie weit das ist.

   Zusammengesetzt wird aus drei Quellen, jede mit einer anderen Schwäche:

   1. Copernicus DEM GLO-30 – ein weltweites Oberflächenmodell aus Radar,
      etwa 30 m Zellenweite. Es sieht Wald und geschlossene Bebauung, aber ein
      einzelnes Haus und eine einreihige Allee verschwinden in der Zelle.
   2. OpenStreetMap-Gebäude – punktgenau in der Grundfläche, aber nur dort
      brauchbar, wo jemand eine Höhe oder die Geschosszahl eingetragen hat. In
      Städten ist das oft der Fall, im Dorf fast nie.
   3. OpenStreetMap-Wald und -Gehölz – die Fläche steht praktisch überall, die
      Bestandshöhe nirgends. Sie ist deshalb eine ANNAHME (BEWUCHS_HOEHE) und
      wird als solche geführt und angezeigt.

   Genommen wird an jedem Stützpunkt die höchste dieser Oberflächen, nie ein
   Mittelwert: die Frage lautet, ob etwas im Weg steht, und dafür entscheidet
   das Höchste. Aus demselben Grund liegt die angenommene Bewuchshöhe eher zu
   hoch als zu tief – eine zu hohe Annahme kostet Masthöhe, eine zu niedrige
   kostet die Strecke.

   Die Geländehöhe bleibt in `h` unangetastet stehen. Sie ist die belastbarere
   Zahl, sie trägt das Profilbild, und die Differenz zur Oberfläche ist nur
   dann eine Hindernishöhe, wenn beide aus derselben Aufnahme stammen – was
   hier gerade nicht der Fall ist. Deshalb heißt das Feld `hindernis` und nicht
   „Gebäudehöhe“. */

import { werteAn, oeffnen } from './cog.js';

// ---------------------------------------------------------------- Konfiguration

/* Was sich ohne Quelltextkenntnis ändern lassen soll, steht hier beisammen.
   Die beiden Höhenannahmen sind bewusst Zahlen und keine Formel: sie werden
   am Bauplatz gegen den Augenschein gehalten, und dann muss man sie
   wiedererkennen. */
export const KONFIG = {
  /* Mittlere Geschosshöhe für `building:levels`. 3 m trifft Wohnbebauung; eine
     Halle mit einem Geschoss ist damit unterschätzt – sie trägt aber meist
     ohnehin eine `height`. */
  meterJeGeschoss: 3,

  /* Angenommene Bestandshöhe über Wald- und Gehölzflächen. Der Wirtschaftswald
     in Deutschland steht im Mittel bei 20–30 m; 25 m ist die Zahl, mit der die
     Funkplanung üblicherweise rechnet, wenn keine Aufnahme vorliegt. */
  bewuchsHoehe: 25,

  /* Halbe Breite des Streifens, in dem nach Gebäuden gesucht wird. Er ist weit
     breiter als die Fresnelzone (die ist auf 10 km bei 5,5 GHz keine 10 m dick),
     und zwar aus einem geometrischen Grund: Overpass wählt nach den ECKPUNKTEN
     eines Gebäudes aus, nicht danach, ob es die Strecke überdeckt. Eine 150 m
     lange Halle, durch deren Mitte die Strecke läuft, hätte bei einem schmalen
     Streifen keine einzige Ecke darin und fiele heraus – ausgerechnet das
     Gebäude, auf das es ankommt. Ein zu breiter Streifen kostet dagegen nur
     Übertragung: was den Stützpunkt nicht überdeckt, fällt bei der Punktprobe
     ohnehin heraus. */
  korridorbreite: 80,

  /* Wald- und Gehölzflächen werden nicht über den Streifen gesucht, sondern
     über das umschließende Rechteck: ein Waldstück ist Kilometer breit, seine
     Kante liegt dann nirgends nahe der Strecke, und über den Streifen käme
     gerade der Wald nicht mit, in dem die Strecke ganz verläuft. Der Zuschlag
     in Grad hält Flächen im Bild, die knapp über den Rand ragen. */
  bbZuschlag: 0.005,

  /* Adressen der Dienste. Beide sind austauschbar: das Oberflächenmodell muss
     ein Cloud-Optimized GeoTIFF in Grad-Koordinaten sein (cog.js liest
     Float32/Deflate), die Hindernisabfrage eine Overpass-API. */
  dsmSigner: 'https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=',
  dsmKachel: (nordsued, ostwest) => 'https://elevationeuwest.blob.core.windows.net/' +
    `copernicus-dem/COP30_hh/Copernicus_DSM_COG_10_${nordsued}_00_${ostwest}_00_DEM.tif`,
  /* Zwei Overpass-Adressen, der Reihe nach: der Hauptdienst drosselt bei
     Andrang und antwortet dann mit einer Fehlermeldung statt mit Daten. Beim
     Planen am Kartentisch ist ein zweiter Anlauf auf einem Spiegel die
     bessere Antwort als eine leere Hindernisliste. */
  overpass: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ],

  /* Geduld für einen Abruf. Ohne Frist bleibt eine Anfrage, die der Dienst
     stillschweigend in eine Warteschlange legt, ewig offen – und mit ihr die
     Meldung „wird geholt …“ in der Anzeige. Nach dieser Frist wird der zweite
     Dienst versucht; bleibt auch der stumm, urteilt die Strecke über das
     Gelände und sagt, dass die Hindernisdaten fehlten. */
  frist: 25000
};

/** Quellenangabe für Blattfuß und Lizenzhinweis. */
export const OBERFLAECHEN_QUELLE =
  'Oberfläche: Copernicus DEM GLO-30 © DLR/ESA, Gebäude und Bewuchs © OpenStreetMap-Mitwirkende';

// ---------------------------------------------------------------- Copernicus-DSM

/* Der Zugang ist zweistufig: die Kachel liegt öffentlich, die Adresse muss aber
   signiert werden, und die Signatur läuft nach etwa einem Tag ab. Beides wird
   je Sitzung einmal geholt und danach wiederverwendet – ein Abruf je Strecke
   wäre eine Anfrage mehr für nichts. */
const bilder = new Map();

function kachelname(lat, lng) {
  const n = Math.floor(lat), e = Math.floor(lng);
  const ns = (n < 0 ? 'S' : 'N') + String(Math.abs(n)).padStart(2, '0');
  const ew = (e < 0 ? 'W' : 'E') + String(Math.abs(e)).padStart(3, '0');
  return KONFIG.dsmKachel(ns, ew);
}

function dsmBild(lat, lng) {
  const url = kachelname(lat, lng);
  if (bilder.has(url)) return bilder.get(url);
  const p = (async () => {
    const r = await fetch(KONFIG.dsmSigner + encodeURIComponent(url),
      { signal: AbortSignal.timeout(KONFIG.frist) });
    if (!r.ok) throw new Error(`Signatur ${r.status}`);
    return oeffnen((await r.json()).href);
  })().catch(() => null);
  bilder.set(url, p);
  return p;
}

/* Die Kacheln des Modells sind ein Grad breit; eine Strecke kann über die Kante
   laufen. Deshalb wird nach Kachel gruppiert und nicht nach Strecke. */
async function dsmProfil(punkte) {
  const gruppen = new Map();
  punkte.forEach((p, i) => {
    const k = `${Math.floor(p.lat)}/${Math.floor(p.lng)}`;
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(i);
  });
  const aus = new Array(punkte.length).fill(null);
  await Promise.all([...gruppen.values()].map(async idx => {
    const bild = await dsmBild(punkte[idx[0]].lat, punkte[idx[0]].lng);
    if (!bild) return;
    const werte = await werteAn(bild, idx.map(i => punkte[i]));
    idx.forEach((i, j) => { aus[i] = werte[j]; });
  }));
  return aus;
}

// ---------------------------------------------------------------- OSM-Hindernisse

/* Abgefragt wird ein Schlauch um die Strecke, kein umschließendes Rechteck:
   `around` mit einer Punktfolge ist genau dafür da. Bei einer 10-km-Strecke
   quer durch eine Stadt macht das den Unterschied zwischen ein paar hundert
   und einigen zehntausend Objekten – und es geht nach außen nur der Streifen,
   auf dem geplant wird, nicht die halbe Region. */
/* Der Streifen um die Strecke als Vieleck. Zwei Ecken je Ende genügen: die
   Stützpunkte liegen auf der Geraden zwischen den Aufbauplätzen (siehe
   hoehe.js profil()), der Streifen ist also ein Rechteck. Ein Vieleck ist für
   Overpass zudem weit billiger als eine lange Kette von Umkreisen – dieselbe
   Abfrage lief damit über einer Großstadt in Sekunden statt in eine
   Zeitüberschreitung. */
function korridor(punkte) {
  const a = punkte[0], b = punkte[punkte.length - 1];
  const mLat = 111320, mLng = 111320 * Math.cos(a.lat * Math.PI / 180);
  const dx = (b.lng - a.lng) * mLng, dy = (b.lat - a.lat) * mLat;
  const laenge = Math.hypot(dx, dy) || 1;
  /* Normale zur Strecke, zurück in Grad – quer versetzt, nicht längs. */
  const nLat = (-dx / laenge) * KONFIG.korridorbreite / mLat;
  const nLng = (dy / laenge) * KONFIG.korridorbreite / mLng;
  return [
    [a.lat + nLat, a.lng + nLng], [b.lat + nLat, b.lng + nLng],
    [b.lat - nLat, b.lng - nLng], [a.lat - nLat, a.lng - nLng]
  ].map(([lat, lng]) => `${lat.toFixed(5)} ${lng.toFixed(5)}`).join(' ');
}

function overpassAbfrage(punkte) {
  const im = `(poly:"${korridor(punkte)}")`;

  const lat = punkte.map(p => p.lat), lng = punkte.map(p => p.lng);
  const z = KONFIG.bbZuschlag;
  const bb = '(' + [
    Math.min(...lat) - z, Math.min(...lng) - z,
    Math.max(...lat) + z, Math.max(...lng) + z
  ].map(w => w.toFixed(5)).join(',') + ')';

  return `[out:json][timeout:60];(` +
    `way${im}["building"];relation${im}["building"];` +
    `way${bb}["landuse"="forest"];relation${bb}["landuse"="forest"];` +
    `way${bb}["natural"="wood"];relation${bb}["natural"="wood"];` +
    `);out geom;`;
}

/* „12“, „12 m“, „12.5“ – die Einheit steht in OSM mal da und mal nicht. Fuß
   und Zoll ('40\\'') kommen in Deutschland nicht vor und werden nicht gelesen:
   eine falsch verstandene Einheit wäre schlimmer als eine fehlende Höhe. */
function hoeheAusTag(wert) {
  if (typeof wert !== 'string' && typeof wert !== 'number') return null;
  const m = String(wert).trim().match(/^(\d+(?:[.,]\d+)?)\s*m?$/i);
  if (!m) return null;
  const z = Number(m[1].replace(',', '.'));
  return isFinite(z) && z > 0 && z < 400 ? z : null;
}

function ringe(o) {
  if (o.type === 'way' && o.geometry) return [o.geometry];
  /* Bei Relationen zählen die äußeren Ringe. Innenringe (Lichtungen, Höfe)
     bleiben unberücksichtigt – sie würden die Fläche kleiner machen, und die
     vorsichtige Seite ist hier die größere. */
  if (o.type === 'relation' && Array.isArray(o.members)) {
    return o.members.filter(m => m.geometry && m.role !== 'inner').map(m => m.geometry);
  }
  return [];
}

/* Strahlensatzverfahren: eine Halbgerade nach Westen zählt die Kanten, die sie
   schneidet – ungerade heißt innen. Die Punkte kommen aus Overpass und heißen
   dort `lon`, nicht `lng`; die Verwechslung fällt nicht auf, weil sie kein
   Fehler ist, sondern lautlos „nirgendwo innen“ ergibt. */
function imRing(ring, lat, lng) {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > lat) !== (b.lat > lat) &&
        lng < (b.lon - a.lon) * (lat - a.lat) / (b.lat - a.lat) + a.lon) drin = !drin;
  }
  return drin;
}

/* Was ein Objekt an einem Stützpunkt beiträgt: eine Höhe über Grund, oder
   – bei einem Gebäude ohne jede Höhenangabe – nur die Feststellung, dass dort
   etwas steht. Diese Feststellung ist selbst ein Befund: „hier steht ein
   Gebäude unbekannter Höhe“ ist eine Erkundungsaufgabe, keine Freigabe. */
function hindernisAus(o) {
  const t = o.tags || {};
  if (t.building) {
    const direkt = hoeheAusTag(t.height);
    if (direkt !== null) return { hoehe: direkt, art: 'gebaeude', quelle: 'osm-hoehe', geschaetzt: false };
    const geschosse = Number(String(t['building:levels'] || '').replace(',', '.'));
    if (isFinite(geschosse) && geschosse > 0) {
      return {
        hoehe: geschosse * KONFIG.meterJeGeschoss,
        art: 'gebaeude', quelle: 'osm-geschosse', geschaetzt: true
      };
    }
    return { hoehe: null, art: 'gebaeude', quelle: 'osm-ohne-hoehe', geschaetzt: true };
  }
  return {
    hoehe: KONFIG.bewuchsHoehe, art: 'bewuchs',
    quelle: 'bewuchs-annahme', geschaetzt: true
  };
}

/* Welche Adresse zuletzt geantwortet hat. Der Hauptdienst drosselt tageweise;
   ohne dieses Merken zahlt jede weitere Strecke der Sitzung erneut die volle
   Frist, bevor der Spiegel überhaupt gefragt wird. */
let bewaehrt = null;

async function overpass(daten) {
  let letzter = null;
  const reihe = bewaehrt
    ? [bewaehrt, ...KONFIG.overpass.filter(a => a !== bewaehrt)]
    : KONFIG.overpass;
  for (const adresse of reihe) {
    try {
      const r = await fetch(adresse, {
        method: 'POST', body: new URLSearchParams({ data: daten }),
        signal: AbortSignal.timeout(KONFIG.frist)
      });
      if (!r.ok) throw new Error(`Overpass ${r.status}`);
      const antwort = await r.json();
      bewaehrt = adresse;
      return antwort;
    } catch (fehler) { letzter = fehler; }
  }
  throw letzter || new Error('Overpass nicht erreichbar');
}

async function osmHindernisse(punkte) {
  const antwort = await overpass(overpassAbfrage(punkte));
  const objekte = (antwort.elements || []).map(o => ({ ...hindernisAus(o), ringe: ringe(o) }));

  return punkte.map(p => {
    let treffer = null, ohneHoehe = false;
    for (const o of objekte) {
      if (!o.ringe.some(ring => ring.length > 2 && imRing(ring, p.lat, p.lng))) continue;
      if (o.hoehe === null) { ohneHoehe = true; continue; }
      if (!treffer || o.hoehe > treffer.hoehe) treffer = o;
    }
    return { treffer, ohneHoehe };
  });
}

// ---------------------------------------------------------------- Zusammenführung

/* Die Namen der Herkunft stehen im Ergebnis und nicht nur im Kommentar: das
   Blatt und die Anzeige sollen sagen können, worauf eine Höhe beruht, und der
   Unterschied zwischen einer gemessenen und einer angenommenen Höhe ist der
   Unterschied zwischen einem Befund und einem Hinweis. */
const GELAENDE = { art: 'gelaende', quelle: 'dgm', geschaetzt: false };

/**
 * Geländeprofil um die Oberfläche ergänzen.
 *
 * @param {Array<{d:number,lat:number,lng:number,h:?number}>} profil aus hoehe.js
 * @returns {Promise<{punkte:Array, dsm:boolean, osm:boolean}>} dieselben
 *   Stützpunkte, je Punkt zusätzlich: `oberflaeche` (Meter über NN, nie unter
 *   `h`), `hindernis` (Meter über Grund), `art`, `quelle`, `geschaetzt` und
 *   `gebaeudeOhneHoehe`. `dsm` und `osm` sagen, ob die jeweilige Quelle
 *   geantwortet hat.
 *
 * Dass eine Quelle ausfällt, MUSS nach außen sichtbar bleiben: fällt Overpass
 * mit einer Drosselung aus – das kommt vor –, sieht ein Profil ohne Gebäude
 * genauso aus wie eines über freiem Feld. Der Unterschied entscheidet, ob man
 * dem Bild glauben darf, und deshalb steht er im Ergebnis und im Vorbehalt.
 */
export async function oberflaechenprofil(profil) {
  const alle = profil || [];
  const punkte = alle.filter(p => isFinite(p.h));
  const leer = p => ({ ...p, ...GELAENDE, oberflaeche: null, hindernis: null, gebaeudeOhneHoehe: false });
  if (!punkte.length) return { punkte: alle.map(leer), dsm: false, osm: false };

  /* Beide Quellen laufen nebeneinander und jede für sich: fällt der eine Dienst
     aus, soll der andere trotzdem etwas beitragen. */
  let dsmDa = true, osmDa = true;
  const [dsm, osm] = await Promise.all([
    dsmProfil(punkte).catch(() => { dsmDa = false; return punkte.map(() => null); }),
    osmHindernisse(punkte).catch(() => {
      osmDa = false;
      return punkte.map(() => ({ treffer: null, ohneHoehe: false }));
    })
  ]);
  if (dsm.every(w => w === null)) dsmDa = false;

  const nach = new Map();
  punkte.forEach((p, i) => {
    const kandidaten = [{ hoehe: p.h, ...GELAENDE }];
    /* Das Oberflächenmodell steht selbst über NN, die OSM-Höhen stehen über
       Grund – deshalb werden letztere erst hier auf das Gelände gesetzt. */
    if (dsm[i] !== null && dsm[i] > p.h) {
      kandidaten.push({ hoehe: dsm[i], art: 'dsm', quelle: 'copernicus-dsm', geschaetzt: false });
    }
    const t = osm[i].treffer;
    if (t) kandidaten.push({ hoehe: p.h + t.hoehe, art: t.art, quelle: t.quelle, geschaetzt: t.geschaetzt });

    const hoechster = kandidaten.reduce((a, b) => b.hoehe > a.hoehe ? b : a);
    nach.set(p.d, {
      oberflaeche: hoechster.hoehe,
      hindernis: Math.max(0, hoechster.hoehe - p.h),
      art: hoechster.art, quelle: hoechster.quelle, geschaetzt: hoechster.geschaetzt,
      gebaeudeOhneHoehe: osm[i].ohneHoehe
    });
  });

  return {
    punkte: alle.map(p => nach.has(p.d) ? { ...p, ...nach.get(p.d) } : leer(p)),
    dsm: dsmDa, osm: osmDa
  };
}

/** Höchste Oberfläche an einem Stützpunkt, ersatzweise das Gelände. */
export const oberflaecheVon = p => isFinite(p && p.oberflaeche) ? p.oberflaeche : (p ? p.h : null);

/* Klartext für die Herkunft einer Höhe – einmal hier, damit Bildschirm und
   Blatt denselben Wortlaut tragen. */
export const QUELLTEXT = {
  'dgm': 'Geländemodell',
  'copernicus-dsm': 'Oberflächenmodell (30 m)',
  'osm-hoehe': 'Gebäudehöhe aus OpenStreetMap',
  'osm-geschosse': `Geschosszahl aus OpenStreetMap, ${KONFIG.meterJeGeschoss} m je Geschoss`,
  'osm-ohne-hoehe': 'Gebäude ohne Höhenangabe',
  'bewuchs-annahme': `Wald- oder Gehölzfläche, ${KONFIG.bewuchsHoehe} m angenommen`
};

export const ARTTEXT = {
  gelaende: 'Gelände', dsm: 'Oberfläche', gebaeude: 'Gebäude', bewuchs: 'Bewuchs'
};
