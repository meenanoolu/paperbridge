import { describe, expect, it } from "vitest";
import { createStabilityTracker, resultSignature } from "../capture/stability";
import type { BubbleState, ScanResult } from "../types";

function ok(states: BubbleState[]): Extract<ScanResult, { ok: true }> {
  return {
    ok: true,
    cardId: "c",
    layoutVersion: 1,
    fiducials: [],
    bubbles: states.map((state, i) => ({ group: "g", row: "r", col: String(i), state, confidence: 1, fill: 0, at: [0, 0] })),
  };
}

describe("stability tracker", () => {
  it("is stable after two identical ambiguity-free frames", () => {
    const t = createStabilityTracker();
    expect(t.push(ok(["filled", "blank"])).stable).toBe(false);
    expect(t.push(ok(["filled", "blank"])).stable).toBe(true);
  });

  it("restarts the streak when the result changes", () => {
    const t = createStabilityTracker();
    t.push(ok(["filled", "blank"]));
    expect(t.push(ok(["blank", "blank"])).stable).toBe(false);
    expect(t.push(ok(["blank", "blank"])).stable).toBe(true);
  });

  it("never reports stable while a bubble is ambiguous, but keeps the last good decode", () => {
    const t = createStabilityTracker();
    t.push(ok(["ambiguous"]));
    const s = t.push(ok(["ambiguous"]));
    expect(s.stable).toBe(false);
    expect(s.lastOk).not.toBeNull();
  });

  it("resets on a failed frame", () => {
    const t = createStabilityTracker();
    t.push(ok(["filled"]));
    t.push({ ok: false, reason: "FIDUCIALS_NOT_FOUND" });
    expect(t.push(ok(["filled"])).stable).toBe(false);
  });

  it("signature encodes states in order", () => {
    expect(resultSignature(ok(["filled", "blank", "ambiguous"]))).toBe("10?");
  });
});
