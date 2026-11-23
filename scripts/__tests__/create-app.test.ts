import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM script without type declarations
import { componentName, createApp, validateDisplayName, validateSlug } from "../create-app.mjs";
import { bubbleCenters, bubbleKey, checkLayout, renderCardRaster, type CardLayout } from "../../src/core";
import { processBatch, saveBatchGroup, type BatchAdapter } from "../../src/shell/batch";
import { loadSaved } from "../../src/shell/local-batch";
import { routeRaster } from "../../src/shell/route";

/**
 * The scaffolder writes into a temp copy of the repo shape: src/apps/<slug>/ next to
 * symlinked src/core, src/shell and node_modules, so the generated relative imports resolve
 * exactly as they would in src/apps/. The real src/apps/ is never touched.
 */
const REPO = resolve(__dirname, "../..");
const realApps = () => readdirSync(join(REPO, "src/apps")).sort();
const appsBefore = realApps();

const tmp = mkdtempSync(join(tmpdir(), "pb-create-app-"));
mkdirSync(join(tmp, "src/apps"), { recursive: true });
symlinkSync(join(REPO, "src/core"), join(tmp, "src/core"), "dir");
symlinkSync(join(REPO, "src/shell"), join(tmp, "src/shell"), "dir");
symlinkSync(join(REPO, "node_modules"), join(tmp, "node_modules"), "dir");
const appsDir = join(tmp, "src/apps");

const result = createApp({ slug: "clinic-intake", displayName: "Clinic Intake", appsDir });
const dir = result.dir as string;

// Run the generated test suite inside this file: importing it registers its describe blocks.
await import(join(dir, "__tests__/layout.test.ts"));

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("create-app scaffolder", () => {
  it("writes the 3-file contract, sample recipe, and tests", () => {
    expect(result.files).toEqual(["layout.ts", "interpret.ts", "App.tsx", "print.ts", "samples/specs.ts", "samples/index.ts", "__tests__/layout.test.ts"]);
    for (const f of result.files) expect(existsSync(join(dir, f)), f).toBe(true);
  });

  it("does not touch the real src/apps", () => {
    expect(realApps()).toEqual(appsBefore);
    expect(existsSync(join(REPO, "src/apps/clinic-intake"))).toBe(false);
  });

  it("generates a valid card layout with the slug as card ID", async () => {
    const { LAYOUTS } = (await import(join(dir, "layout.ts"))) as { LAYOUTS: CardLayout[] };
    expect(LAYOUTS.map((l) => [l.id, l.title, l.page])).toEqual([
      ["clinic-intake", "Clinic Intake", "A4"],
      ["clinic-intake", "Clinic Intake", "Letter"],
    ]);
    for (const l of LAYOUTS) expect(checkLayout(l)).toMatchObject({ ok: true, errors: [] });
  });

  it("generates an App that registers itself and renders the sample panel", async () => {
    const mod = (await import(join(dir, "App.tsx"))) as { appMeta: { id: string; label: string }; default: () => null };
    expect(mod.appMeta).toMatchObject({ id: "clinic-intake", label: "Clinic Intake" });
    const html = renderToString(createElement(mod.default));
    expect(html).toContain("<h1");
    expect(html).toContain("Clinic Intake");
    expect(html).toContain("Try Sample Scanned Cards");
    expect(html).toContain("No sample photos yet"); // until gen:samples runs
    expect(readFileSync(join(dir, "App.tsx"), "utf8")).toContain("export function ClinicIntakeApp()");
  });

  it("passes typecheck on its own, with the repo's strict settings", () => {
    writeFileSync(
      join(tmp, "tsconfig.json"),
      JSON.stringify({ extends: join(REPO, "tsconfig.json"), include: ["src/apps/clinic-intake"], compilerOptions: { types: ["node", "vite/client"] } }),
    );
    const r = spawnSync(process.execPath, [join(REPO, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", join(tmp, "tsconfig.json")], { encoding: "utf8" });
    expect(r.stdout + r.stderr).toBe("");
    expect(r.status).toBe(0);
  }, 120_000);

  it("works with Scan Any Card out of the box: auto-route and batch save into Saved Cards", async () => {
    type Mod = { appMeta: { id: string; label: string; layouts: CardLayout[]; batch: BatchAdapter }; SAVED: { storageKey: string } };
    const mod = (await import(join(dir, "App.tsx"))) as Mod;
    const { layouts, batch } = mod.appMeta;
    expect(batch.actionLabel(2)).toBe("Save 2 cards to Saved Cards");
    const keys = bubbleCenters(layouts[0]).map((b) => bubbleKey(b.group, b.row, b.col));
    const marked = (i: number) => new Set([keys[i], keys[i + 2]]);
    // Routed by its card ID, on both paper sizes.
    const app = { id: mod.appMeta.id, label: mod.appMeta.label, layouts, batch };
    for (const l of layouts) {
      const r = routeRaster(renderCardRaster(l, marked(0), { rotationDeg: 4 }), [app]);
      expect(r.ok && [r.app.id, r.layout.page]).toEqual(["clinic-intake", l.page]);
    }
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const before = g.localStorage;
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    try {
      const run = await processBatch(
        [
          { name: "ana_lee.jpg", load: async () => renderCardRaster(layouts[0], marked(0)) },
          { name: "bo-chen.jpg", load: async () => renderCardRaster(layouts[1], marked(1)) },
        ],
        [app],
      );
      const values = Object.fromEntries(run.items.map((i, k) => [i.index, batch.defaults!(run.items)[k]]));
      expect(Object.values(values)).toEqual(["ana lee", "bo-chen"]);
      const saved = saveBatchGroup(run.items, app, values, new Date("2026-11-23T10:00:00Z"), new Date("2026-11-23T10:05:00Z"));
      expect(saved).toMatchObject({ ok: true, message: "Saved 2 cards to Saved Cards." });
      const list = loadSaved(mod.SAVED.storageKey);
      expect(list.map((e) => [e.name, e.filled.length])).toEqual([["bo-chen", 2], ["ana lee", 2]]);
      expect(saveBatchGroup(run.items, app, { 0: "Same", 1: "same" }, new Date(), new Date())).toMatchObject({ ok: false });
    } finally {
      g.localStorage = before;
    }
  });

  it("ships starter Read Aloud and Copy Quick Update text", async () => {
    const mod = (await import(join(dir, "App.tsx"))) as {
      spokenSummary: (r: unknown) => { text: string; lang: string };
      shareText: (r: unknown) => string;
    };
    const report = { items: [], answered: 5, total: 6, counts: { yes: 3, no: 2 }, needsReview: ["Item 4"] };
    expect(mod.spokenSummary(report)).toEqual({ text: "5 of 6 rows answered. Please check Item 4 on the paper card.", lang: "en-US" });
    expect(mod.shareText(report)).toBe("Clinic Intake update\n5 of 6 rows answered (Yes: 3, No: 2).\nTo check: Item 4.");
  });

  it("inherits multilingual print, any-script text, High-Visibility, icons and a 4-sheet pack", async () => {
    const { PRINT } = (await import(join(dir, "print.ts"))) as { PRINT: import("../../src/shell/print-slot").PrintSlot };
    const { checkPrintedText, hasColumnIcons, isWinAnsiText } = await import("../../src/core");
    expect(PRINT.languages).toEqual(["en", "te", "hi", "es"]);
    for (const language of ["te", "hi", "es"] as const)
      for (const highVisibility of [false, true])
        for (const l of PRINT.layouts({ language, highVisibility, icons: true })) {
          expect(checkPrintedText(l)).toEqual([]);
          if (language !== "es") expect(isWinAnsiText(l.groups[0].title!)).toBe(false);
        }
    expect(hasColumnIcons(PRINT.layouts({ icons: true }))).toBe(true);
    expect(PRINT.pack!.layouts({ language: "te" }, "Letter").map((l) => l.groups[0].title)).toEqual(["జాబితా 1/4", "జాబితా 2/4", "జాబితా 3/4", "జాబితా 4/4"]);
    expect(readFileSync(join(dir, "App.tsx"), "utf8")).toContain("print={PRINT}");
  });

  it("refuses to overwrite an existing app", () => {
    expect(() => createApp({ slug: "clinic-intake", displayName: "Again", appsDir })).toThrow(/already exists/);
  });

  it("validates slugs and display names with clear messages", () => {
    expect(validateSlug("clinic-intake")).toBeNull();
    expect(validateSlug("Clinic")).toMatch(/not a valid slug/);
    expect(validateSlug("a--b")).toMatch(/not a valid slug/);
    expect(validateSlug("9lives")).toMatch(/not a valid slug/);
    expect(validateSlug("core")).toMatch(/reserved/);
    expect(validateSlug("")).toMatch(/Give the app a slug/);
    expect(validateDisplayName("")).toMatch(/display name/);
    expect(validateDisplayName("Café Intake")).toBeNull();
    expect(validateDisplayName("診療")).toMatch(/cannot be printed/);
    expect(() => createApp({ slug: "Bad Slug", displayName: "X", appsDir })).toThrow(/not a valid slug/);
    expect(componentName("clinic-intake")).toBe("ClinicIntakeApp");
  });

  it("escapes display names safely into the generated code", () => {
    const r = createApp({ slug: "quote-test", displayName: 'Mo\'s "Card" \\ {x}', appsDir });
    const src = readFileSync(join(r.dir, "layout.ts"), "utf8");
    expect(src).toContain('title: "Mo\'s \\"Card\\" \\\\ {x}",');
  });
});
