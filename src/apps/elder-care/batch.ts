import type { BatchAdapter } from "../../shell/batch";
import { loadJson, saveJson } from "../../shell/storage";
import { columnLabel, DEFAULT_CARE_SETTINGS, mondayOf, parseCareSettings } from "./card-settings";
import { addWeek, parseHistory, toWeekEntry, type WeekEntry } from "./history";
import { interpretCareCard } from "./interpret";
import { CARE_SETTINGS_KEY, HISTORY_KEY } from "./storage-keys";

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/**
 * Bulk save for "Scan Any Card": each decoded Weekly Care Card becomes a week in Multi-Week
 * History, for the patient and medication labels on the saved card. Each row picks its week.
 */
export const ELDER_BATCH: BatchAdapter = {
  input: { label: "Week starting (Monday)", type: "date", hint: "Leave empty for an undated card." },
  defaults(items) {
    // A 4-Week Pack starts on the saved card's Monday: prefill consecutive weeks from it.
    const start = loadJson(CARE_SETTINGS_KEY, parseCareSettings, DEFAULT_CARE_SETTINGS).weekStart;
    return items.map((_, i) => (start ? addDays(start, 7 * i) : ""));
  },
  validate(values) {
    const mondays = values.map((v) => (v ? mondayOf(v) : ""));
    return values.map((v, i) => {
      if (!v) return null;
      if (!mondays[i]) return "Enter a valid date.";
      return mondays.indexOf(mondays[i]) !== i ? "Same week as another card in this batch." : null;
    });
  },
  actionLabel: (n) => `Save ${n} ${n === 1 ? "card" : "cards"} to Multi-Week History`,
  save(items, now) {
    const card = loadJson(CARE_SETTINGS_KEY, parseCareSettings, DEFAULT_CARE_SETTINGS);
    const doseLabels = { Morning: columnLabel(card, "am"), Night: columnLabel(card, "pm") };
    let list: WeekEntry[] = loadJson(HISTORY_KEY, parseHistory, []);
    let replaced = 0;
    for (const it of items) {
      const entry = toWeekEntry(interpretCareCard(it.scan, { doseLabels }), {
        scannedAt: it.scannedAt,
        savedAt: now,
        card: { ...card, weekStart: it.value ? mondayOf(it.value) : "" },
        manualOverrides: 0,
      });
      const r = addWeek(list, entry);
      list = r.list;
      if (r.replaced) replaced++;
    }
    const ok = saveJson(HISTORY_KEY, list);
    const who = card.patientName ? ` for ${card.patientName}` : "";
    const n = items.length;
    if (!ok) return `Could not save: this browser blocked storage.`;
    return `Saved ${n} ${n === 1 ? "week" : "weeks"} to Multi-Week History${who}${replaced ? ` (${replaced} replaced an earlier save)` : ""}.`;
  },
};
