import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { rasterFromUrl, type RasterImage } from "../../core";
import { APPS, DEFAULT_ACCENT, routableApps } from "../app-registry";
import { batchSummary, processBatch, type BatchItem, type BatchRun } from "../batch";
import { demoBatchSources, judgeScenarios, type DemoRef } from "../judge-demo";
import { RouteContext } from "../route-context";
import { offerRoutedScan } from "../routed-scan";
import { useSessionState } from "../session-state";
import { unwarpRaster } from "../unwarp";
import { xrayModel } from "../xray";
import { AutoRoutePanel } from "./AutoRoutePanel";
import { Icon } from "./Icon";
import { Button, StatusBadge } from "./ui";
import { XRayOverlay } from "./XRayOverlay";

const REPO = "https://github.com/meenanoolu/paperbridge";

/** What every app gets from the skeleton, listed on the Scaffold Your Next App card. */
export const INHERITED = [
  "Scan Any Card auto-route and batch save",
  "Optical X-Ray and Raw vs. Unwarped",
  "Audio lock-on chime for the webcam",
  "Read Aloud and Copy Quick Update",
  "Translate card with any-script PDF text",
  "High-Visibility and Icon-Anchored print",
  "Multi-sheet PDF packs",
  "Offline PWA, saved cards, accessible 3-tab workspace",
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

/** "Mixed Batch (Elder Care + Study Bridge)": one click, one engine, two domains. */
export function MixedBatchShowcase() {
  const onRoute = useContext(RouteContext);
  const refs = useMemo(() => judgeScenarios(APPS).find((s) => s.id === "batch")?.refs ?? [], []);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useSessionState<{ run: BatchRun; rasters: RasterImage[] } | null>("home.mixed-batch", null);
  const [error, setError] = useState("");
  if (refs.length < 2) return null;
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
  const shown: Shown[] = run ? run.run.items.flatMap((item, i) => (item.result ? [{ ref: refs[i], item, raster: run.rasters[i] }] : [])) : [];
  return (
    <section aria-labelledby="home-mixed" className="rounded-3xl border-4 border-slate-950 bg-yellow-200 p-5 shadow-[6px_6px_0_0_#0f172a] sm:p-7">
      <h2 id="home-mixed" className="text-3xl font-black tracking-tight">
        One engine, two domains, one click
      </h2>
      <p className="mt-1 text-lg">
        A real Elder Care card photo and a real Study Bridge quiz photo go through Scan Any Card together. The same offline decoder finds
        the 4 corners, unwarps each card, reads every bubble and routes each one to its own app.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" icon="upload" onClick={() => void go()} disabled={busy}>
          {busy ? "Decoding..." : "Run Mixed Batch (Elder Care + Study Bridge)"}
        </Button>
        <p role="status" aria-live="polite" className="text-lg font-bold">
          {error || (run ? batchSummary(run.run) : "")}
        </p>
      </div>
      {shown.length > 0 && (
        <ul className="mt-4 grid gap-4 lg:grid-cols-2" aria-label="Decoded cards">
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
      )}
    </section>
  );
}

function DomainCard({ title, accent, outcome, href, cta, children }: { title: string; accent: string; outcome: string; href: string; cta: string; children?: ReactNode }) {
  return (
    <li className="flex flex-col rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-sm" style={{ borderTopColor: accent, borderTopWidth: 10 }}>
      <h3 className="text-2xl font-extrabold">{title}</h3>
      <p className="mt-1 text-lg">{outcome}</p>
      {children}
      <a
        href={href}
        className="mt-auto inline-flex min-h-14 items-center justify-center gap-2 self-start rounded-xl border-2 border-slate-950 px-5 py-3 text-lg font-bold hover:bg-slate-100"
        style={{ boxShadow: `inset 0 -5px 0 0 ${accent}` }}
        {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {cta}
      </a>
    </li>
  );
}

/** The default landing view: the mixed-batch demo and the 3 domains on one skeleton. */
export function SkeletonHome() {
  const onRoute = useContext(RouteContext);
  const elder = APPS.find((a) => a.id === "elder-care");
  const study = APPS.find((a) => a.id === "study-bridge");
  const seance = APPS.find((a) => a.id === "seance-cipher");
  return (
    <div className="space-y-8">
      <header className="flex items-start gap-4">
        <span className="on-dark grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-950 text-yellow-300">
          <Icon name="sparkle" className="h-8 w-8" />
        </span>
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Skeleton Home</h1>
          <p className="mt-1 max-w-3xl text-lg text-slate-800">
            Reliable paper forms, read by one offline optical engine. No AI guessing: unclear marks go to a person. Pick a demo, or open an app.
          </p>
        </div>
      </header>
      <MixedBatchShowcase />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Apps on the skeleton">
        {elder && (
          <DomainCard title="Elder Care Bridge" accent={elder.accent?.strong ?? DEFAULT_ACCENT.strong} outcome="A large-print weekly medication card. One photo gives a caregiver adherence, missed doses, patterns and a Doctor Visit PDF." href={`#${elder.id}`} cta="Open Elder Care" />
        )}
        {study && (
          <DomainCard title="Study Bridge" accent={study.accent?.strong ?? DEFAULT_ACCENT.strong} outcome="A screen-free quiz sheet. One photo gives a score, weak topics with review dates, and a class gradebook." href={`#${study.id}`} cta="Open Study Bridge" />
        )}
        {seance && (
          <DomainCard title="Seance Cipher" accent={seance.accent?.strong ?? DEFAULT_ACCENT.strong} outcome="A Kiroween paper mystery. Mark one rune per question, scan the card, and the runes glow, lock on and tell a story." href={`#${seance.id}`} cta="Open Seance Cipher" />
        )}
        <DomainCard title="Scaffold Your Next App" accent={DEFAULT_ACCENT.strong} outcome="One command writes a new paper app on the same skeleton." href={`${REPO}/blob/main/docs/BUILD-YOUR-OWN-APP.md`} cta="Read the guide">
          <pre tabIndex={0} aria-label="Command to create your next app" className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-lg text-white">
            <code>npm run create-app clinic-intake "Clinic Intake"</code>
          </pre>
          <p className="mt-3 text-lg font-bold">It inherits:</p>
          <ul className="mb-4 list-disc pl-6 text-lg">
            {INHERITED.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </DomainCard>
      </ul>
      {onRoute && <AutoRoutePanel onRoute={onRoute} />}
    </div>
  );
}
