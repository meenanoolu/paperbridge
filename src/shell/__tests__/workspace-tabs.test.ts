import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceTabs } from "../components/WorkspaceTabs";
import { offerRoutedScan, takeRoutedScan } from "../routed-scan";
import { clearSessionState, sessionRef } from "../session-state";
import { fitText } from "../text-image";
import { currentWorkspaceTab, nextTabIndex, showWorkspaceTab, WORKSPACE_TABS } from "../workspace-tabs";

describe("3-tab workspace", () => {
  it("has Scan & Verify first (the default), then Print Cards and History & Export", () => {
    expect(WORKSPACE_TABS.map((t) => t.label)).toEqual(["Scan & Verify", "Print Cards", "History & Export"]);
    expect(currentWorkspaceTab()).toBe("scan");
  });

  it("follows the ARIA tabs keyboard model: arrows wrap, Home/End jump, Tab is left to the browser", () => {
    expect(nextTabIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextTabIndex(2, "ArrowRight", 3)).toBe(0);
    expect(nextTabIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(nextTabIndex(1, "Home", 3)).toBe(0);
    expect(nextTabIndex(0, "End", 3)).toBe(2);
    expect(nextTabIndex(1, "Tab", 3)).toBeNull();
    expect(nextTabIndex(1, "Enter", 3)).toBeNull();
  });

  it("renders a tablist with one tab stop, linked tabs and panels, and keeps hidden panels mounted", () => {
    const html = renderToString(
      createElement(WorkspaceTabs, {
        scope: "demo",
        active: "print",
        labels: { history: "Class Sheet & Export" },
        intro: createElement("h1", null, "Demo"),
        panels: { scan: createElement("p", null, "SCAN"), print: createElement("p", null, "PRINT"), history: createElement("p", null, "HISTORY") },
      }),
    );
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(3);
    expect(html).toMatch(/id="demo-tab-print"[^>]*aria-selected="true"[^>]*aria-controls="demo-panel-print"[^>]*tabindex="0"/);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
    expect(html).toContain("Class Sheet &amp; Export");
    // Inactive panels are hidden but still rendered, so a scan or a form survives switching tabs.
    for (const t of ["SCAN", "PRINT", "HISTORY"]) expect(html).toContain(t);
    expect(html).toMatch(/id="demo-panel-scan"[^>]*hidden=""/);
    expect(html).not.toMatch(/id="demo-panel-print"[^>]*hidden/);
  });

  it("a routed scan (Scan Any Card or a batch Review) switches back to Scan & Verify", () => {
    showWorkspaceTab("history");
    expect(currentWorkspaceTab()).toBe("history");
    offerRoutedScan({ layout: { id: "x" } } as never);
    expect(currentWorkspaceTab()).toBe("scan");
    expect(takeRoutedScan(["x"])).not.toBeNull();
  });

  it("keeps Scan Any Card state for the page session, across app switches", () => {
    clearSessionState();
    const a = sessionRef("files", [] as string[]);
    a.current.push("rosa.jpg");
    expect(sessionRef("files", [] as string[]).current).toEqual(["rosa.jpg"]);
    clearSessionState();
    expect(sessionRef("files", [] as string[]).current).toEqual([]);
  });
});

describe("any-script text images", () => {
  const box = { widthMm: 20, heightMm: 4.9, baselineMm: 3.75, align: "middle" as const };
  it("keeps the font's baseline when the text fits", () => {
    const f = fitText(box, { width: 300, ascent: 80, descent: 20 }, 24);
    expect(f).toMatchObject({ scale: 1, width: 480, height: 118, baseline: 90 });
    expect(f.x).toBe(90);
  });

  it("shrinks text that is wider or taller than its measured box, so it never leaves it", () => {
    const wide = fitText({ ...box, align: "start" }, { width: 960, ascent: 80, descent: 20 }, 24);
    expect(wide.scale).toBe(0.5);
    expect(wide.x).toBe(0);
    const tall = fitText({ ...box, align: "end" }, { width: 200, ascent: 150, descent: 86 }, 24);
    expect(tall.scale).toBeCloseTo(118 / 236);
    expect(tall.baseline - 150 * tall.scale).toBeGreaterThanOrEqual(0);
    expect(tall.baseline + 86 * tall.scale).toBeLessThanOrEqual(tall.height + 1e-9);
    expect(tall.x + 200 * tall.scale).toBeCloseTo(480);
  });
});
