import { columnLabel, type CareCardSettings } from "./card-settings";
import { CARD_LANGUAGE_TAGS, ENGLISH_FOCUS, ENGLISH_SPOKEN, languagePack, translateLabel } from "./i18n";
import type { CareReport } from "./interpret";
import { DAYS } from "./layout";

/**
 * Thin wiring for the shell's Read Aloud and Copy Quick Update buttons. Read Aloud speaks in the
 * card's language, so a caregiver can play the week back to the patient; the quick update is a
 * short English message for family.
 */
export function elderSpokenSummary(r: CareReport, card: CareCardSettings, manualOverrides: number): { text: string; lang?: string } {
  const pack = languagePack(card.language);
  const p = pack?.spoken ?? ENGLISH_SPOKEN;
  const f = pack?.focus ?? ENGLISH_FOCUS;
  const parts = [r.adherencePct === null ? p.unknown : p.adherence(r.adherencePct), r.missed.length ? p.missed(r.missed.length) : p.noneMissed];
  if (r.symptomDays.length) parts.push(p.symptoms(r.symptomDays.length));
  const pattern = r.patterns[0];
  if (pattern) parts.push(`${f.lead} ${translateLabel(pack, columnLabel(card, pattern.slot === "Morning" ? "am" : "pm"))}${f.stop ?? "."}`);
  if (manualOverrides > 0) parts.push(p.verified(manualOverrides));
  return { text: parts.join(" "), lang: CARD_LANGUAGE_TAGS[card.language ?? "en"] };
}

const short = (days: string[]) => [...days].sort((a, b) => DAYS.indexOf(a as never) - DAYS.indexOf(b as never)).join(", ");

export function elderShareText(r: CareReport, card: CareCardSettings, manualOverrides: number): string {
  const who = card.patientName.trim();
  const flag = r.patterns[0]
    ? `Worth asking about: ${r.patterns[0].title}.`
    : r.missed.length || r.symptomDays.length
      ? [r.missed.length ? `${r.missed.length} missed (${short(r.missed.map((m) => `${m.day} ${m.slot === "Morning" ? "AM" : "PM"}`))})` : "", r.symptomDays.length ? `dizzy or pain on ${short(r.symptomDays)}` : ""].filter(Boolean).join("; ") + "."
      : "No missed doses or symptoms marked.";
  return [
    `Weekly care update${who ? ` for ${who}` : ""}:`,
    r.adherencePct === null ? "Doses could not be counted from the card this week." : `Took ${r.adherencePct}% of doses this week (${r.taken} of ${r.counted}).`,
    flag.charAt(0).toUpperCase() + flag.slice(1),
    manualOverrides > 0 ? `Manually verified (${manualOverrides}) on the paper card.` : "Every mark on the card was clear.",
  ].join("\n");
}

/** `cardLanguage` for the Kiro Crew alert: only for translated cards, so English alerts are unchanged. */
export function alertCardLanguage(card: CareCardSettings): string | undefined {
  return card.language && card.language !== "en" ? CARD_LANGUAGE_TAGS[card.language] : undefined;
}
