import { useEffect, useState } from "react";
import { ElderCareApp } from "../apps/elder-care/App";
import { StudyBridgeApp } from "../apps/study-bridge/App";
import { Icon, type IconName } from "./components/Icon";

type AppId = "elder-care" | "study-bridge";

const APPS: { id: AppId; label: string; icon: IconName }[] = [
  { id: "elder-care", label: "Elder Care Bridge", icon: "heart" },
  { id: "study-bridge", label: "Study Bridge", icon: "book" },
];

function fromHash(): AppId {
  return window.location.hash === "#study-bridge" ? "study-bridge" : "elder-care";
}

export function App() {
  const [app, setApp] = useState<AppId>(fromHash);

  useEffect(() => {
    const onHash = () => setApp(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = `${APPS.find((a) => a.id === app)!.label} | PaperBridge`;
  }, [app]);

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
          <a href="#elder-care" className="flex items-center gap-3 text-2xl font-black tracking-tight" aria-label="PaperBridge home">
            <span className="grid h-10 w-10 grid-cols-2 gap-1 rounded-md bg-white p-1.5" aria-hidden>
              <span className="rounded-sm bg-slate-950" />
              <span className="rounded-full border-2 border-slate-950" />
              <span className="rounded-full border-2 border-slate-950" />
              <span className="rounded-sm bg-slate-950" />
            </span>
            PaperBridge
          </a>
          <nav aria-label="Choose an app">
            <ul className="flex gap-2">
              {APPS.map((a) => (
                <li key={a.id}>
                  <a
                    href={`#${a.id}`}
                    aria-current={app === a.id ? "page" : undefined}
                    className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-4 py-2 text-lg font-bold ${
                      app === a.id ? "bg-yellow-300 text-slate-950" : "text-white hover:bg-slate-800"
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
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 focus:outline-none sm:px-6 sm:py-10">
        {app === "elder-care" ? <ElderCareApp /> : <StudyBridgeApp />}
      </main>
      <footer className="border-t-2 border-slate-300 bg-white">
        <p className="mx-auto max-w-6xl px-4 py-5 text-lg text-slate-800 sm:px-6">
          PaperBridge runs fully in your browser. Cards need only paper and a pen: no smartphone, login, or upload. One
          shared optical core powers both apps.
        </p>
      </footer>
    </div>
  );
}
