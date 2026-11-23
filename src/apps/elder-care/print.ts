import type { PrintOptions } from "../../core";
import type { PrintSlot } from "../../shell/print-slot";
import { customizedElderLayouts, formatDay, normalizeSettings, validateSettings, type CareCardSettings } from "./card-settings";
import { monthlyPackLayouts, packFileName, packMondays, packTitle, PACK_WEEKS } from "./monthly-pack";

const optionsOf = (c: CareCardSettings): PrintOptions => ({ language: c.language ?? "en", highVisibility: !!c.highVisibility, icons: !!c.icons });
const withOptions = (c: CareCardSettings, o: PrintOptions): CareCardSettings => normalizeSettings({ ...c, language: o.language, highVisibility: o.highVisibility, icons: o.icons });

/**
 * Elder Care's plug-in for the shared Print Cards tab. The options are saved with the card
 * settings (the dashboard, Read Aloud and alerts use the card language too); the shell draws
 * the controls and the downloads.
 */
export function elderPrintSlot(card: CareCardSettings, save: (c: CareCardSettings) => void): PrintSlot {
  return {
    value: optionsOf(card),
    onChange: (o) => save(withOptions(card, o)),
    languages: ["en", "te", "hi", "es", "other"],
    cardLabel: "Download 1-Week Card (PDF)",
    layouts: (o) => customizedElderLayouts(withOptions(card, o)),
    problems: (o) => validateSettings(withOptions(card, o)).map((p) => p.message),
    pack: {
      heading: "Print a month",
      label: `Download ${PACK_WEEKS}-Week Pack (1 Month)`,
      sheets: PACK_WEEKS,
      hint: () => {
        const mondays = packMondays(card.weekStart);
        return mondays.length === PACK_WEEKS
          ? `${PACK_WEEKS} pages: weeks starting ${mondays.map((m) => formatDay(m).slice(0, -5)).join(", ")}.`
          : "Set a week start date in Customize Card and press Save card first: the pack starts on that Monday.";
      },
      layouts: (o, page) => monthlyPackLayouts(withOptions(card, o), page),
      fileName: (o, page) => packFileName(withOptions(card, o), page),
      pdfTitle: (o) => packTitle(withOptions(card, o)),
    },
  };
}
