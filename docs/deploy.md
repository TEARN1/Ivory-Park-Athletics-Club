# Deploying on free tiers

Two parts: the **client** (static site) and the **server** (live relay, sync, notices). Costs R0 on free tiers, with the limits below. Both hosts give you HTTPS, which GPS and installing the app require.

## 1. Server on Render (free web service)
1. Push this repo to GitHub.
2. Render → New → **Blueprint** → pick the repo. `render.yaml` creates `ipac-server`.
3. When asked, set `ALLOWED_ORIGIN` to your client address (step 2 below; you can edit it later).
4. After it deploys, open the service → Environment and copy `COACH_TOKEN`. Keep it private; only coaches need it.
5. Check `https://<your-service>.onrender.com/health` returns `{"ok":true}`.

**Free-tier limits you will notice**
- The service **sleeps after ~15 minutes without traffic**; the first request then takes up to about a minute. Coaches should open the app a few minutes before a session.
- The disk is **wiped on every restart or redeploy**: uploaded sessions, the guest list and notices on the server are lost. The phones keep their own copies (history and the upload queue stay on each device until sent). Export CSVs you need to keep. Permanent storage needs a paid disk or a hosted database.
- Live rooms live in memory, so a restart ends them and coaches reopen the room.
- Limits and prices change; check the current Render free-tier terms.

## 2. Client on Vercel (free)
1. Vercel → Add New → Project → import the repo (framework: Vite is detected; `vercel.json` sets the rest).
2. Add environment variable `VITE_SERVER_URL` = your Render address (optional; it just pre-fills the Club tab).
3. Deploy, then put the final address into the server's `ALLOWED_ORIGIN` on Render and redeploy it.

Any static host works too (Cloudflare Pages, Netlify, GitHub Pages at the domain root): build with `npm run build` and publish `dist/`.

## 3. Domain
Optional. Buy a `.org.za` / `.co.za` name from a registrar and add it in Vercel → Domains. The free `*.vercel.app` address works without one.

## Alternative: one small VPS
```
docker build -t ipac .
docker run -d --restart unless-stopped -p 8787:8787 -v ipac-data:/data \
  -e COACH_TOKEN=... -e ALLOWED_ORIGIN=https://your-client ipac
```
Put it behind HTTPS (Caddy or nginx) so the app can use `wss://`. The `/data` volume keeps guests, notices and sessions across restarts.

## First-run checklist
1. Open the client, **Club** tab: enter the server address and (coach phone only) the token, Save.
2. Coach: Live tab → room code → Join. Runner phones: pick name → same room code → Join.
3. Test Pass Over / Take with two phones before a real session.
