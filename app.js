/**
 * NavTGU — Navegador GPS 3D Satelital con Motor SQLite (sql.js),
 * detección dinámica cero-hardcode de bucles 270°, rotondas y desvíos a desnivel.
 */

const SQLITE_STORAGE_KEY = "navtgu_sqlite_db_v2";
const FALLBACK_SQL_STORAGE_KEY = "navtgu_sql_fallback_v2";

const INITIAL_SQL_ROUTES_SEED = [
  {
    id: "ruta-completa",
    name: "Ruta Completa: Choluteca → 3 Destinos en Tegucigalpa",
    short_label: "Completa",
    category: "preset",
    is_active: 1,
    stops: [
      { name: "Choluteca, Honduras (Salida)", lat: 13.306131, lng: -87.1955618 },
      { name: "Iglesia San Judas Tadeo (Blvd. Suyapa)", lat: 14.0798587, lng: -87.1569144 },
      { name: "La Reserva Event Center (Blvd. Santa Cristina, Miraflores)", lat: 14.0744, lng: -87.1927 },
      { name: "Hotel Comfort Inn (Altos de Miramonte / Mall Las Cascadas)", lat: 14.0759, lng: -87.1994 }
    ]
  },
  {
    id: "ruta-1-san-judas",
    name: "Ruta 1: Choluteca → Iglesia San Judas Tadeo",
    short_label: "R1: San Judas",
    category: "preset",
    is_active: 0,
    stops: [
      { name: "Choluteca, Honduras (Salida)", lat: 13.306131, lng: -87.1955618 },
      { name: "Iglesia San Judas Tadeo (Blvd. Suyapa)", lat: 14.0798587, lng: -87.1569144 }
    ]
  },
  {
    id: "ruta-2-la-reserva",
    name: "Ruta 2: Iglesia San Judas Tadeo → La Reserva Event Center",
    short_label: "R2: La Reserva",
    category: "preset",
    is_active: 0,
    stops: [
      { name: "Iglesia San Judas Tadeo (Blvd. Suyapa)", lat: 14.0798587, lng: -87.1569144 },
      { name: "La Reserva Event Center (Blvd. Santa Cristina, Miraflores)", lat: 14.0744, lng: -87.1927 }
    ]
  },
  {
    id: "ruta-3-comfort-inn",
    name: "Ruta 3: La Reserva Event Center → Hotel Comfort Inn",
    short_label: "R3: Comfort Inn",
    category: "preset",
    is_active: 0,
    stops: [
      { name: "La Reserva Event Center (Blvd. Santa Cristina, Miraflores)", lat: 14.0744, lng: -87.1927 },
      { name: "Hotel Comfort Inn (Altos de Miramonte / Mall Las Cascadas)", lat: 14.0759, lng: -87.1994 }
    ]
  }
];

const SATELLITE_HYBRID_STYLE = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    "google-satellite-4k": {
      type: "raster",
      tiles: [
        "https://mt0.google.com/vt/lyrs=s&hl=es&x={x}&y={y}&z={z}",
        "https://mt1.google.com/vt/lyrs=s&hl=es&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=s&hl=es&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=s&hl=es&x={x}&y={y}&z={z}"
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: "Google Satellite 4K · OpenMapTiles"
    },
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet"
    }
  },
  layers: [
    {
      id: "google-sat-4k-base",
      type: "raster",
      source: "google-satellite-4k",
      paint: {
        "raster-contrast": 0.14,
        "raster-saturation": 0.12,
        "raster-brightness-min": 0.02,
        "raster-fade-duration": 0
      }
    },
    {
      id: "road-asphalt-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 15.5,
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#090d14",
        "line-width": ["interpolate", ["linear"], ["zoom"], 15.5, 4, 19, 18],
        "line-opacity": 0.32
      }
    },
    {
      id: "road-asphalt-surface",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 15.5,
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#1e2430",
        "line-width": ["interpolate", ["linear"], ["zoom"], 15.5, 2.5, 19, 14],
        "line-opacity": 0.2
      }
    },
    {
      id: "buildings-3d",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 12.5,
      filter: ["!", ["has", "hide_3d"]],
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], 7],
          0, "#d97757",
          8, "#e7d8c5",
          16, "#cbd5e1",
          36, "#94a3b8"
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12.5, 0,
          14.0, ["max", 6.5, ["*", ["coalesce", ["get", "render_height"], 6.5], 1.45]]
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-opacity": 0.88
      }
    },
    {
      id: "vector-road-labels",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 13.5,
      layout: {
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name"], ["get", "ref"], ""],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 13.5, 10.5, 18.5, 14],
        "text-rotation-alignment": "map"
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(8, 12, 20, 0.94)",
        "text-halo-width": 1.8
      }
    },
    {
      id: "vector-place-labels",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 11.5,
      layout: {
        "text-field": ["coalesce", ["get", "name"], ""],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11.5, 11.5, 16, 14]
      },
      paint: {
        "text-color": "#f8fafc",
        "text-halo-color": "rgba(8, 12, 20, 0.94)",
        "text-halo-width": 2
      }
    }
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
    case "rotate-cw":
      return `<svg ${common}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;
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
  sqlDb: null,
  sqlMode: "SQLite WASM",
  sqlFallbackRoutes: null,
  activeRouteId: "ruta-completa",
  stops: [],
  draftStops: [],

  routes: [],
  mainCoords: [],
  cumDistances: [],
  steps: [],
  activeCheckpoints: [],
  dynamicAvoidFeatures: [],
  dynamicLoopFeatures: [],
  routeArrowFeatures: [],
  proceduralHouseFeatures: [],
  totalDistance: 0,
  totalDuration: 0,

  mode: "sim",
  simPlaying: false,
  simSpeed: 1,
  currentSimKmh: 58,
  simDistMeters: 0,
  lastAlongMeters: 0,
  vehiclePos: null,
  vehicleHeading: 0,
  smoothCameraBearing: 0,
  bankAngleDeg: 0,
  deviceHeading: null,
  speedKmh: 0,
  gpsWatchId: null,
  lastFrameTime: 0,

  cameraMode: "street",
  followZoom: 19.1,
  theme: "satellite",
  showRouteLine: true,
  cleanUiMode: false,
  voiceEnabled: true,
  pickMode: false,
  spokenAlerts: new Set(),

  activeCheckpointId: null,
  dismissedCheckpointId: null,
  bridgeAlertShownAt: 0,
  lastSpokenContextId: null,
  selectedVoice: null,
  audioCtx: null,
  voicePrewarmed: false,

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
  curveSpeedBadge: document.getElementById("curveSpeedBadge"),
  speedBadge: document.getElementById("speedBadge"),
  gearBadge: document.getElementById("gearBadge"),
  rpmBarFill: document.getElementById("rpmBarFill"),
  hudTitle: document.getElementById("hudTitle"),
  hudSubtitle: document.getElementById("hudSubtitle"),
  laneForkBar: document.getElementById("laneForkBar"),

  bridgeAlert: document.getElementById("bridgeAlert"),
  bridgeAlertTitle: document.getElementById("bridgeAlertTitle"),
  bridgeAlertDist: document.getElementById("bridgeAlertDist"),
  bridgePathsGrid: document.getElementById("bridgePathsGrid"),
  btnDismissBridgeAlert: document.getElementById("btnDismissBridgeAlert"),

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
  btnRestoreUi: document.getElementById("btnRestoreUi"),
  btnToggleVoice: document.getElementById("btnToggleVoice"),
  btnZoomIn: document.getElementById("btnZoomIn"),
  btnZoomOut: document.getElementById("btnZoomOut"),

  itineraryModal: document.getElementById("itineraryModal"),
  sqlStatusBadge: document.getElementById("sqlStatusBadge"),
  sqlRoutesList: document.getElementById("sqlRoutesList"),
  sqlRouteNameInput: document.getElementById("sqlRouteNameInput"),
  btnSaveNewSqlRoute: document.getElementById("btnSaveNewSqlRoute"),
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

function projectPointMeters([lng, lat], bearingDeg, meters) {
  const R = 6371000;
  const br = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lng);
  const dR = meters / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(br)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(dR) * Math.cos(lat1),
      Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [toDeg(lon2), toDeg(lat2)];
}

function normalizeAngle(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function shortPlaceName(name) {
  return String(name || "").split("(")[0].split(",")[0].trim() || "Destino";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast() {
  // Notificaciones flotantes deshabilitadas para vista limpia sin distracciones
  if (el.toastMsg) el.toastMsg.classList.add("hidden");
}

/* ================= SQLITE WASM DATABASE ENGINE ================= */
function uint8ToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function initFallbackSqlStore() {
  try {
    const raw = localStorage.getItem(FALLBACK_SQL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        state.sqlFallbackRoutes = parsed;
        return;
      }
    }
  } catch {
    // Usar semilla inicial si localStorage no tiene respaldo válido
  }
  state.sqlFallbackRoutes = structuredClone(INITIAL_SQL_ROUTES_SEED).map((r, i) => ({
    ...r,
    created_at: new Date(Date.now() + i * 1000).toISOString()
  }));
  persistFallbackStore();
}

function persistFallbackStore() {
  if (!state.sqlFallbackRoutes) return;
  try {
    localStorage.setItem(FALLBACK_SQL_STORAGE_KEY, JSON.stringify(state.sqlFallbackRoutes));
  } catch {
    // Ignorar límite de cuota
  }
}

function persistSqlDatabase() {
  if (state.sqlDb) {
    try {
      const data = state.sqlDb.export();
      localStorage.setItem(SQLITE_STORAGE_KEY, uint8ToBase64(data));
    } catch {
      // Ignorar límite de cuota
    }
  } else {
    persistFallbackStore();
  }
}

function createSqlSchema(db) {
  db.run("PRAGMA foreign_keys = ON;");
  db.run(`
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_label TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'custom',
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS route_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id TEXT NOT NULL,
      stop_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
    );
  `);
}

function seedInitialRoutesSql(db) {
  db.run("BEGIN TRANSACTION;");
  try {
    const insertRoute = db.prepare(
      "INSERT INTO routes (id, name, short_label, category, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?);"
    );
    const insertStop = db.prepare(
      "INSERT INTO route_stops (route_id, stop_order, name, lat, lng) VALUES (?, ?, ?, ?, ?);"
    );

    const baseTime = Date.now();
    INITIAL_SQL_ROUTES_SEED.forEach((route, rIdx) => {
      const createdAt = new Date(baseTime + rIdx * 1000).toISOString();
      insertRoute.run([
        route.id,
        route.name,
        route.short_label,
        route.category,
        route.is_active ? 1 : 0,
        createdAt
      ]);
      route.stops.forEach((st, sIdx) => {
        insertStop.run([route.id, sIdx, st.name, st.lat, st.lng]);
      });
    });

    insertRoute.free();
    insertStop.free();
    db.run("COMMIT;");
  } catch (err) {
    db.run("ROLLBACK;");
    throw err;
  }
  persistSqlDatabase();
}

async function initSqlDatabase() {
  if (typeof window.initSqlJs !== "function") {
    state.sqlMode = "Respaldo SQL Local";
    initFallbackSqlStore();
    return;
  }

  try {
    const SQL = await window.initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
    });

    let db = null;
    const savedB64 = localStorage.getItem(SQLITE_STORAGE_KEY);
    if (savedB64) {
      try {
        db = new SQL.Database(base64ToUint8(savedB64));
      } catch {
        db = null;
      }
    }
    if (!db) {
      db = new SQL.Database();
    }

    createSqlSchema(db);
    state.sqlDb = db;
    state.sqlMode = "SQLite WASM";

    const countRes = db.exec("SELECT COUNT(*) FROM routes;");
    const total = countRes?.[0]?.values?.[0]?.[0] ?? 0;
    if (total === 0) {
      seedInitialRoutesSql(db);
    }
  } catch {
    state.sqlDb = null;
    state.sqlMode = "Respaldo SQL Local";
    initFallbackSqlStore();
  }
}

function sqlQueryRows(sql, params = []) {
  const stmt = state.sqlDb.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

function sqlGetAllRoutes() {
  if (state.sqlDb) {
    return sqlQueryRows(`
      SELECT r.id, r.name, r.short_label, r.category, r.is_active, r.created_at,
             COUNT(s.id) AS stop_count
      FROM routes r
      LEFT JOIN route_stops s ON s.route_id = r.id
      GROUP BY r.id
      ORDER BY CASE WHEN r.category = 'preset' THEN 0 ELSE 1 END, r.created_at ASC;
    `);
  }
  return (state.sqlFallbackRoutes || []).map((r) => ({
    id: r.id,
    name: r.name,
    short_label: r.short_label,
    category: r.category,
    is_active: r.is_active ? 1 : 0,
    created_at: r.created_at,
    stop_count: r.stops.length
  }));
}

function sqlGetRouteStops(routeId) {
  if (state.sqlDb) {
    return sqlQueryRows(
      `SELECT stop_order, name, lat, lng FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC;`,
      [routeId]
    ).map((row) => ({
      id: `stop-${row.stop_order}-${Math.round(row.lat * 10000)}`,
      name: row.name,
      lat: Number(row.lat),
      lng: Number(row.lng)
    }));
  }
  const found = (state.sqlFallbackRoutes || []).find((r) => r.id === routeId);
  return found ? structuredClone(found.stops) : [];
}

function sqlSetActiveRoute(routeId) {
  if (state.sqlDb) {
    state.sqlDb.run("BEGIN TRANSACTION;");
    try {
      state.sqlDb.run("UPDATE routes SET is_active = 0;");
      state.sqlDb.run("UPDATE routes SET is_active = 1 WHERE id = ?;", [routeId]);
      state.sqlDb.run("COMMIT;");
    } catch (err) {
      state.sqlDb.run("ROLLBACK;");
      throw err;
    }
    persistSqlDatabase();
  } else if (state.sqlFallbackRoutes) {
    state.sqlFallbackRoutes.forEach((r) => {
      r.is_active = r.id === routeId ? 1 : 0;
    });
    persistFallbackStore();
  }
  state.activeRouteId = routeId;
}

function sqlSaveRoute({ id, name, shortLabel, category = "custom", stops, makeActive = true }) {
  const routeId = id || `ruta-${Date.now()}`;
  const cleanName = String(name || "").trim() || `${shortPlaceName(stops[0]?.name)} → ${shortPlaceName(stops[stops.length - 1]?.name)}`;
  const cleanShort = String(shortLabel || "").trim() || (cleanName.length > 18 ? `${cleanName.slice(0, 16)}…` : cleanName);
  const nowIso = new Date().toISOString();

  if (state.sqlDb) {
    const existing = sqlQueryRows("SELECT id, category, created_at FROM routes WHERE id = ?;", [routeId]);
    state.sqlDb.run("BEGIN TRANSACTION;");
    try {
      if (makeActive) {
        state.sqlDb.run("UPDATE routes SET is_active = 0;");
      }
      if (existing.length) {
        state.sqlDb.run(
          "UPDATE routes SET name = ?, short_label = ?, is_active = ? WHERE id = ?;",
          [cleanName, cleanShort, makeActive ? 1 : 0, routeId]
        );
        state.sqlDb.run("DELETE FROM route_stops WHERE route_id = ?;", [routeId]);
      } else {
        state.sqlDb.run(
          "INSERT INTO routes (id, name, short_label, category, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?);",
          [routeId, cleanName, cleanShort, category, makeActive ? 1 : 0, nowIso]
        );
      }

      const stmtStop = state.sqlDb.prepare(
        "INSERT INTO route_stops (route_id, stop_order, name, lat, lng) VALUES (?, ?, ?, ?, ?);"
      );
      stops.forEach((st, idx) => {
        stmtStop.run([routeId, idx, st.name, Number(st.lat), Number(st.lng)]);
      });
      stmtStop.free();
      state.sqlDb.run("COMMIT;");
    } catch (err) {
      state.sqlDb.run("ROLLBACK;");
      throw err;
    }
    persistSqlDatabase();
  } else {
    const list = state.sqlFallbackRoutes || [];
    if (makeActive) list.forEach((r) => (r.is_active = 0));
    const idx = list.findIndex((r) => r.id === routeId);
    const entry = {
      id: routeId,
      name: cleanName,
      short_label: cleanShort,
      category: idx >= 0 ? list[idx].category : category,
      is_active: makeActive ? 1 : 0,
      created_at: idx >= 0 ? list[idx].created_at : nowIso,
      stops: structuredClone(stops)
    };
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    persistFallbackStore();
  }

  if (makeActive) state.activeRouteId = routeId;
  return routeId;
}

function sqlDeleteRoute(routeId) {
  const all = sqlGetAllRoutes();
  if (all.length <= 1) {
    showToast("Debe permanecer al menos 1 ruta en la base SQL");
    return false;
  }

  if (state.sqlDb) {
    state.sqlDb.run("BEGIN TRANSACTION;");
    try {
      state.sqlDb.run("DELETE FROM route_stops WHERE route_id = ?;", [routeId]);
      state.sqlDb.run("DELETE FROM routes WHERE id = ?;", [routeId]);
      state.sqlDb.run("COMMIT;");
    } catch (err) {
      state.sqlDb.run("ROLLBACK;");
      throw err;
    }
    persistSqlDatabase();
  } else if (state.sqlFallbackRoutes) {
    state.sqlFallbackRoutes = state.sqlFallbackRoutes.filter((r) => r.id !== routeId);
    persistFallbackStore();
  }

  if (state.activeRouteId === routeId) {
    const remaining = sqlGetAllRoutes();
    if (remaining.length) {
      sqlSetActiveRoute(remaining[0].id);
    }
  }
  return true;
}

function sqlRestoreDefaultRoutes() {
  if (state.sqlDb) {
    state.sqlDb.run("DELETE FROM route_stops;");
    state.sqlDb.run("DELETE FROM routes;");
    seedInitialRoutesSql(state.sqlDb);
  } else {
    localStorage.removeItem(FALLBACK_SQL_STORAGE_KEY);
    initFallbackSqlStore();
  }
  state.activeRouteId = INITIAL_SQL_ROUTES_SEED[0].id;
}

function loadActiveRouteFromSql() {
  const routes = sqlGetAllRoutes();
  const active = routes.find((r) => Number(r.is_active) === 1) || routes[0];
  if (active) {
    state.activeRouteId = active.id;
    state.stops = sqlGetRouteStops(active.id);
  }
  updateSqlStatusBadge();
}

function updateSqlStatusBadge() {
  if (!el.sqlStatusBadge) return;
  const routes = sqlGetAllRoutes();
  const totalStops = routes.reduce((acc, r) => acc + Number(r.stop_count || 0), 0);
  el.sqlStatusBadge.textContent = `${state.sqlMode} · ${routes.length} rutas · ${totalStops} paradas`;
}

/* ================= VOICE ENGINE (ZERO LAG & NATURAL SPANISH) ================= */
function selectBestSpanishVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const esVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("es"));
  if (!esVoices.length) return null;

  const preferredTokens = [
    "natural",
    "online",
    "neural",
    "google español",
    "sabina",
    "dalia",
    "paulina",
    "mónica",
    "helena",
    "jorge"
  ];

  let best = esVoices[0];
  let bestScore = -1;
  for (const v of esVoices) {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();
    let score = 0;
    if (lang.includes("hn") || lang.includes("mx") || lang.includes("419")) score += 20;
    preferredTokens.forEach((tok, idx) => {
      if (name.includes(tok)) score += 100 - idx * 5;
    });
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  state.selectedVoice = best;
  return best;
}

function initVoiceEngine() {
  if (!("speechSynthesis" in window)) return;
  selectBestSpanishVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    selectBestSpanishVoice();
  };
}

function prewarmAudioAndSpeech() {
  if (state.voicePrewarmed) return;
  state.voicePrewarmed = true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !state.audioCtx) state.audioCtx = new AC();
    if (state.audioCtx && state.audioCtx.state === "suspended") {
      state.audioCtx.resume();
    }
  } catch {
    // Web Audio opcional
  }
  if ("speechSynthesis" in window) {
    try {
      selectBestSpanishVoice();
      const warm = new SpeechSynthesisUtterance("");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    } catch {
      // Ignorar si navegador restringe síntesis inicial
    }
  }
}

function playNavChime(stage) {
  if (!state.voiceEnabled || !stage) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!state.audioCtx) state.audioCtx = new AC();
    const ctx = state.audioCtx;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const notes = stage === "prep" ? [523.25, 659.25] : [659.25, 880.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.085);
      gain.gain.setValueAtTime(0.001, now + idx * 0.085);
      gain.gain.exponentialRampToValueAtTime(0.075, now + idx * 0.085 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.085 + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.085);
      osc.stop(now + idx * 0.085 + 0.12);
    });
  } catch {
    // Web Audio opcional
  }
}

function cancelSpeech() {
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignorar
    }
  }
}

function speakSpanish(text, alertKey, contextId = null, chimeStage = null) {
  if (!state.voiceEnabled) return;
  if (alertKey && state.spokenAlerts.has(alertKey)) return;
  if (alertKey) state.spokenAlerts.add(alertKey);
  state.lastSpokenContextId = contextId;
  if (chimeStage) playNavChime(chimeStage);
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = state.selectedVoice || selectBestSpanishVoice();
    if (voice) utter.voice = voice;
    utter.lang = voice?.lang || "es-HN";
    utter.rate = state.mode === "sim" && state.simSpeed > 1 ? 1.32 : 1.15;
    utter.pitch = 1.02;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignorar errores si el navegador bloquea autoplay de voz
  }
}

/* ================= MAP INITIALIZATION & REALISTIC LAYERS ================= */
function ensureChevronImage(map) {
  if (!map || map.hasImage("route-chevron")) return;
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.strokeStyle = "rgba(3, 24, 11, 0.9)";
  ctx.lineWidth = 6.2;
  ctx.beginPath();
  ctx.moveTo(8, 21);
  ctx.lineTo(16, 9);
  ctx.lineTo(24, 21);
  ctx.stroke();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(8, 21);
  ctx.lineTo(16, 9);
  ctx.lineTo(24, 21);
  ctx.stroke();

  const imgData = ctx.getImageData(0, 0, size, size);
  map.addImage("route-chevron", { width: size, height: size, data: imgData.data });
}

function ensureFacadeTexture(map) {
  if (!map || map.hasImage("building-facade-tex")) return;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Base translúcida arquitectónica con losas de entrepiso y ventanales realistas
  ctx.fillStyle = "rgba(30, 41, 59, 0.25)";
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 4;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = 0; r < rows; r++) {
    // Losa de concreto horizontal entre pisos
    ctx.fillStyle = "rgba(226, 232, 240, 0.35)";
    ctx.fillRect(0, r * cellH, size, 2);

    for (let c = 0; c < cols; c++) {
      const warm = (r + c) % 3 === 0;
      ctx.fillStyle = warm ? "rgba(253, 224, 140, 0.65)" : "rgba(147, 197, 253, 0.52)";
      ctx.fillRect(c * cellW + 3, r * cellH + 4, cellW - 6, cellH - 7);
      ctx.strokeStyle = "rgba(15, 23, 42, 0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(c * cellW + 3, r * cellH + 4, cellW - 6, cellH - 7);
    }
  }

  const imgData = ctx.getImageData(0, 0, size, size);
  map.addImage("building-facade-tex", { width: size, height: size, data: imgData.data });
}

function initMap() {
  let fallbackApplied = false;
  state.map = new maplibregl.Map({
    container: "map",
    style: MAP_STYLES[state.theme],
    center: [-87.185, 14.072],
    zoom: 19.1,
    maxZoom: 21,
    pitch: 76,
    maxPitch: 82,
    bearing: 0,
    fadeDuration: 0,
    pixelRatio: Math.min((window.devicePixelRatio || 1) * 1.35, 3),
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
    if (typeof state.map.setLight === "function") {
      try {
        state.map.setLight({
          anchor: "map",
          color: "#fffaf0",
          intensity: 0.68,
          position: [1.4, 210, 36]
        });
      } catch {
        // Luz direccional opcional
      }
    }
    if (state.theme === "satellite" && typeof state.map.setSky === "function") {
      try {
        state.map.setSky({
          "sky-color": "#142c4c",
          "sky-horizon-blend": 0.45,
          "horizon-color": "#93c5fd",
          "horizon-fog-blend": 0.62,
          "fog-color": "#cbd5e1",
          "fog-ground-blend": 0.35
        });
      } catch {
        // Sky opcional según soporte WebGL/MapLibre
      }
    }
    ensureRouteLayers();
    renderAllMapData();
    applyRouteLineVisibility();
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
      return;
    }

    if (window.innerWidth <= 768) {
      toggleCleanUiMode();
    }
  });
}

function ensureRouteLayers() {
  const m = state.map;
  if (!m) return;

  ensureChevronImage(m);
  ensureFacadeTexture(m);

  const sources = {
    "procedural-houses-src": { type: "geojson", data: emptyFC() },
    "alt-routes-src": { type: "geojson", data: emptyFC() },
    "avoid-forks-src": { type: "geojson", data: emptyFC() },
    "main-route-src": { type: "geojson", data: emptyFC() },
    "loop-highlight-src": { type: "geojson", data: emptyFC() },
    "route-arrows-src": { type: "geojson", data: emptyFC() }
  };

  for (const [id, spec] of Object.entries(sources)) {
    if (!m.getSource(id)) m.addSource(id, spec);
  }

  // Casas y edificios 3D procedurales con textura a lo largo de la calle
  if (!m.getLayer("procedural-houses-3d")) {
    m.addLayer({
      id: "procedural-houses-3d",
      type: "fill-extrusion",
      source: "procedural-houses-src",
      minzoom: 14.5,
      paint: {
        "fill-extrusion-color": ["get", "color"],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14.5, 0,
          15.5, ["get", "height"]
        ],
        "fill-extrusion-base": 0,
        "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-opacity": 0.9
      }
    });
  }

  if (!m.getLayer("procedural-houses-tex")) {
    try {
      m.addLayer({
        id: "procedural-houses-tex",
        type: "fill-extrusion",
        source: "procedural-houses-src",
        minzoom: 15.2,
        paint: {
          "fill-extrusion-pattern": "building-facade-tex",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15.2, 0,
            15.8, ["get", "height"]
          ],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.42
        }
      });
    } catch {
      // Patrón opcional según soporte WebGL
    }
  }

  // Edificios reales OSM en estilos claro/oscuro/satélite + capa de ventanas texturizadas
  if (m.getSource("openmaptiles") && !m.getLayer("buildings-3d") && !m.getLayer("building-3d")) {
    m.addLayer({
      id: "buildings-3d",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 12.5,
      filter: ["!", ["has", "hide_3d"]],
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], 7],
          0, "#d97757",
          8, "#e7d8c5",
          16, "#cbd5e1",
          36, "#94a3b8"
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12.5, 0,
          14.0, ["max", 6.5, ["*", ["coalesce", ["get", "render_height"], 6.5], 1.45]]
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-opacity": 0.88
      }
    });
  }

  if (m.getSource("openmaptiles") && !m.getLayer("buildings-3d-tex")) {
    try {
      m.addLayer({
        id: "buildings-3d-tex",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14.8,
        filter: ["!", ["has", "hide_3d"]],
        paint: {
          "fill-extrusion-pattern": "building-facade-tex",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14.8, 0,
            15.6, ["max", 6.6, ["*", ["coalesce", ["get", "render_height"], 6.5], 1.45]]
          ],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.36
        }
      });
    } catch {
      // Patrón opcional según soporte WebGL
    }
  }

  if (!m.getLayer("alt-routes-layer")) {
    m.addLayer({
      id: "alt-routes-layer",
      type: "line",
      source: "alt-routes-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ff9f0a",
        "line-width": 4.5,
        "line-opacity": 0.72,
        "line-dasharray": [2, 1.5]
      }
    });
  }

  if (!m.getLayer("avoid-forks-casing")) {
    m.addLayer({
      id: "avoid-forks-casing",
      type: "line",
      source: "avoid-forks-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#1a0608",
        "line-width": 8.5,
        "line-opacity": 0.6
      }
    });
  }

  if (!m.getLayer("avoid-forks-layer")) {
    m.addLayer({
      id: "avoid-forks-layer",
      type: "line",
      source: "avoid-forks-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ff453a",
        "line-width": 5,
        "line-opacity": 0.92,
        "line-dasharray": [1.5, 1.2]
      }
    });
  }

  if (!m.getLayer("main-route-glow")) {
    m.addLayer({
      id: "main-route-glow",
      type: "line",
      source: "main-route-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#022c16",
        "line-width": 15,
        "line-opacity": 0.65,
        "line-blur": 2.4
      }
    });
  }

  if (!m.getLayer("main-route-casing")) {
    m.addLayer({
      id: "main-route-casing",
      type: "line",
      source: "main-route-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 9.5,
        "line-opacity": 0.94
      }
    });
  }

  if (!m.getLayer("main-route-layer")) {
    m.addLayer({
      id: "main-route-layer",
      type: "line",
      source: "main-route-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#00e676",
        "line-width": 6,
        "line-opacity": 1
      }
    });
  }

  if (!m.getLayer("loop-highlight-halo")) {
    m.addLayer({
      id: "loop-highlight-halo",
      type: "line",
      source: "loop-highlight-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ff9f0a",
        "line-width": 10.5,
        "line-opacity": 0.6,
        "line-blur": 1.8
      }
    });
  }

  if (!m.getLayer("loop-highlight-layer")) {
    m.addLayer({
      id: "loop-highlight-layer",
      type: "line",
      source: "loop-highlight-src",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ff3b30",
        "line-width": 6.2,
        "line-opacity": 0.98
      }
    });
  }

  if (!m.getLayer("route-arrows-layer")) {
    m.addLayer({
      id: "route-arrows-layer",
      type: "symbol",
      source: "route-arrows-src",
      minzoom: 13.5,
      layout: {
        "icon-image": "route-chevron",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 13.5, 0.45, 18.5, 0.72],
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      }
    });
  }

  applyRouteLineVisibility();
}

function applyRouteLineVisibility() {
  const m = state.map;
  if (!m || !state.mapReady) return;
  const vis = state.showRouteLine ? "visible" : "none";
  for (const id of [
    "main-route-glow",
    "main-route-casing",
    "main-route-layer",
    "loop-highlight-halo",
    "loop-highlight-layer",
    "route-arrows-layer"
  ]) {
    if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", vis);
  }
}

function toggleCleanUiMode(force = null) {
  state.cleanUiMode = force !== null ? Boolean(force) : !state.cleanUiMode;
  document.body.classList.toggle("ios-clean-mode", state.cleanUiMode);
  if (el.btnRestoreUi) {
    el.btnRestoreUi.classList.toggle("hidden", !state.cleanUiMode);
  }
  if (el.btnToggleCleanUi) {
    el.btnToggleCleanUi.classList.toggle("active", state.cleanUiMode);
    el.btnToggleCleanUi.innerHTML = state.cleanUiMode
      ? `<i data-lucide="eye" class="ico-md"></i>`
      : `<i data-lucide="eye-off" class="ico-md"></i>`;
    refreshLucideIcons();
  }
  updateNavigationHUD();
}

function emptyFC() {
  return { type: "FeatureCollection", features: [] };
}

/* ================= ZERO-HARDCODE OSRM ROUTING & GEOMETRY ANALYZER ================= */
async function fetchAndBuildRoutes() {
  const activeStops = state.stops;
  if (!activeStops || activeStops.length < 2) return;

  el.hudTitle.textContent = "Calculando ruta satelital…";
  el.hudSubtitle.textContent = "Analizando geometría, rotondas, bucles y desvíos";

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
        // Rutas alternativas opcionales
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

function buildAvoidStubsForIntersection(inter, roadName) {
  if (!inter || !Array.isArray(inter.bearings) || !Array.isArray(inter.location)) return [];
  const stubs = [];
  const origin = inter.location;
  const outBearing = typeof inter.out === "number" ? inter.bearings[inter.out] : null;
  const entries = Array.isArray(inter.entry) ? inter.entry : null;

  inter.bearings.forEach((bearingDeg, bIdx) => {
    if (bIdx === inter.in || bIdx === inter.out) return;
    if (entries && entries[bIdx] === false) return;
    const diffOut = outBearing !== null ? Math.abs(normalizeAngle(bearingDeg - outBearing)) : 90;
    if (diffOut < 14) return;
    const tip = projectPointMeters(origin, bearingDeg, 30);
    const dirLabel = normalizeAngle(bearingDeg - (outBearing ?? bearingDeg)) >= 0 ? "derecha" : "izquierda";
    stubs.push({
      label: `EVITAR desvío a ${dirLabel}${roadName ? ` (${roadName})` : ""}`,
      coords: [origin, tip]
    });
  });

  return stubs;
}

function detectLoopsAndHairpinsFromGeometry(coords, cum) {
  if (coords.length < 5) return [];

  // Filtrar vértices muy juntos (< 4 m) para evitar ruido angular de GPS/OSM
  const cleaned = [{ idx: 0, coord: coords[0], dist: cum[0] }];
  for (let i = 1; i < coords.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    if (cum[i] - prev.dist >= 4 || i === coords.length - 1) {
      cleaned.push({ idx: i, coord: coords[i], dist: cum[i] });
    }
  }
  if (cleaned.length < 4) return [];

  const segBearings = [];
  for (let k = 0; k < cleaned.length - 1; k++) {
    segBearings.push(calculateBearing(cleaned[k].coord, cleaned[k + 1].coord));
  }

  const detected = [];
  let i = 0;
  while (i < segBearings.length - 2) {
    let netAngle = 0;
    let maxAbsAngle = 0;
    let peakJ = i;
    let dominantSign = 0;
    let endScan = i;

    for (let j = i + 1; j < segBearings.length; j++) {
      const spanDist = cleaned[j + 1].dist - cleaned[i].dist;
      if (spanDist > 340) break;

      const dAng = normalizeAngle(segBearings[j] - segBearings[j - 1]);
      if (dominantSign === 0 && Math.abs(dAng) >= 6) {
        dominantSign = Math.sign(dAng);
      }

      // Si hay un giro sostenido en dirección opuesta superior a 45°, termina la curva actual
      if (dominantSign !== 0 && dAng * dominantSign < -45) break;

      netAngle += dAng;
      if (Math.abs(netAngle) > maxAbsAngle) {
        maxAbsAngle = Math.abs(netAngle);
        peakJ = j;
      }
      endScan = j;
    }

    if (maxAbsAngle >= 155) {
      // Recortar segmentos casi rectos del inicio y fin para encajar exacto en el bucle
      let sK = i;
      while (sK < peakJ - 1) {
        const dStart = Math.abs(normalizeAngle(segBearings[sK + 1] - segBearings[sK]));
        if (dStart >= 7) break;
        sK++;
      }
      let eK = Math.min(peakJ + 1, cleaned.length - 1);
      while (eK > sK + 2) {
        const dEnd = Math.abs(normalizeAngle(segBearings[eK - 1] - segBearings[eK - 2]));
        if (dEnd >= 6) break;
        eK--;
      }

      const startOrigIdx = cleaned[sK].idx;
      const endOrigIdx = cleaned[Math.min(eK, cleaned.length - 1)].idx;
      const startDist = cum[startOrigIdx];
      const endDist = cum[endOrigIdx];
      const arcLen = Math.max(15, endDist - startDist);
      const turnRad = toRad(maxAbsAngle);
      const avgRadiusM = arcLen / Math.max(0.5, turnRad);

      // Filtrar curvas abiertas de autopista (radio grande); conservar bucles y vueltas cerradas reales
      if (avgRadiusM <= 88) {
        const is270 = maxAbsAngle >= 195;
        const absDeg = Math.round(maxAbsAngle);
        const turnDir = netAngle >= 0 ? "right" : "left";
        const dirWord = turnDir === "right" ? "derecha" : "izquierda";
        const laneWord = turnDir === "right" ? "derecho" : "izquierdo";
        const recSpeed = is270 ? 25 : 30;
        const entryBearing = segBearings[sK];

        detected.push({
          id: `dyn-loop-${Math.round(startDist)}`,
          kind: is270 ? "loop270" : "hairpin",
          shortLabel: is270 ? `Bucle ${absDeg}°` : `Curva ${absDeg}°`,
          title: is270
            ? `Vuelta en bucle a desnivel (${absDeg}° · ${dirWord})`
            : `Vuelta completamente cerrada (${absDeg}° · ${dirWord})`,
          coord: coords[startOrigIdx],
          lat: coords[startOrigIdx][1],
          lng: coords[startOrigIdx][0],
          distAlong: startDist,
          endDistAlong: endDist,
          arcLen,
          turnDeg: absDeg,
          recommendedSpeed: recSpeed,
          takeLane: turnDir,
          prepHeadline: `Prepárate: Vuelta cerrada de ${absDeg}° a la ${dirWord}, pasa al carril ${laneWord} y reduce a ${recSpeed} km/h`,
          actionHeadline: `Gira siguiendo el bucle completo a la ${dirWord} sin salirte del carril (${recSpeed} km/h)`,
          loopCoords: coords.slice(startOrigIdx, endOrigIdx + 1),
          entryBearing,
          avoidStubs: []
        });
        i = Math.max(endScan, eK);
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return detected;
}

function extractDynamicManeuverCheckpoints(route, flatSteps) {
  const rawCps = [];
  const allIntersections = [];

  for (const step of flatSteps) {
    for (const inter of step.intersections || []) {
      allIntersections.push({ inter, stepName: step.name });
    }
  }

  for (let idx = 0; idx < flatSteps.length; idx++) {
    const step = flatSteps[idx];
    const mType = step.type || "";
    const mod = step.modifier || "straight";
    const roadName = step.rotaryName || step.name || "";

    // Evitar duplicar checkpoint al salir de rotonda (ya cubierto al entrar)
    if (mType === "exit roundabout" || mType === "exit rotary" || mType === "depart") continue;

    if (mType === "roundabout" || mType === "rotary" || mType === "roundabout turn") {
      const exitNum = step.exit || 1;
      const nextStep = flatSteps[idx + 1];
      const nextRoad = nextStep && nextStep.name ? ` hacia ${nextStep.name}` : roadName ? ` hacia ${roadName}` : "";
      const exitStep = flatSteps.slice(idx + 1, idx + 4).find((s) => s.type === "exit roundabout" || s.type === "exit rotary");
      const endDist = exitStep ? Math.max(step.distAlong + 35, exitStep.distAlong + 15) : step.distAlong + Math.max(40, Math.min(180, step.distance));

      const takeLane = mod.includes("left") ? "left" : mod.includes("straight") ? "center" : "right";
      const avoidStubs = [];
      for (const inter of step.intersections || []) {
        avoidStubs.push(...buildAvoidStubsForIntersection(inter, roadName));
      }

      rawCps.push({
        id: `dyn-rb-${Math.round(step.distAlong)}`,
        kind: "roundabout",
        shortLabel: `Rotonda S${exitNum}`,
        title: `Rotonda${roadName ? ` (${roadName})` : ""} · Salida ${exitNum}`,
        coord: step.coord,
        lat: step.coord[1],
        lng: step.coord[0],
        distAlong: step.distAlong,
        endDistAlong: endDist,
        recommendedSpeed: 30,
        takeLane,
        prepHeadline: `Rotonda adelante: Reduce a 30 km/h, prepárate para la salida ${exitNum}${nextRoad}`,
        actionHeadline: `Entra a la rotonda y toma la salida ${exitNum}${nextRoad}`,
        avoidStubs
      });
      continue;
    }

    const isRampOrFork = mType === "off ramp" || mType === "on ramp" || mType === "fork" || mType === "merge";
    const isUturn = mod.includes("uturn");
    const isSharp = mod.includes("sharp");

    if (isRampOrFork || isUturn || isSharp) {
      const isLeft = mod.includes("left") || isUturn;
      const isRight = !isUturn && mod.includes("right");
      const takeLane = isLeft ? "left" : isRight ? "right" : "center";
      const laneWord = isLeft ? "izquierdo" : isRight ? "derecho" : "central";
      const dirWord = isUturn ? "el retorno" : isLeft ? "la izquierda" : isRight ? "la derecha" : "al frente";
      const destRoad = roadName ? ` hacia ${roadName}` : "";

      const avoidStubs = [];
      for (const inter of step.intersections || []) {
        avoidStubs.push(...buildAvoidStubsForIntersection(inter, roadName));
      }

      const kind = isUturn ? "hairpin" : isRampOrFork ? "ramp" : "turn";
      const recSpeed = isUturn ? 30 : 45;
      const titleBase = isUturn
        ? `Retorno cerrado${destRoad}`
        : mType === "off ramp"
        ? `Salida / Rampa a desnivel${destRoad}`
        : mType === "on ramp"
        ? `Incorporación / Rampa${destRoad}`
        : `Bifurcación${destRoad}`;

      rawCps.push({
        id: `dyn-man-${Math.round(step.distAlong)}`,
        kind,
        shortLabel: isUturn ? "Retorno" : isRampOrFork ? "Rampa" : "Giro cerrado",
        title: titleBase,
        coord: step.coord,
        lat: step.coord[1],
        lng: step.coord[0],
        distAlong: step.distAlong,
        endDistAlong: step.distAlong + (isUturn ? 55 : 30),
        recommendedSpeed: recSpeed,
        takeLane,
        prepHeadline: `Prepárate: Ve pasándote al carril ${laneWord} antes de ${titleBase.toLowerCase()}`,
        actionHeadline: `Ahora: Toma ${dirWord}${destRoad}`,
        avoidStubs
      });
    }
  }

  return { rawCps, allIntersections };
}

function analyzeRouteGeometryAndManeuvers(route, coords, cum, flatSteps) {
  const geomLoops = detectLoopsAndHairpinsFromGeometry(coords, cum);
  const { rawCps, allIntersections } = extractDynamicManeuverCheckpoints(route, flatSteps);

  // Enriquecer cada bucle geométrico con desvíos reales desde las intersecciones OSRM cercanas o tangente recta
  for (const loop of geomLoops) {
    const nearbyAvoids = [];
    for (const item of allIntersections) {
      if (haversineMeters(loop.coord, item.inter.location) <= 45) {
        nearbyAvoids.push(...buildAvoidStubsForIntersection(item.inter, item.stepName));
      }
    }
    if (!nearbyAvoids.length && typeof loop.entryBearing === "number") {
      const straightTip = projectPointMeters(loop.coord, loop.entryBearing, 30);
      nearbyAvoids.push({
        label: "EVITAR: Seguir recto (te pasas la entrada de la vuelta cerrada)",
        coords: [loop.coord, straightTip]
      });
    }
    loop.avoidStubs = nearbyAvoids;
  }

  // Combinar loops geométricos y checkpoints de OSRM fusionando los que coinciden en < 90 m
  const combined = [...geomLoops, ...rawCps].sort((a, b) => a.distAlong - b.distAlong);
  const merged = [];
  const priority = { loop270: 4, roundabout: 4, hairpin: 3, ramp: 2, turn: 1 };

  for (const cp of combined) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(cp.distAlong - prev.distAlong) < 90) {
      const keepNew = (priority[cp.kind] || 0) > (priority[prev.kind] || 0);
      if (keepNew) {
        cp.avoidStubs = [...(cp.avoidStubs || []), ...(prev.avoidStubs || [])];
        if (!cp.loopCoords && prev.loopCoords) cp.loopCoords = prev.loopCoords;
        merged[merged.length - 1] = cp;
      } else {
        prev.avoidStubs = [...(prev.avoidStubs || []), ...(cp.avoidStubs || [])];
        if (!prev.loopCoords && cp.loopCoords) prev.loopCoords = cp.loopCoords;
        if (cp.endDistAlong > prev.endDistAlong) prev.endDistAlong = cp.endDistAlong;
      }
    } else {
      merged.push(cp);
    }
  }

  // Numerar dinámicamente etiquetas cortas y construir lista de opciones para el banner
  const avoidFeatures = [];
  const loopFeatures = [];

  merged.forEach((cp, idx) => {
    cp.indexNum = idx + 1;
    cp.shortLabel = `${idx + 1}. ${cp.shortLabel}`;

    const takeDesc =
      cp.kind === "loop270"
        ? `TOMAR: Mantén el carril ${cp.takeLane === "right" ? "derecho" : "izquierdo"} y completa el giro de ${cp.turnDeg}° (${cp.recommendedSpeed} km/h)`
        : cp.kind === "roundabout"
        ? `TOMAR: ${cp.actionHeadline}`
        : `TOMAR: ${cp.actionHeadline}`;

    const paths = [{ type: "take", label: takeDesc }];
    const seenLabels = new Set();

    for (const stub of cp.avoidStubs || []) {
      avoidFeatures.push({
        type: "Feature",
        properties: { label: `${cp.title} — ${stub.label}` },
        geometry: { type: "LineString", coordinates: stub.coords }
      });
      if (!seenLabels.has(stub.label)) {
        seenLabels.add(stub.label);
        paths.push({ type: "avoid", label: stub.label });
      }
    }
    if (paths.length === 1) {
      paths.push({
        type: "avoid",
        label: cp.kind === "loop270" || cp.kind === "hairpin"
          ? "EVITAR: Tomar salida tangente antes de completar el giro"
          : "EVITAR: Carril contrario al desvío indicado"
      });
    }
    cp.paths = paths;

    if (cp.loopCoords && cp.loopCoords.length >= 2) {
      loopFeatures.push({
        type: "Feature",
        properties: { title: cp.title },
        geometry: { type: "LineString", coordinates: cp.loopCoords }
      });
    } else if (cp.kind === "roundabout") {
      const rbSlice = sliceCoordsByDistance(coords, cum, cp.distAlong, cp.endDistAlong);
      if (rbSlice.length >= 2) {
        loopFeatures.push({
          type: "Feature",
          properties: { title: cp.title },
          geometry: { type: "LineString", coordinates: rbSlice }
        });
      }
    }
  });

  state.activeCheckpoints = merged;
  state.dynamicAvoidFeatures = avoidFeatures;
  state.dynamicLoopFeatures = loopFeatures;
}

function sliceCoordsByDistance(coords, cum, startM, endM) {
  const out = [];
  for (let i = 0; i < coords.length; i++) {
    if (cum[i] >= startM - 10 && cum[i] <= endM + 10) {
      out.push(coords[i]);
    }
  }
  return out;
}

function buildRouteArrowChevrons(coords, cum) {
  const features = [];
  const maxD = cum[cum.length - 1] || 0;
  if (maxD < 30) return features;

  let cursor = 35;
  while (cursor < maxD - 20) {
    const insideTight = state.activeCheckpoints.some(
      (c) => (c.kind === "loop270" || c.kind === "hairpin" || c.kind === "roundabout") &&
        cursor >= c.distAlong - 20 &&
        cursor <= (c.endDistAlong || c.distAlong + 30) + 15
    );
    const stepM = insideTight ? 20 : 85;
    const sample = sampleRouteAtDistance(cursor);
    if (sample) {
      features.push({
        type: "Feature",
        properties: { bearing: sample.heading },
        geometry: { type: "Point", coordinates: sample.coord }
      });
    }
    cursor += stepM;
  }
  return features;
}

function buildProcedural3dHouses(coords, cum) {
  const features = [];
  const maxD = cum[cum.length - 1] || 0;
  if (coords.length < 2 || maxD < 60) return features;

  const stopCoords = (state.stops || [])
    .map((s) => s?.coord || (Number.isFinite(s?.lng) && Number.isFinite(s?.lat) ? [s.lng, s.lat] : null))
    .filter(Boolean);

  // Subsample long straight segments so cloverleafs, ramps, and parallel roads keep >= 15 m clearance
  const checkPts = [];
  for (let i = 0; i < coords.length; i++) {
    const a = coords[i];
    checkPts.push(a);
    if (i + 1 < coords.length) {
      const b = coords[i + 1];
      const segM = haversineMeters(a, b);
      if (segM > 14) {
        const parts = Math.min(20, Math.floor(segM / 12));
        for (let k = 1; k < parts; k++) {
          const t = k / parts;
          checkPts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
    }
  }

  const palette = [
    "#d6cfc2",
    "#cbd5e1",
    "#bfa893",
    "#94a3b8",
    "#c9b9a6",
    "#a8b5c2",
    "#b89f8d",
    "#adb5bd"
  ];

  const seeded = (n) => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const hasClearance = (pt, minMeters) => {
    const lngTol = 0.00024;
    const latTol = 0.00024;
    for (let i = 0; i < checkPts.length; i++) {
      const p = checkPts[i];
      if (Math.abs(pt[0] - p[0]) > lngTol || Math.abs(pt[1] - p[1]) > latTol) continue;
      if (haversineMeters(pt, p) < minMeters) return false;
    }
    return true;
  };

  const isInUrbanCorridor = (distM, coord) => {
    if (distM <= 3000 || distM >= Math.max(0, maxD - 22000)) return true;
    for (let i = 0; i < stopCoords.length; i++) {
      const s = stopCoords[i];
      if (Math.abs(coord[0] - s[0]) < 0.028 && Math.abs(coord[1] - s[1]) < 0.028) {
        if (haversineMeters(coord, s) <= 2400) return true;
      }
    }
    return false;
  };

  let idxSeed = 1;
  let cursor = 25;
  while (cursor < maxD - 25 && features.length < 550) {
    const sample = sampleRouteAtDistance(cursor);
    if (!sample) {
      cursor += 40;
      continue;
    }

    if (!isInUrbanCorridor(cursor, sample.coord)) {
      cursor += 120;
      idxSeed += 1;
      continue;
    }

    for (const side of [-1, 1]) {
      if (features.length >= 550) break;
      idxSeed += 1;
      const r1 = seeded(idxSeed * 3 + side);
      const r2 = seeded(idxSeed * 5 + 11);
      const r3 = seeded(idxSeed * 7 + 19);

      if (r1 < 0.12) continue; // occasional yard/gap between buildings

      const offsetM = 17 + r2 * 9; // 17 m to 26 m off centerline
      const center = projectPointMeters(sample.coord, sample.heading + side * 90, offsetM);
      if (!hasClearance(center, 15.0)) continue;

      const isTall = r3 > 0.72;
      const halfAlongM = isTall ? 5.5 + r1 * 3.5 : 4.0 + r1 * 2.8;
      const halfAcrossM = isTall ? 4.2 + r2 * 2.5 : 3.2 + r2 * 1.8;
      const height = isTall ? 12.0 + r3 * 10.0 : 6.0 + r3 * 5.8; // 6.0..22.0 m
      const color = palette[Math.floor((r1 + r2 + r3) * 100) % palette.length];

      const fwd = sample.heading;
      const right = sample.heading + 90;
      const fCenter = projectPointMeters(center, fwd, halfAlongM);
      const bCenter = projectPointMeters(center, fwd + 180, halfAlongM);
      const c1 = projectPointMeters(fCenter, right + 180, halfAcrossM);
      const c2 = projectPointMeters(fCenter, right, halfAcrossM);
      const c3 = projectPointMeters(bCenter, right, halfAcrossM);
      const c4 = projectPointMeters(bCenter, right + 180, halfAcrossM);

      features.push({
        type: "Feature",
        properties: {
          height: Number(height.toFixed(1)),
          base: 0,
          color
        },
        geometry: {
          type: "Polygon",
          coordinates: [[c1, c2, c3, c4, c1]]
        }
      });
    }

    cursor += 30;
  }

  return features;
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
        exit: step.maneuver.exit || null,
        name: step.name || "",
        rotaryName: step.rotary_name || "",
        distance: step.distance,
        intersections: step.intersections || []
      });
    }
  }
  state.steps = flatSteps;

  analyzeRouteGeometryAndManeuvers(route, coords, cum, flatSteps);
  state.routeArrowFeatures = buildRouteArrowChevrons(coords, cum);
  state.proceduralHouseFeatures = buildProcedural3dHouses(coords, cum);

  el.metricTotalDist.textContent = `${(route.distance / 1000).toFixed(1)} km`;
  el.metricTotalTime.textContent = `${Math.round(route.duration / 60)} min`;
  el.metricRoutesCount.textContent = `${state.routes.length} rutas · ${state.activeCheckpoints.length} alertas`;
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
    const segMeters = cum[i + 1] - cum[i] || Math.hypot(dx, dy);
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

/* ================= RENDER MAP LAYERS & DYNAMIC MARKERS ================= */
function renderAllMapData() {
  if (!state.mapReady || !state.mainCoords.length) return;
  const m = state.map;

  m.getSource("main-route-src")?.setData({
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
  m.getSource("alt-routes-src")?.setData({ type: "FeatureCollection", features: altFeatures });
  m.getSource("avoid-forks-src")?.setData({ type: "FeatureCollection", features: state.dynamicAvoidFeatures });
  m.getSource("loop-highlight-src")?.setData({ type: "FeatureCollection", features: state.dynamicLoopFeatures });
  m.getSource("route-arrows-src")?.setData({ type: "FeatureCollection", features: state.routeArrowFeatures });
  m.getSource("procedural-houses-src")?.setData({
    type: "FeatureCollection",
    features: state.proceduralHouseFeatures || []
  });

  state.stopMarkers.forEach((mk) => mk.remove());
  state.stopMarkers = [];
  const activeStops = state.stops;
  activeStops.forEach((s, idx) => {
    const div = document.createElement("div");
    div.className = `stop-marker ${idx === 0 ? "origin" : idx === activeStops.length - 1 ? "final" : ""}`;
    const icon = idx === 0 ? svgIcon("flag", 12) : svgIcon("map-pin", 12);
    const label = shortPlaceName(s.name);
    div.innerHTML = `${icon}<span>${idx === 0 ? label : `${idx}. ${label}`}</span>`;
    const mk = new maplibregl.Marker({ element: div, anchor: "bottom" })
      .setLngLat([s.lng, s.lat])
      .addTo(m);
    state.stopMarkers.push(mk);
  });

  state.forkMarkers.forEach((item) => item.mk.remove());
  state.forkMarkers = [];

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
}

/* ================= VEHICLE POSITION, 3D ARROW, LOOP/ROUNDABOUT HUD & VOICE ================= */
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
  state.currentSimKmh = 64;
  state.activeCheckpointId = null;
  state.dismissedCheckpointId = null;
  state.bridgeAlertShownAt = 0;
  state.lastSpokenContextId = null;
  state.bankAngleDeg = 0;
  el.simScrubber.value = "0";
  state.spokenAlerts.clear();
  cancelSpeech();
  const sample = sampleRouteAtDistance(0);
  if (sample) {
    state.vehiclePos = sample.coord;
    state.vehicleHeading = sample.heading;
    state.smoothCameraBearing = sample.heading;
    updateNavigationHUD();
    focusCameraOnVehicle(true);
  }
}

function jumpToCheckpoint(cp) {
  if (state.mode === "gps") stopGpsMode();
  cancelSpeech();
  const startAlong = Math.max(0, cp.distAlong - 280);
  state.simDistMeters = startAlong;
  state.lastAlongMeters = startAlong;
  state.currentSimKmh = 52;
  state.activeCheckpointId = null;
  state.dismissedCheckpointId = null;
  state.bridgeAlertShownAt = 0;
  state.lastSpokenContextId = null;
  state.bankAngleDeg = 0;
  state.spokenAlerts.delete(`${cp.id}-prep`);
  state.spokenAlerts.delete(`${cp.id}-action`);

  const sample = sampleRouteAtDistance(startAlong);
  if (sample) {
    state.vehiclePos = sample.coord;
    state.vehicleHeading = sample.heading;
    state.smoothCameraBearing = sample.heading;
    state.simSpeed = 1;
    el.btnSimSpeed.textContent = "1x";
    state.simPlaying = true;
    setPlayButtonUI(true);
    state.cameraMode = "street";
    state.followZoom = 19.1;
    setCameraButtonUI("street");
    updateNavigationHUD();
    focusCameraOnVehicle(true);
  }
}

function focusCameraOnVehicle(immediate = false) {
  if (!state.map || !state.vehiclePos) return;
  if (immediate || state.smoothCameraBearing == null) {
    state.smoothCameraBearing = state.vehicleHeading;
  } else {
    const diff = normalizeAngle(state.vehicleHeading - state.smoothCameraBearing);
    state.smoothCameraBearing = (state.smoothCameraBearing + diff * 0.24 + 360) % 360;
  }

  if (state.cameraMode === "street") {
    const opts = {
      center: state.vehiclePos,
      zoom: state.followZoom,
      pitch: 76,
      bearing: state.smoothCameraBearing,
      padding: { top: Math.round(window.innerHeight * 0.36), bottom: 0, left: 0, right: 0 }
    };
    if (immediate) state.map.jumpTo(opts);
    else state.map.easeTo({ ...opts, duration: 180, easing: (t) => t });
  } else if (state.cameraMode === "aerial") {
    const opts = {
      center: state.vehiclePos,
      zoom: state.followZoom,
      pitch: 58,
      bearing: state.smoothCameraBearing,
      padding: { top: 0, bottom: 0, left: 0, right: 0 }
    };
    if (immediate) state.map.jumpTo(opts);
    else state.map.easeTo({ ...opts, duration: 180, easing: (t) => t });
  } else {
    state.map.easeTo({
      center: state.vehiclePos,
      bearing: 0,
      pitch: 12,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: immediate ? 0 : 240
    });
  }
}

function updateRacingTelemetryUI(kmh, isBraking) {
  const roundedKmh = Math.max(0, Math.round(kmh || 0));
  if (el.speedBadge) {
    el.speedBadge.textContent = String(roundedKmh);
  }

  let gear = "D1";
  let bandMin = 0;
  let bandMax = 18;
  if (roundedKmh > 96) {
    gear = "D6";
    bandMin = 96;
    bandMax = 135;
  } else if (roundedKmh > 72) {
    gear = "D5";
    bandMin = 72;
    bandMax = 96;
  } else if (roundedKmh > 52) {
    gear = "D4";
    bandMin = 52;
    bandMax = 72;
  } else if (roundedKmh > 34) {
    gear = "D3";
    bandMin = 34;
    bandMax = 52;
  } else if (roundedKmh > 18) {
    gear = "D2";
    bandMin = 18;
    bandMax = 34;
  }

  const ratio = Math.max(0.18, Math.min(0.95, (roundedKmh - bandMin) / Math.max(1, bandMax - bandMin)));
  const rpmPct = Math.round(24 + ratio * 70);

  if (el.gearBadge) {
    el.gearBadge.textContent = gear;
    el.gearBadge.classList.toggle("braking", Boolean(isBraking));
  }
  if (el.rpmBarFill) {
    el.rpmBarFill.style.width = `${rpmPct}%`;
    el.rpmBarFill.classList.toggle("braking", Boolean(isBraking));
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

  const lookAhead = sampleRouteAtDistance(Math.min(totalDist, curAlong + 75));
  const targetBearing = lookAhead ? calculateBearing(state.vehiclePos, lookAhead.coord) : state.vehicleHeading;
  const relTurn = normalizeAngle(targetBearing - state.vehicleHeading);
  const arrowAngle = state.cameraMode !== "overview" ? relTurn : targetBearing;

  const targetBank = Math.max(-18, Math.min(18, relTurn * 0.35));
  state.bankAngleDeg += (targetBank - (state.bankAngleDeg || 0)) * 0.25;
  const arrowSvg = state.vehicleMarker?.getElement()?.querySelector(".road-arrow-svg");
  if (arrowSvg) {
    arrowSvg.style.transform = `perspective(240px) rotateX(18deg) rotateY(${state.bankAngleDeg.toFixed(1)}deg)`;
  }

  el.arrow3d.style.transform = `rotateX(34deg) rotateZ(${arrowAngle.toFixed(1)}deg)`;

  // Buscar checkpoint activo (incluye permanecer activo mientras cruza un bucle 270 o rotonda)
  let nearestCp = null;
  let nearestCpDelta = Infinity;
  for (const cp of state.activeCheckpoints) {
    const entryDelta = cp.distAlong - curAlong;
    const endDelta = (cp.endDistAlong || cp.distAlong) - curAlong;
    const insideSpan = curAlong >= cp.distAlong - 12 && curAlong <= (cp.endDistAlong || cp.distAlong) + 12;

    if (insideSpan || (entryDelta >= -10 && entryDelta <= 680)) {
      if (insideSpan) {
        nearestCp = cp;
        nearestCpDelta = Math.max(0, endDelta);
        cp._currentlyInside = true;
        break;
      }
      if (entryDelta < nearestCpDelta) {
        nearestCpDelta = entryDelta;
        nearestCp = cp;
        cp._currentlyInside = false;
      }
    }
  }

  const isBrakingZone = Boolean(
    nearestCp &&
    (nearestCp.kind === "loop270" || nearestCp.kind === "hairpin" || nearestCp.kind === "roundabout") &&
    (nearestCp._currentlyInside || Math.max(0, nearestCp.distAlong - curAlong) <= 180)
  );
  updateRacingTelemetryUI(state.speedKmh, isBrakingZone);

  if (state.lastSpokenContextId && (!nearestCp || nearestCp.id !== state.lastSpokenContextId)) {
    cancelSpeech();
    state.lastSpokenContextId = null;
  }

  const nextStep = state.steps.find((st) => st.distAlong > curAlong + 8) || state.steps[state.steps.length - 1];
  const nextStepDist = nextStep ? Math.max(0, nextStep.distAlong - curAlong) : 0;

  const speedMps = Math.max(7, (state.speedKmh || 48) / 3.6);
  const leadCompMeters = speedMps * 0.45;
  const showLanes = !state.cleanUiMode && (Boolean(nearestCp) || nextStepDist <= 550);
  el.laneForkBar.classList.toggle("hidden", !showLanes);

  // Nunca mostrar banners temporales ni ventanas emergentes sobre el mapa
  if (el.bridgeAlert) {
    el.bridgeAlert.classList.add("hidden");
  }

  if (nearestCp) {
    if (state.activeCheckpointId !== nearestCp.id) {
      state.activeCheckpointId = nearestCp.id;
    }

    const isInside = Boolean(nearestCp._currentlyInside);
    const entryDist = Math.max(0, nearestCp.distAlong - curAlong);
    const dispDist = isInside ? Math.max(0, (nearestCp.endDistAlong || nearestCp.distAlong) - curAlong) : entryDist;

    let headline;
    if (isInside && (nearestCp.kind === "loop270" || nearestCp.kind === "hairpin")) {
      const dirWord = nearestCp.takeLane === "right" ? "derecha" : "izquierda";
      headline = `Dentro del bucle (${nearestCp.turnDeg}°): Sigue girando a la ${dirWord} hasta conectar`;
    } else if (isInside && nearestCp.kind === "roundabout") {
      headline = nearestCp.actionHeadline;
    } else {
      headline = entryDist > 260 ? nearestCp.prepHeadline : nearestCp.actionHeadline;
    }

    el.hudCard.classList.add("checkpoint-active");
    el.checkpointBadge.classList.remove("hidden");
    const badgeLabel =
      nearestCp.kind === "roundabout"
        ? "Rotonda"
        : nearestCp.kind === "loop270"
        ? "Bucle 270"
        : nearestCp.kind === "hairpin"
        ? "Vuelta Cerrada"
        : "Desvío";
    if (el.checkpointBadge.dataset.label !== badgeLabel) {
      el.checkpointBadge.dataset.label = badgeLabel;
      el.checkpointBadge.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg><span>${badgeLabel}</span>`;
    }

    if (nearestCp.recommendedSpeed && nearestCp.recommendedSpeed <= 35) {
      el.curveSpeedBadge.textContent = `Máx ${nearestCp.recommendedSpeed} km/h`;
      el.curveSpeedBadge.classList.remove("hidden");
    } else {
      el.curveSpeedBadge.classList.add("hidden");
    }

    el.hudDistance.textContent = formatDistance(dispDist);
    el.hudTitle.textContent = headline;
    el.hudSubtitle.textContent = state.showRouteLine
      ? isInside
        ? `${nearestCp.title} · Resta ${formatDistance(dispDist)} del giro`
        : nearestCp.title
      : "Vista 3D despejada · Mantente derecho";

    highlightLanes(nearestCp.takeLane, true);

    const effectiveDelta = entryDist - leadCompMeters;
    const prepTrigger = Math.min(580, Math.max(300, speedMps * 9));
    const actionTrigger = Math.min(200, Math.max(85, speedMps * 4));
    if (!isInside && effectiveDelta <= prepTrigger && effectiveDelta > actionTrigger) {
      speakSpanish(nearestCp.prepHeadline, `${nearestCp.id}-prep`, nearestCp.id, "prep");
    } else if ((isInside || effectiveDelta <= actionTrigger) && dispDist > 8) {
      speakSpanish(nearestCp.actionHeadline, `${nearestCp.id}-action`, nearestCp.id, "action");
    }
  } else {
    state.activeCheckpointId = null;
    el.hudCard.classList.remove("checkpoint-active");
    el.checkpointBadge.classList.add("hidden");
    el.curveSpeedBadge.classList.add("hidden");

    el.hudDistance.textContent = formatDistance(nextStepDist);
    const { lane, label, stage } = mapModifierToSpanish(nextStep, nextStepDist);
    el.hudTitle.textContent = label;
    if (!state.showRouteLine) {
      el.hudSubtitle.textContent = "Vista 3D despejada · Mantente derecho";
    } else if (stage === "cruise") {
      el.hudSubtitle.textContent = nextStep?.name
        ? `Sigue de frente por ${nextStep.name}`
        : "Sigue de frente por la vía principal";
    } else {
      el.hudSubtitle.textContent = nextStep?.name ? `Vía: ${nextStep.name}` : "Mantente derecho";
    }

    if (stage === "cruise") {
      el.arrow3d.style.transform = "rotateX(34deg) rotateZ(0deg)";
    }
    highlightLanes(lane, false);

    const effectiveStepDist = nextStepDist - leadCompMeters;
    const isTurnOrArrive =
      nextStep &&
      (nextStep.type === "arrive" || (nextStep.modifier && !nextStep.modifier.includes("straight")));
    if (isTurnOrArrive && effectiveStepDist > 12) {
      const prepStepTrigger = Math.min(520, Math.max(280, speedMps * 8));
      const actionStepTrigger = Math.min(180, Math.max(80, speedMps * 3.8));
      if (effectiveStepDist <= prepStepTrigger && effectiveStepDist > actionStepTrigger) {
        const prepObj = mapModifierToSpanish(nextStep, 400);
        speakSpanish(prepObj.label, `step-prep-${Math.round(nextStep.distAlong)}`, null, "prep");
      } else if (effectiveStepDist <= actionStepTrigger) {
        const actObj = mapModifierToSpanish(nextStep, 120);
        speakSpanish(actObj.label, `step-act-${Math.round(nextStep.distAlong)}`, null, "action");
      }
    }
  }
}

function mapModifierToSpanish(step, distMeters = Infinity) {
  if (!step || distMeters > 550) {
    return { lane: "center", label: "Mantente derecho", stage: "cruise" };
  }
  const m = step.modifier || "straight";
  const street = step.name ? ` hacia ${step.name}` : "";
  if (step.type === "arrive") {
    return { lane: "center", label: `Llegaste a tu destino${street}`, stage: "action" };
  }

  const isRoundabout = step.type === "roundabout" || step.type === "rotary" || step.type === "roundabout turn";
  if (isRoundabout) {
    const exitNum = step.exit || 1;
    if (distMeters > 240) {
      return {
        lane: "right",
        label: `Rotonda adelante: Reduce velocidad, salida ${exitNum}${street}`,
        stage: "prep"
      };
    }
    return {
      lane: "right",
      label: `Entra a la rotonda y toma la salida ${exitNum}${street}`,
      stage: "action"
    };
  }

  const isUturn = m.includes("uturn");
  const isLeft = !isUturn && m.includes("left");
  const isRight = m.includes("right");

  if (distMeters > 260) {
    if (isUturn) {
      return {
        lane: "left",
        label: "Con anticipación: Ve pasándote al carril izquierdo para el retorno cerrado",
        stage: "prep"
      };
    }
    if (isLeft) {
      return {
        lane: "left",
        label: "Con anticipación: Ve pasándote al carril izquierdo",
        stage: "prep"
      };
    }
    if (isRight) {
      return {
        lane: "right",
        label: "Con anticipación: Ve pasándote al carril derecho",
        stage: "prep"
      };
    }
    return {
      lane: "center",
      label: "Mantente derecho en el carril central",
      stage: "prep"
    };
  }

  if (isUturn) {
    return { lane: "left", label: `Toma el retorno cerrado ahora${street}`, stage: "action" };
  }
  if (isLeft) {
    return { lane: "left", label: `Toma la ruta a la izquierda${street}`, stage: "action" };
  }
  if (isRight) {
    return { lane: "right", label: `Toma la ruta a la derecha${street}`, stage: "action" };
  }
  return {
    lane: "center",
    label: step.name ? `Sigue al frente por ${step.name}` : "Sigue al frente",
    stage: "action"
  };
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

/* ================= SIMULATION LOOP WITH REALISTIC CURVE PHYSICS ================= */
function computeTargetSimSpeedKmh(curAlong) {
  for (const cp of state.activeCheckpoints) {
    const endD = cp.endDistAlong || cp.distAlong;
    if (curAlong >= cp.distAlong - 120 && curAlong <= endD + 25) {
      return cp.recommendedSpeed || 30;
    }
  }
  return 76;
}

function animationLoop(ts) {
  if (state.mode === "sim" && state.simPlaying && state.mainCoords.length) {
    if (!state.lastFrameTime) state.lastFrameTime = ts;
    const dt = Math.min(0.1, (ts - state.lastFrameTime) / 1000);
    state.lastFrameTime = ts;

    const targetKmh = computeTargetSimSpeedKmh(state.simDistMeters);
    state.currentSimKmh += (targetKmh - state.currentSimKmh) * Math.min(1, dt * 3.5);
    const metersPerSec = (state.currentSimKmh / 3.6) * state.simSpeed;
    state.speedKmh = state.currentSimKmh;

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
    ? `<i data-lucide="pause" class="ico-sm"></i>`
    : `<i data-lucide="play" class="ico-sm"></i>`;
  const label = playing ? "Pausar simulación" : "Simular recorrido";
  el.btnPlayPause.title = label;
  el.btnPlayPause.setAttribute("aria-label", label);
  refreshLucideIcons();
}

function setCameraButtonUI(mode) {
  const active = mode !== "overview";
  const label = mode === "street" ? "Vista Calle 3D" : mode === "aerial" ? "Vista Aérea 3D" : "Vista 2D Ruta";
  el.btnToggleCamera.classList.toggle("active", active);
  el.btnToggleCamera.innerHTML = `<i data-lucide="compass" class="ico-md"></i>`;
  el.btnToggleCamera.title = label;
  el.btnToggleCamera.setAttribute("aria-label", label);
  refreshLucideIcons();
}

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function startGpsMode() {
  if (!("geolocation" in navigator)) {
    return;
  }
  state.mode = "gps";
  state.simPlaying = false;
  setPlayButtonUI(false);
  el.btnStartGps.innerHTML = `<i data-lucide="navigation" class="ico-sm"></i>`;
  el.btnStartGps.title = "Detener GPS";
  el.btnStartGps.setAttribute("aria-label", "Detener GPS");
  el.btnStartGps.classList.add("active-gps");
  el.modeBadge.textContent = "GPS";
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
    () => {},
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
  el.btnStartGps.innerHTML = `<i data-lucide="navigation" class="ico-sm"></i>`;
  el.btnStartGps.title = "GPS en vivo";
  el.btnStartGps.setAttribute("aria-label", "GPS en vivo");
  el.btnStartGps.classList.remove("active-gps");
  el.modeBadge.textContent = "SIM";
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

/* ================= SQL ROUTE SELECTOR ================= */

function renderLegPills() {
  const routes = sqlGetAllRoutes();
  el.legFilterPills.innerHTML = routes
    .map(
      (r) =>
        `<button type="button" class="leg-pill ${r.id === state.activeRouteId ? "active" : ""}" data-route-id="${escapeHtml(r.id)}">${escapeHtml(r.short_label)}</button>`
    )
    .join("");

  el.legFilterPills.querySelectorAll(".leg-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextId = btn.dataset.routeId;
      if (!nextId || nextId === state.activeRouteId) return;
      sqlSetActiveRoute(nextId);
      loadActiveRouteFromSql();
      renderLegPills();
      fetchAndBuildRoutes();
    });
  });
  updateSqlStatusBadge();
}

/* ================= SQL ROUTES & ITINERARY CONFIGURATOR MODAL ================= */
function openItineraryModal() {
  state.draftStops = structuredClone(state.stops);
  el.searchResults.innerHTML = "";
  if (el.sqlRouteNameInput) el.sqlRouteNameInput.value = "";
  renderSqlRoutesList();
  renderDraftStopsList();
  updateSqlStatusBadge();
  el.itineraryModal.classList.remove("hidden");
}

function renderSqlRoutesList() {
  if (!el.sqlRoutesList) return;
  const routes = sqlGetAllRoutes();
  el.sqlRoutesList.innerHTML = routes
    .map((r) => {
      const isAct = r.id === state.activeRouteId;
      const badgeText = isAct ? "Activa en mapa" : "Cargar";
      return `
        <li class="sql-route-row ${isAct ? "active" : ""}">
          <div class="sql-route-info" data-sql-select="${escapeHtml(r.id)}">
            <div class="sql-route-name">${escapeHtml(r.name)}</div>
            <div class="sql-route-meta">${Number(r.stop_count || 0)} paradas · ${r.category === "preset" ? "Pre-cargada SQL" : "Guardada por usuario"}</div>
          </div>
          <div class="sql-route-actions">
            <button type="button" class="ios-mini-btn ${isAct ? "" : "ghost"}" data-sql-select="${escapeHtml(r.id)}">${badgeText}</button>
            <button type="button" class="stop-btn danger" data-sql-del="${escapeHtml(r.id)}" title="Eliminar de SQL">${svgIcon("trash", 14)}</button>
          </div>
        </li>
      `;
    })
    .join("");

  el.sqlRoutesList.querySelectorAll("[data-sql-select]").forEach((node) => {
    node.addEventListener("click", () => {
      const rid = node.dataset.sqlSelect;
      sqlSetActiveRoute(rid);
      loadActiveRouteFromSql();
      state.draftStops = structuredClone(state.stops);
      renderSqlRoutesList();
      renderDraftStopsList();
      renderLegPills();
      fetchAndBuildRoutes();
      showToast("Ruta cargada desde SQLite");
    });
  });

  el.sqlRoutesList.querySelectorAll("[data-sql-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rid = btn.dataset.sqlDel;
      if (sqlDeleteRoute(rid)) {
        loadActiveRouteFromSql();
        state.draftStops = structuredClone(state.stops);
        renderSqlRoutesList();
        renderDraftStopsList();
        renderLegPills();
        fetchAndBuildRoutes();
        showToast("Ruta eliminada de la base de datos SQL");
      }
    });
  });
}

function renderDraftStopsList() {
  el.stopsList.innerHTML = state.draftStops
    .map((s, idx) => {
      const role = idx === 0 ? "Origen" : idx === state.draftStops.length - 1 ? "Destino final" : `Parada ${idx}`;
      return `
        <li class="stop-row">
          <div class="stop-info">
            <div class="stop-role">${role}</div>
            <div class="stop-name">${escapeHtml(s.name)}</div>
            <div class="stop-coords">${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}</div>
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
  el.searchResults.innerHTML = `<li class="search-result-item">Buscando "${escapeHtml(query)}" en Honduras…</li>`;
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
          <span>${escapeHtml(it.display_name)}</span>
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
      state.followZoom = 19.1;
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
    const themeLabel = `Mapa: ${THEME_LABELS[state.theme]}`;
    el.btnToggleTheme.innerHTML = `<i data-lucide="layers" class="ico-md"></i>`;
    el.btnToggleTheme.title = themeLabel;
    el.btnToggleTheme.setAttribute("aria-label", themeLabel);
    refreshLucideIcons();
    state.mapReady = false;
    state.map.setStyle(MAP_STYLES[state.theme]);
  });

  el.btnToggleRouteLine.addEventListener("click", () => {
    state.showRouteLine = !state.showRouteLine;
    const lineLabel = state.showRouteLine ? "Ocultar ruta verde" : "Mostrar ruta verde";
    el.btnToggleRouteLine.classList.toggle("active", state.showRouteLine);
    el.btnToggleRouteLine.innerHTML = state.showRouteLine
      ? `<i data-lucide="route" class="ico-md"></i>`
      : `<i data-lucide="eye-off" class="ico-md"></i>`;
    el.btnToggleRouteLine.title = lineLabel;
    el.btnToggleRouteLine.setAttribute("aria-label", lineLabel);
    refreshLucideIcons();
    applyRouteLineVisibility();
    updateNavigationHUD();
  });

  el.btnToggleCleanUi.addEventListener("click", () => {
    toggleCleanUiMode();
  });

  if (el.btnRestoreUi) {
    el.btnRestoreUi.addEventListener("click", () => {
      toggleCleanUiMode(false);
    });
  }

  window.addEventListener("pointerdown", prewarmAudioAndSpeech, { once: true });

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
    const voiceLabel = state.voiceEnabled ? "Silenciar voz" : "Activar voz";
    el.btnToggleVoice.classList.toggle("active", state.voiceEnabled);
    el.btnToggleVoice.innerHTML = state.voiceEnabled
      ? `<i data-lucide="volume-2" class="ico-md"></i>`
      : `<i data-lucide="volume-x" class="ico-md"></i>`;
    el.btnToggleVoice.title = voiceLabel;
    el.btnToggleVoice.setAttribute("aria-label", voiceLabel);
    refreshLucideIcons();
    if (state.voiceEnabled) speakSpanish("Voz activada.");
    else cancelSpeech();
  });

  el.btnToggleItinerary.addEventListener("click", openItineraryModal);
  el.btnCloseModal.addEventListener("click", () => el.itineraryModal.classList.add("hidden"));
  el.btnCancelModal.addEventListener("click", () => el.itineraryModal.classList.add("hidden"));

  el.btnRestoreDefault.addEventListener("click", () => {
    sqlRestoreDefaultRoutes();
    loadActiveRouteFromSql();
    state.draftStops = structuredClone(state.stops);
    renderSqlRoutesList();
    renderDraftStopsList();
    renderLegPills();
    fetchAndBuildRoutes();
    showToast("Base de datos SQL restaurada con las 4 rutas");
  });

  el.btnSaveNewSqlRoute.addEventListener("click", () => {
    if (state.draftStops.length < 2) {
      showToast("Agrega al menos origen y destino antes de guardar");
      return;
    }
    const typed = el.sqlRouteNameInput.value.trim();
    const autoName = `${shortPlaceName(state.draftStops[0].name)} → ${shortPlaceName(state.draftStops[state.draftStops.length - 1].name)}`;
    const fullName = typed || autoName;
    const shortLbl = typed ? (typed.length > 16 ? `${typed.slice(0, 15)}…` : typed) : shortPlaceName(state.draftStops[state.draftStops.length - 1].name);

    sqlSaveRoute({
      name: fullName,
      shortLabel: shortLbl,
      category: "custom",
      stops: state.draftStops,
      makeActive: true
    });
    el.sqlRouteNameInput.value = "";
    loadActiveRouteFromSql();
    renderSqlRoutesList();
    renderLegPills();
    fetchAndBuildRoutes();
    showToast(`Guardada en SQLite: ${fullName}`);
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
    if (state.draftStops.length < 2) {
      showToast("Debes mantener al menos origen y destino");
      return;
    }
    const routes = sqlGetAllRoutes();
    const current = routes.find((r) => r.id === state.activeRouteId);
    sqlSaveRoute({
      id: state.activeRouteId,
      name: current ? current.name : `${shortPlaceName(state.draftStops[0].name)} → ${shortPlaceName(state.draftStops[state.draftStops.length - 1].name)}`,
      shortLabel: current ? current.short_label : shortPlaceName(state.draftStops[state.draftStops.length - 1].name),
      category: current ? current.category : "custom",
      stops: state.draftStops,
      makeActive: true
    });
    loadActiveRouteFromSql();
    el.itineraryModal.classList.add("hidden");
    renderLegPills();
    fetchAndBuildRoutes();
    showToast("Cambios guardados en SQLite y ruta trazada");
  });
}

/* ================= BOOTSTRAP ================= */
document.addEventListener("DOMContentLoaded", async () => {
  refreshLucideIcons();
  initVoiceEngine();
  await initSqlDatabase();
  loadActiveRouteFromSql();
  initMap();
  renderLegPills();
  bindEvents();
  await fetchAndBuildRoutes();
  requestAnimationFrame(animationLoop);
});
