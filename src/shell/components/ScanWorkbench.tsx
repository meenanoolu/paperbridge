import { useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import type { CardLayout } from "../../core";
import { RouteContext } from "../route-context";
import { useOpticalScan } from "../useOpticalScan";
import { pipelineSteps } from "../pipeline";
import { DecodePipeline } from "./DecodePipeline";
import { JudgeDemoStrip } from "./JudgeDemoStrip";
import { RawUnwarpView } from "./RawUnwarpView";
import { AdaptiveCardPanel, type AdaptiveCardSpec } from "./AdaptiveCard";
import { PrintWorkspace } from "./PrintWorkspace";
import { createPrintSlot, type PrintSlot } from "../print-slot";
import { showWorkspaceTab, useWorkspaceTab, type WorkspaceTab } from "../workspace-tabs";
import { AutoRoutePanel } from "./AutoRoutePanel";
import type { ReviewedScan } from "../scan";
import { DecodeFacts } from "./DecodeFacts";
import { Icon, type IconName } from "./Icon";
import { defaultDescribe, ReviewPanel, type DescribeBubble } from "./ReviewPanel";
import { SamplePanel, type SampleCard } from "./SamplePanel";
import { ScanPreview } from "./ScanPreview";
import { StressLab } from "./StressLab";
import { ResultVoice } from "./ResultVoice";
import { playLockOnChime, type SpokenSummary } from "../audio-cues";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { WebcamScanner } from "./WebcamScanner";
import { Button, Callout, Card, StatusBadge } from "./ui";

export interface WorkbenchProps {
  icon: IconName;
  title: string;
  tagline: string;
  /** Accepted print variants of the same card (A4 and Letter). The first is the default. */
  layouts: CardLayout[];
  samples: SampleCard[];
  steps: [string, string][];
  /** App-specific dashboard for a successful scan, with any human overrides applied. */
  renderResult: (scan: ReviewedScan) => ReactNode;
  /** Called after each successful scan and again whenever a person changes an override. */
  onScan?: (scan: ReviewedScan) => void;
  /** One-sentence result read out by screen readers, e.g. "71% of doses taken, 6 alerts". */
  announce?: (scan: ReviewedScan) => string;
  /** Card variants offered for printing. Defaults to `layouts`. Must share `layouts`' bubble geometry. */
  printLayouts?: CardLayout[];
  /** Extra panel in the "use your own card" section of Scan & Verify, e.g. an answer key. */
  setup?: ReactNode;
  /** Extra Print Cards tab content below the shared print controls, e.g. card customization. */
  printTab?: ReactNode;
  /** The shared Print Cards controls (language, High-Visibility, icons, packs). Defaults to `printLayouts` with High-Visibility. */
  print?: PrintSlot;
  /** Optional "next card" built from this scan (e.g. an adapted next-week card or a due review sheet). */
  adaptiveCard?: (scan: ReviewedScan) => AdaptiveCardSpec | null | undefined;
  /** History & Export tab content, e.g. a multi-week trend or a class sheet. */
  historyTab?: ReactNode;
  /** Per-app tab names, e.g. { history: "Class Sheet & Export" }. */
  tabLabels?: Partial<Record<WorkspaceTab, string>>;
  /** Known marks of a sample card, for the "Test Decoder Resilience" drawer. */
  stressTest?: { filled: string[] };
  /** Optional one-paragraph summary for the shell's "Read Aloud" button (offline speechSynthesis). */
  spokenSummary?: (scan: ReviewedScan) => SpokenSummary | null | undefined;
  /** Optional short plain-text update for the shell's "Copy Quick Update" button (SMS, WhatsApp). */
  shareText?: (scan: ReviewedScan) => string | null | undefined;
  /** Plain-language name of a bubble for the review list and screen readers, e.g. "Wednesday water". */
  describeBubble?: DescribeBubble;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Shared page frame: sample panel first, then own-card options, then the decoded result. */
export function ScanWorkbench({
  icon,
  title,
  tagline,
  layouts,
  samples,
  steps,
  renderResult,
  onScan,
  announce,
  describeBubble = defaultDescribe,
  printLayouts,
  setup,
  printTab,
  historyTab,
  tabLabels,
  stressTest,
  spokenSummary,
  shareText,
  print,
  adaptiveCard,
}: WorkbenchProps) {
  const fallbackPrint = useMemo(() => createPrintSlot({ layouts: printLayouts ?? layouts }), [printLayouts, layouts]);
  const tab = useWorkspaceTab();
  const onRoute = useContext(RouteContext);
  const fileInput = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const onNewScan = useCallback(() => {
    // Every new scan is shown on Scan & Verify.
    showWorkspaceTab("scan");
    results.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, []);
  const o = useOpticalScan(layouts, { onScan, announce, onNewScan });
  const { state, reviewed, unclear, overrides, busy, liveMessage, activeSample, setActiveSample, camera, setCamera, xray, setXray, unwarp, setUnwarp, audioCues, setAudioCues } = o;
  const editOverride = o.setAnswer;
  const scanUrl = (src: string, title: string, id: string) => o.pickSample(id, src, title);

  const header = (
    <header className="flex items-start gap-4">
      <span className="on-dark grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--accent,#020617)] text-white">
        <Icon name={icon} className="h-8 w-8" />
      </span>
      <div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-lg text-slate-800">{tagline}</p>
      </div>
    </header>
  );

  const scanPanel = (
    <>
      <JudgeDemoStrip />
      {onRoute && <AutoRoutePanel onRoute={onRoute} />}
      <SamplePanel
        samples={samples}
        activeId={activeSample}
        busy={busy}
        onPick={(s) => scanUrl(s.src, s.title, s.id)}
      />

      <section aria-labelledby="own-card" className="rounded-2xl border-2 border-slate-300 bg-white p-5">
        <h2 id="own-card" className="text-2xl font-extrabold">Or use your own card</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            icon="camera"
            onClick={() => {
              setActiveSample(null);
              setCamera((c) => !c);
            }}
            aria-expanded={camera}
          >
            {camera ? "Hide webcam" : "Scan with webcam"}
          </Button>
          <Button icon="upload" onClick={() => fileInput.current?.click()} disabled={busy}>
            Upload a photo
          </Button>
          <Button icon={audioCues ? "speaker" : "mute"} aria-pressed={audioCues} onClick={() => setAudioCues(!audioCues)} title="A short chime when the webcam locks onto all 4 corners">
            Audio cues
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              o.upload(f);
            }}
          />
          <span className="hidden h-10 w-0.5 bg-slate-300 sm:block" aria-hidden />
          <Button icon="printer" onClick={() => showWorkspaceTab("print")}>
            Need a card? Go to Print Cards
          </Button>
        </div>
        {setup && <div className="mt-4">{setup}</div>}
        {camera && (
          <div className="mt-4">
            <WebcamScanner
              layout={layouts[0]}
              onClose={() => setCamera(false)}
              onLock={() => playLockOnChime(audioCues)}
              onCapture={(frame) => o.scanFrame(frame)}
            />
          </div>
        )}
      </section>

      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
      <div ref={results} aria-busy={busy} className="scroll-mt-4 space-y-6">
        {state.status !== "idle" && <DecodePipeline steps={pipelineSteps(state, Math.max(0, unclear.length - (reviewed?.manualOverrides ?? 0)))} />}
        {state.status === "idle" && (
          <ol className="grid gap-3 sm:grid-cols-4">
            {steps.map(([head, body], i) => (
              <li key={head} className="rounded-2xl border-2 border-dashed border-slate-400 p-4">
                <p className="text-lg font-black uppercase tracking-wider text-slate-700">Step {i + 1}</p>
                <p className="text-xl font-extrabold">{head}</p>
                <p className="text-lg text-slate-800">{body}</p>
              </li>
            ))}
          </ol>
        )}
        {state.status === "busy" && (
          <p className="flex items-center gap-3 rounded-2xl border-2 border-slate-950 bg-white p-5 text-xl font-bold">
            <span className="h-6 w-6 motion-safe:animate-spin rounded-full border-4 border-slate-950 border-t-transparent" aria-hidden />
            Decoding {state.label}...
          </p>
        )}
        {state.status === "error" && <Callout tone="bad" title={state.message} />}
        {state.status === "done" && (
          <>
            {reviewed && reviewed.manualOverrides > 0 && (
              <p className="flex flex-wrap items-center gap-3 text-lg">
                <StatusBadge tone="info">Manually verified ({reviewed.manualOverrides})</StatusBadge>
                <span className="text-slate-800">
                  Results include {reviewed.manualOverrides} {reviewed.manualOverrides === 1 ? "mark" : "marks"} checked by a person. The decoder output below is unchanged.
                </span>
              </p>
            )}
            {reviewed && renderResult(reviewed)}
            {reviewed && adaptiveCard && (() => {
              const spec = adaptiveCard(reviewed);
              return spec ? <AdaptiveCardPanel spec={spec} /> : null;
            })()}
            {reviewed && <ResultVoice spoken={spokenSummary?.(reviewed)} share={shareText?.(reviewed)} />}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card title="What the decoder saw">
                {state.scan.result.ok && (
                  <div className="mb-3 flex flex-wrap gap-3">
                    <Button icon="xray" onClick={() => setXray((x) => !x)}>
                      {xray ? "Hide Optical X-Ray" : "Show Optical X-Ray"}
                    </Button>
                    <Button icon="camera" aria-pressed={unwarp} onClick={() => setUnwarp((u) => !u)}>
                      Raw vs. Unwarped
                    </Button>
                  </div>
                )}
                {unwarp && state.scan.result.ok ? (
                  <RawUnwarpView scan={state.scan} />
                ) : (
                  <ScanPreview scan={state.scan} overrides={overrides} onCycle={editOverride} describe={describeBubble} xray={xray} />
                )}
                <ReviewPanel
                  unclear={unclear}
                  overrides={overrides}
                  describe={describeBubble}
                  onSet={editOverride}
                  onResetAll={o.resetAnswers}
                />
              </Card>
              <Card title="Decode details">
                <DecodeFacts scan={state.scan} manualOverrides={reviewed?.manualOverrides ?? 0} />
                <details className="mt-4">
                  <summary className="cursor-pointer text-lg font-bold underline underline-offset-4">
                    Show raw JSON output
                  </summary>
                  <pre
                    tabIndex={0}
                    aria-label="Raw decoder JSON output"
                    className="mt-2 max-h-96 overflow-auto rounded-lg bg-slate-950 p-3 text-sm text-slate-50"
                  >
                    {JSON.stringify(state.scan.result, null, 2)}
                  </pre>
                </details>
              </Card>
            </div>
          </>
        )}
      </div>
      {stressTest && <StressLab layout={layouts[0]} filled={stressTest.filled} title={title} />}
    </>
  );

  const printPanel = (
    <>
      <PrintWorkspace slot={print ?? fallbackPrint} storageKey={`${layouts[0].id}.print-options`} />
      {printTab}
    </>
  );

  return (
    <div className="space-y-6">
      <WorkspaceTabs
        scope={layouts[0].id}
        active={tab}
        labels={tabLabels}
        intro={header}
        panels={{
          scan: scanPanel,
          print: printPanel,
          history: historyTab ?? <p className="text-lg text-slate-800">Nothing saved yet. Scan a card on Scan &amp; Verify first.</p>,
        }}
      />
    </div>
  );
}