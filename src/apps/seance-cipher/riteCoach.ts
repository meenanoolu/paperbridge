import { RITE_RUNE_NAMES } from "./layout";
import { PAD_KEYS, type PlayMode, type RiteState, type ScoreReceipt } from "./riteEngine";
import { trembleLine } from "./riteVoice";

/**
 * What a stranger needs in their first minute: three steps they can read in 15 seconds, and a
 * little ghost that always says the exact next thing to do, with a joke. Pure, so every line is
 * unit tested and none of it touches the game rules in `riteEngine.ts`.
 */
export const HOWTO_STEPS = [
  { n: 1, title: "Watch the gold glow", short: "Watch the gold glow", detail: "1 to 4 runes light up each wave." },
  { n: 2, title: "Cover or hold the rune", short: "Cover or hold the rune", detail: "Use your printed sheet, or hold the pad or its key, before the ring drains." },
  { n: 3, title: "Half-cover = Trembling Hand", short: "Half-cover = Trembling Hand", detail: "Press firmly to break the curse and keep your combo." },
] as const;

export type CoachMood = "hello" | "cheer" | "worry" | "scold" | "gloat" | "sleepy";

export interface Coach {
  mood: CoachMood;
  text: string;
}

/** A moment the ghost reacts to for a few seconds: a banish or a lost life. */
export interface Reaction {
  kind: "banish" | "lifeLost";
  /** The runes banished (for "banish"). */
  runes?: number[];
  at: number;
}

export const REACTION_MS = 3000;
/** How long the camera may see no sheet before the ghost offers the launchpad. */
export const NO_SHEET_MS = 2000;

/** True once no sheet has been seen for `NO_SHEET_MS`. `lastSeen` starts when the camera opens. */
export const sheetMissing = (now: number, lastSeen: number, limit = NO_SHEET_MS): boolean => now - lastSeen >= limit;

const names = (runes: readonly number[]) => runes.map((r) => RITE_RUNE_NAMES[r]).join(" and ");

/** "the Skull (key 1)" or, with several, "the Skull (key 1) and the Bat (key 2)". */
const withKeys = (runes: readonly number[]) => runes.map((r) => `the ${RITE_RUNE_NAMES[r]} (key ${PAD_KEYS[r]})`).join(" and ");

export interface CoachInput {
  game: RiteState;
  mode: PlayMode;
  paused: boolean;
  /** Live mode: the camera has not seen the sheet for a while. */
  noSheet: boolean;
  reaction: Reaction | null;
  now: number;
}

export const COACH_LINES = {
  menuDigital: "Boo! Tap Start the Rite, then press and hold any glowing rune to banish your first ghost.",
  menuLive: "Boo! Hold your printed sheet ready, then tap Open Camera and Start the Rite. No paper? Pick the launchpad mode.",
  paused: "Paused. Even ghosts need a breather. Tap Resume when you are ready.",
  gameOver: "The spirits won this round. Tap Play Again for instant revenge.",
  noSheet: "The spirits can't spot your paper! Line up the 4 black corners, or tap Switch to Launchpad to play right now.",
  lifeLost: "Too slow, mortal! Watch the next gold glow and hold the rune before the ring runs out.",
} as const;

/** The one line the ghost says now, with its mood. The priority is: what you must do, then what just happened. */
export function coachFor({ game, mode, paused, noSheet, reaction, now }: CoachInput): Coach {
  if (game.phase === "menu") return { mood: "hello", text: mode === "live" ? COACH_LINES.menuLive : COACH_LINES.menuDigital };
  if (game.phase === "gameOver") return { mood: "gloat", text: COACH_LINES.gameOver };
  if (paused) return { mood: "sleepy", text: COACH_LINES.paused };
  if (mode === "live" && noSheet) return { mood: "scold", text: COACH_LINES.noSheet };

  const lit = game.targets.map((t) => t.rune);
  const shaking = game.targets.find((t) => t.trembling);
  if (game.phase === "active" && shaking) return { mood: "worry", text: trembleLine(shaking.rune, game.wave) };

  const fresh = reaction && now - reaction.at < REACTION_MS ? reaction : null;
  if (fresh?.kind === "lifeLost") return { mood: "scold", text: COACH_LINES.lifeLost };
  if (fresh?.kind === "banish" && fresh.runes?.length) return { mood: "cheer", text: `Gotcha! The ${names(fresh.runes)} ${fresh.runes.length > 1 ? "wail" : "wails"} and vanish${fresh.runes.length > 1 ? "" : "es"}. Keep it going!` };

  if (game.phase === "waveIntro") return { mood: "hello", text: `Wave ${game.wave}! Watch the gold glow on ${names(lit)}.` };
  return {
    mood: "hello",
    text: mode === "digital" ? `Press and hold ${withKeys(lit)} until it vanishes. Hold, do not tap!` : `Cover the glowing ${names(lit)} with a finger or token and keep it there.`,
  };
}

/** One tip under the receipt, from how the game went. Null when the player clearly has it figured out. */
export function receiptTip(r: Pick<ScoreReceipt, "banished" | "mode" | "maxCombo">): string | null {
  if (r.banished === 0) return r.mode === "digital" ? "Tip: press and hold the glowing rune for a quarter of a second. A quick tap only makes it tremble." : "Tip: cover the whole circle on the sheet with a finger or token, and keep the 4 black corners in view.";
  if (r.maxCombo < 2) return "Tip: a trembling rune cannot grow your combo. Press firmly the first time.";
  return null;
}
