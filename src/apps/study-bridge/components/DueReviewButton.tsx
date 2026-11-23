import { useMemo } from "react";
import { PrintLayoutButton } from "../../../shell/components/PrintCard";
import { dueReviewFileName, dueReviewSheet, shortDate } from "../due-review";
import type { GradeReport } from "../grade";

/** "Print Due Review Card": a review answer sheet naming the weak topics and their 1/3/7-day dates. */
export function DueReviewButton({ report }: { report: GradeReport }) {
  const sheet = useMemo(() => dueReviewSheet(report), [report]);
  if (!sheet) return null;
  return (
    <section aria-labelledby="due-review" className="rounded-2xl border-2 border-slate-950 bg-yellow-50 p-5">
      <h3 id="due-review" className="text-2xl font-extrabold">
        Next: a review sheet
      </h3>
      <PrintLayoutButton
        layouts={sheet.layouts}
        label="Print Due Review Card"
        icon="calendar"
        fileName={(page) => dueReviewFileName(sheet.dates, page)}
        description={`Header: review ${sheet.topics.join(", ")}. Footer: due ${sheet.dates.map(shortDate).join(", ")} (1, 3 and 7 days). Same circles, so it grades like any sheet.`}
      />
    </section>
  );
}
