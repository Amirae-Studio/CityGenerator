import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

/**
 * Build size trims (MakerLab asks for a small build: it loads inside an iframe
 * and the SDK handshake has a 10 s limit).
 *
 * 1. three.js's DRACOLoader names default decoder files with
 *    `new URL("../libs/draco/…", import.meta.url)`, which makes Vite bundle a
 *    second, unused set of decoders (~1.3 MB, incl. a 700 KB JS fallback).
 *    The app always calls setDecoderPath("draco/") (public/draco), so those
 *    defaults are dropped.
 * 2. @fontsource stylesheets list a .woff fallback next to every .woff2; every
 *    browser MakerLab supports reads woff2, so the .woff copies are dropped.
 */
function trimBuild(): Plugin {
  return {
    name: "city-generator:trim-build",
    enforce: "pre",
    transform(code, id) {
      if (/three[\\/]examples[\\/]jsm[\\/]loaders[\\/]DRACOLoader\.js$/.test(id)) {
        return code.replace(/new URL\(\s*'\.\.\/libs\/draco\/[^']+',\s*import\.meta\.url\s*\)\.toString\(\)/g, "''");
      }
      if (id.includes("@fontsource") && id.endsWith(".css")) {
        return code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, "");
      }
      return null;
    },
  };
}

// MakerLab serves each release from a versioned path on https://<appId>.mwapps.com,
// so every asset path must be relative ("./"), never "/…".
export default defineConfig({
  base: "./",
  plugins: [trimBuild(), react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  // Keeps the existing .env (NEXT_PUBLIC_MAPBOX_TOKEN) working.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  server: { port: 5174, strictPort: true }, // keep in sync with entryUrl in makerlab/config.json
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        // Stable vendor chunks: a new app release doesn't make returning
        // visitors re-download React or three.js.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (/node_modules[\\/]three[\\/]build[\\/]/.test(id)) return "three";
        },
      },
    },
  },
});
