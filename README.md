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

Production URL: `https://city-generator.mwapps.com` (MakerLab serves each App
from `https://${appId}.mwapps.com`, under a versioned path that changes every
release).

```bash
npm run build
npm run preview:release
```

`preview:release` serves `dist/` the way MakerLab does: from a versioned path
(`http://localhost:4175/v1/`) and with the exact CSP from
`makerlab/config.production.json`. The terminal prints every CSP violation
(`[CSP blocked] …`) and every request outside the versioned path, which
means an absolute `/…` path. Walk through map → scan → generate → Studio →
frame and check that it prints nothing. `-- --strict` additionally drops
`'unsafe-inline'` from `style-src` (it's already absent in production).

Output in `dist/` (~7.4 MB, under MakerLab's 10 MB guidance; `sdk.init` gets a
20 s timeout). `npm run package` builds and writes `dist.zip` with
`index.html` at the ZIP root, as MakerLab requires (not inside a `dist/`
folder). Publish it on the Generator Management Platform, and paste the CSP
from `makerlab/config.production.json` into the version's custom CSP field as
one line (`directive value; directive value; …`). The CSP belongs to the
published version, so set it before publishing; if the map fails, the alert
lists the CSP the host actually served.

**Pre-release checklist** (status as of this version):

- [x] `base: "./"` in `vite.config.ts`; no `/…` asset paths in `dist/`. The
  Mapbox worker is resolved via `import.meta.url`.
- [x] `script-src 'self' 'wasm-unsafe-eval'`: no `'unsafe-inline'` or
  `'unsafe-eval'`. `'wasm-unsafe-eval'` is needed by Mapbox GL JS (3D
  landmark/model decoding, right-to-left text) and by the DRACO/meshopt
  decoders for LOD2 buildings; tell MakerLab at review.
- [x] `style-src 'self'`, without `'unsafe-inline'`: the app sets styles only
  through the DOM, never inline `<style>`/`style="…"`; verified with
  `preview:release`.
- [x] `connect-src` lists every runtime host: Mapbox (`api`, `events`,
  `*.tiles`), Photon, OpenFreeMap, Overture, Overpass mirrors, AWS elevation,
  3DBAG, swisstopo, PLATEAU (+ GSI geocoder).
- [x] `sandboxOverrides`: scripts + same-origin only (module scripts and
  workers need same-origin; exports go through `sdk.export`, so no downloads).
- [x] `capabilities`: `export`, `toast`, `requestAccess`: all the app uses.
- [ ] SDK is the latest from the developer kit: compare `lib/makerlab/sdk/`
  with the kit's `lib/index.js` / `lib/index.d.ts` before each release.
- [ ] Walk through export, toasts and the commercial-licence payment in the
  kit's local host (see "Inside MakerLab").
- [ ] Mapbox token: add `https://city-generator.mwapps.com` to its URL
  restrictions, then check the map in MakerLab's online preview.

"Use my location" hides itself if the iframe isn't allowed geolocation.

Send MakerLab the commercial license details (key `commercial_eeee`, name,
description, price). See Paid Features › Step 1.

## Map setup

There are two maps, chosen by `NEXT_PUBLIC_USE_MAPBOX` in `.env`:

| `NEXT_PUBLIC_USE_MAPBOX` | Map |
| --- | --- |
| `false` | Always the **free map**: MapLibre + OpenFreeMap streets + Esri satellite. No account, no key, no billing. |
| `true` or empty | **Mapbox** (below) when `NEXT_PUBLIC_MAPBOX_TOKEN` is set, otherwise the free map. |

If Mapbox stops serving the map (token refused, free limit or billing, rate
limit, missing style, or it doesn't load in 20 s), the app switches to the free
map on its own — the map never goes blank. Only one map engine is loaded at a
time (Mapbox GL and MapLibre break each other when both are on the page).
Both maps keep the neutral display: no borders, no country/state/sea names.

### Mapbox

The map is **Mapbox GL JS** drawing **Mapbox Standard**, the same engine and
data Mapbox Studio uses: small map-data tiles drawn in the browser, 3D
buildings included. Street map: your Mapbox Studio style built on Standard
(or plain `mapbox/standard`). Satellite: `mapbox/standard-satellite`. Place
search uses Photon (free, no key).

The map must stay neutral: **no country/state borders and no country, state
or sea names**. The app enforces this itself through Standard's switches,
whatever the Studio style says: borders are always off, and place names only
appear from zoom 10 in (city level), where there are no country, state or sea
names. See `neutralConfig` in `components/explore/MapPicker.tsx`.

1. **Token.** In your Mapbox account, create a public token (starts with
   `pk.`). Under URL restrictions, add your live site's URL and
   `http://localhost:5174` for local work. The account needs a payment method
   on file: without one, Mapbox limits it to a trial allowance.
2. **Street style (optional).** In Mapbox Studio, style a map built on
   **Standard** (colours, light preset, font…) and publish it. Copy its URL,
   e.g. `mapbox://styles/yourname/abc123`. Without one the app uses plain
   Standard.
3. **Satellite style (optional).** Same, built on Standard Satellite.
4. **`.env`** (copy `.env.example`):

   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk....
   NEXT_PUBLIC_MAPBOX_STREET_STYLE=mapbox://styles/yourname/abc123
   NEXT_PUBLIC_MAPBOX_SATELLITE_STYLE=mapbox://styles/yourname/def456
   ```

   Restart `npm run dev` after editing `.env`. For a release build, the same
   variables must be set when running `npm run build`.

If the token is missing or Mapbox refuses a request (bad token, wrong style
ID), the map shows a message instead of going blank.

**Cost.** Mapbox GL JS is billed per **map load** (each time the map opens;
panning and zooming are free): 50,000 a month free, then from $5 per 1,000
(check mapbox.com/pricing). Switching street ↔ satellite reloads the style
but is the same map, not a new load.

## Optional setup

- Tree styles (Classic, Leafy, Grand) are built in code. To use your own
  models, put `tree1.stl` … `tree3.stl` in `public/trees/` and set
  `USE_STL_FILES = true` in `lib/explore/trees.ts`.
