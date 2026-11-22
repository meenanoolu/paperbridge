import { useCallback } from "react";
import { ScanWorkbench } from "../../shell/components/ScanWorkbench";
import type { ReviewedScan } from "../../shell/scan";
import { CareDashboard } from "./components/CareDashboard";
import { interpretCareCard, SCAN_ALERT_EVENT, toScanAlert, type ScanAlert } from "./interpret";
import { describeCareBubble, ELDER_LAYOUTS } from "./layout";
import { ELDER_SAMPLES } from "./samples";

/** The alert for a reviewed scan: human overrides applied, with their count recorded. */
export function alertFor(scan: ReviewedScan): ScanAlert {
  return toScanAlert(interpretCareCard(scan.result), scan.result.cardId, scan.scannedAt, scan.manualOverrides);
}

export function ElderCareApp() {
  // Emit an aggregate alert after every scan and after every manual override (task 9.6).
  // The Kiro Crew App dedupes by card + scan time, so a corrected alert replaces the earlier one.
  const onScan = useCallback((scan: ReviewedScan) => {
    window.dispatchEvent(new CustomEvent(SCAN_ALERT_EVENT, { detail: alertFor(scan) }));
  }, []);

  return (
    <ScanWorkbench
      icon="heart"
      title="Elder Care Bridge"
      tagline="A large-print weekly paper card for medication and symptoms. No smartphone or login for the person filling it in. Caregivers get adherence, missed doses, and symptom flags from one photo."
      layouts={ELDER_LAYOUTS}
      samples={ELDER_SAMPLES}
      steps={[
        ["Print", "One page, bold large print, A4 or US Letter."],
        ["Fill in", "Each day, fill circles with a dark pen."],
        ["Scan", "Webcam or photo upload at the end of the week."],
        ["Review", "Adherence, missed doses, and symptom alerts."],
      ]}
      describeBubble={describeCareBubble}
      onScan={onScan}
      announce={(scan) => {
        const r = interpretCareCard(scan.result);
        const pct = r.adherencePct === null ? "Adherence unknown" : `${r.adherencePct}% of doses taken`;
        return `${pct}. ${r.alerts.length === 0 ? "No alerts." : `${r.alerts.length} alert${r.alerts.length > 1 ? "s" : ""}, starting with: ${r.alerts[0].title}.`}`;
      }}
      renderResult={(scan) => <CareDashboard report={interpretCareCard(scan.result)} scannedAt={scan.scannedAt} alert={alertFor(scan)} />}
    />
  );
}
