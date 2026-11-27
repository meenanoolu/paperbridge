import { describe, expect, it } from "vitest";
import { atRest, dampingRatio, overshoot, SPRINGS, settleSeconds, springAt, springCss, springEasing, stepSpring } from "../spring";

describe("spring physics", () => {
  it("starts at rest and ends on target for every preset", () => {
    for (const cfg of Object.values(SPRINGS)) {
      expect(springAt(cfg, 0)).toBe(0);
      expect(springAt(cfg, -1)).toBe(0);
      expect(springAt(cfg, 5)).toBeCloseTo(1, 4);
    }
  });

  it("bounces for under-damped springs and never for critical or over-damped ones", () => {
    expect(dampingRatio(SPRINGS.wobbly)).toBeLessThan(0.6);
    expect(overshoot(SPRINGS.wobbly)).toBeGreaterThan(1.15);
    expect(overshoot(SPRINGS.slam)).toBeGreaterThan(1.1);
    expect(overshoot(SPRINGS.snappy)).toBeGreaterThan(1.02);
    expect(overshoot(SPRINGS.snappy)).toBeLessThan(1.15);
    expect(dampingRatio(SPRINGS.soft)).toBeGreaterThanOrEqual(0.99);
    expect(overshoot(SPRINGS.soft)).toBeLessThanOrEqual(1.0005);
    expect(overshoot({ stiffness: 100, damping: 40 })).toBeLessThanOrEqual(1.0005);
  });

  it("handles exactly critical damping", () => {
    const cfg = { stiffness: 100, damping: 20 };
    expect(dampingRatio(cfg)).toBe(1);
    expect(springAt(cfg, 0.5)).toBeGreaterThan(0.5);
    expect(springAt(cfg, 6)).toBeCloseTo(1, 5);
  });

  it("settles within a sensible time, stiffer meaning faster", () => {
    for (const cfg of Object.values(SPRINGS)) {
      expect(settleSeconds(cfg)).toBeGreaterThan(0.2);
      expect(settleSeconds(cfg)).toBeLessThan(1.6);
    }
    expect(settleSeconds({ stiffness: 600, damping: 40 })).toBeLessThan(settleSeconds({ stiffness: 100, damping: 20 }));
  });

  it("turns a spring into a CSS linear() easing that starts at 0 and ends at exactly 1", () => {
    const { easing, ms } = springEasing(SPRINGS.wobbly);
    expect(easing).toMatch(/^linear\(0, /);
    expect(easing).toMatch(/, 1\)$/);
    expect(easing.split(",").length).toBe(40);
    expect(ms).toBeGreaterThan(300);
    // The under-damped easing really goes past 1.
    expect(Math.max(...easing.slice(7, -1).split(",").map(Number))).toBeGreaterThan(1.1);
  });

  it("publishes every spring as a custom property with a duration, plus a fallback curve", () => {
    const css = springCss();
    for (const n of Object.keys(SPRINGS)) {
      expect(css).toContain(`--spring-${n}: linear(`);
      expect(css).toMatch(new RegExp(`--spring-${n}-ms: \\d+ms`));
    }
    expect(css).toContain("--spring: cubic-bezier(");
    expect(css).not.toMatch(/[\u2013\u2014]/);
  });

  it("chases a moving target and comes to rest", () => {
    let s = { x: 0, v: 0 };
    for (let i = 0; i < 400; i++) s = stepSpring(s, 10, 1 / 60);
    expect(s.x).toBeCloseTo(10, 2);
    expect(atRest(s, 10, 0.01)).toBe(true);
    expect(atRest({ x: 0, v: 0 }, 10)).toBe(false);
    const first = stepSpring({ x: 0, v: 0 }, 10, 1 / 60);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(10);
  });
});

import { tiltVars } from "../pointer";

describe("tilt variables", () => {
  it("leans toward the pointer and puts the glare under it", () => {
    expect(tiltVars(0, 0, 8)).toEqual({ "--rx": "0.00deg", "--ry": "0.00deg", "--gx": "50.0%", "--gy": "50.0%" });
    const corner = tiltVars(1, -1, 8);
    expect(corner["--ry"]).toBe("8.00deg");
    expect(corner["--rx"]).toBe("8.00deg");
    expect(corner["--gx"]).toBe("100.0%");
    expect(corner["--gy"]).toBe("0.0%");
  });
  it("never leans past the maximum, however far the pointer is", () => {
    expect(tiltVars(40, 40, 6)["--ry"]).toBe("6.00deg");
    expect(tiltVars(-40, -40, 6)["--ry"]).toBe("-6.00deg");
  });
});
