import { nextOverride, readingKey, type ManualOverrides, type OverrideState } from "../overrides";
import type { CompletedScan } from "../scan";
import { Icon } from "./Icon";
import type { DescribeBubble } from "./ReviewPanel";

const STATE_STYLE = {
  filled: { stroke: "#15803d", dash: undefined, width: 4 },
  ambiguous: { stroke: "#b45309", dash: "6 4", width: 4 },
  blank: { stroke: "#64748b", dash: undefined, width: 1.5 },
} as const;

const OVERRIDE_TEXT: Record<"unclear" | OverrideState, string> = {
  unclear: "unclear mark",
  filled: "marked filled by you",
  blank: "marked blank by you",
};

const NEXT_TEXT: Record<"unclear" | OverrideState, string> = { unclear: "unclear", filled: "filled", blank: "blank" };

/**
 * The scanned image with the decoder's view drawn on top: corner markers, card outline,
 * bubble states. Every unclear bubble is a real button that cycles a human override.
 */
export function ScanPreview({
  scan,
  overrides = {},
  onCycle,
  describe,
}: {
  scan: CompletedScan;
  overrides?: ManualOverrides;
  /** Set the override for one bubble. Omit to show a read-only preview. */
  onCycle?: (key: string, value: OverrideState | undefined) => void;
  describe?: DescribeBubble;
}) {
  const { result, width, height } = scan;
  const r = Math.max(width, height) / 90;
  const unclear = result.ok ? result.bubbles.filter((b) => b.state === "ambiguous") : [];
  return (
    <figure>
      <div className="relative overflow-hidden rounded-xl border-2 border-slate-400 bg-slate-800">
        <img src={scan.imageUrl} alt={`Scanned image: ${scan.label}`} className="block h-auto w-full" />
        {result.ok && (
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
            <polygon
              points={result.fiducials.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke="#2563eb"
              strokeWidth={r / 3}
              strokeDasharray={`${r} ${r / 2}`}
            />
            {result.fiducials.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={r * 1.4} fill="none" stroke="#2563eb" strokeWidth={r / 2.5} />
            ))}
            {result.bubbles.map((b, i) => {
              if (b.state === "ambiguous" && onCycle) return null; // drawn as a button below
              const s = STATE_STYLE[b.state];
              return (
                <circle
                  key={i}
                  cx={b.at[0]}
                  cy={b.at[1]}
                  r={r * 0.75}
                  fill="none"
                  stroke={s.stroke}
                  strokeWidth={(s.width * r) / 12}
                  strokeDasharray={s.dash}
                />
              );
            })}
          </svg>
        )}
        {onCycle &&
          unclear.map((b) => {
            const key = readingKey(b);
            const current = overrides[key];
            const now = current ?? "unclear";
            const next = nextOverride(current) ?? "unclear";
            const name = describe ? describe(b) : key;
            const look =
              current === "filled"
                ? "border-solid border-green-500 bg-green-700 text-white"
                : current === "blank"
                  ? "border-solid border-white bg-slate-700 text-white"
                  : "border-dashed border-amber-400 bg-amber-400/30 text-amber-50";
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCycle(key, nextOverride(current))}
                aria-label={`${name}: ${OVERRIDE_TEXT[now]}. Press to mark as ${NEXT_TEXT[next]}.`}
                title={`${name}: ${OVERRIDE_TEXT[now]}`}
                style={{ left: `${(b.at[0] / width) * 100}%`, top: `${(b.at[1] / height) * 100}%` }}
                className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] shadow-[0_0_0_2px_rgba(15,23,42,0.9)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 ${look}`}
              >
                <Icon name={current === "filled" ? "check" : current === "blank" ? "cross" : "question"} className="h-5 w-5" />
              </button>
            );
          })}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-lg">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-4 border-blue-600" aria-hidden /> Corner marker found
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-4 border-green-700" aria-hidden /> Filled
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-4 border-dashed border-amber-700" aria-hidden /> Needs review
          {onCycle && unclear.length > 0 ? " (click to resolve)" : ""}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border border-slate-500" aria-hidden /> Blank
        </span>
      </figcaption>
    </figure>
  );
}
