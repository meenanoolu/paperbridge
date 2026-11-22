import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { checkLayout, idCode, validateLayoutJson, type CardLayout, type LayoutReport } from "../src/core";

/**
 * Tool logic for the PaperBridge Layout Validator MCP server. Kept separate from the stdio
 * transport so it is unit tested directly.
 */

/** `validate_card_layout`: accepts a CardLayout object, or a JSON string of one. */
export function validateCardLayout(input: unknown, opts: { checkText?: boolean } = {}): LayoutReport & { summary: string } {
  let raw = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (err) {
      const report: LayoutReport = {
        ok: false,
        errors: [{ code: "INVALID_SHAPE", path: "$", message: `$: not valid JSON (${(err as Error).message})` }],
        stats: { groups: 0, bubbles: 0, page: null, pageMm: null },
      };
      return { ...report, summary: summarize(report) };
    }
  }
  const report = validateLayoutJson(raw, opts);
  return { ...report, summary: summarize(report) };
}

function summarize(r: LayoutReport): string {
  if (r.ok) return `PASS: ${r.stats.bubbles} bubbles in ${r.stats.groups} group${r.stats.groups === 1 ? "" : "s"} on ${r.stats.page} satisfy every PaperBridge geometric invariant.`;
  const byCode = new Map<string, number>();
  for (const e of r.errors) byCode.set(e.code, (byCode.get(e.code) ?? 0) + 1);
  return `FAIL: ${r.errors.length} problem${r.errors.length === 1 ? "" : "s"} (${[...byCode].map(([c, n]) => `${c} x${n}`).join(", ")}).\n${r.errors.map((e) => `- ${e.message}`).join("\n")}`;
}

export interface RegisteredAppInfo {
  slug: string;
  /** From `appMeta.label` in App.tsx; null if the app is not registered in the switcher. */
  label: string | null;
  registered: boolean;
  cardId: string | null;
  version: number | null;
  title: string | null;
  pages: string[];
  groups: { key: string; rows: number; cols: number }[];
  bubbles: number;
  idCode: number | null;
  layoutOk: boolean;
  layoutErrors: number;
  samplePhotos: number;
  problems: string[];
}

const isLayout = (v: unknown): v is CardLayout =>
  typeof v === "object" && v !== null && typeof (v as CardLayout).id === "string" && Array.isArray((v as CardLayout).groups) && "fiducial" in v;

/** `list_registered_apps`: every folder in src/apps with its layout metadata. */
export async function listRegisteredApps(appsDir: string): Promise<RegisteredAppInfo[]> {
  const out: RegisteredAppInfo[] = [];
  for (const slug of readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const dir = join(appsDir, slug);
    const problems: string[] = [];
    const appSrc = existsSync(join(dir, "App.tsx")) ? readFileSync(join(dir, "App.tsx"), "utf8") : "";
    // Read appMeta textually: importing App.tsx would pull in React and Vite-only APIs.
    const meta = /export const appMeta[^=]*=\s*\{[^}]*label:\s*("(?:[^"\\]|\\.)*")/.exec(appSrc);
    const label = meta ? (JSON.parse(meta[1]) as string) : null;
    if (!appSrc) problems.push("missing App.tsx");
    else if (!meta) problems.push("App.tsx does not export appMeta, so the app is not in the switcher");

    let layouts: CardLayout[] = [];
    if (!existsSync(join(dir, "layout.ts"))) problems.push("missing layout.ts");
    else {
      try {
        const mod = (await import(pathToFileURL(join(dir, "layout.ts")).href)) as Record<string, unknown>;
        const seen = new Set<string>();
        for (const v of Object.values(mod).flatMap((x) => (Array.isArray(x) ? x : [x]))) {
          if (isLayout(v) && !seen.has(`${v.id}|${v.page}`)) {
            seen.add(`${v.id}|${v.page}`);
            layouts.push(v);
          }
        }
        if (!layouts.length) problems.push("layout.ts exports no CardLayout");
      } catch (err) {
        problems.push(`layout.ts failed to load: ${(err as Error).message}`);
        layouts = [];
      }
    }
    const first = layouts[0];
    const reports = layouts.map(checkLayout);
    const errors = reports.reduce((s, r) => s + r.errors.length, 0);
    const samplesDir = join(dir, "samples");
    out.push({
      slug,
      label,
      registered: !!meta,
      cardId: first?.id ?? null,
      version: first?.version ?? null,
      title: first?.title ?? null,
      pages: layouts.map((l) => l.page),
      groups: first ? first.groups.map((g) => ({ key: g.key, rows: g.rows.length, cols: g.cols.length })) : [],
      bubbles: reports[0]?.stats.bubbles ?? 0,
      idCode: first ? idCode(first) : null,
      layoutOk: layouts.length > 0 && errors === 0,
      layoutErrors: errors,
      samplePhotos: existsSync(samplesDir) ? readdirSync(samplesDir).filter((f) => f.endsWith(".jpg")).length : 0,
      problems,
    });
  }
  // Two apps with the same card-ID code would accept each other's printouts.
  for (const a of out)
    for (const b of out)
      if (a !== b && a.idCode !== null && a.idCode === b.idCode && a.cardId !== b.cardId) a.problems.push(`same card-ID code as "${b.slug}"; bump version in layout.ts`);
  return out;
}
