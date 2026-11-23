import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../scripts/lib/photo";
import { ELDER_LAYOUT, ELDER_LAYOUTS } from "../../apps/elder-care/layout";
import { decode, fiducialCenters, renderCardRaster } from "../../core";
import { APPS, DEFAULT_ACCENT, routableApps } from "../app-registry";
import { batchSummary, processBatch } from "../batch";
import { DecodePipeline } from "../components/DecodePipeline";
import { SkeletonDiagram, SkeletonGuide } from "../components/SkeletonGuide";
import { dialogKey } from "../dialog";
import { demoBatchSources, judgeScenarios } from "../judge-demo";
import { pipelineSteps } from "../pipeline";
import { offerRoutedScan, requestAutoRouteBatch, takeAutoRouteBatch, takeRoutedScan, takeRoutedView } from "../routed-scan";
import type { CompletedScan, ScanState } from "../scan";
import { unwarpRaster } from "../unwarp";
import { currentWorkspaceTab, showWorkspaceTab } from "../workspace-tabs";

const sampleFile = (src: string) => {
  // Vitest serves asset imports as "/src/apps/<app>/samples/<file>.jpg".
  const rel = src.replace(/^\//, "").split("?")[0];
  return decodeJpeg(readFileSync(join(__dirname, "../../..", rel)));
};

describe("Instant Demo scenarios", () => {
  const scenarios = judgeScenarios(APPS);

  it("offers the 3 scenarios, built from what the apps declare", () => {
    expect(scenarios.map((s) => [s.id, s.title])).toEqual([
      ["faint", "Missed-Dose + Faint Mark"],
      ["batch", "Mixed Batch (2 Apps at Once)"],
      ["clean", "Clean Week (100% Adherence)"],
    ]);
    expect(scenarios[0].refs.map((r) => [r.appId, r.sample.id])).toEqual([["elder-care", "missed-dose"]]);
    expect(scenarios[1].refs.map((r) => [r.appId, r.sample.id])).toEqual([
      ["elder-care", "missed-dose"],
      ["study-bridge", "sam-review"],
    ]);
    expect(scenarios[2].refs.map((r) => [r.appId, r.sample.id])).toEqual([["elder-care", "normal-week"]]);
  });

  it("drops a scenario whose samples are missing, and needs 2 different apps for the batch", () => {
    const one = [{ id: "a", label: "A", samples: [{ id: "x", title: "X", description: "", src: "x.jpg" }], demo: { faint: "x", batch: "x" } }];
    expect(judgeScenarios(one).map((s) => s.id)).toEqual(["faint"]);
    expect(judgeScenarios([{ ...one[0], demo: { faint: "missing" } }])).toEqual([]);
  });

  it("Missed-Dose + Faint Mark decodes the real sample with the faint mark unclear, and asks for the X-Ray", () => {
    const r = scenarios[0].refs[0];
    const raster = sampleFile(r.sample.src);
    const result = decode(raster, ELDER_LAYOUT);
    expect(result.ok && result.bubbles.filter((b) => b.state === "ambiguous").map((b) => `${b.row}/${b.col}`)).toEqual(["Wed/water"]);
    showWorkspaceTab("print");
    offerRoutedScan({ layout: ELDER_LAYOUT, result } as CompletedScan, { xray: true });
    expect(currentWorkspaceTab()).toBe("scan");
    expect(takeRoutedScan(["elder-care-weekly"])).not.toBeNull();
    expect(takeRoutedView()).toEqual({ xray: true });
    expect(takeRoutedView()).toEqual({}); // read once
  });

  it("Mixed Batch routes one Elder Care card and one Study Bridge sheet through Scan Any Card", async () => {
    const s = scenarios[1];
    const run = await processBatch(demoBatchSources(s.refs, async (r) => sampleFile(r.sample.src)), routableApps());
    expect(run.items.map((i) => [i.fileName, i.appId, i.status])).toEqual([
      ["missed-dose.jpg", "elder-care", "review"],
      ["sam-review.jpg", "study-bridge", "ready"],
    ]);
    expect(batchSummary(run)).toMatch(/^2 cards decoded locally in \d+ ms: 1 ready, 1 needs human review\.$/);
    // The strip hands files to the mounted Scan Any Card panel and shows Scan & Verify.
    showWorkspaceTab("history");
    const files = [new File(["x"], "a.jpg")];
    requestAutoRouteBatch(files);
    expect(currentWorkspaceTab()).toBe("scan");
    expect(takeAutoRouteBatch()).toBe(files);
    expect(takeAutoRouteBatch()).toBeNull();
  });

  it("Clean Week loads a 100% week", async () => {
    const r = judgeScenarios(APPS)[2].refs[0];
    const result = decode(sampleFile(r.sample.src), ELDER_LAYOUT);
    const { interpretCareCard } = await import("../../apps/elder-care/interpret");
    expect(result.ok && interpretCareCard(result).adherencePct).toBe(100);
  });
});

describe("3-step decode pipeline", () => {
  const scan = (ok: boolean): CompletedScan => ({
    source: "sample",
    label: "S",
    imageUrl: "x",
    width: 1185,
    height: 1359,
    result: ok ? { ok: true, cardId: "c", layoutVersion: 1, bubbles: [], fiducials: [] } : { ok: false, reason: "FIDUCIALS_NOT_FOUND" },
    layout: ELDER_LAYOUT,
    decodeMs: 27.6,
    scannedAt: new Date(),
  });
  const view = (state: ScanState, unclear = 0) => pipelineSteps(state, unclear).map((s) => [s.label, s.status, s.detail]);

  it("walks Photo Input -> Optical Unwarp (with the real decode time) -> Verified Output", () => {
    expect(view({ status: "idle" }).map((s) => s[1])).toEqual(["waiting", "waiting", "waiting"]);
    expect(view({ status: "busy", label: "Missed-Dose" })).toEqual([
      ["1. Photo Input", "done", "Missed-Dose"],
      ["2. Optical Unwarp", "active", "finding 4 corner markers"],
      ["3. Verified Output", "waiting", ""],
    ]);
    expect(view({ status: "done", scan: scan(true) })).toEqual([
      ["1. Photo Input", "done", "1185 x 1359 px"],
      ["2. Optical Unwarp (28 ms)", "done", "4 corner markers locked"],
      ["3. Verified Output", "done", "every mark read or checked by hand"],
    ]);
  });

  it("shows unclear marks as 'needs review' and failures as failed", () => {
    expect(view({ status: "done", scan: scan(true) }, 1)[2]).toEqual(["3. Verified Output", "review", "1 mark needs a human check"]);
    expect(view({ status: "done", scan: scan(false) }).map((s) => s[1])).toEqual(["done", "failed", "failed"]);
    expect(view({ status: "error", message: "x" })[0][1]).toBe("failed");
  });

  it("renders an ordered list, marks the current step, and names each state in words", () => {
    const html = renderToString(createElement(DecodePipeline, { steps: pipelineSteps({ status: "done", scan: scan(true) }, 1) })).replace(/<!-- -->/g, "");
    expect(html).toContain('<ol aria-label="Decode pipeline"');
    expect(html).toMatch(/aria-current="step" data-status="review"/);
    expect(html).toContain("Needs review: 1 mark needs a human check");
    expect(html).toContain("2. Optical Unwarp (28 ms)");
  });
});

describe("Raw vs. Unwarped", () => {
  it("maps the photo back onto the flat card: corner markers land at their printed positions", () => {
    const layout = ELDER_LAYOUTS[0];
    const photo = renderCardRaster(layout, new Set(["care/Mon/am"]), { rotationDeg: 12, perspective: [0.05, 0.03], scale: 1.4 });
    const result = decode(photo, layout);
    expect(result.ok).toBe(true);
    const flat = unwarpRaster(photo, result, layout, 3)!;
    expect([flat.width, flat.height]).toEqual([630, 891]);
    const lum = (xMm: number, yMm: number) => flat.data[(Math.round(yMm * 3) * flat.width + Math.round(xMm * 3)) * 4];
    for (const [x, y] of fiducialCenters(layout)) expect(lum(x, y)).toBeLessThan(60); // black centre square
    const filled = { x: 52, y: 82 }; // care/Mon/am
    expect(lum(filled.x, filled.y)).toBeLessThan(100);
    expect(lum(filled.x + 26, filled.y)).toBeGreaterThan(150); // the blank bubble next to it
    expect(unwarpRaster(photo, { ok: false, reason: "FIDUCIALS_NOT_FOUND" }, layout)).toBeNull();
  });
});

describe("App accents and the Skeleton Architecture dialog", () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

  it("Elder Care is clinical teal and Study Bridge academic indigo, both AAA with white text", () => {
    const elder = APPS.find((a) => a.id === "elder-care")!.accent!;
    const study = APPS.find((a) => a.id === "study-bridge")!.accent!;
    expect([elder.name, study.name]).toEqual(["clinical-teal", "academic-indigo"]);
    expect(contrast(elder.strong, "#ffffff")).toBeGreaterThanOrEqual(7);
    expect(contrast(study.strong, "#ffffff")).toBeGreaterThanOrEqual(7);
    // Dark text on the soft tints.
    expect(contrast(elder.soft, "#0f172a")).toBeGreaterThanOrEqual(7);
    expect(contrast(study.soft, "#0f172a")).toBeGreaterThanOrEqual(7);
    expect(DEFAULT_ACCENT.strong).toBe("#020617");
  });

  it("Escape closes; Tab and Shift+Tab wrap inside the dialog", () => {
    expect(dialogKey("Escape", false, 2, 5)).toEqual({ kind: "close" });
    expect(dialogKey("Tab", false, 4, 5)).toEqual({ kind: "focus", index: 0 });
    expect(dialogKey("Tab", true, 0, 5)).toEqual({ kind: "focus", index: 4 });
    expect(dialogKey("Tab", false, -1, 5)).toEqual({ kind: "focus", index: 0 });
    expect(dialogKey("Tab", false, 1, 5)).toBeNull(); // the browser moves normally
    expect(dialogKey("Tab", true, 3, 5)).toBeNull();
    expect(dialogKey("Enter", false, 0, 5)).toBeNull();
    expect(dialogKey("Tab", false, -1, 0)).toBeNull();
  });

  it("the header button opens a labelled dialog that shows the engine, every app, App #3 and the Crew handoff", () => {
    expect(renderToString(createElement(SkeletonGuide))).toMatch(/aria-haspopup="dialog"[^>]*>.*How the Skeleton Works<\/button>$/);
    const body = renderToString(createElement(SkeletonDiagram)).replace(/<!-- -->/g, "");
    for (const t of ["src/apps", "src/shell", "src/core", "scripts/create-app.mjs", "crew-app", "Elder Care Bridge", "Study Bridge", "App #3: npm run create-app"]) expect(body).toContain(t);
  });
});

describe("rendered controls", () => {
  it("the Instant Demo strip sits at the top of Scan & Verify, with 3 described buttons", async () => {
    const { RouteContext } = await import("../route-context");
    const { default: Study } = await import("../../apps/study-bridge/App");
    const html = renderToString(createElement(RouteContext.Provider, { value: () => {} }, createElement(Study))).replace(/<!-- -->/g, "");
    const panel = html.slice(html.indexOf('role="tabpanel"'));
    expect(panel.indexOf("Try an Instant Demo")).toBeLessThan(panel.indexOf("Scan Any Card (Auto-Route)"));
    expect(html.match(/aria-describedby="instant-demo-(faint|batch|clean)"/g)).toHaveLength(3);
    // Without the shell (no RouteContext) it renders nothing.
    expect(renderToString(createElement(Study))).not.toContain("Try an Instant Demo");
  });

  it("Raw vs. Unwarped shows the input photo and the flattened card side by side", async () => {
    const { RawUnwarpView } = await import("../components/RawUnwarpView");
    const scan = { source: "sample", label: "Missed-Dose", imageUrl: "x.jpg", width: 10, height: 10, result: { ok: true, cardId: "c", layoutVersion: 1, bubbles: [], fiducials: [] }, layout: ELDER_LAYOUT, decodeMs: 1, scannedAt: new Date() } as CompletedScan;
    const html = renderToString(createElement(RawUnwarpView, { scan })).replace(/<!-- -->/g, "");
    expect(html).toContain('alt="Raw input photo: Missed-Dose"');
    expect(html).toMatch(/<canvas role="img" aria-label="The same card after optical unwarping/);
    expect(html).toContain("Raw photo");
    expect(html).toContain("Unwarped card");
  });
});
