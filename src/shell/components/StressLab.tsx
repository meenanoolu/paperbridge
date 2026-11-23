import { useEffect, useId, useRef, useState } from "react";
import type { CardLayout } from "../../core";
import { runStressTest, TILT_LIMIT_DEG, type StressRun, type StressSettings } from "../stress-lab";
import { Icon } from "./Icon";
import { StatusBadge } from "./ui";

const DEBOUNCE_MS = 250;
const START: StressSettings = { tiltDeg: 0, dim: 0, faint: 0 };

function Slider({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-lg font-bold">
          {label}
        </label>
        <output htmlFor={id} className="text-lg font-extrabold tabular-nums">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={`${id}-hint`}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-10 w-full cursor-pointer accent-slate-950"
      />
      <p id={`${id}-hint`} className="text-lg text-slate-800">
        {hint}
      </p>
    </div>
  );
}

/**
 * "Test Decoder Resilience": a collapsed drawer with 3 sliders. On change (debounced) it renders
 * the sample card with known marks, distorts it, and runs the real decoder in this browser.
 * Nothing is uploaded; the card here is a synthetic render (corner markers, ID strip, bubbles).
 */
export function StressLab({ layout, filled, title }: { layout: CardLayout; filled: string[]; title: string }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<StressSettings>(START);
  const [run, setRun] = useState<StressRun | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setRun(runStressTest(layout, filled, settings)), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [open, layout, filled, settings]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !run) return;
    c.width = run.raster.width;
    c.height = run.raster.height;
    c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(run.raster.data), run.raster.width, run.raster.height), 0, 0);
  }, [run]);

  const c = run?.counts;
  const summary = !run
    ? "Decoding..."
    : !run.result.ok
      ? `Could not read the card (${run.result.reason}). Nothing was guessed.`
      : `${c!.correct} of ${c!.total} bubbles read correctly, ${c!.unclear} sent for a human check, ${c!.falseFilled + c!.missed} wrong. Decoded in ${Math.round(run.decodeMs)} ms on this device.`;

  return (
    <details className="group rounded-2xl border-2 border-slate-950 bg-white" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-xl font-extrabold">
        <span className="flex items-center gap-3">
          <Icon name="gauge" className="h-7 w-7" />
          Test Decoder Resilience
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 shrink-0 motion-safe:transition-transform group-open:rotate-180">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      {open && (
        <div className="grid gap-6 border-t-2 border-slate-200 p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            <p className="text-lg text-slate-800">
              Distort the {title} sample card and watch the real decoder read it, here in your browser. Its marks are known, so
              every bubble is scored. Tilt and shadow do not change the answer; very faint marks are sent to a person, never
              guessed.
            </p>
            <Slider
              id={`${uid}-tilt`}
              label="Tilt angle"
              hint={`Rotate the card from -${TILT_LIMIT_DEG} to +${TILT_LIMIT_DEG} degrees.`}
              min={-TILT_LIMIT_DEG}
              max={TILT_LIMIT_DEG}
              step={1}
              value={settings.tiltDeg}
              format={(v) => `${v > 0 ? "+" : ""}${v} degrees`}
              onChange={(tiltDeg) => setSettings((s) => ({ ...s, tiltDeg }))}
            />
            <Slider
              id={`${uid}-dim`}
              label="Dim lighting and shadow"
              hint="Down to half brightness, with uneven light and a soft shadow."
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.dim * 100)}
              format={(v) => `${v}%`}
              onChange={(v) => setSettings((s) => ({ ...s, dim: v / 100 }))}
            />
            <Slider
              id={`${uid}-faint`}
              label="Pen faintness"
              hint="From a dark pen to a very light mark."
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.faint * 100)}
              format={(v) => `${v}%`}
              onChange={(v) => setSettings((s) => ({ ...s, faint: v / 100 }))}
            />
            <div role="status" aria-live="polite" className="space-y-2">
              <p className="text-lg font-bold">{summary}</p>
              {c && (
                <p className="flex flex-wrap gap-2">
                  <StatusBadge tone="good">{c.correct} correct</StatusBadge>
                  <StatusBadge tone="warn">{c.unclear} unclear</StatusBadge>
                  <StatusBadge tone={c.falseFilled + c.missed ? "bad" : "good"}>{c.falseFilled + c.missed} wrong</StatusBadge>
                </p>
              )}
            </div>
          </div>
          <figure>
            <canvas ref={canvas} className="w-full rounded-lg border-2 border-slate-400 bg-white" aria-label="The distorted card the decoder just read" role="img" />
            <figcaption className="mt-2 text-lg text-slate-800">The distorted sample card, as the decoder saw it.</figcaption>
          </figure>
        </div>
      )}
    </details>
  );
}
