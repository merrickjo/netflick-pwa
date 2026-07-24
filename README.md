# Netflick PWA

Private, offline-capable badminton session controller. Notion owns player identity; this phone owns tonight's courts and fairness counts.

## Included

- P0 shell, service worker, recoverable local session state
- Dedicated Cloudflare Worker with paginated Players API
- Session setup, player search/create/edit
- Manual per-player +/− ledger, bench/return, live court count
- Legal MD/WD/XD recommendation engine with fairness-first scoring
- `Played · +1 all` plus undo
- Responsive light/dark UI and demo roster

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
npm test
npm run check
```

Choose **Use demo players** to exercise the full organizer loop without a Worker.

## Worker setup

1. Replace `PLAYERS_DATA_SOURCE_ID` in `worker/wrangler.toml` with the Players data source UUID.
2. Create a dedicated Notion integration and grant it access only to Netflick Badminton / Players.
3. From `worker/` run:

```bash
wrangler secret put NOTION_TOKEN
wrangler secret put APP_KEY
wrangler deploy
```

4. Open the PWA and enter the Worker URL + APP_KEY.

Never commit either secret. Code deploys do not require resetting secrets.

## Deploy app

Create a `netflick-pwa` GitHub repository, push these files, enable GitHub Pages from `main` root. For every shell change bump `CACHE_NAME` in `sw.js`; close and reopen the installed PWA twice. Do not reinstall for routine updates.

## Boundary

This code never reads or writes the Sessions or Matches data sources. Registration/payment is intentionally absent from v1.