import { Resvg } from "@resvg/resvg-js";
import { bubbleCenters, pageSizeMm, type CardLayout, type RasterImage } from "../../../core";
import { photographSurface, type CameraOptions } from "../../../core/testing/synth";
import { riteSheetSvg } from "../riteSheet";

/** A camera view like the bundled sample photos: tilted, uneven light, a little noise. */
export const CAMERA: CameraOptions = {
  scale: 1.1,
  rotationDeg: -5,
  perspective: [0.03, -0.02],
  gradient: { angleRad: 2.2, strength: 0.25 },
  noiseSigma: 3,
  seed: 7,
  marginMm: 16,
  background: [0.16, 0.13, 0.12],
};

/** Rasterise an SVG sheet and photograph it through the simulated camera. */
export function photographSvg(layout: CardLayout, svg: string, camera: CameraOptions = CAMERA): RasterImage {
  const { width: cw, height: ch } = pageSizeMm(layout);
  const flat = new Resvg(svg, { fitTo: { mode: "width", value: Math.round(cw * 5) }, font: { loadSystemFonts: true, defaultFontFamily: "Arial" }, background: "#ffffff" }).render();
  const W = flat.width;
  const H = flat.height;
  const px = flat.pixels;
  const sx = W / cw;
  const sy = H / ch;
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
        const a = px[(y0 * W + x0) * 4 + c];
        const b = px[(y0 * W + x0 + 1) * 4 + c];
        const d = px[((y0 + 1) * W + x0) * 4 + c];
        const e = px[((y0 + 1) * W + x0 + 1) * 4 + c];
        rgb[c] = (((a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty) / 255) * paper[c];
      }
    },
    camera,
  );
}

/** The Rite sheet with a disc of `color` over rune `i` (a finger or token): `frac` of the bubble radius, `off` mm to the side. */
export function sheetWithCover(layout: CardLayout, i: number, color: string, opacity: number, frac: number, off = 0): string {
  const slots = bubbleCenters(layout);
  const b = slots[i];
  return riteSheetSvg(layout).replace("</svg>", `<circle cx="${b.x + off}" cy="${b.y}" r="${b.r * frac}" fill="${color}" fill-opacity="${opacity}"/></svg>`);
}
