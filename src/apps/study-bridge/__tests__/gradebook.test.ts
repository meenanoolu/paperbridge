import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { decode } from "../../../core";
import { RouteContext } from "../../../shell/route-context";
import { StudyBridgeApp } from "../App";
import { DEFAULT_EDITABLE_KEY, toAnswerKey } from "../answer-key";
import { GRADE_CSS, HAND, RULED_STYLE, Telemetry, TopicMastery } from "../components/Studio";
import { gradeSheet } from "../grade";
import { STUDY_LAYOUT } from "../layout";

const strip = (h: string) => h.replace(/<!-- -->/g, "");
const text = (h: string) => strip(h).replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const EM_DASH = /[\u2013\u2014]/;
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe("the teacher's gradebook", () => {
  const html = strip(renderToString(createElement(RouteContext.Provider, { value: () => undefined }, createElement(StudyBridgeApp))));

  it("is ruled paper (#FCFBF7) with blue rules, a red margin line and binder holes", () => {
    expect(html).toMatch(/^(<link[^>]*>)*<div class="grade-book relative [^"]*bg-\[#FCFBF7\][^"]*" style="[^"]*" data-frontend="study-bridge"/);
    expect(RULED_STYLE.backgroundImage).toMatch(/repeating-linear-gradient\(to bottom, transparent 0 31px, rgba\(96,150,210,0\.26\) 31px 32px\)/);
    expect(html).toContain("border-l-[3px] border-[#d64545]");
    expect((html.match(/rounded-full bg-\[#2b2f3a\]/g) ?? []).length).toBe(3);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(text(html)).toContain("Teacher's gradebook");
    expect(html).not.toContain("bg-[#3730A3] text-white on-dark"); // the old indigo banner is gone
    expect(text(html)).not.toMatch(EM_DASH);
  });

  it("keeps the 3 workspace tabs, styled as notebook dividers, and the score telemetry", () => {
    expect(html).toContain('aria-label="Score telemetry"');
    for (const tab of ["Live Scan", "Print Studio", "Gradebook"]) expect(text(html)).toContain(tab);
    expect(html.match(/role="tab" aria-selected/g)).toHaveLength(3);
    expect(GRADE_CSS).toMatch(/\[role="tab"\] \{ border-radius: 14px 14px 0 0;/);
    expect(GRADE_CSS).toMatch(/\[aria-selected="true"\] \{[^}]*color: #9b1c1c/);
    expect(GRADE_CSS).not.toMatch(/outline/);
  });

  it("stamps the telemetry in red, blue and green ink, tilted a little, with tabular numbers", () => {
    const t = strip(renderToString(createElement(Telemetry, { items: [{ label: "Score", value: "60%", tone: "red" }, { label: "Correct", value: "6/10", tone: "blue" }, { label: "Decode", value: "9 ms", tone: "green" }] })));
    expect(t).toContain('data-ink="red"');
    expect(t).toContain("border-[#9b1c1c] text-[#9b1c1c]");
    expect(t).toContain("border-[#1e3a8a] text-[#1e3a8a]");
    expect(t).toContain("border-[#14532d] text-[#14532d]");
    expect(t).toContain("tabular-nums");
    expect(t.match(/rotate\(-?[\d.]+deg\)/g)).toHaveLength(3);
    expect(text(t)).toContain("Score 60% Correct 6/10 Decode 9 ms");
    expect(HAND).toMatch(/Segoe Print/);
  });

  it("marks topics with highlighter: yellow when mastered, pink when it needs review, and says so in words", () => {
    const scan = decode(decodeJpeg(readFileSync(join(__dirname, "../samples/sam-review.jpg"))), STUDY_LAYOUT);
    if (!scan.ok) throw new Error("sample");
    const report = gradeSheet(scan, toAnswerKey(DEFAULT_EDITABLE_KEY), new Date(2026, 10, 27));
    const m = strip(renderToString(createElement(TopicMastery, { report })));
    expect(report.topics.some((t) => t.weak)).toBe(true);
    for (const t of report.topics) {
      const li = new RegExp(`<li data-topic="${t.topic}" data-weak="${t.weak ? "yes" : "no"}">[\\s\\S]*?</li>`).exec(m)![0];
      expect(li).toContain(t.weak ? 'data-marker="weak"' : 'data-marker="mastered"');
      expect(li).toContain(t.weak ? "background:#fda4af" : "background:#fde047");
      expect(li).toContain(`width:${Math.max(6, t.pct)}%`);
      expect(text(li)).toContain(`${t.correct}/${t.total} (${t.pct}%) ${t.weak ? "Review" : "Mastered"}`);
      expect(li).toContain('aria-hidden="true"'); // the bar is decoration; the numbers are the content
    }
    expect(m).toContain("-skew-x-6");
    expect(m).toContain("mix-blend-multiply");
    expect(text(m)).not.toMatch(EM_DASH);
  });

  it("is readable: every ink is at least 7:1 on the paper", () => {
    for (const [what, ink] of [["red", "#9b1c1c"], ["blue", "#1e3a8a"], ["green", "#14532d"], ["slate", "#1e293b"], ["body", "#0f172a"]] as const) expect(contrast(ink, "#FCFBF7"), what).toBeGreaterThanOrEqual(7);
    expect(contrast("#1e293b", "#fde047")).toBeGreaterThanOrEqual(7); // text beside a highlighter stays on the paper, but is readable on it too
    expect(contrast("#1e293b", "#fda4af")).toBeGreaterThanOrEqual(7);
  });
});
