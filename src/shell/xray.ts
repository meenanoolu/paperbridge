import { bubbleCenters, bubbleKey, fiducialCenters, type CardLayout, type ScanResult } from "../core";

/**
 * Optical X-Ray: a read-only view of exactly what the decoder measured. Everything comes from
 * the existing decode result (corner-marker centres in image pixels, each bubble's centre, ink
 * density `fill` and state). Nothing is re-measured or re-classified, so the X-Ray can never
 * disagree with the decoder. Pure, for tests and for any app.
 */
export type XRayState = "filled" | "unclear" | "blank";

export interface XRayCorner {
  name: "top-left" | "top-right" | "bottom-right" | "bottom-left";
  x: number;
  y: number;
  /** Side of the lock-on box in image pixels (the marker's printed size at this scale). */
  size: number;
}

export interface XRayBubble {
  key: string;
  x: number;
  y: number;
  /** Ring radius in image pixels. */
  r: number;
  state: XRayState;
  /** Ink density 0..1 exactly as the decoder measured it. */
  density: number;
  /** "0.84". */
  score: string;
}

export interface XRayModel {
  corners: XRayCorner[];
  bubbles: XRayBubble[];
  counts: Record<XRayState, number>;
  /** Image pixels per card millimetre, from the corner markers. */
  pxPerMm: number;
}

const CORNERS: XRayCorner["name"][] = ["top-left", "top-right", "bottom-right", "bottom-left"];
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const xrayState = (s: "filled" | "blank" | "ambiguous"): XRayState => (s === "ambiguous" ? "unclear" : s);
export const xrayScore = (density: number) => density.toFixed(2);

/** Null for a failed decode: no corners were locked, so there is nothing to show. */
export function xrayModel(result: ScanResult, layout: CardLayout): XRayModel | null {
  if (!result.ok || result.fiducials.length !== 4) return null;
  const mm = fiducialCenters(layout);
  const f = result.fiducials;
  // Average the 4 sides: perspective makes them differ a little.
  const sides = [0, 1, 2, 3].map((i) => dist(f[i], f[(i + 1) % 4]) / Math.max(1e-9, dist(mm[i], mm[(i + 1) % 4])));
  const pxPerMm = sides.reduce((a, b) => a + b, 0) / 4;
  const radius = new Map(bubbleCenters(layout).map((b) => [bubbleKey(b.group, b.row, b.col), b.r]));
  const counts: Record<XRayState, number> = { filled: 0, unclear: 0, blank: 0 };
  const bubbles = result.bubbles.map((b) => {
    const key = bubbleKey(b.group, b.row, b.col);
    const state = xrayState(b.state);
    counts[state]++;
    return { key, x: b.at[0], y: b.at[1], r: (radius.get(key) ?? 5) * pxPerMm, state, density: b.fill, score: xrayScore(b.fill) };
  });
  const size = layout.fiducial.sizeMm * pxPerMm;
  return { corners: f.map(([x, y], i) => ({ name: CORNERS[i], x, y, size })), bubbles, counts, pxPerMm };
}

/** One sentence for screen readers and the caption. */
export function xraySummary(m: XRayModel): string {
  const range = (s: XRayState) => {
    const d = m.bubbles.filter((b) => b.state === s).map((b) => b.density);
    return d.length ? ` (${xrayScore(Math.min(...d))}-${xrayScore(Math.max(...d))})` : "";
  };
  return `4 corner markers locked. ${m.counts.filled} filled${range("filled")}, ${m.counts.unclear} unclear${range("unclear")}, ${m.counts.blank} blank${range("blank")}. Scores are ink density from 0 (empty) to 1 (solid).`;
}

/** High-contrast colours: each ring also has its own dash pattern and a label, never colour alone. */
export const XRAY_STYLE: Record<XRayState, { ring: string; dash?: string; label: string; text: string }> = {
  filled: { ring: "#22c55e", label: "#052e16", text: "#ffffff" },
  unclear: { ring: "#f59e0b", dash: "5 3", label: "#451a03", text: "#ffffff" },
  blank: { ring: "#94a3b8", dash: "1.5 2.5", label: "#0f172a", text: "#ffffff" },
};
export const XRAY_LOCK = "#22c55e";

/** A colour set for the overlay, so an app can theme it (e.g. Seance Cipher's glowing runes). */
export interface XRayPalette {
  lock: string;
  styles: typeof XRAY_STYLE;
  /** Soft glow around rings and lock-on boxes. */
  glow?: boolean;
}
export const DEFAULT_XRAY_PALETTE: XRayPalette = { lock: XRAY_LOCK, styles: XRAY_STYLE };
