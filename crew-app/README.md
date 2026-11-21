# PaperBridge Care Monitor (Kiro Crew App)

A caregiver inbox inside [Kiro Crew](https://kiro.dev/docs/crew/) for alerts from PaperBridge
Weekly Care Cards. An older adult fills in the paper card with a pen. PaperBridge decodes it
with deterministic computer vision. This app collects the resulting alerts and drafts the
caregiver's check-in with the `care-auditor` agent.

## What's in the package

| Path | What it is |
|---|---|
| `app.json` | Manifest: identity, agent, skill, UI page, permissions, Cmd+K command |
| `agents/care-auditor.json` | Agent that reads an alert and drafts a plain-language check-in |
| `skills/adherence-analysis/SKILL.md` | Alert format, PaperBridge thresholds, and when to suggest calling a clinician |
| `ui/src/App.tsx` | Dashboard page (default export, mounted by the Crew host) |
| `ui/src/sdk.ts` | The only file that uses `@kirocrew/app-sdk` |
| `ui/src/alerts.ts` | Pure alert parsing, dedupe, storage, and prompt logic |
| `ui/dist/index.mjs` | Built page bundle, **committed** because Crew installs apps without `node_modules` |
| `icon.png`, `ui/icon.svg` | App Store icon (256x256) and sidebar icon |

## Install

```bash
# From a clone of this repo, with the Crew gateway running
curl -X POST http://localhost:5476/api/apps/install \
  -H 'Content-Type: application/json' \
  -d '{"source": "./crew-app"}'
curl -X POST http://localhost:5476/api/apps/paperbridge-care-monitor/enable
```

Or use **App Store → Install from local path** and pick the `crew-app/` folder.

## Try it in 10 seconds

1. Open **PaperBridge Care** in the Crew sidebar.
2. Click **Load demo alert**. It is the PaperBridge "Missed-Dose Alert" sample card: 71% adherence, Thursday fully missed, dizzy 2 days, one unclear mark.
3. The sidebar badge shows 1 open alert.
4. Click **Draft Caregiver Check-In**. A chat with `care-auditor` opens with the alert as a draft. You review it and press Send.
5. Or press **Cmd+K** and run **Audit latest PaperBridge care card**.

## How alerts arrive

| Source | How |
|---|---|
| Crew notifications | Live `notification` events, plus a backfill from `/api/notifications` on open. An alert can be an object field (`data`, `alert`, `payload`, `detail`) or `paperbridge:scan-alert` JSON inside the title or body. |
| Same-window browser event | `window` `paperbridge:scan-alert` CustomEvent, as Elder Care Bridge dispatches after every scan. |
| Paste | **Paste alert JSON**: copy the alert from PaperBridge and paste it here. |
| Demo | **Load demo alert**. |

Every alert is validated (`parseScanAlert`) before it is stored. Alerts are deduplicated by
card ID and scan time, kept newest first (50 max), and saved in `localStorage` under
`kirocrew.app.paperbridge-care-monitor.alerts.v1`. Alerts contain aggregate data only:
adherence, missed slots, symptom days, and unclear-mark labels. There are no card images
and no names.

## Permissions

| Permission | Why |
|---|---|
| `api: /api/status` | Show whether the Crew gateway is online |
| `api: /api/notifications` | Backfill PaperBridge alerts already in the notification log |
| `events: notification` | Receive new PaperBridge alerts live |
| `events: task_complete` | Tell the caregiver when `care-auditor` finishes |
| `storage: true` | Keep the alert inbox |
| `network: false` | The app never calls outside the gateway |

## Develop

```bash
cd crew-app/ui
npm install      # dev tools only; React and the SDK come from the Crew host
npm run build    # tsc --noEmit && vite build -> dist/index.mjs
```

Then commit `ui/dist/index.mjs`. Tests run from the repo root (`npm test`). They cover the
alert logic, render the built bundle against a recording SDK double, and check that every
PaperBridge sample alert passes the Crew parser unchanged.

### Notes on the manifest

- `ui.entry` and `iconUrl` are relative to `ui/`, so the entry is `dist/index.mjs`, not `ui/dist/index.mjs`.
- A Lucide `icon` name only renders for built-in apps, so the page also ships `iconUrl`.
- The bundle file name is pinned to `index.mjs` in `vite.config.ts`, because Vite emits `.js` for `"type": "module"` packages.
