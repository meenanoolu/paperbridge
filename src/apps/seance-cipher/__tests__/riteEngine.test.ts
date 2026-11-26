import { describe, expect, it } from "vitest";
import {
  announceEvents,
  BASE_POINTS,
  classifyCoverage,
  confirmCoverage,
  createGame,
  emptyPad,
  formatMultiplier,
  formatScore,
  HOLD_COVERAGE,
  HOLD_MS,
  INTERFERENCE_RANGE,
  INTRO_MS,
  MAX_LIVES,
  multiplierFor,
  padCoverage,
  padPress,
  padRelease,
  PAD_KEYS,
  PERFECT,
  receiptOf,
  receiptText,
  runeForKey,
  startGame,
  TAP_COVERAGE,
  TAP_PULSE_MS,
  targetCount,
  tick,
  TREMBLE_DRAIN,
  waveTimeMs,
  type RiteState,
} from "../riteEngine";

/** 12 cover readings, all 0 except the ones given. */
const cov = (entries: Record<number, number> = {}) => Array.from({ length: 12 }, (_, i) => entries[i] ?? 0);
/** Cover every current target fully. */
const coverAll = (s: RiteState, c = 1) => cov(Object.fromEntries(s.targets.map((t) => [t.rune, c])));
/** From the wave announcement to the running timer. */
const go = (s: RiteState) => tick(s, INTRO_MS, null);
const fresh = (seed = 7) => go(startGame(createGame(seed)));
/** Clear waves with a full cover until `wave` is reached (waveIntro of that wave), then start its timer. */
const toWave = (wave: number, seed = 7) => {
  let s = fresh(seed);
  while (s.wave < wave) s = go(tick(s, 16, coverAll(s)));
  return s;
};

describe("rules and constants", () => {
  it("uses the calibrated thresholds, 3 lives and the multiplier formula", () => {
    expect(PERFECT).toBe(0.48);
    expect([...INTERFERENCE_RANGE]).toEqual([0.22, 0.47]);
    expect(MAX_LIVES).toBe(3);
    expect(TREMBLE_DRAIN).toBeCloseTo(0.6, 10);
    expect(multiplierFor(0)).toBe(1);
    expect(multiplierFor(4)).toBeCloseTo(1.6, 10);
    expect(multiplierFor(10)).toBeCloseTo(2.5, 10);
  });

  it("shrinks the wave timer by 180 ms a wave and never goes under 1800 ms", () => {
    expect([1, 2, 5, 13].map(waveTimeMs)).toEqual([4020, 3840, 3300, 1860]);
    expect(waveTimeMs(14)).toBe(1800);
    expect(waveTimeMs(15)).toBe(1800);
    expect(waveTimeMs(500)).toBe(1800);
    for (let w = 1; w < 40; w++) expect(waveTimeMs(w + 1)).toBeLessThanOrEqual(waveTimeMs(w));
  });

  it("lights 1 rune for waves 1 to 3, then one more every 3 waves, up to 4", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 100].map(targetCount)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4]);
  });

  it("reads a cover as covered, trembling or empty", () => {
    expect(classifyCoverage(0.48)).toBe("covered");
    expect(classifyCoverage(0.479)).toBe("trembling");
    expect(classifyCoverage(0.47)).toBe("trembling");
    expect(classifyCoverage(0.22)).toBe("trembling");
    expect(classifyCoverage(0.2199)).toBe("empty");
    expect(classifyCoverage(0)).toBe("empty");
  });
});

describe("state machine: menu, waveIntro, active, gameOver", () => {
  it("starts in the menu, then announces wave 1 with 3 lives, then runs", () => {
    const menu = createGame(3);
    expect([menu.phase, menu.lives, menu.score, menu.wave]).toEqual(["menu", 3, 0, 0]);
    expect(tick(menu, 1000, cov({ 0: 1 })).phase).toBe("menu");

    const intro = startGame(menu);
    expect([intro.phase, intro.wave, intro.lives, intro.targets.length, intro.timeLeftMs]).toEqual(["waveIntro", 1, 3, 1, 4020]);
    expect(intro.events).toEqual([{ type: "wave", wave: 1, runes: intro.targets.map((t) => t.rune) }]);

    // Covering during the announcement does nothing: the timer has not started.
    const mid = tick(intro, INTRO_MS - 100, coverAll(intro));
    expect(mid.phase).toBe("waveIntro");
    expect(mid.score).toBe(0);
    const active = tick(mid, 100, null);
    expect(active.phase).toBe("active");
    expect(active.events).toEqual([{ type: "go", wave: 1 }]);
    expect(active.timeLeftMs).toBe(4020);
  });

  it("is pure: ticking never changes the previous state", () => {
    const s = fresh();
    const before = JSON.stringify(s);
    tick(s, 500, coverAll(s));
    tick(s, 500, null);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("picks the same runes for the same seed and different runes for another", () => {
    const run = (seed: number) => {
      let s = fresh(seed);
      const seen: number[][] = [];
      for (let i = 0; i < 6; i++) {
        seen.push(s.targets.map((t) => t.rune));
        s = go(tick(s, 16, coverAll(s)));
      }
      return seen;
    };
    expect(run(11)).toEqual(run(11));
    expect(run(11)).not.toEqual(run(12));
  });
});

describe("waves escalate", () => {
  it("clearing a wave starts the next, faster, with more runes, never repeating the last wave's runes", () => {
    let s = fresh();
    for (let wave = 1; wave <= 12; wave++) {
      expect(s.wave).toBe(wave);
      expect(s.targets).toHaveLength(targetCount(wave));
      expect(new Set(s.targets.map((t) => t.rune)).size).toBe(s.targets.length);
      expect(s.waveMs).toBe(waveTimeMs(wave));
      expect(s.timeLeftMs).toBe(waveTimeMs(wave));
      const last = s.targets.map((t) => t.rune);
      const cleared = tick(s, 16, coverAll(s));
      expect(cleared.events.some((e) => e.type === "clear" && e.wave === wave)).toBe(true);
      expect(cleared.phase).toBe("waveIntro");
      expect(cleared.wave).toBe(wave + 1);
      expect(cleared.targets.map((t) => t.rune).some((r) => last.includes(r))).toBe(false);
      s = go(cleared);
    }
    expect(s.targets).toHaveLength(4);
  });

  it("pays a time bonus for clearing early", () => {
    const s = fresh();
    const quick = tick(s, 16, coverAll(s));
    const slow = tick(tick(s, 3000, cov()), 16, coverAll(s));
    const bonus = (r: RiteState) => (r.events.find((e) => e.type === "clear") as { bonus: number }).bonus;
    expect(bonus(quick)).toBe(Math.round(4020 / 10));
    expect(bonus(slow)).toBeLessThan(bonus(quick));
  });
});

describe("banishing at 0.48 and the combo", () => {
  it("banishes at exactly 0.48 and not at 0.479", () => {
    const s = fresh();
    const rune = s.targets[0].rune;
    const hit = tick(s, 16, cov({ [rune]: 0.48 }));
    expect(hit.events.find((e) => e.type === "banish")).toMatchObject({ rune, points: BASE_POINTS, combo: 1, grew: true });
    expect(hit.combo).toBe(1);
    expect(hit.banished).toBe(1);

    const near = tick(s, 16, cov({ [rune]: 0.479 }));
    expect(near.events.some((e) => e.type === "banish")).toBe(false);
    expect(near.targets).toHaveLength(1);
    expect(near.wave).toBe(1);
  });

  it("builds the combo and the multiplier, and pays 100 times the multiplier", () => {
    // Waves 1 to 3 have one rune each; wave 4 has two.
    let s = fresh();
    const points: number[] = [];
    for (let wave = 1; wave <= 4; wave++) {
      const next = tick(s, 16, coverAll(s));
      points.push(...next.events.filter((e) => e.type === "banish").map((e) => (e as { points: number }).points));
      s = go(next);
    }
    expect(points).toEqual([100, 115, 130, 145, 160]);
    expect(s.combo).toBe(5);
    expect(s.maxCombo).toBe(5);
    expect(s.multiplier).toBeCloseTo(1.75, 10);
  });

  it("scores several runes banished in one tick, in rune order", () => {
    const s = toWave(4);
    expect(s.targets).toHaveLength(2);
    const next = tick(s, 16, coverAll(s));
    const banished = next.events.filter((e) => e.type === "banish") as { rune: number; points: number; combo: number }[];
    expect(banished.map((b) => b.rune)).toEqual([...s.targets.map((t) => t.rune)].sort((a, b) => a - b));
    expect(banished.map((b) => b.points)).toEqual([Math.round(100 * multiplierFor(3)), Math.round(100 * multiplierFor(4))]);
    expect(next.combo).toBe(5);
  });

  it("clamps nonsense readings", () => {
    const s = fresh();
    const rune = s.targets[0].rune;
    expect(tick(s, 16, cov({ [rune]: 7 })).banished).toBe(1);
    expect(tick(s, 16, cov({ [rune]: Number.NaN })).banished).toBe(0);
    expect(tick(s, 16, cov({ [rune]: -3 })).banished).toBe(0);
  });
});

describe("Trembling Hand (0.22 to 0.47)", () => {
  it("drains the wave timer 40% slower while a target trembles", () => {
    const s = fresh();
    const rune = s.targets[0].rune;
    const calm = tick(s, 1000, cov());
    const shaky = tick(s, 1000, cov({ [rune]: 0.3 }));
    expect(s.timeLeftMs - calm.timeLeftMs).toBe(1000);
    expect(s.timeLeftMs - shaky.timeLeftMs).toBeCloseTo(600, 6);
    expect(shaky.trembling).toBe(true);
    expect(calm.trembling).toBe(false);
  });

  it("covers the whole range: 0.22 and 0.47 tremble, 0.2199 and 0.48 do not", () => {
    const s = fresh();
    const rune = s.targets[0].rune;
    const state = (c: number) => tick(s, 1000, cov({ [rune]: c }));
    expect(state(0.22).trembling).toBe(true);
    expect(state(0.47).trembling).toBe(true);
    expect(state(0.2199).trembling).toBe(false);
    expect(state(0.48).trembling).toBe(false);
    expect(state(0.48).banished).toBe(1);
  });

  it("announces a tremble once, when it starts", () => {
    const s = fresh();
    const rune = s.targets[0].rune;
    const a = tick(s, 50, cov({ [rune]: 0.3 }));
    const b = tick(a, 50, cov({ [rune]: 0.35 }));
    expect(a.events).toEqual([{ type: "tremble", rune }]);
    expect(b.events).toEqual([]);
    // Backing off and trembling again is a new tremble.
    expect(tick(tick(b, 50, cov()), 50, cov({ [rune]: 0.3 })).events).toEqual([{ type: "tremble", rune }]);
  });

  it("locks combo growth until the rune is fully covered: the banish pays points but grows nothing", () => {
    let s = fresh();
    // Build a combo of 2 first.
    for (let i = 0; i < 2; i++) s = go(tick(s, 16, coverAll(s)));
    expect(s.combo).toBe(2);
    const rune = s.targets[0].rune;
    s = tick(s, 100, cov({ [rune]: 0.35 }));
    expect(s.targets[0].cursed).toBe(true);
    // Backing off does not clear the curse: it lasts until the rune is banished.
    s = tick(s, 100, cov());
    expect(s.targets[0].cursed).toBe(true);
    const done = tick(s, 16, cov({ [rune]: 0.9 }));
    const banish = done.events.find((e) => e.type === "banish") as { points: number; grew: boolean };
    expect(banish).toMatchObject({ points: Math.round(100 * multiplierFor(2)), grew: false });
    expect(done.combo).toBe(2);
    expect(done.maxCombo).toBe(2);
    // The next clean banishes grow it again (wave 4 lights two runes).
    const next = go(done);
    const after = tick(next, 16, coverAll(next));
    expect(after.events.filter((e) => e.type === "banish").map((e) => (e as { grew: boolean }).grew)).toEqual([true, true]);
    expect(after.combo).toBe(4);
  });

  it("keeps a clean banish from growing the combo while another target is still trembling", () => {
    const s = toWave(4);
    const [a, b] = s.targets.map((t) => t.rune);
    const shaky = tick(s, 100, cov({ [a]: 0.3 }));
    const next = tick(shaky, 16, cov({ [a]: 0.3, [b]: 1 }));
    expect(next.events.find((e) => e.type === "banish")).toMatchObject({ rune: b, grew: false });
    expect(next.combo).toBe(s.combo);
    expect(next.targets.map((t) => t.rune)).toEqual([a]);
    // Pushing the trembling rune over 0.48 finishes the wave; the lock only held for that rune.
    const cleared = tick(next, 16, cov({ [a]: 0.6 }));
    expect(cleared.events.find((e) => e.type === "banish")).toMatchObject({ rune: a, grew: false });
    expect(cleared.combo).toBe(s.combo);
    expect(cleared.wave).toBe(5);
  });

  it("never breaks the combo by itself", () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = go(tick(s, 16, coverAll(s)));
    const rune = s.targets[0].rune;
    s = tick(s, 500, cov({ [rune]: 0.4 }));
    expect(s.combo).toBe(3);
  });
});

describe("lives and Game Over", () => {
  it("loses a life, the combo and the wave when the timer runs out", () => {
    let s = fresh();
    for (let i = 0; i < 2; i++) s = go(tick(s, 16, coverAll(s)));
    expect(s.combo).toBe(2);
    const missed = s.targets.map((t) => t.rune);
    const timeout = tick(s, s.timeLeftMs + 1, cov());
    expect(timeout.events).toContainEqual({ type: "lifeLost", lives: 2 });
    expect([timeout.lives, timeout.combo, timeout.phase, timeout.wave]).toEqual([2, 0, "waveIntro", s.wave + 1]);
    expect(timeout.maxCombo).toBe(2);
    expect(timeout.targets.map((t) => t.rune).some((r) => missed.includes(r))).toBe(false);
  });

  it("ends on the third lost life with the frozen reading and a receipt", () => {
    let s = fresh();
    s = go(tick(s, 16, coverAll(s)));
    s = go(tick(s, 16, coverAll(s)));
    const score = s.score;
    expect(receiptOf(s, "digital")).toBeNull();
    // A reading on a rune that is not a target: the timer runs at full speed and the reading is frozen at the end.
    let quiet = 0;
    for (let i = 0; i < 3; i++) {
      expect(s.phase).not.toBe("gameOver");
      const lit = s.targets.map((t) => t.rune);
      quiet = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].find((r) => !lit.includes(r))!;
      s = tick(s, s.timeLeftMs + 1, cov({ [quiet]: 0.3 }));
      if (s.phase === "gameOver") {
        expect(s.events.map((e) => e.type)).toEqual(["lifeLost", "gameOver"]);
        expect(s.targets.map((t) => t.rune)).toEqual(lit);
      } else s = go(s);
    }
    expect(s.phase).toBe("gameOver");
    expect(s.lives).toBe(0);
    expect(s.coverage[quiet]).toBe(0.3);
    expect(tick(s, 1000, coverAll(s))).toMatchObject({ phase: "gameOver", score });

    const r = receiptOf(s, "live")!;
    expect(r).toMatchObject({ wave: s.wave, score, maxCombo: 2, banished: 2, mode: "live", missed: s.targets.map((t) => t.rune) });
    expect(r.bestMultiplier).toBeCloseTo(1.3, 10);
    expect(r.coverage).toHaveLength(12);
    expect(r.coverage).not.toBe(s.coverage);
  });

  it("Play Again starts a clean game from the Game Over screen", () => {
    let s = fresh();
    s = go(tick(s, 16, coverAll(s)));
    while (s.phase !== "gameOver") s = s.phase === "waveIntro" ? go(s) : tick(s, s.timeLeftMs + 1, cov());
    const again = startGame(s, 99);
    expect([again.phase, again.wave, again.lives, again.score, again.combo, again.maxCombo, again.banished]).toEqual(["waveIntro", 1, MAX_LIVES, 0, 0, 0, 0]);
  });

  it("waits while the camera cannot see the sheet: no life is lost", () => {
    const s = fresh();
    const hidden = tick(s, s.timeLeftMs + 5000, null);
    expect(hidden.cardVisible).toBe(false);
    expect(hidden.timeLeftMs).toBe(s.timeLeftMs);
    expect(hidden.lives).toBe(3);
    const back = tick(hidden, 100, cov());
    expect(back.cardVisible).toBe(true);
    expect(back.timeLeftMs).toBe(s.timeLeftMs - 100);
  });
});

describe("Score Receipt", () => {
  const over = (): RiteState => {
    let s = fresh();
    s = go(tick(s, 16, coverAll(s)));
    while (s.phase !== "gameOver") s = s.phase === "waveIntro" ? go(s) : tick(s, s.timeLeftMs + 1, cov());
    return s;
  };

  it("copies as plain text with the final wave, score and max combo, and no em dash", () => {
    const s = over();
    const text = receiptText(receiptOf(s, "digital")!);
    expect(text.split("\n")).toEqual([
      "X-Ray Rite: The Endless Obsidian Seance",
      `Final wave: ${s.wave}`,
      `Score: ${formatScore(s.score)}`,
      "Max combo: 1 (x1.15)",
      "Runes banished: 1",
      "Mode: Instant digital launchpad",
      "Read offline by PaperBridge. No AI guessing.",
    ]);
    expect(text).not.toMatch(/\u2014|\u2013/);
  });

  it("formats scores with thousands separators and multipliers with 2 decimals at most", () => {
    expect([0, 999, 1000, 1234567].map(formatScore)).toEqual(["0", "999", "1,000", "1,234,567"]);
    expect([1, 1.15, 1.6, 2.05].map(formatMultiplier)).toEqual(["x1.0", "x1.15", "x1.6", "x2.05"]);
  });
});

describe("announcements", () => {
  it("say what happened, in plain words and without em dashes", () => {
    const s = fresh();
    const rune = s.targets[0].rune;
    const intro = startGame(createGame(7));
    expect(announceEvents(intro.events)).toMatch(/^Wave 1\. Banish [A-Z][a-z]+\.$/);
    expect(announceEvents(tick(s, 50, cov({ [rune]: 0.3 })).events)).toMatch(/^Trembling hand on [A-Z][a-z]+\. Cover it fully\.$/);
    const banish = announceEvents(tick(s, 16, coverAll(s)).events)!;
    expect(banish).toMatch(/banished, 100 points\. Combo 1\./);
    expect(banish).toMatch(/Wave 1 cleared, \d+ bonus\./);
    expect(announceEvents(tick(s, s.timeLeftMs + 1, cov()).events)).toMatch(/^A life is lost\. 2 left\./);
    expect(announceEvents([])).toBeNull();
    for (const e of [banish]) expect(e).not.toMatch(/\u2014/);
  });
});

describe("Instant Digital Launchpad inputs", () => {
  it("a hold reads 1.0 once it lasts 250 ms; before that it reads nothing", () => {
    let p = padPress(emptyPad, 3, 1000);
    expect(padCoverage(p, 1000)[3]).toBe(0);
    expect(padCoverage(p, 1000 + HOLD_MS - 1)[3]).toBe(0);
    expect(padCoverage(p, 1000 + HOLD_MS)[3]).toBe(HOLD_COVERAGE);
    expect(HOLD_COVERAGE).toBe(1);
    p = padRelease(p, 3, 1400);
    expect(padCoverage(p, 1401)[3]).toBe(0);
  });

  it("a quick tap reads 0.35 for a moment, then 0", () => {
    let p = padPress(emptyPad, 5, 2000);
    p = padRelease(p, 5, 2080);
    expect(TAP_COVERAGE).toBe(0.35);
    expect(padCoverage(p, 2081)[5]).toBe(0.35);
    expect(padCoverage(p, 2080 + TAP_PULSE_MS - 1)[5]).toBe(0.35);
    expect(padCoverage(p, 2080 + TAP_PULSE_MS)[5]).toBe(0);
    expect(classifyCoverage(TAP_COVERAGE)).toBe("trembling");
    expect(classifyCoverage(HOLD_COVERAGE)).toBe("covered");
  });

  it("ignores key repeat, a release without a press, and keeps pads independent", () => {
    const a = padPress(emptyPad, 1, 100);
    expect(padPress(a, 1, 900)).toBe(a);
    expect(padRelease(emptyPad, 1, 100)).toBe(emptyPad);
    const both = padPress(padPress(emptyPad, 1, 100), 2, 150);
    expect(padCoverage(both, 400).map((c, i) => (c ? i : -1)).filter((i) => i >= 0)).toEqual([1, 2]);
    expect(padCoverage(both, 400)).toHaveLength(12);
  });

  it("maps the keys 1-9, 0, minus and equals to runes 1 to 12", () => {
    expect([...PAD_KEYS]).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="]);
    expect(PAD_KEYS.map((k) => runeForKey(k))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(runeForKey("a")).toBeNull();
    expect(runeForKey("Enter")).toBeNull();
  });

  it("plays the game: a hold banishes, a tap trembles", () => {
    const s = fresh();
    const rune = s.targets[0].rune;
    const held = tick(s, 16, padCoverage(padPress(emptyPad, rune, 0), HOLD_MS + 10));
    expect(held.events.some((e) => e.type === "banish")).toBe(true);
    const tapped = tick(s, 16, padCoverage(padRelease(padPress(emptyPad, rune, 0), rune, 60), 70));
    expect(tapped.events).toEqual([{ type: "tremble", rune }]);
    expect(tapped.trembling).toBe(true);
    expect(tapped.targets[0].cursed).toBe(true);
  });
});

describe("camera noise guard", () => {
  it("counts a rune only as much as it read in both of the last two frames", () => {
    expect(confirmCoverage(null, null)).toBeNull();
    expect(confirmCoverage([0.9, 0.9], null)).toBeNull();
    expect(confirmCoverage(null, [0.9, 0.5])).toEqual([0, 0]);
    expect(confirmCoverage([0.9, 0.1], [0.7, 0.8])).toEqual([0.7, 0.1]);
  });
});
