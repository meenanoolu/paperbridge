import { bubbleKey, type BubbleReading, type ScanResult } from "../core";

/**
 * Human-in-the-loop review of unclear marks.
 *
 * The decoder's `ScanResult` is never changed. A person looks at the paper and records an
 * override for a bubble the decoder reported as `ambiguous`; `applyManualOverrides` returns a
 * new result with those decisions applied, and the apps re-run their pure interpreters on it.
 *
 * Overrides only resolve `ambiguous` bubbles. An override for a bubble the decoder read with
 * confidence (filled or blank) is ignored, so a click can never silently rewrite a clear mark.
 */
export type OverrideState = "filled" | "blank";

/** Keyed by `bubbleKey(group, row, col)`. A missing key means "still unclear". */
export type ManualOverrides = Readonly<Record<string, OverrideState>>;

export const NO_OVERRIDES: ManualOverrides = Object.freeze({});

export function readingKey(b: Pick<BubbleReading, "group" | "row" | "col">): string {
  return bubbleKey(b.group, b.row, b.col);
}

/** The bubbles a person may resolve: exactly the decoder's ambiguous readings, in card order. */
export function unclearBubbles(scan: ScanResult): BubbleReading[] {
  return scan.ok ? scan.bubbles.filter((b) => b.state === "ambiguous") : [];
}

/** How many overrides actually apply to this scan (stale or non-ambiguous keys do not count). */
export function countActiveOverrides(scan: ScanResult, overrides: ManualOverrides): number {
  return unclearBubbles(scan).filter((b) => overrides[readingKey(b)] !== undefined).length;
}

/**
 * Return a new scan with human decisions applied to ambiguous bubbles. Pure: `scan` and
 * `overrides` are not mutated, and untouched bubbles keep their original objects. The
 * decoder's `fill` and `confidence` are kept as the audit trail of what the camera saw.
 */
export function applyManualOverrides<T extends ScanResult>(scan: T, overrides: ManualOverrides): T {
  if (!scan.ok || countActiveOverrides(scan, overrides) === 0) return scan;
  const bubbles = scan.bubbles.map((b) => {
    const o = b.state === "ambiguous" ? overrides[readingKey(b)] : undefined;
    return o ? { ...b, state: o } : b;
  });
  return { ...scan, bubbles };
}

/** Click / Enter cycle on the scan overlay: unclear -> filled -> blank -> unclear. */
export function nextOverride(current: OverrideState | undefined): OverrideState | undefined {
  return current === undefined ? "filled" : current === "filled" ? "blank" : undefined;
}

/** Set or clear one override, returning a new map. */
export function setOverride(overrides: ManualOverrides, key: string, value: OverrideState | undefined): ManualOverrides {
  const next: Record<string, OverrideState> = { ...overrides };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}
