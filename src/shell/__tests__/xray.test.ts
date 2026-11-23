import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../scripts/lib/photo";
import { ELDER_LAYOUT } from "../../apps/elder-care/layout";
import { STUDY_LAYOUT } from "../../apps/study-bridge/layout";
import { decode, renderCardRaster } from "../../core";
import { ScanPreview } from "../components/ScanPreview";
import { XRayDetails, XRayOverlay } from "../components/XRayOverlay";
import type { CompletedScan } from "../scan";
import { runStressTest } from "../stress-lab";
import { XRAY_STYLE, xrayModel, xrayScore, xrayState, xraySummary } from "../xray";

const photo = decodeJpeg(readFileSync(join(__dirname, "../../apps/elder-care/samples/missed-dose.jpg")));
const result = decode(photo, ELDER_LAYOUT);
if (!result.ok) throw new Error("sample did not decode");

describe("Optical X-Ray model", () => {
  const m = xrayModel(result, ELDER_LAYOUT)!;

  it("uses the decoder's own corner coordinates, bubble centres, ink densities and states, unchanged", () => {
    expect(m.corners.map((c) => [c.x, c.y])).toEqual(result.fiducials);
    expect(m.corners.map((c) => c.name)).toEqual(["top-left", "top-right", "bottom-right", "bottom-left"]);
    expect(m.bubbles).toHaveLength(result.bubbles.length);
    m.bubbles.forEach((b, i) => {
      const r = result.bubbles[i];
      expect([b.x, b.y, b.density, b.state]).toEqual([r.at[0], r.at[1], r.fill, xrayState(r.state)]);
    });
    expect(m.counts).toEqual({
      filled: result.bubbles.filter((b) => b.state === "filled").length,
      unclear: result.bubbles.filter((b) => b.state === "ambiguous").length,
      blank: result.bubbles.filter((b) => b.state === "blank").length,
    });
  });

  it("shows the Missed-Dose sample's faint mark as unclear (amber) with its score", () => {
    const unclear = m.bubbles.filter((b) => b.state === "unclear");
    expect(unclear.map((b) => b.key)).toEqual(["care/Wed/water"]);
    expect(Number(unclear[0].score)).toBeGreaterThan(0.2);
    expect(Number(unclear[0].score)).toBeLessThan(0.45);
    expect(XRAY_STYLE.unclear.ring).toBe("#f59e0b");
    expect(xrayScore(0.8449)).toBe("0.84");
    expect(xrayScore(0.03)).toBe("0.03");
  });

  it("sizes lock-on boxes and rings from the measured scale", () => {
    // The sample photo is about 2.5-3.5 px per mm; markers are 16 mm.
    expect(m.pxPerMm).toBeGreaterThan(2);
    expect(m.pxPerMm).toBeLessThan(5);
    expect(m.corners[0].size).toBeCloseTo(16 * m.pxPerMm);
    expect(m.bubbles.find((b) => b.key === "care/Mon/am")!.r).toBeCloseTo(6.5 * m.pxPerMm);
    expect(m.bubbles.find((b) => b.key === "energy/Mon/1")!.r).toBeCloseTo(4.3 * m.pxPerMm);
  });

  it("summarises counts and score ranges in words", () => {
    expect(xraySummary(m)).toMatch(/^4 corner markers locked\. \d+ filled \(0\.\d\d-[01]\.\d\d\), 1 unclear \(0\.\d\d-0\.\d\d\), \d+ blank \(0\.\d\d-0\.\d\d\)\./);
  });

  it("has nothing to show for a failed decode", () => {
    expect(xrayModel({ ok: false, reason: "FIDUCIALS_NOT_FOUND" }, ELDER_LAYOUT)).toBeNull();
  });

  it("works for any app's card: Study Bridge and the Stress-Test Lab render", () => {
    const study = decode(renderCardRaster(STUDY_LAYOUT, new Set(["answers/Q1/A"]), { rotationDeg: 5 }), STUDY_LAYOUT);
    const sm = xrayModel(study, STUDY_LAYOUT)!;
    expect(sm.counts.filled).toBe(1);
    expect(sm.bubbles.find((b) => b.key === "answers/Q1/A")).toMatchObject({ state: "filled" });
    const run = runStressTest(ELDER_LAYOUT, ["care/Mon/am"], { tiltDeg: 8, dim: 1, faint: 0.85 });
    const lab = xrayModel(run.result, ELDER_LAYOUT)!;
    expect(lab.bubbles.find((b) => b.key === "care/Mon/am")!.state).toBe("unclear");
  });
});

describe("Optical X-Ray overlay", () => {
  const m = xrayModel(result, ELDER_LAYOUT)!;
  const scan: CompletedScan = { source: "sample", label: "Missed-Dose", imageUrl: "x.jpg", width: photo.width, height: photo.height, result, layout: ELDER_LAYOUT, decodeMs: 50, scannedAt: new Date() };

  it("draws 4 green lock-on boxes and one coded ring per bubble, with filled and unclear scores always visible", () => {
    const svg = renderToString(createElement(XRayOverlay, { model: m, width: photo.width, height: photo.height }));
    expect(svg.match(/data-corner=/g)).toHaveLength(4);
    expect(svg).toContain(`viewBox="0 0 ${photo.width} ${photo.height}"`);
    expect(svg.match(/data-state="/g)).toHaveLength(m.bubbles.length);
    expect(svg).toMatch(/data-state="unclear" data-score="0\.\d\d"/);
    expect(svg).toContain('stroke="#f59e0b"');
    // Hidden until hover or focus: blank scores.
    expect(svg.match(/opacity-0 group-hover:opacity-100/g)).toHaveLength(m.counts.blank);
    const focused = renderToString(createElement(XRayOverlay, { model: m, width: photo.width, height: photo.height, focusKey: "care/Mon/water" }));
    expect(focused.match(/opacity-0 group-hover:opacity-100/g)).toHaveLength(m.counts.blank - (m.bubbles.find((b) => b.key === "care/Mon/water")!.state === "blank" ? 1 : 0));
    expect(svg).toContain('aria-hidden="true"');
  });

  it("ScanPreview swaps its plain overlay for the X-Ray only when asked, keeping the review buttons", () => {
    const off = renderToString(createElement(ScanPreview, { scan, onCycle: () => {} }));
    const on = renderToString(createElement(ScanPreview, { scan, onCycle: () => {}, xray: true })).replace(/<!-- -->/g, "");
    expect(off).not.toContain('data-testid="xray"');
    expect(on).toContain('data-testid="xray"');
    expect(on).toContain("Optical X-Ray: 4 corner markers locked.");
    expect(on).toContain("Press to mark as"); // unclear marks can still be resolved
  });

  it("gives keyboard and screen-reader users the same readings as a list", () => {
    const html = renderToString(createElement(XRayDetails, { model: m })).replace(/<!-- -->/g, "");
    expect(html).toContain(`All ${m.bubbles.length} readings`);
    expect(html).toContain("Unclear (sent to a person)");
  });
});
