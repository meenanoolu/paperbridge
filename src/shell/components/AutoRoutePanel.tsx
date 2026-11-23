import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { rasterFromFile } from "../../core";
import { routableApps, type RegisteredApp } from "../app-registry";
import { batchSummary, processBatch, saveableFor, saveBatchGroup, type BatchItem, type BatchRun } from "../batch";
import { offerRoutedScan } from "../routed-scan";
import { sessionRef, useSessionState } from "../session-state";
import { showWorkspaceTab } from "../workspace-tabs";
import { Icon } from "./Icon";
import { Button, Callout, StatusBadge } from "./ui";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/**
 * "Scan Any Card (Auto-Route)": pick or drop one or many photos from any PaperBridge app. Each
 * photo's card-ID strip says which app printed it. One photo opens straight in that app; a batch
 * gets a summary, per-file results, 1-click review, and bulk save. All local.
 */
export function AutoRoutePanel({ onRoute }: { onRoute: (app: RegisteredApp) => void }) {
  const uid = useId();
  const apps = useMemo(() => routableApps(), []);
  const input = useRef<HTMLInputElement>(null);
  // The panel sits in every app's Scan & Verify tab: batch state outlives switching apps.
  const files = sessionRef<File[]>("autoroute.files", []);
  const lastUrl = sessionRef<string | null>("autoroute.url", null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [run, setRun] = useSessionState<BatchRun | null>("autoroute.run", null);
  const [scannedAt, setScannedAt] = useSessionState("autoroute.at", () => new Date());
  const [values, setValues] = useSessionState<Record<number, string>>("autoroute.values", {});
  const [problems, setProblems] = useSessionState<Record<number, string>>("autoroute.problems", {});
  const [status, setStatus] = useSessionState<{ text: string; tone: "good" | "bad" | "info" } | null>("autoroute.status", null);

  const open = useCallback(
    (item: BatchItem) => {
      const app = apps.find((a) => a.id === item.appId);
      const file = files.current[item.index];
      if (!app || !item.result || !item.layout || !file) return;
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      lastUrl.current = URL.createObjectURL(file);
      offerRoutedScan({
        source: "upload",
        label: item.fileName,
        imageUrl: lastUrl.current,
        width: item.width ?? 0,
        height: item.height ?? 0,
        result: item.result,
        layout: item.layout,
        decodeMs: item.decodeMs,
        scannedAt,
      });
      onRoute(app);
    },
    [apps, onRoute, scannedAt],
  );

  const handle = useCallback(
    async (list: File[]) => {
      if (list.length === 0) return;
      // Photos dropped on any tab: the results show on Scan & Verify.
      showWorkspaceTab("scan");
      files.current = list;
      setRun(null);
      setStatus(null);
      setProblems({});
      setProgress(`Decoding ${list.length === 1 ? list[0].name : `1 of ${list.length}`}...`);
      await nextFrame();
      const result = await processBatch(
        list.map((f) => ({ name: f.name, load: () => rasterFromFile(f) })),
        apps,
        {
          onProgress: (done, total) => {
            if (done < total) setProgress(`Decoding ${done + 1} of ${total}...`);
          },
        },
      );
      const at = new Date();
      setScannedAt(at);
      setProgress("");
      const [only] = result.items;
      if (list.length === 1 && only.result) {
        const app = apps.find((a) => a.id === only.appId)!;
        setStatus({ text: `Opened ${only.fileName} in ${app.label}.`, tone: "good" });
        // Single photo: go straight to the app.
        open(only);
        return;
      }
      // Prefill each app's row inputs (e.g. consecutive weeks, names from file names).
      const v: Record<number, string> = {};
      for (const app of apps) {
        const rows = result.items.filter((i) => i.appId === app.id && i.result);
        const d = app.batch?.defaults?.(rows) ?? [];
        rows.forEach((r, k) => (v[r.index] = d[k] ?? ""));
      }
      setValues(v);
      setRun(result);
    },
    [apps, open],
  );

  // Drop anywhere on the page.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes("Files");
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      void handle([...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(f.name)));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [handle]);

  const saveApp = (app: (typeof apps)[number]) => {
    if (!run) return;
    const r = saveBatchGroup(run.items, app, values, scannedAt, new Date());
    if (r.ok) {
      setRun({ ...run, items: r.items });
      setProblems((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !r.items[+k]?.saved)));
      setStatus({ text: r.message, tone: "good" });
    } else {
      setProblems((p) => ({ ...p, ...r.problems }));
      setStatus({ text: r.message, tone: "bad" });
    }
  };

  const clear = () => {
    setRun(null);
    setStatus(null);
    setProblems({});
    files.current = [];
  };

  return (
    <section aria-labelledby={`${uid}-title`} className="rounded-2xl border-2 border-slate-300 bg-sky-50">
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-slate-950/70 p-6" aria-hidden="true">
          <p className="rounded-3xl border-4 border-dashed border-yellow-300 bg-slate-950 px-8 py-6 text-3xl font-black text-white">
            Drop card photos to decode and route them
          </p>
        </div>
      )}
      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h2 id={`${uid}-title`} className="flex items-center gap-2 text-2xl font-extrabold">
            <Icon name="upload" className="h-7 w-7" /> Scan Any Card (Auto-Route)
          </h2>
          <Button variant="primary" icon="camera" onClick={() => input.current?.click()} disabled={!!progress} aria-describedby={`${uid}-hint`}>
            Choose card photos
          </Button>
          <p id={`${uid}-hint`} className="text-lg text-slate-800">
            or drop them anywhere on this page. One or many, from any app: each card's ID strip says where it goes.
          </p>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const list = [...(e.target.files ?? [])];
              e.target.value = "";
              void handle(list);
            }}
          />
        </div>

        <p role="status" aria-live="polite" className="mt-2 text-lg font-bold empty:hidden">
          {progress || (run ? batchSummary(run) : "") || (!run && status ? status.text : "")}
        </p>

        {run && (
          <div className="mt-3 space-y-4 rounded-2xl border-2 border-slate-950 bg-white p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-lg">
                <caption className="sr-only">Decoded photos in this batch</caption>
                <thead>
                  <tr className="border-b-2 border-slate-950">
                    <th scope="col" className="px-2 py-2">Photo</th>
                    <th scope="col" className="px-2 py-2">Card</th>
                    <th scope="col" className="px-2 py-2">Result</th>
                    <th scope="col" className="px-2 py-2">Save as</th>
                    <th scope="col" className="px-2 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {run.items.map((item) => {
                    const app = apps.find((a) => a.id === item.appId);
                    const field = app?.batch?.input;
                    const id = `${uid}-v${item.index}`;
                    const problem = problems[item.index];
                    return (
                      <tr key={item.index} className="border-b border-slate-300 align-top">
                        <th scope="row" className="max-w-56 break-words px-2 py-2 font-bold">{item.fileName}</th>
                        <td className="px-2 py-2">{app ? `${app.label} (${item.layout?.page})` : "-"}</td>
                        <td className="px-2 py-2">
                          {item.status === "error" ? (
                            <span className="text-red-900">
                              <StatusBadge tone="bad">Not read</StatusBadge> <span className="mt-1 block">{item.error}</span>
                            </span>
                          ) : item.saved ? (
                            <StatusBadge tone="good">Saved</StatusBadge>
                          ) : item.status === "review" ? (
                            <StatusBadge tone="warn">{`${item.unclear} unclear ${item.unclear === 1 ? "mark" : "marks"}`}</StatusBadge>
                          ) : (
                            <StatusBadge tone="good">Ready</StatusBadge>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {field && item.result && !item.saved ? (
                            <div>
                              <label htmlFor={id} className="sr-only">
                                {`${field.label} for ${item.fileName}`}
                              </label>
                              <input
                                id={id}
                                type={field.type}
                                value={values[item.index] ?? ""}
                                aria-invalid={!!problem}
                                aria-describedby={problem ? `${id}-err` : undefined}
                                onChange={(e) => {
                                  setValues({ ...values, [item.index]: e.target.value });
                                  setProblems(({ [item.index]: _gone, ...rest }) => rest);
                                }}
                                className="block min-h-12 w-full min-w-44 rounded-xl border-2 border-slate-950 px-3 text-lg aria-[invalid=true]:border-red-800"
                              />
                              <span className="mt-1 block text-lg text-slate-800">{field.label}</span>
                              {problem && (
                                <span id={`${id}-err`} className="mt-1 block text-lg font-bold text-red-900">
                                  {problem}
                                </span>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {/* The accessible name starts with the visible word (WCAG 2.5.3 Label in Name). */}
                          {item.result && app && (
                            <Button onClick={() => open(item)} aria-label={`${item.unclear ? "Review" : "Open"} ${item.fileName} in ${app.label}`}>
                              {item.unclear ? "Review" : "Open"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {apps.map((app) => {
                const rows = saveableFor(run.items, app.id);
                if (!app.batch || rows.length === 0) return null;
                return (
                  <Button key={app.id} variant="primary" icon="check" onClick={() => saveApp(app)}>
                    {app.batch.actionLabel(rows.length)}
                  </Button>
                );
              })}
              <Button onClick={clear}>Clear batch</Button>
            </div>
            {run.items.some((i) => i.status === "review" && !i.saved) && (
              <p className="text-lg text-slate-800">
                Cards with unclear marks can be saved now (those marks are left uncounted), or opened with Review to check them by hand first.
              </p>
            )}
            {status && (
              <div role="status" aria-live="polite">
                <Callout tone={status.tone} title={status.text} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
