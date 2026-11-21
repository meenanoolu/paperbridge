import type { CompletedScan } from "../scan";
import { DECODE_ERROR_TEXT } from "../scan";
import { Callout } from "./ui";

export function DecodeFacts({ scan }: { scan: CompletedScan }) {
  const { result } = scan;
  if (!result.ok) {
    const t = DECODE_ERROR_TEXT[result.reason];
    return (
      <Callout tone="bad" title={t.title}>
        <p>{t.help}</p>
        <p className="mt-1 font-mono text-lg">reason: {result.reason}</p>
      </Callout>
    );
  }
  const filled = result.bubbles.filter((b) => b.state === "filled").length;
  const unclear = result.bubbles.filter((b) => b.state === "ambiguous").length;
  const rows: [string, string][] = [
    ["Source", scan.label],
    ["Corner markers", "4 of 4 found"],
    ["Card", `${result.cardId} v${result.layoutVersion} (${scan.layout.page})`],
    ["Bubbles read", `${result.bubbles.length} (${filled} filled, ${unclear} ${unclear === 1 ? "needs" : "need"} review)`],
    ["Image", `${scan.width} x ${scan.height} px`],
    ["Decode time", `${scan.decodeMs.toFixed(0)} ms on this device`],
  ];
  return (
    <div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-lg">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-bold">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 rounded-lg bg-slate-100 p-3 text-lg">
        Decoded in your browser with corner detection, a perspective transform, and local thresholds. No AI model, no
        upload, same answer every time.
      </p>
    </div>
  );
}
