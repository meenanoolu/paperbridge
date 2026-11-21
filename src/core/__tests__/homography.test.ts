import { describe, expect, it } from "vitest";
import { applyHomography, solveHomography } from "../decode/homography";

describe("homography", () => {
  const src: [number, number][] = [[0, 0], [10, 0], [10, 20], [0, 20]];

  it("recovers a known projective map", () => {
    const dst: [number, number][] = [[100, 50], [220, 70], [240, 260], [90, 240]];
    const H = solveHomography(src, dst)!;
    expect(H).not.toBeNull();
    src.forEach((p, i) => {
      const [x, y] = applyHomography(H, p[0], p[1]);
      expect(x).toBeCloseTo(dst[i][0], 6);
      expect(y).toBeCloseTo(dst[i][1], 6);
    });
  });

  it("maps interior points consistently with an affine transform", () => {
    // Scale 3, rotate 90 degrees, translate (5, 7): (x, y) -> (-3y + 5, 3x + 7)
    const f = ([x, y]: [number, number]): [number, number] => [-3 * y + 5, 3 * x + 7];
    const H = solveHomography(src, src.map(f))!;
    const [x, y] = applyHomography(H, 4, 6);
    expect(x).toBeCloseTo(-13, 6);
    expect(y).toBeCloseTo(19, 6);
  });

  it("returns null when three points are collinear", () => {
    const collinear: [number, number][] = [[0, 0], [1, 1], [2, 2], [5, 0]];
    expect(solveHomography(collinear, src)).toBeNull();
  });
});
