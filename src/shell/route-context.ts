import { createContext } from "react";
import type { RegisteredApp } from "./app-registry";

/** Lets "Scan Any Card", inside each app's Scan & Verify tab, switch the shell to another app. */
export const RouteContext = createContext<((app: RegisteredApp) => void) | null>(null);
