import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../../scripts/lib/photo";
import { bubbleCenters, bubbleKey, checkLayout, checkPrintedText, decode, fiducialCenters, idBits, idCode, renderCardPdf, renderCardRaster, validateLayoutJson } from "../../../core";
import { applyManualOverrides } from "../../../shell/overrides";
import { ELDER_LAYOUT } from "../../elder-care/layout";
import { STUDY_LAYOUT } from "../../study-bridge/layout";
import { chapterLayouts, chapterOf, CHAPTERS, describeRune, RUNES, SEANCE_LAYOUT, SEANCE_LAYOUTS } from "../layout";
import { fateOf, readOracle, readingSummary, storyFor } from "../oracle";
import { SEANCE_SAMPLE_SPECS } from "../samples/specs";

const KEYS = bubbleCenters(SEANCE_LAYOUT).map((b) => bubbleKey(b.group, b.row, b.col));
const sample = (file: string) => {
  const r = decode(decodeJpeg(readFileSync(join(__dirname, "../samples", file))), SEANCE_LAYOUT);
  if (!r.ok) throw new Error(r.reason);
  return r;
};

describe("Oracle Cipher Card layout", () => {
  it("is 3 questions of 4 runes, drawn as vector icons, on A4 and Letter", () => {
    expect(SEANCE_LAYOUTS.map((l) => [l.id, l.page])).toEqual([
      ["seance-cipher", "A4"],
      ["seance-cipher", "Letter"],
    ]);
    expect(KEYS).toHaveLength(12);
    expect(SEANCE_LAYOUT.groups.map((g) => g.colIcons)).toEqual([0, 1, 2].map(() => ["moon", "eye", "key", "flame"]));
    expect(SEANCE_LAYOUT.printStyle?.showIcons).toBe(true);
  });

  it("every chapter passes the Layout Validator (geometry and printed text) and keeps the same circles", () => {
    for (const n of [1, 2, 3])
      for (const [i, l] of chapterLayouts(n).entries()) {
        expect(validateLayoutJson(JSON.parse(JSON.stringify(l)), { checkText: true })).toMatchObject({ ok: true, errors: [] });
        expect(checkLayout(l).ok).toBe(true);
        expect(checkPrintedText(l)).toEqual([]);
        expect(bubbleCenters(l)).toEqual(bubbleCenters(SEANCE_LAYOUTS[i]));
        expect(fiducialCenters(l)).toEqual(fiducialCenters(SEANCE_LAYOUTS[i]));
        expect(idBits(l)).toEqual(idBits(SEANCE_LAYOUT));
        expect(l.subtitle).toBe(`Chapter ${n}: ${CHAPTERS[n - 1].name}`);
      }
    expect(chapterOf(4).number).toBe(1);
  });

  it("has a card-ID code no other app uses", () => {
    expect(new Set([idCode(ELDER_LAYOUT), idCode(STUDY_LAYOUT), idCode(SEANCE_LAYOUT)]).size).toBe(3);
  });

  it("renders a 1-page PDF with the rune icons", async () => {
    const doc = await PDFDocument.load(await renderCardPdf(chapterLayouts(2)[1]));
    expect(doc.getPageCount()).toBe(1);
  });

  it("decodes any rune pattern under tilt, scale and uneven light (fast-check)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: KEYS.length, maxLength: KEYS.length }),
        fc.double({ min: -20, max: 20, noNaN: true }),
        fc.double({ min: 0.8, max: 1.4, noNaN: true }),
        (bits, rotationDeg, scale) => {
          const filled = new Set(KEYS.filter((_, i) => bits[i]));
          for (const layout of SEANCE_LAYOUTS) {
            const r = decode(renderCardRaster(layout, filled, { rotationDeg, scale, gradient: { angleRad: 1, strength: 0.3 } }), layout);
            expect(r.ok).toBe(true);
            if (r.ok) expect(new Set(r.bubbles.filter((b) => b.state === "filled").map((b) => bubbleKey(b.group, b.row, b.col)))).toEqual(filled);
          }
        },
      ),
      { numRuns: 8 },
    );
  });

  it("photographed chapter cards decode bubble for bubble like chapter 1", () => {
    const spec = SEANCE_SAMPLE_SPECS[1];
    const states = (l: typeof SEANCE_LAYOUT, base: typeof SEANCE_LAYOUT) => {
      const r = decode(decodeJpeg(encodeJpeg(photographSample(l, spec))), base);
      if (!r.ok) throw new Error(r.reason);
      return r.bubbles.map((b) => b.state);
    };
    for (const i of [0, 1]) expect(states(chapterLayouts(3)[i], SEANCE_LAYOUTS[i])).toEqual(states(SEANCE_LAYOUTS[i], SEANCE_LAYOUTS[i]));
  });
});

describe("The oracle's reading", () => {
  it("The Lantern Hall sample tells its story: Key, Flame, Moon", () => {
    const o = readOracle(sample("lantern-hall.jpg"), 1);
    expect(o.answers.map((a) => a.rune)).toEqual(["key", "flame", "moon"]);
    expect(o.complete).toBe(true);
    expect(o.prompt).toBeNull();
    expect(o.verdict).toEqual(storyFor(1, ["key", "flame", "moon"]));
    expect(o.verdict!.title).toBe("The Lantern Hall: The Veil Stays Open");
    expect(o.verdict!.story).toMatch(/^The old caretaker, rattling a ring of iron keys brings you into the hall/);
  });

  it("The Smudged Seance waits for a human before the spirits speak, then reveals the story", () => {
    const raw = sample("smudged-seance.jpg");
    const o = readOracle(raw, 1);
    expect(o.answers.map((a) => [a.status, a.rune])).toEqual([
      ["chosen", "eye"],
      ["unclear", null],
      ["chosen", "key"],
    ]);
    expect(o.verdict).toBeNull();
    expect(o.prompt).toBe("The veil is thin: a faint mark needs a human to confirm it before the spirits speak.");
    const confirmed = readOracle(applyManualOverrides(raw, { "q2/rune/moon": "filled" }), 1);
    expect(confirmed.answers.map((a) => a.rune)).toEqual(["eye", "moon", "key"]);
    expect(confirmed.verdict!.fate).toBe("veil");
    expect(readingSummary(confirmed)).toBe("Question 1: Eye, Question 2: Moon, Question 3: Key. The Lantern Hall: The Veil Stays Open");
  });

  it("never guesses: two runes or none leave the story unwritten", () => {
    const base = decode(renderCardRaster(SEANCE_LAYOUT, new Set(["q1/rune/moon", "q1/rune/eye", "q2/rune/key"])), SEANCE_LAYOUT);
    if (!base.ok) throw new Error(base.reason);
    const o = readOracle(base, 2);
    expect(o.answers.map((a) => a.status)).toEqual(["multiple", "chosen", "blank"]);
    expect(o.prompt).toBe("The spirits are confused: mark only one rune per question.");
    const blank = readOracle({ ...base, bubbles: base.bubbles.map((b) => ({ ...b, state: b.group === "q1" && b.col === "eye" ? "blank" : b.state })) }, 2);
    expect(blank.prompt).toBe("The question remains unanswered: mark one rune for every question.");
  });

  it("is deterministic: the majority rune sets the fate, a tie leaves the veil open", () => {
    expect(fateOf(["flame", "flame", "moon"])).toBe("flame");
    expect(fateOf(["eye", "eye", "eye"])).toBe("eye");
    expect(fateOf(["moon", "eye", "key"])).toBe("veil");
    for (const n of [1, 2, 3])
      for (const a of RUNES)
        for (const b of RUNES)
          for (const c of RUNES) {
            const s = storyFor(n, [a, b, c]);
            expect(s).toEqual(storyFor(n, [a, b, c]));
            expect(s.title.startsWith(`${CHAPTERS[n - 1].name}: `)).toBe(true);
            expect(s.story).not.toMatch(/undefined|\u2014/);
          }
    expect(describeRune({ group: "q2", row: "rune", col: "key" })).toBe("Question 2: Key");
  });
});
