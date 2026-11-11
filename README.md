# Ivory Park Athletics Club

Offline-first session timer for the club. Works with no data and no personal phones.

**Built (Phase 1):** coach check-in with bib/name, buddy pairing for runners without phones, one Start for the field,
tap-to-finish, live rank / pace per km / gap / group median pace, local storage (IndexedDB) and an upload outbox.

**Not built yet (Phase 2):** Pass Over / Take relay control (needs a WebSocket server), route generator and Reroute
(OpenStreetMap), saved routes and visitor notices, GPS tracking. Uploads need a server; set `VITE_SYNC_URL` once one exists.

```
npm install
npm run dev      # develop
npm run verify   # tests + type-check + build
```
Full plan: [docs/architecture.md](docs/architecture.md)
