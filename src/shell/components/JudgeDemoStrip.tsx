import { useContext, useMemo, useState } from "react";
import { rasterFromUrl } from "../../core";
import { APPS, routableApps } from "../app-registry";
import { demoFileName, judgeScenarios, type JudgeScenario } from "../judge-demo";
import { RouteContext } from "../route-context";
import { offerRoutedScan, requestAutoRouteBatch } from "../routed-scan";
import { routeRaster } from "../route";
import { useSessionState } from "../session-state";
import { Icon, type IconName } from "./Icon";

const ICONS: Record<JudgeScenario["id"], IconName> = { faint: "xray", batch: "upload", clean: "check" };

/**
 * "Try an Instant Demo": 3 one-click scenarios at the top of Scan & Verify, for a first visit.
 * Everything still runs the real decoder on real sample pixels in this browser.
 */
export function JudgeDemoStrip() {
  const onRoute = useContext(RouteContext);
  const scenarios = useMemo(() => judgeScenarios(APPS), []);
  const [busy, setBusy] = useState<string | null>(null);
  // The strip remounts when a scenario switches apps: keep its status line for the session.
  const [status, setStatus] = useSessionState("instant-demo.status", "");
  if (!onRoute || scenarios.length === 0) return null;

  const single = async (s: JudgeScenario, xray: boolean) => {
    const r = s.refs[0];
    const raster = await rasterFromUrl(r.sample.src);
    const t0 = performance.now();
    const routed = routeRaster(raster, routableApps());
    const decodeMs = performance.now() - t0;
    if (!routed.ok) throw new Error(routed.reason);
    offerRoutedScan(
      { source: "sample", label: r.sample.title, imageUrl: r.sample.src, width: raster.width, height: raster.height, result: routed.result, layout: routed.layout, decodeMs, scannedAt: new Date() },
      { xray },
    );
    onRoute(routed.app);
    return `${r.sample.title} decoded in ${Math.round(decodeMs)} ms and opened in ${routed.app.label}.`;
  };

  const batch = async (s: JudgeScenario) => {
    const files = await Promise.all(
      s.refs.map(async (r) => new File([await (await fetch(r.sample.src)).blob()], demoFileName(r), { type: "image/jpeg" })),
    );
    requestAutoRouteBatch(files);
    return `Decoding ${files.length} cards from ${s.refs.map((r) => r.appLabel).join(" and ")} in Scan Any Card below.`;
  };

  const run = async (s: JudgeScenario) => {
    setBusy(s.id);
    setStatus(`Loading ${s.title}...`);
    try {
      setStatus(s.id === "batch" ? await batch(s) : await single(s, s.id === "faint"));
    } catch {
      setStatus(`${s.title} could not be loaded.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="instant-demo" className="rounded-2xl border-2 border-[var(--accent,#020617)] bg-[var(--accent-soft,#f1f5f9)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="instant-demo" className="text-2xl font-extrabold">
          Try an Instant Demo
        </h2>
        <p className="text-lg text-slate-800">One click each. Real sample photos, decoded on this device.</p>
      </div>
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {scenarios.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => void run(s)}
              disabled={busy !== null}
              aria-describedby={`instant-demo-${s.id}`}
              className="flex h-full min-h-14 w-full items-start gap-3 rounded-xl border-2 border-slate-950 bg-white px-4 py-3 text-left hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
            >
              <Icon name={ICONS[s.id]} className="mt-0.5 h-7 w-7 shrink-0" />
              <span>
                <span className="block text-lg font-extrabold">{busy === s.id ? "Loading..." : s.title}</span>
                <span id={`instant-demo-${s.id}`} className="block text-lg text-slate-800">
                  {s.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className="mt-2 min-h-7 text-lg font-bold">
        {status}
      </p>
    </section>
  );
}
