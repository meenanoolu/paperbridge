/**
 * Spring physics for the whole UI. One damped harmonic oscillator (unit target, starts at rest)
 * is solved in closed form, then sampled into a CSS `linear()` easing so the browser runs real
 * spring motion on the compositor with no animation library. Pure and unit tested.
 */
export interface SpringConfig {
  /** Spring constant: higher is faster. */
  stiffness: number;
  /** Friction: higher settles with less bounce. */
  damping: number;
  mass?: number;
}

/** Position of a unit step response at time `t` seconds (0 at rest, tends to 1). */
export function springAt({ stiffness, damping, mass = 1 }: SpringConfig, t: number): number {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const r = Math.sqrt(zeta * zeta - 1);
  const s1 = -w0 * (zeta - r);
  const s2 = -w0 * (zeta + r);
  return 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1);
}

/** Damping ratio: under 1 overshoots, 1 is critical, over 1 never overshoots. */
export const dampingRatio = ({ stiffness, damping, mass = 1 }: SpringConfig): number => damping / (2 * Math.sqrt(stiffness * mass));

/** Seconds until the spring stays within `eps` of its target. Capped at 4 s. */
export function settleSeconds(cfg: SpringConfig, eps = 0.002): number {
  let last = 0;
  for (let ms = 0; ms <= 4000; ms += 4) if (Math.abs(springAt(cfg, ms / 1000) - 1) > eps) last = ms;
  return Math.min(4, (last + 4) / 1000);
}

/** The peak value of the spring (1 when it never overshoots). */
export function overshoot(cfg: SpringConfig): number {
  const end = settleSeconds(cfg);
  let peak = 0;
  for (let t = 0; t <= end; t += 0.004) peak = Math.max(peak, springAt(cfg, t));
  return peak;
}

/** A CSS `linear()` easing that traces the spring, and how long it takes to settle. */
export function springEasing(cfg: SpringConfig, samples = 40): { easing: string; ms: number } {
  const end = settleSeconds(cfg);
  const pts: string[] = [];
  for (let i = 0; i < samples; i++) pts.push((Math.round(springAt(cfg, (i / (samples - 1)) * end) * 1000) / 1000).toString());
  pts[pts.length - 1] = "1";
  return { easing: `linear(${pts.join(", ")})`, ms: Math.round(end * 1000) };
}

export const SPRINGS = {
  /** Quick and crisp with a small overshoot: buttons, chips, pills. */
  snappy: { stiffness: 320, damping: 22 },
  /** Critically damped: smooth, no bounce. Page transitions and big surfaces. */
  soft: { stiffness: 170, damping: 26 },
  /** Playful: lots of bounce. Ghosts, pops, stamps landing. */
  wobbly: { stiffness: 260, damping: 12 },
  /** A heavy thud: a rubber stamp or a paper being dealt. */
  slam: { stiffness: 420, damping: 18 },
} as const satisfies Record<string, SpringConfig>;

export type SpringName = keyof typeof SPRINGS;

/** One semi-implicit Euler step for a value chasing a target (used for pointer-following light). */
export function stepSpring(state: { x: number; v: number }, target: number, dt: number, { stiffness, damping, mass = 1 }: SpringConfig = SPRINGS.soft): { x: number; v: number } {
  const a = (-stiffness * (state.x - target) - damping * state.v) / mass;
  const v = state.v + a * dt;
  return { x: state.x + v * dt, v };
}

/** True once a chasing spring is close enough to rest that the animation loop can stop. */
export const atRest = (state: { x: number; v: number }, target: number, eps = 0.001): boolean => Math.abs(state.x - target) < eps && Math.abs(state.v) < eps;

/** `:root` custom properties for every spring, plus a plain fallback for browsers without `linear()`. */
export function springCss(): string {
  const lines = (Object.keys(SPRINGS) as SpringName[]).map((n) => {
    const { easing, ms } = springEasing(SPRINGS[n]);
    return `--spring-${n}: ${easing}; --spring-${n}-ms: ${ms}ms;`;
  });
  return `:root { --spring: cubic-bezier(0.34, 1.56, 0.64, 1); ${lines.join(" ")} }`;
}
