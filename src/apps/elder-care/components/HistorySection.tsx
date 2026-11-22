import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "../../../shell/components/CopyButton";
import { Icon } from "../../../shell/components/Icon";
import { Button, Card, StatusBadge } from "../../../shell/components/ui";
import { formatDoctorSummary, patientsIn, trend, weekLabel, weeksFor, type WeekEntry } from "../history";
import { ADHERENCE_TARGET_PCT } from "../interpret";

/** Decorative sparkline; the table below carries the same numbers for screen readers. */
function Sparkline({ values }: { values: (number | null)[] }) {
  const W = 360;
  const H = 140;
  const pad = 10;
  const n = values.length;
  const x = (i: number) => (n === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => H - pad - (v / 100) * (H - 2 * pad);
  const pts = values.map((v, i) => (v === null ? null : ([x(i), y(v)] as const)));
  const path = pts.reduce((d, p, i) => (p ? `${d}${d && pts[i - 1] ? " L" : " M"}${p[0].toFixed(1)},${p[1].toFixed(1)}` : d), "");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full max-w-md rounded-lg border-2 border-slate-200 bg-slate-50" aria-hidden="true">
      <line x1={pad} x2={W - pad} y1={y(ADHERENCE_TARGET_PCT)} y2={y(ADHERENCE_TARGET_PCT)} stroke="#475569" strokeDasharray="4 4" strokeWidth={1.5} />
      <path d={path} fill="none" stroke="#0f172a" strokeWidth={3} strokeLinejoin="round" />
      {pts.map((p, i) =>
        p ? (
          <circle key={i} cx={p[0]} cy={p[1]} r={5} fill={(values[i] as number) >= ADHERENCE_TARGET_PCT ? "#166534" : "#991b1b"} stroke="#fff" strokeWidth={2} />
        ) : null,
      )}
    </svg>
  );
}

function Delta({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return <span className="text-slate-800">{delta === 0 ? "no change" : ""}</span>;
  const up = delta > 0;
  return (
    <span className={`font-bold ${up ? "text-green-900" : "text-red-900"}`}>
      <svg viewBox="0 0 10 10" className="mr-1 inline h-3.5 w-3.5 align-baseline" aria-hidden="true">
        <path d={up ? "M5 1 L9.5 9 L0.5 9 Z" : "M5 9 L9.5 1 L0.5 1 Z"} fill="currentColor" />
      </svg>
      {up ? "up" : "down"} {Math.abs(delta)} pts
    </span>
  );
}

/** Multi-Week Adherence Trend with patient filter, Doctor Visit Summary, and Clear History. */
export function HistorySection({
  history,
  currentPatient,
  onClear,
  now = () => new Date(),
}: {
  history: WeekEntry[];
  currentPatient: string;
  onClear: () => void;
  now?: () => Date;
}) {
  const patients = useMemo(() => patientsIn(history), [history]);
  const [patient, setPatient] = useState(currentPatient);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setPatient(currentPatient), [currentPatient]);
  // If the selected patient has no weeks (e.g. renamed), fall back to one that does.
  const selected = weeksFor(history, patient).length || !patients.length ? patient : patients[patients.length - 1];
  const weeks = useMemo(() => weeksFor(history, selected), [history, selected]);
  const points = useMemo(() => trend(weeks), [weeks]);
  const summary = useMemo(() => formatDoctorSummary(weeks, { patientName: selected, generatedAt: now() }), [weeks, selected, now]);

  return (
    <section aria-labelledby="history-title" className="mt-10">
      <Card
        title={
          <span id="history-title" className="flex items-center gap-2">
            <Icon name="calendar" className="h-7 w-7" /> Multi-Week Adherence Trend
          </span>
        }
      >
        {history.length === 0 ? (
          <p className="text-lg text-slate-800">
            No saved weeks yet. After a scan, press <strong>Save Week to History</strong> on the dashboard to start a trend for doctor visits.
          </p>
        ) : (
          <div className="space-y-5">
            {patients.length > 1 && (
              <div>
                <label htmlFor="history-patient" className="block text-lg font-bold">
                  Patient
                </label>
                <select
                  id="history-patient"
                  value={selected}
                  onChange={(e) => setPatient(e.target.value)}
                  className="mt-1 min-h-14 rounded-xl border-2 border-slate-950 bg-white px-3 text-lg"
                >
                  {patients.map((p) => (
                    <option key={p} value={p}>
                      {p || "Unnamed patient"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-6">
              <Sparkline values={weeks.map((w) => w.adherencePct)} />
              <p className="text-lg text-slate-800">
                {weeks.length} {weeks.length === 1 ? "week" : "weeks"} for <strong>{selected || "unnamed patient"}</strong>. Dashed line: {ADHERENCE_TARGET_PCT}% goal.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-lg">
                <caption className="sr-only">Weekly adherence for {selected || "unnamed patient"}, oldest first</caption>
                <thead>
                  <tr className="border-b-2 border-slate-950">
                    <th scope="col" className="px-2 py-2">Week</th>
                    <th scope="col" className="px-2 py-2">Adherence</th>
                    <th scope="col" className="px-2 py-2">Change</th>
                    <th scope="col" className="px-2 py-2">Missed doses</th>
                    <th scope="col" className="px-2 py-2">Dizzy / pain days</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map(({ entry: w, delta }) => (
                    <tr key={w.id} className="border-b border-slate-300">
                      <th scope="row" className="px-2 py-2 font-bold">
                        {weekLabel(w)}
                        {w.manualOverrides > 0 && (
                          <span className="ml-2 align-middle">
                            <StatusBadge tone="info">Manually verified ({w.manualOverrides})</StatusBadge>
                          </span>
                        )}
                      </th>
                      <td className="px-2 py-2">
                        {w.adherencePct === null ? (
                          "Unknown"
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className="h-3 w-24 rounded-full bg-slate-200" aria-hidden>
                              <span
                                className={`block h-3 rounded-full ${w.adherencePct >= ADHERENCE_TARGET_PCT ? "bg-green-800" : "bg-red-800"}`}
                                style={{ width: `${w.adherencePct}%` }}
                              />
                            </span>
                            <strong>{w.adherencePct}%</strong>
                            {w.adherencePct < ADHERENCE_TARGET_PCT && <span className="text-red-900">(below goal)</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Delta delta={delta} />
                      </td>
                      <td className="px-2 py-2">{w.missed.length}</td>
                      <td className="px-2 py-2">{w.symptomDays.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t-2 border-slate-200 pt-4">
              <h4 className="text-xl font-extrabold">Doctor visit</h4>
              <p className="mb-3 text-lg text-slate-800">
                Copies a plain-text summary of these {weeks.length} {weeks.length === 1 ? "week" : "weeks"} (it pastes cleanly into email, a patient portal, or notes).
              </p>
              <CopyButton text={summary} label="Copy Doctor Visit Summary" copiedMessage="Copied. Paste it into your message to the doctor." />
              <details className="mt-3">
                <summary className="cursor-pointer text-lg font-bold underline underline-offset-4">Preview summary</summary>
                <pre tabIndex={0} aria-label="Doctor visit summary text" className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border-2 border-slate-300 bg-slate-50 p-3 text-lg">
                  {summary}
                </pre>
              </details>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t-2 border-slate-200 pt-4">
              {confirming ? (
                <>
                  <span className="text-lg font-bold text-red-900" role="alert">
                    Delete all {history.length} saved {history.length === 1 ? "week" : "weeks"} from this browser?
                  </span>
                  <Button
                    variant="primary"
                    onClick={() => {
                      onClear();
                      setConfirming(false);
                    }}
                  >
                    Yes, clear history
                  </Button>
                  <Button onClick={() => setConfirming(false)}>Cancel</Button>
                </>
              ) : (
                <Button onClick={() => setConfirming(true)}>Clear History</Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
