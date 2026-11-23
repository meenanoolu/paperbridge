import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState that survives unmounting for the rest of the page session (memory only, never
 * stored). Scan Any Card lives inside each app's Scan & Verify tab, so its batch list must
 * survive switching apps.
 */
const store = new Map<string, unknown>();

export function useSessionState<T>(key: string, init: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : typeof init === "function" ? (init as () => T)() : init));
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        store.set(key, v);
        return v;
      }),
    [key],
  );
  return [value, set];
}

/** A mutable value shared across mounts (like useRef, but page-session wide). */
export function sessionRef<T>(key: string, init: T): { current: T } {
  if (!store.has(`ref:${key}`)) store.set(`ref:${key}`, { current: init });
  return store.get(`ref:${key}`) as { current: T };
}

/** For tests. */
export function clearSessionState(): void {
  store.clear();
}
