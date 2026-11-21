import {
  CONCENTRIC_TOLERANCE,
  MAX_FIDUCIAL_FRAC,
  MAX_FIDUCIAL_SIZE_SPREAD,
  MAX_TILT_DEG,
  MIN_BLOB_SOLIDITY,
  MIN_COMPONENT_AREA,
  RING_BLOB_AREA_RATIO,
} from "./constants";

export interface Component {
  area: number;
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface FiducialCandidate {
  x: number;
  y: number;
  /** sqrt of the outer ring's pixel area. Used to rank and sanity-check candidates. */
  size: number;
}

/** 4-connected component labelling (two-pass, union-find). Centroids use pixel centres at +0.5. */
export function labelComponents(mask: Uint8Array, w: number, h: number): Component[] {
  const labels = new Int32Array(w * h);
  const parent: number[] = [0];
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const left = x > 0 ? labels[i - 1] : 0;
      const up = y > 0 ? labels[i - w] : 0;
      if (!left && !up) {
        labels[i] = parent.length;
        parent.push(parent.length);
      } else if (left && up) {
        const a = find(left);
        const b = find(up);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
        labels[i] = Math.min(a, b);
      } else {
        labels[i] = left || up;
      }
    }
  }
  const byRoot = new Map<number, Component>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = labels[y * w + x];
      if (!l) continue;
      const r = find(l);
      let c = byRoot.get(r);
      if (!c) {
        c = { area: 0, cx: 0, cy: 0, minX: x, maxX: x, minY: y, maxY: y };
        byRoot.set(r, c);
      }
      c.area++;
      c.cx += x + 0.5;
      c.cy += y + 0.5;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
    }
  }
  const out: Component[] = [];
  for (const c of byRoot.values()) {
    if (c.area < MIN_COMPONENT_AREA) continue;
    c.cx /= c.area;
    c.cy /= c.area;
    out.push(c);
  }
  return out;
}

/**
 * A fiducial is a dark square ring with a dark solid square exactly in its middle.
 * The signature is two dark components with the same centroid and an area ratio near 24:9.
 */
export function findFiducialCandidates(components: Component[], w: number, h: number): FiducialCandidate[] {
  const maxSize = MAX_FIDUCIAL_FRAC * Math.min(w, h);
  const sorted = [...components].sort((a, b) => b.area - a.area);
  const found: FiducialCandidate[] = [];
  const used = new Set<Component>();
  for (const ring of sorted) {
    const ringSize = Math.sqrt(ring.area);
    if (ringSize > maxSize) continue;
    for (const blob of sorted) {
      if (blob === ring || used.has(blob) || blob.area >= ring.area) continue;
      const ratio = ring.area / blob.area;
      if (ratio < RING_BLOB_AREA_RATIO[0] || ratio > RING_BLOB_AREA_RATIO[1]) continue;
      if (Math.hypot(ring.cx - blob.cx, ring.cy - blob.cy) > CONCENTRIC_TOLERANCE * ringSize) continue;
      const bw = blob.maxX - blob.minX + 1;
      const bh = blob.maxY - blob.minY + 1;
      if (blob.area / (bw * bh) < MIN_BLOB_SOLIDITY) continue;
      // The blob must sit inside the ring's bounding box.
      if (blob.minX < ring.minX || blob.maxX > ring.maxX || blob.minY < ring.minY || blob.maxY > ring.maxY) continue;
      used.add(blob);
      // The solid centre square gives the most stable centre; the ring can be clipped by shadows.
      found.push({ x: blob.cx, y: blob.cy, size: ringSize });
      break;
    }
  }
  return found;
}

/**
 * Pick the four fiducials and order them TL, TR, BR, BL.
 * Returns null if there are fewer than four plausible candidates.
 */
export function pickAndOrderCorners(cands: FiducialCandidate[]): [number, number][] | null {
  if (cands.length < 4) return null;
  const top = [...cands].sort((a, b) => b.size - a.size).slice(0, 4);
  const sizes = top.map((c) => c.size);
  if (Math.max(...sizes) / Math.min(...sizes) > MAX_FIDUCIAL_SIZE_SPREAD) return null;

  const mx = top.reduce((s, c) => s + c.x, 0) / 4;
  const my = top.reduce((s, c) => s + c.y, 0) / 4;
  // Image y points down, so increasing atan2 angle runs clockwise on screen.
  const cw = [...top].sort((a, b) => Math.atan2(a.y - my, a.x - mx) - Math.atan2(b.y - my, b.x - mx));

  // Four cyclic starts are possible. TL is the start whose TL->TR edge points closest to "right".
  let best = 0;
  let bestAngle = Infinity;
  for (let k = 0; k < 4; k++) {
    const a = cw[k];
    const b = cw[(k + 1) % 4];
    const angle = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
    if (angle < bestAngle) {
      bestAngle = angle;
      best = k;
    }
  }
  if (bestAngle > MAX_TILT_DEG) return null;
  return [0, 1, 2, 3].map((i) => {
    const c = cw[(best + i) % 4];
    return [c.x, c.y] as [number, number];
  });
}

/** Shoelace area of a quad given as 4 points in order. */
export function quadArea(p: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % 4];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}
