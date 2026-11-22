import type { Day } from "./layout";
import { DAYS, DAY_NAMES } from "./layout";

/**
 * Deterministic clinical-pattern rules for the Weekly Care Card. Pure: fixed thresholds over
 * the decoded marks, no AI, no randomness, no clock. Works for one week (the dashboard and scan
 * alert) or many saved weeks (the Doctor Visit Summary and PDF).
 *
 * Wording stays observational ("worth asking about"): PaperBridge flags patterns for a person
 * to discuss; it does not diagnose.
 */
export type Slot = "Morning" | "Night";
export const SLOTS: Slot[] = ["Morning", "Night"];

export type SymptomKind = "dizzy-pain" | "low-energy";
export type PatternKind = "symptom-miss" | "slot-barrier";

export interface CarePattern {
  kind: PatternKind;
  /** One plain-language sentence, e.g. "Night Meds missed on 3 days when low energy was marked". */
  title: string;
  /** What it may mean and what to do, in plain language. */
  detail: string;
  slot: Slot;
  symptom?: SymptomKind;
  /** Matching dose-days (symptom-miss) or misses in the slot (slot-barrier). */
  count: number;
  /** All misses in the slot (symptom-miss) or all misses (slot-barrier). */
  of: number;
}

/** One week of decoded marks: what both a CareReport and a saved WeekEntry provide. */
export interface WeekMarks {
  missed: { day: Day; slot: Slot }[];
  symptomDays: Day[];
  lowEnergyDays: Day[];
}

/** Printed names of the two dose columns, e.g. { Morning: "Metformin 500mg", Night: "BP Pill - Evening" }. */
export type DoseLabels = Record<Slot, string>;
export const DEFAULT_DOSE_LABELS: DoseLabels = { Morning: "Morning Meds", Night: "Night Meds" };

/** A symptom-miss pattern needs at least this many dose-days missed on symptom days... */
export const SYMPTOM_MISS_MIN_DAYS = 2;
/** ...making up at least this share of that slot's misses (so it is not just chance overlap). */
export const SYMPTOM_MISS_MIN_SHARE = 0.5;
/** A time-of-day barrier needs at least this many misses in total... */
export const SLOT_BARRIER_MIN_MISSES = 3;
/** ...with at least this share of them in one slot. */
export const SLOT_BARRIER_MIN_SHARE = 0.75;

const SYMPTOMS: { kind: SymptomKind; name: string; days: (w: WeekMarks) => Day[] }[] = [
  { kind: "dizzy-pain", name: "dizziness or pain", days: (w) => w.symptomDays },
  { kind: "low-energy", name: "low energy", days: (w) => w.lowEnergyDays },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const dayList = (days: Day[]) => days.map((d) => DAY_NAMES[d]).join(", ");

/**
 * Detect patterns across one or more weeks. Ordered: symptom-miss (dizziness/pain, then low
 * energy; Morning, then Night), then the time-of-day barrier.
 */
export function detectPatterns(weeks: WeekMarks[], labels: DoseLabels = DEFAULT_DOSE_LABELS): CarePattern[] {
  const out: CarePattern[] = [];
  const single = weeks.length === 1;
  const missesIn = (slot: Slot) => weeks.reduce((n, w) => n + w.missed.filter((m) => m.slot === slot).length, 0);

  for (const symptom of SYMPTOMS) {
    for (const slot of SLOTS) {
      const total = missesIn(slot);
      const hitDays: Day[] = [];
      let hits = 0;
      for (const w of weeks) {
        const sDays = new Set(symptom.days(w));
        for (const m of w.missed) {
          if (m.slot !== slot || !sDays.has(m.day)) continue;
          hits++;
          if (single) hitDays.push(m.day);
        }
      }
      if (hits < SYMPTOM_MISS_MIN_DAYS || hits / total < SYMPTOM_MISS_MIN_SHARE) continue;
      const when = single ? ` (${dayList(DAYS.filter((d) => hitDays.includes(d)))})` : "";
      out.push({
        kind: "symptom-miss",
        slot,
        symptom: symptom.kind,
        count: hits,
        of: total,
        title: `${labels[slot]} missed on ${plural(hits, "day")} when ${symptom.name} was marked`,
        detail: `${hits} of ${total} ${labels[slot]} misses fell on days with ${symptom.name}${when}. Possibly a side effect leading to skipped doses: worth asking about.`,
      });
    }
  }

  const all = missesIn("Morning") + missesIn("Night");
  if (all >= SLOT_BARRIER_MIN_MISSES) {
    for (const slot of SLOTS) {
      const n = missesIn(slot);
      if (n / all < SLOT_BARRIER_MIN_SHARE) continue;
      out.push({
        kind: "slot-barrier",
        slot,
        count: n,
        of: all,
        title: `${n} of ${all} missed doses were ${labels[slot]}`,
        detail: `Misses cluster at one time of day: more likely a routine barrier than overall non-adherence. A routine anchor (e.g. "after dinner") or a different time may help.`,
      });
    }
  }
  return out;
}

/** Payload form for the Kiro Crew alert: aggregate wording only. */
export function toAlertPatterns(patterns: CarePattern[]): { kind: PatternKind; title: string; detail: string }[] {
  return patterns.map(({ kind, title, detail }) => ({ kind, title, detail }));
}
