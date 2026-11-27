// Shaped frames: a frame that follows the model's outline (round, heart,
// star, hexagon, triangle, a drawn outline) instead of a rectangle.
//
// The swept-profile builder in frame.ts needs every ring (the outline at one
// inset of the cross-section) to have the same number of points, in the same
// order, so ring i and ring i+1 stitch index for index. Here each ring is a
// true offset of the opening (Clipper, round joins — the outer edge gets soft
// corners, the opening keeps the model's exact outline), sampled along one
// fixed set of rays from a centre point. That works for any outline every ray
// crosses once (star-shaped); anything else falls back to a rectangle.

import * as THREE from "three";
import * as ClipperLib from "clipper-lib";

export type Pt = [number, number];

/** Clipper works in integers: 1/1000 mm. */
const Q = 1000;

const area2 = (p: Pt[]) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return a;
};

const ccw = (p: Pt[]) => (area2(p) < 0 ? p.slice().reverse() : p);

function areaCentroid(p: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return Math.abs(a) < 1e-9 ? p[0] : [cx / (3 * a), cy / (3 * a)];
}

/** Offsets a closed outline by `d` mm (out when positive, in when negative). Null if it breaks into pieces or vanishes. */
function offset(poly: Pt[], d: number): Pt[] | null {
  if (Math.abs(d) < 1e-6) return poly;
  const co = new ClipperLib.ClipperOffset(2, 0.02 * Q);
  co.AddPath(
    poly.map(([x, y]) => ({ X: Math.round(x * Q), Y: Math.round(y * Q) })),
    ClipperLib.JoinType.jtRound,
    ClipperLib.EndType.etClosedPolygon
  );
  const out: ClipperLib.Paths = [];
  co.Execute(out, d * Q);
  if (out.length !== 1 || out[0].length < 3) return null;
  return ccw(out[0].map((p) => [p.X / Q, p.Y / Q] as Pt));
}

const norm = (a: number) => {
  const t = a % (2 * Math.PI);
  return t < 0 ? t + 2 * Math.PI : t;
};

/**
 * The outline as seen from `c`, cleaned so its angle only ever grows — each
 * ray from c then crosses it once. Clipper's rounded corners carry hair-thin
 * zigzags from rounding to its integer grid; those points are dropped. Null
 * when the outline really turns back on itself (not visible whole from c).
 */
function starShaped(p: Pt[], c: Pt): Pt[] | null {
  const ang = p.map(([x, y]) => Math.atan2(y - c[1], x - c[0]));
  let start = 0;
  for (let i = 1; i < p.length; i++) if (norm(ang[i]) < norm(ang[start])) start = i;
  const out: Pt[] = [p[start]];
  let acc = 0; // angle swept so far
  let last = ang[start];
  for (let k = 1; k <= p.length; k++) {
    const i = (start + k) % p.length;
    let d = ang[i] - last;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    if (d <= 0) {
      if (d < -0.01) return null; // a real turn-back, not a rounding zigzag
      continue;
    }
    acc += d;
    last = ang[i];
    if (k < p.length) out.push(p[i]);
  }
  return Math.abs(acc - 2 * Math.PI) < 0.02 && out.length >= 3 ? out : null;
}

/** Where each ray (angle) from c leaves the outline. Assumes star-shaped. */
function sampleRays(p: Pt[], c: Pt, angles: number[]): THREE.Vector2[] {
  const out: (THREE.Vector2 | null)[] = new Array(angles.length).fill(null);
  const best = new Float64Array(angles.length);
  const first = (a: number) => {
    let lo = 0, hi = angles.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (angles[m] < a) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
  const hit = (k: number, a: Pt, b: Pt) => {
    const dx = Math.cos(angles[k]), dy = Math.sin(angles[k]);
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) return;
    const ax = a[0] - c[0], ay = a[1] - c[1];
    const t = (ax * ey - ay * ex) / den; // distance along the ray
    if (t <= 0 || t < best[k]) return;
    best[k] = t;
    out[k] = new THREE.Vector2(c[0] + dx * t, c[1] + dy * t);
  };
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const ta = norm(Math.atan2(a[1] - c[1], a[0] - c[0]));
    const tb = norm(Math.atan2(b[1] - c[1], b[0] - c[0]));
    // The edge covers angles ta → tb counter-clockwise (may wrap past 2π).
    const span = norm(tb - ta);
    const eps = 1e-9;
    if (ta + span <= 2 * Math.PI) {
      for (let k = first(ta - eps); k < angles.length && angles[k] <= ta + span + eps; k++) hit(k, a, b);
    } else {
      for (let k = first(ta - eps); k < angles.length; k++) hit(k, a, b);
      for (let k = 0; k < angles.length && angles[k] <= ta + span - 2 * Math.PI + eps; k++) hit(k, a, b);
    }
  }
  // A ray that slipped between two edges (exactly through a vertex) takes its neighbour's point.
  for (let k = 0; k < out.length; k++) {
    if (!out[k]) out[k] = (out[(k + out.length - 1) % out.length] ?? out[(k + 1) % out.length])?.clone() ?? new THREE.Vector2(c[0], c[1]);
  }
  return out as THREE.Vector2[];
}

export function pointInPoly(x: number, y: number, l: THREE.Vector2[]) {
  let inside = false;
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    if (l[i].y > y !== l[j].y > y && x < ((l[j].x - l[i].x) * (y - l[i].y)) / (l[j].y - l[i].y) + l[i].x) inside = !inside;
  }
  return inside;
}

export function distToPoly(x: number, y: number, l: THREE.Vector2[]) {
  let d = Infinity;
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const ax = l[j].x, ay = l[j].y, bx = l[i].x, by = l[i].y;
    const ex = bx - ax, ey = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)));
    d = Math.min(d, Math.hypot(x - ax - ex * t, y - ay - ey * t));
  }
  return d;
}

export type ShapedRings = {
  /** The ring at inset u from the outer edge (u = border is the opening). Same point count for every u. */
  ring: (u: number) => THREE.Vector2[] | null;
  /** Ray angle of each ring point, for texture coordinates. */
  angles: number[];
  /** Polar centre; ray k leaves it at angles[k]. */
  centre: Pt;
  /** Mean radius of the outer edge, to turn angles into millimetres along the rail. */
  radius: number;
  /** Ring index of the ray straight down / straight up from the centre (nameplate, hanger). */
  down: number;
  up: number;
};

/**
 * Rings for a frame whose opening is `outline` (frame mm, centred), widened by
 * `border` to the outer edge. Null when the outline can't be swept this way.
 */
export function shapedRings(outline: Pt[], border: number, step: number): ShapedRings | null {
  const raw = ccw(outline);
  const c = areaCentroid(raw);
  const opening = starShaped(raw, c);
  if (!opening) return null;
  const off = offset(opening, border);
  const outer = off && starShaped(off, c);
  if (!outer) return null;

  // Rays: evenly spread by the outer edge's length, plus one through every
  // corner of the opening (so the pocket keeps the model's exact corners),
  // plus straight down and up for the nameplate and the hanger.
  let perim = 0;
  let rSum = 0;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length];
    perim += Math.hypot(b[0] - a[0], b[1] - a[1]);
    rSum += Math.hypot(a[0] - c[0], a[1] - c[1]);
  }
  const n = Math.min(2400, Math.max(360, Math.ceil(perim / step)));
  const set = new Set<number>();
  for (let k = 0; k < n; k++) set.add(Math.round(((k / n) * 2 * Math.PI) * 1e7) / 1e7);
  for (const [x, y] of opening) set.add(Math.round(norm(Math.atan2(y - c[1], x - c[0])) * 1e7) / 1e7);
  set.add(Math.round(norm(-Math.PI / 2) * 1e7) / 1e7);
  set.add(Math.round((Math.PI / 2) * 1e7) / 1e7);
  const angles = [...set].sort((a, b) => a - b).filter((a, i, l) => i === 0 || a - l[i - 1] > 1e-6);
  const down = angles.indexOf(Math.round(norm(-Math.PI / 2) * 1e7) / 1e7);
  const up = angles.indexOf(Math.round((Math.PI / 2) * 1e7) / 1e7);

  const cache = new Map<number, THREE.Vector2[] | null>();
  const ring = (u: number) => {
    const key = Math.round(u * 1e4);
    if (!cache.has(key)) {
      const p = offset(opening, border - u);
      const clean = p && starShaped(p, c);
      cache.set(key, clean ? sampleRays(clean, c, angles) : null);
    }
    return cache.get(key)!;
  };
  return { ring, angles, centre: c, radius: rSum / outer.length, down, up };
}

/** Fits an outline (any units, any place) into a w × d box centred on the origin. */
export function fitOutline(outline: Pt[], w: number, d: number): Pt[] {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const sx = w / (maxX - minX || 1), sy = d / (maxY - minY || 1);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return outline.map(([x, y]) => [(x - cx) * sx, (y - cy) * sy]);
}

/** An outline that is just its bounding box (a square or rectangle area) — the classic frame fits it. */
export function isBoxOutline(outline: Pt[]): boolean {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return Math.abs(Math.abs(area2(outline)) / 2 - (maxX - minX) * (maxY - minY)) < 1e-6 * (maxX - minX) * (maxY - minY);
}

export { offset as offsetOutline };
