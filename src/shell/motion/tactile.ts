import { prefersReducedMotion } from "./reduced";
import { SPRINGS, springEasing } from "./spring";

/** Things that feel pressed: buttons, links, tabs, summaries. */
export const TACTILE_SELECTOR = 'button, a[href], [role="tab"], [role="button"], summary';
/** ...except pads (they have their own hold feedback), disabled controls and anything that opts out. */
export const NO_TACTILE = '[data-rune], [disabled], [aria-disabled="true"], [data-no-tactile]';
/** Big surfaces (a whole stretched link) must not shrink: only controls up to this many square px press in. */
export const MAX_TACTILE_AREA = 60_000;
export const PRESS_SCALE = 0.955;

const release = springEasing(SPRINGS.snappy);

interface Pressable {
  closest(sel: string): Pressable | null;
  matches(sel: string): boolean;
  getBoundingClientRect(): { width: number; height: number };
  animate(frames: Keyframe[], opts: KeyframeAnimationOptions): { cancel(): void };
}

/** The control a pointer or key event is pressing, or null when it should not press in. */
export function tactileTarget(from: unknown): Pressable | null {
  const el = (from as Pressable | null)?.closest?.(TACTILE_SELECTOR) ?? null;
  if (!el || el.matches(NO_TACTILE)) return null;
  const r = el.getBoundingClientRect();
  return r.width * r.height > MAX_TACTILE_AREA ? null : el;
}

/**
 * Every button, link and tab presses in under the finger and springs back, using the Web
 * Animations `scale` property so it never fights a control's own transform or transition.
 * One listener set on the document. Off for reduced motion. Returns the cleanup.
 */
export function installTactile(doc: Pick<Document, "addEventListener" | "removeEventListener"> = document): () => void {
  const live = new WeakMap<object, { cancel(): void }>();
  const down = (e: Event) => {
    if (prefersReducedMotion()) return;
    const el = tactileTarget(e.target);
    if (!el) return;
    live.get(el)?.cancel();
    live.set(el, el.animate([{ scale: "1" }, { scale: String(PRESS_SCALE) }], { duration: 90, easing: "ease-out", fill: "forwards" }));
    held.add(el);
  };
  const held = new Set<Pressable>();
  const up = () => {
    for (const el of held) {
      live.get(el)?.cancel();
      live.set(el, el.animate([{ scale: String(PRESS_SCALE) }, { scale: "1" }], { duration: release.ms, easing: release.easing }));
    }
    held.clear();
  };
  const keyDown = (e: Event) => {
    const k = (e as KeyboardEvent).key;
    if (k === " " || k === "Enter") down(e);
  };
  doc.addEventListener("pointerdown", down, true);
  doc.addEventListener("pointerup", up, true);
  doc.addEventListener("pointercancel", up, true);
  doc.addEventListener("keydown", keyDown, true);
  doc.addEventListener("keyup", up, true);
  return () => {
    doc.removeEventListener("pointerdown", down, true);
    doc.removeEventListener("pointerup", up, true);
    doc.removeEventListener("pointercancel", up, true);
    doc.removeEventListener("keydown", keyDown, true);
    doc.removeEventListener("keyup", up, true);
  };
}
