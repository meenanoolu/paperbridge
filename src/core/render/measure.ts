import { HELVETICA_BOLD_WIDTHS, HELVETICA_WIDTHS } from "./helvetica-metrics";

/**
 * Multiplier on measured widths. 1: the PDF draws with exactly these metrics, and Arial (the
 * SVG font) shares Helvetica's advance widths. TEXT_CLEARANCE_MM provides the margin.
 */
export const TEXT_WIDTH_SAFETY = 1;

/** Combining marks and joiners take no width of their own (Telugu, Hindi and other scripts use many). */
const ZERO_WIDTH = /[\p{M}\u200b-\u200d\u2060\ufeff]/u;

/**
 * Printed width of `text` in mm at `sizeMm`, from the Helvetica / Helvetica-Bold metrics the PDF
 * embeds. Characters without a Latin-1 glyph count as 1 em (generous for Indic, Arabic and CJK
 * text), and combining marks count as 0. Non-Latin text is printed as an image fitted inside
 * this box, so the estimate is also the exact printed extent.
 */
export function estimateTextWidthMm(text: string, sizeMm: number, bold = false): number {
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code > 255 && ZERO_WIDTH.test(ch)) continue;
    const w = code >= 32 && code <= 255 ? table[code - 32] : 0;
    units += w || 1000;
  }
  return (units / 1000) * sizeMm * TEXT_WIDTH_SAFETY;
}

/** Text the standard PDF fonts draw directly (printable ASCII and Latin-1). */
export function isWinAnsiText(text: string): boolean {
  return /^[\x20-\x7e\xa0-\xff]*$/.test(text);
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Height above the baseline and depth below it, as fractions of the font size. */
export const TEXT_ASCENT = 0.75;
export const TEXT_DESCENT = 0.22;

/** The box a text primitive occupies: cap height above the baseline, descender below. */
export function textBoxOf(p: { x: number; y: number; sizeMm: number; text: string; bold?: boolean; anchor?: "start" | "middle" | "end" }): Box {
  const w = estimateTextWidthMm(p.text, p.sizeMm, p.bold);
  const x0 = p.anchor === "middle" ? p.x - w / 2 : p.anchor === "end" ? p.x - w : p.x;
  return { x0, y0: p.y - TEXT_ASCENT * p.sizeMm, x1: x0 + w, y1: p.y + TEXT_DESCENT * p.sizeMm };
}
