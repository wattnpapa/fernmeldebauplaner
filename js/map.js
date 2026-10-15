// map.js – Leaflet-Karte, Basiskarten, Panes

import { kachelHolen, kacheladresse } from './kacheln.js';

/* `vorrat: true` heißt: diese Karte darf für den Bauort mitgenommen werden.
   Es steht nur an den Ebenen des BKG. Deren Lizenz – dl-de/by-2-0 – erlaubt
   Vervielfältigung ausdrücklich. OpenStreetMap untersagt das Vorabladen in
   seiner Tile Usage Policy dagegen ebenso ausdrücklich (dort ist von mehr als
   250 Kacheln ab Zoomstufe 13 die Rede, und ein üblicher Vorrat liegt
   darüber), OpenTopoMap und die HOT-Kacheln liegen auf gespendeten Servern mit
   derselben Haltung, und für die Esri-Dienste gilt das Zwischenspeichern nach
   deren Nutzungsbedingungen als unzulässig. Eine Karte ohne dieses Kennzeichen
   wird nicht vorgeladen – die Anwendung sagt das und schlägt den Wechsel vor.

   Wer hier ein Kennzeichen ergänzt, prüft vorher die Bedingungen des Anbieters
   und trägt sie in `LIZENZEN.md` nach. Wer es weglässt, spart dem Anbieter
   nichts, sondern verlagert den Preis nur auf alle anderen Nutzer. */
export const BASISKARTEN = [
  {
    id: 'topplus',
    vorrat: true,
    name: 'TopPlusOpen (BKG)',
    grau: false,
    url: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://www.bkg.bund.de">BKG</a> (TopPlusOpen, dl-de/by-2-0)',
    maxZoom: 18
  },
  {
    id: 'topplus_grau',
    vorrat: true,
    name: 'TopPlusOpen grau (BKG)',
    grau: true,
    url: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://www.bkg.bund.de">BKG</a> (TopPlusOpen, dl-de/by-2-0)',
    maxZoom: 18
  },
  {
    id: 'topplus_light',
    vorrat: true,
    name: 'TopPlusOpen hell (BKG)',
    grau: false,
    url: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_light/default/WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://www.bkg.bund.de">BKG</a> (TopPlusOpen, dl-de/by-2-0)',
    maxZoom: 18
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    grau: false,
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
    maxZoom: 19
  },
  {
    id: 'topo',
    name: 'OpenTopoMap',
    grau: false,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), © OpenStreetMap',
    maxZoom: 17
  },
  {
    id: 'esri_topo',
    name: 'Topografisch (Esri)',
    grau: false,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap-Mitwirkende',
    maxZoom: 19
  },
  {
    id: 'osm_hot',
    name: 'OpenStreetMap Humanitär (HOT)',
    grau: false,
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, Kacheln <a href="https://www.hotosm.org">HOT</a> / <a href="https://www.openstreetmap.fr">OSM France</a>',
    maxZoom: 19
  },
  {
    id: 'luftbild',
    name: 'Luftbild (Esri)',
    grau: false,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Luftbild © Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    dunkel: true
  },
  {
    id: 'dop',
    name: 'Luftbild Länder (DOP 20 cm)',
    grau: false,
    /* Kein einzelner Kacheldienst: die Orthophotos kommen je Land vom eigenen
       WMS, siehe DOP_LAENDER. url bleibt leer, setzeBasiskarte baut das Bündel. */
    dop: true,
    url: '',
    attribution: 'Luftbild © Landesvermessungen',
    maxZoom: 20,
    dunkel: true
  },
  {
    id: 'basemapde',
    vorrat: true,
    name: 'basemap.de (BKG)',
    grau: false,
    /* Kachelmatrix GLOBAL_WEBMERCATOR, nicht DE_EPSG_3857_ADV: die AdV-Matrix ist
       zwar ebenfalls Web-Mercator, hat aber einen eigenen Ursprung und eigene
       Kachelnummern. Leaflet fragt mit den Standardnummern an und bekommt dann
       zu jeder Kachel nur eine leere Fläche zurück. */
    url: 'https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_farbe/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://basemap.de">basemap.de</a> / <a href="https://www.bkg.bund.de">BKG</a> (dl-de/by-2-0)',
    maxZoom: 19
  },
  {
    id: 'basemapde_grau',
    vorrat: true,
    name: 'basemap.de grau (BKG)',
    grau: true,
    url: 'https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_grau/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://basemap.de">basemap.de</a> / <a href="https://www.bkg.bund.de">BKG</a> (dl-de/by-2-0)',
    maxZoom: 19
  }
];


/* Orthophotos der Landesvermessungen. Das BKG bündelt die DOP zwar bundesweit,
   gibt den Dienst aber nicht frei (403 ohne Vertrag) – also je Land der offene
   WMS, jeweils mit Ebenenname, Quellenvermerk laut Lizenz und dem Umgriff in
   WGS84 [[süd, west], [nord, ost]]. Der Umgriff ist großzügig: Leaflet fragt nur
   innerhalb an, ein zu knapper Rahmen ließe am Rand weiße Kacheln. Reihenfolge
   ist Zeichenreihenfolge – die Stadtstaaten stehen zuletzt, damit sie über
   dem umgebenden Flächenland liegen (Brandenburgs Dienst deckt Berlin mit ab).
   Stand der Adressen: September 2026. */
export const DOP_LAENDER = [
  { kuerzel: 'BW', name: 'Baden-Württemberg',      quelle: 'LGL Baden-Württemberg',       lizenz: 'dl-de/by-2-0',
    url: 'https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DOP_20_C', layers: 'IMAGES_DOP_20_RGB',
    bbox: [[47.5, 7.5], [49.8, 10.5]] },
  { kuerzel: 'BY', name: 'Bayern',                 quelle: 'Bayerische Vermessungsverwaltung', lizenz: 'CC BY 4.0',
    url: 'https://geoservices.bayern.de/od/wms/dop/v1/dop20', layers: 'by_dop20c',
    bbox: [[47.27, 8.97], [50.56, 13.84]] },
  { kuerzel: 'BB', name: 'Brandenburg',            quelle: 'GeoBasis-DE/LGB',             lizenz: 'dl-de/by-2-0',
    url: 'https://isk.geobasis-bb.de/mapproxy/dop20c/service/wms', layers: 'bebb_dop20c',
    bbox: [[51.36, 11.26], [53.56, 14.77]] },
  { kuerzel: 'HE', name: 'Hessen',                 quelle: 'HVBG Hessen',                 lizenz: 'dl-de/zero-2-0',
    url: 'https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-images.ows', layers: 'he_dop_rgb',
    bbox: [[49.39, 7.77], [51.66, 10.24]] },
  { kuerzel: 'MV', name: 'Mecklenburg-Vorpommern', quelle: 'GeoBasis-DE/M-V',             lizenz: 'dl-de/by-2-0',
    url: 'https://www.geodaten-mv.de/dienste/adv_dop', layers: 'mv_dop',
    bbox: [[53.11, 10.59], [54.69, 14.41]] },
  { kuerzel: 'NI', name: 'Niedersachsen',          quelle: 'LGLN Niedersachsen',          lizenz: 'CC BY 4.0',
    url: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms', layers: 'ni_dop20',
    bbox: [[51.29, 6.65], [53.9, 11.6]] },
  { kuerzel: 'NW', name: 'Nordrhein-Westfalen',    quelle: 'GeoBasis NRW',                lizenz: 'dl-de/zero-2-0',
    url: 'https://www.wms.nrw.de/geobasis/wms_nw_dop', layers: 'nw_dop_rgb',
    bbox: [[50.32, 5.87], [52.53, 9.46]] },
  { kuerzel: 'RP', name: 'Rheinland-Pfalz',        quelle: 'GeoBasis-DE/LVermGeoRP',      lizenz: 'dl-de/by-2-0',
    url: 'https://geo4.service24.rlp.de/wms/rp_dop20.fcgi', layers: 'rp_dop20',
    bbox: [[48.97, 6.11], [50.94, 8.51]] },
  { kuerzel: 'SL', name: 'Saarland',               quelle: 'GeoBasis-DE/LVGL Saarland',   lizenz: 'dl-de/by-2-0',
    url: 'https://geoportal.saarland.de/freewms/dop', layers: 'sl_dop',
    bbox: [[49.11, 6.36], [49.64, 7.4]] },
  { kuerzel: 'SN', name: 'Sachsen',                quelle: 'GeoSN',                       lizenz: 'dl-de/by-2-0',
    url: 'https://geodienste.sachsen.de/wms_geosn_dop-rgb/guest', layers: 'sn_dop_020',
    bbox: [[50.17, 11.87], [51.69, 15.04]] },
  { kuerzel: 'ST', name: 'Sachsen-Anhalt',         quelle: 'GeoBasis-DE/LVermGeo ST',     lizenz: 'dl-de/by-2-0',
    url: 'https://www.geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_DOP_WMS_OpenData/guest', layers: 'lsa_lvermgeo_dop20_2',
    bbox: [[50.94, 10.56], [53.04, 13.19]] },
  { kuerzel: 'SH', name: 'Schleswig-Holstein',     quelle: 'GeoBasis-DE/LVermGeo SH',     lizenz: 'CC BY 4.0',
    url: 'https://dienste.gdi-sh.de/WMS_SH_DOP20col_OpenGBD', layers: 'sh_dop20_rgb',
    bbox: [[53.36, 7.87], [55.06, 11.31]] },
  { kuerzel: 'TH', name: 'Thüringen',              quelle: 'GDI-Th',                      lizenz: 'dl-de/by-2-0',
    url: 'https://www.geoproxy.geoportal-th.de/geoproxy/services/DOP20', layers: 'th_dop',
    bbox: [[50.2, 9.88], [51.65, 12.65]] },
  { kuerzel: 'BE', name: 'Berlin',                 quelle: 'GeoBasis-DE/Berlin',          lizenz: 'dl-de/zero-2-0',
    url: 'https://gdi.berlin.de/services/wms/truedop_2024', layers: 'truedop_2024',
    bbox: [[52.33, 13.08], [52.68, 13.77]] },
  { kuerzel: 'HB', name: 'Bremen',                 quelle: 'Landesamt GeoInformation Bremen', lizenz: 'CC BY 4.0',
    url: 'https://geodienste.bremen.de/wms_dop20_2023', layers: 'DOP20_2023_HB,DOP20_2023_BHV',
    bbox: [[53.01, 8.48], [53.61, 8.99]] },
  { kuerzel: 'HH', name: 'Hamburg',                quelle: 'Freie und Hansestadt Hamburg, LGV', lizenz: 'dl-de/by-2-0',
    // Hamburg führt nur noch die Zeitreihe; ohne TIME-Parameter liefert sie den jüngsten Jahrgang.
    url: 'https://geodienste.hamburg.de/wms_dop_zeitreihe_unbelaubt', layers: 'dop_zeitreihe_unbelaubt',
    bbox: [[53.39, 9.73], [53.75, 10.33]] }
];

/** Länder, deren Orthophoto-Umgriff einen der Punkte ([lat, lng] oder
 *  LatLngBounds) berührt – in der Reihenfolge von DOP_LAENDER. */
export function dopLaenderFuer(orte) {
  const liste = Array.isArray(orte) ? orte : [orte];
  return DOP_LAENDER.filter(l => {
    const b = L.latLngBounds(l.bbox);
    return liste.some(o => (o instanceof L.LatLngBounds) ? b.intersects(o) : b.contains(L.latLng(o)));
  });
}

/** Quellenvermerk fürs Länder-Luftbild – die Lizenzen verlangen den Namen der
 *  jeweiligen Landesvermessung, also nur die, deren Bilder tatsächlich zu sehen
 *  sind. Außerhalb Deutschlands gibt es nichts zu nennen. */
export function dopQuellenangabe(orte) {
  const laender = dopLaenderFuer(orte);
  if (!laender.length) return 'Luftbild: kein Landes-Orthophoto für diesen Ausschnitt';
  return 'Luftbild © ' + laender.map(l => `${l.quelle} (${l.lizenz})`).join(', ');
}

/** Obergrenze fürs Hineinzoomen. Liegt bewusst über der feinsten Kachelstufe
 *  (17–19 je Quelle): beim Planen einer Muffe oder eines Endverzweigers reicht
 *  die Kartenauflösung oft nicht, um die Punkte auseinanderzuhalten. Ab
 *  maxNativeZoom streckt Leaflet die letzte scharfe Kachel – unscharf, aber
 *  brauchbar. */
export const MAX_ZOOM = 22;

export const basiskarteById = id => BASISKARTEN.find(b => b.id === id) || BASISKARTEN[0];

/** Graustufen-Pendant zu einer Basiskarte (für den S/W-Druck).
 *  Bewusst über die Kachelquelle und nicht über einen CSS-Filter: Firefox gibt
 *  gefilterte Seitenbereiche beim Drucken nicht aus, die Karte fehlt dann im PDF.
 *  basemap.de bringt eine eigene graue Ausgabe mit; wer damit plant, soll im
 *  Druck dieselbe Kartengrafik wiederfinden. Für das Luftbild gibt es keine
 *  graue Quelle – Esri wie Länder-Orthophotos bleiben, wie sie sind. */
export function grauVariante(id) {
  if (id === 'luftbild' || id === 'dop') return id;
  if (id === 'basemapde' || id === 'basemapde_grau') return 'basemapde_grau';
  return 'topplus_grau';
}

/* Wer im Reiter „Strecken“ arbeitet, greift nach Trassenpunkten, nicht nach
   Lichtbildern – liegen beide dicht beieinander, fing bisher immer die
   Bildmarke den Klick, weil ihre Ebene höher liegt. Deshalb wandern die Griffe
   über die Bildmarken, solange Strecken oder Flächen bearbeitet werden, und
   fallen danach zurück. Nur die Griffebene bewegt sich: die taktischen Zeichen
   bleiben oben, das Lagebild geht weiter vor. */
const GRIFFE_UNTEN = 470;
const GRIFFE_UEBER_BILDERN = 631;

export function erstelleKarte(el, ansicht = {}) {
  const karte = L.map(el, {
    center: [ansicht.lat ?? 51.1657, ansicht.lng ?? 10.4515],
    zoom: ansicht.zoom ?? 6,
    zoomControl: false,
    attributionControl: true,
    doubleClickZoom: false,
    maxZoom: MAX_ZOOM,
    preferCanvas: false
  });
  /* Nur die Arbeitskarte gibt einem hängenden Kartenserver eine Frist (siehe
     `ABRUF_FRIST` bei der Kachelebene); Druckkarten warten auf jede Kachel. */
  karte._fbpAnzeige = true;

  /* Die Funksichtfläche liegt unter allem, was geplant wird: sie ist
     Kartengrundlage, kein Planungsinhalt. Läge sie darüber, verdeckte sie
     ausgerechnet die Strecken, deren Machbarkeit sie beurteilen soll. */
  karte.createPane('fbp-schatten').style.zIndex = 405;
  karte.getPane('fbp-schatten').style.pointerEvents = 'none';
  /* Die Flächen liegen unter den Strecken: sie sind Grundriss, die Trasse
     läuft darüber – ein Kabel, das in den Anhänger führt, endet auf ihm. */
  karte.createPane('fbp-flaechen').style.zIndex = 410;
  karte.createPane('fbp-strecken').style.zIndex = 420;
  karte.createPane('fbp-griffe').style.zIndex = GRIFFE_UNTEN;
  karte.createPane('fbp-labels').style.zIndex = 620;
  karte.getPane('fbp-labels').style.pointerEvents = 'none';
  /* Die Streckenschilder liegen über den Griffen, auch wenn die im Reiter
     „Strecken“ nach vorn rücken (`setzeVorrang`): im Review lag „neu“ an der
     Standmarke unter einer Punktmarke der Nachbarstrecke, und genau dieses
     Wort sollte die Führungsstelle auf der Karte finden. Getippt wird durch
     das Schild hindurch – die Ebene nimmt keine Zeigerereignisse an. */
  karte.createPane('fbp-schilder').style.zIndex = 636;
  karte.getPane('fbp-schilder').style.pointerEvents = 'none';
  /* Die Lichtbilder liegen unter den taktischen Zeichen: das Lagebild geht
     vor, die Bilder belegen es. */
  karte.createPane('fbp-bilder').style.zIndex = 630;
  karte.createPane('fbp-zeichen').style.zIndex = 640;

  L.control.zoom({ position: 'topright', zoomInTitle: 'Vergrößern', zoomOutTitle: 'Verkleinern' }).addTo(karte);
  L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 160 }).addTo(karte);

  /* Die Verweise im Kartenvermerk öffnen ein eigenes Fenster. Leaflet setzt
     keins, und im Audit führte ein Handschuhtipp auf den oberen Rand von
     „Fertig“ über den Vermerk „Leaflet“ aus der Anwendung – mitten in der
     Punktaufnahme, und ohne Netz auf eine Fehlerseite. Gesetzt wird beim
     Tipp, weil Leaflet den Vermerk bei jedem Kartenwechsel neu schreibt. */
  karte.getContainer().addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('.leaflet-control-attribution a');
    if (a) { a.target = '_blank'; a.rel = 'noopener'; }
  }, true);

  setzeBasiskarte(karte, ansicht.basemap || 'topplus');
  return karte;
}

/** Vorrang auf der Karte nach dem Reiter, in dem gearbeitet wird – `bereich`
 *  ist der Reitername. */
export function setzeVorrang(karte, bereich) {
  const griffe = karte.getPane('fbp-griffe');
  if (!griffe) return;
  const vorn = bereich === 'strecken' || bereich === 'flaechen';
  griffe.style.zIndex = vorn ? GRIFFE_UEBER_BILDERN : GRIFFE_UNTEN;
}

/* Wie viele Stufen gröber eine Ersatzkachel sein darf. Fünf reichen von der
   feinsten Stufe der Ebene (18) bis zur gröbsten des Vorrats (13); darunter
   ist ein Ausschnitt aus 32 × 32 Bildpunkten nur noch Farbe. */
const ERSATZ_STUFEN = 5;

/* Wie lange eine Kachel der Arbeitskarte auf den Kartenserver wartet, bevor
   die gröbere Stufe aus dem Vorrat einspringt. Ein Server, der die Verbindung
   annimmt und nie antwortet (überlasteter Anbieter, Funkloch mit stehendem
   Netzsymbol), löst weder `error` noch `navigator.onLine === false` aus: die
   Fläche blieb bei Stufe 18 grau, und die Leiste schwieg. Die Frist ist kurz,
   weil am Bauort jede Sekunde Grau eine ist, in der niemand die Karte lesen
   kann – und nur für die Arbeitskarte: der Bauauftrag wartet lieber auf die
   feine Kachel, als gröber auszudrucken. */
const ABRUF_FRIST = 4000;

/* Der zweite Anlauf für eine Kachel, die nur gröber da ist, darf länger warten
   als der erste: er läuft unsichtbar nebenher, und die Fläche zeigt solange das
   unscharfe Bild. Die vier Sekunden des ersten Anlaufs waren für eine langsame,
   aber lebende Verbindung zu knapp und brachen den Abruf ab – ohne Neuversuch
   blieb die Kachel dann unscharf, bis jemand schob oder zoomte. */
const NACHLADE_FRIST = 20000;

/* Wann der Nachversuch für gröbere Kacheln wiederholt wird, wenn der erste
   nicht ankam: 15 s, 45 s, 2 min nach dem jeweils letzten Lauf, danach nur
   noch bei einem Ereignis (Netz zurück, eine Kachel kommt doch aus dem Netz,
   neuer Ausschnitt). Der eine Versuch von früher gab auf: antwortete der
   Server erst nach der Frist, blieben 17 von 29 Kacheln unscharf, auch nach
   dem Verschieben, und die Leiste meldete „gröber“ ohne Aussicht auf Besserung.
   Eine feste Folge und kein Dauerfeuer, weil jeder Lauf das Gerät am Netz hält
   und ein Server, der Kacheln nicht führt, nicht belagert werden soll. */
const NACHLADE_PAUSEN = [15000, 45000, 120000];

/* Eine Kachelebene, die erst im Vorrat des Geräts nachsieht und nur dann ins
   Netz geht, wenn dort nichts liegt.

   Warum in der Seite und nicht im Service Worker: der Vorrat liegt in
   IndexedDB, und ein Service Worker, der ihn mitliest, müsste dieselbe
   Datenbank ein zweites Mal öffnen und bei jeder Schemaänderung nachgezogen
   werden. Hier steht die Entscheidung dort, wo auch die Karte steht.

   Die Blob-Adresse wird erst freigegeben, wenn Leaflet die Kachel wieder
   abräumt (`tileunload`) oder ihren Abruf abbricht (`tileabort`), und
   ausdrücklich NICHT schon beim Laden des Bildes.
   Ein geladenes Bild zeigt zwar weiter, was es decodiert hat – aber nicht
   verlässlich: beim Drucken wird die Karte neu gerastert, und eine tote Adresse
   liefert dann eine leere Fläche. Das gedruckte Blatt ist das Erzeugnis dieser
   Anwendung; ein Bauauftrag mit weißen Löchern in der Karte wäre der schlechteste
   denkbare Tausch gegen etwas Arbeitsspeicher. */
function vorratsEbene(url, optionen) {
  const Ebene = L.TileLayer.extend({
    createTile(koordinaten, fertig) {
      const bild = document.createElement('img');
      bild.alt = '';
      const adresse = this.getTileUrl(koordinaten);
      bild._fbpAdresse = adresse;
      let ersatzVersucht = false;
      let abrufUhr = null;
      /* Leaflet erwartet je Kachel genau einen Abschluss. Mit der Frist kann
         das Bild nach einem Fehlschlag des Rückgriffs doch noch aus dem Netz
         eintreffen – es erscheint dann, ohne die Ebene ein zweites Mal
         fertigzumelden. */
      let abgeschlossen = false;
      const abschluss = fehler => {
        clearTimeout(abrufUhr);
        if (abgeschlossen) return;
        abgeschlossen = true;
        fertig(fehler, bild);
      };
      L.DomEvent.on(bild, 'load', () => {
        abschluss(null);
        /* Kam eine Kachel doch aus dem Netz, lebt der Server – dann lohnt der
           zweite Anlauf für die, die an der Frist gescheitert waren. Entprellt,
           weil ein Ausschnitt seine Kacheln in Schüben bekommt. */
        if (!bild._fbpGrob && !bild._fbpBlobAdresse && this._map) {
          clearTimeout(this._nachladeUhr);
          this._nachladeUhr = setTimeout(() => this.nachladen(false), 2000);
          /* Der Server lebt: die Folge der Wiederholungen beginnt von vorn. */
          this._nachSchritt = 0;
        }
      });
      /* Kommt die Kachel weder aus dem Vorrat noch aus dem Netz, springt die
         gröbere Stufe aus dem Vorrat ein, bevor die Fläche grau bleibt. */
      L.DomEvent.on(bild, 'error', () => {
        if (bild._fbpWeg) return;
        if (ersatzVersucht) return abschluss(new Error('Kachel nicht verfügbar'));
        ersatzVersucht = true;
        clearTimeout(abrufUhr);
        this._ersatzSetzen(bild, koordinaten, 'fehler').then(da => {
          if (!da && !bild._fbpWeg) abschluss(new Error('Kachel nicht verfügbar'));
        });
      });
      const ausDemNetz = () => {
        /* Ohne Netz gar nicht erst fragen: der Abruf schlüge ohnehin fehl,
           und bis dahin stünde die Fläche leer, wo der Vorrat sie füllen kann. */
        if (navigator.onLine === false) {
          ersatzVersucht = true;
          this._ersatzSetzen(bild, koordinaten, 'fehler').then(da => {
            if (da || bild._fbpWeg) return;
            if (this.options.crossOrigin) bild.crossOrigin = this.options.crossOrigin;
            bild.src = adresse;
          });
          return;
        }
        /* `crossOrigin` gilt nur für den Weg übers Netz: bei einer
           Blob-Adresse ist es ohne Wirkung und bei manchen Browsern hinderlich. */
        if (this.options.crossOrigin) bild.crossOrigin = this.options.crossOrigin;
        bild.src = adresse;
        if (!this._map || !this._map._fbpAnzeige) return;
        abrufUhr = setTimeout(() => {
          if (bild._fbpWeg || abgeschlossen || ersatzVersucht) return;
          ersatzVersucht = true;
          this._ersatzSetzen(bild, koordinaten, 'frist').then(da => {
            if (bild._fbpWeg) return;
            /* Ein ersetzter Abruf endet nie in `error` – die Kachelwacht
               erfährt von der Frist nur hierüber. */
            if (da) this.fire('fbp:abrufstumm', { tile: bild });
            /* Ohne gröbere Stufe bleibt der Abruf stehen: kommt die Kachel
               doch noch, erscheint sie, aber gemeldet ist der Ausfall. */
            else abschluss(new Error('Kachelserver antwortet nicht'));
          });
        }, ABRUF_FRIST);
      };
      kachelHolen(adresse).then(blob => {
        /* Abgeräumt, bevor der Vorrat geantwortet hat. Dann darf hier nichts
           mehr geschehen: eine Blob-Adresse wäre ein Leck, das niemand mehr
           freigibt, und ein `src` aus dem Netz hebelte Leaflets Abbruch aus –
           beim Zoomen und beim Sammeldruck verwirft Leaflet laufend Kacheln,
           und jede davon zöge sonst nachträglich doch ihren Abruf. */
        if (bild._fbpWeg) return;
        if (blob) {
          bild._fbpBlobAdresse = URL.createObjectURL(blob);
          bild.src = bild._fbpBlobAdresse;
        } else {
          ausDemNetz();
        }
      }).catch(() => {
        if (bild._fbpWeg) return;
        ausDemNetz();
      });
      return bild;
    },

    /* Über der feinsten mitgenommenen Stufe war die Karte am Bauort weg: die
       Ebene fragt bis Stufe 18, der Vorrat reicht nach Vorgabe bis 17, und
       beim Einmessen einer Muffe wird genau dorthin gezoomt. Statt grau zu
       bleiben, zeigt die Kachel dann ihr Viertel (oder Sechzehntel …) aus der
       nächstgröberen Stufe, die im Vorrat liegt – unscharf, aber mit Weg und
       Haus an der richtigen Stelle. `maxNativeZoom` der Ebene auf die
       Vorratsstufe zu senken, hätte dasselbe gezeigt, aber auch mit Netz jede
       feinere Kachel verschenkt.

       Ausgeschnitten wird auf einer Leinwand und als Blob-Adresse übergeben,
       damit das Bild denselben Weg geht wie jede Kachel aus dem Vorrat – samt
       Freigabe beim Abräumen und ohne CSS-Filter, dessen Bereich Firefox beim
       Drucken weglässt. */
    async _ersatzSetzen(bild, { x, y, z }, grund) {
      for (let stufen = 1; stufen <= ERSATZ_STUFEN && z - stufen >= 0; stufen++) {
        const teiler = 2 ** stufen;
        const eltern = { x: Math.floor(x / teiler), y: Math.floor(y / teiler), z: z - stufen };
        /* Nicht `getTileUrl()`: Leaflet setzt dort die Stufe der Karte ein und
           nicht die der verlangten Kachel. `kacheladresse()` ist auch die
           Adresse, unter der „Karte holen“ abgelegt hat. */
        const blob = await kachelHolen(kacheladresse(this._url, eltern)).catch(() => null);
        if (bild._fbpWeg) return false;
        if (!blob) continue;
        try {
          const quelle = await createImageBitmap(blob);
          const kante = quelle.width / teiler;
          const leinwand = document.createElement('canvas');
          leinwand.width = leinwand.height = 256;
          leinwand.getContext('2d').drawImage(quelle,
            (x % teiler) * kante, (y % teiler) * kante, kante, kante, 0, 0, 256, 256);
          quelle.close?.();
          const ausschnitt = await new Promise(f => leinwand.toBlob(f, 'image/png'));
          if (!ausschnitt || bild._fbpWeg) return false;
          bild.removeAttribute('crossorigin');
          if (bild._fbpBlobAdresse) URL.revokeObjectURL(bild._fbpBlobAdresse);
          bild._fbpBlobAdresse = URL.createObjectURL(ausschnitt);
          bild.src = bild._fbpBlobAdresse;
          bild._fbpGrob = grund;
          if (this._map) this._map.fire('fbp:kachelgrob', { z, aus: z - stufen, grund });
          /* Aus der Frist heraus gibt es immer einen Nachversuch, auch wenn
             keine andere Kachel aus dem Netz kommt: genau dann hängt der
             Server, und kein `load` stößt das Nachladen an. */
          if (grund === 'frist') this._nachPlanen();
          return true;
        } catch (e) {
          return false;
        }
      }
      return false;
    },

    /* Die Kacheln, die nur gröber dastehen, noch einmal aus dem Netz holen –
       im Hintergrund, mit einem unsichtbaren Bild, und getauscht wird erst,
       wenn es da ist. Ein `redraw()` risse alle Kacheln ab und baute sie neu
       auf: die Fläche stünde einen Augenblick leer, und das mitten in einem
       Funkloch, das gerade endet. `alle` gilt nach der Rückkehr des Netzes für
       jede gröbere Kachel; sonst nur für die, die an der Frist gescheitert
       waren, und jede nur einmal – eine Kachel, die der Anbieter nicht führt,
       soll nicht bei jedem Schub erneut angefragt werden. */
    nachladen(modus) {
      const alle = modus === true;
      const runde = modus === 'runde';
      /* Nach der Rückkehr des Netzes beginnt die Folge der Wiederholungen neu. */
      if (alle) this._nachSchritt = 0;
      const laeufe = [];
      let angekommen = 0;
      for (const k in this._tiles) {
        const bild = this._tiles[k].el;
        if (!bild || bild._fbpWeg || !bild._fbpGrob || bild._fbpNachlauf) continue;
        /* `modus` false: die Kachel kommt erst jetzt dran, die Frist war ihr
           Grund. `'runde'` ist die zeitgesteuerte Wiederholung und fragt jede
           an der Frist gescheiterte Kachel erneut – die Folge begrenzt sie. */
        if (!alle) {
          if (bild._fbpGrob !== 'frist') continue;
          if (!runde && bild._fbpNachversucht) continue;
        }
        bild._fbpNachlauf = true;
        bild._fbpNachversucht = true;
        laeufe.push(new Promise(fertig => {
          const probe = new Image();
          if (this.options.crossOrigin) probe.crossOrigin = this.options.crossOrigin;
          const ende = geholt => {
            clearTimeout(uhr);
            probe.onload = probe.onerror = null;
            bild._fbpNachlauf = false;
            if (geholt && !bild._fbpWeg) {
              angekommen++;
              if (bild._fbpBlobAdresse) URL.revokeObjectURL(bild._fbpBlobAdresse);
              bild._fbpBlobAdresse = null;
              bild._fbpGrob = null;
              if (this.options.crossOrigin) bild.crossOrigin = this.options.crossOrigin;
              bild.src = bild._fbpAdresse;
            }
            fertig();
          };
          const uhr = setTimeout(() => { probe.src = ''; ende(false); }, NACHLADE_FRIST);
          /* Wird die Kachel abgeräumt (Zoomen, Verschieben), ist der Abruf für
             niemanden mehr: er gibt seine Verbindung frei, statt sie bis zur
             Frist zu halten und die Kacheln des neuen Ausschnitts auszubremsen. */
          bild._fbpNachladenAbbruch = () => { probe.src = ''; ende(false); };
          probe.onload = () => ende(true);
          probe.onerror = () => ende(false);
          probe.src = bild._fbpAdresse;
        }));
      }
      if (!laeufe.length) return Promise.resolve(0);
      return Promise.all(laeufe).then(() => {
        const offen = this.grobSichtbar();
        /* Ein Rest, der nur gröber dasteht, bekommt den nächsten Versuch nach
           der nächsten Pause; ist die Folge durch, sagt das Ereignis es. */
        const geplant = offen > 0 && this._nachPlanen();
        if (this._map) {
          this._map.fire('fbp:nachgeladen', { offen, angekommen, aufgegeben: offen > 0 && !geplant });
        }
        return offen;
      });
    },

    /* Wie viele der gröber gezeigten Kacheln im Bild stehen. Gezählt wird, was
       zu sehen ist: Leaflet hält Kacheln rund um den Ausschnitt vor, und eine
       gröbere am Rand, die niemand sieht, ließ die Leiste „gröber“ melden, obwohl
       das Bild scharf war – und umgekehrt blieb sie nach dem Verschieben stehen. */
    grobSichtbar() {
      if (!this._map) return 0;
      const rahmen = this._map.getContainer().getBoundingClientRect();
      let n = 0;
      for (const k in this._tiles) {
        const bild = this._tiles[k].el;
        if (!bild || bild._fbpWeg || !bild._fbpGrob) continue;
        const r = bild.getBoundingClientRect();
        if (r.right > rahmen.left && r.left < rahmen.right &&
            r.bottom > rahmen.top && r.top < rahmen.bottom) n++;
      }
      return n;
    },

    /* Den nächsten zeitgesteuerten Lauf anberaumen, falls die Folge noch nicht
       durch ist. @returns {boolean} ob einer steht */
    _nachPlanen() {
      if (this._nachUhr) return true;
      const pause = NACHLADE_PAUSEN[this._nachSchritt || 0];
      if (pause === undefined || !this._map) return false;
      this._nachSchritt = (this._nachSchritt || 0) + 1;
      this._nachUhr = setTimeout(() => {
        this._nachUhr = null;
        if (this._map) this.nachladen('runde');
      }, pause);
      return true;
    }
  });
  const ebene = new Ebene(url, optionen);
  /* Leaflet lässt eine Kachel auf zwei Wegen fallen: `tileunload` beim Abräumen
     einer fertigen, `tileabort` beim Zoomen einer, die noch lädt – dort löscht
     `_abortLoading` sie aus `_tiles`, ohne `tileunload` zu feuern. Nur beide
     zusammen erreichen jede erzeugte Adresse. Und die Marke muss auch dann
     fallen, wenn der Vorrat noch gar nicht geantwortet hat: sonst legt die
     laufende Lesung gleich darauf eine Adresse an, die niemand mehr freigibt. */
  const wegraeumen = e => {
    const bild = e.tile;
    if (!bild) return;
    bild._fbpWeg = true;
    if (bild._fbpNachlauf && bild._fbpNachladenAbbruch) bild._fbpNachladenAbbruch();
    if (bild._fbpBlobAdresse) {
      URL.revokeObjectURL(bild._fbpBlobAdresse);
      bild._fbpBlobAdresse = null;
    }
  };
  ebene.on('tileunload', wegraeumen);
  ebene.on('tileabort', wegraeumen);
  /* Ein neuer Ausschnitt oder eine neue Stufe lädt neue Kacheln: für sie
     beginnt die Folge der Wiederholungen neu. */
  ebene.on('loading', () => { ebene._nachSchritt = 0; });
  ebene.on('remove', () => {
    clearTimeout(ebene._nachUhr); ebene._nachUhr = null;
    clearTimeout(ebene._nachladeUhr);
  });
  return ebene;
}

/* Drei ausgefallene Kacheln als Schwelle: einzelne Löcher kommen im Betrieb
   vor – am Rand einer WMS-Abdeckung, bei einer Stufe, die der Anbieter nicht
   führt. Ohne Netz sind es dagegen sofort alle, und dann sagt `navigator.onLine`
   es ohnehin schon. */
const AUSFALL_AB = 3;

/* Ohne Netz blieb die Karte einfach grau. Der Ausfall ging an Leaflet und
   endete dort; am Bauort stand der Trupp vor einer leeren Fläche und hielt sie
   für einen Fehler der Anwendung – dabei liegt vielleicht ein Vorrat im Gerät.
   Gemeldet wird er als Ereignis an der Karte: WO er angezeigt wird, entscheidet
   die Oberfläche und nicht dieses Modul. Und er wird angezeigt, solange er
   dauert – eine Hinweispille wäre nach 3,2 s weg, der Zustand hält die ganze
   Baustelle. */
function kachelWacht(karte, ebene) {
  let fehler = 0;
  const melden = aus => {
    if (karte._fbpKachelAus === aus) return;
    karte._fbpKachelAus = aus;
    karte.fire('fbp:kachelnot', { aus });
  };
  const ebenen = ebene.getLayers ? ebene.getLayers() : [ebene];
  for (const e of ebenen) {
    /* Gezählt wird je Ladelauf und nicht über die Sitzung: nach drei Löchern
       am Rand einer Abdeckung bliebe die Anzeige sonst für immer stehen. */
    e.on('loading', () => { fehler = 0; });
    const ausgefallen = () => {
      fehler++;
      if (navigator.onLine === false || fehler >= AUSFALL_AB) melden(true);
    };
    e.on('tileerror', ausgefallen);
    e.on('fbp:abrufstumm', ausgefallen);
    /* Aufgehoben wird erst, wenn ein ganzer Lauf durch ist und dabei zu wenige
       Kacheln gefehlt haben. Auf jede einzelne angekommene Kachel zurück-
       zusetzen ließe die Anzeige flackern, sobald ein Vorrat den Ausschnitt
       nur teilweise deckt – und genau das ist am Bauort der Normalfall. */
    e.on('load', () => {
      if (fehler < AUSFALL_AB && navigator.onLine !== false) melden(false);
    });
  }
}

/** Nach der Rückkehr des Netzes: alle gröber gezeigten Kacheln neu holen */
export function kartenGrobSichtbar(karte) {
  const basis = karte._fbpBasis;
  if (!basis) return 0;
  const ebenen = basis.getLayers ? basis.getLayers() : [basis];
  return ebenen.reduce((n, e) => n + (e.grobSichtbar ? e.grobSichtbar() : 0), 0);
}

export function kartenNachladen(karte) {
  const basis = karte._fbpBasis;
  if (!basis) return Promise.resolve(0);
  const ebenen = basis.getLayers ? basis.getLayers() : [basis];
  return Promise.all(ebenen.filter(e => e.nachladen).map(e => e.nachladen(true)))
    .then(r => r.reduce((a, b) => a + b, 0));
}

export function setzeBasiskarte(karte, id) {
  const def = basiskarteById(id);
  if (karte._fbpBasis) {
    /* Die Horcher der vorigen Ebene abnehmen – `warteAufKacheln` hängt seine
       an `load`, die Kachelwacht ihre an `tileerror`. */
    karte._fbpBasis.off('load');
    karte._fbpBasis.off('tileerror');
    karte._fbpBasis.off('fbp:abrufstumm');
    karte.removeLayer(karte._fbpBasis);
    /* Der gemeldete Zustand gehört zur alten Ebene: die neue meldet ihn mit
       ihrer ersten Kachel neu, ob sie ankommt oder nicht. */
    karte._fbpKachelAus = undefined;
  }
  if (karte._fbpDopQuelle) { karte.off('moveend', karte._fbpDopQuelle); karte._fbpDopQuelle = null; }
  karte._fbpBasis = def.dop ? dopBuendel(karte, def) : vorratsEbene(def.url, {
    attribution: def.attribution,
    maxZoom: MAX_ZOOM,
    maxNativeZoom: def.maxZoom,
    /* Nur ein Unterserver statt der üblichen drei: die drei Buchstaben sind ein
       Erbe von HTTP/1.1 und seiner Grenze von sechs Verbindungen je Gegenstelle;
       über HTTP/2 bringen sie nichts mehr. Dem Vorrat ist die Wahl gleich –
       Leaflet greift den Buchstaben fest über |x+y| mod Anzahl heraus, jede
       Kachel liegt also ohnehin nur unter einer Adresse –, aber das eine `a`
       ist dasselbe, das `kacheladresse()` in `kacheln.js` einsetzt. */
    subdomains: def.url.includes('{s}') ? 'a' : [],
    crossOrigin: 'anonymous',
    className: 'fbp-basis',
    kartenId: def.id
  });
  kachelWacht(karte, karte._fbpBasis);
  karte._fbpBasis.addTo(karte);
  karte._fbpBasisId = id;
  document.body.classList.toggle('karte-dunkel', !!def.dunkel);
  // Das Koordinatengitter färbt sich nach der Unterlage und hört auf diesen
  // Wechsel – ein Projektereignis gibt es beim Kartenwechsel nicht.
  karte.fire('fbp:basiskarte', { id });
  return def;
}

/* Ein WMS je Land, per bounds auf den Umgriff beschränkt, als eine Gruppe.
   Die Quellenangabe hängt vom Ausschnitt ab und wird beim Verschieben neu
   gesetzt – die Attribution-Steuerung von Leaflet liest sie beim Entfernen der
   Ebene aus options.attribution, deshalb wird die dort mitgeführt. */
function dopBuendel(karte, def) {
  const ebenen = DOP_LAENDER.map(l => L.tileLayer.wms(l.url, {
    layers: l.layers,
    format: 'image/jpeg',
    version: '1.3.0',
    bounds: L.latLngBounds(l.bbox),
    maxZoom: MAX_ZOOM,
    maxNativeZoom: def.maxZoom,
    crossOrigin: 'anonymous',
    className: 'fbp-basis'
  }));
  const gruppe = L.layerGroup(ebenen, { attribution: def.attribution });
  const quelleNachziehen = () => {
    /* Die Druckkarte hat keine Quellenzeile (attributionControl: false) –
       ohne diese Schranke bliebe der Bauauftrag beim Länder-Luftbild für
       immer bei „Karte wird geladen …“ stehen. */
    if (!karte.attributionControl) return;
    const neu = dopQuellenangabe(karte.getBounds());
    if (neu === gruppe.options.attribution) return;
    karte.attributionControl.removeAttribution(gruppe.options.attribution);
    gruppe.options.attribution = neu;
    karte.attributionControl.addAttribution(neu);
  };
  karte._fbpDopQuelle = quelleNachziehen;
  karte.on('moveend', quelleNachziehen);
  gruppe.once('add', () => setTimeout(quelleNachziehen, 0));
  return gruppe;
}

/** Wartet, bis die aktuelle Kachelebene fertig geladen ist (für den Druck).
 *  Beim Länder-Luftbild sind das mehrere Ebenen – gewartet wird auf jede, die
 *  im Ausschnitt tatsächlich lädt.
 *
 *  Liefert, wie viele Kacheln dabei nicht kamen (`fehler`) und wie viele
 *  geladen wurden (`geladen`). Leaflet meldet `load` auch dann, wenn jede
 *  Kachel gescheitert ist: ohne Netz war der Druckknopf nach vier Sekunden
 *  frei, als wäre die Karte da, und das Blatt ging mit leerem Kartengrund
 *  zum Trupp. */
export function warteAufKacheln(karte, timeoutMs = 8000) {
  const basis = karte._fbpBasis;
  if (!basis) return Promise.resolve({ fehler: 0, geladen: 0 });
  const ebenen = basis.getLayers ? basis.getLayers() : [basis];
  const zaehl = { fehler: 0, geladen: 0 };
  return Promise.all(ebenen.map(layer => new Promise(resolve => {
    let fertig = false;
    const beiLoad = () => setTimeout(ende, 150);
    const beiFehler = () => { zaehl.fehler++; };
    const beiKachel = () => { zaehl.geladen++; };
    const ende = () => {
      if (fertig) return;
      fertig = true;
      layer.off('load', beiLoad); layer.off('tileerror', beiFehler); layer.off('tileload', beiKachel);
      resolve();
    };
    layer.on('tileerror', beiFehler); layer.on('tileload', beiKachel);
    if (layer.isLoading && !layer.isLoading()) { setTimeout(ende, 120); return; }
    layer.on('load', beiLoad);
    setTimeout(ende, timeoutMs);
  }))).then(() => zaehl);
}

// ---------------------------------------------------------------- Funksicht

/* Die Fläche kommt als Bild auf die Karte, nicht als Polygonzug: das Raster hat
   je nach Umkreis über hunderttausend Zellen, und eine Konturverfolgung daraus
   wären Zehntausende Pfadpunkte, die Leaflet bei jedem Verschieben neu zeichnen
   müsste. Ein Bild wird einmal erzeugt und danach nur noch skaliert.

   Gezeichnet wird ohne Glättung (`imageRendering: pixelated`): die harte
   Rasterkante ist ehrlich – sie zeigt, in welcher Körnung gerechnet wurde. Eine
   weiche Kante täuschte eine Genauigkeit vor, die 25 m Zellenmaß nicht haben.

   Die Farbe ist Violett, und das aus zwei Gründen. Erstens führt eine
   topografische Karte selbst kein Violett: Grün ginge in den Waldflächen der
   TopPlusOpen unter, Blau im Gewässer, Orange in den Straßen – die Fläche wäre
   dort, wo man sie am nötigsten braucht, nicht zu sehen. Zweitens ist Grün die
   Farbe der Freigabe, und eine Freigabe ist diese Fläche gerade nicht: sie ist
   die günstigste Annahme über nacktem Gelände. Die Deckung liegt bei gut vier
   Zehnteln –
   genug, um die Fläche auf einen Blick zu sehen, wenig genug, um über dem
   Luftbild noch Waldrand und Bebauung zu erkennen. Die muss man erkennen: sie
   fehlen in der Rechnung. Die Durchsicht steckt im Bild selbst und nicht in
   einem CSS-Filter – Firefox gibt Seitenbereiche mit `filter` beim Drucken gar
   nicht aus (siehe `grauVariante`), ein Bild mit Alphakanal dagegen schon. */
export function zeichneFunksicht(karte, e) {
  const c = document.createElement('canvas');
  c.width = e.spalten; c.height = e.zeilen;
  const ctx = c.getContext('2d');
  const bild = ctx.createImageData(e.spalten, e.zeilen);
  /* Zwei Deckungen, ein Farbton – wie bei den Zonen der Ausbreitung unten und
     aus demselben Grund: frei und eingeschränkt sind ein Sachverhalt in zwei
     Graden, keine zwei Sachverhalte. Verdeckt bleibt ungefärbt. Ältere
     Befunde ohne Stufen (nur `sicht`) werden weiter gezeichnet. */
  const stufen = e.stufen;
  for (let i = 0; i < e.sicht.length; i++) {
    const j = i * 4;
    const deckung = e.sicht[i] ? 112 : (stufen && stufen[i] === 2 ? 44 : 0);
    if (deckung) {
      bild.data[j] = 124; bild.data[j + 1] = 46; bild.data[j + 2] = 158; bild.data[j + 3] = deckung;
    }
  }
  ctx.putImageData(bild, 0, 0);
  const [sw, no] = e.ecken;
  const ebene = L.imageOverlay(c.toDataURL('image/png'),
    [[sw.lat, sw.lng], [no.lat, no.lng]],
    { pane: 'fbp-schatten', interactive: false, alt: 'Funksicht über das Gelände' });
  ebene.addTo(karte);
  const el = ebene.getElement();
  if (el) el.style.imageRendering = 'pixelated';
  return ebene;
}

// ---------------------------------------------------------- Zwischenstandort

/**
 * Die Fläche, von der aus beide Aufbauplätze einer Richtfunkstrecke in freier
 * Funksicht liegen, samt den nummerierten Kandidaten darin. `e` kommt aus
 * `zwischenstandorte()` in richtfunkrelais.js. Zurück kommt eine Gruppe, die
 * als Ganzes wieder von der Karte zu nehmen ist; `aufWahl(k)` wird gerufen,
 * wenn jemand eine Marke antippt.
 *
 * Die Fläche ist kräftiger als eine einzelne Funksicht, weil sie eine
 * schärfere Aussage trägt: nicht „von hier aus sichtbar“, sondern „von beiden
 * Enden aus“. Die Marken liegen in der Ebene der Griffe, damit sie über der
 * Strecke antippbar bleiben.
 */
export function zeichneZwischenraum(karte, e, aufWahl = () => {}) {
  const gruppe = L.layerGroup();
  const c = document.createElement('canvas');
  c.width = e.spalten; c.height = e.zeilen;
  const ctx = c.getContext('2d');
  const bild = ctx.createImageData(e.spalten, e.zeilen);
  for (let i = 0; i < e.beide.length; i++) {
    if (!e.beide[i]) continue;
    const j = i * 4;
    bild.data[j] = 124; bild.data[j + 1] = 46; bild.data[j + 2] = 158; bild.data[j + 3] = 150;
  }
  ctx.putImageData(bild, 0, 0);
  const [sw, no] = e.ecken;
  const flaeche = L.imageOverlay(c.toDataURL('image/png'),
    [[sw.lat, sw.lng], [no.lat, no.lng]],
    { pane: 'fbp-schatten', interactive: false,
      alt: 'Fläche mit freier Funksicht zu beiden Aufbauplätzen' });
  gruppe.addLayer(flaeche);
  e.kandidaten.forEach((k, i) => {
    const marke = L.marker([k.lat, k.lng], {
      pane: 'fbp-griffe',
      icon: L.divIcon({
        className: 'zwischen-marke',
        html: `<span>${i + 1}</span>`,
        iconSize: [26, 26], iconAnchor: [13, 13]
      }),
      title: `Zwischenstandort ${i + 1}`,
      keyboard: false
    });
    marke.on('click', ev => {
      L.DomEvent.stop(ev);
      if (ev.originalEvent) ev.originalEvent._fbpVerbraucht = true;
      aufWahl(k, i);
    });
    gruppe.addLayer(marke);
  });
  gruppe.addTo(karte);
  const el = flaeche.getElement();
  if (el) el.style.imageRendering = 'pixelated';
  return gruppe;
}

// ---------------------------------------------------------------- Ausbreitung

/* Dieselbe Bauart wie die Funksichtfläche darüber und aus denselben Gründen:
   ein Bild statt eines Polygonzugs, ungeglättet, damit die Rasterkante zeigt,
   in welcher Körnung gerechnet wurde. Zwei Unterschiede gibt es.

   Erstens sind es drei Zonen und nicht zwei. Sie liegen in derselben Farbe und
   unterscheiden sich allein in der Deckung: freie Sicht kräftig, Randbereich
   halb so dicht, Funkschatten ungefärbt. Zwei verschiedene Farbtöne wären
   leichter zu unterscheiden und wären trotzdem falsch – sie läsen sich als
   zwei Sachverhalte, und es ist einer: dieselbe Beugungsdämpfung, einmal unter
   und einmal über der Schwelle. Der Farbton bleibt das Violett der Funksicht,
   weil eine topografische Karte selbst kein Violett führt und weil Grün die
   Farbe der Freigabe wäre – und eine Freigabe ist auch diese Fläche nicht.

   Zweitens muss der Unterschied den Schwarz-Weiß-Druck überstehen. Die beiden
   Deckungen sind deshalb so gewählt, dass sie auch als Grauwerte weit genug
   auseinanderliegen; im Farbdruck trägt zusätzlich der Ton. Geprüft gehört das
   an einem wirklich schwarz-weiß gedruckten Blatt und nicht am Bildschirm. */
const ZONENFARBEN = {
  3: [106, 27, 154, 122],    // freie Sicht
  2: [106, 27, 154, 52],     // Randbereich
  1: [0, 0, 0, 0],           // Funkschatten – ungefärbt, die vorsichtige Seite
  0: [0, 0, 0, 0]            // nicht beurteilt, ebenso
};

const ZONENFARBEN_SW = {
  3: [0, 0, 0, 104],
  2: [0, 0, 0, 40],
  1: [0, 0, 0, 0],
  0: [0, 0, 0, 0]
};

/**
 * Ausbreitungsfläche einer Relaisstelle (oder die Überdeckung mehrerer) als
 * Bildebene. `e` ist ein Befund aus `ausbreitung()` bzw. `ueberdeckung()`.
 */
export function zeichneAusbreitung(karte, e, o = {}) {
  const c = document.createElement('canvas');
  c.width = e.spalten; c.height = e.zeilen;
  const ctx = c.getContext('2d');
  const bild = ctx.createImageData(e.spalten, e.zeilen);
  const farben = o.sw ? ZONENFARBEN_SW : ZONENFARBEN;
  for (let i = 0; i < e.zonen.length; i++) {
    const f = farben[e.zonen[i]];
    if (!f[3]) continue;
    const j = i * 4;
    bild.data[j] = f[0]; bild.data[j + 1] = f[1]; bild.data[j + 2] = f[2]; bild.data[j + 3] = f[3];
  }
  ctx.putImageData(bild, 0, 0);
  const [sw, no] = e.ecken;
  const ebene = L.imageOverlay(c.toDataURL('image/png'),
    [[sw.lat, sw.lng], [no.lat, no.lng]],
    { pane: 'fbp-schatten', interactive: false, alt: 'Ausbreitung über das Gelände' });
  ebene.addTo(karte);
  const el = ebene.getElement();
  if (el) el.style.imageRendering = 'pixelated';
  return ebene;
}
