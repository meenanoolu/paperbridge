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

/**
 * The 12 bubbles: 3 rows (q1..q3) of 4 columns. Both printed faces of this card, the Oracle
 * Cipher chapters and the X-Ray Rite sheet, use exactly these coordinates and the same card ID,
 * so one decoder reading (and every sample photo) fits either print.
 */
function baseGroup(i: number) {
  return {
    key: QUESTIONS[i] as string,
    rows: ["rune"],
    cols: [...RUNES] as string[],
    hideRowLabels: true,
    originMm: [48, FIRST_Y + i * GROUP_PITCH] as [number, number],
    pitchMm: [36, 0] as [number, number],
    radiusMm: 7,
  };
}

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
    groups: QUESTIONS.map((_, i) => ({
      ...baseGroup(i),
      title: chapter.questions[i],
      colLabels: RUNES.map((r) => RUNE_NAMES[r]),
      colIcons: [...RUNE_ICONS],
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

// ---------------------------------------------------------------------------
// X-Ray Rite: the 12-Rune Sheet
// ---------------------------------------------------------------------------

/** The 12 spooky runes of the X-Ray Rite sheet in reading order: rune 1 is top-left, rune 12 bottom-right. */
export const RITE_RUNE_NAMES = ["Skull", "Bat", "Ghost", "Pumpkin", "Eye", "Moon", "Candle", "Cross", "Spider", "Bone", "Coffin", "Star"] as const;
export const RITE_RUNE_COUNT = RITE_RUNE_NAMES.length;

/**
 * The bubble under rune `i` (0 to 11). The keys are the Oracle card's legacy slots (q1..q3,
 * moon/eye/key/flame), kept so printed cards and the sample photos keep decoding. On the Rite
 * sheet those columns carry the spooky runes instead.
 */
export function riteSlot(i: number): { group: Question; row: "rune"; col: Rune } {
  return { group: QUESTIONS[Math.floor(i / RUNES.length)], row: "rune", col: RUNES[i % RUNES.length] };
}

/** Each rune's picture sits below its bubble. The bubble itself stays blank white. */
export const RITE_GLYPH_MM = 12;
export const RITE_GLYPH_GAP_MM = 2.5;

/** The printable X-Ray Rite sheet: same 12 bubbles and card ID, spooky runes named above and drawn below each one. */
function riteCard(page: PageSize): CardLayout {
  return {
    id: "seance-cipher",
    version: 1,
    title: "X-Ray Rite",
    subtitle: "The 12-Rune Sheet",
    page,
    fiducial: { sizeMm: 16, insetMm: 6 },
    labelScale: 1.3,
    groups: QUESTIONS.map((_, i) => ({
      ...baseGroup(i),
      title: `Runes ${i * 4 + 1} to ${i * 4 + 4}`,
      colLabels: RITE_RUNE_NAMES.slice(i * 4, i * 4 + 4).map((name, j) => `${i * 4 + j + 1} ${name}`),
    })),
    // Lower than the Oracle card's footer: the last row of runes is drawn under its bubbles.
    footer: {
      yMm: FIRST_Y + 2 * GROUP_PITCH + 36,
      lines: ["Cover a lit rune with a finger or token.", "Keep all 4 corner squares in the camera view."],
    },
  };
}

/** The X-Ray Rite sheet on A4 and US Letter. Pictures are added by `riteSheet.ts`. */
export const SEANCE_RITE_LAYOUTS: CardLayout[] = [riteCard("A4"), riteCard("Letter")];
