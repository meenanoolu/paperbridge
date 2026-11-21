import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { bubbleCenters, decode, validateLayout, type BubbleState, type SuccessfulScan } from "../../../core";
import { PRACTICE_QUIZ } from "../answer-key";
import { gradeSheet } from "../grade";
import { STUDY_LAYOUT, STUDY_LAYOUTS } from "../layout";
import { STUDY_SAMPLE_SPECS } from "../samples/specs";

const TODAY = new Date(2026, 10, 21); // 21 Nov 2026, local time

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

const perfect = () =>
  Object.fromEntries(Object.entries(PRACTICE_QUIZ).map(([q, k]) => [`answers/${q}/${k.answer}`, "filled"])) as Record<string, BubbleState>;

describe("gradeSheet", () => {
  it("scores a perfect sheet 100% with no weak topics", () => {
    const g = gradeSheet(scanWith(perfect()), PRACTICE_QUIZ, TODAY);
    expect(g.scorePct).toBe(100);
    expect(g.weakTopics).toEqual([]);
    expect(g.schedule).toEqual([]);
  });

  it("marks a double-marked question invalid and scores it wrong (R6.4)", () => {
    const g = gradeSheet(scanWith({ ...perfect(), "answers/Q4/A": "filled" }), PRACTICE_QUIZ, TODAY);
    expect(g.questions[3]).toMatchObject({ status: "invalid", marked: ["A", "D"] });
    expect(g.correct).toBe(9);
  });

  it("treats an unclear bubble as review, not as an answer", () => {
    const s = perfect();
    s["answers/Q2/C"] = "ambiguous";
    expect(gradeSheet(scanWith(s), PRACTICE_QUIZ, TODAY).questions[1].status).toBe("review");
  });

  it("flags topics below 70% and schedules reviews at +1, +3, +7 days (R6.5, R6.6)", () => {
    const s = perfect();
    delete s["answers/Q7/D"]; // Algebra 1 of 2 = 50%
    const g = gradeSheet(scanWith(s), PRACTICE_QUIZ, TODAY);
    expect(g.questions[6].status).toBe("blank");
    expect(g.weakTopics).toEqual(["Algebra"]);
    expect(g.schedule).toEqual([{ topic: "Algebra", dates: ["2026-11-22", "2026-11-24", "2026-11-28"] }]);
  });

  it("does not flag a topic at exactly 70% or above", () => {
    const g = gradeSheet(scanWith(perfect()), PRACTICE_QUIZ, TODAY);
    expect(g.topics.every((t) => !t.weak)).toBe(true);
  });
});

describe("study sample sheets (decoded from the checked-in JPEGs)", () => {
  const grade = (id: string) => {
    const spec = STUDY_SAMPLE_SPECS.find((s) => s.id === id)!;
    const result = decode(decodeJpeg(readFileSync(join(__dirname, "../samples", spec.file))), STUDY_LAYOUT);
    if (!result.ok) throw new Error(result.reason);
    return gradeSheet(result, PRACTICE_QUIZ, TODAY);
  };

  it("layout is valid for A4 and Letter", () => {
    for (const l of STUDY_LAYOUTS) expect(validateLayout(l)).toEqual([]);
  });

  it("Alex: 90%, Geometry weak at 67%", () => {
    const g = grade("alex-strong");
    expect(g.scorePct).toBe(90);
    expect(g.questions[4]).toMatchObject({ q: "Q5", status: "incorrect", marked: ["D"] });
    expect(g.weakTopics).toEqual(["Geometry"]);
  });

  it("Sam: 60%, invalid Q6, blank Q7, three weak topics", () => {
    const g = grade("sam-review");
    expect(g.scorePct).toBe(60);
    expect(g.questions.map((q) => q.status)).toEqual([
      "incorrect", "correct", "incorrect", "correct", "correct", "invalid", "blank", "correct", "correct", "correct",
    ]);
    expect(g.weakTopics).toEqual(["Fractions", "Algebra", "Geometry"]);
  });
});
