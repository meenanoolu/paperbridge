import { useEffect, type RefObject } from "react";
import { atRest, SPRINGS, stepSpring } from "./spring";
import { canHover, prefersReducedMotion } from "./reduced";

interface Axis {
  x: number;
  v: number;
}

/**
 * Pointer-lit surface. While a mouse moves over `ref`, springs chase the pointer and write CSS
 * variables on the element, so CSS can draw light, parallax and tilt from them:
 *   --px, --py   pointer from -1 to 1 across the element (0 at the centre)
 *   --mx, --my   pointer in px from the element's top left
 * The loop runs only while something is moving, and does nothing for touch or reduced motion.
 */
export function usePointerLight(ref: RefObject<HTMLElement | null>, { stiffness = 140, damping = 20 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !canHover() || prefersReducedMotion()) return;
    const cfg = { ...SPRINGS.soft, stiffness, damping };
    const s = { px: { x: 0, v: 0 } as Axis, py: { x: 0, v: 0 } as Axis, mx: { x: 0, v: 0 } as Axis, my: { x: 0, v: 0 } as Axis };
    const target = { px: 0, py: 0, mx: 0, my: 0 };
    let raf = 0;
    let last = 0;
    let primed = false;
    const write = () => {
      el.style.setProperty("--px", s.px.x.toFixed(3));
      el.style.setProperty("--py", s.py.x.toFixed(3));
      el.style.setProperty("--mx", `${s.mx.x.toFixed(1)}px`);
      el.style.setProperty("--my", `${s.my.x.toFixed(1)}px`);
    };
    const frame = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      let moving = false;
      for (const k of ["px", "py", "mx", "my"] as const) {
        s[k] = stepSpring(s[k], target[k], dt, cfg);
        if (!atRest(s[k], target[k], k.startsWith("m") ? 0.3 : 0.001)) moving = true;
      }
      write();
      raf = moving ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      target.mx = e.clientX - r.left;
      target.my = e.clientY - r.top;
      target.px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      target.py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      if (!primed) {
        // Start the light at the pointer instead of sweeping in from the corner.
        s.mx.x = target.mx;
        s.my.x = target.my;
        primed = true;
        el.dataset.lit = "true";
      }
      kick();
    };
    const leave = () => {
      target.px = 0;
      target.py = 0;
      kick();
    };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [ref, stiffness, damping]);
}

/** The variables a tilting item gets: lean in degrees, and where the glare sits in percent. */
export function tiltVars(nx: number, ny: number, maxDeg: number): Record<string, string> {
  const cx = Math.max(-1, Math.min(1, nx));
  const cy = Math.max(-1, Math.min(1, ny));
  return { "--rx": `${(-cy * maxDeg).toFixed(2)}deg`, "--ry": `${(cx * maxDeg).toFixed(2)}deg`, "--gx": `${(((cx + 1) / 2) * 100).toFixed(1)}%`, "--gy": `${(((cy + 1) / 2) * 100).toFixed(1)}%` };
}

/**
 * Cards that lean toward the pointer and catch the light. One listener on `ref` serves every
 * element matching `selector` inside it (or `ref` itself with no selector). Each item gets
 * --rx, --ry (deg) and --gx, --gy (%) plus `data-tilting`, which the motion CSS reads.
 */
export function useTilt(ref: RefObject<HTMLElement | null>, { selector, maxDeg = 7 }: { selector?: string; maxDeg?: number } = {}) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !canHover() || prefersReducedMotion()) return;
    let current: HTMLElement | null = null;
    const clear = () => {
      if (!current) return;
      for (const k of ["--rx", "--ry"]) current.style.removeProperty(k);
      delete current.dataset.tilting;
      current = null;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const item = selector ? (e.target as Element).closest<HTMLElement>(selector) : root;
      if (item !== current) clear();
      if (!item) return;
      current = item;
      const r = item.getBoundingClientRect();
      for (const [k, v] of Object.entries(tiltVars(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1, maxDeg))) item.style.setProperty(k, v);
      item.dataset.tilting = "true";
    };
    root.addEventListener("pointermove", move, { passive: true });
    root.addEventListener("pointerleave", clear);
    return () => {
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", clear);
      clear();
    };
  }, [ref, selector, maxDeg]);
}
