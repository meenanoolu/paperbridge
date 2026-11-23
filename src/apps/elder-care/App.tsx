import { useCallback, useMemo, useState } from "react";
import type { AppMeta } from "../../shell/app-registry";
import { ScanWorkbench } from "../../shell/components/ScanWorkbench";
import { Button } from "../../shell/components/ui";
import type { ReviewedScan } from "../../shell/scan";
import { usePersistentState } from "../../shell/usePersistentState";
import { columnLabel, customizedElderLayouts, DEFAULT_CARE_SETTINGS, parseCareSettings } from "./card-settings";
import { CareDashboard } from "./components/CareDashboard";
import { CustomizeCardPanel } from "./components/CustomizeCardPanel";
import { HistorySection } from "./components/HistorySection";
import { addWeek, parseHistory, toWeekEntry, weekLabel, type WeekEntry } from "./history";
import { interpretCareCard, SCAN_ALERT_EVENT, toScanAlert, type ScanAlert } from "./interpret";
import { describeCareBubble, ELDER_LAYOUTS } from "./layout";
import type { DoseLabels } from "./patterns";
import { ELDER_SAMPLES } from "./samples";
import { sampleHistory } from "./sample-history";
import { nextCardMonday } from "./adaptive";
import { AdaptedCardButton } from "./components/AdaptedCardButton";
import { ThisWeekDoctorPdf } from "./components/ThisWeekDoctorPdf";
import { ELDER_SAMPLE_SPECS } from "./samples/specs";
import { alertCardLanguage, elderShareText, elderSpokenSummary } from "./voice";

/** The Missed-Dose sample's pen marks (dark ones), for the Test Decoder Resilience drawer. */
const STRESS_MARKS = { filled: ELDER_SAMPLE_SPECS[1].marks.filter((m) => m.style !== "faint").map((m) => m.key) };

/** The alert for a reviewed scan: human overrides applied, with their count recorded. */
export function alertFor(scan: ReviewedScan, doseLabels?: DoseLabels, habitLabel?: string, cardLanguage?: string): ScanAlert {
  return toScanAlert(interpretCareCard(scan.result, { doseLabels, habitLabel }), scan.result.cardId, scan.scannedAt, scan.manualOverrides, cardLanguage);
}

import { CARE_SETTINGS_KEY, HISTORY_KEY } from "./storage-keys";
import { ELDER_BATCH } from "./batch";
export { CARE_SETTINGS_KEY, HISTORY_KEY };
const NO_WEEKS: WeekEntry[] = [];

function SaveWeek({ entry, history, onSave }: { entry: WeekEntry; history: WeekEntry[]; onSave: (e: WeekEntry) => void }) {
  const [message, setMessage] = useState("");
  const existing = history.find((h) => h.id === entry.id);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="primary"
        icon="calendar"
        onClick={() => {
          onSave(entry);
          setMessage(`${existing ? "Updated" : "Saved"} ${weekLabel(entry)}${entry.patientName ? ` for ${entry.patientName}` : ""}. See the trend below.`);
        }}
      >
        {existing ? "Update saved week" : "Save Week to History"}
      </Button>
      <span role="status" aria-live="polite" className="text-lg font-bold text-green-900">
        {message}
      </span>
      {!entry.weekStart && !message && (
        <span className="text-lg text-slate-800">Tip: set the week in Customize Card so weeks line up in the trend.</span>
      )}
    </div>
  );
}

export function ElderCareApp() {
  const [card, saveCard, resetCard, cardSaved] = usePersistentState(CARE_SETTINGS_KEY, parseCareSettings, DEFAULT_CARE_SETTINGS);
  const [history, setHistory, clearHistory] = usePersistentState(HISTORY_KEY, parseHistory, NO_WEEKS);
  const saveWeek = useCallback((e: WeekEntry) => setHistory(addWeek(history, e).list), [history, setHistory]);
  const printLayouts = useMemo(() => customizedElderLayouts(card), [card]);
  const doseLabels = useMemo<DoseLabels>(() => ({ Morning: columnLabel(card, "am"), Night: columnLabel(card, "pm") }), [card]);
  const habitLabel = columnLabel(card, "water");
  const labels = useMemo(
    () => ({ am: columnLabel(card, "am"), pm: columnLabel(card, "pm"), water: columnLabel(card, "water"), dizzy: columnLabel(card, "dizzy") }),
    [card],
  );

  // Emit an aggregate alert after every scan and after every manual override (task 9.6).
  // The Kiro Crew App dedupes by card + scan time, so a corrected alert replaces the earlier one.
  const cardLanguage = alertCardLanguage(card);
  const onScan = useCallback((scan: ReviewedScan) => {
    window.dispatchEvent(new CustomEvent(SCAN_ALERT_EVENT, { detail: alertFor(scan, doseLabels, habitLabel, cardLanguage) }));
  }, [doseLabels, habitLabel, cardLanguage]);

  return (
    <>
      <ScanWorkbench
        icon="heart"
        title="Elder Care Bridge"
        tagline="A large-print weekly paper card for medication and symptoms. No smartphone or login for the person filling it in. Caregivers get adherence, missed doses, and symptom flags from one photo."
        layouts={ELDER_LAYOUTS}
        printLayouts={printLayouts}
        printTab={<CustomizeCardPanel settings={card} onSave={saveCard} onReset={resetCard} saved={cardSaved} defaultOpen />}
        historyTab={
          <HistorySection history={history} currentPatient={card.patientName} card={card} onClear={clearHistory} onLoadSample={() => setHistory(sampleHistory(new Date()))} />
        }
        stressTest={STRESS_MARKS}
        spokenSummary={(scan) => elderSpokenSummary(interpretCareCard(scan.result, { doseLabels, habitLabel }), card, scan.manualOverrides)}
        shareText={(scan) => elderShareText(interpretCareCard(scan.result, { doseLabels, habitLabel }), card, scan.manualOverrides)}
        samples={ELDER_SAMPLES}
        steps={[
          ["Print", "One page, bold large print, A4 or US Letter."],
          ["Fill in", "Each day, fill circles with a dark pen."],
          ["Scan", "Webcam or photo upload at the end of the week."],
          ["Review", "Adherence, missed doses, and symptom alerts."],
        ]}
        describeBubble={(b) => describeCareBubble(b, labels)}
        onScan={onScan}
        announce={(scan) => {
          const r = interpretCareCard(scan.result, { doseLabels, habitLabel });
          const pct = r.adherencePct === null ? "Adherence unknown" : `${r.adherencePct}% of doses taken`;
          return `${pct}. ${r.alerts.length === 0 ? "No alerts." : `${r.alerts.length} alert${r.alerts.length > 1 ? "s" : ""}, starting with: ${r.alerts[0].title}.`}`;
        }}
        renderResult={(scan) => {
          const report = interpretCareCard(scan.result, { doseLabels, habitLabel });
          return (
            <CareDashboard
              report={report}
              scannedAt={scan.scannedAt}
              alert={alertFor(scan, doseLabels, habitLabel, cardLanguage)}
              card={card}
              adapt={
                <AdaptedCardButton
                  card={card}
                  patterns={report.patterns}
                  weekStart={nextCardMonday([card.weekStart, ...history.filter((h) => h.patientName === card.patientName).map((h) => h.weekStart ?? "")], scan.scannedAt)}
                />
              }
              actions={
                <div className="space-y-3">
                  <SaveWeek
                    key={scan.scannedAt.toISOString()}
                    history={history}
                    onSave={saveWeek}
                    entry={toWeekEntry(report, { scannedAt: scan.scannedAt, savedAt: new Date(), card, manualOverrides: scan.manualOverrides })}
                  />
                  <ThisWeekDoctorPdf card={card} entry={toWeekEntry(report, { scannedAt: scan.scannedAt, savedAt: scan.scannedAt, card, manualOverrides: scan.manualOverrides })} />
                </div>
              }
            />
          );
        }}
      />
    </>
  );
}

export const appMeta: AppMeta = {
  id: "elder-care",
  label: "Elder Care Bridge",
  icon: "heart",
  order: 1,
  layouts: ELDER_LAYOUTS,
  batch: ELDER_BATCH,
  // Calm clinical teal: white text on it is 7.6:1 (AAA).
  accent: { name: "clinical-teal", strong: "#115e59", soft: "#f0fdfa" },
  samples: ELDER_SAMPLES,
  demo: { faint: "missed-dose", clean: "normal-week", batch: "missed-dose" },
  footerNote: "For tracking only; not medical advice. Talk to a doctor or pharmacist before changing any medication.",
};
export default ElderCareApp;
