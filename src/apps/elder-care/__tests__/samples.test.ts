import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { decode, validateLayout } from "../../../core";
import { interpretCareCard } from "../interpret";
import { ELDER_LAYOUT, ELDER_LAYOUTS } from "../layout";
import { ELDER_SAMPLE_SPECS } from "../samples/specs";

/** End to end: decode the checked-in sample JPEGs exactly as the browser does, then interpret. */
function reportFor(id: string) {
  const spec = ELDER_SAMPLE_SPECS.find((s) => s.id === id)!;
  const img = decodeJpeg(readFileSync(join(__dirname, "../samples", spec.file)));
  const result = decode(img, ELDER_LAYOUT);
  if (!result.ok) throw new Error(`${id} failed to decode: ${result.reason}`);
  return interpretCareCard(result);
}

describe("elder care layout", () => {
  it("is valid for A4 and Letter", () => {
    for (const l of ELDER_LAYOUTS) expect(validateLayout(l)).toEqual([]);
  });
});

describe("elder care sample cards", () => {
  it("Normal Week: full adherence, no alerts", () => {
    const r = reportFor("normal-week");
    expect(r.adherencePct).toBe(100);
    expect(r.missed).toEqual([]);
    expect(r.symptomDays).toEqual([]);
    expect(r.hydrationDays).toBe(6);
    expect(r.days.map((d) => d.energy)).toEqual([4, 4, 3, 4, 5, 4, 4]);
    expect(r.needsReview).toEqual([]);
    expect(r.alerts).toEqual([]);
  });

  it("Missed-Dose Alert: 71% adherence, Thursday fully missed, symptoms, one unclear mark", () => {
    const r = reportFor("missed-dose");
    expect(r.taken).toBe(10);
    expect(r.adherencePct).toBe(71);
    expect(r.missed).toEqual([
      { day: "Tue", slot: "Night" },
      { day: "Thu", slot: "Morning" },
      { day: "Thu", slot: "Night" },
      { day: "Sat", slot: "Night" },
    ]);
    expect(r.symptomDays).toEqual(["Thu", "Fri"]);
    expect(r.lowEnergyDays).toEqual(["Thu", "Fri"]);
    expect(r.needsReview).toEqual(["Wednesday water"]);
    expect(r.alerts.filter((a) => a.level === "high").map((a) => a.title)).toEqual([
      "Medication taken 71% of the time",
      "No medication at all on Thursday",
      "Dizzy or in pain on 2 days",
    ]);
  });

  it("Tilted/Low-Light: decodes exactly despite angle and shadow", () => {
    const r = reportFor("tilted-low-light");
    expect(r.adherencePct).toBe(93);
    expect(r.missed).toEqual([{ day: "Sun", slot: "Night" }]);
    expect(r.symptomDays).toEqual(["Mon"]);
    expect(r.hydrationDays).toBe(6);
    expect(r.days.map((d) => d.energy)).toEqual([3, 4, 4, 4, 3, 4, 3]);
    expect(r.needsReview).toEqual([]);
  });

  it("every sample matches its recipe bubble for bubble", () => {
    for (const spec of ELDER_SAMPLE_SPECS) {
      const result = decode(decodeJpeg(readFileSync(join(__dirname, "../samples", spec.file))), ELDER_LAYOUT);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const pen = new Set(spec.marks.filter((m) => (m.style ?? "pen") !== "faint").map((m) => m.key));
      const faint = new Set(spec.marks.filter((m) => m.style === "faint").map((m) => m.key));
      for (const b of result.bubbles) {
        const key = `${b.group}/${b.row}/${b.col}`;
        const expected = pen.has(key) ? "filled" : faint.has(key) ? "ambiguous" : "blank";
        expect({ key, state: b.state }).toEqual({ key, state: expected });
      }
    }
  });
});
