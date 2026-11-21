import {
  FIDUCIAL_MODULES,
  bubbleKey,
  fiducialCenters,
  idBits,
  idBubbleCenters,
  pageSizeMm,
  type BubbleCenter,
} from "../layout";
import { BUBBLE_STROKE_MM } from "../render/primitives";
import type { CardLayout, RasterImage } from "../types";

/** Pixels per millimetre at scale 1. */
export const NOMINAL_PX_PER_MM = 2;

export interface SynthOptions {
  /** Card rotation in degrees (clockwise on screen). Default 0. */
  rotationDeg?: number;
  /** Resolution multiplier relative to NOMINAL_PX_PER_MM. Default 1. */
  scale?: number;
  /** Perspective strength per axis, e.g. 0.1 means the frame edge is about 10% nearer/farther. */
  perspective?: [number, number];
  /** Smooth lighting gradient: darkest side is `1 - strength` of the brightest. */
  gradient?: { angleRad: number; strength: number };
  /** Soft round shadow in frame fractions (0..1). Multiplies light by `1 - strength` at its centre. */
  blob?: { x: number; y: number; sigma: number; strength: number };
  /** Overall light level 0..1. Default 1. */
  brightness?: number;
  /** Additive noise standard deviation in grey levels. Default 0. */
  noiseSigma?: number;
  /** Seed for the noise generator. */
  seed?: number;
  /** Indices (0 TL, 1 TR, 2 BR, 3 BL) of fiducials to leave unprinted. */
  omitFiducials?: number[];
  /** Extra frame margin around the rotated card in mm. Default 10. */
  marginMm?: number;
  /** Mark darkness 0..1 (1 is solid black). Default 0.88. */
  markDarkness?: number;
}

const PAPER = 0.92;
const DESK = 0.32;
const INK = 0.05;

/** Small seeded PRNG (mulberry32), so noise is reproducible from the seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Grid {
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  nr: number;
  nc: number;
  r: number;
  /** filled[i * nc + j] */
  filled: Uint8Array;
}

function buildGrids(layout: CardLayout, filled: ReadonlySet<string>): Grid[] {
  const grids: Grid[] = [];
  for (const g of layout.groups) {
    const f = new Uint8Array(g.rows.length * g.cols.length);
    g.rows.forEach((row, i) => g.cols.forEach((col, j) => (f[i * g.cols.length + j] = filled.has(bubbleKey(g.key, row, col)) ? 1 : 0)));
    grids.push({ ox: g.originMm[0], oy: g.originMm[1], dx: g.pitchMm[0], dy: g.pitchMm[1], nr: g.rows.length, nc: g.cols.length, r: g.radiusMm, filled: f });
  }
  const ids: BubbleCenter[] = idBubbleCenters(layout);
  const bits = idBits(layout);
  grids.push({
    ox: ids[0].x,
    oy: ids[0].y,
    dx: ids[1].x - ids[0].x,
    dy: 0,
    nr: 1,
    nc: ids.length,
    r: ids[0].r,
    filled: Uint8Array.from(bits, (b) => (b ? 1 : 0)),
  });
  return grids;
}

/**
 * Rasterise a card with the given bubbles filled, then apply a camera-like transform:
 * rotation, scale, perspective, lighting gradient, soft shadow, noise.
 * Used by property tests and by the sample-card generator. Deterministic for a given seed.
 */
export function renderCardRaster(layout: CardLayout, filled: ReadonlySet<string>, opts: SynthOptions = {}): RasterImage {
  const { width: cw, height: ch } = pageSizeMm(layout);
  const grids = buildGrids(layout, filled);
  const fids = fiducialCenters(layout);
  const u = layout.fiducial.sizeMm / FIDUCIAL_MODULES;
  const omit = new Set(opts.omitFiducials ?? []);
  const markAlbedo = 1 - (opts.markDarkness ?? 0.88);
  const strokeHalf = BUBBLE_STROKE_MM / 2;

  const albedoAt = (mx: number, my: number): number => {
    for (let k = 0; k < 4; k++) {
      if (omit.has(k)) continue;
      const d = Math.max(Math.abs(mx - fids[k][0]), Math.abs(my - fids[k][1]));
      if (d <= 1.5 * u) return INK;
      if (d <= 2.5 * u) return PAPER;
      if (d <= 3.5 * u) return INK;
    }
    for (let gi = 0; gi < grids.length; gi++) {
      const g = grids[gi];
      const j = g.dx > 0 ? Math.round((mx - g.ox) / g.dx) : 0;
      const i = g.dy > 0 ? Math.round((my - g.oy) / g.dy) : 0;
      if (i < 0 || j < 0 || i >= g.nr || j >= g.nc) continue;
      const dist = Math.hypot(mx - (g.ox + j * g.dx), my - (g.oy + i * g.dy));
      if (dist <= 0.9 * g.r && g.filled[i * g.nc + j]) return gi === grids.length - 1 ? INK : markAlbedo;
      if (Math.abs(dist - g.r) <= strokeHalf) return INK;
    }
    return PAPER;
  };

  return photographSurface(cw, ch, (mx, my, rgb) => {
    const a = albedoAt(mx, my);
    rgb[0] = a;
    rgb[1] = a;
    rgb[2] = a;
  }, opts);
}

/** Writes the surface colour (0..1 per channel) at card position (mx, my) mm into `rgb`. */
export type SurfaceSampler = (mx: number, my: number, rgb: Float64Array) => void;

export interface CameraOptions
  extends Pick<
    SynthOptions,
    "rotationDeg" | "scale" | "perspective" | "gradient" | "blob" | "brightness" | "noiseSigma" | "seed" | "marginMm"
  > {
  /** Colour of the surface around the card (0..1 RGB). Default neutral grey. */
  background?: [number, number, number];
  /** Colour of the light (0..1 RGB), e.g. warm indoor light. Default white. */
  lightColor?: [number, number, number];
}

/**
 * Simulated camera: views a card of `cw` x `ch` mm through rotation, scale and perspective,
 * then applies uneven lighting, a soft shadow and sensor noise. Deterministic for a given seed.
 * `sample` is only called for points on the card.
 */
export function photographSurface(cw: number, ch: number, sample: SurfaceSampler, opts: CameraOptions = {}): RasterImage {
  const rot = ((opts.rotationDeg ?? 0) * Math.PI) / 180;
  const scale = opts.scale ?? 1;
  const pxmm = NOMINAL_PX_PER_MM * scale;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  // Perspective magnifies the near side, so widen the frame enough to keep the whole card in view.
  const persp = Math.max(Math.abs(opts.perspective?.[0] ?? 0), Math.abs(opts.perspective?.[1] ?? 0));
  const margin = (opts.marginMm ?? 10) + persp * 2 * Math.max(cw, ch);

  // Frame size: bounding box of the rotated card plus a margin.
  const bbW = Math.abs(cw * cos) + Math.abs(ch * sin) + 2 * margin;
  const bbH = Math.abs(cw * sin) + Math.abs(ch * cos) + 2 * margin;
  const W = Math.ceil(bbW * pxmm);
  const H = Math.ceil(bbH * pxmm);

  const gx = (opts.perspective?.[0] ?? 0) / (W / 2);
  const gy = (opts.perspective?.[1] ?? 0) / (H / 2);
  const brightness = opts.brightness ?? 1;
  const noise = opts.noiseSigma ?? 0;
  const rand = mulberry32(opts.seed ?? 1);
  const ss = pxmm >= 3 ? 1 : 2;
  const grad = opts.gradient;
  const gdx = grad ? Math.cos(grad.angleRad) : 0;
  const gdy = grad ? Math.sin(grad.angleRad) : 0;
  const blob = opts.blob;
  const bg = opts.background ?? [DESK, DESK, DESK];
  const light = opts.lightColor ?? [1, 1, 1];

  const out = new Uint8ClampedArray(W * H * 4);
  const cx = W / 2;
  const cy = H / 2;
  const mcx = cw / 2;
  const mcy = ch / 2;
  const inv = 1 / pxmm;
  const rgb = new Float64Array(3);
  const acc = new Float64Array(3);

  const lightAt = (px: number, py: number): number => {
    let l = brightness;
    if (grad) {
      const t = 0.5 + ((px / W - 0.5) * gdx + (py / H - 0.5) * gdy) / (2 * 0.7072);
      l *= 1 - grad.strength * Math.min(1, Math.max(0, t));
    }
    if (blob) {
      const dx = px / W - blob.x;
      const dy = py / H - blob.y;
      l *= 1 - blob.strength * Math.exp(-(dx * dx + dy * dy) / (2 * blob.sigma * blob.sigma));
    }
    return l;
  };

  // Inverse transform: pixel -> card mm.  q = p' / (1 - g.p'),  m = c + R^-1 q / pxmm
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      acc[0] = acc[1] = acc[2] = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const ppx = x + (sx + 0.5) / ss - cx;
          const ppy = y + (sy + 0.5) / ss - cy;
          const k = 1 / (1 - (gx * ppx + gy * ppy));
          const qx = ppx * k * inv;
          const qy = ppy * k * inv;
          // R^-1 for a clockwise-on-screen rotation by `rot`.
          const mx = mcx + qx * cos + qy * sin;
          const my = mcy - qx * sin + qy * cos;
          if (mx < 0 || my < 0 || mx > cw || my > ch) {
            rgb[0] = bg[0];
            rgb[1] = bg[1];
            rgb[2] = bg[2];
          } else {
            sample(mx, my, rgb);
          }
          acc[0] += rgb[0];
          acc[1] += rgb[1];
          acc[2] += rgb[2];
        }
      }
      const l = (lightAt(x + 0.5, y + 0.5) * 255) / (ss * ss);
      // Sum of 3 uniforms: cheap, roughly Gaussian luminance noise shared by all channels.
      const n = noise > 0 ? noise * (rand() + rand() + rand() - 1.5) * 2 : 0;
      const o = (y * W + x) * 4;
      out[o] = acc[0] * l * light[0] + n;
      out[o + 1] = acc[1] * l * light[1] + n;
      out[o + 2] = acc[2] * l * light[2] + n;
      out[o + 3] = 255;
    }
  }
  return { width: W, height: H, data: out };
}
