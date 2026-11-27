import type { ReactNode } from "react";
import type { DecodeErrorReason, SuccessfulScan } from "../../core";
import { DECODE_ERROR_TEXT, type CompletedScan } from "../scan";
import { GhostShape } from "./HomeGhosts";

/**
 * Helpful, slightly mischievous messages for the moments a stranger gets stuck: a photo with no
 * card in it, a card that belongs to another app, a sheet with nothing marked. Each one says what
 * went wrong in plain words and the exact next thing to tap. The ghost is decoration; the words
 * carry the meaning.
 */
export function FriendlyNotice({ kind, joke, children }: { kind: string; joke: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-amber-800 bg-amber-50 p-4 text-amber-950" data-notice={kind}>
      <GhostShape className="h-14 w-14 shrink-0 text-amber-700" />
      <div>
        <p className="text-xl font-extrabold">{joke}</p>
        <div className="mt-1 space-y-1 text-lg">{children}</div>
      </div>
    </div>
  );
}

/** The joke and the next step for each way a decode can fail. The factual reason comes from `DECODE_ERROR_TEXT`. */
export const PROBLEM_COPY: Record<DecodeErrorReason, { joke: string; next: string }> = {
  FIDUCIALS_NOT_FOUND: {
    joke: "The spirits can't spot your paper!",
    next: "Line up all 4 black corner squares inside the photo, keep the card flat and keep fingers off the corners. Or tap a sample card above to see it work right now.",
  },
  HOMOGRAPHY_DEGENERATE: {
    joke: "Your card is hiding in the corner!",
    next: "Move closer and hold it face-on to the camera, then try again. Or tap a sample card above.",
  },
  CARD_ID_MISMATCH: {
    joke: "Wrong paper, wrong world!",
    next: "That card belongs to another PaperBridge app. Open that app from the bar at the top, or print this app's own card.",
  },
};

/** Shown when the last photo could not be read. Renders nothing for a good scan or no scan. */
export function ScanProblem({ scan }: { scan: CompletedScan | null }) {
  if (!scan || scan.result.ok) return null;
  const reason = scan.result.reason;
  return (
    <FriendlyNotice kind={`decode-${reason}`} joke={PROBLEM_COPY[reason].joke}>
      <p>{DECODE_ERROR_TEXT[reason].title}.</p>
      <p>{PROBLEM_COPY[reason].next}</p>
    </FriendlyNotice>
  );
}

/** True when the card was read but not one bubble has ink: an empty page. */
export const hasNoMarks = (result: SuccessfulScan): boolean => result.bubbles.length > 0 && result.bubbles.every((b) => b.state === "blank");
