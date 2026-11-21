/**
 * Test double for the host-provided `@kirocrew/app-sdk` and `@kirocrew/app-sdk/ui`.
 * Aliased in the root vite.config.ts for tests only. Records calls for assertions.
 */
import { createElement, type ReactNode } from "react";

export const calls = { openChat: [] as unknown[], badge: [] as number[], notify: [] as string[], subscribed: [] as string[] };

export function useAppApi() {
  return {
    get: async (path: string) => (path === "/api/status" ? { version: "0.13.0" } : { notifications: [] }),
    post: async () => ({}),
    put: async () => ({}),
    patch: async () => ({}),
    del: async () => ({}),
  };
}
export function useAppEvents(event: string) {
  calls.subscribed.push(event);
}
export function useAppInfo() {
  return { name: "paperbridge-care-monitor", permissions: {} };
}
export function useNotify() {
  return (m: string) => calls.notify.push(m);
}
export function useNavBadge() {
  return (n: number) => calls.badge.push(n);
}
export function useChatLauncher() {
  return { openChat: (o: unknown) => calls.openChat.push(o) };
}

const el = (tag: string) => (props: { children?: ReactNode; [k: string]: unknown }) => {
  const { children, primary: _p, danger: _d, busy: _b, variant: _v, accent: _a, ...rest } = props;
  return createElement(tag, rest, children);
};
export const Card = el("section");
export const CardTitle = el("h3");
export const Btn = el("button");
export const Badge = el("span");
export const StatCard = ({ label, value }: { label: string; value?: unknown }) => createElement("div", null, `${label}: ${String(value)}`);
export const EmptyState = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) =>
  createElement("div", null, title, subtitle, action);
export const PageHeader = ({ title, subtitle, actions }: { title: ReactNode; subtitle?: string; actions?: ReactNode }) =>
  createElement("header", null, createElement("h1", null, title), subtitle, actions);
export const InfoTip = el("span");
