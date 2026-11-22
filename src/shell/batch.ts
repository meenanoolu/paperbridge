import type { CardLayout, RasterImage, SuccessfulScan } from "../core";
import { routeRaster, ROUTE_ERROR_TEXT, type RoutableApp } from "./route";

/**
 * "Scan Any Card" batches: decode many photos locally, route each to its app by card ID, and
 * bulk-save. Everything here is pure (the clock and image loading are injected), so it is unit
 * tested without a browser. One bad file never stops the rest of the batch.
 */

/** What an app needs from each decoded item to save it in bulk. */
export interface BatchSaveItem {
  scan: SuccessfulScan;
  scannedAt: Date;
  fileName: string;
  /** The row's input value (see BatchAdapter.input), already validated. */
  value: string;
}

/**
 * An app's bulk-save hook. Apps export one in `appMeta.batch`. `save` writes the app's own
 * local storage; the app's open page picks the change up (see usePersistentState).
 */
export interface BatchAdapter {
  /** Per-row input shown before saving, e.g. the student's name or the card's week. */
  input?: { label: string; type: "text" | "date"; hint?: string };
  /** Default input values for this app's decoded rows, in batch order. */
  defaults?(items: { fileName: string }[]): string[];
  /** One problem message (or null) per row, given all of this app's values (to catch duplicates). */
  validate?(values: string[]): (string | null)[];
  /** Button text, e.g. "Save 3 cards to Multi-Week History". */
  actionLabel(count: number): string;
  /** Save the rows. Returns a confirmation sentence for the status line. */
  save(items: BatchSaveItem[], now: Date): string;
}

export interface BatchApp extends RoutableApp {
  batch?: BatchAdapter;
}

export type BatchStatus = "ready" | "review" | "error";

export interface BatchItem {
  /** Position in the batch; stable key for the UI. */
  index: number;
  fileName: string;
  status: BatchStatus;
  decodeMs: number;
  appId?: string;
  appLabel?: string;
  layout?: CardLayout;
  result?: SuccessfulScan;
  width?: number;
  height?: number;
  /** Unclear marks a person should check. */
  unclear: number;
  error?: string;
  saved?: boolean;
}

export interface BatchSource {
  name: string;
  load(): Promise<RasterImage>;
}

export interface BatchRun {
  items: BatchItem[];
  /** Total decode time (excludes reading the files). */
  decodeMs: number;
}

/** Decode every source in order. Failures become error rows; the batch always completes. */
export async function processBatch(
  sources: BatchSource[],
  apps: BatchApp[],
  opts: { clock?: () => number; onProgress?: (done: number, total: number) => void } = {},
): Promise<BatchRun> {
  const clock = opts.clock ?? (() => performance.now());
  const items: BatchItem[] = [];
  let decodeMs = 0;
  for (const [index, src] of sources.entries()) {
    let raster: RasterImage;
    try {
      raster = await src.load();
    } catch {
      items.push({ index, fileName: src.name, status: "error", decodeMs: 0, unclear: 0, error: "Could not read this file as an image." });
      opts.onProgress?.(index + 1, sources.length);
      continue;
    }
    const r = routeRaster(raster, apps, clock);
    decodeMs += r.decodeMs;
    if (r.ok) {
      const unclear = r.result.bubbles.filter((b) => b.state === "ambiguous").length;
      items.push({
        index,
        fileName: src.name,
        status: unclear ? "review" : "ready",
        decodeMs: r.decodeMs,
        appId: r.app.id,
        appLabel: r.app.label,
        layout: r.layout,
        result: r.result,
        width: raster.width,
        height: raster.height,
        unclear,
      });
    } else {
      items.push({ index, fileName: src.name, status: "error", decodeMs: r.decodeMs, unclear: 0, error: ROUTE_ERROR_TEXT[r.reason] });
    }
    opts.onProgress?.(index + 1, sources.length);
  }
  return { items, decodeMs };
}

export interface BatchCounts {
  total: number;
  decoded: number;
  ready: number;
  review: number;
  errors: number;
  saved: number;
}

export function batchCounts(items: BatchItem[]): BatchCounts {
  const n = (s: BatchStatus) => items.filter((i) => i.status === s).length;
  return { total: items.length, decoded: n("ready") + n("review"), ready: n("ready"), review: n("review"), errors: n("error"), saved: items.filter((i) => i.saved).length };
}

/** "4 cards decoded locally in 118 ms: 3 ready, 1 needs human review; 1 could not be read." */
export function batchSummary(run: BatchRun): string {
  const c = batchCounts(run.items);
  const ms = Math.round(run.decodeMs);
  if (c.decoded === 0) return c.errors === 1 ? "The photo could not be read as a PaperBridge card." : `None of the ${c.errors} photos could be read as a PaperBridge card.`;
  const parts = [`${c.ready} ready`];
  if (c.review) parts.push(`${c.review} ${c.review === 1 ? "needs" : "need"} human review`);
  const errs = c.errors ? `; ${c.errors} could not be read` : "";
  return `${c.decoded} ${c.decoded === 1 ? "card" : "cards"} decoded locally in ${ms} ms: ${parts.join(", ")}${errs}.`;
}

/** Decoded, unsaved rows of one app, in batch order. */
export function saveableFor(items: BatchItem[], appId: string): BatchItem[] {
  return items.filter((i) => i.appId === appId && i.result && !i.saved);
}

/**
 * Validate and save one app's unsaved rows. `values` are keyed by item index. Returns the new
 * items (saved rows marked) and a status message, or the per-row problems without saving.
 */
export function saveBatchGroup(
  items: BatchItem[],
  app: BatchApp,
  values: Record<number, string>,
  scannedAt: Date,
  now: Date,
): { ok: true; items: BatchItem[]; message: string } | { ok: false; problems: Record<number, string>; message: string } {
  const adapter = app.batch;
  if (!adapter) return { ok: false, problems: {}, message: `${app.label} cannot save in bulk. Open each card instead.` };
  const rows = saveableFor(items, app.id);
  const vals = rows.map((r) => values[r.index] ?? "");
  const checks = adapter.validate?.(vals) ?? vals.map(() => null);
  const problems: Record<number, string> = {};
  rows.forEach((r, k) => {
    if (checks[k]) problems[r.index] = checks[k]!;
  });
  if (Object.keys(problems).length) {
    const n = Object.keys(problems).length;
    return { ok: false, problems, message: `Fix ${n} ${n === 1 ? "row" : "rows"} before saving.` };
  }
  const message = adapter.save(
    // Distinct timestamps (1 ms apart) keep undated rows from replacing each other.
    rows.map((r, k) => ({ scan: r.result!, scannedAt: new Date(scannedAt.getTime() + r.index), fileName: r.fileName, value: vals[k] })),
    now,
  );
  const done = new Set(rows.map((r) => r.index));
  return { ok: true, items: items.map((i) => (done.has(i.index) ? { ...i, saved: true } : i)), message };
}

/** "sam-review.jpg" -> "sam-review"; used as a default student name / ID. */
export function fileStem(name: string): string {
  return name.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_]+/g, " ").trim().slice(0, 60);
}
