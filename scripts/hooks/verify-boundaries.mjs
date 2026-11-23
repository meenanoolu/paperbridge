#!/usr/bin/env node
// Kiro Stop hook: before the agent ends its turn, (1) fail if src/core imports src/apps or
// src/shell, and (2) if UI files changed, ask the agent to confirm the WCAG 2.2 AA / AAA audit.
import { execFileSync } from "node:child_process";
import { forbiddenCoreImports, uiFiles } from "./guards.mjs";

const root = process.cwd();
const bad = forbiddenCoreImports(root);
if (bad.length) {
  process.stderr.write(`src/core must not import src/apps or src/shell (the core is app-agnostic):\n${bad.join("\n")}\nMove the code or the test outside src/core.\n`);
  process.exit(1);
}

let changed = [];
try {
  changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
} catch {
  process.exit(0);
}
const ui = uiFiles(changed);
if (ui.length) {
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason:
        `UI files changed (${ui.slice(0, 5).join(", ")}${ui.length > 5 ? ", ..." : ""}). Before finishing, run an axe-core audit (0 WCAG 2.2 AA violations; ` +
        "color-contrast-enhanced for Elder Care), check keyboard access and 4 px focus rings, or say plainly that it was not run.",
    }),
  );
}
process.exit(0);
