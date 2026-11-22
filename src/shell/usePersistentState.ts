import { useCallback, useEffect, useState } from "react";
import { loadJson, removeJson, saveJson, STORAGE_EVENT, storageKey, type Parse } from "./storage";

/**
 * React state mirrored to localStorage. `saved` is false if the last write failed.
 * It reloads when another part of the page (e.g. a "Scan Any Card" bulk save) or another tab
 * writes the same key.
 */
export function usePersistentState<T>(name: string, parse: Parse<T>, fallback: T) {
  const [value, setValue] = useState<T>(() => loadJson(name, parse, fallback));
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    const reload = () => setValue(loadJson(name, parse, fallback));
    const onLocal = (e: Event) => {
      if ((e as CustomEvent<string>).detail === name) reload();
    };
    const onOtherTab = (e: StorageEvent) => {
      if (e.key === null || e.key === storageKey(name)) reload();
    };
    window.addEventListener(STORAGE_EVENT, onLocal);
    window.addEventListener("storage", onOtherTab);
    return () => {
      window.removeEventListener(STORAGE_EVENT, onLocal);
      window.removeEventListener("storage", onOtherTab);
    };
  }, [name, parse, fallback]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      setSaved(saveJson(name, next));
    },
    [name],
  );
  const reset = useCallback(() => {
    removeJson(name);
    setValue(fallback);
    setSaved(true);
  }, [name, fallback]);
  return [value, set, reset, saved] as const;
}
