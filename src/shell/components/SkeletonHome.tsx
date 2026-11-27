import { useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { rasterFromUrl, type RasterImage } from "../../core";
import { APPS, DEFAULT_ACCENT, routableApps, type AppMeta } from "../app-registry";
import { batchSummary, processBatch, type BatchItem, type BatchRun } from "../batch";
import { demoBatchSources, type DemoRef } from "../judge-demo";
import { RouteContext } from "../route-context";
import { offerRoutedScan } from "../routed-scan";
import { useSessionState } from "../session-state";
import { unwarpRaster } from "../unwarp";
import { xrayModel } from "../xray";
import { AutoRoutePanel } from "./AutoRoutePanel";
import { Icon } from "./Icon";
import { SkeletonGuide } from "./SkeletonGuide";
import { Button, StatusBadge } from "./ui";
import { ArtifactRow } from "./HomeArtifacts";
import { DriftingGhosts, GhostGuide, HOME_CSS } from "./HomeGhosts";
import { XRayOverlay } from "./XRayOverlay";

/** What every app gets from the skeleton, listed on the Scaffold Your Next App card. */
export const INHERITED = [
  "Scan Any Card auto-route and batch save",
  "Optical X-Ray and Raw vs. Unwarped",
  "Audio lock-on chime for the webcam",
  "Read Aloud and Copy Quick Update",
  "Translate card with any-script PDF text",
  "High-Visibility and Icon-Anchored print",
  "Multi-sheet PDF packs",
  "Offline PWA, saved cards, accessible workspace",
];

interface Shown {
  ref: DemoRef;
  item: BatchItem;
  raster: RasterImage;
}

/** The unwarped card on a canvas (display only). */
function Flat({ shown }: { shown: Shown }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!shown.item.result || !shown.item.layout || !c.current) return;
    const flat = unwarpRaster(shown.raster, shown.item.result, shown.item.layout, 2);
    if (!flat) return;
    c.current.width = flat.width;
    c.current.height = flat.height;
    c.current.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(flat.data), flat.width, flat.height), 0, 0);
  }, [shown]);
  return <canvas ref={c} role="img" aria-label={`${shown.ref.sample.title} after optical unwarping`} className="block w-full rounded-lg border-2 border-slate-400 bg-white" />;
}

/** One decoded card of the mixed batch: X-Ray on the photo, the unwarped card, and its app. */
function ShowcaseCard({ shown, onOpen }: { shown: Shown; onOpen: () => void }) {
  const app = APPS.find((a) => a.id === shown.item.appId);
  const accent = app?.accent ?? DEFAULT_ACCENT;
  const model = shown.item.result && shown.item.layout ? xrayModel(shown.item.result, shown.item.layout) : null;
  return (
    <li className="rounded-2xl border-2 border-slate-300 bg-white p-4" style={{ borderTopColor: accent.strong, borderTopWidth: 8 }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-extrabold">{shown.ref.sample.title}</p>
        {shown.item.status === "ready" ? <StatusBadge tone="good">Ready</StatusBadge> : <StatusBadge tone="warn">{`${shown.item.unclear} unclear`}</StatusBadge>}
      </div>
      <p className="text-lg">
        Routed to <strong>{shown.item.appLabel}</strong> by its card ID, in {Math.max(1, Math.round(shown.item.decodeMs))} ms.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <figure>
          <div className="relative overflow-hidden rounded-lg border-2 border-slate-400 bg-slate-800">
            <img src={shown.ref.sample.src} alt={`${shown.ref.sample.title}: photo with the Optical X-Ray`} className="block w-full" />
            {model && <XRayOverlay model={model} width={shown.raster.width} height={shown.raster.height} />}
          </div>
          <figcaption className="mt-1 text-lg font-bold">X-Ray</figcaption>
        </figure>
        <figure>
          <Flat shown={shown} />
          <figcaption className="mt-1 text-lg font-bold">Unwarped</figcaption>
        </figure>
      </div>
      {app && (
        <Button className="mt-3" icon={app.icon} onClick={onOpen}>
          {`Open in ${app.shortLabel ?? app.label}`}
        </Button>
      )}
    </li>
  );
}

/**
 * One sample card per app for the mixed-domain demo: the app's declared `demo.batch` sample, else
 * its first sample with a photo. Pure, so the choice is unit tested.
 */
export function mixedDomainRefs(apps: Pick<AppMeta, "id" | "label" | "samples" | "demo">[]): DemoRef[] {
  return apps.flatMap((a) => {
    const sample = a.samples?.find((s) => s.id === a.demo?.batch && s.src) ?? a.samples?.find((s) => s.src);
    return sample ? [{ appId: a.id, appLabel: a.label, sample }] : [];
  });
}

export const DEMO_LABEL = "Run Mixed-Domain Auto-Route Demo";

/** Focus rings on the dark stage are yellow (`.on-dark`), 4 px, from index.css. */
const CTA =
  "inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-amber-400 px-7 py-3 text-lg font-black text-slate-950 shadow-[0_10px_40px_-8px_rgba(251,191,36,0.7)] transition-[background-color] hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70";
const GHOST =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-slate-300 bg-transparent px-7 py-3 text-lg font-bold text-white transition-[background-color,border-color] hover:border-white hover:bg-white/10";

/** The mixed-domain demo: one click sends a real card from every app through Scan Any Card. */
export function MixedBatchShowcase({ secondary }: { secondary?: ReactNode }) {
  const onRoute = useContext(RouteContext);
  const refs = useMemo(() => mixedDomainRefs(APPS), []);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useSessionState<{ run: BatchRun; rasters: RasterImage[] } | null>("home.mixed-batch", null);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      const rasters = await Promise.all(refs.map((r) => rasterFromUrl(r.sample.src)));
      const result = await processBatch(
        demoBatchSources(refs, async (r) => rasters[refs.indexOf(r)]),
        routableApps(),
      );
      setRun({ run: result, rasters });
    } catch {
      setError("The sample photos could not be loaded.");
    } finally {
      setBusy(false);
    }
  };
  const shown: Shown[] = run ? run.run.items.flatMap((item, i) => (item.result && refs[i] ? [{ ref: refs[i], item, raster: run.rasters[i] }] : [])) : [];
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {refs.length >= 2 && (
            <button type="button" className={CTA} onClick={() => void go()} disabled={busy}>
              <Icon name="upload" />
              {busy ? "Decoding..." : DEMO_LABEL}
            </button>
          )}
          {secondary}
        </div>
        <p role="status" aria-live="polite" className="min-h-7 text-center text-lg font-bold text-slate-100">
          {error || (run ? batchSummary(run.run) : "")}
        </p>
      </div>
      {shown.length > 0 && (
        <section
          id="home-mixed-drawer"
          aria-labelledby="home-mixed"
          className="rounded-3xl border border-slate-600 bg-slate-900/90 p-5 shadow-2xl sm:p-7"
        >
          <h2 id="home-mixed" className="text-2xl font-black tracking-tight text-white">
            {`One engine, ${shown.length} domains, one click`}
          </h2>
          <p className="mt-1 text-lg text-slate-300">
            The same offline decoder found the 4 corners, unwarped each card, read every bubble and routed each one to its own app by its printed card ID.
          </p>
          <ul className="mt-4 grid gap-4 text-slate-950 lg:grid-cols-3" aria-label="Decoded cards">
            {shown.map((s) => (
              <ShowcaseCard
                key={s.item.index}
                shown={s}
                onOpen={() => {
                  const app = routableApps().find((a) => a.id === s.item.appId);
                  if (!app || !s.item.result || !s.item.layout || !onRoute) return;
                  offerRoutedScan(
                    {
                      source: "sample",
                      label: s.ref.sample.title,
                      imageUrl: s.ref.sample.src,
                      width: s.raster.width,
                      height: s.raster.height,
                      result: s.item.result,
                      layout: s.item.layout,
                      decodeMs: s.item.decodeMs,
                      scannedAt: new Date(),
                    },
                    { xray: true },
                  );
                  onRoute(app);
                }}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The haunted drafting table: near-black desk, a warm lamp glow at the top and a faint pencil grid. */
const STAGE: CSSProperties = {
  backgroundColor: "#090C14",
  backgroundImage:
    "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(251,191,36,0.10), transparent 70%), radial-gradient(ellipse 120% 80% at 50% 120%, rgba(0,0,0,0.55), transparent 60%), linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
  backgroundSize: "100% 100%, 100% 100%, 44px 44px, 44px 44px",
};

/** A printed-card corner marker, as decoration on the stage corners. */
function Fiducial({ className }: { className: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute hidden h-9 w-9 border-[5px] border-slate-500/50 sm:block ${className}`}>
      <span className="absolute inset-[6px] bg-slate-500/50" />
    </span>
  );
}

/** The default landing view: the haunted drafting table with its 3 paper artifacts and the mixed-domain demo. */
export function SkeletonHome() {
  const onRoute = useContext(RouteContext);
  const [hint, setHint] = useState<string | null>(null);
  const ids = APPS.map((a) => a.id);
  return (
    <>
      <style>{HOME_CSS}</style>
      <section aria-labelledby="home-title" className="on-dark relative min-h-[calc(100svh-4.5rem)] overflow-hidden text-white" style={STAGE}>
        <DriftingGhosts />
        <Fiducial className="left-5 top-5" />
        <Fiducial className="right-5 top-5" />
        <Fiducial className="bottom-5 left-5" />
        <Fiducial className="bottom-5 right-5" />
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 px-4 py-14 sm:px-8 sm:py-16">
          <header className="mx-auto max-w-4xl text-center">
            <p className="text-base font-bold uppercase tracking-[0.3em] text-amber-200">PaperBridge Skeleton</p>
            <h1 id="home-title" className="mt-4 text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              One Optical Engine. Three Distinct Worlds.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-xl leading-relaxed text-slate-300">
              Offline-first deterministic paper scanning across healthcare, classrooms, and physical puzzle games.
            </p>
          </header>
          <GhostGuide hint={hint} />
          <ArtifactRow ids={ids} onHint={setHint} />
          <MixedBatchShowcase
            secondary={
              <span onMouseEnter={() => setHint("scaffold")} onMouseLeave={() => setHint(null)} onFocus={() => setHint("scaffold")} onBlur={() => setHint(null)}>
                <SkeletonGuide
                  className={GHOST}
                  label={
                    <span>
                      Scaffold Your Next App (<code className="font-mono">npm run create-app</code>)
                    </span>
                  }
                />
              </span>
            }
          />
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-lg font-bold text-slate-200">Every world inherits from the skeleton:</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="What every app inherits">
              {INHERITED.map((i) => (
                <li key={i} className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1 text-base text-slate-200">
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      {onRoute && (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <AutoRoutePanel onRoute={onRoute} />
        </div>
      )}
    </>
  );
}
