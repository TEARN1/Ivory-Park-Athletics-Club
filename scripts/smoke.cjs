// End-to-end smoke test. Needs: server on :8787 (COACH_TOKEN=secret) and `vite preview` on :4173.
const { chromium } = require("playwright"); const assert = require("node:assert/strict");
const APP = "http://localhost:4173/", SRV = "http://localhost:8787";
const openLive = async (p) => { await p.click("nav >> text=Map"); await p.click(".ipac-seg >> button:text-is('Live')"); };
const openRoutes = async (p) => { await p.click("nav >> text=Map"); await p.click(".ipac-seg >> button:text-is('Routes')"); };
async function addRunner(p, name, bib) { await p.fill('[aria-label="Name"]', name); await p.fill('[aria-label="Bib number"]', bib); await p.click("text=Add runner"); }
async function setup(browser, name, server, token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, geolocation: { latitude: -25.9967, longitude: 28.2 }, permissions: ["geolocation"], acceptDownloads: true });
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(APP); await p.waitForSelector("h1");
  await p.click("nav >> text=Club"); await p.fill('[aria-label="Server address"]', server); if (token) await p.fill('[aria-label="Coach token"]', token); await p.click("button:text-is('Save')");
  await p.click("nav >> text=Session"); await addRunner(p, "Thandi", "1"); await addRunner(p, "Sipho", "2");
  return { ctx, p };
}
(async () => {
  const b = await chromium.launch();
  const coach = await setup(b, "coach", SRV, "secret"), runner = await setup(b, "runner", SRV, "");
  // Relay: coach opens room and sets lead; runner 2 joins, lead 1 passes, 2 takes
  for (const [who, me] of [[coach, ""], [runner, "2"]]) {
    await openLive(who.p); if (me) await who.p.selectOption('select:visible >> nth=0', me); await who.p.fill('input[placeholder="e.g. IPARK"]', "IPARK"); await who.p.click("text=Join room");
    await who.p.waitForSelector("text=Connection: on");
  }
  await coach.p.selectOption('[aria-label="Set lead"]', "1");
  await runner.p.waitForSelector(".ipac-lead >> text=#1 Thandi");
  assert.equal(await runner.p.locator("button:text-is('Take')").isDisabled(), true, "Take must wait for an offer");
  // Thandi's device
  const t = await setup(b, "t", SRV, ""); await openLive(t.p); await t.p.selectOption('select:visible >> nth=0', "1"); await t.p.fill('input[placeholder="e.g. IPARK"]', "IPARK"); await t.p.click("text=Join room"); await t.p.waitForSelector("text=Connection: on");
  await t.p.click("text=Pass Over");
  await runner.p.waitForSelector("text=is passing the lead");
  await runner.p.click("button:text-is('Take')");
  await coach.p.waitForSelector(".ipac-lead >> text=#2 Sipho"); console.log("relay ok");
  // GPS + splits on the runner device (mock a ~1.2 km walk)
  await runner.p.click("nav >> text=Session"); await runner.p.click("text=/Start for 2 runner/"); await openLive(runner.p); await runner.p.check("text=Track my run with GPS");
  for (let i = 0; i < 6; i++) { await runner.ctx.setGeolocation({ latitude: -25.9967 + i * 0.0022, longitude: 28.2 }); await runner.p.waitForTimeout(300); }
  console.log("gps:", (await runner.p.locator("text=/\\d+\\.\\d+ km · \\d+ points/").first().innerText()));
  // finish, edit, csv, archive + upload
  await runner.p.click("nav >> text=Session"); await runner.p.click('[aria-label="Finish #2 Sipho"]'); await runner.p.click("text=Undo"); await runner.p.click('[aria-label="Finish #2 Sipho"]');
  await runner.p.click("text=End session"); await runner.p.click("text=Yes");
  await runner.p.click('[aria-label="Fix time for #2 Sipho"]'); await runner.p.fill('[aria-label="New time"]', "9:30"); await runner.p.click("button:text-is('OK')");
  assert.match(await runner.p.innerText(".ipac-board"), /9:30/);
  const [dl] = await Promise.all([runner.p.waitForEvent("download"), runner.p.click("text=Download CSV")]); console.log("csv:", dl.suggestedFilename());
  // sync needs a coach token on the client: runner has none, so the upload stays queued
  await runner.p.click("text=New session, same runners"); await runner.p.waitForSelector("text=/1 saved session/");
  // coach: sync a session, notice reaches the runner, guest list, routes
  await coach.p.click("nav >> text=Session"); await coach.p.click("text=/Start for 2 runner/"); await coach.p.click('[aria-label="Finish #1 Thandi"]');
  await coach.p.click("text=End session"); await coach.p.click("text=Yes"); await coach.p.waitForSelector("text=New session, same runners"); await coach.p.waitForTimeout(800);
  const uploaded = await (await fetch(SRV + "/sessions", { headers: { authorization: "Bearer secret" } })).json(); assert.equal(uploaded.length, 1); assert.equal(uploaded[0].tracks, undefined); console.log("sync ok (tracks stripped)");
  await coach.p.click("nav >> text=Club"); await coach.p.fill('[aria-label="New notice"]', "Time trial Saturday"); await coach.p.click("text=Send notice");
  await runner.p.click("nav >> text=Club"); await runner.p.waitForSelector("text=Time trial Saturday", { timeout: 70000 }).catch(() => { throw new Error("notice did not reach runner"); }); console.log("notice ok");
  await coach.p.fill('[aria-label="Guest name"]', "Visitor"); assert.equal(await coach.p.locator("text=Join guest list").isDisabled(), true); await coach.p.check("text=I agree the club may contact me"); await coach.p.click("text=Join guest list");
  await coach.p.waitForSelector("text=Visitor ·"); console.log("guest ok");
  await openRoutes(coach.p); await coach.p.click("text=Generate 15 loops"); await coach.p.waitForSelector("svg[aria-label^='Map of']");
  const len = await coach.p.locator("text=/option 1 of 15/").innerText(); await coach.p.selectOption("select:visible >> nth=0", "90").catch(() => {});
  await coach.p.click("text=Reroute"); console.log("routes:", len.slice(0, 40), "→", (await coach.p.locator("text=/option \\d+ of 15/").innerText()).slice(-20));
  await coach.p.fill('[aria-label="Route name"]', "Ivory Park 5k Loop"); await coach.p.click("text=Save this route"); await coach.p.waitForSelector("text=Saved routes");
  await coach.p.screenshot({ path: process.argv[2] + "/routes.png" });
  // ---- join by link / QR, and by picking today's run ----
  await coach.p.click("nav >> text=Session"); await coach.p.click("text=New session, same runners"); await coach.p.click("text=Open for joiners");
  const link = await coach.p.inputValue('[aria-label="Join link"]'); assert.match(link, /\?join=[A-Z0-9]{5}&server=/); assert.ok(await coach.p.locator('[aria-label="QR code to join today\'s run"] svg').count(), "QR shown");
  const j1 = await b.newContext({ viewport: { width: 390, height: 800 } }); const jp = await j1.newPage(); jp.errs = []; jp.on("pageerror", (e) => jp.errs.push(e.message));
  await jp.goto(link); await jp.waitForSelector("text=Today's runs"); await jp.waitForSelector("text=/Joining through/");
  assert.equal(await jp.locator("button:text-is('Join this run')").isDisabled(), true, "needs a name");
  await jp.fill('[aria-label="Your name"]', "Naledi"); await jp.click("text=Join this run"); await jp.waitForSelector("text=You're in"); console.log("joiner in"); const t0 = Date.now();
  await coach.p.waitForSelector(".ipac-roster b:text-is('Naledi')", { timeout: 30000 }).catch(async (e) => { console.log(JSON.stringify(await coach.p.locator("text=Naledi").evaluateAll((els) => els.map((e) => [e.tagName, e.offsetParent !== null, e.outerHTML.slice(0, 90)])))); await coach.p.screenshot({ path: process.argv[2] + "/coachfail.png" }); throw e; }); console.log("coach sees Naledi after", Date.now() - t0, "ms");                       // appears in the coach's roster
  await jp.waitForSelector('[aria-label^="Your bib number is"]', { timeout: 15000 }); console.log("link join ok, bib:", await jp.locator(".ipac-bigbib").innerText());
  const j2 = await b.newContext({ viewport: { width: 390, height: 800 } }); const lp = await j2.newPage(); lp.errs = [];
  await lp.goto(APP); await lp.waitForSelector("h1"); await lp.click("nav >> text=Club"); await lp.fill('[aria-label="Server address"]', SRV); await lp.click("button:text-is('Save')"); await lp.reload();
  await lp.waitForSelector("text=Today's runs"); await lp.waitForSelector("text=/5 km run/"); await lp.fill('[aria-label="Your name"]', "Themba"); await lp.click("text=Join this run"); await lp.waitForSelector("text=You're in");
  await coach.p.waitForSelector(".ipac-roster b:text-is('Themba')", { timeout: 30000 }); console.log("pick-from-list join ok");
  // status button -> dialog -> start race closes joining
  await coach.p.click('[aria-label^="Session status"]'); await coach.p.waitForSelector('[role=dialog][aria-label="Session status"]');
  await coach.p.keyboard.press("Escape"); assert.equal(await coach.p.locator("[role=dialog]").count(), 0, "Escape closes the sheet");
  await coach.p.click('[aria-label^="Session status"]'); await coach.p.click("text=Start race"); await coach.p.waitForSelector("text=Race clock");
  await coach.p.waitForTimeout(800); assert.deepEqual(await (await fetch(SRV + "/programs?date=" + new Date().toLocaleDateString("en-CA"))).json(), [], "joining closed at start"); console.log("status sheet + close-on-start ok");
  const late = await j2.newPage(); await late.goto(APP); await late.waitForSelector("text=You're in"); // joined state survives reload
  // themes and distances
  await coach.p.click("nav >> text=Club"); await coach.p.click("button:text-is('Night')"); assert.equal(await coach.p.evaluate(() => document.documentElement.dataset.theme), "dark");
  await coach.p.click("button:has-text('Pitch')"); assert.equal(await coach.p.evaluate(() => document.documentElement.dataset.palette), "pitch");
  await coach.p.fill('[aria-label="Distance shortcuts"]', "2.4, abc"); await coach.p.click("text=Save shortcuts"); await coach.p.waitForSelector("[role=alert]:has-text('abc')");
  await coach.p.fill('[aria-label="Distance shortcuts"]', "2.4, 8"); await coach.p.click("text=Save shortcuts"); await openRoutes(coach.p); await coach.p.waitForSelector("button:text-is('2.4 km')");
  await coach.p.click('[aria-label="Switch to day theme"]'); assert.equal(await coach.p.evaluate(() => document.documentElement.dataset.theme), "light"); console.log("themes + distances ok");
  assert.deepEqual(jp.errs, []);
  // ---- batch 3: live map, shared timing, events, club page, backup ----
  await openLive(coach.p); await coach.p.waitForSelector('svg[aria-label^="Map with"]', { timeout: 15000 }); console.log("live map shows runners");
  await coach.p.click("button:text-is('Leave room')"); await coach.p.fill('input[placeholder="e.g. IPARK"]', "RACE2"); await coach.p.click("button:text-is('Join room')"); await coach.p.waitForSelector("text=Connection: on");
  await coach.p.check("text=Share timing with other timekeepers");
  const tk2 = await setup(b, "tk2", SRV, "secret"); await openLive(tk2.p); await tk2.p.fill('input[placeholder="e.g. IPARK"]', "RACE2"); await tk2.p.click("button:text-is('Join room')"); await tk2.p.waitForSelector("text=Connection: on");
  await tk2.p.check("text=Share timing with other timekeepers");
  await tk2.p.click("nav >> text=Session"); await tk2.p.waitForSelector("text=Race clock", { timeout: 10000 });                    // the shared start reached the second phone
  await tk2.p.fill('[aria-label="Finish by bib number"]', "2"); await tk2.p.click("button:text-is('Finish')");
  await coach.p.click("nav >> text=Session"); await coach.p.waitForSelector(".ipac-board >> text=#2 Sipho", { timeout: 10000 }); console.log("second timekeeper's finish reached the coach");
  await coach.p.fill('[aria-label="Finish by bib number"]', "77"); await coach.p.click("button:text-is('Finish')");
  await tk2.p.waitForSelector(".ipac-board >> text=#77", { timeout: 10000 }); console.log("shared timing both ways ok");
  await coach.p.click("nav >> text=Club"); await coach.p.getByLabel("What").fill("Saturday time trial"); await coach.p.getByLabel("km", { exact: true }).fill("5"); await coach.p.click("button:text-is('Add event')");
  await coach.p.waitForTimeout(3500);                                                                                           // auto-publish
  await lp.click("nav >> text=Today"); await lp.reload(); await lp.waitForSelector("text=Coming up", { timeout: 10000 });
  if (await lp.locator('[aria-label="Your name for events"]').count()) await lp.fill('[aria-label="Your name for events"]', "Themba");
  await lp.click("button:text-is(\"I'm coming\")"); await lp.waitForSelector("text=/1 coming/");
  const club = await (await fetch(SRV + "/club")).text(); assert.match(club, /Saturday time trial/); assert.match(club, /1 coming/); console.log("events + club page ok");
  await coach.p.click('[aria-label="Who is coming to Saturday time trial"]'); await coach.p.waitForSelector("small:text-is('Themba')");
  const [bk] = await Promise.all([coach.p.waitForEvent("download"), coach.p.click("text=Download backup")]);
  const bf = require("node:fs").readFileSync(await bk.path(), "utf8"); assert.equal(JSON.parse(bf).app, "ipac"); assert.ok(!bf.includes("secret"), "token never in backup"); console.log("backup ok");
  assert.deepEqual(tk2.p.errs, []);
  for (const x of [coach, runner, t]) assert.deepEqual(x.p.errs, []);
  console.log("ALL OK"); await b.close();
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
