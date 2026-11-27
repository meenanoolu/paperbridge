import { useEffect, useRef, useState, type CSSProperties } from "react";
import { copyText } from "../../shell/clipboard";
import { XRayOverlay } from "../../shell/components/XRayOverlay";
import { RITE_RUNE_NAMES } from "./layout";
import { receiptTip } from "./riteCoach";
import { classifyCoverage, formatMultiplier, formatScore, MODE_LABEL, receiptText, type ScoreReceipt } from "./riteEngine";
import type { FrozenFrame } from "./riteSheet";
import { RITE_COLORS, RITE_PALETTE } from "./theme";

const SERIF = { fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, "Times New Roman", serif' };
const btn =
  "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-[#D4AF37] bg-[#151821] px-5 py-3 text-lg font-bold text-[#F3EBD3] hover:bg-[#1d2130] disabled:opacity-60";

/** One plain word (or three) for a rune's final reading. */
function readingWord(missed: boolean, cover: number): string {
  const kind = classifyCoverage(cover);
  if (kind === "covered") return "covered";
  if (missed) return kind === "trembling" ? "missed while trembling" : "missed";
  return kind === "trembling" ? "trembling" : "empty";
}

/** Game Over: the frozen Optical X-Ray, the numbers, Play Again and Copy Score Receipt. */
export function RiteReceipt({ receipt, frame, best, onPlayAgain }: { receipt: ScoreReceipt; frame: FrozenFrame | null; best: number; onPlayAgain: () => void }) {
  const [copy, setCopy] = useState("");
  const again = useRef<HTMLButtonElement>(null);
  // The rite ended under the player's hands: move focus to the way back in.
  useEffect(() => again.current?.focus(), []);
  const newBest = receipt.score > 0 && receipt.score >= best;
  const rows: [string, string][] = [
    ["Final wave", String(receipt.wave)],
    ["Score", formatScore(receipt.score)],
    ["Max combo", `${receipt.maxCombo} (${formatMultiplier(receipt.bestMultiplier)})`],
    ["Runes banished", String(receipt.banished)],
    ["Mode", MODE_LABEL[receipt.mode]],
  ];
  return (
    <section aria-labelledby="rite-receipt" className="m-pop space-y-3 rounded-2xl border-2 border-[#D4AF37] bg-[#10131a] p-4" data-receipt="true">
      <h3 id="rite-receipt" className="text-3xl font-semibold text-[#D4AF37]" style={SERIF}>
        The rite ends
      </h3>
      <div className="grid gap-5 md:grid-cols-2">
        {frame && (
          <figure>
            <div className="relative overflow-hidden rounded-xl border-2 border-[#D4AF37]/70 bg-slate-800">
              <img src={frame.imageUrl} alt={frame.alt} className="mx-auto block h-auto max-h-[46svh] w-auto max-w-full bg-white" />
              <XRayOverlay model={frame.model} width={frame.width} height={frame.height} palette={RITE_PALETTE} />
            </div>
            <figcaption className="mt-2 text-lg text-[#D9CFB4]">Frozen Optical X-Ray. Emerald runes were covered. Dashed crimson runes were still lit or trembling when time ran out.</figcaption>
          </figure>
        )}
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xl" aria-label="Score receipt">
            {rows.map(([k, v], n) => (
              <div key={k} className="contents">
                <dt className="font-bold text-[#D4AF37]">{k}</dt>
                <dd className="m-rise tabular-nums" style={{ "--i": n, "--d": "250ms" } as CSSProperties}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          {receiptTip(receipt) && (
            <p className="rounded-lg border border-[#D4AF37]/60 bg-[#151821] p-3 text-lg text-[#F3EBD3]" data-testid="receipt-tip">
              {receiptTip(receipt)}
            </p>
          )}
          {newBest && <p className="text-xl font-bold text-[#34d399]">New best score on this device.</p>}
          {!newBest && best > 0 && <p className="text-lg text-[#D9CFB4]">Best on this device: {formatScore(best)}</p>}
          <div className="flex flex-wrap gap-3">
            <button ref={again} type="button" className={`${btn} shadow-[0_0_18px_-4px_#D4AF37]`} onClick={onPlayAgain}>
              Play Again
            </button>
            <button
              type="button"
              className={btn}
              onClick={async () => setCopy((await copyText(receiptText(receipt))) ? "Score receipt copied." : "Copy is blocked here. Select the receipt text below and copy it by hand.")}
            >
              Copy Score Receipt
            </button>
          </div>
          <p role="status" aria-live="polite" className="min-h-7 text-lg font-bold text-[#34d399]">
            {copy}
          </p>
        </div>
      </div>
      <details>
        <summary className="cursor-pointer text-lg font-bold">Final readings, rune by rune</summary>
        <ul className="mt-2 grid gap-1 text-lg sm:grid-cols-2 lg:grid-cols-3" aria-label="Final readings">
          {receipt.coverage.map((c, i) => (
            <li key={i}>
              <span className="font-bold" style={{ color: classifyCoverage(c) === "covered" ? RITE_COLORS.emerald : classifyCoverage(c) === "trembling" ? RITE_COLORS.crimson : RITE_COLORS.parchment }}>
                {i + 1} {RITE_RUNE_NAMES[i]}
              </span>
              : {readingWord(receipt.missed.includes(i), c)} {c.toFixed(2)}
            </li>
          ))}
        </ul>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-[#D4AF37]/50 bg-[#0B0D12] p-3 text-lg">{receiptText(receipt)}</pre>
      </details>
    </section>
  );
}
