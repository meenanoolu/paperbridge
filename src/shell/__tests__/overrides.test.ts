import { describe, expect, it } from "vitest";
import type { BubbleState, SuccessfulScan } from "../../core";
import {
  applyManualOverrides,
  countActiveOverrides,
  nextOverride,
  setOverride,
  unclearBubbles,
  NO_OVERRIDES,
} from "../overrides";

function scan(states: BubbleState[]): SuccessfulScan {
  return {
    ok: true,
    cardId: "c",
    layoutVersion: 1,
    fiducials: [],
    bubbles: states.map((state, i) => ({ group: "g", row: "r", col: String(i), state, confidence: 0.3, fill: 0.3, at: [i, i] })),
  };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

describe("applyManualOverrides", () => {
  it("resolves ambiguous bubbles and keeps the decoder's fill and confidence", () => {
    const raw = scan(["filled", "ambiguous", "blank", "ambiguous"]);
    const out = applyManualOverrides(raw, { "g/r/1": "filled", "g/r/3": "blank" });
    expect(out.ok && out.bubbles.map((b) => b.state)).toEqual(["filled", "filled", "blank", "blank"]);
    if (out.ok) expect(out.bubbles[1]).toMatchObject({ fill: 0.3, confidence: 0.3 });
  });

  it("never changes the raw scan (deep-frozen input does not throw)", () => {
    const raw = deepFreeze(scan(["ambiguous", "blank"]));
    const before = JSON.stringify(raw);
    const out = applyManualOverrides(raw, deepFreeze({ "g/r/0": "filled" as const }));
    expect(JSON.stringify(raw)).toBe(before);
    expect(out).not.toBe(raw);
    if (out.ok && raw.ok) expect(out.bubbles[1]).toBe(raw.bubbles[1]);
  });

  it("ignores overrides on bubbles the decoder read clearly, and unknown keys", () => {
    const raw = scan(["filled", "blank", "ambiguous"]);
    const out = applyManualOverrides(raw, { "g/r/0": "blank", "g/r/1": "filled", "x/y/z": "filled" });
    expect(out).toBe(raw);
    expect(countActiveOverrides(raw, { "g/r/0": "blank", "g/r/2": "filled" })).toBe(1);
  });

  it("passes failed scans through", () => {
    const failed = { ok: false as const, reason: "FIDUCIALS_NOT_FOUND" as const };
    expect(applyManualOverrides(failed, { a: "filled" })).toBe(failed);
    expect(unclearBubbles(failed)).toEqual([]);
  });

  it("returns the same scan when there is nothing to apply", () => {
    const raw = scan(["ambiguous"]);
    expect(applyManualOverrides(raw, NO_OVERRIDES)).toBe(raw);
  });
});

describe("override editing", () => {
  it("cycles unclear -> filled -> blank -> unclear", () => {
    expect(nextOverride(undefined)).toBe("filled");
    expect(nextOverride("filled")).toBe("blank");
    expect(nextOverride("blank")).toBeUndefined();
  });

  it("sets and clears without mutating", () => {
    const a = setOverride(NO_OVERRIDES, "k", "filled");
    const b = setOverride(a, "k", undefined);
    expect(a).toEqual({ k: "filled" });
    expect(b).toEqual({});
    expect(NO_OVERRIDES).toEqual({});
  });
});
