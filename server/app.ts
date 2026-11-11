import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual, randomUUID, randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { initialRelay, relayReduce, type RelayState } from "../src/lib/relay";
import { emptyTiming, timingReduce, type SharedTiming } from "../src/lib/timing";
import { renderClubPage, renderResultsPage, sanitizeBundle, type PublicBundle } from "../src/lib/publicSite";

export interface Options { coachToken?: string; dataFile?: string; allowedOrigin?: string }
interface Joiner { id: string; deviceId: string; name: string; bib: string | null; at: number }
interface Program { code: string; date: string; distanceKm: number; open: boolean; createdAt: number; joiners: Joiner[] }
interface Db { public?: PublicBundle; rsvps: Record<string, Rsvp[]>; programs: Program[]; sessions: any[]; guests: { id: string; name: string; contact: string; consentAt: number }[]; notices: { id: string; text: string; at: number }[] }
interface Client { ws: WebSocket; room: string; runnerId?: string; coach: boolean; deviceTag: string }
interface Pos { runnerId: string; lat: number; lon: number; at: number }
interface Room { relay: RelayState; startedAt?: number; clients: Set<Client>; beacon?: Pos; positions: Map<string, Pos>; timing: SharedTiming }
interface Rsvp { deviceId: string; name: string; coming: boolean; at: number }

const MAX_BODY = 1_000_000;
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function createApp(opts: Options): { server: Server; close: () => Promise<void> } {
  const origin = opts.allowedOrigin ?? "*";
  let db: Db = { rsvps: {}, programs: [], sessions: [], guests: [], notices: [] };
  if (opts.dataFile && existsSync(opts.dataFile)) { try { db = { ...db, ...JSON.parse(readFileSync(opts.dataFile, "utf8")) }; } catch { /* start empty */ } }
  const persist = () => {
    if (!opts.dataFile) return;
    mkdirSync(dirname(opts.dataFile), { recursive: true });
    writeFileSync(opts.dataFile + ".tmp", JSON.stringify(db)); renameSync(opts.dataFile + ".tmp", opts.dataFile);
  };
  const isCoach = (tok?: string | null) => !!opts.coachToken && !!tok && same(tok, opts.coachToken);
  const rooms = new Map<string, Room>();
  const send = (ws: WebSocket, m: unknown) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const roomState = (r: Room) => ({ type: "state", serverNow: Date.now(), relay: r.relay, startedAt: r.startedAt, beacon: r.beacon, positions: [...r.positions.values()].slice(-200), timing: r.timing, runners: [...r.clients].map((c) => c.runnerId).filter(Boolean) });
  const broadcast = (r: Room, m: unknown) => r.clients.forEach((c) => send(c.ws, m));

  const reply = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": origin, "access-control-allow-headers": "content-type,authorization", "access-control-allow-methods": "GET,POST,DELETE,OPTIONS" });
    res.end(JSON.stringify(body));
  };
  const readJson = (req: IncomingMessage, limit = MAX_BODY) => new Promise<any>((ok, bad) => {
    let n = 0; const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => { n += c.length; if (n > limit) { bad(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { ok(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { bad(new Error("bad json")); } });
  });

  const rsvpCounts = () => Object.fromEntries(Object.entries(db.rsvps).map(([k, v]) => [k, v.filter((r) => r.coming).length]));
  const html = (res: ServerResponse, code: number, body: string) => {
    res.writeHead(code, { "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'", "x-content-type-options": "nosniff" });
    res.end(body);
  };
  const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: easy to read out loud
  const clean = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, n);
  async function programs(req: IncomingMessage, res: ServerResponse, pm: RegExpMatchArray, url: URL) {
    const [, code, sub] = pm; const get = req.method === "GET", post = req.method === "POST";
    if (!code) {
      if (get) {
        const day = url.searchParams.get("date") ?? "";
        return reply(res, 200, db.programs.filter((p) => p.open && p.date === day).map(({ code, date, distanceKm }) => ({ code, date, distanceKm })));
      }
      if (post) {
        const b = await readJson(req), date = String(b.date ?? ""), km = Number(b.distanceKm);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(km >= 0.1 && km <= 200)) return reply(res, 400, { error: "Need a date and a distance" });
        let c = ""; do { c = Array.from({ length: 5 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join(""); } while (db.programs.some((p) => p.code === c));
        db.programs = [...db.programs, { code: c, date, distanceKm: km, open: true, createdAt: Date.now(), joiners: [] }].slice(-200); persist();
        return reply(res, 201, { code: c });
      }
      return reply(res, 405, { error: "Method not allowed" });
    }
    const prog = db.programs.find((p) => p.code === code);
    if (!prog) return reply(res, 404, { error: "Program not found" });
    if (!sub && get) return reply(res, 200, { code, date: prog.date, distanceKm: prog.distanceKm, open: prog.open });
    if (sub === "close" && post) { prog.open = false; persist(); return reply(res, 200, { ok: true }); }
    if (sub === "joiners" && get) return reply(res, 200, prog.joiners);
    if (sub === "assign" && post) {
      const a = (await readJson(req)).assignments ?? {};
      for (const [id, bib] of Object.entries(a)) { const j = prog.joiners.find((x) => x.id === id); if (j && /^[0-9A-Za-z]{1,6}$/.test(String(bib))) j.bib = String(bib); }
      persist(); return reply(res, 200, { ok: true });
    }
    if (sub === "join" && post) {
      if (!prog.open) return reply(res, 403, { error: "Joining is closed for this run" });
      const b = await readJson(req), name = clean(b.name, 60), deviceId = clean(b.deviceId, 64);
      if (!name) return reply(res, 400, { error: "Please enter your name" });
      if (deviceId.length < 8) return reply(res, 400, { error: "Missing device id" });
      let j = prog.joiners.find((x) => x.deviceId === deviceId);
      if (j) j.name = name; // joining twice from one phone updates the same entry
      else {
        if (prog.joiners.length >= 300) return reply(res, 409, { error: "This run is full" });
        j = { id: randomUUID(), deviceId, name, bib: null, at: Date.now() }; prog.joiners.push(j);
      }
      persist(); return reply(res, 200, { joinerId: j.id, bib: j.bib });
    }
    if (sub === "me" && get) {
      const j = prog.joiners.find((x) => x.id === url.searchParams.get("joinerId"));
      return j ? reply(res, 200, { name: j.name, bib: j.bib, open: prog.open }) : reply(res, 404, { error: "Not joined" });
    }
    return reply(res, 404, { error: "Not found" });
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x"); const path = url.pathname;
    const coach = isCoach((req.headers.authorization ?? "").replace(/^Bearer /, ""));
    if (req.method === "OPTIONS") return reply(res, 204, {});
    try {
      if (path === "/health") return reply(res, 200, { ok: true });
      if (req.method === "GET" && (path === "/club" || path === "/club/")) return html(res, 200, renderClubPage(db.public, rsvpCounts()));
      const rm = path.match(/^\/club\/results\/([\w-]{1,60})$/);
      if (req.method === "GET" && rm) { const h = renderResultsPage(db.public, rm[1]); return h ? html(res, 200, h) : html(res, 404, renderClubPage(db.public, rsvpCounts())); }
      if (req.method === "GET" && path === "/public.json") return reply(res, 200, { bundle: db.public ?? null, counts: rsvpCounts() });
      const em = path.match(/^\/events\/([\w-]{1,60})\/(rsvp|rsvps)$/);
      if (em && em[2] === "rsvp" && req.method === "POST") {
        const ev = db.public?.events.find((e) => e.id === em[1]); if (!ev) return reply(res, 404, { error: "That event is not on the club calendar" });
        const b = await readJson(req), name = clean(b.name, 60), deviceId = clean(b.deviceId, 64);
        if (!name || deviceId.length < 8) return reply(res, 400, { error: "Please enter your name" });
        const list = (db.rsvps[ev.id] ?? []).filter((r) => r.deviceId !== deviceId);
        if (list.length >= 500) return reply(res, 409, { error: "This event is full" });
        db.rsvps[ev.id] = [...list, { deviceId, name, coming: b.coming !== false, at: Date.now() }]; persist();
        return reply(res, 200, { ok: true, coming: rsvpCounts()[ev.id] ?? 0 });
      }
      if (path === "/notices" && req.method === "GET") return reply(res, 200, db.notices.slice(-20));
      const pm = path.match(/^\/programs(?:\/([A-Z0-9]{4,8}))?(?:\/([a-z]+))?$/);
      const programCoach = !!pm && ((req.method === "POST" && (!pm[1] || pm[2] === "close" || pm[2] === "assign")) || pm[2] === "joiners");
      const needCoach = programCoach || (path === "/public" && req.method === "POST") || (!!em && em[2] === "rsvps") || ["/sync", "/sessions"].includes(path) || (path === "/notices" && req.method === "POST") || (path === "/guests" && req.method === "GET") || path.startsWith("/guests/");
      if (needCoach && !opts.coachToken) return reply(res, 503, { error: "Coach token not configured on the server" });
      if (needCoach && !coach) return reply(res, 401, { error: "Coach token required" });

      if (pm) return await programs(req, res, pm, url);
      if (path === "/public" && req.method === "POST") { db.public = sanitizeBundle(await readJson(req, 4_000_000)); persist(); return reply(res, 200, { ok: true }); }
      if (em && em[2] === "rsvps" && req.method === "GET") return reply(res, 200, (db.rsvps[em[1]] ?? []).map(({ name, coming, at }) => ({ name, coming, at })));
      if (path === "/sync" && req.method === "POST") {
        const s = await readJson(req);
        if (typeof s.id !== "string" || !Array.isArray(s.runners)) return reply(res, 400, { error: "Not a session" });
        db.sessions = [...db.sessions.filter((x) => x.id !== s.id), s].slice(-500); persist(); return reply(res, 200, { ok: true });
      }
      if (path === "/sessions" && req.method === "GET") return reply(res, 200, db.sessions);
      if (path === "/guests" && req.method === "POST") {
        const g = await readJson(req);
        if (g.consent !== true) return reply(res, 400, { error: "Guest must agree to be contacted" });
        const name = String(g.name ?? "").trim().slice(0, 80), contact = String(g.contact ?? "").trim().slice(0, 120);
        if (!name) return reply(res, 400, { error: "Name required" });
        db.guests.push({ id: randomUUID(), name, contact, consentAt: Date.now() }); persist(); return reply(res, 201, { ok: true });
      }
      if (path === "/guests" && req.method === "GET") return reply(res, 200, db.guests);
      if (path.startsWith("/guests/") && req.method === "DELETE") { db.guests = db.guests.filter((g) => g.id !== path.slice(8)); persist(); return reply(res, 200, { ok: true }); }
      if (path === "/notices" && req.method === "POST") {
        const text = String((await readJson(req)).text ?? "").trim().slice(0, 280);
        if (!text) return reply(res, 400, { error: "Notice text required" });
        const n = { id: randomUUID(), text, at: Date.now() }; db.notices.push(n); db.notices = db.notices.slice(-100); persist();
        rooms.forEach((r) => broadcast(r, { type: "notice", notice: n })); wss.clients.forEach((c) => send(c, { type: "notice", notice: n }));
        return reply(res, 201, n);
      }
      reply(res, 404, { error: "Not found" });
    } catch (e) { reply(res, 400, { error: (e as Error).message }); }
  });

  const wss = new WebSocketServer({ server, path: "/live", maxPayload: 16_000 });
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "", "http://x"); const code = (url.searchParams.get("room") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!code) { ws.close(1008, "room required"); return; }
    const c: Client = { ws, room: code, coach: isCoach(url.searchParams.get("token")), runnerId: url.searchParams.get("runner") || undefined, deviceTag: randomUUID() };
    if (!rooms.has(code)) { if (!c.coach) { send(ws, { type: "error", error: "Room not open. Ask your coach to start it." }); ws.close(1008); return; } rooms.set(code, { relay: initialRelay(), clients: new Set(), positions: new Map(), timing: emptyTiming() }); }
    const room = rooms.get(code)!; room.clients.add(c); send(ws, roomState(room)); broadcast(room, roomState(room));
    ws.on("message", (raw) => {
      let m: any; try { m = JSON.parse(String(raw)); } catch { return; }
      const now = Date.now();
      if (m.type === "start" && c.coach) room.startedAt ??= now;
      else if (m.type === "setLead" && c.coach && typeof m.runnerId === "string") room.relay = relayReduce(room.relay, { type: "setLead", runnerId: m.runnerId, at: now });
      else if (m.type === "pass" && c.runnerId) room.relay = relayReduce(room.relay, { type: "pass", runnerId: c.runnerId });
      else if (m.type === "take" && c.runnerId) room.relay = relayReduce(room.relay, { type: "take", runnerId: c.runnerId, at: now });
      else if (m.type === "pos" && c.runnerId && Number.isFinite(m.lat) && Number.isFinite(m.lon) && Math.abs(m.lat) <= 90 && Math.abs(m.lon) <= 180) {
        const p = { runnerId: c.runnerId, lat: m.lat, lon: m.lon, at: now }; room.positions.set(c.runnerId, p); if (room.relay.leadId === c.runnerId) room.beacon = p;
      }
      else if (m.type === "timing" && c.coach && m.action && typeof m.action === "object") {
        const a = m.action; // the server stamps who and when; phones send times relative to the shared start
        if (a.type === "start") room.timing = timingReduce(room.timing, { type: "start", at: now - Math.max(0, Math.min(10_000, Number(a.lagMs) || 0)) });
        else if (a.type === "finish") room.timing = timingReduce(room.timing, { type: "finish", bib: String(a.bib ?? ""), ms: Number(a.ms), by: c.deviceTag, at: now });
        else if (a.type === "undo") room.timing = timingReduce(room.timing, { type: "undo", bib: String(a.bib ?? "") });
        else if (a.type === "reset") room.timing = timingReduce(room.timing, { type: "reset" });
        else return;
      }
      else return;
      broadcast(room, roomState(room));
    });
    ws.on("close", () => { room.clients.delete(c); if (!room.clients.size) rooms.delete(code); else broadcast(room, roomState(room)); });
  });
  return { server, close: () => new Promise((ok) => { wss.clients.forEach((c) => c.terminate()); wss.close(); server.close(() => ok()); }) };
}
