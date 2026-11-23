import { useCallback, useId, useState } from "react";
import type { SuccessfulScan } from "../../core";
import { parseSavedScans, saveOne, type LocalBatchOptions, type SavedScan } from "../local-batch";
import { usePersistentState } from "../usePersistentState";
import { Button, Card } from "./ui";

const NONE: SavedScan[] = [];

/** The generic saved-cards list, live-updated by single saves, batch saves and other tabs. */
export function useSavedScans(storageKey: string) {
  const [list, , clear] = usePersistentState(storageKey, parseSavedScans, NONE);
  return [list, clear] as const;
}

/** "Save this card" under a result: one name field and a button. */
export function SaveScanForm({ options, scan, scannedAt }: { options: LocalBatchOptions; scan: SuccessfulScan; scannedAt: Date }) {
  const uid = useId();
  const [name, setName] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const save = useCallback(() => setState(saveOne(options, name, scan, scannedAt, new Date())), [options, name, scan, scannedAt]);
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-2xl border-2 border-slate-300 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div>
        <label htmlFor={`${uid}-name`} className="block text-lg font-bold">
          {options.inputLabel ?? "Name or ID"}
        </label>
        <input
          id={`${uid}-name`}
          value={name}
          maxLength={60}
          autoComplete="off"
          aria-invalid={state ? !state.ok : undefined}
          aria-describedby={`${uid}-msg`}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block min-h-14 w-72 rounded-xl border-2 border-slate-950 bg-white px-3 text-lg"
        />
      </div>
      <Button type="submit" variant="primary" icon="check">
        Save to {options.place ?? "Saved Cards"}
      </Button>
      <p id={`${uid}-msg`} role="status" aria-live="polite" className={`text-lg font-bold ${state && !state.ok ? "text-red-900" : "text-green-900"}`}>
        {state?.message ?? ""}
      </p>
    </form>
  );
}

/** The History & Export tab for the generic list: name, scan date, marks, and Clear. */
export function SavedScansSection({ options, summarize }: { options: LocalBatchOptions; summarize?: (e: SavedScan) => string }) {
  const [list, clear] = useSavedScans(options.storageKey);
  const [confirming, setConfirming] = useState(false);
  const place = options.place ?? "Saved Cards";
  return (
    <Card title={place}>
      {list.length === 0 ? (
        <p className="text-lg text-slate-800">Nothing saved yet. Scan a card on Scan &amp; Verify, or save a batch from Scan Any Card.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-lg">
              <caption className="sr-only">{place}, newest first</caption>
              <thead>
                <tr className="border-b-2 border-slate-950">
                  <th scope="col" className="px-2 py-2">Name</th>
                  <th scope="col" className="px-2 py-2">Scanned</th>
                  <th scope="col" className="px-2 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-b border-slate-300">
                    <th scope="row" className="px-2 py-2 font-bold">{e.name}</th>
                    <td className="px-2 py-2">{e.scannedAt.slice(0, 10)}</td>
                    <td className="px-2 py-2">{summarize ? summarize(e) : `${e.filled.length} filled${e.unclear.length ? `, ${e.unclear.length} unclear` : ""}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {confirming ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => {
                    clear();
                    setConfirming(false);
                  }}
                >
                  Yes, delete {list.length}
                </Button>
                <Button onClick={() => setConfirming(false)}>Cancel</Button>
              </>
            ) : (
              <Button icon="cross" onClick={() => setConfirming(true)}>
                Clear {place}
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
