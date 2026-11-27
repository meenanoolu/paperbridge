import type { CSSProperties } from "react";

/**
 * The haunted drafting table's ghosts: a few translucent ones that drift across the desk, and one
 * friendly guide with a speech bubble. Everything is SVG and CSS transforms (cheap to animate),
 * decorative (`aria-hidden`), and switched off for `prefers-reduced-motion: reduce`: the ghosts
 * then rest in fixed spots and the guide stops floating.
 */
export const HOME_CSS = `
@keyframes home-drift { from { transform: translateX(-24vw); } to { transform: translateX(124vw); } }
@keyframes home-bob { from { transform: translateY(-12px) rotate(-3deg); } to { transform: translateY(12px) rotate(3deg); } }
@keyframes home-float { from { transform: translateY(0); } to { transform: translateY(-9px); } }
.home-ghost { position: absolute; left: 0; animation: home-drift var(--drift, 60s) linear infinite; animation-delay: var(--delay, 0s); will-change: transform; }
.home-ghost > svg { animation: home-bob var(--bob, 6s) ease-in-out infinite alternate; animation-delay: var(--delay, 0s); }
.home-guide { animation: home-float 2.6s ease-in-out infinite alternate; }
.home-artifact { transform: rotate(0deg); transition: transform .25s ease; }
@media (min-width: 1024px) {
  .home-artifact { transform: rotate(var(--tilt, 0deg)); }
  .home-artifact:hover, .home-artifact:has(a:focus-visible) { transform: rotate(0deg) translateY(-8px) scale(1.015); z-index: 5; }
}
@media (prefers-reduced-motion: reduce) {
  .home-ghost, .home-ghost > svg, .home-guide { animation: none; }
  .home-ghost { transform: translateX(var(--rest, 20vw)); }
  .home-artifact { transition: none; }
  .home-artifact:hover, .home-artifact:has(a:focus-visible) { transform: rotate(var(--tilt, 0deg)); }
}
`;

/** A ghost: a dome, a ragged hem, two eyes and an open mouth. `tone` is the body colour. */
export function GhostShape({ className = "h-16 w-16", happy = false }: { className?: string; happy?: boolean }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true" focusable="false">
      <path
        d="M6 70V32C6 15 17 4 32 4s26 11 26 28v38l-6.5-6.5L45 70l-6.5-6.5L32 70l-6.5-6.5L19 70l-6.5-6.5z"
        fill="currentColor"
      />
      <ellipse cx="23" cy="30" rx="4.4" ry="6" fill="#090C14" />
      <ellipse cx="41" cy="30" rx="4.4" ry="6" fill="#090C14" />
      {happy ? (
        <>
          <path d="M23 43c3 6 15 6 18 0" fill="none" stroke="#090C14" strokeWidth="3.2" strokeLinecap="round" />
          <ellipse cx="15" cy="40" rx="4" ry="2.6" fill="#f9a8d4" opacity="0.85" />
          <ellipse cx="49" cy="40" rx="4" ry="2.6" fill="#f9a8d4" opacity="0.85" />
        </>
      ) : (
        <ellipse cx="32" cy="46" rx="4.2" ry="5.5" fill="#090C14" />
      )}
    </svg>
  );
}

interface Drifter {
  top: string;
  size: string;
  opacity: number;
  drift: string;
  bob: string;
  delay: string;
  rest: string;
}

/** Five ghosts at different heights, sizes and speeds. Negative delays start them mid-flight. */
export const DRIFTERS: Drifter[] = [
  { top: "9%", size: "h-14 w-14", opacity: 0.16, drift: "52s", bob: "5.5s", delay: "-8s", rest: "62vw" },
  { top: "27%", size: "h-24 w-24", opacity: 0.1, drift: "78s", bob: "7.5s", delay: "-40s", rest: "8vw" },
  { top: "49%", size: "h-16 w-16", opacity: 0.14, drift: "61s", bob: "6s", delay: "-22s", rest: "84vw" },
  { top: "68%", size: "h-32 w-32", opacity: 0.08, drift: "94s", bob: "8.5s", delay: "-63s", rest: "30vw" },
  { top: "86%", size: "h-12 w-12", opacity: 0.18, drift: "47s", bob: "5s", delay: "-30s", rest: "72vw" },
];

export function DriftingGhosts() {
  return (
    <div aria-hidden="true" data-ghosts="drifting" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {DRIFTERS.map((g, i) => (
        <div
          key={i}
          className="home-ghost text-slate-100"
          style={{ top: g.top, opacity: g.opacity, "--drift": g.drift, "--bob": g.bob, "--delay": g.delay, "--rest": g.rest } as CSSProperties}
        >
          <GhostShape className={g.size} />
        </div>
      ))}
    </div>
  );
}

/** What the guide says, by app (or by nothing in particular). Plain, playful and short. */
export const GUIDE_HINTS: Record<string, string> = {
  default: "Boo! Point at a paper, or tab to one, and I will tell you what lives in it.",
  "elder-care": "Pills, naps and dizzy days on one sheet. Spooky? No. Just lots of checkmarks.",
  "study-bridge": "A quiz on paper, graded by one photo. I never peek at the answers. Well, once.",
  "seance-cipher": "Cover each glowing rune before the clock runs out. Careful: shaky hands make us ghosts giggle.",
  scaffold: "Want a fourth paper? One command builds it. I will haunt it for free.",
};

export const hintFor = (id: string | null): string => (id && GUIDE_HINTS[id]) || GUIDE_HINTS.default;

/** The friendly floating guide: a smiling ghost and a paper speech bubble. */
export function GhostGuide({ hint }: { hint: string | null }) {
  const text = hintFor(hint);
  return (
    <div className="mx-auto flex max-w-3xl items-center justify-center gap-3" data-guide={hint ?? "default"}>
      <div className="home-guide shrink-0 text-slate-50 drop-shadow-[0_0_18px_rgba(226,232,240,0.55)]">
        <GhostShape className="h-20 w-20" happy />
      </div>
      <p
        className="relative rounded-2xl rounded-bl-sm bg-[#F8F3E6] px-5 py-3 text-left text-lg font-semibold leading-snug text-slate-950 shadow-[0_6px_0_-2px_rgba(0,0,0,0.5)]"
        data-testid="guide-bubble"
      >
        {text}
      </p>
    </div>
  );
}
