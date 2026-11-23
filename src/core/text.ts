import { estimateTextWidthMm } from "./render/measure";

/**
 * Printed-text helpers shared by every app: clean typed text, find characters a card cannot
 * print, and wrap by measured width without ever splitting a syllable (Telugu, Hindi...).
 */

/** Text the printed card can show: typographic dashes and quotes become plain ones, control characters go. */
export function printableText(s: string): string {
  return s
    .replace(/[\u2012-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Characters the standard PDF fonts cannot draw (they would print as "?"). */
export function unprintableLatin(s: string): string[] {
  return [...new Set([...printableText(s)].filter((c) => !/[\x20-\x7e\xa0-\xff]/.test(c)))];
}

/**
 * For cards printed in any script (drawn by the browser as images): only symbols that would not
 * print as plain black text are refused, such as emoji and private-use characters.
 */
export function unprintableAnyScript(s: string): string[] {
  return [...new Set([...printableText(s)].filter((c) => !/[\p{L}\p{M}\p{N}\p{P}\p{Zs}\p{Sm}\p{Sc}\u200c\u200d\xa0-\xff]/u.test(c)))];
}

export const isLatinText = (w: string) => /^[\x20-\x7e\xa0-\xff]*$/.test(w);

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** User-perceived characters: a Telugu or Hindi syllable with its vowel signs is one unit. */
export function graphemes(w: string): string[] {
  return isLatinText(w) || !segmenter ? [...w] : [...segmenter.segment(w)].map((g) => g.segment);
}

/** Word-wrap to a printed width (measured). Long words are split by grapheme. Null if it needs more than `maxLines`. */
export function wrapToWidth(text: string, sizeMm: number, widthMm: number, maxLines: number, bold = false): string[] | null {
  const fits = (t: string) => estimateTextWidthMm(t, sizeMm, bold) <= widthMm;
  const words: string[] = [];
  for (const w of printableText(text).split(" ").filter(Boolean)) {
    if (fits(w)) {
      words.push(w);
      continue;
    }
    let part = "";
    for (const c of graphemes(w)) {
      if (part && !fits(part + c)) {
        words.push(part);
        part = "";
      }
      part += c;
    }
    if (part) words.push(part);
  }
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && fits(`${last} ${w}`)) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  if (lines.length === 0) return null;
  return lines.length <= maxLines ? lines : null;
}
