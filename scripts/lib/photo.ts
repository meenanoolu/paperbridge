import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import { bubbleCenters, bubbleKey, pageSizeMm, renderCardSvg, type CardLayout, type RasterImage } from "../../src/core";
import { photographSurface } from "../../src/core/testing/synth";
import type { MarkStyle, SampleSpec } from "../../src/shell/sample-spec";

/** Resolution of the flat card before the simulated camera views it. */
const SOURCE_PX_PER_MM = 5;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INK: Record<MarkStyle, { color: string; opacity: number; cover: [number, number] }> = {
  pen: { color: "#1b2a6b", opacity: 0.95, cover: [0.82, 0.97] },
  pencil: { color: "#3a3a3a", opacity: 0.85, cover: [0.8, 0.95] },
  // Light, small mark: should land between the blank and filled thresholds.
  faint: { color: "#7d828c", opacity: 0.62, cover: [0.62, 0.74] },
};

/** A hand-drawn-looking blob: wobbly outline, slightly off-centre, plus a few scribble strokes. */
function markSvg(cx: number, cy: number, r: number, style: MarkStyle, rand: () => number): string {
  const ink = INK[style];
  const ox = (rand() - 0.5) * 0.14 * r;
  const oy = (rand() - 0.5) * 0.14 * r;
  const n = 18;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n + rand() * 0.15;
    const rr = r * (ink.cover[0] + rand() * (ink.cover[1] - ink.cover[0]));
    pts.push(`${(cx + ox + rr * Math.cos(a)).toFixed(2)},${(cy + oy + rr * Math.sin(a)).toFixed(2)}`);
  }
  const strokes: string[] = [];
  const reach = ink.cover[0];
  for (let i = 0; i < 3; i++) {
    const y = cy + oy + (i - 1) * r * 0.4 * reach;
    const w = r * reach * (0.85 - Math.abs(i - 1) * 0.2);
    strokes.push(
      `M${(cx + ox - w).toFixed(2)},${(y + (rand() - 0.5) * 0.4).toFixed(2)} L${(cx + ox + w).toFixed(2)},${(y + (rand() - 0.5) * 0.4).toFixed(2)}`,
    );
  }
  return (
    `<polygon points="${pts.join(" ")}" fill="${ink.color}" fill-opacity="${ink.opacity}"/>` +
    `<path d="${strokes.join(" ")}" stroke="${ink.color}" stroke-opacity="${ink.opacity * 0.6}" stroke-width="${(r * 0.22).toFixed(2)}" stroke-linecap="round" fill="none"/>`
  );
}

/** The printed card plus pen marks, as SVG. */
export function markedCardSvg(layout: CardLayout, spec: SampleSpec): string {
  const centers = new Map(bubbleCenters(layout).map((b) => [bubbleKey(b.group, b.row, b.col), b]));
  const rand = mulberry32(spec.inkSeed);
  const marks = spec.marks.map((m) => {
    const b = centers.get(m.key);
    if (!b) throw new Error(`Sample "${spec.id}" marks unknown bubble "${m.key}"`);
    return markSvg(b.x, b.y, b.r, m.style ?? "pen", rand);
  });
  return renderCardSvg(layout).replace("</svg>", `<g>${marks.join("")}</g>\n</svg>`);
}

/** Render the sample photo: rasterise the marked card, then view it through the simulated camera. */
export function photographSample(layout: CardLayout, spec: SampleSpec): RasterImage {
  const { width: cw, height: ch } = pageSizeMm(layout);
  const flat = new Resvg(markedCardSvg(layout, spec), {
    fitTo: { mode: "width", value: Math.round(cw * SOURCE_PX_PER_MM) },
    font: { loadSystemFonts: true, defaultFontFamily: "Arial" },
    background: "#ffffff",
  }).render();
  const W = flat.width;
  const H = flat.height;
  const px = flat.pixels;
  const sx = W / cw;
  const sy = H / ch;
  // Slightly off-white paper, so the pure-white SVG reads like a real sheet.
  const paper = [0.95, 0.94, 0.91];

  return photographSurface(
    cw,
    ch,
    (mx, my, rgb) => {
      const fx = Math.min(Math.max(mx * sx - 0.5, 0), W - 1.001);
      const fy = Math.min(Math.max(my * sy - 0.5, 0), H - 1.001);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      for (let c = 0; c < 3; c++) {
        const i00 = px[(y0 * W + x0) * 4 + c];
        const i10 = px[(y0 * W + x0 + 1) * 4 + c];
        const i01 = px[((y0 + 1) * W + x0) * 4 + c];
        const i11 = px[((y0 + 1) * W + x0 + 1) * 4 + c];
        rgb[c] = (((i00 * (1 - tx) + i10 * tx) * (1 - ty) + (i01 * (1 - tx) + i11 * tx) * ty) / 255) * paper[c];
      }
    },
    spec.camera,
  );
}

export const JPEG_QUALITY = 84;

export function encodeJpeg(img: RasterImage): Buffer {
  const data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return jpeg.encode({ width: img.width, height: img.height, data }, JPEG_QUALITY).data;
}

export function decodeJpeg(bytes: Uint8Array): RasterImage {
  const d = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { width: d.width, height: d.height, data: new Uint8ClampedArray(d.data.buffer, d.data.byteOffset, d.data.byteLength) };
}
