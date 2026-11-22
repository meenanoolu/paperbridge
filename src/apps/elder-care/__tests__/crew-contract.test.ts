import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { parseScanAlert } from "../../../../crew-app/ui/src/alerts";
import { decode } from "../../../core";
import { applyManualOverrides, countActiveOverrides } from "../../../shell/overrides";
import { interpretCareCard, toScanAlert } from "../interpret";
import { ELDER_LAYOUT } from "../layout";
import { ELDER_SAMPLE_SPECS } from "../samples/specs";

/** The Kiro Crew App must accept exactly what Elder Care Bridge emits. */
describe("PaperBridge -> Kiro Crew alert contract", () => {
  for (const spec of ELDER_SAMPLE_SPECS) {
    it(`${spec.title} alert passes the Crew parser unchanged`, () => {
      const result = decode(decodeJpeg(readFileSync(join(__dirname, "../samples", spec.file))), ELDER_LAYOUT);
      if (!result.ok) throw new Error(result.reason);
      const alert = toScanAlert(interpretCareCard(result), result.cardId, new Date("2026-11-21T10:00:00Z"));
      expect(parseScanAlert(JSON.parse(JSON.stringify(alert)))).toEqual(alert);
    });
  }

  it("a manually verified alert, exactly as Copy for Kiro Crew writes it, pastes unchanged", () => {
    const result = decode(decodeJpeg(readFileSync(join(__dirname, "../samples/missed-dose.jpg"))), ELDER_LAYOUT);
    if (!result.ok) throw new Error(result.reason);
    const overrides = { "care/Wed/water": "filled" as const };
    const alert = toScanAlert(
      interpretCareCard(applyManualOverrides(result, overrides)),
      result.cardId,
      new Date("2026-11-21T10:00:00Z"),
      countActiveOverrides(result, overrides),
    );
    const pasted = JSON.stringify(alert, null, 2); // the clipboard text
    expect(parseScanAlert(pasted)).toEqual(alert);
    expect(parseScanAlert(pasted)).toMatchObject({ manualOverrides: 1, needsReview: [] });
  });

  it("app.json matches the agent, skill, and bundle it points to", () => {
    const root = join(__dirname, "../../../../crew-app");
    const app = JSON.parse(readFileSync(join(root, "app.json"), "utf8"));
    expect(app.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(app.version).toMatch(/^\d+\.\d+\.\d+$/);
    const agent = JSON.parse(readFileSync(join(root, app.agents[0]), "utf8"));
    expect(agent.name).toBe("care-auditor");
    expect(app.contributes.commands[0].agent).toBe(agent.name);
    expect(readFileSync(join(root, app.skills[0], "SKILL.md"), "utf8")).toMatch(/^---\nname: adherence-analysis\n/);
    // ui.entry and iconUrl resolve against ui/; iconPath against the app root.
    expect(() => readFileSync(join(root, "ui", app.ui.entry))).not.toThrow();
    expect(() => readFileSync(join(root, "ui", app.ui.pages[0].iconUrl))).not.toThrow();
    expect(() => readFileSync(join(root, app.iconPath))).not.toThrow();
  });
});
