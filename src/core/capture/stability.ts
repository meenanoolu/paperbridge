import type { ScanResult } from "../types";

/** Number of consecutive identical, ambiguity-free frames needed before a webcam scan is "stable". */
export const STABLE_FRAMES = 2;

export interface StabilityState {
  /** True once STABLE_FRAMES consecutive frames decoded to the same ambiguity-free result. */
  stable: boolean;
  /** The most recent successful decode, if any. Lets the UI offer "use this frame anyway". */
  lastOk: Extract<ScanResult, { ok: true }> | null;
  /** How many consecutive matching frames have been seen. */
  streak: number;
}

/** Compact signature of a result: one character per bubble. */
export function resultSignature(result: Extract<ScanResult, { ok: true }>): string {
  return result.bubbles.map((b) => (b.state === "filled" ? "1" : b.state === "blank" ? "0" : "?")).join("");
}

/**
 * Tracks consecutive webcam decodes (requirement R3.2).
 * Pure: feed it results in order, read back whether the scan is stable.
 */
export function createStabilityTracker(required = STABLE_FRAMES) {
  let lastSig: string | null = null;
  let streak = 0;
  let lastOk: StabilityState["lastOk"] = null;

  return {
    push(result: ScanResult): StabilityState {
      if (!result.ok) {
        lastSig = null;
        streak = 0;
        return { stable: false, lastOk, streak };
      }
      lastOk = result;
      const sig = resultSignature(result);
      if (sig.includes("?")) {
        lastSig = null;
        streak = 0;
        return { stable: false, lastOk, streak };
      }
      streak = sig === lastSig ? streak + 1 : 1;
      lastSig = sig;
      return { stable: streak >= required, lastOk, streak };
    },
    reset() {
      lastSig = null;
      streak = 0;
      lastOk = null;
    },
  };
}
