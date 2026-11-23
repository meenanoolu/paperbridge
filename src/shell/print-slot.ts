import { applyPrintOptions, buildPack, isPrintLanguage, localizeLayout, withGroupTitle, type CardLayout, type PageSize, type PrintLanguage, type PrintOptions } from "../core";

/**
 * What an app plugs into the shared Print Cards tab. The shell draws the language picker,
 * High-Visibility and Icon-Anchored toggles, paper size, the card download and an optional
 * multi-sheet pack; the app only says how its layouts change. `createPrintSlot` builds a
 * complete slot from a translation table, so most apps write no print code.
 */
export interface PackSlot {
  /** Box heading, e.g. "Print a month". */
  heading: string;
  /** Button text, e.g. "Download 4-Week Pack (1 Month)". */
  label: string;
  sheets: number;
  /** One sentence under the heading (what the pack contains, or what is missing). */
  hint(o: PrintOptions): string;
  /** One layout per sheet for this paper; empty when the pack is not ready. */
  layouts(o: PrintOptions, page: PageSize): CardLayout[];
  fileName(o: PrintOptions, page: PageSize): string;
  pdfTitle(o: PrintOptions): string;
}

export interface PrintSlot {
  /** Controlled options (e.g. saved with the app's own card settings). Omit and the shell stores them. */
  value?: PrintOptions;
  onChange?: (o: PrintOptions) => void;
  /** Languages offered on the Translate card picker. One or none hides the picker. */
  languages?: PrintLanguage[];
  /** Download button text. */
  cardLabel?: string;
  /** Printable layouts (A4 and Letter) for these options. */
  layouts(o: PrintOptions): CardLayout[];
  /** Reasons the card cannot be printed with these options. */
  problems?(o: PrintOptions): string[];
  pack?: PackSlot;
}

export type PrintText = Partial<Record<Exclude<PrintLanguage, "en" | "other">, Record<string, string>>>;

export interface StandardPrint {
  layouts: CardLayout[];
  /** Exact-string translations of the card's printed words, per language. */
  text?: PrintText;
  cardLabel?: string;
  pack?: {
    heading: string;
    label: string;
    sheets: number;
    /** Sheet headings to try, longest first, e.g. ["Quiz 1 of 4", "Quiz 1/4"]. */
    sheetTitles(index: number, count: number, lang: PrintLanguage): string[];
    /** File name stem, e.g. "unit-quiz-pack". */
    fileStem: string;
    pdfTitle: string;
  };
}

/** The layouts for these options: translate, then High-Visibility and icons. */
export function standardLayouts(layouts: CardLayout[], text: PrintText | undefined, o: PrintOptions): CardLayout[] {
  const dict = o.language && o.language !== "en" && o.language !== "other" ? text?.[o.language] : undefined;
  return layouts.map((l) => applyPrintOptions(localizeLayout(l, dict), o));
}

export function createPrintSlot(p: StandardPrint): PrintSlot {
  const languages: PrintLanguage[] = ["en", ...(Object.keys(p.text ?? {}) as PrintLanguage[])];
  const slot: PrintSlot = { languages, cardLabel: p.cardLabel, layouts: (o) => standardLayouts(p.layouts, p.text, o) };
  if (p.pack) {
    const pk = p.pack;
    slot.pack = {
      heading: pk.heading,
      label: pk.label,
      sheets: pk.sheets,
      hint: () => `${pk.sheets} sheets in one PDF, each with its own heading. Every sheet scans like the single card.`,
      layouts: (o, page) => {
        const base = standardLayouts(p.layouts, p.text, o).find((l) => l.page === page) ?? standardLayouts(p.layouts, p.text, o)[0];
        return buildPack(pk.sheets, (i) => [...pk.sheetTitles(i + 1, pk.sheets, o.language ?? "en").map((t) => withGroupTitle(base, t)), base]);
      },
      fileName: (o, page) => `${pk.fileStem}-${o.language ?? "en"}-${page}.pdf`,
      pdfTitle: () => pk.pdfTitle,
    };
  }
  return slot;
}

/** Stored shell-owned options; anything invalid is dropped. */
export function parsePrintOptions(raw: unknown): PrintOptions | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return {
    ...(isPrintLanguage(r.language) && r.language !== "en" ? { language: r.language } : {}),
    ...(r.highVisibility === true ? { highVisibility: true } : {}),
    ...(r.icons === true ? { icons: true } : {}),
  };
}
