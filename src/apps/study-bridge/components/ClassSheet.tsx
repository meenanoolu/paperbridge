import { useId, useMemo, useState } from "react";
import { Icon } from "../../../shell/components/Icon";
import { Button, Card, StatusBadge } from "../../../shell/components/ui";
import type { AnswerKey } from "../answer-key";
import {
  classTopicBreakdown,
  gradebookCsv,
  gradebookFileName,
  gradeClass,
  MAX_STUDENT,
  studentId,
  validateStudent,
  type ClassEntry,
} from "../class-sheet";
import { WEAK_TOPIC_BELOW_PCT } from "../grade";

function downloadText(text: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "Student Name / ID" + "Add to Class Sheet", shown under each graded sheet. */
export function AddToClass({ roster, onAdd }: { roster: ClassEntry[]; onAdd: (student: string) => void }) {
  const id = useId();
  const [student, setStudent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const exists = roster.some((e) => e.id === studentId(student));
  return (
    <Card title="Add to class">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const problem = validateStudent(student);
          setError(problem);
          if (problem) return;
          onAdd(student);
          setMessage(`${exists ? "Updated" : "Added"} ${student.trim()}. ${exists ? "" : `${roster.length + 1} in the class sheet.`}`.trim());
          setStudent("");
        }}
      >
        <div className="min-w-64 flex-1">
          <label htmlFor={id} className="block text-lg font-bold">
            Student Name / ID
          </label>
          <input
            id={id}
            value={student}
            maxLength={MAX_STUDENT}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : exists ? `${id}-note` : undefined}
            onChange={(e) => {
              setStudent(e.target.value);
              setError(null);
              setMessage("");
            }}
            className="mt-1 block min-h-14 w-full rounded-xl border-2 border-slate-950 px-3 text-lg aria-[invalid=true]:border-red-800"
          />
        </div>
        <Button type="submit" variant="primary" icon="book">
          {exists ? "Replace in Class Sheet" : "Add to Class Sheet"}
        </Button>
      </form>
      {error && (
        <p id={`${id}-err`} className="mt-2 text-lg font-bold text-red-900">
          {error}
        </p>
      )}
      {exists && !error && (
        <p id={`${id}-note`} className="mt-2 text-lg text-slate-800">
          This student is already in the class sheet. Adding again replaces their earlier sheet.
        </p>
      )}
      <p role="status" aria-live="polite" className="mt-2 text-lg font-bold text-green-900">
        {message}
      </p>
    </Card>
  );
}

/** Saved class: roster, weak-topic breakdown, and CSV export. Graded live with the current key. */
export function ClassSection({
  roster,
  answerKey,
  onRemove,
  onClear,
}: {
  roster: ClassEntry[];
  answerKey: AnswerKey;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [exported, setExported] = useState("");
  const today = useMemo(() => new Date(), []);
  const rows = useMemo(() => gradeClass(roster, answerKey, today), [roster, answerKey, today]);
  const topics = useMemo(() => classTopicBreakdown(rows), [rows]);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.report.scorePct, 0) / rows.length) : 0;

  return (
    <section aria-labelledby="class-title" className="mt-10">
      <Card
        title={
          <span id="class-title" className="flex items-center gap-2">
            <Icon name="book" className="h-7 w-7" /> Class Sheet
          </span>
        }
      >
        {roster.length === 0 ? (
          <p className="text-lg text-slate-800">
            No students yet. After a scan, enter the student's name or ID and press <strong>Add to Class Sheet</strong>.
          </p>
        ) : (
          <div className="space-y-6">
            <p className="text-lg">
              <strong>{roster.length}</strong> {roster.length === 1 ? "student" : "students"}, class average <strong>{avg}%</strong>. Graded with the current
              answer key; editing the key re-grades everyone.
            </p>

            <div>
              <h4 className="text-xl font-extrabold">Class Weak-Topic Breakdown</h4>
              <p className="text-lg text-slate-800">Share of students below {WEAK_TOPIC_BELOW_PCT}% on each topic, most-missed first.</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left text-lg">
                  <caption className="sr-only">Topics by share of students below {WEAK_TOPIC_BELOW_PCT}%</caption>
                  <thead>
                    <tr className="border-b-2 border-slate-950">
                      <th scope="col" className="px-2 py-2">Topic</th>
                      <th scope="col" className="px-2 py-2">Students below {WEAK_TOPIC_BELOW_PCT}%</th>
                      <th scope="col" className="px-2 py-2">Class average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((t) => (
                      <tr key={t.topic} className="border-b border-slate-300">
                        <th scope="row" className="px-2 py-2 font-bold">{t.topic}</th>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-3 w-28 rounded-full bg-slate-200" aria-hidden>
                              <span className={`block h-3 rounded-full ${t.weakPct >= 50 ? "bg-red-800" : t.weakPct > 0 ? "bg-amber-700" : "bg-green-800"}`} style={{ width: `${Math.max(t.weakPct, 2)}%` }} />
                            </span>
                            <strong>{t.weakPct}%</strong> ({t.weakStudents} of {t.students})
                          </span>
                        </td>
                        <td className="px-2 py-2">{t.classPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-extrabold">Students</h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-lg">
                  <caption className="sr-only">Students in the class sheet</caption>
                  <thead>
                    <tr className="border-b-2 border-slate-950">
                      <th scope="col" className="px-2 py-2">Student</th>
                      <th scope="col" className="px-2 py-2">Score</th>
                      <th scope="col" className="px-2 py-2">Needs a look</th>
                      <th scope="col" className="px-2 py-2">Weak topics</th>
                      <th scope="col" className="px-2 py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ entry, report: r }) => {
                      const flags = [
                        ...r.questions.filter((q) => q.status === "invalid").map((q) => `${q.q} double`),
                        ...r.questions.filter((q) => q.status === "blank").map((q) => `${q.q} blank`),
                        ...r.questions.filter((q) => q.status === "review").map((q) => `${q.q} unclear`),
                      ];
                      return (
                        <tr key={entry.id} className="border-b border-slate-300">
                          <th scope="row" className="px-2 py-2 font-bold">{entry.student}</th>
                          <td className="px-2 py-2">
                            <StatusBadge tone={r.scorePct >= WEAK_TOPIC_BELOW_PCT ? "good" : "bad"}>
                              {r.scorePct}% ({r.correct}/{r.total})
                            </StatusBadge>
                          </td>
                          <td className="px-2 py-2">{flags.join(", ") || "-"}</td>
                          <td className="px-2 py-2">{r.weakTopics.join(", ") || "-"}</td>
                          <td className="px-2 py-2 text-right">
                            <Button onClick={() => onRemove(entry.id)} aria-label={`Remove ${entry.student} from the class sheet`}>
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t-2 border-slate-200 pt-4">
              <Button
                variant="primary"
                icon="upload"
                onClick={() => {
                  const name = gradebookFileName(new Date());
                  downloadText(gradebookCsv(rows), "text/csv;charset=utf-8", name);
                  setExported(`Downloaded ${name} (${rows.length} ${rows.length === 1 ? "student" : "students"}).`);
                }}
              >
                Export CSV Gradebook
              </Button>
              <span role="status" aria-live="polite" className="text-lg font-bold text-green-900">
                {exported}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {confirming ? (
                <>
                  <span role="alert" className="text-lg font-bold text-red-900">
                    Delete all {roster.length} students from this browser?
                  </span>
                  <Button
                    variant="primary"
                    onClick={() => {
                      onClear();
                      setConfirming(false);
                    }}
                  >
                    Yes, clear class sheet
                  </Button>
                  <Button onClick={() => setConfirming(false)}>Cancel</Button>
                </>
              ) : (
                <Button onClick={() => setConfirming(true)}>Clear Class Sheet</Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
