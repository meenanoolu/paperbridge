/** Keyboard model for modal dialogs: Escape closes; Tab and Shift+Tab wrap inside the dialog. */
export type DialogKeyAction = { kind: "close" } | { kind: "focus"; index: number } | null;

/**
 * `current` is the index of the focused element among the dialog's `count` focusable elements
 * (-1 when focus is outside them, e.g. on the dialog container itself).
 */
export function dialogKey(key: string, shift: boolean, current: number, count: number): DialogKeyAction {
  if (key === "Escape") return { kind: "close" };
  if (key !== "Tab" || count === 0) return null;
  if (shift) return current <= 0 ? { kind: "focus", index: count - 1 } : null;
  return current === -1 || current >= count - 1 ? { kind: "focus", index: 0 } : null;
}

export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
