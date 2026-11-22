/**
 * Integration tests: the shipped apps' printed cards against the core Layout Validator.
 * They live outside src/core so the core has no imports from src/apps, even in tests.
 */
import { describe, expect, it } from "vitest";
import { ELDER_LAYOUTS } from "../apps/elder-care/layout";
import { STUDY_LAYOUTS } from "../apps/study-bridge/layout";
import { checkLayout, checkPrintedText, validateLayoutJson, type CardLayout } from "../core";

const clone = (l: CardLayout): CardLayout => structuredClone(l);

describe("shipped app layouts pass the core Layout Validator", () => {
  it("every shipped layout passes checkLayout", () => {
    for (const l of [...ELDER_LAYOUTS, ...STUDY_LAYOUTS]) {
      const r = checkLayout(l);
      expect(r.errors).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });

  it("every shipped card passes checkPrintedText", () => {
    for (const l of [...ELDER_LAYOUTS, ...STUDY_LAYOUTS]) expect(checkPrintedText(l)).toEqual([]);
  });

  it("flags a Study sheet header line that runs into the card-ID strip", () => {
    const l = clone(STUDY_LAYOUTS[0]);
    l.subtitle = "Fill one circle per question. Erase fully to change.";
    expect(checkPrintedText(l).map((e) => e.message)).toContain('Text "Fill one circle per question. Erase f..." touches the card-ID strip.');
  });

  it("flags Elder Care column notes that collide with the next column and text off the page", () => {
    const l = clone(ELDER_LAYOUTS[0]);
    l.groups[0].colNotes = ["A very long routine anchor line", "", "", ""];
    l.footer = { yMm: 280, lines: ["x".repeat(80)] };
    const codes = checkPrintedText(l).map((e) => e.code);
    expect(codes).toContain("TEXT_OVERLAP");
    expect(codes).toContain("TEXT_OUT_OF_BOUNDS");
  });

  it("the printed-text check is opt-in on validateLayoutJson", () => {
    const l = clone(STUDY_LAYOUTS[0]);
    l.subtitle = "Fill one circle per question. Erase fully to change.";
    expect(validateLayoutJson(l).ok).toBe(true);
    expect(validateLayoutJson(l, { checkText: true })).toMatchObject({ ok: false, errors: [{ code: "TEXT_OVERLAP", message: expect.stringMatching(/touches the card-ID strip/) }] });
  });
});
