import { useCallback, useEffect, useRef, useState } from "react";
import logo from "./assets/logo.jpg";
import { assignBibs, closeProgram, fetchJoiners, parseJoinParams, qrSvg } from "./lib/join";
import { useLive, wsUrl, type LiveJoin, type Notice } from "./lib/live";
import { addPositions, type Trail } from "./lib/livemap";
import type { Route } from "./lib/routes";
import { applyShared, localChanges } from "./lib/timing";
import { applyPrefs, defaultPrefs, timeCallDue, type Prefs } from "./lib/prefs";
import { beep, say } from "./lib/sound";
import * as W from "./lib/workout";
import * as S from "./lib/session";
import * as C from "./lib/club";
import { archive, flushOutbox, kvGet, kvSet, loadRoutes, loadClub, loadConfig, loadHistory, loadPrefs, loadSession, pendingCount, saveClub, savePrefs, saveSession, type Config } from "./lib/store";
import { localDate } from "./lib/join";
import Runners from "./tabs/Runners";
import Club from "./tabs/Club";
import type { PublishState } from "./tabs/ClubAdmin";
import { buildBundle } from "./lib/publicSite";
import JoinPanel from "./tabs/JoinPanel";
import Live from "./tabs/Live";
import Routes from "./tabs/Routes";
import Session from "./tabs/Session";
import Today from "./tabs/Today";
import Demo from "./tabs/Demo";
import TeamDispatch from "./tabs/TeamDispatch";
import { Confirm, Icons } from "./ui";

type Tab = "today" | "session" | "runners" | "map" | "dispatch" | "club";
const NAV: [Tab, string][] = [
  ["today", "Today"],
  ["session", "Session"],
  ["runners", "Runners"],
  ["map", "Map"],
  ["dispatch", "Team Hub"],
  ["club", "Club"],
];
const PHASE_LABEL = { setup: "Setting up", running: "Race on", done: "Finished" };
const STAGES: [S.Phase, string][] = [["setup", "Set up"], ["running", "Race on"], ["done", "Results"]];
const deepLink = parseJoinParams(location.search);
const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export default function App() {
  const [s, setS] = useState<S.Session | null>(null), [tab, setTab] = useState<Tab>(deepLink ? "today" : "session"), [now, setNow] = useState(Date.now());
  const [err, setErr] = useState(""), [pending, setPending] = useState(0), [cfg, setCfg] = useState<Config>({ serverUrl: "", token: "" }), [notices, setNotices] = useState<Notice[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(defaultPrefs()), [sheet, setSheet] = useState(false), [mapView, setMapView] = useState<"live" | "routes" | "demo">("live");
  const [club, setClubState] = useState<C.ClubData>(C.emptyClub()), [history, setHistory] = useState<S.Session[]>([]);
  const clubRef = useRef(club); clubRef.current = club;
  const [countdown, setCountdown] = useState<number | null>(null), lastTick = useRef(0);
  const [liveJoin, setLiveJoinState] = useState<LiveJoin | null>(null), [trail, setTrail] = useState<Trail>({}), [routes, setRoutes] = useState<Route[]>([]);
  const setLiveJoin = (j: LiveJoin | null) => { setLiveJoinState(j); kvSet("liveJoin", j); };
  const live = useLive(liveJoin && cfg.serverUrl ? wsUrl(cfg.serverUrl, liveJoin.room, liveJoin.me, cfg.token) : null);
  const [publish, setPublish] = useState<PublishState>({}), loaded = useRef({ club: false, history: false }), histRef = useRef(history); histRef.current = history;
  const synced = useRef<Record<string, number>>({}), seen = useRef<string[]>([]), resetAt = useRef(Date.now());
  const [toast, setToast] = useState<{ id: number; msg: string; undo?: () => void } | null>(null);
  const [showInstall, setShowInstall] = useState(false), [deferredPrompt, setDeferredPrompt] = useState<any>(null), [copiedAppUrl, setCopiedAppUrl] = useState(false);
  const ref = useRef<S.Session | null>(null), tid = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    loadSession().then((x) => { const v = x ?? S.newSession(); ref.current = v; setS(v); });
    loadConfig().then((c) => { setCfg(c); if (!deepLink && !c.token && c.serverUrl) setTab("today"); });
    loadPrefs().then((p) => { setPrefsState(p); applyPrefs(p); });
    loadClub().then((c) => { loaded.current.club = true; setClubState(c); }); loadHistory().then((h) => { loaded.current.history = true; setHistory(h); }); kvGet<LiveJoin>("liveJoin").then((j) => j && setLiveJoinState(j));
  }, []);
  const setClub = (c: C.ClubData) => { setClubState(c); saveClub(c); };
  const setPrefs = (p: Prefs) => { setPrefsState(p); applyPrefs(p); savePrefs(p); };
  const isNight = prefs.mode === "dark" || (prefs.mode === "auto" && prefersDark());
  useEffect(() => { if (s) saveSession(s); }, [s]);
  const ph = s ? S.phase(s) : "setup", prog = s?.program?.code;
  useEffect(() => { if (ph !== "running") return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [ph]);
  useEffect(() => {
    const sync = () => flushOutbox().then((r) => setPending(r.pending));
    pendingCount().then(setPending); sync(); window.addEventListener("online", sync); return () => window.removeEventListener("online", sync);
  }, [cfg]);
  useEffect(() => {
    if (!cfg.serverUrl) return;
    const pull = () => fetch(cfg.serverUrl.replace(/\/$/, "") + "/notices").then((r) => r.json()).then(setNotices).catch(() => {});
    pull(); const t = setInterval(pull, 60000); return () => clearInterval(t);
  }, [cfg.serverUrl]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(""), 5000); return () => clearTimeout(t); }, [err]);
  useEffect(() => { if (ph !== "running") setToast(null); }, [ph]);
  useEffect(() => { if (!sheet && countdown === null) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setSheet(false); setCountdown(null); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [sheet, countdown]);

  const showToast = useCallback((msg: string, undo?: () => void) => {
    clearTimeout(tid.current); setToast({ id: Date.now(), msg, undo }); tid.current = setTimeout(() => setToast(null), 6000);
  }, []);

  // Coach: pull in people who joined through the link or QR, and give each the next free bib.
  useEffect(() => {
    if (!prog || !cfg.serverUrl || !cfg.token) return;
    const tick = async () => {
      if (!ref.current || S.phase(ref.current) !== "setup") return;
      try {
        const plan = S.planJoins(ref.current, await fetchJoiners(cfg.serverUrl, cfg.token, prog), (n) => C.findMemberByName(clubRef.current.members, n)?.id);
        if (!Object.keys(plan.assignments).length) return;
        if (plan.added) { ref.current = plan.session; setS(plan.session); showToast(`${plan.added} runner${plan.added > 1 ? "s" : ""} joined`); }
        await assignBibs(cfg.serverUrl, cfg.token, prog, plan.assignments);
      } catch { /* offline or server asleep: try again in a few seconds */ }
    };
    tick(); const t = setInterval(tick, 5000); return () => clearInterval(t);
  }, [prog, cfg.serverUrl, cfg.token, showToast]);
  // Joining closes when the race starts.
  useEffect(() => {
    if (!prog || ph === "setup") return;
    if (cfg.serverUrl && cfg.token) closeProgram(cfg.serverUrl, cfg.token, prog).catch(() => {});
    const n = S.setProgram(ref.current!); ref.current = n; setS(n);
  }, [prog, ph]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start: optional countdown with beeps and voice, then the clock starts on "Go".
  const startNow = () => { const cur = ref.current; if (!cur || cur.startedAt !== undefined) return; const n = cur.mode === "reps" ? W.startReps(cur, Date.now()) : S.start(cur, Date.now()); ref.current = n; setS(n); };
  useEffect(() => {
    if (countdown === null) return;
    const snd = prefs.sound;
    if (countdown <= 0) { if (snd.beeps) beep(1200, 600); if (snd.voice) say("Go"); startNow(); setCountdown(null); setTab("session"); return; }
    if (snd.beeps) beep(880, 150); if (snd.voice && countdown <= 5) say(String(countdown));
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000); return () => clearTimeout(t);
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps
  // Time calls ("10 minutes"), as often as the coach chose, or never.
  useEffect(() => {
    if (ph !== "running" || !s?.startedAt) { lastTick.current = 0; return; }
    const el = now - s.startedAt, prev = lastTick.current; lastTick.current = el;
    if (!prev) return;
    const m = timeCallDue(prev, el, prefs.sound.timeCallMin, prefs.sound.quietAfterMin);
    if (m && prefs.sound.voice) say(`${m} minute${m > 1 ? "s" : ""}`);
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === "map") loadRoutes().then(setRoutes); }, [tab]);
  // Club web page: republish a moment after anything changes (also puts it back after the free server restarts).
  const publishNow = useCallback(async () => {
    if (!cfg.serverUrl || !cfg.token || !loaded.current.club || !loaded.current.history) return;
    try {
      const r = await fetch(cfg.serverUrl.replace(/\/$/, "") + "/public", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` }, body: JSON.stringify(buildBundle(clubRef.current, histRef.current, localDate())) });
      if (!r.ok) throw new Error(r.status === 401 ? "the coach token was not accepted" : `the server said ${r.status}`);
      setPublish({ at: Date.now() });
    } catch (e) { setPublish({ error: `Could not publish the club page: ${(e as Error).message === "Failed to fetch" ? "cannot reach the server" : (e as Error).message}.` }); }
  }, [cfg.serverUrl, cfg.token]);
  useEffect(() => { if (!cfg.token || !cfg.serverUrl) return; const t = setTimeout(publishNow, 2500); return () => clearTimeout(t); }, [club, history, publishNow]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const p = live.state?.positions; if (p) setTrail((t) => addPositions(t, p, Date.now() + live.offset)); }, [live.state?.positions]); // eslint-disable-line react-hooks/exhaustive-deps
  // Shared timing: this phone's new taps go to the room; the room's merged copy comes back into this phone.
  const sharing = !!(liveJoin?.share && cfg.token && live.status === "on" && s && (s.mode ?? "race") === "race");
  useEffect(() => { synced.current = {}; seen.current = []; resetAt.current = Date.now(); }, [s?.id, sharing]);
  useEffect(() => {
    if (!sharing || !s || !live.state) return;
    if (s.startedAt !== undefined && live.state.timing.startedAt === undefined) live.send({ type: "timing", action: { type: "start", lagMs: Date.now() - s.startedAt } });
    const cur = S.finishesByBib(s), ch = localChanges(synced.current, cur);
    ch.finish.forEach((f) => live.send({ type: "timing", action: { type: "finish", ...f } })); ch.undo.forEach((bib) => live.send({ type: "timing", action: { type: "undo", bib } }));
    synced.current = cur;
  }, [s, sharing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = live.state?.timing, cur0 = ref.current;
    if (!sharing || !t || !cur0) return;
    if (cur0.startedAt === undefined && t.startedAt !== undefined && t.startedAt - live.offset < resetAt.current - 5000) return; // an older race in this room
    let cur = cur0;
    if (t.startedAt !== undefined && cur.startedAt !== undefined && Math.abs(cur.startedAt - (t.startedAt - live.offset)) > 1500) cur = { ...cur, startedAt: t.startedAt - live.offset };
    const a = applyShared(cur, t, live.offset, seen.current); seen.current = a.seen; synced.current = S.finishesByBib(a.session);
    if (JSON.stringify(a.session.finishes) !== JSON.stringify(cur0.finishes) || a.session.startedAt !== cur0.startedAt || a.session.runners.length !== cur0.runners.length) { ref.current = a.session; setS(a.session); }
  }, [live.state?.timing, sharing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <p className="ipac-loading">Loading…</p>;
  // Compute from a ref so async callbacks (GPS, polling) never use a stale session.
  const act = (fn: (x: S.Session) => S.Session) => { try { const n = fn(ref.current!); ref.current = n; setS(n); setErr(""); } catch (e) { setErr((e as Error).message); } };
  const onEnd = async (ended: S.Session) => { act(() => ended); await archive(ended); setHistory(await loadHistory()); setPending(await pendingCount()); flushOutbox().then((r) => setPending(r.pending)); };
  const onSaveMember = (r: S.Runner) => {
    try {
      if (!r.name.trim()) throw new Error("Add a name first (Edit), then save the runner to the club");
      const m = C.findMemberByName(club.members, r.name) ?? C.newMember(r.name, { bib: r.bib || undefined });
      if (!club.members.includes(m)) setClub({ ...club, members: [...club.members, m] });
      act((x) => ({ ...x, runners: x.runners.map((y) => (y.id === r.id ? { ...y, memberId: m.id } : y)) }));
      showToast(`${m.name} saved to the club`);
    } catch (e) { setErr((e as Error).message); }
  };
  const onNew = (keep: boolean) => { if (sharing) live.send({ type: "timing", action: { type: "reset" } }); const n = S.nextSession(s, keep); ref.current = n; setS(n); setTab("session"); setSheet(false); window.scrollTo(0, 0); };
  const go = (t: Tab) => { setTab(t); setSheet(false); window.scrollTo(0, 0); };
  const startRace = () => { setSheet(false); if (!s.runners.length) return; if (prefs.sound.countdownSec > 0) setCountdown(prefs.sound.countdownSec); else { if (prefs.sound.beeps) beep(1200, 600); startNow(); go("session"); } };
  const announce = (kind: "finishes" | "laps", text: string) => { if (prefs.sound.beeps) beep(1000, 90, 0.25); if (prefs.sound.voice && prefs.sound[kind]) say(text); };
  const joinPanel = (bare?: boolean) => <JoinPanel s={s} act={act} cfg={cfg} bare={bare} />;

  return (
    <div className="ipac-shell">
      <header className="ipac-head"><div className="ipac-head-in">
        <img className="ipac-logo" src={logo} alt="Ivory Park Athletics Club logo" />
        <div className="ipac-title"><h1>Ivory Park Athletics Club</h1><p>{s.date} · {s.distanceKm} km</p></div>
        <div className="ipac-head-actions">
          <button className="ipac-themebtn" aria-label="Download app / Scan QR code" title="Get App / Scan QR code" onClick={() => setShowInstall(true)}>{Icons.download}</button>
          <button className="ipac-themebtn" aria-label={isNight ? "Switch to day theme" : "Switch to night theme"} onClick={() => setPrefs({ ...prefs, mode: isNight ? "light" : "dark" })}>{isNight ? Icons.sun : Icons.moon}</button>
        </div>
      </div>
        <button className={`ipac-status ipac-status-${ph}`} aria-haspopup="dialog" aria-label={`Session status: ${PHASE_LABEL[ph]}. Open options`} onClick={() => setSheet(true)}>
          <span className="ipac-dot" aria-hidden="true" />
          <b>{PHASE_LABEL[ph]}</b>
          <span>{ph === "running" ? (s.mode === "reps" && s.reps ? `${W.resting(s) ? "Rest" : `Rep ${W.repIndex(s) + 1}`} of ${s.reps.count} · ${S.fmtTime(now - s.startedAt!)}` : `${S.fmtTime(now - s.startedAt!)} · ${S.standings(s).length}/${s.runners.length} home`) : `${s.runners.length} runner${s.runners.length === 1 ? "" : "s"}${prog ? " · open to join" : ""}`}</span>
          <span className="ipac-chev" aria-hidden="true">Options ▾</span>
        </button>
      </header>

      <main className="ipac-main">
        {err && <p role="alert" className="ipac-err">{err}</p>}
        <div hidden={tab !== "today"}><Today cfg={cfg} deepLink={deepLink} /></div>
        <div hidden={tab !== "session"}><Session s={s} act={act} now={now} pending={pending} serverOn={!!(cfg.serverUrl && cfg.token)} toast={showToast} onEnd={onEnd} onNew={onNew} distances={prefs.distances} joinSlot={joinPanel()} members={club.members} onSaveMember={onSaveMember} onStart={startRace} announce={announce} safetyPaceSec={prefs.sound.safetyPaceSec} logo={logo} /></div>
        <div hidden={tab !== "runners"}><Runners club={club} setClub={setClub} history={history} today={localDate()} /></div>
        <div hidden={tab !== "map"}>
          <div className="ipac-seg" role="group" aria-label="Map views">
            <button aria-pressed={mapView === "live"} onClick={() => setMapView("live")}>Live</button>
            <button aria-pressed={mapView === "routes"} onClick={() => setMapView("routes")}>Routes</button>
            <button aria-pressed={mapView === "demo"} onClick={() => setMapView("demo")}>Demo</button>
          </div>
          <div hidden={mapView !== "live"}><Live s={s} act={act} cfg={cfg} running={ph === "running"} live={live} join={liveJoin} setJoin={setLiveJoin} trail={trail} members={club.members} routes={routes} /></div>
          <div hidden={mapView !== "routes"}><Routes distances={prefs.distances} router={cfg.router} /></div>
          {mapView === "demo" && <div><Demo /></div>}
        </div>
        <div hidden={tab !== "dispatch"}>
          <TeamDispatch onOpenPickupRoute={() => { setTab("map"); setMapView("routes"); }} />
        </div>
        <div hidden={tab !== "club"}><Club cfg={cfg} setCfg={setCfg} notices={notices} prefs={prefs} setPrefs={setPrefs} club={club} setClub={setClub} publish={publish} publishNow={publishNow} /></div>
      </main>

      {toast && (
        <div className="ipac-toast" role="status" aria-live="polite" key={toast.id}>
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={() => { toast.undo!(); setToast(null); }}>Undo</button>}
        </div>
      )}

      {sheet && (
        <div className="ipac-scrim" onClick={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="ipac-sheet" role="dialog" aria-modal="true" aria-label="Session status">
            <div className="ipac-sheet-head"><h2>Session status</h2><button className="ipac-btn ipac-btn-quiet" autoFocus aria-label="Close session status" onClick={() => setSheet(false)}>Close</button></div>
            <ol className="ipac-stages" aria-label="Stages">{STAGES.map(([k, l], i) => <li key={k} aria-current={k === ph ? "step" : undefined} className={STAGES.findIndex(([x]) => x === ph) > i ? "ipac-stage-done" : ""}>{l}</li>)}</ol>
            {ph === "setup" && (<>
              <p className="ipac-hint">{s.runners.length ? `${s.runners.length} runner${s.runners.length > 1 ? "s are" : " is"} ready.` : "Add runners, or open the run for joiners, then start."}</p>
              {joinPanel(true)}
              <button className="ipac-btn ipac-btn-hero" disabled={!s.runners.length} onClick={startRace}>{s.runners.length ? "Start race" : "Add a runner to start"}</button>
            </>)}
            {ph === "running" && (<>
              <p className="ipac-hint">The clock is running: {S.fmtTime(now - s.startedAt!)}. {S.stillRunning(s).length} still out.</p>
              <button className="ipac-btn ipac-btn-hero" onClick={() => go("session")}>Go to the race clock</button>
              <Confirm className="ipac-btn ipac-btn-outline ipac-btn-wide" label="End session" ask={`${S.stillRunning(s).length} still running. End anyway?`} onYes={() => { onEnd(S.endSession(s, Date.now())); go("session"); }} />
            </>)}
            {ph === "done" && (<>
              <p className="ipac-hint">The session is finished and saved on this device.</p>
              <button className="ipac-btn ipac-btn-hero" onClick={() => go("session")}>See results</button>
              <button className="ipac-btn ipac-btn-outline" onClick={() => onNew(true)}>New session, same runners</button>
            </>)}
          </div>
        </div>
      )}

      {countdown !== null && (
        <div className="ipac-scrim ipac-scrim-center">
          <div className="ipac-countdown" role="dialog" aria-modal="true" aria-label="Start countdown">
            <p>Starting in</p><div className="ipac-countnum" aria-live="assertive">{countdown}</div>
            <button className="ipac-btn ipac-btn-outline" autoFocus aria-label="Close countdown" onClick={() => setCountdown(null)}>Cancel start</button>
          </div>
        </div>
      )}

      {showInstall && (
        <div className="ipac-scrim" onClick={(e) => e.target === e.currentTarget && setShowInstall(false)}>
          <div className="ipac-sheet ipac-install-sheet" role="dialog" aria-modal="true" aria-label="Get Ivory Park Athletics Club App">
            <div className="ipac-sheet-head">
              <h2>Get Ivory Park Athletics App</h2>
              <button className="ipac-btn ipac-btn-quiet" autoFocus aria-label="Close modal" onClick={() => setShowInstall(false)}>Close</button>
            </div>
            <p className="ipac-hint" style={{ marginTop: 0 }}>
              Scan the QR code with your phone camera to download and install Ivory Park Athletics Club directly onto your home screen.
            </p>
            <div className="ipac-qr" role="img" aria-label="QR code to install app" dangerouslySetInnerHTML={{ __html: qrSvg(window.location.origin || window.location.href) }} />
            {deferredPrompt && (
              <button
                className="ipac-btn ipac-btn-hero ipac-btn-wide"
                style={{ marginTop: "14px", minHeight: "44px" }}
                onClick={() => {
                  deferredPrompt.prompt();
                  deferredPrompt.userChoice.then((choice: any) => { if (choice.outcome === "accepted") setDeferredPrompt(null); });
                }}
              >
                Install App to Device
              </button>
            )}
            <div className="ipac-install-guide">
              <div className="ipac-guide-col">
                <b>Android / Chrome</b>
                <p>Scan QR code &gt; Tap browser menu ⋮ &gt; Tap <b>Install app</b> or <b>Add to Home Screen</b>.</p>
              </div>
              <div className="ipac-guide-col">
                <b>iPhone / Safari</b>
                <p>Scan QR code &gt; Tap Share button ⎋ &gt; Scroll down &gt; Tap <b>Add to Home Screen</b>.</p>
              </div>
            </div>
            <div className="ipac-row2" style={{ marginTop: "10px" }}>
              <button
                className="ipac-btn ipac-btn-outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.origin || window.location.href);
                    setCopiedAppUrl(true);
                    setTimeout(() => setCopiedAppUrl(false), 2500);
                  } catch {}
                }}
              >
                {copiedAppUrl ? "Link Copied" : "Copy App Link"}
              </button>
              {typeof navigator.share === "function" && (
                <button
                  className="ipac-btn ipac-btn-primary"
                  onClick={() =>
                    navigator
                      .share({
                        title: "Ivory Park Athletics Club App",
                        text: "Download Ivory Park Athletics Club app for live tracking, routes, and race timing:",
                        url: window.location.origin || window.location.href,
                      })
                      .catch(() => {})
                  }
                >
                  Share via WhatsApp
                </button>
              )}
            </div>
            <p className="ipac-hint" style={{ textAlign: "center", marginTop: "12px", fontSize: "0.8rem" }}>
              Works 100% offline on road runs once installed — zero mobile data required.
            </p>
          </div>
        </div>
      )}
      <nav className="ipac-nav" aria-label="Sections">
        {NAV.map(([t, l]) => <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>{Icons[t]}<span>{l}</span></button>)}
      </nav>
    </div>
  );
}
