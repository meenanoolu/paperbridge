import { describe, expect, it } from "vitest";
import { ELDER_LAYOUT } from "../../apps/elder-care/layout";
import { ELDER_SAMPLE_SPECS } from "../../apps/elder-care/samples/specs";
import { STUDY_LAYOUT } from "../../apps/study-bridge/layout";
import { STUDY_SAMPLE_SPECS } from "../../apps/study-bridge/samples/specs";
import { markDarkness, runStressTest, scoreBubbles, stressCamera, TILT_LIMIT_DEG } from "../stress-lab";

const elderMarks = ELDER_SAMPLE_SPECS[1].marks.filter((m) => m.style !== "faint").map((m) => m.key);
const studyMarks = STUDY_SAMPLE_SPECS[0].marks.map((m) => m.key);
let tick = 0;
const clock = () => (tick += 7);

describe("Optical Stress-Test Lab", () => {
  it("maps sliders to the simulated camera within the decoder's verified limits", () => {
    expect(stressCamera({ tiltDeg: 30, dim: 2, faint: 0 })).toMatchObject({ rotationDeg: TILT_LIMIT_DEG, brightness: 0.5, gradient: { strength: 0.45 }, blob: { strength: 0.4 }, markDarkness: 0.88 });
    expect(stressCamera({ tiltDeg: -30, dim: -1, faint: 1 })).toMatchObject({ rotationDeg: -TILT_LIMIT_DEG, brightness: 1 });
    expect(stressCamera({ tiltDeg: 0, dim: 0, faint: 1 }).markDarkness).toBeCloseTo(0.3);
    expect(markDarkness(0.5)).toBeCloseTo(0.59);
  });

  it("reports the decode time from the injected clock", () => {
    tick = 0;
    expect(runStressTest(STUDY_LAYOUT, studyMarks, { tiltDeg: 0, dim: 0, faint: 0 }, clock).decodeMs).toBe(7);
  });

  for (const tiltDeg of [-8, 0, 8])
    for (const dim of [0, 1])
      it(`tilt ${tiltDeg} degrees, dim ${dim * 100}%: every bubble reads exactly as marked`, () => {
        const run = runStressTest(ELDER_LAYOUT, elderMarks, { tiltDeg, dim, faint: 0 }, clock);
        expect(run.result.ok).toBe(true);
        expect(run.counts).toMatchObject({ correct: run.counts!.total, unclear: 0, falseFilled: 0, missed: 0 });
      });

  it("as the pen gets fainter, marks flip from filled to unclear, never to a wrong reading", () => {
    const seen: string[] = [];
    for (let faint = 0; faint <= 1.0001; faint += 0.1)
      for (const [layout, marks] of [
        [ELDER_LAYOUT, elderMarks],
        [STUDY_LAYOUT, studyMarks],
      ] as const) {
        const c = runStressTest(layout, marks, { tiltDeg: 8, dim: 1, faint }, clock).counts!;
        expect({ faint, wrong: c.falseFilled + c.missed }).toEqual({ faint, wrong: 0 });
        seen.push(c.unclear === 0 ? "clear" : c.unclear === marks.length ? "all-unclear" : "some");
      }
    expect(seen[0]).toBe("clear");
    expect(seen.at(-1)).toBe("all-unclear");
  });

  it("scores bubbles against the known marks", () => {
    const result = {
      ok: true as const,
      cardId: "x",
      layoutVersion: 1,
      fiducials: [],
      bubbles: (["filled", "ambiguous", "blank", "filled", "blank"] as const).map((state, i) => ({ group: "g", row: "r", col: String(i), state, confidence: 1, fill: 0, at: [0, 0] as [number, number] })),
    };
    expect(scoreBubbles(result, new Set(["g/r/0", "g/r/1", "g/r/2"]))).toEqual({ correct: 2, unclear: 1, falseFilled: 1, missed: 1, total: 5 });
    expect(scoreBubbles({ ok: false, reason: "FIDUCIALS_NOT_FOUND" }, new Set())).toBeNull();
  });
});
