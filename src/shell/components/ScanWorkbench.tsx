import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CardLayout, SuccessfulScan } from "../../core";
import { useScanner, type CompletedScan } from "../scan";
import { DecodeFacts } from "./DecodeFacts";
import { Icon, type IconName } from "./Icon";
import { PrintCard } from "./PrintCard";
import { SamplePanel, type SampleCard } from "./SamplePanel";
import { ScanPreview } from "./ScanPreview";
import { WebcamScanner } from "./WebcamScanner";
import { Button, Callout, Card } from "./ui";

export interface WorkbenchProps {
  icon: IconName;
  title: string;
  tagline: string;
  /** Accepted print variants of the same card (A4 and Letter). The first is the default. */
  layouts: CardLayout[];
  samples: SampleCard[];
  steps: [string, string][];
  /** App-specific dashboard for a successful scan. */
  renderResult: (scan: CompletedScan & { result: SuccessfulScan }) => ReactNode;
  /** Called once per completed scan, e.g. to emit alerts. */
  onScan?: (scan: CompletedScan) => void;
}

/** Shared page frame: sample panel first, then own-card options, then the decoded result. */
export function ScanWorkbench({ icon, title, tagline, layouts, samples, steps, renderResult, onScan }: WorkbenchProps) {
  const { state, scanUrl, scanFile, scanFrame } = useScanner(layouts);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const lastReported = useRef<CompletedScan | null>(null);

  useEffect(() => {
    if (state.status !== "done" || lastReported.current === state.scan) return;
    lastReported.current = state.scan;
    onScan?.(state.scan);
    results.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state, onScan]);

  const busy = state.status === "busy";

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
          <PrintCard layouts={layouts} />
        </div>
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

      <div ref={results} aria-live="polite" aria-busy={busy} className="scroll-mt-4 space-y-6">
        {state.status === "idle" && (
          <ol className="grid gap-3 sm:grid-cols-4">
            {steps.map(([head, body], i) => (
              <li key={head} className="rounded-2xl border-2 border-dashed border-slate-400 p-4">
                <p className="text-sm font-black uppercase tracking-wider text-slate-700">Step {i + 1}</p>
                <p className="text-xl font-extrabold">{head}</p>
                <p className="text-base text-slate-800">{body}</p>
              </li>
            ))}
          </ol>
        )}
        {busy && (
          <p className="flex items-center gap-3 rounded-2xl border-2 border-slate-950 bg-white p-5 text-xl font-bold">
            <span className="h-6 w-6 animate-spin rounded-full border-4 border-slate-950 border-t-transparent" aria-hidden />
            Decoding {state.label}...
          </p>
        )}
        {state.status === "error" && <Callout tone="bad" title={state.message} />}
        {state.status === "done" && (
          <>
            {state.scan.result.ok && renderResult(state.scan as CompletedScan & { result: SuccessfulScan })}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card title="What the decoder saw">
                <ScanPreview scan={state.scan} />
              </Card>
              <Card title="Decode details">
                <DecodeFacts scan={state.scan} />
                <details className="mt-4">
                  <summary className="cursor-pointer text-lg font-bold underline underline-offset-4">
                    Show raw JSON output
                  </summary>
                  <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-slate-950 p-3 text-sm text-slate-50">
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
