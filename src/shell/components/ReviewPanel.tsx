import type { BubbleReading } from "../../core";
import { readingKey, type ManualOverrides, type OverrideState } from "../overrides";
import { Button } from "./ui";

export type DescribeBubble = (b: BubbleReading) => string;

export const defaultDescribe: DescribeBubble = (b) => `${b.group} ${b.row} ${b.col}`;

const CHOICES: { value: OverrideState | undefined; label: string }[] = [
  { value: "filled", label: "Filled" },
  { value: "blank", label: "Blank" },
  { value: undefined, label: "Unclear" },
];

/** Large-target list of every unclear mark, with an explicit Filled / Blank / Unclear choice. */
export function ReviewPanel({
  unclear,
  overrides,
  describe,
  onSet,
  onResetAll,
}: {
  unclear: BubbleReading[];
  overrides: ManualOverrides;
  describe: DescribeBubble;
  onSet: (key: string, value: OverrideState | undefined) => void;
  onResetAll: () => void;
}) {
  if (unclear.length === 0) return null;
  const resolved = unclear.filter((b) => overrides[readingKey(b)] !== undefined).length;
  return (
    <section aria-labelledby="review-title" className="mt-5 rounded-xl border-2 border-amber-700 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="review-title" className="text-xl font-extrabold text-amber-950">
          Check {unclear.length === 1 ? "this mark" : "these marks"} on the paper card
        </h4>
        <span className="text-lg font-bold text-amber-950">
          {resolved} of {unclear.length} resolved
        </span>
      </div>
      <p className="mt-1 text-lg text-amber-950">
        The decoder will not guess. Look at the card, then choose what you see. You can also click the amber circle on the photo.
      </p>
      <ul className="mt-3 space-y-3">
        {unclear.map((b) => {
          const key = readingKey(b);
          const current = overrides[key];
          const name = describe(b);
          return (
            <li key={key} className="rounded-lg border-2 border-amber-700/40 bg-white p-3">
              <p className="text-lg font-bold">
                {name}
                <span className="ml-2 font-normal text-slate-800">(darkness {Math.round(b.fill * 100)}%)</span>
              </p>
              <div role="group" aria-label={`What is ${name}?`} className="mt-2 flex flex-wrap gap-2">
                {CHOICES.map((c) => {
                  const active = current === c.value;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSet(key, c.value)}
                      className={`min-h-14 min-w-28 rounded-xl border-2 px-4 text-lg font-bold ${
                        active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-950 bg-white text-slate-950 hover:bg-slate-100"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      {resolved > 0 && (
        <Button className="mt-3" onClick={onResetAll}>
          Reset all to unclear
        </Button>
      )}
    </section>
  );
}
