import { useEffect, useRef, useState, type ReactNode } from "react";
import { playHarmonicChord } from "../../shell/audio-cues";
import { CopyButton } from "../../shell/components/CopyButton";
import { ScanProblem } from "../../shell/components/FriendlyNotice";
import {
  HumanVerifyControl,
  OpticalViewToggles,
  OpticalXRayOverlay,
  ReadAloudButton,
  ScanSources,
  type HumanVerifyTheme,
  type OpticalScan,
} from "../../shell/optical";
import {
  createHunt,
  describeRoom,
  guessesLeft,
  HEAT_LABEL,
  HEAT_SHORT,
  hideAt,
  huntReceipt,
  makeGuess,
  MAX_GUESSES,
  readMap,
  ROOMS,
  runeOfRoom,
  starsOf,
  type Heat,
  type Hunt,
} from "./hunt";
import { SEANCE_RITE_LAYOUTS } from "./layout";
import { HUNT_SAMPLES } from "./samples";
import { RUNE_PALETTE } from "./theme";

const SERIF = { fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, "Times New Roman", serif' };
const btn =
  "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-[#D4AF37] bg-[#151821] px-5 py-3 text-lg font-bold text-[#F3EBD3] hover:bg-[#1d2130] disabled:opacity-60";
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

/** Dark windows with light text, so every heat reads at 7:1 or better. The word is always shown too. */
const WINDOW: Record<Heat | "unsearched", string> = {
  unsearched: "border-[#D4AF37]/60 bg-[#151821] text-[#F3EBD3]",
  found: "border-emerald-300 bg-emerald-950 text-emerald-50 shadow-[0_0_28px_-4px_#34d399]",
  scorching: "border-red-300 bg-red-950 text-red-50 shadow-[0_0_22px_-6px_#fca5a5]",
  hot: "border-orange-300 bg-orange-950 text-orange-50",
  warm: "border-yellow-300 bg-yellow-950 text-yellow-50",
  cold: "border-sky-300 bg-sky-950 text-sky-50",
  freezing: "border-indigo-300 bg-indigo-950 text-indigo-50",
};

/** Two glowing eyes in the dark: the creature. */
function Eyes({ className = "h-8 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="14" cy="16" rx="6" ry="9" fill="#a3e635" />
      <ellipse cx="34" cy="16" rx="6" ry="9" fill="#a3e635" />
      <ellipse cx="14" cy="16" rx="2" ry="6" fill="#052e16" />
      <ellipse cx="34" cy="16" rx="2" ry="6" fill="#052e16" />
    </svg>
  );
}

/** The house: a roof and 12 windows. Each window is a button, so the map can also be tapped. */
function HouseMap({ hunt, onTap }: { hunt: Hunt | null; onTap: (room: number) => void }) {
  const guessed = new Map(hunt?.guesses.map((g) => [g.room, g.heat]) ?? []);
  const live = hunt?.status === "hunting";
  return (
    <div data-house="map" className="mx-auto w-full max-w-xl">
      <svg viewBox="0 0 400 70" className="block w-full" aria-hidden="true" focusable="false">
        <path d="M10 68L200 6L390 68Z" fill="#0b0d12" stroke="#D4AF37" strokeOpacity="0.7" strokeWidth="3" strokeLinejoin="round" />
        <rect x="290" y="14" width="26" height="34" fill="#0b0d12" stroke="#D4AF37" strokeOpacity="0.7" strokeWidth="3" />
        <circle cx="200" cy="44" r="9" fill="#fde047" opacity="0.9" />
      </svg>
      <ol aria-label="The 12 rooms of the haunted house" className={`grid grid-cols-4 gap-2 rounded-b-xl border-x-2 border-b-2 border-[#D4AF37]/50 bg-[#0b0d12] p-2`}>
        {ROOMS.map((room, i) => {
          const heat = guessed.get(i);
          const isCreature = hunt && i === hunt.creature && hunt.status !== "hunting";
          const key = heat ?? "unsearched";
          const state = heat ? HEAT_SHORT[heat] : isCreature ? "The creature's room" : "Not searched yet";
          return (
            <li key={room}>
              <button
                type="button"
                disabled={!live || !!heat}
                onClick={() => onTap(i)}
                className={`flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 px-1 py-2 text-center ${WINDOW[key]} ${!heat && live ? "hover:bg-[#1d2130]" : ""} ${
                  isCreature && heat !== "found" ? "border-lime-300 bg-[#10241e]" : ""
                }`}
              >
                <span className="text-sm font-bold uppercase tracking-wide opacity-90">{i + 1}. {runeOfRoom(i)}</span>
                <span className="text-base font-extrabold leading-tight">{room}</span>
                {heat ? <span className="text-base font-black">{heat === "found" ? "Found!" : HEAT_SHORT[heat]}</span> : isCreature ? <Eyes className="h-6 w-9" /> : null}
                <span className="sr-only">{`. ${state}.${live && !heat ? " Tap to search it on screen." : ""}`}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-base text-[#D9CFB4]">Rooms next to each other are close. Row by row, left to right, like the printed map.</p>
    </div>
  );
}

/** Five candles, one per guess. A candle burns out with every guess. */
function Candles({ left }: { left: number }) {
  return (
    <div role="img" aria-label={`${left} of ${MAX_GUESSES} guesses left`} className="flex items-end gap-2">
      {Array.from({ length: MAX_GUESSES }, (_, i) => (
        <span key={i} aria-hidden className="flex flex-col items-center">
          <span className={`h-3 w-2 rounded-full ${i < left ? "bg-amber-300 shadow-[0_0_10px_3px_rgba(251,191,36,0.8)]" : "bg-transparent"}`} />
          <span className={`h-7 w-3 rounded-sm ${i < left ? "bg-[#F3EBD3]" : "bg-[#3b3f4d]"}`} />
        </span>
      ))}
    </div>
  );
}

const STORY =
  "Something nefarious is hiding in one of the 12 rooms of this haunted house. Print the map, mark ONE room with a pen, take ONE photo. The reader answers hot or cold, and it never guesses. Find the creature before the five candles burn out.";

/**
 * The Haunted Treasure Hunt: a one-photo-per-move paper game on the same optical engine. The
 * printed 12-Rune Sheet is the map. The house hides the creature (or a friend does), you mark a
 * room with a pen and scan it, and a faint mark always goes to a person.
 */
export function HuntGame({ scan }: { scan: OpticalScan }) {
  const [hunt, setHunt] = useState<Hunt | null>(null);
  const [mode, setMode] = useState<"house" | "friend">("house");
  const [pick, setPick] = useState<number | null>(null);
  const [hiding, setHiding] = useState(false);
  const [notice, setNotice] = useState("");
  const handled = useRef<string | null>(null);
  const reviewed = scan.reviewed;
  const key = reviewed ? `${reviewed.scannedAt.toISOString()}|${reviewed.manualOverrides}` : null;

  const apply = (room: number, via: string) => {
    if (!hunt) return;
    const out = makeGuess(hunt, room);
    if (out.repeat) {
      setNotice(`You already searched ${ROOMS[room]}. Mark a different room.`);
      return;
    }
    setHunt(out.hunt);
    const g = out.hunt.guesses[out.hunt.guesses.length - 1];
    setNotice(`${via} ${ROOMS[room]}: ${HEAT_LABEL[g.heat]}.`);
    if (out.hunt.status === "won") playHarmonicChord(scan.audioCues);
  };

  // One photo is one guess: read the pen on the map, ask a person about faint marks, then judge.
  useEffect(() => {
    if (!hunt || hunt.status !== "hunting" || !reviewed || !key || handled.current === key) return;
    const reading = readMap(reviewed.result);
    if (reading.kind === "unclear") {
      setNotice("One mark is too faint for the reader. Look at the amber circle and tell it: filled or blank.");
      return;
    }
    handled.current = key;
    if (reading.kind === "none") setNotice("No room is marked. Fill ONE circle on the map with a dark pen and scan again.");
    else if (reading.kind === "many") setNotice(`${reading.rooms.length} rooms are marked. Mark only ONE room per photo.`);
    else apply(reading.room, "Your pen marked");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunt, reviewed, key]);

  const begin = (h: Hunt) => {
    handled.current = key; // an older photo never counts as a guess
    setHunt(h);
    setNotice("");
    setHiding(false);
    setPick(null);
  };
  const start = () => begin(createHunt(Math.floor(Math.random() * 2 ** 31)));

  const last = hunt?.guesses[hunt.guesses.length - 1];
  const over = !!hunt && hunt.status !== "hunting";

  const header = (children: ReactNode) => (
    <h2 className="text-3xl font-semibold tracking-wide text-[#D4AF37]" style={SERIF}>
      {children}
    </h2>
  );

  return (
    <section aria-labelledby="hunt-title" data-game="treasure-hunt" className="rounded-2xl border border-[#D4AF37]/70 bg-[#10131a]/80 p-4 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.15)] sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div id="hunt-title">{header("Haunted Treasure Hunt")}</div>
          <p className="text-xl leading-relaxed text-[#F3EBD3]" style={SERIF}>
            {STORY}
          </p>

          {!hunt && !hiding && (
            <div className="space-y-3" data-step="start">
              <fieldset>
                <legend className="text-lg font-bold">Who hides the creature?</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ["house", "The house hides it (play alone)"],
                      ["friend", "A friend hides it (two players)"],
                    ] as const
                  ).map(([m, label]) => (
                    <label
                      key={m}
                      className={`cursor-pointer rounded-xl border-2 px-4 py-2 text-lg font-bold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-yellow-300 ${
                        mode === m ? "border-emerald-300 bg-[#10241e]" : "border-[#D4AF37]/60 bg-[#151821]"
                      }`}
                    >
                      <input type="radio" name="hunt-mode" className="sr-only" checked={mode === m} onChange={() => setMode(m)} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="button" className={CLASSES.primary} onClick={() => (mode === "house" ? start() : setHiding(true))} data-action="begin">
                {mode === "house" ? "Begin the hunt" : "Friend: choose a hiding room"}
              </button>
            </div>
          )}

          {hiding && (
            <div className="space-y-3" data-step="friend-hide">
              <p className="text-lg font-bold text-amber-200">Hunter, look away. Friend, pick the room where the creature hides.</p>
              <fieldset>
                <legend className="sr-only">Hiding room</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ROOMS.map((r, i) => (
                    <label
                      key={r}
                      className={`cursor-pointer rounded-lg border-2 px-3 py-2 text-base font-bold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-yellow-300 ${
                        pick === i ? "border-emerald-300 bg-[#10241e]" : "border-[#D4AF37]/60 bg-[#151821]"
                      }`}
                    >
                      <input type="radio" name="hunt-hide" className="sr-only" checked={pick === i} onChange={() => setPick(i)} />
                      {r}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="button" className={CLASSES.primary} disabled={pick === null} onClick={() => pick !== null && begin(hideAt(pick))}>
                Hide it and look back
              </button>
            </div>
          )}

          {hunt && (
            <div className="space-y-4" data-step="hunt">
              <div className="flex flex-wrap items-center gap-4">
                <Candles left={guessesLeft(hunt)} />
                <p className="text-lg font-bold text-[#D9CFB4]">
                  {hunt.status === "hunting" ? `${guessesLeft(hunt)} guesses left` : hunt.status === "won" ? "Hunt won" : "Hunt lost"}
                </p>
              </div>

              {hunt.status === "hunting" && (
                <>
                  <ScanSources scan={scan} layouts={SEANCE_RITE_LAYOUTS} samples={HUNT_SAMPLES} classes={CLASSES} samplesLabel="Marked map photos (no printer needed)" />
                  <p className="text-base text-[#D9CFB4]">
                    No printer or camera? Tap a window on the house instead.{" "}
                    <button
                      type="button"
                      className="font-bold text-[#D4AF37] underline underline-offset-4"
                      onClick={() => {
                        const d = document.querySelector<HTMLDetailsElement>('[data-drawer="more"]');
                        if (d) {
                          d.open = true;
                          d.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                    >
                      Get the printable map
                    </button>
                  </p>
                </>
              )}
              <p className="sr-only" role="status" aria-live="polite">
                {notice || scan.liveMessage}
              </p>
              {notice && (
                <p data-testid="hunt-notice" className="rounded-xl border border-[#D4AF37]/60 bg-[#151821] px-4 py-3 text-xl font-bold text-[#F3EBD3]">
                  {notice}
                </p>
              )}
              {scan.state.status === "busy" && <p className="text-lg font-bold">The spirits are reading {scan.state.label}...</p>}
              {scan.state.status === "error" && <p className="text-lg font-bold text-amber-200">{scan.state.message}</p>}
              {scan.scan && (
                <div className="space-y-3">
                  <OpticalViewToggles scan={scan} className={btn} />
                  <div className="relative overflow-hidden rounded-xl" data-testid="hunt-xray">
                    <OpticalXRayOverlay scan={scan} describe={describeRoom} palette={RUNE_PALETTE} />
                  </div>
                  <ScanProblem scan={scan.scan} />
                </div>
              )}
              {hunt.status === "hunting" && scan.unclear.length > 0 && (
                <HumanVerifyControl
                  unclear={scan.unclear}
                  overrides={scan.overrides}
                  onSet={scan.setAnswer}
                  describe={describeRoom}
                  theme={VERIFY_THEME}
                  title="Confirm the faint mark"
                  hint="The reader is not sure about this mark, so it will not guess. Look at the amber circle on the photo, then tap Mark filled or Mark blank."
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <HouseMap hunt={hunt} onTap={(room) => apply(room, "You searched")} />
          {hunt && hunt.guesses.length > 0 && (
            <ol aria-label="Your guesses so far" className="space-y-1 text-lg" data-trail>
              {hunt.guesses.map((g, i) => (
                <li key={g.room} className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[#D4AF37]">Guess {i + 1}:</span> {ROOMS[g.room]}
                  <span className={`rounded-full border-2 px-3 py-0.5 text-base font-black ${WINDOW[g.heat]}`}>{HEAT_SHORT[g.heat]}</span>
                </li>
              ))}
            </ol>
          )}
          {last && hunt?.status === "hunting" && (
            <p className="text-2xl font-semibold text-amber-200" style={SERIF} data-testid="hunt-heat">
              {HEAT_LABEL[last.heat]}.
            </p>
          )}
          {over && hunt && (
            <article
              aria-labelledby="hunt-result"
              data-result={hunt.status}
              className={`rounded-xl border p-4 ${hunt.status === "won" ? "border-emerald-300/70 bg-[#0e1a17] shadow-[0_0_30px_-10px_rgba(52,211,153,0.7)]" : "border-red-300/70 bg-[#1a0e12]"}`}
            >
              <h3 id="hunt-result" className="text-2xl font-semibold text-[#F3EBD3]" style={SERIF}>
                {hunt.status === "won" ? `You found it in the ${ROOMS[hunt.creature]}!` : `The creature was hiding in the ${ROOMS[hunt.creature]}.`}
              </h3>
              <p className="mt-1 text-xl" style={SERIF}>
                {hunt.status === "won"
                  ? `${hunt.guesses.length} of ${MAX_GUESSES} guesses, ${starsOf(hunt)} ${starsOf(hunt) === 1 ? "star" : "stars"}. It hisses and slinks back into the dark.`
                  : "The last candle goes out. It grins in the dark. Try again?"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-[#F3EBD3] p-3 text-slate-950 [&_:focus-visible]:outline-slate-950">
                <CopyButton text={huntReceipt(hunt)} label="Copy the haunting report" copiedMessage="Copied. Share it with a friend." />
                <ReadAloudButton summary={{ text: huntReceipt(hunt), lang: "en-US" }} />
              </div>
              <button
                type="button"
                className={`${CLASSES.primary} mt-3`}
                onClick={() => {
                  setHunt(null);
                  setHiding(false);
                  setNotice("");
                }}
              >
                Hunt again
              </button>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

