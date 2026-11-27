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
import { CARE_CSS, Field, LINEN_STYLE, PaperClip } from "./components/CareSheet";
import { CustomizeCardPanel } from "./components/CustomizeCardPanel";
import { SignOffStamp } from "./components/SignOffStamp";
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

  const pending = Math.max(0, scan.unclear.length - (r?.manualOverrides ?? 0));
  return (
    <div className="min-h-[80vh] bg-[#F4EFE6] px-3 py-8 text-slate-950 sm:px-6 sm:py-12" style={LINEN_STYLE} data-frontend="elder-care">
      <style>{CARE_CSS}</style>
      <div className="care-sheet relative mx-auto max-w-4xl space-y-8 bg-[#FAF8F5] px-5 pb-12 pt-14 shadow-[0_1px_0_#e4dac6,0_2px_0_#f0e9db,0_34px_60px_-34px_rgba(70,48,12,0.55)] sm:px-12">
        <PaperClip />
        <header className="space-y-2 text-center">
          <p className="text-lg font-bold uppercase tracking-[0.3em] text-[#134E4A]">Weekly medicine sheet</p>
          <h1 className="text-5xl font-bold tracking-tight text-[#134E4A] sm:text-6xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Elder Care Bridge
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[#134E4A]">
            A large-print paper card for the week's medicines and symptoms. No smartphone or login for the person filling it in. One photo tells you how the week went.
          </p>
          <p className="pt-2 text-xl text-[#134E4A]">
            For: <span className="inline-block min-w-56 border-b-2 border-dotted border-[#134E4A] px-2 font-bold">{card.patientName || "\u00a0"}</span>
          </p>
        </header>

        <p className="sr-only" role="status" aria-live="polite">
          {scan.liveMessage}
        </p>

        <Field n={1} id="elder-card" title="This week's card">
          <ScanSources scan={scan} layouts={ELDER_LAYOUTS} samples={ELDER_SAMPLES} classes={STATIONERY} samplesLabel="Sample cards (no printer needed)" />
          {scan.state.status !== "idle" && <DecodePipeline steps={pipelineSteps(scan.state, pending)} />}
          {scan.state.status === "error" && <Callout tone="bad" title={scan.state.message} />}
          <OpticalViewToggles scan={scan} className={STATIONERY.button} />
          <OpticalXRayOverlay scan={scan} describe={describe} />
        </Field>

        <Field n={2} id="elder-status" title="How the week went">
          {!report ? (
            <p className="text-xl text-[#134E4A]">Pick a sample card, upload a photo or use the webcam. The answer is written here.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <p className="text-7xl font-black tabular-nums text-[#134E4A]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {report.adherencePct === null ? "?" : `${report.adherencePct}%`}
              </p>
              <div className="space-y-1 text-xl">
                <p className="font-bold">
                  {report.taken} of {report.counted} doses taken
                </p>
                <StatusBadge tone={report.adherencePct !== null && report.adherencePct >= 80 ? "good" : "bad"}>
                  {report.adherencePct !== null && report.adherencePct >= 80 ? "On track" : "Below the 80% goal"}
                </StatusBadge>
                {report.symptomDays.length > 0 && (
                  <p>
                    Dizzy or pain on {report.symptomDays.length} {report.symptomDays.length === 1 ? "day" : "days"}
                  </p>
                )}
              </div>
            </div>
          )}
          <HumanVerifyControl unclear={scan.unclear} overrides={scan.overrides} onSet={scan.setAnswer} describe={describe} theme={VERIFY} title="Faint marks to check on the paper" />
          {r && report && <SignOffStamp key={r.scannedAt.toISOString()} pending={pending} when={r.scannedAt} />}
        </Field>

        {r && report && (
          <Field n={3} id="elder-share" title="Share and save">
            <ResultVoice spoken={elderSpokenSummary(report, card, r.manualOverrides)} share={elderShareText(report, card, r.manualOverrides)} shareLabel="Copy WhatsApp Update" />
            <section aria-label="Save and share with the doctor" className="space-y-3 p-4">
              <SaveWeek
                key={r.scannedAt.toISOString()}
                history={history}
                onSave={saveWeek}
                entry={toWeekEntry(report, { scannedAt: r.scannedAt, savedAt: new Date(), card, manualOverrides: r.manualOverrides })}
              />
              <ThisWeekDoctorPdf card={card} entry={toWeekEntry(report, { scannedAt: r.scannedAt, savedAt: r.scannedAt, card, manualOverrides: r.manualOverrides })} />
            </section>
            {adaptive && <AdaptiveCardPanel spec={adaptive} />}
          </Field>
        )}

        <Field n={r && report ? 4 : 3} id="elder-more" title="More ways to scan">
          <JudgeDemoStrip />
          <BatchDropzone />
        </Field>

        {r && report && <CareDashboard report={report} scannedAt={r.scannedAt} alert={alertFor(r, doseLabels, habitLabel, cardLanguage)} card={card} />}

        <details className="group border-t-2 border-dotted border-[#134E4A]/40 pt-4" data-drawer="print">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-1 py-3 text-2xl font-bold text-[#134E4A]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Print the card, languages and presets
            <svg viewBox="0 0 24 24" className="h-5 w-5 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l7 7 7-7" /></svg>
          </summary>
          <div className="space-y-4 pt-3">
            <PrintWorkspace slot={printSlot} storageKey="elder-care-weekly.print-options" />
            <CustomizeCardPanel settings={card} onSave={saveCard} onReset={resetCard} saved={cardSaved} />
          </div>
        </details>

        <details className="group border-t-2 border-dotted border-[#134E4A]/40 pt-4">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-1 py-3 text-2xl font-bold text-[#134E4A]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            History, trend and Doctor Visit PDF
            <svg viewBox="0 0 24 24" className="h-5 w-5 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l7 7 7-7" /></svg>
          </summary>
          <div className="pt-3">
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
