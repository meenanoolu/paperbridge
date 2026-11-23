import { useEffect, useId, useRef, useState } from "react";
import { copyText } from "../clipboard";
import { Button } from "./ui";

const CONFIRM_MS = 4000;

/** Copies `text`, confirms politely, and shows the text to copy by hand if the clipboard is blocked. */
export function CopyButton({ text, label, copiedMessage }: { text: string; label: string; copiedMessage: string }) {
  const uid = useId();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // A new payload (e.g. after a manual override) invalidates the old confirmation.
  useEffect(() => setState("idle"), [text]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          icon="upload"
          onClick={async () => {
            const ok = await copyText(text);
            setState(ok ? "copied" : "failed");
            window.clearTimeout(timer.current);
            if (ok) timer.current = window.setTimeout(() => setState("idle"), CONFIRM_MS);
          }}
        >
          {label}
        </Button>
        <span role="status" aria-live="polite" className="text-lg font-bold text-green-900">
          {state === "copied" ? copiedMessage : ""}
        </span>
      </div>
      {state === "failed" && (
        <div className="mt-3">
          <label htmlFor={`${uid}-fallback`} className="block text-lg font-bold text-red-900">
            Your browser blocked copying. Select this text and copy it:
          </label>
          <textarea
            id={`${uid}-fallback`}
            readOnly
            value={text}
            rows={6}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded-lg border-2 border-slate-950 p-2 font-mono text-lg"
          />
        </div>
      )}
    </div>
  );
}
