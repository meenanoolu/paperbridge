import type { SampleSet, SampleSpec } from "../../../shell/sample-spec";
import { SEANCE_LAYOUT } from "../layout";

/** Two haunted sample cards: one clean reading, one with a smudged mark a person must confirm. */
export const SEANCE_SAMPLE_SPECS: SampleSpec[] = [
  {
    id: "lantern-hall",
    title: "The Lantern Hall",
    description: "Key, Flame, Moon. A clean reading.",
    file: "lantern-hall.jpg",
    inkSeed: 31,
    marks: [{ key: "q1/rune/key" }, { key: "q2/rune/flame" }, { key: "q3/rune/moon" }],
    camera: {
      scale: 1.45,
      rotationDeg: -7,
      perspective: [0.03, -0.02],
      gradient: { angleRad: 2.2, strength: 0.25 },
      noiseSigma: 3,
      seed: 41,
      marginMm: 16,
      background: [0.16, 0.13, 0.12],
    },
  },
  {
    id: "smudged-seance",
    title: "The Smudged Seance",
    description: "Candlelight and a faint mark the spirits cannot read alone.",
    file: "smudged-seance.jpg",
    inkSeed: 32,
    marks: [{ key: "q1/rune/eye" }, { key: "q2/rune/moon", style: "faint" }, { key: "q3/rune/key" }],
    camera: {
      scale: 1.3,
      rotationDeg: 9,
      perspective: [-0.04, 0.03],
      gradient: { angleRad: 0.4, strength: 0.38 },
      blob: { x: 0.7, y: 0.35, sigma: 0.22, strength: 0.32 },
      brightness: 0.72,
      noiseSigma: 4,
      seed: 42,
      marginMm: 18,
      background: [0.1, 0.09, 0.11],
    },
  },
];

export const SAMPLE_SET: SampleSet = { layout: SEANCE_LAYOUT, specs: SEANCE_SAMPLE_SPECS };
