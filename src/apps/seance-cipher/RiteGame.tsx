import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CameraError, rasterToDataUrl } from "../../core";
import { defaultPageSize } from "../../shell/components/PrintCard";
import { usePersistentState } from "../../shell/usePersistentState";
import { xrayModel } from "../../shell/xray";
import { RITE_RUNE_COUNT, RITE_RUNE_NAMES, SEANCE_RITE_LAYOUTS } from "./layout";
import { CoachGhost } from "./CoachGhost";
import { LiveOverlay, type LiveView } from "./RiteLive";
import { LaunchPad, RuneGlyph, type Burst } from "./RitePads";
import { RiteReceipt } from "./RiteReceipt";
import { coachFor, HOWTO_STEPS, sheetMissing, type Reaction } from "./riteCoach";
import { closeRiteAudio, playRite } from "./riteAudio";
import { CAMERA_HELP, openRiteCamera, type RiteCamera, type RiteFrame } from "./riteCamera";
import {
  confirmCoverage,
  createGame,
  emptyPad,
  formatMultiplier,
  formatScore,
  INTERFERENCE_RANGE,
  MAX_LIVES,
  PERFECT,
  padCoverage,
  padPress,
  padRelease,
  receiptOf,
  runeForKey,
  startGame,
  tick,
  type PadState,
  type PlayMode,
  type RiteState,
} from "./riteEngine";
import { modelWithCoverage, sheetSnapshot, type FrozenFrame } from "./riteSheet";
import { coverageFromScan, runeKey } from "./riteVision";
import { ghostlyStatus, TREMBLE_HINT } from "./riteVoice";
import { RITE_COLORS, RITE_CSS } from "./theme";

const SERIF = { fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, "Times New Roman", serif' };
const btn =
  "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-[#D4AF37] bg-[#151821] px-5 py-3 text-lg font-bold text-[#F3EBD3] hover:bg-[#1d2130] disabled:opacity-60";
const btnSm = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#D4AF37] bg-[#151821] px-4 py-2 text-lg font-bold text-[#F3EBD3] hover:bg-[#1d2130]";
const primary = `${btn} shadow-[0_0_18px_-4px_#D4AF37]`;

const parseMode = (v: unknown): PlayMode | null => (v === "live" || v === "digital" ? v : null);
const parseBool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const parseBest = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

/** The game advances this often (about 30 times a second). */
const STEP_MS = 33;
/** The longest single step: a stalled tab never swallows a whole wave. */
const MAX_STEP_MS = 100;
/** A live reading older than this means the camera lost the sheet. */
const STALE_MS = 700;
const BURST_MS = 700;

const zeros = () => Array.from({ length: RITE_RUNE_COUNT }, () => 0);
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

const isEditable = (t: EventTarget | null) => {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return true;
  return t.tagName === "INPUT" && !["radio", "checkbox", "button", "submit"].includes((t as HTMLInputElement).type);
};

function Hearts({ lives }: { lives: number }) {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {Array.from({ length: MAX_LIVES }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-6 w-6" data-life={i < lives ? "kept" : "lost"}>
          <path
            d="M12 21s-7.5-4.6-9.6-9.1C1 8.8 2.7 5.5 6 5.5c2 0 3.2 1 4 2.2.8-1.2 2-2.2 4-2.2 3.3 0 5 3.3 3.6 6.4C19.5 16.4 12 21 12 21z"
            fill={i < lives ? RITE_COLORS.crimson : "none"}
            stroke={RITE_COLORS.crimson}
            strokeWidth="2"
          />
        </svg>
      ))}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="rounded-xl border border-[#D4AF37]/50 bg-[#151821] px-3 py-1">
      <p className="text-base font-bold uppercase tracking-wider text-[#D4AF37]">{label}</p>
      <p className="text-2xl font-bold leading-tight tabular-nums text-[#F3EBD3]">{children}</p>
    </li>
  );
}

/**
 * X-Ray Rite: The Endless Obsidian Seance. Runes light up in waves; cover them (with a finger or
 * token under the camera, or on the digital launchpad) before the timer runs out. All rules live
 * in `riteEngine.ts`; this component only feeds it readings and draws the result.
 */
export function RiteGame() {
  const [mode, setMode] = usePersistentState("seance-cipher.rite-mode", parseMode, "digital" as PlayMode);
  const [sound, setSound] = usePersistentState("seance-cipher.rite-sound", parseBool, true);
  const [best, setBest] = usePersistentState("seance-cipher.rite-best", parseBest, 0);
  const [game, setGame] = useState<RiteState>(() => createGame());
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("Choose a mode, then start the rite.");
  const [display, setDisplay] = useState<number[]>(zeros);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [frame, setFrame] = useState<FrozenFrame | null>(null);
  const [cam, setCam] = useState<{ status: "off" | "starting" | "on" | "error"; message: string }>({ status: "off", message: "" });
  const [view, setView] = useState<LiveView | null>(null);
  const [held, setHeld] = useState<number[]>([]);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [noSheet, setNoSheet] = useState(false);

  // Everything the animation loop and the camera callbacks read lives in refs, so they never go stale.
  const gameRef = useRef(game);
  const modeRef = useRef(mode);
  const soundRef = useRef(sound);
  const bestRef = useRef(best);
  modeRef.current = mode;
  soundRef.current = sound;
  bestRef.current = best;
  const padRef = useRef<PadState>(emptyPad);
  const liveRef = useRef<{ cover: number[] | null; at: number } | null>(null);
  const prevRaw = useRef<number[] | null>(null);
  const lastGood = useRef<RiteFrame | null>(null);
  const camRef = useRef<RiteCamera | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timers = useRef(new Set<number>());
  const mounted = useRef(true);
  const openToken = useRef(0);
  const burstId = useRef(0);
  const lastSeen = useRef(0);

  // --- Camera -------------------------------------------------------------------------------

  const onFrame = useCallback((f: RiteFrame) => {
    const cov = coverageFromScan(f.result);
    liveRef.current = { cover: confirmCoverage(prevRaw.current, cov), at: performance.now() };
    prevRaw.current = cov;
    if (f.result.ok) {
      lastGood.current = f;
      lastSeen.current = performance.now();
    }
    const model = xrayModel(f.result, f.layout);
    const byKey = new Map(model?.bubbles.map((b) => [b.key, b]));
    setView({
      width: f.frame.width,
      height: f.frame.height,
      bubbles: model ? Array.from({ length: RITE_RUNE_COUNT }, (_, i) => byKey.get(runeKey(i)) ?? { x: 0, y: 0, r: 0 }).map((b) => ({ x: b.x, y: b.y, r: b.r })) : null,
    });
  }, []);

  const stopCamera = useCallback(() => {
    openToken.current++;
    camRef.current?.stop();
    camRef.current = null;
    liveRef.current = null;
    prevRaw.current = null;
    lastGood.current = null;
    setView(null);
    setNoSheet(false);
    setCam({ status: "off", message: "" });
  }, []);

  const openCamera = useCallback(async (): Promise<boolean> => {
    if (camRef.current) return true;
    const video = videoRef.current;
    if (!video) return false;
    const token = ++openToken.current;
    setCam({ status: "starting", message: "" });
    try {
      const camera = await openRiteCamera({ video, layouts: SEANCE_RITE_LAYOUTS, onFrame });
      // The page may have changed mode or closed while the browser asked for permission.
      if (!mounted.current || token !== openToken.current || modeRef.current !== "live") {
        camera.stop();
        return false;
      }
      camRef.current = camera;
      lastSeen.current = performance.now();
      setCam({ status: "on", message: "" });
      return true;
    } catch (err) {
      if (mounted.current && token === openToken.current) setCam({ status: "error", message: err instanceof CameraError ? (CAMERA_HELP[err.kind] ?? err.message) : CAMERA_HELP.UNKNOWN });
      return false;
    }
  }, [onFrame]);

  useEffect(() => {
    mounted.current = true;
    const pending = timers.current;
    return () => {
      mounted.current = false;
      openToken.current++;
      camRef.current?.stop();
      camRef.current = null;
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
      closeRiteAudio();
    };
  }, []);

  // --- Game events: sound, announcements, bursts, the frozen frame ---------------------------

  const finish = useCallback(
    (over: RiteState) => {
      camRef.current?.setActive(false);
      if (over.score > bestRef.current) setBest(over.score);
      const good = lastGood.current;
      const standing = over.targets.map((t) => t.rune);
      if (modeRef.current === "live" && good) {
        const model = xrayModel(good.result, good.layout);
        setFrame(
          model
            ? { imageUrl: rasterToDataUrl(good.frame), width: good.frame.width, height: good.frame.height, model: modelWithCoverage(model, over.coverage, standing), alt: "The last camera frame of the sheet, frozen when the rite ended." }
            : null,
        );
      } else {
        const layout = SEANCE_RITE_LAYOUTS.find((l) => l.page === defaultPageSize()) ?? SEANCE_RITE_LAYOUTS[0];
        setFrame(sheetSnapshot(layout, over.coverage, standing));
      }
    },
    [setBest],
  );

  const handle = useCallback(
    (next: RiteState) => {
      const message = ghostlyStatus(next.events, next.wave);
      if (message) setStatus(message);
      const fresh: Burst[] = [];
      for (const e of next.events) {
        if (e.type === "banish") {
          playRite("banish", soundRef.current, e.combo);
          fresh.push({ id: ++burstId.current, rune: e.rune });
        } else if (e.type === "tremble") playRite("interference", soundRef.current);
        else if (e.type === "lifeLost") playRite("lifeLost", soundRef.current);
        else if (e.type === "wave") playRite("wave", soundRef.current);
        else if (e.type === "gameOver") {
          playRite("gameOver", soundRef.current);
          finish(next);
        }
      }
      const at = performance.now();
      if (next.events.some((e) => e.type === "lifeLost")) setReaction({ kind: "lifeLost", at });
      else if (fresh.length) setReaction({ kind: "banish", runes: fresh.map((b) => b.rune), at });
      if (fresh.length) {
        setBursts((b) => [...b, ...fresh]);
        const t = window.setTimeout(() => {
          timers.current.delete(t);
          setBursts((b) => b.filter((x) => !fresh.includes(x)));
        }, BURST_MS);
        timers.current.add(t);
      }
    },
    [finish],
  );

  const apply = useCallback(
    (next: RiteState) => {
      gameRef.current = next;
      setGame(next);
      handle(next);
    },
    [handle],
  );

  // --- The game loop: one requestAnimationFrame chain, cancelled on pause, phase change and unmount

  useEffect(() => {
    if (paused || (game.phase !== "waveIntro" && game.phase !== "active")) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += Math.min(MAX_STEP_MS, now - last);
      last = now;
      if (acc >= STEP_MS) {
        const live = liveRef.current;
        const cover = modeRef.current === "digital" ? padCoverage(padRef.current, now) : live?.cover && now - live.at <= STALE_MS ? live.cover : null;
        const next = tick(gameRef.current, acc, cover);
        acc = 0;
        setDisplay((d) => (cover && !same(d, cover) ? [...cover] : !cover && !same(d, zeros()) ? zeros() : d));
        apply(next);
        if (next.phase === "gameOver") return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game.phase, paused, apply]);

  // --- Digital launchpad input --------------------------------------------------------------

  const press = useCallback((i: number) => {
    padRef.current = padPress(padRef.current, i, performance.now());
    setHeld((h) => (h.includes(i) ? h : [...h, i]));
  }, []);
  const release = useCallback((i: number) => {
    padRef.current = padRelease(padRef.current, i, performance.now());
    setHeld((h) => h.filter((x) => x !== i));
  }, []);

  useEffect(() => {
    if (mode !== "digital") return;
    const down = (e: KeyboardEvent) => {
      const i = runeForKey(e.key);
      if (i === null || e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
      e.preventDefault();
      if (!e.repeat) press(i);
    };
    const up = (e: KeyboardEvent) => {
      const i = runeForKey(e.key);
      if (i !== null) release(i);
    };
    // A key held while the window loses focus would otherwise stay down forever.
    const blur = () => {
      padRef.current = emptyPad;
      setHeld([]);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [mode, press, release]);

  // --- Controls -----------------------------------------------------------------------------

  const seed = () => (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;

  const begin = useCallback(() => {
    setPaused(false);
    setFrame(null);
    setBursts([]);
    setDisplay(zeros());
    camRef.current?.setActive(true);
    apply(startGame(gameRef.current, seed()));
  }, [apply]);

  const onStart = async () => {
    if (mode === "live" && !camRef.current && !(await openCamera())) return;
    begin();
  };

  const toMenu = useCallback(() => {
    setPaused(false);
    setFrame(null);
    setBursts([]);
    setDisplay(zeros());
    setStatus("Choose a mode, then start the rite.");
    setReaction(null);
    setHeld([]);
    camRef.current?.setActive(true);
    const menu = createGame(seed());
    gameRef.current = menu;
    setGame(menu);
  }, []);

  const changeMode = (m: PlayMode) => {
    if (m === mode) return;
    stopCamera();
    padRef.current = emptyPad;
    setHeld([]);
    toMenu();
    setMode(m);
  };

  // Live mode: if the camera has not seen the sheet for 2 seconds, the ghost offers the launchpad.
  useEffect(() => {
    if (mode !== "live" || cam.status !== "on" || game.phase === "gameOver") {
      setNoSheet(false);
      return;
    }
    const id = window.setInterval(() => setNoSheet(sheetMissing(performance.now(), lastSeen.current)), 400);
    return () => window.clearInterval(id);
  }, [mode, cam.status, game.phase]);

  const playing = game.phase === "waveIntro" || game.phase === "active";
  const coach = coachFor({ game, mode, paused, noSheet, reaction, now: performance.now() });
  const receipt = receiptOf(game, mode);
  const names = game.targets.map((t) => RITE_RUNE_NAMES[t.rune]).join(", ");
  const startLabel = mode === "live" && cam.status !== "on" ? (cam.status === "starting" ? "Opening the camera..." : "Open Camera and Start the Rite") : "Start the Rite";
  const runes = game.targets.map((t) => t.rune);

  return (
    <section
      aria-labelledby="rite-play"
      className="flex h-[calc(100svh-var(--launcher,4.1rem)-9.5rem)] min-h-[31rem] flex-col gap-3 max-sm:h-auto rounded-2xl border border-[#D4AF37]/70 bg-[#10131a]/80 p-3 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.15)] sm:p-4"
      data-game="x-ray-rite"
    >
      <style>{RITE_CSS}</style>
      <h2 id="rite-play" className="sr-only">
        Play the rite
      </h2>

      {/* Toolbar: mode on the left, the in-game controls on the right. */}
      <div className="flex flex-wrap items-center gap-2">
        <fieldset>
          <legend className="sr-only">Play mode</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["digital", "Instant digital launchpad", "No printer needed. Mouse, touch or keys 1 to 9, 0, minus, equals."],
                ["live", "Live optical webcam", "Print the sheet and cover its runes with a finger or token."],
              ] as const
            ).map(([m, label, hint]) => (
              <label
                key={m}
                className={`cursor-pointer rounded-xl border-2 px-4 py-2 text-lg font-bold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-yellow-300 ${
                  mode === m ? "border-emerald-300 bg-[#10241e]" : "border-[#D4AF37]/60 bg-[#151821]"
                }`}
              >
                <input type="radio" name="rite-mode" className="sr-only" checked={mode === m} onChange={() => changeMode(m)} aria-describedby={`rite-mode-${m}`} />
                {label}
                <span id={`rite-mode-${m}`} className="sr-only">
                  {hint}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {playing && (
            <>
              <button type="button" className={btnSm} onClick={() => setPaused((p) => !p)}>
                {paused ? "Resume" : "Pause"}
              </button>
              <button type="button" className={btnSm} onClick={toMenu}>
                Quit to Menu
              </button>
            </>
          )}
          {mode === "live" && cam.status === "on" && !playing && (
            <button type="button" className={btnSm} onClick={stopCamera}>
              Close Camera
            </button>
          )}
          <button type="button" className={btnSm} aria-pressed={sound} onClick={() => setSound(!sound)}>
            Rite sounds{" "}
            <span className="text-[#D4AF37]">{sound ? "on" : "off"}</span>
          </button>
        </div>
      </div>

      {/* HUD: the numbers on the left, the countdown ring on the right. */}
      <div className="flex flex-wrap items-center gap-3">
        <ul className="flex flex-1 flex-wrap gap-2" aria-label="Rite status" data-phase={game.phase}>
          <Stat label="Wave">{game.phase === "menu" ? "-" : game.wave}</Stat>
          <Stat label="Lives">
            <span className="inline-flex items-center gap-2">
              <Hearts lives={game.lives} />
              <span className="whitespace-nowrap">
                {game.lives} of {MAX_LIVES}
              </span>
            </span>
          </Stat>
          <Stat label="Score">{formatScore(game.score)}</Stat>
          <Stat label="Combo">
            {game.combo} <span className="text-lg font-semibold text-[#D4AF37]">{formatMultiplier(game.multiplier)}</span>
          </Stat>
          <Stat label="Best">{formatScore(best)}</Stat>
        </ul>
        {playing && game.trembling ? (
          <p className="max-w-md flex-1 text-lg font-bold leading-snug text-[#FF6B7A]" data-testid="rite-tremble">
            {TREMBLE_HINT}
          </p>
        ) : (
          game.phase !== "menu" && (
            <ol aria-label="How to play" data-steps="chips" className="flex max-w-xl flex-1 flex-wrap content-center gap-x-2 gap-y-1">
              {HOWTO_STEPS.map((st) => (
                <li key={st.n} className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/50 bg-[#151821] px-3 py-0.5 text-base font-semibold text-[#F3EBD3]">
                  <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#D4AF37] text-sm font-black text-[#0B0D12]">
                    {st.n}
                  </span>
                  {st.short}
                </li>
              ))}
            </ol>
          )
        )}
        {playing && <TimerRing left={game.timeLeftMs} total={game.waveMs} trembling={game.trembling} />}
      </div>

      {/* The stage takes whatever height is left, so the game fits one screen. */}
      <div className="relative min-h-[16rem] flex-1 max-sm:h-[30rem] max-sm:flex-none">
        {mode === "live" && (
          <div hidden={game.phase === "gameOver"} className="relative mx-auto h-full max-w-full overflow-hidden rounded-xl border-2 border-[#D4AF37]/70 bg-black" style={{ aspectRatio: "16 / 9" }} data-stage="live">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-contain" aria-label="Live camera preview" muted playsInline />
            {view && <LiveOverlay view={view} targets={game.targets} coverage={display} bursts={bursts} />}
            {noSheet && playing && <CornerGuide />}
            {cam.status === "on" && playing && !game.cardVisible && !noSheet && (
              <p className="absolute inset-x-0 bottom-0 bg-[#0B0D12]/90 p-3 text-center text-lg font-bold text-[#FBBF24]">The sheet slipped out of view. The timer waits until all 4 corner squares are visible.</p>
            )}
            {game.phase === "waveIntro" && <WaveBanner wave={game.wave} names={names} runes={runes} />}
            {paused && <PausedBanner />}
          </div>
        )}
        {mode === "digital" && game.phase !== "gameOver" && (
          <div className="relative h-full">
            <LaunchPad targets={game.targets} coverage={display} bursts={bursts} onPress={press} onRelease={release} held={held} />
            {game.phase === "waveIntro" && <WaveBanner wave={game.wave} names={names} runes={runes} />}
            {paused && <PausedBanner />}
          </div>
        )}

        {game.phase === "menu" && (
          <div className="absolute inset-0 z-20 grid place-items-center overflow-auto rounded-xl bg-[#0B0D12]/88 p-3" data-overlay="menu">
            <div className="max-w-4xl space-y-4 rounded-2xl border-2 border-[#D4AF37] bg-[#10131a] p-5">
              <h3 className="text-3xl font-semibold text-[#D4AF37]" style={SERIF}>
                How the rite works
              </h3>
              <ol className="grid gap-3 sm:grid-cols-3" aria-label="How the rite works" data-steps="cards">
                {HOWTO_STEPS.map((st) => (
                  <li key={st.n} className="flex gap-3 rounded-xl border border-[#D4AF37]/60 bg-[#151821] p-3">
                    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#D4AF37] text-xl font-black text-[#0B0D12]">
                      {st.n}
                    </span>
                    <span>
                      <span className="block text-xl font-bold leading-tight text-[#F3EBD3]">{st.title}</span>
                      <span className="mt-1 block text-lg leading-snug text-[#D9CFB4]">{st.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {mode === "live" && cam.status === "error" && <p className="text-lg font-bold text-[#FBBF24]">{cam.message}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={primary} onClick={() => void onStart()} disabled={cam.status === "starting"}>
                  {startLabel}
                </button>
                {mode === "live" && cam.status === "error" && (
                  <button type="button" className={btn} onClick={() => changeMode("digital")}>
                    Use the digital launchpad instead
                  </button>
                )}
              </div>
              <details className="text-lg text-[#F3EBD3]">
                <summary className="cursor-pointer font-bold text-[#D4AF37]">The exact scoring rules</summary>
                <ul className="mt-2 list-disc space-y-1 pl-6" aria-label="Scoring rules">
                  <li>
                    Runes light up in gold. Cover one fully (a reading of {PERFECT.toFixed(2)} or more) to banish it and build your combo. Each banish pays 100 points times your multiplier, 1 plus 0.15 for every combo step.
                  </li>
                  <li>
                    A shaky half cover ({INTERFERENCE_RANGE[0].toFixed(2)} to {INTERFERENCE_RANGE[1].toFixed(2)}) is the Trembling Hand: the timer runs 40% slower, but that rune cannot grow your combo.
                  </li>
                  <li>Run out of time and you lose a life. You have 3. Every wave is faster, and later waves light up to 4 runes at once.</li>
                  <li>{mode === "digital" ? "Hold a pad, or its key, for a full cover. A quick tap reads as a trembling hand." : "Hold the printed sheet so all 4 corner squares are in view. The timer waits whenever they are not."}</li>
                </ul>
              </details>
            </div>
          </div>
        )}

        {receipt && (
          <div className="absolute inset-0 overflow-y-auto">
            <RiteReceipt receipt={receipt} frame={frame} best={best} onPlayAgain={begin} />
          </div>
        )}
      </div>

      <div className="flex min-h-12 items-center gap-3" data-testid="rite-coach-row">
        <CoachGhost mood={coach.mood} className="h-11 w-11 shrink-0" />
        <p className="min-w-0 flex-1 rounded-xl rounded-bl-sm bg-[#F8F3E6] px-4 py-1.5 text-lg font-bold leading-snug text-slate-950" data-testid="rite-coach" data-mood={coach.mood}>
          {coach.text}
        </p>
        {mode === "live" && noSheet && game.phase !== "gameOver" && (
          <button type="button" className={btnSm} onClick={() => changeMode("digital")}>
            Switch to Launchpad
          </button>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite" data-testid="rite-status">
        {status}
      </p>
    </section>
  );
}

/** The wave countdown as a ring: gold, crimson while a hand trembles. The number in the middle is the same time as text. */
/** Four dashed corners where the sheet's black squares should land. Decoration: the ghost says it in words. */
export function CornerGuide() {
  const corner = "absolute h-12 w-12 border-[#FBBF24]";
  return (
    <div aria-hidden="true" data-guide="corners" className="pointer-events-none absolute inset-[7%]">
      <span className={`${corner} left-0 top-0 rounded-tl-lg border-l-4 border-t-4`} />
      <span className={`${corner} right-0 top-0 rounded-tr-lg border-r-4 border-t-4`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4`} />
      <span className={`${corner} bottom-0 right-0 rounded-br-lg border-b-4 border-r-4`} />
    </div>
  );
}

export function TimerRing({ left, total, trembling }: { left: number; total: number; trembling: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return (
    <div
      role="progressbar"
      aria-label="Wave time left"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(left)}
      aria-valuetext={`${(left / 1000).toFixed(1)} seconds left`}
      className="relative h-20 w-20 shrink-0"
      data-ring={trembling ? "crimson" : "gold"}
    >
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true" focusable="false">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#2a2f3d" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={trembling ? RITE_COLORS.crimson : RITE_COLORS.gold} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xl font-black tabular-nums text-[#F3EBD3]">{(left / 1000).toFixed(1)}</span>
    </div>
  );
}

export function WaveBanner({ wave, names, runes }: { wave: number; names: string; runes: number[] }) {
  return (
    <div aria-hidden="true" data-banner="wave" className="absolute inset-0 z-10 grid place-items-center bg-[#0B0D12]/85 p-4 text-center">
      <div>
        <p className="text-6xl font-semibold text-[#D4AF37]" style={SERIF}>
          Wave {wave}
        </p>
        <p className="mt-2 text-2xl text-[#F3EBD3]">Banish {names}</p>
        <div className="mt-3 flex justify-center gap-5 text-[#D4AF37]">
          {runes.map((r) => (
            <RuneGlyph key={r} index={r} className="h-16 w-16" />
          ))}
        </div>
      </div>
    </div>
  );
}

function PausedBanner() {
  return (
    <div data-banner="paused" className="absolute inset-0 z-20 grid place-items-center bg-[#0B0D12]/90 p-4 text-center">
      <p className="text-5xl font-semibold text-[#D4AF37]" style={SERIF}>
        Paused
      </p>
    </div>
  );
}
