import { useCallback, useState } from "react";
import { loadJson, removeJson, saveJson, type Parse } from "./storage";

/** React state mirrored to localStorage. `saved` is false if the last write failed. */
export function usePersistentState<T>(name: string, parse: Parse<T>, fallback: T) {
  const [value, setValue] = useState<T>(() => loadJson(name, parse, fallback));
  const [saved, setSaved] = useState(true);
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
