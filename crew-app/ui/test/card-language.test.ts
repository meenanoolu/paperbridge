import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkInPrompt, demoAlert, languageName, parseScanAlert } from "../src/alerts";

const NOW = new Date("2026-11-23T10:00:00Z");

describe("cardLanguage", () => {
  it("keeps a valid BCP 47 tag and drops anything else", () => {
    for (const tag of ["te-IN", "hi-IN", "es-ES", "en-US", "en", "zh-Hant-TW"]) expect(parseScanAlert({ ...demoAlert(NOW), cardLanguage: tag })?.cardLanguage).toBe(tag);
    for (const bad of ["Telugu please", "<script>", "", 7, "e", "te_IN"]) expect(parseScanAlert({ ...demoAlert(NOW), cardLanguage: bad })).not.toHaveProperty("cardLanguage");
  });

  it("is optional: older alerts without it still parse, unchanged", () => {
    const { cardLanguage, ...old } = demoAlert(NOW);
    expect(cardLanguage).toBe("te-IN"); // the demo shows the bilingual check-in
    expect(parseScanAlert(old)).toEqual(old);
    expect(parseScanAlert(old)).not.toHaveProperty("cardLanguage");
  });

  it("names the check-in language, falling back to English", () => {
    expect([languageName("te-IN"), languageName("hi-IN"), languageName("es-ES"), languageName("en-US"), languageName(undefined), languageName("ta-IN")]).toEqual([
      "Telugu",
      "Hindi",
      "Spanish",
      "English",
      "English",
      "English",
    ]);
  });

  it("asks care-auditor for a Clinical Note in English and a Gentle Check-In Opener in the card language", () => {
    const p = checkInPrompt(demoAlert(NOW));
    expect(p).toContain('"Clinical Note (English)"');
    expect(p).toContain('"Gentle Check-In Opener (Telugu)"');
    expect(p).toContain('"cardLanguage": "te-IN"');
    // Patterns alone also get both sections (opener in English).
    const { cardLanguage: _drop, ...english } = demoAlert(NOW);
    expect(checkInPrompt(english)).toContain('"Gentle Check-In Opener (English)"');
    expect(checkInPrompt(english)).not.toContain("cardLanguage");
    // Neither patterns nor a language: the original single check-in.
    const { patterns: _p, ...plain } = english;
    expect(checkInPrompt(plain)).not.toContain("Clinical Note");
  });

  it("the agent and the skill both describe the two sections", () => {
    const root = join(__dirname, "../..");
    const agent = JSON.parse(readFileSync(join(root, "agents/care-auditor.json"), "utf8"));
    const skill = readFileSync(join(root, "skills/adherence-analysis/SKILL.md"), "utf8");
    for (const text of [agent.prompt as string, skill]) {
      expect(text).toContain("Clinical Note (English)");
      expect(text).toContain("Gentle Check-In Opener");
      expect(text).toMatch(/te-IN/);
    }
  });

  it("the committed bundle includes the language badge", () => {
    const bundle = readFileSync(join(__dirname, "../dist/index.mjs"), "utf8");
    expect(bundle).toContain("cardLanguage");
    expect(bundle).toContain("Card: ");
  });
});
