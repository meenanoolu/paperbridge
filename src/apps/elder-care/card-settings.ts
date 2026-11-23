import {
  COL_LABEL_SIZE_MM,
  COL_NOTE_SIZE_MM,
  estimateTextWidthMm as coreTextWidth,
  graphemes,
  HIGH_VISIBILITY_STYLE,
  isLatinText as latin,
  printableText,
  unprintableAnyScript,
  unprintableLatin as unprintableChars,
  wrapToWidth,
  type CardLayout,
} from "../../core";

// Shared with every app (src/core); re-exported for existing imports.
export { HIGH_VISIBILITY_STYLE, printableText, unprintableAnyScript, unprintableChars, wrapToWidth };
import { isCardLanguage, languagePack, numericRange, translateAnchor, translateLabel, type CardLanguage } from "./i18n";
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
  /** Optional routine anchor per column, printed under its label, e.g. "With breakfast". */
  anchors?: Partial<Record<CareCol, string>>;
  /** Optional visual pill cue per column, printed under the anchor, e.g. "White oval". */
  cues?: Partial<Record<CareCol, string>>;
  /** Bolder, larger labels and stronger row shading for low vision and tremor. Print-only. */
  highVisibility?: boolean;
  /**
   * Language of the printed card (default English). Translates the card's default wording; the
   * dashboard and Doctor Visit PDF stay in English. Any non-English choice also allows labels in
   * any script, printed as images by the browser.
   */
  language?: CardLanguage;
  /** Icon-Anchored print mode: sun, moon, water drop and warning icons above the columns. Print-only. */
  icons?: boolean;
}

export const MAX_NOTE = 24;
/** Each note (anchor or cue) may take at most this many printed lines. */
export const NOTE_MAX_LINES = 2;
/**
 * Printed width available to a column's label and notes: the 26 mm column pitch less the text
 * clearance, so two neighbouring columns at full width still do not touch (checkPrintedText).
 */
export const COLUMN_TEXT_MM = 25.6;

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

/** Whether the settings print through the any-script path (a non-English card language). */
export const allowsAnyScript = (s: CareCardSettings) => !!s.language && s.language !== "en";

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
    .flatMap((w) => {
      if (latin(w)) return w.length <= perLine ? [w] : (w.match(new RegExp(`.{1,${perLine}}`, "g")) ?? []);
      const g = graphemes(w);
      return g.length <= perLine ? [w] : Array.from({ length: Math.ceil(g.length / perLine) }, (_, i) => g.slice(i * perLine, (i + 1) * perLine).join(""));
    });
  const len = (t: string) => (latin(t) ? t.length : graphemes(t).length);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && len(last) + 1 + len(w) <= perLine) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  if (lines.length === 0) return null;
  return lines.length <= maxLines ? lines : null;
}

/** Elder card base label scale (layout.ts labelScale). */
const CARE_LABEL_SCALE = 1.45;
const colScale = (s: CareCardSettings) => CARE_LABEL_SCALE * (s.highVisibility ? HIGH_VISIBILITY_STYLE.colLabelScale ?? 1 : 1);
export const noteSizeMm = (s: CareCardSettings) => COL_NOTE_SIZE_MM * colScale(s);

/** Printed lines of a column's anchor or cue, or null if it does not fit 2 lines. */
export function wrapNote(s: CareCardSettings, text: string): string[] | null {
  return wrapToWidth(text, noteSizeMm(s), COLUMN_TEXT_MM, NOTE_MAX_LINES, !!s.highVisibility);
}

/** Printed lines of a column label: standard cards keep the 9-character wrap; high-visibility wraps by width. */
export function wrapColumnLabel(s: CareCardSettings, text: string): string[] | null {
  const size = COL_LABEL_SIZE_MM * colScale(s);
  // Keep the familiar 9-character wrap when every line really fits the column (labels print bold);
  // otherwise (wide capitals, or high-visibility size) wrap by measured width.
  // The width fallback only re-wraps labels the 9-character rule accepts; it never loosens it.
  if (s.highVisibility) return wrapToWidth(text, size, COLUMN_TEXT_MM, LABEL_MAX_LINES, true);
  const byChars = wrapLabel(text);
  if (!byChars) return null;
  if (byChars.every((l) => coreTextWidth(l, size, true) <= COLUMN_TEXT_MM)) return byChars;
  return wrapToWidth(text, size, COLUMN_TEXT_MM, LABEL_MAX_LINES, true);
}

export function anchorOf(s: CareCardSettings, col: CareCol): string {
  return printableText(s.anchors?.[col] ?? "");
}
export function cueOf(s: CareCardSettings, col: CareCol): string {
  return printableText(s.cues?.[col] ?? "");
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
  field: "patientName" | "weekStart" | CareCol | `${CareCol}.anchor` | `${CareCol}.cue`;
  message: string;
}

export function validateSettings(s: CareCardSettings): SettingsProblem[] {
  const problems: SettingsProblem[] = [];
  const unprintableChars = allowsAnyScript(s) ? unprintableAnyScript : unprintableLatin;
  if (s.patientName.length > MAX_NAME) problems.push({ field: "patientName", message: `Use at most ${MAX_NAME} characters.` });
  else if (!nameFitsHeader(s.patientName)) problems.push({ field: "patientName", message: "Too long to fit the card header. Try initials for the surname." });
  const badName = unprintableChars(s.patientName);
  if (badName.length) problems.push({ field: "patientName", message: `These characters cannot be printed: ${badName.join(" ")}` });
  if (s.weekStart && !parseIsoDate(s.weekStart)) problems.push({ field: "weekStart", message: "Enter a valid date." });
  for (const col of CARE_COLS) {
    const label = s.labels[col];
    if (!printableText(label)) problems.push({ field: col, message: "Enter a label." });
    else if (label.length > MAX_LABEL) problems.push({ field: col, message: `Use at most ${MAX_LABEL} characters.` });
    else if (!wrapColumnLabel(s, label))
      problems.push({
        field: col,
        message: s.highVisibility
          ? `Too long for High-Visibility print. Keep it to ${LABEL_MAX_LINES} short lines.`
          : `Too long to fit the column. Keep it to ${LABEL_MAX_LINES} short lines.`,
      });
    const bad = unprintableChars(label);
    if (bad.length) problems.push({ field: col, message: `These characters cannot be printed: ${bad.join(" ")}` });
    for (const [kind, value] of [
      ["anchor", s.anchors?.[col] ?? ""],
      ["cue", s.cues?.[col] ?? ""],
    ] as const) {
      if (!value.trim()) continue;
      const field = `${col}.${kind}` as const;
      if (value.length > MAX_NOTE) problems.push({ field, message: `Use at most ${MAX_NOTE} characters.` });
      else if (!wrapNote(s, value)) problems.push({ field, message: `Too long to fit under the column. Keep it to ${NOTE_MAX_LINES} short lines.` });
      const badNote = unprintableChars(value);
      if (badNote.length) problems.push({ field, message: `These characters cannot be printed: ${badNote.join(" ")}` });
    }
  }
  return problems;
}

const unprintableLatin = unprintableChars;

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
  const out: CareCardSettings = { patientName: str(raw.patientName, MAX_NAME), weekStart, labels };
  // Optional fields are only present when set, so settings saved by older versions round-trip unchanged.
  for (const key of ["anchors", "cues"] as const) {
    const src = isObj(raw[key]) ? (raw[key] as Record<string, unknown>) : {};
    const notes: Partial<Record<CareCol, string>> = {};
    for (const col of CARE_COLS) {
      const v = str(src[col], MAX_NOTE);
      if (v.trim()) notes[col] = v;
    }
    if (Object.keys(notes).length) out[key] = notes;
  }
  if (raw.highVisibility === true) out.highVisibility = true;
  if (isCardLanguage(raw.language) && raw.language !== "en") out.language = raw.language;
  if (raw.icons === true) out.icons = true;
  return out;
}

/** Trim and drop empty optional fields, as stored. `parseCareSettings(normalizeSettings(s))` equals it. */
export function normalizeSettings(s: CareCardSettings): CareCardSettings {
  const out: CareCardSettings = { patientName: s.patientName.trim(), weekStart: mondayOf(s.weekStart), labels: { ...s.labels } };
  for (const key of ["anchors", "cues"] as const) {
    const notes = Object.fromEntries(CARE_COLS.flatMap((c) => (s[key]?.[c]?.trim() ? [[c, s[key]![c]!.trim()]] : [])));
    if (Object.keys(notes).length) out[key] = notes;
  }
  if (s.highVisibility) out.highVisibility = true;
  if (s.language && s.language !== "en") out.language = s.language;
  if (s.icons) out.icons = true;
  return out;
}

export function isDefaultSettings(s: CareCardSettings): boolean {
  return (
    !s.patientName.trim() &&
    !s.weekStart &&
    !s.highVisibility &&
    !s.icons &&
    (!s.language || s.language === "en") &&
    CARE_COLS.every((c) => printableText(s.labels[c]) === DEFAULT_LABELS[c] && !anchorOf(s, c) && !cueOf(s, c))
  );
}

/** Display label for a checklist column (falls back to the default if invalid). */
export function columnLabel(s: CareCardSettings, col: CareCol): string {
  return printableText(s.labels[col]) || DEFAULT_LABELS[col];
}

/**
 * The printable layout for these settings. Copies every coordinate from `base` and changes
 * only text, so `bubbleCenters`, `fiducialCenters` and `idBits` are identical to the base.
 */
/** Icon per checklist column: sun, moon, a drop for water (a check mark for other habits), warning. */
export function columnIcons(s: CareCardSettings): ("sun" | "moon" | "drop" | "check" | "alert")[] {
  const water = /water|cup|glass|hydrat|agua|nee|pani|पानी|నీ/i.test(columnLabel(s, "water"));
  return ["sun", "moon", water ? "drop" : "check", "alert"];
}

export function customizeCareLayout(base: CardLayout, s: CareCardSettings): CardLayout {
  const pack = languagePack(s.language);
  const name = s.patientName.trim() ? fitNameToHeader(s.patientName) : "";
  const dates = weekDates(s.weekStart);
  const week = dates.length ? (pack ? `${pack.weekOf} ${numericRange(dates[0], dates[6])}` : `Week of ${weekRange(dates[0], dates[6])}`) : "";
  // Preset anchors print translated when the translation fits; anything else prints as typed.
  const note = (t: string) => (pack && t ? wrapNote(s, translateAnchor(pack, t)) : null) ?? wrapNote(s, t) ?? [];
  const notes = CARE_COLS.map((col) => [...(anchorOf(s, col) ? note(anchorOf(s, col)) : []), ...(cueOf(s, col) ? wrapNote(s, cueOf(s, col)) ?? [] : [])].join("\n"));
  const days = pack?.days ?? DAY_SHORT;
  const groups = base.groups.map((g) => {
    if (g.key === "energy" && pack) return { ...g, title: pack.energyTitle };
    if (g.key !== "care") return g;
    return {
      ...g,
      // The week replaces "Daily checklist": that heading sits in open space mid-card.
      title: week || (pack ? pack.dailyChecklist : g.title),
      colLabels: g.cols.map((col, j) => {
        const label = columnLabel(s, col as CareCol);
        const lines = (pack && wrapColumnLabel(s, translateLabel(pack, label))) || wrapColumnLabel(s, label);
        return lines ? lines.join("\n") : g.colLabels?.[j] ?? col;
      }),
      colNotes: notes.some(Boolean) ? notes : g.colNotes,
      rowLabels: dates.length ? g.rows.map((_, i) => `${days[i]} ${Number(dates[i].slice(8))}`) : pack ? [...days] : g.rowLabels,
      // Dated row labels are wider; widen the shading so they sit inside it. Shading only.
      bands: dates.length && g.bands ? { ...g.bands, fromXMm: g.bands.fromXMm - 4 } : g.bands,
      ...(s.icons ? { colIcons: columnIcons(s) } : {}),
    };
  });
  const style = { ...(s.highVisibility ? HIGH_VISIBILITY_STYLE : {}), ...(s.icons ? { showIcons: true } : {}) };
  const pen = pack?.penInstruction ?? "Fill each circle fully with a dark pen.";
  const footerLines = pack ? [...pack.footer] : base.footer?.lines ?? [];
  return {
    ...base,
    ...(pack ? { title: pack.title } : {}),
    // The header holds only the name: it must stay clear of the card-ID strip on the right.
    subtitle: name ? (pack ? `${pack.patient} ${name}` : headerLine(name)) : pack ? pen : base.subtitle,
    ...(Object.keys(style).length ? { printStyle: { ...base.printStyle, ...style } } : {}),
    groups,
    // The footer never grows: on Letter paper extra lines would reach the bottom corner markers.
    // With a name in the header, the pen instruction takes the place of the last footer line.
    footer: base.footer && {
      ...base.footer,
      lines: name ? [pen, ...footerLines.slice(0, -1)] : footerLines,
    },
  };
}

export function customizedElderLayouts(s: CareCardSettings): CardLayout[] {
  return ELDER_LAYOUTS.map((l) => customizeCareLayout(l, s));
}
