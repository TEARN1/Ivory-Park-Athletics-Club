import { publicName, type ClubData, type ClubEvent, type News, type Sponsor } from "./club";
import { fmtTime, ordinal, standings, type Session } from "./session";

/** What the coach publishes to the club web page. Never names in full, never contacts, notes or ages. */
export interface PublicResult { id: string; date: string; distanceKm: number; rows: { place: string; name: string; time: string }[] }
export interface PublicBundle { events: ClubEvent[]; news: News[]; sponsors: Sponsor[]; results: PublicResult[]; at: number }

const nameFor = (r: { name: string; bib: string }) => (r.name.trim() ? publicName(r.name) : `Bib ${r.bib}`);
export function buildBundle(club: ClubData, history: Session[], today: string, now = Date.now()): PublicBundle {
  const results = history.filter((s) => (s.mode ?? "race") === "race" && standings(s).length)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
    .map((s) => ({ id: s.id, date: s.date, distanceKm: s.distanceKm, rows: standings(s).slice(0, 100).map((r) => ({ place: ordinal(r.rank), name: nameFor(r.runner), time: fmtTime(r.elapsedMs) })) }));
  return {
    events: club.events.filter((e) => e.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 20),
    news: [...club.news].sort((a, b) => b.at - a.at).slice(0, 10), sponsors: club.sponsors.slice(0, 20), results, at: now,
  };
}

/* ---------- server side: trust nothing that arrives ---------- */
const str = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const httpUrl = (u: unknown) => { const s = str(u, 300); try { return ["http:", "https:"].includes(new URL(s).protocol) ? s : undefined; } catch { return undefined; } };
const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : undefined);
const arr = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n) : []);
export function sanitizeBundle(raw: any): PublicBundle {
  return {
    at: Number.isFinite(raw?.at) ? raw.at : Date.now(),
    events: arr(raw?.events, 20).flatMap((e: any) => { const d = date(e?.date); return d && str(e?.title, 80) ? [{ id: str(e.id, 60), date: d, time: /^\d{2}:\d{2}$/.test(e?.time) ? e.time : "", title: str(e.title, 80), distanceKm: Number(e.distanceKm) > 0 && Number(e.distanceKm) <= 200 ? Number(e.distanceKm) : undefined, notes: str(e.notes, 300) || undefined }] : []; }),
    news: arr(raw?.news, 10).flatMap((n: any) => (str(n?.title, 100) ? [{ id: str(n.id, 60), at: Number(n.at) || 0, title: str(n.title, 100), body: str(n.body, 2000), photo: typeof n.photo === "string" && n.photo.length < 400_000 && PHOTO.test(n.photo) ? n.photo : undefined }] : [])),
    sponsors: arr(raw?.sponsors, 20).flatMap((s: any) => (str(s?.name, 60) ? [{ id: str(s.id, 60), name: str(s.name, 60), url: httpUrl(s.url) }] : [])),
    results: arr(raw?.results, 10).flatMap((r: any) => { const d = date(r?.date); return d ? [{ id: str(r.id, 60), date: d, distanceKm: Number(r.distanceKm) || 0, rows: arr(r.rows, 100).map((x: any) => ({ place: str(x?.place, 6), name: publicName(str(x?.name, 80)) || "Runner", time: str(x?.time, 10) })) }] : []; }),
  };
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>:root{--n:#2a3090;--r:#e81820;--bg:#f2f3fa;--fg:#14162b;--mu:#585c7e;--card:#fff}@media(prefers-color-scheme:dark){:root{--bg:#0b0c1a;--fg:#eceefb;--mu:#a7abd0;--card:#15173a}}
*{box-sizing:border-box}body{margin:0;font:17px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}header{background:var(--n);color:#fff;border-bottom:5px solid var(--r);padding:22px 16px}header h1{margin:0;font:800 1.9rem/1.05 "Arial Narrow",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.02em}header p{margin:6px 0 0;opacity:.85}
main{max-width:720px;margin:0 auto;padding:16px;display:grid;gap:16px}section{background:var(--card);border-radius:16px;padding:16px}h2{margin:0 0 10px;font:800 1.3rem "Arial Narrow",system-ui,sans-serif;text-transform:uppercase}
ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}small,.mu{color:var(--mu)}img{max-width:100%;border-radius:12px}a{color:inherit}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}td,th{padding:8px 6px;border-bottom:1px solid rgba(127,127,160,.25);text-align:left}td:last-child,th:last-child{text-align:right}.pl{font-weight:800;color:var(--r)}</style></head><body>${body}</body></html>`;

export function renderClubPage(b: PublicBundle | undefined, counts: Record<string, number>): string {
  const head = `<header><h1>Ivory Park Athletics Club</h1><p>Est. 2015 · Ivory Park</p></header>`;
  if (!b) return page("Ivory Park Athletics Club", `${head}<main><section><p>The club page has not been published yet.</p></section></main>`);
  const events = b.events.length ? `<ul>${b.events.map((e) => `<li><b>${esc(e.title)}</b><br><small>${esc(e.date)}${e.time ? ` · ${esc(e.time)}` : ""}${e.distanceKm ? ` · ${e.distanceKm} km` : ""} · ${counts[e.id] ?? 0} coming</small>${e.notes ? `<br>${esc(e.notes)}` : ""}</li>`).join("")}</ul>` : `<p class="mu">No upcoming events.</p>`;
  const news = b.news.map((n) => `<article><h3>${esc(n.title)}</h3><small>${new Date(n.at).toISOString().slice(0, 10)}</small>${n.photo ? `<p><img src="${n.photo}" alt=""></p>` : ""}<p>${esc(n.body).replace(/\n/g, "<br>")}</p></article>`).join("");
  const results = b.results.length ? `<ul>${b.results.map((r) => `<li><a href="/club/results/${encodeURIComponent(r.id)}"><b>${esc(r.date)} · ${r.distanceKm} km</b></a><br><small>${r.rows.length} finisher${r.rows.length === 1 ? "" : "s"} · 1st ${esc(r.rows[0]?.name ?? "")} ${esc(r.rows[0]?.time ?? "")}</small></li>`).join("")}</ul>` : `<p class="mu">No results yet.</p>`;
  const sponsors = b.sponsors.length ? `<section><h2>Sponsors</h2><ul>${b.sponsors.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}" rel="noopener nofollow">${esc(s.name)}</a>` : esc(s.name)}</li>`).join("")}</ul></section>` : "";
  return page("Ivory Park Athletics Club", `${head}<main><section><h2>Coming up</h2>${events}<p class="mu">Open the club app to say you're coming.</p></section>${news ? `<section><h2>News</h2>${news}</section>` : ""}<section><h2>Latest results</h2>${results}</section>${sponsors}<p class="mu">Results show first names and surname initials only.</p></main>`);
}
export function renderResultsPage(b: PublicBundle | undefined, id: string): string | undefined {
  const r = b?.results.find((x) => x.id === id); if (!r) return undefined;
  return page(`Results ${r.date}`, `<header><h1>Results · ${r.distanceKm} km</h1><p>${esc(r.date)} · Ivory Park Athletics Club</p></header><main><section><table><thead><tr><th>Place</th><th>Runner</th><th>Time</th></tr></thead><tbody>${r.rows.map((x) => `<tr><td class="pl">${esc(x.place)}</td><td>${esc(x.name)}</td><td>${esc(x.time)}</td></tr>`).join("")}</tbody></table></section><p class="mu"><a href="/club">Back to the club page</a></p></main>`);
}
