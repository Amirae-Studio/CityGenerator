# City Generator

Pick any place on Earth, choose filament colours, and export a print-ready
**3MF** (multi-colour) or **STL** city model. Built as a **MakerLab App**: it
runs inside MakerLab's iframe and talks to the host through the MakerLab App SDK.

Flow (one page):

1. **Choose place** – search or drag the frame on the map, pick a shape and size.
2. **Colours** – the area is scanned (OpenStreetMap, Overture, terrain, LOD2 buildings in NL/CH/JP), pick a colour per layer.
3. **Studio** – tweak buildings/terrain/roads/trees, size to your printer, add a frame, export.

Everything is generated in the browser — no backend, no sign-in.

## Stack

Vite + React + Tailwind (static build). It used to be Next.js, but MakerLab
serves Apps as static files from a versioned path with a strict CSP
(`script-src 'self'`, no inline scripts), which a Next.js export can't meet.

## Run

```bash
npm install
npm run dev
```

Opens on http://localhost:5174 (standalone: files download directly).

## Inside MakerLab (local host)

1. Copy the developer kit's `lib/index.js` and `lib/index.d.ts` into
   `lib/makerlab/sdk/`. Without them the app runs standalone.
2. Start this app: `npm run dev` (port 5174).
3. Start the kit's local host with this repo's config:

   ```bash
   node server.cjs -c "<path to CityGenerator>/makerlab/config.json"
   ```

4. Open http://localhost:8001. Use the host's top-left config panel to simulate
   buying the commercial license.

Notes from testing against the kit's host (Sample_Project-V1.1.0):

- With `membershipType: "free"` the local host sends no `functions`, so the
  commercial license (and its button) disappears — the local config uses
  `"partial_buyout"`, like the kit's sample.
- Every entry in `priceInfo.functions` needs a `discountConfig` (use
  `startTime/endTime: 0` for no discount), or the host page crashes.
- A closed export window comes back as `{ success: false, errorCode:
  "EXPORT_USER_CANCELLED" }` as well as by rejection; both are silent.

What the MakerLab integration does (`lib/makerlab/`):

- **Export** – every download goes through `sdk.export()`. 3MF is sent as
  OBJ + MTL (one `o`/`usemtl` per layer colour, mm, Z up); the frame goes on
  plate 2. STL is sent as-is. Cover image = the Studio viewport.
  `EXPORT_USER_CANCELLED` (closed window / quota used up) is silent.
- **Commercial license** – the "Commercial license" button calls
  `sdk.requestAccess("commercial_eeee")`; the host takes payment. Price comes
  from the platform; locally it's **$99** (`originPrice: 99000`) in
  `makerlab/config.json`. When owned, the button becomes a "Commercial" badge
  (updated from `onPaymentChange`).
- **Errors** – checked by `error.code` against the SDK's `ERROR_CODE`.

## Release

```bash
npm run build
```

Output in `dist/` (~7 MB, relative paths, no inline scripts). Publish on the
Generator Management Platform with the settings in
`makerlab/config.production.json` (CSP without `'unsafe-inline'` in
`script-src`). `'wasm-unsafe-eval'` is requested only for the DRACO/meshopt
decoders used by LOD2 buildings; MakerLab decides on it at review.

Send MakerLab the commercial license details (key `commercial_eeee`, name,
description, price) — see Paid Features › Step 1.

## Optional setup

- `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env`: Mapbox satellite tiles and search.
  Unset → free Esri imagery and Photon search. If Mapbox refuses the token
  (401/403) the map switches to Esri by itself.
- Tree styles (Classic, Leafy, Grand) are built in code. To use your own
  models, put `tree1.stl` … `tree3.stl` in `public/trees/` and set
  `USE_STL_FILES = true` in `lib/explore/trees.ts`.

The map display is kept neutral: imagery has no labels, the street map
(OpenFreeMap) has no border lines, country/state names or sea names, and
capitals aren't marked.
