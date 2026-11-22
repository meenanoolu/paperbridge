import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { renderDoctorVisitPdfWithLayout } from "../doctor-pdf";
import { addWeek, formatDoctorSummary, historyPatterns, parseHistory, trend } from "../history";
import { SAMPLE_CARD, SAMPLE_PATIENT, sampleHistory } from "../sample-history";

function drawnText(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const out: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let c: string;
    try {
      c = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      c = m[1];
    }
    for (const t of c.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out.push(Buffer.from(t[1], "hex").toString("latin1"));
  }
  return out;
}

describe("4-Week Sample History", () => {
  const NOW = new Date(2026, 10, 22, 12); // Sunday 22 Nov 2026
  const weeks = sampleHistory(NOW);

  it("seeds the 4 weeks before this one with a slipping trend and 1 hand-checked mark", () => {
    expect(weeks.map((w) => [w.weekStart, w.adherencePct, w.patientName])).toEqual([
      ["2026-10-19", 93, SAMPLE_PATIENT],
      ["2026-10-26", 86, SAMPLE_PATIENT],
      ["2026-11-02", 79, SAMPLE_PATIENT],
      ["2026-11-09", 71, SAMPLE_PATIENT],
    ]);
    expect(trend(weeks).map((t) => t.delta)).toEqual([null, -7, -7, -8]);
    expect(weeks.reduce((s, w) => s + w.manualOverrides, 0)).toBe(1);
    expect(weeks[0].doseLabels).toEqual({ Morning: "Metformin + BP Pill", Night: "Metformin" });
    expect(sampleHistory(NOW)).toEqual(weeks);
  });

  it("is valid stored history (round-trips) and merges as its own patient", () => {
    expect(parseHistory(JSON.parse(JSON.stringify(weeks)))).toEqual(weeks);
    const real = { ...weeks[0], id: "rosa|2026-10-19", patientName: "Rosa" };
    const merged = weeks.reduce((l, w) => addWeek(l, w).list, [real]);
    expect(merged).toHaveLength(5);
  });

  it("activates the evening-dose symptom pattern, the routine barrier, the summary and the PDF", async () => {
    const patterns = historyPatterns(weeks);
    expect(patterns.map((p) => p.title)).toEqual([
      "Metformin missed on 4 days when dizziness or pain was marked",
      "Metformin missed on 8 days when low energy was marked",
      "8 of 10 missed doses were Metformin",
    ]);
    const text = formatDoctorSummary(weeks, { patientName: SAMPLE_PATIENT, generatedAt: NOW, patterns });
    expect(text).toContain("## Patterns to discuss");
    expect(text).toContain("- Weekly adherence: 71% to 93%; 2 of 4 weeks below goal.");
    expect(text).toContain("- 1 unclear mark was checked by hand by the caregiver.");
    const pdf = await renderDoctorVisitPdfWithLayout({ patientName: SAMPLE_PATIENT, weeks, patterns, card: SAMPLE_CARD, generatedAt: NOW });
    expect((await PDFDocument.load(pdf.bytes)).getPageCount()).toBe(1);
    expect(pdf.rowsListed).toBe(4);
    expect(pdf.minBodyY).toBeGreaterThan(pdf.footerTop);
    expect(drawnText(pdf.bytes).join(" ")).toContain("Metformin + BP Pill · Routine: With breakfast · Looks like: Large white, white oval");
  });
});
