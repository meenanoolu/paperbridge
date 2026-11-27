import type { CSSProperties } from "react";

/**
 * Small hand-drawn Halloween touches that sit around a page without touching its content:
 * falling candy and leaves, a cobweb corner, a spider on a thread, a pumpkin and a bat. All are
 * decorative inline SVG (`aria-hidden`, no pointer events), drawn on the page's own colours and
 * moved only with `transform` and `opacity` behind `prefers-reduced-motion: no-preference`.
 */
export const DOODLE_CSS = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes doodle-fall { from { transform: translate3d(0, -12vh, 0) rotate(0deg); opacity: 0; } 10% { opacity: var(--o, 0.5); } 90% { opacity: var(--o, 0.5); } to { transform: translate3d(var(--sway, 30px), 108vh, 0) rotate(var(--spin, 240deg)); opacity: 0; } }
  @keyframes doodle-dangle { from { transform: translateY(0); } to { transform: translateY(18px); } }
  @keyframes doodle-wobble { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
  @keyframes doodle-flit { 0%, 100% { transform: translate(0, 0) scaleX(1); } 25% { transform: translate(18px, -8px) scaleX(0.82); } 50% { transform: translate(36px, 2px) scaleX(1); } 75% { transform: translate(18px, 8px) scaleX(0.82); } }
  .doodle-fall { animation: doodle-fall var(--dur, 22s) linear infinite; animation-delay: var(--delay, 0s); }
  .doodle-dangle { animation: doodle-dangle 3.4s ease-in-out infinite alternate; }
  .doodle-wobble { transform-origin: 50% 100%; animation: doodle-wobble 3.8s ease-in-out infinite alternate; }
  .doodle-flit { animation: doodle-flit 6s ease-in-out infinite; }
}
@media (prefers-reduced-motion: reduce) { .doodle-fall { display: none; } }
`;

export type Treat = "candy" | "leaf" | "bat" | "pumpkin";

/** One tiny falling thing, 28 px. */
function Sprite({ kind, color }: { kind: Treat; color: string }) {
  if (kind === "candy")
    return (
      <svg viewBox="0 0 28 28" className="h-7 w-7" fill="none" aria-hidden="true" focusable="false">
        <path d="M7 14L2 9v10zM21 14l5-5v10z" fill={color} />
        <rect x="7" y="8" width="14" height="12" rx="6" fill={color} />
        <path d="M11 9l-2 10M15 9l-2 10M19 9l-2 10" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
      </svg>
    );
  if (kind === "leaf")
    return (
      <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true" focusable="false">
        <path d="M14 3C22 8 25 16 14 25C3 16 6 8 14 3Z" fill={color} />
        <path d="M14 8V24" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.6" />
      </svg>
    );
  if (kind === "bat")
    return (
      <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true" focusable="false">
        <path d="M14 11C11 5 5 5 1 10C5 9 7 12 8 15C10 12 12 12 14 16C16 12 18 12 20 15C21 12 23 9 27 10C23 5 17 5 14 11Z" fill={color} />
      </svg>
    );
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true" focusable="false">
      <ellipse cx="14" cy="16" rx="11" ry="9" fill={color} />
      <path d="M14 7C14 4 16 3 18 3" stroke="#4d7c0f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M9 14l3 2-3 1zM19 14l-3 2 3 1z" fill="#1c1917" />
    </svg>
  );
}

const SLOTS = [6, 14, 23, 31, 40, 48, 57, 66, 74, 83, 91];

/** Candy, leaves, bats and pumpkins drifting down behind the page. Positions are fixed so the render is stable. */
export function FallingTreats({ kinds = ["candy", "leaf"], colors = ["#ea580c", "#b45309"], count = 9, opacity = 0.4 }: { kinds?: Treat[]; colors?: string[]; count?: number; opacity?: number }) {
  return (
    <div aria-hidden="true" data-doodle="falling" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <style>{DOODLE_CSS}</style>
      {SLOTS.slice(0, count).map((left, i) => (
        <span
          key={left}
          className="doodle-fall absolute top-0"
          style={{ left: `${left}%`, "--dur": `${18 + (i % 5) * 4}s`, "--delay": `${-(i * 3.7)}s`, "--sway": `${(i % 2 ? 1 : -1) * (20 + (i % 4) * 14)}px`, "--spin": `${(i % 2 ? 1 : -1) * (180 + i * 30)}deg`, "--o": opacity } as CSSProperties}
        >
          <Sprite kind={kinds[i % kinds.length]} color={colors[i % colors.length]} />
        </span>
      ))}
    </div>
  );
}

/** A cobweb in the top-left corner. Mirror it with `-scale-x-100` for the right. */
export function Cobweb({ className = "", color = "#94a3b8" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" data-doodle="cobweb" className={`pointer-events-none ${className}`} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
      <path d="M0 0L118 6M0 0L96 54M0 0L54 96M0 0L6 118" />
      <path d="M22 1.6Q24 22 1.6 22M44 3Q50 46 3 44M68 4.4Q80 68 4.4 68M92 5.2Q106 94 5.2 92" />
    </svg>
  );
}

/** A spider that dangles on a thread from the top. `length` is the thread in px. */
export function SpiderOnThread({ className = "", length = 70, body = "#1e1b2e" }: { className?: string; length?: number; body?: string }) {
  return (
    <div aria-hidden="true" data-doodle="spider" className={`pointer-events-none absolute ${className}`}>
      <div className="doodle-dangle flex flex-col items-center">
        <span className="block w-px bg-slate-400" style={{ height: length }} />
        <svg viewBox="0 0 36 30" className="h-8 w-9" focusable="false">
          <g stroke={body} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d="M12 14L2 8M12 16L1 17M12 18L3 26M24 14L34 8M24 16L35 17M24 18L33 26" />
          </g>
          <ellipse cx="18" cy="18" rx="8" ry="9" fill={body} />
          <circle cx="18" cy="9" r="5" fill={body} />
          <circle cx="16" cy="8" r="1.4" fill="#fde047" />
          <circle cx="20" cy="8" r="1.4" fill="#fde047" />
        </svg>
      </div>
    </div>
  );
}

/** A jack-o'-lantern. `lit` puts a warm light in the face. */
export function Pumpkin({ className = "h-16 w-16", lit = true }: { className?: string; lit?: boolean }) {
  return (
    <svg viewBox="0 0 64 56" aria-hidden="true" focusable="false" data-doodle="pumpkin" className={`pointer-events-none ${className}`}>
      <path d="M32 12C32 6 36 3 41 2" stroke="#4d7c0f" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="32" cy="34" rx="29" ry="21" fill="#ea580c" />
      <path d="M32 14C22 22 22 46 32 55M32 14C42 22 42 46 32 55" stroke="#9a3412" strokeWidth="2.4" fill="none" />
      <path d="M17 28l8 4-8 3zM47 28l-8 4 8 3zM20 42l5 4 4-4 3 4 3-4 4 4 5-4" fill={lit ? "#fde047" : "#1c1917"} stroke={lit ? "#fde047" : "#1c1917"} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** A bat that flits side to side. */
export function BatDoodle({ className = "h-8 w-10", color = "#1e1b2e" }: { className?: string; color?: string }) {
  return (
    <div aria-hidden="true" data-doodle="bat" className={`doodle-flit pointer-events-none absolute ${className}`}>
      <svg viewBox="0 0 28 28" className="h-full w-full" focusable="false">
        <path d="M14 11C11 5 5 5 1 10C5 9 7 12 8 15C10 12 12 12 14 16C16 12 18 12 20 15C21 12 23 9 27 10C23 5 17 5 14 11Z" fill={color} />
        <circle cx="12.6" cy="12" r="0.9" fill="#fde047" />
        <circle cx="15.4" cy="12" r="0.9" fill="#fde047" />
      </svg>
    </div>
  );
}
