// Browser check: countdown, laps, intervals, results image. Needs `vite preview` on :4173.
const { chromium } = require("playwright"); const assert = require("node:assert/strict"); const O = (process.argv[2] || ".") + "/";
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:4173/"); await p.waitForSelector("h1");
  await p.click("nav >> text=Club"); await p.click("button:text-is('3 s')"); await p.click("button:text-is('Every 1 min')");
  await p.click("nav >> text=Session"); await p.fill('[aria-label="How many runners"]', "3"); await p.click("text=Add 3 numbered runners");
  // laps
  await p.click("button:text-is('Laps')"); await p.getByLabel("Laps", { exact: true }).fill("2"); await p.getByLabel("Metres each").fill("400"); await p.click("text=/Use 2 x 400 m/");
  await p.waitForSelector("text=/0.8 km/");
  await p.click("text=/Start for 3 runners/"); await p.waitForSelector('[role=dialog][aria-label="Start countdown"]'); await p.waitForSelector("text=Laps · 2 x 400 m", { timeout: 6000 }); console.log("countdown ok");
  for (const r of ["1", "2", "1", "2", "3", "3"]) { await p.click(`[aria-label="Lap for #${r}"]`); await p.waitForTimeout(250); }
  await p.waitForSelector("text=See results"); await p.click("text=See results"); await p.waitForSelector("text=Lap times");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("text=Share results image")]); assert.match(dl.suggestedFilename(), /\.png$/); await dl.saveAs(O + "results.png"); console.log("laps + image ok");
  await p.screenshot({ path: O + "b2-laps-done.png", fullPage: true });
  // intervals: 2 reps, 3 s rest
  await p.click("text=New session, same runners"); await p.click("button:text-is('Intervals')");
  await p.getByLabel("Reps").fill("2"); await p.getByLabel("Metres each").fill("200"); await p.getByLabel("Rest (sec)").fill("3"); await p.click("text=/Use 2 x 200 m/");
  await p.click("text=/Start for 3 runners/"); await p.waitForSelector("text=Rep 1 of 2", { timeout: 6000 });
  for (const r of ["2", "1", "3"]) { await p.click(`[aria-label="Rep done for #${r}"]`); await p.waitForTimeout(200); }
  await p.waitForSelector("text=/^\\s*Rest/", { timeout: 3000 }); await p.screenshot({ path: O + "b2-rest.png" });
  await p.waitForSelector("text=Rep 2 of 2", { timeout: 8000 }); console.log("rest -> rep 2 ok");
  for (const r of ["1", "2"]) await p.click(`[aria-label="Rep done for #${r}"]`);
  await p.click("text=End rep 2"); await p.click("text=Yes"); await p.waitForSelector("text=Rep times"); await p.waitForSelector("text=New session, same runners");
  const table = await p.locator(".ipac-wtable").innerText(); assert.match(table, /#3[\s\S]*–/); console.log("intervals ok");
  await p.screenshot({ path: O + "b2-reps-done.png" });
  assert.deepEqual(errs, []); console.log("B2 OK"); await b.close();
})().catch((e) => { console.error("FAIL", e.message.split("\n")[0]); process.exit(1); });
