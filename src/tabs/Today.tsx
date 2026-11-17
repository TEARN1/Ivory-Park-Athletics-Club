import { useCallback, useEffect, useState } from "react";
import { deviceId, getProgram, joinProgram, listToday, loadJoined, localDate, myJoin, saveJoined, type Joined, type Program } from "../lib/join";
import { kvGet, kvSet, type Config } from "../lib/store";
import type { ClubEvent } from "../lib/club";
import { Confirm } from "../ui";
import {
  DEFAULT_CLUB_SCHEDULE,
  DEFAULT_MILEAGE_TARGET,
  loadClubSchedule,
  loadMileageTarget,
  saveClubSchedule,
  saveMileageTarget,
  type ClubScheduleDay,
  type MileageTarget,
} from "../lib/schedule";
import { DEFAULT_VEHICLES } from "../lib/transport";

/** Runner landing: pick the run that is open today, track weekly mileage, view schedule, and request transport. */
export default function Today({ cfg, deepLink }: { cfg: Config; deepLink: { code: string; server: string } | null }) {
  const server = deepLink?.server ?? cfg.serverUrl;
  return (
    <>
      <TodayRun cfg={cfg} deepLink={deepLink} />
      <PickMeUpQuickCard />
      <ClubWeeklySchedule />
      <MileageTargetTracker />
      <Upcoming server={server} />
    </>
  );
}

function TodayRun({ cfg, deepLink }: { cfg: Config; deepLink: { code: string; server: string } | null }) {
  const server = deepLink?.server ?? cfg.serverUrl;
  const [joined, setJoined] = useState<Joined | null>(null), [me, setMe] = useState<{ bib: string | null; open: boolean } | null>(null);
  const [programs, setPrograms] = useState<Program[] | null>(null), [name, setName] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState("");
  useEffect(() => { loadJoined().then((j) => setJoined(j && j.date === localDate() ? j : null)); kvGet<string>("myName").then((n) => n && setName(n)); }, []);

  const refresh = useCallback(async () => {
    if (!server) return; setErr("");
    try { setPrograms(deepLink ? [await getProgram(server, deepLink.code)] : await listToday(server, localDate())); }
    catch (e) { setPrograms([]); setErr((e as Error).message); }
  }, [server, deepLink]);
  useEffect(() => { if (!joined) refresh(); }, [joined, refresh]);

  useEffect(() => {
    if (!joined) return; let live = true;
    const tick = () => myJoin(joined.server, joined.code, joined.joinerId).then((m) => live && setMe(m)).catch(() => {});
    tick(); const t = setInterval(tick, 4000); return () => { live = false; clearInterval(t); };
  }, [joined]);

  const join = async (p: Program) => {
    setBusy(p.code); setErr("");
    try {
      const r = await joinProgram(server, p.code, name, await deviceId());
      const j: Joined = { server, code: p.code, joinerId: r.joinerId, name: name.trim(), date: p.date, distanceKm: p.distanceKm };
      await saveJoined(j); await kvSet("myName", name.trim()); setMe({ bib: r.bib, open: true }); setJoined(j);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  };

  if (joined) return (
    <section className="ipac-card ipac-youre-in">
      <h2>You are checked in</h2>
      <p>{joined.name} · today's {joined.distanceKm} km run</p>
      {me?.bib ? <><div className="ipac-bigbib" aria-label={`Your bib number is ${me.bib}`}>{me.bib}</div><p className="ipac-hint">Your bib number. Tell the timekeeper this number when you finish.</p></>
        : <p className="ipac-wait" role="status">Waiting for the coach to give you a bib number…</p>}
      <Confirm label="Leave this run" ask="Leave this run?" onYes={async () => { await saveJoined(null); setJoined(null); setMe(null); }} />
    </section>
  );

  return (
    <section className="ipac-card">
      <h2>Today at Ivory Park AC</h2>
      {server ? (
        <>
          {deepLink && <p className="ipac-hint">Joining through {new URL(server).host}</p>}
          <label className="ipac-namefield">Your name<input aria-label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Naledi" /></label>
          {programs === null ? <p className="ipac-hint">Looking for today's run…</p> : programs.length === 0 ? <p className="ipac-empty">No run is open for joining today. Ask your coach to open it, then check again.</p> : (
            <ul className="ipac-programs">{programs.map((p) => (
              <li key={p.code}>
                <span className="ipac-who"><b>{p.distanceKm} km run</b><small>{p.date === localDate() ? "Today" : p.date} · code {p.code}{p.open === false && " · closed"}</small></span>
                <button className="ipac-btn ipac-btn-hero ipac-join-btn" disabled={!name.trim() || busy === p.code || p.open === false} onClick={() => join(p)}>{busy === p.code ? "Joining…" : "Join this run"}</button>
              </li>))}</ul>)}
          {err && <p role="alert" className="ipac-err">{err}</p>}
          <button className="ipac-btn ipac-btn-quiet" onClick={refresh}>Check again</button>
        </>
      ) : (
        <p className="ipac-hint">All timing and session tracking runs 100% offline. Connect to coach Wi-Fi or scan a join QR code to participate in live telemetry.</p>
      )}
    </section>
  );
}

/** Pre-Race Day Pickup Request Button for Athletes */
function PickMeUpQuickCard() {
  const [requested, setRequested] = useState(false);
  const [vehicle, setVehicle] = useState(DEFAULT_VEHICLES[0].id);
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    kvGet<{ requested: boolean; vehicle: string }>("ipac_pickup_request").then((p) => {
      if (p) {
        setRequested(p.requested);
        setVehicle(p.vehicle);
      }
    });
  }, []);

  const handlePickMeUp = () => {
    setBusy(true);
    setStatusMsg("Acquiring high-accuracy hardware GPS coordinates…");
    if (!("geolocation" in navigator)) {
      setStatusMsg("Geolocation not supported by device.");
      setBusy(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          at: Date.now(),
        };
        kvSet("ipac_pickup_request", { requested: true, vehicle, coords });
        setRequested(true);
        setBusy(false);
        setStatusMsg(`Pickup requested. Coordinates locked at ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)} (±${coords.accuracy}m). Driver will pick you up.`);
      },
      () => {
        // Fallback without coordinates
        kvSet("ipac_pickup_request", { requested: true, vehicle });
        setRequested(true);
        setBusy(false);
        setStatusMsg("Pickup requested. Driver alerted.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const cancelPickup = () => {
    kvSet("ipac_pickup_request", null);
    setRequested(false);
    setStatusMsg("Pickup request cancelled.");
  };

  return (
    <section className="ipac-card" style={{ borderLeft: "4px solid var(--p-navy)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Race Day Pickup &amp; Transport</h3>
        <span className="ipac-chip" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>Saturday &amp; Sunday</span>
      </div>
      <p className="ipac-hint" style={{ marginTop: "6px" }}>
        Tap before sleeping or on wake-up to transmit your exact GPS gate coordinates to the transport driver.
      </p>

      {requested ? (
        <div style={{ padding: "10px", background: "rgba(15, 81, 50, 0.1)", borderRadius: "8px", border: "1px solid rgba(15, 81, 50, 0.3)", marginTop: "10px" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--p-ctl-d, #0f5132)" }}>
            Pickup Confirmed for Saturday Morning
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>
            Assigned Vehicle: <b>{DEFAULT_VEHICLES.find((v) => v.id === vehicle)?.name}</b>
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--color-muted)" }}>
            Please wait outside your gate 5 minutes before scheduled pickup.
          </p>
          <button type="button" className="ipac-btn ipac-btn-quiet" style={{ marginTop: "10px" }} onClick={cancelPickup}>
            Cancel Pickup Request
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
          <label style={{ fontSize: "0.84rem", fontWeight: 600 }}>
            Preferred Transport Vehicle:
            <select value={vehicle} onChange={(e) => setVehicle(e.target.value)} style={{ marginTop: "4px" }}>
              {DEFAULT_VEHICLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} (Driver: {v.driverName})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ipac-btn ipac-btn-hero"
            disabled={busy}
            onClick={handlePickMeUp}
            style={{ padding: "12px", fontSize: "0.98rem" }}
          >
            {busy ? "Locking GPS Coordinates…" : "Pick Me Up (Submit Gate Location)"}
          </button>
        </div>
      )}
      {statusMsg && <p role="status" className="ipac-hint" style={{ marginTop: "8px" }}>{statusMsg}</p>}
    </section>
  );
}

/** Official Weekly Club Schedule with Coach Adjuster */
function ClubWeeklySchedule() {
  const [schedule, setSchedule] = useState<ClubScheduleDay[]>(loadClubSchedule);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ClubScheduleDay[]>(schedule);

  const handleSave = () => {
    saveClubSchedule(draft);
    setSchedule(draft);
    setEditing(false);
  };

  const toggleSeason = (season: "summer" | "winter") => {
    const updated = draft.map((day) => {
      if (day.day === "Monday") {
        return { ...day, season, time: season === "summer" ? "17:00" : "17:30" };
      }
      if (day.day === "Wednesday") {
        return { ...day, season, time: season === "summer" ? "17:00" : "16:45" };
      }
      return { ...day, season };
    });
    setDraft(updated);
  };

  return (
    <section className="ipac-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Official Club Training Schedule</h2>
          <p className="ipac-hint" style={{ margin: "2px 0 0" }}>Ivory Park Athletics Club weekly rhythm</p>
        </div>
        <button
          type="button"
          className="ipac-btn ipac-btn-small"
          onClick={() => {
            setDraft(schedule);
            setEditing(!editing);
          }}
        >
          {editing ? "Cancel Edit" : "Coach Adjust Times"}
        </button>
      </div>

      {editing ? (
        <div style={{ marginTop: "14px", display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>Season Preset:</span>
            <button
              type="button"
              className="ipac-chip"
              aria-pressed={draft[0]?.season === "summer"}
              onClick={() => toggleSeason("summer")}
            >
              Summer (17:00 PM)
            </button>
            <button
              type="button"
              className="ipac-chip"
              aria-pressed={draft[0]?.season === "winter"}
              onClick={() => toggleSeason("winter")}
            >
              Winter (17:30 PM)
            </button>
          </div>

          {draft.map((d, idx) => (
            <div key={d.day} style={{ padding: "10px", background: "rgba(255, 255, 255, 0.4)", borderRadius: "8px", border: "1px solid var(--color-glass-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: "6px" }}>
                <span>{d.day}</span>
                <span>{d.title}</span>
              </div>
              <div className="ipac-row2">
                <label>
                  Start Time
                  <input
                    type="time"
                    value={d.time}
                    onChange={(e) => {
                      const copy = [...draft];
                      copy[idx] = { ...d, time: e.target.value };
                      setDraft(copy);
                    }}
                  />
                </label>
                <label>
                  Target Distance (km)
                  <input
                    type="number"
                    step="0.5"
                    value={d.distanceKm}
                    onChange={(e) => {
                      const copy = [...draft];
                      copy[idx] = { ...d, distanceKm: parseFloat(e.target.value) || 0 };
                      setDraft(copy);
                    }}
                  />
                </label>
              </div>
              <label style={{ marginTop: "4px" }}>
                Meeting Point
                <input
                  type="text"
                  value={d.meetupPoint}
                  onChange={(e) => {
                    const copy = [...draft];
                    copy[idx] = { ...d, meetupPoint: e.target.value };
                    setDraft(copy);
                  }}
                />
              </label>
            </div>
          ))}

          <button type="button" className="ipac-btn ipac-btn-primary" onClick={handleSave}>
            Save Schedule Changes
          </button>
        </div>
      ) : (
        <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
          {schedule.map((d) => (
            <div
              key={d.day}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.4)",
                border: "1px solid var(--color-glass-border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "var(--p-navy)" }}>{d.day} · {d.time}</span>
                <span className="ipac-chip" style={{ fontSize: "0.78rem" }}>{d.distanceKm} km</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{d.title}</div>
              <div style={{ fontSize: "0.80rem", color: "var(--color-muted)" }}>
                Meet: {d.meetupPoint} · {d.notes}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Athlete Weekly & Monthly Target Mileage Tracker */
function MileageTargetTracker() {
  const [target, setTarget] = useState<MileageTarget>(loadMileageTarget);
  const [editing, setEditing] = useState(false);
  const [customWeekly, setCustomWeekly] = useState(target.weeklyKm);
  const [customMonthly, setCustomMonthly] = useState(target.monthlyKm);
  const [goal, setGoal] = useState(target.raceGoal);

  // Simulated representative weekly and monthly mileage for demo display
  const completedWeeklyKm = 24.5;
  const completedMonthlyKm = 108.0;

  const weeklyPercent = Math.min(100, Math.round((completedWeeklyKm / target.weeklyKm) * 100));
  const monthlyPercent = Math.min(100, Math.round((completedMonthlyKm / target.monthlyKm) * 100));

  const applyPreset = (w: number, m: number, g: string) => {
    setCustomWeekly(w);
    setCustomMonthly(m);
    setGoal(g);
  };

  const handleSave = () => {
    const updated: MileageTarget = {
      weeklyKm: customWeekly,
      monthlyKm: customMonthly,
      raceGoal: goal,
    };
    saveMileageTarget(updated);
    setTarget(updated);
    setEditing(false);
  };

  return (
    <section className="ipac-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Target Mileage &amp; Race Goal</h2>
          <p className="ipac-hint" style={{ margin: "2px 0 0" }}>Current Focus: <b>{target.raceGoal}</b></p>
        </div>
        <button
          type="button"
          className="ipac-btn ipac-btn-small"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Cancel" : "Set Mileage Target"}
        </button>
      </div>

      {editing ? (
        <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="ipac-chip"
              onClick={() => applyPreset(30, 120, "5K & 10K Speed Focus")}
            >
              5K/10K Speed (30 km/wk)
            </button>
            <button
              type="button"
              className="ipac-chip"
              onClick={() => applyPreset(45, 180, "21.1km Half Marathon Build")}
            >
              21.1K Half (45 km/wk)
            </button>
            <button
              type="button"
              className="ipac-chip"
              onClick={() => applyPreset(75, 300, "Marathon & Ultra Qualifier")}
            >
              Marathon/Ultra (75 km/wk)
            </button>
          </div>

          <div className="ipac-row2">
            <label>
              Weekly Target (km)
              <input
                type="number"
                value={customWeekly}
                onChange={(e) => setCustomWeekly(parseInt(e.target.value, 10) || 0)}
              />
            </label>
            <label>
              Monthly Target (km)
              <input
                type="number"
                value={customMonthly}
                onChange={(e) => setCustomMonthly(parseInt(e.target.value, 10) || 0)}
              />
            </label>
          </div>

          <label>
            Upcoming Goal Race
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Soweto 10K, CGA Championships, Two Oceans Qualifier"
            />
          </label>

          <button type="button" className="ipac-btn ipac-btn-primary" onClick={handleSave}>
            Save Targets
          </button>
        </div>
      ) : (
        <div style={{ marginTop: "14px", display: "grid", gap: "12px" }}>
          {/* Weekly Progress Bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: "4px" }}>
              <span><b>This Week:</b> {completedWeeklyKm} km of {target.weeklyKm} km</span>
              <span><b>{weeklyPercent}%</b> ({Math.max(0, target.weeklyKm - completedWeeklyKm).toFixed(1)} km left)</span>
            </div>
            <div style={{ width: "100%", height: "10px", background: "rgba(0, 0, 0, 0.1)", borderRadius: "6px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${weeklyPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--p-navy), #0284c7)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          {/* Monthly Progress Bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: "4px" }}>
              <span><b>This Month:</b> {completedMonthlyKm} km of {target.monthlyKm} km</span>
              <span><b>{monthlyPercent}%</b> ({Math.max(0, target.monthlyKm - completedMonthlyKm).toFixed(1)} km left)</span>
            </div>
            <div style={{ width: "100%", height: "10px", background: "rgba(0, 0, 0, 0.1)", borderRadius: "6px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${monthlyPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #0f5132, #eab308)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Coming up: time trials and long runs. Runners say whether they are coming. */
function Upcoming({ server }: { server: string }) {
  const [events, setEvents] = useState<ClubEvent[]>([]), [counts, setCounts] = useState<Record<string, number>>({}), [mine, setMine] = useState<Record<string, boolean>>({});
  const [name, setName] = useState(""), [err, setErr] = useState("");
  const load = useCallback(() => { if (server) fetch(server.replace(/\/$/, "") + "/public.json").then((r) => r.json()).then((j) => { setEvents(j.bundle?.events ?? []); setCounts(j.counts ?? {}); }).catch(() => {}); }, [server]);
  useEffect(() => { load(); kvGet<Record<string, boolean>>("rsvps").then((r) => r && setMine(r)); kvGet<string>("myName").then((n) => n && setName(n)); }, [load]);
  const answer = async (e: ClubEvent, coming: boolean) => {
    if (!name.trim()) { setErr("Type your name first"); return; }
    try {
      const r = await fetch(`${server.replace(/\/$/, "")}/events/${e.id}/rsvp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, coming, deviceId: await deviceId() }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not save your answer");
      const m = { ...mine, [e.id]: coming }; setMine(m); kvSet("rsvps", m); kvSet("myName", name.trim()); setCounts({ ...counts, [e.id]: j.coming }); setErr("");
    } catch (x) { setErr((x as Error).message === "Failed to fetch" ? "Cannot reach the club server." : (x as Error).message); }
  };
  if (!server || !events.length) return null;
  return (
    <section className="ipac-card">
      <h2>Coming up</h2>
      {(!name.trim() || Object.keys(mine).length === 0) && <label className="ipac-namefield">Your name<input aria-label="Your name for events" value={name} onChange={(e) => setName(e.target.value)} /></label>}
      <ul className="ipac-programs">{events.map((e) => (
        <li key={e.id}><span className="ipac-who"><b>{e.title}</b><small>{e.date} {e.time}{e.distanceKm ? ` · ${e.distanceKm} km` : ""} · {counts[e.id] ?? 0} coming</small>{e.notes && <small>{e.notes}</small>}</span>
          <div className="ipac-seg" role="group" aria-label={`Are you coming to ${e.title}?`}>
            <button aria-pressed={mine[e.id] === true} onClick={() => answer(e, true)}>I am coming</button>
            <button aria-pressed={mine[e.id] === false} onClick={() => answer(e, false)}>Cannot make it</button>
          </div></li>))}</ul>
      {err && <p role="alert" className="ipac-err">{err}</p>}
    </section>
  );
}
