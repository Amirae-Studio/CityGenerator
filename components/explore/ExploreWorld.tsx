import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Globe2 } from "lucide-react";
import { DEFAULT_LAYER_COLORS, FILAMENT_LINES } from "@/lib/studio";
import type { ModelFile } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommercialLicenseButton } from "@/components/CommercialLicenseButton";
import { BuyProButton } from "@/components/ProUpsell";
import Scrubber from "@/components/ui/Scrubber";
import { BackButton } from "@/components/ui/BackButton";
import { StepPills } from "@/components/StepPills";
import { bounds, formatMeters, shapePolygon, type FrameShape } from "@/lib/explore/geo";
import { fetchMapData, type OsmData } from "@/lib/explore/osm";
import { loadHeights, shapeTerrain, type HeightSampler } from "@/lib/explore/elevation";
import { TerrainModePicker, type TerrainChoice } from "./TerrainModePicker";
import type { TreeModelId, TreeTemplate } from "@/lib/explore/trees";
import type { ExploreLayer, LayerSummary } from "@/lib/explore/buildModel";
import { PRINT_MM, TREE_PRINT_MM } from "@/lib/explore/printSize";

/*
 * Code splitting: the first screen is only the map. three.js, the model
 * builder, the tree models and the Studio load when they're first needed
 * (scan, colours step, Generate), so the page — and MakerLab's handshake —
 * come up fast.
 */
const MapPicker = lazy(() => import("./MapPicker").then((m) => ({ default: m.MapPicker })));
const StudioConfigurator = lazy(() =>
  import("@/components/studio/StudioConfigurator").then((m) => ({ default: m.StudioConfigurator }))
);
const TreePicker = lazy(() => import("./TreePicker").then((m) => ({ default: m.TreePicker })));
type Builder = typeof import("@/lib/explore/buildModel");
const loadBuilder = (): Promise<Builder> => import("@/lib/explore/buildModel");
const loadTree = (id: TreeModelId) => import("@/lib/explore/trees").then((m) => m.loadTree(id));
const DEFAULT_TREE: TreeModelId = "tree1";

type Phase = "map" | "scanning" | "customize" | "building" | "studio";

type Scan = {
  shape: FrameShape;
  data: OsmData;
  heights: HeightSampler;
  half: number; // metres the height grid covers around the centre
};


const DEFAULT_SHAPE: FrameShape = {
  kind: "square",
  center: [-0.1246, 51.5007], // Westminster, London (same spot as the map's "London" chip)
  size: 600,
  rotation: 0,
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 60) || "place";

async function reverseName([lng, lat]: [number, number]): Promise<string | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=en`);
    const json = (await res.json()) as { features?: { properties: Record<string, string> }[] };
    const p = json.features?.[0]?.properties;
    if (!p) return null;
    return p.name || p.district || p.city || p.county || p.state || null;
  } catch {
    return null;
  }
}

export function ExploreWorld() {
  const [shape, setShape] = useState<FrameShape>(DEFAULT_SHAPE);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("map");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [colors, setColors] = useState<Record<string, string>>({ ...DEFAULT_LAYER_COLORS });
  const [relief, setRelief] = useState(150);
  const [terrain, setTerrain] = useState<TerrainChoice>({ mode: "smooth" });
  const [rebuilding, setRebuilding] = useState(false);
  const [files, setFiles] = useState<ModelFile[] | null>(null);
  const [treeId, setTreeId] = useState<TreeModelId>(DEFAULT_TREE);
  const [tree, setTree] = useState<TreeTemplate | null>(null);
  /** The model builder module, loaded with the first scan. */
  const [builder, setBuilder] = useState<Builder | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const buildId = useRef(0);
  const rebuildTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The tree model sets how big trees print and how many fit, so layer
  // counts follow the chosen model once it has loaded.
  // Only once an area is scanned: the tree models need three.js.
  const scanned = !!scan;
  useEffect(() => {
    if (!scanned) return;
    let alive = true;
    loadTree(treeId)
      .then((t) => alive && setTree(t))
      .catch((err) => console.error(err));
    return () => {
      alive = false;
    };
  }, [treeId, scanned]);

  const layers = useMemo(
    () =>
      scan && builder
        ? builder.summarize(scan.data, scan.shape, scan.heights, tree?.id === treeId ? tree : undefined)
        : [],
    [scan, builder, tree, treeId]
  );

  const patchShape = useCallback((patch: Partial<FrameShape>) => setShape((s) => ({ ...s, ...patch })), []);

  // Generated layers live as blob: URLs — release them when replaced.
  useEffect(() => {
    return () => files?.forEach((f) => URL.revokeObjectURL(f.url));
  }, [files]);

  async function startScan() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const snapshot = { ...shape };
    setError(null);
    setPhase("scanning");
    setProgress("Reading map data");
    try {
      const b = bounds(shapePolygon(snapshot));
      const half = Math.max(-b.minX, b.maxX, -b.minY, b.maxY) + 20;
      const [data, heights, name, mod] = await Promise.all([
        fetchMapData(snapshot, ctrl.signal),
        loadHeights(snapshot.center, half, 256, ctrl.signal),
        placeName ? Promise.resolve(placeName) : reverseName(snapshot.center),
        loadBuilder(), // fetched in parallel with the map data
      ]);
      if (ctrl.signal.aborted) return;
      setBuilder(() => mod);
      if (name) setPlaceName(name);
      setScan({ shape: snapshot, data, heights, half });
      setPhase("customize");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      console.error(err);
      setError("Couldn't load map data for this area. Check your connection or try a smaller area.");
      setPhase("map");
    }
  }

  async function build(s: Scan, t: TerrainChoice, onProgress?: (label: string) => void) {
    const ground = shapeTerrain(s.heights, t.mode, s.half, s.shape.size / PRINT_MM);
    // A tree model that can't be fetched falls back to the built-in cone tree.
    const [model, mod] = await Promise.all([loadTree(treeId).catch(() => undefined), builder ?? loadBuilder()]);
    return mod.buildExploreModel(s.shape, s.data, ground, { relief: relief / 100, tree: model }, onProgress);
  }

  async function generate() {
    if (!scan) return;
    const id = ++buildId.current;
    setPhase("building");
    try {
      const out = await build(scan, terrain, setProgress);
      if (id !== buildId.current) return;
      setFiles(out);
      setPhase("studio");
    } catch (err) {
      console.error(err);
      setError("Something went wrong while building the 3D model. Try a smaller area.");
      setPhase("customize");
    }
  }

  /** Terrain changed inside the Studio: rebuild in place, keeping the user's
   *  colours and sliders. Debounced so quick re-clicks build once. */
  function changeTerrainInStudio(next: TerrainChoice) {
    setTerrain(next);
    if (!scan) return;
    if (rebuildTimer.current) clearTimeout(rebuildTimer.current);
    setRebuilding(true);
    rebuildTimer.current = setTimeout(async () => {
      const id = ++buildId.current;
      try {
        const out = await build(scan, next);
        if (id === buildId.current) setFiles(out);
      } catch (err) {
        console.error(err);
      } finally {
        if (id === buildId.current) setRebuilding(false);
      }
    }, 450);
  }

  function cancelScan() {
    abortRef.current?.abort();
    setPhase("map");
  }

  if (phase === "studio" && files && scan) {
    const name = placeName || "Custom place";
    const hasWater = layers.some((l) => l.key === "water");
    return (
      <Suspense
        fallback={
          <div className="flex h-dvh items-center justify-center bg-base text-[12px] text-cream/50">Opening the Studio…</div>
        }
      >
      <StudioConfigurator
        type="explore"
        city={{ slug: "explore", name: "Explore" }}
        location={{
          slug: slugify(name),
          name,
          area: `${formatMeters(scan.shape.size)} ${scan.shape.kind}`,
          coords: `${scan.shape.center[1].toFixed(5)}, ${scan.shape.center[0].toFixed(5)}`,
        }}
        customFiles={files}
        initialControls={{
          enableColors: true,
          layerColors: Object.fromEntries(layers.map((l) => [l.key, colors[l.key]])),
          enableWater: hasWater,
          water: 100,
        }}
        onBack={() => setPhase("customize")}
        terrainControl={
          scan.heights.flat ? undefined : { ...terrain, busy: rebuilding, onChange: changeTerrainInStudio }
        }
      />
      </Suspense>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-base text-cream">
      <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-cream/[0.08] bg-deep px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {phase === "customize" && <BackButton onClick={() => setPhase("map")} />}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-text)]">
              City Generator
            </div>
            <h1 className="m-0 truncate font-display text-[17px] font-semibold leading-tight">
              {phase === "map" || phase === "scanning"
                ? placeName || "Pick a place to print"
                : placeName || "Custom place"}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StepPills step={phase === "map" || phase === "scanning" ? 0 : 1} />
          <BuyProButton />
          <CommercialLicenseButton compact />
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex-1">
        <Suspense fallback={<div className="h-full animate-pulse bg-cream/[0.04]" />}>
          <MapPicker
            shape={shape}
            onShapeChange={patchShape}
            onPlaceName={setPlaceName}
            onConfirm={startScan}
            busy={phase !== "map"}
            locked={phase !== "map"}
          />
        </Suspense>

        <AnimatePresence>
          {error && phase === "map" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-1/2 top-20 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full float-panel !border-[#e07a5f]/50 px-5 py-2.5 text-[12.5px] text-cream"
            >
              <span className="h-2 w-2 rounded-full bg-[#e07a5f]" />
              {error}
              <button onClick={() => setError(null)} className="text-cream/40 hover:text-cream">
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(phase === "scanning" || phase === "building") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(var(--ink-rgb),0.18)] backdrop-blur-[2px]"
            >
              <div className="float-panel flex w-[300px] flex-col items-center gap-4 rounded-2xl p-6 text-center">
                <div className="relative h-12 w-12">
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-cream/15 border-t-[color:var(--accent)]" />
                  <Globe2 className="absolute inset-0 m-auto text-[var(--accent)]" size={20} />
                </div>
                <div>
                  <div className="font-display text-[17px] font-semibold">
                    {phase === "scanning" ? "Scanning the area" : "Building your model"}
                  </div>
                  <div className="mt-1 text-[12.5px] text-cream/55">{progress}…</div>
                </div>
                {phase === "scanning" && (
                  <button
                    onClick={cancelScan}
                    className="rounded-full border border-cream/20 px-4 py-1.5 text-[12px] text-cream/70 hover:bg-cream/5"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "customize" && scan && (
            <CustomizePanel
              scan={scan}
              layers={layers}
              treeId={treeId}
              onTree={setTreeId}
              placeName={placeName}
              colors={colors}
              onColor={(k, hex) => setColors((c) => ({ ...c, [k]: hex }))}
              relief={relief}
              onRelief={setRelief}
              terrain={terrain}
              onTerrain={setTerrain}
              onGenerate={generate}
              canReopen={!!files}
              onReopen={() => setPhase("studio")}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function CustomizePanel({
  scan,
  layers,
  treeId,
  onTree,
  placeName,
  colors,
  onColor,
  relief,
  onRelief,
  terrain,
  onTerrain,
  onGenerate,
  canReopen,
  onReopen,
}: {
  scan: Scan;
  layers: LayerSummary[];
  treeId: TreeModelId;
  onTree: (id: TreeModelId) => void;
  placeName: string | null;
  colors: Record<string, string>;
  onColor: (key: ExploreLayer, hex: string) => void;
  relief: number;
  onRelief: (v: number) => void;
  terrain: TerrainChoice;
  onTerrain: (t: TerrainChoice) => void;
  onGenerate: () => void;
  canReopen: boolean;
  onReopen: () => void;
}) {
  const [open, setOpen] = useState<ExploreLayer | null>(null);
  const onlyTerrain = layers.length === 1;
  const trees = layers.find((l) => l.key === "trees");

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="float-panel absolute bottom-4 left-4 right-4 top-auto z-20 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl md:bottom-5 md:left-auto md:right-5 md:top-5 md:max-h-none md:w-[360px]"
    >
      <div className="border-b border-cream/[0.09] p-5 pb-4">
        <h3 className="m-0 font-display text-[17px] font-semibold">Customise your model</h3>
        <p className="m-0 mt-1 text-[12.5px] leading-[1.5] text-cream/55">
          {formatMeters(scan.shape.size)} {scan.shape.kind} · {layers.length} layers found. Tap a layer to pick its
          filament colour.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {layers.map((l) => {
          const hex = colors[l.key] || "#FFFFFF";
          const isOpen = open === l.key;
          return (
            <div key={l.key} className="rounded-xl border border-cream/[0.12] bg-cream/[0.03]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : l.key)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <span
                  className="h-7 w-7 shrink-0 rounded-lg border border-black/20 shadow-inner"
                  style={{ background: hex }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px]">{l.label}</span>
                  <span className="block text-[11.5px] text-cream/50">{l.detail}</span>
                </span>
                <span className="text-[11.5px] text-cream/45">{filamentName(hex)}</span>
              </button>
              {isOpen && (
                <div className="border-t border-cream/[0.09] p-3">
                  {FILAMENT_LINES.map((group) => (
                    <div key={group.line} className="mb-2 last:mb-0">
                      <div className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-cream/40">
                        Bambu {group.line}
                      </div>
                      <div className="grid grid-cols-10 gap-1.5">
                        {Object.entries(group.colors).map(([name, c]) => {
                          const on = c.toLowerCase() === hex.toLowerCase();
                          return (
                            <button
                              key={name}
                              type="button"
                              title={name}
                              onClick={() => onColor(l.key, c)}
                              className={`relative aspect-square rounded-md border border-black/20 transition-transform hover:scale-110 ${
                                on ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--color-panel)]" : ""
                              }`}
                              style={{ background: c }}
                            >
                              {on && (
                                <Check
                                  size={11}
                                  className="absolute inset-0 m-auto"
                                  color={isLight(c) ? "#000" : "#fff"}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {trees && (
          <div className="mt-1 rounded-xl border border-cream/[0.12] bg-cream/[0.03] p-3">
            <div className="mb-1.5 text-[13px]">Tree style</div>
            <p className="m-0 mb-2.5 text-[11.5px] leading-[1.5] text-cream/50">
              Placed on parks, woods and mapped trees · {TREE_PRINT_MM} mm tall
            </p>
            <Suspense fallback={<div className="h-20 animate-pulse rounded-lg bg-cream/[0.05]" />}>
              <TreePicker value={treeId} onChange={onTree} color={colors.trees || "#3f7d3a"} />
            </Suspense>
          </div>
        )}

        {scan.data.lod2 && (
          <p className="m-0 rounded-xl bg-[var(--accent-soft)] p-3 text-[11.5px] leading-[1.5] text-cream/70">
            Measured LOD2 buildings from {scan.data.lod2.name} — {scan.data.lod2.attribution}. Gaps filled from
            OpenStreetMap.
          </p>
        )}

        {onlyTerrain && (
          <p className="m-0 rounded-xl border border-cream/[0.1] p-3 text-[11.5px] leading-[1.5] text-cream/55">
            No buildings, roads or greenery are mapped here — you&apos;ll get the terrain only. Try moving the frame
            closer to a town.
          </p>
        )}

        {!scan.heights.flat && (
          <div className="mt-1 flex flex-col gap-3 rounded-xl border border-cream/[0.12] bg-cream/[0.03] p-3">
            <div>
              <div className="mb-1.5 text-[13px]">Terrain shape</div>
              <p className="m-0 mb-2 text-[11.5px] leading-[1.5] text-cream/50">
                {Math.round(scan.heights.relief)} m of height change here. Smooth keeps the slopes, flat levels
                the ground.
              </p>
              <TerrainModePicker value={terrain} onChange={onTerrain} />
            </div>
            {terrain.mode !== "flat" && (
              <div>
                <Scrubber
                  label="Terrain relief (%)"
                  value={relief}
                  min={100}
                  max={400}
                  step={10}
                  decimals={0}
                  onValueChange={onRelief}
                />
                <p className="m-0 mt-1.5 text-[11.5px] text-cream/45">Exaggerate hills so they show up in print</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-cream/[0.09] p-4">
        <button
          type="button"
          onClick={onGenerate}
          className="w-full rounded-full btn-primary py-3 text-[13.5px] transition-transform hover:scale-[1.02]"
        >
          Generate 3D model
        </button>
        {canReopen && (
          <button
            type="button"
            onClick={onReopen}
            className="w-full rounded-full border border-cream/[0.14] py-2.5 text-[12.5px] text-cream/70 hover:bg-cream/[0.04]"
          >
            Open the last model without changes
          </button>
        )}
      </div>
    </motion.aside>
  );
}

function filamentName(hex: string): string {
  for (const g of FILAMENT_LINES) {
    for (const [name, c] of Object.entries(g.colors)) if (c.toLowerCase() === hex.toLowerCase()) return name;
  }
  return hex.toUpperCase();
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 160;
}
