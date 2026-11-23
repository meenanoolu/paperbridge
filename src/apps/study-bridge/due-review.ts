import { checkPrintedText, type CardLayout } from "../../core";
import type { AdaptiveCardSpec } from "../../shell/components/AdaptiveCard";
import type { GradeReport } from "./grade";
import { STUDY_LAYOUTS } from "./layout";

/**
 * Adaptive Paper Loop for Study Bridge: after a sheet with weak topics is graded, print a review
 * answer sheet whose header names the topics due and whose footer lists the 1/3/7-day review
 * dates. Only printed text changes, so the review sheet scans and grades like any other.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Tue 24 Nov". Locale-independent so the printed sheet is deterministic. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[date.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** Header lines to try, longest first: every topic, then the first few with a count of the rest. */
export function reviewSubtitleCandidates(topics: string[]): string[] {
  const out: string[] = [];
  for (let k = topics.length; k >= 1; k--) {
    const rest = topics.length - k;
    out.push(`Review: ${topics.slice(0, k).join(", ")}${rest ? ` +${rest} more` : ""}`);
  }
  out.push(`Review: ${topics.length} ${topics.length === 1 ? "topic" : "topics"}`);
  return out;
}

/** Footer lines with the review dates, longest first. */
export function reviewDueCandidates(dates: string[]): string[] {
  const [d1, d3, d7] = dates.map(shortDate);
  return [`Review due ${d1} (1 day), ${d3} (3 days) and ${d7} (7 days).`, `Review due ${d1}, ${d3} and ${d7}.`, `Due: ${d1}, ${d3}, ${d7}.`];
}

export interface DueReviewSheet {
  topics: string[];
  /** Spaced-repetition dates (YYYY-MM-DD), +1, +3 and +7 days after the scan. */
  dates: string[];
  layouts: CardLayout[];
}

/** Null when nothing is due (no weak topics). */
export function dueReviewSheet(report: Pick<GradeReport, "weakTopics" | "schedule">, bases: CardLayout[] = STUDY_LAYOUTS): DueReviewSheet | null {
  const topics = report.weakTopics;
  if (!topics.length) return null;
  const dates = report.schedule.find((s) => s.topic === topics[0])?.dates ?? [];
  if (dates.length < 3) return null;
  const layouts = bases.map((base) => {
    const titles = ["Review Answer Sheet", base.title];
    const subs = reviewSubtitleCandidates(topics);
    const dues = reviewDueCandidates(dates);
    for (const due of dues)
      for (const subtitle of subs)
        for (const title of titles) {
          const footer = base.footer && { ...base.footer, lines: [...base.footer.lines.slice(0, -1), due], boldLines: [base.footer.lines.length - 1] };
          const layout: CardLayout = { ...base, title, subtitle, footer };
          if (checkPrintedText(layout).length === 0) return layout;
        }
    return base;
  });
  return { topics, dates, layouts };
}

export function dueReviewFileName(dates: string[], page: string): string {
  return `review-sheet-${dates[0] ?? "due"}-${page}.pdf`;
}

/** The shell's adaptive-card spec ("Print Due Review Card"), or null when no topic is due. */
export function dueReviewSpec(report: Pick<GradeReport, "weakTopics" | "schedule">): AdaptiveCardSpec | null {
  const sheet = dueReviewSheet(report);
  if (!sheet) return null;
  return {
    heading: "Next: a review sheet",
    label: "Print Due Review Card",
    icon: "calendar",
    layouts: sheet.layouts,
    fileName: (page) => dueReviewFileName(sheet.dates, page),
    description: `Header: review ${sheet.topics.join(", ")}. Footer: due ${sheet.dates.map(shortDate).join(", ")} (1, 3 and 7 days). Same circles, so it grades like any sheet.`,
  };
}
