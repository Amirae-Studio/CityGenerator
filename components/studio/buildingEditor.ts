import * as THREE from "three";
import { DEFAULT_LAYER_COLORS, type BuildingEdit, type CityControls } from "@/lib/studio";

/**
 * Pro "Edit buildings".
 *
 * Each building layer arrives as ONE merged mesh (fast to draw, small to load).
 * Every vertex carries its building's ground anchor (`_anchor`, see
 * lib/explore/buildModel.ts), so the triangles can be grouped back into single
 * buildings without changing the model.
 *
 * A building the user selects or edits is lifted out into its own mesh (its
 * own material → own colour in the 3MF; own vertices → own size and place);
 * all the others stay merged. A building whose edits are reset goes back into
 * the merged mesh.
 */

export const BUILDING_LAYERS = ["main-building", "small-building"] as const;

type Building = {
  id: string;
  tris: Uint32Array;
  /** Ground centre at rest; y is the lowest ground under the footprint. */
  anchor: THREE.Vector3;
  /** Footprint extent at rest (x, z). */
  box: { minX: number; maxX: number; minZ: number; maxZ: number };
};

export type BuildingLayer = {
  layer: string;
  /** The merged mesh: every building not lifted out. */
  base: THREE.Mesh;
  /** The layer at rest, as loaded. */
  full: { pos: Float32Array; anc: Float32Array; nrm: Float32Array | null };
  buildings: Building[];
  byId: Map<string, Building>;
  /** base face → building, for picking. */
  faceOwner: Building[];
  /** Lifted-out buildings. */
  parts: Map<string, THREE.Mesh>;
  splitKey: string;
};

/** Groups a merged building mesh into buildings. Null if it can't be (no anchors). */
export function indexBuildingLayer(layer: string, mesh: THREE.Mesh): BuildingLayer | null {
  let geom = mesh.geometry as THREE.BufferGeometry;
  if (!geom.attributes._anchor || !geom.attributes.position) return null;
  if (geom.index) {
    geom = geom.toNonIndexed();
    mesh.geometry.dispose();
    mesh.geometry = geom;
  }
  const pos = new Float32Array(geom.attributes.position.array as Float32Array);
  const anc = new Float32Array(geom.attributes._anchor.array as Float32Array);
  const nrm = geom.attributes.normal ? new Float32Array(geom.attributes.normal.array as Float32Array) : null;
  mesh.userData.origPosition = pos.slice();

  const lists = new Map<string, number[]>();
  const anchors = new Map<string, THREE.Vector3>();
  const triCount = pos.length / 9;
  for (let t = 0; t < triCount; t++) {
    const i = t * 9;
    // Horizontal only: a terrain rebuild (smooth ↔ flat) keeps the same ids.
    const id = `${layer}:${Math.round(anc[i] * 100)}:${Math.round(anc[i + 2] * 100)}`;
    let list = lists.get(id);
    if (!list) {
      list = [];
      lists.set(id, list);
      anchors.set(id, new THREE.Vector3(anc[i], anc[i + 1], anc[i + 2]));
    }
    list.push(t);
  }
  const buildings: Building[] = [];
  const byId = new Map<string, Building>();
  const faceOwner: Building[] = new Array(triCount);
  for (const [id, list] of lists) {
    const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const t of list) {
      for (let v = t * 9; v < t * 9 + 9; v += 3) {
        box.minX = Math.min(box.minX, pos[v]);
        box.maxX = Math.max(box.maxX, pos[v]);
        box.minZ = Math.min(box.minZ, pos[v + 2]);
        box.maxZ = Math.max(box.maxZ, pos[v + 2]);
      }
    }
    const b: Building = { id, tris: Uint32Array.from(list), anchor: anchors.get(id)!, box };
    buildings.push(b);
    byId.set(id, b);
    for (const t of list) faceOwner[t] = b;
  }
  return { layer, base: mesh, full: { pos, anc, nrm }, buildings, byId, faceOwner, parts: new Map(), splitKey: "" };
}

/** Copies the given buildings' rest triangles into a fresh geometry. */
function gather(L: BuildingLayer, list: Building[]): { geom: THREE.BufferGeometry; owner: Building[] } {
  let n = 0;
  for (const b of list) n += b.tris.length;
  const pos = new Float32Array(n * 9);
  const anc = new Float32Array(n * 9);
  const nrm = L.full.nrm ? new Float32Array(n * 9) : null;
  const owner: Building[] = new Array(n);
  let o = 0;
  for (const b of list) {
    for (const t of b.tris) {
      const i = t * 9;
      pos.set(L.full.pos.subarray(i, i + 9), o * 9);
      anc.set(L.full.anc.subarray(i, i + 9), o * 9);
      if (nrm) nrm.set(L.full.nrm!.subarray(i, i + 9), o * 9);
      owner[o++] = b;
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("_anchor", new THREE.BufferAttribute(anc, 3));
  // Always with normals: the exporter merges the layer with its lifted-out
  // buildings, and merging needs the same attributes on every piece.
  if (nrm) geom.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  else geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return { geom, owner };
}

/**
 * Lifts exactly `ids` (this layer's) out of the merged mesh. Returns true when
 * the merged mesh was rebuilt (its vertices are then back at rest).
 */
export function splitBuildings(L: BuildingLayer, ids: string[]): boolean {
  const want = ids.filter((id) => L.byId.has(id)).sort();
  const key = want.join("|");
  if (key === L.splitKey) return false;
  L.splitKey = key;
  const wantSet = new Set(want);

  for (const [id, part] of L.parts) {
    if (wantSet.has(id)) continue;
    part.removeFromParent();
    part.geometry.dispose();
    (part.material as THREE.Material).dispose();
    L.parts.delete(id);
  }
  for (const id of want) {
    if (L.parts.has(id)) continue;
    const b = L.byId.get(id)!;
    const { geom } = gather(L, [b]);
    const part = new THREE.Mesh(geom, (L.base.material as THREE.Material).clone());
    part.name = L.base.name;
    part.castShadow = true;
    part.receiveShadow = true;
    part.userData = {
      ...L.base.userData,
      origPosition: (geom.attributes.position.array as Float32Array).slice(),
      buildingId: id,
      clonedMat: true,
    };
    L.base.parent?.add(part);
    L.parts.set(id, part);
  }

  const { geom, owner } = gather(L, L.buildings.filter((b) => !wantSet.has(b.id)));
  L.base.geometry.dispose();
  L.base.geometry = geom;
  L.base.userData.origPosition = (geom.attributes.position.array as Float32Array).slice();
  L.faceOwner = owner;
  return true;
}

/** Layer slider scale per axis (x, y, z) — Y is up for generated models. */
export function layerScale(layer: string, c: CityControls): [number, number, number] {
  if (layer === "small-building") return [1, c.small / 100, 1];
  const all = c.large / 100;
  return [all, (c.largeHeight / 100) * all, all];
}

/**
 * Writes a building mesh's vertices: each scaled about its own ground anchor by
 * the layer scale (and the building's own size), then moved by `offset`.
 */
export function placeMesh(
  m: THREE.Mesh,
  s: [number, number, number],
  edit?: BuildingEdit | null,
  offset: [number, number, number] = [0, 0, 0]
) {
  const posAttr = m.geometry.attributes.position as THREE.BufferAttribute;
  const anc = (m.geometry.attributes._anchor as THREE.BufferAttribute).array as Float32Array;
  const orig = m.userData.origPosition as Float32Array;
  const out = posAttr.array as Float32Array;
  const size = edit ? edit.size / 100 : 1;
  const k = [s[0] * size, s[1] * size * (edit ? edit.height / 100 : 1), s[2] * size];
  for (let i = 0; i < out.length; i++) {
    const a = i % 3;
    out[i] = anc[i] + (orig[i] - anc[i]) * k[a] + offset[a];
  }
  posAttr.needsUpdate = true;
  // Lifted-out buildings (edit given, even null) get fresh normals after a resize.
  if (edit !== undefined) m.geometry.computeVertexNormals();
  m.geometry.computeBoundingBox();
  m.geometry.computeBoundingSphere();
}

const OUTLINE = new THREE.LineBasicMaterial({ color: "#4cce8a", depthTest: false, transparent: true, opacity: 0.95 });

/**
 * Selection mark: the building's edges in the accent green, drawn on top. An
 * outline (not a glow) keeps the building's own colour true. Lines are never
 * exported — the exporter takes meshes only.
 */
export function outline(part: THREE.Mesh, on: boolean) {
  const old = part.userData.outline as THREE.LineSegments | undefined;
  if (old) {
    old.removeFromParent();
    old.geometry.dispose();
    delete part.userData.outline;
  }
  if (!on) return;
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(part.geometry, 30), OUTLINE);
  lines.renderOrder = 10;
  lines.raycast = () => {}; // never picked
  part.add(lines);
  part.userData.outline = lines;
}

/** The colour a mesh gets from the layer settings (Filament Colors). */
export function layerColor(c: CityControls, layerName: string, colorHint?: string): string {
  if (!c.enableColors) return "#e9e6df";
  return c.layerColors?.[layerName] || colorHint || DEFAULT_LAYER_COLORS[layerName] || "#FFFFFF";
}

/**
 * Ground height under a point, in the model's own space (Y up). Uses a probe
 * that shares the terrain's geometry, so the model's placement in the scene
 * doesn't matter.
 */
export function groundSampler(terrain: THREE.Mesh | null) {
  if (!terrain) return () => null as number | null;
  const probe = new THREE.Mesh(terrain.geometry);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  const cache = new Map<string, number | null>();
  return (x: number, z: number): number | null => {
    const key = `${Math.round(x * 100)}:${Math.round(z * 100)}`;
    if (cache.has(key)) return cache.get(key)!;
    if (!terrain.geometry.boundingBox) terrain.geometry.computeBoundingBox();
    from.set(x, terrain.geometry.boundingBox!.max.y + 10, z);
    ray.set(from, down);
    const hit = ray.intersectObject(probe, false)[0];
    const y = hit ? hit.point.y : null;
    if (cache.size > 20000) cache.clear(); // a long drag samples many spots
    cache.set(key, y);
    return y;
  };
}

/**
 * How far a moved building must rise or sink to stand on the land at its new
 * spot: its base goes to the lowest ground under the (resized) footprint, the
 * same rule the model builder uses, so no side ever floats. Null when part of
 * the footprint would leave the land — the move is refused.
 */
export function groundOffset(
  b: Building,
  s: [number, number, number],
  edit: BuildingEdit | null,
  dx: number,
  dz: number,
  groundAt: (x: number, z: number) => number | null
): number | null {
  const k = edit ? edit.size / 100 : 1;
  const ax = b.anchor.x;
  const az = b.anchor.z;
  const x0 = ax + (b.box.minX - ax) * s[0] * k + dx;
  const x1 = ax + (b.box.maxX - ax) * s[0] * k + dx;
  const z0 = az + (b.box.minZ - az) * s[2] * k + dz;
  const z1 = az + (b.box.maxZ - az) * s[2] * k + dz;
  let low = Infinity;
  for (const [x, z] of [
    [ax + dx, az + dz],
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
    [(x0 + x1) / 2, z0],
    [(x0 + x1) / 2, z1],
    [x0, (z0 + z1) / 2],
    [x1, (z0 + z1) / 2],
  ]) {
    const g = groundAt(x, z);
    if (g === null) return null;
    low = Math.min(low, g);
  }
  return low - b.anchor.y;
}
