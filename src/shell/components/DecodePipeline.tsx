import { STEP_WORD, type PipelineStep } from "../pipeline";
import { Icon, type IconName } from "./Icon";

const LOOK: Record<PipelineStep["status"], { box: string; icon: IconName }> = {
  waiting: { box: "border-slate-400 bg-white text-slate-800", icon: "sparkle" },
  active: { box: "border-[var(--accent,#020617)] bg-white text-slate-950 motion-safe:animate-pulse", icon: "camera" },
  done: { box: "border-green-800 bg-green-50 text-green-950", icon: "check" },
  failed: { box: "border-red-800 bg-red-50 text-red-950", icon: "alert" },
  review: { box: "border-amber-700 bg-amber-50 text-amber-950", icon: "question" },
};

/** Compact 3-step indicator. Each step names its state in words, never by colour alone. */
export function DecodePipeline({ steps }: { steps: PipelineStep[] }) {
  const current = steps.find((s) => s.status === "active" || s.status === "review" || s.status === "failed") ?? [...steps].reverse().find((s) => s.status === "done");
  return (
    <ol aria-label="Decode pipeline" className="grid gap-2 sm:grid-cols-3" data-testid="pipeline">
      {steps.map((s, i) => (
        <li
          key={s.id}
          aria-current={s === current ? "step" : undefined}
          data-status={s.status}
          className={`flex items-start gap-2 rounded-xl border-2 px-3 py-2 ${LOOK[s.status].box}`}
        >
          <Icon name={LOOK[s.status].icon} className="mt-0.5 h-6 w-6 shrink-0" />
          <span>
            <span className="block text-lg font-extrabold">{s.label}</span>
            <span className="block text-lg">
              {STEP_WORD[s.status]}
              {s.detail ? `: ${s.detail}` : ""}
            </span>
          </span>
          {i < steps.length - 1 && <span className="sr-only">, then </span>}
        </li>
      ))}
    </ol>
  );
}
