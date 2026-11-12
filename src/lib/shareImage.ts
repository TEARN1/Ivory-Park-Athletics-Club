import { publicName } from "./club";
import { fmtTime, ordinal, standings, type Session } from "./session";

/** Name shown in shared images and on the public page: first name + surname initial, or the bib. */
export const shareName = (r: { name: string; bib: string }) => (r.name.trim() ? publicName(r.name) : `Bib ${r.bib}`);

export interface ImageRow { place: string; name: string; time: string }
export function imageRows(s: Session, max = 12): ImageRow[] {
  return standings(s).slice(0, max).map((r) => ({ place: ordinal(r.rank), name: shareName(r.runner), time: fmtTime(r.elapsedMs) }));
}
const css = (name: string, dv: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || dv;

/** 1080x1350 PNG of the results in club colours. Public names only. */
export async function resultsImage(s: Session, logoSrc: string): Promise<Blob> {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!; await document.fonts?.ready;
  const navy = css("--p-navy", "#2a3090"), red = css("--p-hot", "#e81820"), disp = '"Barlow Condensed","Arial Narrow",sans-serif';
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  g.fillStyle = navy; g.fillRect(0, 0, W, 300); g.fillStyle = red; g.fillRect(0, 300, W, 14);
  try { const img = new Image(); img.src = logoSrc; await img.decode(); g.fillStyle = "#fff"; roundRect(g, 60, 60, 180, 180, 28); g.fill(); g.drawImage(img, 70, 70, 160, 160); } catch { /* no logo */ }
  g.fillStyle = "#fff"; g.font = `800 76px ${disp}`; g.fillText("IVORY PARK", 280, 140); g.fillText("ATHLETICS CLUB", 280, 215);
  g.font = `600 38px system-ui,sans-serif`; g.fillText(`${s.distanceKm} km · ${s.date}`, 280, 268);
  const rows = imageRows(s); let y = 410;
  g.fillStyle = "#14162b"; g.font = `700 54px ${disp}`; g.fillText("RESULTS", 60, 385); y = 470;
  for (const [i, r] of rows.entries()) {
    if (i % 2 === 0) { g.fillStyle = "#f2f3fa"; g.fillRect(40, y - 56, W - 80, 72); }
    g.fillStyle = i === 0 ? red : navy; g.font = `800 52px ${disp}`; g.fillText(r.place, 60, y);
    g.fillStyle = "#14162b"; g.font = `600 42px system-ui,sans-serif`; g.fillText(clip(g, r.name, 600), 220, y);
    g.font = `700 52px ${disp}`; g.textAlign = "right"; g.fillText(r.time, W - 60, y); g.textAlign = "left";
    y += 72;
  }
  if (!rows.length) { g.fillStyle = "#585c7e"; g.font = "500 40px system-ui,sans-serif"; g.fillText("No finishers recorded.", 60, y); }
  const more = standings(s).length - rows.length;
  g.fillStyle = "#585c7e"; g.font = "500 30px system-ui,sans-serif";
  g.fillText(more > 0 ? `+ ${more} more finisher${more > 1 ? "s" : ""}` : `${standings(s).length} finisher${standings(s).length === 1 ? "" : "s"}`, 60, H - 60);
  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("Could not make the image"))), "image/png"));
}
function clip(g: CanvasRenderingContext2D, t: string, w: number) { let s = t; while (s.length > 1 && g.measureText(s).width > w) s = s.slice(0, -2) + "…"; return s; }
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/** 1080x1350 PNG flyer for community event announcements across The Resident, The Grooves, and WhatsApp. */
export async function eventFlyerImage(ev: { title: string; date: string; time: string; distanceKm?: number; notes?: string }, logoSrc: string, qrSvgString?: string): Promise<Blob> {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!; await document.fonts?.ready;
  const navy = css("--p-navy", "#2a3090"), red = css("--p-hot", "#e81820"), disp = '"Barlow Condensed","Arial Narrow",sans-serif';
  
  // Background
  g.fillStyle = "#0c0f2a"; g.fillRect(0, 0, W, H);
  
  // Subtle top grid & gradient header
  const grad = g.createLinearGradient(0, 0, W, 400);
  grad.addColorStop(0, "#191e5c"); grad.addColorStop(1, "#0c0f2a");
  g.fillStyle = grad; g.fillRect(0, 0, W, 400);
  
  // Accent lines
  g.fillStyle = red; g.fillRect(0, 396, W, 10);
  
  // Logo
  try {
    const img = new Image(); img.src = logoSrc; await img.decode();
    g.fillStyle = "#ffffff"; roundRect(g, 70, 60, 200, 200, 30); g.fill();
    g.drawImage(img, 85, 75, 170, 170);
  } catch { /* no logo */ }
  
  // Club header text
  g.fillStyle = "#ffffff"; g.font = `800 80px ${disp}`; g.fillText("IVORY PARK", 310, 140);
  g.fillText("ATHLETICS CLUB", 310, 220);
  g.fillStyle = "#a5b4fc"; g.font = `700 36px ${disp}`; g.fillText("OFFICIAL COMMUNITY RUN & ATHLETICS EVENT", 310, 275);
  
  // Event Badge / Card
  g.fillStyle = "rgba(255, 255, 255, 0.06)";
  roundRect(g, 70, 440, W - 140, 480, 24); g.fill();
  g.strokeStyle = "rgba(163, 169, 255, 0.25)"; g.lineWidth = 2; g.stroke();
  
  // Event Title
  g.fillStyle = "#ffffff"; g.font = `800 68px ${disp}`;
  g.fillText(clip(g, ev.title.toUpperCase(), W - 200), 110, 530);
  
  // Details grid inside card
  g.fillStyle = red; g.font = `800 44px ${disp}`;
  g.fillText("DATE & TIME", 110, 610);
  g.fillStyle = "#ffffff"; g.font = `700 52px ${disp}`;
  g.fillText(`${ev.date} · ${ev.time}`, 110, 670);
  
  if (ev.distanceKm) {
    g.fillStyle = red; g.font = `800 44px ${disp}`;
    g.fillText("DISTANCE", 640, 610);
    g.fillStyle = "#ffffff"; g.font = `800 64px ${disp}`;
    g.fillText(`${ev.distanceKm} KM`, 640, 675);
  }
  
  // Notes / Meet Location
  g.fillStyle = "#a5b4fc"; g.font = `600 38px system-ui,sans-serif`;
  const locationText = ev.notes ? `Location: ${ev.notes}` : "Meet point: Ivory Park Athletics Hub / Freedom Drive";
  g.fillText(clip(g, locationText, W - 220), 110, 770);
  
  g.fillStyle = "#94a3b8"; g.font = `500 32px system-ui,sans-serif`;
  g.fillText("Water stations, pace rabbits (4:30, 5:30, 6:30/km) and safety marshals present.", 110, 840);
  
  // Community syndication banner
  g.fillStyle = "rgba(42, 48, 144, 0.4)";
  roundRect(g, 70, 950, W - 140, 160, 20); g.fill();
  g.strokeStyle = "rgba(232, 24, 32, 0.4)"; g.stroke();
  
  g.fillStyle = "#ffffff"; g.font = `700 36px ${disp}`;
  g.fillText("COMMUNITY BROADCAST SYNDICATION", 110, 1005);
  g.fillStyle = "#cbd5e1"; g.font = `500 30px system-ui,sans-serif`;
  g.fillText("Featured on The Resident · The Grooves Sports Hub · TEARN's Excellence", 110, 1055);
  
  // QR Code section
  if (qrSvgString) {
    try {
      const qrBlob = new Blob([qrSvgString], { type: "image/svg+xml" });
      const qrUrl = URL.createObjectURL(qrBlob);
      const qrImg = new Image(); qrImg.src = qrUrl; await qrImg.decode();
      g.fillStyle = "#ffffff"; roundRect(g, W - 230, H - 190, 150, 150, 16); g.fill();
      g.drawImage(qrImg, W - 220, H - 180, 130, 130);
      URL.revokeObjectURL(qrUrl);
    } catch { /* svg parse fallback */ }
  }
  
  // Footer text
  g.fillStyle = "#ffffff"; g.font = `700 36px ${disp}`;
  g.fillText("SCAN OR OPEN IVORY PARK ATHLETICS APP", 110, 1200);
  g.fillStyle = "#94a3b8"; g.font = `500 28px system-ui,sans-serif`;
  g.fillText("Free live GPS route tracking, runner bibs, split times, and live leaderboards.", 110, 1245);
  g.fillText("All runners, joggers, walkers, and youth welcomed.", 110, 1285);
  
  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("Could not make the flyer"))), "image/png"));
}

/** Share the image where the phone allows it, otherwise save it. */
export async function shareOrSave(blob: Blob, name: string): Promise<"shared" | "saved"> {
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "Ivory Park AC results" }); return "shared"; } catch (e) { if ((e as Error).name === "AbortError") return "shared"; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return "saved";
}
