// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";

let app: ReturnType<typeof createApp>, base = "", wsBase = "";
beforeAll(async () => { app = createApp({ coachToken: "secret" }); await new Promise<void>((r) => app.server.listen(0, r)); const p = (app.server.address() as AddressInfo).port; base = `http://127.0.0.1:${p}`; wsBase = `ws://127.0.0.1:${p}/live`; });
afterAll(() => app.close());
const auth = { authorization: "Bearer secret", "content-type": "application/json" };
const open = (q: string) => new Promise<{ ws: WebSocket; msgs: any[] }>((ok, bad) => { const ws = new WebSocket(`${wsBase}?${q}`), msgs: any[] = []; ws.on("message", (d) => msgs.push(JSON.parse(String(d)))); ws.on("open", () => ok({ ws, msgs })); ws.on("error", bad); });
const until = async (f: () => boolean) => { for (let i = 0; i < 100 && !f(); i++) await new Promise((r) => setTimeout(r, 10)); expect(f()).toBe(true); };

describe("http", () => {
  it("guards coach endpoints", async () => {
    expect((await fetch(`${base}/sessions`)).status).toBe(401);
    expect((await fetch(`${base}/sessions`, { headers: { authorization: "Bearer nope" } })).status).toBe(401);
    expect((await fetch(`${base}/sessions`, { headers: auth })).status).toBe(200);
  });
  it("syncs a session and rejects junk", async () => {
    expect((await fetch(`${base}/sync`, { method: "POST", headers: auth, body: JSON.stringify({ id: "a", runners: [] }) })).status).toBe(200);
    expect((await fetch(`${base}/sync`, { method: "POST", headers: auth, body: "{}" })).status).toBe(400);
    expect(((await (await fetch(`${base}/sessions`, { headers: auth })).json()) as any[]).length).toBe(1);
  });
  it("guests need consent; notices are public to read, coach to write", async () => {
    const post = (b: unknown) => fetch(`${base}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    expect((await post({ name: "Visitor", contact: "x" })).status).toBe(400);
    expect((await post({ name: "Visitor", contact: "x", consent: true })).status).toBe(201);
    expect((await fetch(`${base}/notices`, { method: "POST", body: JSON.stringify({ text: "Time trial Sat" }) })).status).toBe(401);
    expect((await fetch(`${base}/notices`, { method: "POST", headers: auth, body: JSON.stringify({ text: "Time trial Sat" }) })).status).toBe(201);
    expect(((await (await fetch(`${base}/notices`)).json()) as any[])[0].text).toBe("Time trial Sat");
    const guests = (await (await fetch(`${base}/guests`, { headers: auth })).json()) as any[];
    expect((await fetch(`${base}/guests/${guests[0].id}`, { method: "DELETE", headers: auth })).status).toBe(200);
  });
});
describe("live relay", () => {
  it("runners cannot open a room; Pass Over then Take moves the beacon", async () => {
    const stranger = await open("room=ABCD&runner=a"); await until(() => stranger.msgs.some((m) => m.type === "error")); stranger.ws.close();
    const coach = await open("room=ABCD&token=secret"); const a = await open("room=ABCD&runner=a"); const b = await open("room=ABCD&runner=b");
    coach.ws.send(JSON.stringify({ type: "setLead", runnerId: "a" }));
    b.ws.send(JSON.stringify({ type: "take" })); // no offer yet: ignored
    a.ws.send(JSON.stringify({ type: "pass" }));
    await until(() => b.msgs.at(-1)?.relay?.offeredBy === "a");
    b.ws.send(JSON.stringify({ type: "take" }));
    await until(() => b.msgs.at(-1)?.relay?.leadId === "b");
    a.ws.send(JSON.stringify({ type: "pos", lat: 1, lon: 1 })); // no longer lead: ignored
    b.ws.send(JSON.stringify({ type: "pos", lat: -26, lon: 28 }));
    await until(() => a.msgs.at(-1)?.beacon?.runnerId === "b");
    expect(a.msgs.at(-1).beacon.lat).toBe(-26);
    [coach, a, b].forEach((x) => x.ws.close());
  });
});

describe("join programs", () => {
  const J = (path: string, body?: unknown, coach = false) => fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST", headers: coach ? auth : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  it("coach opens a run; runners find it, join once per phone, get a bib from the coach", async () => {
    expect((await J("/programs", { date: "2026-11-11", distanceKm: 5 })).status).toBe(401);
    expect((await J("/programs", { date: "nope", distanceKm: 5 }, true)).status).toBe(400);
    const { code } = (await (await J("/programs", { date: "2026-11-11", distanceKm: 5 }, true)).json()) as any;
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    const today = (await (await J("/programs?date=2026-11-11")).json()) as any[]; expect(today.map((p) => p.code)).toContain(code);
    expect((await (await J("/programs?date=2026-11-12")).json()) as any[]).toEqual([]);
    expect((await J(`/programs/${code}/join`, { name: "  ", deviceId: "device-0001" })).status).toBe(400);
    const a = (await (await J(`/programs/${code}/join`, { name: "Naledi", deviceId: "device-0001" })).json()) as any;
    const again = (await (await J(`/programs/${code}/join`, { name: "Naledi M", deviceId: "device-0001" })).json()) as any;
    expect(again.joinerId).toBe(a.joinerId);
    await J(`/programs/${code}/join`, { name: "Themba", deviceId: "device-0002" });
    expect((await J(`/programs/${code}/joiners`)).status).toBe(401);
    const list = (await (await fetch(`${base}/programs/${code}/joiners`, { headers: auth })).json()) as any[];
    expect(list.map((x) => x.name)).toEqual(["Naledi M", "Themba"]); expect(list[0].bib).toBeNull();
    expect((await J(`/programs/${code}/assign`, { assignments: { [a.joinerId]: "7" } })).status).toBe(401);
    await J(`/programs/${code}/assign`, { assignments: { [a.joinerId]: "7", nobody: "9" } }, true);
    expect(((await (await J(`/programs/${code}/me?joinerId=${a.joinerId}`)).json()) as any).bib).toBe("7");
  });
  it("closing stops new joiners and removes it from today's list", async () => {
    const { code } = (await (await J("/programs", { date: "2026-11-13", distanceKm: 10 }, true)).json()) as any;
    expect((await J(`/programs/${code}/close`, {}, true)).status).toBe(200);
    expect((await J(`/programs/${code}/join`, { name: "Late", deviceId: "device-0003" })).status).toBe(403);
    expect((await (await J("/programs?date=2026-11-13")).json()) as any[]).toEqual([]);
    expect((await J("/programs/ZZZZZ")).status).toBe(404);
  });
});
