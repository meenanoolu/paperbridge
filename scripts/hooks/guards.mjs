// Pure checks shared by the Kiro hook scripts in this folder (and unit tested).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** The protected optical core: decoder thresholds, geometry, and capture. */
export const PROTECTED = [/(^|\/)src\/core\/decode\//, /(^|\/)src\/core\/layout\.ts$/, /(^|\/)src\/core\/capture\//];

const SHELL_WRITE = /(sed\s+-i|perl\s+-i|>\s*\S|\btee\b|\bmv\b|\bcp\b|\brm\b|\btruncate\b|python3?\s+-)/;

/** Every string anywhere in a hook payload (tool input shapes differ between tools). */
export function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
  return out;
}

/** Protected paths a tool call would write. Shell commands count only when they look like a write. */
export function protectedTargets(payload) {
  const input = payload?.tool_input ?? payload?.toolInput ?? payload?.input ?? payload ?? {};
  const all = strings(input);
  const hits = new Set();
  for (const s of all) {
    const isCommand = /\s/.test(s) && SHELL_WRITE.test(s);
    for (const token of s.split(/[\s"'`=,;()]+/)) {
      const t = token.replace(/^\.\//, "").replace(/^\/projects\/sandbox\/paperbridge\//, "");
      if (!PROTECTED.some((re) => re.test(t))) continue;
      // A bare path is a write target; inside a shell command only when the command writes.
      if (s.trim() === token || !/\s/.test(s) || isCommand) hits.add(t);
    }
  }
  return [...hits];
}

export const PROTECTED_REASON =
  "Protected optical core (src/core/decode/, src/core/layout.ts, src/core/capture/). Thresholds, fiducials and bubble geometry are invariants: " +
  "every printed card in the field depends on them. Before changing them, run the 50-photo regression matrix (5 samples x 5 cameras x A4/Letter, " +
  "npx vitest --run src/shell/__tests__/paper-matrix.test.ts) and the property tests (npx vitest --run src/core), and record the reason in " +
  ".kiro/specs/paperbridge/design.md. Prefer print-only changes in src/core/render/ instead.";

/** Imports from src/core into src/apps or src/shell (forbidden, even in tests). */
export function forbiddenCoreImports(root) {
  const core = join(root, "src/core");
  const found = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts|js)$/.test(name)) {
        const text = readFileSync(p, "utf8");
        for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g))
          if (/(^|\/)(apps|shell)(\/|$)/.test(m[1]) && m[1].startsWith(".")) found.push(`${relative(root, p)} imports ${m[1]}`);
      }
    }
  };
  walk(core);
  return found;
}

/** Changed files that affect what people see (React components, styles). */
export function uiFiles(changed) {
  return changed.filter((f) => /^src\/(shell|apps)\/.*\.tsx$|\.css$/.test(f));
}
