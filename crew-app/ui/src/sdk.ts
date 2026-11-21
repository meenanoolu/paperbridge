/**
 * The only file that touches `@kirocrew/app-sdk`. If the SDK changes, only this file changes.
 */
import { useAppApi, useAppEvents, useAppInfo, useChatLauncher, useNavBadge, useNotify } from "@kirocrew/app-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SCAN_ALERT_TYPE,
  addAlert,
  alertFromNotification,
  checkInPrompt,
  loadAlerts,
  openCount,
  saveAlerts,
  storageKey,
  type AlertSource,
  type ScanAlert,
  type StoredAlert,
} from "./alerts";

export const AUDITOR_AGENT = "care-auditor";

export interface GatewayStatus {
  online: boolean | null;
  version?: string;
}

/** Alerts from every source, persisted in namespaced localStorage, with the sidebar badge kept in sync. */
export function useCareAlerts() {
  const info = useAppInfo();
  const api = useAppApi();
  const notify = useNotify();
  const setBadge = useNavBadge();
  const key = storageKey(info.name);
  const [alerts, setAlerts] = useState<StoredAlert[]>(() => loadAlerts(globalThis.localStorage, key));
  const [status, setStatus] = useState<GatewayStatus>({ online: null });
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const add = useCallback((alert: ScanAlert, source: AlertSource, announce = true) => {
    setAlerts((list) => {
      const isNew = !list.some((a) => a.cardId === alert.cardId && a.scannedAt === alert.scannedAt);
      if (isNew && announce && alert.severity === "high") {
        notifyRef.current(`PaperBridge: ${alert.alerts[0]?.title ?? "new care card alert"}`, { type: "error" });
      }
      return addAlert(list, alert, source, new Date());
    });
  }, []);

  // Persist and badge on every change.
  useEffect(() => {
    saveAlerts(globalThis.localStorage, key, alerts);
    setBadge(openCount(alerts));
  }, [alerts, key, setBadge]);

  // Live Crew notifications that carry a PaperBridge alert.
  useAppEvents("notification", (data) => {
    const a = alertFromNotification(data);
    if (a) add(a, "notification");
  });

  // A care-auditor run finished: point the caregiver at the chat.
  useAppEvents("task_complete", (data) => {
    if (JSON.stringify(data ?? "").includes(AUDITOR_AGENT)) notifyRef.current("care-auditor finished a check-in draft", { type: "success" });
  });

  // Same-window browser events, e.g. PaperBridge opened inside the Crew dashboard.
  useEffect(() => {
    const onAlert = (e: Event) => {
      const a = alertFromNotification((e as CustomEvent).detail);
      if (a) add(a, "browser-event");
    };
    window.addEventListener(SCAN_ALERT_TYPE, onAlert);
    return () => window.removeEventListener(SCAN_ALERT_TYPE, onAlert);
  }, [add]);

  // Backfill from stored notifications and read gateway status once.
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ notifications?: unknown[] }>("/api/notifications")
      .then((res) => {
        if (cancelled) return;
        for (const n of res?.notifications ?? []) {
          const a = alertFromNotification(n);
          if (a) add(a, "notification", false);
        }
      })
      .catch(() => undefined);
    api
      .get<{ version?: string }>("/api/status")
      .then((s) => !cancelled && setStatus({ online: true, version: s?.version }))
      .catch(() => !cancelled && setStatus({ online: false }));
    return () => {
      cancelled = true;
    };
  }, [api, add]);

  const markReviewed = useCallback((id: string, reviewed = true) => {
    setAlerts((list) => list.map((a) => (a.id === id ? { ...a, reviewed } : a)));
  }, []);
  const clear = useCallback(() => setAlerts([]), []);

  return useMemo(() => ({ alerts, add, markReviewed, clear, status, notify }), [alerts, add, markReviewed, clear, status, notify]);
}

/** Open a draft chat with care-auditor, seeded with the alert. The caregiver presses Send. */
export function useDraftCheckIn() {
  const { openChat } = useChatLauncher();
  return useCallback(
    (alert: ScanAlert) => openChat({ agent: AUDITOR_AGENT, message: checkInPrompt(alert), autoSend: false }),
    [openChat],
  );
}
