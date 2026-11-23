/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mapbox public token (Mapbox GL JS map). */
  readonly NEXT_PUBLIC_MAPBOX_TOKEN?: string;
  /** Optional Mapbox Studio street style built on Standard; defaults to mapbox/standard. */
  readonly NEXT_PUBLIC_MAPBOX_STREET_STYLE?: string;
  /** Optional Mapbox Studio satellite style; defaults to mapbox/standard-satellite. */
  readonly NEXT_PUBLIC_MAPBOX_SATELLITE_STYLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Mapbox GL JS's CSP build has the same API as the default one. */
declare module "mapbox-gl/dist/mapbox-gl-csp.js" {
  import mapboxgl from "mapbox-gl";
  export default mapboxgl;
}
