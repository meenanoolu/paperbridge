import { useCallback } from "react";
import { ScanWorkbench } from "../../shell/components/ScanWorkbench";
import type { CompletedScan } from "../../shell/scan";
import { CareDashboard } from "./components/CareDashboard";
import { interpretCareCard, SCAN_ALERT_EVENT, toScanAlert } from "./interpret";
import { ELDER_LAYOUTS } from "./layout";
import { ELDER_SAMPLES } from "./samples";

export function ElderCareApp() {
  // Emit an aggregate alert after every successful scan (task 9.6). The Kiro Crew App listens for it.
  const onScan = useCallback((scan: CompletedScan) => {
    if (!scan.result.ok) return;
    const alert = toScanAlert(interpretCareCard(scan.result), scan.result.cardId, scan.scannedAt);
    window.dispatchEvent(new CustomEvent(SCAN_ALERT_EVENT, { detail: alert }));
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
      onScan={onScan}
      renderResult={(scan) => <CareDashboard report={interpretCareCard(scan.result)} scannedAt={scan.scannedAt} />}
    />
  );
}
