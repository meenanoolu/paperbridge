import { useEffect, useRef, useState } from "react";
import type { BubbleReading } from "../../core";
import { readingKey, type ManualOverrides, type OverrideState } from "../overrides";
import { Icon } from "./Icon";

/**
 * One row per unclear mark: "Mark filled" / "Mark blank" / "Undo". When a person answers, a
 * "HUMAN VERIFIED" stamp lands on the row (animated only without reduced motion) and a polite
 * message is announced. The decoder's own output never changes; the answer is an override.
 */
export interface HumanVerifyTheme {
  /** Row surface and text, e.g. "bg-white text-slate-950". */
  row: string;
  /** Stamp colour classes, e.g. "border-teal-800 text-teal-900". */
  stamp: string;
  /** Primary and secondary button classes. */
  button: string;
}

export const DEFAULT_VERIFY_THEME: HumanVerifyTheme = {
  row: "border-slate-300 bg-white text-slate-950",
  stamp: "border-green-800 text-green-900",
  button: "border-slate-950 bg-white text-slate-950 hover:bg-slate-100",
};

export function verifiedCount(unclear: BubbleReading[], overrides: ManualOverrides): number {
  return unclear.filter((b) => overrides[readingKey(b)]).length;
}

export function HumanVerifyControl({
  unclear,
  overrides,
  onSet,
  describe,
  theme = DEFAULT_VERIFY_THEME,
  title = "Check unclear marks on the paper",
  hint,
}: {
  unclear: BubbleReading[];
  overrides: ManualOverrides;
  onSet: (key: string, value: OverrideState | undefined) => void;
  describe?: (b: BubbleReading) => string;
  theme?: HumanVerifyTheme;
  title?: string;
  /** One plain sentence under the title that says what to look at and what to tap next. */
  hint?: string;
}) {
  const [message, setMessage] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (unclear.length === 0) return null;
  const done = verifiedCount(unclear, overrides);
  const set = (b: BubbleReading, v: OverrideState | undefined) => {
    const key = readingKey(b);
    onSet(key, v);
    const name = describe ? describe(b) : key;
    setMessage(v ? `Human verified: ${name} marked ${v}.` : `Undone: ${name} is unclear again.`);
    setFresh(v ? key : null);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFresh(null), 900);
  };
  return (
    <section aria-label={title} className="space-y-2">
      <p className="text-lg font-extrabold">
        {title} ({done} of {unclear.length} checked)
      </p>
      {hint && (
        <p className="text-lg" data-testid="verify-hint">
          {hint}
        </p>
      )}
      <ul className="space-y-2">
        {unclear.map((b) => {
          const key = readingKey(b);
          const v = overrides[key];
          const name = describe ? describe(b) : key;
          return (
            <li key={key} className={`relative flex flex-wrap items-center gap-3 overflow-hidden rounded-xl border-2 p-3 ${theme.row}`} data-verify={v ?? "unclear"}>
              <span className="min-w-40 flex-1 text-lg font-bold">{name}</span>
              {v ? (
                <>
                  <span
                    className={`inline-flex -rotate-6 items-center gap-1 rounded-md border-4 px-3 py-1 text-lg font-black uppercase tracking-widest ${theme.stamp} ${fresh === key ? "motion-safe:animate-[stamp_0.45s_ease-out]" : ""}`}
                    data-stamp
                  >
                    <Icon name="check" className="h-5 w-5" />
                    Human verified: {v}
                  </span>
                  <button type="button" onClick={() => set(b, undefined)} className={`min-h-12 rounded-xl border-2 px-4 py-2 text-lg font-bold ${theme.button}`}>
                    Undo
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => set(b, "filled")} className={`min-h-12 rounded-xl border-2 px-4 py-2 text-lg font-bold ${theme.button}`} aria-label={`Mark filled: ${name}`}>
                    Mark filled
                  </button>
                  <button type="button" onClick={() => set(b, "blank")} className={`min-h-12 rounded-xl border-2 px-4 py-2 text-lg font-bold ${theme.button}`} aria-label={`Mark blank: ${name}`}>
                    Mark blank
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p role="status" aria-live="polite" className="text-lg font-bold">
        {message}
      </p>
    </section>
  );
}
