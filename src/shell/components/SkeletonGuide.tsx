import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { APPS } from "../app-registry";
import { dialogKey, FOCUSABLE } from "../dialog";
import { Icon } from "./Icon";

const REPO = "https://github.com/meenanoolu/paperbridge/tree/main";

function Layer({ title, path, children, tone }: { title: string; path: string; children: ReactNode; tone: string }) {
  return (
    <div className={`rounded-xl border-2 border-slate-950 p-3 ${tone}`}>
      <p className="text-lg font-extrabold">
        {title}{" "}
        <a href={`${REPO}/${path}`} target="_blank" rel="noreferrer" className="font-mono text-lg font-bold underline underline-offset-4">
          {path}
        </a>
      </p>
      <div className="text-lg">{children}</div>
    </div>
  );
}

const Down = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v15m-6-6l6 6 6-6" />
  </svg>
);

/** Body of the dialog: the shared engine, the apps on it, the next app, and the Kiro Crew handoff. */
export function SkeletonDiagram() {
  return (
    <div className="space-y-3">
      <ol className="space-y-3" aria-label="Layers, from the apps down to the engine">
        <li>
          <Layer title="Apps (thin):" path="src/apps" tone="bg-white">
            <ul className="mt-1 flex flex-wrap gap-2">
              {APPS.map((a) => (
                <li key={a.id} className="rounded-lg border-2 px-2 py-0.5 font-bold" style={{ borderColor: a.accent?.strong ?? "#020617" }}>
                  {a.label}
                </li>
              ))}
              <li className="rounded-lg border-2 border-dashed border-slate-950 px-2 py-0.5 font-bold">Next app: npm run create-app</li>
            </ul>
            <p className="mt-1">Each app is a layout (the printed card), a pure interpreter (marks to report) and a page.</p>
          </Layer>
        </li>
        <li aria-hidden className="flex justify-center">
          <Down />
        </li>
        <li>
          <Layer title="Shared shell:" path="src/shell" tone="bg-slate-100">
            3 tabs, Scan Any Card routing and batch save, samples, webcam, review of unclear marks, Optical X-Ray, Read Aloud,
            storage, offline PWA.
          </Layer>
        </li>
        <li aria-hidden className="flex justify-center">
          <Down />
        </li>
        <li>
          <Layer title="Optical core:" path="src/core" tone="bg-yellow-100">
            Card PDF/SVG from one layout object, 4 corner markers, perspective unwarp, local thresholds, card-ID strip. Pure and
            deterministic: same pixels, same answer, no AI.
          </Layer>
        </li>
      </ol>
      <div className="grid gap-3 sm:grid-cols-2">
        <Layer title="Your next app in one command:" path="scripts/create-app.mjs" tone="bg-white">
          <code className="font-mono">npm run create-app clinic-intake "Clinic Intake"</code> writes a card, an interpreter, tests and a
          page that already routes, batch-saves and reads aloud.
        </Layer>
        <Layer title="Kiro Crew handoff:" path="crew-app" tone="bg-white">
          Copy for Kiro Crew sends aggregate alert JSON (no images, no names). The care-auditor agent drafts the check-in.
        </Layer>
      </div>
    </div>
  );
}

const GUIDE_BUTTON =
  "inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-white/80 px-4 py-1.5 text-lg font-bold text-white hover:bg-slate-800";

/** Header button + accessible modal dialog explaining the architecture. `label` and `className` restyle the trigger only. */
export function SkeletonGuide({ label = "How Skeleton Works", className = GUIDE_BUTTON }: { label?: ReactNode; className?: string } = {}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const d = dialog.current;
    d?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      const items = d ? [...d.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
      const action = dialogKey(e.key, e.shiftKey, items.indexOf(document.activeElement as HTMLElement), items.length);
      if (!action) return;
      e.preventDefault();
      if (action.kind === "close") setOpen(false);
      else items[action.index]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger.current?.focus(); // focus returns to the button that opened it
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={className}
      >
        <Icon name="sparkle" className="h-5 w-5" />
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-title`}
            aria-describedby={`${uid}-desc`}
            className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border-4 border-slate-950 bg-white p-5 text-slate-950 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={`${uid}-title`} className="text-3xl font-black">
                How Skeleton Works
              </h2>
              <button
                type="button"
                data-autofocus
                onClick={() => setOpen(false)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-slate-950 px-4 py-2 text-lg font-bold hover:bg-slate-100"
              >
                <Icon name="cross" />
                Close
              </button>
            </div>
            <p id={`${uid}-desc`} className="mb-4 mt-1 text-lg text-slate-800">
              One offline optical engine, one shared UI, many thin paper apps. Press Escape to close.
            </p>
            <SkeletonDiagram />
          </div>
        </div>
      )}
    </>
  );
}
