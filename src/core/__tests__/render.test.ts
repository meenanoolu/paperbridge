import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { bubbleCenters } from "../layout";
import { renderCardPdf } from "../render/pdf";
import { renderCardSvg } from "../render/svg";
import { TEST_LAYOUT, TEST_LAYOUT_LETTER } from "../testing/fixtures";

describe("card generator", () => {
  const svg = renderCardSvg(TEST_LAYOUT);

  it("is deterministic", () => {
    expect(renderCardSvg(TEST_LAYOUT)).toBe(svg);
  });

  it("sizes the page in millimetres for A4 and Letter", () => {
    expect(svg).toContain('width="210mm" height="297mm"');
    expect(renderCardSvg(TEST_LAYOUT_LETTER)).toContain('width="215.9mm" height="279.4mm"');
  });

  it("draws 3 nested squares per corner (12 rects plus the page background)", () => {
    expect(svg.match(/<rect /g)).toHaveLength(13);
  });

  it("draws every layout bubble plus 10 ID bubbles", () => {
    expect(svg.match(/<circle /g)).toHaveLength(bubbleCenters(TEST_LAYOUT).length + 10);
  });

  it("prints the title and card ID", () => {
    expect(svg).toContain(">Test Card<");
    expect(svg).toContain("CARD test-card v1");
  });

  it("escapes text", () => {
    const s = renderCardSvg({ ...TEST_LAYOUT, title: 'A & B <"x">' });
    expect(s).toContain("A &amp; B &lt;&quot;x&quot;&gt;");
  });

  it("produces a one-page PDF matching the page size", async () => {
    const bytes = await renderCardPdf(TEST_LAYOUT);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo((210 * 72) / 25.4, 1);
    expect(height).toBeCloseTo((297 * 72) / 25.4, 1);
    expect(Buffer.from(await renderCardPdf(TEST_LAYOUT)).equals(Buffer.from(bytes))).toBe(true);
  });

  it("does not throw on non-Latin text in the PDF", async () => {
    await expect(renderCardPdf({ ...TEST_LAYOUT, title: "Weekly – 薬 ✓" })).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe("print-only options", () => {
  it("leave bubbles and markers untouched and change only text and shading", async () => {
    const { cardPrimitives } = await import("../render/primitives");
    const base = cardPrimitives(TEST_LAYOUT);
    const styled = cardPrimitives({
      ...TEST_LAYOUT,
      printStyle: { boldText: true, bandGrey: 0.5, rowLabelScale: 1.2, colLabelScale: 1.1 },
      groups: TEST_LAYOUT.groups.map((g) => ({ ...g, colNotes: g.cols.map((c) => `note ${c}\nline 2`), bands: { fromXMm: 30, toXMm: 190 } })),
    });
    const shapes = (ps: typeof base) => ps.filter((p) => p.kind === "circle" || (p.kind === "rect" && p.fill !== "band"));
    expect(shapes(styled)).toEqual(shapes(base));
    expect(styled.filter((p) => p.kind === "text" && p.text.startsWith("note "))).toHaveLength(11); // first line of each of the 6 + 5 columns
    // Band grey is clamped so shading can never read as a mark.
    expect(styled.find((p) => p.kind === "rect" && p.fill === "band")).toMatchObject({ grey: 0.88 });
    // Everything is bold except the small card-ID caption, which stays narrow beside the ID strip.
    expect(styled.filter((p) => p.kind === "text" && !p.bold).map((p) => p.kind === "text" && p.text)).toEqual(["CARD test-card v1"]);
  });

  it("render band grey in SVG and PDF", async () => {
    const svg = renderCardSvg({ ...TEST_LAYOUT, printStyle: { bandGrey: 0.9 }, groups: [{ ...TEST_LAYOUT.groups[0], bands: { fromXMm: 30, toXMm: 190 } }] });
    expect(svg).toContain('fill="#e6e6e6"');
    expect(svg).not.toContain('fill="#ededed"');
    const pdf = await renderCardPdf({ ...TEST_LAYOUT, printStyle: { bandGrey: 0.88 }, groups: [{ ...TEST_LAYOUT.groups[0], colNotes: ["With breakfast", "", "", "", "", ""] }] });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
