import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { parseScanAlert } from "../../../../crew-app/ui/src/alerts";
import { decode } from "../../../core";
import { applyManualOverrides, countActiveOverrides } from "../../../shell/overrides";
import { DEFAULT_CARE_SETTINGS, type CareCardSettings } from "../card-settings";
import { interpretCareCard, toScanAlert } from "../interpret";
import { ELDER_LAYOUT } from "../layout";
import { applyPreset, REGIMEN_PRESETS } from "../presets";
import { alertCardLanguage, elderShareText, elderSpokenSummary } from "../voice";

const raw = decode(decodeJpeg(readFileSync(join(__dirname, "../samples/missed-dose.jpg"))), ELDER_LAYOUT);
if (!raw.ok) throw new Error("sample did not decode");
const overrides = { "care/Wed/water": "filled" as const };
const checked = applyManualOverrides(raw, overrides);
const n = countActiveOverrides(raw, overrides);
const report = interpretCareCard(checked);
const ROSA: CareCardSettings = { ...DEFAULT_CARE_SETTINGS, patientName: "Rosa Martínez" };

describe("Elder Care: Read Aloud", () => {
  it("speaks adherence, misses, symptoms, the pattern's focus and the hand-check count, in English by default", () => {
    expect(elderSpokenSummary(report, ROSA, n)).toEqual({
      text: "71 percent of doses were taken this week. 4 doses were missed. Dizziness or pain was marked on 2 days. Focus this week: Night Meds. 1 mark was checked by hand.",
      lang: "en-US",
    });
  });

  it("speaks in the card's language with its BCP 47 tag", () => {
    expect(elderSpokenSummary(report, { ...ROSA, language: "te" }, n)).toEqual({
      text: "ఈ వారం 71 శాతం మందులు వేసుకున్నారు. 4 మోతాదులు తప్పిపోయాయి. 2 రోజులు తల తిరగడం లేదా నొప్పి గుర్తించారు. ఈ వారం శ్రద్ధ: రాత్రి మందులు. 1 గుర్తులను చేతితో తనిఖీ చేశారు.",
      lang: "te-IN",
    });
    expect(elderSpokenSummary(report, { ...ROSA, language: "hi" }, 0)).toMatchObject({ lang: "hi-IN", text: expect.stringMatching(/^इस सप्ताह 71 प्रतिशत दवाएँ ली गईं। .*इस सप्ताह ध्यान: रात की दवा।$/) });
    expect(elderSpokenSummary(report, { ...ROSA, language: "es" }, 0)).toMatchObject({ lang: "es-ES", text: expect.stringContaining("Esta semana: Pastillas Noche.") });
    // A medicine name the caregiver typed stays as typed.
    expect(elderSpokenSummary(report, applyPreset({ ...ROSA, language: "hi" }, REGIMEN_PRESETS[0]), 0).text).toContain("इस सप्ताह ध्यान: Metformin।");
    expect(elderSpokenSummary(report, { ...ROSA, language: "other" }, 0).lang).toBeUndefined();
  });
});

describe("Elder Care: Copy Quick Update", () => {
  it("writes a warm 4-line family update with the name, adherence, flag and hand-check count", () => {
    expect(elderShareText(report, ROSA, n).split("\n")).toEqual([
      "Weekly care update for Rosa Martínez:",
      "Took 71% of doses this week (10 of 14).",
      "Worth asking about: 3 of 4 missed doses were Night Meds.",
      "Manually verified (1) on the paper card.",
    ]);
  });

  it("still reads well with no pattern, no name, and nothing missed", () => {
    const clean = { ...report, patterns: [], missed: [], symptomDays: [], adherencePct: 100, taken: 14, counted: 14 };
    expect(elderShareText(clean, DEFAULT_CARE_SETTINGS, 0).split("\n")).toEqual([
      "Weekly care update:",
      "Took 100% of doses this week (14 of 14).",
      "No missed doses or symptoms marked.",
      "Every mark on the card was clear.",
    ]);
    const noPattern = { ...report, patterns: [] };
    expect(elderShareText(noPattern, ROSA, 0).split("\n")[2]).toBe("4 missed (Tue PM, Thu AM, Thu PM, Sat PM); dizzy or pain on Thu, Fri.");
  });
});

describe("Elder Care: cardLanguage in the Kiro Crew alert", () => {
  const at = new Date("2026-11-23T10:00:00Z");
  it("is omitted for English cards, so existing alerts are unchanged", () => {
    expect(alertCardLanguage(ROSA)).toBeUndefined();
    expect(alertCardLanguage({ ...ROSA, language: "en" })).toBeUndefined();
    expect(alertCardLanguage({ ...ROSA, language: "other" })).toBeUndefined();
    expect(toScanAlert(report, raw.cardId, at, n)).not.toHaveProperty("cardLanguage");
  });

  it("is the card's BCP 47 tag for translated cards, and pastes into Kiro Crew unchanged", () => {
    for (const [language, tag] of [["te", "te-IN"], ["hi", "hi-IN"], ["es", "es-ES"]] as const) {
      const alert = toScanAlert(report, raw.cardId, at, n, alertCardLanguage({ ...ROSA, language }));
      expect(alert.cardLanguage).toBe(tag);
      expect(parseScanAlert(JSON.stringify(alert, null, 2))).toEqual(alert);
    }
  });
});
