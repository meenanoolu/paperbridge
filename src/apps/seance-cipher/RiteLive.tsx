import { RITE_RUNE_NAMES } from "./layout";
import { classifyCoverage, type Target } from "./riteEngine";
import { RITE_COLORS } from "./theme";
import type { Burst } from "./RitePads";

/** Where the 12 bubbles are in the latest camera frame, in frame pixels. Null positions mean the sheet is not in view. */
export interface LiveView {
  width: number;
  height: number;
  bubbles: { x: number; y: number; r: number }[] | null;
}

/**
 * Drawn over the live video, in frame pixels. Targets get a pulsing gold ring and a gold beam;
 * a trembling target flickers crimson with a dashed ring; a banished rune bursts emerald. Purely
 * visual (`aria-hidden`): the status line and the HUD carry the same facts as text.
 */
export function LiveOverlay({ view, targets, coverage, bursts }: { view: LiveView; targets: readonly Target[]; coverage: readonly number[]; bursts: readonly Burst[] }) {
  const { width, height, bubbles } = view;
  if (!bubbles) return null;
  const u = Math.max(width, height) / 300;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" data-testid="rite-overlay">
      <defs>
        <linearGradient id="rite-beam-gold" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={RITE_COLORS.gold} stopOpacity="0.75" />
          <stop offset="1" stopColor={RITE_COLORS.gold} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rite-beam-crimson" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={RITE_COLORS.crimson} stopOpacity="0.85" />
          <stop offset="1" stopColor={RITE_COLORS.crimson} stopOpacity="0" />
        </linearGradient>
      </defs>
      {bubbles.map((b, i) => {
        const t = targets.find((x) => x.rune === i);
        const cover = coverage[i] ?? 0;
        const kind = classifyCoverage(cover);
        const burst = bursts.find((x) => x.rune === i);
        if (!t)
          return (
            <g key={i}>
              <circle cx={b.x} cy={b.y} r={b.r * 1.05} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={u * 1.6} />
              <circle cx={b.x} cy={b.y} r={b.r * 1.05} fill="none" stroke="#e2e8f0" strokeOpacity={0.55} strokeWidth={u * 0.7} />
              {burst && <circle key={burst.id} className="rite-burst" cx={b.x} cy={b.y} r={b.r * 1.1} fill="none" stroke={RITE_COLORS.emerald} strokeWidth={u * 2} />}
            </g>
          );
        const trembling = kind === "trembling";
        const color = kind === "covered" ? RITE_COLORS.emerald : trembling ? RITE_COLORS.crimson : RITE_COLORS.gold;
        const beam = Math.max(8 * u, b.y - 8 * b.r);
        return (
          <g key={i} data-rune={i} data-kind={kind === "empty" ? "target" : kind}>
            <rect
              data-beam={trembling ? "crimson" : "gold"}
              className={trembling ? "rite-flicker" : undefined}
              x={b.x - b.r * 0.55}
              y={beam}
              width={b.r * 1.1}
              height={Math.max(0, b.y - beam - b.r)}
              fill={`url(#rite-beam-${trembling ? "crimson" : "gold"})`}
            />
            <circle cx={b.x} cy={b.y} r={b.r * 1.25} fill="none" stroke="#000" strokeOpacity={0.65} strokeWidth={u * 3.2} />
            <circle
              className={kind === "empty" ? "rite-pulse" : undefined}
              cx={b.x}
              cy={b.y}
              r={b.r * 1.25}
              fill="none"
              stroke={color}
              strokeWidth={u * 2}
              strokeDasharray={trembling ? `${u * 3} ${u * 2}` : undefined}
            />
            <text x={b.x} y={b.y + b.r * 1.25 + u * 6} textAnchor="middle" fontSize={u * 5} fontWeight={800} fill={color} stroke="#000" strokeWidth={u * 1.2} paintOrder="stroke" fontFamily="ui-sans-serif, system-ui, sans-serif">
              {`${i + 1} ${RITE_RUNE_NAMES[i]} ${cover.toFixed(2)}`}
            </text>
            {burst && <circle key={burst.id} className="rite-burst" cx={b.x} cy={b.y} r={b.r * 1.25} fill="none" stroke={RITE_COLORS.emerald} strokeWidth={u * 2.6} />}
          </g>
        );
      })}
    </svg>
  );
}
