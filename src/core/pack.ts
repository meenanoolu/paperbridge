import type { CardLayout } from "./types";
import { checkPrintedText } from "./validate";

/**
 * Multi-sheet packs (e.g. a 4-week month of care cards, a 4-quiz unit): one layout per sheet,
 * each the first candidate whose printed text fits. Render with `renderCardsPdf`.
 */
export function firstFitting(candidates: CardLayout[]): CardLayout {
  return candidates.find((l) => checkPrintedText(l).length === 0) ?? candidates[candidates.length - 1];
}

export function buildPack(count: number, sheet: (index: number) => CardLayout[]): CardLayout[] {
  return Array.from({ length: count }, (_, i) => firstFitting(sheet(i)));
}

/** "Week 1 of 4: ..." style label on the first group's title, with shorter fallbacks. */
export function withGroupTitle(layout: CardLayout, title: string): CardLayout {
  return { ...layout, groups: layout.groups.map((g, i) => (i === 0 ? { ...g, title } : g)) };
}
