import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { pageSizeMm } from "../layout";
import type { CardLayout } from "../types";
import { BAND_GREY, cardPrimitives } from "./primitives";

const PT_PER_MM = 72 / 25.4;

/** Standard PDF fonts only cover WinAnsi; replace anything else so drawing never throws. */
const safe = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

/** Draw one card on a new page of `doc`, sized to the layout's paper. */
function drawCard(doc: PDFDocument, layout: CardLayout, regular: PDFFont, bold: PDFFont): void {
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
    } else {
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
  for (const layout of layouts) drawCard(doc, layout, regular, bold);
  return doc.save();
}

/** One-page vector PDF drawn from the same primitives as the SVG. */
export async function renderCardPdf(layout: CardLayout): Promise<Uint8Array> {
  return renderCardsPdf([layout], { title: `${layout.title} (${layout.id} v${layout.version})` });
}
