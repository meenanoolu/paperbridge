import { describe, expect, it } from "vitest";
import { RITE_RUNE_NAMES } from "../layout";
import { COACH_LINES, coachFor, HOWTO_STEPS, NO_SHEET_MS, REACTION_MS, receiptTip, sheetMissing, type CoachInput } from "../riteCoach";
import { createGame, PAD_KEYS, startGame, type RiteState } from "../riteEngine";
import { TREMBLE_LINES } from "../riteVoice";

const EM_DASH = /[\u2013\u2014]/;

const menu = createGame(7);
const intro = startGame(menu, 7);
const active: RiteState = { ...intro, phase: "active", introLeftMs: 0 };
const input = (over: Partial<CoachInput> & { game: RiteState }): CoachInput => ({ mode: "digital", paused: false, noSheet: false, reaction: null, now: 10_000, ...over });

describe("the 3 steps", () => {
  it("are exactly 3, in order, each short enough to read at a glance and free of em dashes", () => {
    expect(HOWTO_STEPS.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(HOWTO_STEPS.map((s) => s.title)).toEqual(["Watch the gold glow", "Cover or hold the rune", "Half-cover = Trembling Hand"]);
    for (const s of HOWTO_STEPS) {
      expect(s.title.split(" ").length).toBeLessThanOrEqual(5);
      expect(`${s.title} ${s.short} ${s.detail}`).not.toMatch(EM_DASH);
    }
  });
});

describe("the ghost coach says the exact next thing to do", () => {
  it("menu: tells the digital player to press Start, and the live player to open the camera or pick the launchpad", () => {
    expect(coachFor(input({ game: menu }))).toMatchObject({ mood: "hello", text: COACH_LINES.menuDigital });
    expect(COACH_LINES.menuDigital).toContain("Start the Rite");
    expect(coachFor(input({ game: menu, mode: "live" })).text).toBe(COACH_LINES.menuLive);
    expect(COACH_LINES.menuLive).toMatch(/Open Camera and Start the Rite/);
    expect(COACH_LINES.menuLive).toMatch(/launchpad/);
  });

  it("wave intro: names the glowing runes", () => {
    const c = coachFor(input({ game: intro }));
    expect(c.mood).toBe("hello");
    expect(c.text).toContain(`Wave ${intro.wave}`);
    for (const t of intro.targets) expect(c.text).toContain(RITE_RUNE_NAMES[t.rune]);
  });

  it("active, digital: says to press AND HOLD, with the key of every lit rune", () => {
    const c = coachFor(input({ game: active }));
    expect(c.text).toMatch(/hold/i);
    expect(c.text).toMatch(/do not tap/i);
    for (const t of active.targets) expect(c.text).toContain(`key ${PAD_KEYS[t.rune]}`);
  });

  it("active, live: says to cover the glowing rune with a finger or token", () => {
    const c = coachFor(input({ game: active, mode: "live" }));
    expect(c.text).toMatch(/Cover the glowing/);
    expect(c.text).toMatch(/finger or token/);
  });

  it("trembling: worried, names the rune and says to press down firmly", () => {
    const game: RiteState = { ...active, targets: active.targets.map((t, i) => (i === 0 ? { ...t, trembling: true } : t)), trembling: true };
    const c = coachFor(input({ game }));
    expect(c.mood).toBe("worry");
    expect(c.text).toContain(RITE_RUNE_NAMES[game.targets[0].rune]);
    expect(c.text).toMatch(/firmly/);
  });

  it("a fresh banish cheers with the rune name; a stale one does not", () => {
    const rune = 3;
    const fresh = coachFor(input({ game: active, reaction: { kind: "banish", runes: [rune], at: 9_000 } }));
    expect(fresh.mood).toBe("cheer");
    expect(fresh.text).toContain(RITE_RUNE_NAMES[rune]);
    expect(fresh.text).toMatch(/wails and vanishes/);
    const two = coachFor(input({ game: active, reaction: { kind: "banish", runes: [1, 2], at: 9_000 } }));
    expect(two.text).toMatch(/wail and vanish\./);
    const stale = coachFor(input({ game: active, reaction: { kind: "banish", runes: [rune], at: 10_000 - REACTION_MS - 1 } }));
    expect(stale.mood).toBe("hello");
  });

  it("a lost life scolds and says what to do next", () => {
    const c = coachFor(input({ game: active, reaction: { kind: "lifeLost", at: 9_500 } }));
    expect(c).toEqual({ mood: "scold", text: COACH_LINES.lifeLost });
    expect(c.text).toMatch(/hold the rune/);
  });

  it("tremble outranks a banish reaction, and what you must do outranks everything while playing", () => {
    const shaking: RiteState = { ...active, targets: active.targets.map((t) => ({ ...t, trembling: true })), trembling: true };
    expect(coachFor(input({ game: shaking, reaction: { kind: "banish", runes: [1], at: 9_900 } })).mood).toBe("worry");
  });

  it("game over gloats and points at Play Again; pause is sleepy and points at Resume", () => {
    const over: RiteState = { ...active, phase: "gameOver" };
    expect(coachFor(input({ game: over }))).toEqual({ mood: "gloat", text: COACH_LINES.gameOver });
    expect(COACH_LINES.gameOver).toContain("Play Again");
    expect(coachFor(input({ game: active, paused: true }))).toEqual({ mood: "sleepy", text: COACH_LINES.paused });
    expect(COACH_LINES.paused).toContain("Resume");
  });

  it("live with no sheet in view: scolds and offers Switch to Launchpad; digital mode never does", () => {
    const c = coachFor(input({ game: active, mode: "live", noSheet: true }));
    expect(c.mood).toBe("scold");
    expect(c.text).toContain("Switch to Launchpad");
    expect(c.text).toContain("4 black corners");
    expect(coachFor(input({ game: active, mode: "digital", noSheet: true })).text).not.toContain("Switch to Launchpad");
  });

  it("every line is plain: no em dashes, under 140 characters", () => {
    const lines = [...Object.values(COACH_LINES), ...TREMBLE_LINES.map((l) => l)];
    for (const l of lines) {
      expect(String(l)).not.toMatch(EM_DASH);
    }
    for (const l of Object.values(COACH_LINES)) expect(l.length).toBeLessThan(140);
    for (const g of [menu, intro, active])
      for (const mode of ["digital", "live"] as const) {
        const t = coachFor(input({ game: g, mode })).text;
        expect(t).not.toMatch(EM_DASH);
        expect(t.length).toBeLessThan(140);
      }
  });
});

describe("the camera sheet timer", () => {
  it("is missing only once the sheet has been unseen for NO_SHEET_MS", () => {
    expect(NO_SHEET_MS).toBe(2000);
    expect(sheetMissing(1_999, 0)).toBe(false);
    expect(sheetMissing(2_000, 0)).toBe(true);
    expect(sheetMissing(5_500, 4_000)).toBe(false);
    expect(sheetMissing(5_500, 4_000, 1_000)).toBe(true);
  });
});

describe("the receipt tip", () => {
  it("tells a player who banished nothing how to hold, by mode", () => {
    expect(receiptTip({ banished: 0, mode: "digital", maxCombo: 0 })).toMatch(/press and hold.*quick tap/);
    expect(receiptTip({ banished: 0, mode: "live", maxCombo: 0 })).toMatch(/cover the whole circle/);
  });
  it("tells a player with no combo to press firmly, and stays quiet for a player who has it", () => {
    expect(receiptTip({ banished: 4, mode: "digital", maxCombo: 1 })).toMatch(/press firmly/i);
    expect(receiptTip({ banished: 9, mode: "digital", maxCombo: 5 })).toBeNull();
  });
  it("has no em dashes", () => {
    for (const r of [{ banished: 0, mode: "digital" as const, maxCombo: 0 }, { banished: 0, mode: "live" as const, maxCombo: 0 }, { banished: 2, mode: "digital" as const, maxCombo: 1 }])
      expect(receiptTip(r)).not.toMatch(EM_DASH);
  });
});
