import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decode } from "../decode/decode";
import { bubbleKey } from "../layout";
import { TEST_BUBBLE_KEYS, TEST_LAYOUT, TEST_LAYOUT_LETTER } from "../testing/fixtures";
import { renderCardRaster, type SynthOptions } from "../testing/synth";
import type { CardLayout, ScanResult } from "../types";

/**
 * Property-based tests for the optical decoder. Each property renders a synthetic card
 * from a random fill pattern, applies a random camera-like transform, and decodes it.
 * On failure fast-check prints the seed and the counterexample for replay.
 */

// Override for deeper local runs: PBT_RUNS=200 npm test
const NUM_RUNS = Number(process.env.PBT_RUNS ?? 25);

const fillPattern = fc.array(fc.boolean(), { minLength: TEST_BUBBLE_KEYS.length, maxLength: TEST_BUBBLE_KEYS.length });

const shadow = fc.record({
  gradient: fc.option(
    fc.record({ angleRad: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), strength: fc.double({ min: 0, max: 0.45, noNaN: true }) }),
    { nil: undefined },
  ),
  blob: fc.option(
    fc.record({
      x: fc.double({ min: 0, max: 1, noNaN: true }),
      y: fc.double({ min: 0, max: 1, noNaN: true }),
      sigma: fc.double({ min: 0.08, max: 0.3, noNaN: true }),
      strength: fc.double({ min: 0, max: 0.4, noNaN: true }),
    }),
    { nil: undefined },
  ),
});

const camera = fc.record({
  rotationDeg: fc.double({ min: -30, max: 30, noNaN: true }),
  scale: fc.double({ min: 0.5, max: 2, noNaN: true }),
  perspective: fc.tuple(fc.double({ min: -0.08, max: 0.08, noNaN: true }), fc.double({ min: -0.08, max: 0.08, noNaN: true })),
  noiseSigma: fc.double({ min: 0, max: 5, noNaN: true }),
  brightness: fc.double({ min: 0.5, max: 1, noNaN: true }),
  seed: fc.integer({ min: 0, max: 2 ** 31 }),
});

function setOf(bits: boolean[]): Set<string> {
  return new Set(TEST_BUBBLE_KEYS.filter((_, i) => bits[i]));
}

function filledKeys(res: ScanResult): Set<string> {
  const s = new Set<string>();
  if (res.ok) for (const b of res.bubbles) if (b.state === "filled") s.add(bubbleKey(b.group, b.row, b.col));
  return s;
}

function expectExact(res: ScanResult, expected: Set<string>) {
  expect(res.ok).toBe(true);
  if (!res.ok) return;
  expect(res.bubbles.filter((b) => b.state === "ambiguous")).toEqual([]);
  expect(res.bubbles).toHaveLength(TEST_BUBBLE_KEYS.length);
  expect(filledKeys(res)).toEqual(expected);
}

const opts = (c: Record<string, unknown>): SynthOptions => c as SynthOptions;

describe("decoder properties", () => {
  it("P1: recovers the fill pattern under rotation, scale, perspective, shadow and noise", () => {
    fc.assert(
      fc.property(fillPattern, camera, shadow, (bits, cam, sh) => {
        const expected = setOf(bits);
        const res = decode(renderCardRaster(TEST_LAYOUT, expected, opts({ ...cam, ...sh })), TEST_LAYOUT);
        expectExact(res, expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("P2: rotation and scale alone do not change the result", () => {
    fc.assert(
      fc.property(
        fillPattern,
        fc.double({ min: -30, max: 30, noNaN: true }),
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        (bits, rotationDeg, scale) => {
          const filled = setOf(bits);
          const base = decode(renderCardRaster(TEST_LAYOUT, filled), TEST_LAYOUT);
          const moved = decode(renderCardRaster(TEST_LAYOUT, filled, { rotationDeg, scale }), TEST_LAYOUT);
          expectExact(base, filled);
          expect(filledKeys(moved)).toEqual(filledKeys(base));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("P3: shadow strength does not change the result", () => {
    fc.assert(
      fc.property(fillPattern, shadow, fc.integer({ min: -30, max: 30 }), (bits, sh, rotationDeg) => {
        const filled = setOf(bits);
        const lit = decode(renderCardRaster(TEST_LAYOUT, filled, { rotationDeg }), TEST_LAYOUT);
        const shaded = decode(renderCardRaster(TEST_LAYOUT, filled, opts({ rotationDeg, ...sh })), TEST_LAYOUT);
        expectExact(lit, filled);
        expectExact(shaded, filled);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("P4: removing any one fiducial returns FIDUCIALS_NOT_FOUND, never guessed data", () => {
    fc.assert(
      fc.property(fillPattern, fc.integer({ min: 0, max: 3 }), camera, (bits, missing, cam) => {
        const img = renderCardRaster(TEST_LAYOUT, setOf(bits), opts({ ...cam, omitFiducials: [missing] }));
        expect(decode(img, TEST_LAYOUT)).toEqual({ ok: false, reason: "FIDUCIALS_NOT_FOUND" });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("P5: decoding is deterministic", () => {
    fc.assert(
      fc.property(fillPattern, camera, shadow, (bits, cam, sh) => {
        const img = renderCardRaster(TEST_LAYOUT, setOf(bits), opts({ ...cam, ...sh }));
        expect(JSON.stringify(decode(img, TEST_LAYOUT))).toBe(JSON.stringify(decode(img, TEST_LAYOUT)));
      }),
      { numRuns: 10 },
    );
  });

  it("P6: a card printed from a different layout is rejected, not misread", () => {
    fc.assert(
      fc.property(fillPattern, fc.integer({ min: -30, max: 30 }), (bits, rotationDeg) => {
        const other: CardLayout = { ...TEST_LAYOUT, id: "some-other-card" };
        const img = renderCardRaster(other, setOf(bits), { rotationDeg });
        expect(decode(img, TEST_LAYOUT)).toEqual({ ok: false, reason: "CARD_ID_MISMATCH" });
      }),
      { numRuns: 15 },
    );
  });

  it("P7: Letter-size cards decode too", () => {
    fc.assert(
      fc.property(fillPattern, fc.double({ min: -30, max: 30, noNaN: true }), (bits, rotationDeg) => {
        const expected = setOf(bits);
        const res = decode(renderCardRaster(TEST_LAYOUT_LETTER, expected, { rotationDeg }), TEST_LAYOUT_LETTER);
        expectExact(res, expected);
      }),
      { numRuns: 10 },
    );
  });
});

describe("decoder edge cases", () => {
  it("returns FIDUCIALS_NOT_FOUND on a blank frame", () => {
    const data = new Uint8ClampedArray(320 * 240 * 4).fill(200);
    expect(decode({ width: 320, height: 240, data }, TEST_LAYOUT)).toEqual({ ok: false, reason: "FIDUCIALS_NOT_FOUND" });
  });

  it("flags a half-filled bubble as ambiguous instead of coercing it", () => {
    const key = TEST_BUBBLE_KEYS[0];
    const img = renderCardRaster(TEST_LAYOUT, new Set([key]), { markDarkness: 0.3 });
    const res = decode(img, TEST_LAYOUT);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const b = res.bubbles[0];
      expect(b.state).toBe("ambiguous");
      expect(b.confidence).toBeLessThanOrEqual(0.5);
    }
  });
});
