import { useSyncExternalStore } from "react";
import type { CompletedScan } from "./scan";
import { showWorkspaceTab } from "./workspace-tabs";

/**
 * Hand-off from "Scan Any Card" to an app's ScanWorkbench. The shell offers a decoded scan and
 * switches to the app; the app's workbench takes it when the card ID is one of its layouts.
 */
let pending: CompletedScan | null = null;
/** How the receiving workbench should show the scan, e.g. with the Optical X-Ray on (demo). */
export interface RoutedView {
  xray?: boolean;
  unwarp?: boolean;
}
let pendingView: RoutedView = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function offerRoutedScan(scan: CompletedScan, view: RoutedView = {}): void {
  pending = scan;
  pendingView = view;
  // A routed scan or a batch "Review" always lands on the Scan & Verify tab.
  showWorkspaceTab("scan");
  emit();
}

/** Take the pending scan if it belongs to one of `cardIds`. */
export function takeRoutedScan(cardIds: string[]): CompletedScan | null {
  if (!pending || !cardIds.includes(pending.layout.id)) return null;
  const s = pending;
  pending = null;
  lastView = pendingView;
  pendingView = {};
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

let lastView: RoutedView = {};
/** The view options of the scan last taken with takeRoutedScan (read once). */
export function takeRoutedView(): RoutedView {
  const v = lastView;
  lastView = {};
  return v;
}

// ---------------------------------------------------------------------------
// Programmatic Scan Any Card batches (the Instant Demo's "Mixed Batch")
// ---------------------------------------------------------------------------

let batchRequest: File[] | null = null;
const batchListeners = new Set<() => void>();

/** Ask the mounted Scan Any Card panel to decode these files as a batch. */
export function requestAutoRouteBatch(files: File[]): void {
  batchRequest = files;
  showWorkspaceTab("scan");
  batchListeners.forEach((l) => l());
}

export function takeAutoRouteBatch(): File[] | null {
  const f = batchRequest;
  batchRequest = null;
  return f;
}

export function useAutoRouteBatchRequest(): File[] | null {
  return useSyncExternalStore(
    (cb) => {
      batchListeners.add(cb);
      return () => batchListeners.delete(cb);
    },
    () => batchRequest,
    () => null,
  );
}
