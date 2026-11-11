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
