// OBJ + MTL for MakerLab's export: the host turns `format: "obj"` into a
// multi-plate, multi-colour 3MF (Exporting Models › OBJ → 3MF).
//
// - Units are millimetres, Z up (the printing convention). The host centres
//   each plate itself, so absolute XY doesn't matter.
// - Each colour region is its own `o` object with `usemtl`; materials carry
//   only Kd. One buffer per plate; the MTL is shared by all plates.

import type * as THREE from "three";

export type ObjPart = { name: string; geometry: THREE.BufferGeometry; color: string };

const enc = new TextEncoder();

const matName = (hex: string) => `c_${hex.replace("#", "").toUpperCase()}`;

const prettyName = (name: string) =>
  name
    .replace(/\.(glb|stl|obj)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase()) || "Part";

const num = (v: number) => {
  const s = v.toFixed(4);
  // Trim trailing zeros to keep files small: "12.5000" → "12.5", "3.0000" → "3".
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};

/** One plate as OBJ text bytes. */
function plateObj(parts: ObjPart[]): ArrayBuffer {
  const chunks: string[] = ["# City Generator\n", "mtllib model.mtl\n"];
  let base = 1; // OBJ indices are 1-based and global within the file
  const used = new Map<string, number>();
  for (const part of parts) {
    const pos = part.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos || pos.count === 0) continue;
    const label = prettyName(part.name);
    const n = (used.get(label) ?? 0) + 1;
    used.set(label, n);
    chunks.push(`o ${n > 1 ? `${label} ${n}` : label}\n`, `usemtl ${matName(part.color)}\n`);

    let lines: string[] = [];
    const flush = () => {
      if (lines.length) chunks.push(lines.join(""));
      lines = [];
    };
    for (let i = 0; i < pos.count; i++) {
      lines.push(`v ${num(pos.getX(i))} ${num(pos.getY(i))} ${num(pos.getZ(i))}\n`);
      if (lines.length >= 20000) flush();
    }
    const index = part.geometry.getIndex();
    const tri = index ? index.count / 3 : pos.count / 3;
    for (let t = 0; t < tri; t++) {
      const a = index ? index.getX(t * 3) : t * 3;
      const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      lines.push(`f ${a + base} ${b + base} ${c + base}\n`);
      if (lines.length >= 20000) flush();
    }
    flush();
    base += pos.count;
  }
  return enc.encode(chunks.join("")).buffer as ArrayBuffer;
}

function mtlFor(plates: ObjPart[][]): string {
  const colors = new Set(plates.flat().map((p) => p.color.toUpperCase()));
  return [...colors]
    .map((hex) => {
      const n = parseInt(hex.slice(1), 16);
      const kd = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255).toFixed(4)).join(" ");
      return `newmtl ${matName(hex)}\nKd ${kd}\n`;
    })
    .join("\n");
}

/** OBJ buffers (one per plate) plus the shared MTL text. */
export function buildObj(plates: ObjPart[][]): { buffers: ArrayBuffer[]; mtl: string } {
  const nonEmpty = plates.filter((p) => p.length);
  return { buffers: nonEmpty.map(plateObj), mtl: mtlFor(nonEmpty) };
}

/**
 * The Studio viewport as a cover image: a PNG data URL, scaled down so it
 * stays far under the host's 10 MB limit. The renderer keeps its drawing
 * buffer (preserveDrawingBuffer), so the capture isn't blank.
 */
export function captureCover(maxSize = 1024): string {
  const src = document.querySelector<HTMLCanvasElement>(".studio-viewport canvas");
  if (!src || !src.width || !src.height) return blankCover();
  const k = Math.min(1, maxSize / Math.max(src.width, src.height));
  const out = document.createElement("canvas");
  out.width = Math.round(src.width * k);
  out.height = Math.round(src.height * k);
  const ctx = out.getContext("2d");
  if (!ctx) return src.toDataURL("image/png");
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

function blankCover(): string {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#e9e6df";
  ctx.fillRect(0, 0, 256, 256);
  return c.toDataURL("image/png");
}
