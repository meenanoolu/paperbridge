import type { CSSProperties, ReactNode } from "react";

/**
 * The caregiver sheet: one sheet of cream paper on a linen desk, with numbered fields down it,
 * instead of a dashboard of boxes. The shell's own panels (print, voice, history...) keep their
 * markup; the scoped CSS below turns their boxes into dotted-outline form fields, so nothing
 * inside the sheet looks like a separate card. Text on the sheet is #134E4A on #FAF8F5 (AAA).
 */
export const CARE_COLORS = { linen: "#F4EFE6", paper: "#FAF8F5", ink: "#134E4A", teal: "#0F766E" } as const;

export const LINEN_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(120,98,60,0.06) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(120,98,60,0.05) 0 1px, transparent 1px 3px)",
} as const;

export const CARE_CSS = `
.care-sheet { --ink: #134E4A; color: var(--ink); }
.care-sheet h2.care-field { font-family: Georgia, "Times New Roman", serif; }
/* The shell's panels become form fields on the sheet. */
.care-sheet section[class*="rounded"], .care-sheet details[class*="rounded"], .care-sheet div[class*="rounded-2xl"], .care-sheet div[class*="rounded-3xl"], .care-sheet article[class*="rounded"] {
  border: 1.5px dotted rgba(19, 78, 74, 0.55);
  border-radius: 4px;
  background: transparent;
  box-shadow: none;
}
.care-sheet [class*="bg-slate-100"], .care-sheet [class*="bg-sky-50"] { background: transparent; }
.care-sheet h3, .care-sheet h2:not(.care-field) { font-family: Georgia, "Times New Roman", serif; color: var(--ink); }
/* Calm, physical motion: the sheet settles, the clip swings once, the stamp thuds and bleeds ink.
   No looping, no jokes about medicine. Reduced motion shows every final state at once. */
.care-clip { transform-origin: 50% 10%; }
.stamp-ink { display: none; }
@media (prefers-reduced-motion: no-preference) {
  @keyframes care-swing { from { rotate: -17deg; } }
  @keyframes care-impress { from { opacity: 0; scale: 1.9; filter: blur(3px); } }
  @keyframes care-ink { from { opacity: 0.6; scale: 0.7; } to { opacity: 0; scale: 1.5; } }
  @keyframes care-nudge { 0%, 60%, 100% { translate: 0 0; } 75% { translate: 0 -5px; } 88% { translate: 0 1px; } }
  .care-clip { animation: care-swing var(--spring-wobbly-ms) var(--spring-wobbly) 0.3s both; }
  .stamp-impress { animation: care-impress var(--spring-slam-ms) var(--spring-slam) both; }
  .stamp-ink { display: block; position: absolute; inset: -8px; border-radius: 14px; border: 4px solid #115e59; pointer-events: none; animation: care-ink 0.8s ease-out both; }
  .stamp-ready .stamp-head { animation: care-nudge 2.4s ease-in-out 3; }
}
`;

/** A brass paper clip holding the sheet's top corner. */
export function PaperClip() {
  return (
    <svg viewBox="0 0 40 110" className="care-clip absolute -top-5 left-8 z-10 h-24 w-9 drop-shadow-[0_3px_2px_rgba(60,40,10,0.35)]" aria-hidden="true" focusable="false">
      <path d="M12 96V24a10 10 0 0 1 20 0v66a14 14 0 0 1-28 0V30" fill="none" stroke="#b08a2e" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 96V24a8 8 0 0 1 16 0" fill="none" stroke="#f1d98a" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

/** A numbered field: a small-caps serif label with a dotted rule, then its content. */
export function Field({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} data-field={n} className="m-rise space-y-4 border-t-2 border-dotted border-[#134E4A]/40 pt-6" style={{ "--i": n, "--d": "250ms" } as CSSProperties}>
      <h2 id={id} className="care-field flex items-baseline gap-3 text-2xl font-bold tracking-wide text-[#134E4A]">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[#134E4A] text-lg font-black">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
