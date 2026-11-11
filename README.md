# Ivory Park Athletics Club

Offline-first session timer, live relay and route planner for the club. Works without data and without personal phones.

## What it does
- **Today (runners):** join today's run by link, QR or from the list; say "I'm coming" to time trials and long runs.
- **Session (coach):** race, laps or interval reps with rest; pace groups; check in club runners (under-18s need guardian consent);
  countdown, big finish tiles or bib keypad with undo; voice and beeps you can turn down; safety alerts with emergency contacts;
  results, share-as-image (first name + initial only), CSV, next session with the same runners.
- **Runners:** profiles with personal bests, progress chart, age group, age-adjusted times (club estimate, not WMA tables),
  attendance, week streaks and badges, training plan, coach notes; club league and records.
- **Map:** street map (MapLibre + OpenFreeMap tiles, CARTO fallback, offline drawing when there is no signal; the same approach as The Gruvs' LiveMap and The Resident's VibeMap), live map of every runner sharing GPS (flags stopped or silent runners), Pass Over / Take relay, shared timing for
  several timekeepers (earliest time wins, disagreements shown); route planner with loops, Reroute, Follow roads (OpenStreetMap)
  and a "checked and safe" tick.
- **Club:** day/night and colour themes, distance shortcuts, sound settings, events, news with photos, sponsors,
  a public club page at `<server>/club`, backup and restore (combine data from two phones).

## Run it
```
npm install
npm run dev                              # client
COACH_TOKEN=choose-a-long-secret npm run server   # server on :8787 (data in data/db.json)
npm run verify                           # unit tests + type-check + build
npm run build && npx vite preview --port 4173   # then, with the server running with COACH_TOKEN=secret:
node scripts/smoke.cjs <dir>                  # full flow: relay, joining, shared timing, events, club page, backup
node scripts/session-modes-smoke.cjs <dir>    # countdown, laps, intervals, results image
node scripts/runners-smoke.cjs <dir>          # club runners, consent, league
```
In the app: Club tab → enter the server address and (coaches only) the token.

Server environment: `COACH_TOKEN` (required for sync, guest list, notices and for opening rooms), `PORT`, `DATA_FILE`, `ALLOWED_ORIGIN`.
Browsers only allow GPS and install on HTTPS, so host the client and server behind HTTPS (a `wss://` address is used automatically).

## GPS accuracy (read this before promising anything)
Phone GPS is accurate to a few metres (about 3–5 m in the open, worse between buildings), never centimetres.
The app drops fixes worse than 25 m, smooths the rest with a Kalman filter weighted by each fix's own accuracy,
can measure along a planned route (sideways wobble does not add distance), and learns a per-phone correction on a
measured distance. For exact distances use Laps on a measured track (times shown to 0.1 s; hand taps are good to ~0.2 s).
Centimetre accuracy needs RTK GNSS hardware with correction data (for example from TrigNet); that is not built.

## Known limits (be honest with athletes and coaches)
- No permanent database (by choice): the coach's phone holds the club's data; the free server forgets on restart and the app republishes. Use Backup.
- Follow roads needs the routing service to be reachable (default routing.openstreetmap.de). Walk every route before using it.
- Route loops are straight-line guides from the hub, **not snapped to roads** or checked for safety. No OpenStreetMap tiles or road routing yet.
- Runner identity in a live room is chosen by the runner (practice, not secure). Only coaches (token) can open rooms.
- Notices show inside the app (refreshed every minute, or instantly while in a live room). No SMS or phone push messages.
- GPS needs the screen/app kept open on most phones. Median pace per individual is shown per km split, not yet on the dashboard.
- The coach token is stored on the coach's device. There are no user accounts.

Plan: [docs/architecture.md](docs/architecture.md)
