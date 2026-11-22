import { describe, expect, it } from "vitest";
import { bubbleCenters, type BubbleState, type SuccessfulScan } from "../../../core";
import { applyManualOverrides } from "../../../shell/overrides";
import { PRACTICE_QUIZ } from "../answer-key";
import { gradeSheet } from "../grade";
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

const perfect = () =>
  Object.fromEntries(Object.entries(PRACTICE_QUIZ).map(([q, k]) => [`answers/${q}/${k.answer}`, "filled"])) as Record<string, BubbleState>;

describe("study bridge with manual overrides", () => {
  it("an unclear answer bubble scores as review until resolved", () => {
    const s = perfect();
    delete s["answers/Q7/D"];
    s["answers/Q7/D"] = "ambiguous"; // Algebra: Q7 is the correct answer, but unclear
    const raw = scanWith(s);

    const before = gradeSheet(raw, PRACTICE_QUIZ, TODAY);
    expect(before.questions[6].status).toBe("review");
    expect(before.scorePct).toBe(90);
    expect(before.weakTopics).toEqual(["Algebra"]);

    const after = gradeSheet(applyManualOverrides(raw, { "answers/Q7/D": "filled" }), PRACTICE_QUIZ, TODAY);
    expect(after.questions[6].status).toBe("correct");
    expect(after.scorePct).toBe(100);
    expect(after.weakTopics).toEqual([]);
    expect(after.schedule).toEqual([]);
  });

  it("confirming a stray unclear mark as filled makes the question a double mark", () => {
    const s = perfect();
    s["answers/Q2/C"] = "ambiguous"; // Q2 answer is A, already filled
    const raw = scanWith(s);
    expect(gradeSheet(raw, PRACTICE_QUIZ, TODAY).questions[1].status).toBe("review");

    const erased = gradeSheet(applyManualOverrides(raw, { "answers/Q2/C": "blank" }), PRACTICE_QUIZ, TODAY);
    expect(erased.questions[1].status).toBe("correct");
    expect(erased.scorePct).toBe(100);

    const double = gradeSheet(applyManualOverrides(raw, { "answers/Q2/C": "filled" }), PRACTICE_QUIZ, TODAY);
    expect(double.questions[1]).toMatchObject({ status: "invalid", marked: ["A", "C"] });
    expect(double.scorePct).toBe(90);
    expect(double.topics.find((t) => t.topic === "Fractions")).toMatchObject({ correct: 2, total: 3, weak: true });
  });
});
