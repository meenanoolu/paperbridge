import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { CareCardSettings } from "../card-settings";
import { doctorPdfFileName, pdfSafe, renderDoctorVisitPdf, renderDoctorVisitPdfWithLayout, type DoctorPdfInput } from "../doctor-pdf";
import { addWeek, historyPatterns, MAX_HISTORY, type WeekEntry } from "../history";
import type { Day } from "../layout";

/** Every string pdf-lib drew, in order (hex-encoded WinAnsi text in the content streams). */
function drawnText(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const out: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      content = m[1];
    }
    for (const t of content.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out.push(Buffer.from(t[1], "hex").toString("latin1"));
  }
  return out;
}

const CARD: CareCardSettings = {
  patientName: "Rosa Martínez",
  weekStart: "2026-11-23",
  labels: { am: "Metformin 500mg", pm: "Lisinopril 10mg", water: "Water 6 cups", dizzy: "Dizzy or Pain" },
  anchors: { am: "With breakfast", pm: "After dinner" },
  cues: { am: "White oval", pm: "Small pink round" },
};

function entry(weekStart: string, adherencePct: number, missed: { day: Day; slot: "Morning" | "Night" }[], extra: Partial<WeekEntry> = {}): WeekEntry {
  return {
    id: `rosa|${weekStart}`,
    savedAt: "2026-12-07T09:00:00.000Z",
    scannedAt: `${weekStart}T10:00:00.000Z`,
    weekStart,
    patientName: "Rosa Martínez",
    adherencePct,
    taken: 14 - missed.length,
    counted: 14,
    missed,
    symptomDays: [],
    lowEnergyDays: [],
    hydrationDays: 6,
    needsReview: 0,
    manualOverrides: 0,
    doseLabels: { Morning: "Metformin 500mg", Night: "Lisinopril 10mg" },
    ...extra,
  };
}

const THREE: WeekEntry[] = [
  entry("2026-11-16", 100, []),
  entry("2026-11-23", 71, [{ day: "Tue", slot: "Night" }, { day: "Thu", slot: "Morning" }, { day: "Thu", slot: "Night" }, { day: "Sat", slot: "Night" }], {
    symptomDays: ["Thu", "Fri"],
    lowEnergyDays: ["Thu", "Sat"],
    manualOverrides: 1,
  }),
  entry("2026-11-30", 93, [{ day: "Sun", slot: "Night" }], { needsReview: 1 }),
];

const input = (weeks: WeekEntry[], over: Partial<DoctorPdfInput> = {}): DoctorPdfInput => ({
  patientName: "Rosa Martínez",
  weeks,
  patterns: historyPatterns(weeks),
  card: CARD,
  generatedAt: new Date(2026, 11, 7, 12),
  ...over,
});

async function onePage(bytes: Uint8Array) {
  expect(bytes.length).toBeGreaterThan(1000);
  expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  expect(Buffer.from(bytes.slice(-6)).toString()).toContain("%%EOF");
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(1);
  return doc;
}

describe("Doctor Visit PDF", () => {
  it("renders a one-page clinical handoff with everything the visit needs", async () => {
    const { bytes, minBodyY, footerTop, rowsListed } = await renderDoctorVisitPdfWithLayout(input(THREE));
    const doc = await onePage(bytes);
    expect(doc.getTitle()).toBe("Doctor Visit Sheet - Rosa Martínez");
    // Wrapped paragraphs are drawn line by line, so search the joined text.
    const text = drawnText(bytes).join(" ");
    const has = (t: string) => expect(text.includes(t), t).toBe(true);
    has("Patient: Rosa Martínez");
    has("Generated 7 Dec 2026. 3 weeks covered: 16 Nov - 22 Nov 2026 to 30 Nov - 6 Dec 2026.");
    has("Metformin 500mg · Routine: With breakfast · Looks like: White oval");
    has("Lisinopril 10mg · Routine: After dinner · Looks like: Small pink round");
    has("Doses taken: 37 of 42 recorded (88%). Goal: 80% or more.");
    has("Evening (Lisinopril 10mg): 4 missed (4 of 5 misses)");
    has("Morning (Metformin 500mg): 1 missed (1 of 5 misses)");
    has("4 of 5 missed doses were Lisinopril 10mg");
    has("23 Nov - 29 Nov 2026");
    has("71% (10/14) below goal");
    has("1 unclear mark was checked by hand by the caregiver; 1 was left uncounted.");
    has("no AI, no upload");
    expect(rowsListed).toBe(3);
    expect(minBodyY).toBeGreaterThan(footerTop);
  });

  it("handles an empty history", async () => {
    const bytes = await renderDoctorVisitPdf(input([]));
    await onePage(bytes);
    const text = drawnText(bytes).join("\n");
    expect(text).toContain("No weeks saved yet.");
    expect(text).toContain("0 weeks covered.");
    expect(text).not.toContain("Week by week");
  });

  it("handles a single week", async () => {
    const bytes = await renderDoctorVisitPdf(input([THREE[0]]));
    await onePage(bytes);
    const text = drawnText(bytes).join(" ");
    expect(text).toContain("1 week covered: 16 Nov - 22 Nov 2026 to 16 Nov - 22 Nov 2026.");
    expect(text).toContain("No symptom-to-miss or time-of-day patterns in these weeks.");
    expect(text).toContain("no unclear marks needed checking");
  });

  it("stays on one page with two years of weeks, listing the latest and counting the rest", async () => {
    let list: WeekEntry[] = [];
    const start = Date.UTC(2025, 0, 6);
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      const ws = new Date(start + i * 7 * 86_400_000).toISOString().slice(0, 10);
      list = addWeek(list, entry(ws, 70 + (i % 30), i % 3 ? [{ day: "Mon", slot: "Night" }] : [], { lowEnergyDays: ["Mon"] })).list;
    }
    expect(list).toHaveLength(MAX_HISTORY);
    for (const page of ["Letter", "A4"] as const) {
      const r = await renderDoctorVisitPdfWithLayout(input(list, { page }));
      await onePage(r.bytes);
      expect(r.rowsListed).toBeGreaterThan(0);
      expect(r.rowsListed).toBeLessThan(MAX_HISTORY);
      expect(r.minBodyY).toBeGreaterThan(r.footerTop);
      expect(drawnText(r.bytes).join("\n")).toContain(`${MAX_HISTORY - r.rowsListed} earlier weeks are included in the totals above but not listed.`);
    }
  });

  it("draws special characters safely and never throws", async () => {
    const odd = "Zoë O’Brien — 李 «Ⅳ» \u0007 <script>";
    const card = { ...CARD, labels: { ...CARD.labels, am: "Café “Pill” ½" }, anchors: { am: "Avant le dîner…" } };
    const weeks = [entry("2026-11-23", 50, [{ day: "Mon", slot: "Morning" }], { patientName: odd })];
    const bytes = await renderDoctorVisitPdf(input(weeks, { patientName: odd, card, patterns: [{ kind: "slot-barrier", slot: "Morning", count: 1, of: 1, title: "x".repeat(400), detail: "y ".repeat(400) }] }));
    await onePage(bytes);
    const text = drawnText(bytes).join("\n");
    expect(text).toContain("Patient: Zoë O'Brien - ? «?» <script>");
    expect(text).toContain('Café "Pill" ½ · Routine: Avant le dîner...');
    expect(pdfSafe("Zoë — 李")).toBe("Zoë - ?");
    expect(doctorPdfFileName(odd, new Date(2026, 11, 7))).toBe("doctor-visit-zoe-o-brien-script-2026-12-07.pdf");
    expect(doctorPdfFileName("Rosa Martínez", new Date(2026, 11, 7))).toBe("doctor-visit-rosa-martinez-2026-12-07.pdf");
    expect(doctorPdfFileName("", new Date(2026, 11, 7))).toBe("doctor-visit-patient-2026-12-07.pdf");
  });

  it("is deterministic", async () => {
    const a = await renderDoctorVisitPdf(input(THREE));
    const b = await renderDoctorVisitPdf(input(THREE));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});

describe("Doctor Visit PDF table", () => {
  it("never truncates week labels, adherence notes or headers", async () => {
    const weeks = [entry("2026-12-28", 79, [{ day: "Mon", slot: "Night" }, { day: "Tue", slot: "Night" }, { day: "Wed", slot: "Night" }])];
    const text = drawnText(await renderDoctorVisitPdf(input(weeks)));
    for (const t of ["28 Dec 2026 - 3 Jan 2027", "79% (11/14) below goal", "Dizzy/pain days", "Checked by hand"]) expect(text, t).toContain(t);
    expect(text.filter((s) => s.endsWith("...") )).toEqual([]);
  });
});
