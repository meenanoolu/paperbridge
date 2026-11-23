import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM helper shared with the hook scripts
import { forbiddenCoreImports, protectedTargets, uiFiles } from "../hooks/guards.mjs";

const root = join(__dirname, "../..");
const hook = (name: string) => JSON.parse(readFileSync(join(root, ".kiro/hooks", name), "utf8")).hooks[0];

describe("Kiro hooks", () => {
  it("ship 5 hooks of 3 kinds: PostFileSave commands, a PreToolUse guard and a Stop check", () => {
    const triggers = ["core-tests-on-save.json", "regen-samples-on-layout.json", "typecheck-on-app-save.json", "protect-core-pre-tool.json", "verify-boundaries-on-stop.json"].map((f) => hook(f).trigger);
    expect(triggers).toEqual(["PostFileSave", "PostFileSave", "PostFileSave", "PreToolUse", "Stop"]);
    expect(hook("protect-core-pre-tool.json").action.command).toBe("node scripts/hooks/protect-core.mjs");
  });

  it("the PreToolUse guard flags writes to the protected core only", () => {
    expect(protectedTargets({ tool_input: { path: "/projects/sandbox/paperbridge/src/core/decode/constants.ts", oldStr: "a", newStr: "b" } })).toEqual(["src/core/decode/constants.ts"]);
    expect(protectedTargets({ tool_input: { path: "src/core/layout.ts" } })).toEqual(["src/core/layout.ts"]);
    expect(protectedTargets({ tool_input: { command: "sed -i s/0.2/0.25/ src/core/decode/constants.ts" } })).toEqual(["src/core/decode/constants.ts"]);
    expect(protectedTargets({ tool_input: { path: "./src/core/capture/webcam.ts" } })).toEqual(["src/core/capture/webcam.ts"]);
    // Reads and other files pass.
    expect(protectedTargets({ tool_input: { command: "grep -n BLANK src/core/decode/constants.ts" } })).toEqual([]);
    expect(protectedTargets({ tool_input: { path: "src/core/render/pdf.ts", text: "see src/core/decode for thresholds" } })).toEqual([]);
    expect(protectedTargets({ tool_input: { path: "src/core/layout-notes.md" } })).toEqual([]);
  });

  it("the Stop check finds no src/core imports of src/apps or src/shell, and spots UI changes", () => {
    expect(forbiddenCoreImports(root)).toEqual([]);
    expect(uiFiles(["src/shell/components/StressLab.tsx", "src/core/render/pdf.ts", "src/index.css", "README.md"])).toEqual(["src/shell/components/StressLab.tsx", "src/index.css"]);
  });
});
