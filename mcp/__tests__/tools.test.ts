import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ELDER_LAYOUT } from "../../src/apps/elder-care/layout";
import { STUDY_LAYOUT } from "../../src/apps/study-bridge/layout";
import { listRegisteredApps, validateCardLayout } from "../tools";

const REPO = resolve(__dirname, "../..");

describe("validate_card_layout", () => {
  it("passes a valid layout, given as an object or a JSON string", () => {
    for (const input of [ELDER_LAYOUT, JSON.stringify(STUDY_LAYOUT)]) {
      const r = validateCardLayout(input);
      expect(r.ok).toBe(true);
      expect(r.errors).toEqual([]);
    }
    expect(validateCardLayout(STUDY_LAYOUT).summary).toBe("PASS: 50 bubbles in 1 group on A4 satisfy every PaperBridge geometric invariant.");
  });

  it("fails overlapping bubbles with a clear message", () => {
    const l = structuredClone(STUDY_LAYOUT);
    l.groups[0].pitchMm = [10, 18]; // radius 5.5: 10 mm apart overlap
    const r = validateCardLayout(l);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toEqual({
      code: "BUBBLE_OVERLAP",
      bubbles: ["answers/Q1/A", "answers/Q1/B"],
      message: "Bubbles answers/Q1/A and answers/Q1/B are 10 mm apart (centres); they need at least 12.1 mm and currently overlap.",
    });
    expect(r.summary).toMatch(/^FAIL: \d+ problems \(BUBBLE_OVERLAP x\d+\)\.\n- Bubbles answers\/Q1\/A and answers\/Q1\/B/);
  });

  it("fails a fiducial collision with a clear message", () => {
    const l = structuredClone(STUDY_LAYOUT);
    l.groups[0].rows = ["Q1"];
    l.groups[0].originMm = [16, 18]; // first bubble on top of the top-left corner marker
    const r = validateCardLayout(l);
    expect(r.errors.map((e) => e.code)).toContain("FIDUCIAL_OVERLAP");
    expect(r.errors.find((e) => e.code === "FIDUCIAL_OVERLAP")!.message).toBe(
      "Bubble answers/Q1/A at (16, 18) mm is inside the top-left corner marker's quiet zone (marker centre (14, 14) mm, keep 11 mm + radius clear).",
    );
  });

  it("reports bad JSON and wrong shapes instead of throwing", () => {
    expect(validateCardLayout("{not json").errors[0]).toMatchObject({ code: "INVALID_SHAPE", path: "$" });
    expect(validateCardLayout({ id: "x" }).errors.map((e) => e.path)).toEqual(["title", "version", "page", "fiducial", "groups"]);
  });
});

describe("list_registered_apps", () => {
  it("lists the shipped apps with their layout metadata", async () => {
    const apps = await listRegisteredApps(join(REPO, "src/apps"));
    expect(apps.map((a) => ({ slug: a.slug, label: a.label, cardId: a.cardId, pages: a.pages, bubbles: a.bubbles, ok: a.layoutOk, photos: a.samplePhotos, problems: a.problems }))).toEqual([
      { slug: "elder-care", label: "Elder Care Bridge", cardId: "elder-care-weekly", pages: ["A4", "Letter"], bubbles: 63, ok: true, photos: 3, problems: [] },
      { slug: "seance-cipher", label: "Seance Cipher", cardId: "seance-cipher", pages: ["A4", "Letter"], bubbles: 12, ok: true, photos: 6, problems: [] },
      { slug: "study-bridge", label: "Study Bridge", cardId: "study-mcq-10", pages: ["A4", "Letter"], bubbles: 50, ok: true, photos: 2, problems: [] },
    ]);
    expect(apps[0].groups).toEqual([
      { key: "care", rows: 7, cols: 4 },
      { key: "energy", rows: 7, cols: 5 },
    ]);
  });

  const tmp = mkdtempSync(join(tmpdir(), "pb-mcp-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("flags unregistered apps, missing layouts, and broken layouts", async () => {
    const apps = join(tmp, "src/apps");
    mkdirSync(join(apps, "half-done"), { recursive: true });
    mkdirSync(join(apps, "no-meta"), { recursive: true });
    symlinkSync(join(REPO, "src/core"), join(tmp, "src/core"), "dir");
    writeFileSync(join(apps, "half-done/App.tsx"), 'export const appMeta = { id: "half-done", label: "Half \\"Done\\"", icon: "book" };\n');
    writeFileSync(join(apps, "no-meta/App.tsx"), "export default function X() { return null; }\n");
    writeFileSync(
      join(apps, "no-meta/layout.ts"),
      `export const LAYOUT = ${JSON.stringify({ ...STUDY_LAYOUT, id: "no-meta", groups: [{ ...STUDY_LAYOUT.groups[0], pitchMm: [5, 18] }] })};\n`,
    );
    const r = await listRegisteredApps(apps);
    expect(r.map((a) => [a.slug, a.label, a.registered, a.layoutOk, a.problems])).toEqual([
      ["half-done", 'Half "Done"', true, false, ["missing layout.ts"]],
      ["no-meta", null, false, false, ["App.tsx does not export appMeta, so the app is not in the switcher"]],
    ]);
    expect(r[1].layoutErrors).toBeGreaterThan(0);
  });
});
