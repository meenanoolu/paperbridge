import { useId, type KeyboardEvent, type PointerEvent } from "react";
import { RITE_RUNE_NAMES } from "./layout";
import { classifyCoverage, PAD_KEYS, PERFECT, type Target } from "./riteEngine";
import { GLYPH_UNITS, RUNE_GLYPHS } from "./runeGlyphs";

/**
 * One rune's picture, in the text colour. White cut-outs are real holes (an SVG mask), not paint,
 * so whatever is behind the picture (a glowing beam, the pad colour) shows through them.
 */
export function RuneGlyph({ index, className = "h-12 w-12" }: { index: number; className?: string }) {
  const mask = `rune-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox={`0 0 ${GLYPH_UNITS} ${GLYPH_UNITS}`} className={className} aria-hidden="true" focusable="false">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width={GLYPH_UNITS} height={GLYPH_UNITS}>
          {RUNE_GLYPHS[index].map((sh, i) => (
            <path key={i} d={sh.d} fill={sh.fill === "black" ? "#fff" : "#000"} />
          ))}
        </mask>
      </defs>
      <rect width={GLYPH_UNITS} height={GLYPH_UNITS} fill="currentColor" mask={`url(#${mask})`} />
    </svg>
  );
}

export interface Burst {
  id: number;
  rune: number;
}

/** What a pad looks like, from the game state: never colour alone, every state also has a word. */
export function padStatus(index: number, targets: readonly Target[], cover: number): { target: boolean; word: string; kind: "idle" | "target" | "trembling" | "covered" } {
  const t = targets.find((x) => x.rune === index);
  if (!t) return { target: false, word: "", kind: "idle" };
  const c = classifyCoverage(cover);
  return c === "covered" ? { target: true, word: "Covered", kind: "covered" } : c === "trembling" ? { target: true, word: "Trembling", kind: "trembling" } : { target: true, word: "Target", kind: "target" };
}

const KIND_CLASS = {
  idle: "border-[#D4AF37]/50 bg-[#151821]",
  target: "border-[#D4AF37] bg-[#1d1a10]",
  trembling: "border-dashed border-[#FF6B7A] bg-[#24121a]",
  covered: "border-[#34d399] bg-[#10241e]",
} as const;

/**
 * The Instant Digital Launchpad: the sheet's 12 runes as a 3 x 4 grid of buttons. Press and hold
 * (mouse, touch, or a key) for a full cover; a quick tap reads as a trembling hand. The page owns
 * the timing (see `padPress`, `padRelease`); the pads only report presses and releases.
 */
export function LaunchPad({
  targets,
  coverage,
  bursts,
  onPress,
  onRelease,
}: {
  targets: readonly Target[];
  coverage: readonly number[];
  bursts: readonly Burst[];
  onPress: (rune: number) => void;
  onRelease: (rune: number) => void;
}) {
  return (
    <ul className="grid h-full min-h-0 grid-cols-3 grid-rows-4 gap-2 sm:grid-cols-4 sm:grid-rows-3 sm:gap-3" aria-label="Rune launchpad">
      {RITE_RUNE_NAMES.map((name, i) => {
        const st = padStatus(i, targets, coverage[i] ?? 0);
        const burst = bursts.find((b) => b.rune === i);
        const keyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          if (!e.repeat) onPress(i);
        };
        const keyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          onRelease(i);
        };
        const down = (e: PointerEvent<HTMLButtonElement>) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          onPress(i);
        };
        return (
          <li key={name} className="min-h-0">
            <button
              type="button"
              data-rune={i}
              data-kind={st.kind}
              className={`relative flex h-full min-h-0 w-full touch-none select-none flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl border-4 p-1 text-[#F3EBD3] sm:gap-1 sm:p-2 ${KIND_CLASS[st.kind]}`}
              onPointerDown={down}
              onPointerUp={() => onRelease(i)}
              onPointerCancel={() => onRelease(i)}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={keyDown}
              onKeyUp={keyUp}
            >
              {st.kind === "target" && <span aria-hidden="true" data-glow="pulse" className="rite-pulse pointer-events-none absolute inset-0 rounded-2xl border-4 border-[#D4AF37] shadow-[0_0_26px_-2px_#D4AF37]" />}
              {st.kind === "trembling" && <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl shadow-[0_0_26px_-2px_#FF6B7A]" />}
              {st.kind === "covered" && <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl shadow-[0_0_26px_-2px_#34d399]" />}
              {st.target && (
                <span
                  aria-hidden="true"
                  data-beam={st.kind === "trembling" ? "crimson" : "gold"}
                  className={`pointer-events-none absolute inset-x-1/4 top-0 h-1/2 ${st.kind === "trembling" ? "rite-flicker" : ""}`}
                  style={{ background: `linear-gradient(to bottom, ${st.kind === "trembling" ? "rgba(255,107,122,0.7)" : "rgba(212,175,55,0.6)"}, transparent)` }}
                />
              )}
              {burst && <span key={burst.id} aria-hidden="true" data-burst="true" className="rite-burst pointer-events-none absolute inset-2 rounded-full border-4 border-[#34d399]" />}
              <RuneGlyph index={i} className="relative h-[clamp(1.5rem,5svh,2.75rem)] w-[clamp(1.5rem,5svh,2.75rem)]" />
              <span className="relative text-base font-bold sm:text-lg">
                {i + 1} {name}
              </span>
              <span className="relative flex items-center gap-1 text-sm sm:gap-2 sm:text-base">
                <kbd className="rounded border-2 border-[#D4AF37]/70 px-2 font-mono text-[#D9CFB4]">Key {PAD_KEYS[i]}</kbd>
                {st.word && <span className="font-bold">{st.word}</span>}
              </span>
              {st.target && (
                <span aria-hidden="true" className="relative block h-1.5 w-4/5 overflow-hidden rounded-full bg-[#2a2f3d] sm:h-2">
                  <span className="absolute inset-y-0 left-0 bg-[#F3EBD3]" style={{ width: `${Math.min(100, Math.round(((coverage[i] ?? 0) / PERFECT) * 100))}%` }} />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
