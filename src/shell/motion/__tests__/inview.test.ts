import { describe, expect, it, vi } from "vitest";
import { revealOnce } from "../inview";

const el = () => ({ dataset: {} as Record<string, string> }) as unknown as HTMLElement;

describe("revealOnce", () => {
  it("marks the element at once when the browser has no IntersectionObserver, so nothing stays hidden", () => {
    const e = el();
    revealOnce(e, {}, undefined);
    expect(e.dataset.seen).toBe("true");
  });

  it("waits for the element to scroll into view, marks it once, then stops watching", () => {
    let cb!: (entries: { isIntersecting: boolean }[]) => void;
    const disconnect = vi.fn();
    const observe = vi.fn();
    class FakeIO {
      constructor(c: typeof cb, public opts: unknown) {
        cb = c;
      }
      observe = observe;
      disconnect = disconnect;
    }
    const e = el();
    revealOnce(e, { rootMargin: "0px 0px -20% 0px" }, FakeIO as unknown as typeof IntersectionObserver);
    expect(observe).toHaveBeenCalledWith(e);
    expect(e.dataset.seen).toBeUndefined();
    cb([{ isIntersecting: false }]);
    expect(e.dataset.seen).toBeUndefined();
    cb([{ isIntersecting: true }]);
    expect(e.dataset.seen).toBe("true");
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
