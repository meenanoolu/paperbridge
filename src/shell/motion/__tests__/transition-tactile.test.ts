import { afterEach, describe, expect, it, vi } from "vitest";
import { coverRadius, originFor, POINTER_FRESH_MS, rememberPointer, resetPointerForTests, runTransition } from "../transition";
import { installTactile, MAX_TACTILE_AREA, NO_TACTILE, PRESS_SCALE, tactileTarget } from "../tactile";

afterEach(() => {
  resetPointerForTests();
  vi.unstubAllGlobals();
});

const VIEW = { width: 1000, height: 600 };

describe("page transition origin", () => {
  it("opens from the last press when it is fresh", () => {
    rememberPointer({ clientX: 120, clientY: 80 }, 1000);
    expect(originFor(VIEW, null, 1000 + POINTER_FRESH_MS - 1)).toEqual({ x: 120, y: 80 });
  });
  it("falls back to the focused control for keyboard users, then to the centre", () => {
    rememberPointer({ clientX: 120, clientY: 80 }, 0);
    const el = { getBoundingClientRect: () => ({ left: 100, top: 20, width: 200, height: 40 }) };
    expect(originFor(VIEW, el, POINTER_FRESH_MS + 5)).toEqual({ x: 200, y: 40 });
    expect(originFor(VIEW, null, POINTER_FRESH_MS + 5)).toEqual({ x: 500, y: 300 });
    expect(originFor(VIEW, { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) }, POINTER_FRESH_MS + 5)).toEqual({ x: 500, y: 300 });
  });
  it("covers the whole screen from any origin", () => {
    expect(coverRadius({ x: 0, y: 0 }, VIEW)).toBeCloseTo(Math.hypot(1000, 600), 5);
    expect(coverRadius({ x: 500, y: 300 }, VIEW)).toBeCloseTo(Math.hypot(500, 300), 5);
  });
});

describe("runTransition", () => {
  const doc = () => {
    const props: Record<string, string> = {};
    let done!: () => void;
    const finished = new Promise<void>((r) => (done = r));
    return { props, done, finished, doc: { documentElement: { style: { setProperty: (k: string, v: string) => (props[k] = v), removeProperty: (k: string) => void delete props[k] } }, startViewTransition: vi.fn((cb: () => void) => (cb(), { finished })) } };
  };

  it("runs the update inside a view transition that opens from the origin, then cleans up", async () => {
    stubMotion(false);
    const d = doc();
    const update = vi.fn();
    expect(runTransition(update, { x: 100.4, y: 50 }, VIEW, d.doc)).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(d.props).toMatchObject({ "--vt-x": "100px", "--vt-y": "50px" });
    expect(d.props["--vt-r"]).toMatch(/^\d+px$/);
    d.done();
    await d.finished;
    await Promise.resolve();
    await Promise.resolve();
    expect(d.props).toEqual({});
  });

  it("just updates when the browser has no view transitions", () => {
    stubMotion(false);
    const update = vi.fn();
    expect(runTransition(update, { x: 0, y: 0 }, VIEW, { documentElement: { style: { setProperty() {}, removeProperty() {} } } })).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("skips the animation for people who ask for reduced motion, and still navigates", () => {
    stubMotion(true);
    const d = doc();
    const update = vi.fn();
    expect(runTransition(update, { x: 0, y: 0 }, VIEW, d.doc)).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
    expect(d.doc.startViewTransition).not.toHaveBeenCalled();
  });
});

function stubMotion(reduced: boolean) {
  vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: reduced && q.includes("reduce"), addEventListener() {}, removeEventListener() {} }) });
}

interface FakeEl {
  closest: (s: string) => FakeEl | null;
  matches: (s: string) => boolean;
  getBoundingClientRect: () => { width: number; height: number };
  animate: ReturnType<typeof vi.fn>;
}
const fake = (w: number, h: number, opts: { noTactile?: boolean } = {}): FakeEl => {
  const el: FakeEl = {
    closest: () => el,
    matches: (s) => s === NO_TACTILE && !!opts.noTactile,
    getBoundingClientRect: () => ({ width: w, height: h }),
    animate: vi.fn(() => ({ cancel: vi.fn() })),
  };
  return el;
};

describe("tactile press", () => {
  it("presses in on pointer down and springs back on release", () => {
    stubMotion(false);
    const handlers: Record<string, (e: unknown) => void> = {};
    const doc = { addEventListener: (t: string, h: (e: unknown) => void) => (handlers[t] = h), removeEventListener: vi.fn() };
    const stop = installTactile(doc as unknown as Document);
    const btn = fake(120, 48);
    handlers.pointerdown({ target: btn });
    expect(btn.animate).toHaveBeenCalledTimes(1);
    expect(btn.animate.mock.calls[0][0]).toEqual([{ scale: "1" }, { scale: String(PRESS_SCALE) }]);
    handlers.pointerup({});
    expect(btn.animate).toHaveBeenCalledTimes(2);
    const [frames, opts] = btn.animate.mock.calls[1];
    expect(frames).toEqual([{ scale: String(PRESS_SCALE) }, { scale: "1" }]);
    expect(opts.easing).toMatch(/^linear\(/);
    handlers.keydown({ target: btn, key: "Enter" });
    expect(btn.animate).toHaveBeenCalledTimes(3);
    handlers.keydown({ target: btn, key: "a" });
    expect(btn.animate).toHaveBeenCalledTimes(3);
    stop();
    expect(doc.removeEventListener).toHaveBeenCalledTimes(5);
  });

  it("leaves pads, disabled controls and big surfaces alone", () => {
    stubMotion(false);
    expect(tactileTarget(fake(100, 40, { noTactile: true }))).toBeNull();
    expect(tactileTarget(fake(400, MAX_TACTILE_AREA / 400 + 1))).toBeNull();
    expect(tactileTarget(fake(100, 40))).not.toBeNull();
    expect(tactileTarget(null)).toBeNull();
    expect(NO_TACTILE).toContain("[data-rune]");
  });

  it("does nothing for reduced motion", () => {
    stubMotion(true);
    const handlers: Record<string, (e: unknown) => void> = {};
    installTactile({ addEventListener: (t: string, h: (e: unknown) => void) => (handlers[t] = h), removeEventListener() {} } as unknown as Document);
    const btn = fake(100, 40);
    handlers.pointerdown({ target: btn });
    expect(btn.animate).not.toHaveBeenCalled();
  });
});
