import {
  bubbleCenters,
  fiducialCenters,
  ID_GROUP_KEY,
  idBubbleCenters,
  PAGE_SIZE_MM,
  type BubbleCenter,
} from "./layout";
import { CARD_ICONS } from "./render/icons";
import { textBoxOf } from "./render/measure";
import { BUBBLE_STROKE_MM, cardPrimitives } from "./render/primitives";
import type { BubbleGroup, CardLayout, PageSize } from "./types";

/**
 * Structured geometric checks for a CardLayout, for tools (the Layout Validator MCP server,
 * the app scaffolder) that need machine-readable pass/fail diagnostics. Pure, no I/O.
 * `validateLayout` in layout.ts is unchanged; these checks are a strict superset of it plus
 * bubble-to-bubble overlap across groups and unique IDs.
 */
export type DiagnosticCode =
  | "INVALID_SHAPE"
  | "OUT_OF_BOUNDS"
  | "FIDUCIAL_OVERLAP"
  | "ID_STRIP_OVERLAP"
  | "BUBBLE_OVERLAP"
  | "DUPLICATE_ID"
  | "EMPTY_GROUP"
  | "TEXT_OVERLAP"
  | "TEXT_OUT_OF_BOUNDS";

export interface LayoutDiagnostic {
  code: DiagnosticCode;
  message: string;
  /** Bubble IDs involved, as `group/row/col`. */
  bubbles?: string[];
  /** JSON path for shape errors, e.g. `groups[0].radiusMm`. */
  path?: string;
}

export interface LayoutReport {
  ok: boolean;
  errors: LayoutDiagnostic[];
  stats: { groups: number; bubbles: number; page: PageSize | null; pageMm: { width: number; height: number } | null };
}

/** Two bubbles need centre distance of at least this many times the sum of their radii. Matches validateLayout's 2.2r pitch rule. */
export const MIN_SEPARATION = 1.1;
/** Quiet zone around each fiducial beyond its half-size, in mm. Matches validateLayout. */
export const FIDUCIAL_QUIET_MM = 3;
/** Distinct overlapping pairs are reported individually up to this count, then summarised. */
export const MAX_PAIR_REPORTS = 25;

const r2 = (n: number) => Math.round(n * 100) / 100;
const idOf = (b: Pick<BubbleCenter, "group" | "row" | "col">) => `${b.group}/${b.row}/${b.col}`;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isPair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(isNum);

/** Check that untrusted JSON has the CardLayout shape. Returns the layout or shape diagnostics. */
export function parseCardLayout(raw: unknown): { layout: CardLayout; errors: [] } | { layout: null; errors: LayoutDiagnostic[] } {
  const errors: LayoutDiagnostic[] = [];
  const bad = (path: string, message: string) => errors.push({ code: "INVALID_SHAPE", path, message: `${path}: ${message}` });
  if (!isObj(raw)) {
    bad("$", "expected a CardLayout object");
    return { layout: null, errors };
  }
  for (const k of ["id", "title"] as const) if (typeof raw[k] !== "string" || !raw[k]) bad(k, "expected a non-empty string");
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1) bad("version", "expected a positive integer");
  if (raw.page !== "A4" && raw.page !== "Letter") bad("page", 'expected "A4" or "Letter"');
  const f = raw.fiducial;
  if (!isObj(f) || !isNum(f.sizeMm) || !isNum(f.insetMm) || f.sizeMm <= 0 || f.insetMm < 0) bad("fiducial", "expected { sizeMm > 0, insetMm >= 0 }");
  if (!Array.isArray(raw.groups) || raw.groups.length === 0) bad("groups", "expected a non-empty array");
  else
    raw.groups.forEach((g: unknown, i: number) => {
      const p = `groups[${i}]`;
      if (!isObj(g)) return bad(p, "expected an object");
      if (typeof g.key !== "string" || !g.key) bad(`${p}.key`, "expected a non-empty string");
      if (!isStrArr(g.rows)) bad(`${p}.rows`, "expected an array of strings");
      if (!isStrArr(g.cols)) bad(`${p}.cols`, "expected an array of strings");
      if (!isPair(g.originMm)) bad(`${p}.originMm`, "expected [x, y] in mm");
      if (!isPair(g.pitchMm) || g.pitchMm.some((n) => n < 0)) bad(`${p}.pitchMm`, "expected [dx, dy] >= 0 in mm");
      if (!isNum(g.radiusMm) || g.radiusMm <= 0) bad(`${p}.radiusMm`, "expected a positive number");
      for (const k of ["rowLabels", "colLabels", "colNotes"] as const) if (g[k] !== undefined && !isStrArr(g[k])) bad(`${p}.${k}`, "expected an array of strings");
      if (g.colIcons !== undefined && !(isStrArr(g.colIcons) && g.colIcons.every((n) => n === "" || (CARD_ICONS as readonly string[]).includes(n))))
        bad(`${p}.colIcons`, `expected an array of "" or ${CARD_ICONS.map((n) => `"${n}"`).join(", ")}`);
      if (g.colHighlights !== undefined && !(Array.isArray(g.colHighlights) && g.colHighlights.every((j) => Number.isInteger(j) && j >= 0)))
        bad(`${p}.colHighlights`, "expected an array of column indexes");
      if (g.colHighlightStyle !== undefined && g.colHighlightStyle !== "frame" && g.colHighlightStyle !== "underline") bad(`${p}.colHighlightStyle`, 'expected "frame" or "underline"');
    });
  return errors.length ? { layout: null, errors } : { layout: raw as unknown as CardLayout, errors: [] };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

/** All geometric invariants a printable, decodable PaperBridge card must satisfy. */
export function checkLayout(layout: CardLayout): LayoutReport {
  const errors: LayoutDiagnostic[] = [];
  const page = PAGE_SIZE_MM[layout.page];
  const { sizeMm, insetMm } = layout.fiducial;

  // Unique IDs: group keys, rows/cols within a group, and the reserved ID-strip key.
  for (const key of duplicates(layout.groups.map((g) => g.key)))
    errors.push({ code: "DUPLICATE_ID", message: `Group key "${key}" is used more than once. Bubble IDs (group/row/col) must be unique.` });
  for (const g of layout.groups as BubbleGroup[]) {
    if (g.key === ID_GROUP_KEY) errors.push({ code: "DUPLICATE_ID", message: `Group key "${ID_GROUP_KEY}" is reserved for the card-ID strip.` });
    for (const [what, list] of [["row", g.rows], ["column", g.cols]] as const)
      for (const k of duplicates(list)) errors.push({ code: "DUPLICATE_ID", message: `Group "${g.key}" has ${what} "${k}" more than once.` });
    if (g.rows.length === 0 || g.cols.length === 0) errors.push({ code: "EMPTY_GROUP", message: `Group "${g.key}" has no bubbles.` });
  }

  const bubbles = bubbleCenters(layout);
  const fids = fiducialCenters(layout);
  const ids = idBubbleCenters(layout);
  const clear = sizeMm / 2 + FIDUCIAL_QUIET_MM;
  const names = ["top-left", "top-right", "bottom-right", "bottom-left"];

  for (const b of bubbles) {
    const id = idOf(b);
    const edges = { left: b.x - b.r - insetMm, top: b.y - b.r - insetMm, right: page.width - insetMm - (b.x + b.r), bottom: page.height - insetMm - (b.y + b.r) };
    const out = Object.entries(edges).filter(([, d]) => d < 0);
    if (out.length)
      errors.push({
        code: "OUT_OF_BOUNDS",
        bubbles: [id],
        message: `Bubble ${id} at (${r2(b.x)}, ${r2(b.y)}) mm, r=${r2(b.r)} goes past the ${out.map(([e, d]) => `${e} margin by ${r2(-d)} mm`).join(" and ")} (page ${page.width}x${page.height} mm, margin ${insetMm} mm).`,
      });
    fids.forEach(([fx, fy], k) => {
      if (Math.abs(b.x - fx) < clear + b.r && Math.abs(b.y - fy) < clear + b.r)
        errors.push({
          code: "FIDUCIAL_OVERLAP",
          bubbles: [id],
          message: `Bubble ${id} at (${r2(b.x)}, ${r2(b.y)}) mm is inside the ${names[k]} corner marker's quiet zone (marker centre (${r2(fx)}, ${r2(fy)}) mm, keep ${r2(clear)} mm + radius clear).`,
        });
    });
    for (const s of ids) {
      const need = MIN_SEPARATION * (b.r + s.r);
      if (Math.hypot(b.x - s.x, b.y - s.y) < need)
        errors.push({ code: "ID_STRIP_OVERLAP", bubbles: [id, idOf(s)], message: `Bubble ${id} is too close to the card-ID strip (bubble ${s.col}). Move it below y=${r2(s.y + s.r + b.r * 1.2)} mm.` });
    }
  }

  // Bubble-to-bubble spacing, across all groups. O(n^2) is fine for card-sized layouts.
  let pairs = 0;
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i];
      const c = bubbles[j];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      const need = MIN_SEPARATION * (a.r + c.r);
      if (d >= need) continue;
      pairs++;
      if (pairs <= MAX_PAIR_REPORTS)
        errors.push({
          code: "BUBBLE_OVERLAP",
          bubbles: [idOf(a), idOf(c)],
          message: `Bubbles ${idOf(a)} and ${idOf(c)} are ${r2(d)} mm apart (centres); they need at least ${r2(need)} mm${d < a.r + c.r ? " and currently overlap" : ""}.`,
        });
    }
  }
  if (pairs > MAX_PAIR_REPORTS)
    errors.push({ code: "BUBBLE_OVERLAP", message: `${pairs - MAX_PAIR_REPORTS} more bubble pairs are too close (not listed).` });

  return { ok: errors.length === 0, errors, stats: { groups: layout.groups.length, bubbles: bubbles.length, page: layout.page, pageMm: page } };
}

/**
 * Parse untrusted JSON and run every geometric check. The MCP tool's entry point.
 * `checkText` also checks printed text placement (see checkPrintedText).
 */
export function validateLayoutJson(raw: unknown, opts: { checkText?: boolean } = {}): LayoutReport {
  const parsed = parseCardLayout(raw);
  if (!parsed.layout) return { ok: false, errors: parsed.errors, stats: { groups: 0, bubbles: 0, page: null, pageMm: null } };
  const report = checkLayout(parsed.layout);
  if (!opts.checkText) return report;
  const errors = [...report.errors, ...checkPrintedText(parsed.layout)];
  return { ...report, ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Printed text
// ---------------------------------------------------------------------------

/** Clearance kept around printed text, in mm. */
export const TEXT_CLEARANCE_MM = 0.4;

export { estimateTextWidthMm, TEXT_WIDTH_SAFETY } from "./render/measure";

export interface TextBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Estimated box of every printed string (cap height above the baseline, descender below). */
export function textBoxes(layout: CardLayout): TextBox[] {
  return cardPrimitives(layout).flatMap((p) => (p.kind !== "text" || !p.text.trim() ? [] : [{ text: p.text, ...textBoxOf(p) }]));
}

/** A printed mark that must stay clear of everything else: text, an icon, or a frame (a ring with an open inside). */
export interface PrintedBox extends TextBox {
  /** For frames: the open inside, where the framed label sits. */
  inner?: { x0: number; y0: number; x1: number; y1: number };
}

/** Every printed text box plus icon boxes and highlight frames, for the collision check. */
export function printedBoxes(layout: CardLayout): PrintedBox[] {
  return cardPrimitives(layout).flatMap((p): PrintedBox[] => {
    if (p.kind === "text") return p.text.trim() ? [{ text: p.text, ...textBoxOf(p) }] : [];
    if (p.kind === "icon") return [{ text: `[${p.name} icon]`, x0: p.x, y0: p.y, x1: p.x + p.sizeMm, y1: p.y + p.sizeMm }];
    if (p.kind === "rule") return [{ text: "[underline]", x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h }];
    if (p.kind === "frame") {
      const h = p.strokeMm / 2;
      return [{ text: "[highlight frame]", x0: p.x - h, y0: p.y - h, x1: p.x + p.w + h, y1: p.y + p.h + h, inner: { x0: p.x + h, y0: p.y + h, x1: p.x + p.w - h, y1: p.y + p.h - h } }];
    }
    return [];
  });
}

type Rect = { x0: number; y0: number; x1: number; y1: number };
const rectOverlaps = (a: Rect, b: Rect, pad = 0) => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
const inside = (b: Rect, area: Rect, pad: number) => b.x0 >= area.x0 + pad && b.x1 <= area.x1 - pad && b.y0 >= area.y0 + pad && b.y1 <= area.y1 - pad;
/** A frame only collides with what touches its ring: a label well inside it is what it frames. */
const overlaps = (a: PrintedBox | Rect, b: PrintedBox | Rect, pad = 0) => {
  if (!rectOverlaps(a, b, pad)) return false;
  if ("inner" in a && a.inner && inside(b, a.inner, pad)) return false;
  if ("inner" in b && b.inner && inside(a, b.inner, pad)) return false;
  return true;
};

/**
 * Printed text must stay on the page, off every bubble, corner marker, and the card-ID strip,
 * and off other text. Pure; uses estimated glyph widths, so it is conservative.
 */
export function checkPrintedText(layout: CardLayout): LayoutDiagnostic[] {
  const errors: LayoutDiagnostic[] = [];
  const page = PAGE_SIZE_MM[layout.page];
  const { sizeMm, insetMm } = layout.fiducial;
  const boxes = printedBoxes(layout);
  const solids: { what: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  const half = sizeMm / 2;
  fiducialCenters(layout).forEach(([x, y], i) =>
    solids.push({ what: `${["top-left", "top-right", "bottom-right", "bottom-left"][i]} corner marker`, x0: x - half, y0: y - half, x1: x + half, y1: y + half }),
  );
  for (const b of [...bubbleCenters(layout), ...idBubbleCenters(layout)]) {
    const r = b.r + BUBBLE_STROKE_MM / 2;
    solids.push({ what: b.group === ID_GROUP_KEY ? "the card-ID strip" : `bubble ${idOf(b)}`, x0: b.x - r, y0: b.y - r, x1: b.x + r, y1: b.y + r });
  }
  const shown = (t: string) => (t.length > 40 ? `${t.slice(0, 37)}...` : t);
  for (const t of boxes) {
    if (t.x0 < insetMm || t.y0 < insetMm || t.x1 > page.width - insetMm || t.y1 > page.height - insetMm)
      errors.push({ code: "TEXT_OUT_OF_BOUNDS", message: `Text "${shown(t.text)}" runs past the page margin.` });
    const hit = solids.find((s) => overlaps(t, s, TEXT_CLEARANCE_MM));
    if (hit) errors.push({ code: "TEXT_OVERLAP", message: `Text "${shown(t.text)}" touches ${hit.what}.` });
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (overlaps(boxes[i], boxes[j], TEXT_CLEARANCE_MM / 2))
        errors.push({ code: "TEXT_OVERLAP", message: `Text "${shown(boxes[i].text)}" overlaps text "${shown(boxes[j].text)}".` });
  return errors;
}
