// frequenzen.js – Allgemeinzuteilungen der Bundesnetzagentur für den WLAN-Richtfunk

/* Was js/vorschrift.js für die KatS-Dv 861 ist, ist dieses Modul für die
   Allgemeinzuteilungen: Grenzwert und Auflage mit Fundstelle am
   Entscheidungsort, dazu die Rechnung, die daraus die am Gerät einzustellende
   Sendeleistung macht. Fundstelle ist hier nicht die Gliederungsnummer einer
   Vorschrift, sondern Verfügungsnummer und Amtsblattjahr – danach sucht, wer
   den Wortlaut nachlesen will.

   Das Werkzeug rechnet und warnt, es bescheinigt nicht. Ob eine Strecke so
   betrieben werden darf, entscheidet die planende Führungskraft anhand der
   Verfügung, der Konformitätserklärung des Gerätes und der Lage vor Ort –
   nicht diese Datei und nicht ihre Ausgabe.

   Redaktionsstand der Werte: September 2026, aus dem Volltext der
   Amtsblattverfügungen übernommen. Allgemeinzuteilungen sind befristet und
   werden ersetzt; die Fundstelle gehört deshalb überall mit in die Ausgabe,
   und vor jeder Planung ist nachzusehen, ob sie noch die geltende ist. */

/* Ein Bandeintrag trägt, was am Entscheidungsort gebraucht wird:

     eirp     höchstzulässige mittlere EIRP in dBm
     dichte   höchstzulässige EIRP-Dichte in dBm/MHz
     auflagen Sätze der Verfügung, die keine Zahl sind und trotzdem binden

   Die Dichte steht in dBm/MHz, weil die Prüfung in Dezibel rechnet. Wo die
   Verfügung in Milliwatt schreibt, steht ihr Wortlaut in „dichteText“: die
   50 mW/MHz des Bandes 5470–5725 MHz nennt sie selbst 17 dBm/MHz, und diese
   Rundung der Verfügung wird übernommen statt nachgerechnet (16,99).

   „ortsfestDraussen“ ist der Schalter, um den es beim Richtfunk geht: darf die
   Ausrüstung im Freien an einer ortsfesten Antenne betrieben werden? Wo nicht,
   steht der Grund in „ausschluss“ – er ist der eigentliche Inhalt des Eintrags
   und nicht bloß eine fehlende Zahl. */
export const BAENDER = [
  {
    id: '2400',
    name: '2400–2483,5 MHz',
    kurz: '2,4 GHz',
    von: 2400, bis: 2483.5,
    art: 'az',
    eirp: 20,
    dichte: 10,
    dichteText: '10 mW/MHz, bei Frequenzsprungverfahren 100 mW/100 kHz',
    tpc: false, dfs: false,
    ortsfestDraussen: true,
    ausschluss: null,
    /* Rechtlich offen, praktisch eng: 20 dBm EIRP sind der Gesamtwert
       einschließlich Antennengewinn, und eine Richtantenne verbraucht ihn
       allein. Deshalb der Vorbehalt statt eines Hakens. */
    vorbehalt: 'Die 20 dBm EIRP gelten einschließlich Antennengewinn: hinter einer ' +
      '23-dBi-Schüssel bleiben am Gerät −3 dBm (0,5 mW).',
    auflagen: [
      'Betrieb im Außenbereich und an ortsfester Antenne zulässig.',
      'Nutzung nichtstörend und ungeschützt: kein Schutz vor Störungen durch andere ' +
        'Funkanwendungen, eigene Störungen sind abzustellen.'
    ],
    fundstelle: 'Vfg. 128/2023'
  },
  {
    id: '5150',
    name: '5150–5250 MHz',
    kurz: '5,2 GHz unten',
    von: 5150, bis: 5250,
    art: 'az',
    eirp: 23,
    dichte: 10,
    dichteText: '10 mW/MHz',
    tpc: true, dfs: true,
    ortsfestDraussen: false,
    ausschluss: 'Nur im Innenraum. Im Außenbereich darf die Ausrüstung weder an einer ' +
      'ortsfesten Außenantenne betrieben werden noch selbst ortsfest sein.',
    vorbehalt: null,
    auflagen: [
      'Innenraum, auch in Straßenfahrzeugen, Zügen und Luftfahrzeugen.',
      'Im Außenbereich weder ortsfeste Außenantenne noch ortsfester Betrieb.',
      'TPC und DFS.'
    ],
    fundstelle: 'Vfg. 136/2022 i.d.F. Vfg. 49/2023'
  },
  {
    id: '5250',
    name: '5250–5350 MHz',
    kurz: '5,3 GHz',
    von: 5250, bis: 5350,
    art: 'az',
    eirp: 23,
    dichte: 10,
    dichteText: '10 mW/MHz',
    tpc: true, dfs: true,
    ortsfestDraussen: false,
    ausschluss: 'Einsatz im Außenbereich nicht zulässig; Anlagen in Straßenfahrzeugen, ' +
      'Zügen und Luftfahrzeugen ebenfalls nicht.',
    vorbehalt: null,
    auflagen: [
      'Einsatz im Außenbereich nicht zulässig.',
      'Anlagen in Straßenfahrzeugen, Zügen und Luftfahrzeugen nicht zulässig.',
      'TPC und DFS sind Pflicht.'
    ],
    fundstelle: 'Vfg. 136/2022 i.d.F. Vfg. 49/2023'
  },
  /* Das Band, auf das es beim Richtfunk hinausläuft: als einziges lässt es
     Innenraum und Außenbereich zu und hat mit 30 dBm EIRP genug Abstand zum
     Antennengewinn einer Schüssel, dass eine Strecke davon übrig bleibt.
     Preis dafür sind TPC und DFS – im Wetterradarbereich räumt die Anlage die
     Frequenz, und das trifft eine stehende Strecke mitten im Einsatz. */
  {
    id: '5470',
    name: '5470–5725 MHz',
    kurz: '5,6 GHz',
    von: 5470, bis: 5725,
    art: 'az',
    eirp: 30,
    dichte: 17,
    dichteText: '50 mW/MHz (17 dBm/MHz)',
    tpc: true, dfs: true,
    ortsfestDraussen: true,
    ausschluss: null,
    vorbehalt: null,
    auflagen: [
      'Innenraum und Außenbereich zulässig.',
      'TPC und DFS sind Pflicht.',
      'In Straßenfahrzeugen nur 200 mW im Slave-Modus unter einem ortsfesten DFS-Master.'
    ],
    fundstelle: 'Vfg. 136/2022 i.d.F. Vfg. 49/2023'
  },
  /* Die vier Watt dieses Bandes sehen nach der Lösung aus und sind keine: die
     Zuteilung ist an einen Zweck gebunden, den eine THW-Einsatzstrecke nicht
     erfüllt. Der Eintrag steht deshalb hier, damit die Zahl nicht ohne die
     Bindung gefunden wird. */
  {
    id: '5755',
    name: '5755–5875 MHz (BFWA)',
    kurz: 'BFWA',
    von: 5755, bis: 5875,
    art: 'az',
    eirp: 36,
    dichte: 23,
    dichteText: '23 dBm/MHz bei Punkt-zu-Punkt, 20 dBm/MHz im Mesh',
    tpc: true, dfs: true,
    ortsfestDraussen: false,
    ausschluss: 'Zweckbindung: zugeteilt für „gewerblich öffentliche, breitbandige, ' +
      'ortsfeste Verteilsysteme“. Eine THW-interne Einsatzstrecke ist weder gewerblich ' +
      'noch öffentlich; für gewerblich öffentliche Telekommunikationsnetze bestünde ' +
      'zudem Meldepflicht. Für das THW nicht einschlägig.',
    vorbehalt: null,
    auflagen: [
      'Punkt-zu-Punkt 36 dBm (4 W) EIRP; Mesh-Betrieb 33 dBm EIRP.',
      'TPC mit einem Regelbereich von 12 dB.',
      'DFS im Bereich 5755–5850 MHz.',
      'Funkanlagen nach EN 302 502.'
    ],
    fundstelle: 'Vfg. 34/2017'
  },
  {
    id: '5945',
    name: '5945–6425 MHz',
    kurz: '6 GHz',
    von: 5945, bis: 6425,
    art: 'az',
    eirp: 23,
    dichte: 10,
    dichteText: '10 dBm/MHz (LPI)',
    tpc: false, dfs: false,
    ortsfestDraussen: false,
    ausschluss: 'Kein Einsatz im Außenbereich, auch nicht in Straßenfahrzeugen. Das Gerät ' +
      'muss eine integrierte Antenne haben und über Kabel mit Strom versorgt sein – eine ' +
      'ortsfeste 6-GHz-Strecke im Freien ist damit unzulässig.',
    vorbehalt: null,
    auflagen: [
      'LPI 23 dBm EIRP, Dichte 10 dBm/MHz: nur im Innenraum, integrierte Antenne, ' +
        'Stromversorgung über Kabel.',
      'VLP 14 dBm EIRP: tragbare Geräte.'
    ],
    fundstelle: 'Vfg. 76/2025'
  },
  /* Nachrichtlich, weil das THW BOS-berechtigt ist und in diesen beiden
     Zuteilungen sucht, wer im WLAN-Bereich nicht weiterkommt. Beide sind kein
     Ausweg, und genau das ist ihr Inhalt – die Zahlen stehen nur daneben,
     damit erkennbar ist, wovon die Rede war.

     Ihre Leistungsangaben sind Dichten und Kanalsummen, keine mittlere EIRP
     einer Funkstelle; „eirp“ bleibt deshalb leer und die EIRP-Prüfung greift
     hier nicht. Was gilt, steht im Klartext in den Auflagen. */
  {
    id: 'bos5150',
    name: 'BOS 5150–5250 MHz',
    kurz: 'BOS 5,2',
    von: 5150, bis: 5250,
    art: 'bos',
    eirp: null,
    dichte: null,
    dichteText: 'Basisstationen 400 mW/MHz, Endgeräte 20 mW/MHz',
    tpc: false, dfs: false,
    ortsfestDraussen: false,
    ausschluss: '„Frequenznutzungen für feste Funkverbindungen sind nicht zulässig.“ – ' +
      'damit scheidet die ortsfeste Richtfunkstrecke aus, obwohl das THW im ' +
      'Teilnehmerkreis steht.',
    vorbehalt: null,
    auflagen: [
      'Das THW steht ausdrücklich im Teilnehmerkreis.',
      'Basisstationen 400 mW/MHz Leistungsdichte, in der Summe höchstens 8 W EIRP je Kanal.',
      'Endgeräte 20 mW/MHz, höchstens 400 mW je Kanal.',
      'Funkanlagen nach ETSI EN 302064.'
    ],
    fundstelle: 'Verwaltungsvorschriften BOS'
  },
  {
    id: 'bos14250',
    name: 'BOS-Richtfunk 14250–14500 MHz',
    kurz: 'BOS 14',
    von: 14250, bis: 14500,
    art: 'bos',
    /* 29 dBW sind 59 dBm; die Verfügung nennt beide Schreibweisen, hier steht
       die, in der das Modul rechnet. */
    eirp: 59,
    dichte: null,
    dichteText: null,
    tpc: false, dfs: false,
    ortsfestDraussen: false,
    ausschluss: 'Kein WLAN-Band: Punkt-zu-Punkt-Richtfunk nach ETSI EN 302 217 mit ' +
      'eigenem Gerät und eigenem Kanalraster, nicht mit WLAN-Ausrüstung zu betreiben.',
    vorbehalt: null,
    auflagen: [
      'Nur Punkt-zu-Punkt.',
      'Höchstens 790 W (29 dBW) EIRP, Senderausgangsleistung höchstens 250 mW.',
      'Kanalraster 14 bis 20 MHz.',
      'Funkanlagen nach ETSI EN 302 217, Planung nach CEPT/ERC/REC 12-07.',
      'Das THW steht im Teilnehmerkreis.'
    ],
    fundstelle: 'Verwaltungsvorschriften BOS'
  }
];

export const BAND_STANDARD = '5470';

/** Band zu einer Kennung; unbekannte Kennungen fallen auf 5470–5725 MHz zurück. */
export const bandById = id =>
  BAENDER.find(b => b.id === id) ||
  BAENDER.find(b => b.id === BAND_STANDARD);

/* Band zu einer Kanalmittenfrequenz in MHz. Nur Allgemeinzuteilungen kommen in
   Frage: die BOS-Einträge überlappen 5150–5250 MHz und würden eine Kanalangabe
   sonst der falschen Fundstelle zuordnen. */
export const bandFuerFrequenz = mhz => {
  const f = Number(mhz);
  if (!isFinite(f)) return null;
  return BAENDER.find(b => b.art === 'az' && f >= b.von && f <= b.bis) || null;
};

// ---------------------------------------------------------------- BEMFV

/* Eine ortsfeste Funkanlage ab 10 W EIRP darf nur mit gültiger
   Standortbescheinigung betrieben werden; die Schwelle greift auch für die
   einzelne kleinere Anlage, sobald die Gesamtstrahlungsleistung am Standort
   10 W erreicht – auf einem Bauplatz mit mehreren Anlagen ist das die
   eigentliche Falle.

   ACHTUNG: Dieser Wert ist aus zweiter Hand und wurde – anders als die
   Verfügungen oben – nicht im Volltext gelesen. Vor Verwendung prüfen. */
export const STANDORTBESCHEINIGUNG_AB_DBM = 40;   // 10 W EIRP

export const STANDORTBESCHEINIGUNG_FUNDSTELLE = 'BEMFV (aus zweiter Hand, vor Verwendung prüfen)';

/** Hinweis zur Standortbescheinigung; `null`, solange keine EIRP vorliegt. */
export function standortbescheinigung(eirpDbm) {
  const e = Number(eirpDbm);
  if (!isFinite(e)) return null;
  const noetig = e >= STANDORTBESCHEINIGUNG_AB_DBM;
  return {
    noetig,
    schwelle: STANDORTBESCHEINIGUNG_AB_DBM,
    text: noetig
      ? 'Ortsfeste Anlage ab 10 W EIRP: nur mit gültiger Standortbescheinigung zu betreiben.'
      : 'Unter 10 W EIRP; die Schwelle gilt aber auch, wenn erst die Summe aller Anlagen ' +
        'am Standort 10 W erreicht.',
    fundstelle: STANDORTBESCHEINIGUNG_FUNDSTELLE
  };
}

// ------------------------------------------------------------ dBm und mW

export const dbmZuMw = dbm => {
  const d = Number(dbm);
  return isFinite(d) ? Math.pow(10, d / 10) : null;
};

export const mwZuDbm = mw => {
  const m = Number(mw);
  return isFinite(m) && m > 0 ? 10 * Math.log10(m) : null;
};

/* Die vier Werte, die in den Verfügungen immer wiederkehren. Sie stehen hier
   als Tabelle, damit die Oberfläche sie zeigen kann, ohne dass jemand den
   Zusammenhang zwischen Skala und Milliwatt im Kopf haben muss. */
export const MERKPOSTEN = [
  { mw: 100,  dbm: 20 },
  { mw: 200,  dbm: 23 },
  { mw: 1000, dbm: 30 },
  { mw: 4000, dbm: 36 }
];

// ------------------------------------------------------------- Prüfungen

/* Ohne TPC sind die höchstzulässige mittlere EIRP und die höchstzulässige
   EIRP-Dichte um 3 dB zu verringern (Vfg. 136/2022 i.d.F. Vfg. 49/2023). Der
   Abzug trifft beide Grenzen, nicht nur die Gesamtleistung. */
export const TPC_ABZUG_DB = 3;

export const TPC_FUNDSTELLE = 'Vfg. 136/2022 i.d.F. Vfg. 49/2023';

/* Bei MIMO zählt die Summe über alle Ketten der Funkstelle, nicht die Leistung
   einer Kette: zwei Ketten sind 3 dB, vier Ketten 6 dB mehr EIRP. Wer je Kette
   bis an die Grenze stellt, steht mit 4×4 um 6 dB darüber. */
export const kettenZuschlag = ketten => {
  const n = Math.max(1, Math.round(Number(ketten) || 1));
  return 10 * Math.log10(n);
};

/**
 * EIRP-Prüfung einer Funkstelle gegen die Grenzwerte ihres Bandes.
 *
 * @param {object} v  band, sendeleistung (dBm), antennengewinn (dBi),
 *                    kabeldaempfung (dB), bandbreite (MHz), ketten, tpc
 * @returns {object|null} `null`, wenn das Band keine mittlere EIRP kennt
 *                        (die BOS-Zuteilung 5150–5250 MHz) oder keine
 *                        Sendeleistung angegeben ist
 */
/* `Number(null)` und `Number('')` sind 0 und damit endlich – ein leeres Feld
   käme so als „0 dBm“ durch und die Prüfung meldete brav, die Strecke halte die
   Grenze ein. Eine Zusage aus lauter Leerstellen ist schlimmer als gar keine,
   deshalb wird hier zwischen „nicht angegeben“ und „null“ unterschieden. */
const angegeben = w => w !== null && w !== undefined && w !== '' && isFinite(Number(w));

export function eirpPruefung(v) {
  const band = bandById(v && v.band);
  if (band.eirp === null) return null;
  /* Gewinn und Sendeleistung müssen beide dastehen: die Grenze gilt für die
     abgestrahlte Leistung, und die ist ohne Antenne keine Größe. Die
     Zuleitungsdämpfung darf dagegen fehlen – sie zu übergehen rechnet zu
     ungunsten des Planers und liegt damit auf der sicheren Seite. */
  if (!angegeben(v && v.sendeleistung) || !angegeben(v && v.antennengewinn)) return null;
  const sende = Number(v.sendeleistung);

  /* Ohne ausdrückliche Angabe wird ohne TPC gerechnet – das ist die sichere
     Seite; die 3 dB fehlen sonst erst auf dem Bauplatz. */
  const tpc = v.tpc === true;
  const abzug = tpc ? 0 : TPC_ABZUG_DB;
  const grenzeGesamt = band.eirp - abzug;
  const grenzeDichte = band.dichte === null ? null : band.dichte - abzug;

  const mhz = Math.max(0, Number(v.bandbreite) || 0);
  /* Die Dichte wird über die Kanalbandbreite auf einen Gesamtwert gebracht:
     ein 20-MHz-Kanal darf 13 dB mehr führen als ein einzelnes Megahertz. Ohne
     Bandbreitenangabe ist die Dichte nicht zu prüfen – dann bindet allein der
     Gesamtwert, und das gehört in der Ausgabe gesagt. */
  const grenzeAusDichte = grenzeDichte === null || mhz <= 0
    ? Infinity
    : grenzeDichte + 10 * Math.log10(mhz);

  const grenze = Math.min(grenzeGesamt, grenzeAusDichte);
  const massgebend = grenzeAusDichte < grenzeGesamt - 1e-9 ? 'dichte'
    : (grenzeGesamt < grenzeAusDichte - 1e-9 ? 'gesamt' : 'beide');

  const gewinn = Number(v.antennengewinn) || 0;
  const kabel = Math.max(0, Number(v.kabeldaempfung) || 0);
  const zuschlag = kettenZuschlag(v.ketten);

  const eirp = sende - kabel + gewinn + zuschlag;
  const eirpDichte = mhz > 0 ? eirp - 10 * Math.log10(mhz) : null;
  const ueber = eirp - grenze;

  /* Die Zahl, um die es geht: was am Gerät je Kette eingestellt werden darf.
     Das Gefälle ist steil – im Band 5470–5725 MHz liegt eine Funkstelle mit
     27 dBm schon bei 3,5 dBi Antennengewinn über den 30 dBm, und hinter einer
     23-dBi-Schüssel bleiben 7 dBm, also rund 20 dB weniger. Wer aus der
     Sendeleistung des Gerätes heraus plant statt aus der EIRP-Grenze herunter,
     plant an der Zulässigkeit vorbei. */
  const hoechstSendeleistung = grenze - gewinn + kabel - zuschlag;

  return {
    band,
    sendeleistung: sende, antennengewinn: gewinn, kabeldaempfung: kabel,
    bandbreite: mhz || null, ketten: Math.max(1, Math.round(Number(v.ketten) || 1)),
    kettenZuschlag: zuschlag,
    tpc, tpcAbzug: abzug, tpcFundstelle: TPC_FUNDSTELLE,
    eirp, eirpDichte,
    grenzeGesamt, grenzeDichte, grenzeAusDichte, grenze, massgebend,
    passt: ueber <= 1e-9,
    ueber: Math.max(0, ueber),
    hoechstSendeleistung,
    reduktion: Math.max(0, sende - hoechstSendeleistung),
    standortbescheinigung: standortbescheinigung(eirp),
    fundstelle: band.fundstelle
  };
}

// -------------------------------------------------------- Bandauswahl

/* Für eine ortsfeste Strecke im Freien bleiben von den Allgemeinzuteilungen
   nur zwei Bänder übrig, und von diesen beiden trägt nur eines eine
   Richtantenne: 2400–2483,5 MHz ist zwar draußen und ortsfest zugelassen,
   seine 20 dBm EIRP sind aber der Gesamtwert einschließlich Antennengewinn und
   von einer Schüssel allein aufgebraucht. Bleibt 5470–5725 MHz. */
export const HINWEIS_FESTE_STRECKE =
  'Für eine ortsfeste WLAN-Richtfunkstrecke im Freien bleibt in Deutschland ' +
  'praktisch allein das Band 5470–5725 MHz (30 dBm EIRP, TPC und DFS Pflicht, ' +
  'Vfg. 136/2022 i.d.F. Vfg. 49/2023). 2400–2483,5 MHz ist draußen und ortsfest ' +
  'zwar zugelassen, seine 20 dBm EIRP gelten aber einschließlich Antennengewinn. ' +
  'Alle übrigen Bänder scheiden aus – der Grund steht bei jedem Band.';

/**
 * Bänder für eine ortsfeste Strecke im Freien, mit dem Grund des Ausschlusses
 * bei den übrigen. Jeder Eintrag trägt einen fertigen Satz für die Anzeige.
 */
export function bandauswahlFesteStrecke() {
  return BAENDER.map(b => {
    const werte = b.eirp === null
      ? (b.dichteText || '')
      : leistungText(b.eirp) + ' EIRP' + (b.dichte === null ? '' : ', Dichte ' + b.dichteText);
    const grenzen = werte ? werte + '.' : '';
    const funk = [b.tpc ? 'TPC' : null, b.dfs ? 'DFS' : null].filter(Boolean).join(' und ');
    const zulassung = b.ortsfestDraussen
      ? ['Ortsfest im Freien zulässig.', grenzen,
         funk ? funk + ' Pflicht.' : '', b.vorbehalt || '']
      : ['Nicht nutzbar: ' + b.ausschluss];
    return {
      id: b.id,
      name: b.name,
      kurz: b.kurz,
      geeignet: b.ortsfestDraussen,
      vorbehalt: b.vorbehalt,
      fundstelle: b.fundstelle,
      text: zulassung.filter(Boolean).join(' ') + ' (' + b.fundstelle + ')'
    };
  });
}

// ---------------------------------------------------------------- Ausgabe

const nf = (n, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/* „100 mW“, „1 W“ – Watt erst, wo die Milliwatt vierstellig würden. Grob
   gerundet, und zwar mit Absicht: 23 dBm sind 199,53 mW, und die Verfügung
   nennt sie 200 mW. Eine Nachkommastelle behauptete hier eine Genauigkeit,
   die im Rundungsschritt der Verfügung längst verlorengegangen ist. */
export function mwText(mw) {
  if (!isFinite(mw)) return '–';
  if (mw >= 1000) {
    const w = mw / 1000;
    return nf(w, w >= 100 ? 0 : (Math.round(w * 10) % 10 ? 1 : 0)) + ' W';
  }
  const m = Math.round(mw * 10) / 10;
  return nf(m, m < 100 && m % 1 ? 1 : 0) + ' mW';
}

/* „20 dBm“, „−3 dBm“ – halbe Dezibel nur, wo es sie gibt. Das Minus ist das
   typografische, nicht der Bindestrich: negative Sendeleistungen sind hier
   der Normalfall, sobald eine Schüssel an einem engen Band hängt. */
const minus = s => s.replace('-', '−');

export function dbmText(dbm) {
  if (!isFinite(dbm)) return '–';
  const d = Math.round(dbm * 10) / 10;
  return minus(nf(d, d % 1 ? 1 : 0)) + ' dBm';
}

/** „20 dBm (100 mW)“ – die Schreibweise der Verfügungen */
export function leistungText(dbm) {
  if (!isFinite(dbm)) return '–';
  return dbmText(dbm) + ' (' + mwText(dbmZuMw(dbm)) + ')';
}

/** Differenz in Dezibel mit Vorzeichen: „+2,5 dB“, „−20 dB“ */
export function abstandText(db) {
  if (!isFinite(db)) return '–';
  const d = Math.round(db * 10) / 10;
  return (d < 0 ? '−' : '+') + nf(Math.abs(d), Math.abs(d) % 1 ? 1 : 0) + ' dB';
}

/**
 * Leistungsdichte als Zahl: „17 dBm/MHz“ – nicht zu verwechseln mit dem
 * Wortlaut der Verfügung, der bei jedem Band in `dichteText` steht.
 */
export function dbmProMhzText(dbmProMhz) {
  if (!isFinite(dbmProMhz)) return '–';
  return dbmText(dbmProMhz).replace(' dBm', ' dBm/MHz');
}

/** Was die Grenze gesetzt hat – in Worten für Anzeige und Bauauftrag */
export function massgebendText(p) {
  if (!p) return '–';
  if (p.massgebend === 'dichte') return 'Leistungsdichte';
  if (p.massgebend === 'gesamt') return 'Gesamtwert';
  return 'Gesamtwert und Leistungsdichte';
}
