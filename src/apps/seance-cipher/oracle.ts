import { bubbleKey, readingsByKey, type SuccessfulScan } from "../../core";
import { chapterOf, QUESTIONS, RUNE_NAMES, RUNES, type Question, type Rune } from "./layout";

/**
 * Seance Cipher rules. Pure and deterministic: the same marks always tell the same story.
 * A question is answered by exactly one clear rune. Unclear marks are never guessed: the
 * story waits until a person confirms them, like every other PaperBridge app.
 */
export type AnswerStatus = "chosen" | "blank" | "multiple" | "unclear";

export interface QuestionReading {
  question: Question;
  status: AnswerStatus;
  rune: Rune | null;
}

export type Fate = Rune | "veil";

export interface OracleReading {
  chapter: number;
  answers: QuestionReading[];
  /** True when all 3 questions have one clear rune. */
  complete: boolean;
  /** What to tell the player while the story waits. */
  prompt: string | null;
  /** The story verdict, when complete. */
  verdict: { title: string; story: string; fate: Fate } | null;
}

/** Story fragments per chapter, question and rune. */
const FRAGMENTS: Record<number, Record<Question, Record<Rune, string>>> = {
  1: {
    q1: { moon: "A pale child carrying moonlight in a jar", eye: "A watcher with too many candles in her eyes", key: "The old caretaker, rattling a ring of iron keys", flame: "A stranger whose coat still smokes" },
    q2: { moon: "leads you down the stairwell where the windows face the sky", eye: "walks you past portraits that turn to follow you", key: "takes you to a locked door no one remembers building", flame: "brings you into the hall where every lantern relights itself" },
    q3: { moon: "and you leave a silver coin for the dreaming.", eye: "and you leave your reflection on the glass.", key: "and you leave the door unlocked behind you.", flame: "and you leave one candle burning, for whoever comes next." },
  },
  2: {
    q1: { moon: "The tide itself, pulled by a low red moon,", eye: "A drowned sailor with open, patient eyes", key: "The keeper of the lighthouse, long dead,", flame: "A lantern that floats without a hand to hold it" },
    q2: { moon: "draws you along the silver path on the water", eye: "turns you toward a ship that is watching back", key: "guides you to the chained gate of the sea cave", flame: "leads you to a beacon burning under the waves" },
    q3: { moon: "and you give it a lullaby your mother sang.", eye: "and you give it the name you never say aloud.", key: "and you give it the key from your pocket.", flame: "and you give it your last match, still dry." },
  },
  3: {
    q1: { moon: "Your own face, years older and smiling,", eye: "Someone who knows every secret you kept", key: "The child you were, holding out a small brass key,", flame: "A figure made of candle smoke" },
    q2: { moon: "shows you the night you first felt brave", eye: "shows you the room behind your room", key: "shows you a door opening onto morning", flame: "shows you every candle you ever lit, still burning" },
    q3: { moon: "and you whisper goodnight, and mean it.", eye: "and you whisper the truth at last.", key: "and you whisper the word that opens it.", flame: "and you whisper thank you to the dark." },
  },
};

const FATES: Record<Fate, { title: string; line: string }> = {
  moon: { title: "The Dreaming Path", line: "The Moon rune rules this reading: what you saw was a dream that remembers you." },
  eye: { title: "The Revelation", line: "The Eye rune rules this reading: something hidden has been seen, and cannot be unseen." },
  key: { title: "The Way Out", line: "The Key rune rules this reading: a door has opened that will not close again." },
  flame: { title: "The Brave Light", line: "The Flame rune rules this reading: you carried a light into the dark and it held." },
  veil: { title: "The Veil Stays Open", line: "No rune rules this reading. The veil stays open, and the spirits will speak again next chapter." },
};

/** The rune chosen most often; ties leave the veil open. */
export function fateOf(runes: Rune[]): Fate {
  const counts = RUNES.map((r) => runes.filter((x) => x === r).length);
  const max = Math.max(...counts);
  return counts.filter((c) => c === max).length === 1 ? RUNES[counts.indexOf(max)] : "veil";
}

export function storyFor(chapter: number, runes: [Rune, Rune, Rune]): { title: string; story: string; fate: Fate } {
  const ch = chapterOf(chapter);
  const f = FRAGMENTS[ch.number];
  const fate = fateOf(runes);
  return {
    title: `${ch.name}: ${FATES[fate].title}`,
    story: `${f.q1[runes[0]]} ${f.q2[runes[1]]}, ${f.q3[runes[2]]} ${FATES[fate].line}`,
    fate,
  };
}

export function readOracle(scan: SuccessfulScan, chapter: number): OracleReading {
  const r = readingsByKey(scan);
  const answers: QuestionReading[] = QUESTIONS.map((q) => {
    const states = RUNES.map((rune) => r.get(bubbleKey(q, "rune", rune))?.state ?? "ambiguous");
    const chosen = RUNES.filter((_, i) => states[i] === "filled");
    const status: AnswerStatus = states.includes("ambiguous") ? "unclear" : chosen.length > 1 ? "multiple" : chosen.length === 0 ? "blank" : "chosen";
    return { question: q, status, rune: status === "chosen" ? chosen[0] : null };
  });
  const complete = answers.every((a) => a.status === "chosen");
  const n = (s: AnswerStatus) => answers.filter((a) => a.status === s).length;
  const prompt = complete
    ? null
    : n("unclear")
      ? `The veil is thin: ${n("unclear") === 1 ? "a faint mark needs" : `${n("unclear")} faint marks need`} a human to confirm it before the spirits speak.`
      : n("multiple")
        ? "The spirits are confused: mark only one rune per question."
        : "The question remains unanswered: mark one rune for every question.";
  const verdict = complete ? storyFor(chapter, answers.map((a) => a.rune!) as [Rune, Rune, Rune]) : null;
  return { chapter: chapterOf(chapter).number, answers, complete, prompt, verdict };
}

/** "Question 1: Key, Question 2: unclear, ..." for screen readers. */
export function readingSummary(o: OracleReading): string {
  const parts = o.answers.map((a, i) => `Question ${i + 1}: ${a.rune ? RUNE_NAMES[a.rune] : a.status}`);
  return `${parts.join(", ")}. ${o.verdict ? o.verdict.title : o.prompt ?? ""}`;
}
