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

## Done in this version
Guided Session flow (set up, race on, results), big finish tiles with undo, end-session confirm, next session with same runners, bottom navigation, club colours and logo, bundled display font (works offline), dark mode.
