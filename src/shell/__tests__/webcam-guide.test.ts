import { describe, expect, it } from "vitest";
import { ELDER_LAYOUT } from "../../apps/elder-care/layout";
import { ALIGN_PROMPT, guideFor, guideGeometry } from "../webcam-guide";

const ok = { ok: true as const, cardId: "c", layoutVersion: 1, fiducials: [] as [number, number][], bubbles: [] };

describe("webcam guide state", () => {
  it("prompts to align before any frame and when markers are missing", () => {
    expect(guideFor(null, 0)).toMatchObject({ tone: "starting", locked: false, message: ALIGN_PROMPT });
    expect(guideFor({ ok: false, reason: "FIDUCIALS_NOT_FOUND" }, 0)).toMatchObject({ tone: "searching", locked: false, message: ALIGN_PROMPT });
  });

  it("gives specific help for a too-small or wrong card", () => {
    expect(guideFor({ ok: false, reason: "HOMOGRAPHY_DEGENERATE" }, 0).message).toMatch(/closer/);
    expect(guideFor({ ok: false, reason: "CARD_ID_MISMATCH" }, 0)).toMatchObject({ locked: false, message: expect.stringMatching(/different/) });
  });

  it("locks when all 4 corners decode", () => {
    expect(guideFor(ok, 1)).toEqual({ tone: "locked", locked: true, message: "4/4 corners locked. Hold steady..." });
    expect(guideFor(ok, 0).message).toMatch(/unclear/);
  });
});

describe("webcam guide geometry", () => {
  it("draws a centred card-shaped target with 4 brackets", () => {
    const g = guideGeometry(1280, 720, ELDER_LAYOUT);
    expect(g.h).toBeCloseTo(633.6, 1);
    expect(g.w / g.h).toBeCloseTo(210 / 297, 5);
    expect(g.x + g.w / 2).toBeCloseTo(640, 5);
    expect(g.path.match(/M/g)).toHaveLength(4);
  });

  it("fits a portrait frame by width", () => {
    const g = guideGeometry(400, 1000, ELDER_LAYOUT);
    expect(g.w).toBeCloseTo(368, 5);
    expect(g.h).toBeLessThanOrEqual(1000);
  });
});
