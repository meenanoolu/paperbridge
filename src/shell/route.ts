import { decode, type CardLayout, type RasterImage, type ScanResult, type SuccessfulScan } from "../core";

/**
 * Card-ID routing. Every PaperBridge card prints a card-ID strip, and `decode` only succeeds for
 * the layout whose ID matches, so trying each registered app's layouts finds the right app with
 * no app-specific code. Pure apart from the injectable clock.
 *
 * Paper sizes: the A4 and Letter prints of one card share a card ID, and the decoder can lock
 * onto either for the same photo (the corner markers do not reveal the paper size). The wrong
 * paper misplaces bubbles by a few mm, which always shows up as extra unclear marks (measured on
 * 50 sample photos: 1 to 7 more), so among successful variants we keep the best fit.
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
  let best: { result: SuccessfulScan; layout: CardLayout } | null = null;
  let firstFailure: { result: ScanResult; layout: CardLayout } | null = null;
  for (const layout of layouts) {
    const result = decode(raster, layout);
    if (result.ok) {
      if (!best || better(result, best.result)) best = { result, layout };
      continue;
    }
    if (result.reason === "FIDUCIALS_NOT_FOUND") return best ?? { result, layout };
    firstFailure ??= { result, layout };
  }
  return best ?? firstFailure!;
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
