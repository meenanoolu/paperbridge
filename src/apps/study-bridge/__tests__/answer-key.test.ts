import { describe, expect, it } from "vitest";
import { bubbleCenters, type BubbleState, type SuccessfulScan } from "../../../core";
import {
  DEFAULT_EDITABLE_KEY,
  isPracticeKey,
  parseEditableKey,
  PRACTICE_QUIZ,
  toAnswerKey,
  validateKey,
  type EditableKey,
} from "../answer-key";
import { gradeMarks, gradeSheet, readMarks } from "../grade";
import { STUDY_LAYOUT } from "../layout";

const TODAY = new Date(2026, 10, 21);

function scanWith(states: Record<string, BubbleState>): SuccessfulScan {
  return {
    ok: true,
    cardId: STUDY_LAYOUT.id,
    layoutVersion: 1,
    fiducials: [],
    bubbles: bubbleCenters(STUDY_LAYOUT).map((b) => ({
      group: b.group,
      row: b.row,
      col: b.col,
      state: states[`${b.group}/${b.row}/${b.col}`] ?? "blank",
      confidence: 1,
      fill: 0,
      at: [0, 0],
    })),
  };
}

/** A student who answered A on every question. */
const allA = scanWith(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`answers/Q${i + 1}/A`, "filled"])));

const teacherKey = (): EditableKey => {
  const k = structuredClone(DEFAULT_EDITABLE_KEY);
  for (let i = 1; i <= 10; i++) k[`Q${i}` as keyof EditableKey] = { answer: i <= 4 ? "A" : "C", topic: i <= 5 ? "Cells" : "Genetics " };
  return k;
};

describe("custom answer key grading", () => {
  it("the default editable key is the practice quiz, with its question text", () => {
    expect(isPracticeKey(DEFAULT_EDITABLE_KEY)).toBe(true);
    expect(toAnswerKey(DEFAULT_EDITABLE_KEY)).toBe(PRACTICE_QUIZ);
  });

  it("grades the same sheet differently under a teacher's key", () => {
    expect(gradeSheet(allA, PRACTICE_QUIZ, TODAY).scorePct).toBe(20); // Q2 and Q8 are A
    const key = toAnswerKey(teacherKey());
    const g = gradeSheet(allA, key, TODAY);
    expect(g.scorePct).toBe(40);
    expect(g.questions[0].prompt).toBeUndefined();
    expect(g.topics).toEqual([
      { topic: "Cells", correct: 4, total: 5, pct: 80, weak: false },
      { topic: "Genetics", correct: 0, total: 5, pct: 0, weak: true },
    ]);
    expect(g.weakTopics).toEqual(["Genetics"]);
  });

  it("re-grading stored marks with a new key matches grading the scan", () => {
    const marks = readMarks(allA);
    const key = toAnswerKey(teacherKey());
    expect(gradeMarks(marks, key, TODAY)).toEqual(gradeSheet(allA, key, TODAY));
  });

  it("validates topics and answers", () => {
    const k = teacherKey();
    k.Q3 = { answer: "A", topic: "   " };
    k.Q4 = { answer: "Z" as "A", topic: "x".repeat(41) };
    expect(validateKey(k).map((p) => p.q)).toEqual(["Q3", "Q4", "Q4"]);
    expect(validateKey(DEFAULT_EDITABLE_KEY)).toEqual([]);
  });

  it("parses stored keys defensively", () => {
    expect(parseEditableKey("nope")).toBeNull();
    const parsed = parseEditableKey({ Q1: { answer: "E", topic: "  Optics  " }, Q2: { answer: "F", topic: "x" }, Q3: "bad" })!;
    expect(parsed.Q1).toEqual({ answer: "E", topic: "Optics" });
    expect(parsed.Q2).toEqual(DEFAULT_EDITABLE_KEY.Q2);
    expect(parsed.Q3).toEqual(DEFAULT_EDITABLE_KEY.Q3);
  });
});
