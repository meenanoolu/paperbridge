import type { CareCardSettings, CareCol } from "./card-settings";

/**
 * One-click starter regimens for the Customize Card panel. Each sets the 4 column labels,
 * routine anchors and pill cues; the patient, week and print mode are kept, and every field
 * stays editable.
 *
 * The card's columns have fixed meanings that the dashboard, alerts and patterns rely on:
 * column 1 = morning dose, column 2 = evening dose, column 3 = a daily habit, column 4 = the
 * symptom to report. Presets keep those roles: two morning medicines share column 1, and the
 * symptom column stays so dizziness/pain alerts and symptom-to-miss patterns keep working.
 */
export interface RegimenPreset {
  id: string;
  name: string;
  /** One sentence shown under the button. */
  summary: string;
  labels: Record<CareCol, string>;
  anchors: Partial<Record<CareCol, string>>;
  cues: Partial<Record<CareCol, string>>;
}

export const REGIMEN_PRESETS: RegimenPreset[] = [
  {
    id: "bp-diabetes",
    name: "BP & Diabetes",
    summary: "Morning BP pill + Metformin, evening Metformin, water.",
    labels: { am: "BP Pill + Metformin", pm: "Metformin", water: "Water 6+ Cups", dizzy: "Dizzy or Pain" },
    anchors: { am: "With breakfast", pm: "After dinner", water: "All day" },
    cues: { am: "White oval, large white", pm: "Large white", water: "6 glasses" },
  },
  {
    id: "post-surgery",
    name: "Post-Surgery Recovery",
    summary: "Antibiotic morning and evening, gentle walk, pain tracking.",
    labels: { am: "Antibiotic", pm: "Antibiotic", water: "Gentle Walk", dizzy: "Pain or Dizzy" },
    anchors: { am: "With food", pm: "With dinner", water: "Afternoon", dizzy: "Pain med taken?" },
    cues: { am: "Blue capsule", pm: "Blue capsule", water: "10 mins" },
  },
  {
    id: "simple",
    name: "Simple Morning & Night",
    summary: "Morning meds, night meds, water, dizziness or pain.",
    labels: { am: "Morning Meds", pm: "Night Meds", water: "Water", dizzy: "Dizzy or Pain" },
    anchors: { am: "With breakfast", pm: "Before bed", water: "All day" },
    cues: {},
  },
];

/** Apply a preset to settings: columns change, patient / week / print mode stay. */
export function applyPreset(s: CareCardSettings, p: RegimenPreset): CareCardSettings {
  const out: CareCardSettings = { ...s, labels: { ...p.labels } };
  delete out.anchors;
  delete out.cues;
  if (Object.keys(p.anchors).length) out.anchors = { ...p.anchors };
  if (Object.keys(p.cues).length) out.cues = { ...p.cues };
  return out;
}
