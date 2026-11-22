import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { decode } from "../../../core";
import { addWeek, formatDoctorSummary, historyPatterns, toWeekEntry, type WeekEntry } from "../history";
import { interpretCareCard, toScanAlert } from "../interpret";
import type { Day } from "../layout";
import { ELDER_LAYOUT } from "../layout";
import { detectPatterns, SLOT_BARRIER_MIN_MISSES, SYMPTOM_MISS_MIN_DAYS, type WeekMarks } from "../patterns";

const night = (...days: Day[]) => days.map((day) => ({ day, slot: "Night" as const }));
const morning = (...days: Day[]) => days.map((day) => ({ day, slot: "Morning" as const }));
const week = (w: Partial<WeekMarks>): WeekMarks => ({ missed: [], symptomDays: [], lowEnergyDays: [], ...w });
const labels = { Morning: "Metformin 500mg", Night: "BP Pill - Evening" };

describe("symptom-to-miss co-occurrence", () => {
  it("flags evening misses on low-energy days, naming the dose and days", () => {
    const p = detectPatterns([week({ missed: night("Mon", "Wed", "Fri"), lowEnergyDays: ["Mon", "Wed", "Fri", "Sat"] })], labels);
    expect(p[0]).toEqual({
      kind: "symptom-miss",
      slot: "Night",
      symptom: "low-energy",
      count: 3,
      of: 3,
      title: "BP Pill - Evening missed on 3 days when low energy was marked",
      detail: "3 of 3 BP Pill - Evening misses fell on days with low energy (Monday, Wednesday, Friday). Possibly a side effect leading to skipped doses: worth asking about.",
    });
  });

  it(`needs at least ${SYMPTOM_MISS_MIN_DAYS} matching days`, () => {
    expect(detectPatterns([week({ missed: night("Mon"), symptomDays: ["Mon"] })])).toEqual([]);
    expect(detectPatterns([week({ missed: night("Mon", "Tue"), symptomDays: ["Mon", "Tue"] })]).map((p) => p.kind)).toEqual(["symptom-miss"]);
  });

  it("ignores chance overlap: matches must be at least half of that dose's misses", () => {
    // 2 of 5 night misses on dizzy days: not a pattern (the slot barrier still fires).
    const p = detectPatterns([week({ missed: night("Mon", "Tue", "Wed", "Thu", "Fri"), symptomDays: ["Mon", "Tue"] })]);
    expect(p.map((x) => x.kind)).toEqual(["slot-barrier"]);
  });

  it("counts each slot and symptom separately and deterministically", () => {
    const p = detectPatterns([week({ missed: [...morning("Tue", "Thu"), ...night("Tue", "Thu")], symptomDays: ["Tue", "Thu"], lowEnergyDays: ["Tue", "Thu"] })]);
    expect(p.map((x) => `${x.symptom}:${x.slot}`)).toEqual(["dizzy-pain:Morning", "dizzy-pain:Night", "low-energy:Morning", "low-energy:Night"]);
    expect(detectPatterns([week({ missed: night("Mon", "Wed"), symptomDays: ["Mon", "Wed"] })])).toEqual(detectPatterns([week({ missed: night("Mon", "Wed"), symptomDays: ["Mon", "Wed"] })]));
  });
});

describe("time-of-day barrier", () => {
  it("flags 4 of 5 misses in the evening", () => {
    const p = detectPatterns([week({ missed: [...night("Mon", "Tue", "Thu", "Sat"), ...morning("Fri")] })], labels);
    expect(p).toEqual([
      {
        kind: "slot-barrier",
        slot: "Night",
        count: 4,
        of: 5,
        title: "4 of 5 missed doses were BP Pill - Evening",
        detail: 'Misses cluster at one time of day: more likely a routine barrier than overall non-adherence. A routine anchor (e.g. "after dinner") or a different time may help.',
      },
    ]);
  });

  it(`needs at least ${SLOT_BARRIER_MIN_MISSES} misses and a 75% share`, () => {
    expect(detectPatterns([week({ missed: night("Mon", "Tue") })])).toEqual([]);
    expect(detectPatterns([week({ missed: [...night("Mon", "Tue"), ...morning("Wed", "Thu")] })])).toEqual([]); // 50/50
    expect(detectPatterns([week({ missed: [...night("Mon", "Tue", "Wed"), ...morning("Thu")] })]).map((p) => p.count)).toEqual([3]); // exactly 75%
  });

  it("aggregates across weeks without listing day names", () => {
    const p = detectPatterns([week({ missed: night("Mon"), lowEnergyDays: ["Mon"] }), week({ missed: night("Tue", "Wed"), lowEnergyDays: ["Tue"] })], labels);
    expect(p.map((x) => x.title)).toEqual(["BP Pill - Evening missed on 2 days when low energy was marked", "3 of 3 missed doses were BP Pill - Evening"]);
    expect(p[0].detail).toBe("2 of 3 BP Pill - Evening misses fell on days with low energy. Possibly a side effect leading to skipped doses: worth asking about.");
  });
});

describe("patterns in the report, alert and doctor summary", () => {
  const sample = () => {
    const r = decode(decodeJpeg(readFileSync(join(__dirname, "../samples/missed-dose.jpg"))), ELDER_LAYOUT);
    if (!r.ok) throw new Error(r.reason);
    return r;
  };

  it("the Missed-Dose sample shows an evening routine barrier, worded with the card's labels", () => {
    const r = interpretCareCard(sample(), { doseLabels: labels });
    expect(r.patterns.map((p) => p.title)).toEqual(["3 of 4 missed doses were BP Pill - Evening"]);
    expect(toScanAlert(r, "elder-care-weekly", new Date()).patterns).toEqual([{ kind: "slot-barrier", title: r.patterns[0].title, detail: r.patterns[0].detail }]);
  });

  it("a week with no pattern adds nothing to the alert", () => {
    const r = decode(decodeJpeg(readFileSync(join(__dirname, "../samples/normal-week.jpg"))), ELDER_LAYOUT);
    if (!r.ok) throw new Error(r.reason);
    expect(toScanAlert(interpretCareCard(r), "elder-care-weekly", new Date())).not.toHaveProperty("patterns");
  });

  it("history patterns feed an optional section of the doctor summary", () => {
    let list: WeekEntry[] = [];
    const card = { patientName: "Rosa", weekStart: "", labels: { am: "Metformin 500mg", pm: "BP Pill - Evening", water: "Water", dizzy: "Dizzy or Pain" } };
    for (const [weekStart, day] of [["2026-11-16", "Mon"], ["2026-11-23", "Wed"]] as const) {
      const report = { ...interpretCareCard(sample()), missed: night(day, "Sun"), lowEnergyDays: [day] as Day[], symptomDays: [] as Day[] };
      list = addWeek(list, toWeekEntry(report, { scannedAt: new Date(`${weekStart}T10:00:00Z`), savedAt: new Date(), card: { ...card, weekStart }, manualOverrides: 0 })).list;
    }
    const patterns = historyPatterns(list);
    expect(patterns.map((p) => p.title)).toEqual(["BP Pill - Evening missed on 2 days when low energy was marked", "4 of 4 missed doses were BP Pill - Evening"]);
    const text = formatDoctorSummary(list, { patientName: "Rosa", generatedAt: new Date(2026, 11, 1), patterns });
    expect(text).toContain("## Patterns to discuss\n\nFound by fixed rules over the marks above (no AI):\n\n- **BP Pill - Evening missed on 2 days when low energy was marked.** 2 of 4");
    expect(text.indexOf("## Patterns to discuss")).toBeLessThan(text.indexOf("## Week by week"));
    expect(formatDoctorSummary(list, { patientName: "Rosa", generatedAt: new Date(2026, 11, 1) })).not.toContain("Patterns");
  });
});
