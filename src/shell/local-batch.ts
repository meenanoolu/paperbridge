import { bubbleCenters, bubbleKey, type CardLayout, type SuccessfulScan } from "../core";
import { fileStem, type BatchAdapter } from "./batch";
import { loadJson, saveJson } from "./storage";

/**
 * Generic "saved cards" list in this browser's localStorage, plus a ready-made Scan Any Card
 * batch adapter for it. Any app gets single and bulk save with no storage code of its own: the
 * marks are stored (not a report), so the app can re-interpret saved cards after you change
 * interpret.ts. Scaffolded apps use this by default.
 */
export interface SavedScan {
  /** Normalized name: one entry per name (a later save replaces it). */
  id: string;
  name: string;
  cardId: string;
  scannedAt: string;
  savedAt: string;
  /** Bubble keys (`group/row/col`) read as filled, and those still unclear. */
  filled: string[];
  unclear: string[];
}

export const MAX_SAVED = 500;
export const MAX_NAME = 60;

export const savedId = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export function validateSavedName(name: string): string | null {
  const t = name.trim();
  if (!t) return "Enter a name or ID.";
  if (t.length > MAX_NAME) return `Use at most ${MAX_NAME} characters.`;
  return null;
}

export function toSavedScan(name: string, scan: SuccessfulScan, scannedAt: Date, now: Date): SavedScan {
  const keyOf = (b: SuccessfulScan["bubbles"][number]) => bubbleKey(b.group, b.row, b.col);
  return {
    id: savedId(name),
    name: name.trim().slice(0, MAX_NAME),
    cardId: scan.cardId,
    scannedAt: scannedAt.toISOString(),
    savedAt: now.toISOString(),
    filled: scan.bubbles.filter((b) => b.state === "filled").map(keyOf),
    unclear: scan.bubbles.filter((b) => b.state === "ambiguous").map(keyOf),
  };
}

/** Newest first; one entry per name. */
export function addSaved(list: SavedScan[], entry: SavedScan): { list: SavedScan[]; replaced: boolean } {
  const rest = list.filter((e) => e.id !== entry.id);
  return { list: [entry, ...rest].slice(0, MAX_SAVED), replaced: rest.length !== list.length };
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

/** Validate stored data; corrupt entries are dropped, never thrown. */
export function parseSavedScans(raw: unknown): SavedScan[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter(
      (e): e is SavedScan =>
        typeof e === "object" && e !== null && isStr(e.id) && isStr(e.name) && isStr(e.cardId) && isStr(e.scannedAt) && isStr(e.savedAt) && isStrArr(e.filled) && isStrArr(e.unclear),
    )
    .slice(0, MAX_SAVED);
}

export interface LocalBatchOptions {
  /** localStorage name (prefixed with "paperbridge."), e.g. "clinic-intake.saved". */
  storageKey: string;
  /** e.g. ["card", "cards"]. */
  noun?: [string, string];
  /** Per-row input label. */
  inputLabel?: string;
  /** Where the rows go, for the button and message, e.g. "Saved Cards". */
  place?: string;
}

export function loadSaved(storageKey: string): SavedScan[] {
  return loadJson(storageKey, parseSavedScans, []);
}

/** Save one card. Returns a confirmation sentence, or the problem. */
export function saveOne(opts: LocalBatchOptions, name: string, scan: SuccessfulScan, scannedAt: Date, now: Date): { ok: boolean; message: string } {
  const problem = validateSavedName(name);
  if (problem) return { ok: false, message: problem };
  const r = addSaved(loadSaved(opts.storageKey), toSavedScan(name, scan, scannedAt, now));
  if (!saveJson(opts.storageKey, r.list)) return { ok: false, message: "Could not save: this browser blocked storage." };
  return { ok: true, message: `${r.replaced ? "Updated" : "Saved"} ${name.trim()} in ${opts.place ?? "Saved Cards"}.` };
}

/** A Scan Any Card batch adapter that saves into the generic list. */
export function localBatchAdapter(opts: LocalBatchOptions): BatchAdapter {
  const [one, many] = opts.noun ?? ["card", "cards"];
  const place = opts.place ?? "Saved Cards";
  const n = (k: number) => `${k} ${k === 1 ? one : many}`;
  return {
    input: { label: opts.inputLabel ?? "Name or ID", type: "text", hint: "Prefilled from the file name." },
    defaults: (items) => items.map((i) => fileStem(i.fileName)),
    validate(values) {
      const ids = values.map(savedId);
      return values.map((v, i) => validateSavedName(v) ?? (ids.indexOf(ids[i]) !== i ? `Same name as another ${one} in this batch.` : null));
    },
    actionLabel: (k) => `Save ${n(k)} to ${place}`,
    save(items, now) {
      let list = loadSaved(opts.storageKey);
      let replaced = 0;
      for (const it of items) {
        const r = addSaved(list, toSavedScan(it.value, it.scan, it.scannedAt, now));
        list = r.list;
        if (r.replaced) replaced++;
      }
      if (!saveJson(opts.storageKey, list)) return "Could not save: this browser blocked storage.";
      return `Saved ${n(items.length)} to ${place}${replaced ? ` (${replaced} replaced an earlier ${one})` : ""}.`;
    },
  };
}

/** The saved marks back as a decode-shaped result (every bubble of `layout`), so an app can re-run its interpreter. */
export function savedAsScan(e: SavedScan, layout: CardLayout): SuccessfulScan {
  const filled = new Set(e.filled);
  const unclear = new Set(e.unclear);
  return {
    ok: true,
    cardId: e.cardId,
    layoutVersion: layout.version,
    fiducials: [],
    bubbles: bubbleCenters(layout).map((b) => {
      const k = bubbleKey(b.group, b.row, b.col);
      const state = filled.has(k) ? "filled" : unclear.has(k) ? "ambiguous" : "blank";
      return { group: b.group, row: b.row, col: b.col, state, confidence: 1, fill: state === "filled" ? 1 : state === "ambiguous" ? 0.3 : 0, at: [0, 0] };
    }),
  };
}
