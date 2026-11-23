import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary";

export function Button({
  variant = "secondary",
  icon,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName }) {
  const base =
    "inline-flex min-h-14 items-center justify-center gap-3 rounded-xl px-5 py-3 text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-slate-950 text-white shadow-[inset_0_-5px_0_0_var(--accent,#020617)] hover:bg-slate-800"
      : "border-2 border-slate-950 bg-white text-slate-950 hover:bg-slate-100";
  return (
    <button type="button" className={`${base} ${styles} ${className}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export type Tone = "good" | "warn" | "bad" | "info";

const TONE: Record<Tone, { box: string; icon: IconName; word: string }> = {
  good: { box: "border-green-800 bg-green-50 text-green-950", icon: "check", word: "OK" },
  warn: { box: "border-amber-700 bg-amber-50 text-amber-950", icon: "question", word: "Check" },
  bad: { box: "border-red-800 bg-red-50 text-red-950", icon: "alert", word: "Alert" },
  info: { box: "border-slate-700 bg-slate-100 text-slate-950", icon: "sparkle", word: "Info" },
};

/** Status never relies on colour alone: every badge has an icon and a word. */
export function StatusBadge({ tone, children }: { tone: Tone; children?: ReactNode }) {
  const t = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-0.5 text-lg font-bold ${t.box}`}>
      <Icon name={t.icon} className="h-5 w-5" />
      {children ?? t.word}
    </span>
  );
}

export function Callout({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) {
  const t = TONE[tone];
  return (
    <div className={`flex gap-3 rounded-xl border-2 p-4 ${t.box}`}>
      <Icon name={t.icon} className="mt-0.5 h-7 w-7 shrink-0" />
      <div>
        <p className="font-bold">{title}</p>
        {children && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      {title && <h3 className="mb-4 text-2xl font-extrabold tracking-tight">{title}</h3>}
      {children}
    </section>
  );
}
