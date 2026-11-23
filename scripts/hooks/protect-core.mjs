#!/usr/bin/env node
// Kiro PreToolUse hook: before a write to the protected optical core, ask the person first and
// remind the agent of the invariant and the regression matrix. Reads the hook payload on stdin.
import { PROTECTED_REASON, protectedTargets } from "./guards.mjs";

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    process.exit(0);
  }
  const hits = protectedTargets(payload);
  if (hits.length === 0) process.exit(0);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { permissionDecision: "ask", permissionDecisionReason: `Edits ${hits.join(", ")}. ${PROTECTED_REASON}` },
    }),
  );
  process.exit(0);
});
