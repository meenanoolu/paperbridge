# PaperBridge Care Monitor (Kiro Crew App)

A caregiver inbox inside [Kiro Crew](https://kiro.dev/docs/crew/) for alerts from
[PaperBridge](https://github.com/meenanoolu/paperbridge) Weekly Care Cards. An older adult
fills in the paper card with a pen. PaperBridge decodes the photo on the caregiver's device with
deterministic computer vision (no AI reads the card). This app collects the resulting alerts
and drafts the caregiver's check-in with the `care-auditor` agent.

- **PaperBridge (the scanner, both apps, and the optical core):** https://github.com/meenanoolu/paperbridge
- **Live PaperBridge demo:** https://paperbridge-acvw.onrender.com/
- **This app's repo:** https://github.com/meenanoolu/paperbridge-care-monitor (the same files as [`crew-app/`](https://github.com/meenanoolu/paperbridge/tree/main/crew-app) in PaperBridge)

PaperBridge Care Monitor helps with tracking and conversation only. It is not medical advice.

## What's in the package

| Path | What it is |
|---|---|
| `app.json` | Manifest: identity, agent, skill, UI page, permissions, Cmd+K command |
| `agents/care-auditor.json` | Agent that reads an alert and drafts a plain-language check-in |
| `skills/adherence-analysis/SKILL.md` | Alert format, PaperBridge thresholds and patterns, and when to suggest calling a clinician |
| `ui/src/App.tsx` | Dashboard page (default export, mounted by the Crew host) |
| `ui/src/sdk.ts` | The only file that uses `@kirocrew/app-sdk` |
| `ui/src/alerts.ts` | Pure alert parsing, dedupe, storage, and prompt logic |
| `ui/dist/index.mjs` | Built page bundle, **committed** because Crew installs apps without `node_modules` |
| `icon.png`, `ui/icon.svg` | App Store icon (256x256) and sidebar icon |

## Install

With the Crew gateway running, install from a local clone. `source` is the folder that holds
`app.json`: the root of this repo, or `crew-app/` inside a PaperBridge clone.

```bash
git clone https://github.com/meenanoolu/paperbridge-care-monitor.git
cd paperbridge-care-monitor
curl -X POST http://localhost:5476/api/apps/install \
  -H 'Content-Type: application/json' \
  -d "{\"source\": \"$(pwd)\"}"
curl -X POST http://localhost:5476/api/apps/paperbridge-care-monitor/enable
```

Or use **App Store → Install from local path** and pick the folder.

## Try it in 10 seconds

1. Open **PaperBridge Care** in the Crew sidebar.
2. Click **Load demo alert**. It is the PaperBridge "Missed-Dose Alert" sample card: 71% adherence, Thursday fully missed, dizzy 2 days, one unclear mark, and a card printed in Telugu (`cardLanguage: "te-IN"`, shown as a **Card: Telugu** badge).
3. The sidebar badge shows 1 open alert.
4. Click **Draft Caregiver Check-In**. A chat with `care-auditor` opens with the alert as a draft. You review it and press Send. Because the alert has patterns and a card language, the agent answers with a **Clinical Note (English)** and a **Gentle Check-In Opener** in Telugu.
5. Or press **Cmd+K** and run **Audit latest PaperBridge care card**.

## How alerts get here

PaperBridge runs in the browser, usually on a different site from your Crew dashboard, and it
never uploads anything. So the normal path is a copy and paste:

1. In PaperBridge's **Elder Care Bridge**, scan a card (or click a sample card).
2. Click **Copy for Kiro Crew**. This copies the alert JSON.
3. In **PaperBridge Care**, click **Paste alert JSON**, paste it, and click **Add alert**.

Or click **Load demo alert** to try the app without PaperBridge.

The app also accepts alerts from two other sources:

| Source | How |
|---|---|
| Crew notifications | Live `notification` events, plus a backfill from `/api/notifications` on open. The alert can be an object field (`data`, `alert`, `payload`, `detail`) or `paperbridge:scan-alert` JSON inside the title or body. PaperBridge does not post these itself; a Crew automation or channel can. |
| Same-window browser event | A `window` `paperbridge:scan-alert` CustomEvent, which Elder Care Bridge dispatches after every scan. It only arrives when both run in the same page. |

Every alert is validated (`parseScanAlert`) before it is stored. Alerts are deduplicated by
card ID and scan time, kept newest first (50 max), and saved in `localStorage` under
`kirocrew.app.paperbridge-care-monitor.alerts.v1`. Alerts contain aggregate data only:
adherence, missed slots, symptom days, unclear-mark labels, a count of marks checked by hand,
any patterns PaperBridge's fixed rules found, and the card's language (`cardLanguage`, a BCP 47 tag such as `te-IN`) for translated cards. There are no card images and no names.

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
cd ui
npm install      # dev tools only; React and the SDK come from the Crew host
npm run build    # tsc --noEmit && vite build -> dist/index.mjs
```

Then commit `ui/dist/index.mjs`.

The tests in `ui/test/` run inside PaperBridge, which provides Vitest, React and the
recording SDK double (`ui/test/mock-sdk.ts`). From a
[PaperBridge](https://github.com/meenanoolu/paperbridge) clone, run `npm test`. The tests cover
the alert logic and render the built bundle against the SDK double. PaperBridge's
`src/apps/elder-care/__tests__/crew-contract.test.ts` also checks that every Elder Care sample
alert passes this app's parser unchanged.

### Notes on the manifest

- `ui.entry` and `iconUrl` are relative to `ui/`, so the entry is `dist/index.mjs`, not `ui/dist/index.mjs`.
- A Lucide `icon` name only renders for built-in apps, so the page also ships `iconUrl`.
- The bundle file name is pinned to `index.mjs` in `vite.config.ts`, because Vite emits `.js` for `"type": "module"` packages.
- `repo` is `paperbridge-care-monitor`, the standalone repository, which Crew's blob proxy uses to serve images.
