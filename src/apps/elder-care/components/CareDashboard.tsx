import type { ReactNode } from "react";
import { Icon, type IconName } from "../../../shell/components/Icon";
import { Callout, Card, StatusBadge, type Tone } from "../../../shell/components/ui";
import { CopyButton } from "../../../shell/components/CopyButton";
import { columnLabel, DEFAULT_CARE_SETTINGS, formatDay, weekDates, weekRange, type CareCardSettings } from "../card-settings";
import type { CareReport, Mark, ScanAlert } from "../interpret";
import { ADHERENCE_TARGET_PCT, LOW_ENERGY_MAX } from "../interpret";
import { DAY_NAMES, DAYS } from "../layout";

function AdherenceRing({ pct }: { pct: number | null }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const value = pct ?? 0;
  const good = pct !== null && pct >= ADHERENCE_TARGET_PCT;
  return (
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={good ? "#166534" : "#991b1b"}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-5xl font-black">{pct === null ? "-" : `${pct}%`}</p>
          <p className="text-lg font-bold">doses taken</p>
        </div>
      </div>
    </div>
  );
}

const MARK: Record<Mark, { icon: IconName; text: string; cls: string }> = {
  yes: { icon: "check", text: "Yes", cls: "text-green-900" },
  no: { icon: "cross", text: "No", cls: "text-red-900" },
  review: { icon: "question", text: "Check", cls: "text-amber-900" },
};

function MarkCell({ mark, bad }: { mark: Mark; bad: "yes" | "no" }) {
  const m = MARK[mark];
  const isBad = mark === bad;
  return (
    <td className={`px-2 py-2 ${isBad ? "bg-red-50" : mark === "review" ? "bg-amber-50" : ""}`}>
      <span className={`inline-flex items-center gap-1.5 font-bold ${isBad ? "text-red-900" : m.cls}`}>
        <Icon name={m.icon} className="h-6 w-6" />
        {m.text}
      </span>
    </td>
  );
}

function EnergyBar({ value, review }: { value: number | null; review: boolean }) {
  if (review)
    return (
      <span className="inline-flex items-center gap-1.5 font-bold text-amber-900">
        <Icon name="question" className="h-6 w-6" /> Check
      </span>
    );
  if (value === null) return <span className="text-slate-700">Not marked</span>;
  const low = value <= LOW_ENERGY_MAX;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-5 w-3 rounded-sm ${i <= value ? (low ? "bg-red-800" : "bg-slate-950") : "bg-slate-200"}`} />
        ))}
      </span>
      <span className={`font-bold ${low ? "text-red-900" : ""}`}>
        {value} of 5{low ? " (low)" : ""}
      </span>
    </span>
  );
}

const ALERT_TONE: Record<string, Tone> = { high: "bad", medium: "warn", info: "info" };

export function CareDashboard({
  report,
  scannedAt,
  alert,
  card = DEFAULT_CARE_SETTINGS,
  actions,
}: {
  report: CareReport;
  scannedAt: Date;
  alert: ScanAlert;
  /** Saved card customization: patient, week and the printed column labels. */
  card?: CareCardSettings;
  /** Extra controls under the summary, e.g. Save Week to History. */
  actions?: ReactNode;
}) {
  const dates = weekDates(card.weekStart);
  const good = report.adherencePct !== null && report.adherencePct >= ADHERENCE_TARGET_PCT;
  return (
    <div className="space-y-6">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-3">
            Caregiver Adherence Dashboard
            <span className="text-lg font-semibold text-slate-700">
              Scanned {scannedAt.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
            </span>
          </span>
        }
      >
        {(card.patientName || dates.length > 0) && (
          <p className="mb-4 text-xl font-bold">
            {card.patientName && <span>{card.patientName}</span>}
            {card.patientName && dates.length > 0 && <span aria-hidden> · </span>}
            {dates.length > 0 && <span>Week of {weekRange(dates[0], dates[6])}</span>}
          </p>
        )}
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <AdherenceRing pct={report.adherencePct} />
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-slate-300 p-4">
              <p className="flex items-center gap-2 text-lg font-bold">
                <Icon name="pill" /> Medication
              </p>
              <p className="text-3xl font-black">
                {report.taken} of {report.counted}
              </p>
              <p className="mt-1">
                <StatusBadge tone={good ? "good" : "bad"}>{good ? "On track" : `Below ${ADHERENCE_TARGET_PCT}% goal`}</StatusBadge>
              </p>
            </div>
            <div className="rounded-xl border-2 border-slate-300 p-4">
              <p className="flex items-center gap-2 text-lg font-bold">
                <Icon name="alert" /> Dizzy or pain
              </p>
              <p className="text-3xl font-black">
                {report.symptomDays.length} day{report.symptomDays.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1">
                <StatusBadge tone={report.symptomDays.length === 0 ? "good" : report.symptomDays.length >= 2 ? "bad" : "warn"}>
                  {report.symptomDays.length === 0 ? "None reported" : report.symptomDays.join(", ")}
                </StatusBadge>
              </p>
            </div>
            <div className="rounded-xl border-2 border-slate-300 p-4">
              <p className="flex items-center gap-2 text-lg font-bold">
                <Icon name="drop" /> Water 6+ cups
              </p>
              <p className="text-3xl font-black">{report.hydrationDays} of 7 days</p>
            </div>
            <div className="rounded-xl border-2 border-slate-300 p-4">
              <p className="flex items-center gap-2 text-lg font-bold">
                <Icon name="question" /> Needs a human check
              </p>
              <p className="text-3xl font-black">{report.needsReview.length}</p>
              <p className="mt-1 text-lg">Unclear marks are never guessed.</p>
            </div>
          </div>
        </div>
        {actions && <div className="mt-5 border-t-2 border-slate-200 pt-4">{actions}</div>}
      </Card>

      <Card title="Alerts for the caregiver">
        {report.alerts.length === 0 ? (
          <Callout tone="good" title="All good this week">
            Every dose was taken and nothing needs attention.
          </Callout>
        ) : (
          <ul className="space-y-3">
            {report.alerts.map((a) => (
              <li key={a.title}>
                <Callout tone={ALERT_TONE[a.level]} title={a.title}>
                  {a.detail}
                </Callout>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 border-t-2 border-slate-200 pt-4">
          <h4 className="text-xl font-extrabold">Send to Kiro Crew</h4>
          <p className="mb-3 text-lg text-slate-800">
            Copies this week's alert{alert.manualOverrides ? `, including ${alert.manualOverrides} manually verified ${alert.manualOverrides === 1 ? "mark" : "marks"}` : ""}. In Kiro Crew,
            open <strong>PaperBridge Care</strong> and choose <strong>Paste alert JSON</strong>. Summary data only: no photo, no names.
          </p>
          <CopyButton
            text={JSON.stringify(alert, null, 2)}
            label="Copy for Kiro Crew"
            copiedMessage="Copied — paste into PaperBridge Care in Kiro Crew"
          />
        </div>
      </Card>

      <Card title="Day by day">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-lg">
            <thead>
              <tr className="border-b-2 border-slate-950">
                <th scope="col" className="px-2 py-2">Day</th>
                <th scope="col" className="px-2 py-2">{columnLabel(card, "am")}</th>
                <th scope="col" className="px-2 py-2">{columnLabel(card, "pm")}</th>
                <th scope="col" className="px-2 py-2">{columnLabel(card, "water")}</th>
                <th scope="col" className="px-2 py-2">{columnLabel(card, "dizzy")}</th>
                <th scope="col" className="px-2 py-2">Energy</th>
              </tr>
            </thead>
            <tbody>
              {report.days.map((d) => (
                <tr key={d.day} className="border-b border-slate-300">
                  <th scope="row" className="px-2 py-2 font-bold">
                    {DAY_NAMES[d.day]}
                    {dates.length > 0 && <span className="block text-lg font-normal text-slate-800">{formatDay(dates[DAYS.indexOf(d.day)])}</span>}
                  </th>
                  <MarkCell mark={d.morning} bad="no" />
                  <MarkCell mark={d.night} bad="no" />
                  <MarkCell mark={d.water} bad="no" />
                  <MarkCell mark={d.dizzy} bad="yes" />
                  <td className="px-2 py-2">
                    <EnergyBar value={d.energy} review={d.energyReview} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
