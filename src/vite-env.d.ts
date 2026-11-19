/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Mapbox token for satellite imagery and search. */
  readonly NEXT_PUBLIC_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** MapLibre's CSP build has the same API as the default one. */
declare module "maplibre-gl/dist/maplibre-gl-csp.js" {
  import maplibregl from "maplibre-gl";
  export default maplibregl;
}
