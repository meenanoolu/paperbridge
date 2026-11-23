import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../../scripts/lib/photo";
import { bubbleCenters, checkLayout, checkPrintedText, decode, fiducialCenters, idBits, printedBoxes, renderCardPdf } from "../../../core";
import { adaptedFileName, adaptedNextWeekCard, focusNoteCandidates, nextCardMonday } from "../adaptive";
import { DEFAULT_CARE_SETTINGS } from "../card-settings";
import { historyPatterns } from "../history";
import { interpretCareCard } from "../interpret";
import { ELDER_LAYOUT, ELDER_LAYOUTS } from "../layout";
import { applyPreset, REGIMEN_PRESETS } from "../presets";
import { sampleHistory } from "../sample-history";
import { ELDER_SAMPLE_SPECS } from "../samples/specs";

const scan = decode(decodeJpeg(readFileSync(join(__dirname, "../samples/missed-dose.jpg"))), ELDER_LAYOUT);
if (!scan.ok) throw new Error("sample did not decode");
const weekPatterns = interpretCareCard(scan).patterns;
const SAMPLE = sampleHistory(new Date("2026-11-22T12:00:00"));
const historyPats = historyPatterns(SAMPLE);

describe("Adaptive Paper Loop: Print Adapted Next-Week Card", () => {
  it("is offered only when a pattern was found", () => {
    expect(weekPatterns.map((p) => p.title)).toEqual(["3 of 4 missed doses were Night Meds"]);
    expect(adaptedNextWeekCard(DEFAULT_CARE_SETTINGS, [], "2026-11-30")).toBeNull();
    const normal = decode(decodeJpeg(readFileSync(join(__dirname, "../samples/normal-week.jpg"))), ELDER_LAYOUT);
    expect(normal.ok && interpretCareCard(normal).patterns).toEqual([]);
  });

  it("starts the Monday after the latest known week, or the next Monday for an undated card", () => {
    expect(nextCardMonday(["2026-11-23"], new Date("2026-11-25T09:00:00"))).toBe("2026-11-30");
    expect(nextCardMonday(["2026-11-25", "2026-11-09", ""], new Date("2026-12-31T09:00:00"))).toBe("2026-11-30");
    expect(nextCardMonday(["", ""], new Date("2026-11-25T09:00:00"))).toBe("2026-11-30");
    expect(nextCardMonday([], new Date("2026-11-30T09:00:00"))).toBe("2026-12-07");
  });

  it("prints a bold focus note in the footer and frames the affected column header", () => {
    const a = adaptedNextWeekCard({ ...DEFAULT_CARE_SETTINGS, patientName: "Rosa" }, weekPatterns, "2026-11-30")!;
    expect(a.focusCol).toBe("pm");
    for (const { layout, note, highlight } of a.layouts) {
      expect(note).toBe("Focus this week: Night Meds. Take it at the same time each day.");
      expect(highlight).toBe("frame");
      expect(layout.footer!.lines).toHaveLength(2); // never grows: Letter has no room
      expect(layout.footer!.lines[1]).toBe(note);
      expect(layout.footer!.boldLines).toEqual([1]);
      expect(layout.groups[0]).toMatchObject({ colHighlights: [1], colHighlightStyle: "frame" });
      expect(layout.groups[0].title).toBe("Week of 30 Nov - 6 Dec 2026");
      expect(printedBoxes(layout).filter((b) => b.text === "[highlight frame]")).toHaveLength(1);
    }
    expect(adaptedFileName({ ...DEFAULT_CARE_SETTINGS, patientName: "Rosa Martínez" }, a.weekStart, "A4")).toBe("care-card-adapted-rosa-martinez-2026-11-30-A4.pdf");
  });

  it("words a symptom pattern as a doctor check-in, and shortens the note only when it would collide", () => {
    const sym = historyPats[0];
    expect(sym.kind).toBe("symptom-miss");
    const notes = focusNoteCandidates(applyPreset(DEFAULT_CARE_SETTINGS, REGIMEN_PRESETS[0]), sym);
    expect(notes[0]).toBe("Focus this week: Metformin. Ask the doctor if dizziness or pain continues.");
    const a = adaptedNextWeekCard(applyPreset(DEFAULT_CARE_SETTINGS, REGIMEN_PRESETS[0]), historyPats, "2026-11-23")!;
    for (const x of a.layouts) {
      expect(notes).toContain(x.note);
      expect(x.note).toMatch(/Ask the doctor if dizziness or pain continues\.$/);
      // "Metformin + BP Pill" sits next to "Metformin": no room for a box, so a double underline.
      expect(x.highlight).toBe("underline");
    }
  });

  it("every adapted card (presets x languages x modes x papers) passes the layout and printed-text checks, with identical geometry", () => {
    for (const language of [undefined, "te", "hi", "es"] as const)
      for (const s of [DEFAULT_CARE_SETTINGS, ...REGIMEN_PRESETS.map((p) => applyPreset({ ...DEFAULT_CARE_SETTINGS, patientName: "Rosa Martínez" }, p))])
        for (const highVisibility of [false, true])
          for (const icons of [false, true])
            for (const patterns of [weekPatterns, historyPats]) {
              const a = adaptedNextWeekCard({ ...s, language, highVisibility, icons }, patterns, "2026-12-28")!;
              for (const { layout, note, highlight } of a.layouts) {
                const base = ELDER_LAYOUTS.find((l) => l.page === layout.page)!;
                expect(note).not.toBe("");
                expect(highlight).not.toBeNull();
                expect(checkLayout(layout).ok).toBe(true);
                expect(checkPrintedText(layout)).toEqual([]);
                expect(bubbleCenters(layout)).toEqual(bubbleCenters(base));
                expect(fiducialCenters(layout)).toEqual(fiducialCenters(base));
                expect(idBits(layout)).toEqual(idBits(base));
              }
            }
  });

  it("a photographed adapted card decodes bubble for bubble like the standard card, and renders a 1-page PDF", async () => {
    const spec = ELDER_SAMPLE_SPECS.find((s) => s.id === "missed-dose")!;
    const states = (l: typeof ELDER_LAYOUT, layout: typeof ELDER_LAYOUT) => {
      const r = decode(decodeJpeg(encodeJpeg(photographSample(l, spec))), layout);
      if (!r.ok) throw new Error(r.reason);
      return r.bubbles.map((b) => b.state);
    };
    const a = adaptedNextWeekCard({ ...DEFAULT_CARE_SETTINGS, icons: true }, weekPatterns, "2026-11-30")!;
    for (const [i, { layout }] of a.layouts.entries()) {
      expect(states(layout, ELDER_LAYOUTS[i])).toEqual(states(ELDER_LAYOUTS[i], ELDER_LAYOUTS[i]));
      expect((await PDFDocument.load(await renderCardPdf(layout))).getPageCount()).toBe(1);
    }
  });
});
