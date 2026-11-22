import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CardLayout } from "../../core";
import { applyManualOverrides, countActiveOverrides, NO_OVERRIDES, setOverride, unclearBubbles, type ManualOverrides } from "../overrides";
import { takeRoutedScan, useRoutedScan } from "../routed-scan";
import { DECODE_ERROR_TEXT, useScanner, type CompletedScan, type ReviewedScan } from "../scan";
import { DecodeFacts } from "./DecodeFacts";
import { Icon, type IconName } from "./Icon";
import { PrintCard } from "./PrintCard";
import { defaultDescribe, ReviewPanel, type DescribeBubble } from "./ReviewPanel";
import { SamplePanel, type SampleCard } from "./SamplePanel";
import { ScanPreview } from "./ScanPreview";
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
  /** Extra panel in the "use your own card" section, e.g. card customization or an answer key. */
  setup?: ReactNode;
  /** Plain-language name of a bubble for the review list and screen readers, e.g. "Wednesday water". */
  describeBubble?: DescribeBubble;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Shared page frame: sample panel first, then own-card options, then the decoded result. */
export function ScanWorkbench({ icon, title, tagline, layouts, samples, steps, renderResult, onScan, announce, describeBubble = defaultDescribe, printLayouts, setup }: WorkbenchProps) {
  const { state, scanUrl, scanFile, scanFrame, loadScan } = useScanner(layouts);
  const routed = useRoutedScan();
  useEffect(() => {
    const scan = routed && takeRoutedScan(layouts.map((l) => l.id));
    if (!scan) return;
    setCamera(false);
    setActiveSample(null);
    loadScan(scan);
  }, [routed, layouts, loadScan]);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const lastScrolled = useRef<CompletedScan | null>(null);
  // Overrides belong to one scan: a new scan starts with none, so there is no reset race.
  const [review, setReview] = useState<{ scan: CompletedScan | null; overrides: ManualOverrides }>({ scan: null, overrides: NO_OVERRIDES });

  const scan = state.status === "done" ? state.scan : null;
  const overrides = review.scan === scan ? review.overrides : NO_OVERRIDES;
  const reviewed = useMemo<ReviewedScan | null>(() => {
    if (!scan || !scan.result.ok) return null;
    return {
      ...scan,
      rawResult: scan.result,
      result: applyManualOverrides(scan.result, overrides),
      overrides,
      manualOverrides: countActiveOverrides(scan.result, overrides),
    };
  }, [scan, overrides]);
  const unclear = useMemo(() => (scan ? unclearBubbles(scan.result) : []), [scan]);
  const editOverride = (key: string, value: Parameters<typeof setOverride>[2]) =>
    setReview((r) => ({ scan, overrides: setOverride(r.scan === scan ? r.overrides : NO_OVERRIDES, key, value) }));

  useEffect(() => {
    if (!scan || lastScrolled.current === scan) return;
    lastScrolled.current = scan;
    results.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, [scan]);

  useEffect(() => {
    if (reviewed) onScan?.(reviewed);
  }, [reviewed, onScan]);

  const busy = state.status === "busy";
  const liveMessage =
    state.status === "busy"
      ? `Decoding ${state.label}.`
      : state.status === "error"
        ? state.message
        : state.status === "done"
          ? reviewed
            ? `${reviewed.manualOverrides > 0 ? `Updated. Manually verified (${reviewed.manualOverrides}).` : `Scanned ${reviewed.label}.`} ${announce?.(reviewed) ?? ""}`
            : !state.scan.result.ok
              ? `Scan failed. ${DECODE_ERROR_TEXT[state.scan.result.reason].title}.`
              : ""
          : "";

  return (
    <div className="space-y-8">
      <header className="flex items-start gap-4">
        <span className="on-dark grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-slate-950 text-yellow-300">
          <Icon name={icon} className="h-9 w-9" />
        </span>
        <div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-xl text-slate-800">{tagline}</p>
        </div>
      </header>

      <SamplePanel
        samples={samples}
        activeId={activeSample}
        busy={busy}
        onPick={(s) => {
          setCamera(false);
          setActiveSample(s.id);
          void scanUrl(s.src, s.title);
        }}
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
              setCamera(false);
              setActiveSample(null);
              void scanFile(f);
            }}
          />
          <span className="hidden h-10 w-0.5 bg-slate-300 sm:block" aria-hidden />
          <PrintCard layouts={printLayouts ?? layouts} />
        </div>
        {setup && <div className="mt-4">{setup}</div>}
        {camera && (
          <div className="mt-4">
            <WebcamScanner
              layout={layouts[0]}
              onClose={() => setCamera(false)}
              onCapture={(frame) => {
                setCamera(false);
                scanFrame(frame);
              }}
            />
          </div>
        )}
      </section>

      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
      <div ref={results} aria-busy={busy} className="scroll-mt-4 space-y-6">
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
        {busy && (
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card title="What the decoder saw">
                <ScanPreview scan={state.scan} overrides={overrides} onCycle={editOverride} describe={describeBubble} />
                <ReviewPanel
                  unclear={unclear}
                  overrides={overrides}
                  describe={describeBubble}
                  onSet={editOverride}
                  onResetAll={() => setReview({ scan, overrides: NO_OVERRIDES })}
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
    </div>
  );
}
