import type { CardLayout } from "../../core";
import { CARE_COLS, DAYS, ELDER_LAYOUTS } from "./layout";

/**
 * Caregiver customization of the Weekly Care Card. Only printed TEXT changes: patient name,
 * week, day dates, and checklist column labels. Bubble positions, corner markers, the card
 * ID strip and the layout id/version are copied from the base layout, so a customized card
 * decodes exactly like the default one (see __tests__/card-settings.test.ts).
 */
export type CareCol = (typeof CARE_COLS)[number];

export interface CareCardSettings {
  patientName: string;
  /** YYYY-MM-DD of the Monday the card starts, or "" for an undated card. */
  weekStart: string;
  /** Printed label for each checklist column, e.g. "Metformin 500mg - Morning". */
  labels: Record<CareCol, string>;
}

export const DEFAULT_LABELS: Record<CareCol, string> = {
  am: "Morning Meds",
  pm: "Night Meds",
  water: "Water 6+ cups",
  dizzy: "Dizzy or Pain",
};

export const DEFAULT_CARE_SETTINGS: CareCardSettings = { patientName: "", weekStart: "", labels: { ...DEFAULT_LABELS } };

export const MAX_NAME = 40;
/**
 * The header line starts 26 mm from the left and must end before the card-ID strip
 * (about 113 mm), with a safety margin. Subtitles print at 4.2 mm.
 */
export const HEADER_TEXT_MM = 4.2;
export const HEADER_BUDGET_MM = 76;
export const MAX_LABEL = 30;
/** A checklist column is 26 mm wide; at large-print size about 9 characters fit per line. */
export const LABEL_CHARS_PER_LINE = 9;
export const LABEL_MAX_LINES = 3;

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Text the printed card can show. The PDF uses standard fonts (Latin-1), so typographic
 * dashes and quotes are mapped to plain ones and control characters are removed.
 */
export function printableText(s: string): string {
  return s
    .replace(/[\u2012-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Characters the PDF fonts cannot draw (they would print as "?"). */
export function unprintableChars(s: string): string[] {
  return [...new Set([...printableText(s)].filter((c) => !/[\x20-\x7e\xa0-\xff]/.test(c)))];
}

// Approximate Helvetica advance widths (em). Generous, so the estimate errs on the wide side.
const NARROW = new Set([..."iljI.,;:'!|`()[]{} "]);
const WIDE = new Set([..."mwMW@%"]);

/** Estimated printed width in mm. Used to keep header text clear of the card-ID strip. */
export function estimateTextWidthMm(text: string, sizeMm: number): number {
  let em = 0;
  for (const c of text) em += NARROW.has(c) ? 0.3 : WIDE.has(c) ? 0.95 : c >= "A" && c <= "Z" ? 0.72 : 0.6;
  return em * sizeMm;
}

export function headerLine(name: string): string {
  return `Patient: ${name}`;
}

/** Whether the patient line fits the header without reaching the card-ID strip. */
export function nameFitsHeader(name: string): boolean {
  return estimateTextWidthMm(headerLine(printableText(name)), HEADER_TEXT_MM) <= HEADER_BUDGET_MM;
}

/** Trim a name until it fits, adding "..." when shortened. */
export function fitNameToHeader(name: string): string {
  let n = printableText(name);
  if (nameFitsHeader(n)) return n;
  while (n.length > 1 && !nameFitsHeader(`${n}...`)) n = n.slice(0, -1).trimEnd();
  return `${n}...`;
}

/** Word-wrap a label to the column. Long words are split. Returns null if it needs too many lines. */
export function wrapLabel(text: string, perLine = LABEL_CHARS_PER_LINE, maxLines = LABEL_MAX_LINES): string[] | null {
  const words = printableText(text)
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => (w.length <= perLine ? [w] : (w.match(new RegExp(`.{1,${perLine}}`, "g")) ?? [])));
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + w.length <= perLine) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  if (lines.length === 0) return null;
  return lines.length <= maxLines ? lines : null;
}

function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The Monday on or before an ISO date (the card's rows always run Mon..Sun). "" if invalid. */
export function mondayOf(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  if (!d) return "";
  const back = (d.getUTCDay() + 6) % 7;
  return iso(new Date(d.getTime() - back * 86_400_000));
}

/** ISO dates for Mon..Sun of the week. Empty for an undated card. */
export function weekDates(weekStart: string): string[] {
  const d = parseIsoDate(weekStart);
  if (!d) return [];
  return DAYS.map((_, i) => iso(new Date(d.getTime() + i * 86_400_000)));
}

/** "23 Nov - 29 Nov 2026", or "28 Dec 2026 - 3 Jan 2027" across years. */
export function weekRange(fromIso: string, toIso: string): string {
  const a = formatDay(fromIso);
  const b = formatDay(toIso);
  return a.slice(-4) === b.slice(-4) ? `${a.slice(0, -5)} - ${b}` : `${a} - ${b}`;
}

/** "23 Nov 2026". Locale-independent so printed cards and summaries are deterministic. */
export function formatDay(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "";
}

export interface SettingsProblem {
  field: "patientName" | "weekStart" | CareCol;
  message: string;
}

export function validateSettings(s: CareCardSettings): SettingsProblem[] {
  const problems: SettingsProblem[] = [];
  if (s.patientName.length > MAX_NAME) problems.push({ field: "patientName", message: `Use at most ${MAX_NAME} characters.` });
  else if (!nameFitsHeader(s.patientName)) problems.push({ field: "patientName", message: "Too long to fit the card header. Try initials for the surname." });
  const badName = unprintableChars(s.patientName);
  if (badName.length) problems.push({ field: "patientName", message: `These characters cannot be printed: ${badName.join(" ")}` });
  if (s.weekStart && !parseIsoDate(s.weekStart)) problems.push({ field: "weekStart", message: "Enter a valid date." });
  for (const col of CARE_COLS) {
    const label = s.labels[col];
    if (!printableText(label)) problems.push({ field: col, message: "Enter a label." });
    else if (label.length > MAX_LABEL) problems.push({ field: col, message: `Use at most ${MAX_LABEL} characters.` });
    else if (!wrapLabel(label)) problems.push({ field: col, message: `Too long to fit the column. Keep it to ${LABEL_MAX_LINES} short lines.` });
    const bad = unprintableChars(label);
    if (bad.length) problems.push({ field: col, message: `These characters cannot be printed: ${bad.join(" ")}` });
  }
  return problems;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Validate stored settings. Invalid fields fall back to defaults; never throws. */
export function parseCareSettings(raw: unknown): CareCardSettings | null {
  if (!isObj(raw)) return null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const labelsRaw = isObj(raw.labels) ? raw.labels : {};
  const labels = { ...DEFAULT_LABELS };
  for (const col of CARE_COLS) {
    const v = str(labelsRaw[col], MAX_LABEL);
    if (v.trim()) labels[col] = v;
  }
  const weekStart = typeof raw.weekStart === "string" ? mondayOf(raw.weekStart) : "";
  return { patientName: str(raw.patientName, MAX_NAME), weekStart, labels };
}

export function isDefaultSettings(s: CareCardSettings): boolean {
  return !s.patientName.trim() && !s.weekStart && CARE_COLS.every((c) => printableText(s.labels[c]) === DEFAULT_LABELS[c]);
}

/** Display label for a checklist column (falls back to the default if invalid). */
export function columnLabel(s: CareCardSettings, col: CareCol): string {
  return printableText(s.labels[col]) || DEFAULT_LABELS[col];
}

/**
 * The printable layout for these settings. Copies every coordinate from `base` and changes
 * only text, so `bubbleCenters`, `fiducialCenters` and `idBits` are identical to the base.
 */
export function customizeCareLayout(base: CardLayout, s: CareCardSettings): CardLayout {
  const name = s.patientName.trim() ? fitNameToHeader(s.patientName) : "";
  const dates = weekDates(s.weekStart);
  const week = dates.length ? `Week of ${weekRange(dates[0], dates[6])}` : "";
  const groups = base.groups.map((g) => {
    if (g.key !== "care") return g;
    return {
      ...g,
      // The week replaces "Daily checklist": that heading sits in open space mid-card.
      title: week || g.title,
      colLabels: g.cols.map((col, j) => {
        const lines = wrapLabel(columnLabel(s, col as CareCol));
        return lines ? lines.join("\n") : g.colLabels?.[j] ?? col;
      }),
      rowLabels: dates.length ? g.rows.map((_, i) => `${DAY_SHORT[i]} ${Number(dates[i].slice(8))}`) : g.rowLabels,
      // Dated row labels are wider; widen the shading so they sit inside it. Shading only.
      bands: dates.length && g.bands ? { ...g.bands, fromXMm: g.bands.fromXMm - 4 } : g.bands,
    };
  });
  return {
    ...base,
    // The header holds only the name: it must stay clear of the card-ID strip on the right.
    subtitle: name ? headerLine(name) : base.subtitle,
    groups,
    // The footer never grows: on Letter paper extra lines would reach the bottom corner markers.
    // With a name in the header, the pen instruction takes the place of the last footer line.
    footer: base.footer && {
      ...base.footer,
      lines: name ? ["Fill each circle fully with a dark pen.", ...base.footer.lines.slice(0, -1)] : base.footer.lines,
    },
  };
}

export function customizedElderLayouts(s: CareCardSettings): CardLayout[] {
  return ELDER_LAYOUTS.map((l) => customizeCareLayout(l, s));
}
