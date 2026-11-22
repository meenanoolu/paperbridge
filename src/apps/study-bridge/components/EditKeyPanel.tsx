import { useEffect, useId, useMemo, useState } from "react";
import { Button, Callout } from "../../../shell/components/ui";
import {
  DEFAULT_EDITABLE_KEY,
  isPracticeKey,
  MAX_TOPIC,
  normalizeTopic,
  validateKey,
  type EditableKey,
} from "../answer-key";
import { OPTIONS, QUESTIONS } from "../layout";

/**
 * Collapsible "Edit Answer Key". The draft is graded only after Save, which also re-grades
 * the sheet on screen. Saved in this browser only.
 */
export function EditKeyPanel({
  answerKey,
  onSave,
  onReset,
  saved,
  hasScan,
}: {
  answerKey: EditableKey;
  onSave: (k: EditableKey) => void;
  onReset: () => void;
  saved: boolean;
  /** A sheet is loaded, so saving re-grades it. */
  hasScan: boolean;
}) {
  const uid = useId();
  const [draft, setDraft] = useState(answerKey);
  const [message, setMessage] = useState("");
  useEffect(() => setDraft(answerKey), [answerKey]);

  const problems = useMemo(() => validateKey(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(answerKey);
  const topics = useMemo(() => [...new Set(QUESTIONS.map((q) => normalizeTopic(draft[q].topic)).filter(Boolean))], [draft]);
  const practice = isPracticeKey(answerKey);

  return (
    <details className="group rounded-2xl border-2 border-slate-950 bg-white">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-xl font-extrabold">
        <span>
          Edit Answer Key
          <span className="ml-3 text-lg font-bold text-slate-800">{practice ? "practice quiz" : "your key"}</span>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 shrink-0 motion-safe:transition-transform group-open:rotate-180">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <form
        className="border-t-2 border-slate-200 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (problems.length) {
            setMessage(`Fix ${problems.length} ${problems.length === 1 ? "problem" : "problems"} before saving.`);
            return;
          }
          onSave(Object.fromEntries(QUESTIONS.map((q) => [q, { ...draft[q], topic: normalizeTopic(draft[q].topic) }])) as EditableKey);
          setMessage(hasScan ? "Saved. The sheet on screen was re-graded with this key." : "Saved. Sheets you scan will be graded with this key.");
        }}
      >
        <p className="text-lg text-slate-800">
          Set the correct answer and a topic for each question. Topics below 70% become weak topics with review dates.
        </p>
        <datalist id={`${uid}-topics`}>
          {topics.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <ol className="mt-4 divide-y-2 divide-slate-200">
          {QUESTIONS.map((q) => {
            const n = q.slice(1);
            const err = problems.filter((p) => p.q === q);
            const topicId = `${uid}-${q}-topic`;
            return (
              <li key={q} className="grid gap-3 py-3 md:grid-cols-[auto_auto_minmax(0,1fr)] md:items-end">
                <span className="text-xl font-black md:w-10 md:pb-3">{n}.</span>
                <fieldset>
                  <legend className="text-lg font-bold">Question {n} answer</legend>
                  <div className="mt-1 flex gap-1.5">
                    {OPTIONS.map((o) => (
                      <label
                        key={o}
                        className={`grid h-12 w-12 cursor-pointer place-items-center rounded-xl border-2 border-slate-950 text-lg font-black has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-950 ${
                          draft[q].answer === o ? "bg-slate-950 text-white" : "bg-white text-slate-950 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${uid}-${q}`}
                          value={o}
                          checked={draft[q].answer === o}
                          onChange={() => setDraft({ ...draft, [q]: { ...draft[q], answer: o } })}
                          className="sr-only"
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor={topicId} className="block text-lg font-bold">
                    Question {n} topic
                  </label>
                  <input
                    id={topicId}
                    list={`${uid}-topics`}
                    value={draft[q].topic}
                    maxLength={MAX_TOPIC + 10}
                    autoComplete="off"
                    aria-invalid={err.length > 0}
                    aria-describedby={err.length ? `${topicId}-err` : undefined}
                    onChange={(e) => setDraft({ ...draft, [q]: { ...draft[q], topic: e.target.value } })}
                    className="mt-1 block min-h-12 w-full rounded-xl border-2 border-slate-950 px-3 text-lg aria-[invalid=true]:border-red-800"
                  />
                  {err.length > 0 && (
                    <p id={`${topicId}-err`} className="mt-1 text-lg font-bold text-red-900">
                      {err.map((p) => p.message).join(" ")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={!dirty}>
            Save key{hasScan ? " and re-grade" : ""}
          </Button>
          <Button
            onClick={() => {
              onReset();
              setDraft(DEFAULT_EDITABLE_KEY);
              setMessage(hasScan ? "Reset to the default key. The sheet on screen was re-graded." : "Reset to the default key.");
            }}
            disabled={practice && isPracticeKey(draft)}
          >
            Reset to default key
          </Button>
        </div>
        <p role="status" aria-live="polite" className="mt-3 text-lg font-bold">
          {message}
        </p>
        {!saved && (
          <Callout tone="warn" title="This browser did not save the key">
            It applies until you close the page. Check that site storage is allowed.
          </Callout>
        )}
      </form>
    </details>
  );
}
