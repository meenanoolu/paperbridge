import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { decode } from "../../../core";
import { DEFAULT_EDITABLE_KEY, PRACTICE_QUIZ, toAnswerKey } from "../answer-key";
import {
  addStudent,
  classTopicBreakdown,
  csvCell,
  gradebookCsv,
  gradebookFileName,
  gradeClass,
  parseClassSheet,
  removeStudent,
  toClassEntry,
  validateStudent,
  type ClassEntry,
} from "../class-sheet";
import { readMarks, type SheetMarks } from "../grade";
import { STUDY_LAYOUT } from "../layout";

const TODAY = new Date(2026, 10, 21);
const T = new Date("2026-11-21T10:00:00Z");

function sampleMarks(file: string): SheetMarks {
  const r = decode(decodeJpeg(readFileSync(join(__dirname, "../samples", file))), STUDY_LAYOUT);
  if (!r.ok) throw new Error(r.reason);
  return readMarks(r);
}

/** Marks from a list of answers like "BACDCBDABE" ("-" blank, "?" unclear, "BC" via array). */
function marksFrom(answers: (string | string[])[]): SheetMarks {
  return Object.fromEntries(
    answers.map((a, i) => [
      `Q${i + 1}`,
      a === "-" ? { marked: [], unclear: false } : a === "?" ? { marked: [], unclear: true } : { marked: Array.isArray(a) ? a : [a], unclear: false },
    ]),
  ) as SheetMarks;
}

function classOf(): ClassEntry[] {
  let list: ClassEntry[] = [];
  for (const [name, marks] of [
    ["Sam", sampleMarks("sam-review.jpg")],
    ["Alex", sampleMarks("alex-strong.jpg")],
    ["Jo, \"JJ\" Park", marksFrom(["B", "A", "C", "D", "C", "B", "D", "A", "B", "E"])],
  ] as const) {
    list = addStudent(list, toClassEntry(name, marks, T, T)).list;
  }
  return list;
}

describe("class sheet", () => {
  it("sorts by student and replaces a re-added student", () => {
    const list = classOf();
    expect(list.map((e) => e.student)).toEqual(["Alex", 'Jo, "JJ" Park', "Sam"]);
    const again = addStudent(list, toClassEntry("  sam ", marksFrom(Array(10).fill("A")), T, T));
    expect(again.replaced).toBe(true);
    expect(again.list).toHaveLength(3);
    expect(removeStudent(again.list, "sam")).toHaveLength(2);
  });

  it("validates the student name", () => {
    expect(validateStudent("  ")).toMatch(/Enter/);
    expect(validateStudent("x".repeat(61))).toMatch(/at most/);
    expect(validateStudent("S-1042")).toBeNull();
  });

  it("aggregates weak topics across the class", () => {
    const rows = gradeClass(classOf(), PRACTICE_QUIZ, TODAY);
    expect(rows.map((r) => r.report.scorePct)).toEqual([90, 100, 60]);
    expect(classTopicBreakdown(rows)).toEqual([
      { topic: "Geometry", classPct: 78, weakStudents: 2, students: 3, weakPct: 67 },
      // Ties on weak share: lower class average first.
      { topic: "Fractions", classPct: 78, weakStudents: 1, students: 3, weakPct: 33 },
      { topic: "Algebra", classPct: 83, weakStudents: 1, students: 3, weakPct: 33 },
      { topic: "Statistics", classPct: 100, weakStudents: 0, students: 3, weakPct: 0 },
    ]);
  });

  it("re-grades the whole class when the key changes", () => {
    const key = structuredClone(DEFAULT_EDITABLE_KEY);
    key.Q5 = { answer: "D", topic: "Geometry" };
    const rows = gradeClass(classOf(), toAnswerKey(key), TODAY);
    // Alex was marked wrong on Q5 (D); Jo and Sam answered C.
    expect(rows.map((r) => r.report.scorePct)).toEqual([100, 90, 50]);
  });

  it("round-trips through storage and drops corrupt entries", () => {
    const list = classOf();
    const stored = JSON.parse(JSON.stringify([...list, { student: "", marks: {} }, { student: "Bad", marks: { Q1: 1 }, savedAt: T, scannedAt: T }]));
    expect(parseClassSheet(stored)).toEqual(list);
    expect(parseClassSheet({})).toBeNull();
  });
});

describe("CSV gradebook", () => {
  it("escapes cells per RFC 4180 and blocks formula injection", () => {
    expect(csvCell("Alex")).toBe("Alex");
    expect(csvCell(60)).toBe("60");
    expect(csvCell('Jo, "JJ" Park')).toBe('"Jo, ""JJ"" Park"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(" padded ")).toBe('" padded "');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-")).toBe("'-");
    expect(csvCell("@sum")).toBe("'@sum");
    expect(csvCell("")).toBe("");
  });

  it("formats the gradebook with a BOM, CRLF, and one row per student", () => {
    const csv = gradebookCsv(gradeClass(classOf(), PRACTICE_QUIZ, TODAY));
    expect(csv).toBe(
      "\ufeff" +
        [
          "Student,Score,%,Double-Marked,Blank,Unclear,Weak Topics",
          "Alex,9 of 10,90,,,,Geometry",
          '"Jo, ""JJ"" Park",10 of 10,100,,,,',
          "Sam,6 of 10,60,Q6,Q7,,Fractions; Algebra; Geometry",
        ].join("\r\n") +
        "\r\n",
    );
  });

  it("lists unclear questions and names the file by date", () => {
    const list = addStudent([], toClassEntry("Rae", marksFrom(["B", "?", "C", "D", "C", ["B", "C"], "-", "A", "B", "E"]), T, T)).list;
    expect(gradebookCsv(gradeClass(list, PRACTICE_QUIZ, TODAY)).split("\r\n")[1]).toBe("Rae,7 of 10,70,Q6,Q7,Q2,Algebra; Fractions; Geometry");
    expect(gradebookFileName(TODAY)).toBe("gradebook-2026-11-21.csv");
  });
});
