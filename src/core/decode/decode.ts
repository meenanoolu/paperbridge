import {
  BG_ANNULUS_FRAC,
  BG_PERCENTILE,
  BLANK_MAX,
  DARK_RATIO,
  EPS,
  FILLED_MIN,
  ID_FILL_MID,
  INNER_DISC_FRAC,
  LOCAL_WINDOW_FRAC,
  MIN_QUAD_AREA_FRAC,
} from "./constants";
import { findFiducialCandidates, labelComponents, pickAndOrderCorners, quadArea } from "./fiducials";
import { applyHomography, solveHomography, type Homography } from "./homography";
import { adaptiveDarkMask, sampleGray, toGray, type GrayImage } from "./image";
import { bubbleCenters, fiducialCenters, idBits, idBubbleCenters, type BubbleCenter } from "../layout";
import type { BubbleReading, BubbleState, CardLayout, RasterImage, ScanResult } from "../types";

// Sample offsets in units of the bubble radius, built once.
const INNER_OFFSETS: [number, number][] = (() => {
  const pts: [number, number][] = [[0, 0]];
  for (const [rf, n] of [
    [INNER_DISC_FRAC * 0.5, 6],
    [INNER_DISC_FRAC, 12],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      pts.push([rf * Math.cos(a), rf * Math.sin(a)]);
    }
  }
  return pts;
})();

const BG_OFFSETS: [number, number][] = (() => {
  const pts: [number, number][] = [];
  const n = 16;
  for (const rf of BG_ANNULUS_FRAC) {
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * (i + (rf === BG_ANNULUS_FRAC[0] ? 0 : 0.5))) / n;
      pts.push([rf * Math.cos(a), rf * Math.sin(a)]);
    }
  }
  return pts;
})();

function classify(fill: number): { state: BubbleState; confidence: number } {
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  if (fill >= FILLED_MIN) return { state: "filled", confidence: clamp01((fill - FILLED_MIN) / (0.9 - FILLED_MIN)) };
  if (fill <= BLANK_MAX) return { state: "blank", confidence: clamp01((BLANK_MAX - fill) / BLANK_MAX + 0.5) };
  const mid = (FILLED_MIN + BLANK_MAX) / 2;
  const half = (FILLED_MIN - BLANK_MAX) / 2;
  return { state: "ambiguous", confidence: 0.5 * clamp01(1 - Math.abs(fill - mid) / half) };
}

function measureBubble(g: GrayImage, H: Homography, b: BubbleCenter): number {
  let inner = 0;
  for (const [dx, dy] of INNER_OFFSETS) {
    const [px, py] = applyHomography(H, b.x + dx * b.r, b.y + dy * b.r);
    inner += sampleGray(g, px, py);
  }
  inner /= INNER_OFFSETS.length;

  const ring: number[] = [];
  for (const [dx, dy] of BG_OFFSETS) {
    const [px, py] = applyHomography(H, b.x + dx * b.r, b.y + dy * b.r);
    ring.push(sampleGray(g, px, py));
  }
  ring.sort((a, c) => a - c);
  const bg = ring[Math.min(ring.length - 1, Math.floor(BG_PERCENTILE * ring.length))];

  const fill = (bg - inner) / Math.max(bg, EPS);
  return Math.min(1, Math.max(0, fill));
}

/**
 * Decode a photo or frame of a card printed from `layout`.
 * Pure and deterministic: no randomness, no clock, no network.
 */
export function decode(image: RasterImage, layout: CardLayout): ScanResult {
  const gray = toGray(image);
  const { width: w, height: h } = gray;

  const half = Math.max(4, Math.round(LOCAL_WINDOW_FRAC * Math.max(w, h)));
  const mask = adaptiveDarkMask(gray, half, DARK_RATIO);
  const candidates = findFiducialCandidates(labelComponents(mask, w, h), w, h);
  const corners = pickAndOrderCorners(candidates);
  if (!corners) return { ok: false, reason: "FIDUCIALS_NOT_FOUND" };
  if (quadArea(corners) < MIN_QUAD_AREA_FRAC * w * h) return { ok: false, reason: "HOMOGRAPHY_DEGENERATE" };

  const H = solveHomography(fiducialCenters(layout), corners);
  if (!H) return { ok: false, reason: "HOMOGRAPHY_DEGENERATE" };

  // Card ID: the printed bubble strip must match this layout's checksum.
  const expected = idBits(layout);
  const idReads = idBubbleCenters(layout).map((b) => measureBubble(gray, H, b));
  // The ID bubbles are small, so they are read with a single midpoint threshold instead of
  // the three-state rule. A wrong card flips about half of the bits, so this still rejects it.
  for (let i = 0; i < expected.length; i++) {
    if ((idReads[i] >= ID_FILL_MID) !== expected[i]) return { ok: false, reason: "CARD_ID_MISMATCH" };
  }

  const bubbles: BubbleReading[] = bubbleCenters(layout).map((b) => {
    const fill = measureBubble(gray, H, b);
    const { state, confidence } = classify(fill);
    return {
      group: b.group,
      row: b.row,
      col: b.col,
      state,
      confidence: round3(confidence),
      fill: round3(fill),
    };
  });

  return {
    ok: true,
    cardId: layout.id,
    layoutVersion: layout.version,
    bubbles,
    fiducials: corners.map(([x, y]) => [round3(x), round3(y)] as [number, number]),
  };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
