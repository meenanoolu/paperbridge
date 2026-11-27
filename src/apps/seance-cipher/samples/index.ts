import type { SampleCard } from "../../../shell/components/SamplePanel";
import huntFaintMark from "./hunt-faint-mark.jpg";
import huntMoonAttic from "./hunt-moon-attic.jpg";
import huntSkullCrypt from "./hunt-skull-crypt.jpg";
import huntStarTower from "./hunt-star-tower.jpg";
import lanternHall from "./lantern-hall.jpg";
import smudgedSeance from "./smudged-seance.jpg";
import { HUNT_SAMPLE_SPECS, SEANCE_SAMPLE_SPECS } from "./specs";

const URLS: Record<string, string> = {
  "lantern-hall": lanternHall,
  "smudged-seance": smudgedSeance,
  "hunt-moon-attic": huntMoonAttic,
  "hunt-skull-crypt": huntSkullCrypt,
  "hunt-star-tower": huntStarTower,
  "hunt-faint-mark": huntFaintMark,
};

const card = (s: (typeof SEANCE_SAMPLE_SPECS)[number]): SampleCard => ({ id: s.id, title: s.title, description: s.description, src: URLS[s.id] });

export const SEANCE_SAMPLES: SampleCard[] = SEANCE_SAMPLE_SPECS.map(card);
/** Photos of the printed hunt map, one room marked in each. */
export const HUNT_SAMPLES: SampleCard[] = HUNT_SAMPLE_SPECS.map(card);
