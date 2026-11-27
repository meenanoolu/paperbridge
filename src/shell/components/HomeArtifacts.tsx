import { useRef, type CSSProperties } from "react";
import { useRevealOnce } from "../motion/inview";
import { useTilt } from "../motion/pointer";

/**
 * The 3 apps on Skeleton Home as physical objects on a dark drafting table: a metal-clipped
 * clipboard, a ruled composition sheet and an obsidian and gold oracle card. Each is tilted a
 * different way on desktop, has a different size, and is one link (the title) stretched over the
 * whole object. The art is decorative; the title, tag and description carry the meaning.
 */
export interface Artifact {
  id: string;
  title: string;
  /** Small caps line above the title (the app's own name when the title is a game name). */
  eyebrow?: string;
  tag: string;
  description: string;
  /** What the call to action says (decorative: the title is the link). */
  open: string;
}

export const ARTIFACTS: Artifact[] = [
  {
    id: "elder-care",
    title: "Elder Care Bridge",
    tag: "Clinical Care",
    description: "A large-print weekly medication card. One photo gives a caregiver adherence, missed doses and a Doctor Visit PDF.",
    open: "Unclip the clipboard",
  },
  {
    id: "study-bridge",
    title: "Study Bridge",
    tag: "Classroom Studio",
    description: "A screen-free quiz sheet. One photo gives a score, weak topics with review dates and a class gradebook.",
    open: "Open the gradebook",
  },
  {
    id: "seance-cipher",
    title: "Haunted Treasure Hunt",
    eyebrow: "Seance Cipher",
    tag: "Physical Paper Game",
    description: "Hunt a hiding creature through 12 rooms. Mark one room with a pen, take one photo and hear hot or cold. Play alone or with a friend.",
    open: "Draw the oracle card",
  },
];

interface Handlers {
  onHint: (id: string | null) => void;
}

const stretched = "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none";
const ring = "has-[a:focus-visible]:outline-4 has-[a:focus-visible]:outline-offset-8 has-[a:focus-visible]:outline-[#fde047] has-[a:focus-visible]:outline-solid";

function Arrow({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

/** A silver and brass clipboard clip. */
function Clip() {
  return (
    <svg viewBox="0 0 180 64" className="absolute -top-5 left-1/2 z-10 w-44 -translate-x-1/2 drop-shadow-[0_4px_3px_rgba(0,0,0,0.45)]" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="clip-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f5f9" />
          <stop offset="0.5" stopColor="#aeb7c4" />
          <stop offset="1" stopColor="#7b8594" />
        </linearGradient>
        <linearGradient id="clip-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4d77a" />
          <stop offset="1" stopColor="#a67c1c" />
        </linearGradient>
      </defs>
      <rect x="22" y="14" width="136" height="42" rx="9" fill="url(#clip-silver)" stroke="#5b6472" strokeWidth="2" />
      <rect x="44" y="2" width="92" height="26" rx="10" fill="url(#clip-brass)" stroke="#7a5a0e" strokeWidth="2" />
      <rect x="58" y="9" width="64" height="9" rx="4.5" fill="#3b2a07" opacity="0.55" />
      <circle cx="36" cy="35" r="4.5" fill="url(#clip-brass)" stroke="#7a5a0e" />
      <circle cx="144" cy="35" r="4.5" fill="url(#clip-brass)" stroke="#7a5a0e" />
      <path d="M40 48h100" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A week of the Elder Care card in miniature: 4 rows of doses, teal ink, one missed. */
function WeekGrid() {
  const rows = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1],
    [1, 0, 1, 1, 1, 1, 1],
  ];
  return (
    <svg viewBox="0 0 220 94" className="h-24 w-full" aria-hidden="true" focusable="false">
      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
        <text key={i} x={34 + i * 26} y="10" fontSize="10" fontWeight="700" textAnchor="middle" fill="#134E4A" fontFamily="Georgia, serif">
          {d}
        </text>
      ))}
      {rows.map((r, y) =>
        r.map((on, x) => (
          <g key={`${x}-${y}`}>
            <circle cx={34 + x * 26} cy={26 + y * 17} r="6" fill="#FAF6EE" stroke="#134E4A" strokeWidth="1.6" />
            {on === 1 && <circle cx={34 + x * 26} cy={26 + y * 17} r="3.8" fill="#0F766E" opacity="0.92" />}
          </g>
        )),
      )}
    </svg>
  );
}

export function ClipboardArtifact({ a, onHint }: { a: Artifact } & Handlers) {
  return (
    <li
      data-world={a.id}
      data-artifact="clipboard"
      className={`home-artifact m-deal group relative lg:mt-10 ${ring}`}
      style={{ "--tilt": "-1.5deg", "--i": 0, "--d": "150ms" } as CSSProperties}
      onMouseEnter={() => onHint(a.id)}
      onMouseLeave={() => onHint(null)}
      onFocus={() => onHint(a.id)}
      onBlur={() => onHint(null)}
    >
      <div className="relative rounded-[10px] bg-[#8B6B43] px-3 pb-3 pt-10 shadow-[0_30px_50px_-20px_rgba(0,0,0,0.85),inset_0_0_0_2px_rgba(0,0,0,0.25)]">
        <Clip />
        <div
          className="relative flex flex-col gap-3 bg-[#FAF6EE] px-5 pb-5 pt-6 text-[#134E4A]"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, rgba(15,118,110,0.13) 31px 32px)" }}
        >
          <span className="self-start rounded-sm border-2 border-dashed border-[#0F766E] px-3 py-0.5 text-base font-bold text-[#134E4A] [font-family:Georgia,'Times_New_Roman',serif]">{a.tag}</span>
          <WeekGrid />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-4 -rotate-12 rounded-md border-4 border-[#0F766E] px-2 py-0.5 text-lg font-black uppercase leading-tight tracking-widest text-[#0F766E] opacity-90 mix-blend-multiply [font-family:Georgia,'Times_New_Roman',serif]"
          >
            Verified
          </span>
          <h2 className="text-3xl font-bold tracking-tight [font-family:Georgia,'Times_New_Roman',serif]">
            <a href={`#${a.id}`} aria-describedby={`world-${a.id}-desc`} className={stretched} data-no-tactile>
              {a.title}
            </a>
          </h2>
          <p id={`world-${a.id}-desc`} className="text-lg leading-snug text-[#134E4A]">
            {a.description}
          </p>
          <span aria-hidden="true" className="mt-1 inline-flex items-center gap-2 text-lg font-bold underline decoration-[#0F766E] decoration-2 underline-offset-4">
            {a.open}
            <Arrow className="h-5 w-5 transition-transform motion-safe:group-hover:translate-x-1" />
          </span>
        </div>
      </div>
      <span aria-hidden="true" className="tilt-glare rounded-[12px]" />
    </li>
  );
}

/** Topic bars drawn as yellow highlighter strokes, the way a teacher marks a gradebook. */
function Highlights() {
  const rows: [string, number, string][] = [
    ["Fractions", 92, "#fde047"],
    ["Geometry", 74, "#fde047"],
    ["Decimals", 100, "#86efac"],
    ["Ratios", 48, "#fda4af"],
  ];
  return (
    <svg viewBox="0 0 220 86" className="h-[5.4rem] w-full" aria-hidden="true" focusable="false">
      {rows.map(([name, pct, color], i) => (
        <g key={name} transform={`translate(0 ${i * 21})`}>
          <rect x="62" y="3" width={1.45 * pct} height="14" rx="3" fill={color} opacity="0.9" transform="skewX(-8) translate(7 0)" />
          <text x="2" y="14" fontSize="11.5" fontWeight="700" fill="#1e293b" fontFamily="'Segoe Print','Bradley Hand','Comic Sans MS',cursive">
            {name}
          </text>
          <text x="214" y="14" fontSize="11.5" fontWeight="800" textAnchor="end" fill="#1e293b" style={{ fontVariantNumeric: "tabular-nums" }}>
            {pct}%
          </text>
        </g>
      ))}
    </svg>
  );
}

export function CompositionArtifact({ a, onHint }: { a: Artifact } & Handlers) {
  return (
    <li
      data-world={a.id}
      data-artifact="composition"
      className={`home-artifact m-deal group relative lg:mt-2 ${ring}`}
      style={{ "--tilt": "1.2deg", "--i": 1, "--d": "150ms" } as CSSProperties}
      onMouseEnter={() => onHint(a.id)}
      onMouseLeave={() => onHint(null)}
      onFocus={() => onHint(a.id)}
      onBlur={() => onHint(null)}
    >
      <div
        className="relative flex flex-col gap-3 overflow-hidden rounded-[3px] bg-[#FCFBF7] py-6 pl-16 pr-5 text-slate-900 shadow-[0_30px_50px_-20px_rgba(0,0,0,0.85)]"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, #bcd3ec 31px 32px)" }}
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-12 w-[2px] bg-[#d64545]" />
        <span aria-hidden="true" className="absolute inset-y-0 left-[3.4rem] w-[1px] bg-[#d64545]/50" />
        {[18, 50, 82].map((top) => (
          <span key={top} aria-hidden="true" className="absolute left-3 h-5 w-5 rounded-full bg-[#090C14] shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)]" style={{ top: `${top}%` }} />
        ))}
        <span className="self-start rounded-sm bg-[#fde68a] px-3 py-0.5 text-base font-bold text-slate-900 [font-family:'Segoe_Print','Bradley_Hand','Comic_Sans_MS',cursive]">{a.tag}</span>
        <Highlights />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-5 rotate-12 rounded-full border-4 border-[#b91c1c] px-3 py-1 text-3xl font-black leading-none text-[#b91c1c] opacity-90 mix-blend-multiply"
        >
          A+
        </span>
        <h2 className="text-3xl font-black tracking-tight text-slate-950 [font-family:'Segoe_Print','Bradley_Hand','Comic_Sans_MS',cursive]">
          <a href={`#${a.id}`} aria-describedby={`world-${a.id}-desc`} className={stretched} data-no-tactile>
            {a.title}
          </a>
        </h2>
        <p id={`world-${a.id}-desc`} className="text-lg leading-snug text-slate-800">
          {a.description}
        </p>
        <span aria-hidden="true" className="mt-1 inline-flex items-center gap-2 text-lg font-bold text-[#b91c1c]">
          {a.open}
          <Arrow className="h-5 w-5 transition-transform motion-safe:group-hover:translate-x-1" />
        </span>
      </div>
      <span aria-hidden="true" className="tilt-glare rounded-[12px]" />
    </li>
  );
}

/** A gold corner flourish; rotated to the 4 corners. */
function Filigree({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`pointer-events-none absolute h-12 w-12 ${className}`} aria-hidden="true" focusable="false">
      <path d="M3 45V14C3 7 7 3 14 3h31" fill="none" stroke="#D4AF37" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10 45V18c0-5 3-8 8-8h27" fill="none" stroke="#D4AF37" strokeOpacity="0.6" strokeWidth="1.2" />
      <path d="M16 16c4 0 7 3 7 7s-3 7-7 7" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 23h6" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M33 8l3 3-3 3-3-3z" fill="#34d399" />
    </svg>
  );
}

/** The 12 rune circles in 3 rows: one banished (emerald), one trembling (dashed amber), the rest waiting. */
function RuneGrid() {
  return (
    <svg viewBox="0 0 220 96" className="h-24 w-full" aria-hidden="true" focusable="false">
      <defs>
        <filter id="home-oracle-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {Array.from({ length: 12 }, (_, i) => {
        const x = 30 + (i % 4) * 53;
        const y = 18 + Math.floor(i / 4) * 30;
        const lit = i === 5;
        const shaky = i === 2;
        return (
          <g key={i} filter={lit || shaky ? "url(#home-oracle-glow)" : undefined}>
            <circle cx={x} cy={y} r="11" fill="none" stroke={lit ? "#34d399" : shaky ? "#fbbf24" : "#D4AF37"} strokeOpacity={lit || shaky ? 1 : 0.55} strokeWidth={lit || shaky ? 2.6 : 1.6} strokeDasharray={shaky ? "4 3" : undefined} />
            {lit && <circle cx={x} cy={y} r="5" fill="#34d399" />}
          </g>
        );
      })}
    </svg>
  );
}

export function OracleArtifact({ a, onHint }: { a: Artifact } & Handlers) {
  return (
    <li
      data-world={a.id}
      data-artifact="oracle"
      className={`home-artifact m-deal group relative lg:mt-16 ${ring}`}
      style={{ "--tilt": "-1deg", "--i": 2, "--d": "150ms" } as CSSProperties}
      onMouseEnter={() => onHint(a.id)}
      onMouseLeave={() => onHint(null)}
      onFocus={() => onHint(a.id)}
      onBlur={() => onHint(null)}
    >
      <div className="relative flex flex-col gap-3 rounded-[14px] border-2 border-[#D4AF37] bg-[#11131A] px-7 py-8 text-[#F3EBD3] shadow-[0_0_52px_-10px_rgba(52,211,153,0.5),0_30px_50px_-20px_rgba(0,0,0,0.9)]">
        <span aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-[10px] border border-[#D4AF37]/45" />
        <Filigree className="left-1 top-1" />
        <Filigree className="right-1 top-1 rotate-90" />
        <Filigree className="bottom-1 right-1 rotate-180" />
        <Filigree className="bottom-1 left-1 -rotate-90" />
        <span className="self-center rounded-full border border-emerald-300 bg-emerald-400/10 px-4 py-0.5 text-base font-bold text-emerald-200 shadow-[0_0_18px_-2px_rgba(52,211,153,0.75)]">{a.tag}</span>
        <RuneGrid />
        <div className="text-center">
          {a.eyebrow && <p className="text-base font-bold uppercase tracking-[0.3em] text-[#D4AF37]">{a.eyebrow}</p>}
          <h2 className="text-4xl font-semibold tracking-wide text-[#F3EBD3] [font-family:Georgia,'Times_New_Roman',serif]">
            <a href={`#${a.id}`} aria-describedby={`world-${a.id}-desc`} className={stretched} data-no-tactile>
              {a.title}
            </a>
          </h2>
        </div>
        <p id={`world-${a.id}-desc`} className="text-center text-lg leading-snug text-[#D9CFB4]">
          {a.description}
        </p>
        <span aria-hidden="true" className="mx-auto mt-1 inline-flex items-center gap-2 text-lg font-bold text-[#D4AF37]">
          {a.open}
          <Arrow className="h-5 w-5 transition-transform motion-safe:group-hover:translate-x-1" />
        </span>
      </div>
      <span aria-hidden="true" className="tilt-glare rounded-[12px]" />
    </li>
  );
}

/** The artifacts in a deliberately uneven row: different widths, heights and tilts. `ids` limits it to the registered apps. */
export function ArtifactRow({ onHint, ids }: { onHint: (id: string | null) => void; ids: readonly string[] }) {
  const [elder, study, rite] = ARTIFACTS;
  const row = useRef<HTMLUListElement>(null);
  useTilt(row, { selector: ".home-artifact", maxDeg: 6 });
  useRevealOnce(row);
  return (
    <ul ref={row} className="grid items-start gap-10 lg:grid-cols-[1.12fr_1fr_0.94fr] lg:gap-8" aria-label="Apps on the skeleton">
      {ids.includes(elder.id) && <ClipboardArtifact a={elder} onHint={onHint} />}
      {ids.includes(study.id) && <CompositionArtifact a={study} onHint={onHint} />}
      {ids.includes(rite.id) && <OracleArtifact a={rite} onHint={onHint} />}
    </ul>
  );
}
