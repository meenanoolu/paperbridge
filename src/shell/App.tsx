import { useCallback, useEffect, useState } from "react";
import { DEFAULT_ACCENT, HOME_ID, navItems, viewFromHash, viewId, type RegisteredApp, type View } from "./app-registry";
import { SkeletonHome } from "./components/SkeletonHome";
import { SkeletonGuide } from "./components/SkeletonGuide";
import type { CSSProperties } from "react";
import { Icon } from "./components/Icon";
import { OfflineBadge } from "./components/OfflineBadge";
import { RouteContext } from "./route-context";

/**
 * Top-right view tabs: Skeleton Home, then every app. They are links (each view has its own URL),
 * styled as tabs, with `aria-current="page"` on the open one.
 */
export function ViewTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Views">
      <ul className="flex flex-wrap gap-2">
        {navItems().map((n) => {
          const on = n.id === current;
          return (
            <li key={n.id}>
              <a
                href={`#${n.id}`}
                aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-12 items-center gap-2 rounded-xl border-b-4 px-4 py-2 text-lg font-bold ${
                  on ? "border-yellow-300 bg-yellow-300 text-slate-950" : "border-transparent text-white hover:bg-slate-800"
                }`}
              >
                <Icon name={n.icon} />
                {n.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
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
      <header className="on-dark bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href={`#${HOME_ID}`} className="flex items-center gap-3 text-2xl font-black tracking-tight" aria-label="PaperBridge home">
            <span className="grid h-10 w-10 grid-cols-2 gap-1 rounded-md bg-white p-1.5" aria-hidden>
              <span className="rounded-sm bg-slate-950" />
              <span className="rounded-full border-2 border-slate-950" />
              <span className="rounded-full border-2 border-slate-950" />
              <span className="rounded-sm bg-slate-950" />
            </span>
            PaperBridge
          </a>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <OfflineBadge />
            <SkeletonGuide />
            <ViewTabs current={viewId(view)} />
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        data-accent={accent.name}
        style={{ "--accent": accent.strong, "--accent-soft": accent.soft } as CSSProperties}
        className="mx-auto max-w-6xl px-4 py-6 focus:outline-none sm:px-6 sm:py-8"
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
