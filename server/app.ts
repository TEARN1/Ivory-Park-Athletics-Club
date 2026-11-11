import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { initialRelay, relayReduce, type RelayState } from "../src/lib/relay";

export interface Options { coachToken?: string; dataFile?: string; allowedOrigin?: string }
interface Db { sessions: any[]; guests: { id: string; name: string; contact: string; consentAt: number }[]; notices: { id: string; text: string; at: number }[] }
interface Client { ws: WebSocket; room: string; runnerId?: string; coach: boolean }
interface Room { relay: RelayState; startedAt?: number; clients: Set<Client>; beacon?: { runnerId: string; lat: number; lon: number; at: number } }

const MAX_BODY = 1_000_000;
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function createApp(opts: Options): { server: Server; close: () => Promise<void> } {
  const origin = opts.allowedOrigin ?? "*";
  let db: Db = { sessions: [], guests: [], notices: [] };
  if (opts.dataFile && existsSync(opts.dataFile)) { try { db = { ...db, ...JSON.parse(readFileSync(opts.dataFile, "utf8")) }; } catch { /* start empty */ } }
  const persist = () => {
    if (!opts.dataFile) return;
    mkdirSync(dirname(opts.dataFile), { recursive: true });
    writeFileSync(opts.dataFile + ".tmp", JSON.stringify(db)); renameSync(opts.dataFile + ".tmp", opts.dataFile);
  };
  const isCoach = (tok?: string | null) => !!opts.coachToken && !!tok && same(tok, opts.coachToken);
  const rooms = new Map<string, Room>();
  const send = (ws: WebSocket, m: unknown) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const roomState = (r: Room) => ({ type: "state", relay: r.relay, startedAt: r.startedAt, beacon: r.beacon, runners: [...r.clients].map((c) => c.runnerId).filter(Boolean) });
  const broadcast = (r: Room, m: unknown) => r.clients.forEach((c) => send(c.ws, m));

  const reply = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": origin, "access-control-allow-headers": "content-type,authorization", "access-control-allow-methods": "GET,POST,DELETE,OPTIONS" });
    res.end(JSON.stringify(body));
  };
  const readJson = (req: IncomingMessage) => new Promise<any>((ok, bad) => {
    let n = 0; const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => { n += c.length; if (n > MAX_BODY) { bad(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { ok(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { bad(new Error("bad json")); } });
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x"); const path = url.pathname;
    const coach = isCoach((req.headers.authorization ?? "").replace(/^Bearer /, ""));
    if (req.method === "OPTIONS") return reply(res, 204, {});
    try {
      if (path === "/health") return reply(res, 200, { ok: true });
      if (path === "/notices" && req.method === "GET") return reply(res, 200, db.notices.slice(-20));
      const needCoach = ["/sync", "/sessions"].includes(path) || (path === "/notices" && req.method === "POST") || (path === "/guests" && req.method === "GET") || path.startsWith("/guests/");
      if (needCoach && !opts.coachToken) return reply(res, 503, { error: "Coach token not configured on the server" });
      if (needCoach && !coach) return reply(res, 401, { error: "Coach token required" });

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
    const c: Client = { ws, room: code, coach: isCoach(url.searchParams.get("token")), runnerId: url.searchParams.get("runner") || undefined };
    if (!rooms.has(code)) { if (!c.coach) { send(ws, { type: "error", error: "Room not open. Ask your coach to start it." }); ws.close(1008); return; } rooms.set(code, { relay: initialRelay(), clients: new Set() }); }
    const room = rooms.get(code)!; room.clients.add(c); send(ws, roomState(room)); broadcast(room, roomState(room));
    ws.on("message", (raw) => {
      let m: any; try { m = JSON.parse(String(raw)); } catch { return; }
      const now = Date.now();
      if (m.type === "start" && c.coach) room.startedAt ??= now;
      else if (m.type === "setLead" && c.coach && typeof m.runnerId === "string") room.relay = relayReduce(room.relay, { type: "setLead", runnerId: m.runnerId, at: now });
      else if (m.type === "pass" && c.runnerId) room.relay = relayReduce(room.relay, { type: "pass", runnerId: c.runnerId });
      else if (m.type === "take" && c.runnerId) room.relay = relayReduce(room.relay, { type: "take", runnerId: c.runnerId, at: now });
      else if (m.type === "pos" && c.runnerId && room.relay.leadId === c.runnerId && Number.isFinite(m.lat) && Number.isFinite(m.lon)) room.beacon = { runnerId: c.runnerId, lat: m.lat, lon: m.lon, at: now };
      else return;
      broadcast(room, roomState(room));
    });
    ws.on("close", () => { room.clients.delete(c); if (!room.clients.size) rooms.delete(code); else broadcast(room, roomState(room)); });
  });
  return { server, close: () => new Promise((ok) => { wss.clients.forEach((c) => c.terminate()); wss.close(); server.close(() => ok()); }) };
}
