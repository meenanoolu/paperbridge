import { describe, expect, it } from "vitest";
import {
  addAlert,
  alertFromNotification,
  checkInPrompt,
  demoAlert,
  loadAlerts,
  openCount,
  parseScanAlert,
  saveAlerts,
  storageKey,
} from "../src/alerts";

const NOW = new Date("2026-11-21T12:00:00Z");

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("crew-app alert logic", () => {
  it("accepts a valid alert and rejects anything else", () => {
    expect(parseScanAlert(demoAlert(NOW))).toMatchObject({ adherencePct: 71, severity: "high" });
    expect(parseScanAlert({ ...demoAlert(NOW), type: "other" })).toBeNull();
    expect(parseScanAlert({ ...demoAlert(NOW), adherencePct: 140 })).toBeNull();
    expect(parseScanAlert({ ...demoAlert(NOW), scannedAt: "not a date" })).toBeNull();
    expect(parseScanAlert("not json")).toBeNull();
    expect(parseScanAlert(null)).toBeNull();
  });

  it("drops malformed list entries and unknown fields", () => {
    const a = parseScanAlert({ ...demoAlert(NOW), missed: [{ day: "Mon", slot: "Noon" }, { day: "Tue", slot: "Night" }], extra: "<script>" })!;
    expect(a.missed).toEqual([{ day: "Tue", slot: "Night" }]);
    expect(a).not.toHaveProperty("extra");
  });

  it("finds alerts in Crew notifications: object field or JSON inside the body", () => {
    const alert = demoAlert(NOW);
    expect(alertFromNotification({ title: "PaperBridge", data: alert })).not.toBeNull();
    expect(alertFromNotification({ ts: "1", title: "PaperBridge alert", body: `New scan: ${JSON.stringify(alert)} (end)` })).not.toBeNull();
    expect(alertFromNotification({ title: "Build done", body: "All green {not json}" })).toBeNull();
  });

  it("dedupes by card and scan time, keeps reviewed state, newest first", () => {
    const a = demoAlert(new Date("2026-11-14T10:00:00Z"));
    const b = demoAlert(new Date("2026-11-21T10:00:00Z"));
    let list = addAlert([], a, "demo", NOW);
    list = list.map((x) => ({ ...x, reviewed: true }));
    list = addAlert(list, b, "notification", NOW);
    list = addAlert(list, a, "notification", NOW);
    expect(list.map((x) => x.scannedAt)).toEqual([b.scannedAt, a.scannedAt]);
    expect(list[1]).toMatchObject({ reviewed: true, source: "demo" });
    expect(openCount(list)).toBe(1);
  });

  it("does not count 'all good' alerts in the badge", () => {
    const ok = { ...demoAlert(NOW), severity: "none" as const, alerts: [] };
    expect(openCount(addAlert([], ok, "demo", NOW))).toBe(0);
  });

  it("persists under a namespaced key and survives corrupt storage", () => {
    const s = memoryStorage();
    const key = storageKey("paperbridge-care-monitor");
    expect(key).toBe("kirocrew.app.paperbridge-care-monitor.alerts.v1");
    saveAlerts(s, key, addAlert([], demoAlert(NOW), "demo", NOW));
    expect(loadAlerts(s, key)).toHaveLength(1);
    s.setItem(key, "{broken");
    expect(loadAlerts(s, key)).toEqual([]);
    s.setItem(key, JSON.stringify([{ type: "nope" }, ...JSON.parse(JSON.stringify(addAlert([], demoAlert(NOW), "demo", NOW)))]));
    expect(loadAlerts(s, key)).toHaveLength(1);
  });

  it("seeds the check-in prompt with aggregate data only", () => {
    const p = checkInPrompt({ ...demoAlert(NOW), ...{ id: "x", reviewed: false } } as never);
    expect(p).toContain("adherence-analysis");
    expect(p).toContain('"adherencePct": 71');
    expect(p).not.toContain('"id"');
    expect(p).not.toContain("reviewed");
  });
});
