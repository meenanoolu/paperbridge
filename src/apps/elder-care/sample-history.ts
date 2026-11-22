import { applyPreset, REGIMEN_PRESETS } from "./presets";
import { DEFAULT_CARE_SETTINGS, mondayOf, type CareCardSettings } from "./card-settings";
import { addWeek, localIsoDate, weekEntryId, type WeekEntry } from "./history";
import type { Day } from "./layout";
import type { Slot } from "./patterns";

/**
 * "Load 4-Week Sample History": four realistic saved weeks for a clearly named demo patient, so a
 * first-time visitor sees the trend, patterns, Doctor Visit Summary and PDF without scanning.
 * Adherence slides 93% -> 86% -> 79% -> 71%; most misses are the evening Metformin on low-energy
 * days (a symptom-to-miss pattern and an evening routine barrier); week 3 has 1 mark checked by hand.
 */
export const SAMPLE_PATIENT = "Sample patient (demo)";

/** The demo patient's card: the BP & Diabetes preset. Used for the Doctor PDF's medication list. */
export const SAMPLE_CARD: CareCardSettings = applyPreset({ ...DEFAULT_CARE_SETTINGS, patientName: SAMPLE_PATIENT }, REGIMEN_PRESETS[0]);

interface WeekPlan {
  missed: [Day, Slot][];
  lowEnergyDays: Day[];
  symptomDays: Day[];
  hydrationDays: number;
  manualOverrides: number;
}

const PLAN: WeekPlan[] = [
  { missed: [["Thu", "Night"]], lowEnergyDays: ["Thu"], symptomDays: [], hydrationDays: 6, manualOverrides: 0 },
  { missed: [["Tue", "Night"], ["Fri", "Night"]], lowEnergyDays: ["Tue", "Fri"], symptomDays: ["Fri"], hydrationDays: 5, manualOverrides: 0 },
  { missed: [["Mon", "Night"], ["Wed", "Night"], ["Sat", "Morning"]], lowEnergyDays: ["Mon", "Wed"], symptomDays: ["Wed"], hydrationDays: 5, manualOverrides: 1 },
  { missed: [["Mon", "Night"], ["Tue", "Night"], ["Thu", "Night"], ["Sun", "Morning"]], lowEnergyDays: ["Mon", "Tue", "Thu", "Fri"], symptomDays: ["Tue", "Thu"], hydrationDays: 4, manualOverrides: 0 },
];

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** The 4 weeks before the current one, oldest first. Pure: `now` is a parameter. */
export function sampleHistory(now: Date): WeekEntry[] {
  const thisMonday = mondayOf(localIsoDate(now));
  const doseLabels = { Morning: SAMPLE_CARD.labels.am, Night: SAMPLE_CARD.labels.pm };
  let list: WeekEntry[] = [];
  PLAN.forEach((w, i) => {
    const weekStart = addDays(thisMonday, -7 * (PLAN.length - i));
    const scannedAt = `${addDays(weekStart, 7)}T10:00:00.000Z`;
    const missed = w.missed.map(([day, slot]) => ({ day, slot }));
    list = addWeek(list, {
      id: weekEntryId(SAMPLE_PATIENT, weekStart, scannedAt),
      savedAt: now.toISOString(),
      scannedAt,
      weekStart,
      patientName: SAMPLE_PATIENT,
      adherencePct: Math.round(((14 - missed.length) / 14) * 100),
      taken: 14 - missed.length,
      counted: 14,
      missed,
      symptomDays: w.symptomDays,
      lowEnergyDays: w.lowEnergyDays,
      hydrationDays: w.hydrationDays,
      needsReview: 0,
      manualOverrides: w.manualOverrides,
      doseLabels,
    }).list;
  });
  return list;
}
