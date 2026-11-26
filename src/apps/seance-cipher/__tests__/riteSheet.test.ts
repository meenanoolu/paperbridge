import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { bubbleCenters, bubbleKey, checkLayout, checkPrintedText, decode, fiducialCenters, idBits, idCode, pageSizeMm, printedBoxes, renderCardPdf, renderCardRaster, renderCardSvg, validateLayoutJson } from "../../../core";
import { idBubbleCenters } from "../../../core/layout";
import { BUBBLE_STROKE_MM } from "../../../core/render/primitives";
import { decodeBestFit, routeRaster } from "../../../shell/route";
import { routableApps } from "../../../shell/app-registry";
import { RITE_GLYPH_GAP_MM, RITE_GLYPH_MM, RITE_RUNE_COUNT, RITE_RUNE_NAMES, riteSlot, SEANCE_LAYOUT, SEANCE_LAYOUTS, SEANCE_RITE_LAYOUTS } from "../layout";
import { classifyCoverage, confirmCoverage, createGame, INTRO_MS, PERFECT, startGame, tick } from "../riteEngine";
import { modelWithCoverage, riteSheetPdf, riteSheetSvg, runeGlyphBox, sheetSnapshot } from "../riteSheet";
import { coverageFromScan, runeKey } from "../riteVision";
import { GLYPH_UNITS, RUNE_GLYPHS } from "../runeGlyphs";
import { photographSvg, sheetWithCover } from "./rite-helpers";

const sample = (file: string) => decodeJpeg(readFileSync(join(__dirname, "../samples", file)));
const EM_DASH = /[\u2013\u2014]/;

describe("the X-Ray Rite sheet keeps the Oracle card's 12 bubbles and card ID", () => {
  it("is the same 3 x 4 grid, corner markers and ID strip on A4 and Letter", () => {
    expect(SEANCE_RITE_LAYOUTS.map((l) => [l.id, l.version, l.page])).toEqual([
      ["seance-cipher", 1, "A4"],
      ["seance-cipher", 1, "Letter"],
    ]);
    SEANCE_RITE_LAYOUTS.forEach((rite, i) => {
      const oracle = SEANCE_LAYOUTS[i];
      expect(bubbleCenters(rite)).toEqual(bubbleCenters(oracle));
      expect(fiducialCenters(rite)).toEqual(fiducialCenters(oracle));
      expect(idBubbleCenters(rite)).toEqual(idBubbleCenters(oracle));
      expect(idBits(rite)).toEqual(idBits(oracle));
      expect(idCode(rite)).toBe(idCode(SEANCE_LAYOUT));
      expect(rite.groups.map((g) => [g.key, g.rows, g.cols, g.originMm, g.pitchMm, g.radiusMm])).toEqual(oracle.groups.map((g) => [g.key, g.rows, g.cols, g.originMm, g.pitchMm, g.radiusMm]));
    });
    expect(bubbleCenters(SEANCE_RITE_LAYOUTS[0])).toHaveLength(12);
  });

  it("names the 12 runes in reading order, each beside its own bubble", () => {
    expect([...RITE_RUNE_NAMES]).toEqual(["Skull", "Bat", "Ghost", "Pumpkin", "Eye", "Moon", "Candle", "Cross", "Spider", "Bone", "Coffin", "Star"]);
    expect(RITE_RUNE_COUNT).toBe(12);
    for (const l of SEANCE_RITE_LAYOUTS) {
      expect(l.groups.flatMap((g) => g.colLabels)).toEqual(RITE_RUNE_NAMES.map((n, i) => `${i + 1} ${n}`));
      const keys = bubbleCenters(l).map((b) => bubbleKey(b.group, b.row, b.col));
      expect(Array.from({ length: 12 }, (_, i) => runeKey(i))).toEqual(keys);
      expect(Array.from({ length: 12 }, (_, i) => riteSlot(i)).map((s) => bubbleKey(s.group, s.row, s.col))).toEqual(keys);
    }
  });

  it("passes the Layout Validator (geometry and printed text) on both papers, with no em dashes printed", () => {
    for (const l of SEANCE_RITE_LAYOUTS) {
      expect(checkLayout(l)).toMatchObject({ ok: true, errors: [] });
      expect(checkPrintedText(l)).toEqual([]);
      expect(validateLayoutJson(JSON.parse(JSON.stringify(l)), { checkText: true })).toMatchObject({ ok: true, errors: [] });
      for (const t of printedBoxes(l)) expect(t.text).not.toMatch(EM_DASH);
    }
  });
});

describe("the 12 runes are drawn inside their zones, clear of everything else", () => {
  it("has a picture for every rune, in ink, inside its 10 x 10 box", () => {
    expect(RUNE_GLYPHS).toHaveLength(12);
    RUNE_GLYPHS.forEach((shapes, i) => {
      expect(shapes.some((s) => s.fill === "black"), RITE_RUNE_NAMES[i]).toBe(true);
      for (const s of shapes) {
        expect(s.d).toMatch(/^M[\d. -]+/);
        const nums = (s.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
        expect(nums.length).toBeGreaterThan(5);
        for (const n of nums) expect(n, `${RITE_RUNE_NAMES[i]} ${s.d.slice(0, 30)}`).toBeGreaterThanOrEqual(-0.01);
        for (const n of nums) expect(n).toBeLessThanOrEqual(GLYPH_UNITS + 0.01);
      }
    });
  });

  it("places each rune centred under its bubble, off the bubble, inside the margin, clear of text, markers and the ID strip", () => {
    for (const l of SEANCE_RITE_LAYOUTS) {
      const page = pageSizeMm(l);
      const inset = l.fiducial.insetMm;
      const half = l.fiducial.sizeMm / 2;
      const solids = [
        ...fiducialCenters(l).map(([x, y]) => ({ x0: x - half, y0: y - half, x1: x + half, y1: y + half })),
        ...[...bubbleCenters(l), ...idBubbleCenters(l)].map((b) => ({ x0: b.x - b.r - BUBBLE_STROKE_MM, y0: b.y - b.r - BUBBLE_STROKE_MM, x1: b.x + b.r + BUBBLE_STROKE_MM, y1: b.y + b.r + BUBBLE_STROKE_MM })),
        ...printedBoxes(l).map((t) => ({ x0: t.x0, y0: t.y0, x1: t.x1, y1: t.y1 })),
      ];
      const hit = (a: { x0: number; y0: number; x1: number; y1: number }, b: typeof a, gap: number) => a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.y0 < b.y1 + gap && a.y1 > b.y0 - gap;
      const boxes = Array.from({ length: 12 }, (_, i) => ({ i, box: runeGlyphBox(l, i) })).map(({ i, box }) => ({ i, box, rect: { x0: box.x, y0: box.y, x1: box.x + box.size, y1: box.y + box.size } }));
      const bubbles = bubbleCenters(l);
      for (const { i, box, rect } of boxes) {
        expect(box.size).toBe(RITE_GLYPH_MM);
        expect(box.x + box.size / 2).toBeCloseTo(bubbles[i].x, 6);
        expect(box.y).toBeCloseTo(bubbles[i].y + bubbles[i].r + RITE_GLYPH_GAP_MM, 6);
        expect(rect.x0).toBeGreaterThanOrEqual(inset);
        expect(rect.x1).toBeLessThanOrEqual(page.width - inset);
        expect(rect.y1).toBeLessThanOrEqual(page.height - inset);
        // Never inside any bubble: the white centres stay blank.
        expect(solids.some((s) => hit(rect, s, 0.4)), `${l.page} rune ${i + 1} ${RITE_RUNE_NAMES[i]} touches something`).toBe(false);
        for (const other of boxes) if (other.i !== i) expect(hit(rect, other.rect, 2), `runes ${i + 1} and ${other.i + 1} are too close`).toBe(false);
      }
    }
  });

  it("draws all 12 runes in the SVG and keeps the core's card", () => {
    const svg = riteSheetSvg(SEANCE_RITE_LAYOUTS[0]);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain("CARD seance-cipher v1");
    for (const name of RITE_RUNE_NAMES) expect(svg).toContain(`aria-label="${name} rune"`);
    expect(svg.match(/<g transform="translate\(/g)).toHaveLength(12);
    expect(svg.length).toBeGreaterThan(renderCardSvg(SEANCE_RITE_LAYOUTS[0]).length);
    expect(svg).not.toMatch(EM_DASH);
  });

  it("prints a 1-page vector PDF with the runes on A4 and Letter, the same bytes every time", async () => {
    for (const [l, widthPt] of [
      [SEANCE_RITE_LAYOUTS[0], 595.28],
      [SEANCE_RITE_LAYOUTS[1], 612],
    ] as const) {
      const bytes = await riteSheetPdf(l);
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(doc.getPage(0).getWidth()).toBeCloseTo(widthPt, 0);
      expect((await renderCardPdf(l)).length).toBeLessThan(bytes.length);
      expect(Buffer.from(await riteSheetPdf(l)).equals(Buffer.from(bytes))).toBe(true);
      expect(doc.getTitle()).toBe("X-Ray Rite (seance-cipher v1)");
    }
  });
});

describe("a photographed sheet reads clean: the runes never touch the bubbles", () => {
  it("decodes, with all 12 white centres blank, exactly like the card without runes", () => {
    const l = SEANCE_RITE_LAYOUTS[0];
    const flat = decode(photographSvg(l, riteSheetSvg(l)), l);
    const bare = decode(photographSvg(l, renderCardSvg(l)), l);
    if (!flat.ok || !bare.ok) throw new Error("decode");
    expect(flat.cardId).toBe("seance-cipher");
    const cover = coverageFromScan(flat)!;
    expect(cover).toHaveLength(12);
    for (const c of cover) expect(c).toBeLessThan(0.05);
    expect(flat.bubbles.every((b) => b.state === "blank")).toBe(true);
    expect(coverageFromScan(bare)!.every((c, i) => Math.abs(c - cover[i]) < 0.03)).toBe(true);
  });

  it("reads nothing when the sheet is not in view", () => {
    const l = SEANCE_RITE_LAYOUTS[0];
    expect(coverageFromScan(decode(renderCardRaster(l, new Set(), { omitFiducials: [0] }), l))).toBeNull();
  });
});

describe("existing sample cards keep routing and decoding (A4 and Letter)", () => {
  for (const file of ["lantern-hall.jpg", "smudged-seance.jpg"])
    it(`${file} decodes the same on the Rite sheet and on the Oracle card, and routes to Seance Cipher`, () => {
      const photo = sample(file);
      const a = decodeBestFit(photo, SEANCE_RITE_LAYOUTS);
      const b = decodeBestFit(photo, SEANCE_LAYOUTS);
      if (!a.result.ok || !b.result.ok) throw new Error("decode");
      expect(a.layout.page).toBe("A4");
      expect(a.result.bubbles.map((x) => [x.group, x.col, x.state])).toEqual(b.result.bubbles.map((x) => [x.group, x.col, x.state]));
      const routed = routeRaster(photo, routableApps());
      expect(routed.ok && routed.app.id).toBe("seance-cipher");
    });
});

describe("cover readings from the optical decoder, through the simulated camera", () => {
  const read = (svg: string, camera?: Parameters<typeof photographSvg>[2]) => {
    const l = SEANCE_RITE_LAYOUTS[0];
    const r = decode(photographSvg(l, svg, camera), l);
    const c = coverageFromScan(r);
    if (!c) throw new Error("no decode");
    return c;
  };
  const l = SEANCE_RITE_LAYOUTS[0];
  const others = (c: number[], i: number) => Math.max(...c.filter((_, k) => k !== i));

  it("a dark token or a dark finger over a bubble is a full cover (0.48 or more)", () => {
    for (const rot of [-5, 8]) {
      const token = read(sheetWithCover(l, 0, "#111111", 1, 1), { scale: 1.1, rotationDeg: rot, seed: 3, noiseSigma: 3 });
      expect(token[0]).toBeGreaterThanOrEqual(PERFECT);
      expect(classifyCoverage(token[0])).toBe("covered");
      expect(others(token, 0)).toBeLessThan(0.05);
    }
    const finger = read(sheetWithCover(l, 6, "#3b2a22", 0.95, 1.05));
    expect(finger[6]).toBeGreaterThanOrEqual(PERFECT);
    expect(others(finger, 6)).toBeLessThan(0.05);
    // Covering only most of the bubble still counts.
    expect(read(sheetWithCover(l, 3, "#3b2a22", 0.95, 0.6))[3]).toBeGreaterThanOrEqual(PERFECT);
  });

  it("a shaky half cover reads as the Trembling Hand (0.22 to 0.47)", () => {
    const half = read(sheetWithCover(l, 4, "#3b2a22", 0.95, 1, 6));
    expect(classifyCoverage(half[4])).toBe("trembling");
    // A pale fingertip in bright light only darkens the bubble partway: the thresholds are the game's, the lighting is the player's.
    const pale = read(sheetWithCover(l, 8, "#c99a7c", 0.85, 1.05));
    expect(pale[8]).toBeGreaterThanOrEqual(0.22);
    expect(pale[8]).toBeLessThan(PERFECT);
  });

  it("feeds the game: a covered target banishes after the camera noise guard, a half cover only trembles", () => {
    let s = tick(startGame(createGame(5)), INTRO_MS, null);
    const rune = s.targets[0].rune;
    const covered = read(sheetWithCover(l, rune, "#111111", 1, 1));
    // Frame 2 agrees with frame 1, so the cover counts.
    const hit = tick(s, 100, confirmCoverage(covered, covered));
    expect(hit.events.some((e) => e.type === "banish")).toBe(true);
    // Straight after the sheet appears there is only one frame, so nothing counts yet.
    expect(tick(s, 100, confirmCoverage(null, covered)).events.some((e) => e.type === "banish")).toBe(false);

    const half = read(sheetWithCover(l, rune, "#3b2a22", 0.95, 1, 6));
    s = tick(s, 100, confirmCoverage(half, half));
    expect(s.trembling).toBe(true);
    expect(s.score).toBe(0);
  });
});

describe("the frozen X-Ray for the Game Over receipt", () => {
  it("colours each rune by the game's thresholds, marking the runes still standing", () => {
    const l = SEANCE_RITE_LAYOUTS[0];
    const cover = Array.from({ length: 12 }, () => 0);
    cover[0] = 0.9;
    cover[1] = 0.3;
    const frame = sheetSnapshot(l, cover, [5]);
    expect(frame.width).toBe(Math.round(pageSizeMm(l).width * 3));
    expect(frame.imageUrl.startsWith("data:image/svg+xml")).toBe(true);
    const state = (i: number) => frame.model.bubbles.find((b) => b.key === runeKey(i))!.state;
    expect([state(0), state(1), state(5), state(7)]).toEqual(["filled", "unclear", "unclear", "blank"]);
    expect(frame.model.counts).toEqual({ filled: 1, unclear: 2, blank: 9 });
    expect(frame.model.bubbles.find((b) => b.key === runeKey(0))!.score).toBe("0.90");
    expect(frame.model.corners).toHaveLength(4);
    expect(frame.alt).not.toMatch(EM_DASH);
  });

  it("keeps a camera model's positions and only re-colours it", () => {
    const l = SEANCE_RITE_LAYOUTS[0];
    const base = sheetSnapshot(l, Array.from({ length: 12 }, () => 0)).model;
    const recoloured = modelWithCoverage(base, Array.from({ length: 12 }, () => 1));
    expect(recoloured.bubbles.map((b) => [b.x, b.y, b.r])).toEqual(base.bubbles.map((b) => [b.x, b.y, b.r]));
    expect(recoloured.counts.filled).toBe(12);
  });
});
