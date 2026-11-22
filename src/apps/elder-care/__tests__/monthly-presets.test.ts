import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../../scripts/lib/photo";
import { bubbleCenters, checkLayout, checkPrintedText, decode, fiducialCenters, idBits, renderCardsPdf } from "../../../core";
import { customizedElderLayouts, DEFAULT_CARE_SETTINGS, parseCareSettings, validateSettings, type CareCardSettings } from "../card-settings";
import { interpretCareCard } from "../interpret";
import { ELDER_LAYOUT, ELDER_LAYOUTS } from "../layout";
import { monthlyPackLayouts, packFileName, packMondays, packTitle, packTitleCandidates } from "../monthly-pack";
import { applyPreset, REGIMEN_PRESETS } from "../presets";
import { ELDER_SAMPLE_SPECS } from "../samples/specs";

function drawnText(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const out: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let c: string;
    try {
      c = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      c = m[1];
    }
    for (const t of c.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out.push(Buffer.from(t[1], "hex").toString("latin1"));
  }
  return out;
}

const ROSA: CareCardSettings = applyPreset({ ...DEFAULT_CARE_SETTINGS, patientName: "Rosa Martínez", weekStart: "2026-12-16" }, REGIMEN_PRESETS[0]);

describe("4-Week Monthly Pack", () => {
  it("starts on the saved card's Monday and runs 4 consecutive weeks", () => {
    expect(packMondays("2026-12-16")).toEqual(["2026-12-14", "2026-12-21", "2026-12-28", "2027-01-04"]);
    expect(packMondays("")).toEqual([]);
    expect(monthlyPackLayouts({ ...ROSA, weekStart: "" }, "A4")).toEqual([]);
  });

  for (const highVisibility of [false, true])
    for (const page of ["A4", "Letter"] as const)
      it(`${page}${highVisibility ? " High-Visibility" : ""}: 4 dated pages, identical geometry, no text collisions`, () => {
        const s = { ...ROSA, highVisibility };
        const pack = monthlyPackLayouts(s, page);
        const base = ELDER_LAYOUTS.find((l) => l.page === page)!;
        expect(pack).toHaveLength(4);
        expect(pack.map((l) => l.groups[0].title)).toEqual([
          "Week 1 of 4: 14 Dec - 20 Dec 2026",
          "Week 2 of 4: 21 Dec - 27 Dec 2026",
          "Week 3 of 4: 28 Dec 2026 - 3 Jan 2027",
          "Week 4 of 4: 4 Jan - 10 Jan 2027",
        ]);
        expect(pack.map((l) => [l.groups[0].rowLabels![0], l.groups[0].rowLabels![6]])).toEqual([
          ["Mon 14", "Sun 20"],
          ["Mon 21", "Sun 27"],
          ["Mon 28", "Sun 3"],
          ["Mon 4", "Sun 10"],
        ]);
        for (const l of pack) {
          expect(l.page).toBe(page);
          expect(bubbleCenters(l)).toEqual(bubbleCenters(base));
          expect(fiducialCenters(l)).toEqual(fiducialCenters(base));
          expect(idBits(l)).toEqual(idBits(base));
          expect(checkLayout(l).errors).toEqual([]);
          expect(checkPrintedText(l)).toEqual([]);
          expect(l.subtitle).toBe("Patient: Rosa Martínez");
          expect(l.groups[0].colLabels).toEqual(customizedElderLayouts(s).find((x) => x.page === page)!.groups[0].colLabels);
          expect(l.groups[0].colNotes![0]).toContain("With breakfast");
          expect(l.printStyle).toEqual(highVisibility ? expect.objectContaining({ boldText: true }) : undefined);
        }
      });

  it("falls back to a shorter week heading only when the long one would collide", () => {
    expect(packTitleCandidates(3, 4, "2026-12-28", "2027-01-03")).toEqual([
      "Week 3 of 4: 28 Dec 2026 - 3 Jan 2027",
      "Week 3/4: 28 Dec 2026 - 3 Jan 2027",
      "Week 3/4: 28 Dec - 3 Jan 2027",
    ]);
  });

  it("renders one 4-page PDF with every week's heading and the patient on each page", async () => {
    const bytes = await renderCardsPdf(monthlyPackLayouts({ ...ROSA, highVisibility: true }, "Letter"), { title: packTitle(ROSA) });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(4);
    expect(doc.getTitle()).toBe("Weekly Care Cards, 4 weeks from 14 Dec 2026 - Rosa Martínez");
    for (let i = 0; i < 4; i++) expect(doc.getPage(i).getSize().height).toBeCloseTo((279.4 * 72) / 25.4, 1);
    const text = drawnText(bytes);
    for (let w = 1; w <= 4; w++) expect(text.some((t) => t.startsWith(`Week ${w} of 4: `))).toBe(true);
    expect(text.filter((t) => t === "Patient: Rosa Martínez")).toHaveLength(4);
    expect(text.filter((t) => t === "With breakfast")).toHaveLength(4);
    expect(packFileName(ROSA, "Letter")).toBe("care-cards-4-weeks-rosa-martinez-2026-12-14-Letter.pdf");
  });

  it("a photographed pack page decodes bubble for bubble like the standard card", () => {
    const spec = ELDER_SAMPLE_SPECS.find((s) => s.id === "missed-dose")!;
    const states = (l: typeof ELDER_LAYOUT) => {
      const r = decode(decodeJpeg(encodeJpeg(photographSample(l, spec))), ELDER_LAYOUT);
      if (!r.ok) throw new Error(r.reason);
      return r.bubbles.map((b) => b.state);
    };
    expect(states(monthlyPackLayouts({ ...ROSA, highVisibility: true }, "A4")[2])).toEqual(states(ELDER_LAYOUT));
  });
});

describe("Regimen presets", () => {
  it("each preset is valid and prints without collisions on A4 and Letter, standard and High-Visibility", () => {
    expect(REGIMEN_PRESETS.map((p) => p.name)).toEqual(["BP & Diabetes", "Post-Surgery Recovery", "Simple Morning & Night"]);
    for (const p of REGIMEN_PRESETS)
      for (const highVisibility of [false, true]) {
        // Worst case for width: the longest name that fits and a cross-year week.
        const s = applyPreset({ ...DEFAULT_CARE_SETTINGS, patientName: "Rosa Martínez", weekStart: "2026-12-28", highVisibility }, p);
        expect({ preset: p.id, highVisibility, problems: validateSettings(s) }).toEqual({ preset: p.id, highVisibility, problems: [] });
        for (const l of customizedElderLayouts(s)) {
          expect(checkLayout(l).ok).toBe(true);
          expect({ preset: p.id, highVisibility, page: l.page, text: checkPrintedText(l) }).toEqual({ preset: p.id, highVisibility, page: l.page, text: [] });
        }
      }
  });

  it("keeps each column's meaning: doses in columns 1-2, a habit in 3, the symptom in 4", () => {
    const bp = REGIMEN_PRESETS[0];
    expect(bp.labels).toEqual({ am: "BP Pill + Metformin", pm: "Metformin", water: "Water 6+ Cups", dizzy: "Dizzy or Pain" });
    expect([bp.anchors.am, bp.cues.am, bp.anchors.pm, bp.cues.pm, bp.anchors.water, bp.cues.water]).toEqual([
      "With breakfast",
      "White oval, large white",
      "After dinner",
      "Large white",
      "All day",
      "6 glasses",
    ]);
    for (const p of REGIMEN_PRESETS) expect(p.labels.dizzy).toMatch(/dizzy|pain/i);
  });

  it("applying a preset replaces the columns but keeps patient, week and print mode, and round-trips through storage", () => {
    const before: CareCardSettings = { ...DEFAULT_CARE_SETTINGS, patientName: "Ana", weekStart: "2026-11-23", highVisibility: true, anchors: { dizzy: "old" } };
    const after = applyPreset(before, REGIMEN_PRESETS[2]);
    expect(after).toMatchObject({ patientName: "Ana", weekStart: "2026-11-23", highVisibility: true, labels: REGIMEN_PRESETS[2].labels });
    expect(after.anchors).toEqual(REGIMEN_PRESETS[2].anchors);
    expect(after).not.toHaveProperty("cues");
    expect(parseCareSettings(JSON.parse(JSON.stringify(after)))).toEqual(after);
  });

  it("habit alerts name the printed habit instead of always saying water", () => {
    const r = decode(decodeJpeg(readFileSync(join(__dirname, "../samples/missed-dose.jpg"))), ELDER_LAYOUT);
    if (!r.ok) throw new Error(r.reason);
    const titles = (habitLabel?: string) => interpretCareCard(r, { habitLabel }).alerts.map((a) => a.title).filter((t) => /of 7 days/.test(t));
    expect(titles()).toEqual(["Enough water on only 3 of 7 days"]);
    expect(titles("Water 6+ Cups")).toEqual(["Enough water on only 3 of 7 days"]);
    expect(titles("Gentle Walk")).toEqual(["Gentle Walk: done on only 3 of 7 days"]);
  });
});

