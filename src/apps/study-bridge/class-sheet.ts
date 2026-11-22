import type { AnswerKey } from "./answer-key";
import { gradeMarks, WEAK_TOPIC_BELOW_PCT, type GradeReport, type SheetMarks } from "./grade";
import { OPTIONS, QUESTIONS, type Option } from "./layout";

/**
 * A class's graded sheets, kept in this browser. Each entry stores the student's MARKS, not
 * their grades, so the whole class re-grades when the teacher edits the answer key.
 */
export interface ClassEntry {
  /** Normalized student name/ID: one entry per student, re-adding replaces it. */
  id: string;
  student: string;
  savedAt: string;
  scannedAt: string;
  marks: SheetMarks;
}

export interface ClassRow {
  entry: ClassEntry;
  report: GradeReport;
}

export const MAX_STUDENT = 60;
export const MAX_CLASS = 200;

export function studentId(student: string): string {
  return student.trim().replace(/\s+/g, " ").toLowerCase();
}

export function validateStudent(student: string): string | null {
  const s = student.trim();
  if (!s) return "Enter the student's name or ID.";
  if (s.length > MAX_STUDENT) return `Use at most ${MAX_STUDENT} characters.`;
  return null;
}

export function toClassEntry(student: string, marks: SheetMarks, scannedAt: Date, savedAt: Date): ClassEntry {
  const name = student.trim().replace(/\s+/g, " ");
  return { id: studentId(name), student: name, savedAt: savedAt.toISOString(), scannedAt: scannedAt.toISOString(), marks };
}

/** Add or replace a student. Sorted by name for a stable gradebook. */
export function addStudent(list: ClassEntry[], entry: ClassEntry): { list: ClassEntry[]; replaced: boolean } {
  const replaced = list.some((e) => e.id === entry.id);
  const next = [...list.filter((e) => e.id !== entry.id), entry]
    .sort((a, b) => a.student.localeCompare(b.student, "en", { sensitivity: "base", numeric: true }))
    .slice(0, MAX_CLASS);
  return { list: next, replaced };
}

export function removeStudent(list: ClassEntry[], id: string): ClassEntry[] {
  return list.filter((e) => e.id !== id);
}

export function gradeClass(list: ClassEntry[], key: AnswerKey, today: Date): ClassRow[] {
  return list.map((entry) => ({ entry, report: gradeMarks(entry.marks, key, today) }));
}

export interface TopicBreakdown {
  topic: string;
  /** Mean of students' topic percentages. */
  classPct: number;
  /** Students below WEAK_TOPIC_BELOW_PCT on this topic. */
  weakStudents: number;
  students: number;
  weakPct: number;
}

/** For each topic: class average and the share of students weak in it. Most-missed first. */
export function classTopicBreakdown(rows: ClassRow[]): TopicBreakdown[] {
  const by = new Map<string, { sum: number; weak: number; n: number }>();
  for (const { report } of rows) {
    for (const t of report.topics) {
      const b = by.get(t.topic) ?? { sum: 0, weak: 0, n: 0 };
      b.sum += t.pct;
      b.n++;
      if (t.pct < WEAK_TOPIC_BELOW_PCT) b.weak++;
      by.set(t.topic, b);
    }
  }
  return [...by]
    .map(([topic, b]) => ({
      topic,
      classPct: Math.round(b.sum / b.n),
      weakStudents: b.weak,
      students: b.n,
      weakPct: Math.round((b.weak / b.n) * 100),
    }))
    .sort((a, b) => b.weakPct - a.weakPct || a.classPct - b.classPct || a.topic.localeCompare(b.topic));
}

// ---------------------------------------------------------------------------
// CSV gradebook
// ---------------------------------------------------------------------------

/**
 * One RFC 4180 cell. Quotes when needed and doubles inner quotes. Cells that a spreadsheet
 * would run as a formula (= + - @ tab CR) are prefixed with an apostrophe (OWASP CSV injection).
 */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = ["Student", "Score", "%", "Double-Marked", "Blank", "Unclear", "Weak Topics"];

const qList = (r: GradeReport, status: string) =>
  r.questions
    .filter((q) => q.status === status)
    .map((q) => q.q)
    .join("; ");

/** Gradebook CSV: UTF-8 BOM (so Excel reads accents), CRLF line endings, one row per student. */
export function gradebookCsv(rows: ClassRow[]): string {
  const lines = [CSV_HEADER, ...rows.map(({ entry, report: r }) => [
    entry.student,
    `${r.correct} of ${r.total}`,
    r.scorePct,
    qList(r, "invalid"),
    qList(r, "blank"),
    qList(r, "review"),
    r.weakTopics.join("; "),
  ])];
  return "\ufeff" + lines.map((cols) => cols.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function gradebookFileName(today: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `gradebook-${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}.csv`;
}

// ---------------------------------------------------------------------------
// Parsing stored class sheets
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseMarks(v: unknown): SheetMarks | null {
  if (!isObj(v)) return null;
  const out: Partial<SheetMarks> = {};
  for (const q of QUESTIONS) {
    const m = v[q];
    if (!isObj(m) || !Array.isArray(m.marked) || typeof m.unclear !== "boolean") return null;
    const marked = OPTIONS.filter((o) => (m.marked as unknown[]).includes(o)) as Option[];
    out[q] = { marked, unclear: m.unclear };
  }
  return out as SheetMarks;
}

export function parseClassSheet(raw: unknown): ClassEntry[] | null {
  if (!Array.isArray(raw)) return null;
  let list: ClassEntry[] = [];
  for (const item of raw) {
    if (!isObj(item) || typeof item.student !== "string" || validateStudent(item.student)) continue;
    const marks = parseMarks(item.marks);
    const savedAt = typeof item.savedAt === "string" && !Number.isNaN(Date.parse(item.savedAt)) ? item.savedAt : null;
    const scannedAt = typeof item.scannedAt === "string" && !Number.isNaN(Date.parse(item.scannedAt)) ? item.scannedAt : null;
    if (!marks || !savedAt || !scannedAt) continue;
    list = addStudent(list, toClassEntry(item.student, marks, new Date(scannedAt), new Date(savedAt))).list;
  }
  return list;
}
