import { useState } from "react";
import { renderCardPdf, renderCardSvg, type CardLayout } from "../../core";
import { Button } from "./ui";

function download(bytes: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Print the blank card. Both page sizes decode, so pick the one in the printer. */
export function PrintCard({ layouts }: { layouts: CardLayout[] }) {
  const prefersLetter = typeof navigator !== "undefined" && /^en-(US|CA)|es-MX|fr-CA/.test(navigator.language);
  const [page, setPage] = useState(prefersLetter ? "Letter" : "A4");
  const [busy, setBusy] = useState(false);
  const layout = layouts.find((l) => l.page === page) ?? layouts[0];

  const pdf = async () => {
    setBusy(true);
    try {
      download(new Uint8Array(await renderCardPdf(layout)), "application/pdf", `${layout.id}-${layout.page}.pdf`);
    } finally {
      setBusy(false);
    }
  };
  const svg = () => download(renderCardSvg(layout), "image/svg+xml", `${layout.id}-${layout.page}.svg`);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <fieldset className="flex items-center gap-1 rounded-xl border-2 border-slate-950 p-1">
        <legend className="sr-only">Paper size</legend>
        {layouts.map((l) => (
          <label
            key={l.page}
            className={`cursor-pointer rounded-lg px-3 py-2 text-lg font-bold has-[:focus-visible]:outline-4 ${
              page === l.page ? "bg-slate-950 text-white" : "text-slate-950"
            }`}
          >
            <input type="radio" name={`page-${layouts[0].id}`} value={l.page} checked={page === l.page} onChange={() => setPage(l.page)} className="sr-only" />
            {l.page === "Letter" ? "US Letter" : "A4"}
          </label>
        ))}
      </fieldset>
      <Button icon="printer" onClick={pdf} disabled={busy}>
        {busy ? "Preparing PDF..." : "Print blank card (PDF)"}
      </Button>
      <Button onClick={svg}>SVG</Button>
    </div>
  );
}
