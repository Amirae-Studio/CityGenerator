import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MBMap,
  MapMouseEvent,
  MapTouchEvent,
} from "mapbox-gl";
// CSP build: its web worker is a real file served from 'self' instead of a
// blob: URL, so MakerLab's strict CSP (worker-src 'self') allows it.
import type MapboxGL from "mapbox-gl";
import type { Marker } from "mapbox-gl";
import mapboxWorkerUrl from "mapbox-gl/dist/mapbox-gl-csp-worker.js?url";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import "mapbox-gl/dist/mapbox-gl.css";
import "maplibre-gl/dist/maplibre-gl.css";

/*
 * Two map engines: Mapbox GL (Mapbox maps) and MapLibre (the free map —
 * Mapbox GL's open fork, same API for everything used here). They must never
 * both be loaded at once: each registers its classes on shared globals for
 * worker messaging, and together they corrupt each other ("reading 'omit'").
 * So each is imported only when needed, and the CSP builds keep their workers
 * as real files served from 'self'.
 */
type Engine = typeof MapboxGL;
const engines: Partial<Record<"mapbox" | "free", Engine>> = {};
async function loadEngine(p: "mapbox" | "free"): Promise<Engine> {
  if (engines[p]) return engines[p]!;
  if (p === "mapbox") {
    const gl = (await import("mapbox-gl/dist/mapbox-gl-csp.js")).default;
    gl.workerUrl = mapboxWorkerUrl;
    if (MAPBOX_TOKEN) gl.accessToken = MAPBOX_TOKEN;
    engines.mapbox = gl;
  } else {
    const gl = (await import("maplibre-gl/dist/maplibre-gl-csp.js")).default;
    gl.setWorkerUrl(maplibreWorkerUrl);
    // MapLibre is typed as Mapbox GL: the calls made here exist in both; the
    // Mapbox-only ones (Standard config, emissive strength) are guarded.
    engines.free = gl as unknown as Engine;
  }
  return engines[p]!;
}
import {
  Circle,
  Crosshair,
  Heart,
  Hexagon,
  Layers,
  LocateFixed,
  Move,
  PenTool,
  RotateCw,
  Scan,
  Search,
  Square,
  Star,
  Triangle,
  Undo2,
  X,
} from "lucide-react";
import Scrubber from "@/components/ui/Scrubber";
import {
  bounds,
  customFrame,
  customIssue,
  formatMeters,
  pointInRing,
  shapeLngLatRing,
  shapePolygon,
  toLngLat,
  toLocal,
  type FrameShape,
  type LngLat,
  type ShapeKind,
  type Vec2,
} from "@/lib/explore/geo";
import { PRINT_MM } from "@/lib/explore/printSize";
import { useTheme } from "@/lib/theme";

/*
 * Basemaps: Mapbox GL JS drawing Mapbox Standard (the same engine and data
 * Mapbox Studio uses): small vector tiles drawn in the browser, 3D buildings
 * included. Billed per map load, not per tile.
 * - Street map: the project's Mapbox Studio style (built on Standard), or
 *   mapbox/standard when none is set.
 * - Satellite: mapbox/standard-satellite, or the project's own satellite style.
 *
 * Neutral map display is a hard requirement: no country/state borders and no
 * country, state or sea names. Standard's own switches enforce it below, on
 * top of whatever the Studio style says.
 */
const MAPBOX_TOKEN: string | undefined = import.meta.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;

/** Accepts "user/styleId" or a "mapbox://styles/user/styleId" URL. */
function styleUrl(v?: string) {
  const id = v?.trim().replace(/^mapbox:\/\/styles\//, "").replace(/\/$/, "");
  return id ? `mapbox://styles/${id}` : undefined;
}
const STREET_STYLE = styleUrl(import.meta.env.NEXT_PUBLIC_MAPBOX_STREET_STYLE) ?? "mapbox://styles/mapbox/standard";
/** Street style used in dark mode; falls back to the light one when unset. */
const STREET_STYLE_DARK = styleUrl(import.meta.env.NEXT_PUBLIC_MAPBOX_STREET_STYLE_DARK) ?? STREET_STYLE;
const SATELLITE_STYLE =
  styleUrl(import.meta.env.NEXT_PUBLIC_MAPBOX_SATELLITE_STYLE) ?? "mapbox://styles/mapbox/standard-satellite";
/** The Mapbox style for a view: satellite, or the street style for the theme. */
function mapboxStyle(satellite: boolean, dark: boolean) {
  return satellite ? SATELLITE_STYLE : dark ? STREET_STYLE_DARK : STREET_STYLE;
}

/*
 * Which map to use: Mapbox (above) or the free map.
 *
 * - NEXT_PUBLIC_USE_MAPBOX=false → always the free map.
 * - NEXT_PUBLIC_USE_MAPBOX=true, or unset → Mapbox when a token is set,
 *   otherwise the free map.
 * - Mapbox refusing the token (bad token, billing/free limit reached, rate
 *   limit) or missing the style switches to the free map on its own, so the
 *   map never goes blank.
 */
type Provider = "mapbox" | "free";
const USE_MAPBOX_FLAG = (import.meta.env.NEXT_PUBLIC_USE_MAPBOX ?? "").trim().toLowerCase();
const MAPBOX_DISABLED = ["false", "0", "no", "off"].includes(USE_MAPBOX_FLAG);
const START_PROVIDER: Provider = MAPBOX_TOKEN && !MAPBOX_DISABLED ? "mapbox" : "free";


/*
 * Free basemaps (no key, no billing), with the same neutral display:
 * - Satellite: Esri World Imagery (photos only, no labels or borders) plus
 *   Esri's roads-only reference layer.
 * - Street: OpenFreeMap vector tiles, minus every border line and every
 *   country, state and sea name; capitals aren't marked.
 */
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
type AnyStyle = Record<string, unknown>;
const FREE_SATELLITE_STYLE: AnyStyle = {
  version: 8,
  sources: {
    imagery: {
      type: "raster",
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
    roads: {
      type: "raster",
      tiles: [`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: "imagery", type: "raster", source: "imagery" },
    { id: "roads", type: "raster", source: "roads", paint: { "raster-opacity": 0.75 } },
  ],
};
/** Shown for the moment the free street style is being fetched. */
const BLANK_STYLE: AnyStyle = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#eef3f0" } }],
};

const FREE_STREET_URL = "https://tiles.openfreemap.org/styles/liberty";
let freeStreetPromise: Promise<AnyStyle> | null = null;

function isPolitical(layer: { id: string; "source-layer"?: string }) {
  const src = layer["source-layer"];
  if (src === "boundary" || src === "water_name") return true; // border lines, sea names
  return /^label_(country|state)/.test(layer.id);
}

/** OpenFreeMap's street style with borders and political names removed. */
function freeStreetStyle(): Promise<AnyStyle> {
  freeStreetPromise ??= (async () => {
    const res = await fetch(FREE_STREET_URL);
    if (!res.ok) throw new Error(`Street map style ${res.status}`);
    const style = (await res.json()) as { layers: ({ id: string; "source-layer"?: string; layout?: AnyStyle })[] } & AnyStyle;
    style.layers = style.layers
      .filter((l) => !isPolitical(l))
      // Capitals get a star; drop it so no city is marked as anyone's capital.
      .map((l) => (l.id === "label_city_capital" ? { ...l, layout: { ...l.layout, "icon-image": "" } } : l));
    return style;
  })().catch((err) => {
    freeStreetPromise = null;
    throw err;
  });
  return freeStreetPromise;
}

/** What's missing for the map to show, or null when it's ready. The free map
 *  needs no setup, so this is only ever about Mapbox. */
const SETUP_ISSUE: string | null = null;

/** Standard's style fragment that the switches below apply to. */
const BASEMAP = "basemap";
/** Place names show only from this zoom in. Zoomed further out they are
 *  country and state names (and sea names), which must never appear. */
const PLACE_LABEL_MIN_ZOOM = 10;

/** The neutral-display switches for a given zoom. */
function neutralConfig(zoom: number) {
  return { showAdminBoundaries: false, showPlaceLabels: zoom >= PLACE_LABEL_MIN_ZOOM };
}

/** "Use my location" needs the geolocation permission. Inside MakerLab's
 *  sandboxed iframe it may be withheld; then the button is hidden rather than
 *  failing on click. (Browsers without featurePolicy just try.) */
const CAN_LOCATE =
  typeof navigator !== "undefined" &&
  "geolocation" in navigator &&
  ((document as Document & { featurePolicy?: { allowsFeature(f: string): boolean } }).featurePolicy?.allowsFeature(
    "geolocation"
  ) ?? true);

/** Farther than this, a search result or preset city is jumped to, not flown
 *  to: a long flight loads tiles all along the way before the ones that matter. */
const FLY_MAX_KM = 40;

function haversineKm([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const SHAPES: [ShapeKind, string, typeof Square][] = [
  ["square", "Square", Square],
  ["circle", "Round", Circle],
  ["triangle", "Triangle", Triangle],
  ["hexagon", "Hexagon", Hexagon],
  ["heart", "Heart", Heart],
  ["star", "Star", Star],
  ["custom", "Custom", PenTool],
];

const ACCENT = "#1fa463";

export const MIN_SIZE = 150;
export const MAX_SIZE = 2000;

/** Screen distance (px) between the frame's top edge and its rotate knob. */
const KNOB_GAP = 36;

/** Quick-start places shown under the search, so a first-time visitor can try
 *  the app in one click. Each centres on a well-known, building-dense spot. */
const PRESET_CITIES: { name: string; spot: string; center: LngLat }[] = [
  { name: "Paris", spot: "Eiffel Tower", center: [2.2945, 48.8584] },
  { name: "New York", spot: "Midtown Manhattan", center: [-73.9855, 40.758] },
  { name: "London", spot: "Westminster", center: [-0.1246, 51.5007] },
  { name: "Tokyo", spot: "Shibuya Crossing", center: [139.7005, 35.6595] },
  { name: "Rome", spot: "Colosseum", center: [12.4922, 41.8902] },
  { name: "Sydney", spot: "Opera House", center: [151.2153, -33.8568] },
];

type SearchHit = {
  id: string;
  title: string;
  subtitle: string;
  center: [number, number];
  extent?: [number, number, number, number]; // w, n, e, s
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    extent?: [number, number, number, number];
  };
};

/** What a press on the map grabbed. */
type Grab = "move" | "resize" | "rotate" | "vertex";

const GRAB_CURSOR: Record<Grab, string> = {
  move: "move",
  resize: "nwse-resize",
  rotate: "grab",
  vertex: "move",
};

/** Zoom at which the frame fills ~`fill` of the shorter viewport side. */
function zoomForSize(size: number, lat: number, px: number, fill = 0.6) {
  const metersPerPx = size / (px * fill);
  return Math.log2((156543.03 * Math.cos((lat * Math.PI) / 180)) / metersPerPx) - 1; // 512px tiles
}

function metersPerPixel(zoom: number, lat: number) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

/** Rotate a local point clockwise by `deg` (same convention as shapePolygon). */
function rotate([x, y]: Vec2, deg: number): Vec2 {
  const t = (-deg * Math.PI) / 180;
  return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
}

/** Bounding box of a template shape before rotation, in local metres. */
function unrotatedBox(s: FrameShape) {
  return bounds(shapePolygon({ ...s, rotation: 0 }));
}

/** Patch that puts the frame at `center`. A drawn outline is carried along
 *  in metres so it keeps its real-world shape at any latitude. */
function placeAt(s: FrameShape, center: LngLat, size = s.size): Partial<FrameShape> {
  if (s.kind === "custom" && s.points?.length) {
    const points = s.points.map((p) => toLngLat(toLocal(p, s.center), center));
    return { points, ...customFrame(points) };
  }
  return { center, size };
}

/** Corners of the dashed edit box around a template shape (none for custom). */
function editBox(s: FrameShape): LngLat[] {
  if (s.kind === "custom") return [];
  const b = unrotatedBox(s);
  return ([[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]] as Vec2[]).map((p) =>
    toLngLat(rotate(p, s.rotation), s.center)
  );
}

/** Everything the user needs to see to edit the frame: outline plus handles. */
function editExtent(s: FrameShape): LngLat[] {
  const ring = shapeLngLatRing(s);
  return ring.length ? [...ring, ...editBox(s)] : [];
}

function lngLatBounds(ring: LngLat[]): [[number, number], [number, number]] {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export function MapPicker({
  shape,
  onShapeChange,
  onPlaceName,
  onConfirm,
  busy,
  locked,
}: {
  shape: FrameShape;
  onShapeChange: (patch: Partial<FrameShape>) => void;
  onPlaceName: (name: string | null) => void;
  onConfirm: () => void;
  busy: boolean;
  locked: boolean; // map frozen while a later step is open
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MBMap | null>(null);
  const labelRef = useRef<Marker | null>(null);
  const gripRef = useRef<Marker | null>(null);
  const shapeRef = useRef(shape);
  shapeRef.current = shape;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const onShapeChangeRef = useRef(onShapeChange);
  onShapeChangeRef.current = onShapeChange;
  /** Counts finished style loads; the overlay exists once it's above 0. */
  const [styleGen, setStyleGen] = useState(0);
  const ready = styleGen > 0;
  const [satellite, setSatellite] = useState(false); // street map by default
  const satelliteRef = useRef(satellite);
  // Dark mode swaps the Mapbox street style (satellite and the free map stay).
  const dark = useTheme().mode === "dark";
  const darkRef = useRef(dark);
  /** Mapbox or the free map; switches to free on its own if Mapbox fails. */
  const [provider, setProvider] = useState<Provider>(START_PROVIDER);
  /** Bumped when a map engine finishes loading, so the map effect runs again. */
  const [enginesLoaded, setEnginesLoaded] = useState(0);
  /** A setup or Mapbox problem to show over the map (bad token, missing style). */
  const [mapIssue, setMapIssue] = useState<string | null>(SETUP_ISSUE);
  const [grab, setGrab] = useState<Grab | null>(null);
  const grabRef = useRef<Grab | null>(null);
  grabRef.current = grab;
  const [offscreen, setOffscreen] = useState(false);

  // Custom outline drawing. Points live in a ref so map handlers see them
  // without re-binding; `draftCount` re-renders the panel.
  const [drawing, setDrawing] = useState(false);
  const drawingRef = useRef(false);
  drawingRef.current = drawing;
  const draftRef = useRef<LngLat[]>([]);
  const hoverRef = useRef<LngLat | null>(null);
  const [draftCount, setDraftCount] = useState(0);

  const issue = shape.kind === "custom" ? customIssue(shape.points, MAX_SIZE) : null;

  /** Map padding that keeps the frame clear of the search bar and the panel. */
  const fitPadding = useCallback(() => {
    const el = containerRef.current;
    const h = el?.clientHeight ?? 800;
    const w = el?.clientWidth ?? 800;
    // Room the panel takes from the bottom of the map, plus space for the size badge.
    const panelEl = lockedRef.current ? null : panelRef.current;
    const panel = panelEl && el ? el.getBoundingClientRect().bottom - panelEl.getBoundingClientRect().top : 0;
    const side = Math.min(56, w * 0.08);
    // The customise panel sits on the right on desktop.
    const right = lockedRef.current && w >= 768 ? 400 : side;
    return {
      top: Math.min(lockedRef.current ? 40 : 124 + KNOB_GAP, h * 0.3),
      bottom: Math.min(panel ? panel + 52 : 48, h * 0.5),
      left: side,
      right: Math.min(right, w * 0.6),
    };
  }, []);

  /** Animate the camera so the whole frame sits in the clear area. `fly`
   *  arcs out and back in like flyTo for nearby moves; somewhere far away
   *  (another city) is jumped to directly, because a long flight fetches and
   *  decodes dozens of tiles along the way that hold up the ones at the end. */
  const fitFrame = useCallback(
    (s: FrameShape = shapeRef.current, { instant = false, fly = false } = {}) => {
      const map = mapRef.current;
      const pts = lockedRef.current ? shapeLngLatRing(s) : editExtent(s);
      if (!map || !pts.length) return;
      if (fly) {
        const c = map.getCenter();
        const km = haversineKm([c.lng, c.lat], s.center);
        if (km > FLY_MAX_KM) instant = true;
      }
      // flyTo turns an explicit `duration: undefined` into NaN, so leave it out.
      const timing = fly && !instant ? { linear: false, speed: 1.6 } : { duration: instant ? 0 : 500 };
      map.fitBounds(lngLatBounds(pts), { padding: fitPadding(), maxZoom: 18, ...timing });
    },
    [fitPadding]
  );

  /** Only move the camera when part of the frame is hidden. */
  const ensureVisible = useCallback(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    const pts = editExtent(shapeRef.current);
    if (!map || !el || !pts.length || map.isMoving()) return;
    const pad = fitPadding();
    const fits = pts.every((c) => {
      const p = map.project(c);
      return p.x >= pad.left && p.x <= el.clientWidth - pad.right && p.y >= pad.top && p.y <= el.clientHeight - pad.bottom;
    });
    if (!fits) fitFrame();
  }, [fitPadding, fitFrame]);

  const checkOffscreen = useCallback(() => {
    const map = mapRef.current;
    if (!map || map.isMoving()) return; // moveend checks again
    const s = shapeRef.current;
    const ring = shapeLngLatRing(s);
    if (!ring.length || drawingRef.current) return setOffscreen(false);
    const b = map.getBounds();
    const c = map.getCenter();
    const seen =
      ring.some((p) => b.contains(p)) || pointInRing(toLocal([c.lng, c.lat], s.center), shapePolygon(s));
    setOffscreen(!seen);
  }, []);

  const renderDraft = useCallback(() => {
    const map = mapRef.current;
    if (!map?.getSource("draft")) return;
    const pts = draftRef.current;
    const line = drawingRef.current && hoverRef.current ? [...pts, hoverRef.current] : pts;
    (map.getSource("draft") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        drawingRef.current && line.length >= 2
          ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } }]
          : [],
    });
    const verts = drawingRef.current
      ? pts
      : shapeRef.current.kind === "custom" && !lockedRef.current
        ? (shapeRef.current.points ?? [])
        : [];
    (map.getSource("vertices") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: verts.map((c, i) => ({
        type: "Feature",
        properties: { i, first: drawingRef.current && i === 0 && pts.length >= 3 ? 1 : 0 },
        geometry: { type: "Point", coordinates: c },
      })),
    });
  }, []);

  /** Resize corners, rotate knob and the dashed box around template shapes. */
  const renderHandles = useCallback(() => {
    const map = mapRef.current;
    if (!map?.getSource("handles")) return;
    const s = shapeRef.current;
    const handles: GeoJSON.Feature[] = [];
    const guides: GeoJSON.Feature[] = [];
    if (!drawingRef.current && !lockedRef.current && s.kind !== "custom") {
      const b = unrotatedBox(s);
      const at = (p: Vec2) => toLngLat(rotate(p, s.rotation), s.center);
      const box = editBox(s);
      box.forEach((c, i) =>
        handles.push({ type: "Feature", properties: { role: "resize", i }, geometry: { type: "Point", coordinates: c } })
      );
      // A circle looks the same at any angle — no knob.
      if (s.kind !== "circle") {
        const midX = (b.minX + b.maxX) / 2;
        const top = at([midX, b.maxY]);
        const knob = at([midX, b.maxY + KNOB_GAP * metersPerPixel(map.getZoom(), s.center[1])]);
        handles.push({ type: "Feature", properties: { role: "rotate" }, geometry: { type: "Point", coordinates: knob } });
        guides.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [top, knob] } });
      }
      if (s.kind !== "square") {
        guides.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [...box, box[0]] } });
      }
    }
    (map.getSource("handles") as GeoJSONSource).setData({ type: "FeatureCollection", features: handles });
    (map.getSource("guides") as GeoJSONSource).setData({ type: "FeatureCollection", features: guides });
  }, []);

  const finishDrawing = useCallback(() => {
    const pts = draftRef.current;
    if (pts.length < 3) return;
    setDrawing(false);
    drawingRef.current = false;
    hoverRef.current = null;
    const next = { kind: "custom" as const, points: pts.slice(), rotation: 0, ...customFrame(pts) };
    onShapeChangeRef.current(next);
    fitFrame({ ...shapeRef.current, ...next });
  }, [fitFrame]);

  function startDrawing() {
    draftRef.current = [];
    hoverRef.current = null;
    setDraftCount(0);
    setDrawing(true);
  }

  function undoPoint() {
    draftRef.current = draftRef.current.slice(0, -1);
    setDraftCount(draftRef.current.length);
    renderDraft();
  }

  function pickShape(kind: ShapeKind) {
    if (kind === "custom") {
      if (shape.points?.length) {
        onShapeChange({ kind, rotation: 0, ...customFrame(shape.points) });
      } else {
        startDrawing();
      }
      return;
    }
    setDrawing(false);
    // The frame stays where it is on the ground — only its outline changes.
    onShapeChange({
      kind,
      size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(shape.size / 10) * 10)),
    });
  }

  /** Bring the frame to the middle of the current view. */
  function moveHere() {
    const c = mapRef.current?.getCenter();
    if (!c) return;
    const patch = placeAt(shape, [c.lng, c.lat]);
    onShapeChange(patch);
    fitFrame({ ...shape, ...patch });
  }

  // Map lifecycle
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const px = Math.min(el.clientWidth, el.clientHeight) || 600;
    const zoom = zoomForSize(shapeRef.current.size, shapeRef.current.center[1], px);
    const isMapbox = provider === "mapbox";
    const gl = engines[provider];
    if (!gl) {
      // Load this provider's engine first; the effect runs again once it's in.
      let alive = true;
      loadEngine(provider)
        .then(() => alive && setEnginesLoaded((n) => n + 1))
        .catch((err: Error) => {
          if (!alive) return;
          if (provider === "mapbox") setProvider("free");
          else setMapIssue(`Couldn't load the map: ${err.message}`);
        });
      return () => {
        alive = false;
      };
    }
    // A new map (first run, or after switching provider) has no overlay yet.
    setStyleGen(0);
    const firstStyle = isMapbox
      ? mapboxStyle(satelliteRef.current, darkRef.current)
      : satelliteRef.current
        ? FREE_SATELLITE_STYLE
        : BLANK_STYLE; // the free street style is fetched just below
    const map = new gl.Map({
      container: el,
      style: firstStyle as string,
      ...(isMapbox
        ? {
            config: { [BASEMAP]: neutralConfig(zoom) },
            // Flat top-down map: the frame is drawn on the ground in Web Mercator.
            projection: "mercator" as const,
          }
        : {}),
      center: shapeRef.current.center,
      zoom,
      maxZoom: 19,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new gl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new gl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new gl.AttributionControl({ compact: true }), "bottom-right");

    /** Mapbox failed (refused token, free limit or billing, missing style):
     *  carry on with the free map instead of leaving a broken one. */
    let fellBack = false;
    const fallBackToFree = (why: string) => {
      if (!isMapbox || fellBack) return;
      fellBack = true;
      console.warn(`[MapPicker] ${why} — switching to the free map`);
      setMapIssue(null);
      setProvider("free");
    };

    // Place names follow the zoom (see PLACE_LABEL_MIN_ZOOM): flip the switch
    // only when crossing the threshold, since each change re-lays out labels.
    let placeLabels = neutralConfig(zoom).showPlaceLabels;
    const applyNeutral = (force = false) => {
      // Mapbox Standard's switches; the free styles are neutral already.
      if (!isMapbox) return;
      const want = neutralConfig(map.getZoom());
      if (!force && want.showPlaceLabels === placeLabels) return;
      placeLabels = want.showPlaceLabels;
      for (const [key, value] of Object.entries(want)) map.setConfigProperty(BASEMAP, key, value);
    };
    map.on("zoom", () => applyNeutral());

    // Mapbox answers 401/403 for a bad or URL-restricted token, and 404 for a
    // style it can't find (wrong ID, or a style owned by another account).
    // Say so instead of leaving a blank map.
    // Every problem is kept and listed (the first one is usually the cause),
    // so one screenshot of the alert is enough to diagnose a broken map.
    const issues: string[] = [];
    const report = (issue: string) => {
      const clean = issue.replace(/access_token=[^&\s]+/g, "access_token=…");
      // Every tile fails the same way: report each problem once.
      if (issues.includes(clean)) return;
      issues.push(clean);
      console.warn(`[MapPicker] ${clean}`);
      setMapIssue(issues.join("\n"));
    };
    let styleLoaded = false;
    let lastError = "";
    // When a request fails with no HTTP answer, find out why: what the page's
    // own CSP allows, and whether Mapbox and another host are reachable.
    let probed = false;
    const probe = async () => {
      if (probed) return;
      probed = true;
      const out: string[] = [];
      try {
        const res = await fetch(location.href, { cache: "no-store" });
        const csp = res.headers.get("content-security-policy");
        const connect = csp?.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src"));
        out.push(
          !csp
            ? "page sends no CSP header"
            : !connect
              ? "page CSP has no connect-src"
              : `page CSP ${connect.includes("api.mapbox.com") ? "allows" : "does NOT allow"} api.mapbox.com`,
        );
        // The whole policy the host served, to compare with the one submitted.
        if (csp) out.push(`served CSP: ${csp.replace(/\s+/g, " ").slice(0, 900)}`);
      } catch (e) {
        out.push(`page headers unreadable (${(e as Error).message})`);
      }
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy" i]')?.getAttribute("content");
      if (meta) out.push(`meta CSP: ${meta.slice(0, 160)}`);
      const styleHttp = mapboxStyle(false, darkRef.current).replace("mapbox://styles/", "https://api.mapbox.com/styles/v1/");
      for (const [name, url] of [
        ["Mapbox", `${styleHttp}?access_token=${MAPBOX_TOKEN}`],
        ["Photon", "https://photon.komoot.io/api/?q=paris&limit=1"],
      ]) {
        try {
          out.push(`${name} HTTP ${(await fetch(url, { cache: "no-store" })).status}`);
        } catch (e) {
          out.push(`${name} failed (${(e as Error).message})`);
        }
      }
      out.push(
        `fetch ${/\[native code\]/.test(String(window.fetch)) ? "native" : "wrapped"}, ${navigator.onLine ? "online" : "offline"}, ${window === window.top ? "top window" : "in iframe"}`,
      );
      report(`Checks: ${out.join(" · ")}`);
    };
    map.on("error", (e) => {
      const { error } = e as unknown as { error?: { status?: number; url?: string; message?: string } };
      if (!error) return;
      lastError = error.message || String(error);
      if (import.meta.env.DEV) console.debug("[MapPicker] map error", error.status, error.url?.replace(/access_token=[^&]+/, "…"), error.message);
      const which = satelliteRef.current ? "satellite" : "street";
      const fromMapbox = !!error.url?.includes("api.mapbox.com");
      // 401/403: bad or restricted token, or the account is off (free limit
      // reached without billing). 402: payment required. 429: rate limited.
      // 404 on a style: wrong style ID. All mean Mapbox can't serve this map.
      if (
        fromMapbox &&
        ([401, 402, 403, 429].includes(error.status ?? 0) || (error.status === 404 && error.url!.includes("/styles/")))
      ) {
        fallBackToFree(`Mapbox answered ${error.status}`);
        return;
      }
      if (error.url?.includes("api.mapbox.com") && (error.status === 401 || error.status === 403)) {
        report(`Mapbox refused the token (${error.status}). Check its URL restrictions and that the Mapbox account is active, with billing set up`);
      } else if (error.url?.includes("api.mapbox.com") && error.status === 404) {
        report(`Mapbox can't find the ${which} style (404)`);
      } else if (!styleLoaded) {
        // No HTTP status: the request never completed, usually because the
        // host page's security policy (CSP), the sandbox or a content
        // blocker stopped it.
        report(`Couldn't load the map: ${lastError}`);
        void probe();
      }
    });
    // Anything the page's security policy blocks (a host missing from
    // connect-src, a worker, WebAssembly…) fails silently otherwise.
    const onCsp = (e: SecurityPolicyViolationEvent) => {
      if (!styleLoaded) report(`Blocked by the page's security policy: ${e.violatedDirective} ${e.blockedURI}`);
    };
    document.addEventListener("securitypolicyviolation", onCsp);
    // Last resort: the style never finished loading, with no error event.
    const watchdog = setTimeout(() => {
      if (styleLoaded) return;
      if (isMapbox) {
        fallBackToFree("Mapbox didn't load within 20 seconds");
        return;
      }
      if (!issues.length) report("The map didn't finish loading within 20 seconds");
      void probe();
    }, 20000);

    // Free street map: its style is fetched (and cleaned of political layers) first.
    if (!isMapbox && !satelliteRef.current) {
      freeStreetStyle()
        .then((s) => {
          if (mapRef.current === map && !satelliteRef.current) map.setStyle(s as never, { diff: false } as never);
        })
        .catch((err: Error) => report(`Couldn't load the street map: ${err.message}`));
    }

    const badge = document.createElement("div");
    badge.className =
      "pointer-events-none whitespace-nowrap rounded-full bg-white px-2.5 py-1 font-mono text-[10.5px] font-medium tracking-wide text-[#15201a] shadow-lg";
    labelRef.current = new gl.Marker({ element: badge, anchor: "top", offset: [0, 12] })
      .setLngLat(shapeRef.current.center)
      .addTo(map);

    // Centre grip: always grabs the frame, even when it fills the screen.
    const grip = document.createElement("div");
    grip.className =
      "pointer-events-none flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#1fa463] text-white shadow-lg";
    grip.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/></svg>';
    gripRef.current = new gl.Marker({ element: grip }).setLngLat(shapeRef.current.center).addTo(map);

    // The frame overlay lives in the style, so it is (re)added each time a
    // style finishes loading: on start, and after switching street/satellite.
    map.on("style.load", () => {
      styleLoaded = true;
      clearTimeout(watchdog);
      applyNeutral(true);
      map.addSource("mask", { type: "geojson", data: emptyFc() });
      map.addSource("frame", { type: "geojson", data: emptyFc() });
      map.addSource("draft", { type: "geojson", data: emptyFc() });
      map.addSource("vertices", { type: "geojson", data: emptyFc() });
      map.addSource("guides", { type: "geojson", data: emptyFc() });
      map.addSource("handles", { type: "geojson", data: emptyFc() });
      map.addLayer({
        id: "mask",
        type: "fill",
        source: "mask",
        paint: { "fill-color": "#000", "fill-opacity": 0.5 },
      });
      map.addLayer({
        id: "frame-fill",
        type: "fill",
        source: "frame",
        paint: { "fill-color": ACCENT, "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "frame-glow",
        type: "line",
        source: "frame",
        paint: { "line-color": ACCENT, "line-width": 8, "line-opacity": 0.35, "line-blur": 4 },
      });
      map.addLayer({
        id: "frame-line",
        type: "line",
        source: "frame",
        paint: { "line-color": "#ffffff", "line-width": 2 },
      });
      map.addLayer({
        id: "guides",
        type: "line",
        source: "guides",
        paint: { "line-color": "#ffffff", "line-width": 1.25, "line-opacity": 0.7, "line-dasharray": [3, 2] },
      });
      map.addLayer({
        id: "draft-line",
        type: "line",
        source: "draft",
        paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [2, 1.5] },
      });
      map.addLayer({
        id: "vertices",
        type: "circle",
        source: "vertices",
        paint: {
          "circle-radius": ["case", ["==", ["get", "first"], 1], 8, 5.5],
          "circle-color": ["case", ["==", ["get", "first"], 1], ACCENT, "#ffffff"],
          "circle-stroke-color": ACCENT,
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "handles",
        type: "circle",
        source: "handles",
        paint: {
          "circle-radius": ["case", ["==", ["get", "role"], "rotate"], 7.5, 6],
          "circle-color": ["case", ["==", ["get", "role"], "rotate"], ACCENT, "#ffffff"],
          "circle-stroke-color": ["case", ["==", ["get", "role"], "rotate"], "#ffffff", ACCENT],
          "circle-stroke-width": 2,
        },
      });
      // Standard lights the scene (e.g. a dawn preset); keep the frame
      // overlay at full brightness regardless.
      if (isMapbox) {
        for (const id of ["mask", "frame-fill"]) map.setPaintProperty(id, "fill-emissive-strength", 1);
        for (const id of ["frame-glow", "frame-line", "guides", "draft-line"]) map.setPaintProperty(id, "line-emissive-strength", 1);
        for (const id of ["vertices", "handles"]) map.setPaintProperty(id, "circle-emissive-strength", 1);
      }
      setStyleGen((g) => g + 1);
    });

    // Handles keep a fixed screen distance from the frame, so redraw on zoom.
    map.on("zoom", renderHandles);
    map.on("moveend", checkOffscreen);

    // Drawing: click adds a point, clicking the first point (or double-click) closes it.
    map.on("click", (e) => {
      if (!drawingRef.current) return;
      const pts = draftRef.current;
      const hit = (c: LngLat) => {
        const p = map.project(c);
        return Math.hypot(p.x - e.point.x, p.y - e.point.y) < 12;
      };
      if (pts.length >= 3 && hit(pts[0])) {
        finishDrawing();
        return;
      }
      if (pts.length && hit(pts[pts.length - 1])) return; // second click of a double-click
      draftRef.current = [...pts, [e.lngLat.lng, e.lngLat.lat]];
      setDraftCount(draftRef.current.length);
      renderDraft();
    });
    map.on("dblclick", (e) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      finishDrawing();
    });

    // Direct editing: drag inside the frame to move it, a corner to resize,
    // the knob to rotate, or a drawn outline's points to reshape it.
    type Drag =
      | { kind: "move"; from: LngLat; start: FrameShape }
      | { kind: "resize" | "rotate" }
      | { kind: "vertex"; i: number };
    let drag: Drag | null = null;

    const hitTest = (e: MapMouseEvent | MapTouchEvent, touch: boolean): Drag | null => {
      const pad = touch ? 16 : 6;
      if (drawingRef.current || lockedRef.current) return null;
      const { x, y } = e.point;
      if (!map.getLayer("handles")) return null; // style still (re)loading
      const [f] = map.queryRenderedFeatures(
        [
          [x - pad, y - pad],
          [x + pad, y + pad],
        ],
        { layers: ["handles", "vertices"] }
      );
      if (f?.layer?.id === "vertices") return { kind: "vertex", i: Number(f.properties?.i) };
      if (f) return { kind: f.properties?.role === "rotate" ? "rotate" : "resize" };
      const s = shapeRef.current;
      const ring = shapePolygon(s);
      if (!ring.length) return null;
      const grabMove = { kind: "move" as const, from: [e.lngLat.lng, e.lngLat.lat] as LngLat, start: s };
      const c = map.project(s.center);
      if (Math.hypot(c.x - x, c.y - y) < pad + 12) return grabMove;
      // With a mouse, dragging inside the frame moves it — unless it's bigger
      // than the view, where a drag should pan the map. On touch a one-finger
      // drag always pans; the centre grip moves the frame.
      if (touch) return null;
      const canvas = map.getCanvas();
      const whole = shapeLngLatRing(s).every((ll) => {
        const p = map.project(ll);
        return p.x >= 0 && p.y >= 0 && p.x <= canvas.clientWidth && p.y <= canvas.clientHeight;
      });
      if (whole && pointInRing(toLocal([e.lngLat.lng, e.lngLat.lat], s.center), ring)) return grabMove;
      return null;
    };

    const begin = (e: MapMouseEvent | MapTouchEvent, touch: boolean) => {
      if (touch && (e as MapTouchEvent).points.length !== 1) return;
      if (!touch && (e as MapMouseEvent).originalEvent.button !== 0) return;
      const hit = hitTest(e, touch);
      if (!hit) return;
      e.preventDefault(); // stops the map from panning
      map.dragPan.disable();
      drag = hit;
      setGrab(hit.kind);
      map.getCanvas().style.cursor = hit.kind === "rotate" ? "grabbing" : GRAB_CURSOR[hit.kind];
    };

    const update = (e: MapMouseEvent | MapTouchEvent) => {
      if (!drag) {
        // Hover feedback (mouse only).
        if (drawingRef.current || "points" in e) return;
        const hit = hitTest(e, false);
        map.getCanvas().style.cursor = hit ? GRAB_CURSOR[hit.kind] : "";
        return;
      }
      const s = shapeRef.current;
      const ll: LngLat = [e.lngLat.lng, e.lngLat.lat];
      if (drag.kind === "move") {
        const { from, start } = drag;
        const to: LngLat = [start.center[0] + ll[0] - from[0], start.center[1] + ll[1] - from[1]];
        onShapeChangeRef.current(placeAt(start, to));
      } else if (drag.kind === "vertex") {
        const pts = (s.points ?? []).slice();
        pts[drag.i] = ll;
        onShapeChangeRef.current({ points: pts, ...customFrame(pts) });
      } else if (drag.kind === "resize") {
        // Scale about the centre by how far along the corner's diagonal the pointer is.
        const [lx, ly] = rotate(toLocal(ll, s.center), -s.rotation);
        const b = unrotatedBox(s);
        const cx = lx >= 0 ? b.maxX : b.minX;
        const cy = ly >= 0 ? b.maxY : b.minY;
        const k = (lx * cx + ly * cy) / (cx * cx + cy * cy);
        const size = Math.round((s.size * k) / 10) * 10;
        onShapeChangeRef.current({ size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)) });
      } else {
        const [lx, ly] = toLocal(ll, s.center);
        const fine = !("points" in e) && (e as MapMouseEvent).originalEvent.shiftKey;
        const step = fine ? 1 : 5;
        const deg = Math.round(((Math.atan2(lx, ly) * 180) / Math.PI + 360) / step) * step;
        onShapeChangeRef.current({ rotation: deg % 360 });
      }
    };

    const end = () => {
      if (!drag) return;
      drag = null;
      setGrab(null);
      map.getCanvas().style.cursor = "";
      if (!lockedRef.current) map.dragPan.enable();
    };

    map.on("mousedown", (e) => begin(e, false));
    map.on("touchstart", (e) => begin(e, true));
    map.on("mousemove", (e) => {
      if (drawingRef.current) {
        hoverRef.current = [e.lngLat.lng, e.lngLat.lat];
        renderDraft();
        return;
      }
      update(e);
    });
    map.on("touchmove", update);
    map.on("mouseup", end);
    map.on("touchend", end);
    map.on("touchcancel", end);
    window.addEventListener("mouseup", end);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      clearTimeout(watchdog);
      document.removeEventListener("securitypolicyviolation", onCsp);
      window.removeEventListener("mouseup", end);
      labelRef.current = null;
      gripRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [finishDrawing, renderDraft, renderHandles, checkOffscreen, provider, enginesLoaded]);

  // Redraw the frame, mask, handles and size badge whenever the shape changes.
  useEffect(() => {
    const map = mapRef.current;
    // No overlay while a style is (re)loading; style.load bumps styleGen.
    if (!map || !ready || !map.getSource("frame")) return;
    const ring = drawing ? [] : shapeLngLatRing(shape);
    (map.getSource("frame") as GeoJSONSource).setData(
      ring.length
        ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }
        : emptyFc()
    );
    const world = [
      [-180, -85],
      [180, -85],
      [180, 85],
      [-180, 85],
      [-180, -85],
    ];
    (map.getSource("mask") as GeoJSONSource).setData(
      ring.length
        ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [world, ring.slice().reverse()] } }
        : emptyFc()
    );
    map.setPaintProperty("frame-line", "line-width", grab === "move" ? 3 : 2);
    map.setPaintProperty("frame-fill", "fill-opacity", grab === "move" ? 0.16 : 0.08);
    renderDraft();
    renderHandles();
    checkOffscreen();

    const grip = gripRef.current;
    if (grip) {
      grip.getElement().style.display = ring.length && !locked ? "" : "none";
      grip.setLngLat(shape.center);
    }

    // Size badge under the lowest point of the frame.
    const label = labelRef.current;
    if (label) {
      const el = label.getElement();
      el.style.display = ring.length && !locked ? "" : "none";
      if (ring.length) {
        const low = ring.reduce((a, b) => (b[1] < a[1] ? b : a));
        label.setLngLat([shape.center[0], low[1]]);
        el.textContent =
          grab === "rotate"
            ? `${shape.rotation}°`
            : shape.kind === "custom"
              ? `${formatMeters(shape.size)} across`
              : `${formatMeters(shape.size)} ${shape.kind === "circle" ? "across" : "wide"}`;
      }
    }
  }, [shape, ready, styleGen, drawing, locked, grab, renderDraft, renderHandles, checkOffscreen]);

  // After the frame grows, shrinks, turns or changes shape, pull the camera
  // back only if part of it ended up hidden. Waits for drags to finish.
  const fitKey = `${shape.kind}|${shape.size}|${shape.rotation}|${shape.points?.length ?? 0}`;
  const lastFitKey = useRef(fitKey);
  useEffect(() => {
    if (!ready || grab || drawing || fitKey === lastFitKey.current) return;
    const t = setTimeout(() => {
      lastFitKey.current = fitKey;
      ensureVisible();
    }, 350);
    return () => clearTimeout(t);
  }, [fitKey, ready, grab, drawing, ensureVisible]);

  // Drawing mode: crosshair cursor, no double-click zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
    if (drawing) map.doubleClickZoom.disable();
    else if (!locked) map.doubleClickZoom.enable();
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") finishDrawing();
      else if (e.key === "Escape") setDrawing(false);
      else if ((e.key === "z" && (e.ctrlKey || e.metaKey)) || e.key === "Backspace") {
        if ((e.target as HTMLElement)?.tagName === "INPUT") return;
        draftRef.current = draftRef.current.slice(0, -1);
        setDraftCount(draftRef.current.length);
        renderDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, ready, locked, finishDrawing, renderDraft]);

  const opened = useRef(false);
  // Freeze interaction while the customise step is open, and keep the
  // frame clear of whichever panel is showing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const handlers = [map.dragPan, map.scrollZoom, map.doubleClickZoom, map.touchZoomRotate, map.keyboard, map.boxZoom];
    handlers.forEach((h) => (locked ? h.disable() : h.enable()));
    if (!locked) map.touchZoomRotate.disableRotation();
    // First run opens on the frame, framed clear of the panel.
    fitFrame(shapeRef.current, { instant: !opened.current });
    opened.current = true;
  }, [locked, ready, fitFrame]);

  // Street ↔ satellite, and light ↔ dark street style: load the other style;
  // style.load re-adds the overlay.
  useEffect(() => {
    const was = mapboxStyle(satelliteRef.current, darkRef.current);
    const satelliteChanged = satelliteRef.current !== satellite;
    satelliteRef.current = satellite;
    darkRef.current = dark;
    const map = mapRef.current;
    if (!map) return;
    if (provider === "mapbox") {
      const next = mapboxStyle(satellite, dark);
      if (next === was) return;
      map.setStyle(next, {
        config: { [BASEMAP]: neutralConfig(map.getZoom()) },
        localFontFamily: undefined,
        localIdeographFontFamily: undefined,
      });
    } else if (!satelliteChanged) {
      return; // the free map has one street style for both themes
    } else if (satellite) {
      // diff: false → a full reload, so style.load re-adds the frame overlay.
      map.setStyle(FREE_SATELLITE_STYLE as never, { diff: false } as never);
    } else {
      freeStreetStyle()
        .then((s) => {
          if (mapRef.current === map && !satelliteRef.current) map.setStyle(s as never, { diff: false } as never);
        })
        .catch((err: Error) => setMapIssue(`Couldn't load the street map: ${err.message}`));
    }
  }, [satellite, dark, provider]);

  /** Search result: the frame moves to the place and the camera follows. */
  function flyToHit(hit: SearchHit) {
    onPlaceName(hit.title);
    const s = shapeRef.current;
    let size = s.size;
    if (hit.extent && s.kind !== "custom") {
      const [w, n, e, so] = hit.extent;
      const spanM = Math.max((e - w) * 111320 * Math.cos((hit.center[1] * Math.PI) / 180), (n - so) * 110574);
      // Small extents (a building, a street) → keep the current frame size.
      if (spanM > 400) size = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, spanM * 1.05)) / 10) * 10;
    }
    const patch = placeAt(s, hit.center, size);
    lastFitKey.current = `${s.kind}|${patch.size ?? s.size}|${s.rotation}|${s.points?.length ?? 0}`;
    onShapeChange(patch);
    fitFrame({ ...s, ...patch }, { fly: true });
  }

  function locateMe() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        onPlaceName(null);
        const s = shapeRef.current;
        const patch = placeAt(s, [pos.coords.longitude, pos.coords.latitude]);
        onShapeChange(patch);
        fitFrame({ ...s, ...patch }, { fly: true });
      },
      () => alert("Could not get your location.")
    );
  }

  const getBias = useCallback((): LngLat | null => {
    const c = mapRef.current?.getCenter();
    return c ? [c.lng, c.lat] : null;
  }, []);

  const isCustom = shape.kind === "custom";
  const mPerMm = shape.size / PRINT_MM;

  return (
    <div className="relative h-full w-full overflow-hidden max-md:[&_.mapboxgl-ctrl-top-right]:hidden [&_.mapboxgl-ctrl-top-right]:mr-1 [&_.mapboxgl-ctrl-top-right]:mt-1">
      {/* Mapbox's own CSS forces `position: relative` on the container,
          so it fills an absolutely positioned wrapper instead. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* Search + basemap + quick-start cities */}
      {!locked && (
        <div className="absolute left-4 right-4 top-4 z-10 flex flex-col gap-2 md:right-auto md:w-[500px]">
          <div className="flex items-start gap-2">
            <PlaceSearch onPick={flyToHit} getBias={getBias} />
            {(
              <button
                type="button"
                onClick={() => setSatellite((s) => !s)}
                title={satellite ? "Switch to street map" : "Switch to satellite"}
                className="float-panel flex h-12 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-[12.5px] text-cream/80 transition-colors hover:text-cream"
              >
                <Layers size={15} />
                <span className="hidden sm:inline">{satellite ? "Map" : "Satellite"}</span>
              </button>
            )}
            {CAN_LOCATE && (
              <button
                type="button"
                onClick={locateMe}
                title="Move the frame to my location"
                aria-label="Use my location"
                className="float-panel flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-cream/80 transition-colors hover:text-cream"
              >
                <LocateFixed size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <span className="float-panel shrink-0 rounded-full px-2.5 py-1.5 text-[11.5px] text-cream/55">Try</span>
            {PRESET_CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => flyToHit({ id: `preset-${c.name}`, title: c.name, subtitle: c.spot, center: c.center })}
                title={`${c.spot}, ${c.name}`}
                className="float-panel shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] text-cream/85 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map setup / Mapbox problems: never a silent blank map. */}
      {mapIssue && (
        <div
          role="alert"
          className="float-panel absolute left-1/2 top-[170px] z-10 flex w-[min(440px,calc(100%-32px))] -translate-x-1/2 items-start gap-3 rounded-2xl p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-medium text-cream">
              {MAPBOX_TOKEN ? "The map couldn't fully load" : "The map isn't set up yet"}
            </p>
            <p className="m-0 mt-1 text-[12px] leading-[1.5] text-cream/60">
              {import.meta.env.DEV
                ? `${mapIssue}. See "Map setup" in the README.`
                : "Please refresh the page or try again later."}
            </p>
            {!import.meta.env.DEV && (
              // The technical reason, so a screenshot is enough to diagnose it.
              <p className="m-0 mt-1.5 max-h-48 select-text overflow-y-auto whitespace-pre-line break-all font-mono text-[10.5px] leading-[1.4] text-cream/40">
                {mapIssue}
              </p>
            )}
          </div>
          {MAPBOX_TOKEN && (
            <button
              type="button"
              onClick={() => setMapIssue(null)}
              aria-label="Dismiss"
              className="shrink-0 text-cream/40 hover:text-cream"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {/* The frame is pinned to the ground — say so when it scrolls away. */}
      {!locked && offscreen && !drawing && (
        <div className="float-panel absolute left-1/2 top-[124px] z-10 flex -translate-x-1/2 items-center gap-1 rounded-full p-1 pl-3.5 text-cream">
          <span className="mr-1 whitespace-nowrap text-[12px] text-cream/70">Frame is out of view</span>
          <button
            type="button"
            onClick={() => fitFrame()}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] text-cream/80 transition-colors hover:bg-cream/[0.06]"
          >
            <Scan size={13} /> Show it
          </button>
          <button
            type="button"
            onClick={moveHere}
            className="btn-primary flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px]"
          >
            <Crosshair size={13} /> Move here
          </button>
        </div>
      )}

      {/* Frame controls */}
      {!locked && (
        <div
          ref={panelRef}
          className="float-panel absolute bottom-6 left-1/2 z-10 w-[min(760px,calc(100%-32px))] -translate-x-1/2 rounded-2xl p-4 md:bottom-8"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 gap-1 overflow-x-auto rounded-full border border-cream/[0.14] p-1 [scrollbar-width:none]">
              {SHAPES.map(([kind, label, Icon]) => {
                const on = drawing ? kind === "custom" : shape.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    title={label}
                    aria-pressed={on}
                    onClick={() => pickShape(kind)}
                    className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-[7px] text-[11.5px] transition-colors duration-200 ${
                      on ? "seg-on font-medium" : "text-cream/60 hover:text-cream"
                    }`}
                  >
                    <Icon size={13} />
                    <span className={on ? "hidden sm:inline" : "hidden lg:inline"}>{label}</span>
                  </button>
                );
              })}
            </div>
            {!drawing && (
              <button
                type="button"
                onClick={moveHere}
                title="Move the frame to the middle of the map"
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-cream/20 px-3 py-[7px] text-[11.5px] text-cream/70 transition-colors hover:bg-cream/5 hover:text-cream"
              >
                <Crosshair size={13} />
                <span className="hidden sm:inline">Centre</span>
              </button>
            )}
          </div>

          {drawing ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[13px] text-cream">
                  {draftCount < 3
                    ? `Click the map to place corner ${draftCount + 1}`
                    : "Click the first point or press Enter to finish"}
                </p>
                <p className="m-0 mt-0.5 text-[11.5px] text-cream/50">
                  {draftCount} point{draftCount === 1 ? "" : "s"} · Backspace undoes · Esc cancels
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={undoPoint}
                  disabled={!draftCount}
                  className="flex items-center gap-1.5 rounded-full border border-cream/20 px-3.5 py-2 text-[12px] text-cream/70 hover:bg-cream/5 disabled:opacity-40"
                >
                  <Undo2 size={13} /> Undo
                </button>
                <button
                  type="button"
                  onClick={() => setDrawing(false)}
                  className="rounded-full border border-cream/20 px-3.5 py-2 text-[12px] text-cream/70 hover:bg-cream/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={finishDrawing}
                  disabled={draftCount < 3}
                  className="rounded-full btn-primary px-4 py-2 text-[12.5px] disabled:opacity-40"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {isCustom ? (
                <div className="flex items-center justify-between gap-3">
                  <p className={`m-0 text-[12.5px] ${issue ? "text-[#e07a5f]" : "text-cream/70"}`}>
                    {issue ?? `Custom outline · ${formatMeters(shape.size)} across`}
                  </p>
                  <button
                    type="button"
                    onClick={startDrawing}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-cream/20 px-3.5 py-2 text-[12px] text-cream/70 hover:bg-cream/5"
                  >
                    <PenTool size={13} /> Redraw
                  </button>
                </div>
              ) : (
                <div className={`grid grid-cols-1 gap-2 sm:gap-4 ${shape.kind === "circle" ? "" : "sm:grid-cols-2"}`}>
                  <Scrubber
                    label="Size (m)"
                    value={shape.size}
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    step={10}
                    decimals={0}
                    onValueChange={(v) => onShapeChange({ size: v })}
                  />
                  {shape.kind !== "circle" && (
                    <Scrubber
                      label="Rotation (°)"
                      value={shape.rotation}
                      min={0}
                      max={355}
                      step={5}
                      decimals={0}
                      onValueChange={(v) => onShapeChange({ rotation: v })}
                    />
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-cream/[0.09] pt-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-cream/55">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Move size={11} />
                      <span className="sm:hidden">Drag the grip to move</span>
                      <span className="hidden sm:inline">Drag the frame to move</span>
                    </span>
                    {isCustom ? (
                      <span className="hidden sm:inline">Drag points to reshape</span>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Corners resize</span>
                        {shape.kind !== "circle" && (
                          <span className="hidden items-center gap-1 sm:flex">
                            <RotateCw size={11} /> Knob rotates · Shift for 1°
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="m-0 mt-1 hidden text-[11.5px] text-cream/40 sm:block">
                    {PRINT_MM / 10} cm print · 1 mm ≈ {mPerMm < 10 ? mPerMm.toFixed(1) : Math.round(mPerMm)} m
                    {shape.size > 1200 && <span className="text-[var(--accent-text)]"> · large areas take longer</span>}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !!issue}
                  onClick={onConfirm}
                  className="shrink-0 rounded-full btn-primary px-5 py-[10px] text-[13px] transition-transform duration-300 hover:scale-[1.03] disabled:opacity-50"
                >
                  Use this area
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function emptyFc(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

async function photonSearch(query: string, bias: LngLat | null, signal: AbortSignal): Promise<SearchHit[]> {
  const params = new URLSearchParams({ q: query, limit: "7", lang: "en" });
  if (bias) {
    params.set("lon", String(bias[0]));
    params.set("lat", String(bias[1]));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const json = (await res.json()) as { features: PhotonFeature[] };
  return json.features.map((f, i) => {
    const p = f.properties;
    const title = p.name || [p.housenumber, p.street].filter(Boolean).join(" ") || p.city || "Unnamed place";
    const subtitle = [p.city !== title ? p.city : null, p.state, p.country].filter(Boolean).join(", ");
    return { id: `ph-${p.osm_id ?? i}-${i}`, title, subtitle, center: f.geometry.coordinates, extent: p.extent };
  });
}

/** Place search (Photon, OpenStreetMap data), ranked near the current view. */
async function geocode(query: string, bias: LngLat | null, signal: AbortSignal): Promise<SearchHit[]> {
  const out: SearchHit[] = [];
  // OSM often has the same place twice (e.g. a node and an area): keep one,
  // preferring the entry that knows its extent.
  for (const hit of await photonSearch(query, bias, signal)) {
    const dup = out.find(
      (h) =>
        h.title.toLowerCase() === hit.title.toLowerCase() &&
        h.subtitle === hit.subtitle &&
        Math.abs(h.center[0] - hit.center[0]) < 0.01 &&
        Math.abs(h.center[1] - hit.center[1]) < 0.01
    );
    if (dup) dup.extent ??= hit.extent;
    else out.push(hit);
  }
  return out.slice(0, 8);
}

function PlaceSearch({ onPick, getBias }: { onPick: (hit: SearchHit) => void; getBias: () => LngLat | null }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    // "lat, lng" jumps straight to coordinates.
    const coord = query.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (coord) {
      const lat = parseFloat(coord[1]);
      const lng = parseFloat(coord[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        setHits([{ id: "coord", title: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, subtitle: "Coordinates", center: [lng, lat] }]);
        return;
      }
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setHits(await geocode(query, getBias(), ctrl.signal));
        setActive(0);
      } catch {
        /* aborted or offline — keep previous results */
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, getBias]);

  function pick(hit: SearchHit) {
    setQ(hit.title);
    setOpen(false);
    onPick(hit);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div className="float-panel flex h-12 items-center gap-2 rounded-2xl px-3.5 text-cream focus-within:!border-[var(--accent)]">
        <Search size={16} className="shrink-0 text-cream/45" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!hits.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % hits.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + hits.length) % hits.length);
            } else if (e.key === "Enter") {
              pick(hits[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search a city, landmark or address"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-cream outline-none placeholder:text-cream/40"
        />
        {loading && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-cream/15 border-t-[var(--accent)]" />}
        {q && !loading && (
          <button type="button" onClick={() => { setQ(""); setHits([]); }} aria-label="Clear search" className="shrink-0 text-cream/40 hover:text-cream">
            <X size={15} />
          </button>
        )}
      </div>
      {open && hits.length > 0 && (
        <ul className="float-panel absolute left-0 right-0 top-[calc(100%+6px)] z-20 m-0 list-none overflow-hidden rounded-2xl p-1 text-cream">
          {hits.map((h, i) => (
            <li key={h.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
                className={`flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition-colors ${
                  i === active ? "bg-[var(--accent-soft)]" : ""
                }`}
              >
                <span className="text-[13.5px]">{h.title}</span>
                {h.subtitle && <span className="text-[11.5px] text-cream/50">{h.subtitle}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
