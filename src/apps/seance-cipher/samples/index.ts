import type { SampleCard } from "../../../shell/components/SamplePanel";
import lanternHall from "./lantern-hall.jpg";
import smudgedSeance from "./smudged-seance.jpg";
import { SEANCE_SAMPLE_SPECS } from "./specs";

const URLS: Record<string, string> = { "lantern-hall": lanternHall, "smudged-seance": smudgedSeance };

export const SEANCE_SAMPLES: SampleCard[] = SEANCE_SAMPLE_SPECS.map((s) => ({ id: s.id, title: s.title, description: s.description, src: URLS[s.id] }));
