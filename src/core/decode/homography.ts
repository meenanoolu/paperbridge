import { HOMOGRAPHY_PIVOT_EPS } from "./constants";

/** Row-major 3x3 matrix [h0..h8] with h8 = 1. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/**
 * Solve for the homography H that maps each `src[i]` to `dst[i]` (4 point pairs).
 * Returns null when the configuration is degenerate (e.g. three collinear points).
 */
export function solveHomography(src: [number, number][], dst: [number, number][]): Homography | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  // Unknowns h0..h7; two equations per point, h8 fixed to 1.
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const h = gaussSolve(A);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Gaussian elimination with partial pivoting on an n x (n+1) augmented matrix. */
function gaussSolve(M: number[][]): number[] | null {
  const n = M.length;
  // Scale for a relative singularity test.
  let scale = 0;
  for (const row of M) for (let j = 0; j < n; j++) scale = Math.max(scale, Math.abs(row[j]));
  if (scale === 0) return null;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < HOMOGRAPHY_PIVOT_EPS * scale) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

export function applyHomography(H: Homography, x: number, y: number): [number, number] {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}
