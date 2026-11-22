import { useSyncExternalStore } from "react";
import type { CompletedScan } from "./scan";

/**
 * Hand-off from "Scan Any Card" to an app's ScanWorkbench. The shell offers a decoded scan and
 * switches to the app; the app's workbench takes it when the card ID is one of its layouts.
 */
let pending: CompletedScan | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function offerRoutedScan(scan: CompletedScan): void {
  pending = scan;
  emit();
}

/** Take the pending scan if it belongs to one of `cardIds`. */
export function takeRoutedScan(cardIds: string[]): CompletedScan | null {
  if (!pending || !cardIds.includes(pending.layout.id)) return null;
  const s = pending;
  pending = null;
  emit();
  return s;
}

export function useRoutedScan(): CompletedScan | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
    () => null,
  );
}
