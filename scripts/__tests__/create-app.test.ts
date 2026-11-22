import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM script without type declarations
import { componentName, createApp, validateDisplayName, validateSlug } from "../create-app.mjs";
import { checkLayout, type CardLayout } from "../../src/core";

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
    expect(result.files).toEqual(["layout.ts", "interpret.ts", "App.tsx", "samples/specs.ts", "samples/index.ts", "__tests__/layout.test.ts"]);
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
