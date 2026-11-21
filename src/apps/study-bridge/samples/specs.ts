import type { SampleSpec } from "../../../shell/sample-spec";
import type { Option, QuestionId } from "../layout";

function answers(a: Partial<Record<QuestionId, Option | Option[]>>): SampleSpec["marks"] {
  return Object.entries(a).flatMap(([q, o]) => (Array.isArray(o) ? o : [o!]).map((opt) => ({ key: `answers/${q}/${opt}` })));
}

export const STUDY_SAMPLE_SPECS: SampleSpec[] = [
  {
    id: "alex-strong",
    title: "Alex: Strong Quiz",
    description: "9 of 10 right. One slip in Geometry.",
    file: "alex-strong.jpg",
    inkSeed: 51,
    marks: answers({ Q1: "B", Q2: "A", Q3: "C", Q4: "D", Q5: "D", Q6: "B", Q7: "D", Q8: "A", Q9: "B", Q10: "E" }),
    camera: {
      scale: 1.5,
      rotationDeg: -4,
      perspective: [0.03, 0.04],
      gradient: { angleRad: 1.2, strength: 0.18 },
      noiseSigma: 3,
      seed: 501,
      marginMm: 16,
      background: [0.55, 0.58, 0.62],
      lightColor: [0.97, 0.99, 1],
    },
  },
  {
    id: "sam-review",
    title: "Sam: Needs Review",
    description: "Double mark, a blank, and 3 weak topics.",
    file: "sam-review.jpg",
    inkSeed: 67,
    marks: answers({ Q1: "A", Q2: "A", Q3: "B", Q4: "D", Q5: "C", Q6: ["B", "C"], Q8: "A", Q9: "B", Q10: "E" }),
    camera: {
      scale: 1.5,
      rotationDeg: 11,
      perspective: [-0.05, 0.04],
      brightness: 0.8,
      blob: { x: 0.3, y: 0.7, sigma: 0.2, strength: 0.3 },
      gradient: { angleRad: 3.6, strength: 0.25 },
      noiseSigma: 4.5,
      seed: 602,
      marginMm: 16,
      background: [0.2, 0.22, 0.26],
      lightColor: [1, 0.96, 0.88],
    },
  },
];
