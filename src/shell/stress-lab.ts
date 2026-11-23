import { decode, renderCardRaster, type CardLayout, type RasterImage, type ScanResult, type SynthOptions } from "../core";

/**
 * Optical Stress-Test Lab: render a sample card with known marks, distort it (tilt, dim light and
 * shadow, faint pen), and run the real decoder on the pixels. Because the truth is known, every
 * bubble can be scored: correct, unclear (sent to a person), or wrong. Pure apart from the clock.
 */
export interface StressSettings {
  /** Card tilt in degrees, -8..8. */
  tiltDeg: number;
  /** Dim lighting and shadow, 0 (bright, even) .. 1 (half brightness, 45% gradient, 40% shadow). */
  dim: number;
  /** Pen faintness, 0 (dark pen) .. 1 (very light marks). */
  faint: number;
}

export const TILT_LIMIT_DEG = 8;
/** Darkness of a pen mark at faintness 0 and at faintness 1 (measured: below ~0.3 a mark reads as blank). */
export const MARK_DARKNESS_RANGE: [number, number] = [0.88, 0.3];

export function markDarkness(faint: number): number {
  const f = Math.min(1, Math.max(0, faint));
  return MARK_DARKNESS_RANGE[0] - f * (MARK_DARKNESS_RANGE[0] - MARK_DARKNESS_RANGE[1]);
}

/** The simulated camera for these settings. Deterministic (fixed noise seed). */
export function stressCamera(s: StressSettings): SynthOptions {
  const dim = Math.min(1, Math.max(0, s.dim));
  return {
    rotationDeg: Math.min(TILT_LIMIT_DEG, Math.max(-TILT_LIMIT_DEG, s.tiltDeg)),
    scale: 1.5,
    brightness: 1 - 0.5 * dim,
    gradient: { angleRad: 0.6, strength: 0.45 * dim },
    blob: { x: 0.65, y: 0.4, sigma: 0.22, strength: 0.4 * dim },
    noiseSigma: 3,
    seed: 7,
    markDarkness: markDarkness(s.faint),
  };
}

export interface StressCounts {
  /** Read exactly as marked (filled or blank). */
  correct: number;
  /** Reported as unclear for a person to check: never counted. */
  unclear: number;
  /** A blank read as filled. */
  falseFilled: number;
  /** A mark read as blank (only when a mark is fainter than the lab's range). */
  missed: number;
  total: number;
}

export interface StressRun {
  raster: RasterImage;
  result: ScanResult;
  decodeMs: number;
  counts: StressCounts | null;
}

export function scoreBubbles(result: ScanResult, filled: ReadonlySet<string>): StressCounts | null {
  if (!result.ok) return null;
  const c: StressCounts = { correct: 0, unclear: 0, falseFilled: 0, missed: 0, total: result.bubbles.length };
  for (const b of result.bubbles) {
    const truth = filled.has(`${b.group}/${b.row}/${b.col}`);
    if (b.state === "ambiguous") c.unclear++;
    else if ((b.state === "filled") === truth) c.correct++;
    else if (truth) c.missed++;
    else c.falseFilled++;
  }
  return c;
}

export function runStressTest(layout: CardLayout, filled: string[], s: StressSettings, now: () => number = () => performance.now()): StressRun {
  const set = new Set(filled);
  const raster = renderCardRaster(layout, set, stressCamera(s));
  const t0 = now();
  const result = decode(raster, layout);
  const decodeMs = now() - t0;
  return { raster, result, decodeMs, counts: scoreBubbles(result, set) };
}
