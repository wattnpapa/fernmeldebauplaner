// querungspruefung.js – Was die Trasse kreuzt: Freileitungen, Bahn, Umspannwerke

/* Die Querungen einer Kabeltrasse trägt bisher der Planer von Hand ein, und er
   trägt nur ein, was er kennt. Eine 110-kV-Freileitung über der Trasse ist aber
   kein Nebenumstand: das Überbauen ist verboten, der Trupp braucht die Auflage
   im Bauauftrag, und wer sie beim Zeichnen am Bildschirm übersieht, findet sie
   erst am Bauplatz. Dieses Modul fragt bei OpenStreetMap nach, was die
   gezeichnete Trasse schneidet, und legt jedem Fund die Querungsart aus
   `vorschrift.js` bei – der Planer bestätigt oder verwirft.

   Der Befund ist ein VORSCHLAG und kein Bestand. Zwei Gründe, und beide
   gehören in den Satz neben die Liste:

   1. OpenStreetMap ist bei Hochspannungsleitungen in Deutschland nahezu
      vollständig, beim Ortsnetz aber nicht: `power=minor_line` fehlt vielerorts
      ganz, und wo sie steht, fehlt oft die Spannung. Ein leerer Befund heißt
      deshalb „nichts gefunden“ und nie „nichts da“.
   2. Der Verlauf einer Leitung ist auf den Meter genau kartiert, ihre Höhe über
      Grund nicht. Ob die Leitung an der Kreuzungsstelle 8 m oder 25 m hoch
      hängt, sagt keine Quelle – das bleibt Sache der Erkundung.

   Wo die Spannung fehlt, wird die schärfere Auflage angenommen (über 1 kV).
   Eine zu strenge Auflage kostet Zeit am Bau, eine zu milde kostet mehr.

   Was hier NICHT geschieht: Punkte werden nicht selbsttätig in die Trasse
   gesetzt. Ein Fund, den niemand angesehen hat, stünde sonst als Auflage im
   Bauauftrag und trüge dessen Verbindlichkeit, ohne sie zu verdienen. */

import { overpass, rechteck, ringe } from './overpass.js';
import { distanz, kumuliert } from './geo.js';
import {
  querungsartById, fundstelleText, MINDESTABSTAND_MAST, MINDESTABSTAND_UMSPANNWERK
} from './vorschrift.js';

// ---------------------------------------------------------------- Konfiguration

export const KONFIG = {
  /* Zuschlag um das abgefragte Rechteck in Grad – rund 250 m. Er hält Masten
     und Umspannwerke im Bild, die neben der Trasse stehen und gerade deshalb
     zu melden sind. */
  bbZuschlag: 0.0025,

  /* Höchstmaß eines Abfragerechtecks in Grad, rund 5 km. Eine lange Trasse
     wird in mehrere Rechtecke zerlegt statt in eines gelegt: bei einer
     Diagonale über 30 km umschlösse das eine Rechteck 900 km² und brächte alle
     Leitungen des halben Landkreises mit, von denen keine einzige die Trasse
     berührt. Mehrere kleine Rechtecke laden weniger und treffen dasselbe. */
  kachelGrad: 0.05,

  /* Mehr Rechtecke macht die Abfrage selbst zum Aufwand; darüber wird auf ein
     einziges umschließendes Rechteck zurückgefallen. Bei 0,05° je Kachel sind
     das gut 300 km Trasse – jenseits dessen, was ein Bauauftrag beschreibt. */
  kachelnHoechstens: 60,

  /* Abstand, bis zu dem ein vorhandener Querungspunkt als derselbe gilt. Wer
     die Kreuzung schon von Hand eingetragen hat, soll sie nicht ein zweites Mal
     angeboten bekommen. 30 m ist die Größenordnung, in der ein von Hand auf der
     Karte gesetzter Punkt neben der wahren Kreuzungsstelle liegt. */
  gleicherPunkt: 30
};

/** Quellenangabe für Blattfuß und Lizenzhinweis. */
export const QUERUNGS_QUELLE =
  'Freileitungen, Bahnstrecken und Umspannwerke © OpenStreetMap-Mitwirkende';

// ---------------------------------------------------------------- Abfrage

/* Die Trasse wird in Gruppen aufeinanderfolgender Punkte zerlegt, deren
   gemeinsames Rechteck das Höchstmaß nicht überschreitet. Jede Gruppe beginnt
   mit dem letzten Punkt der vorigen – sonst fiele das Segment zwischen zwei
   Gruppen durch keines der Rechtecke. */
function kacheln(punkte) {
  const gruppen = [];
  let aktuell = [punkte[0]];
  const passt = g => {
    const lat = g.map(p => p.lat), lng = g.map(p => p.lng);
    return Math.max(...lat) - Math.min(...lat) <= KONFIG.kachelGrad &&
           Math.max(...lng) - Math.min(...lng) <= KONFIG.kachelGrad;
  };
  for (let i = 1; i < punkte.length; i++) {
    const probe = [...aktuell, punkte[i]];
    if (passt(probe)) { aktuell = probe; continue; }
    gruppen.push(aktuell);
    aktuell = [punkte[i - 1], punkte[i]];
  }
  gruppen.push(aktuell);
  return gruppen.length > KONFIG.kachelnHoechstens ? [punkte] : gruppen;
}

/** Eine Overpass-Anweisung für jedes Abfragerechteck. */
function jeKachel(gruppen, anweisung) {
  return gruppen.map(g => anweisung(rechteck(g, KONFIG.bbZuschlag))).join('');
}

/* Zwei Abfragen statt einer, und aus demselben Grund wie in oberflaeche.js:
   fällt die eine aus, trägt die andere trotzdem. Die Kreuzungen sind der Kern
   des Befundes, die Abstände zu Mast und Umspannwerk der Zusatz – ein Ausfall
   der Zusatzabfrage darf die Kreuzungen nicht mitnehmen.

   Tunnel fallen heraus: eine Bahnstrecke, die unter der Trasse durchführt,
   kreuzt sie in der Karte, aber nicht am Boden. Erdkabel stehen ohnehin nicht
   darin – `power=line` und `power=minor_line` sind Freileitungen, das
   unterirdische Gegenstück heißt `power=cable`. */
function linienAbfrage(gruppen) {
  return '[out:json][timeout:60];(' + jeKachel(gruppen, bb =>
    `way${bb}["power"~"^(line|minor_line)$"];` +
    `way${bb}["railway"~"^(rail|light_rail|narrow_gauge|tram)$"]["tunnel"!~"."];`
  ) + ');out geom;';
}

/* Nur Gittermasten und Portale der Hochspannung: der Abstand von 20 m gilt dem
   Hochspannungsmast. `power=pole` ist der Holz- oder Betonmast des Ortsnetzes –
   er steht zu Tausenden an jeder Dorfstraße und trüge die Meldung, ohne dass
   die Auflage für ihn gälte.

   Beim Umspannwerk ebenso: `substation=minor_distribution` ist das
   Trafohäuschen an der Straßenecke. Ein 300-m-Kreis um jedes davon färbte die
   halbe Ortslage und machte die Meldung wertlos. */
function anlagenAbfrage(gruppen) {
  return '[out:json][timeout:60];(' + jeKachel(gruppen, bb =>
    `node${bb}["power"~"^(tower|portal)$"];` +
    `way${bb}["power"="substation"]["substation"!="minor_distribution"];` +
    `relation${bb}["power"="substation"]["substation"!="minor_distribution"];`
  ) + ');out geom;';
}

// ---------------------------------------------------------------- Geometrie

/* Gerechnet wird in Metern auf einer Ebene, nicht auf der Kugel. Über die
   Ausdehnung einer Bautrasse ist der Fehler dieser Näherung im Zentimeterbereich
   und damit weit unter dem, was die Lage einer kartierten Leitung hergibt –
   dafür sind Schnittpunkt und Lotabstand zwei Zeilen statt zweier Verfahren. */
function ebene(bezug) {
  const mLat = 111320;
  const mLng = 111320 * Math.cos(bezug.lat * Math.PI / 180);
  return {
    hin: p => [((p.lng ?? p.lon) - bezug.lng) * mLng, (p.lat - bezug.lat) * mLat],
    zurueck: ([x, y]) => ({ lat: bezug.lat + y / mLat, lng: bezug.lng + x / mLng })
  };
}

/** Lage des Schnittpunkts auf der Strecke a→b als Anteil, oder `null`. */
function schnittanteil(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1];
  const sx = d[0] - c[0], sy = d[1] - c[1];
  const nenner = rx * sy - ry * sx;
  if (!nenner) return null;                       // parallel oder entartet
  const qx = c[0] - a[0], qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / nenner;
  const u = (qx * ry - qy * rx) / nenner;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** Lotabstand auf die Strecke a→b und die Lage des Lotfußpunkts als Anteil. */
function lot(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return { abstand: Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)), t };
}

const lotabstand = (p, a, b) => lot(p, a, b).abstand;

/* Strahlensatzverfahren wie in oberflaeche.js: liegt ein Trassenpunkt in der
   Umzäunung des Umspannwerks, ist der Abstand null und nicht der zum nächsten
   Zaunstück. */
function imRing(ring, p) {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
        p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) drin = !drin;
  }
  return drin;
}

// ---------------------------------------------------------------- Deutung

/* „110000“, „380000;110000“, „20000“ – die Spannung steht in Volt, bei
   Mehrfachleitungen mit Semikolon getrennt. Maßgebend ist die höchste: nach ihr
   richtet sich die Auflage. */
function kvAus(wert) {
  if (wert === undefined || wert === null) return null;
  const zahlen = String(wert).split(';')
    .map(t => Number(String(t).trim()))
    .filter(z => isFinite(z) && z > 0);
  return zahlen.length ? Math.max(...zahlen) / 1000 : null;
}

/* Als Bindestrichfügung, weil sie vor einem Substantiv steht: „110-kV-Freileitung“,
   nicht „110 kV-Freileitung“. Unter 1 kV in Volt – das Ortsnetz nennt niemand
   „0,4 kV“. */
const spannungsfuegung = kv => kv >= 1
  ? `${Number(kv.toFixed(1)).toLocaleString('de-DE')}-kV`
  : `${Math.round(kv * 1000)}-V`;

/* Was OSM über das Objekt hinaus hergibt: Name, Betreiber, Leitungsnummer. Am
   Bauplatz ist das die Angabe, mit der man beim EVU anruft. */
function zusatz(t) {
  const teile = [t.name, t.operator, t.ref].filter(Boolean);
  return teile.length ? ` (${[...new Set(teile)].join(', ')})` : '';
}

/* Die Zuordnung zur Querungsart der Vorschrift. Ohne Spannungsangabe gilt die
   schärfere Stufe: eine `minor_line` führt in Deutschland ebenso 20 kV wie
   400 V, und die Auflage „Überbauen verboten“ zu früh zu geben ist der
   billigere Fehler. Der Fund merkt sich das in `kvUnsicher` und sagt es. */
function deutung(t) {
  const kv = kvAus(t.voltage);
  if (t.railway) {
    const fahrdraht = t.electrified && t.electrified !== 'no';
    if (t.railway === 'tram') {
      return { art: 'fahrleitung', kv, bezeichnung: 'Straßenbahn' + zusatz(t) };
    }
    return {
      art: fahrdraht ? 'bahn_oberleitung' : 'bahn', kv,
      bezeichnung: `Bahnstrecke ${fahrdraht ? 'mit' : 'ohne'} Oberleitung` + zusatz(t)
    };
  }
  const nieder = t.power === 'minor_line' && kv !== null && kv <= 1;
  return {
    art: nieder ? 'starkstrom_nieder' : 'starkstrom_hoch',
    kv,
    kvUnsicher: kv === null,
    bezeichnung: (kv !== null ? `${spannungsfuegung(kv)}-Freileitung` : 'Freileitung') + zusatz(t)
  };
}

// ---------------------------------------------------------------- Sätze

/* Die Sätze werden hier gebildet und nicht in der Oberfläche zusammengesetzt,
   damit auf Bildschirm und Blatt derselbe Wortlaut steht – so wie beim
   Geländeurteil der Funkstrecke. */
function kreuzungssatz(f) {
  const wo = `bei ${Math.round(f.abAnfang).toLocaleString('de-DE')} m ab Anfang`;
  const unsicher = f.kvUnsicher
    ? ' Die Spannung ist nicht kartiert; vorsorglich als Anlage über 1 kV geführt.'
    : '';
  return `${f.bezeichnung} kreuzt die Trasse ${wo}.${unsicher}`;
}

function naehesatz(f) {
  const wo = `bei ${Math.round(f.abAnfang).toLocaleString('de-DE')} m ab Anfang`;
  return `${f.bezeichnung} ${Math.round(f.abstand)} m neben der Trasse ${wo} – ` +
    `gefordert sind ${f.soll} m (${fundstelleText(f.art)}).`;
}

/**
 * Der Satz, der über der Fundliste stehen muss. Eine leere Liste sieht aus wie
 * eine Freigabe und ist keine.
 */
export function befundText(b) {
  if (!b) return 'Die Trasse wurde noch nicht auf Querungen geprüft.';
  if (!b.linienDa && !b.anlagenDa) {
    return 'Die Abfrage bei OpenStreetMap kam nicht zustande. Es wurde nichts geprüft.';
  }
  const teil = !b.linienDa
    ? ' Die Abfrage der Leitungen und Bahnstrecken fiel aus – gefunden wurde nur, was neben der Trasse steht.'
    : (!b.anlagenDa
      ? ' Die Abfrage der Masten und Umspannwerke fiel aus – Abstände dorthin sind nicht geprüft.'
      : '');
  const kreuzungen = b.funde.filter(f => f.klasse === 'kreuzung').length;
  const naehe = b.funde.length - kreuzungen;
  const zahl = b.funde.length
    ? `gefunden: ${kreuzungen} Kreuzung${kreuzungen === 1 ? '' : 'en'}` +
      (naehe ? ` und ${naehe} Unterschreitung${naehe === 1 ? '' : 'en'} eines Mindestabstands` : '')
    : 'nichts gefunden';
  return `Entlang der Trasse ${zahl}. Grundlage ist OpenStreetMap: ` +
    'Hochspannungsleitungen sind dort weitgehend vollständig, Ortsnetz-Freileitungen ' +
    'nicht. Ein leerer Befund heißt „nichts gefunden“ und nicht „nichts da“; die ' +
    'Höhe einer Leitung über Grund steht in keiner Quelle und bleibt Sache der ' +
    'Erkundung.' + teil;
}

// ---------------------------------------------------------------- Prüfung

function kreuzungen(punkte, elemente, feld, kum) {
  const funde = [];
  for (const o of elemente) {
    const bahn = (o.geometry || []).map(feld.hin);
    if (bahn.length < 2) continue;
    const d = deutung(o.tags || {});
    for (let i = 1; i < punkte.length; i++) {
      const a = feld.hin(punkte[i - 1]), b = feld.hin(punkte[i]);
      for (let j = 1; j < bahn.length; j++) {
        const t = schnittanteil(a, b, bahn[j - 1], bahn[j]);
        if (t === null) continue;
        const ort = feld.zurueck([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
        funde.push({
          id: `${o.type}/${o.id}@${i}`,
          klasse: 'kreuzung',
          art: querungsartById(d.art),
          lat: ort.lat, lng: ort.lng,
          segment: i - 1,
          abAnfang: kum[i - 1] + t * (kum[i] - kum[i - 1]),
          kv: d.kv, kvUnsicher: !!d.kvUnsicher,
          bezeichnung: d.bezeichnung
        });
        /* Ein Leitungszug schlängelt sich; zwei benachbarte Stücke können
           dasselbe Trassensegment zweimal schneiden. Gemeldet wird die erste
           Kreuzung je Objekt und Segment – die zweite läge wenige Meter daneben
           und wäre dieselbe Querung. */
        break;
      }
    }
  }
  return funde;
}

function naehe(punkte, elemente, feld, kum) {
  const bahn = punkte.map(feld.hin);
  const funde = [];
  for (const o of elemente) {
    const t = o.tags || {};
    const mast = t.power === 'tower' || t.power === 'portal';
    const soll = mast ? MINDESTABSTAND_MAST : MINDESTABSTAND_UMSPANNWERK;

    /* Bezugspunkt ist beim Mast der Mast selbst, beim Umspannwerk die Ecke der
       Umzäunung, die der Trasse am nächsten liegt. Die Mitte des Werks wäre der
       falsche Bezug: gemeint sind 300 m ab der Umzäunung, und auf der Karte
       zeigt die Ecke auf die Stelle, an der es eng wird. */
    let bezug = null, abstand = Infinity;
    if (mast) {
      bezug = feld.hin(o);
      for (let i = 1; i < bahn.length; i++) abstand = Math.min(abstand, lotabstand(bezug, bahn[i - 1], bahn[i]));
    } else {
      for (const ring of ringe(o)) {
        if (ring.length < 3) continue;
        const eben = ring.map(feld.hin);
        if (bahn.some(p => imRing(eben, p))) { abstand = 0; bezug = eben[0]; continue; }
        for (const ecke of eben) {
          for (let i = 1; i < bahn.length; i++) {
            const d = lotabstand(ecke, bahn[i - 1], bahn[i]);
            if (d < abstand) { abstand = d; bezug = ecke; }
          }
        }
        /* Auch der umgekehrte Fall: eine lange Zaunkante, an der ein
           Trassenpunkt näher liegt als jede Zaunecke. */
        for (const p of bahn) {
          for (let i = 1; i < eben.length; i++) {
            const d = lotabstand(p, eben[i - 1], eben[i]);
            if (d < abstand) { abstand = d; bezug = eben[i - 1]; }
          }
        }
      }
    }
    if (!bezug || !isFinite(abstand) || abstand > soll) continue;
    const ort = feld.zurueck(bezug);

    /* Wo an der Trasse: das nächstgelegene Segment. Anders als bei einer
       Kreuzung gibt es hier keine Stelle, sondern eine Strecke, entlang derer
       der Abstand unterschritten wird – die Meldung nennt deshalb die Nähe und
       setzt keinen Punkt. */
    let segment = 0, anteil = 0, beste = Infinity;
    for (let i = 1; i < bahn.length; i++) {
      const l = lot(bezug, bahn[i - 1], bahn[i]);
      if (l.abstand < beste) { beste = l.abstand; segment = i - 1; anteil = l.t; }
    }

    funde.push({
      id: `${o.type}/${o.id}`,
      klasse: 'naehe',
      art: querungsartById('starkstrom_hoch'),
      lat: ort.lat, lng: ort.lng,
      segment,
      abAnfang: kum[segment] + anteil * (kum[segment + 1] - kum[segment]),
      abstand, soll,
      kv: kvAus(t.voltage), kvUnsicher: false,
      bezeichnung: mast
        ? (t.power === 'portal' ? 'Leitungsportal' : 'Hochspannungsmast') + zusatz(t)
        : 'Umspannwerk' + zusatz(t)
    });
  }
  return funde;
}

/**
 * Die Trasse einer Strecke gegen OpenStreetMap prüfen.
 *
 * @param {object} strecke  Strecke mit mindestens zwei Punkten
 * @returns {Promise<object|null>} Befund mit `funde`, `linienDa`, `anlagenDa`
 */
export async function pruefeQuerungen(strecke) {
  const punkte = (strecke && strecke.punkte) || [];
  if (punkte.length < 2) return null;

  const gruppen = kacheln(punkte);
  const holen = async abfrage => (await overpass(abfrage)).elements || [];
  const [linien, anlagen] = await Promise.all([
    holen(linienAbfrage(gruppen)).then(e => ({ da: true, e }), () => ({ da: false, e: [] })),
    holen(anlagenAbfrage(gruppen)).then(e => ({ da: true, e }), () => ({ da: false, e: [] }))
  ]);

  const feld = ebene(punkte[0]);
  const kum = kumuliert(punkte);
  const funde = [
    ...kreuzungen(punkte, linien.e, feld, kum),
    ...naehe(punkte, anlagen.e, feld, kum)
  ];
  /* Sortiert nach der Stelle auf der Trasse und nicht nach Art: so steht die
     Liste in der Reihenfolge, in der der Trupp die Stellen abläuft. */
  funde.sort((a, b) => a.abAnfang - b.abAnfang);
  for (const f of funde) f.satz = f.klasse === 'kreuzung' ? kreuzungssatz(f) : naehesatz(f);

  const befund = { funde, linienDa: linien.da, anlagenDa: anlagen.da, geprueft: Date.now() };
  befunde.set(strecke.id, { signatur: signatur(strecke), befund });
  return befund;
}

/** Steht an dieser Stelle schon eine Querung in der Trasse? */
export function schonEingetragen(strecke, fund) {
  return (strecke.punkte || []).some(p =>
    p.art === 'querung' && distanz(p, fund) <= KONFIG.gleicherPunkt);
}

// ---------------------------------------------------------------- Zwischenspeicher

/* Der Befund liegt wie das Geländeurteil der Funkstrecke im Modul und nicht im
   Projekt: er ist eine Auskunft über den Stand einer fremden Datenbank, kein
   Planungsinhalt. Ein Befund, der eine Planung überdauert, wäre irgendwann für
   eine Trasse gerechnet, die längst anders läuft. */
const befunde = new Map();

/* Die Signatur beschreibt die GESTALT der Trasse, nicht ihre Punktliste. Der
   Unterschied ist genau der Fall, um den es hier geht: das Übernehmen eines
   Fundes setzt einen Punkt auf eine Linie, die schon geprüft war – die Trasse
   bekommt eine Ecke mehr und verläuft unverändert. Über die Punktliste gerechnet
   hätte der Befund sich selbst für veraltet erklärt, sobald man ihm folgt, und
   nach einem Rückgängig wäre er es wieder geworden.

   Punkte, die auf der Verbindung ihrer Nachbarn liegen, fallen deshalb heraus.
   Ein Meter Abweichung ist die Schwelle: darunter liegt kein Knick, sondern
   die Rundung der Koordinaten auf fünf Nachkommastellen. */
const KNICK = 1;

function signatur(strecke) {
  const punkte = (strecke && strecke.punkte) || [];
  if (punkte.length < 2) return '';
  const feld = ebene(punkte[0]);
  const eben = punkte.map(feld.hin);
  return punkte
    .filter((p, i) => i === 0 || i === punkte.length - 1 ||
      lotabstand(eben[i], eben[i - 1], eben[i + 1]) > KNICK)
    .map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
}

/**
 * Befund zu dieser Strecke, oder `null`. `aktuell` sagt, ob die Trasse seit der
 * Prüfung unverändert ist – ein veralteter Befund wird nicht weggeworfen,
 * sondern mit dem Vorbehalt gezeigt: er ist mehr wert als eine leere Liste.
 */
export function befundLesen(strecke) {
  const eintrag = strecke && befunde.get(strecke.id);
  if (!eintrag) return null;
  return { ...eintrag.befund, aktuell: eintrag.signatur === signatur(strecke) };
}
