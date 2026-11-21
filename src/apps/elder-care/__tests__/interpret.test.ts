import { describe, expect, it } from "vitest";
import { bubbleCenters, type BubbleState, type SuccessfulScan } from "../../../core";
import { interpretCareCard, toScanAlert } from "../interpret";
import { ELDER_LAYOUT } from "../layout";

/** Build a decoded scan directly: every bubble blank unless listed. */
function scanWith(states: Record<string, BubbleState>): SuccessfulScan {
  return {
    ok: true,
    cardId: ELDER_LAYOUT.id,
    layoutVersion: ELDER_LAYOUT.version,
    fiducials: [],
    bubbles: bubbleCenters(ELDER_LAYOUT).map((b) => ({
      group: b.group,
      row: b.row,
      col: b.col,
      state: states[`${b.group}/${b.row}/${b.col}`] ?? "blank",
      confidence: 1,
      fill: 0,
      at: [0, 0],
    })),
  };
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const allDoses = () => Object.fromEntries(DAYS.flatMap((d) => [[`care/${d}/am`, "filled"], [`care/${d}/pm`, "filled"]])) as Record<string, BubbleState>;

describe("interpretCareCard", () => {
  it("computes adherence as taken over scheduled doses", () => {
    const states = allDoses();
    states["care/Tue/pm"] = "blank";
    states["care/Thu/am"] = "blank";
    const r = interpretCareCard(scanWith(states));
    expect(r.scheduled).toBe(14);
    expect(r.taken).toBe(12);
    expect(r.adherencePct).toBe(86);
    expect(r.missed).toEqual([
      { day: "Tue", slot: "Night" },
      { day: "Thu", slot: "Morning" },
    ]);
  });

  it("excludes unclear doses from adherence and lists them for review (R5.9)", () => {
    const states = allDoses();
    states["care/Mon/am"] = "ambiguous";
    const r = interpretCareCard(scanWith(states));
    expect(r.counted).toBe(13);
    expect(r.taken).toBe(13);
    expect(r.adherencePct).toBe(100);
    expect(r.missed).toEqual([]);
    expect(r.needsReview).toContain("Monday morning meds");
  });

  it("flags symptom days", () => {
    const r = interpretCareCard(scanWith({ ...allDoses(), "care/Wed/dizzy": "filled", "care/Sat/dizzy": "filled" }));
    expect(r.symptomDays).toEqual(["Wed", "Sat"]);
    expect(r.alerts[0]).toMatchObject({ level: "high", title: "Dizzy or in pain on 2 days" });
  });

  it("reads one energy level per day and rejects double marks", () => {
    const r = interpretCareCard(scanWith({ "energy/Mon/4": "filled", "energy/Tue/2": "filled", "energy/Tue/3": "filled" }));
    expect(r.days[0].energy).toBe(4);
    expect(r.days[1].energy).toBeNull();
    expect(r.days[1].energyReview).toBe(true);
    expect(r.days[2].energy).toBeNull();
    expect(r.days[2].energyReview).toBe(false);
  });

  it("raises a high alert when both doses are missed on a day", () => {
    const states = allDoses();
    states["care/Fri/am"] = "blank";
    states["care/Fri/pm"] = "blank";
    const r = interpretCareCard(scanWith(states));
    expect(r.alerts.map((a) => a.title)).toContain("No medication at all on Friday");
  });

  it("returns null adherence when nothing can be counted", () => {
    const states = Object.fromEntries(DAYS.flatMap((d) => [[`care/${d}/am`, "ambiguous"], [`care/${d}/pm`, "ambiguous"]])) as Record<string, BubbleState>;
    expect(interpretCareCard(scanWith(states)).adherencePct).toBeNull();
  });

  it("builds an aggregate-only alert payload", () => {
    const states = allDoses();
    states["care/Sun/pm"] = "blank";
    const alert = toScanAlert(interpretCareCard(scanWith(states)), "elder-care-weekly", new Date("2026-11-21T10:00:00Z"));
    expect(alert).toMatchObject({ type: "paperbridge:scan-alert", severity: "medium", adherencePct: 93, scannedAt: "2026-11-21T10:00:00.000Z" });
    expect(JSON.stringify(alert)).not.toContain("bubbles");
  });
});
