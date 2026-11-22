import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../../scripts/lib/photo";
import { validateCardLayout } from "../../../../mcp/tools";
import { bubbleCenters, checkLayout, checkPrintedText, decode, fiducialCenters, idBits, renderCardPdf, renderCardSvg, type CardLayout } from "../../../core";
import {
  customizeCareLayout,
  customizedElderLayouts,
  HIGH_VISIBILITY_STYLE,
  isDefaultSettings,
  MAX_NOTE,
  nameFitsHeader,
  parseCareSettings,
  validateSettings,
  wrapColumnLabel,
  wrapNote,
  type CareCardSettings,
} from "../card-settings";
import { CARE_COLS, ELDER_LAYOUT, ELDER_LAYOUTS } from "../layout";
import { ELDER_SAMPLE_SPECS } from "../samples/specs";

const ROUTINE: CareCardSettings = {
  patientName: "Rosa Martínez",
  weekStart: "2026-11-23",
  labels: { am: "Metformin 500mg", pm: "Lisinopril 10mg", water: "Water 6 cups", dizzy: "Dizzy or Pain" },
  anchors: { am: "With breakfast", pm: "After dinner", water: "Through the day" },
  cues: { am: "White oval", pm: "Small pink round" },
};
const HIGH_VIS: CareCardSettings = { ...ROUTINE, highVisibility: true };

const spec = ELDER_SAMPLE_SPECS.find((s) => s.id === "missed-dose")!;
/** Photograph `layout` with the Missed-Dose pen marks and decode it with the standard layout for its paper size. */
const states = (layout: CardLayout, camera = spec.camera) => {
  const standard = ELDER_LAYOUTS.find((l) => l.page === layout.page)!;
  const r = decode(decodeJpeg(encodeJpeg(photographSample(layout, { ...spec, camera }))), standard);
  if (!r.ok) throw new Error(r.reason);
  return r.bubbles.map((b) => `${b.group}/${b.row}/${b.col}=${b.state}`);
};

/** Longest string built from `alphabet` that `ok` still accepts. */
function longest(ok: (t: string) => boolean, alphabet: string, max: number): string {
  let t = "";
  while (t.length < max && ok(t + alphabet[t.length % alphabet.length])) t += alphabet[t.length % alphabet.length];
  return t;
}

describe("routine anchors and pill cues", () => {
  it("print under each column label without moving any bubble, marker or ID bit", () => {
    for (const base of ELDER_LAYOUTS) {
      const l = customizeCareLayout(base, ROUTINE);
      expect(bubbleCenters(l)).toEqual(bubbleCenters(base));
      expect(fiducialCenters(l)).toEqual(fiducialCenters(base));
      expect(idBits(l)).toEqual(idBits(base));
      expect(l.groups[0].colNotes).toEqual(["With breakfast\nWhite oval", "After dinner\nSmall pink\nround", "Through the\nday", ""]);
      expect(checkPrintedText(l)).toEqual([]);
    }
    const svg = renderCardSvg(customizedElderLayouts(ROUTINE)[0]);
    for (const t of ["With breakfast", "White oval", "After dinner", "Small pink", "round"]) expect(svg).toContain(`>${t}<`);
  });

  it("a photographed routine card decodes identically to the standard card", () => {
    const standard = states(ELDER_LAYOUT);
    expect(states(customizeCareLayout(ELDER_LAYOUT, ROUTINE))).toEqual(standard);
    expect(standard).toContain("care/Wed/water=ambiguous");
    // Same marks on US Letter, with the tilted low-light camera.
    const tilted = ELDER_SAMPLE_SPECS[2].camera;
    expect(states(customizeCareLayout(ELDER_LAYOUTS[1], ROUTINE), tilted)).toEqual(states(ELDER_LAYOUTS[1], tilted));
  });

  it("are validated: length, 2 printed lines, printable characters", () => {
    expect(validateSettings(ROUTINE)).toEqual([]);
    const bad = validateSettings({ ...ROUTINE, anchors: { am: "x".repeat(25), pm: "MMMM WWWW MMMM WWWW MMM" }, cues: { water: "蓝色" } });
    expect(bad.map((p) => [p.field, p.message])).toEqual([
      ["am.anchor", "Use at most 24 characters."],
      ["pm.anchor", "Too long to fit under the column. Keep it to 2 short lines."],
      ["water.cue", "These characters cannot be printed: 蓝 色"],
    ]);
  });

  it("persist only when set, so older saved settings round-trip unchanged", () => {
    const old = { patientName: "A", weekStart: "", labels: { am: "Morning Meds", pm: "Night Meds", water: "Water 6+ cups", dizzy: "Dizzy or Pain" } };
    expect(parseCareSettings(old)).toEqual(old);
    expect(parseCareSettings(JSON.parse(JSON.stringify(HIGH_VIS)))).toEqual(HIGH_VIS);
    expect(parseCareSettings({ ...old, anchors: { am: "  ", pm: 5, x: "y" }, cues: "nope", highVisibility: "yes" })).toEqual(old);
    expect(isDefaultSettings({ ...old, patientName: "", anchors: { am: "With lunch" } })).toBe(false);
    expect(isDefaultSettings({ ...old, patientName: "", highVisibility: true })).toBe(false);
  });
});

describe("High-Visibility print mode", () => {
  it("adds bold, larger labels and stronger shading but keeps geometry identical", () => {
    for (const base of ELDER_LAYOUTS) {
      const l = customizeCareLayout(base, HIGH_VIS);
      expect(l.printStyle).toEqual(HIGH_VISIBILITY_STYLE);
      expect(bubbleCenters(l)).toEqual(bubbleCenters(base));
      expect(fiducialCenters(l)).toEqual(fiducialCenters(base));
      expect(idBits(l)).toEqual(idBits(base));
      expect(checkLayout(l).errors).toEqual([]);
      expect(checkPrintedText(l)).toEqual([]);
    }
    const svg = renderCardSvg(customizedElderLayouts(HIGH_VIS)[0]);
    expect(svg).toContain('fill="#e6e6e6"'); // bands at 0.90 grey
    expect(svg).not.toMatch(/<text[^>]*font-size="5.06"[^>]*>(?!.*font-weight)/); // no regular-weight row labels
    // Bubble interiors stay pure white with the standard border.
    expect(svg.match(/<circle [^>]*r="6.5" fill="#fff" stroke="#000" stroke-width="0.5"\/>/g)).toHaveLength(28);
  });

  it("passes validate_card_layout (geometry and printed text)", () => {
    for (const l of customizedElderLayouts(HIGH_VIS)) {
      const r = validateCardLayout(JSON.parse(JSON.stringify(l)), { checkText: true });
      expect(r.errors).toEqual([]);
      expect(r.summary).toMatch(/^PASS: 63 bubbles in 2 groups/);
    }
  });

  it("a photographed High-Visibility card decodes bubble for bubble identically to the standard card (2 papers x 3 cameras)", () => {
    for (const base of ELDER_LAYOUTS)
      for (const { camera } of ELDER_SAMPLE_SPECS) {
        const hv = states(customizeCareLayout(base, HIGH_VIS), camera);
        expect(hv).toEqual(states(base, camera));
        // The deliberately faint mark on a shaded row still reads as unclear, never as blank.
        expect(hv).toContain("care/Wed/water=ambiguous");
      }
  });

  it("renders a one-page PDF", async () => {
    const pdf = await renderCardPdf(customizedElderLayouts(HIGH_VIS)[1]);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });
});

describe("worst-case printed text", () => {
  it("the longest valid name, labels, anchors and cues never collide, in both modes and paper sizes", () => {
    for (const highVisibility of [false, true]) {
      const base: CareCardSettings = { ...ROUTINE, highVisibility, weekStart: "2026-12-28" };
      const label = longest((t) => !!wrapColumnLabel(base, t), "MW mw ", 30);
      const note = longest((t) => !!wrapNote(base, t), "MW mw", MAX_NOTE);
      let name = "";
      while (nameFitsHeader(name + "W")) name += "W";
      const s: CareCardSettings = {
        ...base,
        patientName: name,
        labels: Object.fromEntries(CARE_COLS.map((c) => [c, label])) as CareCardSettings["labels"],
        anchors: Object.fromEntries(CARE_COLS.map((c) => [c, note])),
        cues: Object.fromEntries(CARE_COLS.map((c) => [c, note])),
      };
      expect(validateSettings(s)).toEqual([]);
      for (const l of customizedElderLayouts(s)) {
        expect(checkLayout(l).ok).toBe(true);
        expect({ highVisibility, page: l.page, problems: checkPrintedText(l) }).toEqual({ highVisibility, page: l.page, problems: [] });
      }
    }
  });

  it("wide capitals that pass the 9-character rule are re-wrapped to fit the column", () => {
    const s: CareCardSettings = { ...ROUTINE, labels: { ...ROUTINE.labels, am: "WARFARIN MORNING" } };
    expect(validateSettings(s)).toEqual([]);
    const l = customizeCareLayout(ELDER_LAYOUT, s);
    expect(l.groups[0].colLabels![0].split("\n").length).toBeLessThanOrEqual(3);
    expect(checkPrintedText(l)).toEqual([]);
  });
});
