import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { decode } from "../../../core";
import { applyManualOverrides } from "../../../shell/overrides";
import { DEFAULT_CARE_SETTINGS, type CareCardSettings } from "../card-settings";
import { addWeek, formatDoctorSummary, parseHistory, patientsIn, toWeekEntry, trend, weeksFor, type WeekEntry } from "../history";
import { interpretCareCard } from "../interpret";
import { ELDER_LAYOUT } from "../layout";

function sampleReport(file: string, overrides = {}) {
  const r = decode(decodeJpeg(readFileSync(join(__dirname, "../samples", file))), ELDER_LAYOUT);
  if (!r.ok) throw new Error(r.reason);
  return interpretCareCard(applyManualOverrides(r, overrides));
}

const rosa = (weekStart: string): CareCardSettings => ({
  patientName: "Rosa Martínez",
  weekStart,
  labels: { am: "Metformin 500mg - Morning", pm: "BP Pill - Evening", water: "Water 6 cups", dizzy: "Dizzy or Pain" },
});

function threeWeeks(): WeekEntry[] {
  const saved = new Date("2026-12-07T09:00:00Z");
  let list: WeekEntry[] = [];
  const add = (file: string, week: string, scanned: string, overrides = {}, manual = 0) => {
    list = addWeek(list, toWeekEntry(sampleReport(file, overrides), { scannedAt: new Date(scanned), savedAt: saved, card: rosa(week), manualOverrides: manual })).list;
  };
  // Added out of order on purpose.
  add("missed-dose.jpg", "2026-11-23", "2026-11-30T10:00:00Z", { "care/Wed/water": "filled" }, 1);
  add("normal-week.jpg", "2026-11-16", "2026-11-23T10:00:00Z");
  add("tilted-low-light.jpg", "2026-11-30", "2026-12-07T10:00:00Z");
  return list;
}

describe("week history", () => {
  it("keeps weeks oldest first and replaces a re-saved week", () => {
    const list = threeWeeks();
    expect(list.map((e) => [e.weekStart, e.adherencePct])).toEqual([
      ["2026-11-16", 100],
      ["2026-11-23", 71],
      ["2026-11-30", 93],
    ]);
    const again = addWeek(list, { ...list[1], adherencePct: 79, scannedAt: "2026-12-01T10:00:00Z" });
    expect(again.replaced).toBe(true);
    expect(again.list).toHaveLength(3);
    expect(again.list[1].adherencePct).toBe(79);
  });

  it("computes week-over-week change", () => {
    expect(trend(threeWeeks()).map((t) => t.delta)).toEqual([null, -29, 22]);
  });

  it("separates patients", () => {
    const list = threeWeeks();
    const other = toWeekEntry(sampleReport("normal-week.jpg"), {
      scannedAt: new Date("2026-11-23T10:00:00Z"),
      savedAt: new Date(),
      card: { ...DEFAULT_CARE_SETTINGS, patientName: "Sam Lee", weekStart: "2026-11-16" },
      manualOverrides: 0,
    });
    const mixed = addWeek(list, other).list;
    expect(patientsIn(mixed)).toEqual(["Rosa Martínez", "Sam Lee"]);
    expect(weeksFor(mixed, " rosa  martínez ")).toHaveLength(3);
  });

  it("round-trips through storage and drops corrupt entries", () => {
    const list = threeWeeks();
    const stored = JSON.parse(JSON.stringify([...list, { scannedAt: "x" }, { ...list[0], taken: 20 }, 5]));
    expect(parseHistory(stored)).toEqual(list);
    expect(parseHistory("nope")).toBeNull();
  });
});

describe("doctor visit summary", () => {
  it("formats saved weeks as a deterministic Markdown summary", () => {
    const text = formatDoctorSummary(threeWeeks(), { patientName: "Rosa Martínez", generatedAt: new Date(2026, 11, 7, 12) });
    expect(text).toBe(
      [
        "# Medication adherence summary: Rosa Martínez",
        "",
        "Generated 7 Dec 2026 from 3 PaperBridge Weekly Care Cards: 16 Nov - 22 Nov 2026 to 30 Nov - 6 Dec 2026.",
        "",
        "## Overview",
        "",
        "- Doses taken: 37 of 42 recorded (88%). Goal: 80% or more.",
        "- Weekly adherence: 71% to 100%; 1 of 3 weeks below goal.",
        "- Missed doses: 5 (BP Pill - Evening: 4; Metformin 500mg - Morning: 1).",
        "- Days with no doses at all: 1.",
        "- Days with dizziness or pain: 3.",
        "- Days with low energy (2 or below on a 1-5 scale): 2.",
        "- Trend: down 7 points from the first to the latest week.",
        "",
        "## Week by week",
        "",
        "| Week | Adherence | Missed doses | Dizzy or pain | Low energy | Water 6+ cups |",
        "|---|---|---|---|---|---|",
        "| 16 Nov - 22 Nov 2026 | 100% (14/14) | none | none | none | 6 of 7 days |",
        "| 23 Nov - 29 Nov 2026 | 71% (10/14) | Tue PM, Thu AM, Thu PM, Sat PM | Thu, Fri | Thu, Fri | 4 of 7 days |",
        "| 30 Nov - 6 Dec 2026 | 93% (13/14) | Sun PM | Mon | none | 6 of 7 days |",
        "",
        "## About this data",
        "",
        "- Recorded by the patient on a paper card with a pen and read by PaperBridge's deterministic scanner (no AI interpretation).",
        "- Unclear marks are never guessed: they are left out of the counts unless a caregiver checked the paper card.",
        "- 1 unclear mark was checked by hand by the caregiver.",
      ].join("\n"),
    );
  });

  it("handles no weeks and unnamed patients", () => {
    expect(formatDoctorSummary([], { patientName: "", generatedAt: new Date(2026, 0, 1) })).toBe(
      "# Medication adherence summary: Unnamed patient\n\nNo weeks saved yet.",
    );
  });
});
