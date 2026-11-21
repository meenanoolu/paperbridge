import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { decode, type RasterImage } from "../../../core";
import { ELDER_LAYOUT } from "../layout";

/** R9.1: decoding a 1280x720 frame must take under 500 ms. */
const BUDGET_MS = 500;

/** Bilinear-resize `src` to fit inside w x h and centre it on a dark background, like a webcam frame. */
function letterbox(src: RasterImage, w: number, h: number): RasterImage {
  const s = Math.min(w / src.width, h / src.height);
  const dw = Math.round(src.width * s);
  const dh = Math.round(src.height * s);
  const ox = Math.floor((w - dw) / 2);
  const oy = Math.floor((h - dh) / 2);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 40;
    out[i + 1] = 36;
    out[i + 2] = 34;
    out[i + 3] = 255;
  }
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(src.height - 1.001, Math.max(0, (y + 0.5) / s - 0.5));
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(src.width - 1.001, Math.max(0, (x + 0.5) / s - 0.5));
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const o = ((oy + y) * w + ox + x) * 4;
      for (let c = 0; c < 3; c++) {
        const p = (yy: number, xx: number) => src.data[(yy * src.width + xx) * 4 + c];
        out[o + c] = (p(y0, x0) * (1 - tx) + p(y0, x0 + 1) * tx) * (1 - ty) + (p(y0 + 1, x0) * (1 - tx) + p(y0 + 1, x0 + 1) * tx) * ty;
      }
    }
  }
  return { width: w, height: h, data: out };
}

describe("decode performance (R9.1)", () => {
  it(`decodes a 1280x720 webcam-sized frame in under ${BUDGET_MS} ms with the same result`, () => {
    const photo = decodeJpeg(readFileSync(join(__dirname, "../samples/tilted-low-light.jpg")));
    const frame = letterbox(photo, 1280, 720);
    expect([frame.width, frame.height]).toEqual([1280, 720]);

    const reference = decode(photo, ELDER_LAYOUT);
    const result = decode(frame, ELDER_LAYOUT); // warm-up
    expect(result.ok && reference.ok).toBe(true);
    if (!result.ok || !reference.ok) return;
    // The card is about 53% of its original size here; the bubbles must not change.
    expect(result.bubbles.map((b) => b.state)).toEqual(reference.bubbles.map((b) => b.state));

    const times: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      decode(frame, ELDER_LAYOUT);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[3];
    console.info(`1280x720 decode: median ${median.toFixed(1)} ms, min ${times[0].toFixed(1)} ms, max ${times[6].toFixed(1)} ms`);
    expect(median).toBeLessThan(BUDGET_MS);
  });
});
