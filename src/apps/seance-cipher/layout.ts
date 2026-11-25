import type { CardIcon, CardLayout, PageSize } from "../../core";

/**
 * Oracle Cipher Card: 3 mystery questions, each with 4 runes. The player marks one rune per
 * question with a pen. Every chapter prints the same circles, corner markers and card-ID strip,
 * so one layout decodes every chapter; only the printed words change.
 */
export const RUNES = ["moon", "eye", "key", "flame"] as const;
export type Rune = (typeof RUNES)[number];
export const RUNE_NAMES: Record<Rune, string> = { moon: "Moon", eye: "Eye", key: "Key", flame: "Flame" };
export const RUNE_ICONS: CardIcon[] = ["moon", "eye", "key", "flame"];

export const QUESTIONS = ["q1", "q2", "q3"] as const;
export type Question = (typeof QUESTIONS)[number];

export interface Chapter {
  number: number;
  name: string;
  questions: [string, string, string];
}

export const CHAPTERS: Chapter[] = [
  { number: 1, name: "The Lantern Hall", questions: ["1. Who knocks at the door?", "2. Where does the candle lead?", "3. What do you leave behind?"] },
  { number: 2, name: "The Drowned Bell", questions: ["1. Who rings the bell?", "2. Where does the tide pull?", "3. What do you give the sea?"] },
  { number: 3, name: "The Last Mirror", questions: ["1. Who looks back at you?", "2. What does the glass show?", "3. What do you whisper?"] },
];

const FIRST_Y = 96;
const GROUP_PITCH = 54;

function cipherCard(page: PageSize, chapter: Chapter = CHAPTERS[0]): CardLayout {
  return {
    id: "seance-cipher",
    version: 1,
    title: "Oracle Cipher",
    subtitle: `Chapter ${chapter.number}: ${chapter.name}`,
    page,
    fiducial: { sizeMm: 16, insetMm: 6 },
    labelScale: 1.3,
    printStyle: { showIcons: true },
    groups: QUESTIONS.map((q, i) => ({
      key: q,
      title: chapter.questions[i],
      rows: ["rune"],
      cols: [...RUNES],
      colLabels: RUNES.map((r) => RUNE_NAMES[r]),
      colIcons: [...RUNE_ICONS],
      hideRowLabels: true,
      originMm: [48, FIRST_Y + i * GROUP_PITCH] as [number, number],
      pitchMm: [36, 0] as [number, number],
      radiusMm: 7,
    })),
    footer: {
      yMm: FIRST_Y + 2 * GROUP_PITCH + 26,
      lines: ["Mark one rune per question with a dark pen.", "Then hold the card to the light and scan it."],
    },
  };
}

/** Chapter 1 card, A4 first. Every chapter decodes with these. */
export const SEANCE_LAYOUTS: CardLayout[] = [cipherCard("A4"), cipherCard("Letter")];
export const SEANCE_LAYOUT = SEANCE_LAYOUTS[0];

/** The printed card for a chapter (same geometry as SEANCE_LAYOUTS). */
export function chapterLayouts(n: number): CardLayout[] {
  const ch = CHAPTERS[(n - 1 + CHAPTERS.length) % CHAPTERS.length];
  return (["A4", "Letter"] as const).map((p) => cipherCard(p, ch));
}

export function chapterOf(n: number): Chapter {
  return CHAPTERS[(n - 1 + CHAPTERS.length) % CHAPTERS.length];
}

/** "Question 2: Key". */
export function describeRune(b: { group: string; row: string; col: string }): string {
  return `Question ${b.group.slice(1)}: ${RUNE_NAMES[b.col as Rune] ?? b.col}`;
}
