import { useCallback, useMemo, useState } from "react";
import type { AppMeta } from "../../shell/app-registry";
import { AdaptiveCardPanel } from "../../shell/components/AdaptiveCard";
import { PrintWorkspace } from "../../shell/components/PrintWorkspace";
import {
  BatchDropzone,
  DecodePipeline,
  HumanVerifyControl,
  JudgeDemoStrip,
  OpticalViewToggles,
  OpticalXRayOverlay,
  pipelineSteps,
  ResultVoice,
  ScanSources,
  StressLab,
  useOpticalScan,
  type HumanVerifyTheme,
} from "../../shell/optical";
import { Button, Callout, StatusBadge } from "../../shell/components/ui";
import type { ReviewedScan } from "../../shell/scan";
import { usePersistentState } from "../../shell/usePersistentState";
import { columnLabel, DEFAULT_CARE_SETTINGS, parseCareSettings } from "./card-settings";
import { CareDashboard } from "./components/CareDashboard";
import { CustomizeCardPanel } from "./components/CustomizeCardPanel";
import { HistorySection } from "./components/HistorySection";
import { addWeek, parseHistory, toWeekEntry, weekLabel, type WeekEntry } from "./history";
import { interpretCareCard, SCAN_ALERT_EVENT, toScanAlert, type ScanAlert } from "./interpret";
import { describeCareBubble, ELDER_LAYOUT, ELDER_LAYOUTS } from "./layout";
import type { DoseLabels } from "./patterns";
import { ELDER_SAMPLES } from "./samples";
import { sampleHistory } from "./sample-history";
import { adaptedCardSpec, nextCardMonday } from "./adaptive";
import { elderPrintSlot } from "./print";
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
  // Language, High-Visibility, icons and the 4-week pack live in the shared Print Cards tab; they are saved with the card.
  const printSlot = useMemo(() => elderPrintSlot(card, (next) => saveCard(next)), [card, saveCard]);
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

  const announce = useCallback(
    (scan: ReviewedScan) => {
      const r = interpretCareCard(scan.result, { doseLabels, habitLabel });
      const pct = r.adherencePct === null ? "Adherence unknown" : `${r.adherencePct}% of doses taken`;
      return `${pct}. ${r.alerts.length === 0 ? "No alerts." : `${r.alerts.length} alert${r.alerts.length > 1 ? "s" : ""}, starting with: ${r.alerts[0].title}.`}`;
    },
    [doseLabels, habitLabel],
  );
  const scan = useOpticalScan(ELDER_LAYOUTS, { onScan, announce });
  const describe = (b: { group: string; row: string; col: string }) => describeCareBubble(b, labels);
  const r = scan.reviewed;
  const report = r ? interpretCareCard(r.result, { doseLabels, habitLabel }) : null;
  const adaptive = r && report
    ? adaptedCardSpec(card, report.patterns, nextCardMonday([card.weekStart, ...history.filter((h) => h.patientName === card.patientName).map((h) => h.weekStart ?? "")], r.scannedAt))
    : null;

  return (
    <div className="min-h-[80vh] bg-[#FAF8F5] text-slate-950" data-frontend="elder-care">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#0F766E] pb-4">
          <div>
            <p className="text-lg font-bold uppercase tracking-[0.2em] text-[#134E4A]">Caregiver workspace</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              Elder Care Bridge
            </h1>
            <p className="mt-1 max-w-3xl text-lg text-slate-800">
              A large-print paper card for the week's medicines and symptoms. No smartphone or login for the person filling it in. One photo tells you how the week went.
            </p>
          </div>
          {card.patientName && <p className="rounded-full border-2 border-[#0F766E] px-4 py-1 text-lg font-bold text-[#134E4A]">Card for {card.patientName}</p>}
        </header>

        <p className="sr-only" role="status" aria-live="polite">
          {scan.liveMessage}
        </p>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <section aria-labelledby="elder-card" className="space-y-4 rounded-2xl border border-[#0F766E]/40 bg-white p-5 shadow-[0_1px_0_#0F766E,0_8px_24px_-12px_rgba(15,118,110,0.35)]">
            <h2 id="elder-card" className="text-2xl font-extrabold text-[#134E4A]">
              This week's card
            </h2>
            <ScanSources scan={scan} layouts={ELDER_LAYOUTS} samples={ELDER_SAMPLES} classes={STATIONERY} samplesLabel="Sample cards (no printer needed)" />
            {scan.state.status !== "idle" && <DecodePipeline steps={pipelineSteps(scan.state, Math.max(0, scan.unclear.length - (r?.manualOverrides ?? 0)))} />}
            {scan.state.status === "error" && <Callout tone="bad" title={scan.state.message} />}
            <OpticalViewToggles scan={scan} className={STATIONERY.button} />
            <OpticalXRayOverlay scan={scan} describe={describe} />
          </section>

          <div className="space-y-4">
            <section aria-labelledby="elder-status" className="rounded-2xl border border-[#0F766E]/40 bg-white p-5">
              <h2 id="elder-status" className="text-2xl font-extrabold text-[#134E4A]">
                How the week went
              </h2>
              {!report ? (
                <p className="mt-2 text-lg text-slate-800">Pick a sample card, upload a photo or use the webcam. The answer appears here.</p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <p className="text-6xl font-black tabular-nums">{report.adherencePct === null ? "?" : `${report.adherencePct}%`}</p>
                  <div className="space-y-1 text-lg">
                    <p className="font-bold">
                      {report.taken} of {report.counted} doses taken
                    </p>
                    <StatusBadge tone={report.adherencePct !== null && report.adherencePct >= 80 ? "good" : "bad"}>
                      {report.adherencePct !== null && report.adherencePct >= 80 ? "On track" : "Below the 80% goal"}
                    </StatusBadge>
                    {report.symptomDays.length > 0 && <p>Dizzy or pain on {report.symptomDays.length} {report.symptomDays.length === 1 ? "day" : "days"}</p>}
                  </div>
                </div>
              )}
            </section>
            <HumanVerifyControl unclear={scan.unclear} overrides={scan.overrides} onSet={scan.setAnswer} describe={describe} theme={VERIFY} title="Faint marks to check on the paper" />
            {r && report && (
              <>
                <ResultVoice
                  spoken={elderSpokenSummary(report, card, r.manualOverrides)}
                  share={elderShareText(report, card, r.manualOverrides)}
                  shareLabel="Copy WhatsApp Update"
                />
                <section aria-label="Save and share with the doctor" className="space-y-3 rounded-2xl border border-[#0F766E]/40 bg-white p-4">
                  <SaveWeek
                    key={r.scannedAt.toISOString()}
                    history={history}
                    onSave={saveWeek}
                    entry={toWeekEntry(report, { scannedAt: r.scannedAt, savedAt: new Date(), card, manualOverrides: r.manualOverrides })}
                  />
                  <ThisWeekDoctorPdf card={card} entry={toWeekEntry(report, { scannedAt: r.scannedAt, savedAt: r.scannedAt, card, manualOverrides: r.manualOverrides })} />
                </section>
                {adaptive && <AdaptiveCardPanel spec={adaptive} />}
              </>
            )}
            <PrintWorkspace slot={printSlot} storageKey="elder-care-weekly.print-options" />
            <CustomizeCardPanel settings={card} onSave={saveCard} onReset={resetCard} saved={cardSaved} />
          </div>
        </div>

        <JudgeDemoStrip />
        <BatchDropzone />
        {r && report && <CareDashboard report={report} scannedAt={r.scannedAt} alert={alertFor(r, doseLabels, habitLabel, cardLanguage)} card={card} />}

        <details className="group rounded-2xl border-2 border-[#0F766E]/50 bg-white">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between rounded-2xl px-4 py-3 text-xl font-extrabold text-[#134E4A]">
            History, trend and Doctor Visit PDF
            <span aria-hidden className="motion-safe:transition-transform group-open:rotate-180">&#9662;</span>
          </summary>
          <div className="border-t-2 border-slate-200 p-4">
            <HistorySection history={history} currentPatient={card.patientName} card={card} onClear={clearHistory} onLoadSample={() => setHistory(sampleHistory(new Date()))} />
          </div>
        </details>
        <StressLab layout={ELDER_LAYOUT} filled={STRESS_MARKS.filled} title="Elder Care Bridge" />
      </div>
    </div>
  );
}

/** Warm stationery: deep teal on ivory and white. White on #134E4A is 9.7:1 and #134E4A on white 9.7:1 (AAA). */
const STATIONERY = {
  button: "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-[#134E4A] bg-white px-5 py-3 text-lg font-bold text-[#134E4A] hover:bg-[#F0FDFA] disabled:opacity-60",
  primary: "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-[#134E4A] bg-[#134E4A] px-5 py-3 text-lg font-bold text-white hover:bg-[#0F3F3C]",
  sample: "rounded-xl border-2 border-[#0F766E]/40 bg-[#FAF8F5] p-3 hover:bg-[#F0FDFA]",
  activeSample: "rounded-xl border-2 border-[#134E4A] bg-[#F0FDFA] p-3",
};
const VERIFY: HumanVerifyTheme = {
  row: "border-[#0F766E]/40 bg-white text-slate-950",
  stamp: "border-[#0F766E] text-[#134E4A]",
  button: "border-[#134E4A] bg-white text-[#134E4A] hover:bg-[#F0FDFA]",
};

export const appMeta: AppMeta = {
  id: "elder-care",
  label: "Elder Care Bridge",
  shortLabel: "Elder Care",
  icon: "heart",
  order: 1,
  fullBleed: true,
  layouts: ELDER_LAYOUTS,
  batch: ELDER_BATCH,
  // Calm clinical teal: white text on it is 7.6:1 (AAA).
  accent: { name: "clinical-teal", strong: "#115e59", soft: "#f0fdfa" },
  samples: ELDER_SAMPLES,
  demo: { faint: "missed-dose", clean: "normal-week", batch: "missed-dose" },
  footerNote: "For tracking only; not medical advice. Talk to a doctor or pharmacist before changing any medication.",
};
export default ElderCareApp;
