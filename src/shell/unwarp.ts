import { applyHomography, fiducialCenters, pageSizeMm, solveHomography, type CardLayout, type RasterImage, type ScanResult } from "../core";

/**
 * "Raw vs. Unwarped": the same 4 corner-marker correspondences the decoder uses, applied in
 * reverse to draw the card flat and face-on. Display only; the decoder never sees this image.
 */
export const UNWARP_PX_PER_MM = 3;

/** Card-mm -> image-px homography from a successful decode, or null. */
export function cardToImage(result: ScanResult, layout: CardLayout) {
  if (!result.ok || result.fiducials.length !== 4) return null;
  return solveHomography(fiducialCenters(layout), result.fiducials);
}

/** Resample the photo onto the flat card (bilinear). Pixels outside the photo are white. */
export function unwarpRaster(photo: RasterImage, result: ScanResult, layout: CardLayout, pxPerMm = UNWARP_PX_PER_MM): RasterImage | null {
  const H = cardToImage(result, layout);
  if (!H) return null;
  const { width: wMm, height: hMm } = pageSizeMm(layout);
  const W = Math.round(wMm * pxPerMm);
  const Ht = Math.round(hMm * pxPerMm);
  const out = new Uint8ClampedArray(W * Ht * 4);
  const src = photo.data;
  const pw = photo.width;
  const ph = photo.height;
  for (let y = 0; y < Ht; y++) {
    for (let x = 0; x < W; x++) {
      const [ix, iy] = applyHomography(H, (x + 0.5) / pxPerMm, (y + 0.5) / pxPerMm);
      const o = (y * W + x) * 4;
      const fx = ix - 0.5;
      const fy = iy - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= pw || y0 + 1 >= ph) {
        out[o] = out[o + 1] = out[o + 2] = 255;
        out[o + 3] = 255;
        continue;
      }
      const tx = fx - x0;
      const ty = fy - y0;
      const i00 = (y0 * pw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + pw * 4;
      const i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] = (src[i00 + c] * (1 - tx) + src[i10 + c] * tx) * (1 - ty) + (src[i01 + c] * (1 - tx) + src[i11 + c] * tx) * ty;
      }
      out[o + 3] = 255;
    }
  }
  return { width: W, height: Ht, data: out };
}
