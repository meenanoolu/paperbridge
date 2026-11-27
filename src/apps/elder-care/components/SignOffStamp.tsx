import { useState } from "react";
import { Icon } from "../../../shell/components/Icon";

/**
 * The caregiver's rubber stamp. Pressing it puts a HUMAN VERIFIED impression, dated, on the
 * sheet. It only works once every faint mark has been checked on the paper, so the stamp can
 * never say more than the sheet does. The stamp is a sign-off on screen: it changes no reading.
 */
export const STAMP_INK = "#115E59";

export const stampDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/** What the sheet says next to the stamp: why it cannot be pressed yet, or that it can. */
export const stampHelp = (pending: number): string =>
  pending > 0
    ? `${pending} faint ${pending === 1 ? "mark still needs" : "marks still need"} your eyes on the paper. Check ${pending === 1 ? "it" : "them"} above, then stamp.`
    : "Everything is checked. Press the stamp to sign off this sheet.";

export function SignOffStamp({ pending, when }: { pending: number; when: Date }) {
  const [stamped, setStamped] = useState(false);
  const [message, setMessage] = useState("");
  const blocked = pending > 0;
  const press = () => {
    if (blocked) {
      setMessage(`Check ${pending} faint ${pending === 1 ? "mark" : "marks"} on the paper first.`);
      return;
    }
    setStamped(true);
    setMessage(`Stamped HUMAN VERIFIED on ${stampDate(when)}.`);
  };
  return (
    <div className="flex flex-wrap items-center gap-6" data-stamp-state={stamped ? "stamped" : blocked ? "blocked" : "ready"}>
      <div className="flex flex-col items-center">
        <button
          type="button"
          aria-disabled={blocked || stamped}
          aria-describedby="stamp-help"
          onClick={() => !stamped && press()}
          className={`group flex flex-col items-center text-white ${blocked || stamped ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span aria-hidden="true" className="block h-9 w-16 rounded-t-full bg-[#7c5a2e] shadow-[inset_0_-6px_0_rgba(0,0,0,0.25)]" />
          <span aria-hidden="true" className="block h-3 w-7 bg-[#5f4422]" />
          <span
              className={`flex min-h-14 flex-col items-center rounded-md px-6 py-2 motion-safe:transition-transform ${
                blocked || stamped ? "bg-[#365553] shadow-[0_3px_0_#243a38]" : "bg-[#134E4A] shadow-[0_8px_0_#0b2f2c] group-active:translate-y-2 group-active:shadow-[0_2px_0_#0b2f2c]"
              }`}
            >
            <span className="text-base font-bold uppercase tracking-[0.3em]">Stamp</span>
            <span className="inline-flex items-center gap-2 text-xl font-black uppercase tracking-widest">
              <Icon name="check" className="h-5 w-5" />
              HUMAN VERIFIED
            </span>
          </span>
        </button>
        <span aria-hidden="true" className="mt-4 block h-2 w-48 rounded-full bg-[#134E4A]/20" />
      </div>

      <div className="min-w-48 flex-1">
        {stamped ? (
          <div className="flex flex-wrap items-center gap-4">
            <div
              role="img"
              aria-label={`HUMAN VERIFIED stamp, dated ${stampDate(when)}`}
              data-impression="true"
              className="-rotate-6 rounded-lg border-[6px] border-double px-5 py-2 text-center mix-blend-multiply motion-safe:animate-[stamp_0.45s_ease-out]"
              style={{ borderColor: STAMP_INK, color: STAMP_INK }}
            >
              <span className="block text-3xl font-black uppercase leading-none tracking-widest">HUMAN VERIFIED</span>
              <span className="mt-1 block text-lg font-bold tracking-wider">{stampDate(when)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStamped(false);
                setMessage("Stamp lifted.");
              }}
              className="min-h-12 rounded-lg border-2 border-[#134E4A] bg-white px-4 py-2 text-lg font-bold text-[#134E4A] hover:bg-[#F0FDFA]"
            >
              Lift stamp
            </button>
          </div>
        ) : (
          <p id="stamp-help" className="text-lg text-[#134E4A]">
            {stampHelp(pending)}
          </p>
        )}
        {stamped && (
          <p id="stamp-help" className="sr-only">
            Stamped.
          </p>
        )}
        <p role="status" aria-live="polite" className="mt-2 min-h-7 text-lg font-bold text-[#134E4A]">
          {message}
        </p>
      </div>
    </div>
  );
}
