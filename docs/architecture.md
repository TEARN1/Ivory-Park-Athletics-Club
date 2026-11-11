# Ivory Park Athletics Club: System & Deployment Plan

Low-cost, offline-first workflow for athletes and coaches, including people without smartphones or data.

## Budget
| Component | Strategy |
|---|---|
| Domain | Standard .org.za / .co.za, annual renewal |
| Hosting/backend | Free tier serverless or one low-cost VPS |
| Live messaging (target <5s) | Lightweight WebSocket (or MQTT) |
| Maps/routing | OpenStreetMap data, offline tiles, no recurring API fees |

## Ivory Park protocol (no phone needed)
- Coach checks in all runners at session start (bib or name).
- Buddy system: a runner without a phone pairs with one who carries a device.
- Local caching in IndexedDB; upload when on home or community Wi-Fi.

## Relay: Pass Over / Take (Phase 2)
One coach/pack leader presses Start for the field. A lead runner taps **Pass Over**; adjacent runners get a prompt; the incoming lead taps **Take** and assumes live beacon with no gap in tracking.

## Coach dashboard
Live ordinal rank and split, pace per km, group and individual median pace.

## Routes (Phase 2)
Target distance generates up to 15 loops from the club hub; **Reroute** gives an alternative of the same distance; named circuits; notices to past guests about time trials and long runs.

## Status
Phase 1 and 2 are built (see README for known limits). Not built: road-snapped routing with OSM tiles, SMS/push, accounts.
