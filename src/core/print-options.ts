import type { CardLayout, PrintStyle } from "./types";

/**
 * Print options every app gets from the shared Print Cards tab: the card's language,
 * High-Visibility mode and Icon-Anchored mode. Print-only: none of them moves a bubble,
 * a corner marker or a card-ID bit.
 */
export type PrintLanguage = "en" | "te" | "hi" | "es" | "other";

export interface PrintLanguageOption {
  id: PrintLanguage;
  /** Name in its own script, shown first. */
  native: string;
  english: string;
  /** BCP 47 tag for `lang` attributes; "und" for "other". */
  tag: string;
}

export const PRINT_LANGUAGES: PrintLanguageOption[] = [
  { id: "en", native: "English", english: "English", tag: "en" },
  { id: "te", native: "తెలుగు", english: "Telugu", tag: "te" },
  { id: "hi", native: "हिन्दी", english: "Hindi", tag: "hi" },
  { id: "es", native: "Español", english: "Spanish", tag: "es" },
  { id: "other", native: "Other script", english: "Any other language (type your own labels)", tag: "und" },
];

/** BCP 47 tag for speech and alerts. Undefined for "other". */
export const PRINT_LANGUAGE_TAGS: Record<PrintLanguage, string | undefined> = { en: "en-US", te: "te-IN", hi: "hi-IN", es: "es-ES", other: undefined };

export function isPrintLanguage(v: unknown): v is PrintLanguage {
  return PRINT_LANGUAGES.some((l) => l.id === v);
}

export interface PrintOptions {
  language?: PrintLanguage;
  highVisibility?: boolean;
  icons?: boolean;
}

/**
 * High-visibility style: all text bold, day/row labels 20% larger, alternate rows at grey 0.90.
 * Bubble positions, borders and interiors are unchanged; faint marks on shaded rows still read as
 * unclear rather than blank (measured, see print-modes.test.ts).
 */
export const HIGH_VISIBILITY_STYLE: PrintStyle = { boldText: true, bandGrey: 0.9, rowLabelScale: 1.2, colLabelScale: 1 };

/** Apply High-Visibility and Icon-Anchored modes to a layout. Icons draw only where the layout declares `colIcons`. */
export function applyPrintOptions(layout: CardLayout, o: PrintOptions): CardLayout {
  const style: PrintStyle = { ...(o.highVisibility ? HIGH_VISIBILITY_STYLE : {}), ...(o.icons ? { showIcons: true } : {}) };
  return Object.keys(style).length ? { ...layout, printStyle: { ...layout.printStyle, ...style } } : layout;
}

/** Whether Icon-Anchored mode would draw anything on these layouts. */
export function hasColumnIcons(layouts: CardLayout[]): boolean {
  return layouts.some((l) => l.groups.some((g) => g.colIcons?.some(Boolean)));
}

/**
 * Replace printed strings by exact match: title, subtitle, group titles, column and row labels,
 * column notes and footer lines. Anything not in `dict` (e.g. a typed name) prints as is.
 */
export function localizeLayout(layout: CardLayout, dict: Record<string, string> | undefined): CardLayout {
  if (!dict || Object.keys(dict).length === 0) return layout;
  const t = (s: string) => dict[s] ?? s;
  const tl = (list?: string[]) => list && list.map((s) => s.split("\n").map(t).join("\n"));
  return {
    ...layout,
    title: t(layout.title),
    ...(layout.subtitle !== undefined ? { subtitle: t(layout.subtitle) } : {}),
    groups: layout.groups.map((g) => ({
      ...g,
      ...(g.title !== undefined ? { title: t(g.title) } : {}),
      ...(g.colLabels ? { colLabels: tl(g.colLabels) } : {}),
      ...(g.rowLabels ? { rowLabels: tl(g.rowLabels) } : {}),
      ...(g.colNotes ? { colNotes: tl(g.colNotes) } : {}),
    })),
    ...(layout.footer ? { footer: { ...layout.footer, lines: layout.footer.lines.map(t) } } : {}),
  };
}
