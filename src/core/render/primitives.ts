import {
  FIDUCIAL_MODULES,
  bubbleCenters,
  fiducialCenters,
  idBits,
  idBubbleCenters,
} from "../layout";
import type { CardLayout } from "../types";

export type Primitive =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: "black" | "white" }
  | { kind: "circle"; cx: number; cy: number; r: number; fill?: "black"; strokeMm?: number }
  | {
      kind: "text";
      x: number;
      y: number;
      sizeMm: number;
      text: string;
      bold?: boolean;
      anchor?: "start" | "middle" | "end";
    };

export const BUBBLE_STROKE_MM = 0.5;

/**
 * Everything printed on a card, in card-space millimetres. The SVG and PDF renderers
 * both draw this list, so the two outputs cannot drift apart.
 */
export function cardPrimitives(layout: CardLayout): Primitive[] {
  const out: Primitive[] = [];
  const { sizeMm, insetMm } = layout.fiducial;
  const u = sizeMm / FIDUCIAL_MODULES;

  for (const [cx, cy] of fiducialCenters(layout)) {
    out.push({ kind: "rect", x: cx - 3.5 * u, y: cy - 3.5 * u, w: 7 * u, h: 7 * u, fill: "black" });
    out.push({ kind: "rect", x: cx - 2.5 * u, y: cy - 2.5 * u, w: 5 * u, h: 5 * u, fill: "white" });
    out.push({ kind: "rect", x: cx - 1.5 * u, y: cy - 1.5 * u, w: 3 * u, h: 3 * u, fill: "black" });
  }

  const textLeft = insetMm + sizeMm + 4;
  out.push({ kind: "text", x: textLeft, y: insetMm + 8, sizeMm: 8, text: layout.title, bold: true });
  if (layout.subtitle) {
    out.push({ kind: "text", x: textLeft, y: insetMm + 14, sizeMm: 4.2, text: layout.subtitle });
  }

  // Card ID: printed as text and as a strip of bubbles the decoder reads.
  const ids = idBubbleCenters(layout);
  const bits = idBits(layout);
  ids.forEach((b, i) => {
    out.push({ kind: "circle", cx: b.x, cy: b.y, r: b.r, strokeMm: BUBBLE_STROKE_MM, fill: bits[i] ? "black" : undefined });
  });
  const idRight = ids[ids.length - 1].x + ids[0].r;
  const idLeft = ids[0].x - ids[0].r;
  out.push({
    kind: "text",
    x: (idLeft + idRight) / 2,
    y: ids[0].y + ids[0].r + 5,
    sizeMm: 3.2,
    text: `CARD ${layout.id} v${layout.version}`,
    anchor: "middle",
  });

  for (const g of layout.groups) {
    const [ox, oy] = g.originMm;
    if (g.title) {
      out.push({ kind: "text", x: ox - g.radiusMm, y: oy - g.radiusMm - 9, sizeMm: 4.5, text: g.title, bold: true });
    }
    g.cols.forEach((col, j) => {
      out.push({
        kind: "text",
        x: ox + j * g.pitchMm[0],
        y: oy - g.radiusMm - 2.5,
        sizeMm: 3.6,
        text: g.colLabels?.[j] ?? col,
        bold: true,
        anchor: "middle",
      });
    });
    g.rows.forEach((row, i) => {
      out.push({
        kind: "text",
        x: ox - g.radiusMm - 2.5,
        y: oy + i * g.pitchMm[1] + 1.3,
        sizeMm: 3.8,
        text: g.rowLabels?.[i] ?? row,
        bold: true,
        anchor: "end",
      });
    });
  }
  for (const b of bubbleCenters(layout)) {
    out.push({ kind: "circle", cx: b.x, cy: b.y, r: b.r, strokeMm: BUBBLE_STROKE_MM });
  }

  return out;
}
