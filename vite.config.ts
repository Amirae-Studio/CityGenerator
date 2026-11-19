import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// MakerLab serves each release from a versioned path on https://<appId>.mwapps.com,
// so every asset path must be relative ("./"), never "/…".
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  // Keeps the existing .env (NEXT_PUBLIC_MAPBOX_TOKEN) working.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  server: { port: 5174, strictPort: true }, // keep in sync with entryUrl in makerlab/config.json
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2500,
  },
});
