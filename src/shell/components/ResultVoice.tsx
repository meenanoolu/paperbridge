import { useEffect, useRef, useState } from "react";
import { speak, speechSupported, type SpokenSummary } from "../audio-cues";
import { CopyButton } from "./CopyButton";
import { Button } from "./ui";

/**
 * "Read Aloud" / "Stop Reading" for an app's `spokenSummary`, using the browser's offline
 * speechSynthesis. Hidden when the browser has no speech support.
 */
export function ReadAloudButton({ summary, supported = speechSupported() }: { summary: SpokenSummary; supported?: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  // A new summary (e.g. after a manual check) or leaving the page stops the old one.
  useEffect(() => () => stop.current?.(), [summary.text, summary.lang]);
  if (!supported) return null;
  return (
    <Button
      icon={speaking ? "cross" : "speaker"}
      onClick={() => {
        if (speaking) {
          stop.current?.();
          return;
        }
        setSpeaking(true);
        stop.current = speak(summary, () => {
          setSpeaking(false);
          stop.current = null;
        });
      }}
    >
      {speaking ? "Stop Reading" : "Read Aloud"}
    </Button>
  );
}

/** The shell's result actions: Read Aloud and Copy Quick Update, when the app provides them. */
export function ResultVoice({
  spoken,
  share,
  shareLabel = "Copy Quick Update",
}: {
  spoken?: SpokenSummary | null;
  share?: string | null;
  /** Button text, e.g. "Copy WhatsApp Update". */
  shareLabel?: string;
}) {
  if (!spoken?.text && !share) return null;
  return (
    <section aria-label="Share this result" className="flex flex-wrap items-start gap-3 rounded-2xl border-2 border-slate-300 bg-white p-4">
      {spoken?.text && (
        <ReadAloudButton summary={spoken} />
      )}
      {share && <CopyButton text={share} label={shareLabel} copiedMessage="Copied. Paste it into a message." />}
    </section>
  );
}
