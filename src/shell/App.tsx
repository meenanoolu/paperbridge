import { useCallback, useEffect, useState } from "react";
import { DEFAULT_ACCENT, navItems, viewFromHash, viewId, type RegisteredApp, type View } from "./app-registry";
import { SkeletonHome } from "./components/SkeletonHome";
import { SkeletonGuide } from "./components/SkeletonGuide";
import type { CSSProperties } from "react";
import { OfflineBadge } from "./components/OfflineBadge";
import { RouteContext } from "./route-context";

/**
 * Skeleton Crew Launcher Bar: the PaperBridge mark (Skeleton Home) and one pill per app. Pills
 * are links, since each frontend has its own URL; the open one has `aria-current="page"`.
 */
export function LauncherBar({ current }: { current: string }) {
  const [home, ...apps] = navItems();
  return (
    <header className="on-dark sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <a
          href={`#${home.id}`}
          aria-current={current === home.id ? "page" : undefined}
          aria-label="PaperBridge: Skeleton Home"
          className={`flex min-h-12 items-center gap-2 rounded-full px-2 pr-4 text-xl font-black tracking-tight ${current === home.id ? "bg-white/10" : "hover:bg-white/5"}`}
        >
          <span className="grid h-9 w-9 grid-cols-2 gap-1 rounded-md bg-white p-1.5" aria-hidden>
            <span className="rounded-sm bg-slate-950" />
            <span className="rounded-full border-2 border-slate-950" />
            <span className="rounded-full border-2 border-slate-950" />
            <span className="rounded-sm bg-slate-950" />
          </span>
          PaperBridge
        </a>
        <nav aria-label="Apps" className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
          <ul className="flex flex-wrap gap-2">
            {apps.map((n) => {
              const on = n.id === current;
              return (
                <li key={n.id}>
                  <a
                    href={`#${n.id}`}
                    aria-current={on ? "page" : undefined}
                    className={`inline-flex min-h-12 items-center gap-2 rounded-full px-4 py-2 text-lg font-bold ${on ? "bg-yellow-300 text-slate-950" : "text-white hover:bg-slate-800"}`}
                  >
                    <span aria-hidden className="h-3 w-3 rounded-full ring-2 ring-white" style={{ background: n.accent?.strong ?? "#020617" }} />
                    {n.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <OfflineBadge />
          <SkeletonGuide />
        </div>
      </div>
    </header>
  );
}

export function App() {
  const [view, setView] = useState<View>(() => viewFromHash(window.location.hash));
  const app = view.kind === "app" ? view.app : null;

  useEffect(() => {
    const onHash = () => setView(viewFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = `${app ? app.label : "Skeleton Home"} | PaperBridge`;
  }, [app]);

  const onRoute = useCallback((target: RegisteredApp) => {
    if (window.location.hash !== `#${target.id}`) window.location.hash = target.id;
    setView({ kind: "app", app: target });
  }, []);
  const accent = app?.accent ?? DEFAULT_ACCENT;

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        onClick={(e) => {
          // The hash selects the app, so move focus without changing it.
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only z-50 rounded-xl bg-yellow-300 px-4 py-3 text-lg font-bold text-slate-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <LauncherBar current={viewId(view)} />
      <main
        id="main"
        tabIndex={-1}
        data-accent={accent.name}
        style={{ "--accent": accent.strong, "--accent-soft": accent.soft } as CSSProperties}
        className={!app || app.fullBleed ? "focus:outline-none" : "mx-auto max-w-6xl px-4 py-6 focus:outline-none sm:px-6 sm:py-8"}
      >
        <RouteContext.Provider value={onRoute}>
          {app ? <app.Component key={app.id} /> : <SkeletonHome />}
        </RouteContext.Provider>
      </main>
      <footer className="border-t-2 border-slate-300 bg-white">
        <p className="mx-auto max-w-6xl px-4 py-5 text-lg text-slate-800 sm:px-6">
          PaperBridge runs fully in your browser and keeps working offline once loaded (install it from the browser menu). Cards need only paper and a pen: no smartphone, login, or upload. One
          shared optical core powers every app.
        </p>
        {app?.footerNote && <p className="mx-auto max-w-6xl px-4 -mt-2 pb-5 text-lg text-slate-800 sm:px-6">{app.footerNote}</p>}
      </footer>
    </div>
  );
}
