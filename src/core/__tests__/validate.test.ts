import { describe, expect, it } from "vitest";
import { ELDER_LAYOUTS } from "../../apps/elder-care/layout";
import { STUDY_LAYOUTS } from "../../apps/study-bridge/layout";
import { validateLayout } from "../layout";
import { TEST_LAYOUT, TEST_LAYOUT_LETTER } from "../testing/fixtures";
import type { CardLayout } from "../types";
import { checkLayout, validateLayoutJson } from "../validate";

const codes = (l: unknown) => validateLayoutJson(l).errors.map((e) => e.code);
const clone = (l: CardLayout): CardLayout => structuredClone(l);

describe("checkLayout (Layout Validator)", () => {
  it("passes every shipped layout and the test fixtures", () => {
    for (const l of [...ELDER_LAYOUTS, ...STUDY_LAYOUTS, TEST_LAYOUT, TEST_LAYOUT_LETTER]) {
      const r = checkLayout(l);
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
    }
    expect(checkLayout(TEST_LAYOUT).stats).toEqual({ groups: 2, bubbles: 58, page: "A4", pageMm: { width: 210, height: 297 } });
  });

  it("fails overlapping bubbles in one group with both IDs and the distance", () => {
    const l = clone(TEST_LAYOUT);
    l.groups[0].pitchMm = [8, 22]; // radius 5: centres 8 mm apart overlap
    const r = checkLayout(l);
    expect(r.ok).toBe(false);
    const first = r.errors.find((e) => e.code === "BUBBLE_OVERLAP")!;
    expect(first.bubbles).toEqual(["grid/r1/c1", "grid/r1/c2"]);
    expect(first.message).toBe("Bubbles grid/r1/c1 and grid/r1/c2 are 8 mm apart (centres); they need at least 11 mm and currently overlap.");
  });

  it("catches overlap across groups that validateLayout cannot see", () => {
    const l = clone(TEST_LAYOUT);
    l.groups[1].originMm = [52, 77]; // second group drawn on top of the first
    expect(validateLayout(l)).toEqual([]);
    expect(codes(l)).toContain("BUBBLE_OVERLAP");
    expect(checkLayout(l).errors[0].bubbles).toEqual(["grid/r1/c1", "scale/e1/1"]);
  });

  it("fails a bubble inside a corner marker's quiet zone, naming the corner", () => {
    const l = clone(TEST_LAYOUT);
    l.groups = [{ key: "x", rows: ["a"], cols: ["b"], originMm: [190, 280], pitchMm: [0, 0], radiusMm: 4 }];
    const r = checkLayout(l);
    expect(r.errors.map((e) => e.code)).toEqual(["FIDUCIAL_OVERLAP"]);
    expect(r.errors[0].message).toMatch(/^Bubble x\/a\/b at \(190, 280\) mm is inside the bottom-right corner marker's quiet zone/);
  });

  it("fails bubbles past the page margins with the edge and amount", () => {
    const l = clone(TEST_LAYOUT_LETTER);
    l.groups[1].originMm = [50, 272];
    const out = checkLayout(l).errors.filter((e) => e.code === "OUT_OF_BOUNDS");
    expect(out).toHaveLength(10); // both rows (y=272 and y=286) of 5 bubbles
    expect(out[0].message).toBe("Bubble scale/e1/1 at (50, 272) mm, r=4.5 goes past the bottom margin by 3.1 mm (page 215.9x279.4 mm, margin 6 mm).");
  });

  it("fails bubbles over the card-ID strip", () => {
    const l = clone(TEST_LAYOUT);
    l.groups.push({ key: "hdr", rows: ["a"], cols: ["b"], originMm: [140, 14], pitchMm: [0, 0], radiusMm: 3 });
    expect(codes(l)).toContain("ID_STRIP_OVERLAP");
  });

  it("requires unique IDs", () => {
    const l = clone(TEST_LAYOUT);
    l.groups[1].key = "grid";
    l.groups[0].rows[1] = "r1";
    l.groups.push({ ...l.groups[1], key: "_id", originMm: [50, 200], rows: ["z"] });
    const msgs = checkLayout(l).errors.filter((e) => e.code === "DUPLICATE_ID").map((e) => e.message);
    expect(msgs).toEqual([
      'Group key "grid" is used more than once. Bubble IDs (group/row/col) must be unique.',
      'Group "grid" has row "r1" more than once.',
      'Group key "_id" is reserved for the card-ID strip.',
    ]);
  });

  it("reports shape errors with JSON paths instead of throwing", () => {
    expect(validateLayoutJson(null)).toMatchObject({ ok: false, errors: [{ code: "INVALID_SHAPE", path: "$" }] });
    const r = validateLayoutJson({ id: "x", version: 1, title: "T", page: "A5", fiducial: { sizeMm: 16, insetMm: 6 }, groups: [{ key: "g", rows: ["a"], cols: [1], originMm: [1], pitchMm: [1, 1], radiusMm: -2 }] });
    expect(r.errors.map((e) => e.path)).toEqual(["page", "groups[0].cols", "groups[0].originMm", "groups[0].radiusMm"]);
    expect(r.errors[0].message).toBe('page: expected "A4" or "Letter"');
  });

  it("caps the number of listed overlap pairs", () => {
    const l = clone(TEST_LAYOUT);
    l.groups[0].pitchMm = [2, 2];
    const overlaps = checkLayout(l).errors.filter((e) => e.code === "BUBBLE_OVERLAP");
    expect(overlaps).toHaveLength(26);
    expect(overlaps[25].message).toMatch(/^\d+ more bubble pairs are too close/);
  });
});

describe("checkPrintedText", () => {
  it("passes every shipped card", async () => {
    const { checkPrintedText } = await import("../validate");
    for (const l of [...ELDER_LAYOUTS, ...STUDY_LAYOUTS]) expect(checkPrintedText(l)).toEqual([]);
  });

  it("flags a header line that runs into the card-ID strip", async () => {
    const { checkPrintedText } = await import("../validate");
    const l = clone(STUDY_LAYOUTS[0]);
    l.subtitle = "Fill one circle per question. Erase fully to change.";
    expect(checkPrintedText(l).map((e) => e.message)).toContain('Text "Fill one circle per question. Erase f..." touches the card-ID strip.');
  });

  it("flags column notes that collide with the next column and text off the page", async () => {
    const { checkPrintedText } = await import("../validate");
    const l = clone(ELDER_LAYOUTS[0]);
    l.groups[0].colNotes = ["A very long routine anchor line", "", "", ""];
    l.footer = { yMm: 280, lines: ["x".repeat(80)] };
    const codes = checkPrintedText(l).map((e) => e.code);
    expect(codes).toContain("TEXT_OVERLAP");
    expect(codes).toContain("TEXT_OUT_OF_BOUNDS");
  });

  it("is opt-in on validateLayoutJson", () => {
    const l = clone(STUDY_LAYOUTS[0]);
    l.subtitle = "Fill one circle per question. Erase fully to change.";
    expect(validateLayoutJson(l).ok).toBe(true);
    expect(validateLayoutJson(l, { checkText: true })).toMatchObject({ ok: false, errors: [{ code: "TEXT_OVERLAP", message: expect.stringMatching(/touches the card-ID strip/) }] });
  });
});
