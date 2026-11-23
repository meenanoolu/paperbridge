import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bubbleKey, decode, renderCardRaster, type SuccessfulScan } from "../../core";
import { TEST_LAYOUT } from "../../core/testing/fixtures";
import { processBatch, saveBatchGroup } from "../batch";
import { addSaved, loadSaved, localBatchAdapter, parseSavedScans, savedAsScan, saveOne, toSavedScan, validateSavedName } from "../local-batch";
import { storageKey } from "../storage";

const OPTS = { storageKey: "demo.saved", noun: ["form", "forms"] as [string, string], place: "Saved Forms" };
const marks = (keys: string[]) => {
  const r = decode(renderCardRaster(TEST_LAYOUT, new Set(keys)), TEST_LAYOUT);
  if (!r.ok) throw new Error(r.reason);
  return r as SuccessfulScan;
};

const store = new Map<string, string>();
const g = globalThis as { localStorage?: unknown };
let before: unknown;
beforeEach(() => {
  store.clear();
  before = g.localStorage;
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
});
afterEach(() => {
  g.localStorage = before;
});

describe("generic localStorage batch save", () => {
  it("stores marks (not a report), one entry per name, newest first", () => {
    const a = toSavedScan(" Ana Lee ", marks(["grid/r1/c1", "grid/r2/c3"]), new Date("2026-11-23T10:00:00Z"), new Date("2026-11-23T10:01:00Z"));
    expect(a).toMatchObject({ id: "ana lee", name: "Ana Lee", cardId: "test-card", filled: ["grid/r1/c1", "grid/r2/c3"], unclear: [] });
    const b = { ...a, id: "bo", name: "Bo" };
    let r = addSaved([], a);
    r = addSaved(r.list, b);
    expect(r.list.map((e) => e.name)).toEqual(["Bo", "Ana Lee"]);
    r = addSaved(r.list, { ...a, filled: [] });
    expect(r).toMatchObject({ replaced: true });
    expect(r.list.map((e) => [e.name, e.filled.length])).toEqual([["Ana Lee", 0], ["Bo", 0 + 2]]);
  });

  it("parses stored data defensively", () => {
    expect(parseSavedScans("x")).toBeNull();
    const ok = toSavedScan("A", marks([]), new Date(), new Date());
    expect(parseSavedScans([ok, { id: 1 }, null, { ...ok, filled: [3] }])).toEqual([ok]);
    expect(validateSavedName("  ")).toMatch(/Enter/);
    expect(validateSavedName("x".repeat(61))).toMatch(/at most 60/);
  });

  it("is a complete Scan Any Card adapter: defaults from file names, duplicate check, bulk save", async () => {
    const adapter = localBatchAdapter(OPTS);
    expect(adapter.actionLabel(1)).toBe("Save 1 form to Saved Forms");
    expect(adapter.validate!(["Ana", " ana ", ""])).toEqual([null, "Same name as another form in this batch.", "Enter a name or ID."]);
    const app = { id: "demo", label: "Demo", layouts: [TEST_LAYOUT], batch: adapter };
    const run = await processBatch(
      [
        { name: "ana_lee.png", load: async () => renderCardRaster(TEST_LAYOUT, new Set(["grid/r1/c1"])) },
        { name: "bo.jpg", load: async () => renderCardRaster(TEST_LAYOUT, new Set(["grid/r3/c2", "grid/r4/c2"])) },
      ],
      [app],
    );
    const values = { 0: adapter.defaults!(run.items)[0], 1: adapter.defaults!(run.items)[1] };
    expect(values).toEqual({ 0: "ana lee", 1: "bo" });
    const r = saveBatchGroup(run.items, app, values, new Date("2026-11-23T10:00:00Z"), new Date("2026-11-23T10:05:00Z"));
    expect(r).toMatchObject({ ok: true, message: "Saved 2 forms to Saved Forms." });
    expect(JSON.parse(store.get(storageKey("demo.saved"))!).map((e: { name: string }) => e.name)).toEqual(["bo", "ana lee"]);
    expect(adapter.save([{ scan: marks([]), scannedAt: new Date(), fileName: "x", value: "bo" }], new Date())).toBe("Saved 1 form to Saved Forms (1 replaced an earlier form).");
  });

  it("single save, reload and re-interpretation", () => {
    const scan = marks(["grid/r1/c1", "scale/e2/5"]);
    expect(saveOne(OPTS, "", scan, new Date(), new Date())).toEqual({ ok: false, message: "Enter a name or ID." });
    expect(saveOne(OPTS, "Ana", scan, new Date(), new Date())).toEqual({ ok: true, message: "Saved Ana in Saved Forms." });
    expect(saveOne(OPTS, "ana", scan, new Date(), new Date())).toEqual({ ok: true, message: "Updated ana in Saved Forms." });
    const [e] = loadSaved(OPTS.storageKey);
    const back = savedAsScan(e, TEST_LAYOUT);
    expect(back.bubbles).toHaveLength(scan.bubbles.length);
    expect(back.bubbles.filter((b) => b.state === "filled").map((b) => bubbleKey(b.group, b.row, b.col))).toEqual(["grid/r1/c1", "scale/e2/5"]);
    expect(back.bubbles.every((b) => b.state !== "ambiguous")).toBe(true);
  });

  it("reports blocked storage instead of throwing", () => {
    g.localStorage = { getItem: () => null, setItem: () => { throw new Error("full"); }, removeItem: () => undefined };
    expect(saveOne(OPTS, "Ana", marks([]), new Date(), new Date())).toEqual({ ok: false, message: "Could not save: this browser blocked storage." });
  });
});
