import type { RasterImage } from "../types";

export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export function toGray(img: RasterImage): GrayImage {
  const { width, height, data } = img;
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    out[i] = (77 * data[j] + 150 * data[j + 1] + 29 * data[j + 2]) >> 8;
  }
  return { width, height, data: out };
}

/** Summed-area table with a zero border: size (w+1) x (h+1). */
export function integralImage(g: GrayImage): Float64Array {
  const { width: w, height: h, data } = g;
  const stride = w + 1;
  const sat = new Float64Array(stride * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x];
      sat[(y + 1) * stride + (x + 1)] = sat[y * stride + (x + 1)] + row;
    }
  }
  return sat;
}

/**
 * Local-mean adaptive threshold. Returns 1 for pixels darker than `ratio` times the mean
 * of the surrounding window, so a smooth illumination change does not move the result.
 */
export function adaptiveDarkMask(g: GrayImage, halfWindow: number, ratio: number): Uint8Array {
  const { width: w, height: h, data } = g;
  const sat = integralImage(g);
  const stride = w + 1;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - halfWindow);
    const y1 = Math.min(h, y + halfWindow + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - halfWindow);
      const x1 = Math.min(w, x + halfWindow + 1);
      const sum = sat[y1 * stride + x1] - sat[y0 * stride + x1] - sat[y1 * stride + x0] + sat[y0 * stride + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      if (data[y * w + x] < mean * ratio) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/** Bilinear sample at continuous pixel coordinates (pixel centres at +0.5). Clamps at edges. */
export function sampleGray(g: GrayImage, px: number, py: number): number {
  const { width: w, height: h, data } = g;
  const fx = Math.min(Math.max(px - 0.5, 0), w - 1);
  const fy = Math.min(Math.max(py - 0.5, 0), h - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const a = data[y0 * w + x0] * (1 - tx) + data[y0 * w + x1] * tx;
  const b = data[y1 * w + x0] * (1 - tx) + data[y1 * w + x1] * tx;
  return a * (1 - ty) + b * ty;
}
