# Backlog: what is missing and what to improve

## Must do before real use
1. **Test on real phones** (GPS accuracy, screen lock, install to home screen, a full mock session with 10+ runners).
2. **Put it online** (Vercel + Render; see deploy.md) and test over mobile data with two phones in a room.
3. **Permanent storage.** Free-tier server data is wiped on restart. Needs a hosted database or paid disk.
4. **Road-based routes.** Loops are straight-line guides. Needs OpenStreetMap routing (OSRM/Valhalla) plus a "checked by coach" tick before a route is shared.
5. **Safety.** Runner safety alert (no movement / far behind), coach emergency contact per runner, route hazard notes.
6. **Privacy for minors.** Written consent, who can see names, delete-my-data option, no public results with full names.

## Should do
- **Phone push / SMS / WhatsApp** for visitor notices (today: in-app only).
- **Accounts and roles** (coach, assistant, runner). Runner identity in a live room is self-chosen today.
- **Photo finish for ties** and "finish order only" mode when the timer phone is busy.
- **Lap and interval sessions** (e.g. 8 x 400 m), laps per runner, not only one finish.
- **Per-runner history**: personal bests, progress chart, season table.
- **Age/gender categories** and club records.
- **Import/export**: runner list from CSV, results to PDF or WhatsApp-ready text.
- **Roster that persists** across weeks with attendance (today: "same runners" copies the last session only).
- **Languages**: isiZulu, Sepedi, Afrikaans labels.
- **Low-data mode and storage warnings**, background sync that survives app close.
- **Wake lock fallback** for phones that refuse it; warn the timekeeper before the screen locks.

## Nice to have
- Offline map tiles of Ivory Park and a live map of runners for the coach.
- Voice announce of positions ("Sipho, second").
- Bluetooth/finish-line button for a dedicated timekeeper.
- Club website page for results and events.
- Automated browser tests in CI (scripts/smoke.cjs is manual today).

## 20 ideas to add (not built yet)
1. Road-based routes (OpenStreetMap routing) with a coach "checked and safe" tick before sharing.
2. Safety alerts: runner far behind or stopped, plus an emergency contact per runner.
3. WhatsApp, SMS and push messages for notices and results (today: in-app only).
4. Accounts and roles: coach, assistant, runner, with a PIN so only you can claim your bib.
5. Permanent database so server data survives restarts.
6. Runner profiles: personal bests, progress charts, season totals.
7. Interval and lap sessions (8 x 400 m) with splits per lap.
8. Age and gender categories, and age-graded results.
9. Club league: points table, monthly challenge, club records.
10. Attendance and membership register, parent consent for under-18s.
11. Event calendar with "I'm coming" replies for time trials and long runs.
12. Shareable results: image, PDF or WhatsApp text, and a public results page without full names.
13. Languages: isiZulu, Sepedi, Afrikaans.
14. Live map for the coach showing every GPS runner.
15. Start beep, countdown and voice announcements of positions.
16. More than one timekeeper, photo finish for ties, scan the bib QR to record a finish.
17. Target pace and pacer groups, with "10 seconds behind target" cues.
18. Backup and restore of all data, and conflict handling when two phones edit one session.
19. Training plans, coach notes per runner, streak badges.
20. Club web page with news, photos, sponsors and fundraising links (no payments taken in the app).

## Done in this version
Join by link or QR (runners tap today's open run or scan a code, the coach gives each the next bib), status button with options sheet, day/night/auto and three colour themes, editable distance shortcuts.

Guided Session flow (set up, race on, results), big finish tiles with undo, end-session confirm, next session with same runners, bottom navigation, club colours and logo, bundled display font (works offline), dark mode.
