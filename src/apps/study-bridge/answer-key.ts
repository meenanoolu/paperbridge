import type { Option, QuestionId } from "./layout";

export interface KeyEntry {
  answer: Option;
  topic: string;
  prompt: string;
  choices: Record<Option, string>;
}

/** The practice quiz that matches the sample sheets. Teachers would supply their own key. */
export const PRACTICE_QUIZ: Record<QuestionId, KeyEntry> = {
  Q1: { topic: "Fractions", prompt: "1/2 + 1/4 = ?", answer: "B", choices: { A: "2/6", B: "3/4", C: "1/8", D: "2/4", E: "1" } },
  Q2: { topic: "Fractions", prompt: "Which is largest?", answer: "A", choices: { A: "2/3", B: "3/5", C: "5/8", D: "1/2", E: "4/7" } },
  Q3: { topic: "Fractions", prompt: "3/4 of 20 = ?", answer: "C", choices: { A: "12", B: "16", C: "15", D: "5", E: "18" } },
  Q4: { topic: "Geometry", prompt: "The angles of a triangle add up to?", answer: "D", choices: { A: "90", B: "360", C: "270", D: "180", E: "120" } },
  Q5: { topic: "Geometry", prompt: "Area of a 4 x 6 rectangle?", answer: "C", choices: { A: "10", B: "20", C: "24", D: "12", E: "48" } },
  Q6: { topic: "Geometry", prompt: "How many sides does a hexagon have?", answer: "B", choices: { A: "5", B: "6", C: "7", D: "8", E: "9" } },
  Q7: { topic: "Algebra", prompt: "2x + 3 = 11. x = ?", answer: "D", choices: { A: "3", B: "5", C: "7", D: "4", E: "8" } },
  Q8: { topic: "Algebra", prompt: "5(x - 2) when x = 4?", answer: "A", choices: { A: "10", B: "2", C: "20", D: "18", E: "6" } },
  Q9: { topic: "Statistics", prompt: "Mean of 2, 4, 9?", answer: "B", choices: { A: "4", B: "5", C: "6", D: "15", E: "9" } },
  Q10: { topic: "Statistics", prompt: "Median of 3, 7, 1, 9, 5?", answer: "E", choices: { A: "7", B: "3", C: "1", D: "9", E: "5" } },
};
