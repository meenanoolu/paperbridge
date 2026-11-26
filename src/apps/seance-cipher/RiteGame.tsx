import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CameraError, rasterToDataUrl } from "../../core";
import { defaultPageSize } from "../../shell/components/PrintCard";
import { usePersistentState } from "../../shell/usePersistentState";
import { xrayModel } from "../../shell/xray";
import { RITE_RUNE_COUNT, RITE_RUNE_NAMES, SEANCE_RITE_LAYOUTS } from "./layout";
import { LiveOverlay, type LiveView } from "./RiteLive";
import { LaunchPad, RuneGlyph, type Burst } from "./RitePads";
import { RiteReceipt } from "./RiteReceipt";
import { closeRiteAudio, playRite } from "./riteAudio";
import { CAMERA_HELP, openRiteCamera, type RiteCamera, type RiteFrame } from "./riteCamera";
import {
  announceEvents,
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
  TREMBLE_DRAIN,
  type PadState,
  type PlayMode,
  type RiteState,
} from "./riteEngine";
import { modelWithCoverage, sheetSnapshot, type FrozenFrame } from "./riteSheet";
import { coverageFromScan, runeKey } from "./riteVision";
import { RITE_COLORS, RITE_CSS } from "./theme";

const SERIF = { fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, "Times New Roman", serif' };
const btn =
  "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-[#D4AF37] bg-[#151821] px-5 py-3 text-lg font-bold text-[#F3EBD3] hover:bg-[#1d2130] disabled:opacity-60";
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
        <svg key={i} viewBox="0 0 24 24" className="h-7 w-7" data-life={i < lives ? "kept" : "lost"}>
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
    <li className="rounded-xl border border-[#D4AF37]/50 bg-[#151821] px-4 py-2">
      <p className="text-base font-bold uppercase tracking-wider text-[#D4AF37]">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-[#F3EBD3]">{children}</p>
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

  // --- Camera -------------------------------------------------------------------------------

  const onFrame = useCallback((f: RiteFrame) => {
    const cov = coverageFromScan(f.result);
    liveRef.current = { cover: confirmCoverage(prevRaw.current, cov), at: performance.now() };
    prevRaw.current = cov;
    if (f.result.ok) lastGood.current = f;
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
      const message = announceEvents(next.events);
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
  }, []);
  const release = useCallback((i: number) => {
    padRef.current = padRelease(padRef.current, i, performance.now());
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
    camRef.current?.setActive(true);
    const menu = createGame(seed());
    gameRef.current = menu;
    setGame(menu);
  }, []);

  const changeMode = (m: PlayMode) => {
    if (m === mode) return;
    stopCamera();
    padRef.current = emptyPad;
    toMenu();
    setMode(m);
  };

  const playing = game.phase === "waveIntro" || game.phase === "active";
  const receipt = receiptOf(game, mode);
  const names = game.targets.map((t) => RITE_RUNE_NAMES[t.rune]).join(", ");
  const timePct = game.waveMs > 0 ? Math.max(0, Math.min(100, (game.timeLeftMs / game.waveMs) * 100)) : 0;
  const startLabel = mode === "live" && cam.status !== "on" ? (cam.status === "starting" ? "Opening the camera..." : "Open Camera and Start the Rite") : "Start the Rite";

  return (
    <section aria-labelledby="rite-play" className="space-y-5 rounded-2xl border border-[#D4AF37]/70 bg-[#10131a]/80 p-5 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.15)]" data-game="x-ray-rite">
      <style>{RITE_CSS}</style>
      <h2 id="rite-play" className="text-4xl font-semibold tracking-wide text-[#D4AF37]" style={SERIF}>
        Play the rite
      </h2>

      <fieldset>
        <legend className="text-lg font-bold">Play mode</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["digital", "Instant digital launchpad", "No printer needed. Mouse, touch or keys 1 to 9, 0, minus, equals."],
              ["live", "Live optical webcam", "Print the sheet below and cover its runes with a finger or token."],
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
              <span id={`rite-mode-${m}`} className="block text-base font-normal text-[#D9CFB4]">
                {hint}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Rite status" data-phase={game.phase}>
        <Stat label="Wave">{game.phase === "menu" ? "-" : game.wave}</Stat>
        <Stat label="Lives">
          <span className="inline-flex flex-wrap items-center gap-x-2">
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

      {playing && (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-label="Wave time left"
            aria-valuemin={0}
            aria-valuemax={Math.round(game.waveMs)}
            aria-valuenow={Math.round(game.timeLeftMs)}
            aria-valuetext={`${(game.timeLeftMs / 1000).toFixed(1)} seconds left`}
            className="h-5 overflow-hidden rounded-full border border-[#D4AF37]/60 bg-[#2a2f3d]"
          >
            <div className="h-full" style={{ width: `${timePct}%`, background: game.trembling ? RITE_COLORS.crimson : RITE_COLORS.gold }} />
          </div>
          <p className="text-lg tabular-nums text-[#F3EBD3]">
            {(game.timeLeftMs / 1000).toFixed(1)} s left
            {game.trembling && <span className="ml-3 font-bold text-[#FF6B7A]"> Trembling hand: the timer runs {Math.round((1 - TREMBLE_DRAIN) * 100)}% slower, and combo growth is locked until the rune is fully covered.</span>}
          </p>
        </div>
      )}

      {/* The stage. In live mode the video stays mounted so the camera survives between games. */}
      {mode === "live" && (
        <div hidden={game.phase === "gameOver"} className="relative overflow-hidden rounded-xl border-2 border-[#D4AF37]/70 bg-black">
          <video ref={videoRef} className="block aspect-video w-full object-contain" aria-label="Live camera preview" muted playsInline />
          {view && <LiveOverlay view={view} targets={game.targets} coverage={display} bursts={bursts} />}
          {cam.status !== "on" && (
            <div className="absolute inset-0 grid place-items-center bg-[#0B0D12]/90 p-4 text-center text-xl text-[#F3EBD3]">
              <p>
                {cam.status === "starting" && "Opening the camera..."}
                {cam.status === "off" && "The camera opens when you start the rite. Your video never leaves this device."}
                {cam.status === "error" && cam.message}
              </p>
            </div>
          )}
          {cam.status === "on" && playing && !game.cardVisible && (
            <p className="absolute inset-x-0 bottom-0 bg-[#0B0D12]/90 p-3 text-center text-lg font-bold text-[#FBBF24]">The sheet is out of view. The timer waits until all 4 corner squares are visible.</p>
          )}
          {game.phase === "waveIntro" && <WaveBanner wave={game.wave} names={names} runes={game.targets.map((t) => t.rune)} />}
          {paused && <PausedBanner />}
        </div>
      )}
      {mode === "digital" && game.phase !== "gameOver" && (
        <div className="relative">
          <LaunchPad targets={game.targets} coverage={display} bursts={bursts} onPress={press} onRelease={release} />
          {game.phase === "waveIntro" && <WaveBanner wave={game.wave} names={names} runes={game.targets.map((t) => t.rune)} />}
          {paused && <PausedBanner />}
        </div>
      )}

      {mode === "live" && cam.status === "error" && (
        <button type="button" className={btn} onClick={() => changeMode("digital")}>
          Use the digital launchpad instead
        </button>
      )}

      <p role="status" aria-live="polite" className="min-h-7 text-xl font-bold text-[#F3EBD3]" data-testid="rite-status">
        {status}
      </p>

      {game.phase === "menu" && (
        <ul className="list-disc space-y-1 pl-6 text-lg text-[#D9CFB4]" aria-label="How the rite works">
          <li>
            Runes light up in gold. Cover one fully (a reading of {PERFECT.toFixed(2)} or more) to banish it and build your combo. Each banish pays 100 points times your multiplier, 1 plus 0.15 for every combo step.
          </li>
          <li>
            A shaky half cover ({INTERFERENCE_RANGE[0].toFixed(2)} to {INTERFERENCE_RANGE[1].toFixed(2)}) is the Trembling Hand: the timer runs 40% slower, but that rune cannot grow your combo.
          </li>
          <li>Run out of time and you lose a life. You have 3. Every wave is faster, and later waves light up to 4 runes at once.</li>
          <li>{mode === "digital" ? "Hold a pad, or its key, for a full cover. A quick tap reads as a trembling hand." : "Hold the printed sheet so all 4 corner squares are in view. The timer waits whenever they are not."}</li>
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {game.phase === "menu" && (
          <button type="button" className={primary} onClick={() => void onStart()} disabled={cam.status === "starting"}>
            {startLabel}
          </button>
        )}
        {playing && (
          <>
            <button type="button" className={btn} onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" className={btn} onClick={toMenu}>
              Quit to Menu
            </button>
          </>
        )}
        <button type="button" className={btn} aria-pressed={sound} onClick={() => setSound(!sound)}>
          Rite sounds{" "}
          <span className="text-[#D4AF37]">{sound ? "on" : "off"}</span>
        </button>
        {mode === "live" && cam.status === "on" && !playing && (
          <button type="button" className={btn} onClick={stopCamera}>
            Close Camera
          </button>
        )}
      </div>

      {receipt && <RiteReceipt receipt={receipt} frame={frame} best={best} onPlayAgain={begin} />}
    </section>
  );
}

function WaveBanner({ wave, names, runes }: { wave: number; names: string; runes: number[] }) {
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
