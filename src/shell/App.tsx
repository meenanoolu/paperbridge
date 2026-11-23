import { useCallback, useEffect, useState } from "react";
import { appFromHash, APPS, DEFAULT_ACCENT, type RegisteredApp } from "./app-registry";
import { SkeletonGuide } from "./components/SkeletonGuide";
import type { CSSProperties } from "react";
import { Icon } from "./components/Icon";
import { OfflineBadge } from "./components/OfflineBadge";
import { RouteContext } from "./route-context";

export function App() {
  const [app, setApp] = useState(() => appFromHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setApp(appFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = `${app.label} | PaperBridge`;
  }, [app]);

  const onRoute = useCallback((target: RegisteredApp) => {
    if (window.location.hash !== `#${target.id}`) window.location.hash = target.id;
    setApp(target);
  }, []);

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
          <a href={`#${APPS[0].id}`} className="flex items-center gap-3 text-2xl font-black tracking-tight" aria-label="PaperBridge home">
            <span className="grid h-10 w-10 grid-cols-2 gap-1 rounded-md bg-white p-1.5" aria-hidden>
              <span className="rounded-sm bg-slate-950" />
              <span className="rounded-full border-2 border-slate-950" />
              <span className="rounded-full border-2 border-slate-950" />
              <span className="rounded-sm bg-slate-950" />
            </span>
            PaperBridge
          </a>
          <OfflineBadge />
          <SkeletonGuide />
          <nav aria-label="Choose an app">
            <ul className="flex flex-wrap gap-2">
              {APPS.map((a) => (
                <li key={a.id}>
                  <a
                    href={`#${a.id}`}
                    aria-current={app.id === a.id ? "page" : undefined}
                    className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-4 py-2 text-lg font-bold ${
                      app.id === a.id ? "bg-yellow-300 text-slate-950" : "text-white hover:bg-slate-800"
                    }`}
                  >
                    <Icon name={a.icon} />
                    {a.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        data-accent={(app.accent ?? DEFAULT_ACCENT).name}
        style={{ "--accent": (app.accent ?? DEFAULT_ACCENT).strong, "--accent-soft": (app.accent ?? DEFAULT_ACCENT).soft } as CSSProperties}
        className="mx-auto max-w-6xl px-4 py-6 focus:outline-none sm:px-6 sm:py-8"
      >
        <RouteContext.Provider value={onRoute}>
          <app.Component key={app.id} />
        </RouteContext.Provider>
      </main>
      <footer className="border-t-2 border-slate-300 bg-white">
        <p className="mx-auto max-w-6xl px-4 py-5 text-lg text-slate-800 sm:px-6">
          PaperBridge runs fully in your browser and keeps working offline once loaded (install it from the browser menu). Cards need only paper and a pen: no smartphone, login, or upload. One
          shared optical core powers every app.
        </p>
        {app.footerNote && <p className="mx-auto max-w-6xl px-4 -mt-2 pb-5 text-lg text-slate-800 sm:px-6">{app.footerNote}</p>}
      </footer>
    </div>
  );
}
