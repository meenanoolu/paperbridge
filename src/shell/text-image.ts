import type { TextImageRenderer, TextImageRequest } from "../core";

/**
 * Prints text the standard PDF fonts cannot draw (Telugu, Hindi, Tamil, Arabic, CJK...) without
 * bundling any font: the browser draws it offscreen with the system fonts at about 600 dpi and
 * the PDF embeds it as a lossless PNG, fitted inside the same box the printed-text check
 * measured. Latin-1 text never comes here, so English PDFs stay vector and byte-identical.
 * Returns null outside a browser (Node tests), and the core falls back to its standard path.
 */
export const TEXT_IMAGE_PX_PER_MM = 24;

const FAMILY =
  '"Noto Sans", "Noto Sans Telugu", "Noto Sans Devanagari", "Nirmala UI", "Gautami", "Mangal", "Kohinoor Telugu", "Kohinoor Devanagari", "Segoe UI", system-ui, sans-serif';

/** Where to draw so the text fills but never leaves the box. Pure, for tests. */
export function fitText(
  req: Pick<TextImageRequest, "widthMm" | "heightMm" | "baselineMm" | "align">,
  measured: { width: number; ascent: number; descent: number },
  pxPerMm: number,
): { scale: number; x: number; baseline: number; width: number; height: number } {
  const width = Math.max(1, Math.ceil(req.widthMm * pxPerMm));
  const height = Math.max(1, Math.ceil(req.heightMm * pxPerMm));
  const tall = measured.ascent + measured.descent;
  const scale = Math.min(1, measured.width > 0 ? width / measured.width : 1, tall > 0 ? height / tall : 1);
  const w = measured.width * scale;
  const x = req.align === "middle" ? (width - w) / 2 : req.align === "end" ? width - w : 0;
  // Keep the font's own baseline when everything fits; otherwise centre the scaled glyphs.
  const natural = req.baselineMm * pxPerMm;
  const baseline =
    scale < 1
      ? (height - tall * scale) / 2 + measured.ascent * scale
      : Math.min(Math.max(natural, measured.ascent), height - measured.descent);
  return { scale, x, baseline, width, height };
}

export const canvasTextImage: TextImageRenderer = async (req) => {
  if (typeof document === "undefined") return null;
  const px = TEXT_IMAGE_PX_PER_MM;
  const font = `${req.bold ? "bold " : ""}${req.sizeMm * px}px ${FAMILY}`;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  probe.font = font;
  const m = probe.measureText(req.text);
  const fit = fitText(req, { width: m.width, ascent: m.actualBoundingBoxAscent || req.sizeMm * px * 0.8, descent: m.actualBoundingBoxDescent || req.sizeMm * px * 0.25 }, px);
  const canvas = document.createElement("canvas");
  canvas.width = fit.width;
  canvas.height = fit.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";
  ctx.translate(fit.x, fit.baseline);
  ctx.scale(fit.scale, fit.scale);
  ctx.fillText(req.text, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
};
