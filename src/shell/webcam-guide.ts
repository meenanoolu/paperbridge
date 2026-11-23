import { fiducialCenters, pageSizeMm, type CardLayout, type ScanResult } from "../core";

/**
 * Live alignment guide for the webcam. Pure: maps the latest decode to what the overlay
 * shows and what the status line says, so it is unit tested without a camera.
 */
export type GuideTone = "starting" | "searching" | "locked";

export interface GuideState {
  tone: GuideTone;
  /** All 4 corner markers were found in the latest frame. */
  locked: boolean;
  /** Short prompt for the visible status line and screen readers. */
  message: string;
}

export const ALIGN_PROMPT = "Align all 4 corner markers inside the frame.";

export function guideFor(result: ScanResult | null, streak: number): GuideState {
  if (!result) return { tone: "starting", locked: false, message: ALIGN_PROMPT };
  if (!result.ok) {
    if (result.reason === "HOMOGRAPHY_DEGENERATE")
      return { tone: "searching", locked: false, message: "Move closer so the card fills most of the frame." };
    if (result.reason === "CARD_ID_MISMATCH")
      return { tone: "searching", locked: false, message: "4 corners found, but this is a different PaperBridge card." };
    return { tone: "searching", locked: false, message: ALIGN_PROMPT };
  }
  if (streak === 0)
    return { tone: "locked", locked: true, message: "4/4 corners locked. Some marks are unclear: hold steady, or use this frame." };
  return { tone: "locked", locked: true, message: "4/4 corners locked. Hold steady..." };
}

export interface GuideGeometry {
  /** Guide rectangle in frame pixels, matching the card's aspect ratio. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Length of each corner bracket arm. */
  arm: number;
  stroke: number;
  /** SVG path drawing the 4 corner brackets. */
  path: string;
  /** Where each printed corner marker should sit (TL, TR, BR, BL), as squares in frame pixels. */
  targets: { x: number; y: number; size: number }[];
}

/** Card-shaped target centred in the frame, about 88% of the frame height. */
export function guideGeometry(frameW: number, frameH: number, layout: CardLayout): GuideGeometry {
  const { width: cw, height: ch } = pageSizeMm(layout);
  let h = frameH * 0.88;
  let w = (h * cw) / ch;
  if (w > frameW * 0.92) {
    w = frameW * 0.92;
    h = (w * ch) / cw;
  }
  const x = (frameW - w) / 2;
  const y = (frameH - h) / 2;
  const arm = Math.min(w, h) * 0.14;
  const stroke = Math.max(2, frameH * 0.012);
  const r = (n: number) => Math.round(n * 10) / 10;
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x + w, y + h, -1, -1],
    [x, y + h, 1, -1],
  ];
  const path = corners
    .map(([cx, cy, dx, dy]) => `M${r(cx + dx * arm)},${r(cy)} L${r(cx)},${r(cy)} L${r(cx)},${r(cy + dy * arm)}`)
    .join(" ");
  const k = w / cw;
  const size = layout.fiducial.sizeMm * k;
  const targets = fiducialCenters(layout).map(([fx, fy]) => ({ x: r(x + fx * k - size / 2), y: r(y + fy * k - size / 2), size: r(size) }));
  return { x, y, w, h, arm, stroke, path, targets };
}
