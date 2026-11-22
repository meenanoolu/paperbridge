import type { CardLayout, PageSize } from "../../core";

export const QUESTIONS = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10"] as const;
export type QuestionId = (typeof QUESTIONS)[number];
export const OPTIONS = ["A", "B", "C", "D", "E"] as const;
export type Option = (typeof OPTIONS)[number];

const FIRST_ROW_Y = 80;
const ROW_PITCH = 18;

function bubbleSheet(page: PageSize): CardLayout {
  return {
    id: "study-mcq-10",
    version: 1,
    title: "Quiz Answer Sheet",
    // Kept short: the header line must end before the card-ID strip (checkPrintedText).
    subtitle: "Fill one circle per question.",
    page,
    fiducial: { sizeMm: 16, insetMm: 6 },
    labelScale: 1.25,
    groups: [
      {
        key: "answers",
        title: "Answers",
        rows: [...QUESTIONS],
        rowLabels: QUESTIONS.map((q) => q.slice(1)),
        cols: [...OPTIONS],
        originMm: [66, FIRST_ROW_Y],
        pitchMm: [20, ROW_PITCH],
        radiusMm: 5.5,
        bands: { fromXMm: 44, toXMm: 164 },
      },
    ],
    footer: {
      yMm: FIRST_ROW_Y + 9 * ROW_PITCH + 18,
      lines: ["Name: ______________________    Date: ____________", "To change an answer, erase it fully."],
    },
  };
}

export const STUDY_LAYOUTS: CardLayout[] = [bubbleSheet("A4"), bubbleSheet("Letter")];
export const STUDY_LAYOUT = STUDY_LAYOUTS[0];

/** Plain-language name of a bubble, e.g. "Question 6, option C". */
export function describeAnswerBubble(b: { row: string; col: string }): string {
  return `Question ${b.row.replace(/^Q/, "")}, option ${b.col}`;
}
