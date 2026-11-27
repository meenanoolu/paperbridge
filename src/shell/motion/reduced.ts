import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the visitor asked the OS for less motion. False on the server. */
export const prefersReducedMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

/** True when the pointer can hover (a mouse or a trackpad), so pointer-lit effects make sense. */
export const canHover = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Live `prefers-reduced-motion`. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(QUERY);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
