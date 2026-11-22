import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { renderCardSvg } from "../../../core";
import { Button, Callout } from "../../../shell/components/ui";
import {
  customizeCareLayout,
  DEFAULT_CARE_SETTINGS,
  DEFAULT_LABELS,
  formatDay,
  isDefaultSettings,
  MAX_LABEL,
  MAX_NAME,
  MAX_NOTE,
  normalizeSettings,
  mondayOf,
  validateSettings,
  type CareCardSettings,
  type CareCol,
  type SettingsProblem,
} from "../card-settings";
import { ELDER_LAYOUT } from "../layout";

const LABEL_FIELDS: { col: CareCol; name: string; hint: string }[] = [
  { col: "am", name: "Column 1 (morning dose)", hint: 'e.g. "Metformin 500mg - Morning"' },
  { col: "pm", name: "Column 2 (evening dose)", hint: 'e.g. "BP Pill - Evening"' },
  { col: "water", name: "Column 3 (daily habit)", hint: 'e.g. "Water 6 cups" or "Walk 15 min"' },
  { col: "dizzy", name: "Column 4 (symptom to report)", hint: 'e.g. "Dizzy or Pain"' },
];

const inputCls =
  "mt-1 block min-h-14 w-full rounded-xl border-2 border-slate-950 bg-white px-3 text-lg aria-[invalid=true]:border-red-800";

function Field({
  id,
  label,
  hint,
  problems,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  problems: SettingsProblem[];
  children: (describedBy: string) => ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div>
      <label htmlFor={id} className="block text-lg font-bold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-lg text-slate-800">
          {hint}
        </p>
      )}
      {children([hint ? hintId : "", problems.length ? errId : ""].filter(Boolean).join(" "))}
      {problems.length > 0 && (
        <p id={errId} className="mt-1 text-lg font-bold text-red-900">
          {problems.map((p) => p.message).join(" ")}
        </p>
      )}
    </div>
  );
}

/**
 * Collapsible "Customize Card" panel. Edits are a draft until Save; the printed card and the
 * dashboard use the saved settings. Only printed text changes, never bubble positions.
 */
export function CustomizeCardPanel({
  settings,
  onSave,
  onReset,
  saved,
}: {
  settings: CareCardSettings;
  onSave: (s: CareCardSettings) => void;
  onReset: () => void;
  /** False if the browser refused to store the settings. */
  saved: boolean;
}) {
  const uid = useId();
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState("");
  useEffect(() => setDraft(settings), [settings]);

  const problems = useMemo(() => validateSettings(draft), [draft]);
  const forField = (f: SettingsProblem["field"]) => problems.filter((p) => p.field === f);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const preview = useMemo(() => {
    const svg = renderCardSvg(customizeCareLayout(ELDER_LAYOUT, problems.length ? settings : { ...draft, weekStart: mondayOf(draft.weekStart) }));
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [draft, settings, problems.length]);
  const snapped = draft.weekStart && mondayOf(draft.weekStart) !== draft.weekStart ? mondayOf(draft.weekStart) : "";

  return (
    <details className="group rounded-2xl border-2 border-slate-950 bg-white">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-xl font-extrabold">
        <span>
          Customize Card
          {!isDefaultSettings(settings) && (
            <span className="ml-3 text-lg font-bold text-slate-800">
              {settings.patientName ? `for ${settings.patientName}` : "customized"}
            </span>
          )}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 shrink-0 motion-safe:transition-transform group-open:rotate-180">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <form
        className="grid gap-6 border-t-2 border-slate-200 p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (problems.length) {
            setMessage(`Fix ${problems.length} ${problems.length === 1 ? "problem" : "problems"} before saving.`);
            return;
          }
          onSave(normalizeSettings(draft));
          setMessage("Saved. Print the card to use the new labels. Scans still decode exactly the same.");
        }}
      >
        <div className="space-y-4">
          <p className="text-lg text-slate-800">
            Only the printed words change. Circles and corner markers stay in the same place, so any version of this card
            scans the same way. Saved in this browser only.
          </p>
          <Field id={`${uid}-name`} label="Patient name" hint="Printed in the card header." problems={forField("patientName")}>
            {(d) => (
              <input
                id={`${uid}-name`}
                className={inputCls}
                value={draft.patientName}
                maxLength={MAX_NAME}
                autoComplete="off"
                aria-invalid={forField("patientName").length > 0}
                aria-describedby={d || undefined}
                onChange={(e) => setDraft({ ...draft, patientName: e.target.value })}
              />
            )}
          </Field>
          <Field
            id={`${uid}-week`}
            label="Week start date"
            hint={snapped ? `Rows run Monday to Sunday, so the card will start on Monday ${formatDay(snapped)}.` : "Rows run Monday to Sunday. Leave empty for an undated card."}
            problems={forField("weekStart")}
          >
            {(d) => (
              <input
                id={`${uid}-week`}
                type="date"
                className={inputCls}
                value={draft.weekStart}
                aria-invalid={forField("weekStart").length > 0}
                aria-describedby={d || undefined}
                onChange={(e) => setDraft({ ...draft, weekStart: e.target.value })}
              />
            )}
          </Field>
          <div className="rounded-xl border-2 border-slate-950 p-4">
            <div className="flex items-start gap-3">
              <input
                id={`${uid}-hv`}
                type="checkbox"
                checked={!!draft.highVisibility}
                onChange={(e) => setDraft({ ...draft, highVisibility: e.target.checked })}
                aria-describedby={`${uid}-hv-hint`}
                className="mt-1 h-7 w-7 shrink-0 cursor-pointer accent-slate-950"
              />
              <div>
                <label htmlFor={`${uid}-hv`} className="block cursor-pointer text-lg font-bold">
                  High-Visibility Print Mode
                </label>
                <p id={`${uid}-hv-hint`} className="text-lg text-slate-800">
                  All text bold, larger day names, and stronger shading on alternate days, for low vision or a shaky hand. The
                  circles stay exactly where they are.
                </p>
              </div>
            </div>
          </div>
          <fieldset className="space-y-5">
            <legend className="text-xl font-extrabold">Checklist columns</legend>
            <p className="text-lg text-slate-800">
              Optional: a routine anchor (when to take it) and a pill cue (what it looks like) print in small type under each label.
            </p>
            {LABEL_FIELDS.map(({ col, name, hint }) => (
              <fieldset key={col} className="space-y-3 rounded-xl border-2 border-slate-300 p-3">
                <legend className="px-1 text-lg font-extrabold">{name}</legend>
                <Field id={`${uid}-${col}`} label="Label" hint={`${hint}. Default: "${DEFAULT_LABELS[col]}".`} problems={forField(col)}>
                  {(d) => (
                    <input
                      id={`${uid}-${col}`}
                      className={inputCls}
                      value={draft.labels[col]}
                      maxLength={MAX_LABEL}
                      autoComplete="off"
                      aria-invalid={forField(col).length > 0}
                      aria-describedby={d || undefined}
                      onChange={(e) => setDraft({ ...draft, labels: { ...draft.labels, [col]: e.target.value } })}
                    />
                  )}
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["anchor", "anchors", "Routine anchor", 'e.g. "With breakfast"'],
                      ["cue", "cues", "Pill cue", 'e.g. "White oval"'],
                    ] as const
                  ).map(([kind, key, label, example]) => {
                    const field = `${col}.${kind}` as const;
                    const id = `${uid}-${col}-${kind}`;
                    return (
                      <Field key={kind} id={id} label={`${label} (optional)`} hint={example} problems={forField(field)}>
                        {(d) => (
                          <input
                            id={id}
                            className={inputCls}
                            value={draft[key]?.[col] ?? ""}
                            maxLength={MAX_NOTE + 6}
                            autoComplete="off"
                            aria-invalid={forField(field).length > 0}
                            aria-describedby={d || undefined}
                            onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], [col]: e.target.value } })}
                          />
                        )}
                      </Field>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="primary" disabled={!dirty}>
              Save card
            </Button>
            <Button
              onClick={() => {
                onReset();
                setDraft(DEFAULT_CARE_SETTINGS);
                setMessage("Reset to the default card.");
              }}
              disabled={isDefaultSettings(settings) && isDefaultSettings(draft)}
            >
              Reset to defaults
            </Button>
          </div>
          <p role="status" aria-live="polite" className="text-lg font-bold">
            {message}
          </p>
          {!saved && (
            <Callout tone="warn" title="This browser did not save the settings">
              They apply until you close the page. Check that site storage is allowed.
            </Callout>
          )}
        </div>
        <figure>
          <img
            src={preview}
            alt="Preview of the printed card with your patient name, week and column labels"
            className="w-full rounded-lg border-2 border-slate-400 bg-white"
          />
          <figcaption className="mt-2 text-lg text-slate-800">
            {problems.length ? "Preview shows the last saved card until the problems are fixed." : "Preview of the printed card."}
          </figcaption>
        </figure>
      </form>
    </details>
  );
}
