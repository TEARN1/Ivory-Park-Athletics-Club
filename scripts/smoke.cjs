// End-to-end smoke test. Needs: server on :8787 (COACH_TOKEN=secret) and `vite preview` on :4173.
const { chromium } = require("playwright"); const assert = require("node:assert/strict");
const APP = "http://localhost:4173/", SRV = "http://localhost:8787";
async function addRunner(p, name, bib) { await p.fill('[aria-label="Name"]', name); await p.fill('[aria-label="Bib number"]', bib); await p.click("text=Add runner"); }
async function setup(browser, name, server, token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, geolocation: { latitude: -25.9967, longitude: 28.2 }, permissions: ["geolocation"], acceptDownloads: true });
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(APP); await p.waitForSelector("h1");
  await p.click("nav >> text=Club"); await p.fill('[aria-label="Server address"]', server); if (token) await p.fill('[aria-label="Coach token"]', token); await p.click("text=Save");
  await p.click("nav >> text=Check-in"); await addRunner(p, "Thandi", "1"); await addRunner(p, "Sipho", "2");
  return { ctx, p };
}
(async () => {
  const b = await chromium.launch();
  const coach = await setup(b, "coach", SRV, "secret"), runner = await setup(b, "runner", SRV, "");
  // Relay: coach opens room and sets lead; runner 2 joins, lead 1 passes, 2 takes
  for (const [who, me] of [[coach, ""], [runner, "2"]]) {
    await who.p.click("nav >> text=Live"); if (me) await who.p.selectOption('select >> nth=0', me); await who.p.fill('input[placeholder="e.g. IPARK"]', "IPARK"); await who.p.click("text=Join room");
    await who.p.waitForSelector("text=Connection: on");
  }
  await coach.p.selectOption('[aria-label="Set lead"]', "1");
  await runner.p.waitForSelector("text=Lead: #1 Thandi");
  assert.equal(await runner.p.locator("button:text-is('Take')").isDisabled(), true, "Take must wait for an offer");
  // Thandi's device
  const t = await setup(b, "t", SRV, ""); await t.p.click("nav >> text=Live"); await t.p.selectOption('select >> nth=0', "1"); await t.p.fill('input[placeholder="e.g. IPARK"]', "IPARK"); await t.p.click("text=Join room"); await t.p.waitForSelector("text=Connection: on");
  await t.p.click("text=Pass Over");
  await runner.p.waitForSelector("text=is passing the lead");
  await runner.p.click("button:text-is('Take')");
  await coach.p.waitForSelector("text=Lead: #2 Sipho"); console.log("relay ok");
  // GPS + splits on the runner device (mock a ~1.2 km walk)
  await runner.p.click("nav >> text=Timer"); await runner.p.click("text=Start for everyone"); await runner.p.click("nav >> text=Live"); await runner.p.check("text=Track my run with GPS");
  for (let i = 0; i < 6; i++) { await runner.ctx.setGeolocation({ latitude: -25.9967 + i * 0.0022, longitude: 28.2 }); await runner.p.waitForTimeout(300); }
  console.log("gps:", (await runner.p.locator("text=/\\d+\\.\\d+ km · \\d+ points/").first().innerText()));
  // finish, edit, csv, archive + upload
  await runner.p.click("nav >> text=Timer"); await runner.p.click("text=#2 Sipho"); await runner.p.click("nav >> text=Results");
  await runner.p.click('[aria-label="Edit time for #2 Sipho"]'); await runner.p.fill('[aria-label="New time"]', "9:30"); await runner.p.click("text=OK");
  assert.match(await runner.p.innerText(".ipac-table"), /9:30/);
  const [dl] = await Promise.all([runner.p.waitForEvent("download"), runner.p.click("text=Download CSV")]); console.log("csv:", dl.suggestedFilename());
  // sync needs a coach token on the client: runner has none, so the upload stays queued
  await runner.p.click("text=Save session & start a new one"); await runner.p.click("nav >> text=Results"); await runner.p.waitForSelector("text=/1 saved session/");
  // coach: sync a session, notice reaches the runner, guest list, routes
  await coach.p.click("nav >> text=Timer"); await coach.p.click("text=Start for everyone"); await coach.p.click("text=#1 Thandi"); await coach.p.click("nav >> text=Results");
  await coach.p.click("text=Save session & start a new one"); await coach.p.waitForTimeout(800);
  const uploaded = await (await fetch(SRV + "/sessions", { headers: { authorization: "Bearer secret" } })).json(); assert.equal(uploaded.length, 1); assert.equal(uploaded[0].tracks, undefined); console.log("sync ok (tracks stripped)");
  await coach.p.click("nav >> text=Club"); await coach.p.fill('[aria-label="New notice"]', "Time trial Saturday"); await coach.p.click("text=Send notice");
  await runner.p.click("nav >> text=Club"); await runner.p.waitForSelector("text=Time trial Saturday", { timeout: 70000 }).catch(() => { throw new Error("notice did not reach runner"); }); console.log("notice ok");
  await coach.p.fill('[aria-label="Guest name"]', "Visitor"); assert.equal(await coach.p.locator("text=Join guest list").isDisabled(), true); await coach.p.check("text=I agree the club may contact me"); await coach.p.click("text=Join guest list");
  await coach.p.waitForSelector("text=Visitor ·"); console.log("guest ok");
  await coach.p.click("nav >> text=Routes"); await coach.p.click("text=Generate 15 loops"); await coach.p.waitForSelector("svg[aria-label^='Map of']");
  const len = await coach.p.locator("text=/option 1 of 15/").innerText(); await coach.p.selectOption("select >> nth=0", "90").catch(() => {});
  await coach.p.click("text=Reroute"); console.log("routes:", len.slice(0, 40), "→", (await coach.p.locator("text=/option \\d+ of 15/").innerText()).slice(-20));
  await coach.p.fill('[aria-label="Route name"]', "Ivory Park 5k Loop"); await coach.p.click("text=Save this route"); await coach.p.waitForSelector("text=Saved routes");
  await coach.p.screenshot({ path: process.argv[2] + "/routes.png" });
  for (const x of [coach, runner, t]) assert.deepEqual(x.p.errs, []);
  console.log("ALL OK"); await b.close();
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
