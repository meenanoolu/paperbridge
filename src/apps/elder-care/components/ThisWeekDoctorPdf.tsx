import { useState } from "react";
import { defaultPageSize, downloadBytes } from "../../../shell/components/PrintCard";
import { Button } from "../../../shell/components/ui";
import type { CareCardSettings } from "../card-settings";
import { historyPatterns, type WeekEntry } from "../history";

/** Doctor Visit PDF for just the scanned week, without saving it to history first. */
export function ThisWeekDoctorPdf({ entry, card }: { entry: WeekEntry; card: CareCardSettings }) {
  const [state, setState] = useState<{ busy: boolean; message: string; error?: boolean }>({ busy: false, message: "" });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        icon="printer"
        disabled={state.busy}
        onClick={async () => {
          setState({ busy: true, message: "" });
          try {
            const { renderDoctorVisitPdf, doctorPdfFileName } = await import("../doctor-pdf");
            const generatedAt = new Date();
            const weeks = [entry];
            const bytes = await renderDoctorVisitPdf({ patientName: entry.patientName, weeks, patterns: historyPatterns(weeks), card, generatedAt, page: defaultPageSize() });
            const name = doctorPdfFileName(entry.patientName, generatedAt);
            downloadBytes(new Uint8Array(bytes), "application/pdf", name);
            setState({ busy: false, message: `Downloaded ${name} (this week only).` });
          } catch {
            setState({ busy: false, message: "The PDF could not be created.", error: true });
          }
        }}
      >
        {state.busy ? "Preparing PDF..." : "Doctor Visit PDF (this week)"}
      </Button>
      <span role="status" aria-live="polite" className={`text-lg font-bold ${state.error ? "text-red-900" : "text-green-900"}`}>
        {state.message}
      </span>
    </div>
  );
}
