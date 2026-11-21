import type { SampleCard } from "../../../shell/components/SamplePanel";
import { ELDER_SAMPLE_SPECS } from "./specs";
import missedDose from "./missed-dose.jpg";
import normalWeek from "./normal-week.jpg";
import tiltedLowLight from "./tilted-low-light.jpg";

const URLS: Record<string, string> = {
  "normal-week": normalWeek,
  "missed-dose": missedDose,
  "tilted-low-light": tiltedLowLight,
};

export const ELDER_SAMPLES: SampleCard[] = ELDER_SAMPLE_SPECS.map((s) => ({
  id: s.id,
  title: s.title,
  description: s.description,
  src: URLS[s.id],
}));
