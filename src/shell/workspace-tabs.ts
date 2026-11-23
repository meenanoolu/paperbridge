import { useSyncExternalStore } from "react";

/**
 * The 3-tab app workspace: Scan & Verify (default), Print Cards, History & Export. The active tab
 * lives in a small module store so the shell can switch to Scan & Verify from anywhere (a routed
 * scan, a Review button) without prop drilling.
 */
export type WorkspaceTab = "scan" | "print" | "history";

export const WORKSPACE_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "scan", label: "Scan & Verify" },
  { id: "print", label: "Print Cards" },
  { id: "history", label: "History & Export" },
];

let active: WorkspaceTab = "scan";
const listeners = new Set<() => void>();

export function showWorkspaceTab(tab: WorkspaceTab): void {
  if (active === tab) return;
  active = tab;
  listeners.forEach((l) => l());
}

export function currentWorkspaceTab(): WorkspaceTab {
  return active;
}

export function useWorkspaceTab(): WorkspaceTab {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => active,
    () => "scan",
  );
}

/**
 * Keyboard model of the WAI-ARIA tabs pattern with automatic activation: Left/Right move to the
 * previous/next tab (wrapping), Home/End to the first/last. Other keys return null (Tab leaves
 * the tab list for the panel).
 */
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export const tabId = (scope: string, tab: WorkspaceTab) => `${scope}-tab-${tab}`;
export const panelId = (scope: string, tab: WorkspaceTab) => `${scope}-panel-${tab}`;
