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
/** Share the image where the phone allows it, otherwise save it. */
export async function shareOrSave(blob: Blob, name: string): Promise<"shared" | "saved"> {
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "Ivory Park AC results" }); return "shared"; } catch (e) { if ((e as Error).name === "AbortError") return "shared"; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return "saved";
}
