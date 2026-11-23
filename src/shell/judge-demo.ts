import type { RasterImage } from "../core";
import type { AppMeta } from "./app-registry";
import type { BatchSource } from "./batch";
import type { SampleCard } from "./components/SamplePanel";

/**
 * The Instant Demo: three one-click scenarios assembled from what apps declare in `appMeta.demo`
 * (sample ids) and `appMeta.samples`. Pure, so the choice of samples is unit tested.
 */
export type ScenarioId = "faint" | "batch" | "clean";

export interface DemoRef {
  appId: string;
  appLabel: string;
  sample: SampleCard;
}

export interface JudgeScenario {
  id: ScenarioId;
  title: string;
  description: string;
  refs: DemoRef[];
}

type DemoApp = Pick<AppMeta, "id" | "label" | "samples" | "demo">;

function ref(app: DemoApp, sampleId: string | undefined): DemoRef | null {
  const sample = sampleId ? app.samples?.find((s) => s.id === sampleId && s.src) : undefined;
  return sample ? { appId: app.id, appLabel: app.label, sample } : null;
}

const first = (apps: DemoApp[], key: "faint" | "clean") => apps.map((a) => ref(a, a.demo?.[key])).find(Boolean) ?? null;

/** Scenarios whose samples exist. The batch needs cards from 2 different apps. */
export function judgeScenarios(apps: DemoApp[]): JudgeScenario[] {
  const out: JudgeScenario[] = [];
  const faint = first(apps, "faint");
  if (faint)
    out.push({
      id: "faint",
      title: "Missed-Dose + Faint Mark",
      description: `${faint.appLabel}: ${faint.sample.title}, with the Optical X-Ray on.`,
      refs: [faint],
    });
  const batch = apps.flatMap((a) => ref(a, a.demo?.batch) ?? []).slice(0, 2);
  if (new Set(batch.map((r) => r.appId)).size === 2)
    out.push({
      id: "batch",
      title: "Mixed Batch (2 Apps at Once)",
      description: `${batch.map((r) => r.appLabel).join(" + ")}, routed by card ID.`,
      refs: batch,
    });
  const clean = first(apps, "clean");
  if (clean)
    out.push({
      id: "clean",
      title: "Clean Week (100% Adherence)",
      description: `${clean.appLabel}: ${clean.sample.title}, ready for the Doctor Visit PDF.`,
      refs: [clean],
    });
  return out;
}

/** "missed-dose.jpg" style file names for a batch, so per-row names prefill sensibly. */
export const demoFileName = (r: DemoRef) => `${r.sample.id}.jpg`;

/** Batch sources for the Mixed Batch, with an injected loader (fetch + decode in the browser). */
export function demoBatchSources(refs: DemoRef[], load: (r: DemoRef) => Promise<RasterImage>): BatchSource[] {
  return refs.map((r) => ({ name: demoFileName(r), load: () => load(r) }));
}
