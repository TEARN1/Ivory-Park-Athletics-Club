# Ivory Park Athletics Club

Offline-first session timer, live relay and route planner for the club. Works without data and without personal phones.

## What it does
- **Check-in:** name/bib, buddy pairing for runners without phones, edit/remove runners.
- **Timer:** one Start for the field, tap-to-finish.
- **Results:** ordinal rank, time, pace/km, gap, group median pace, fix a time, CSV download, past sessions.
- **Live:** join a room; the lead taps **Pass Over**, another runner taps **Take**; the new lead's GPS becomes the beacon.
  Optional GPS tracking gives per-km splits (GPS points stay on the device).
- **Routes:** up to 15 loops for a target distance from the club hub, **Reroute** (optionally away from a blocked direction), named saved routes.
- **Club:** server address/token, notices, consented guest list.
- **Offline:** works as an installable PWA; data is in IndexedDB and uploads when online.

## Run it
```
npm install
npm run dev                              # client
COACH_TOKEN=choose-a-long-secret npm run server   # server on :8787 (data in data/db.json)
npm run verify                           # unit tests + type-check + build
npm run build && npx vite preview --port 4173 && node scripts/smoke.cjs <dir>   # browser test (needs the server running with COACH_TOKEN=secret)
```
In the app: Club tab → enter the server address and (coaches only) the token.

Server environment: `COACH_TOKEN` (required for sync, guest list, notices and for opening rooms), `PORT`, `DATA_FILE`, `ALLOWED_ORIGIN`.
Browsers only allow GPS and install on HTTPS, so host the client and server behind HTTPS (a `wss://` address is used automatically).

## Known limits (be honest with athletes and coaches)
- Route loops are straight-line guides from the hub, **not snapped to roads** or checked for safety. No OpenStreetMap tiles or road routing yet.
- Runner identity in a live room is chosen by the runner (practice, not secure). Only coaches (token) can open rooms.
- Notices show inside the app (refreshed every minute, or instantly while in a live room). No SMS or phone push messages.
- GPS needs the screen/app kept open on most phones. Median pace per individual is shown per km split, not yet on the dashboard.
- The coach token is stored on the coach's device. There are no user accounts.

Plan: [docs/architecture.md](docs/architecture.md)
