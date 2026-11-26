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

/* ---------- World portal previews (decorative; the card text carries the meaning) ---------- */

function ElderPreview() {
  return (
    <svg viewBox="0 0 240 110" aria-hidden className="h-28 w-full">
      <rect x="1" y="1" width="238" height="108" rx="14" fill="#FFFFFF" stroke="#0F766E" strokeWidth="1.5" />
      <g transform="rotate(-24 70 55)">
        <rect x="30" y="38" width="80" height="34" rx="17" fill="#CCFBF1" stroke="#134E4A" strokeWidth="2.5" />
        <path d="M70 38h23a17 17 0 0 1 0 34H70z" fill="#0F766E" />
      </g>
      <circle cx="172" cy="55" r="30" fill="#134E4A" />
      <path d="M158 56l10 10 20-22" fill="none" stroke="#FAF8F5" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <circle key={i} cx={128 + i * 15} cy="96" r="5" fill={i === 4 ? "#FFFFFF" : "#0F766E"} stroke="#134E4A" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function StudyPreview() {
  const bars = [
    ["Fractions", 92, "#3730A3"],
    ["Geometry", 74, "#3730A3"],
    ["Decimals", 100, "#047857"],
    ["Ratios", 48, "#3730A3"],
  ] as const;
  return (
    <svg viewBox="0 0 240 110" aria-hidden className="h-28 w-full">
      <rect x="1" y="1" width="238" height="108" rx="14" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      {bars.map(([name, pct, color], i) => (
        <g key={name} transform={`translate(14 ${16 + i * 23})`}>
          <text x="0" y="11" fontSize="11" fontWeight="700" fill="#334155">
            {name}
          </text>
          <rect x="66" y="2" width="130" height="11" rx="5.5" fill="#E2E8F0" />
          <rect x="66" y="2" width={1.3 * pct} height="11" rx="5.5" fill={color} />
          <text x="204" y="11" fontSize="11" fontWeight="800" fill="#1E1B4B" style={{ fontVariantNumeric: "tabular-nums" }}>
            {pct}%
          </text>
        </g>
      ))}
    </svg>
  );
}

function SeancePreview() {
  const runes = [
    { c: "#34D399", d: "M-6-9a10 10 0 1 0 0 18a7 7 0 0 1 0-18z" },
    { c: "#34D399", d: "M-11 0q11-11 22 0q-11 11-22 0zM0-3a3 3 0 1 0 0.1 0z" },
    { c: "#FBBF24", d: "M-3-10a5 5 0 1 0 0.1 0zM0 0v11M0 6h5M0 10h4" },
    { c: "#34D399", d: "M0-11c5 6 8 9 8 13a8 8 0 0 1-16 0c0-4 3-6 4-10c2 3 2 5 4 6c0-4 0-6 0-9z" },
  ];
  return (
    <svg viewBox="0 0 240 110" aria-hidden className="h-28 w-full">
      <defs>
        <filter id="home-rune-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="1" y="1" width="238" height="108" rx="14" fill="#0B0D12" stroke="#D4AF37" strokeWidth="1" />
      {runes.map((r, i) => (
        <g key={i} transform={`translate(${36 + i * 56} 55)`} filter="url(#home-rune-glow)">
          <circle r="21" fill="none" stroke={r.c} strokeWidth="2.5" />
          <path d={r.d} fill="none" stroke={r.c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}

interface World {
  id: string;
  title: string;
  pill: string;
  description: string;
  Preview: () => ReactNode;
  card: string;
  pillClass: string;
  titleClass: string;
  textClass: string;
  enterClass: string;
}

const WORLDS: World[] = [
  {
    id: "elder-care",
    title: "Elder Care Bridge",
    pill: "Clinical Care",
    description: "A large-print weekly medication card. One photo gives a caregiver adherence, missed doses and a Doctor Visit PDF.",
    Preview: ElderPreview,
    card: "border-2 border-[#0F766E] bg-[#FAF8F5] shadow-[0_24px_60px_-20px_rgba(20,184,166,0.55)]",
    pillClass: "bg-[#0F766E] text-white",
    titleClass: "text-[#134E4A]",
    textClass: "text-[#134E4A]",
    enterClass: "text-[#134E4A]",
  },
  {
    id: "study-bridge",
    title: "Study Bridge",
    pill: "Classroom Studio",
    description: "A screen-free quiz sheet. One photo gives a score, weak topics with review dates and a class gradebook.",
    Preview: StudyPreview,
    card: "border-2 border-[#3730A3] bg-[#F8FAFC] shadow-[0_24px_60px_-20px_rgba(99,102,241,0.6)]",
    pillClass: "bg-[#3730A3] text-white",
    titleClass: "text-slate-950",
    textClass: "text-slate-700",
    enterClass: "text-[#3730A3]",
  },
  {
    id: "seance-cipher",
    title: "Seance Cipher",
    pill: "Physical Paper Game",
    description: "A haunted paper mystery. Mark one rune per question, scan it, and the runes glow and tell a story.",
    Preview: SeancePreview,
    card: "border-2 border-[#D4AF37] bg-[#11131A] shadow-[0_24px_60px_-18px_rgba(212,175,55,0.5)]",
    pillClass: "border border-emerald-300 bg-emerald-400/15 text-emerald-200 shadow-[0_0_18px_-2px_rgba(52,211,153,0.75)]",
    titleClass: "text-[#F3EBD3] [font-family:Georgia,'Times_New_Roman',serif]",
    textClass: "text-[#D9CFB4]",
    enterClass: "text-[#D4AF37]",
  },
];

/**
 * One world portal. The title is the link (so its name matches what it says), stretched over the
 * whole card; the card draws the 4 px focus ring while the link has focus.
 */
function WorldPortal({ world }: { world: World }) {
  const { Preview } = world;
  return (
    <li
      data-world={world.id}
      className={`group relative flex flex-col gap-4 rounded-3xl p-6 transition-transform motion-safe:hover:-translate-y-1.5 has-[a:focus-visible]:outline-4 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-[#fde047] has-[a:focus-visible]:outline-solid ${world.card}`}
    >
      <span className={`self-start rounded-full px-4 py-1 text-base font-bold ${world.pillClass}`}>{world.pill}</span>
      <Preview />
      <h2 className={`text-3xl font-black tracking-tight ${world.titleClass}`}>
        <a href={`#${world.id}`} aria-describedby={`world-${world.id}-desc`} className="after:absolute after:inset-0 after:rounded-3xl after:content-[''] focus-visible:outline-none">
          {world.title}
        </a>
      </h2>
      <p id={`world-${world.id}-desc`} className={`text-lg leading-snug ${world.textClass}`}>
        {world.description}
      </p>
      <span aria-hidden className={`mt-auto inline-flex items-center gap-2 text-lg font-black ${world.enterClass}`}>
        Enter world
        <svg viewBox="0 0 24 24" className="h-6 w-6 transition-transform motion-safe:group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12h15M13 6l6 6-6 6" />
        </svg>
      </span>
    </li>
  );
}

/** Midnight blueprint: a faint optical grid with a soft glow at the top. */
const STAGE: CSSProperties = {
  backgroundColor: "#0B1120",
  backgroundImage:
    "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56,189,248,0.16), transparent 70%), linear-gradient(rgba(148,163,184,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.09) 1px, transparent 1px)",
  backgroundSize: "100% 100%, 44px 44px, 44px 44px",
};

/** A printed-card corner marker, as decoration on the stage corners. */
function Fiducial({ className }: { className: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute hidden h-9 w-9 border-[5px] border-slate-500/50 sm:block ${className}`}>
      <span className="absolute inset-[6px] bg-slate-500/50" />
    </span>
  );
}

/** The default landing view: a full-viewport stage with the 3 worlds and the mixed-domain demo. */
export function SkeletonHome() {
  const onRoute = useContext(RouteContext);
  const worlds = WORLDS.filter((w) => APPS.some((a) => a.id === w.id));
  return (
    <>
      <section aria-labelledby="home-title" className="on-dark relative min-h-[calc(100svh-4.5rem)] overflow-hidden text-white" style={STAGE}>
        <Fiducial className="left-5 top-5" />
        <Fiducial className="right-5 top-5" />
        <Fiducial className="bottom-5 left-5" />
        <Fiducial className="bottom-5 right-5" />
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-14 sm:px-8 sm:py-20">
          <header className="mx-auto max-w-4xl text-center">
            <p className="text-base font-bold uppercase tracking-[0.3em] text-sky-300">PaperBridge Skeleton</p>
            <h1 id="home-title" className="mt-4 text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              One Optical Engine. Three Distinct Worlds.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-xl leading-relaxed text-slate-300">
              Offline-first deterministic paper scanning across healthcare, classrooms, and physical puzzle games.
            </p>
          </header>
          <ul className="grid gap-6 lg:grid-cols-3" aria-label="Apps on the skeleton">
            {worlds.map((w) => (
              <WorldPortal key={w.id} world={w} />
            ))}
          </ul>
          <MixedBatchShowcase
            secondary={
              <SkeletonGuide
                className={GHOST}
                label={
                  <span>
                    Scaffold Your Next App (<code className="font-mono">npm run create-app</code>)
                  </span>
                }
              />
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
