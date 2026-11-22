import { columnLabel, formatDay, weekDates, weekRange, type CareCardSettings } from "./card-settings";
import { ADHERENCE_TARGET_PCT, type CareReport, type Slot } from "./interpret";
import { DAY_NAMES, DAYS, type Day } from "./layout";

/**
 * Saved weekly summaries for longitudinal tracking. Stored in this browser only. Entries hold
 * aggregate results (no photo, no bubbles) plus the patient name the caregiver typed.
 */
export interface WeekEntry {
  /** One entry per patient and week; re-saving the same week replaces it. */
  id: string;
  savedAt: string;
  scannedAt: string;
  /** Monday of the card's week (YYYY-MM-DD), or "" for an undated card. */
  weekStart: string;
  patientName: string;
  adherencePct: number | null;
  taken: number;
  counted: number;
  missed: { day: Day; slot: Slot }[];
  symptomDays: Day[];
  lowEnergyDays: Day[];
  hydrationDays: number;
  /** Unclear marks still unresolved when saved. */
  needsReview: number;
  /** Unclear marks a person resolved before saving. */
  manualOverrides: number;
  /** Printed names of the two dose columns at the time, e.g. "Metformin 500mg - Morning". */
  doseLabels: Record<Slot, string>;
}

export const MAX_HISTORY = 104; // two years of weeks

/** Local calendar date of a timestamp as YYYY-MM-DD. */
export function localIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const norm = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export function weekEntryId(patientName: string, weekStart: string, scannedAt: string): string {
  return weekStart ? `${norm(patientName)}|${weekStart}` : `${norm(patientName)}|scan:${scannedAt}`;
}

export function toWeekEntry(
  report: CareReport,
  opts: { scannedAt: Date; savedAt: Date; card: CareCardSettings; manualOverrides: number },
): WeekEntry {
  const scannedAt = opts.scannedAt.toISOString();
  const patientName = opts.card.patientName.trim();
  const weekStart = opts.card.weekStart;
  return {
    id: weekEntryId(patientName, weekStart, scannedAt),
    savedAt: opts.savedAt.toISOString(),
    scannedAt,
    weekStart,
    patientName,
    adherencePct: report.adherencePct,
    taken: report.taken,
    counted: report.counted,
    missed: report.missed,
    symptomDays: report.symptomDays,
    lowEnergyDays: report.lowEnergyDays,
    hydrationDays: report.hydrationDays,
    needsReview: report.needsReview.length,
    manualOverrides: opts.manualOverrides,
    doseLabels: { Morning: columnLabel(opts.card, "am"), Night: columnLabel(opts.card, "pm") },
  };
}

/** Sort key: the card's week, or the scan date for undated cards. */
export function entryDate(e: WeekEntry): string {
  return e.weekStart || localIsoDate(new Date(e.scannedAt));
}

export function weekLabel(e: WeekEntry): string {
  if (e.weekStart) {
    const d = weekDates(e.weekStart);
    return `Week of ${weekRange(d[0], d[6])}`;
  }
  return `Scanned ${formatDay(localIsoDate(new Date(e.scannedAt)))}`;
}

/** Add or replace an entry. Oldest first, capped at MAX_HISTORY. */
export function addWeek(list: WeekEntry[], entry: WeekEntry): { list: WeekEntry[]; replaced: boolean } {
  const replaced = list.some((e) => e.id === entry.id);
  const next = [...list.filter((e) => e.id !== entry.id), entry]
    .sort((a, b) => entryDate(a).localeCompare(entryDate(b)) || a.scannedAt.localeCompare(b.scannedAt))
    .slice(-MAX_HISTORY);
  return { list: next, replaced };
}

/** Distinct patient names in the history, in first-seen order ("" for unnamed). */
export function patientsIn(list: WeekEntry[]): string[] {
  const seen = new Map<string, string>();
  for (const e of list) if (!seen.has(norm(e.patientName))) seen.set(norm(e.patientName), e.patientName);
  return [...seen.values()];
}

export function weeksFor(list: WeekEntry[], patientName: string): WeekEntry[] {
  return list.filter((e) => norm(e.patientName) === norm(patientName));
}

export interface TrendPoint {
  entry: WeekEntry;
  /** Percentage-point change from the previous week with a known adherence, or null. */
  delta: number | null;
}

export function trend(weeks: WeekEntry[]): TrendPoint[] {
  let prev: number | null = null;
  return weeks.map((entry) => {
    const delta = entry.adherencePct !== null && prev !== null ? entry.adherencePct - prev : null;
    if (entry.adherencePct !== null) prev = entry.adherencePct;
    return { entry, delta };
  });
}

// ---------------------------------------------------------------------------
// Parsing stored history
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isDay = (v: unknown): v is Day => typeof v === "string" && (DAYS as readonly string[]).includes(v);
const int = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null);
const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

function parseEntry(v: unknown): WeekEntry | null {
  if (!isObj(v)) return null;
  const scannedAt = iso(v.scannedAt);
  const savedAt = iso(v.savedAt);
  if (!scannedAt || !savedAt) return null;
  const weekStart = typeof v.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.weekStart) ? v.weekStart : "";
  const patientName = typeof v.patientName === "string" ? v.patientName.slice(0, 60) : "";
  const pct = v.adherencePct === null ? null : int(v.adherencePct, 100);
  if (pct === null && v.adherencePct !== null) return null;
  const taken = int(v.taken, 14);
  const counted = int(v.counted, 14);
  const hydrationDays = int(v.hydrationDays, 7);
  if (taken === null || counted === null || hydrationDays === null || taken > counted) return null;
  const missed = Array.isArray(v.missed)
    ? v.missed.filter((m): m is { day: Day; slot: Slot } => isObj(m) && isDay(m.day) && (m.slot === "Morning" || m.slot === "Night"))
    : [];
  const days = (a: unknown) => (Array.isArray(a) ? a.filter(isDay) : []);
  const labels = isObj(v.doseLabels) ? v.doseLabels : {};
  const label = (x: unknown, d: string) => (typeof x === "string" && x.trim() ? x.slice(0, 40) : d);
  return {
    id: weekEntryId(patientName, weekStart, scannedAt),
    savedAt,
    scannedAt,
    weekStart,
    patientName,
    adherencePct: pct,
    taken,
    counted,
    missed: missed.map((m) => ({ day: m.day, slot: m.slot })),
    symptomDays: days(v.symptomDays),
    lowEnergyDays: days(v.lowEnergyDays),
    hydrationDays,
    needsReview: int(v.needsReview, 63) ?? 0,
    manualOverrides: int(v.manualOverrides, 63) ?? 0,
    doseLabels: { Morning: label(labels.Morning, "Morning Meds"), Night: label(labels.Night, "Night Meds") },
  };
}

/** Validate stored history; drops bad entries rather than failing. */
export function parseHistory(raw: unknown): WeekEntry[] | null {
  if (!Array.isArray(raw)) return null;
  let list: WeekEntry[] = [];
  for (const item of raw) {
    const e = parseEntry(item);
    if (e) list = addWeek(list, e).list;
  }
  return list;
}

// ---------------------------------------------------------------------------
// Doctor visit summary
// ---------------------------------------------------------------------------

const short = (d: Day) => DAY_NAMES[d].slice(0, 3);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Plain-text / Markdown summary of saved weeks for a clinician. Pure and deterministic:
 * the generation date is a parameter and dates are formatted without the browser locale.
 */
export function formatDoctorSummary(weeks: WeekEntry[], opts: { patientName: string; generatedAt: Date }): string {
  const name = opts.patientName.trim() || "Unnamed patient";
  const lines: string[] = [`# Medication adherence summary: ${name}`, ""];
  if (weeks.length === 0) {
    lines.push("No weeks saved yet.");
    return lines.join("\n");
  }
  const known = weeks.filter((w) => w.adherencePct !== null);
  const pcts = known.map((w) => w.adherencePct as number);
  const taken = known.reduce((s, w) => s + w.taken, 0);
  const counted = known.reduce((s, w) => s + w.counted, 0);
  const totalMissed = weeks.reduce((s, w) => s + w.missed.length, 0);
  const symptomDays = weeks.reduce((s, w) => s + w.symptomDays.length, 0);
  const lowEnergy = weeks.reduce((s, w) => s + w.lowEnergyDays.length, 0);
  const verified = weeks.reduce((s, w) => s + w.manualOverrides, 0);
  const unresolved = weeks.reduce((s, w) => s + w.needsReview, 0);
  const below = known.filter((w) => (w.adherencePct as number) < ADHERENCE_TARGET_PCT).length;
  const fullDaysMissed = weeks.reduce(
    (s, w) => s + DAYS.filter((d) => w.missed.some((m) => m.day === d && m.slot === "Morning") && w.missed.some((m) => m.day === d && m.slot === "Night")).length,
    0,
  );
  const byLabel = new Map<string, number>();
  for (const w of weeks) for (const m of w.missed) byLabel.set(w.doseLabels[m.slot], (byLabel.get(w.doseLabels[m.slot]) ?? 0) + 1);

  lines.push(
    `Generated ${formatDay(localIsoDate(opts.generatedAt))} from ${plural(weeks.length, "PaperBridge Weekly Care Card")}: ${weekLabel(weeks[0]).replace(/^Week of |^Scanned /, "")} to ${weekLabel(weeks[weeks.length - 1]).replace(/^Week of |^Scanned /, "")}.`,
    "",
    "## Overview",
    "",
    counted > 0
      ? `- Doses taken: ${taken} of ${counted} recorded (${Math.round((taken / counted) * 100)}%). Goal: ${ADHERENCE_TARGET_PCT}% or more.`
      : "- Doses taken: no readable doses.",
    pcts.length > 0 ? `- Weekly adherence: ${Math.min(...pcts)}% to ${Math.max(...pcts)}%; ${below} of ${plural(pcts.length, "week")} below goal.` : "- Weekly adherence: unknown.",
    `- Missed doses: ${totalMissed}${byLabel.size ? ` (${[...byLabel].map(([l, n]) => `${l}: ${n}`).join("; ")})` : ""}.`,
    `- Days with no doses at all: ${fullDaysMissed}.`,
    `- Days with dizziness or pain: ${symptomDays}.`,
    `- Days with low energy (2 or below on a 1-5 scale): ${lowEnergy}.`,
  );
  if (pcts.length >= 2) {
    const change = pcts[pcts.length - 1] - pcts[0];
    lines.push(`- Trend: ${change === 0 ? "no change" : `${change > 0 ? "up" : "down"} ${Math.abs(change)} points`} from the first to the latest week.`);
  }
  lines.push("", "## Week by week", "", "| Week | Adherence | Missed doses | Dizzy or pain | Low energy | Water 6+ cups |", "|---|---|---|---|---|---|");
  for (const w of weeks) {
    const missed = w.missed.length ? w.missed.map((m) => `${short(m.day)} ${m.slot === "Morning" ? "AM" : "PM"}`).join(", ") : "none";
    lines.push(
      `| ${weekLabel(w).replace(/^Week of /, "")} | ${w.adherencePct === null ? "unknown" : `${w.adherencePct}%`} (${w.taken}/${w.counted}) | ${missed} | ${w.symptomDays.map(short).join(", ") || "none"} | ${w.lowEnergyDays.map(short).join(", ") || "none"} | ${w.hydrationDays} of 7 days |`,
    );
  }
  lines.push(
    "",
    "## About this data",
    "",
    "- Recorded by the patient on a paper card with a pen and read by PaperBridge's deterministic scanner (no AI interpretation).",
    "- Unclear marks are never guessed: they are left out of the counts unless a caregiver checked the paper card.",
  );
  if (verified > 0) lines.push(`- ${plural(verified, "unclear mark")} ${verified === 1 ? "was" : "were"} checked by hand by the caregiver.`);
  if (unresolved > 0) lines.push(`- ${plural(unresolved, "mark")} ${unresolved === 1 ? "was" : "were"} still unclear and not counted.`);
  return lines.join("\n");
}
