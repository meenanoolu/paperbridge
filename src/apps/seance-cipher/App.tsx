import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ReviewedScan } from "../../shell/scan";
import type { AppMeta } from "../../shell/app-registry";
import { playHarmonicChord } from "../../shell/audio-cues";
import { localBatchAdapter } from "../../shell/local-batch";
import {
  BatchDropzone,
  HumanVerifyControl,
  OpticalViewToggles,
  OpticalXRayOverlay,
  PrintSheetButton,
  ReadAloudButton,
  ScanSources,
  useOpticalScan,
  type HumanVerifyTheme,
} from "../../shell/optical";
import { usePersistentState } from "../../shell/usePersistentState";
import { RiteGame } from "./RiteGame";
import { RitePrint } from "./RitePrint";
import { RUNE_PALETTE } from "./theme";
import { chapterLayouts, chapterOf, CHAPTERS, describeRune, RUNE_NAMES, SEANCE_LAYOUTS } from "./layout";
import { readOracle, readingSummary } from "./oracle";
import { SEANCE_SAMPLES } from "./samples";

/** Obsidian, antique brass, parchment. Every text colour is at least 7:1 on its surface. */
const OBSIDIAN = "#0B0D12";
const SERIF = { fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, "Times New Roman", serif' };

const btn = "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-[#D4AF37] bg-[#151821] px-5 py-3 text-lg font-bold text-[#F3EBD3] hover:bg-[#1d2130] disabled:opacity-60";
const CLASSES = {
  button: btn,
  primary: `${btn} shadow-[0_0_18px_-4px_#D4AF37]`,
  sample: "rounded-xl border-2 border-[#D4AF37]/60 bg-[#151821] p-3 text-[#F3EBD3] hover:bg-[#1d2130]",
  activeSample: "rounded-xl border-2 border-emerald-300 bg-[#10241e] p-3 text-[#F3EBD3]",
};

const VERIFY_THEME: HumanVerifyTheme = {
  row: "border-[#D4AF37]/60 bg-[#151821] text-[#F3EBD3]",
  stamp: "border-emerald-300 text-emerald-200",
  button: "border-[#D4AF37] bg-[#151821] text-[#F3EBD3] hover:bg-[#1d2130]",
};

const parseChapter = (v: unknown) => (typeof v === "number" && v >= 1 && v <= CHAPTERS.length ? v : null);

/** Thin brass hairline frame used across the page. */
function Panel({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-[#D4AF37]/70 bg-[#10131a]/80 p-5 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.15)]">
      <h2 id={id} className="text-3xl font-semibold tracking-wide text-[#D4AF37]" style={SERIF}>
        {title}
      </h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export function SeanceCipherApp() {
  const [chapter, setChapter] = usePersistentState("seance-cipher.chapter", parseChapter, 1);
  const announce = useMemo(() => (scan: ReviewedScan) => readingSummary(readOracle(scan.result, chapter)), [chapter]);
  const scan = useOpticalScan(SEANCE_LAYOUTS, { announce });
  const { setXray } = scan;
  // The X-Ray is the point of a seance: show the runes lock on from the first scan.
  useEffect(() => setXray(true), [setXray]);
  const reading = scan.reviewed ? readOracle(scan.reviewed.result, chapter) : null;
  const verdictKey = reading?.verdict ? `${scan.reviewed!.scannedAt.toISOString()}|${reading.verdict.title}|${scan.reviewed!.manualOverrides}` : null;
  const lastChord = useRef<string | null>(null);
  useEffect(() => {
    if (!verdictKey || lastChord.current === verdictKey) return;
    lastChord.current = verdictKey;
    playHarmonicChord(scan.audioCues);
  }, [verdictKey, scan.audioCues]);
  const [sweep, setSweep] = useState(false);
  useEffect(() => {
    if (!scan.busy && !scan.scan) return;
    setSweep(true);
    const t = window.setTimeout(() => setSweep(false), 1400);
    return () => window.clearTimeout(t);
  }, [scan.busy, scan.scan]);
  const next = (chapter % CHAPTERS.length) + 1;
  // The stage fills the screen below the launcher bar, which wraps to 2 lines on narrow windows:
  // measure where the page really starts and hand it to the CSS.
  const root = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => setTop(root.current ? Math.round(root.current.getBoundingClientRect().top + window.scrollY) : null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div ref={root} className="on-dark flex min-h-[calc(100svh-var(--launcher,4.1rem))] flex-col px-3 py-3 text-[#F3EBD3] sm:px-6" style={{ background: `radial-gradient(ellipse at top, #1a1d27 0%, ${OBSIDIAN} 60%)`, ...(top ? ({ "--launcher": `${top}px` } as CSSProperties) : {}) }} data-frontend="seance-cipher">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-baseline gap-x-4 gap-y-0 px-1">
          <h1 className="text-4xl font-semibold tracking-wide sm:text-5xl" style={SERIF}>
            X-Ray Rite
          </h1>
          <p className="text-2xl text-[#D9CFB4] sm:text-3xl" style={SERIF}>
            The Endless Obsidian Seance
          </p>
          <p className="ml-auto hidden text-base font-bold uppercase tracking-[0.25em] text-[#D4AF37] min-[1500px]:block">Seance Cipher: a Kiroween paper arcade</p>
        </header>

        <RiteGame />

        <details className="group rounded-xl border border-[#D4AF37]/60 bg-[#10131a]/80" open={scan.scan ? true : undefined} data-drawer="more">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-lg font-bold">
            <span>Print the 12-Rune Sheet, the classic Oracle reading and more</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l7 7 7-7" /></svg>
          </summary>
          <div className="space-y-4 p-4">
            <p className="max-w-3xl text-lg text-[#D9CFB4]">
              12 spooky runes light up in waves. Cover each one with a finger or a token before the timer runs out, and the offline optical scanner reads your cover live. It never guesses: only a clear
              cover counts, and a shaky one makes your hand tremble.
            </p>
            <RitePrint />

        <details className="rounded-2xl border border-[#D4AF37]/60 p-4" open={scan.scan ? true : undefined} data-section="classic-oracle">
          <summary className="cursor-pointer text-lg font-bold">Classic Oracle reading: scan a finished Oracle Cipher card</summary>
          <p className="mt-2 text-lg text-[#D9CFB4]">
            The original 3-question card still works: it has the same 12 circles and the same card ID, so the same scanner reads it. A card routed here from Skeleton Home opens this panel.
          </p>
          <div className="mt-4">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Panel title="Summon a reading" id="seance-scan">
              <fieldset>
                <legend className="text-lg font-bold">Which chapter card are you scanning?</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CHAPTERS.map((c) => (
                    <label
                      key={c.number}
                      className={`cursor-pointer rounded-xl border-2 px-4 py-2 text-lg font-bold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-yellow-300 ${
                        chapter === c.number ? "border-emerald-300 bg-[#10241e]" : "border-[#D4AF37]/60 bg-[#151821]"
                      }`}
                    >
                      <input type="radio" name="seance-chapter" className="sr-only" checked={chapter === c.number} onChange={() => setChapter(c.number)} />
                      {c.number}. {c.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <ScanSources scan={scan} layouts={SEANCE_LAYOUTS} samples={SEANCE_SAMPLES} classes={CLASSES} samplesLabel="Haunted sample cards (no printer needed)" />
              <p className="sr-only" role="status" aria-live="polite">
                {scan.liveMessage}
              </p>
              {scan.state.status === "busy" && <p className="text-lg font-bold">The spirits are reading {scan.state.label}...</p>}
              {scan.state.status === "error" && <p className="text-lg font-bold text-amber-200">{scan.state.message}</p>}
              {scan.scan && (
                <div className="space-y-3">
                  <OpticalViewToggles scan={scan} className={btn} />
                  <div className="relative overflow-hidden rounded-xl" data-testid="seance-view">
                    <OpticalXRayOverlay scan={scan} describe={describeRune} palette={RUNE_PALETTE} />
                    {sweep && (
                      <span
                        aria-hidden
                        data-laser
                        className="pointer-events-none absolute inset-x-0 hidden h-[3px] bg-emerald-300 shadow-[0_0_16px_4px_rgba(52,211,153,0.8)] motion-safe:block motion-safe:animate-[laser-sweep_1.4s_ease-in-out]"
                      />
                    )}
                  </div>
                  {!scan.scan.result.ok && <p className="text-lg font-bold text-amber-200">The card stayed silent: all 4 corner squares must be in the picture.</p>}
                </div>
              )}
            </Panel>

            <div className="space-y-6">
              <Panel title="The verdict" id="seance-verdict">
                {!reading && <p className="text-lg text-[#D9CFB4]">Scan a card, or choose a haunted sample card, to hear what the runes say.</p>}
                {reading && (
                  <>
                    <ol className="space-y-1 text-lg" aria-label="Runes read">
                      {reading.answers.map((a, i) => (
                        <li key={a.question}>
                          <span className="font-bold text-[#D4AF37]">Question {i + 1}:</span>{" "}
                          {a.rune ? RUNE_NAMES[a.rune] : a.status === "unclear" ? "a faint mark" : a.status === "multiple" ? "too many runes" : "no rune"}
                        </li>
                      ))}
                    </ol>
                    <HumanVerifyControl
                      unclear={scan.unclear}
                      overrides={scan.overrides}
                      onSet={scan.setAnswer}
                      describe={describeRune}
                      theme={VERIFY_THEME}
                      title="Confirm the faint mark"
                    />
                    {reading.prompt && <p className="text-lg font-bold text-amber-200">{reading.prompt}</p>}
                    {reading.verdict && (
                      <article aria-labelledby="seance-story" className="rounded-xl border border-emerald-300/70 bg-[#0e1a17] p-4 shadow-[0_0_30px_-10px_rgba(52,211,153,0.7)]" data-fate={reading.verdict.fate}>
                        <h3 id="seance-story" className="text-2xl font-semibold text-emerald-200" style={SERIF}>
                          {reading.verdict.title}
                        </h3>
                        <p className="mt-2 text-xl leading-relaxed" style={SERIF}>
                          {reading.verdict.story}
                        </p>
                        <div className="mt-3">
                          <ReadAloudButton summary={{ text: `${reading.verdict.title}. ${reading.verdict.story}`, lang: "en-US" }} />
                        </div>
                      </article>
                    )}
                  </>
                )}
              </Panel>

              <section aria-labelledby="seance-print" className="rounded-2xl border-2 border-[#6b4f0f] bg-[#F3EBD3] p-5 text-slate-950 [&_:focus-visible]:outline-slate-950">
                <h2 id="seance-print" className="text-3xl font-semibold" style={SERIF}>
                  Print a cipher card
                </h2>
                <p className="mt-1 text-lg">Each card shows the 4 runes as pictures. Every chapter scans the same way.</p>
                <div className="mt-3 space-y-4">
                  <PrintSheetButton
                    layouts={chapterLayouts(chapter)}
                    label={`Print Chapter ${chapter} Card`}
                    icon="printer"
                    fileName={(page) => `oracle-cipher-chapter-${chapter}-${page}.pdf`}
                    description={`Chapter ${chapter}: ${chapterOf(chapter).name}.`}
                  />
                  {reading?.verdict && (
                    <div className="space-y-2 border-t-2 border-[#6b4f0f]/40 pt-3">
                      <PrintSheetButton
                        layouts={chapterLayouts(next)}
                        label={`Print the Next Chapter (${next})`}
                        icon="sparkle"
                        fileName={(page) => `oracle-cipher-chapter-${next}-${page}.pdf`}
                        description={`The story continues in Chapter ${next}: ${chapterOf(next).name}.`}
                      />
                      <button type="button" onClick={() => setChapter(next)} className="inline-flex min-h-14 items-center rounded-xl border-2 border-slate-950 bg-white px-5 py-3 text-lg font-bold hover:bg-slate-100">
                        I am on Chapter {next} now
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
          </div>
        </details>

        <details className="rounded-2xl border border-[#D4AF37]/60 p-4">
          <summary className="cursor-pointer text-lg font-bold">Scan a stack of cards from any PaperBridge app</summary>
          <div className="mt-3 text-slate-950 [&_:focus-visible]:outline-slate-950">
            <BatchDropzone />
          </div>
        </details>
          </div>
        </details>
      </div>
    </div>
  );
}

export const appMeta: AppMeta = {
  id: "seance-cipher",
  label: "Seance Cipher",
  icon: "moon",
  order: 3,
  fullBleed: true,
  layouts: SEANCE_LAYOUTS,
  batch: localBatchAdapter({ storageKey: "seance-cipher.saved", noun: ["reading", "readings"], place: "the Grimoire", inputLabel: "Name of the seer" }),
  // Dark brass: white text on it is 9:1. The page itself is obsidian.
  accent: { name: "obsidian-brass", strong: "#5b4310", soft: "#f7f1dc" },
  samples: SEANCE_SAMPLES,
};
export default SeanceCipherApp;
