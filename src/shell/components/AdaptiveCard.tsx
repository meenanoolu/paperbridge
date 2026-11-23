import type { CardLayout, PageSize } from "../../core";
import type { IconName } from "./Icon";
import { PrintLayoutButton } from "./PrintCard";

/**
 * The shell's adaptive next-card action (paper -> screen -> smarter paper). Apps return a spec
 * from the `adaptiveCard` slot; Elder Care's adapted next-week card and Study Bridge's due review
 * sheet both render through this one component.
 */
export interface AdaptiveCardSpec {
  heading: string;
  label: string;
  icon?: IconName;
  /** One layout per paper size. */
  layouts: CardLayout[];
  fileName(page: PageSize): string;
  description: string;
}

export function AdaptiveCardPanel({ spec }: { spec: AdaptiveCardSpec }) {
  return (
    <section aria-label={spec.heading} className="rounded-2xl border-2 border-slate-950 bg-yellow-50 p-5" data-testid="adaptive-card">
      <p className="text-2xl font-extrabold">{spec.heading}</p>
      <PrintLayoutButton layouts={spec.layouts} label={spec.label} icon={spec.icon ?? "sparkle"} fileName={spec.fileName} description={spec.description} />
    </section>
  );
}
