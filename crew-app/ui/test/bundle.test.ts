import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { demoAlert, storageKey, addAlert } from "../src/alerts";

/** Smoke test of the committed bundle, mounted the way the Crew host does: default export, host-provided modules. */
const BUNDLE = join(__dirname, "../dist/index.mjs");

function installStorage(seed?: string) {
  const m = new Map<string, string>();
  if (seed) m.set(storageKey("paperbridge-care-monitor"), seed);
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe("crew-app/ui/dist/index.mjs", () => {
  beforeEach(() => installStorage());

  it("imports only host-provided modules", () => {
    const src = readFileSync(BUNDLE, "utf8");
    const imports = [...src.matchAll(/from\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(imports)).toEqual(new Set(["react", "react/jsx-runtime", "@kirocrew/app-sdk", "@kirocrew/app-sdk/ui"]));
    expect(src).toMatch(/export\s*\{\s*\w+ as default\s*\}/);
  });

  it("renders the empty state with a demo button", async () => {
    const Page = (await import("../dist/index.mjs")).default;
    const html = renderToString(createElement(Page));
    expect(html).toContain("PaperBridge Care");
    expect(html).toContain("No care card alerts yet");
    expect(html).toContain("Load demo alert");
  });

  it("renders stored alerts with the check-in action", async () => {
    installStorage(JSON.stringify(addAlert([], demoAlert(new Date("2026-11-21T10:00:00Z")), "demo", new Date())));
    const Page = (await import("../dist/index.mjs")).default;
    const html = renderToString(createElement(Page));
    expect(html).toContain("71% of doses taken");
    expect(html).toContain("No medication at all on Thursday");
    expect(html).toContain("Draft Caregiver Check-In");
    expect(html).toContain("Wednesday water");
  });
});
