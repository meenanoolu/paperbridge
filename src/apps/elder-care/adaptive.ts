import { checkPrintedText, type CardLayout } from "../../core";
import { columnLabel, customizeCareLayout, mondayOf, type CareCardSettings, type CareCol } from "./card-settings";
import { ENGLISH_FOCUS, languagePack, translateLabel } from "./i18n";
import { CARE_COLS, ELDER_LAYOUTS } from "./layout";
import type { CarePattern } from "./patterns";

/**
 * Adaptive Paper Loop: paper -> screen -> smarter paper. When the fixed pattern rules find
 * something on a scanned week (or across saved weeks), print next Monday's card with a focus note
 * in the footer and a highlight on the affected dose column. Only printed text and print-only
 * marks change: every bubble, corner marker and card-ID bit is the standard card's, so the
 * adapted card scans exactly like any other.
 */
export type HighlightStyle = "frame" | "underline";

export interface AdaptedCard {
  /** Monday the adapted card starts on. */
  weekStart: string;
  /** The column the pattern points to. */
  focusCol: CareCol;
  /** The pattern the card was adapted for. */
  pattern: CarePattern;
  /** One layout per paper size (A4, Letter), each with its own fitted note and highlight. */
  layouts: { layout: CardLayout; note: string; highlight: HighlightStyle | null }[];
}

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const isoOf = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);

/**
 * The Monday of the next card: the week after the latest known week (the card's saved week or the
 * latest saved history week), or the first Monday after `today` for an undated card.
 */
export function nextCardMonday(knownWeeks: string[], today: Date): string {
  const latest = knownWeeks.map(mondayOf).filter(Boolean).sort().pop();
  if (latest) return addDays(latest, 7);
  const t = isoOf(today);
  return addDays(mondayOf(t), 7);
}

/** Footer notes to try for a pattern, longest first. The first that prints without collisions wins. */
export function focusNoteCandidates(s: CareCardSettings, p: CarePattern): string[] {
  const pack = languagePack(s.language);
  const f = pack?.focus ?? ENGLISH_FOCUS;
  const col: CareCol = p.slot === "Morning" ? "am" : "pm";
  const label = translateLabel(pack, columnLabel(s, col));
  const advice = p.kind === "slot-barrier" ? f.sameTime : p.symptom === "low-energy" ? f.askTired : f.askDizzy;
  const stop = f.stop ?? ".";
  return [`${f.lead} ${label}${stop} ${advice}`, `${f.short} ${label}${stop} ${advice}`, `${f.lead} ${label}${stop}`, `${f.short} ${label}${stop}`];
}

/** The first pattern decides the focus: patterns are listed most specific first. */
export function adaptedNextWeekCard(s: CareCardSettings, patterns: CarePattern[], weekStart: string): AdaptedCard | null {
  const pattern = patterns[0];
  if (!pattern || !weekStart) return null;
  const focusCol: CareCol = pattern.slot === "Morning" ? "am" : "pm";
  const colIndex = CARE_COLS.indexOf(focusCol);
  const notes = focusNoteCandidates(s, pattern);
  const layouts = ELDER_LAYOUTS.map((base) => {
    const card = customizeCareLayout(base, { ...s, weekStart });
    const withNote = (note: string, highlight: HighlightStyle | null): CardLayout => {
      const lines = card.footer ? [...card.footer.lines.slice(0, -1), note] : [note];
      return {
        ...card,
        footer: card.footer && { ...card.footer, lines, boldLines: [lines.length - 1] },
        groups: card.groups.map((g) => (g.key === "care" && highlight ? { ...g, colHighlights: [colIndex], colHighlightStyle: highlight } : g)),
      };
    };
    // Prefer the full note, then the boldest highlight that fits: a frame, else a double underline.
    for (const note of notes)
      for (const highlight of ["frame", "underline", null] as const) {
        const layout = withNote(note, highlight);
        if (checkPrintedText(layout).length === 0) return { layout, note, highlight };
      }
    return { layout: card, note: "", highlight: null };
  });
  return { weekStart, focusCol, pattern, layouts };
}

export function adaptedFileName(s: CareCardSettings, weekStart: string, page: string): string {
  const who = s.patientName.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `care-card-adapted-${who ? `${who}-` : ""}${weekStart}-${page}.pdf`;
}
