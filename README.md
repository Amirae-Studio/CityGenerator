# City Generator

Pick any place on Earth, choose filament colours, and download a print-ready
**3MF** (multi-colour, Bambu Lab) or **STL** city model.

Flow (one page, `/`):

1. **Choose place** – search or drag the frame on the map, pick a shape and size.
2. **Colours** – the area is scanned (OpenStreetMap, Overture, terrain, Japan PLATEAU LOD2), pick a colour per layer.
3. **Studio** – tweak buildings/terrain/roads/trees, size to your printer, add a frame, download.

Everything is generated in the browser. No sign-in or access code is needed.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Optional setup

- `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env`: uses Mapbox satellite tiles and search.
  Leave it unset to use the free Esri imagery and Photon search instead.
- `public/trees/tree1.stl`, `tree2.stl`, `tree3.stl`: tree models for the
  "Tree style" picker. If they're missing, a simple cone tree is used.
