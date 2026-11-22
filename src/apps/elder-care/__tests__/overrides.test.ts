import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeJpeg } from "../../../../scripts/lib/photo";
import { bubbleCenters, decode, type BubbleState, type SuccessfulScan } from "../../../core";
import { applyManualOverrides, countActiveOverrides } from "../../../shell/overrides";
import { interpretCareCard, toScanAlert } from "../interpret";
import { ELDER_LAYOUT } from "../layout";

function missedDoseSample(): SuccessfulScan {
  const result = decode(decodeJpeg(readFileSync(join(__dirname, "../samples/missed-dose.jpg"))), ELDER_LAYOUT);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

function scanWith(states: Record<string, BubbleState>): SuccessfulScan {
  return {
    ok: true,
    cardId: ELDER_LAYOUT.id,
    layoutVersion: 1,
    fiducials: [],
    bubbles: bubbleCenters(ELDER_LAYOUT).map((b) => ({
      group: b.group,
      row: b.row,
      col: b.col,
      state: states[`${b.group}/${b.row}/${b.col}`] ?? "blank",
      confidence: 1,
      fill: 0,
      at: [0, 0],
    })),
  };
}

describe("elder care with manual overrides", () => {
  it("Missed-Dose sample: confirming Wednesday water clears the review item and adds a water day", () => {
    const raw = missedDoseSample();
    const before = interpretCareCard(raw);
    expect(before.needsReview).toEqual(["Wednesday water"]);
    expect(before.hydrationDays).toBe(3);

    const after = interpretCareCard(applyManualOverrides(raw, { "care/Wed/water": "filled" }));
    expect(after.needsReview).toEqual([]);
    expect(after.hydrationDays).toBe(4);
    expect(after.days[2].water).toBe("yes");
    expect(after.alerts.some((a) => a.level === "info")).toBe(false);
    // Adherence is unchanged: the unclear mark was not a dose.
    expect(after.adherencePct).toBe(before.adherencePct);
    // The decoded scan itself is untouched.
    expect(interpretCareCard(raw).needsReview).toEqual(["Wednesday water"]);
  });

  it("an unclear dose is excluded until a person decides, then counts as taken or missed", () => {
    const states: Record<string, BubbleState> = {};
    for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      states[`care/${d}/am`] = "filled";
      states[`care/${d}/pm`] = "filled";
    }
    states["care/Thu/pm"] = "ambiguous";
    const raw = scanWith(states);

    const unresolved = interpretCareCard(raw);
    expect([unresolved.counted, unresolved.adherencePct, unresolved.missed]).toEqual([13, 100, []]);

    const taken = interpretCareCard(applyManualOverrides(raw, { "care/Thu/pm": "filled" }));
    expect([taken.counted, taken.taken, taken.adherencePct]).toEqual([14, 14, 100]);

    const missed = interpretCareCard(applyManualOverrides(raw, { "care/Thu/pm": "blank" }));
    expect([missed.counted, missed.taken, missed.adherencePct]).toEqual([14, 13, 93]);
    expect(missed.missed).toEqual([{ day: "Thu", slot: "Night" }]);
  });

  it("the Crew alert records how many marks a person verified", () => {
    const raw = missedDoseSample();
    const overrides = { "care/Wed/water": "filled" as const };
    const reviewed = applyManualOverrides(raw, overrides);
    const alert = toScanAlert(interpretCareCard(reviewed), raw.cardId, new Date("2026-11-21T10:00:00Z"), countActiveOverrides(raw, overrides));
    expect(alert.manualOverrides).toBe(1);
    expect(alert.needsReview).toEqual([]);
    expect(toScanAlert(interpretCareCard(raw), raw.cardId, new Date())).not.toHaveProperty("manualOverrides");
  });
});

describe("bubble names", () => {
  it("match the dashboard's review wording", async () => {
    const { describeCareBubble } = await import("../layout");
    const { describeAnswerBubble } = await import("../../study-bridge/layout");
    expect(describeCareBubble({ group: "care", row: "Wed", col: "water" })).toBe("Wednesday water");
    expect(describeCareBubble({ group: "care", row: "Thu", col: "pm" })).toBe("Thursday night meds");
    expect(describeCareBubble({ group: "energy", row: "Mon", col: "4" })).toBe("Monday energy 4");
    expect(describeAnswerBubble({ row: "Q10", col: "C" })).toBe("Question 10, option C");
  });
});
