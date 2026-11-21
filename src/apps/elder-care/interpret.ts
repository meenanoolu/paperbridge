import { readingsByKey, bubbleKey, type BubbleState, type SuccessfulScan } from "../../core";
import { DAYS, DAY_NAMES, ENERGY_LEVELS, type Day } from "./layout";

/** "review" means the decoder saw an unclear mark: a person should check the paper. */
export type Mark = "yes" | "no" | "review";
export type Slot = "Morning" | "Night";

export interface DayReport {
  day: Day;
  morning: Mark;
  night: Mark;
  water: Mark;
  dizzy: Mark;
  /** 1..5, or null when blank, unclear, or more than one level is filled. */
  energy: number | null;
  energyReview: boolean;
}

export type AlertLevel = "high" | "medium" | "info";
export interface CareAlert {
  level: AlertLevel;
  title: string;
  detail: string;
}

export interface CareReport {
  days: DayReport[];
  /** taken / counted * 100, rounded. Null when no dose could be counted. */
  adherencePct: number | null;
  taken: number;
  /** Scheduled doses this week (Morning + Night, 7 days). */
  scheduled: number;
  /** Scheduled doses with a clear mark or clear blank. Unclear doses are excluded (R5.9). */
  counted: number;
  missed: { day: Day; slot: Slot }[];
  needsReview: string[];
  symptomDays: Day[];
  lowEnergyDays: Day[];
  hydrationDays: number;
  alerts: CareAlert[];
}

export const ADHERENCE_TARGET_PCT = 80;
export const HYDRATION_TARGET_DAYS = 5;
export const LOW_ENERGY_MAX = 2;

const toMark = (s: BubbleState | undefined): Mark => (s === "filled" ? "yes" : s === "ambiguous" || s === undefined ? "review" : "no");

const list = (days: Day[]) => days.map((d) => DAY_NAMES[d]).join(", ");

/** Turn a decoded Weekly Care Card into the caregiver report. Pure, so it is unit tested without a browser. */
export function interpretCareCard(scan: SuccessfulScan): CareReport {
  const r = readingsByKey(scan);
  const state = (group: string, row: string, col: string) => r.get(bubbleKey(group, row, col))?.state;

  const days: DayReport[] = DAYS.map((day) => {
    const levels = ENERGY_LEVELS.map((lvl) => state("energy", day, lvl));
    const filled = ENERGY_LEVELS.filter((_, i) => levels[i] === "filled");
    const unclear = levels.some((s) => s === "ambiguous" || s === undefined);
    const energyReview = unclear || filled.length > 1;
    return {
      day,
      morning: toMark(state("care", day, "am")),
      night: toMark(state("care", day, "pm")),
      water: toMark(state("care", day, "water")),
      dizzy: toMark(state("care", day, "dizzy")),
      energy: !energyReview && filled.length === 1 ? Number(filled[0]) : null,
      energyReview,
    };
  });

  let taken = 0;
  let counted = 0;
  const missed: CareReport["missed"] = [];
  const needsReview: string[] = [];
  for (const d of days) {
    for (const [slot, mark] of [
      ["Morning", d.morning],
      ["Night", d.night],
    ] as const) {
      if (mark === "review") {
        needsReview.push(`${DAY_NAMES[d.day]} ${slot.toLowerCase()} meds`);
        continue;
      }
      counted++;
      if (mark === "yes") taken++;
      else missed.push({ day: d.day, slot });
    }
    if (d.water === "review") needsReview.push(`${DAY_NAMES[d.day]} water`);
    if (d.dizzy === "review") needsReview.push(`${DAY_NAMES[d.day]} dizzy or pain`);
    if (d.energyReview) needsReview.push(`${DAY_NAMES[d.day]} energy`);
  }

  const scheduled = DAYS.length * 2;
  const adherencePct = counted === 0 ? null : Math.round((taken / counted) * 100);
  const symptomDays = days.filter((d) => d.dizzy === "yes").map((d) => d.day);
  const lowEnergyDays = days.filter((d) => d.energy !== null && d.energy <= LOW_ENERGY_MAX).map((d) => d.day);
  const hydrationDays = days.filter((d) => d.water === "yes").length;

  const alerts: CareAlert[] = [];
  if (adherencePct !== null && adherencePct < ADHERENCE_TARGET_PCT) {
    alerts.push({
      level: "high",
      title: `Medication taken ${adherencePct}% of the time`,
      detail: `${missed.length} of ${counted} doses were missed. The goal is ${ADHERENCE_TARGET_PCT}% or more.`,
    });
  }
  const bothMissed = days.filter((d) => d.morning === "no" && d.night === "no").map((d) => d.day);
  if (bothMissed.length > 0) {
    alerts.push({ level: "high", title: `No medication at all on ${list(bothMissed)}`, detail: "Both morning and night doses were missed." });
  } else if (missed.length > 0 && adherencePct !== null && adherencePct >= ADHERENCE_TARGET_PCT) {
    alerts.push({
      level: "medium",
      title: `${missed.length} missed dose${missed.length > 1 ? "s" : ""}`,
      detail: missed.map((m) => `${DAY_NAMES[m.day]} ${m.slot.toLowerCase()}`).join(", "),
    });
  }
  if (symptomDays.length >= 2) {
    alerts.push({ level: "high", title: `Dizzy or in pain on ${symptomDays.length} days`, detail: `${list(symptomDays)}. Consider calling the doctor.` });
  } else if (symptomDays.length === 1) {
    alerts.push({ level: "medium", title: `Dizzy or in pain on ${DAY_NAMES[symptomDays[0]]}`, detail: "One day this week." });
  }
  if (lowEnergyDays.length >= 2) {
    alerts.push({ level: "medium", title: `Low energy on ${lowEnergyDays.length} days`, detail: `${list(lowEnergyDays)} (energy ${LOW_ENERGY_MAX} or below).` });
  }
  if (hydrationDays < HYDRATION_TARGET_DAYS) {
    alerts.push({ level: "medium", title: `Enough water on only ${hydrationDays} of 7 days`, detail: `The goal is 6+ cups on at least ${HYDRATION_TARGET_DAYS} days.` });
  }
  if (needsReview.length > 0) {
    alerts.push({
      level: "info",
      title: needsReview.length === 1 ? "1 mark needs a human check" : `${needsReview.length} marks need a human check`,
      detail: `${needsReview.join(", ")}. These are not counted as taken or missed.`,
    });
  }
  const order: Record<AlertLevel, number> = { high: 0, medium: 1, info: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);

  return { days, adherencePct, taken, scheduled, counted, missed, needsReview, symptomDays, lowEnergyDays, hydrationDays, alerts };
}

/** Aggregate-only alert payload for other tools (e.g. the Kiro Crew App). No images, no raw bubbles. */
export interface ScanAlert {
  type: "paperbridge:scan-alert";
  app: "elder-care";
  cardId: string;
  scannedAt: string;
  severity: "high" | "medium" | "none";
  adherencePct: number | null;
  missed: { day: Day; slot: Slot }[];
  symptomDays: Day[];
  needsReview: string[];
  alerts: CareAlert[];
}

export const SCAN_ALERT_EVENT = "paperbridge:scan-alert";

export function toScanAlert(report: CareReport, cardId: string, scannedAt: Date): ScanAlert {
  const severity = report.alerts.some((a) => a.level === "high") ? "high" : report.alerts.some((a) => a.level === "medium") ? "medium" : "none";
  return {
    type: SCAN_ALERT_EVENT,
    app: "elder-care",
    cardId,
    scannedAt: scannedAt.toISOString(),
    severity,
    adherencePct: report.adherencePct,
    missed: report.missed,
    symptomDays: report.symptomDays,
    needsReview: report.needsReview,
    alerts: report.alerts,
  };
}
