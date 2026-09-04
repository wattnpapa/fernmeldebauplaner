// map.js – Leaflet-Karte, Basiskarten, Panes

export const BASISKARTEN = [
  {
    id: 'topplus',
    name: 'TopPlusOpen (BKG)',
    grau: false,
    url: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://www.bkg.bund.de">BKG</a> (TopPlusOpen, dl-de/by-2-0)',
    maxZoom: 18
  },
  {
    id: 'topplus_grau',
    name: 'TopPlusOpen grau (BKG)',
    grau: true,
    url: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://www.bkg.bund.de">BKG</a> (TopPlusOpen, dl-de/by-2-0)',
    maxZoom: 18
  },
  {
    id: 'topplus_light',
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

  /* Der Geländeschatten liegt unter allem, was geplant wird: er ist
     Kartengrundlage, kein Planungsinhalt. Läge er darüber, verdeckte er
     ausgerechnet die Strecken, deren Machbarkeit er beurteilen soll. */
  karte.createPane('fbp-schatten').style.zIndex = 405;
  karte.getPane('fbp-schatten').style.pointerEvents = 'none';
  /* Die Flächen liegen unter den Strecken: sie sind Grundriss, die Trasse
     läuft darüber – ein Kabel, das in den Anhänger führt, endet auf ihm. */
  karte.createPane('fbp-flaechen').style.zIndex = 410;
  karte.createPane('fbp-strecken').style.zIndex = 420;
  karte.createPane('fbp-griffe').style.zIndex = 470;
  karte.createPane('fbp-labels').style.zIndex = 620;
  karte.getPane('fbp-labels').style.pointerEvents = 'none';
  /* Die Lichtbilder liegen unter den taktischen Zeichen: das Lagebild geht
     vor, die Bilder belegen es. */
  karte.createPane('fbp-bilder').style.zIndex = 630;
  karte.createPane('fbp-zeichen').style.zIndex = 640;

  L.control.zoom({ position: 'topright', zoomInTitle: 'Vergrößern', zoomOutTitle: 'Verkleinern' }).addTo(karte);
  L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 160 }).addTo(karte);

  setzeBasiskarte(karte, ansicht.basemap || 'topplus');
  return karte;
}

export function setzeBasiskarte(karte, id) {
  const def = basiskarteById(id);
  if (karte._fbpBasis) {
    // Remove any listeners attached to the previous base layer (e.g., from warteAufKacheln)
    karte._fbpBasis.off('load');
    karte._fbpBasis.off('tileerror');
    karte.removeLayer(karte._fbpBasis);
  }
  if (karte._fbpDopQuelle) { karte.off('moveend', karte._fbpDopQuelle); karte._fbpDopQuelle = null; }
  karte._fbpBasis = def.dop ? dopBuendel(karte, def) : L.tileLayer(def.url, {
    attribution: def.attribution,
    maxZoom: MAX_ZOOM,
    maxNativeZoom: def.maxZoom,
    subdomains: def.url.includes('{s}') ? 'abc' : [],
    crossOrigin: 'anonymous',
    className: 'fbp-basis'
  });
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
 *  im Ausschnitt tatsächlich lädt. */
export function warteAufKacheln(karte, timeoutMs = 8000) {
  const basis = karte._fbpBasis;
  if (!basis) return Promise.resolve();
  const ebenen = basis.getLayers ? basis.getLayers() : [basis];
  return Promise.all(ebenen.map(layer => new Promise(resolve => {
    let fertig = false;
    const beiLoad = () => setTimeout(ende, 150);
    const ende = () => { if (fertig) return; fertig = true; layer.off('load', beiLoad); resolve(); };
    if (layer.isLoading && !layer.isLoading()) { setTimeout(ende, 120); return; }
    layer.on('load', beiLoad);
    setTimeout(ende, timeoutMs);
  }))).then(() => undefined);
}

// ---------------------------------------------------------------- Geländeschatten

/* Der Schatten kommt als Bild auf die Karte, nicht als Polygonzug: das Raster
   hat je nach Umkreis über hunderttausend Zellen, und eine Konturverfolgung
   daraus wären Zehntausende Pfadpunkte, die Leaflet bei jedem Verschieben neu
   zeichnen müsste. Ein Bild wird einmal erzeugt und danach nur noch skaliert.

   Gezeichnet wird ohne Glättung (`imageRendering: pixelated`): die harte
   Rasterkante ist ehrlich – sie zeigt, in welcher Körnung gerechnet wurde.
   Eine weiche Kante täuschte eine Genauigkeit vor, die 25 m Zellenmaß nicht
   haben.

   Die Farbe ist ein neutrales Grau und kein Rot: Rot ist in diesem Werkzeug
   die Farbe der Warnung, und der Geländeschatten warnt nicht, er verschattet.
   Die Deckung liegt bei gut vier Zehnteln: genug, um die Fläche auf einen
   Blick zu sehen, wenig genug, um über dem Luftbild noch Waldrand und
   Bebauung zu erkennen – und die muss man erkennen, weil sie in der Rechnung
   gerade fehlen. Die Durchsicht steckt im Bild selbst und nicht in einem
   CSS-Filter: Firefox gibt Seitenbereiche mit `filter` beim Drucken gar nicht
   aus (siehe `grauVariante`), ein Bild mit Alphakanal dagegen schon. */
export function zeichneSchatten(karte, e) {
  const c = document.createElement('canvas');
  c.width = e.spalten; c.height = e.zeilen;
  const ctx = c.getContext('2d');
  const bild = ctx.createImageData(e.spalten, e.zeilen);
  for (let i = 0; i < e.schatten.length; i++) {
    const j = i * 4;
    if (e.schatten[i]) {
      bild.data[j] = 40; bild.data[j + 1] = 44; bild.data[j + 2] = 52; bild.data[j + 3] = 105;
    }
  }
  ctx.putImageData(bild, 0, 0);
  const [sw, no] = e.ecken;
  const ebene = L.imageOverlay(c.toDataURL('image/png'),
    [[sw.lat, sw.lng], [no.lat, no.lng]],
    { pane: 'fbp-schatten', interactive: false, alt: 'Geländeschatten' });
  ebene.addTo(karte);
  const el = ebene.getElement();
  if (el) el.style.imageRendering = 'pixelated';
  return ebene;
}
