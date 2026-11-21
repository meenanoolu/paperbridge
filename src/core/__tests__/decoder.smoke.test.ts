import { describe, expect, it } from "vitest";
import { decode } from "../decode/decode";
import { TEST_BUBBLE_KEYS, TEST_LAYOUT } from "../testing/fixtures";
import { renderCardRaster } from "../testing/synth";
import { bubbleKey } from "../layout";
import type { ScanResult } from "../types";

function filledSet(result: ScanResult): Set<string> {
  const s = new Set<string>();
  if (result.ok) for (const b of result.bubbles) if (b.state === "filled") s.add(bubbleKey(b.group, b.row, b.col));
  return s;
}

describe("decoder smoke", () => {
  const filled = new Set(TEST_BUBBLE_KEYS.filter((_, i) => i % 3 === 0));

  it("decodes an upright, clean card", () => {
    const res = decode(renderCardRaster(TEST_LAYOUT, filled), TEST_LAYOUT);
    expect(res.ok).toBe(true);
    expect(filledSet(res)).toEqual(filled);
    if (res.ok) expect(res.bubbles.every((b) => b.state !== "ambiguous")).toBe(true);
  });

  it("decodes a rotated, shadowed, noisy card", () => {
    const img = renderCardRaster(TEST_LAYOUT, filled, {
      rotationDeg: 22,
      scale: 0.8,
      gradient: { angleRad: 1, strength: 0.4 },
      blob: { x: 0.4, y: 0.5, sigma: 0.15, strength: 0.35 },
      noiseSigma: 4,
      perspective: [0.06, -0.05],
      seed: 3,
    });
    const res = decode(img, TEST_LAYOUT);
    expect(res.ok).toBe(true);
    expect(filledSet(res)).toEqual(filled);
  });
});
