/**
 * Small, defensive localStorage wrapper. Every value is validated by a pure `parse`
 * function on load, so corrupt or hand-edited storage falls back to a default.
 * Everything stays in this browser: PaperBridge never uploads it.
 */
export type Parse<T> = (raw: unknown) => T | null;

export function storageKey(name: string): string {
  return `paperbridge.${name}`;
}

function storage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined; // e.g. blocked by privacy settings
  }
}

export function loadJson<T>(name: string, parse: Parse<T>, fallback: T): T {
  try {
    const raw = storage()?.getItem(storageKey(name));
    if (raw == null) return fallback;
    return parse(JSON.parse(raw)) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when storage is full or unavailable, so the UI can say so. */
export function saveJson(name: string, value: unknown): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(storageKey(name), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeJson(name: string): void {
  try {
    storage()?.removeItem(storageKey(name));
  } catch {
    // ignore
  }
}
