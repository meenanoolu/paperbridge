import { describe, expect, it } from "vitest";
import { RITE_RUNE_NAMES } from "../layout";
import { announceEvents, type RiteEvent } from "../riteEngine";
import { ghostlyStatus, TREMBLE_HINT, TREMBLE_LINES, trembleLine } from "../riteVoice";

const EM_DASH = /[\u2013\u2014]/;

describe("the ghosts' voice", () => {
  it("tells a trembling player to cover the named rune fully, with a joke, every time", () => {
    for (let rune = 0; rune < 12; rune++)
      for (let wave = 1; wave <= 6; wave++) {
        const line = trembleLine(rune, wave);
        expect(line).toContain(RITE_RUNE_NAMES[rune]);
        expect(line).toMatch(/cover|press|hold|half covered/i);
        expect(line).not.toMatch(EM_DASH);
        expect(line.length).toBeLessThan(90);
      }
    expect(TREMBLE_LINES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(Array.from({ length: 5 }, (_, w) => trembleLine(3, w))).size).toBe(5);
  });

  it("is deterministic: the same rune and wave always get the same joke", () => {
    expect(trembleLine(4, 2)).toBe(trembleLine(4, 2));
    expect(trembleLine(4, 2)).not.toBe(trembleLine(4, 3));
  });

  it("explains the rule in plain numbers while a hand trembles", () => {
    expect(TREMBLE_HINT).toContain("40%");
    expect(TREMBLE_HINT).toMatch(/combo/);
    expect(TREMBLE_HINT).toMatch(/fully covered/);
    expect(TREMBLE_HINT).not.toMatch(EM_DASH);
  });

  it("wraps only the tremble: every other event keeps the engine's exact sentence", () => {
    const banish: RiteEvent[] = [{ type: "banish", rune: 1, points: 100, combo: 1, grew: true }];
    expect(ghostlyStatus(banish, 1)).toBe(announceEvents(banish));
    expect(ghostlyStatus([], 1)).toBeNull();
    const shake: RiteEvent[] = [{ type: "tremble", rune: 5 }];
    expect(ghostlyStatus(shake, 2)).toBe(trembleLine(5, 2));
    const both: RiteEvent[] = [{ type: "tremble", rune: 5 }, { type: "lifeLost", lives: 1 }];
    expect(ghostlyStatus(both, 2)).toBe(`${trembleLine(5, 2)} A life is lost. 1 left.`);
  });
});
