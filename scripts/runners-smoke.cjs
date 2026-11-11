const { chromium } = require("playwright"); const O = process.argv[2] + "/shots/"; const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 })).newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:4173/"); await p.waitForSelector("h1"); await p.click("nav >> text=Runners");
  const ensureOpen = async () => { if (!(await p.locator("details.ipac-more[open]").count())) await p.click("summary:has-text('Add a runner')"); };
  const add = async (n, g, y, bib) => { await ensureOpen(); const d = p.locator("details.ipac-more"); await d.getByLabel("Full name").fill(n); await d.getByLabel("Gender").selectOption(g); await d.getByLabel("Birth year").fill(y); await d.getByLabel("Usual bib").fill(bib); await d.locator("button:text-is('Add runner')").click(); };
  await add("Thandi Mokoena", "F", "1990", "11"); await add("Sipho Dlamini", "M", "2011", "12"); await add("Lerato Khumalo", "F", "1978", "");
  await p.waitForSelector("text=Consent needed");
  await p.click("nav >> text=Session"); await p.waitForSelector("text=/Check in 2 club runners/"); await p.waitForSelector("text=/Sipho Dlamini\\./");
  await p.click("text=/Check in 2 club runners/"); assert.ok(await p.locator(".ipac-roster b:text-is('Thandi Mokoena')").count());
  await p.fill('[aria-label="Name"]', "Sipho Dlamini"); await p.click("button:text-is('Add runner')"); await p.waitForSelector("[role=alert]:has-text('under 18')"); console.log("consent block ok");
  for (const order of [["Lerato Khumalo", "Thandi Mokoena"], ["Thandi Mokoena", "Lerato Khumalo"]]) {
    await p.click("text=/Start for 2 runner/"); await p.waitForTimeout(1100);
    for (const n of order) { await p.click(`.ipac-tile:has-text("${n}")`); await p.waitForTimeout(1100); }
    await p.click("text=See results"); await p.click("text=New session, same runners");
  }
  await p.click("nav >> text=Runners"); await p.click('[aria-label="Open Thandi Mokoena"]'); await p.waitForSelector("text=Personal bests");
  await p.screenshot({ path: O + "b1-profile.png", fullPage: true });
  await p.fill('[aria-label="New coach note"]', "Strong finish."); await p.click("text=Add note"); await p.waitForSelector("text=Strong finish.");
  await p.click("text=‹ All runners"); await p.click("button:text-is('League')"); await p.screenshot({ path: O + "b1-league.png" });
  const lg = await p.locator(".ipac-board").innerText(); assert.match(lg, /Thandi Mokoena[\s\S]*20/); console.log("league ok");
  await p.click("button:text-is('Records')"); await p.waitForSelector("text=Overall"); await p.click("button:text-is('Runners')"); await p.screenshot({ path: O + "b1-list.png" });
  assert.deepEqual(errs, []); console.log("B1 OK"); await b.close();
})().catch((e) => { console.error("FAIL", e.message.split("\n")[0]); process.exit(1); });
