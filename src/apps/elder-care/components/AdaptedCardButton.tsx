import { useMemo } from "react";
import { PrintLayoutButton } from "../../../shell/components/PrintCard";
import { adaptedFileName, adaptedNextWeekCard } from "../adaptive";
import { formatDay, type CareCardSettings } from "../card-settings";
import type { CarePattern } from "../patterns";

/**
 * "Print Adapted Next-Week Card": shown only when the fixed pattern rules found something. Prints
 * next Monday's card with a bold focus note in the footer and the affected column highlighted.
 */
export function AdaptedCardButton({ card, patterns, weekStart }: { card: CareCardSettings; patterns: CarePattern[]; weekStart: string }) {
  const adapted = useMemo(() => adaptedNextWeekCard(card, patterns, weekStart), [card, patterns, weekStart]);
  if (!adapted) return null;
  const first = adapted.layouts[0];
  return (
    <div className="rounded-xl border-2 border-slate-950 bg-yellow-50 p-4">
      <p className="text-xl font-extrabold">Adapt next week's card</p>
      <PrintLayoutButton
        layouts={adapted.layouts.map((l) => l.layout)}
        label="Print Adapted Next-Week Card"
        icon="sparkle"
        fileName={(page) => adaptedFileName(card, adapted.weekStart, page)}
        description={`Week of ${formatDay(adapted.weekStart)}, based on "${adapted.pattern.title}". The footer will read "${first.note}"${
          first.highlight ? `, and that column's header is ${first.highlight === "frame" ? "boxed" : "double-underlined"}` : ""
        }. Circles stay in place, so it scans like any card.`}
      />
    </div>
  );
}
