import { useEffect, type RefObject } from "react";

/**
 * Mark `el` with `data-seen="true"` the first time it scrolls into view, so an entrance can
 * play when the visitor can actually see it. Without IntersectionObserver it is marked at once,
 * so nothing is ever left hidden. Returns the cleanup.
 */
export function revealOnce(el: HTMLElement, { rootMargin = "0px 0px -30% 0px", threshold = 0.05 } = {}, IO: typeof IntersectionObserver | undefined = typeof IntersectionObserver === "undefined" ? undefined : IntersectionObserver): () => void {
  if (!IO) {
    el.dataset.seen = "true";
    return () => undefined;
  }
  const io = new IO(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        el.dataset.seen = "true";
        io.disconnect();
      }
    },
    { rootMargin, threshold },
  );
  io.observe(el);
  return () => io.disconnect();
}

export function useRevealOnce(ref: RefObject<HTMLElement | null>, opts?: { rootMargin?: string; threshold?: number }) {
  useEffect(() => (ref.current ? revealOnce(ref.current, opts) : undefined), [ref, opts?.rootMargin, opts?.threshold]); // eslint-disable-line react-hooks/exhaustive-deps
}
