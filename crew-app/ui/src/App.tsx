import { Badge, Btn, Card, CardTitle, EmptyState, PageHeader, StatCard } from "@kirocrew/app-sdk/ui";
import { useState } from "react";
import { demoAlert, openCount, parseScanAlert, type StoredAlert } from "./alerts";
import { useCareAlerts, useDraftCheckIn } from "./sdk";

const DAY: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const day = (d: string) => DAY[d] ?? d;

const SEVERITY = {
  high: { variant: "err", label: "Needs attention" },
  medium: { variant: "warn", label: "Keep an eye on" },
  none: { variant: "ok", label: "All good" },
} as const;

const LEVEL = { high: "err", medium: "warn", info: "muted" } as const;

const SOURCE: Record<StoredAlert["source"], string> = {
  "browser-event": "PaperBridge scan",
  notification: "Crew notification",
  demo: "Demo alert",
  pasted: "Pasted JSON",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function AlertCard({ alert, onReview, onDraft }: { alert: StoredAlert; onReview: (reviewed: boolean) => void; onDraft: () => void }) {
  const sev = SEVERITY[alert.severity];
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          Weekly Care Card, scanned {when(alert.scannedAt)}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={sev.variant}>{sev.label}</Badge>
          {alert.manualOverrides ? (
            <Badge variant="aim" title="Unclear marks a person checked on the paper card">
              Manually verified ({alert.manualOverrides})
            </Badge>
          ) : null}
          {alert.reviewed && <Badge variant="muted">Reviewed</Badge>}
        </div>
      </div>

      <p className="text-sm">
        <strong>{alert.adherencePct === null ? "Adherence unknown" : `${alert.adherencePct}% of doses taken`}</strong>
        {alert.missed.length > 0 && <> · Missed: {alert.missed.map((m) => `${day(m.day)} ${m.slot.toLowerCase()}`).join(", ")}</>}
        {alert.symptomDays.length > 0 && <> · Dizzy or pain: {alert.symptomDays.map(day).join(", ")}</>}
      </p>

      {alert.alerts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" aria-label="Alerts">
          {alert.alerts.map((a) => (
            <li key={a.title} className="flex items-start gap-2 text-sm">
              <Badge variant={LEVEL[a.level]}>{a.level}</Badge>
              <span>
                <strong>{a.title}.</strong> <span className="text-muted">{a.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {alert.needsReview.length > 0 && (
        <p className="mt-3 text-sm">
          <strong>Check on the paper card:</strong> {alert.needsReview.join(", ")}. Unclear marks are never guessed.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn primary onClick={onDraft}>Draft Caregiver Check-In</Btn>
        <Btn onClick={() => onReview(!alert.reviewed)}>{alert.reviewed ? "Mark as open" : "Mark reviewed"}</Btn>
        <span className="text-muted text-[13px]">Source: {SOURCE[alert.source]}</span>
      </div>
    </Card>
  );
}

function PasteAlert({ onAdd }: { onAdd: (raw: string) => boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <Card>
      <CardTitle>Paste a PaperBridge alert</CardTitle>
      <p className="text-muted text-sm">
        In PaperBridge, scan a card and open "Show raw JSON output", or paste a <code>paperbridge:scan-alert</code> payload.
      </p>
      <label className="mt-2 block text-sm" htmlFor="pb-alert-json">Alert JSON</label>
      <textarea
        id="pb-alert-json"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError("");
        }}
        rows={5}
        className="mt-1 w-full rounded-md border border-border bg-card p-2 font-mono text-[13px]"
        spellCheck={false}
      />
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger-text">
          {error}
        </p>
      )}
      <div className="mt-2">
        <Btn
          onClick={() => {
            if (onAdd(text)) setText("");
            else setError("That is not a PaperBridge scan alert (type \"paperbridge:scan-alert\").");
          }}
        >
          Add alert
        </Btn>
      </div>
    </Card>
  );
}

/** Kiro Crew page: PaperBridge care card alerts for caregivers. Default export is what the host mounts. */
export default function PaperBridgeCareMonitor() {
  const { alerts, add, markReviewed, clear, status } = useCareAlerts();
  const draft = useDraftCheckIn();
  const [pasting, setPasting] = useState(false);
  const latest = alerts[0];
  const open = openCount(alerts);

  return (
    <>
      <PageHeader
        title="PaperBridge Care"
        subtitle="Alerts from paper Weekly Care Cards, decoded without AI. Draft the caregiver check-in in one click."
        actions={
          <div className="flex flex-wrap gap-2">
            <Btn primary onClick={() => add(demoAlert(new Date()), "demo")}>Load demo alert</Btn>
            <Btn onClick={() => setPasting((p) => !p)} aria-expanded={pasting}>
              {pasting ? "Hide paste box" : "Paste alert JSON"}
            </Btn>
            {alerts.length > 0 && (
              <Btn danger onClick={clear}>
                Clear all
              </Btn>
            )}
          </div>
        }
      />
      <div className="px-6 pb-8 overflow-y-auto flex-1 min-h-0">
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-6">
          <StatCard label="Latest adherence" value={latest ? (latest.adherencePct === null ? "-" : `${latest.adherencePct}%`) : "-"} accent />
          <StatCard label="Open alerts" value={open} />
          <StatCard label="Missed doses (latest)" value={latest ? latest.missed.length : "-"} />
          <StatCard label="Symptom days (latest)" value={latest ? latest.symptomDays.length : "-"} />
          <StatCard label="Crew gateway" value={status.online === null ? "..." : status.online ? `Online${status.version ? ` ${status.version}` : ""}` : "Offline"} />
        </div>

        <div className="flex flex-col gap-4" aria-live="polite">
          {pasting && (
            <PasteAlert
              onAdd={(raw) => {
                const a = parseScanAlert(raw.trim());
                if (a) add(a, "pasted");
                return a !== null;
              }}
            />
          )}
          {alerts.length === 0 ? (
            <Card>
              <EmptyState
                icon={<span aria-hidden>♡</span>}
                title="No care card alerts yet"
                subtitle="Scan a PaperBridge Weekly Care Card, or load the demo alert to see how it works."
                action={
                  <Btn primary onClick={() => add(demoAlert(new Date()), "demo")}>
                    Load demo alert
                  </Btn>
                }
              />
            </Card>
          ) : (
            alerts.map((a) => <AlertCard key={a.id} alert={a} onReview={(r) => markReviewed(a.id, r)} onDraft={() => draft(a)} />)
          )}
        </div>

        <p className="mt-6 text-muted text-[13px]">
          Alerts hold aggregate data only (adherence, missed slots, symptom days). No card images or personal details are stored.
        </p>
      </div>
    </>
  );
}
