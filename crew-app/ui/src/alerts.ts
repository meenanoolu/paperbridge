/**
 * Pure alert logic for the PaperBridge Care Monitor page: parse, dedupe, persist, summarise.
 * No SDK or React imports, so it is unit tested from the PaperBridge repo root.
 *
 * `ScanAlert` mirrors `src/apps/elder-care/interpret.ts` in PaperBridge. A root test
 * feeds real PaperBridge alerts through `parseScanAlert` to keep the two in step.
 */

export type Severity = "high" | "medium" | "none";
export type Slot = "Morning" | "Night";
export interface CareAlertItem {
  level: "high" | "medium" | "info";
  title: string;
  detail: string;
}

export interface ScanAlert {
  type: "paperbridge:scan-alert";
  app: "elder-care";
  cardId: string;
  scannedAt: string;
  severity: Severity;
  adherencePct: number | null;
  missed: { day: string; slot: Slot }[];
  symptomDays: string[];
  needsReview: string[];
  alerts: CareAlertItem[];
}

export type AlertSource = "browser-event" | "notification" | "demo" | "pasted";

export interface StoredAlert extends ScanAlert {
  id: string;
  receivedAt: string;
  source: AlertSource;
  reviewed: boolean;
}

export const SCAN_ALERT_TYPE = "paperbridge:scan-alert";
export const MAX_STORED_ALERTS = 50;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Validate an untrusted value. Returns a clean copy, or null if it is not a PaperBridge alert. */
export function parseScanAlert(v: unknown): ScanAlert | null {
  if (typeof v === "string") {
    try {
      return parseScanAlert(JSON.parse(v));
    } catch {
      return null;
    }
  }
  if (!isObj(v) || v.type !== SCAN_ALERT_TYPE || v.app !== "elder-care") return null;
  if (typeof v.cardId !== "string" || typeof v.scannedAt !== "string" || Number.isNaN(Date.parse(v.scannedAt))) return null;
  if (v.severity !== "high" && v.severity !== "medium" && v.severity !== "none") return null;
  if (!(v.adherencePct === null || (typeof v.adherencePct === "number" && v.adherencePct >= 0 && v.adherencePct <= 100))) return null;
  if (!isStrArr(v.symptomDays) || !isStrArr(v.needsReview) || !Array.isArray(v.missed) || !Array.isArray(v.alerts)) return null;
  const missed = v.missed.filter(
    (m): m is { day: string; slot: Slot } => isObj(m) && typeof m.day === "string" && (m.slot === "Morning" || m.slot === "Night"),
  );
  const alerts = v.alerts.filter(
    (a): a is CareAlertItem =>
      isObj(a) && (a.level === "high" || a.level === "medium" || a.level === "info") && typeof a.title === "string" && typeof a.detail === "string",
  );
  return {
    type: SCAN_ALERT_TYPE,
    app: "elder-care",
    cardId: v.cardId.slice(0, 120),
    scannedAt: v.scannedAt,
    severity: v.severity,
    adherencePct: v.adherencePct,
    missed: missed.map((m) => ({ day: m.day.slice(0, 20), slot: m.slot })),
    symptomDays: v.symptomDays.map((d) => d.slice(0, 20)),
    needsReview: v.needsReview.map((d) => d.slice(0, 120)),
    alerts: alerts.map((a) => ({ level: a.level, title: a.title.slice(0, 200), detail: a.detail.slice(0, 500) })),
  };
}

/** Find the first `{...}` JSON object in free text that parses as a PaperBridge alert. */
function alertInText(text: string): ScanAlert | null {
  if (!text.includes(SCAN_ALERT_TYPE)) return null;
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}" && --depth === 0) {
        const parsed = parseScanAlert(text.slice(start, i + 1));
        if (parsed) return parsed;
        break;
      }
    }
  }
  return null;
}

/**
 * A Crew notification (WebSocket `notification` event or `/api/notifications` item) can carry
 * an alert as an object field or as JSON inside its title/body/text. Anything else is ignored.
 */
export function alertFromNotification(n: unknown): ScanAlert | null {
  const direct = parseScanAlert(n);
  if (direct) return direct;
  if (!isObj(n)) return null;
  for (const key of ["alert", "data", "payload", "detail"]) {
    const nested = parseScanAlert(n[key]);
    if (nested) return nested;
  }
  for (const key of ["body", "text", "message", "title"]) {
    const v = n[key];
    if (typeof v === "string") {
      const found = alertInText(v);
      if (found) return found;
    }
  }
  return null;
}

export function alertId(a: ScanAlert): string {
  return `${a.cardId}@${a.scannedAt}`;
}

/** Newest first, deduplicated by card + scan time, capped. Re-receiving keeps the reviewed flag. */
export function addAlert(list: StoredAlert[], alert: ScanAlert, source: AlertSource, now: Date): StoredAlert[] {
  const id = alertId(alert);
  const existing = list.find((a) => a.id === id);
  const stored: StoredAlert = { ...alert, id, source: existing?.source ?? source, receivedAt: existing?.receivedAt ?? now.toISOString(), reviewed: existing?.reviewed ?? false };
  return [stored, ...list.filter((a) => a.id !== id)]
    .sort((a, b) => Date.parse(b.scannedAt) - Date.parse(a.scannedAt))
    .slice(0, MAX_STORED_ALERTS);
}

/** Alerts that still need a caregiver's attention: drives the sidebar badge. */
export function openCount(list: StoredAlert[]): number {
  return list.filter((a) => !a.reviewed && a.severity !== "none").length;
}

/** localStorage key, namespaced by app name so it never collides with the host or other apps. */
export function storageKey(appName: string): string {
  return `kirocrew.app.${appName}.alerts.v1`;
}

export function loadAlerts(storage: Pick<Storage, "getItem"> | undefined, key: string): StoredAlert[] {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((item) => {
      const a = parseScanAlert(item);
      if (!a || !isObj(item)) return [];
      const source = (["browser-event", "notification", "demo", "pasted"] as const).find((s) => s === item.source) ?? "pasted";
      const receivedAt = typeof item.receivedAt === "string" ? item.receivedAt : a.scannedAt;
      return [{ ...a, id: alertId(a), source, receivedAt, reviewed: item.reviewed === true }];
    });
  } catch {
    return [];
  }
}

export function saveAlerts(storage: Pick<Storage, "setItem"> | undefined, key: string, list: StoredAlert[]): void {
  try {
    storage?.setItem(key, JSON.stringify(list.slice(0, MAX_STORED_ALERTS)));
  } catch {
    // Storage full or blocked: the in-memory list still works for this session.
  }
}

/** The Missed-Dose Alert sample card, as PaperBridge reports it. Lets judges try the page with no setup. */
export function demoAlert(now: Date): ScanAlert {
  return {
    type: SCAN_ALERT_TYPE,
    app: "elder-care",
    cardId: "elder-care-weekly",
    scannedAt: now.toISOString(),
    severity: "high",
    adherencePct: 71,
    missed: [
      { day: "Tue", slot: "Night" },
      { day: "Thu", slot: "Morning" },
      { day: "Thu", slot: "Night" },
      { day: "Sat", slot: "Night" },
    ],
    symptomDays: ["Thu", "Fri"],
    needsReview: ["Wednesday water"],
    alerts: [
      { level: "high", title: "Medication taken 71% of the time", detail: "4 of 14 doses were missed. The goal is 80% or more." },
      { level: "high", title: "No medication at all on Thursday", detail: "Both morning and night doses were missed." },
      { level: "high", title: "Dizzy or in pain on 2 days", detail: "Thursday, Friday. Consider calling the doctor." },
      { level: "medium", title: "Low energy on 2 days", detail: "Thursday, Friday (energy 2 or below)." },
      { level: "medium", title: "Enough water on only 3 of 7 days", detail: "The goal is 6+ cups on at least 5 days." },
      { level: "info", title: "1 mark needs a human check", detail: "Wednesday water. These are not counted as taken or missed." },
    ],
  };
}

/** The message seeded into the care-auditor chat. Contains the aggregate alert only. */
export function checkInPrompt(a: ScanAlert): string {
  const { type, app, cardId, scannedAt, severity, adherencePct, missed, symptomDays, needsReview, alerts } = a;
  return [
    "Load the adherence-analysis skill and draft a caregiver check-in for this PaperBridge Weekly Care Card.",
    "Start with what went well, list what to ask about, and say whether to contact the clinician.",
    "",
    "```json",
    JSON.stringify({ type, app, cardId, scannedAt, severity, adherencePct, missed, symptomDays, needsReview, alerts }, null, 2),
    "```",
  ].join("\n");
}
