import type { MarkStyle, SampleSpec } from "../../../shell/sample-spec";
import { DAYS, type Day } from "../layout";

type Week = Record<Day, { am?: boolean; pm?: boolean; water?: boolean; dizzy?: boolean; energy?: number; faint?: string[] }>;

/** Turn a readable week description into bubble marks. `faint` lists columns drawn as light partial marks. */
function marksFor(week: Week): SampleSpec["marks"] {
  const out: SampleSpec["marks"] = [];
  for (const day of DAYS) {
    const d = week[day];
    const style = (col: string): MarkStyle | undefined => (d.faint?.includes(col) ? "faint" : undefined);
    for (const col of ["am", "pm", "water", "dizzy"] as const) {
      if (d[col] || d.faint?.includes(col)) out.push({ key: `care/${day}/${col}`, style: style(col) });
    }
    if (d.energy) out.push({ key: `energy/${day}/${d.energy}` });
  }
  return out;
}

const WOOD: [number, number, number] = [0.42, 0.3, 0.2];
const WARM: [number, number, number] = [1, 0.97, 0.9];

export const ELDER_SAMPLE_SPECS: SampleSpec[] = [
  {
    id: "normal-week",
    title: "Normal Week",
    description: "Every dose taken, good water, steady energy.",
    file: "normal-week.jpg",
    inkSeed: 11,
    marks: marksFor({
      Mon: { am: true, pm: true, water: true, energy: 4 },
      Tue: { am: true, pm: true, water: true, energy: 4 },
      Wed: { am: true, pm: true, water: true, energy: 3 },
      Thu: { am: true, pm: true, energy: 4 },
      Fri: { am: true, pm: true, water: true, energy: 5 },
      Sat: { am: true, pm: true, water: true, energy: 4 },
      Sun: { am: true, pm: true, water: true, energy: 4 },
    }),
    camera: {
      scale: 1.5,
      rotationDeg: 2.5,
      perspective: [0.02, 0.035],
      gradient: { angleRad: 0.6, strength: 0.14 },
      noiseSigma: 3,
      seed: 101,
      marginMm: 16,
      background: WOOD,
      lightColor: WARM,
    },
  },
  {
    id: "missed-dose",
    title: "Missed-Dose Alert",
    description: "4 missed doses, dizzy 2 days, one unclear mark.",
    file: "missed-dose.jpg",
    inkSeed: 23,
    marks: marksFor({
      Mon: { am: true, pm: true, water: true, energy: 4 },
      Tue: { am: true, energy: 3 },
      Wed: { am: true, pm: true, energy: 3, faint: ["water"] },
      Thu: { dizzy: true, energy: 2 },
      Fri: { am: true, pm: true, dizzy: true, energy: 2 },
      Sat: { am: true, water: true, energy: 3 },
      Sun: { am: true, pm: true, water: true, energy: 3 },
    }),
    camera: {
      scale: 1.5,
      rotationDeg: -5,
      perspective: [-0.035, 0.045],
      blob: { x: 0.72, y: 0.3, sigma: 0.22, strength: 0.28 },
      gradient: { angleRad: 2.4, strength: 0.12 },
      noiseSigma: 3.5,
      seed: 202,
      marginMm: 16,
      background: WOOD,
      lightColor: WARM,
    },
  },
  {
    id: "tilted-low-light",
    title: "Tilted/Low-Light Card",
    description: "Photo at an angle in a dim room with a shadow.",
    file: "tilted-low-light.jpg",
    inkSeed: 37,
    marks: marksFor({
      Mon: { am: true, pm: true, water: true, dizzy: true, energy: 3 },
      Tue: { am: true, pm: true, water: true, energy: 4 },
      Wed: { am: true, pm: true, water: true, energy: 4 },
      Thu: { am: true, pm: true, water: true, energy: 4 },
      Fri: { am: true, pm: true, energy: 3 },
      Sat: { am: true, pm: true, water: true, energy: 4 },
      Sun: { am: true, water: true, energy: 3 },
    }),
    camera: {
      scale: 1.5,
      rotationDeg: 17,
      perspective: [0.06, -0.05],
      brightness: 0.55,
      gradient: { angleRad: 0.3, strength: 0.4 },
      blob: { x: 0.35, y: 0.62, sigma: 0.18, strength: 0.35 },
      noiseSigma: 6,
      seed: 303,
      marginMm: 18,
      background: [0.3, 0.27, 0.25],
      lightColor: [1, 0.93, 0.8],
    },
  },
];
