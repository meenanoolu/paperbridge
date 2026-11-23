import { shortDate } from "./due-review";
import type { GradeReport } from "./grade";

/** Thin wiring for the shell's Read Aloud and Copy Quick Update buttons. */
export function studySpokenSummary(g: GradeReport): { text: string; lang: string } {
  const due = g.weakTopics.length ? ` Review next: ${g.weakTopics.join(", ")}.` : " No topics need review.";
  return { text: `Score: ${g.correct} out of ${g.total}, ${g.scorePct} percent.${due}`, lang: "en-US" };
}

export function studyShareText(g: GradeReport): string {
  const dates = g.schedule[0]?.dates ?? [];
  return [
    `Quiz result: ${g.correct} of ${g.total} (${g.scorePct}%).`,
    g.weakTopics.length ? `Review next: ${g.weakTopics.join(", ")}.` : "No topics need review. Well done!",
    dates.length ? `Review dates: ${dates.map(shortDate).join(", ")}.` : "Next step: try a new quiz.",
  ].join("\n");
}
