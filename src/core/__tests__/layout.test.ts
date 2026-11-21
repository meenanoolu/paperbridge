import { describe, expect, it } from "vitest";
import { bubbleCenters, fiducialCenters, idBits, idBubbleCenters, validateLayout } from "../layout";
import { TEST_LAYOUT, TEST_LAYOUT_LETTER } from "../testing/fixtures";

describe("layout", () => {
  it("test layouts are valid", () => {
    expect(validateLayout(TEST_LAYOUT)).toEqual([]);
    expect(validateLayout(TEST_LAYOUT_LETTER)).toEqual([]);
  });

  it("computes bubble centres from origin and pitch", () => {
    const b = bubbleCenters(TEST_LAYOUT);
    expect(b).toHaveLength(8 * 6 + 2 * 5);
    expect(b[0]).toMatchObject({ group: "grid", row: "r1", col: "c1", x: 50, y: 75 });
    expect(b[7]).toMatchObject({ row: "r2", col: "c2", x: 72, y: 97 });
  });

  it("places fiducials at the four corners in TL, TR, BR, BL order", () => {
    expect(fiducialCenters(TEST_LAYOUT)).toEqual([
      [14, 14],
      [196, 14],
      [196, 283],
      [14, 283],
    ]);
  });

  it("derives a stable ID strip that differs between layouts", () => {
    expect(idBits(TEST_LAYOUT)).toHaveLength(10);
    expect(idBubbleCenters(TEST_LAYOUT)).toHaveLength(10);
    expect(idBits(TEST_LAYOUT)).toEqual(idBits(TEST_LAYOUT));
    expect(idBits(TEST_LAYOUT)).not.toEqual(idBits({ ...TEST_LAYOUT, id: "other-card" }));
  });

  it("reports bubbles that overlap a fiducial", () => {
    const bad = { ...TEST_LAYOUT, groups: [{ ...TEST_LAYOUT.groups[0], originMm: [20, 20] as [number, number] }] };
    expect(validateLayout(bad).length).toBeGreaterThan(0);
  });
});
