import type { ScanState } from "./scan";

/** The 3-step decode pipeline shown above a result: Photo Input -> Optical Unwarp -> Verified Output. */
export type StepStatus = "waiting" | "active" | "done" | "failed" | "review";

export interface PipelineStep {
  id: "input" | "unwarp" | "output";
  label: string;
  status: StepStatus;
  /** Short status text, e.g. "28 ms" or "1 mark needs a human check". */
  detail: string;
}

export function pipelineSteps(state: ScanState, unclearLeft: number): PipelineStep[] {
  const busy = state.status === "busy";
  const done = state.status === "done";
  const scan = done ? state.scan : null;
  const ms = scan ? `${Math.max(1, Math.round(scan.decodeMs))} ms` : "";
  const ok = !!scan?.result.ok;
  return [
    {
      id: "input",
      label: "1. Photo Input",
      status: busy || done ? "done" : state.status === "error" ? "failed" : "waiting",
      detail: scan ? `${scan.width} x ${scan.height} px` : busy ? state.label : state.status === "error" ? "could not load" : "pick a sample, upload or webcam",
    },
    {
      id: "unwarp",
      label: scan ? `2. Optical Unwarp (${ms})` : "2. Optical Unwarp",
      status: busy ? "active" : done ? (ok ? "done" : "failed") : "waiting",
      detail: busy ? "finding 4 corner markers" : scan ? (ok ? "4 corner markers locked" : "corner markers not found") : "",
    },
    {
      id: "output",
      label: "3. Verified Output",
      status: !scan ? "waiting" : !ok ? "failed" : unclearLeft > 0 ? "review" : "done",
      detail: !scan || !ok ? "" : unclearLeft > 0 ? `${unclearLeft} ${unclearLeft === 1 ? "mark needs" : "marks need"} a human check` : "every mark read or checked by hand",
    },
  ];
}

export const STEP_WORD: Record<StepStatus, string> = { waiting: "Not started", active: "In progress", done: "Done", failed: "Failed", review: "Needs review" };
