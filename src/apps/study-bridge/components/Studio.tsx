import type { CSSProperties } from "react";
import type { GradeReport } from "../grade";
import { WEAK_TOPIC_BELOW_PCT } from "../grade";

/**
 * The teacher's gradebook, as paper: a ruled page with a red margin, red-ink score stamps and
 * highlighter bars. Every number is also text, so nothing depends on the ink colours.
 * Inks on #FCFBF7: red #9B1C1C 8.0:1, blue #1E3A8A 10.8:1, green #14532D 10.1:1, slate #1E293B 14:1.
 */
export const HAND = "'Segoe Print','Bradley Hand','Comic Sans MS',cursive";

export const RULED_STYLE: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, rgba(96,150,210,0.26) 31px 32px)",
};

export const GRADE_CSS = `
.grade-book h2, .grade-book h3 { color: #1e293b; }
.grade-book [role="tablist"] { border-bottom: 3px solid #1e3a8a; gap: 6px; padding-bottom: 0; }
.grade-book [role="tab"] { border-radius: 14px 14px 0 0; border: 2px solid #1e293b; border-bottom: 0; background: #fff6d6; color: #1e293b; margin-bottom: -3px; }
.grade-book [role="tab"]:hover { background: #ffeeb0; }
.grade-book [role="tab"][aria-selected="true"] { background: #FCFBF7; color: #9b1c1c; border-color: #1e293b; box-shadow: inset 0 4px 0 #d64545; }
.study-draw { stroke-dasharray: none; }
@media (prefers-reduced-motion: no-preference) {
  @keyframes study-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  .study-draw { stroke-dasharray: 1; animation: study-draw 900ms cubic-bezier(0.5, 0, 0.2, 1) 0.35s both; }
}
.grade-book [role="tabpanel"] section[class*="rounded"], .grade-book [role="tabpanel"] details[class*="rounded"], .grade-book [role="tabpanel"] div[class*="rounded-2xl"] { background: rgba(255,255,255,0.72); border-color: rgba(30,41,59,0.28); box-shadow: none; border-radius: 6px; }
`;

const INK = {
  red: "border-[#9b1c1c] text-[#9b1c1c]",
  blue: "border-[#1e3a8a] text-[#1e3a8a]",
  green: "border-[#14532d] text-[#14532d]",
  plain: "border-[#1e293b] text-[#1e293b]",
} as const;
const TILT = [-1.6, 1.1, -0.6, 1.5, -1.1];

export type Ink = keyof typeof INK;

/** Score telemetry as rubber-stamp marks in red, blue and green ink. */
export function Telemetry({ items }: { items: { label: string; value: string; tone?: Ink }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-5 md:grid-cols-5" aria-label="Score telemetry">
      {items.map((i, n) => (
        <div
          key={`${i.label}-${i.value}`}
          data-ink={i.tone ?? "plain"}
          className={`m-slam rounded-md border-[3px] border-double bg-[#FCFBF7]/80 px-4 py-2 mix-blend-multiply ${INK[i.tone ?? "plain"]}`}
          style={{ transform: `rotate(${TILT[n % TILT.length]}deg)`, "--i": n, "--d": "350ms" } as CSSProperties}
        >
          <dt className="text-lg font-bold uppercase tracking-wider">{i.label}</dt>
          <dd className="text-4xl font-black tabular-nums" style={{ fontFamily: HAND }}>
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Highlighter colours: yellow for a mastered topic, pink for one that needs review (the words say it too). */
const MARKER = { weak: "#fda4af", mastered: "#fde047" } as const;

export function TopicMastery({ report }: { report: GradeReport | null }) {
  return (
    <section aria-labelledby="mastery" className="space-y-3 p-1">
      <h2 id="mastery" className="text-3xl font-bold" style={{ fontFamily: HAND }}>
        Topic mastery
      </h2>
      {!report ? (
        <p className="text-lg text-slate-800">Scan a sheet to see each topic. Topics below {WEAK_TOPIC_BELOW_PCT}% go on the due review card.</p>
      ) : (
        <ul className="space-y-4" aria-label="Topic mastery">
          {report.topics.map((t, i) => (
            <li key={`${t.topic}-${t.pct}`} data-topic={t.topic} data-weak={t.weak ? "yes" : "no"}>
              <div className="flex items-baseline justify-between gap-2 text-lg text-slate-900">
                <span className="font-bold" style={{ fontFamily: HAND }}>
                  {t.topic}
                </span>
                <span className="font-bold tabular-nums">
                  {t.correct}/{t.total} ({t.pct}%) {t.weak ? "Review" : "Mastered"}
                </span>
              </div>
              <div aria-hidden className="mt-1 h-6">
                <div
                  data-marker={t.weak ? "weak" : "mastered"}
                  className="m-sweep h-full -skew-x-6 rounded-[3px_10px_4px_9px] mix-blend-multiply"
                  style={{ width: `${Math.max(6, t.pct)}%`, background: t.weak ? MARKER.weak : MARKER.mastered, "--i": i } as CSSProperties}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
