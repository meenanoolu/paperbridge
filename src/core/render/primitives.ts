import {
  FIDUCIAL_MODULES,
  bubbleCenters,
  fiducialCenters,
  idBits,
  idBubbleCenters,
} from "../layout";
import type { CardIcon, CardLayout } from "../types";
import { estimateTextWidthMm, TEXT_ASCENT, TEXT_DESCENT } from "./measure";

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
    }
  /** A monochrome vector icon in a square box; (x, y) is its top-left corner. */
  | { kind: "icon"; name: CardIcon; x: number; y: number; sizeMm: number }
  /** An unfilled rectangle; (x, y, w, h) is the centre line of the stroke. */
  | { kind: "frame"; x: number; y: number; w: number; h: number; strokeMm: number }
  /** A solid black bar, e.g. one line of a double underline. */
  | { kind: "rule"; x: number; y: number; w: number; h: number };

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
/** Icon-Anchored mode: icon side before label scale, and the gap between icon and label. */
export const ICON_SIZE_MM = 6;
export const ICON_GAP_MM = 2.2;
/** Highlight frame around a column label: padding to the text, stroke, and the lift that keeps it off the bubbles. */
export const FRAME_PAD_MM = 0.9;
export const FRAME_STROKE_MM = 0.6;
export const HIGHLIGHT_LIFT_MM = 1;
/** Double underline: bar thickness and the gaps below the text and between the bars. */
export const RULE_MM = 0.35;
export const RULE_GAP_MM = 0.4;

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
    const highlights = g.colHighlights?.length ? new Set(g.colHighlights) : null;
    // Highlighted groups lift their labels a little so the frame stays clear of the bubbles.
    const lift = highlights ? HIGHLIGHT_LIFT_MM : 0;
    const colBase = (maxNotes ? bubbleTop - maxNotes * noteSize * LINE_HEIGHT - NOTE_GAP_MM : bubbleTop) - lift;
    let maxLines = 1;
    g.cols.forEach((col, j) => {
      const lines = (g.colLabels?.[j] ?? col).split("\n");
      maxLines = Math.max(maxLines, lines.length);
      if (highlights?.has(j) && g.colHighlightStyle === "underline") {
        const w = Math.max(...lines.map((t) => estimateTextWidthMm(t, colSize, true)));
        const x = ox + j * g.pitchMm[0] - w / 2;
        const y = colBase + TEXT_DESCENT * colSize + RULE_GAP_MM;
        out.push({ kind: "rule", x, y, w, h: RULE_MM }, { kind: "rule", x, y: y + RULE_MM + RULE_GAP_MM, w, h: RULE_MM });
      } else if (highlights?.has(j)) {
        const w = Math.max(...lines.map((t) => estimateTextWidthMm(t, colSize, true)));
        const top = colBase - (lines.length - 1) * colSize * LINE_HEIGHT - TEXT_ASCENT * colSize - FRAME_PAD_MM;
        const bottom = colBase + TEXT_DESCENT * colSize + FRAME_PAD_MM;
        const left = ox + j * g.pitchMm[0] - w / 2 - FRAME_PAD_MM;
        const half = FRAME_STROKE_MM / 2;
        out.push({ kind: "frame", x: left - half, y: top - half, w: w + 2 * FRAME_PAD_MM + FRAME_STROKE_MM, h: bottom - top + FRAME_STROKE_MM, strokeMm: FRAME_STROKE_MM });
      }
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
    // Icon-Anchored mode: one row of icons above the tallest label; the group title moves up.
    let iconLift = 0;
    if (style.showIcons && g.colIcons?.some(Boolean)) {
      const size = ICON_SIZE_MM * ck;
      const bottom = colBase - (maxLines - 1) * colSize * LINE_HEIGHT - TEXT_ASCENT * colSize - ICON_GAP_MM;
      g.colIcons.forEach((name, j) => {
        if (name && j < g.cols.length) out.push({ kind: "icon", name, x: ox + j * g.pitchMm[0] - size / 2, y: bottom - size, sizeMm: size });
      });
      iconLift = size + ICON_GAP_MM;
    }
    if (g.title) {
      out.push({
        kind: "text",
        x: ox - g.radiusMm,
        y: colBase - maxLines * colSize * LINE_HEIGHT - 2 - iconLift,
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
      const bold = style.boldText || layout.footer!.boldLines?.includes(i) || undefined;
      out.push({ kind: "text", x: layout.fiducial.insetMm + layout.fiducial.sizeMm + 4, y: layout.footer!.yMm + i * size * 1.4, sizeMm: size, text, bold });
    });
  }

  for (const b of bubbleCenters(layout)) {
    out.push({ kind: "circle", cx: b.x, cy: b.y, r: b.r, strokeMm: BUBBLE_STROKE_MM });
  }

  return out;
}
