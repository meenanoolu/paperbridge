import { checkPrintedText, type CardLayout, type PageSize } from "../../core";
import { customizeCareLayout, formatDay, mondayOf, weekDates, weekRange, type CareCardSettings } from "./card-settings";
import { ELDER_LAYOUTS } from "./layout";

/**
 * A printable month: N consecutive Weekly Care Cards (default 4) starting on the saved Monday,
 * each with the patient, medication labels, routine anchors, pill cues and print mode. Only text
 * changes between pages, so every page decodes with the standard layout.
 */
export const PACK_WEEKS = 4;

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** "28 Dec - 3 Jan 2027": both years dropped except the last. */
function shortRange(from: string, to: string): string {
  return `${formatDay(from).slice(0, -5)} - ${formatDay(to)}`;
}

/** Week headings to try, longest first. The first one that prints without collisions wins. */
export function packTitleCandidates(week: number, of: number, from: string, to: string): string[] {
  return [`Week ${week} of ${of}: ${weekRange(from, to)}`, `Week ${week}/${of}: ${weekRange(from, to)}`, `Week ${week}/${of}: ${shortRange(from, to)}`];
}

export function packMondays(start: string, weeks = PACK_WEEKS): string[] {
  const monday = mondayOf(start);
  if (!monday) return [];
  return Array.from({ length: weeks }, (_, i) => addDays(monday, 7 * i));
}

/** Layouts for the pack. Empty if the settings have no week start date. */
export function monthlyPackLayouts(s: CareCardSettings, page: PageSize, weeks = PACK_WEEKS): CardLayout[] {
  const base = ELDER_LAYOUTS.find((l) => l.page === page) ?? ELDER_LAYOUTS[0];
  return packMondays(s.weekStart, weeks).map((monday, i) => {
    const layout = customizeCareLayout(base, { ...s, weekStart: monday });
    const dates = weekDates(monday);
    const candidates = packTitleCandidates(i + 1, weeks, dates[0], dates[6]);
    const withTitle = (title: string): CardLayout => ({ ...layout, groups: layout.groups.map((g) => (g.key === "care" ? { ...g, title } : g)) });
    return candidates.map(withTitle).find((l) => checkPrintedText(l).length === 0) ?? layout;
  });
}

export function packFileName(s: CareCardSettings, page: PageSize): string {
  const who = s.patientName.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `care-cards-4-weeks-${who ? `${who}-` : ""}${mondayOf(s.weekStart)}-${page}.pdf`;
}

export function packTitle(s: CareCardSettings): string {
  const m = packMondays(s.weekStart);
  return `Weekly Care Cards, 4 weeks from ${formatDay(m[0])}${s.patientName.trim() ? ` - ${s.patientName.trim()}` : ""}`;
}
