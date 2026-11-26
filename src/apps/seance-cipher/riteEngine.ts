import { RITE_RUNE_COUNT, RITE_RUNE_NAMES } from "./layout";

/**
 * X-Ray Rite: the endless wave game. Pure and deterministic: every function takes a state and
 * returns the next one, so the whole game is unit tested with no camera, clock or DOM. The page
 * feeds it one number per rune ("cover", 0 to 1): the ink density the optical decoder measured
 * inside that rune's bubble when a finger or token covers it, or the digital launchpad's value.
 */

// --- Rules ------------------------------------------------------------------

/** Cover at or above this fully banishes a rune (a whole finger over the bubble reads about this). */
export const PERFECT = 0.48;
/** Cover from the lower bound up to just under PERFECT is the Trembling Hand: a partial, shaky cover. */
export const INTERFERENCE_RANGE = [0.22, 0.47] as const;
/** While any target trembles the wave timer drains at 60% speed: 40% slower. */
export const TREMBLE_DRAIN = 0.6;
export const MAX_LIVES = 3;
export const MAX_TARGETS = 4;
/** Points for one banish at multiplier 1. */
export const BASE_POINTS = 100;
export const MULTIPLIER_STEP = 0.15;
/** The "Wave N" announcement before the timer starts. */
export const INTRO_MS = 1500;
/** Clearing a wave pays one point per this many milliseconds left on the timer. */
export const CLEAR_BONUS_MS_PER_POINT = 10;

/** Time allowed for a wave: shrinks 180 ms per wave and never goes under 1800 ms. */
export const waveTimeMs = (wave: number) => Math.max(1800, 4200 - wave * 180);
/** Runes to banish at once: 1 for waves 1 to 3, then one more every 3 waves, up to 4. */
export const targetCount = (wave: number) => Math.min(MAX_TARGETS, 1 + Math.floor((Math.max(1, wave) - 1) / 3));
/** Score multiplier for a combo. */
export const multiplierFor = (combo: number) => 1 + combo * MULTIPLIER_STEP;

export type Cover = "covered" | "trembling" | "empty";

/** What a cover reading means to the game. */
export function classifyCoverage(c: number): Cover {
  if (c >= PERFECT) return "covered";
  if (c >= INTERFERENCE_RANGE[0]) return "trembling";
  return "empty";
}

// --- State ------------------------------------------------------------------

export type Phase = "menu" | "waveIntro" | "active" | "gameOver";
export type PlayMode = "live" | "digital";

export interface Target {
  rune: number;
  /** Trembled at some point this wave. A cursed rune is banished for points but never grows the combo. */
  cursed: boolean;
  /** Trembling right now. */
  trembling: boolean;
}

export type RiteEvent =
  | { type: "wave"; wave: number; runes: number[] }
  | { type: "go"; wave: number }
  | { type: "tremble"; rune: number }
  | { type: "banish"; rune: number; points: number; combo: number; grew: boolean }
  | { type: "clear"; wave: number; bonus: number }
  | { type: "lifeLost"; lives: number }
  | { type: "gameOver"; wave: number };

export interface RiteState {
  phase: Phase;
  wave: number;
  lives: number;
  score: number;
  combo: number;
  maxCombo: number;
  /** `1 + combo * 0.15`. */
  multiplier: number;
  /** Runes still to banish this wave. */
  targets: Target[];
  /** Runes banished over the whole game. */
  banished: number;
  waveMs: number;
  timeLeftMs: number;
  introLeftMs: number;
  /** True while any target is trembling (timer drains 40% slower, combo growth locked for that rune). */
  trembling: boolean;
  /** False when the camera could not see the sheet on the last tick: the timer waits. */
  cardVisible: boolean;
  /** The last 12 cover readings, frozen when the game ends. */
  coverage: number[];
  /** What happened on the last tick, for sound and announcements. */
  events: RiteEvent[];
  /** Seeded random state. */
  rng: number;
}

const zeros = () => Array.from({ length: RITE_RUNE_COUNT }, () => 0);

/** The menu state. `seed` fixes which runes light up, so a game replays exactly. */
export function createGame(seed = 1): RiteState {
  return {
    phase: "menu",
    wave: 0,
    lives: MAX_LIVES,
    score: 0,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    targets: [],
    banished: 0,
    waveMs: waveTimeMs(1),
    timeLeftMs: waveTimeMs(1),
    introLeftMs: 0,
    trembling: false,
    cardVisible: true,
    coverage: zeros(),
    events: [],
    rng: seed >>> 0,
  };
}

/** One step of a small seeded generator (mulberry32): returns [0..1, next state]. */
export function nextRandom(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** Choose `count` distinct runes, avoiding the previous wave's when there is room. */
export function pickRunes(rng: number, count: number, avoid: readonly number[] = []): { runes: number[]; rng: number } {
  let pool = Array.from({ length: RITE_RUNE_COUNT }, (_, i) => i).filter((i) => !avoid.includes(i));
  if (pool.length < count) pool = Array.from({ length: RITE_RUNE_COUNT }, (_, i) => i);
  const runes: number[] = [];
  let state = rng;
  while (runes.length < count) {
    const [r, next] = nextRandom(state);
    state = next;
    runes.push(pool.splice(Math.floor(r * pool.length), 1)[0]);
  }
  return { runes: runes.sort((a, b) => a - b), rng: state };
}

function beginWave(s: RiteState, wave: number, extra: RiteEvent[] = []): RiteState {
  const { runes, rng } = pickRunes(s.rng, targetCount(wave), s.targets.map((t) => t.rune));
  const waveMs = waveTimeMs(wave);
  return {
    ...s,
    phase: "waveIntro",
    wave,
    targets: runes.map((rune) => ({ rune, cursed: false, trembling: false })),
    waveMs,
    timeLeftMs: waveMs,
    introLeftMs: INTRO_MS,
    trembling: false,
    rng,
    events: [...extra, { type: "wave", wave, runes }],
  };
}

/** Start (or restart) a game at wave 1 with 3 lives. Works from the menu and from Game Over. */
export function startGame(s: RiteState, seed = s.rng): RiteState {
  return beginWave({ ...createGame(seed), targets: [] }, 1);
}

// --- Ticking ----------------------------------------------------------------

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * Advance the game by `dtMs`. `coverage` is the 12 cover readings, or null when the camera
 * cannot see the sheet (the timer then waits, so a hidden card never costs a life).
 *
 * Per target: cover >= PERFECT banishes it. 0.22 up to just under 0.48 is the Trembling Hand:
 * the wave timer drains 40% slower while it lasts, and that rune is cursed for the wave, so its
 * banish pays points but does not grow the combo. A clean banish does not grow the combo while
 * any other target is still cursed. The combo itself is never lost to a tremble.
 */
export function tick(s: RiteState, dtMs: number, coverage: readonly number[] | null): RiteState {
  const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
  if (s.phase === "menu" || s.phase === "gameOver") return { ...s, events: [] };

  if (s.phase === "waveIntro") {
    const left = s.introLeftMs - dt;
    return left > 0
      ? { ...s, introLeftMs: left, events: [] }
      : { ...s, phase: "active", introLeftMs: 0, timeLeftMs: s.waveMs, events: [{ type: "go", wave: s.wave }] };
  }

  if (!coverage) return { ...s, cardVisible: false, events: [] };
  const cover = Array.from({ length: RITE_RUNE_COUNT }, (_, i) => clamp01(coverage[i] ?? 0));
  const events: RiteEvent[] = [];

  const hit: Target[] = [];
  const remaining: Target[] = [];
  for (const t of s.targets) {
    const c = cover[t.rune];
    if (c >= PERFECT) {
      hit.push(t);
      continue;
    }
    const trembling = c >= INTERFERENCE_RANGE[0];
    if (trembling && !t.trembling) events.push({ type: "tremble", rune: t.rune });
    remaining.push({ ...t, trembling, cursed: t.cursed || trembling });
  }

  let { score, combo, maxCombo } = s;
  const lockedByOthers = remaining.some((t) => t.cursed);
  for (const t of [...hit].sort((a, b) => a.rune - b.rune)) {
    const points = Math.round(BASE_POINTS * multiplierFor(combo));
    const grew = !t.cursed && !lockedByOthers;
    score += points;
    if (grew) combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    events.push({ type: "banish", rune: t.rune, points, combo, grew });
  }
  const banished = s.banished + hit.length;
  const base = { ...s, score, combo, maxCombo, multiplier: multiplierFor(combo), banished, coverage: cover, cardVisible: true };

  // Wave cleared: pay the time bonus and start the next, faster wave.
  if (remaining.length === 0) {
    const bonus = Math.round(s.timeLeftMs / CLEAR_BONUS_MS_PER_POINT);
    return beginWave({ ...base, score: score + bonus, targets: hit }, s.wave + 1, [...events, { type: "clear", wave: s.wave, bonus }]);
  }

  const trembling = remaining.some((t) => t.trembling);
  const timeLeftMs = s.timeLeftMs - dt * (trembling ? TREMBLE_DRAIN : 1);
  if (timeLeftMs > 0) return { ...base, targets: remaining, trembling, timeLeftMs, events };

  // Time ran out with runes still standing: a life is lost and the combo breaks.
  const lives = s.lives - 1;
  const lost: RiteEvent = { type: "lifeLost", lives };
  const broken = { ...base, targets: remaining, trembling: false, timeLeftMs: 0, lives, combo: 0, multiplier: 1 };
  if (lives <= 0) return { ...broken, phase: "gameOver", events: [...events, lost, { type: "gameOver", wave: s.wave }] };
  return beginWave(broken, s.wave + 1, [...events, lost]);
}

// --- Digital launchpad ------------------------------------------------------

/** A quick tap reads as a trembling hand. */
export const TAP_COVERAGE = 0.35;
/** A hold reads as a full cover. */
export const HOLD_COVERAGE = 1;
/** Holding this long turns a press into a hold. */
export const HOLD_MS = 250;
/** How long a tap's trembling reading lasts after release. */
export const TAP_PULSE_MS = 220;

export interface PadState {
  /** Rune index to the time it was pressed. */
  down: Readonly<Record<number, number>>;
  /** Rune index to the time a quick tap was released. */
  taps: Readonly<Record<number, number>>;
}

export const emptyPad: PadState = { down: {}, taps: {} };

export function padPress(p: PadState, rune: number, now: number): PadState {
  // Key repeat and a second finger on a held pad change nothing.
  return rune in p.down ? p : { ...p, down: { ...p.down, [rune]: now } };
}

export function padRelease(p: PadState, rune: number, now: number): PadState {
  const at = p.down[rune];
  if (at === undefined) return p;
  const down = { ...p.down };
  delete down[rune];
  return { down, taps: now - at < HOLD_MS ? { ...p.taps, [rune]: now } : p.taps };
}

/** The 12 cover readings the pad produces now: held >= HOLD_MS is 1.0, a quick tap is 0.35 for a moment, else 0. */
export function padCoverage(p: PadState, now: number): number[] {
  return Array.from({ length: RITE_RUNE_COUNT }, (_, i) => {
    const pressed = p.down[i];
    if (pressed !== undefined) return now - pressed >= HOLD_MS ? HOLD_COVERAGE : 0;
    const tapped = p.taps[i];
    return tapped !== undefined && now - tapped < TAP_PULSE_MS ? TAP_COVERAGE : 0;
  });
}

/** Keyboard keys for runes 1 to 12: 1-9, 0, minus, equals. */
export const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="] as const;
export const runeForKey = (key: string): number | null => {
  const i = PAD_KEYS.indexOf(key as (typeof PAD_KEYS)[number]);
  return i < 0 ? null : i;
};

// --- Live camera smoothing --------------------------------------------------

/**
 * Camera noise guard: a rune counts only as much as it read in both of the last two frames
 * (the lower reading wins), so one bad frame cannot banish a rune or start a tremble. The first
 * frame after the sheet comes into view has no earlier frame to agree with, so it reads as empty.
 */
export function confirmCoverage(prev: readonly number[] | null, cur: readonly number[] | null): number[] | null {
  if (!cur) return null;
  return prev ? cur.map((c, i) => Math.min(c, prev[i] ?? 0)) : cur.map(() => 0);
}

// --- Receipt ----------------------------------------------------------------

export interface ScoreReceipt {
  wave: number;
  score: number;
  maxCombo: number;
  /** The multiplier at the best combo. */
  bestMultiplier: number;
  banished: number;
  mode: PlayMode;
  /** The 12 cover readings frozen when the rite ended. */
  coverage: number[];
  /** The runes that were still lit when time ran out. */
  missed: number[];
}

export const MODE_LABEL: Record<PlayMode, string> = { live: "Live optical webcam", digital: "Instant digital launchpad" };

/** The receipt for a finished game. Returns null until the game is over. */
export function receiptOf(s: RiteState, mode: PlayMode): ScoreReceipt | null {
  if (s.phase !== "gameOver") return null;
  return { wave: s.wave, score: s.score, maxCombo: s.maxCombo, bestMultiplier: multiplierFor(s.maxCombo), banished: s.banished, mode, coverage: [...s.coverage], missed: s.targets.map((t) => t.rune) };
}

const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const times = (m: number) => `x${(Math.round(m * 100) / 100).toFixed(2).replace(/0$/, "")}`;
export const formatScore = group;
export const formatMultiplier = times;

/** Plain text to paste anywhere. */
export function receiptText(r: ScoreReceipt): string {
  return [
    "X-Ray Rite: The Endless Obsidian Seance",
    `Final wave: ${r.wave}`,
    `Score: ${group(r.score)}`,
    `Max combo: ${r.maxCombo} (${times(r.bestMultiplier)})`,
    `Runes banished: ${r.banished}`,
    `Mode: ${MODE_LABEL[r.mode]}`,
    "Read offline by PaperBridge. No AI guessing.",
  ].join("\n");
}

// --- Announcements ----------------------------------------------------------

const names = (runes: readonly number[]) => runes.map((i) => RITE_RUNE_NAMES[i]).join(", ");

/** One sentence per tick for the screen-reader status line, or null when nothing worth saying happened. */
export function announceEvents(events: readonly RiteEvent[]): string | null {
  const out: string[] = [];
  for (const e of events) {
    if (e.type === "wave") out.push(`Wave ${e.wave}. Banish ${names(e.runes)}.`);
    else if (e.type === "go") out.push("Go.");
    else if (e.type === "tremble") out.push(`Trembling hand on ${RITE_RUNE_NAMES[e.rune]}. Cover it fully.`);
    else if (e.type === "banish") out.push(`${RITE_RUNE_NAMES[e.rune]} banished, ${e.points} points.${e.grew ? ` Combo ${e.combo}.` : " Combo locked."}`);
    else if (e.type === "clear") out.push(`Wave ${e.wave} cleared, ${e.bonus} bonus.`);
    else if (e.type === "lifeLost") out.push(`A life is lost. ${e.lives} left.`);
    else if (e.type === "gameOver") out.push(`The rite ends on wave ${e.wave}.`);
  }
  return out.length ? out.join(" ") : null;
}
