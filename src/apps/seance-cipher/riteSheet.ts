import { bubbleCenters, bubbleKey, fiducialCenters, pageSizeMm, renderCardsPdf, renderCardSvg, type CardLayout } from "../../core";
import type { XRayModel, XRayState } from "../../shell/xray";
import { RITE_GLYPH_GAP_MM, RITE_GLYPH_MM, RITE_RUNE_COUNT, RITE_RUNE_NAMES, riteSlot } from "./layout";
import { GLYPH_UNITS, RUNE_GLYPHS } from "./runeGlyphs";
import { classifyCoverage } from "./riteEngine";

/**
 * The X-Ray Rite 12-Rune Sheet. The core prints the card (corner markers, card-ID strip, the 12
 * blank bubbles, rune names, footer). This module adds the 12 vector runes below the bubbles, in
 * the SVG preview and in the PDF. The bubbles are never touched: their centres stay blank white
 * so a finger or token can cover them and the decoder reads clean paper when nothing does.
 */
export interface GlyphBox {
  x: number;
  y: number;
  size: number;
}

/** Where rune `i` is drawn on `layout`, in card millimetres: centred under its bubble. */
export function runeGlyphBox(layout: CardLayout, i: number): GlyphBox {
  const s = riteSlot(i);
  const b = bubbleCenters(layout).find((c) => c.group === s.group && c.row === s.row && c.col === s.col);
  if (!b) throw new Error(`Rune ${i} has no bubble on "${layout.id}"`);
  return { x: b.x - RITE_GLYPH_MM / 2, y: b.y + b.r + RITE_GLYPH_GAP_MM, size: RITE_GLYPH_MM };
}

const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** The sheet as a printable SVG (millimetres): the core card plus the 12 runes. */
export function riteSheetSvg(layout: CardLayout): string {
  const glyphs = Array.from({ length: RITE_RUNE_COUNT }, (_, i) => {
    const box = runeGlyphBox(layout, i);
    const paths = RUNE_GLYPHS[i].map((sh) => `<path d="${sh.d}" fill="${sh.fill === "black" ? "#000" : "#fff"}"/>`).join("");
    return `<g transform="translate(${n(box.x)} ${n(box.y)}) scale(${n(box.size / GLYPH_UNITS)})" role="img" aria-label="${RITE_RUNE_NAMES[i]} rune">${paths}</g>`;
  }).join("\n");
  return renderCardSvg(layout).replace(/<\/svg>\s*$/, `${glyphs}\n</svg>`);
}

const PT_PER_MM = 72 / 25.4;

/** The one-page vector PDF: the core's PDF with the 12 runes drawn on top, the same way the core draws its icons. */
export async function riteSheetPdf(layout: CardLayout): Promise<Uint8Array> {
  // Loaded on demand, like the core's own PDF code, so pdf-lib stays out of the initial bundle.
  const { PDFDocument, rgb } = await import("pdf-lib");
  const base = await renderCardsPdf([layout], { title: `${layout.title} (${layout.id} v${layout.version})` });
  // Keep the core's fixed dates, so identical sheets give identical bytes.
  const doc = await PDFDocument.load(base, { updateMetadata: false });
  const page = doc.getPage(0);
  const { height } = pageSizeMm(layout);
  for (let i = 0; i < RITE_RUNE_COUNT; i++) {
    const box = runeGlyphBox(layout, i);
    for (const sh of RUNE_GLYPHS[i])
      page.drawSvgPath(sh.d, {
        x: box.x * PT_PER_MM,
        y: (height - box.y) * PT_PER_MM,
        scale: (box.size / GLYPH_UNITS) * PT_PER_MM,
        color: sh.fill === "black" ? rgb(0, 0, 0) : rgb(1, 1, 1),
        borderWidth: 0,
      });
  }
  return doc.save();
}

/** `data:` URL of an SVG string (an <img> never runs scripts). */
export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// ---------------------------------------------------------------------------
// Frozen X-Ray for the Game Over receipt
// ---------------------------------------------------------------------------

/** Pixels per millimetre of the synthetic sheet picture. */
export const SNAPSHOT_PX_PER_MM = 3;

export interface FrozenFrame {
  imageUrl: string;
  width: number;
  height: number;
  model: XRayModel;
  /** What the picture shows, for its alt text. */
  alt: string;
}

/**
 * Re-colour an X-Ray model by the game's thresholds: a rune at 0.48 or more counts as covered
 * ("filled"), 0.22 up to 0.48 is a trembling hand ("unclear"), anything lower is empty ("blank").
 * Runes in `standing` (still lit when time ran out) also show as "unclear", so the frozen frame
 * says what ended the rite. Positions come from the model; densities come from the game's coverage.
 */
export function modelWithCoverage(model: XRayModel, coverage: readonly number[], standing: readonly number[] = []): XRayModel {
  const index = new Map(Array.from({ length: RITE_RUNE_COUNT }, (_, i) => [slotKey(i), i]));
  const counts: Record<XRayState, number> = { filled: 0, unclear: 0, blank: 0 };
  const bubbles = model.bubbles.map((b) => {
    const i = index.get(b.key);
    const density = i === undefined ? b.density : Math.min(1, Math.max(0, coverage[i] ?? 0));
    const cover = classifyCoverage(density);
    const state: XRayState = cover === "covered" ? "filled" : cover === "trembling" || (i !== undefined && standing.includes(i)) ? "unclear" : "blank";
    counts[state]++;
    return { ...b, density, state, score: density.toFixed(2) };
  });
  return { ...model, bubbles, counts };
}

const slotKey = (i: number) => {
  const s = riteSlot(i);
  return bubbleKey(s.group, s.row, s.col);
};

/** An X-Ray over a drawing of the sheet, for the digital launchpad (there is no camera frame to freeze). */
export function sheetSnapshot(layout: CardLayout, coverage: readonly number[], standing: readonly number[] = []): FrozenFrame {
  const { width: wMm, height: hMm } = pageSizeMm(layout);
  const k = SNAPSHOT_PX_PER_MM;
  const corners = fiducialCenters(layout).map(([x, y], i) => ({
    name: (["top-left", "top-right", "bottom-right", "bottom-left"] as const)[i],
    x: x * k,
    y: y * k,
    size: layout.fiducial.sizeMm * k,
  }));
  const flat: XRayModel = {
    corners,
    bubbles: bubbleCenters(layout).map((b) => ({ key: bubbleKey(b.group, b.row, b.col), x: b.x * k, y: b.y * k, r: b.r * k, state: "blank" as const, density: 0, score: "0.00" })),
    counts: { filled: 0, unclear: 0, blank: bubbleCenters(layout).length },
    pxPerMm: k,
  };
  return {
    imageUrl: svgDataUrl(riteSheetSvg(layout)),
    width: Math.round(wMm * k),
    height: Math.round(hMm * k),
    model: modelWithCoverage(flat, coverage, standing),
    alt: "The X-Ray Rite sheet at the moment the rite ended, with each rune's cover reading.",
  };
}
