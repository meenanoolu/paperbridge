import { useOnline } from "../useOnline";

export const OFFLINE_MESSAGE = "Offline mode: scanning & printing still work locally";

/**
 * Shown only while the browser reports no network. Everything in PaperBridge runs locally,
 * so this reassures rather than warns. Dark text on yellow passes WCAG AAA contrast.
 */
export function OfflineBadge() {
  const online = useOnline();
  return (
    <p role="status" aria-live="polite" className="contents">
      {!online && (
        <span className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-yellow-300 bg-yellow-200 px-3 py-1 text-lg font-bold text-slate-950">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.8M19 13a10 10 0 0 0-2.2-1.6M2 9a15 15 0 0 1 4.5-3M22 9a15 15 0 0 0-10-4" />
            <circle cx="12" cy="20" r="1" fill="currentColor" />
          </svg>
          {OFFLINE_MESSAGE}
        </span>
      )}
    </p>
  );
}
