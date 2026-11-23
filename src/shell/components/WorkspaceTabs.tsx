import { useRef, type ReactNode } from "react";
import { nextTabIndex, panelId, showWorkspaceTab, tabId, WORKSPACE_TABS, type WorkspaceTab } from "../workspace-tabs";
import { Icon, type IconName } from "./Icon";

const TAB_ICONS: Record<WorkspaceTab, IconName> = { scan: "camera", print: "printer", history: "calendar" };

/**
 * WAI-ARIA tabs: one tab stop (roving tabindex), arrows/Home/End move and activate, Tab moves into
 * the panel. Every panel stays mounted (inactive ones are `hidden`), so a scan, a half-filled
 * form or a batch survives switching tabs.
 */
export function WorkspaceTabs({
  scope,
  active,
  labels,
  intro,
  panels,
}: {
  /** Unique per app, for element ids. */
  scope: string;
  active: WorkspaceTab;
  /** Optional per-app tab names, e.g. "Class Sheet & Export". */
  labels?: Partial<Record<WorkspaceTab, string>>;
  panels: Record<WorkspaceTab, ReactNode>;
  /** Shown between the tab list and the panels, e.g. the app heading. */
  intro?: ReactNode;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = WORKSPACE_TABS.findIndex((t) => t.id === active);
  return (
    <>
      <div role="tablist" aria-label="Workspace" className="flex flex-wrap gap-2 border-b-4 border-[var(--accent,#020617)] pb-2">
        {WORKSPACE_TABS.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={tabId(scope, t.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(scope, t.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => showWorkspaceTab(t.id)}
              onKeyDown={(e) => {
                const next = nextTabIndex(index, e.key, WORKSPACE_TABS.length);
                if (next === null) return;
                e.preventDefault();
                showWorkspaceTab(WORKSPACE_TABS[next].id);
                refs.current[next]?.focus();
              }}
              className={`inline-flex min-h-14 items-center gap-2 rounded-xl border-2 px-5 py-3 text-lg font-extrabold ${
                selected ? "border-[var(--accent,#020617)] bg-[var(--accent,#020617)] text-white" : "border-slate-950 bg-white text-slate-950 hover:bg-slate-100"
              }`}
            >
              <Icon name={TAB_ICONS[t.id]} />
              {labels?.[t.id] ?? t.label}
            </button>
          );
        })}
      </div>
      {intro}
      {WORKSPACE_TABS.map((t) => (
        <div
          key={t.id}
          id={panelId(scope, t.id)}
          role="tabpanel"
          aria-labelledby={tabId(scope, t.id)}
          hidden={t.id !== active}
          tabIndex={0}
          className="space-y-8 rounded-xl focus-visible:outline-offset-8"
        >
          {panels[t.id]}
        </div>
      ))}
    </>
  );
}
