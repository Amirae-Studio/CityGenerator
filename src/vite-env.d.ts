/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mapbox public token (Mapbox GL JS map). */
  readonly NEXT_PUBLIC_MAPBOX_TOKEN?: string;
  /** Optional Mapbox Studio street style built on Standard; defaults to mapbox/standard. */
  readonly NEXT_PUBLIC_MAPBOX_STREET_STYLE?: string;
  /** Optional street style for dark mode; defaults to the light street style. */
  readonly NEXT_PUBLIC_MAPBOX_STREET_STYLE_DARK?: string;
  /** Optional Mapbox Studio satellite style; defaults to mapbox/standard-satellite. */
  readonly NEXT_PUBLIC_MAPBOX_SATELLITE_STYLE?: string;
  /** "false" → always the free map (MapLibre + Esri/OpenFreeMap). Unset/"true" → Mapbox when a token is set. */
  readonly NEXT_PUBLIC_USE_MAPBOX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** MapLibre's CSP build has the same API as the default one. */
declare module "maplibre-gl/dist/maplibre-gl-csp.js" {
  import maplibregl from "maplibre-gl";
  export default maplibregl;
}

/** Mapbox GL JS's CSP build has the same API as the default one. */
declare module "mapbox-gl/dist/mapbox-gl-csp.js" {
  import mapboxgl from "mapbox-gl";
  export default mapboxgl;
}
