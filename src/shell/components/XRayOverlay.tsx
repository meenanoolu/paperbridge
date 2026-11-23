import { useId, useState } from "react";
import { XRAY_LOCK, XRAY_STYLE, xraySummary, type XRayModel } from "../xray";

/**
 * SVG drawn over a scanned image (same pixel coordinates). Green lock-on boxes on the 4 corner
 * markers, a colour-and-dash ring per bubble, and its ink-density score. Filled and unclear scores
 * are always shown; blank ones appear on hover, or on focus from the readings list below.
 */
export function XRayOverlay({ model, width, height, focusKey }: { model: XRayModel; width: number; height: number; focusKey?: string | null }) {
  const u = Math.max(width, height) / 300;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" data-testid="xray">
      {model.corners.map((c) => {
        const h = c.size * 0.75;
        return (
          <g key={c.name}>
            <rect x={c.x - h} y={c.y - h} width={2 * h} height={2 * h} fill="none" stroke="#000" strokeWidth={u * 2.6} />
            <rect x={c.x - h} y={c.y - h} width={2 * h} height={2 * h} fill="none" stroke={XRAY_LOCK} strokeWidth={u * 1.4} data-corner={c.name} />
          </g>
        );
      })}
      {model.bubbles.map((b) => {
        const s = XRAY_STYLE[b.state];
        const show = b.state !== "blank" || b.key === focusKey;
        // As large as the bubble pitch allows: 2.4 radii wide.
        const font = b.r * 0.78;
        const w = font * 2.5;
        // Unclear marks carry a review button over the ring: their score goes above it.
        const top = b.state === "unclear" ? b.y - b.r * 1.15 - font * 1.35 : b.y + b.r * 1.15;
        return (
          <g key={b.key} data-state={b.state} data-score={b.score} className={b.state === "blank" ? "group pointer-events-auto" : "pointer-events-auto"}>
            <title>{`${b.key}: ${b.state}, ink ${b.score}`}</title>
            <circle cx={b.x} cy={b.y} r={b.r * 1.05} fill="none" stroke="#000" strokeWidth={u * 2.4} />
            <circle cx={b.x} cy={b.y} r={b.r * 1.05} fill="transparent" stroke={s.ring} strokeWidth={u * 1.3} strokeDasharray={s.dash ? s.dash.split(" ").map((n) => Number(n) * u).join(" ") : undefined} />
            <g className={show ? undefined : "opacity-0 group-hover:opacity-100"}>
              <rect x={b.x - w / 2} y={top} width={w} height={font * 1.35} rx={font * 0.3} fill={s.label} stroke={s.ring} strokeWidth={u * 0.8} />
              <text x={b.x} y={top + font * 1.03} fontSize={font} fontWeight={700} textAnchor="middle" fill={s.text} fontFamily="ui-sans-serif, system-ui, sans-serif">
                {b.score}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** Caption, legend and a keyboard-reachable list of every reading (the overlay itself is visual only). */
export function XRayDetails({ model, describe, onFocusKey }: { model: XRayModel; describe?: (key: string) => string; onFocusKey?: (key: string | null) => void }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-xl border-2 border-slate-950 bg-slate-950 p-3 text-white on-dark">
      <p className="text-lg font-bold" id={`${uid}-sum`}>
        Optical X-Ray: {xraySummary(model)}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-lg" aria-label="X-Ray legend">
        <li className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 border-[3px] border-green-500" aria-hidden /> Corner lock-on
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-[3px] border-green-500" aria-hidden /> Filled
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-[3px] border-dashed border-amber-500" aria-hidden /> Unclear (sent to a person)
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-[3px] border-dotted border-slate-400" aria-hidden /> Blank (hover or focus for its score)
        </li>
      </ul>
      <details className="mt-2" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-lg font-bold underline underline-offset-4">All {model.bubbles.length} readings</summary>
        {open && (
          <ul className="mt-2 grid max-h-72 gap-1 overflow-auto pr-2 sm:grid-cols-2" aria-describedby={`${uid}-sum`}>
            {model.bubbles.map((b) => (
              <li
                key={b.key}
                tabIndex={0}
                onFocus={() => onFocusKey?.(b.key)}
                onBlur={() => onFocusKey?.(null)}
                onMouseEnter={() => onFocusKey?.(b.key)}
                onMouseLeave={() => onFocusKey?.(null)}
                className="rounded-md px-2 py-1 text-lg"
              >
                {describe ? describe(b.key) : b.key}: <strong>{b.state}</strong>, ink {b.score}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
