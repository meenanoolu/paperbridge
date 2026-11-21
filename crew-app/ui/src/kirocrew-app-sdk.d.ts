/**
 * Types for the host-provided SDK. The package is NOT installed: the Crew dashboard
 * resolves `@kirocrew/app-sdk` and `@kirocrew/app-sdk/ui` through its import map.
 * Signatures follow https://kiro.dev/docs/crew/apps/sdk/ and the KiroCrew sources
 * (website/src/app-sdk/index.ts, website/src/components/ui.tsx). Only what this app uses.
 */
declare module "@kirocrew/app-sdk" {
  export interface AppApi {
    get<T = unknown>(path: string): Promise<T>;
    post<T = unknown>(path: string, body?: unknown): Promise<T>;
    put<T = unknown>(path: string, body?: unknown): Promise<T>;
    patch<T = unknown>(path: string, body?: unknown): Promise<T>;
    del<T = unknown>(path: string): Promise<T>;
  }
  export interface AppInfo {
    name: string;
    version?: string;
    permissions: { api?: string[]; events?: string[]; storage?: boolean };
  }
  export interface ChatLaunchOptions {
    agent?: string;
    message?: string;
    slotKey?: string;
    /** False seeds a draft only; the user must press Send. */
    autoSend?: boolean;
  }
  export function useAppApi(): AppApi;
  export function useAppEvents(event: string, callback: (data: unknown) => void): void;
  export function useAppInfo(): AppInfo;
  export function useNotify(): (message: string, opts?: { type?: "info" | "success" | "error" }) => void;
  export function useNavBadge(): (count: number) => void;
  export function useChatLauncher(): { openChat: (opts?: ChatLaunchOptions) => void };
  export function useTheme(): { mode: "dark" | "light"; accent: string; colorTheme: string };
}

declare module "@kirocrew/app-sdk/ui" {
  import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from "react";
  export function Card(props: ComponentPropsWithoutRef<"div">): JSX.Element;
  export function CardTitle(props: ComponentPropsWithoutRef<"h3">): JSX.Element;
  export function Btn(props: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean; primary?: boolean; busy?: boolean }): JSX.Element;
  export function Badge(props: { variant: "ok" | "err" | "warn" | "aim" | "muted"; children: ReactNode; className?: string; title?: string }): JSX.Element;
  export function StatCard(props: { label: string; value?: string | number | null; accent?: boolean; colorClass?: string; title?: string; className?: string }): JSX.Element;
  export function EmptyState(props: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode }): JSX.Element;
  export function PageHeader(props: { title: ReactNode; subtitle?: string; actions?: ReactNode }): JSX.Element;
  export function InfoTip(props: { text?: ReactNode; children?: ReactNode }): JSX.Element;
}
