import { bubbleKey, type ScanResult } from "../../core";
import { RITE_RUNE_COUNT, riteSlot } from "./layout";

/** The decoder's bubble key for rune `i` (0 to 11). */
export function runeKey(i: number): string {
  const s = riteSlot(i);
  return bubbleKey(s.group, s.row, s.col);
}

/**
 * The 12 cover readings from one optical decode, or null when the sheet is not in view (the
 * decode failed, so the game waits). Cover is the decoder's own `fill`: how dark the bubble's
 * interior is next to the paper around it. A clean white centre reads about 0; a finger or
 * token over it reads high. Nothing is re-measured here.
 */
export function coverageFromScan(result: ScanResult): number[] | null {
  if (!result.ok) return null;
  const fill = new Map(result.bubbles.map((b) => [bubbleKey(b.group, b.row, b.col), b.fill]));
  return Array.from({ length: RITE_RUNE_COUNT }, (_, i) => {
    const v = fill.get(runeKey(i));
    return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  });
}
