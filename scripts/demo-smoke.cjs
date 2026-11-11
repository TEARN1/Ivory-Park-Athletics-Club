// Browser check: demo track at 20x speed: laps, standings, stopped-runner alert. Needs vite preview on :4173.
const { chromium } = require("playwright"); const assert = require("node:assert/strict");
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:4173/"); await p.waitForSelector("h1"); await p.click("nav >> text=Map"); await p.click(".ipac-seg >> button:text-is('Demo')");
  await p.click("button:text-is('20× speed')"); await p.click("text=Start the demo"); await p.waitForTimeout(17000);
  console.log("clock", await p.locator(".ipac-demo-clock").innerText()); console.log((await p.locator(".ipac-board").innerText()).replace(/\n+/g, " | "));
  await p.waitForSelector("text=/Check on 1/", { timeout: 5000 }); console.log("alert shown for runner E");
  console.log("street map:", await p.locator(".ipac-mlmap canvas").count(), "pins:", await p.locator(".ipac-pin").count());
  await p.screenshot({ path: process.argv[2] + "/shots/demo.png" }); assert.deepEqual(errs, []); console.log("DEMO OK"); await b.close(); })().catch((e) => { console.error("FAIL", e.message.split("\n")[0]); process.exit(1); });
