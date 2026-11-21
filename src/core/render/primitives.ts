import {
  FIDUCIAL_MODULES,
  bubbleCenters,
  fiducialCenters,
  idBits,
  idBubbleCenters,
} from "../layout";
import type { CardLayout } from "../types";

export type Primitive =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: "black" | "white" | "band" }
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
/** Grey level of alternate-row bands (0 black, 1 white). Light enough to never look like a mark. */
export const BAND_GREY = 0.93;
const LINE_HEIGHT = 1.15;

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

  const k = layout.labelScale ?? 1;
  // Bands go first so everything else is drawn on top.
  for (const g of layout.groups) {
    if (!g.bands) continue;
    g.rows.forEach((_, i) => {
      if (i % 2 === 1) return;
      const cy = g.originMm[1] + i * g.pitchMm[1];
      out.push({ kind: "rect", x: g.bands!.fromXMm, y: cy - g.pitchMm[1] / 2, w: g.bands!.toXMm - g.bands!.fromXMm, h: g.pitchMm[1], fill: "band" });
    });
  }

  for (const g of layout.groups) {
    const [ox, oy] = g.originMm;
    const colSize = 3.6 * k;
    const colBase = oy - g.radiusMm - 2.5;
    let maxLines = 1;
    g.cols.forEach((col, j) => {
      const lines = (g.colLabels?.[j] ?? col).split("\n");
      maxLines = Math.max(maxLines, lines.length);
      lines.forEach((text, li) => {
        out.push({
          kind: "text",
          x: ox + j * g.pitchMm[0],
          y: colBase - (lines.length - 1 - li) * colSize * LINE_HEIGHT,
          sizeMm: colSize,
          text,
          bold: true,
          anchor: "middle",
        });
      });
    });
    if (g.title) {
      out.push({
        kind: "text",
        x: ox - g.radiusMm,
        y: colBase - maxLines * colSize * LINE_HEIGHT - 2,
        sizeMm: 4.5 * k,
        text: g.title,
        bold: true,
      });
    }
    if (!g.hideRowLabels) {
      const rowSize = 3.8 * k;
      g.rows.forEach((row, i) => {
        out.push({
          kind: "text",
          x: ox - g.radiusMm - 2.5,
          y: oy + i * g.pitchMm[1] + rowSize * 0.36,
          sizeMm: rowSize,
          text: g.rowLabels?.[i] ?? row,
          bold: true,
          anchor: "end",
        });
      });
    }
  }

  if (layout.footer) {
    const size = 3.8 * k;
    layout.footer.lines.forEach((text, i) => {
      out.push({ kind: "text", x: layout.fiducial.insetMm + layout.fiducial.sizeMm + 4, y: layout.footer!.yMm + i * size * 1.4, sizeMm: size, text });
    });
  }

  for (const b of bubbleCenters(layout)) {
    out.push({ kind: "circle", cx: b.x, cy: b.y, r: b.r, strokeMm: BUBBLE_STROKE_MM });
  }

  return out;
}
