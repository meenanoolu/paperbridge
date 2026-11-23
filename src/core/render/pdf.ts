import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import { pageSizeMm } from "../layout";
import type { CardLayout } from "../types";
import { ICON_SHAPES, ICON_UNITS } from "./icons";
import { isWinAnsiText, TEXT_ASCENT, textBoxOf } from "./measure";
import { BAND_GREY, cardPrimitives } from "./primitives";

const PT_PER_MM = 72 / 25.4;

/** Standard PDF fonts only cover WinAnsi; replace anything else so drawing never throws. */
const safe = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

/**
 * Text the standard fonts cannot draw (Telugu, Hindi, Arabic, CJK...), to be printed as an image
 * fitted inside its measured box. The caller (a browser) rasterises it with system fonts.
 */
export interface TextImageRequest {
  text: string;
  sizeMm: number;
  bold: boolean;
  /** The box the image must fill: the same box the printed-text check measures. */
  widthMm: number;
  heightMm: number;
  /** Where the baseline sits in the box, from its top, in mm. */
  baselineMm: number;
  align: "start" | "middle" | "end";
}

/** Returns PNG bytes for the request, or null to fall back to the standard-font path. */
export type TextImageRenderer = (req: TextImageRequest) => Promise<Uint8Array | null>;

/** Draw one card on a new page of `doc`, sized to the layout's paper. */
async function drawCard(
  doc: PDFDocument,
  layout: CardLayout,
  regular: PDFFont,
  bold: PDFFont,
  textImage: ((req: TextImageRequest) => Promise<PDFImage | null>) | undefined,
): Promise<void> {
  const { width, height } = pageSizeMm(layout);
  const page = doc.addPage([width * PT_PER_MM, height * PT_PER_MM]);

  const X = (mm: number) => mm * PT_PER_MM;
  const Y = (mm: number) => (height - mm) * PT_PER_MM;
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const band = rgb(BAND_GREY, BAND_GREY, BAND_GREY);

  for (const p of cardPrimitives(layout)) {
    if (p.kind === "rect") {
      page.drawRectangle({ x: X(p.x), y: Y(p.y + p.h), width: X(p.w), height: X(p.h), color: p.fill === "black" ? black : p.fill === "band" ? (p.grey !== undefined ? rgb(p.grey, p.grey, p.grey) : band) : white });
    } else if (p.kind === "circle") {
      page.drawCircle({
        x: X(p.cx),
        y: Y(p.cy),
        size: X(p.r),
        color: p.fill ? black : white,
        borderColor: p.strokeMm ? black : undefined,
        borderWidth: p.strokeMm ? X(p.strokeMm) : 0,
      });
    } else if (p.kind === "icon") {
      // pdf-lib draws SVG paths with y pointing down from (x, y), like the SVG preview.
      for (const shape of ICON_SHAPES[p.name]) {
        page.drawSvgPath(shape.d, { x: X(p.x), y: Y(p.y), scale: X(p.sizeMm / ICON_UNITS), color: shape.fill === "black" ? black : white, borderWidth: 0 });
      }
    } else if (p.kind === "rule") {
      page.drawRectangle({ x: X(p.x), y: Y(p.y + p.h), width: X(p.w), height: X(p.h), color: black });
    } else if (p.kind === "frame") {
      page.drawRectangle({ x: X(p.x), y: Y(p.y + p.h), width: X(p.w), height: X(p.h), borderColor: black, borderWidth: X(p.strokeMm) });
    } else {
      if (textImage && !isWinAnsiText(p.text)) {
        const box = textBoxOf(p);
        const img = await textImage({
          text: p.text,
          sizeMm: p.sizeMm,
          bold: !!p.bold,
          widthMm: box.x1 - box.x0,
          heightMm: box.y1 - box.y0,
          baselineMm: TEXT_ASCENT * p.sizeMm,
          align: p.anchor ?? "start",
        });
        if (img) {
          page.drawImage(img, { x: X(box.x0), y: Y(box.y1), width: X(box.x1 - box.x0), height: X(box.y1 - box.y0) });
          continue;
        }
      }
      const font = p.bold ? bold : regular;
      const size = p.sizeMm * PT_PER_MM;
      const text = safe(p.text);
      const w = font.widthOfTextAtSize(text, size);
      const dx = p.anchor === "middle" ? -w / 2 : p.anchor === "end" ? -w : 0;
      page.drawText(text, { x: X(p.x) + dx, y: Y(p.y), size, font, color: black });
    }
  }
}

export interface CardsPdfOptions {
  /** Document title. Defaults to the first card's title. */
  title?: string;
  /**
   * Renders text the standard fonts cannot draw (any non-Latin-1 script) to a PNG. Without it
   * (e.g. in Node) such characters print as "?", exactly as before. Latin-1 text never uses it,
   * so English cards are byte-identical either way.
   */
  textImage?: TextImageRenderer;
}

/**
 * Multi-page vector PDF: one page per layout, in order, each sized to its own paper. Any app can
 * build a printable pack (e.g. 4 weekly cards) with no PDF code of its own. Deterministic: fixed
 * dates, so identical layouts give identical bytes.
 */
export async function renderCardsPdf(layouts: CardLayout[], opts: CardsPdfOptions = {}): Promise<Uint8Array> {
  if (layouts.length === 0) throw new Error("renderCardsPdf needs at least one layout");
  const doc = await PDFDocument.create();
  doc.setTitle(opts.title ?? layouts[0].title);
  // Fixed dates keep the output deterministic for identical layouts.
  const epoch = new Date(0);
  doc.setCreationDate(epoch);
  doc.setModificationDate(epoch);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // One embedded image per distinct string, so a 4-week pack does not repeat the same labels.
  const cache = new Map<string, Promise<PDFImage | null>>();
  const textImage = opts.textImage
    ? (req: TextImageRequest) => {
        const key = JSON.stringify(req);
        if (!cache.has(key))
          cache.set(
            key,
            opts.textImage!(req).then((png) => (png ? doc.embedPng(png) : null)).catch(() => null),
          );
        return cache.get(key)!;
      }
    : undefined;
  for (const layout of layouts) await drawCard(doc, layout, regular, bold, textImage);
  return doc.save();
}

/** One-page vector PDF drawn from the same primitives as the SVG. */
export async function renderCardPdf(layout: CardLayout, opts: Omit<CardsPdfOptions, "title"> = {}): Promise<Uint8Array> {
  return renderCardsPdf([layout], { ...opts, title: `${layout.title} (${layout.id} v${layout.version})` });
}
