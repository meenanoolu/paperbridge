import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { decode } from "../../../core";
import { DEFAULT_EDITABLE_KEY, toAnswerKey } from "../answer-key";
import { gradeSheet } from "../grade";
import { STUDY_LAYOUT } from "../layout";
import { studyShareText, studySpokenSummary } from "../voice";

const grade = (file: string) => {
  const r = decode(decodeJpeg(readFileSync(join(__dirname, "../samples", file))), STUDY_LAYOUT);
  if (!r.ok) throw new Error(r.reason);
  return gradeSheet(r, toAnswerKey(DEFAULT_EDITABLE_KEY), new Date("2026-11-23T10:00:00"));
};

describe("Study Bridge: Read Aloud and Copy Quick Update", () => {
  it("speaks the score and the topics due", () => {
    expect(studySpokenSummary(grade("sam-review.jpg"))).toEqual({ text: "Score: 6 out of 10, 60 percent. Review next: Fractions, Algebra, Geometry.", lang: "en-US" });
  });

  it("writes a 3-line student/parent update with the score and review dates", () => {
    expect(studyShareText(grade("sam-review.jpg")).split("\n")).toEqual([
      "Quiz result: 6 of 10 (60%).",
      "Review next: Fractions, Algebra, Geometry.",
      "Review dates: Tue 24 Nov, Thu 26 Nov, Mon 30 Nov.",
    ]);
  });

  it("reads well with nothing due", () => {
    const g = { ...grade("alex-strong.jpg"), weakTopics: [], schedule: [] };
    expect(studySpokenSummary(g).text).toMatch(/No topics need review\.$/);
    expect(studyShareText(g).split("\n")).toEqual([`Quiz result: ${g.correct} of 10 (${g.scorePct}%).`, "No topics need review. Well done!", "Next step: try a new quiz."]);
  });
});
