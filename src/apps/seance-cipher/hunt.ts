import type { SuccessfulScan } from "../../core";
import { RITE_RUNE_COUNT, RITE_RUNE_NAMES, riteSlot } from "./layout";
import { nextRandom } from "./riteEngine";
import { runeKey } from "./riteVision";

/**
 * The Haunted Treasure Hunt. Something nefarious hides in one of the 12 rooms of the haunted
 * house. You mark a room on the printed map (the 12-Rune Sheet, 3 rows of 4), take one photo, and
 * the reader tells you how warm or cold you are. The reader only ever reports what the pen
 * says: a faint mark goes to a person, never to a guess. All of this is pure (no DOM, no clock,
 * no hidden randomness: the creature's room comes from a seed), so it is unit tested directly.
 */
export const ROWS = 3;
export const COLS = 4;
export const MAX_GUESSES = 5;

/** The 12 rooms, in the same reading order as the printed runes. */
export const ROOMS = [
  "Skull Crypt",
  "Bat Belfry",
  "Ghost Gallery",
  "Pumpkin Pantry",
  "Eye Study",
  "Moon Attic",
  "Candle Hall",
  "Cross Chapel",
  "Spider Cellar",
  "Bone Library",
  "Coffin Parlor",
  "Star Tower",
] as const;

/** The rune printed under room `i` on the map. */
export const runeOfRoom = (i: number) => RITE_RUNE_NAMES[i];

export const roomPos = (i: number) => ({ row: Math.floor(i / COLS), col: i % COLS });

/** Steps between two rooms, moving along rows and columns (a room next door is 1). */
export function distance(a: number, b: number): number {
  const p = roomPos(a);
  const q = roomPos(b);
  return Math.abs(p.row - q.row) + Math.abs(p.col - q.col);
}

export type Heat = "found" | "scorching" | "hot" | "warm" | "cold" | "freezing";

/** The farthest two rooms can be apart on a 3 by 4 house is 5 steps. */
export function heatFor(d: number): Heat {
  if (d <= 0) return "found";
  if (d === 1) return "scorching";
  if (d === 2) return "hot";
  if (d === 3) return "warm";
  if (d === 4) return "cold";
  return "freezing";
}

export const HEAT_LABEL: Record<Heat, string> = {
  found: "Found it!",
  scorching: "Scorching! It is next door",
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  freezing: "Freezing! It is far away",
};

/** Short chips for the guess trail and the map. */
export const HEAT_SHORT: Record<Heat, string> = { found: "Found", scorching: "Scorching", hot: "Hot", warm: "Warm", cold: "Cold", freezing: "Freezing" };

export interface Guess {
  room: number;
  heat: Heat;
  distance: number;
}

export interface Hunt {
  /** The creature's room. Hidden from the player until the hunt ends. */
  creature: number;
  guesses: Guess[];
  status: "hunting" | "won" | "lost";
}

/** Hide the creature with a seed, so the same seed always hides it in the same room. */
export function createHunt(seed: number): Hunt {
  const [r] = nextRandom(seed >>> 0);
  return hideAt(Math.min(RITE_RUNE_COUNT - 1, Math.floor(r * RITE_RUNE_COUNT)));
}

/** Hide the creature in a chosen room (a friend hides it). */
export function hideAt(room: number): Hunt {
  return { creature: Math.max(0, Math.min(RITE_RUNE_COUNT - 1, Math.floor(room))), guesses: [], status: "hunting" };
}

export type GuessOutcome = { hunt: Hunt; repeat: boolean };

/** Apply one guess. A room already tried, or a finished hunt, changes nothing. */
export function makeGuess(hunt: Hunt, room: number): GuessOutcome {
  if (hunt.status !== "hunting" || room < 0 || room >= RITE_RUNE_COUNT) return { hunt, repeat: false };
  if (hunt.guesses.some((g) => g.room === room)) return { hunt, repeat: true };
  const d = distance(room, hunt.creature);
  const guesses = [...hunt.guesses, { room, heat: heatFor(d), distance: d }];
  const status = d === 0 ? "won" : guesses.length >= MAX_GUESSES ? "lost" : "hunting";
  return { hunt: { ...hunt, guesses, status }, repeat: false };
}

/** Stars for a win: 5 for a first-try find down to 1 for the last guess. 0 if the hunt was lost. */
export function starsOf(hunt: Hunt): number {
  return hunt.status === "won" ? MAX_GUESSES - hunt.guesses.length + 1 : 0;
}

export const guessesLeft = (hunt: Hunt) => Math.max(0, MAX_GUESSES - hunt.guesses.length);

/** Room `i`'s slot index, from a decoder bubble. */
export function roomOfBubble(b: { group: string; col: string }): number {
  for (let i = 0; i < RITE_RUNE_COUNT; i++) {
    const s = riteSlot(i);
    if (s.group === b.group && s.col === b.col) return i;
  }
  return -1;
}

/** "Room 6: Moon Attic (Moon)". */
export function describeRoom(b: { group: string; col: string }): string {
  const i = roomOfBubble(b);
  return i < 0 ? "Unknown room" : `Room ${i + 1}: ${ROOMS[i]} (${RITE_RUNE_NAMES[i]})`;
}

export type MapReading =
  | { kind: "room"; room: number }
  | { kind: "none" }
  | { kind: "many"; rooms: number[] }
  | { kind: "unclear"; rooms: number[] };

/**
 * What the pen on the map says. Exactly one clearly filled room is a guess. A faint mark (the
 * decoder's `ambiguous`) is never counted: it waits for a person to say filled or blank.
 */
export function readMap(result: SuccessfulScan): MapReading {
  const filled: number[] = [];
  const unclear: number[] = [];
  for (const b of result.bubbles) {
    const i = roomOfBubble(b);
    if (i < 0) continue;
    if (b.state === "filled") filled.push(i);
    else if (b.state === "ambiguous") unclear.push(i);
  }
  if (unclear.length > 0) return { kind: "unclear", rooms: unclear.sort((a, b) => a - b) };
  if (filled.length === 0) return { kind: "none" };
  if (filled.length > 1) return { kind: "many", rooms: filled.sort((a, b) => a - b) };
  return { kind: "room", room: filled[0] };
}

/** The decoder's bubble key for a room (for sample marks and tests). */
export const roomKey = runeKey;

/** A copyable result line. */
export function huntReceipt(hunt: Hunt): string {
  const trail = hunt.guesses.map((g) => `${ROOMS[g.room]} (${HEAT_SHORT[g.heat]})`).join(" > ");
  if (hunt.status === "won") return `Haunted Treasure Hunt: found the creature in ${ROOMS[hunt.creature]} with ${hunt.guesses.length} of ${MAX_GUESSES} guesses (${starsOf(hunt)} stars). ${trail}`;
  if (hunt.status === "lost") return `Haunted Treasure Hunt: the creature was hiding in ${ROOMS[hunt.creature]}. ${trail}`;
  return `Haunted Treasure Hunt: ${hunt.guesses.length} of ${MAX_GUESSES} guesses so far. ${trail}`;
}
