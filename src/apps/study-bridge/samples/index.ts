import type { SampleCard } from "../../../shell/components/SamplePanel";
import alexStrong from "./alex-strong.jpg";
import samReview from "./sam-review.jpg";
import { STUDY_SAMPLE_SPECS } from "./specs";

const URLS: Record<string, string> = { "alex-strong": alexStrong, "sam-review": samReview };

export const STUDY_SAMPLES: SampleCard[] = STUDY_SAMPLE_SPECS.map((s) => ({
  id: s.id,
  title: s.title,
  description: s.description,
  src: URLS[s.id],
}));
