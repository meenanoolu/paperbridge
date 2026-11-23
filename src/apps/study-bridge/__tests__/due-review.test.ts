import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../../scripts/lib/photo";
import { bubbleCenters, checkLayout, checkPrintedText, decode, idBits } from "../../../core";
import { DEFAULT_EDITABLE_KEY, toAnswerKey } from "../answer-key";
import { dueReviewFileName, dueReviewSheet, reviewDueCandidates, reviewSubtitleCandidates, shortDate } from "../due-review";
import { gradeSheet } from "../grade";
import { STUDY_LAYOUT, STUDY_LAYOUTS } from "../layout";
import { STUDY_SAMPLE_SPECS } from "../samples/specs";

const key = toAnswerKey(DEFAULT_EDITABLE_KEY);
const read = (file: string) => {
  const r = decode(decodeJpeg(readFileSync(join(__dirname, "../samples", file))), STUDY_LAYOUT);
  if (!r.ok) throw new Error(r.reason);
  return gradeSheet(r, key, new Date("2026-11-23T10:00:00"));
};

describe("Adaptive Paper Loop: Print Due Review Card", () => {
  it("is offered only when topics are due", () => {
    expect(dueReviewSheet({ weakTopics: [], schedule: [] })).toBeNull();
    const alex = read("alex-strong.jpg");
    expect(alex.weakTopics).toEqual(["Geometry"]);
    expect(dueReviewSheet(alex)!.layouts[0].subtitle).toBe("Review: Geometry");
  });

  it("names the due topics in the header and the 1/3/7-day dates in the footer", () => {
    const sam = read("sam-review.jpg");
    const sheet = dueReviewSheet(sam)!;
    expect(sheet.topics).toEqual(["Fractions", "Algebra", "Geometry"]);
    expect(sheet.dates).toEqual(["2026-11-24", "2026-11-26", "2026-11-30"]);
    const [a4, letter] = sheet.layouts;
    expect(a4.title).toBe("Review Answer Sheet");
    expect(a4.subtitle).toBe("Review: Fractions, Algebra, Geometry");
    expect(a4.footer!.lines).toEqual(["Name: ______________________    Date: ____________", "Review due Tue 24 Nov (1 day), Thu 26 Nov (3 days) and Mon 30 Nov (7 days)."]);
    expect(a4.footer!.boldLines).toEqual([1]);
    // Letter is narrower between the bottom corner markers: the shorter line is used.
    expect(letter.footer!.lines[1]).toBe("Review due Tue 24 Nov, Thu 26 Nov and Mon 30 Nov.");
    expect(dueReviewFileName(sheet.dates, "A4")).toBe("review-sheet-2026-11-24-A4.pdf");
  });

  it("drops topics into a count when the header would reach the card-ID strip", () => {
    expect(reviewSubtitleCandidates(["A", "B", "C"])).toEqual(["Review: A, B, C", "Review: A, B +1 more", "Review: A +2 more", "Review: 3 topics"]);
    const long = ["Quadratic equations", "Trigonometric identities", "Probability", "Statistics"];
    const sheet = dueReviewSheet({ weakTopics: long, schedule: long.map((topic) => ({ topic, dates: ["2026-11-24", "2026-11-26", "2026-11-30"] })) })!;
    for (const l of sheet.layouts) {
      expect(l.subtitle).toMatch(/more$|topics$/);
      expect(checkPrintedText(l)).toEqual([]);
    }
    expect(reviewDueCandidates(["2026-12-31", "2027-01-02", "2027-01-06"])[2]).toBe("Due: Thu 31 Dec, Sat 2 Jan, Wed 6 Jan.");
    expect(shortDate("2026-11-24")).toBe("Tue 24 Nov");
  });

  it("keeps every bubble and ID bit, passes the checks, and a photographed review sheet grades identically", () => {
    const sam = read("sam-review.jpg");
    const sheet = dueReviewSheet(sam)!;
    for (const [i, l] of sheet.layouts.entries()) {
      expect(checkLayout(l).ok).toBe(true);
      expect(checkPrintedText(l)).toEqual([]);
      expect(bubbleCenters(l)).toEqual(bubbleCenters(STUDY_LAYOUTS[i]));
      expect(idBits(l)).toEqual(idBits(STUDY_LAYOUTS[i]));
    }
    const spec = STUDY_SAMPLE_SPECS.find((s) => s.id === "sam-review")!;
    const grade = (printed: typeof STUDY_LAYOUT) => {
      const r = decode(decodeJpeg(encodeJpeg(photographSample(printed, spec))), STUDY_LAYOUT);
      if (!r.ok) throw new Error(r.reason);
      return gradeSheet(r, key, new Date("2026-11-23T10:00:00"));
    };
    expect(grade(sheet.layouts[0])).toEqual(grade(STUDY_LAYOUT));
  });
});
