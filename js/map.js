// map.js – Leaflet-Karte, Basiskarten, Panes

export const BASISKARTEN = [
  {
    id: 'topplus', name: 'TopPlusOpen (BKG)', grau: false,
    url: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://www.bkg.bund.de">BKG</a> (TopPlusOpen, dl-de/by-2-0)', maxZoom: 18
  },
  {
    id: 'topplus_grau', name: 'TopPlusOpen grau (BKG)', grau: true,
    url: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://www.bkg.bund.de">BKG</a> (TopPlusOpen, dl-de/by-2-0)', maxZoom: 18
  },
  {
    id: 'topplus_light', name: 'TopPlusOpen hell (BKG)', grau: false,
    url: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_light/default/WEBMERCATOR/{z}/{y}/{x}.png',
    attribution: '© <a href="https://www.bkg.bund.de">BKG</a> (TopPlusOpen, dl-de/by-2-0)', maxZoom: 18
  },
  {
    id: 'osm', name: 'OpenStreetMap', grau: false,
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende', maxZoom: 19
  },
  {
    id: 'topo', name: 'OpenTopoMap', grau: false,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), © OpenStreetMap', maxZoom: 17
  },
  {
    id: 'luftbild', name: 'Luftbild (Esri)', grau: false,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Luftbild © Esri, Maxar, Earthstar Geographics', maxZoom: 19, dunkel: true
  }
];

export const basiskarteById = id => BASISKARTEN.find(b => b.id === id) || BASISKARTEN[0];

/** Graustufen-Pendant zu einer Basiskarte (für den S/W-Druck).
 *  Bewusst über die Kachelquelle und nicht über einen CSS-Filter: Firefox gibt
 *  gefilterte Seitenbereiche beim Drucken nicht aus, die Karte fehlt dann im PDF.
 *  Für das Luftbild gibt es keine graue Quelle – es bleibt, wie es ist. */
export function grauVariante(id) {
  return id === 'luftbild' ? id : 'topplus_grau';
}

export function erstelleKarte(el, ansicht = {}) {
  const karte = L.map(el, {
    center: [ansicht.lat ?? 51.1657, ansicht.lng ?? 10.4515],
    zoom: ansicht.zoom ?? 6,
    zoomControl: false,
    attributionControl: true,
    doubleClickZoom: false,
    maxZoom: 19,
    preferCanvas: false
  });

  karte.createPane('fbp-strecken').style.zIndex = 420;
  karte.createPane('fbp-griffe').style.zIndex = 470;
  karte.createPane('fbp-labels').style.zIndex = 620;
  karte.getPane('fbp-labels').style.pointerEvents = 'none';
  karte.createPane('fbp-zeichen').style.zIndex = 640;

  L.control.zoom({ position: 'topright', zoomInTitle: 'Vergrößern', zoomOutTitle: 'Verkleinern' }).addTo(karte);
  L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 160 }).addTo(karte);

  setzeBasiskarte(karte, ansicht.basemap || 'topplus');
  return karte;
}

export function setzeBasiskarte(karte, id) {
  const def = basiskarteById(id);
  if (karte._fbpBasis) karte.removeLayer(karte._fbpBasis);
  karte._fbpBasis = L.tileLayer(def.url, {
    attribution: def.attribution,
    maxZoom: 19,
    maxNativeZoom: def.maxZoom,
    subdomains: def.url.includes('{s}') ? 'abc' : [],
    crossOrigin: 'anonymous',
    className: 'fbp-basis'
  }).addTo(karte);
  karte._fbpBasisId = id;
  document.body.classList.toggle('karte-dunkel', !!def.dunkel);
  // Das Koordinatengitter färbt sich nach der Unterlage und hört auf diesen
  // Wechsel – ein Projektereignis gibt es beim Kartenwechsel nicht.
  karte.fire('fbp:basiskarte', { id });
  return def;
}

/** Wartet, bis die aktuelle Kachelebene fertig geladen ist (für den Druck). */
export function warteAufKacheln(karte, timeoutMs = 8000) {
  return new Promise(resolve => {
    const layer = karte._fbpBasis;
    if (!layer) return resolve();
    let fertig = false;
    const ende = () => { if (fertig) return; fertig = true; layer.off('load', ende); resolve(); };
    if (layer.isLoading && !layer.isLoading()) { setTimeout(ende, 120); return; }
    layer.on('load', () => setTimeout(ende, 150));
    setTimeout(ende, timeoutMs);
  });
}
