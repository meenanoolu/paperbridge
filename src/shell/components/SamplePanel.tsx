import { Icon } from "./Icon";

export interface SampleCard {
  id: string;
  title: string;
  description: string;
  /** URL of the pre-rendered photo. It is decoded from pixels, not from stored results. */
  src: string;
}

export function SamplePanel({
  samples,
  activeId,
  busy,
  onPick,
}: {
  samples: SampleCard[];
  activeId: string | null;
  busy: boolean;
  onPick: (s: SampleCard) => void;
}) {
  return (
    <section
      aria-labelledby="sample-panel-title"
      className="rounded-3xl border-4 border-slate-950 bg-yellow-200 p-5 shadow-[6px_6px_0_0_#0f172a] sm:p-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="sample-panel-title" className="text-3xl font-black tracking-tight sm:text-4xl">
          Try Sample Scanned Cards <span className="whitespace-nowrap">(No Printer Needed)</span>
        </h2>
        <p className="text-lg font-semibold">One click. Real pixels. Same decoder as the webcam.</p>
      </div>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {samples.map((s) => {
          const active = s.id === activeId;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                disabled={busy}
                aria-pressed={active}
                className={`group flex h-full w-full items-center gap-4 rounded-2xl border-4 p-3 text-left transition-transform hover:-translate-y-0.5 disabled:cursor-wait ${
                  active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-950 bg-white text-slate-950"
                }`}
              >
                <img
                  src={s.src}
                  alt=""
                  className="h-28 w-20 shrink-0 rounded-md border-2 border-slate-400 object-cover"
                  loading="eager"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-xl font-extrabold">
                    {active && <Icon name="check" className="h-6 w-6" />}
                    {s.title}
                  </span>
                  <span className={`mt-1 block text-base ${active ? "text-slate-100" : "text-slate-800"}`}>{s.description}</span>
                  <span className="mt-2 inline-block text-base font-bold underline decoration-2 underline-offset-4">
                    {active ? "Scanned. Click to scan again" : "Scan this card"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
