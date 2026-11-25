import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Edges,
} from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

const dracoLoader = new DRACOLoader();
// Decoders ship with the app (public/draco) — no third-party script host.
dracoLoader.setDecoderPath(new URL("draco/", document.baseURI).href);
import { MM, DEFAULT_LAYER_COLORS, isDefaultEdit, type BuildingEdits, type CityControls } from "@/lib/studio";
import {
  BUILDING_LAYERS,
  groundSampler,
  indexBuildingLayer,
  layerColor,
  layerScale,
  groundOffset,
  outline,
  placeMesh,
  splitBuildings,
  type BuildingLayer,
} from "./buildingEditor";
import { MINOR_ROAD_KINDS } from "@/lib/explore/roads";
import type { ModelFile } from "@/lib/types";

export type GizmoMode = "translate" | "rotate" | "scale";

/** Pro "Edit buildings": what's selected / changed, and how the scene reports picks and drags. */
export type BuildingEditor = {
  editing: boolean;
  selected: string[];
  edits: BuildingEdits;
  /** replace: select only this · toggle: add/remove (Shift/Ctrl) · clear: nothing selected */
  onPick: (id: string | null, how: "replace" | "toggle" | "clear") => void;
  /** New ground offsets for the dragged buildings — once, when the drag ends (the drag itself is previewed in the scene). */
  onMove: (offsets: Record<string, { dx: number; dz: number }>) => void;
};
// null hides the gizmo: size and placement are then set from the side panel.

/** A printable frame shown around the model: geometry in mm, Z up, back at z = 0. */
export type SceneFrame = {
  geometry: THREE.BufferGeometry;
  color: string;
  position: [number, number, number];
  /** Nameplate letters, a separate part in their own colour. */
  text?: { geometry: THREE.BufferGeometry; color: string } | null;
};

function Bed({ w, d, light }: { w: number; d: number; light: boolean }) {
  // Grid every 20 mm, plus a brighter outer border.
  const { grid, border } = useMemo(() => {
    const hw = (w * MM) / 2;
    const hd = (d * MM) / 2;
    const step = 20 * MM;

    const gridPts: number[] = [];
    for (let x = -hw; x <= hw + 1e-6; x += step)
      gridPts.push(x, 0, -hd, x, 0, hd);
    for (let z = -hd; z <= hd + 1e-6; z += step)
      gridPts.push(-hw, 0, z, hw, 0, z);
    const grid = new THREE.BufferGeometry();
    grid.setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3));

    const borderPts = [
      -hw, 0, -hd, hw, 0, -hd,
      hw, 0, -hd, hw, 0, hd,
      hw, 0, hd, -hw, 0, hd,
      -hw, 0, hd, -hw, 0, -hd,
    ];
    const border = new THREE.BufferGeometry();
    border.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(borderPts, 3)
    );

    return { grid, border };
  }, [w, d]);

  const plate = light ? "#dfe6e2" : "#151b18";
  const lineColor = light ? "#2f3d36" : "#eef4f0";

  return (
    <group>
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[w * MM + 0.24, 0.12, d * MM + 0.24]} />
        <meshStandardMaterial color={plate} roughness={0.85} metalness={light ? 0.05 : 0.15} />
      </mesh>
      <lineSegments geometry={grid} position={[0, 0.003, 0]}>
        <lineBasicMaterial color={lineColor} transparent opacity={light ? 0.16 : 0.1} />
      </lineSegments>
      <lineSegments geometry={border} position={[0, 0.005, 0]}>
        <lineBasicMaterial color={lineColor} transparent opacity={light ? 0.4 : 0.3} />
      </lineSegments>
    </group>
  );
}

/**
 * Owns BOTH the transformable group and its TransformControls, so they mount
 * and unmount in the same commit. The gizmo can never outlive (or attach to)
 * an object that has left the scene graph — which is what caused
 * "TransformControls: The attached 3D object must be a part of the scene graph".
 */
function TransformTarget({
  mode,
  position,
  onTarget,
  onTransform,
  children,
}: {
  mode: GizmoMode | null;
  position: [number, number, number];
  onTarget: (o: THREE.Object3D | null) => void;
  onTransform: (o: THREE.Object3D) => void;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const [obj, setObj] = useState<THREE.Group | null>(null);

  useEffect(() => {
    const g = group.current;
    setObj(g);
    onTarget(g);
    return () => {
      setObj(null);
      onTarget(null);
    };
  }, [onTarget]);

  return (
    <>
      <group ref={group} position={position}>
        {children}
      </group>
      {obj && mode && (
        <TransformControls
          object={obj}
          mode={mode}
          size={0.85}
          onObjectChange={() => onTransform(obj)}
        />
      )}
    </>
  );
}

const TARGET_SIZE = 4;

// A city tile assembled from multiple GLB layers (terrain, roads, buildings,
// trees, …) that share one origin. useGLTF suspends until EVERY layer has
// downloaded, so the tile appears fully assembled — never piece by piece.
type Axis = "x" | "y" | "z";
const AXES: Axis[] = ["x", "y", "z"];

function getLocalBoundingBox(node: THREE.Object3D, container: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  node.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }
      if (mesh.geometry.boundingBox) {
        const b = mesh.geometry.boundingBox.clone();
        const localMatrix = new THREE.Matrix4().identity();
        let curr: THREE.Object3D | null = mesh;
        while (curr && curr !== container) {
          localMatrix.premultiply(curr.matrix);
          curr = curr.parent;
        }
        b.applyMatrix4(localMatrix);
        box.union(b);
      }
    }
  });
  return box;
}

function isStlFile(f: ModelFile): boolean {
  if (f.ext && f.ext.toLowerCase() === "stl") return true;
  const lowerName = (f.name || "").toLowerCase();
  const lowerUrl = (f.url || "").toLowerCase();
  return lowerName.endsWith(".stl") || lowerUrl.includes(".stl");
}

function CityAssembly({
  files,
  mode,
  controls,
  buildings,
  onTarget,
  onTransform,
}: {
  files: ModelFile[];
  mode: GizmoMode | null;
  controls: CityControls;
  buildings?: BuildingEditor;
  onTarget: (o: THREE.Object3D | null) => void;
  onTransform: (o: THREE.Object3D) => void;
}) {
  const glbFiles = useMemo(() => files.filter((f) => !isStlFile(f)), [files]);
  const stlFiles = useMemo(() => files.filter((f) => isStlFile(f)), [files]);

  const glbUrls = useMemo(() => glbFiles.map((f) => f.url), [glbFiles]);
  const stlUrls = useMemo(() => stlFiles.map((f) => f.url), [stlFiles]);

  const gltfs = useLoader(GLTFLoader, glbUrls, (loader) => {
    loader.setDRACOLoader(dracoLoader);
  });
  const stls = useLoader(STLLoader, stlUrls);

  const {
    object,
    scale,
    center,
    layerInfo,
    upAxis,
    terrainBottomAtRest,
    boxMin,
    buildingLayers,
    groundAt,
  } = useMemo(() => {
    const object = new THREE.Group();

    // Track layer groups
    const layerGroups = new Map<string, THREE.Group>();
    const getOrCreateLayerGroup = (layerName: string) => {
      let g = layerGroups.get(layerName);
      if (!g) {
        g = new THREE.Group();
        g.name = layerName;
        layerGroups.set(layerName, g);
        object.add(g);
      }
      return g;
    };

    // Process GLB layers
    glbFiles.forEach((file, i) => {
      const gltfObj = Array.isArray(gltfs) ? gltfs[i] : gltfs;
      if (gltfObj && gltfObj.scene) {
        const layer = gltfObj.scene.clone(true);
        const layerName = file.layer || file.name;
        layer.name = file.partKey || file.name;
        layer.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.userData.layerName = layerName;
            m.userData.partKey = file.partKey || file.name;
            m.userData.partName = file.partName || file.name;
            m.userData.isSubPart = !!file.isSubPart;
            m.userData.colorHint = file.colorHint;
            if (m.geometry && m.geometry.attributes.position) {
              m.userData.origPosition = m.geometry.attributes.position.array.slice();
            }
          }
        });
        const parentGroup = getOrCreateLayerGroup(layerName);
        parentGroup.add(layer);
      }
    });

    // Process STL layers
    stlFiles.forEach((file, i) => {
      const geomObj = Array.isArray(stls) ? stls[i] : stls;
      if (geomObj) {
        const g = (geomObj as THREE.BufferGeometry).clone();
        
        // Blender uses Z as up and Y as forward. 
        // Three.js uses Y as up and -Z as forward.
        // Rotate -90 degrees around X to map Blender's coordinates to Three.js
        g.rotateX(-Math.PI / 2);
        
        g.computeVertexNormals();
        g.computeBoundingBox();

        const mat = new THREE.MeshStandardMaterial({
          color: "#e9e6df",
          roughness: 0.6,
          metalness: 0.05,
        });
        const mesh = new THREE.Mesh(g, mat);
        const layerName = file.layer || file.name;
        mesh.name = file.partKey || file.name;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.layerName = layerName;
        mesh.userData.partKey = file.partKey || file.name;
        mesh.userData.partName = file.partName || file.name;
        mesh.userData.isSubPart = !!file.isSubPart;
        mesh.userData.colorHint = file.colorHint;

        if (g.attributes.position) {
          mesh.userData.origPosition = g.attributes.position.array.slice();
        }

        const parentGroup = getOrCreateLayerGroup(layerName);
        parentGroup.add(mesh);
      }
    });

    // Which axis is "up"? Flat layers (roads/terrain/grass) are thinnest
    // along it — robust whether the exports are Y-up or Z-up.
    let upAxis: Axis = "y";
    const flat = ["terrain", "roads", "grass", "water"]
      .map((n) => object.getObjectByName(n))
      .find(Boolean);
    if (flat) {
      const s = new THREE.Vector3();
      new THREE.Box3().setFromObject(flat).getSize(s);
      upAxis = s.x < s.y ? (s.x < s.z ? "x" : "z") : s.y < s.z ? "y" : "z";
    }

    // Per-layer anchors (at rest): base along up-axis, centre elsewhere.
    const layerInfo = new Map<
      string,
      { min: THREE.Vector3; max: THREE.Vector3; center: THREE.Vector3 }
    >();
    object.children.forEach((layer) => {
      const b = new THREE.Box3().setFromObject(layer);
      const c = new THREE.Vector3();
      b.getCenter(c);
      layerInfo.set(layer.name, {
        min: b.min.clone(),
        max: b.max.clone(),
        center: c,
      });
    });

    const box = new THREE.Box3().setFromObject(object);

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const boxMin = box.min.clone();

    const terrainInfo = layerInfo.get("terrain");
    const terrainBottomAtRest = terrainInfo
      ? terrainInfo.min[upAxis]
      : box.min[upAxis];

    const scale = TARGET_SIZE / (Math.max(size.x, size.y, size.z) || 1);

    // Single buildings, for the Pro building editor (generated, Y-up models only).
    const buildingLayers: BuildingLayer[] = [];
    let terrainMesh: THREE.Mesh | null = null;
    if (upAxis === "y") {
      for (const name of BUILDING_LAYERS) {
        let mesh: THREE.Mesh | null = null;
        object.getObjectByName(name)?.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!mesh && m.isMesh && m.geometry?.attributes._anchor) mesh = m;
        });
        const L = mesh && indexBuildingLayer(name, mesh);
        if (L) buildingLayers.push(L);
      }
      object.getObjectByName("terrain")?.traverse((o) => {
        if (!terrainMesh && (o as THREE.Mesh).isMesh) terrainMesh = o as THREE.Mesh;
      });
    }

    return {
      object,
      scale,
      center,
      layerInfo,
      upAxis,
      terrainBottomAtRest,
      boxMin,
      buildingLayers,
      groundAt: groundSampler(terrainMesh),
    };
  }, [glbFiles, stlFiles, gltfs, stls]);

  // Compute dynamic Y bounds so the entire model assembly rests above the checkerboard bed plate.
  const lowestY = useMemo(() => {
    const sTerrain = controls.terrain / 100;
    const terrainInfo = layerInfo.get("terrain");
    const totalH = terrainInfo ? terrainInfo.max[upAxis] - terrainInfo.min[upAxis] : 0;
    const baseHeight = totalH * 0.35;
    const currentTerrainBottom = terrainBottomAtRest - (sTerrain - 1) * baseHeight;

    // Water scales upward from its own bottom and never reaches below the
    // terrain, so it has no say in where the tile's base sits.
    return Math.min(boxMin[upAxis], currentTerrainBottom);
  }, [
    controls.terrain,
    terrainBottomAtRest,
    boxMin,
    upAxis,
    layerInfo,
  ]);


  // Apply the Manipulate City controls, non-destructively.
  useEffect(() => {
    const sTerrain = controls.terrain / 100;

    // Non-terrain components stay right at rest positions on the terrain surface.
    const COMPONENT_INSERTION = 0;
    // Generated (Explore World) layers carry a per-vertex `_anchor`: every
    // building / tree / road / water patch scales about its own ground point,
    // so resized objects stay on the terrain instead of the layer stretching
    // from its lowest point (which lifts everything standing on a hill).
    const scaleAnchored = (layer: THREE.Object3D, vert: number, all: number) => {
      const anchored: THREE.Mesh[] = [];
      layer.traverse((o) => {
        const m = o as THREE.Mesh;
        // Lifted-out buildings are placed by the building editor (below).
        if (m.isMesh && m.geometry?.attributes._anchor && m.userData.origPosition && !m.userData.buildingId) anchored.push(m);
      });
      if (!anchored.length) return false;
      layer.scale.set(1, 1, 1);
      layer.position.set(0, 0, 0);
      const s = AXES.map((a) => (a === upAxis ? vert : 1) * all);
      for (const m of anchored) {
        const posAttr = m.geometry.attributes.position as THREE.BufferAttribute;
        const out = posAttr.array as Float32Array;
        const orig = m.userData.origPosition as Float32Array;
        const anc = (m.geometry.attributes._anchor as THREE.BufferAttribute).array as Float32Array;
        for (let i = 0; i < out.length; i++) out[i] = anc[i] + (orig[i] - anc[i]) * s[i % 3];
        posAttr.needsUpdate = true;
        m.geometry.computeBoundingBox();
        m.geometry.computeBoundingSphere();
      }
      return true;
    };

    const apply = (name: string, vert: number, all: number) => {
      const layer = object.getObjectByName(name);
      const info = layerInfo.get(name);
      if (!layer || !info || name === "terrain" || name === "water") return;

      if (scaleAnchored(layer, vert, all)) return;

      AXES.forEach((a) => {
        const s = (a === upAxis ? vert : 1) * all;
        const anchor = a === upAxis ? info.min[a] : info.center[a];
        layer.scale[a] = s;
        let pos = anchor * (1 - s);
        if (a === upAxis) {
          pos -= COMPONENT_INSERTION;
        }
        layer.position[a] = pos;
      });
    };

    apply("small-building", controls.small / 100, 1);
    // Uniform scale first, then extra height on top of it — so a locked-in
    // uniform size can still be stretched vertically.
    apply("main-building", controls.largeHeight / 100, controls.large / 100);
    apply("roads", controls.roads / 100, 1);
    apply("trees", controls.trees / 100, 1);
    apply("grass", 1, 1);

    // Deform terrain base block from bottom up — top surface topography (t=1) stays fixed (0 delta).
    const terrainLayer = object.getObjectByName("terrain");
    const terrainInfo = layerInfo.get("terrain");
    let terrainOffset = 0;
    if (terrainLayer && terrainInfo) {
      const minY = terrainInfo.min[upAxis];
      const maxY = terrainInfo.max[upAxis];
      const totalH = maxY - minY;
      const topThreshold = minY + 0.35 * totalH;
      const baseHeight = topThreshold - minY;
      terrainOffset = (sTerrain - 1) * baseHeight;

      terrainLayer.position.set(0, 0, 0);
      terrainLayer.scale.set(1, 1, 1);

      terrainLayer.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh && m.geometry && m.userData.origPosition) {
          const orig = m.userData.origPosition as Float32Array;
          const posAttr = m.geometry.attributes.position;
          const arr = posAttr.array as Float32Array;

          m.updateMatrix();
          const localMat = m.matrix;
          const invMat = localMat.clone().invert();
          const v = new THREE.Vector3();

          // Generated terrain has hills reaching into the lower 35%: a ramp
          // would sink valleys away from the roads, trees and buildings on
          // them. Its bottom is one flat plane, so move only that plane.
          const flatBase = !!m.userData.flatBase;
          const baseEps = totalH * 1e-3;

          for (let i = 0; i < orig.length; i += 3) {
            v.set(orig[i], orig[i + 1], orig[i + 2]);
            v.applyMatrix4(localMat);

            const yLocal = v[upAxis];
            let delta: number;
            if (flatBase) {
              delta = yLocal <= minY + baseEps ? terrainOffset : 0;
            } else {
              const t = THREE.MathUtils.clamp((yLocal - minY) / (topThreshold - minY), 0, 1);
              // Bottom vertices (t=0) get the full terrain extension.
              // Top vertices (t=1) stay fixed — no delta.
              delta = (1 - t) * terrainOffset;
            }
            v[upAxis] = yLocal - delta;

            v.applyMatrix4(invMat);
            arr[i] = v.x;
            arr[i + 1] = v.y;
            arr[i + 2] = v.z;
          }
          posAttr.needsUpdate = true;
          m.geometry.computeVertexNormals();
        }
      });
    }

    // Water layer: bottom-anchored; height controlled by controls.water slider,
    // and follows the bottom of the terrain downwards when terrain height increases
    // without increasing the water's vertical size.
    const waterLayer = object.getObjectByName("water");
    const waterInfo = layerInfo.get("water");
    // Generated water lies on the ground (rivers run down slopes): it grows in
    // place from the ground under each point and never moves with the base.
    if (waterLayer && waterInfo && !scaleAnchored(waterLayer, controls.water / 100, 1)) {
      const sWater = controls.water / 100;
      AXES.forEach((a) => {
        const s = a === upAxis ? sWater : 1;
        const anchor = a === upAxis ? waterInfo.min[a] : waterInfo.center[a];
        waterLayer.scale[a] = s;
        let pos = anchor * (1 - s);
        if (a === upAxis) {
          pos -= terrainOffset;
        }
        waterLayer.position[a] = pos;
      });
    }



    // Determine which layers have subparts
    const layerSubpartsMap = new Map<string, boolean>();
    files.forEach((f) => {
      if (f.isSubPart) {
        layerSubpartsMap.set(f.layer, true);
      }
    });

    // Apply visibility of subparts vs monolithic
    object.children.forEach((layerGroup) => {
      const layerName = layerGroup.name;
      const hasSubParts = !!layerSubpartsMap.get(layerName);

      layerGroup.traverse((child) => {
        if (child === layerGroup) return;
        const isSubPart = !!child.userData.isSubPart;
        if (hasSubParts) {
          if (isSubPart) {
            child.visible = !!controls.enableColors;
          } else {
            child.visible = !controls.enableColors;
          }
        } else {
          child.visible = true;
        }
      });
    });

    const setVisible = (name: string, hidden: boolean) => {
      const layer = object.getObjectByName(name);
      if (layer) layer.visible = !hidden;
    };
    setVisible("roads", controls.hideRoads);
    // Road kinds: each is its own child of the roads layer ("roads-local", …).
    // Hidden ones also drop out of the export, which only takes visible meshes.
    const hiddenRoads = new Set<string>(controls.optimizeRoads ? MINOR_ROAD_KINDS : controls.hiddenRoadKinds);
    object.getObjectByName("roads")?.children.forEach((part) => {
      if (part.name.startsWith("roads-")) part.visible = !hiddenRoads.has(part.name.slice("roads-".length));
    });
    setVisible("trees", controls.hideTrees);
    setVisible("grass", controls.hideGrass);
    setVisible("water", !controls.enableWater);

    // Apply layer and sub-part colors dynamically
    object.children.forEach((layer) => {
      layer.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material) {
          if (!m.userData.clonedMat) {
            m.material = (m.material as THREE.Material).clone();
            m.userData.clonedMat = true;
          }
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.color) {
            let targetHex = "#e9e6df";
            if (controls.enableColors) {
              const layerName = m.userData.layerName || layer.name;
              const colorHint = m.userData.colorHint;

              // If user explicitly customized the color for this entire layer (e.g. main-building), use it
              // Otherwise, default to the part's own filename hex colorHint or default layer color
              if (controls.layerColors && controls.layerColors[layerName]) {
                targetHex = controls.layerColors[layerName];
              } else if (colorHint) {
                targetHex = colorHint;
              } else {
                targetHex = DEFAULT_LAYER_COLORS[layerName] || "#FFFFFF";
              }
            }
            mat.color.set(targetHex);
          }
        }
      });
    });
  }, [
    object,
    layerInfo,
    upAxis,
    terrainBottomAtRest,
    controls,
  ]);

  // Pro building editor: lift the selected / edited buildings out of their
  // merged layer and place each one (layer sliders × its own size, moved over
  // the ground, standing on the terrain where it lands). Runs after the layer
  // controls above, so it wins for these buildings.
  const editing = !!buildings?.editing;
  const selectedKey = editing ? (buildings?.selected ?? []).join("|") : "";
  const edits = buildings?.edits;
  useEffect(() => {
    if (!buildingLayers.length) return;
    const sel = new Set(selectedKey ? selectedKey.split("|") : []);
    const ed = edits ?? {};
    const lifted = [...new Set([...sel, ...Object.keys(ed).filter((id) => !isDefaultEdit(ed[id]))])];
    for (const L of buildingLayers) {
      const s = layerScale(L.layer, controls);
      if (splitBuildings(L, lifted)) placeMesh(L.base, s);
      for (const [id, part] of L.parts) {
        const e = ed[id] ?? null;
        const b = L.byId.get(id)!;
        const dx = e?.dx ?? 0;
        const dz = e?.dz ?? 0;
        const dy = dx || dz ? (groundOffset(b, s, e, dx, dz, groundAt) ?? 0) : 0;
        placeMesh(part, s, e, [dx, dy, dz]);
        // What's baked into the vertices; a drag previews by moving the mesh on top.
        part.userData.baked = { dx, dy, dz };
        part.position.set(0, 0, 0);
        (part.material as THREE.MeshStandardMaterial).color.set(e?.color ?? layerColor(controls, L.layer, part.userData.colorHint));
        outline(part, sel.has(id));
      }
    }
  }, [buildingLayers, groundAt, controls, selectedKey, edits]);

  // Click to select (Shift / Ctrl adds), drag a selected building to move it.
  // Listens on the window in the capture phase: the canvas's wrapper (where
  // react-three-fiber and OrbitControls listen) stops the press before it
  // reaches the canvas, and this way a press on a building never starts an orbit.
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const orbit = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const live = useRef(buildings);
  const liveControls = useRef(controls);
  useEffect(() => {
    live.current = buildings;
    liveControls.current = controls;
  });
  useEffect(() => {
    if (!editing || !buildingLayers.length) return;
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const terrain = object.getObjectByName("terrain");
    const aim = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    const pick = (): { id: string; point: THREE.Vector3 } | null => {
      const targets: THREE.Object3D[] = [];
      for (const L of buildingLayers) targets.push(L.base, ...L.parts.values());
      if (terrain?.visible) targets.push(terrain);
      const hit = ray.intersectObjects(targets, true)[0];
      if (!hit) return null;
      const partId = hit.object.userData.buildingId as string | undefined;
      if (partId) return { id: partId, point: hit.point };
      const L = buildingLayers.find((l) => l.base === hit.object);
      const owner = L && hit.faceIndex != null ? L.faceOwner[hit.faceIndex] : undefined;
      return owner ? { id: owner.id, point: hit.point } : null;
    };

    type Drag = {
      x: number;
      y: number;
      moved: boolean;
      /** Runs on release when the pointer didn't move (a click, not a drag/orbit). */
      onClick: (() => void) | null;
      move: { ids: string[]; start: Record<string, { dx: number; dz: number }>; plane: THREE.Plane; from: THREE.Vector3 } | null;
    };
    let drag: Drag | null = null;
    let raf = 0;
    /** Last offsets that keep every dragged building on the land. */
    let next: Record<string, { dx: number; dz: number; dy: number }> | null = null;
    const find = (id: string) => {
      const L = buildingLayers.find((l) => l.byId.has(id));
      return L ? { L, b: L.byId.get(id)! } : null;
    };
    /** Moves the meshes only — React state is written once, on release. */
    const preview = () => {
      raf = 0;
      if (!next) return;
      for (const [id, o] of Object.entries(next)) {
        const part = find(id)?.L.parts.get(id);
        if (!part) continue; // just picked: lifted out on the next render
        const baked = (part.userData.baked as { dx: number; dy: number; dz: number } | undefined) ?? { dx: 0, dy: 0, dz: 0 };
        part.position.set(o.dx - baked.dx, o.dy - baked.dy, o.dz - baked.dz);
      }
    };

    const onDown = (e: PointerEvent) => {
      const b = live.current;
      if (e.target !== el || e.button !== 0 || !b) return;
      aim(e);
      const hit = pick();
      if (!hit) {
        drag = { x: e.clientX, y: e.clientY, moved: false, onClick: () => b.onPick(null, "clear"), move: null };
        return;
      }
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        b.onPick(hit.id, "toggle");
        e.stopImmediatePropagation();
        return;
      }
      const already = b.selected.includes(hit.id);
      if (!already) b.onPick(hit.id, "replace");
      const ids = already ? b.selected : [hit.id];
      const start = Object.fromEntries(ids.map((id) => [id, { dx: b.edits[id]?.dx ?? 0, dz: b.edits[id]?.dz ?? 0 }]));
      drag = {
        x: e.clientX,
        y: e.clientY,
        moved: false,
        // Clicking one of several selected buildings narrows the selection to it.
        onClick: already && b.selected.length > 1 ? () => b.onPick(hit.id, "replace") : null,
        move: { ids, start, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hit.point), from: hit.point.clone() },
      };
      if (orbit) orbit.enabled = false;
      e.stopImmediatePropagation();
    };

    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      drag.moved = true;
      const m = drag.move;
      if (!m) return;
      aim(e);
      const p = ray.ray.intersectPlane(m.plane, new THREE.Vector3());
      if (!p) return;
      const a = object.worldToLocal(m.from.clone());
      const c = object.worldToLocal(p);
      const edits = live.current?.edits ?? {};
      const cand: Record<string, { dx: number; dz: number; dy: number }> = {};
      for (const id of m.ids) {
        const f = find(id);
        if (!f) continue;
        const dx = m.start[id].dx + c.x - a.x;
        const dz = m.start[id].dz + c.z - a.z;
        const dy = groundOffset(f.b, layerScale(f.L.layer, liveControls.current), edits[id] ?? null, dx, dz, groundAt);
        if (dy === null) return; // would leave the land: stay at the last good spot
        cand[id] = { dx, dz, dy };
      }
      next = cand;
      el.style.cursor = "grabbing";
      if (!raf) raf = requestAnimationFrame(preview);
    };

    const onUp = () => {
      if (!drag) return;
      if (!drag.moved) drag.onClick?.();
      else if (drag.move && next) {
        cancelAnimationFrame(raf);
        preview();
        live.current?.onMove(Object.fromEntries(Object.entries(next).map(([id, o]) => [id, { dx: o.dx, dz: o.dz }])));
      }
      next = null;
      if (drag.move && orbit) orbit.enabled = true;
      el.style.cursor = "";
      drag = null;
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      cancelAnimationFrame(raf);
      if (orbit) orbit.enabled = true;
      el.style.cursor = "";
    };
  }, [editing, buildingLayers, groundAt, gl, camera, orbit, object]);

  return (
    <TransformTarget
      mode={mode}
      position={[0, 0, 0]}
      onTarget={onTarget}
      onTransform={onTransform}
    >
      <group
        scale={scale}
        position={[-center.x * scale, -lowestY * scale, -center.z * scale]}
      >
        <primitive object={object} />
      </group>
    </TransformTarget>
  );
}

// Fallback tile for locations that don't have a model uploaded yet.
function PlaceholderTile({
  mode,
  onTarget,
  onTransform,
}: {
  mode: GizmoMode | null;
  onTarget: (o: THREE.Object3D | null) => void;
  onTransform: (o: THREE.Object3D) => void;
}) {
  return (
    <TransformTarget
      mode={mode}
      position={[0, 1, 0]}
      onTarget={onTarget}
      onTransform={onTransform}
    >
      <mesh castShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#e9e6df" roughness={0.6} metalness={0.05} />
        <Edges color="#8a8478" threshold={20} opacity={0.35} transparent />
      </mesh>
    </TransformTarget>
  );
}

/**
 * Marks the scene as loading while mounted. The spinner itself is a normal DOM
 * overlay outside the Canvas: drei's <Html> mounts a separate React root and
 * tears it down synchronously when the model resolves, which React 19 rejects
 * ("synchronously unmount a root while React was already rendering").
 */
function Loader({ onLoading }: { onLoading: (busy: boolean) => void }) {
  useEffect(() => {
    onLoading(true);
    return () => onLoading(false);
  }, [onLoading]);
  return null;
}

function LoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream/20 border-t-[color:var(--accent)]" />
        <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.24em] text-cream/55">
          Loading model…
        </span>
      </div>
    </div>
  );
}

function StudioCameraControls() {
  return (
    <OrbitControls
      makeDefault
      target={[0, 0.8, 0]}
      enableDamping
      dampingFactor={0.08}
      minDistance={2.0}
      maxDistance={32.0}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

export default function StudioScene({
  bedW,
  bedD,
  mode,
  light,
  loading,
  files,
  cityControls,
  buildings,
  onTarget,
  onTransform,
  frame,
}: {
  frame?: SceneFrame | null;
  buildings?: BuildingEditor;
  bedW: number;
  bedD: number;
  mode: GizmoMode | null;
  light: boolean;
  loading: boolean;
  files: ModelFile[];
  cityControls: CityControls;
  onTarget: (o: THREE.Object3D | null) => void;
  onTransform: (o: THREE.Object3D) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="relative h-full w-full">
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [7, 5.5, 9], fov: 40 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[6, 9, 4]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-6, 4, -5]} intensity={0.6} color="#c8cede" />
      <directionalLight position={[0, 2, -8]} intensity={0.45} color="#e8d9c4" />

      <Bed w={bedW} d={bedD} light={light} />

      {frame && (
        // Z-up millimetres → Y-up scene units; the top rail ends up at the back.
        <group position={frame.position} rotation={[-Math.PI / 2, 0, 0]} scale={MM}>
          <mesh geometry={frame.geometry} castShadow receiveShadow>
            <meshStandardMaterial color={frame.color} roughness={0.55} metalness={0.05} />
          </mesh>
          {frame.text && (
            <mesh geometry={frame.text.geometry} castShadow>
              <meshStandardMaterial color={frame.text.color} roughness={0.5} metalness={0.05} />
            </mesh>
          )}
        </group>
      )}

      {/* One render path — no placeholder→model swap. */}
      {loading ? (
        <Loader onLoading={setBusy} />
      ) : files.length > 0 ? (
        <Suspense fallback={<Loader onLoading={setBusy} />}>
          <CityAssembly
            key={files[0].url}
            files={files}
            mode={mode}
            controls={cityControls}
            buildings={buildings}
            onTarget={onTarget}
            onTransform={onTransform}
          />
        </Suspense>
      ) : (
        <PlaceholderTile mode={mode} onTarget={onTarget} onTransform={onTransform} />
      )}

      <StudioCameraControls />
    </Canvas>
    {busy && <LoadingOverlay />}
    </div>
  );
}
