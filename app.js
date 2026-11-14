/**
 * NavTGU — Navegador GPS minimalista estilo iOS con vista Satélite Híbrida,
 * flecha 3D direccional y trazado multicamino para desvíos en Tegucigalpa.
 */

const STORAGE_KEY = "navgame_tgu_itinerary_v1";

const SATELLITE_HYBRID_STYLE = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: "Esri, Maxar, Earthstar Geographics"
    },
    "esri-roads": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      maxzoom: 15
    },
    "esri-labels": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      maxzoom: 14
    }
  },
  layers: [
    { id: "esri-sat-base", type: "raster", source: "esri-satellite" },
    { id: "esri-roads-overlay", type: "raster", source: "esri-roads", paint: { "raster-opacity": 0.72 } },
    { id: "esri-labels-overlay", type: "raster", source: "esri-labels", paint: { "raster-opacity": 0.9 } }
  ]
};

const MAP_STYLES = {
  satellite: SATELLITE_HYBRID_STYLE,
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
};

const THEME_LABELS = {
  satellite: "Satélite",
  light: "Mapa",
  dark: "Oscuro"
};

const FALLBACK_OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "OpenStreetMap contributors"
    }
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }]
};

const DEFAULT_STOPS = [
  { id: "choluteca", name: "Choluteca, Honduras (Salida)", lat: 13.306131, lng: -87.1955618 },
  { id: "san-judas", name: "Iglesia San Judas Tadeo (Blvd. Suyapa)", lat: 14.0798587, lng: -87.1569144 },
  { id: "la-reserva", name: "La Reserva Event Center (Miraflores)", lat: 14.0744, lng: -87.1927 },
  { id: "comfort-inn", name: "Hotel Comfort Inn (Mall Las Cascadas)", lat: 14.0759, lng: -87.1994 }
];

/**
 * 5 Desvíos y Puentes Críticos de Tegucigalpa con sus 3 caminos (1 correcto verde + 2 a evitar rojos).
 * Coordenadas alineadas a la geometría real de OpenStreetMap/OSRM en Tegucigalpa.
 */
const TEGUCIGALPA_CHECKPOINTS = [
  {
    id: "cp-loarque",
    shortLabel: "1. Loarque",
    title: "Entrada Sur: Rampa al Anillo Periférico",
    lat: 14.047694,
    lng: -87.212571,
    takeLane: "right",
    actionHeadline: "Carril Derecho → Rampa Anillo Periférico",
    voiceAlert: "Atención puente Loarque. Toma el carril derecho hacia la rampa del Anillo Periférico rumbo a Suyapa. No sigas recto hacia Comayagüela.",
    paths: [
      {
        type: "take",
        label: "TOMAR: Carril Derecho → Rampa Anillo Periférico (hacia Suyapa/UNAH)",
        coords: [
          [-87.211847, 14.045749],
          [-87.212142, 14.046567],
          [-87.212571, 14.047694],
          [-87.212643, 14.048171],
          [-87.212267, 14.049151],
          [-87.210202, 14.050296]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Seguir recto hacia Loarque / Comayagüela",
        coords: [
          [-87.212571, 14.047694],
          [-87.21305, 14.04925],
          [-87.21365, 14.05185]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Retorno izquierdo hacia Salida al Sur",
        coords: [
          [-87.211847, 14.045749],
          [-87.21245, 14.04622],
          [-87.21335, 14.04685],
          [-87.21275, 14.04515]
        ]
      }
    ]
  },
  {
    id: "cp-suyapa",
    shortLabel: "2. Suyapa",
    title: "Anillo → Salida Bulevar Suyapa / San Judas",
    lat: 14.081797,
    lng: -87.160378,
    takeLane: "right",
    actionHeadline: "Lateral Derecho antes del puente → Blvd. Suyapa",
    voiceAlert: "Atención desvío a Suyapa. Mantén el carril lateral derecho antes del puente para bajar al Bulevar Suyapa. No subas el puente del Anillo.",
    paths: [
      {
        type: "take",
        label: "TOMAR: Carril Lateral Derecho → Salida a Bulevar Suyapa",
        coords: [
          [-87.161672, 14.081376],
          [-87.160378, 14.081797],
          [-87.159199, 14.08224],
          [-87.158667, 14.082033],
          [-87.158515, 14.081571],
          [-87.157015, 14.080932]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Subir puente principal del Anillo (te pasa la salida)",
        coords: [
          [-87.160378, 14.081797],
          [-87.15915, 14.08265],
          [-87.15785, 14.08365]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Giro izquierdo hacia Hato de Enmedio",
        coords: [
          [-87.158667, 14.082033],
          [-87.15975, 14.08295],
          [-87.16105, 14.08325]
        ]
      }
    ]
  },
  {
    id: "cp-ffaa",
    shortLabel: "3. FF.AA.",
    title: "Anillo Periférico → Bulevar Fuerzas Armadas",
    lat: 14.068189,
    lng: -87.169322,
    takeLane: "right",
    actionHeadline: "Carril Derecho → Rampa Bulevar Fuerzas Armadas",
    voiceAlert: "Desvío al Bulevar Fuerzas Armadas. Toma la salida derecha hacia la rampa de conexión. No continúes por el Anillo hacia Las Uvas.",
    paths: [
      {
        type: "take",
        label: "TOMAR: Carril Derecho → Rampa a Blvd. Fuerzas Armadas",
        coords: [
          [-87.167489, 14.069806],
          [-87.169322, 14.068189],
          [-87.171246, 14.066558],
          [-87.172488, 14.065968],
          [-87.174761, 14.069594]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Seguir recto por Anillo Periférico hacia Las Uvas",
        coords: [
          [-87.169322, 14.068189],
          [-87.17145, 14.06535],
          [-87.17385, 14.06285]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Retorno bajo el puente hacia Anillo Norte",
        coords: [
          [-87.171964, 14.065935],
          [-87.17355, 14.06485],
          [-87.17095, 14.06625]
        ]
      }
    ]
  },
  {
    id: "cp-miraflores",
    shortLabel: "4. Miraflores",
    title: "Blvd. FF.AA. → Av. Santa Cristina (La Reserva)",
    lat: 14.075232,
    lng: -87.182944,
    takeLane: "right",
    actionHeadline: "Lateral Derecho (no subir puente) → Miraflores",
    voiceAlert: "Atención puente Miraflores. Sal por el carril lateral derecho hacia Bulevar Centroamérica y gira a Avenida Santa Cristina. No subas el puente de Fuerzas Armadas.",
    paths: [
      {
        type: "take",
        label: "TOMAR: Lateral Derecho → Blvd. Centroamérica y Av. Santa Cristina",
        coords: [
          [-87.182369, 14.075255],
          [-87.182944, 14.075232],
          [-87.184598, 14.076274],
          [-87.185039, 14.076917],
          [-87.185254, 14.079126],
          [-87.184864, 14.074147],
          [-87.18707, 14.074224]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Subir paso elevado de Blvd. FF.AA. (te pasas Miraflores)",
        coords: [
          [-87.182944, 14.075232],
          [-87.18535, 14.07512],
          [-87.18905, 14.07462]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Seguir norte hacia Kennedy / Basílica",
        coords: [
          [-87.185254, 14.079126],
          [-87.18615, 14.08125],
          [-87.18715, 14.08305]
        ]
      }
    ]
  },
  {
    id: "cp-cascadas",
    shortLabel: "5. Cascadas",
    title: "Frente a Mall Las Cascadas → Comfort Inn",
    lat: 14.076467,
    lng: -87.197374,
    takeLane: "right",
    actionHeadline: "No subir puente: Lateral Derecho → Comfort Inn",
    voiceAlert: "Alerta crítica frente a Mall Las Cascadas. Mantén el carril lateral derecho y no subas el puente elevado. Tu entrada al Comfort Inn está a la derecha.",
    paths: [
      {
        type: "take",
        label: "TOMAR: Lateral Derecho (abajo) → Entrada Comfort Inn",
        coords: [
          [-87.195068, 14.076286],
          [-87.197374, 14.076467],
          [-87.198506, 14.076177],
          [-87.199303, 14.075678],
          [-87.199417, 14.075891]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Subir puente elevado (pasa encima del mall sin salida)",
        coords: [
          [-87.195068, 14.076286],
          [-87.19755, 14.07662],
          [-87.20085, 14.07718],
          [-87.20355, 14.07765]
        ]
      },
      {
        type: "avoid",
        label: "EVITAR: Retorno bajo el puente hacia Bulevar Kuwait",
        coords: [
          [-87.198506, 14.076177],
          [-87.19985, 14.07542],
          [-87.19865, 14.07478]
        ]
      }
    ]
  }
];

/* ================= VECTOR SVG ICON HELPER (CERO EMOJIS) ================= */
function svgIcon(name, size = 14) {
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"`;
  switch (name) {
    case "check":
      return `<svg ${common}><polyline points="20 6 9 17 4 12"/></svg>`;
    case "ban":
      return `<svg ${common}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
    case "flag":
      return `<svg ${common}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
    case "map-pin":
      return `<svg ${common}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    case "alert-triangle":
      return `<svg ${common}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    case "navigation":
      return `<svg ${common} fill="currentColor"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>`;
    case "arrow-up":
      return `<svg ${common}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
    case "arrow-down":
      return `<svg ${common}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
    case "trash":
      return `<svg ${common}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    case "git-fork":
      return `<svg ${common}><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v3"/></svg>`;
    default:
      return `<svg ${common}><circle cx="12" cy="12" r="9"/></svg>`;
  }
}

function roadArrowSvg() {
  return `
    <div class="vehicle-pulse"></div>
    <svg viewBox="0 0 120 120" class="road-arrow-svg" aria-hidden="true">
      <defs>
        <linearGradient id="roadFacetLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6cffab" />
          <stop offset="100%" stop-color="#30d158" />
        </linearGradient>
        <linearGradient id="roadFacetRight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#28b850" />
          <stop offset="100%" stop-color="#0f7c33" />
        </linearGradient>
      </defs>
      <polygon points="60,8 106,104 60,82 14,104" fill="#0b1f13" opacity="0.45" transform="translate(0,5)" />
      <polygon points="60,8 60,82 14,104" fill="url(#roadFacetLeft)" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" />
      <polygon points="60,8 106,104 60,82" fill="url(#roadFacetRight)" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" />
    </svg>
  `;
}

/* ================= STATE ================= */
const state = {
  stops: loadSavedStops(),
  draftStops: [],
  activeLeg: "all",
  routes: [],
  mainCoords: [],
  cumDistances: [],
  steps: [],
  activeCheckpoints: [],
  totalDistance: 0,
  totalDuration: 0,

  mode: "sim",
  simPlaying: false,
  simSpeed: 1,
  simDistMeters: 0,
  lastAlongMeters: 0,
  vehiclePos: null,
  vehicleHeading: 0,
  deviceHeading: null,
  speedKmh: 0,
  gpsWatchId: null,
  lastFrameTime: 0,

  cameraMode: "street", // "street" = Calle 3D | "aerial" = Aérea 3D | "overview" = 2D Ruta
  followZoom: 18.8,
  theme: "satellite", // Vista de satélite híbrida por defecto
  showRouteLine: true,
  cleanUiMode: false,
  voiceEnabled: true,
  pickMode: false,
  spokenAlerts: new Set(),

  activeCheckpointId: null,
  dismissedCheckpointId: null,
  bridgeAlertShownAt: 0,
  lastSpokenContextId: null,

  map: null,
  mapReady: false,
  vehicleMarker: null,
  stopMarkers: [],
  forkMarkers: []
};

/* ================= DOM ELEMENTS ================= */
const el = {
  hudCard: document.getElementById("hudCard"),
  arrow3d: document.getElementById("arrow3d"),
  hudDistance: document.getElementById("hudDistance"),
  modeBadge: document.getElementById("modeBadge"),
  checkpointBadge: document.getElementById("checkpointBadge"),
  speedBadge: document.getElementById("speedBadge"),
  hudTitle: document.getElementById("hudTitle"),
  hudSubtitle: document.getElementById("hudSubtitle"),
  laneForkBar: document.getElementById("laneForkBar"),

  bridgeAlert: document.getElementById("bridgeAlert"),
  bridgeAlertTitle: document.getElementById("bridgeAlertTitle"),
  bridgeAlertDist: document.getElementById("bridgeAlertDist"),
  bridgePathsGrid: document.getElementById("bridgePathsGrid"),
  btnDismissBridgeAlert: document.getElementById("btnDismissBridgeAlert"),

  checkpointStrip: document.getElementById("checkpointStrip"),
  legFilterPills: document.getElementById("legFilterPills"),
  metricTotalDist: document.getElementById("metricTotalDist"),
  metricTotalTime: document.getElementById("metricTotalTime"),
  metricRoutesCount: document.getElementById("metricRoutesCount"),

  btnStartGps: document.getElementById("btnStartGps"),
  btnPlayPause: document.getElementById("btnPlayPause"),
  btnSimSpeed: document.getElementById("btnSimSpeed"),
  simScrubber: document.getElementById("simScrubber"),

  btnToggleItinerary: document.getElementById("btnToggleItinerary"),
  btnToggleCamera: document.getElementById("btnToggleCamera"),
  btnToggleTheme: document.getElementById("btnToggleTheme"),
  btnToggleRouteLine: document.getElementById("btnToggleRouteLine"),
  btnToggleCleanUi: document.getElementById("btnToggleCleanUi"),
  btnToggleVoice: document.getElementById("btnToggleVoice"),
  btnZoomIn: document.getElementById("btnZoomIn"),
  btnZoomOut: document.getElementById("btnZoomOut"),

  itineraryModal: document.getElementById("itineraryModal"),
  btnCloseModal: document.getElementById("btnCloseModal"),
  btnCancelModal: document.getElementById("btnCancelModal"),
  btnApplyItinerary: document.getElementById("btnApplyItinerary"),
  btnUseMyLocation: document.getElementById("btnUseMyLocation"),
  btnRestoreDefault: document.getElementById("btnRestoreDefault"),
  stopsList: document.getElementById("stopsList"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  btnPickOnMap: document.getElementById("btnPickOnMap"),
  toastMsg: document.getElementById("toastMsg")
};

/* ================= GEO MATH HELPERS ================= */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function haversineMeters([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing([lng1, lat1], [lng2, lat2]) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function normalizeAngle(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function showToast(msg, ms = 2500) {
  el.toastMsg.textContent = msg;
  el.toastMsg.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.toastMsg.classList.add("hidden"), ms);
}

function cancelSpeech() {
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignorar si no está disponible
    }
  }
}

function speakSpanish(text, alertKey, contextId = null) {
  if (!state.voiceEnabled || !("speechSynthesis" in window)) return;
  if (alertKey && state.spokenAlerts.has(alertKey)) return;
  if (alertKey) state.spokenAlerts.add(alertKey);
  state.lastSpokenContextId = contextId;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-HN";
    utter.rate = state.mode === "sim" && state.simSpeed > 1 ? 1.28 : 1.12;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignorar errores si el navegador bloquea autoplay de voz
  }
}

/* ================= STORAGE ================= */
function loadSavedStops() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
    }
  } catch {
    // Fallback al itinerario por defecto
  }
  return structuredClone(DEFAULT_STOPS);
}

function saveStops(stops) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stops));
  } catch {
    // Ignorar sin cuota
  }
}

/* ================= MAP INITIALIZATION ================= */
function initMap() {
  let fallbackApplied = false;
  state.map = new maplibregl.Map({
    container: "map",
    style: MAP_STYLES[state.theme],
    center: [-87.185, 14.072],
    zoom: 18.8,
    maxZoom: 21,
    pitch: 74,
    maxPitch: 82,
    bearing: 0,
    antialias: true
  });

  state.map.on("error", () => {
    if (!fallbackApplied && !state.mapReady) {
      fallbackApplied = true;
      state.map.setStyle(FALLBACK_OSM_STYLE);
    }
  });

  state.map.on("style.load", () => {
    state.mapReady = true;
    ensureRouteLayers();
    renderAllMapData();
    applyRouteLineVisibility();
  });

  state.map.on("zoom", () => {
    updateForkMarkersVisibility();
  });

  state.map.on("zoomend", (e) => {
    if (e.originalEvent && state.cameraMode !== "overview") {
      state.followZoom = state.map.getZoom();
    }
  });

  state.map.on("click", (e) => {
    if (state.pickMode) {
      state.pickMode = false;
      const { lng, lat } = e.lngLat;
      state.draftStops.push({
        id: `custom-${Date.now()}`,
        name: `Punto elegido (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        lat,
        lng
      });
      el.itineraryModal.classList.remove("hidden");
      renderDraftStopsList();
      showToast("Parada agregada desde el mapa");
      return;
    }

    if (window.innerWidth <= 768) {
      const hitLayers = ["avoid-forks-layer", "alt-routes-layer"].filter((id) => state.map.getLayer(id));
      const features = hitLayers.length ? state.map.queryRenderedFeatures(e.point, { layers: hitLayers }) : [];
      if (!features.length) {
        toggleCleanUiMode();
      }
    }
  });
}

function ensureRouteLayers() {
  const m = state.map;
  if (!m) return;

  const sources = {
    "alt-routes-src": { type: "geojson", data: emptyFC() },
    "avoid-forks-src": { type: "geojson", data: emptyFC() },
    "take-forks-src": { type: "geojson", data: emptyFC() },
    "main-route-src": { type: "geojson", data: emptyFC() }
  };

  for (const [id, spec] of Object.entries(sources)) {
    if (!m.getSource(id)) m.addSource(id, spec);
  }

  // Rutas alternativas OSRM
  if (!m.getLayer("alt-routes-layer")) {
    m.addLayer({
      id: "alt-routes-layer",
      type: "line",
      source: "alt-routes-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ff9f0a",
        "line-width": 5.5,
        "line-opacity": 0.85,
        "line-dasharray": [2, 1.5]
      }
    });
  }

  // Halo de contraste para caminos rojos sobre satélite
  if (!m.getLayer("avoid-forks-casing")) {
    m.addLayer({
      id: "avoid-forks-casing",
      type: "line",
      source: "avoid-forks-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#1a0608",
        "line-width": 10,
        "line-opacity": 0.65
      }
    });
  }

  // Caminos / Retornos a evitar en rojo Apple
  if (!m.getLayer("avoid-forks-layer")) {
    m.addLayer({
      id: "avoid-forks-layer",
      type: "line",
      source: "avoid-forks-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ff453a",
        "line-width": 6.5,
        "line-opacity": 0.95,
        "line-dasharray": [1.6, 1.4]
      }
    });
  }

  // Casing oscuro/blanco para contraste sobre imagen satelital
  if (!m.getLayer("main-route-casing")) {
    m.addLayer({
      id: "main-route-casing",
      type: "line",
      source: "main-route-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 10.5,
        "line-opacity": 0.88
      }
    });
  }

  // Ruta correcta en verde Apple
  if (!m.getLayer("main-route-layer")) {
    m.addLayer({
      id: "main-route-layer",
      type: "line",
      source: "main-route-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#30d158",
        "line-width": 6.5,
        "line-opacity": 1
      }
    });
  }

  // Refuerzo en ramas de puente
  if (!m.getLayer("take-forks-layer")) {
    m.addLayer({
      id: "take-forks-layer",
      type: "line",
      source: "take-forks-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#64ff9b",
        "line-width": 7,
        "line-opacity": 0.95
      }
    });
  }

  m.on("click", "avoid-forks-layer", (e) => {
    const label = e.features?.[0]?.properties?.label;
    if (label) {
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<strong style="color:#ff453a">${label}</strong>`)
        .addTo(m);
    }
  });

  m.on("click", "alt-routes-layer", (e) => {
    const label = e.features?.[0]?.properties?.label;
    if (label) {
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<strong style="color:#ff9f0a">${label}</strong>`)
        .addTo(m);
    }
  });

  applyRouteLineVisibility();
}

function applyRouteLineVisibility() {
  const m = state.map;
  if (!m || !state.mapReady) return;
  const vis = state.showRouteLine ? "visible" : "none";
  for (const id of ["main-route-casing", "main-route-layer", "take-forks-layer"]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", vis);
  }
}

function toggleCleanUiMode(force = null) {
  state.cleanUiMode = force !== null ? Boolean(force) : !state.cleanUiMode;
  document.body.classList.toggle("ios-clean-mode", state.cleanUiMode);
  if (el.btnToggleCleanUi) {
    el.btnToggleCleanUi.classList.toggle("active", state.cleanUiMode);
    el.btnToggleCleanUi.innerHTML = state.cleanUiMode
      ? `<i data-lucide="minimize-2" class="ico-md"></i><span>Ver más</span>`
      : `<i data-lucide="maximize-2" class="ico-md"></i><span>Mapa</span>`;
    refreshLucideIcons();
  }
  updateNavigationHUD();
}

function emptyFC() {
  return { type: "FeatureCollection", features: [] };
}

/* ================= OSRM ROUTING ================= */
function getActiveStops() {
  if (state.activeLeg === "all") return state.stops;
  const idx = Number(state.activeLeg);
  if (Number.isInteger(idx) && state.stops[idx] && state.stops[idx + 1]) {
    return [state.stops[idx], state.stops[idx + 1]];
  }
  return state.stops;
}

async function fetchAndBuildRoutes() {
  const activeStops = getActiveStops();
  if (activeStops.length < 2) return;

  el.hudTitle.textContent = "Calculando ruta satelital…";
  el.hudSubtitle.textContent = "Consultando caminos y desvíos en tiempo real";

  const coordStr = activeStops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&steps=true&alternatives=3&geometries=geojson`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes || !data.routes.length) throw new Error("Sin rutas");

    state.routes = data.routes;

    if (activeStops.length > 2 && state.routes.length === 1) {
      const legStart = activeStops[1] || activeStops[0];
      const legEnd = activeStops[2] || activeStops[1];
      try {
        const altRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${legStart.lng},${legStart.lat};${legEnd.lng},${legEnd.lat}?overview=full&alternatives=3&geometries=geojson`
        );
        const altData = await altRes.json();
        if (altData.routes && altData.routes.length > 1) {
          state.routes.push(...altData.routes.slice(1));
        }
      } catch {
        // Opcional si no hay rutas alternas en OSRM
      }
    }

    processPrimaryRoute(state.routes[0]);
    renderAllMapData();
    resetVehicleToStart();
  } catch {
    el.hudTitle.textContent = "Error al consultar ruta";
    el.hudSubtitle.textContent = "Verifica tu conexión para recargar";
  }
}

function processPrimaryRoute(route) {
  const coords = route.geometry.coordinates;
  state.mainCoords = coords;
  state.totalDistance = route.distance;
  state.totalDuration = route.duration;

  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversineMeters(coords[i - 1], coords[i]));
  }
  state.cumDistances = cum;

  const flatSteps = [];
  let searchHintMeters = 0;
  for (const leg of route.legs) {
    for (const step of leg.steps) {
      const [sLng, sLat] = step.maneuver.location;
      const proj = projectOntoRoute([sLng, sLat], searchHintMeters);
      const along = Math.max(searchHintMeters, proj.distAlong);
      searchHintMeters = along;
      flatSteps.push({
        coord: [sLng, sLat],
        distAlong: along,
        type: step.maneuver.type,
        modifier: step.maneuver.modifier || "straight",
        name: step.name || "Carretera / Bulevar",
        distance: step.distance
      });
    }
  }
  state.steps = flatSteps;

  state.activeCheckpoints = TEGUCIGALPA_CHECKPOINTS.map((cp) => {
    const proj = projectOntoRoute([cp.lng, cp.lat]);
    return { ...cp, distAlong: proj.distAlong, perpDist: proj.perpDist };
  })
    .filter((cp) => cp.perpDist < 220)
    .sort((a, b) => a.distAlong - b.distAlong);

  el.metricTotalDist.textContent = `${(route.distance / 1000).toFixed(1)} km`;
  el.metricTotalTime.textContent = `${Math.round(route.duration / 60)} min`;
  el.metricRoutesCount.textContent = `${state.routes.length} rutas · ${state.activeCheckpoints.length} puentes`;
}

function projectOntoRoute(point, hintMeters = null) {
  const coords = state.mainCoords;
  const cum = state.cumDistances;
  if (!coords.length) return { distAlong: 0, perpDist: Infinity, segmentIndex: 0, heading: 0 };
  if (coords.length === 1) {
    return {
      distAlong: 0,
      perpDist: haversineMeters(point, coords[0]),
      segmentIndex: 0,
      heading: 0
    };
  }

  const refLat = point[1];
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(toRad(refLat));

  const px = (point[0] - coords[0][0]) * mPerDegLng;
  const py = (point[1] - coords[0][1]) * mPerDegLat;

  let bestScore = Infinity;
  let bestPerp = Infinity;
  let bestAlong = 0;
  let bestSeg = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const ax = (coords[i][0] - coords[0][0]) * mPerDegLng;
    const ay = (coords[i][1] - coords[0][1]) * mPerDegLat;
    const bx = (coords[i + 1][0] - coords[0][0]) * mPerDegLng;
    const by = (coords[i + 1][1] - coords[0][1]) * mPerDegLat;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0.0001) {
      t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    }
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const perp = Math.hypot(px - cx, py - cy);
    const segMeters = (cum[i + 1] - cum[i]) || Math.hypot(dx, dy);
    const candAlong = cum[i] + t * segMeters;

    let score = perp;
    if (hintMeters !== null) {
      const jump = Math.abs(candAlong - hintMeters);
      if (jump > 250) score += (jump - 250) * 0.25;
      if (candAlong < hintMeters - 40) score += 35;
    }

    if (score < bestScore) {
      bestScore = score;
      bestPerp = perp;
      bestAlong = candAlong;
      bestSeg = i;
    }
  }

  return {
    distAlong: bestAlong,
    perpDist: bestPerp,
    segmentIndex: bestSeg,
    heading: calculateBearing(coords[bestSeg], coords[bestSeg + 1])
  };
}

function findNearestRouteProgress(point, hintMeters = null) {
  return projectOntoRoute(point, hintMeters).distAlong;
}

/* ================= RENDER MAP LAYERS & VECTOR MARKERS ================= */
function renderAllMapData() {
  if (!state.mapReady || !state.mainCoords.length) return;
  const m = state.map;

  m.getSource("main-route-src").setData({
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: { type: "LineString", coordinates: state.mainCoords } }]
  });

  const altFeatures = state.routes.slice(1).map((r, idx) => ({
    type: "Feature",
    properties: {
      label: `Ruta alternativa ${idx + 2} (${(r.distance / 1000).toFixed(1)} km · ${Math.round(r.duration / 60)} min)`
    },
    geometry: r.geometry
  }));
  m.getSource("alt-routes-src").setData({ type: "FeatureCollection", features: altFeatures });

  const takeFeatures = [];
  const avoidFeatures = [];
  for (const cp of TEGUCIGALPA_CHECKPOINTS) {
    for (const p of cp.paths) {
      const feature = {
        type: "Feature",
        properties: { label: `${cp.title} — ${p.label}` },
        geometry: { type: "LineString", coordinates: p.coords }
      };
      if (p.type === "take") takeFeatures.push(feature);
      else avoidFeatures.push(feature);
    }
  }
  m.getSource("take-forks-src").setData({ type: "FeatureCollection", features: takeFeatures });
  m.getSource("avoid-forks-src").setData({ type: "FeatureCollection", features: avoidFeatures });

  state.stopMarkers.forEach((mk) => mk.remove());
  state.stopMarkers = [];
  const activeStops = getActiveStops();
  activeStops.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = `stop-marker ${idx === 0 ? "origin" : idx === activeStops.length - 1 ? "final" : ""}`;
    const icon = idx === 0 ? svgIcon("flag", 12) : svgIcon("map-pin", 12);
    const label = s.name.split("(")[0].trim();
    div.innerHTML = `${icon}<span>${idx === 0 ? label : `${idx}. ${label}`}</span>`;
    const mk = new maplibregl.Marker({ element: div, anchor: "bottom" })
      .setLngLat([s.lng, s.lat])
      .addTo(m);
    state.stopMarkers.push(mk);
  });

  state.forkMarkers.forEach((item) => item.mk.remove());
  state.forkMarkers = [];
  TEGUCIGALPA_CHECKPOINTS.forEach((cp, idx) => {
    const div = document.createElement("div");
    div.className = "fork-marker";
    div.title = cp.shortLabel;
    div.innerHTML = `<span>${idx + 1}</span>`;
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      jumpToCheckpoint(cp);
    });
    const mk = new maplibregl.Marker({ element: div, anchor: "center" })
      .setLngLat([cp.lng, cp.lat])
      .addTo(m);
    state.forkMarkers.push({ mk, el: div, cp });
  });

  if (!state.vehicleMarker) {
    const vEl = document.createElement("div");
    vEl.className = "vehicle-marker";
    vEl.innerHTML = roadArrowSvg();
    state.vehicleMarker = new maplibregl.Marker({
      element: vEl,
      rotationAlignment: "map",
      pitchAlignment: "map"
    })
      .setLngLat(state.mainCoords[0])
      .addTo(m);
  }

  applyRouteLineVisibility();
  updateForkMarkersVisibility();
}

function updateForkMarkersVisibility() {
  if (!state.map || !state.forkMarkers.length) return;
  const zoom = state.map.getZoom();
  const curAlong = state.mode === "sim" ? state.simDistMeters : state.lastAlongMeters;
  const activeById = new Map(state.activeCheckpoints.map((c) => [c.id, c]));

  state.forkMarkers.forEach(({ el: div, cp }) => {
    const activeCp = activeById.get(cp.id);
    const passed = activeCp ? activeCp.distAlong - curAlong < -35 : false;
    const shouldHide = zoom < 12.5 || (state.cameraMode !== "overview" && passed);
    div.classList.toggle("is-hidden", shouldHide);
  });
}

/* ================= VEHICLE POSITION, 3D ARROW & LANE LOGIC ================= */
function sampleRouteAtDistance(meters) {
  const cum = state.cumDistances;
  const coords = state.mainCoords;
  if (!coords.length) return null;
  if (meters <= 0) {
    return {
      coord: coords[0],
      heading: coords.length > 1 ? calculateBearing(coords[0], coords[1]) : 0
    };
  }
  const maxDist = cum[cum.length - 1];
  if (meters >= maxDist) {
    const n = coords.length;
    return {
      coord: coords[n - 1],
      heading: n > 1 ? calculateBearing(coords[n - 2], coords[n - 1]) : 0
    };
  }
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= meters) lo = mid;
    else hi = mid;
  }
  const segLen = cum[hi] - cum[lo] || 1;
  const t = (meters - cum[lo]) / segLen;
  const lng = coords[lo][0] + (coords[hi][0] - coords[lo][0]) * t;
  const lat = coords[lo][1] + (coords[hi][1] - coords[lo][1]) * t;
  const heading = calculateBearing(coords[lo], coords[hi]);
  return { coord: [lng, lat], heading };
}

function resetVehicleToStart() {
  state.simDistMeters = 0;
  state.lastAlongMeters = 0;
  state.activeCheckpointId = null;
  state.dismissedCheckpointId = null;
  state.bridgeAlertShownAt = 0;
  state.lastSpokenContextId = null;
  el.simScrubber.value = "0";
  state.spokenAlerts.clear();
  cancelSpeech();
  const sample = sampleRouteAtDistance(0);
  if (sample) {
    state.vehiclePos = sample.coord;
    state.vehicleHeading = sample.heading;
    updateNavigationHUD();
    focusCameraOnVehicle(true);
  }
}

function jumpToCheckpoint(cp) {
  if (state.mode === "gps") stopGpsMode();
  cancelSpeech();
  const matched = state.activeCheckpoints.find((c) => c.id === cp.id);
  const cpAlong = matched ? matched.distAlong : projectOntoRoute([cp.lng, cp.lat]).distAlong;
  const startAlong = Math.max(0, cpAlong - 320);
  state.simDistMeters = startAlong;
  state.lastAlongMeters = startAlong;
  state.activeCheckpointId = null;
  state.dismissedCheckpointId = null;
  state.bridgeAlertShownAt = 0;
  state.lastSpokenContextId = null;
  state.spokenAlerts.delete(`${cp.id}-far`);
  state.spokenAlerts.delete(`${cp.id}-near`);

  const sample = sampleRouteAtDistance(startAlong);
  if (sample) {
    state.vehiclePos = sample.coord;
    state.vehicleHeading = sample.heading;
    state.simSpeed = 1;
    el.btnSimSpeed.textContent = "1x";
    state.simPlaying = true;
    setPlayButtonUI(true);
    state.cameraMode = "street";
    state.followZoom = 18.8;
    setCameraButtonUI("street");
    updateNavigationHUD();
    focusCameraOnVehicle(true);
    showToast(`Probando desvío: ${cp.shortLabel}`);
  }
}

function focusCameraOnVehicle(immediate = false) {
  if (!state.map || !state.vehiclePos) return;
  if (state.cameraMode === "street") {
    const opts = {
      center: state.vehiclePos,
      zoom: state.followZoom,
      pitch: 74,
      bearing: state.vehicleHeading,
      padding: { top: Math.round(window.innerHeight * 0.34), bottom: 0, left: 0, right: 0 }
    };
    if (immediate) state.map.jumpTo(opts);
    else state.map.easeTo({ ...opts, duration: 220, easing: (t) => t });
  } else if (state.cameraMode === "aerial") {
    const opts = {
      center: state.vehiclePos,
      zoom: state.followZoom,
      pitch: 56,
      bearing: state.vehicleHeading,
      padding: { top: 0, bottom: 0, left: 0, right: 0 }
    };
    if (immediate) state.map.jumpTo(opts);
    else state.map.easeTo({ ...opts, duration: 220, easing: (t) => t });
  } else {
    state.map.easeTo({
      center: state.vehiclePos,
      bearing: 0,
      pitch: 12,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: immediate ? 0 : 250
    });
  }
}

function updateNavigationHUD() {
  if (!state.vehiclePos || !state.mainCoords.length) return;

  if (state.vehicleMarker) {
    state.vehicleMarker.setLngLat(state.vehiclePos).setRotation(state.vehicleHeading);
  }

  const totalDist = state.cumDistances[state.cumDistances.length - 1] || 1;
  if (state.mode === "sim") {
    el.simScrubber.value = String(Math.round((state.simDistMeters / totalDist) * 1000));
  }

  const curAlong =
    state.mode === "sim"
      ? state.simDistMeters
      : projectOntoRoute(state.vehiclePos, state.lastAlongMeters).distAlong;
  state.lastAlongMeters = curAlong;

  const lookAhead = sampleRouteAtDistance(Math.min(totalDist, curAlong + 90));
  const targetBearing = lookAhead ? calculateBearing(state.vehiclePos, lookAhead.coord) : state.vehicleHeading;
  const arrowAngle = state.cameraMode !== "overview"
    ? normalizeAngle(targetBearing - state.vehicleHeading)
    : targetBearing;

  el.arrow3d.style.transform = `rotateX(34deg) rotateZ(${arrowAngle.toFixed(1)}deg)`;
  el.speedBadge.textContent = `${Math.round(state.speedKmh)} km/h`;

  let nearestCp = null;
  let nearestCpDelta = Infinity;
  const cpPool = state.activeCheckpoints.length ? state.activeCheckpoints : [];
  for (const cp of cpPool) {
    const delta = cp.distAlong - curAlong;
    if (delta >= -10 && delta <= 550 && delta < nearestCpDelta) {
      nearestCpDelta = delta;
      nearestCp = cp;
    }
  }

  if (state.lastSpokenContextId && (!nearestCp || nearestCp.id !== state.lastSpokenContextId)) {
    cancelSpeech();
    state.lastSpokenContextId = null;
  }

  const nextStep = state.steps.find((st) => st.distAlong > curAlong + 8) || state.steps[state.steps.length - 1];
  const nextStepDist = nextStep ? Math.max(0, nextStep.distAlong - curAlong) : 0;

  const speedMps = Math.max(8, (state.speedKmh || 50) / 3.6);
  const showLanes = !state.cleanUiMode && (Boolean(nearestCp) || nextStepDist <= 350);
  el.laneForkBar.classList.toggle("hidden", !showLanes);

  if (nearestCp) {
    if (state.activeCheckpointId !== nearestCp.id) {
      state.activeCheckpointId = nearestCp.id;
      state.bridgeAlertShownAt = performance.now();
    }
    const alertExpired = performance.now() - state.bridgeAlertShownAt > 5000;
    const showBridgeBanner =
      !state.cleanUiMode &&
      state.dismissedCheckpointId !== nearestCp.id &&
      !alertExpired &&
      nearestCpDelta > 25;

    const dispDist = Math.max(0, nearestCpDelta);
    el.hudCard.classList.add("checkpoint-active");
    el.checkpointBadge.classList.remove("hidden");
    el.bridgeAlert.classList.toggle("hidden", !showBridgeBanner);
    el.hudDistance.textContent = formatDistance(dispDist);
    el.hudTitle.textContent = nearestCp.actionHeadline;
    el.hudSubtitle.textContent = state.showRouteLine
      ? nearestCp.title
      : "Línea verde oculta · Carretera despejada";

    if (showBridgeBanner) {
      el.bridgeAlertTitle.textContent = nearestCp.title;
      el.bridgeAlertDist.textContent = `a ${formatDistance(dispDist)}`;
      el.bridgePathsGrid.innerHTML = nearestCp.paths
        .map((p) => {
          const icon = p.type === "take" ? svgIcon("check", 13) : svgIcon("ban", 13);
          return `<div class="bridge-path-item ${p.type}">${icon}<span>${p.label}</span></div>`;
        })
        .join("");
    }

    highlightLanes(nearestCp.takeLane, true);

    const farTrigger = Math.min(450, Math.max(200, speedMps * 7.5));
    const nearTrigger = Math.min(140, Math.max(55, speedMps * 3));
    if (nearestCpDelta <= farTrigger && nearestCpDelta > nearTrigger) {
      speakSpanish(
        `${nearestCp.shortLabel}: ${nearestCp.actionHeadline}`,
        `${nearestCp.id}-far`,
        nearestCp.id
      );
    } else if (nearestCpDelta <= nearTrigger && nearestCpDelta > 10) {
      speakSpanish(
        `En ${Math.round(nearestCpDelta)} metros, ${nearestCp.actionHeadline}`,
        `${nearestCp.id}-near`,
        nearestCp.id
      );
    }
  } else {
    state.activeCheckpointId = null;
    el.hudCard.classList.remove("checkpoint-active");
    el.checkpointBadge.classList.add("hidden");
    el.bridgeAlert.classList.add("hidden");

    el.hudDistance.textContent = formatDistance(nextStepDist);
    const { lane, label } = mapModifierToSpanish(nextStep);
    el.hudTitle.textContent = label;
    el.hudSubtitle.textContent = state.showRouteLine
      ? nextStep?.name
        ? `Vía: ${nextStep.name}`
        : "Mantente en la ruta verde"
      : "Línea verde oculta · Carretera despejada";
    highlightLanes(lane, false);

    const turnTrigger = Math.max(90, speedMps * 4);
    const isTurnOrArrive =
      nextStep &&
      (nextStep.type === "arrive" || (nextStep.modifier && !nextStep.modifier.includes("straight")));
    if (isTurnOrArrive && nextStepDist <= turnTrigger && nextStepDist > 12) {
      speakSpanish(label, `step-${Math.round(nextStep.distAlong)}`);
    }
  }

  updateForkMarkersVisibility();
}

function mapModifierToSpanish(step) {
  if (!step) return { lane: "center", label: "Sigue la ruta verde" };
  const m = step.modifier;
  const street = step.name ? ` hacia ${step.name}` : "";
  if (step.type === "arrive") return { lane: "center", label: `Llegaste a tu destino${street}` };
  if (m.includes("left")) return { lane: "left", label: `Gira o mantén carril izquierdo${street}` };
  if (m.includes("right")) return { lane: "right", label: `Toma carril o salida derecha${street}` };
  return { lane: "center", label: `Continúa recto${street}` };
}

function highlightLanes(activeLane, markOthersAvoid) {
  const slots = el.laneForkBar.querySelectorAll(".ios-lane-slot");
  slots.forEach((slot) => {
    const lane = slot.dataset.lane;
    slot.classList.remove("lane-take", "lane-avoid");
    if (lane === activeLane) slot.classList.add("lane-take");
    else if (markOthersAvoid) slot.classList.add("lane-avoid");
  });
}

/* ================= SIMULATION LOOP & LIVE GPS ================= */
function animationLoop(ts) {
  if (state.mode === "sim" && state.simPlaying && state.mainCoords.length) {
    if (!state.lastFrameTime) state.lastFrameTime = ts;
    const dt = Math.min(0.1, (ts - state.lastFrameTime) / 1000);
    state.lastFrameTime = ts;

    const metersPerSec = 18 * state.simSpeed;
    state.speedKmh = metersPerSec * 3.6;
    const maxDist = state.cumDistances[state.cumDistances.length - 1] || 0;
    state.simDistMeters = Math.min(maxDist, state.simDistMeters + metersPerSec * dt);

    const sample = sampleRouteAtDistance(state.simDistMeters);
    if (sample) {
      state.vehiclePos = sample.coord;
      state.vehicleHeading = sample.heading;
      updateNavigationHUD();
      focusCameraOnVehicle(false);
    }

    if (state.simDistMeters >= maxDist) {
      state.simPlaying = false;
      setPlayButtonUI(false);
      showToast("Llegaste al destino final");
    }
  } else {
    state.lastFrameTime = ts;
  }
  requestAnimationFrame(animationLoop);
}

function setPlayButtonUI(playing) {
  el.btnPlayPause.innerHTML = playing
    ? `<i data-lucide="pause" class="ico-sm"></i><span>Pausar</span>`
    : `<i data-lucide="play" class="ico-sm"></i><span>Simular</span>`;
  refreshLucideIcons();
}

function setCameraButtonUI(mode) {
  const active = mode !== "overview";
  const label = mode === "street" ? "Calle 3D" : mode === "aerial" ? "Aérea 3D" : "2D Ruta";
  el.btnToggleCamera.classList.toggle("active", active);
  el.btnToggleCamera.innerHTML = `<i data-lucide="compass" class="ico-md"></i><span>${label}</span>`;
  refreshLucideIcons();
}

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function startGpsMode() {
  if (!("geolocation" in navigator)) {
    showToast("GPS no soportado en este navegador");
    return;
  }
  state.mode = "gps";
  state.simPlaying = false;
  setPlayButtonUI(false);
  el.btnStartGps.innerHTML = `<i data-lucide="navigation" class="ico-sm"></i><span>Detener</span>`;
  el.btnStartGps.classList.add("active-gps");
  el.modeBadge.textContent = "GPS en vivo";
  el.modeBadge.classList.add("gps-live");
  refreshLucideIcons();

  window.addEventListener("deviceorientationabsolute", onDeviceCompass, true);
  window.addEventListener("deviceorientation", onDeviceCompass, true);

  state.gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, heading, speed } = pos.coords;
      state.vehiclePos = [longitude, latitude];
      state.speedKmh = speed != null && !Number.isNaN(speed) ? speed * 3.6 : 0;
      if (heading != null && !Number.isNaN(heading) && state.speedKmh > 4) {
        state.vehicleHeading = heading;
      } else if (state.deviceHeading != null) {
        state.vehicleHeading = state.deviceHeading;
      }
      updateNavigationHUD();
      focusCameraOnVehicle(false);
    },
    (err) => showToast(`GPS no disponible: ${err.message}`),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
}

function stopGpsMode() {
  if (state.gpsWatchId != null) {
    navigator.geolocation.clearWatch(state.gpsWatchId);
    state.gpsWatchId = null;
  }
  window.removeEventListener("deviceorientationabsolute", onDeviceCompass, true);
  window.removeEventListener("deviceorientation", onDeviceCompass, true);
  state.mode = "sim";
  el.btnStartGps.innerHTML = `<i data-lucide="navigation" class="ico-sm"></i><span>GPS</span>`;
  el.btnStartGps.classList.remove("active-gps");
  el.modeBadge.textContent = "Simulador";
  el.modeBadge.classList.remove("gps-live");
  refreshLucideIcons();
}

function onDeviceCompass(ev) {
  if (typeof ev.webkitCompassHeading === "number") {
    state.deviceHeading = ev.webkitCompassHeading;
  } else if (typeof ev.alpha === "number") {
    state.deviceHeading = (360 - ev.alpha) % 360;
  }
}

/* ================= CHECKPOINT STRIP & LEG SELECTOR ================= */
function renderCheckpointStrip() {
  el.checkpointStrip.innerHTML = TEGUCIGALPA_CHECKPOINTS.map(
    (cp) => `<button type="button" class="cp-pill" data-cp="${cp.id}">${cp.shortLabel}</button>`
  ).join("");

  el.checkpointStrip.querySelectorAll(".cp-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cp = TEGUCIGALPA_CHECKPOINTS.find((c) => c.id === btn.dataset.cp);
      if (cp) jumpToCheckpoint(cp);
    });
  });
}

function renderLegPills() {
  const stops = state.stops;
  let html = `<button type="button" class="leg-pill ${state.activeLeg === "all" ? "active" : ""}" data-leg="all">Completa</button>`;
  for (let i = 0; i < stops.length - 1; i++) {
    const shortB = stops[i + 1].name.split("(")[0].split(",")[0].trim();
    html += `<button type="button" class="leg-pill ${String(state.activeLeg) === String(i) ? "active" : ""}" data-leg="${i}">T${i + 1}: ${shortB}</button>`;
  }
  el.legFilterPills.innerHTML = html;

  el.legFilterPills.querySelectorAll(".leg-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeLeg = btn.dataset.leg;
      renderLegPills();
      fetchAndBuildRoutes();
    });
  });
}

/* ================= ITINERARY CONFIGURATOR MODAL ================= */
function openItineraryModal() {
  state.draftStops = structuredClone(state.stops);
  el.searchResults.innerHTML = "";
  renderDraftStopsList();
  el.itineraryModal.classList.remove("hidden");
}

function renderDraftStopsList() {
  el.stopsList.innerHTML = state.draftStops
    .map((s, idx) => {
      const role = idx === 0 ? "Origen" : idx === state.draftStops.length - 1 ? "Destino final" : `Parada ${idx}`;
      return `
        <li class="stop-row">
          <div class="stop-info">
            <div class="stop-role">${role}</div>
            <div class="stop-name">${s.name}</div>
            <div class="stop-coords">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</div>
          </div>
          <div class="stop-actions">
            <button type="button" class="stop-btn" data-act="up" data-idx="${idx}" title="Subir">${svgIcon("arrow-up", 14)}</button>
            <button type="button" class="stop-btn" data-act="down" data-idx="${idx}" title="Bajar">${svgIcon("arrow-down", 14)}</button>
            <button type="button" class="stop-btn danger" data-act="del" data-idx="${idx}" title="Eliminar">${svgIcon("trash", 14)}</button>
          </div>
        </li>
      `;
    })
    .join("");

  el.stopsList.querySelectorAll(".stop-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const act = btn.dataset.act;
      if (act === "up" && idx > 0) {
        [state.draftStops[idx - 1], state.draftStops[idx]] = [state.draftStops[idx], state.draftStops[idx - 1]];
      } else if (act === "down" && idx < state.draftStops.length - 1) {
        [state.draftStops[idx + 1], state.draftStops[idx]] = [state.draftStops[idx], state.draftStops[idx + 1]];
      } else if (act === "del") {
        if (state.draftStops.length <= 2) {
          showToast("Debes mantener al menos origen y destino");
          return;
        }
        state.draftStops.splice(idx, 1);
      }
      renderDraftStopsList();
    });
  });
}

async function searchPlacesHonduras(query) {
  if (!query.trim()) return;
  el.searchResults.innerHTML = `<li class="search-result-item">Buscando "${query}" en Honduras…</li>`;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=hn&limit=5&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "es" } });
    const items = await res.json();
    if (!items.length) {
      el.searchResults.innerHTML = `<li class="search-result-item">Sin resultados. Usa el botón Mapa para tocar un punto.</li>`;
      return;
    }
    el.searchResults.innerHTML = items
      .map(
        (it, i) => `
        <li class="search-result-item">
          <span>${it.display_name}</span>
          <button type="button" class="ios-mini-btn" data-add="${i}">Agregar</button>
        </li>
      `
      )
      .join("");

    el.searchResults.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const it = items[Number(btn.dataset.add)];
        state.draftStops.push({
          id: `place-${Date.now()}`,
          name: it.display_name.split(",").slice(0, 2).join(", "),
          lat: parseFloat(it.lat),
          lng: parseFloat(it.lon)
        });
        renderDraftStopsList();
        el.searchResults.innerHTML = "";
        el.searchInput.value = "";
      });
    });
  } catch {
    el.searchResults.innerHTML = `<li class="search-result-item">Error al buscar. Usa el botón Mapa.</li>`;
  }
}

/* ================= EVENT BINDINGS ================= */
function bindEvents() {
  el.btnStartGps.addEventListener("click", () => {
    if (state.mode === "gps") stopGpsMode();
    else startGpsMode();
  });

  el.btnPlayPause.addEventListener("click", () => {
    if (state.mode === "gps") stopGpsMode();
    state.simPlaying = !state.simPlaying;
    setPlayButtonUI(state.simPlaying);
    if (!state.simPlaying) cancelSpeech();
  });

  el.btnSimSpeed.addEventListener("click", () => {
    const speeds = [1, 5, 15];
    const next = speeds[(speeds.indexOf(state.simSpeed) + 1) % speeds.length];
    state.simSpeed = next;
    el.btnSimSpeed.textContent = `${next}x`;
  });

  el.simScrubber.addEventListener("input", () => {
    if (state.mode === "gps") stopGpsMode();
    cancelSpeech();
    state.spokenAlerts.clear();
    const totalDist = state.cumDistances[state.cumDistances.length - 1] || 0;
    state.simDistMeters = (Number(el.simScrubber.value) / 1000) * totalDist;
    state.lastAlongMeters = state.simDistMeters;
    const sample = sampleRouteAtDistance(state.simDistMeters);
    if (sample) {
      state.vehiclePos = sample.coord;
      state.vehicleHeading = sample.heading;
      updateNavigationHUD();
      focusCameraOnVehicle(true);
    }
  });

  el.btnToggleCamera.addEventListener("click", () => {
    const order = ["street", "aerial", "overview"];
    state.cameraMode = order[(order.indexOf(state.cameraMode) + 1) % order.length];
    setCameraButtonUI(state.cameraMode);
    if (state.cameraMode === "street") {
      state.followZoom = 18.8;
      focusCameraOnVehicle(false);
    } else if (state.cameraMode === "aerial") {
      state.followZoom = 16.4;
      focusCameraOnVehicle(false);
    } else if (state.mainCoords.length) {
      const bounds = state.mainCoords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(state.mainCoords[0], state.mainCoords[0])
      );
      state.map.fitBounds(bounds, {
        padding: { top: 80, bottom: 100, left: 60, right: 60 },
        pitch: 12,
        bearing: 0
      });
    }
  });

  el.btnToggleTheme.addEventListener("click", () => {
    const order = ["satellite", "light", "dark"];
    state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
    el.btnToggleTheme.innerHTML = `<i data-lucide="layers" class="ico-md"></i><span>${THEME_LABELS[state.theme]}</span>`;
    refreshLucideIcons();
    state.mapReady = false;
    state.map.setStyle(MAP_STYLES[state.theme]);
  });

  el.btnToggleRouteLine.addEventListener("click", () => {
    state.showRouteLine = !state.showRouteLine;
    el.btnToggleRouteLine.classList.toggle("active", state.showRouteLine);
    el.btnToggleRouteLine.innerHTML = state.showRouteLine
      ? `<i data-lucide="route" class="ico-md"></i><span>Guía</span>`
      : `<i data-lucide="eye-off" class="ico-md"></i><span>Sin línea</span>`;
    refreshLucideIcons();
    applyRouteLineVisibility();
    updateNavigationHUD();
    showToast(state.showRouteLine ? "Línea verde visible" : "Línea verde oculta · Carretera libre");
  });

  el.btnToggleCleanUi.addEventListener("click", () => {
    toggleCleanUiMode();
  });

  el.btnDismissBridgeAlert.addEventListener("click", () => {
    if (state.activeCheckpointId) {
      state.dismissedCheckpointId = state.activeCheckpointId;
    }
    el.bridgeAlert.classList.add("hidden");
  });

  el.btnZoomIn.addEventListener("click", () => {
    if (!state.map) return;
    const nextZoom = Math.min(20.5, Math.max(13, state.map.getZoom() + 0.7));
    if (state.cameraMode !== "overview") state.followZoom = nextZoom;
    state.map.easeTo({ zoom: nextZoom, duration: 200 });
  });

  el.btnZoomOut.addEventListener("click", () => {
    if (!state.map) return;
    const nextZoom = Math.min(20.5, Math.max(13, state.map.getZoom() - 0.7));
    if (state.cameraMode !== "overview") state.followZoom = nextZoom;
    state.map.easeTo({ zoom: nextZoom, duration: 200 });
  });

  el.btnToggleVoice.addEventListener("click", () => {
    state.voiceEnabled = !state.voiceEnabled;
    el.btnToggleVoice.classList.toggle("active", state.voiceEnabled);
    el.btnToggleVoice.innerHTML = state.voiceEnabled
      ? `<i data-lucide="volume-2" class="ico-md"></i><span>Voz</span>`
      : `<i data-lucide="volume-x" class="ico-md"></i><span>Muda</span>`;
    refreshLucideIcons();
    if (state.voiceEnabled) speakSpanish("Voz activada.");
    else cancelSpeech();
  });

  el.btnToggleItinerary.addEventListener("click", openItineraryModal);
  el.btnCloseModal.addEventListener("click", () => el.itineraryModal.classList.add("hidden"));
  el.btnCancelModal.addEventListener("click", () => el.itineraryModal.classList.add("hidden"));

  el.btnRestoreDefault.addEventListener("click", () => {
    state.draftStops = structuredClone(DEFAULT_STOPS);
    renderDraftStopsList();
    showToast("Itinerario original restaurado");
  });

  el.btnUseMyLocation.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      showToast("GPS no disponible en este dispositivo");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.draftStops[0] = {
          id: "gps-origin",
          name: "Mi ubicación GPS actual",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        renderDraftStopsList();
        showToast("Origen actualizado a tu GPS actual");
      },
      (err) => showToast(`Error GPS: ${err.message}`),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  el.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    searchPlacesHonduras(el.searchInput.value);
  });

  el.btnPickOnMap.addEventListener("click", () => {
    state.pickMode = true;
    el.itineraryModal.classList.add("hidden");
    showToast("Toca cualquier punto del mapa para agregarlo", 4000);
  });

  el.btnApplyItinerary.addEventListener("click", () => {
    state.stops = structuredClone(state.draftStops);
    state.activeLeg = "all";
    saveStops(state.stops);
    el.itineraryModal.classList.add("hidden");
    renderLegPills();
    fetchAndBuildRoutes();
  });
}

/* ================= BOOTSTRAP ================= */
document.addEventListener("DOMContentLoaded", () => {
  refreshLucideIcons();
  initMap();
  renderCheckpointStrip();
  renderLegPills();
  bindEvents();
  fetchAndBuildRoutes();
  requestAnimationFrame(animationLoop);
});
