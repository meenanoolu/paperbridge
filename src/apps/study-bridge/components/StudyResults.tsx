import { Icon, type IconName } from "../../../shell/components/Icon";
import { Callout, Card, StatusBadge, type Tone } from "../../../shell/components/ui";
import type { KeyEntry } from "../answer-key";
import { WEAK_TOPIC_BELOW_PCT, type GradeReport, type QuestionStatus } from "../grade";
import type { QuestionId } from "../layout";

const STATUS: Record<QuestionStatus, { tone: Tone; icon: IconName; text: string }> = {
  correct: { tone: "good", icon: "check", text: "Correct" },
  incorrect: { tone: "bad", icon: "cross", text: "Wrong" },
  blank: { tone: "warn", icon: "question", text: "Blank" },
  invalid: { tone: "bad", icon: "alert", text: "2+ marks" },
  review: { tone: "warn", icon: "question", text: "Unclear" },
};

const fmt = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export function StudyResults({ report, quiz }: { report: GradeReport; quiz: Record<QuestionId, KeyEntry> }) {
  const pass = report.scorePct >= WEAK_TOPIC_BELOW_PCT;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card title="Score">
          <p className="text-7xl font-black tracking-tight">{report.scorePct}%</p>
          <p className="mt-1 text-2xl font-bold">
            {report.correct} of {report.total} correct
          </p>
          <p className="mt-3">
            <StatusBadge tone={pass ? "good" : "bad"}>{pass ? "Passing" : "Below 70%"}</StatusBadge>
          </p>
        </Card>
        <Card title="Topics">
          <ul className="space-y-3">
            {report.topics.map((t) => (
              <li key={t.topic}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xl font-bold">{t.topic}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-bold">
                      {t.correct}/{t.total} ({t.pct}%)
                    </span>
                    {t.weak ? <StatusBadge tone="bad">Weak</StatusBadge> : <StatusBadge tone="good">Solid</StatusBadge>}
                  </span>
                </div>
                <div className="mt-1 h-3 rounded-full bg-slate-200" aria-hidden>
                  <div className={`h-3 rounded-full ${t.weak ? "bg-red-800" : "bg-green-800"}`} style={{ width: `${t.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Icon name="calendar" className="h-7 w-7" /> Spaced-repetition plan
          </span>
        }
      >
        {report.schedule.length === 0 ? (
          <Callout tone="good" title="No weak topics">
            Every topic is at {WEAK_TOPIC_BELOW_PCT}% or above. Keep it up.
          </Callout>
        ) : (
          <ul className="grid gap-3 md:grid-cols-3">
            {report.schedule.map((s) => (
              <li key={s.topic} className="rounded-xl border-2 border-slate-950 p-4">
                <p className="text-xl font-extrabold">{s.topic}</p>
                <ol className="mt-2 space-y-1">
                  {s.dates.map((d, i) => (
                    <li key={d} className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">{i + 1}</span>
                      {fmt(d)}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Question by question">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-lg">
            <thead>
              <tr className="border-b-2 border-slate-950">
                <th scope="col" className="px-2 py-2">#</th>
                <th scope="col" className="px-2 py-2">Question</th>
                <th scope="col" className="px-2 py-2">Marked</th>
                <th scope="col" className="px-2 py-2">Answer</th>
                <th scope="col" className="px-2 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {report.questions.map((q) => {
                const s = STATUS[q.status];
                const choices = quiz[q.q].choices;
                return (
                  <tr key={q.q} className="border-b border-slate-300">
                    <th scope="row" className="px-2 py-2">{q.q.slice(1)}</th>
                    <td className="px-2 py-2">
                      {q.prompt} <span className="text-base text-slate-700">({q.topic})</span>
                    </td>
                    <td className="px-2 py-2 font-bold">
                      {q.marked.length ? q.marked.map((m) => `${m}: ${choices[m]}`).join(", ") : "-"}
                    </td>
                    <td className="px-2 py-2">
                      {q.answer}: {choices[q.answer]}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge tone={s.tone}>{s.text}</StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
