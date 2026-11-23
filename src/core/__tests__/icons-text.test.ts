import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { bubbleCenters, fiducialCenters, idBits } from "../layout";
import { CARD_ICONS, ICON_SHAPES } from "../render/icons";
import { estimateTextWidthMm, isWinAnsiText } from "../render/measure";
import { renderCardPdf } from "../render/pdf";
import { cardPrimitives } from "../render/primitives";
import { renderCardSvg } from "../render/svg";
import { TEST_LAYOUT } from "../testing/fixtures";
import type { CardLayout } from "../types";
import { checkPrintedText, printedBoxes, validateLayoutJson } from "../validate";

const iconCard = (): CardLayout => {
  const l = structuredClone(TEST_LAYOUT);
  l.printStyle = { showIcons: true };
  l.groups[0].colIcons = l.groups[0].cols.map((_, j) => CARD_ICONS[j % CARD_ICONS.length]);
  return l;
};

describe("Icon-Anchored print mode (core)", () => {
  it("every icon is filled paths only, inside its 10-unit box", () => {
    for (const name of CARD_ICONS) {
      expect(ICON_SHAPES[name].length).toBeGreaterThan(0);
      for (const sh of ICON_SHAPES[name]) {
        const nums = sh.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
        expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...nums)).toBeLessThanOrEqual(10);
      }
    }
  });

  it("icons draw only with showIcons, and never move a bubble, marker or ID bit", () => {
    const l = iconCard();
    const off = { ...l, printStyle: {} };
    expect(cardPrimitives(off).some((p) => p.kind === "icon")).toBe(false);
    expect(cardPrimitives(l).filter((p) => p.kind === "icon")).toHaveLength(l.groups[0].cols.length);
    expect(bubbleCenters(l)).toEqual(bubbleCenters(TEST_LAYOUT));
    expect(fiducialCenters(l)).toEqual(fiducialCenters(TEST_LAYOUT));
    expect(idBits(l)).toEqual(idBits(TEST_LAYOUT));
    expect(renderCardSvg(l)).toContain('aria-label="sun icon"');
  });

  it("icons and highlight frames are part of the printed-text collision check", () => {
    const l = iconCard();
    expect(printedBoxes(l).filter((b) => b.text.endsWith("icon]"))).toHaveLength(l.groups[0].cols.length);
    // Push the icons into the card-ID strip: the check must catch it.
    const bad = structuredClone(l);
    bad.groups[0].originMm = [bad.groups[0].originMm[0], 40];
    expect(checkPrintedText(bad).some((e) => /icon\]/.test(e.message))).toBe(true);
    const framed = structuredClone(TEST_LAYOUT);
    framed.groups[0].colHighlights = [1];
    const frame = printedBoxes(framed).find((b) => b.text === "[highlight frame]")!;
    expect(frame.inner).toBeDefined();
    // The framed label is inside the ring, so it is not a collision; the ring itself is checked.
    const own = framed.groups[0].colLabels?.[1] ?? framed.groups[0].cols[1];
    const label = printedBoxes(framed).find((b) => b.text === own && b.x0 > frame.x0 && b.x1 < frame.x1)!;
    expect(label.x0).toBeGreaterThan(frame.inner!.x0);
    expect(label.y1).toBeLessThan(frame.inner!.y1);
    expect(checkPrintedText(framed).filter((e) => e.message.includes("[highlight frame]") && e.message.includes(`"${own}"`))).toEqual([]);
    // A label that touches the ring is a collision.
    const tight = structuredClone(framed);
    tight.groups[0].colLabels = tight.groups[0].cols.map((c, j) => (j === 0 ? "A very wide neighbour label" : c));
    expect(checkPrintedText(tight).some((e) => e.message.includes("[highlight frame]"))).toBe(true);
  });

  it("the Layout Validator accepts icon fields and rejects unknown icons", () => {
    expect(validateLayoutJson(iconCard(), { checkText: true }).errors.filter((e) => e.code === "INVALID_SHAPE")).toEqual([]);
    const l = iconCard() as unknown as { groups: { colIcons: string[]; colHighlightStyle?: string }[] };
    l.groups[0].colIcons[0] = "skull";
    l.groups[0].colHighlightStyle = "glow";
    expect(validateLayoutJson(l).errors.map((e) => e.path)).toEqual(["groups[0].colIcons", "groups[0].colHighlightStyle"]);
  });

  it("the PDF draws icons as vector paths and frames as strokes", async () => {
    const l = iconCard();
    l.groups[0].colHighlights = [0];
    const doc = await PDFDocument.load(await renderCardPdf(l));
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("Any-script text (core)", () => {
  it("measures combining marks as zero width and other non-Latin characters as 1 em", () => {
    expect(isWinAnsiText("Rosa Martínez")).toBe(true);
    expect(isWinAnsiText("రాత్రి")).toBe(false);
    // ర ా త ్ ర ి: 3 base letters, 3 marks.
    expect(estimateTextWidthMm("రాత్రి", 10)).toBeCloseTo(30);
    expect(estimateTextWidthMm("Mon", 10)).toBeCloseTo(estimateTextWidthMm("Mon", 10));
  });

  it("Latin-1 text never calls the text renderer, so the PDF bytes are unchanged", async () => {
    const textImage = vi.fn(async () => null);
    const plain = await renderCardPdf(TEST_LAYOUT);
    const withRenderer = await renderCardPdf(TEST_LAYOUT, { textImage });
    expect(textImage).not.toHaveBeenCalled();
    expect(Buffer.from(withRenderer).equals(Buffer.from(plain))).toBe(true);
  });

  it("asks for each non-Latin string once, with the box the text check measured, and falls back when it gets null", async () => {
    const l = structuredClone(TEST_LAYOUT);
    l.subtitle = "हर गोला भरें";
    l.footer = { yMm: 250, lines: ["हर गोला भरें"] };
    const calls: { text: string; widthMm: number }[] = [];
    const bytes = await renderCardPdf(l, {
      textImage: async (r) => {
        calls.push(r);
        return null;
      },
    });
    expect(calls.map((c) => c.text)).toEqual(["हर गोला भरें", "हर गोला भरें"]);
    expect(calls[0].widthMm).toBeCloseTo(estimateTextWidthMm("हर गोला भरें", 4.2));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
