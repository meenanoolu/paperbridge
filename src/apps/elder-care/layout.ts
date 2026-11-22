import type { CardLayout, PageSize } from "../../core";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_NAMES: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/** Column keys of the daily checklist group. */
export const CARE_COLS = ["am", "pm", "water", "dizzy"] as const;
export const ENERGY_LEVELS = ["1", "2", "3", "4", "5"] as const;

const ROW_PITCH = 24;
const FIRST_ROW_Y = 82;

function weeklyCareCard(page: PageSize): CardLayout {
  return {
    id: "elder-care-weekly",
    version: 1,
    title: "Weekly Care Card",
    subtitle: "Fill each circle fully with a dark pen.",
    page,
    fiducial: { sizeMm: 16, insetMm: 6 },
    labelScale: 1.45,
    groups: [
      {
        key: "care",
        title: "Daily checklist",
        rows: [...DAYS],
        cols: [...CARE_COLS],
        colLabels: ["Morning\nMeds", "Night\nMeds", "Water\n6+ cups", "Dizzy\nor Pain"],
        originMm: [52, FIRST_ROW_Y],
        pitchMm: [26, ROW_PITCH],
        radiusMm: 6.5,
        bands: { fromXMm: 24, toXMm: 200 },
      },
      {
        key: "energy",
        title: "Energy 1-5",
        rows: [...DAYS],
        cols: [...ENERGY_LEVELS],
        originMm: [152, FIRST_ROW_Y],
        pitchMm: [10.5, ROW_PITCH],
        radiusMm: 4.3,
        hideRowLabels: true,
      },
    ],
    footer: {
      yMm: FIRST_ROW_Y + 6 * ROW_PITCH + 22,
      lines: ["Energy: 1 = very tired, 5 = full of energy. Fill one.", "Bring this card to every visit."],
    },
  };
}

/** A4 first: it is the default print. Both decode. */
export const ELDER_LAYOUTS: CardLayout[] = [weeklyCareCard("A4"), weeklyCareCard("Letter")];
export const ELDER_LAYOUT = ELDER_LAYOUTS[0];

const CARE_COL_NAMES: Record<string, string> = { am: "morning meds", pm: "night meds", water: "water", dizzy: "dizzy or pain" };

/**
 * Plain-language name of a bubble, matching the dashboard's wording, e.g. "Wednesday water".
 * Pass the card's custom column labels to name them as printed ("Wednesday Metformin 500mg").
 */
export function describeCareBubble(b: { group: string; row: string; col: string }, labels?: Partial<Record<string, string>>): string {
  const day = DAY_NAMES[b.row as Day] ?? b.row;
  if (b.group === "energy") return `${day} energy ${b.col}`;
  return `${day} ${labels?.[b.col] ?? CARE_COL_NAMES[b.col] ?? b.col}`;
}
