import { useEffect, useRef, useState } from "react";
import { playAlarmFanfare, say } from "../lib/sound";
import { ATHLETE_PICKUP_ROSTER, type AthletePickupLocation } from "../lib/transport";

export interface TeamMemberStatus {
  id: string;
  name: string;
  bib: string;
  checkInState: "awake" | "needs_pickup" | "en_route" | "absent" | "pending";
  readAt?: string;
  checkInAt?: string;
  locationNote?: string;
}

export interface CallHistoryEntry {
  id: string;
  type: "video" | "voice";
  startedAt: string;
  durationSec: number;
  participants: string[];
  notes: string;
}

const DEFAULT_MEMBERS: TeamMemberStatus[] = [
  { id: "mem-1", name: "Sibusiso Molefe", bib: "12", checkInState: "awake", readAt: "04:32", checkInAt: "04:33", locationNote: "Ext 2 Community Hall" },
  { id: "mem-2", name: "Katlego Dlamini", bib: "07", checkInState: "awake", readAt: "04:31", checkInAt: "04:32", locationNote: "Freedom Drive" },
  { id: "mem-3", name: "Thabo Mokoena", bib: "24", checkInState: "needs_pickup", readAt: "04:34", checkInAt: "04:36", locationNote: "Ext 7 Taxi Rank" },
  { id: "mem-4", name: "Lerato Khumalo", bib: "18", checkInState: "needs_pickup", readAt: "04:35", checkInAt: "04:37", locationNote: "Ext 12 Clinic" },
  { id: "mem-5", name: "Naledi Sithole", bib: "31", checkInState: "en_route", readAt: "04:30", checkInAt: "04:35", locationNote: "Walking to Hub" },
  { id: "mem-6", name: "Sipho Ndlovu", bib: "05", checkInState: "pending", readAt: undefined, checkInAt: undefined, locationNote: "Ext 9" },
];

export default function TeamDispatch({ onOpenPickupRoute }: { onOpenPickupRoute?: () => void }) {
  // Morning Alarm State
  const [alarmTime, setAlarmTime] = useState("04:30");
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  const [raceNotice, setRaceNotice] = useState(
    "Wake up Team Ivory Park! Saturday 5km Time Trial & League Race. Team bus departs Freedom Drive Hub at 05:15 AM sharp. Bring ASA license and bib."
  );
  const [members, setMembers] = useState<TeamMemberStatus[]>(DEFAULT_MEMBERS);
  const [statusMsg, setStatusMsg] = useState("");

  // Team Call (Voice / Video) State
  const [callActive, setCallActive] = useState(false);
  const [callType, setCallType] = useState<"video" | "voice">("video");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callSec, setCallSec] = useState(0);
  const [speakingAthlete, setSpeakingAthlete] = useState<string | null>("Coach");
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([
    {
      id: "call-prev-1",
      type: "voice",
      startedAt: "Yesterday 17:45",
      durationSec: 320,
      participants: ["Coach", "Sibusiso Molefe", "Katlego Dlamini", "Thabo Mokoena", "Lerato Khumalo"],
      notes: "Pre-race nutrition, race shoes check, and pickup route confirmation.",
    },
  ]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Call timer
  useEffect(() => {
    if (!callActive) return;
    const t = setInterval(() => {
      setCallSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [callActive]);

  // Simulated active speaker switcher
  useEffect(() => {
    if (!callActive) return;
    const speakers = ["Coach", "Sibusiso Molefe", "Katlego Dlamini", "Lerato Khumalo", "Coach"];
    const t = setInterval(() => {
      const next = speakers[Math.floor(Math.random() * speakers.length)];
      setSpeakingAthlete(next);
    }, 4500);
    return () => clearInterval(t);
  }, [callActive]);

  // Setup camera stream when video call starts
  useEffect(() => {
    if (callActive && callType === "video" && !videoOff) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: true })
          .then((stream) => {
            localStreamRef.current = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch(() => {
            /* camera denied or headless preview fallback */
          });
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [callActive, callType, videoOff]);

  const triggerAlarmSound = () => {
    setAlarmPlaying(true);
    playAlarmFanfare();
    say(`Wake up Team Ivory Park. Time to prepare for the run.`);
    setTimeout(() => setAlarmPlaying(false), 2400);
  };

  const startCall = (type: "video" | "voice") => {
    setCallType(type);
    setCallSec(0);
    setMuted(false);
    setVideoOff(type === "voice");
    setCallActive(true);
    setStatusMsg(`Team ${type === "video" ? "Video" : "Voice"} Call started. 5 athletes connected.`);
  };

  const endCall = () => {
    if (callSec > 0) {
      const newEntry: CallHistoryEntry = {
        id: crypto.randomUUID(),
        type: callType,
        startedAt: "Today " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        durationSec: callSec,
        participants: ["Coach", ...members.filter((m) => m.checkInState !== "absent").map((m) => m.name)],
        notes: raceNotice.slice(0, 80) + "…",
      };
      setCallHistory([newEntry, ...callHistory]);
    }
    setCallActive(false);
    setCallSec(0);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setStatusMsg("Call ended and attendance record saved.");
  };

  const updateMemberState = (id: string, st: TeamMemberStatus["checkInState"]) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, checkInState: st, checkInAt: now, readAt: m.readAt ?? now } : m))
    );
  };

  const needsPickupCount = members.filter((m) => m.checkInState === "needs_pickup").length;
  const awakeCount = members.filter((m) => m.checkInState === "awake" || m.checkInState === "en_route").length;

  return (
    <div className="ipac-map-view-shell">
      {/* ====================================================================
          1. COACH MORNING WAKE-UP ALARM & DISPATCH
          ==================================================================== */}
      <section className="ipac-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h2 style={{ margin: 0 }}>Coach Morning Wake-Up Alarm</h2>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Dispatch automated wake-up chimes and race prep instructions to all athletes.
            </p>
          </div>
          <span className="ipac-rank-badge" style={{ fontSize: "1rem", padding: "4px 12px" }}>
            {alarmEnabled ? `Active for ${alarmTime}` : "Alarm Standby"}
          </span>
        </div>

        <div className="ipac-form" style={{ marginTop: "14px" }}>
          <div className="ipac-row2">
            <label>
              Alarm Wake-Up Time
              <input
                type="time"
                value={alarmTime}
                onChange={(e) => setAlarmTime(e.target.value)}
                style={{ fontSize: "1.1rem", fontWeight: 700 }}
              />
            </label>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className={`ipac-btn ${alarmEnabled ? "ipac-btn-primary" : "ipac-btn-outline"}`}
                style={{ minHeight: "42px", flex: 1 }}
                onClick={() => setAlarmEnabled(!alarmEnabled)}
              >
                {alarmEnabled ? "Alarm Armed" : "Disarmed"}
              </button>
              <button
                type="button"
                className="ipac-btn ipac-btn-outline"
                style={{ minHeight: "42px" }}
                onClick={triggerAlarmSound}
                title="Test morning chime fanfare"
              >
                {alarmPlaying ? "Chiming…" : "Test Chime"}
              </button>
            </div>
          </div>

          <label>
            Race Day Briefing Note (Delivered with Alarm)
            <textarea
              rows={3}
              value={raceNotice}
              onChange={(e) => setRaceNotice(e.target.value)}
              placeholder="Instructions for wake up, bib numbers, team transport departure time, etc."
            />
          </label>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="ipac-btn ipac-btn-primary"
              style={{ fontSize: "0.88rem" }}
              onClick={() => {
                const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                setMembers((prev) => prev.map((m) => ({ ...m, readAt: now })));
                triggerAlarmSound();
                setStatusMsg(`Wake-up broadcast sent to 6 athletes with alarm set for ${alarmTime}.`);
              }}
            >
              Broadcast Wake-Up Alarm Now
            </button>
            <button
              type="button"
              className="ipac-btn ipac-btn-outline"
              style={{ fontSize: "0.88rem" }}
              onClick={async () => {
                const text = `⏰ *IVORY PARK AC - MORNING WAKE-UP ALARM: ${alarmTime}*\n\n${raceNotice}\n\n*Check in immediately on the app:* https://ivorypark.athletics/today`;
                if (navigator.clipboard) await navigator.clipboard.writeText(text);
                setStatusMsg("Wake-up alert copied for WhatsApp broadcast.");
              }}
            >
              Copy WhatsApp Alert
            </button>
          </div>
        </div>

        {statusMsg && (
          <p role="status" style={{ color: "var(--color-hot)", fontWeight: 700, margin: "10px 0 0", fontSize: "0.88rem" }}>
            [Confirmed] {statusMsg}
          </p>
        )}
      </section>

      {/* ====================================================================
          2. ATHLETE READ RECEIPTS & CHECK-IN TRACK RECORD
          ==================================================================== */}
      <section className="ipac-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Athlete Wake-Up &amp; Read Receipts</h3>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Live track record of who viewed the message and confirmed ready.
            </p>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <span className="ipac-broadcast-badge" style={{ background: "rgba(5, 150, 105, 0.15)", color: "#059669" }}>
              {awakeCount} Awake
            </span>
            <span className="ipac-broadcast-badge" style={{ background: "rgba(234, 88, 12, 0.15)", color: "#ea580c" }}>
              {needsPickupCount} Need Ride
            </span>
          </div>
        </div>

        <div className="ipac-tk-table-wrap" style={{ marginTop: "12px" }}>
          <table className="ipac-tk-table">
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Status</th>
                <th>Seen At</th>
                <th>Check-in</th>
                <th>Location / Pickup Point</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.name}</b> <small style={{ color: "var(--color-muted)" }}>#{m.bib}</small>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "99px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background:
                          m.checkInState === "awake"
                            ? "rgba(5, 150, 105, 0.15)"
                            : m.checkInState === "needs_pickup"
                            ? "rgba(234, 88, 12, 0.15)"
                            : m.checkInState === "en_route"
                            ? "rgba(37, 99, 235, 0.15)"
                            : "rgba(100, 116, 139, 0.15)",
                        color:
                          m.checkInState === "awake"
                            ? "#059669"
                            : m.checkInState === "needs_pickup"
                            ? "#ea580c"
                            : m.checkInState === "en_route"
                            ? "#2563eb"
                            : "#64748b",
                      }}
                    >
                      {m.checkInState === "awake"
                        ? "Awake & Ready"
                        : m.checkInState === "needs_pickup"
                        ? "Needs Pickup"
                        : m.checkInState === "en_route"
                        ? "En Route"
                        : m.checkInState === "absent"
                        ? "Cannot Make It"
                        : "Pending (Unopened)"}
                    </span>
                  </td>
                  <td>{m.readAt || "–"}</td>
                  <td>{m.checkInAt || "–"}</td>
                  <td>{m.locationNote || "Ivory Park"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        type="button"
                        className="ipac-btn ipac-btn-quiet"
                        style={{ minHeight: "28px", padding: "2px 8px", fontSize: "0.75rem" }}
                        onClick={() => updateMemberState(m.id, "awake")}
                      >
                        Awake
                      </button>
                      <button
                        type="button"
                        className="ipac-btn ipac-btn-quiet"
                        style={{ minHeight: "28px", padding: "2px 8px", fontSize: "0.75rem" }}
                        onClick={() => updateMemberState(m.id, "needs_pickup")}
                      >
                        Pickup
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {needsPickupCount > 0 && onOpenPickupRoute && (
          <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="ipac-btn ipac-btn-primary"
              style={{ fontSize: "0.85rem", minHeight: "38px" }}
              onClick={onOpenPickupRoute}
            >
              Plan Shortest Pick-up Route for {needsPickupCount} Athletes ➔
            </button>
          </div>
        )}
      </section>

      {/* ====================================================================
          3. TEAM VOICE & VIDEO CALL HUDDLE
          ==================================================================== */}
      <section className="ipac-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h2 style={{ margin: 0 }}>Team Voice &amp; Video Call (Team Huddle)</h2>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Live pre-race team briefing for coaches and athletes.
            </p>
          </div>
          {!callActive ? (
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="ipac-btn ipac-btn-primary"
                style={{ fontSize: "0.85rem", minHeight: "38px" }}
                onClick={() => startCall("video")}
              >
                Start Video Call
              </button>
              <button
                type="button"
                className="ipac-btn ipac-btn-outline"
                style={{ fontSize: "0.85rem", minHeight: "38px" }}
                onClick={() => startCall("voice")}
              >
                Voice Call (Data Saver)
              </button>
            </div>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                color: "#e81820",
                fontSize: "1.1rem",
              }}
            >
              ● LIVE {Math.floor(callSec / 60)}:{(callSec % 60).toString().padStart(2, "0")}
            </span>
          )}
        </div>

        {/* Live Call Stage */}
        {callActive && (
          <div className="ipac-call-stage" style={{ marginTop: "14px" }}>
            {/* Top Toolbar */}
            <div className="ipac-call-toolbar">
              <span>
                <b>Team Huddle:</b> 6 Connected · Speaking:{" "}
                <b style={{ color: "var(--color-hot)" }}>{speakingAthlete}</b>
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className={`ipac-btn ${muted ? "ipac-btn-danger" : "ipac-btn-quiet"}`}
                  style={{ minHeight: "32px", padding: "2px 10px", fontSize: "0.78rem" }}
                  onClick={() => setMuted(!muted)}
                >
                  {muted ? "Unmute" : "Mute"}
                </button>
                {callType === "video" && (
                  <button
                    type="button"
                    className={`ipac-btn ${videoOff ? "ipac-btn-danger" : "ipac-btn-quiet"}`}
                    style={{ minHeight: "32px", padding: "2px 10px", fontSize: "0.78rem" }}
                    onClick={() => setVideoOff(!videoOff)}
                  >
                    {videoOff ? "Start Camera" : "Stop Camera"}
                  </button>
                )}
                <button
                  type="button"
                  className="ipac-btn ipac-btn-danger"
                  style={{ minHeight: "32px", padding: "2px 12px", fontSize: "0.78rem" }}
                  onClick={endCall}
                >
                  End Call
                </button>
              </div>
            </div>

            {/* Video / Voice Participant Grid */}
            <div className="ipac-call-grid">
              {/* Coach Tile */}
              <div className={`ipac-call-tile ${speakingAthlete === "Coach" ? "speaking" : ""}`}>
                {callType === "video" && !videoOff ? (
                  <video ref={localVideoRef} autoPlay playsInline muted className="ipac-tile-video" />
                ) : (
                  <div className="ipac-tile-avatar">Coach</div>
                )}
                <span className="ipac-tile-label">You (Coach) {muted ? "· Muted" : ""}</span>
              </div>

              {/* Athletes Tiles */}
              {DEFAULT_MEMBERS.slice(0, 5).map((ath) => (
                <div
                  key={ath.id}
                  className={`ipac-call-tile ${speakingAthlete === ath.name ? "speaking" : ""}`}
                >
                  <div className="ipac-tile-avatar">
                    {ath.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="ipac-tile-label">{ath.name} #{ath.bib}</span>
                  {speakingAthlete === ath.name && <span className="ipac-speaking-indicator">Speaking…</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call Attendance History */}
        <div style={{ marginTop: "16px" }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Past Team Calls &amp; Attendance Record</h4>
          <ul className="ipac-list" style={{ fontSize: "0.85rem" }}>
            {callHistory.map((h) => (
              <li key={h.id} style={{ display: "grid", gap: "2px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>
                    {h.type === "video" ? "Video Huddle" : "Voice Briefing"} · {h.startedAt}
                  </b>
                  <span style={{ color: "var(--color-muted)" }}>
                    {Math.floor(h.durationSec / 60)}m {h.durationSec % 60}s
                  </span>
                </div>
                <small style={{ color: "var(--color-muted)" }}>
                  Joined ({h.participants.length}): {h.participants.join(", ")}
                </small>
                {h.notes && <small style={{ fontStyle: "italic" }}>"{h.notes}"</small>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
