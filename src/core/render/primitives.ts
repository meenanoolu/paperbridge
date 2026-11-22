import {
  FIDUCIAL_MODULES,
  bubbleCenters,
  fiducialCenters,
  idBits,
  idBubbleCenters,
} from "../layout";
import type { CardLayout } from "../types";

export type Primitive =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: "black" | "white" | "band"; grey?: number }
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
/**
 * Darkest band allowed. Darker shading lowers the measured fill of faint marks on shaded rows
 * (measured: a faint mark's fill drops from 0.28 at 0.93 to 0.23 at 0.88, near BLANK_MAX 0.2),
 * so the renderer refuses anything darker.
 */
export const MIN_BAND_GREY = 0.88;
export const LINE_HEIGHT = 1.15;
/** Base text sizes in mm, before `labelScale` and `printStyle` multipliers. */
export const COL_LABEL_SIZE_MM = 3.6;
export const ROW_LABEL_SIZE_MM = 3.8;
export const COL_NOTE_SIZE_MM = 2.5;
export const GROUP_TITLE_SIZE_MM = 4.5;
/** Gap between the column notes and the column label above them. */
export const NOTE_GAP_MM = 1;

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

  const style = layout.printStyle ?? {};
  const textLeft = insetMm + sizeMm + 4;
  out.push({ kind: "text", x: textLeft, y: insetMm + 8, sizeMm: 8, text: layout.title, bold: true });
  if (layout.subtitle) {
    out.push({ kind: "text", x: textLeft, y: insetMm + 14, sizeMm: 4.2, text: layout.subtitle, bold: style.boldText || undefined });
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
      const band: Primitive = { kind: "rect", x: g.bands!.fromXMm, y: cy - g.pitchMm[1] / 2, w: g.bands!.toXMm - g.bands!.fromXMm, h: g.pitchMm[1], fill: "band" };
      if (style.bandGrey !== undefined) band.grey = Math.min(1, Math.max(MIN_BAND_GREY, style.bandGrey));
      out.push(band);
    });
  }

  for (const g of layout.groups) {
    const [ox, oy] = g.originMm;
    const ck = k * (style.colLabelScale ?? 1);
    const colSize = COL_LABEL_SIZE_MM * ck;
    const noteSize = COL_NOTE_SIZE_MM * ck;
    const bubbleTop = oy - g.radiusMm - 2.5;
    // Notes sit directly above the bubbles; labels move up by the tallest column's notes.
    const noteLines = g.cols.map((_, j) => (g.colNotes?.[j] ? g.colNotes[j].split("\n") : []));
    const maxNotes = Math.max(0, ...noteLines.map((l) => l.length));
    noteLines.forEach((lines, j) => {
      lines.forEach((text, li) => {
        out.push({
          kind: "text",
          x: ox + j * g.pitchMm[0],
          y: bubbleTop - (lines.length - 1 - li) * noteSize * LINE_HEIGHT,
          sizeMm: noteSize,
          text,
          bold: style.boldText || undefined,
          anchor: "middle",
        });
      });
    });
    const colBase = maxNotes ? bubbleTop - maxNotes * noteSize * LINE_HEIGHT - NOTE_GAP_MM : bubbleTop;
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
        sizeMm: GROUP_TITLE_SIZE_MM * ck,
        text: g.title,
        bold: true,
      });
    }
    if (!g.hideRowLabels) {
      const rowSize = ROW_LABEL_SIZE_MM * k * (style.rowLabelScale ?? 1);
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
      out.push({ kind: "text", x: layout.fiducial.insetMm + layout.fiducial.sizeMm + 4, y: layout.footer!.yMm + i * size * 1.4, sizeMm: size, text, bold: style.boldText || undefined });
    });
  }

  for (const b of bubbleCenters(layout)) {
    out.push({ kind: "circle", cx: b.x, cy: b.y, r: b.r, strokeMm: BUBBLE_STROKE_MM });
  }

  return out;
}
