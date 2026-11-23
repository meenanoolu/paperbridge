import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PAGE_SIZE_MM, type PageSize } from "../../core";
import { anchorOf, columnLabel, cueOf, formatDay, printableText, type CareCardSettings, type CareCol } from "./card-settings";
import { localIsoDate, weekLabel, weekStats, type WeekEntry } from "./history";
import { ADHERENCE_TARGET_PCT } from "./interpret";
import type { CarePattern } from "./patterns";

/**
 * One-page "Doctor Visit Sheet": a clinical handoff PDF generated entirely on this device with
 * pdf-lib (works offline in the PWA). Pure: the same inputs give the same bytes.
 */
export interface DoctorPdfInput {
  patientName: string;
  weeks: WeekEntry[];
  patterns: CarePattern[];
  /** Current card settings: medication names, routine anchors and pill cues. */
  card: CareCardSettings;
  generatedAt: Date;
  page?: PageSize;
}

const PT = 72 / 25.4;
const MARGIN = 48;
const INK = rgb(0, 0, 0);
const MUTED = rgb(0.25, 0.25, 0.25);
const RULE = rgb(0.6, 0.6, 0.6);
const SHADE = rgb(0.93, 0.93, 0.93);

const COLUMNS: { col: CareCol; role: string }[] = [
  { col: "am", role: "Morning dose" },
  { col: "pm", role: "Evening dose" },
  { col: "water", role: "Daily habit" },
  { col: "dizzy", role: "Symptom tracked" },
];

/**
 * Text the standard PDF fonts can draw (WinAnsi). Typographic punctuation becomes plain ASCII;
 * anything else outside Latin-1 becomes "?", so drawing never throws.
 */
export function pdfSafe(s: string): string {
  return printableText(s).replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

/**
 * The Doctor Visit PDF stays in English with standard fonts. Text a caregiver typed mostly in
 * another script (Telugu, Hindi...) would print as "????", so it becomes a plain note instead.
 * A stray symbol in Latin text still prints as "?", as before.
 */
export function englishOr(text: string, fallback: string): string {
  const t = printableText(text);
  const letters = [...t].filter((c) => /[\p{L}\p{M}]/u.test(c));
  const other = letters.filter((c) => !/[\x20-\x7e\xa0-\xff]/.test(c));
  return letters.length > 0 && other.length * 2 >= letters.length ? fallback : t;
}

class Writer {
  y: number;
  /** Lowest baseline drawn in the body (before the footer), for the layout check. */
  minBodyY = Infinity;
  constructor(
    readonly page: PDFPage,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly width: number,
  ) {
    this.y = page.getHeight() - MARGIN;
  }
  inFooter = false;
  get right() {
    return this.width - MARGIN;
  }
  /** Wrap to `maxWidth` by measured width; long words are split. */
  wrap(text: string, size: number, font: PDFFont, maxWidth: number): string[] {
    const fits = (t: string) => font.widthOfTextAtSize(t, size) <= maxWidth;
    const out: string[] = [];
    let line = "";
    for (const word of pdfSafe(text).split(" ").filter(Boolean)) {
      let w = word;
      while (!fits(w)) {
        let cut = w.length - 1;
        while (cut > 1 && !fits(w.slice(0, cut))) cut--;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const next = line ? `${line} ${w}` : w;
      if (fits(next)) line = next;
      else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
    return out;
  }
  text(t: string, x: number, size: number, opts: { bold?: boolean; color?: typeof INK; maxWidth?: number } = {}) {
    const font = opts.bold ? this.bold : this.regular;
    let s = pdfSafe(t);
    const max = opts.maxWidth ?? this.right - x;
    if (font.widthOfTextAtSize(s, size) > max) {
      while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > max) s = s.slice(0, -1);
      s = `${s.trimEnd()}...`;
    }
    this.page.drawText(s, { x, y: this.y, size, font, color: opts.color ?? INK });
    if (!this.inFooter) this.minBodyY = Math.min(this.minBodyY, this.y - size * 0.25);
  }
  /** A wrapped paragraph; returns the number of lines drawn. */
  para(t: string, size: number, opts: { bold?: boolean; color?: typeof INK; indent?: number; maxLines?: number } = {}) {
    const x = MARGIN + (opts.indent ?? 0);
    let lines = this.wrap(t, size, opts.bold ? this.bold : this.regular, this.right - x);
    if (opts.maxLines && lines.length > opts.maxLines) lines = [...lines.slice(0, opts.maxLines - 1), `${lines[opts.maxLines - 1]}...`];
    for (const line of lines) {
      this.text(line, x, size, opts);
      this.y -= size * 1.3;
    }
    return lines.length;
  }
  heading(t: string) {
    this.y -= 6;
    this.text(t, MARGIN, 12.5, { bold: true });
    this.y -= 5;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: this.right, y: this.y }, thickness: 0.75, color: RULE });
    this.y -= 13;
  }
}

const pct = (n: number | null) => (n === null ? "unknown" : `${n}%`);

/** Build the one-page Doctor Visit Sheet. */
export async function renderDoctorVisitPdf(input: DoctorPdfInput): Promise<Uint8Array> {
  return (await renderDoctorVisitPdfWithLayout(input)).bytes;
}

/** As renderDoctorVisitPdf, plus layout numbers so tests can prove nothing runs into the footer. */
export async function renderDoctorVisitPdfWithLayout(input: DoctorPdfInput): Promise<{ bytes: Uint8Array; minBodyY: number; footerTop: number; rowsListed: number }> {
  const pageSize = PAGE_SIZE_MM[input.page ?? "Letter"];
  const doc = await PDFDocument.create();
  const name = pdfSafe(englishOr(input.patientName.trim(), "(name written in another script on the card)")) || "Unnamed patient";
  const generated = formatDay(localIsoDate(input.generatedAt));
  doc.setTitle(`Doctor Visit Sheet - ${name}`);
  doc.setSubject("Medication adherence summary from PaperBridge Weekly Care Cards");
  doc.setProducer("PaperBridge");
  doc.setCreator("PaperBridge");
  doc.setCreationDate(input.generatedAt);
  doc.setModificationDate(input.generatedAt);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = pageSize.width * PT;
  const page = doc.addPage([width, pageSize.height * PT]);
  const w = new Writer(page, regular, bold, width);
  const { weeks } = input;
  const stats = weekStats(weeks);

  // Header
  w.text("Doctor Visit Sheet", MARGIN, 20, { bold: true });
  w.y -= 20;
  w.text(`Patient: ${name}`, MARGIN, 12.5, { bold: true });
  w.y -= 16;
  const range = weeks.length ? `${weekLabel(weeks[0]).replace(/^Week of |^Scanned /, "")} to ${weekLabel(weeks[weeks.length - 1]).replace(/^Week of |^Scanned /, "")}` : "";
  w.para(`Generated ${generated}. ${weeks.length} ${weeks.length === 1 ? "week" : "weeks"} covered${range ? `: ${range}` : ""}.`, 10.5, { color: MUTED });

  // Medications as printed on the current card
  w.heading("Medications and routines (as printed on the current card)");
  for (const { col, role } of COLUMNS) {
    const other = "(in another script on the card)";
    const anchor = anchorOf(input.card, col) && englishOr(anchorOf(input.card, col), other);
    const cue = cueOf(input.card, col) && englishOr(cueOf(input.card, col), other);
    const notes = [anchor && `Routine: ${anchor}`, cue && `Looks like: ${cue}`].filter(Boolean);
    w.text(`${role}:`, MARGIN, 10.5, { bold: true });
    w.text(`${englishOr(columnLabel(input.card, col), other)}${notes.length ? ` · ${notes.join(" · ")}` : ""}`, MARGIN + 110, 10.5, { maxWidth: w.right - MARGIN - 110 });
    w.y -= 14;
  }

  if (weeks.length === 0) {
    w.heading("Adherence");
    w.para("No weeks saved yet. Scan a Weekly Care Card and press Save Week to History.", 10.5);
  } else {
    // Overview
    w.heading("Overview");
    const lines = [
      stats.counted > 0
        ? `Doses taken: ${stats.taken} of ${stats.counted} recorded (${Math.round((stats.taken / stats.counted) * 100)}%). Goal: ${ADHERENCE_TARGET_PCT}% or more.`
        : "Doses taken: no readable doses.",
      stats.pcts.length
        ? `Weekly adherence: ${Math.min(...stats.pcts)}% to ${Math.max(...stats.pcts)}%; ${stats.below} of ${stats.pcts.length} ${stats.pcts.length === 1 ? "week" : "weeks"} below goal.`
        : "Weekly adherence: unknown.",
      `Days with no doses at all: ${stats.fullDaysMissed}. Days with dizziness or pain: ${stats.symptomDays}. Days with low energy (2 or below of 5): ${stats.lowEnergy}.`,
    ];
    for (const l of lines) w.para(l, 10.5, { indent: 8 });

    // Time of day
    w.heading("Missed doses by time of day");
    const latest = weeks[weeks.length - 1].doseLabels;
    const slots = [
      ["Morning", latest.Morning, stats.missedBySlot.Morning],
      ["Evening", latest.Night, stats.missedBySlot.Night],
    ] as const;
    for (const [when, label, n] of slots) {
      // Counts, not rounded percentages: rounded shares can add up to 101%.
      const share = stats.totalMissed ? ` (${n} of ${stats.totalMissed} misses)` : "";
      w.para(`${when} (${label}): ${n} missed${share}`, 10.5, { indent: 8 });
    }

    // Patterns
    w.heading("Patterns to discuss (found by fixed rules, not AI)");
    if (input.patterns.length === 0) w.para("No symptom-to-miss or time-of-day patterns in these weeks.", 10.5, { indent: 8 });
    for (const p of input.patterns.slice(0, 4)) {
      w.para(p.title, 10.5, { bold: true, indent: 8, maxLines: 2 });
      w.para(p.detail, 9.5, { indent: 18, color: MUTED, maxLines: 2 });
    }
  }

  // Footer is drawn from the bottom up; the table fills the space in between.
  const footerTop = MARGIN + 52;
  let rowsListed = 0;
  const rowH = 15;
  if (weeks.length && w.y - 40 - rowH > footerTop) {
    w.heading("Week by week");
    const cols = [
      // Widths fit "28 Dec 2026 - 3 Jan 2027", "100% (14/14) below goal" and the bold headers at 9.5 pt.
      { title: "Week", x: MARGIN },
      { title: "Adherence", x: MARGIN + 145 },
      { title: "Missed", x: MARGIN + 275 },
      { title: "Dizzy/pain days", x: MARGIN + 325 },
      { title: "Checked by hand", x: MARGIN + 412 },
    ];
    for (const c of cols) w.text(c.title, c.x + 4, 9.5, { bold: true });
    w.y -= rowH;
    // Rows that fit above the footer; keep one line for the "earlier weeks" note when needed.
    const room = Math.max(0, Math.floor((w.y - footerTop - 6) / rowH));
    const shown = weeks.length <= room ? weeks : room > 1 ? weeks.slice(-(room - 1)) : [];
    rowsListed = shown.length;
    shown.forEach((e, i) => {
      if (i % 2 === 0) page.drawRectangle({ x: MARGIN, y: w.y - 4, width: w.right - MARGIN, height: rowH, color: SHADE });
      w.text(weekLabel(e).replace(/^Week of /, ""), cols[0].x + 4, 9.5, { maxWidth: cols[1].x - cols[0].x - 8 });
      w.text(`${pct(e.adherencePct)} (${e.taken}/${e.counted})${e.adherencePct !== null && e.adherencePct < ADHERENCE_TARGET_PCT ? " below goal" : ""}`, cols[1].x + 4, 9.5, {
        bold: e.adherencePct !== null && e.adherencePct < ADHERENCE_TARGET_PCT,
        maxWidth: cols[2].x - cols[1].x - 8,
      });
      w.text(String(e.missed.length), cols[2].x + 4, 9.5);
      w.text(String(e.symptomDays.length), cols[3].x + 4, 9.5);
      w.text(e.manualOverrides ? String(e.manualOverrides) : "-", cols[4].x + 4, 9.5);
      w.y -= rowH;
    });
    if (shown.length < weeks.length) {
      w.y -= 2;
      w.text(`${weeks.length - shown.length} earlier ${weeks.length - shown.length === 1 ? "week is" : "weeks are"} included in the totals above but not listed.`, MARGIN + 4, 9, { color: MUTED });
    }
  }

  // Footer
  w.inFooter = true;
  w.y = footerTop - 6;
  page.drawLine({ start: { x: MARGIN, y: w.y + 12 }, end: { x: w.right, y: w.y + 12 }, thickness: 0.75, color: RULE });
  const audit =
    stats.verified || stats.unresolved
      ? ` Human verification: ${stats.verified} unclear ${stats.verified === 1 ? "mark was" : "marks were"} checked by hand by the caregiver; ${stats.unresolved} ${stats.unresolved === 1 ? "was" : "were"} left uncounted.`
      : " Human verification: no unclear marks needed checking.";
  w.para(
    `Recorded by the patient with a pen on PaperBridge Weekly Care Cards and read on this device by a deterministic scanner (corner markers, perspective correction, fixed thresholds; no AI, no upload). Unclear marks are never guessed.${audit} Generated ${generated}.`,
    8.5,
    { color: MUTED, maxLines: 4 },
  );
  return { bytes: await doc.save(), minBodyY: w.minBodyY, footerTop, rowsListed };
}

export function doctorPdfFileName(patientName: string, generatedAt: Date): string {
  // Fold accents ("Martínez" -> "martinez") so file names stay plain ASCII.
  const slug =
    pdfSafe(patientName)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "patient";
  return `doctor-visit-${slug}-${localIsoDate(generatedAt)}.pdf`;
}
