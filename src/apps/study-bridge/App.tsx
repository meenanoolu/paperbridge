import { useCallback, useMemo, useState } from "react";
import type { AppMeta } from "../../shell/app-registry";
import { AdaptiveCardPanel } from "../../shell/components/AdaptiveCard";
import { PrintWorkspace } from "../../shell/components/PrintWorkspace";
import { Callout } from "../../shell/components/ui";
import { WorkspaceTabs } from "../../shell/components/WorkspaceTabs";
import type { ReviewedScan } from "../../shell/scan";
import { showWorkspaceTab, useWorkspaceTab } from "../../shell/workspace-tabs";
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
import { Telemetry, TopicMastery } from "./components/Studio";
import { usePersistentState } from "../../shell/usePersistentState";
import { DEFAULT_EDITABLE_KEY, parseEditableKey, toAnswerKey } from "./answer-key";
import { addStudent, parseClassSheet, removeStudent, toClassEntry, type ClassEntry } from "./class-sheet";
import { AddToClass, ClassSection } from "./components/ClassSheet";
import { EditKeyPanel } from "./components/EditKeyPanel";
import { StudyResults } from "./components/StudyResults";
import { gradeSheet, readMarks } from "./grade";
import { describeAnswerBubble, STUDY_LAYOUT, STUDY_LAYOUTS } from "./layout";
import { STUDY_SAMPLES } from "./samples";
import { STUDY_SAMPLE_SPECS } from "./samples/specs";
import { dueReviewSpec } from "./due-review";
import { STUDY_PRINT } from "./print";
import { studyShareText, studySpokenSummary } from "./voice";

/** A sample sheet's marks, for the Test Decoder Resilience drawer. */
const STRESS_MARKS = { filled: STUDY_SAMPLE_SPECS[0].marks.filter((m) => m.style !== "faint").map((m) => m.key) };

import { ANSWER_KEY_STORAGE, CLASS_STORAGE } from "./storage-keys";
import { STUDY_BATCH } from "./batch";
export { ANSWER_KEY_STORAGE, CLASS_STORAGE };
const NO_STUDENTS: ClassEntry[] = [];

export function StudyBridgeApp() {
  const [editableKey, saveKey, resetKey, keySaved] = usePersistentState(ANSWER_KEY_STORAGE, parseEditableKey, DEFAULT_EDITABLE_KEY);
  const [roster, setRoster, clearRoster] = usePersistentState(CLASS_STORAGE, parseClassSheet, NO_STUDENTS);
  const answerKey = useMemo(() => toAnswerKey(editableKey), [editableKey]);
  const [hasScan, setHasScan] = useState(false);
  const onScan = useCallback(() => setHasScan(true), []);
  const announce = useCallback(
    (scan: ReviewedScan) => {
      const g = gradeSheet(scan.result, answerKey, scan.scannedAt);
      return `Score ${g.scorePct}%, ${g.correct} of ${g.total} correct. ${g.weakTopics.length ? `Weak topics: ${g.weakTopics.join(", ")}.` : "No weak topics."}`;
    },
    [answerKey],
  );
  const onNewScan = useCallback(() => showWorkspaceTab("scan"), []);
  const scan = useOpticalScan(STUDY_LAYOUTS, { onScan, announce, onNewScan });
  const tab = useWorkspaceTab();
  const r = scan.reviewed;
  const g = r ? gradeSheet(r.result, answerKey, r.scannedAt) : null;
  const due = g ? dueReviewSpec(g) : null;

  const live = (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="studio-scan" className="space-y-4 rounded-2xl border border-slate-300 bg-white p-5">
          <h2 id="studio-scan" className="text-2xl font-extrabold">
            Scan a sheet
          </h2>
          <ScanSources scan={scan} layouts={STUDY_LAYOUTS} samples={STUDY_SAMPLES} classes={STUDIO} samplesLabel="Sample sheets (no printer needed)" />
          {scan.state.status !== "idle" && <DecodePipeline steps={pipelineSteps(scan.state, Math.max(0, scan.unclear.length - (r?.manualOverrides ?? 0)))} />}
          {scan.state.status === "error" && <Callout tone="bad" title={scan.state.message} />}
          <OpticalViewToggles scan={scan} className={STUDIO.button} />
          <OpticalXRayOverlay scan={scan} describe={describeAnswerBubble} />
          <HumanVerifyControl unclear={scan.unclear} overrides={scan.overrides} onSet={scan.setAnswer} describe={describeAnswerBubble} theme={VERIFY} title="Unclear answers to check" />
        </section>
        <div className="space-y-4">
          <TopicMastery report={g} />
          {r && g && (
            <>
              <ResultVoice spoken={studySpokenSummary(g)} share={studyShareText(g)} shareLabel="Copy Parent Update" />
              {due && <AdaptiveCardPanel spec={due} />}
              <AddToClass
                key={r.scannedAt.toISOString()}
                roster={roster}
                onAdd={(student) => setRoster(addStudent(roster, toClassEntry(student, readMarks(r.result), r.scannedAt, new Date())).list)}
              />
            </>
          )}
        </div>
      </div>
      <JudgeDemoStrip />
      <BatchDropzone />
      {g && (
        <details className="rounded-2xl border border-slate-300 bg-white p-4">
          <summary className="cursor-pointer text-xl font-extrabold">Question by question</summary>
          <div className="mt-4">
            <StudyResults report={g} quiz={answerKey} />
          </div>
        </details>
      )}
      <StressLab layout={STUDY_LAYOUT} filled={STRESS_MARKS.filled} title="Study Bridge" />
    </>
  );

  return (
    <div className="min-h-[80vh] bg-[#F1F5F9] text-slate-950" data-frontend="study-bridge">
      <div className="bg-[#3730A3] text-white on-dark">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-lg font-bold uppercase tracking-[0.25em] text-indigo-100">Live classroom studio</p>
            <h1 className="text-4xl font-black tracking-tight">Study Bridge</h1>
          </div>
          <p className="max-w-xl text-lg text-indigo-50">Screen-free quizzes on paper. One photo grades a sheet, charts every topic and schedules review.</p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <Telemetry
          items={[
            { label: "Score", value: g ? `${g.scorePct}%` : "--", tone: g && g.scorePct >= 70 ? "emerald" : "indigo" },
            { label: "Correct", value: g ? `${g.correct}/${g.total}` : "--" },
            { label: "Weak topics", value: g ? String(g.weakTopics.length) : "--", tone: "indigo" },
            { label: "Class sheet", value: String(roster.length) },
            { label: "Decode", value: scan.scan ? `${Math.max(1, Math.round(scan.scan.decodeMs))} ms` : "--", tone: "emerald" },
          ]}
        />
        <p className="sr-only" role="status" aria-live="polite">
          {scan.liveMessage}
        </p>
        <WorkspaceTabs
          scope="study-mcq-10"
          active={tab}
          labels={{ scan: "Live Scan", print: "Print Studio", history: "Gradebook" }}
          panels={{
            scan: live,
            print: (
              <>
                <PrintWorkspace slot={STUDY_PRINT} storageKey="study-mcq-10.print-options" />
                <EditKeyPanel answerKey={editableKey} onSave={saveKey} onReset={resetKey} saved={keySaved} hasScan={hasScan} />
              </>
            ),
            history: <ClassSection roster={roster} answerKey={answerKey} onRemove={(id) => setRoster(removeStudent(roster, id))} onClear={clearRoster} />,
          }}
        />
      </div>
    </div>
  );
}

/** Electric indigo on white: 10.4:1. Emerald (#047857) is used for "mastered" bars and numbers. */
const STUDIO = {
  button: "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-[#3730A3] bg-white px-5 py-3 text-lg font-bold text-[#3730A3] hover:bg-indigo-50 disabled:opacity-60",
  primary: "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-[#3730A3] bg-[#3730A3] px-5 py-3 text-lg font-bold text-white hover:bg-[#312e81]",
  sample: "rounded-xl border-2 border-slate-300 bg-white p-3 hover:bg-indigo-50",
  activeSample: "rounded-xl border-2 border-[#3730A3] bg-indigo-50 p-3",
};
const VERIFY: HumanVerifyTheme = {
  row: "border-slate-300 bg-white text-slate-950",
  stamp: "border-[#047857] text-[#065f46]",
  button: "border-[#3730A3] bg-white text-[#3730A3] hover:bg-indigo-50",
};

export const appMeta: AppMeta = {
  id: "study-bridge",
  label: "Study Bridge",
  icon: "book",
  order: 2,
  fullBleed: true,
  layouts: STUDY_LAYOUTS,
  batch: STUDY_BATCH,
  // Crisp academic indigo: white text on it is 8.6:1.
  accent: { name: "academic-indigo", strong: "#3730a3", soft: "#eef2ff" },
  samples: STUDY_SAMPLES,
  demo: { batch: "sam-review" },
};
export default StudyBridgeApp;
