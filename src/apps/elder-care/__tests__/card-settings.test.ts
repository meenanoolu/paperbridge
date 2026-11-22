import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../../scripts/lib/photo";
import { bubbleCenters, decode, fiducialCenters, idBits, renderCardSvg, validateLayout } from "../../../core";
import {
  customizeCareLayout,
  customizedElderLayouts,
  DEFAULT_CARE_SETTINGS,
  isDefaultSettings,
  fitNameToHeader,
  mondayOf,
  nameFitsHeader,
  parseCareSettings,
  printableText,
  validateSettings,
  weekDates,
  wrapLabel,
  type CareCardSettings,
} from "../card-settings";
import { ELDER_LAYOUT, ELDER_LAYOUTS } from "../layout";
import { ELDER_SAMPLE_SPECS } from "../samples/specs";

const CUSTOM: CareCardSettings = {
  patientName: "Rosa Martínez",
  weekStart: "2026-11-25", // a Wednesday: snaps to Monday 23 Nov
  labels: { am: "Metformin 500mg — Morning", pm: "BP Pill — Evening", water: "Water 6 cups", dizzy: "Dizzy or Pain" },
};

describe("customized care card geometry", () => {
  it("keeps every bubble, corner marker, and the card ID strip identical", () => {
    for (const base of ELDER_LAYOUTS) {
      const custom = customizeCareLayout(base, { ...CUSTOM, weekStart: mondayOf(CUSTOM.weekStart) });
      expect(bubbleCenters(custom)).toEqual(bubbleCenters(base));
      expect(fiducialCenters(custom)).toEqual(fiducialCenters(base));
      expect(idBits(custom)).toEqual(idBits(base));
      expect([custom.id, custom.version, custom.page]).toEqual([base.id, base.version, base.page]);
      expect(validateLayout(custom)).toEqual([]);
    }
  });

  it("never adds footer lines (Letter paper has no room above the bottom corner markers)", () => {
    for (const base of ELDER_LAYOUTS) {
      for (const settings of [CUSTOM, { ...CUSTOM, patientName: "" }, { ...CUSTOM, weekStart: "" }]) {
        expect(customizeCareLayout(base, settings).footer!.lines.length).toBe(base.footer!.lines.length);
      }
    }
  });

  it("formats week ranges across months and years", async () => {
    const { weekRange } = await import("../card-settings");
    expect(weekRange("2026-11-30", "2026-12-06")).toBe("30 Nov - 6 Dec 2026");
    expect(weekRange("2026-12-28", "2027-01-03")).toBe("28 Dec 2026 - 3 Jan 2027");
  });

  it("prints the patient, week, dated rows, and wrapped custom labels", () => {
    const svg = renderCardSvg(customizedElderLayouts({ ...CUSTOM, weekStart: "2026-11-23" })[0]);
    expect(svg).toContain(">Patient: Rosa Martínez<");
    expect(svg).toContain(">Week of 23 Nov - 29 Nov 2026<");
    expect(svg).toContain(">Fill each circle fully with a dark pen.<");
    expect(svg).toContain(">Mon 23<");
    expect(svg).toContain(">Sun 29<");
    for (const line of ["Metformin", "500mg -", "Morning", "BP Pill -", "Evening"]) expect(svg).toContain(`>${line}<`);
    expect(svg).not.toContain("—");
  });

  it("a photographed customized card decodes with the DEFAULT layout, bubble for bubble", () => {
    const spec = ELDER_SAMPLE_SPECS.find((s) => s.id === "missed-dose")!;
    const custom = customizeCareLayout(ELDER_LAYOUT, { ...CUSTOM, weekStart: "2026-11-23" });
    const photo = decodeJpeg(encodeJpeg(photographSample(custom, spec)));
    const result = decode(photo, ELDER_LAYOUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pen = new Set(spec.marks.filter((m) => m.style !== "faint").map((m) => m.key));
    const faint = new Set(spec.marks.filter((m) => m.style === "faint").map((m) => m.key));
    for (const b of result.bubbles) {
      const key = `${b.group}/${b.row}/${b.col}`;
      expect({ key, state: b.state }).toEqual({ key, state: pen.has(key) ? "filled" : faint.has(key) ? "ambiguous" : "blank" });
    }
  });

  it("the widest name that validates still passes the card-ID check", () => {
    let name = "";
    while (nameFitsHeader(name + "W")) name += "W";
    expect(name.length).toBeGreaterThan(8);
    expect(validateSettings({ ...CUSTOM, patientName: name })).toEqual([]);
    expect(validateSettings({ ...CUSTOM, patientName: name + "W" }).map((p) => p.field)).toEqual(["patientName"]);
    const custom = customizeCareLayout(ELDER_LAYOUT, { ...CUSTOM, patientName: name, weekStart: "2026-11-23" });
    const blank = { ...ELDER_SAMPLE_SPECS[0], marks: [] };
    for (const camera of [blank.camera, ELDER_SAMPLE_SPECS[2].camera]) {
      const result = decode(decodeJpeg(encodeJpeg(photographSample(custom, { ...blank, camera }))), ELDER_LAYOUT);
      expect(result.ok && result.bubbles.every((b) => b.state === "blank")).toBe(true);
    }
  });
});

describe("card settings helpers", () => {
  it("wraps labels to the column and rejects ones that cannot fit", () => {
    expect(wrapLabel("Metformin 500mg — Morning")).toEqual(["Metformin", "500mg -", "Morning"]);
    expect(wrapLabel("Hydrochlorothiazide")).toEqual(["Hydrochlo", "rothiazid", "e"]);
    expect(wrapLabel("one two three four five six seven")).toBeNull();
    expect(wrapLabel("   ")).toBeNull();
  });

  it("trims an over-long stored name instead of printing into the card-ID strip", () => {
    const long = "Bartholomew Wolfgang Montgomery-Whitworth";
    expect(nameFitsHeader(long)).toBe(false);
    const fitted = fitNameToHeader(long);
    expect(fitted.endsWith("...")).toBe(true);
    expect(nameFitsHeader(fitted)).toBe(true);
    expect(customizeCareLayout(ELDER_LAYOUT, { ...CUSTOM, patientName: long }).subtitle).toBe(`Patient: ${fitted}`);
  });

  it("maps typographic punctuation to printable text", () => {
    expect(printableText("  BP “pill” – evening… ")).toBe('BP "pill" - evening...');
  });

  it("snaps the week to Monday and lists 7 dates", () => {
    expect(mondayOf("2026-11-29")).toBe("2026-11-23");
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
    expect(mondayOf("2026-02-30")).toBe("");
    expect(weekDates("2026-12-28")).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  });

  it("validates fields with specific messages", () => {
    expect(validateSettings(DEFAULT_CARE_SETTINGS)).toEqual([]);
    expect(validateSettings(CUSTOM)).toEqual([]);
    const bad = validateSettings({ ...CUSTOM, patientName: "李雷", labels: { ...CUSTOM.labels, pm: "", water: "one two three four five six" } });
    expect(bad.map((p) => p.field)).toEqual(["patientName", "pm", "water"]);
  });

  it("parses stored settings defensively", () => {
    expect(parseCareSettings(null)).toBeNull();
    expect(parseCareSettings({ patientName: 7, weekStart: "2026-11-26", labels: { am: "Insulin", pm: "", x: "y" } })).toEqual({
      patientName: "",
      weekStart: "2026-11-23",
      labels: { ...DEFAULT_CARE_SETTINGS.labels, am: "Insulin" },
    });
    expect(isDefaultSettings(parseCareSettings({})!)).toBe(true);
  });
});
