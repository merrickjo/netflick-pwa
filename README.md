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
## My game (self-scout → Obsidian)

Tap **Me** in the bottom bar. Set "I'm playing as" once; after each of your rounds a quick log opens.
Per game (~20 taps, only Result + Unforced errors required): result/margin · errors few/many + source shot (≤2) + main cause ·
serve faults, flick serves tried/landed · return quality, flicks out of reach · who had the attack · positional mix-ups · legs.
Game type (Carry/Intensity/Light) comes from the round log automatically. No timing is used — the phone isn't reliably at hand to start/stop rounds.
Per night: energy coming in · did you hit last session's focus · session intensity (Easy → Max, qualitative) · what worked.
Focus suggestions are ranked from where points leaked (need a pattern: ≥2 games and ≥30% of games), each with its reason.
"Open in Obsidian" writes `Badminton/Netflick/YYYY-MM-DD Netflick.md` (properties in frontmatter for Dataview/Bases); re-sending overwrites.
Why these inputs: bad shots decide ~65% of rally turning points and bad lifts cost most (Hammes & Link 2025); doubles rallies average ~7 shots,
so serve/return matter most; self-recall is decent for rare events but undercounts errors (IJRSS tennis study), so errors are categories, not counts;
self-monitoring against a plan is the habit that separates skill levels (Toering et al.); a whole-session effort rating is a validated monitoring tool (Haddad 2017).
Local-only: nothing here is sent to the Worker/D1.
