import { useId, useMemo, useState } from "react";
import { hasColumnIcons, PRINT_LANGUAGES, renderCardsPdf, type PageSize, type PrintLanguage, type PrintOptions } from "../../core";
import { parsePrintOptions, type PackSlot, type PrintSlot } from "../print-slot";
import { canvasTextImage } from "../text-image";
import { usePersistentState } from "../usePersistentState";
import { Icon } from "./Icon";
import { defaultPageSize, downloadBytes, PrintCard } from "./PrintCard";
import { Button, Callout } from "./ui";

const NO_OPTIONS: PrintOptions = {};

/**
 * "Translate card": a globe button that opens a 1-click language choice for the PRINTED card.
 * Translations are built in and work offline; the dashboards stay in English.
 */
export function TranslatePicker({ value, languages, onPick }: { value: PrintLanguage; languages: PrintLanguage[]; onPick: (l: PrintLanguage) => void }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const offered = PRINT_LANGUAGES.filter((l) => languages.includes(l.id));
  const current = PRINT_LANGUAGES.find((l) => l.id === value) ?? PRINT_LANGUAGES[0];
  return (
    <div className="rounded-xl border-2 border-slate-950 p-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${uid}-langs`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-14 items-center gap-3 rounded-xl border-2 border-slate-950 bg-white px-5 py-3 text-lg font-bold hover:bg-slate-100"
      >
        <Icon name="globe" className="h-7 w-7" />
        <span>
          Translate card: <span lang={current.tag}>{current.native}</span>
          {current.id !== "en" && current.id !== "other" && <span className="sr-only"> ({current.english})</span>}
        </span>
      </button>
      <p id={`${uid}-hint`} className="mt-2 text-lg text-slate-800">
        Prints the card's words in another language, offline. Text in any script prints: the browser draws it with its own
        fonts. Results on screen stay in English.
      </p>
      <div id={`${uid}-langs`} hidden={!open} role="radiogroup" aria-label="Card language" aria-describedby={`${uid}-hint`} className="mt-3 flex flex-wrap gap-2">
        {offered.map((l) => (
          <label
            key={l.id}
            className={`inline-flex min-h-14 cursor-pointer items-center rounded-xl border-2 border-slate-950 px-4 py-2 text-lg font-bold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-950 ${
              value === l.id ? "bg-slate-950 text-white" : "bg-white text-slate-950 hover:bg-slate-100"
            }`}
          >
            <input type="radio" name={`${uid}-lang`} value={l.id} checked={value === l.id} onChange={() => onPick(l.id)} className="sr-only" />
            <span lang={l.tag}>{l.native}</span>
            {l.native !== l.english && <span className="ml-2 font-normal">({l.id === "other" ? "any language" : l.english})</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, icons }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; icons?: boolean }) {
  const uid = useId();
  return (
    <div className="rounded-xl border-2 border-slate-950 p-4">
      <div className="flex items-start gap-3">
        <input
          id={uid}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={`${uid}-hint`}
          className="mt-1 h-7 w-7 shrink-0 cursor-pointer accent-slate-950"
        />
        <div>
          <label htmlFor={uid} className="flex cursor-pointer items-center gap-2 text-lg font-bold">
            {label}
            {icons && (
              <>
                <Icon name="sun" className="h-6 w-6" />
                <Icon name="moon" className="h-6 w-6" />
                <Icon name="drop" className="h-6 w-6" />
                <Icon name="alert" className="h-6 w-6" />
              </>
            )}
          </label>
          <p id={`${uid}-hint`} className="text-lg text-slate-800">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Download a multi-sheet pack (e.g. a 4-week month, a 4-quiz unit) as one PDF. */
export function PackDownload({ pack, options, problems }: { pack: PackSlot; options: PrintOptions; problems: string[] }) {
  const uid = useId();
  const [page, setPage] = useState<PageSize>(defaultPageSize);
  const [state, setState] = useState<{ busy: boolean; message: string; error?: boolean }>({ busy: false, message: "" });
  const ready = pack.layouts(options, page).length === pack.sheets && problems.length === 0;
  return (
    <div className="rounded-xl border-2 border-slate-950 p-4">
      <p className="text-xl font-extrabold">{pack.heading}</p>
      <p id={`${uid}-hint`} className="text-lg text-slate-800">
        {pack.hint(options)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <fieldset className="flex items-center gap-1 rounded-xl border-2 border-slate-950 p-1">
          <legend className="sr-only">Paper size for {pack.label}</legend>
          {(["A4", "Letter"] as const).map((p) => (
            <label
              key={p}
              className={`cursor-pointer rounded-lg px-3 py-2 text-lg font-bold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-950 ${page === p ? "bg-slate-950 text-white" : "text-slate-950"}`}
            >
              <input type="radio" name={`${uid}-page`} value={p} checked={page === p} onChange={() => setPage(p)} className="sr-only" />
              {p === "Letter" ? "US Letter" : "A4"}
            </label>
          ))}
        </fieldset>
        <Button
          icon="printer"
          disabled={!ready || state.busy}
          aria-describedby={`${uid}-hint`}
          onClick={async () => {
            setState({ busy: true, message: "" });
            try {
              const bytes = await renderCardsPdf(pack.layouts(options, page), { title: pack.pdfTitle(options), textImage: canvasTextImage });
              const name = pack.fileName(options, page);
              downloadBytes(new Uint8Array(bytes), "application/pdf", name);
              setState({ busy: false, message: `Downloaded ${name} (${pack.sheets} pages).` });
            } catch {
              setState({ busy: false, message: "The pack could not be created.", error: true });
            }
          }}
        >
          {state.busy ? "Preparing pack..." : pack.label}
        </Button>
        <span role="status" aria-live="polite" className={`text-lg font-bold ${state.error ? "text-red-900" : "text-green-900"}`}>
          {state.message}
        </span>
      </div>
    </div>
  );
}

/**
 * The shared Print Cards tab: language, High-Visibility, Icon-Anchored mode, the card download and
 * an optional pack. Every app (and every scaffolded app) gets it from ScanWorkbench.
 */
export function PrintWorkspace({ slot, storageKey }: { slot: PrintSlot; storageKey: string }) {
  const [stored, setStored] = usePersistentState(storageKey, parsePrintOptions, NO_OPTIONS);
  const options = slot.value ?? stored;
  const set = (patch: PrintOptions) => {
    const next = { ...options, ...patch };
    if (slot.onChange) slot.onChange(next);
    else setStored(parsePrintOptions(next) ?? NO_OPTIONS);
  };
  const layouts = useMemo(() => slot.layouts(options), [slot, options]);
  const problems = slot.problems?.(options) ?? [];
  const iconsAvailable = useMemo(() => hasColumnIcons(slot.layouts({ ...options, icons: true })), [slot, options]);
  const languages = slot.languages ?? ["en"];
  return (
    <section aria-labelledby={`${storageKey}-print`} className="space-y-4 rounded-2xl border-2 border-slate-300 bg-white p-5">
      <h2 id={`${storageKey}-print`} className="text-2xl font-extrabold">
        Print Cards
      </h2>
      <p className="text-lg text-slate-800">A4 or US Letter. Every option changes printed words and marks only: any version scans the same way.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {languages.length > 1 && <TranslatePicker value={options.language ?? "en"} languages={languages} onPick={(language) => set({ language })} />}
        <Toggle
          label="High-Visibility Print Mode"
          hint="All text bold, larger row labels, and stronger shading on alternate rows, for low vision or a shaky hand. The circles stay exactly where they are."
          checked={!!options.highVisibility}
          onChange={(highVisibility) => set({ highVisibility })}
        />
        {iconsAvailable && (
          <Toggle
            label="Icon-Anchored Print Mode"
            hint="Prints simple pictures above the columns, for readers who rely on pictures more than words."
            checked={!!options.icons}
            onChange={(icons) => set({ icons })}
            icons
          />
        )}
      </div>
      {problems.length > 0 && (
        <Callout tone="warn" title="Fix these before printing">
          {problems.join(" ")}
        </Callout>
      )}
      <PrintCard layouts={layouts} label={slot.cardLabel ?? "Download card (PDF)"} disabled={problems.length > 0} />
      {slot.pack && <PackDownload pack={slot.pack} options={options} problems={problems} />}
    </section>
  );
}
