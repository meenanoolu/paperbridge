import { useId, useMemo, useState } from "react";
import type { PageSize } from "../../core";
import { defaultPageSize, downloadBytes } from "../../shell/components/PrintCard";
import { Button } from "../../shell/components/ui";
import { RITE_RUNE_NAMES, SEANCE_RITE_LAYOUTS } from "./layout";
import { riteSheetPdf, riteSheetSvg, svgDataUrl } from "./riteSheet";

const SERIF = { fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, "Times New Roman", serif' };

/** Download the X-Ray Rite 12-Rune Sheet as a one-page PDF (or SVG), on A4 or US Letter. */
export function RitePrint() {
  const uid = useId();
  const [page, setPage] = useState<PageSize>(defaultPageSize);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ busy: boolean; message: string; error?: boolean }>({ busy: false, message: "" });
  const layout = SEANCE_RITE_LAYOUTS.find((l) => l.page === page) ?? SEANCE_RITE_LAYOUTS[0];
  const name = (ext: string) => `x-ray-rite-sheet-${layout.page}.${ext}`;
  const preview = useMemo(() => (open ? svgDataUrl(riteSheetSvg(layout)) : ""), [open, layout]);

  const pdf = async () => {
    setState({ busy: true, message: "" });
    try {
      downloadBytes(new Uint8Array(await riteSheetPdf(layout)), "application/pdf", name("pdf"));
      setState({ busy: false, message: `Downloaded ${name("pdf")}.` });
    } catch {
      setState({ busy: false, message: "The PDF could not be created.", error: true });
    }
  };

  return (
    <section aria-labelledby="rite-print" className="rounded-2xl border-2 border-[#6b4f0f] bg-[#F3EBD3] p-5 text-slate-950 [&_:focus-visible]:outline-slate-950">
      <h2 id="rite-print" className="text-3xl font-semibold" style={SERIF}>
        Print the X-Ray Rite 12-Rune Sheet
      </h2>
      <p id={`${uid}-desc`} className="mt-1 text-lg">
        One page, 12 zones. Each zone is a blank white circle with its rune named above and drawn below, so a finger or token can cover the circle. Print it on plain paper and keep the
        4 corner squares clear.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <fieldset className="flex items-center gap-1 rounded-xl border-2 border-slate-950 p-1">
          <legend className="sr-only">Paper size for the X-Ray Rite sheet</legend>
          {SEANCE_RITE_LAYOUTS.map((l) => (
            <label
              key={l.page}
              className={`cursor-pointer rounded-lg px-3 py-2 text-lg font-bold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-950 ${page === l.page ? "bg-slate-950 text-white" : "text-slate-950"}`}
            >
              <input type="radio" name={`${uid}-page`} value={l.page} checked={page === l.page} onChange={() => setPage(l.page)} className="sr-only" />
              {l.page === "Letter" ? "US Letter" : "A4"}
            </label>
          ))}
        </fieldset>
        <Button variant="primary" icon="printer" disabled={state.busy} aria-describedby={`${uid}-desc`} onClick={() => void pdf()}>
          {state.busy ? "Preparing PDF..." : "Print the 12-Rune Sheet"}
        </Button>
        <Button onClick={() => downloadBytes(riteSheetSvg(layout), "image/svg+xml", name("svg"))}>SVG</Button>
        <span role="status" aria-live="polite" className={`text-lg font-bold ${state.error ? "text-red-900" : "text-green-900"}`}>
          {state.message}
        </span>
      </div>
      <details className="mt-3" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer text-lg font-bold">Preview the sheet</summary>
        {open && (
          <img
            src={preview}
            alt={`The X-Ray Rite sheet: 12 blank circles in 3 rows of 4, each named and drawn with its rune: ${RITE_RUNE_NAMES.join(", ")}.`}
            className="mt-3 max-h-[70vh] w-auto max-w-full rounded-lg border-2 border-slate-950 bg-white"
          />
        )}
      </details>
    </section>
  );
}
