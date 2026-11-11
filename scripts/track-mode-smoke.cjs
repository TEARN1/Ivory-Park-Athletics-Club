// Browser check: learn a track from one lap of (mock) GPS, then auto-count laps; marker boards on the road. ~4 minutes.
const { chromium } = require("playwright"); const assert = require("node:assert/strict");
const R = 6378137, toRad = Math.PI / 180;
function dest(p, brg, m) { const d = m / R, b = brg * toRad, la = p.lat * toRad, lo = p.lon * toRad; const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b)); return { lat: la2 / toRad, lon: (lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2))) / toRad }; }
const C = { lat: -25.99, lon: 28.205 }, B = 25, R1 = 36.8, H = 84.39 / 2, BEND = Math.PI * R1;
function at(s0) { const s = ((s0 % 400) + 400) % 400; let u, v;
  if (s < 84.39) { u = s - H; v = -R1; } else if (s < 84.39 + BEND) { const t = (s - 84.39) / R1 - Math.PI / 2; u = H + R1 * Math.cos(t); v = R1 * Math.sin(t); }
  else if (s < 2 * 84.39 + BEND) { u = H - (s - 84.39 - BEND); v = R1; } else { const t = (s - 2 * 84.39 - BEND) / R1 + Math.PI / 2; u = -H + R1 * Math.cos(t); v = R1 * Math.sin(t); }
  return dest(dest(C, B, u), B - 90, v); }
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, geolocation: { latitude: at(0).lat, longitude: at(0).lon, accuracy: 4 }, permissions: ["geolocation"] }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:4173/"); await p.waitForSelector("h1"); await p.fill('[aria-label="Name"]', "Thandi"); await p.click("button:text-is('Add runner')");
  await p.click("nav >> text=Map"); await p.selectOption("select:visible >> nth=0", "1"); await p.check("text=Track my run with GPS"); await p.click("button:text-is('Track')");
  let s = 0; const step = async () => { s += 8; const q = at(s); await ctx.setGeolocation({ latitude: q.lat, longitude: q.lon, accuracy: 4 }); await p.waitForTimeout(1000); };
  for (let i = 0; i < 52; i++) await step();                                     // one lap (416 m)
  await p.click("button:text-is('Learn this track')"); await p.waitForSelector("text=/Track saved/"); console.log(await p.locator("text=/Track saved/").innerText());
  for (let i = 0; i < 100; i++) await step();                                    // two more laps
  const dist = await p.locator(".ipac-dist b").innerText(), laps = await p.locator(".ipac-laps li").allInnerTexts();
  console.log("distance shown:", dist, "true:", s, "m | laps:", laps.join(" / "));
  assert.ok(laps.length >= 2, "laps counted automatically"); assert.ok(Math.abs(parseInt(dist.replace(/\s/g, "")) - s) < 20, "distance within 20 m");
  // road boards
  await p.click("button:text-is('Road')"); await p.selectOption('[aria-label="Distance between boards"]', "500"); await p.click("text=/I'm at the 500 m board/");
  await p.waitForSelector("text=/from the 500 m board/"); console.log("marker:", await p.locator(".ipac-dist").innerText());
  assert.deepEqual(errs, []); console.log("TRACK MODE OK"); await b.close();
})().catch((e) => { console.error("FAIL", e.message.split("\n")[0]); process.exit(1); });
