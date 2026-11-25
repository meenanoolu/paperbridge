import { applyHomography, bubbleCenters, decode, fiducialCenters, solveHomography, type CardLayout, type RasterImage, type ScanResult, type SuccessfulScan } from "../core";

/**
 * Card-ID routing. Every PaperBridge card prints a card-ID strip, and `decode` only succeeds for
 * the layout whose ID matches, so trying each registered app's layouts finds the right app with
 * no app-specific code. Pure apart from the injectable clock.
 *
 * Paper sizes: the A4 and Letter prints of one card share a card ID, and the decoder can lock
 * onto either for the same photo (the corner markers do not reveal the paper size). The wrong
 * paper misplaces bubbles by a few mm. Unclear-mark counts alone can be fooled: on a card with
 * widely spaced bubbles (Seance Cipher) the misplaced sample points land on blank paper and read
 * as confident blanks. So the first signal is ring alignment: how dark the photo is exactly on each
 * layout's printed bubble rings compared with just outside them. Read-only: it uses the decoder's
 * corner markers and never changes a reading. Measured on 98 photos (3 apps, 7 cameras, 2 papers):
 * the printed paper always scores higher, by at least 0.83 on a 0..1 scale.
 */
export interface RoutableApp {
  id: string;
  label: string;
  layouts: CardLayout[];
}

/** Lower is better: unclear marks first, then mean confidence. */
export function fitScore(result: SuccessfulScan): [number, number] {
  const unclear = result.bubbles.filter((b) => b.state === "ambiguous").length;
  const meanConfidence = result.bubbles.reduce((s, b) => s + b.confidence, 0) / Math.max(1, result.bubbles.length);
  return [unclear, -meanConfidence];
}

/** Ring scores closer than this are treated as a tie, and the unclear-mark rule decides. */
export const RING_TIE = 0.1;

const lum = (img: RasterImage, x: number, y: number) => {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= img.width || py >= img.height) return NaN;
  const i = (py * img.width + px) * 4;
  return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
};

/**
 * Mean ring contrast, about 1 when the layout's printed rings sit exactly on dark pixels and about
 * 0 when they land on plain paper. NaN if it cannot be measured.
 */
export function ringAlignment(img: RasterImage, result: SuccessfulScan, layout: CardLayout): number {
  const H = result.fiducials.length === 4 ? solveHomography(fiducialCenters(layout), result.fiducials) : null;
  if (!H) return NaN;
  const at = (x: number, y: number) => {
    const [px, py] = applyHomography(H, x, y);
    return lum(img, px, py);
  };
  let sum = 0;
  let n = 0;
  for (const b of bubbleCenters(layout))
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * 2 * Math.PI;
      const c = Math.cos(a);
      const d = Math.sin(a);
      // The printed stroke is 0.5 mm: take the darkest of 3 radii across it.
      const ring = Math.min(...[-0.35, 0, 0.35].map((e) => at(b.x + c * (b.r + e), b.y + d * (b.r + e))));
      const out = at(b.x + c * (b.r + 1.6), b.y + d * (b.r + 1.6));
      if (Number.isFinite(ring) && Number.isFinite(out) && out > 0) {
        sum += (out - ring) / out;
        n++;
      }
    }
  return n ? sum / n : NaN;
}

const better = (a: SuccessfulScan, b: SuccessfulScan) => {
  const [ua, ca] = fitScore(a);
  const [ub, cb] = fitScore(b);
  return ua < ub || (ua === ub && ca < cb);
};

/**
 * Decode against each accepted layout variant and keep the best-fitting success (see above).
 * Returns the first failure if none decode; stops early when the corner markers are missing,
 * because that fails the same way for every layout.
 */
export function decodeBestFit(raster: RasterImage, layouts: CardLayout[]): { result: ScanResult; layout: CardLayout } {
  let best: { result: SuccessfulScan; layout: CardLayout; ring: number } | null = null;
  let firstFailure: { result: ScanResult; layout: CardLayout } | null = null;
  for (const layout of layouts) {
    const result = decode(raster, layout);
    if (result.ok) {
      const ring = ringAlignment(raster, result, layout);
      const decisive = Number.isFinite(ring) && best && Number.isFinite(best.ring) && Math.abs(ring - best.ring) >= RING_TIE;
      if (!best || (decisive ? ring > best.ring : better(result, best.result))) best = { result, layout, ring };
      continue;
    }
    if (result.reason === "FIDUCIALS_NOT_FOUND") return best ? { result: best.result, layout: best.layout } : { result, layout };
    firstFailure ??= { result, layout };
  }
  return best ? { result: best.result, layout: best.layout } : firstFailure!;
}

export type RouteFailure = "FIDUCIALS_NOT_FOUND" | "HOMOGRAPHY_DEGENERATE" | "UNKNOWN_CARD";

export type RouteResult<A extends RoutableApp = RoutableApp> =
  | { ok: true; app: A; layout: CardLayout; result: SuccessfulScan; decodeMs: number }
  | { ok: false; reason: RouteFailure; decodeMs: number };

export const ROUTE_ERROR_TEXT: Record<RouteFailure, string> = {
  FIDUCIALS_NOT_FOUND: "Could not find all 4 black corner squares. Make sure the whole card is in the photo.",
  HOMOGRAPHY_DEGENERATE: "The card is too small or too skewed in the photo. Take it closer and face-on.",
  UNKNOWN_CARD: "Not a card from any app here (unknown card ID). Check that it was printed from PaperBridge.",
};

/** The app that printed a card, by card ID. Null if no registered app owns it. */
export function appForCardId<A extends RoutableApp>(cardId: string, apps: A[]): A | null {
  return apps.find((a) => a.layouts.some((l) => l.id === cardId)) ?? null;
}

/** Find which app a photo belongs to and decode it with that app's best-fitting layout. */
export function routeRaster<A extends RoutableApp>(
  raster: RasterImage,
  apps: A[],
  clock: () => number = () => performance.now(),
): RouteResult<A> {
  const t0 = clock();
  let reason: RouteFailure = "UNKNOWN_CARD";
  for (const app of apps) {
    if (app.layouts.length === 0) continue;
    const { result, layout } = decodeBestFit(raster, app.layouts);
    if (result.ok) return { ok: true, app, layout, result, decodeMs: clock() - t0 };
    if (result.reason === "FIDUCIALS_NOT_FOUND") return { ok: false, reason: "FIDUCIALS_NOT_FOUND", decodeMs: clock() - t0 };
    if (result.reason === "HOMOGRAPHY_DEGENERATE") reason = "HOMOGRAPHY_DEGENERATE";
  }
  return { ok: false, reason, decodeMs: clock() - t0 };
}
