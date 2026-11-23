import type { ComponentType } from "react";
import type { CardLayout } from "../core";
import type { BatchAdapter } from "./batch";
import type { IconName } from "./components/Icon";
import type { SampleCard } from "./components/SamplePanel";

/**
 * An app's accent colour, used for tab underlines, the selected tab, primary-button borders and
 * the app badge. `strong` carries white text (needs 7:1 for AAA); `soft` is a light tint behind
 * dark text.
 */
export interface AccentTheme {
  name: string;
  strong: string;
  soft: string;
}

/** The shell's neutral accent for apps that do not set one. */
export const DEFAULT_ACCENT: AccentTheme = { name: "slate", strong: "#020617", soft: "#f1f5f9" };

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
  /** Printed card variants (A4, Letter). Lets "Scan Any Card" route a photo here by its card ID. */
  layouts?: CardLayout[];
  /** Optional bulk save for "Scan Any Card" batches (e.g. to history or a class sheet). */
  batch?: BatchAdapter;
  /** One short line shown in the page footer while this app is open, e.g. a disclaimer. */
  footerNote?: string;
  /** Accent colour for this app's workspace. */
  accent?: AccentTheme;
  /** Sample cards, so the shell's Instant Demo can load them. */
  samples?: SampleCard[];
  /** Sample ids for the Instant Demo: a card with a faint mark, a clean card, and one for the mixed batch. */
  demo?: { faint?: string; clean?: string; batch?: string };
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

/** Apps that can receive auto-routed scans. */
export function routableApps(apps: RegisteredApp[] = APPS): (RegisteredApp & { layouts: CardLayout[] })[] {
  return apps.filter((a): a is RegisteredApp & { layouts: CardLayout[] } => !!a.layouts?.length);
}

export function appFromHash(hash: string, apps: RegisteredApp[] = APPS): RegisteredApp {
  const id = hash.replace(/^#/, "");
  return apps.find((a) => a.id === id) ?? apps[0];
}
