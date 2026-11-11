// Droplet layout check. Run: VITE_SERVER_URL=same-origin npx vite build --outDir <dir>; server on :8787 (COACH_TOKEN=secret); node scripts/caddy-standin.cjs <dir>; then this.
const { chromium } = require("playwright"); const assert = require("node:assert/strict"); const O = "http://localhost:4180/";
(async () => { const b = await chromium.launch(); const mk = async () => { const p = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message)); await p.goto(O); await p.waitForSelector("h1"); return p; };
  const coach = await mk();
  await coach.click("nav >> text=Club"); 
  await coach.click("summary:text('Club server settings')"); await coach.fill('[aria-label="Coach token"]', "secret"); assert.equal(await coach.inputValue('[aria-label="Server address"]'), "http://localhost:4180", "server address built in"); await coach.click("button:text-is('Save')");
  await coach.click("nav >> text=Session"); await coach.click("text=Open for joiners"); const link = await coach.inputValue('[aria-label="Join link"]'); assert.match(link, /^http:\/\/localhost:4180\/\?join=/); console.log("join link uses the droplet address");
  const runner = await mk(); await runner.goto(link); await runner.fill('[aria-label="Your name"]', "Naledi"); await runner.click("text=Join this run"); await runner.waitForSelector("text=You're in");
  await coach.waitForSelector(".ipac-roster b:text-is('Naledi')", { timeout: 20000 }); console.log("runner joined with no set-up");
  await coach.click("nav >> text=Map"); await coach.fill('input[placeholder="e.g. IPARK"]', "IPARK"); await coach.click("button:text-is('Join room')"); await coach.waitForSelector("text=Connection: on"); console.log("live room over the same address (WebSocket through the proxy)");
  const club = await (await fetch(O + "club")).text(); assert.match(club, /Ivory Park Athletics Club/); console.log("club page at /club");
  assert.deepEqual([...coach.errs, ...runner.errs], []); console.log("SAME-ORIGIN OK"); await b.close(); })().catch((e) => { console.error("FAIL", e.message.split("\n")[0]); process.exit(1); });
