import { describe, expect, it } from "vitest";
import { appFromHash, APPS, collectApps } from "../app-registry";

const C = () => null;

describe("app registry", () => {
  it("discovers the shipped apps in order", () => {
    expect(APPS.map((a) => [a.id, a.label])).toEqual([
      ["elder-care", "Elder Care Bridge"],
      ["study-bridge", "Study Bridge"],
      ["seance-cipher", "Seance Cipher"],
    ]);
  });

  it("sorts by order then label, skips modules without appMeta, and rejects duplicate ids", () => {
    const apps = collectApps({
      a: { appMeta: { id: "zeta", label: "Zeta", icon: "book" }, default: C },
      b: { default: C },
      c: { appMeta: { id: "alpha", label: "Alpha", icon: "book" }, default: C },
      d: { appMeta: { id: "first", label: "First", icon: "book", order: 1 }, default: C },
    });
    expect(apps.map((a) => a.id)).toEqual(["first", "alpha", "zeta"]);
    expect(() => collectApps({ x: { appMeta: { id: "a", label: "A", icon: "book" }, default: C }, y: { appMeta: { id: "a", label: "B", icon: "book" }, default: C } })).toThrow(
      'Duplicate app id "a" in y',
    );
  });

  it("maps the URL hash to an app, falling back to the first", () => {
    expect(appFromHash("#study-bridge").id).toBe("study-bridge");
    expect(appFromHash("#nope").id).toBe("elder-care");
    expect(appFromHash("").id).toBe("elder-care");
  });
});
