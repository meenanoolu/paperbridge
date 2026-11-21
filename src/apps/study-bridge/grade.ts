import { bubbleKey, readingsByKey, type SuccessfulScan } from "../../core";
import type { KeyEntry } from "./answer-key";
import { OPTIONS, QUESTIONS, type Option, type QuestionId } from "./layout";

/**
 * correct / incorrect: exactly one clear mark.
 * blank: no marks. invalid: more than one mark (R6.4).
 * review: an unclear mark; scored as not correct and listed for the teacher to check.
 */
export type QuestionStatus = "correct" | "incorrect" | "blank" | "invalid" | "review";

export interface QuestionResult {
  q: QuestionId;
  topic: string;
  prompt: string;
  answer: Option;
  marked: Option[];
  status: QuestionStatus;
}

export interface TopicResult {
  topic: string;
  correct: number;
  total: number;
  pct: number;
  weak: boolean;
}

export interface GradeReport {
  correct: number;
  total: number;
  scorePct: number;
  questions: QuestionResult[];
  topics: TopicResult[];
  weakTopics: string[];
  /** Spaced-repetition review dates (YYYY-MM-DD) per weak topic. */
  schedule: { topic: string; dates: string[] }[];
}

export const WEAK_TOPIC_BELOW_PCT = 70;
export const REVIEW_INTERVAL_DAYS = [1, 3, 7] as const;

function addDays(date: Date, days: number): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + days));
  return d.toISOString().slice(0, 10);
}

/** Grade a decoded answer sheet. `today` is a parameter so the function stays pure. */
export function gradeSheet(scan: SuccessfulScan, key: Record<QuestionId, KeyEntry>, today: Date): GradeReport {
  const r = readingsByKey(scan);
  const questions: QuestionResult[] = QUESTIONS.map((q) => {
    const states = OPTIONS.map((o) => r.get(bubbleKey("answers", q, o))?.state ?? "ambiguous");
    const marked = OPTIONS.filter((_, i) => states[i] === "filled");
    const k = key[q];
    let status: QuestionStatus;
    if (marked.length > 1) status = "invalid";
    else if (states.includes("ambiguous")) status = "review";
    else if (marked.length === 0) status = "blank";
    else status = marked[0] === k.answer ? "correct" : "incorrect";
    return { q, topic: k.topic, prompt: k.prompt, answer: k.answer, marked, status };
  });

  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const qr of questions) {
    const t = byTopic.get(qr.topic) ?? { correct: 0, total: 0 };
    t.total++;
    if (qr.status === "correct") t.correct++;
    byTopic.set(qr.topic, t);
  }
  const topics: TopicResult[] = [...byTopic].map(([topic, t]) => {
    const pct = Math.round((t.correct / t.total) * 100);
    return { topic, ...t, pct, weak: pct < WEAK_TOPIC_BELOW_PCT };
  });
  const weakTopics = topics.filter((t) => t.weak).sort((a, b) => a.pct - b.pct).map((t) => t.topic);
  const correct = questions.filter((q) => q.status === "correct").length;

  return {
    correct,
    total: questions.length,
    scorePct: Math.round((correct / questions.length) * 100),
    questions,
    topics,
    weakTopics,
    schedule: weakTopics.map((topic) => ({ topic, dates: REVIEW_INTERVAL_DAYS.map((d) => addDays(today, d)) })),
  };
}
