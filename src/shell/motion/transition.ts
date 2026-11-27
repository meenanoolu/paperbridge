import { prefersReducedMotion } from "./reduced";

export interface Origin {
  x: number;
  y: number;
}

let lastPointer: (Origin & { at: number }) | null = null;

/** Remember where the visitor last pressed, so the next page opens from that spot. */
export function rememberPointer(e: { clientX: number; clientY: number }, now = Date.now()): void {
  lastPointer = { x: e.clientX, y: e.clientY, at: now };
}

/** A press this recent is the cause of the navigation. */
export const POINTER_FRESH_MS = 2000;

/**
 * Where a page transition opens from: the last press if it just happened, else the centre of
 * the focused control (keyboard users), else the middle of the screen.
 */
export function originFor(viewport: { width: number; height: number }, active: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } } | null, now = Date.now()): Origin {
  if (lastPointer && now - lastPointer.at < POINTER_FRESH_MS) return { x: lastPointer.x, y: lastPointer.y };
  if (active) {
    const r = active.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

/** The radius that just covers the viewport from `o`. */
export const coverRadius = (o: Origin, viewport: { width: number; height: number }): number => Math.hypot(Math.max(o.x, viewport.width - o.x), Math.max(o.y, viewport.height - o.y));

export const resetPointerForTests = (): void => {
  lastPointer = null;
};

type Doc = {
  startViewTransition?: (cb: () => void) => { finished: Promise<unknown> };
  documentElement: { style: { setProperty(k: string, v: string): void; removeProperty(k: string): void } };
};

/**
 * Run `update` (which must commit synchronously) inside a View Transition that opens as a circle
 * from `origin`. Falls back to a plain update when the browser has no View Transitions or the
 * visitor wants less motion. Returns true when a transition ran.
 */
export function runTransition(update: () => void, origin: Origin, viewport: { width: number; height: number }, doc: Doc = document as unknown as Doc): boolean {
  if (typeof doc.startViewTransition !== "function" || prefersReducedMotion()) {
    update();
    return false;
  }
  const root = doc.documentElement.style;
  root.setProperty("--vt-x", `${Math.round(origin.x)}px`);
  root.setProperty("--vt-y", `${Math.round(origin.y)}px`);
  root.setProperty("--vt-r", `${Math.ceil(coverRadius(origin, viewport))}px`);
  const t = doc.startViewTransition(update);
  void t.finished.catch(() => undefined).finally(() => {
    root.removeProperty("--vt-x");
    root.removeProperty("--vt-y");
    root.removeProperty("--vt-r");
  });
  return true;
}
