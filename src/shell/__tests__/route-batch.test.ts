import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeJpeg, encodeJpeg, photographSample } from "../../../scripts/lib/photo";
import { ELDER_BATCH } from "../../apps/elder-care/batch";
import { ELDER_LAYOUTS } from "../../apps/elder-care/layout";
import { ELDER_SAMPLE_SPECS } from "../../apps/elder-care/samples/specs";
import { CARE_SETTINGS_KEY, HISTORY_KEY } from "../../apps/elder-care/storage-keys";
import { STUDY_BATCH } from "../../apps/study-bridge/batch";
import { STUDY_LAYOUTS } from "../../apps/study-bridge/layout";
import { STUDY_SAMPLE_SPECS } from "../../apps/study-bridge/samples/specs";
import { CLASS_STORAGE } from "../../apps/study-bridge/storage-keys";
import { decode, renderCardRaster, type RasterImage } from "../../core";
import { TEST_LAYOUT } from "../../core/testing/fixtures";
import { APPS, routableApps } from "../app-registry";
import { batchCounts, batchSummary, fileStem, processBatch, saveableFor, saveBatchGroup, type BatchApp, type BatchSource } from "../batch";
import { appForCardId, decodeBestFit, routeRaster } from "../route";
import { storageKey } from "../storage";

const ELDER: BatchApp = { id: "elder-care", label: "Elder Care Bridge", layouts: ELDER_LAYOUTS, batch: ELDER_BATCH };
const STUDY: BatchApp = { id: "study-bridge", label: "Study Bridge", layouts: STUDY_LAYOUTS, batch: STUDY_BATCH };
const APPS2 = [ELDER, STUDY];

const jpg = (app: string, file: string) => decodeJpeg(readFileSync(join(__dirname, "../../apps", app, "samples", file)));
const blank = (): RasterImage => ({ width: 320, height: 240, data: new Uint8ClampedArray(320 * 240 * 4).fill(200) });
/** A clock that advances 10 ms per call, so timing is deterministic. */
const fakeClock = () => {
  let t = 0;
  return () => (t += 10);
};

describe("card-ID lookup", () => {
  it("finds the app that owns a card ID, or none", () => {
    expect(appForCardId("elder-care-weekly", APPS2)?.id).toBe("elder-care");
    expect(appForCardId("study-mcq-10", APPS2)?.id).toBe("study-bridge");
    expect(appForCardId("test-card", APPS2)).toBeNull();
  });

  it("the registry exposes every shipped app's layouts for routing", () => {
    expect(routableApps().map((a) => [a.id, a.layouts.map((l) => `${l.id}/${l.page}`)])).toEqual([
      ["elder-care", ["elder-care-weekly/A4", "elder-care-weekly/Letter"]],
      ["study-bridge", ["study-mcq-10/A4", "study-mcq-10/Letter"]],
    ]);
    expect(APPS.find((a) => a.id === "elder-care")?.batch).toBe(ELDER_BATCH);
  });
});

describe("routeRaster", () => {
  it("routes real sample photos to their app", () => {
    expect(routeRaster(jpg("elder-care", "missed-dose.jpg"), APPS2)).toMatchObject({ ok: true, app: { id: "elder-care" }, layout: { page: "A4" } });
    expect(routeRaster(jpg("study-bridge", "sam-review.jpg"), APPS2)).toMatchObject({ ok: true, app: { id: "study-bridge" }, layout: { page: "A4" } });
  });

  it("picks the printed paper size: Letter cards decode with the Letter layout, not A4", () => {
    for (const [specs, layouts] of [
      [ELDER_SAMPLE_SPECS, ELDER_LAYOUTS],
      [STUDY_SAMPLE_SPECS, STUDY_LAYOUTS],
    ] as const)
      for (const spec of specs)
        for (const printed of layouts) {
          const photo = decodeJpeg(encodeJpeg(photographSample(printed, spec)));
          const r = routeRaster(photo, APPS2);
          expect({ spec: spec.id, page: r.ok && r.layout.page }).toEqual({ spec: spec.id, page: printed.page });
          // And the bubbles equal decoding with the right layout directly.
          if (r.ok) expect(r.result).toEqual(decode(photo, printed));
        }
  });

  it("regression: decodeBestFit (used by every app's upload and webcam) no longer reads a Letter card with the A4 layout", () => {
    const spec = ELDER_SAMPLE_SPECS[2];
    const photo = decodeJpeg(encodeJpeg(photographSample(ELDER_LAYOUTS[1], spec)));
    expect(decode(photo, ELDER_LAYOUTS[0]).ok).toBe(true); // the A4 layout "succeeds"...
    const { layout, result } = decodeBestFit(photo, ELDER_LAYOUTS);
    expect(layout.page).toBe("Letter"); // ...but the Letter layout fits better and wins
    expect(result.ok && result.bubbles.filter((b) => b.state === "ambiguous")).toEqual([]);
  });

  it("reports an unknown card ID and missing corner markers without guessing", () => {
    expect(routeRaster(renderCardRaster(TEST_LAYOUT, new Set()), APPS2)).toMatchObject({ ok: false, reason: "UNKNOWN_CARD" });
    expect(routeRaster(blank(), APPS2)).toMatchObject({ ok: false, reason: "FIDUCIALS_NOT_FOUND" });
    expect(routeRaster(jpg("elder-care", "normal-week.jpg"), [STUDY])).toMatchObject({ ok: false, reason: "UNKNOWN_CARD" });
  });
});

describe("processBatch", () => {
  const sources = (): BatchSource[] => [
    { name: "week-1.jpg", load: async () => jpg("elder-care", "normal-week.jpg") },
    { name: "week-2.jpg", load: async () => jpg("elder-care", "missed-dose.jpg") }, // 1 unclear mark
    { name: "sam_ortiz.jpg", load: async () => jpg("study-bridge", "sam-review.jpg") },
    { name: "receipt.png", load: async () => blank() },
    { name: "other-card.jpg", load: async () => renderCardRaster(TEST_LAYOUT, new Set()) },
    { name: "broken.heic", load: async () => Promise.reject(new Error("unsupported")) },
  ];

  it("decodes a mixed batch in order, isolating failures per file", async () => {
    const progress: number[] = [];
    const run = await processBatch(sources(), APPS2, { clock: fakeClock(), onProgress: (d) => progress.push(d) });
    expect(run.items.map((i) => [i.fileName, i.status, i.appId ?? null, i.unclear])).toEqual([
      ["week-1.jpg", "ready", "elder-care", 0],
      ["week-2.jpg", "review", "elder-care", 1],
      ["sam_ortiz.jpg", "ready", "study-bridge", 0],
      ["receipt.png", "error", null, 0],
      ["other-card.jpg", "error", null, 0],
      ["broken.heic", "error", null, 0],
    ]);
    expect(run.items[3].error).toMatch(/corner squares/);
    expect(run.items[4].error).toMatch(/unknown card ID/);
    expect(run.items[5].error).toBe("Could not read this file as an image.");
    expect(progress).toEqual([1, 2, 3, 4, 5, 6]);
    expect(run.decodeMs).toBe(run.items.reduce((s, i) => s + i.decodeMs, 0));
    expect(run.decodeMs).toBeGreaterThan(0);
  });

  it("summarizes counts and timing", async () => {
    const run = await processBatch(sources().slice(0, 3), APPS2, { clock: fakeClock() });
    expect(batchCounts(run.items)).toEqual({ total: 3, decoded: 3, ready: 2, review: 1, errors: 0, saved: 0 });
    expect(batchSummary({ ...run, decodeMs: 117.6 })).toBe("3 cards decoded locally in 118 ms: 2 ready, 1 needs human review.");
    const all = await processBatch(sources(), APPS2, { clock: fakeClock() });
    expect(batchSummary({ ...all, decodeMs: 240 })).toBe("3 cards decoded locally in 240 ms: 2 ready, 1 needs human review; 3 could not be read.");
    expect(batchSummary({ items: [all.items[3]], decodeMs: 5 })).toBe("The photo could not be read as a PaperBridge card.");
    expect(batchSummary({ items: all.items.slice(3), decodeMs: 5 })).toBe("None of the 3 photos could be read as a PaperBridge card.");
  });

  it("turns file names into default student IDs", () => {
    expect(fileStem("sam_ortiz.JPG")).toBe("sam ortiz");
    expect(fileStem("S-1042.jpeg")).toBe("S-1042");
  });
});

describe("bulk save", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  });
  afterEach(() => delete (globalThis as { localStorage?: unknown }).localStorage);
  const read = (k: string) => JSON.parse(store.get(storageKey(k)) ?? "null");

  it("saves Elder Care cards as consecutive weeks for the saved patient, and marks them saved", async () => {
    store.set(storageKey(CARE_SETTINGS_KEY), JSON.stringify({ patientName: "Rosa", weekStart: "2026-11-02", labels: { am: "Metformin", pm: "BP Pill", water: "Water", dizzy: "Dizzy or Pain" } }));
    const run = await processBatch(
      [
        { name: "a.jpg", load: async () => jpg("elder-care", "normal-week.jpg") },
        { name: "b.jpg", load: async () => jpg("elder-care", "missed-dose.jpg") },
        { name: "c.jpg", load: async () => jpg("study-bridge", "alex-strong.jpg") },
      ],
      APPS2,
    );
    const rows = saveableFor(run.items, "elder-care");
    expect(rows.map((r) => r.fileName)).toEqual(["a.jpg", "b.jpg"]);
    expect(ELDER_BATCH.defaults!(rows)).toEqual(["2026-11-02", "2026-11-09"]);

    // Same week twice is refused, nothing is written.
    const dup = saveBatchGroup(run.items, ELDER, { 0: "2026-11-02", 1: "2026-11-04" }, new Date("2026-11-30T10:00:00Z"), new Date());
    expect(dup).toMatchObject({ ok: false, problems: { 1: "Same week as another card in this batch." }, message: "Fix 1 row before saving." });
    expect(read(HISTORY_KEY)).toBeNull();

    const ok = saveBatchGroup(run.items, ELDER, { 0: "2026-11-02", 1: "2026-11-09" }, new Date("2026-11-30T10:00:00Z"), new Date());
    expect(ok).toMatchObject({ ok: true, message: "Saved 2 weeks to Multi-Week History for Rosa." });
    const history = read(HISTORY_KEY);
    expect(history.map((w: { weekStart: string; adherencePct: number; patientName: string; needsReview: number }) => [w.weekStart, w.adherencePct, w.patientName, w.needsReview])).toEqual([
      ["2026-11-02", 100, "Rosa", 0],
      ["2026-11-09", 71, "Rosa", 1],
    ]);
    expect(history[1].doseLabels).toEqual({ Morning: "Metformin", Night: "BP Pill" });
    if (!ok.ok) return;
    expect(batchCounts(ok.items).saved).toBe(2);
    expect(saveableFor(ok.items, "elder-care")).toEqual([]);
    expect(saveableFor(ok.items, "study-bridge").map((r) => r.fileName)).toEqual(["c.jpg"]);

    // Saving the same weeks again replaces them instead of duplicating.
    const again = saveBatchGroup(run.items, ELDER, { 0: "2026-11-02", 1: "2026-11-09" }, new Date("2026-12-01T10:00:00Z"), new Date());
    expect(again).toMatchObject({ ok: true, message: "Saved 2 weeks to Multi-Week History for Rosa (2 replaced an earlier save)." });
    expect(read(HISTORY_KEY)).toHaveLength(2);
  });

  it("undated Elder Care cards in one batch do not replace each other", async () => {
    const run = await processBatch(
      [0, 1, 2].map((i) => ({ name: `${i}.jpg`, load: async () => jpg("elder-care", "normal-week.jpg") })),
      APPS2,
    );
    expect(saveBatchGroup(run.items, ELDER, {}, new Date("2026-11-30T10:00:00Z"), new Date()).ok).toBe(true);
    expect(read(HISTORY_KEY)).toHaveLength(3);
  });

  it("adds Study Bridge sheets to the Class Sheet under each row's name", async () => {
    const run = await processBatch(
      [
        { name: "alex_kim.jpg", load: async () => jpg("study-bridge", "alex-strong.jpg") },
        { name: "sam.jpg", load: async () => jpg("study-bridge", "sam-review.jpg") },
      ],
      APPS2,
    );
    const rows = saveableFor(run.items, "study-bridge");
    expect(STUDY_BATCH.defaults!(rows)).toEqual(["alex kim", "sam"]);
    const bad = saveBatchGroup(run.items, STUDY, { 0: "Alex", 1: " alex " }, new Date(), new Date());
    expect(bad).toMatchObject({ ok: false, problems: { 1: "Same student as another sheet in this batch." } });
    expect(saveBatchGroup(run.items, STUDY, { 0: "", 1: "Sam" }, new Date(), new Date())).toMatchObject({ ok: false, problems: { 0: "Enter the student's name or ID." } });
    const ok = saveBatchGroup(run.items, STUDY, { 0: "Alex Kim", 1: "Sam Ortiz" }, new Date("2026-11-30T10:00:00Z"), new Date());
    expect(ok).toMatchObject({ ok: true, message: "Added 2 sheets to the Class Sheet." });
    expect(read(CLASS_STORAGE).map((e: { student: string }) => e.student)).toEqual(["Alex Kim", "Sam Ortiz"]);
  });

  it("apps without a batch adapter explain how to save instead", async () => {
    const plain: BatchApp = { id: "plain", label: "Plain App", layouts: [TEST_LAYOUT] };
    expect(saveBatchGroup([], plain, {}, new Date(), new Date())).toEqual({ ok: false, problems: {}, message: "Plain App cannot save in bulk. Open each card instead." });
  });
});
