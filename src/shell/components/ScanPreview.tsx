import type { CompletedScan } from "../scan";

const STATE_STYLE = {
  filled: { stroke: "#15803d", dash: undefined, width: 4 },
  ambiguous: { stroke: "#b45309", dash: "6 4", width: 4 },
  blank: { stroke: "#64748b", dash: undefined, width: 1.5 },
} as const;

/** The scanned image with the decoder's view drawn on top: corner markers, card outline, bubble states. */
export function ScanPreview({ scan }: { scan: CompletedScan }) {
  const { result, width, height } = scan;
  const r = Math.max(width, height) / 90;
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
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-base">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-4 border-blue-600" aria-hidden /> Corner marker found
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-4 border-green-700" aria-hidden /> Filled
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-4 border-dashed border-amber-700" aria-hidden /> Needs review
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border border-slate-500" aria-hidden /> Blank
        </span>
      </figcaption>
    </figure>
  );
}
