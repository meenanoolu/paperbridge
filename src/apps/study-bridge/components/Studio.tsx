import type { GradeReport } from "../grade";
import { WEAK_TOPIC_BELOW_PCT } from "../grade";

/**
 * Live Classroom Studio pieces: score telemetry and topic-mastery bars. Every number is also
 * text, so nothing depends on the bars or their colour.
 */
export function Telemetry({ items }: { items: { label: string; value: string; tone?: "indigo" | "emerald" | "plain" }[] }) {
  const tone = { indigo: "text-[#3730A3]", emerald: "text-[#047857]", plain: "text-slate-950" } as const;
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Score telemetry">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-slate-300 bg-white px-4 py-3">
          <dt className="text-lg font-bold uppercase tracking-wider text-slate-700">{i.label}</dt>
          <dd className={`text-4xl font-black tabular-nums ${tone[i.tone ?? "plain"]}`}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TopicMastery({ report }: { report: GradeReport | null }) {
  return (
    <section aria-labelledby="mastery" className="rounded-2xl border border-slate-300 bg-white p-5">
      <h2 id="mastery" className="text-2xl font-extrabold">
        Topic mastery
      </h2>
      {!report ? (
        <p className="mt-2 text-lg text-slate-800">Scan a sheet to see each topic. Topics below {WEAK_TOPIC_BELOW_PCT}% go on the due review card.</p>
      ) : (
        <ul className="mt-3 space-y-3" aria-label="Topic mastery">
          {report.topics.map((t) => (
            <li key={t.topic} data-topic={t.topic} data-weak={t.weak ? "yes" : "no"}>
              <div className="flex items-baseline justify-between gap-2 text-lg">
                <span className="font-bold">{t.topic}</span>
                <span className="font-bold tabular-nums">
                  {t.correct}/{t.total} ({t.pct}%) {t.weak ? "Review" : "Mastered"}
                </span>
              </div>
              <div aria-hidden className="mt-1 h-4 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${t.weak ? "bg-[repeating-linear-gradient(45deg,#3730A3_0_8px,#4f46e5_8px_16px)]" : "bg-[#047857]"}`}
                  style={{ width: `${Math.max(4, t.pct)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
