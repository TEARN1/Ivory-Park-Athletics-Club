import { useState } from "react";
import { closeProgram, joinLink, openProgram, qrSvg } from "../lib/join";
import * as S from "../lib/session";
import type { Config } from "../lib/store";
import { Confirm } from "../ui";

/** Coach: open today's run for joiners and share a link or QR code. */
export default function JoinPanel({ s, act, cfg, bare }: { s: S.Session; act: (f: (x: S.Session) => S.Session) => void; cfg: Config; bare?: boolean }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [copied, setCopied] = useState(false);
  const ready = !!(cfg.serverUrl && cfg.token), code = s.program?.code;
  const link = code ? joinLink(location.origin + location.pathname, code, cfg.serverUrl) : "";
  const joined = s.runners.filter((r) => r.joinId).length;
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(""); try { await f(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setErr("Could not copy. Press and hold the link to copy it."); } };
  const Wrap = bare ? "div" : "section";
  return (
    <Wrap className={bare ? "ipac-join" : "ipac-card ipac-join"}>
      <h2>Let runners join</h2>
      {!ready ? <p className="ipac-hint">Joining needs the club server and your coach token. Add them in the Club tab.</p>
        : !code ? (<>
          <p className="ipac-hint">Open today's {s.distanceKm} km run. Runners scan a QR code or tap a link, type their name, and get a bib number here.</p>
          <button className="ipac-btn ipac-btn-primary ipac-btn-wide" disabled={busy} onClick={() => run(async () => { const r = await openProgram(cfg.serverUrl, cfg.token, s.date, s.distanceKm); act((x) => S.setProgram(x, r.code)); })}>{busy ? "Opening…" : "Open for joiners"}</button>
        </>) : (<>
          <p className="ipac-joinhead"><b>Open for joiners</b> · code <b className="ipac-code">{code}</b> · <b>{joined}</b> joined</p>
          <div className="ipac-qr" role="img" aria-label="QR code to join today's run" dangerouslySetInnerHTML={{ __html: qrSvg(link) }} />
          <input className="ipac-link" readOnly aria-label="Join link" value={link} onFocus={(e) => e.currentTarget.select()} />
          <div className="ipac-row2">
            <button className="ipac-btn ipac-btn-outline" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
            {typeof navigator.share === "function" && <button className="ipac-btn ipac-btn-outline" onClick={() => navigator.share({ title: "Join today's run", url: link }).catch(() => {})}>Share</button>}
            <Confirm label="Close joining" ask="Close joining?" aria="Close joining" onYes={() => run(async () => { await closeProgram(cfg.serverUrl, cfg.token, code); act((x) => S.setProgram(x)); })} />
          </div>
          <p className="ipac-hint">New runners appear in your list with the next free bib. Joining closes when you start the race.</p>
        </>)}
      {err && <p role="alert" className="ipac-err">{err}</p>}
    </Wrap>
  );
}
