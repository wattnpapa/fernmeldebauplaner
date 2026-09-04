// richtfunk.js – Angaben der WLAN-Richtfunkstrecke und was sich daraus rechnet

/* Vorlage ist der „Einzelauftrag Richtfunkstrecke WLAN“ des THW (Stand
   200800jun24 / FmFü). Er steht mit zwei Spalten da – eine je Aufbauplatz –
   und darunter, was für die Strecke als Ganzes gilt. Dieses Modul hält beides
   und rechnet, was sich aus der Planung ohnehin ergibt: Distanz, Azimut,
   Höhen und die Bruttodatenrate. Von Hand einzutragen bleibt nur, was am
   Gerät entschieden wird. */

import { distanz, peilung, himmelsrichtung } from './geo.js';
import { BAENDER, bandById as regelBandById } from './frequenzen.js';
import { peilungen } from './missweisung.js';
import { mindestantennenhoehe, neigung } from './funkrechnung.js';

/* Das Band ist kein Anzeigename, sondern ein Rechtsraum. „5 GHz“ als ein Eintrag
   war sachlich falsch: 5250–5350 MHz ist im Freien gar nicht zulässig, 5470–5725
   dagegen mit 1 W – aus einer Bandauswahl muss deshalb eine Teilbandauswahl
   werden. Die Grenzen und Auflagen stehen mit Fundstelle in frequenzen.js; hier
   steht nur, was die Funkschnittstelle daraus macht: WLAN-Norm und die
   Kanalbreiten, die sie dort kennt. Die BOS-Zuteilungen bleiben draußen – sie
   tragen kein WLAN. */
const WLAN_BAENDER = {
  '2400': { norm: 'ht',  bandbreiten: [20, 40] },
  '5150': { norm: 'vht', bandbreiten: [20, 40, 80, 160] },
  '5250': { norm: 'vht', bandbreiten: [20, 40, 80, 160] },
  '5470': { norm: 'vht', bandbreiten: [20, 40, 80, 160] },
  '5755': { norm: 'vht', bandbreiten: [20, 40, 80] },
  '5945': { norm: 'he',  bandbreiten: [20, 40, 80, 160] }
};

export const FREQUENZBAENDER = BAENDER
  .filter(b => WLAN_BAENDER[b.id])
  .map(b => ({
    id: b.id, name: b.name, kurz: b.kurz, von: b.von, bis: b.bis,
    /* Die Mitte des Bandes vertritt die Kanalmitte: die Wellenlänge geht nur
       unter der Wurzel in den Fresnelradius ein, über ein Teilband hinweg macht
       das keinen Millimeter aus. */
    mhz: (b.von + b.bis) / 2,
    ortsfestDraussen: b.ortsfestDraussen,
    ...WLAN_BAENDER[b.id]
  }));

/* Kennungen, die es vor Schema 8 gab: ein Sammeleintrag „5 GHz“ und ein
   „6 GHz“, das im Freien nie zulässig war. Wer so einen Stand öffnet, landet
   im nächstliegenden echten Teilband – bei 5 GHz in dem einzigen, das eine
   ortsfeste Strecke im Freien trägt, bei 6 GHz in demselben Frequenzbereich
   wie zuvor, damit die Auflage dort sichtbar wird statt stillschweigend
   zu verschwinden. */
export const BAND_ALIAS = { '5000': '5470', '6000': '5945' };

export const MIMO_ARTEN = [
  { id: 'kein', name: 'kein', streams: 1 },
  { id: '2x2',  name: '2×2',  streams: 2 },
  { id: '3x3',  name: '3×3',  streams: 3 },
  { id: '4x4',  name: '4×4',  streams: 4 }
];

export const POLARISATIONEN = [
  { id: 'h',  name: 'Horizontal' },
  { id: 'v',  name: 'Vertikal' },
  { id: 'hv', name: 'Horizontal + Vertikal' }
];

export const MODULATIONEN = [
  { id: 'auto', name: 'Automatisch' },
  { id: 'bpsk', name: 'BPSK' },      { id: 'qpsk', name: 'QPSK' },
  { id: 'qam16', name: '16-QAM' },   { id: 'qam64', name: '64-QAM' },
  { id: 'qam256', name: '256-QAM' }, { id: 'qam1024', name: '1024-QAM' }
];

/* Bruttodatenrate eines Datenstroms in Mbit/s bei höchstem Modulationsschema
   und kurzem Schutzabstand – die Zahl, die auch auf dem Typenschild des
   Gerätes steht. 802.11ac mit 80 MHz und 2×2 ergibt so die 866 Mbit/s des
   Formularbeispiels. Es ist ein Rechenwert der Funkschnittstelle, nicht der
   Durchsatz über die Strecke: der liegt in der Praxis bei gut der Hälfte. */
const RATEN = {
  ht:  { 20: 72.2,  40: 150 },
  vht: { 20: 86.7,  40: 200,   80: 433.3, 160: 866.7 },
  he:  { 20: 143.4, 40: 286.8, 80: 600.4, 160: 1201 }
};

export const bandById = id => {
  const schluessel = BAND_ALIAS[id] || id;
  return FREQUENZBAENDER.find(b => b.id === schluessel)
    || FREQUENZBAENDER.find(b => b.id === '5470');
};
export const mimoById = id => MIMO_ARTEN.find(m => m.id === id) || MIMO_ARTEN[1];
export const polarisationById = id => POLARISATIONEN.find(p => p.id === id) || POLARISATIONEN[2];
export const modulationById = id => MODULATIONEN.find(m => m.id === id) || MODULATIONEN[0];

/* Die Neigung wird am Bauplatz auf den besten Empfangspegel eingedreht und
   nicht vorher gerechnet – das Formular sagt genau das, und der Text steht
   deshalb schon im leeren Auftrag. */
export const NEIGUNG_STANDARD = 'nach bestem RX-Pegel';

/** Ein Aufbauplatz der Strecke – die linke oder rechte Spalte des Formulars */
export function neuerFunkstandort() {
  return {
    einheit: '', ansprechpartner: '', erreichbarkeit: '', rufname: '',
    platz: '', hoehe: null, antennenhoehe: 3, neigung: NEIGUNG_STANDARD,
    /* Antennengewinn und Zuleitungsdämpfung stehen je Aufbauplatz, weil die
       beiden Enden verschieden bestückt sein dürfen – eine Schüssel dort, ein
       Sektor hier. Beide bleiben leer, bis jemand das Datenblatt zur Hand hat:
       eine geratene Zahl ginge in die EIRP-Prüfung ein und käme als Zusage
       wieder heraus. */
    antennengewinn: null, kabeldaempfung: null
  };
}

/** Vorgabewerte einer neuen Richtfunkstrecke */
export function neueRichtfunkangabe() {
  return {
    betriebsbereit: '', betriebszeit: '',
    accesspoint: '', antenne: '',
    /* Die Sendeleistung gilt für die Strecke, nicht für den Platz: beide Enden
       einer WLAN-Strecke werden auf denselben Wert eingestellt. TPC steht auf
       „vorhanden“, weil jedes Gerät, das die 5-GHz-Bänder überhaupt benutzen
       darf, es mitbringt – wer es abschaltet, verliert 3 dB der zulässigen
       Leistung, und genau das soll die Prüfung dann auch sagen. */
    sendeleistung: null, tpc: true,
    band: '5470', bandbreite: 80, kanal: '',
    mimo: '2x2', polarisation: 'hv', modulation: 'auto',
    kommentar: '',
    standorte: [neuerFunkstandort(), neuerFunkstandort()]
  };
}

/** Bandbreite auf einen Wert bringen, den das gewählte Band überhaupt kennt */
export function gueltigeBandbreite(bandId, mhz) {
  const moeglich = bandById(bandId).bandbreiten;
  return moeglich.includes(Number(mhz)) ? Number(mhz) : moeglich[moeglich.length - 1];
}

/** Bruttodatenrate in Mbit/s, `null` wenn die Kombination keine Tabelle hat */
export function datenrate(v) {
  const band = bandById(v.band);
  const proStrom = RATEN[band.norm][gueltigeBandbreite(v.band, v.bandbreite)];
  if (!proStrom) return null;
  return proStrom * mimoById(v.mimo).streams;
}

export function datenrateText(v) {
  const r = datenrate(v);
  if (r === null) return '–';
  const zahl = (Math.round(r * 10) / 10).toLocaleString('de-DE');
  /* „max.“ nur bei automatischer Modulation: dort ist die Zahl die obere
     Schranke, aus der das Gerät herunterschaltet. Bei fest eingestellter
     Modulation wäre das Wort irreführend. */
  return `${v.modulation === 'auto' ? 'max. ' : ''}${zahl} Mbit/s`;
}

const zahlOderNull = w => {
  if (w === null || w === undefined || w === '') return null;
  const n = Number(w);
  return isFinite(n) ? n : null;
};

/**
 * Was sich aus der gezeichneten Strecke ergibt: Distanz, Azimut je Standort,
 * Antennenhöhen und der Höhenunterschied. `null`, solange die Strecke keine
 * zwei Punkte hat.
 *
 * Maßgebend sind Anfangs- und Endpunkt, nicht die Summe der Teilstrecken:
 * die Funkstrecke geht durch die Luft, auch wenn die Trasse auf der Karte
 * über einen Knick gezeichnet wurde.
 */
export function funkstrecke(strecke) {
  const p = strecke.punkte || [];
  if (p.length < 2) return null;
  const a = p[0], b = p[p.length - 1];
  const v = strecke.richtfunk;
  const azimut = [peilung(a, b), peilung(b, a)];
  const hoehen = v.standorte.map(s => ({
    grund: zahlOderNull(s.hoehe),
    antenne: zahlOderNull(s.antennenhoehe)
  }));
  const antennenhoehe = hoehen.map(h => h.grund === null ? null : h.grund + (h.antenne || 0));
  const laenge = distanz(a, b);
  const mhz = bandById(v.band).mhz;
  /* Die Peilung wird für jedes Ende an seinem eigenen Ort gerechnet, nicht
     einmal für die Strecke: über 10 km ändert sich die Missweisung zwar kaum,
     die Meridiankonvergenz am Zonenrand aber sehr wohl – und beide Trupps lesen
     ihre Zahl an verschiedenen Punkten ab. */
  const peil = [peilungen(azimut[0], a), peilungen(azimut[1], b)];
  return {
    a, b,
    distanz: laenge,
    mhz,
    azimut,
    richtung: azimut.map(himmelsrichtung),
    peilungen: peil,
    /* Was die Strecke über ebenem, freiem Gelände mindestens braucht – eine
       untere Schranke ohne jede Höhenkachel: wer sie unterschreitet, kommt
       sicher nicht durch. */
    mindesthoehe: mindestantennenhoehe(mhz, laenge),
    neigung: neigung(antennenhoehe[0], antennenhoehe[1], laenge),
    hoehen,
    /* Der Höhenunterschied der Antennenmitten – nur brauchbar, wenn an beiden
       Enden eine Geländehöhe eingetragen ist. */
    hoehenunterschied: antennenhoehe[0] === null || antennenhoehe[1] === null
      ? null : antennenhoehe[1] - antennenhoehe[0]
  };
}

export function azimutText(grad, richtung) {
  return `${Math.round(grad)}° (${richtung})`;
}
