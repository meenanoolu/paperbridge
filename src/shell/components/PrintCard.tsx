import { useId, useState } from "react";
import { renderCardPdf, renderCardsPdf, renderCardSvg, type CardLayout, type PageSize } from "../../core";
import { canvasTextImage } from "../text-image";
import type { IconName } from "./Icon";
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
/** US Letter for the Americas locales that use it, A4 everywhere else. */
export function defaultPageSize(): PageSize {
  return typeof navigator !== "undefined" && /^en-(US|CA)|es-MX|fr-CA/.test(navigator.language) ? "Letter" : "A4";
}

export function downloadBytes(bytes: BlobPart, type: string, name: string) {
  download(bytes, type, name);
}

export function PrintCard({ layouts, label = "Print blank card (PDF)", disabled = false }: { layouts: CardLayout[]; label?: string; disabled?: boolean }) {
  const [page, setPage] = useState<string>(defaultPageSize);
  const [busy, setBusy] = useState(false);
  const layout = layouts.find((l) => l.page === page) ?? layouts[0];

  const pdf = async () => {
    setBusy(true);
    try {
      download(new Uint8Array(await renderCardPdf(layout, { textImage: canvasTextImage })), "application/pdf", `${layout.id}-${layout.page}.pdf`);
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
      <Button icon="printer" onClick={pdf} disabled={busy || disabled}>
        {busy ? "Preparing PDF..." : label}
      </Button>
      <Button onClick={svg} disabled={disabled}>
        SVG
      </Button>
    </div>
  );
}

/**
 * A paper-size choice plus one button that downloads a one-page PDF of the matching layout, with
 * a polite status line. Used by the Adaptive Paper Loop buttons. Text in any script prints.
 */
export function PrintLayoutButton({
  layouts,
  label,
  icon = "printer",
  fileName,
  description,
}: {
  /** One layout per paper size. */
  layouts: CardLayout[];
  label: string;
  icon?: IconName;
  fileName: (page: PageSize) => string;
  /** Shown under the button and used as its accessible description. */
  description?: string;
}) {
  const uid = useId();
  const [page, setPage] = useState<PageSize>(defaultPageSize);
  const [state, setState] = useState<{ busy: boolean; message: string; error?: boolean }>({ busy: false, message: "" });
  const layout = layouts.find((l) => l.page === page) ?? layouts[0];
  return (
    <div className="space-y-2">
      {description && (
        <p id={`${uid}-desc`} className="text-lg text-slate-800">
          {description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="flex items-center gap-1 rounded-xl border-2 border-slate-950 p-1">
          <legend className="sr-only">Paper size for {label}</legend>
          {layouts.map((l) => (
            <label
              key={l.page}
              className={`cursor-pointer rounded-lg px-3 py-2 text-lg font-bold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-950 ${page === l.page ? "bg-slate-950 text-white" : "text-slate-950"}`}
            >
              <input type="radio" name={`${uid}-page`} value={l.page} checked={page === l.page} onChange={() => setPage(l.page)} className="sr-only" />
              {l.page === "Letter" ? "US Letter" : "A4"}
            </label>
          ))}
        </fieldset>
        <Button
          variant="primary"
          icon={icon}
          disabled={state.busy}
          aria-describedby={description ? `${uid}-desc` : undefined}
          onClick={async () => {
            setState({ busy: true, message: "" });
            try {
              const bytes = await renderCardsPdf([layout], { title: `${layout.title} (${layout.id} v${layout.version})`, textImage: canvasTextImage });
              const name = fileName(layout.page);
              download(new Uint8Array(bytes), "application/pdf", name);
              setState({ busy: false, message: `Downloaded ${name}.` });
            } catch {
              setState({ busy: false, message: "The PDF could not be created.", error: true });
            }
          }}
        >
          {state.busy ? "Preparing PDF..." : label}
        </Button>
        <span role="status" aria-live="polite" className={`text-lg font-bold ${state.error ? "text-red-900" : "text-green-900"}`}>
          {state.message}
        </span>
      </div>
    </div>
  );
}
