import { OPTIONS, QUESTIONS, type Option, type QuestionId } from "./layout";

export interface KeyEntry {
  answer: Option;
  topic: string;
  /** Question text and choices exist only for the built-in practice quiz. */
  prompt?: string;
  choices?: Record<Option, string>;
}

export type AnswerKey = Record<QuestionId, KeyEntry>;

/** The practice quiz that matches the sample sheets. Teachers would supply their own key. */
export const PRACTICE_QUIZ: AnswerKey = {
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

/** What the teacher edits and what is stored: answer + topic per question. */
export type EditableKey = Record<QuestionId, { answer: Option; topic: string }>;

export const MAX_TOPIC = 40;

export const DEFAULT_EDITABLE_KEY: EditableKey = Object.fromEntries(
  QUESTIONS.map((q) => [q, { answer: PRACTICE_QUIZ[q].answer, topic: PRACTICE_QUIZ[q].topic }]),
) as EditableKey;

/** Collapse whitespace so "Algebra " and "Algebra" are one topic. */
export function normalizeTopic(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

export function isPracticeKey(k: EditableKey): boolean {
  return QUESTIONS.every((q) => k[q].answer === PRACTICE_QUIZ[q].answer && normalizeTopic(k[q].topic) === PRACTICE_QUIZ[q].topic);
}

/**
 * The key used for grading. The practice quiz keeps its question text; a teacher's own key
 * grades by answer and topic only (their paper quiz has different questions).
 */
export function toAnswerKey(k: EditableKey): AnswerKey {
  if (isPracticeKey(k)) return PRACTICE_QUIZ;
  return Object.fromEntries(QUESTIONS.map((q) => [q, { answer: k[q].answer, topic: normalizeTopic(k[q].topic) }])) as AnswerKey;
}

export interface KeyProblem {
  q: QuestionId;
  message: string;
}

export function validateKey(k: EditableKey): KeyProblem[] {
  const problems: KeyProblem[] = [];
  for (const q of QUESTIONS) {
    const t = normalizeTopic(k[q].topic);
    if (!t) problems.push({ q, message: "Enter a topic." });
    else if (t.length > MAX_TOPIC) problems.push({ q, message: `Use at most ${MAX_TOPIC} characters.` });
    if (!OPTIONS.includes(k[q].answer)) problems.push({ q, message: "Choose A to E." });
  }
  return problems;
}

/** Validate a stored key. Any invalid question falls back to the practice key's entry. */
export function parseEditableKey(raw: unknown): EditableKey | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return Object.fromEntries(
    QUESTIONS.map((q) => {
      const e = r[q] as { answer?: unknown; topic?: unknown } | undefined;
      const answer = OPTIONS.find((o) => o === e?.answer);
      const topic = typeof e?.topic === "string" ? normalizeTopic(e.topic).slice(0, MAX_TOPIC) : "";
      return [q, answer && topic ? { answer, topic } : DEFAULT_EDITABLE_KEY[q]];
    }),
  ) as EditableKey;
}
