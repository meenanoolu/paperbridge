import type { ComponentType } from "react";
import type { IconName } from "./components/Icon";

/**
 * Apps register themselves: any `src/apps/<slug>/App.tsx` that exports `appMeta` and a
 * default component appears in the app switcher. `npm run create-app` relies on this.
 */
export interface AppMeta {
  /** URL hash and folder name, e.g. "elder-care". */
  id: string;
  label: string;
  icon: IconName;
  /** Lower comes first in the switcher. */
  order?: number;
}

export interface RegisteredApp extends AppMeta {
  Component: ComponentType;
}

type AppModule = { appMeta?: AppMeta; default?: ComponentType };

/** Pure: turn loaded modules into a sorted, de-duplicated app list. */
export function collectApps(modules: Record<string, AppModule>): RegisteredApp[] {
  const apps: RegisteredApp[] = [];
  const seen = new Set<string>();
  for (const [path, mod] of Object.entries(modules)) {
    if (!mod.appMeta || !mod.default) continue;
    if (seen.has(mod.appMeta.id)) throw new Error(`Duplicate app id "${mod.appMeta.id}" in ${path}`);
    seen.add(mod.appMeta.id);
    apps.push({ ...mod.appMeta, Component: mod.default });
  }
  return apps.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label));
}

export const APPS: RegisteredApp[] = collectApps(import.meta.glob<AppModule>("../apps/*/App.tsx", { eager: true }));

export function appFromHash(hash: string, apps: RegisteredApp[] = APPS): RegisteredApp {
  const id = hash.replace(/^#/, "");
  return apps.find((a) => a.id === id) ?? apps[0];
}
