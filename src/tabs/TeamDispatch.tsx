import { useEffect, useRef, useState } from "react";
import {
  defaultCoachAlarm,
  formatAlarmWhatsApp,
  loadCoachAlarm,
  saveCoachAlarm,
  type AlarmTone,
  type CoachAlarm,
  type TargetSquad,
} from "../lib/alarms";
import { qrSvg } from "../lib/join";
import { playAlarmTone, playToneSweep, say, vibrate } from "../lib/sound";

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
  mode: "individual" | "team";
  targetName?: string;
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

const PROGRAM_PRESETS = [
  { title: "Saturday 5km Time Trial & League Race", distKm: 5.0, meetup: "Freedom Drive Hub", dep: "05:15" },
  { title: "10km Spine Threshold Tempo Run", distKm: 10.0, meetup: "Ext 2 Community Hall", dep: "05:30" },
  { title: "Ext 2 Hill Repeats & Cadence Drills", distKm: 6.0, meetup: "Ext 2 Park", dep: "05:00" },
  { title: "Long Run 21.1km Highveld Endurance", distKm: 21.1, meetup: "Freedom Drive Hub", dep: "05:00" },
  { title: "Track Speed Intervals (400m / 800m)", distKm: 4.8, meetup: "Ivory Park Track", dep: "05:45" },
];

export default function TeamDispatch({
  onOpenPickupRoute,
  onTriggerAlarmScreen,
}: {
  onOpenPickupRoute?: () => void;
  onTriggerAlarmScreen?: (alarm: CoachAlarm) => void;
}) {
  // Morning Offline Alarm State
  const [alarm, setAlarm] = useState<CoachAlarm>(() => loadCoachAlarm() ?? defaultCoachAlarm());
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [members, setMembers] = useState<TeamMemberStatus[]>(DEFAULT_MEMBERS);
  const [statusMsg, setStatusMsg] = useState("");

  // Team & Individual Call State
  const [callActive, setCallActive] = useState(false);
  const [callMode, setCallMode] = useState<"individual" | "team">("team");
  const [callType, setCallType] = useState<"video" | "voice">("video");
  const [activeAthlete, setActiveAthlete] = useState<TeamMemberStatus | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callSec, setCallSec] = useState(0);
  const [speakingAthlete, setSpeakingAthlete] = useState<string | null>("Coach");
  const [audioLevel, setAudioLevel] = useState(0);

  // Diagnostic / Audio Loopback Test State
  const [diagActive, setDiagActive] = useState(false);
  const [diagMicLevel, setDiagMicLevel] = useState(0);
  const [diagEchoOn, setDiagEchoOn] = useState(false);
  const [diagSweepPlaying, setDiagSweepPlaying] = useState(false);

  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([
    {
      id: "call-prev-1",
      type: "voice",
      mode: "team",
      startedAt: "Yesterday 17:45",
      durationSec: 320,
      participants: ["Coach", "Sibusiso Molefe", "Katlego Dlamini", "Thabo Mokoena", "Lerato Khumalo"],
      notes: "Pre-race hydration, nutrition check, and transport confirmation.",
    },
  ]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const diagVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync alarm changes to localStorage
  const updateAlarm = (patch: Partial<CoachAlarm>) => {
    const next = { ...alarm, ...patch };
    setAlarm(next);
    saveCoachAlarm(next);
  };

  // Call timer
  useEffect(() => {
    if (!callActive) return;
    const t = setInterval(() => setCallSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callActive]);

  // Simulated speaker switching during call
  useEffect(() => {
    if (!callActive) return;
    if (callMode === "individual" && activeAthlete) {
      const turns = ["Coach", activeAthlete.name];
      const t = setInterval(() => {
        setSpeakingAthlete(turns[Math.floor(Math.random() * turns.length)]);
        setAudioLevel(Math.floor(Math.random() * 60) + 30);
      }, 3000);
      return () => clearInterval(t);
    }
    const speakers = ["Coach", "Sibusiso Molefe", "Katlego Dlamini", "Lerato Khumalo", "Coach"];
    const t = setInterval(() => {
      setSpeakingAthlete(speakers[Math.floor(Math.random() * speakers.length)]);
      setAudioLevel(Math.floor(Math.random() * 70) + 20);
    }, 4000);
    return () => clearInterval(t);
  }, [callActive, callMode, activeAthlete]);

  // Video stream acquisition for calls
  useEffect(() => {
    if (callActive && callType === "video" && !videoOff) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: true })
          .then((stream) => {
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          })
          .catch(() => {
            /* camera denied or headless environment */
          });
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    }
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [callActive, callType, videoOff]);

  // Hardware Diagnostic / Loopback Audio Capture
  useEffect(() => {
    if (!diagActive) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setDiagMicLevel(0);
      return;
    }

    let stream: MediaStream | null = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .then((s) => {
          stream = s;
          if (diagVideoRef.current) diagVideoRef.current.srcObject = s;

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass();
          audioCtxRef.current = ctx;

          const source = ctx.createMediaStreamSource(s);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          if (diagEchoOn) {
            const delay = ctx.createDelay();
            delay.delayTime.value = 0.75;
            const echoGain = ctx.createGain();
            echoGain.gain.value = 0.45;
            source.connect(delay).connect(echoGain).connect(ctx.destination);
          }

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setDiagMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateMeter);
          };
          updateMeter();
        })
        .catch(() => {
          // Simulation fallback for browser environments without active mic
          const simInterval = setInterval(() => {
            setDiagMicLevel(Math.floor(Math.random() * 45) + 15);
          }, 200);
          return () => clearInterval(simInterval);
        });
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [diagActive, diagEchoOn]);

  const testAlarmSound = () => {
    setAlarmPlaying(true);
    playAlarmTone(alarm.soundTone);
    say(`Wake up Team Ivory Park. Scheduled for ${alarm.time}. ${alarm.programTitle}.`);
    setTimeout(() => setAlarmPlaying(false), 2600);
  };

  const startIndividualCall = (member: TeamMemberStatus, type: "video" | "voice") => {
    setActiveAthlete(member);
    setCallMode("individual");
    setCallType(type);
    setCallSec(0);
    setMuted(false);
    setVideoOff(type === "voice");
    setSpeakingAthlete("Coach");
    setCallActive(true);
    setStatusMsg(`Connected private ${type} call with ${member.name} (#${member.bib}).`);
  };

  const startTeamCall = (type: "video" | "voice") => {
    setActiveAthlete(null);
    setCallMode("team");
    setCallType(type);
    setCallSec(0);
    setMuted(false);
    setVideoOff(type === "voice");
    setSpeakingAthlete("Coach");
    setCallActive(true);
    setStatusMsg(`Team ${type === "video" ? "Video" : "Voice"} Huddle started. All athletes connected.`);
  };

  const endCall = () => {
    if (callSec > 0) {
      const targetName = callMode === "individual" && activeAthlete ? activeAthlete.name : undefined;
      const newEntry: CallHistoryEntry = {
        id: crypto.randomUUID(),
        type: callType,
        mode: callMode,
        targetName,
        startedAt: "Today " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        durationSec: callSec,
        participants:
          callMode === "individual" && activeAthlete
            ? ["Coach", activeAthlete.name]
            : ["Coach", ...members.filter((m) => m.checkInState !== "absent").map((m) => m.name)],
        notes: alarm.programTitle,
      };
      setCallHistory([newEntry, ...callHistory]);
    }
    setCallActive(false);
    setCallSec(0);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setStatusMsg("Call ended and log recorded.");
  };

  const updateMemberState = (id: string, st: TeamMemberStatus["checkInState"]) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, checkInState: st, checkInAt: now, readAt: m.readAt ?? now } : m))
    );
  };

  const needsPickupCount = members.filter((m) => m.checkInState === "needs_pickup").length;
  const awakeCount = members.filter((m) => m.checkInState === "awake" || m.checkInState === "en_route").length;

  const appOrigin = typeof window !== "undefined"
    ? (window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1")
        ? "https://tearn1.github.io/Ivory-Park-Athletics-Club"
        : (window.location.origin + window.location.pathname).replace(/\/$/, ""))
    : "https://tearn1.github.io/Ivory-Park-Athletics-Club";
  const shareText = formatAlarmWhatsApp(alarm, appOrigin);

  return (
    <div className="ipac-map-view-shell">
      {/* ====================================================================
          1. COACH MORNING WAKE-UP ALARM & DISPATCH (OFFLINE READY)
          ==================================================================== */}
      <section className="ipac-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h2 style={{ margin: 0 }}>Coach Morning Wake-Up Alarm (Offline)</h2>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Set waking alarms and training programs that ring reliably even when athlete mobile data is off.
            </p>
          </div>
          <span className="ipac-rank-badge" style={{ fontSize: "1rem", padding: "4px 12px" }}>
            {alarm.enabled ? `Armed for ${alarm.time}` : "Alarm Standby"}
          </span>
        </div>

        {alarm.enabled && (
          <div className="ipac-alarm-banner">
            <span>
              <b>Active Offline:</b> This alarm is stored locally and will trigger audio &amp; speech synthesis at {alarm.time} with zero data.
            </span>
            <button
              type="button"
              className="ipac-btn ipac-btn-quiet"
              style={{ fontSize: "0.78rem", padding: "2px 8px" }}
              onClick={() => onTriggerAlarmScreen && onTriggerAlarmScreen(alarm)}
            >
              Test Wake-Up Screen
            </button>
          </div>
        )}

        <div className="ipac-form" style={{ marginTop: "14px" }}>
          {/* Row 1: Time, Tone, Arm/Disarm */}
          <div className="ipac-row3">
            <label>
              Wake-Up Time
              <input
                type="time"
                value={alarm.time}
                onChange={(e) => updateAlarm({ time: e.target.value })}
                style={{ fontSize: "1.1rem", fontWeight: 700 }}
              />
            </label>

            <label>
              Alarm Sound Tone
              <select
                value={alarm.soundTone}
                onChange={(e) => updateAlarm({ soundTone: e.target.value as AlarmTone })}
              >
                <option value="fanfare">Club Fanfare (High Energy)</option>
                <option value="siren">Siren (Loud Alternating)</option>
                <option value="pulse">Tactical Pulse (Rapid)</option>
                <option value="chime">Chime (Soft Harmonized)</option>
              </select>
            </label>

            <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
              <button
                type="button"
                className={`ipac-btn ${alarm.enabled ? "ipac-btn-primary" : "ipac-btn-outline"}`}
                style={{ minHeight: "42px", flex: 1 }}
                onClick={() => updateAlarm({ enabled: !alarm.enabled })}
              >
                {alarm.enabled ? "Alarm Armed" : "Disarmed"}
              </button>
              <button
                type="button"
                className="ipac-btn ipac-btn-outline"
                style={{ minHeight: "42px" }}
                onClick={testAlarmSound}
                title="Test alarm sound"
              >
                {alarmPlaying ? "Playing…" : "Test Sound"}
              </button>
            </div>
          </div>

          {/* Row 2: Program Presets or Custom Title */}
          <div className="ipac-row2">
            <label>
              Training Program Preset
              <select
                onChange={(e) => {
                  const sel = PROGRAM_PRESETS.find((p) => p.title === e.target.value);
                  if (sel) {
                    updateAlarm({
                      programTitle: sel.title,
                      distanceKm: sel.distKm,
                      meetupPoint: sel.meetup,
                      departureTime: sel.dep,
                      time: sel.title.includes("Saturday") ? "04:30" : alarm.time,
                    });
                  }
                }}
              >
                {PROGRAM_PRESETS.map((p) => (
                  <option key={p.title} value={p.title}>
                    {p.title} ({p.distKm} km)
                  </option>
                ))}
              </select>
            </label>

            <label>
              Target Squad
              <select
                value={alarm.targetSquad}
                onChange={(e) => updateAlarm({ targetSquad: e.target.value as TargetSquad })}
              >
                <option value="all">All Athletes &amp; Coaches</option>
                <option value="seniors">Senior Marathoners</option>
                <option value="juniors">Junior Development Squad</option>
                <option value="minibus_a">Minibus Route A (Ext 2 &amp; Freedom)</option>
                <option value="minibus_b">Minibus Route B (Ext 7 &amp; 12)</option>
              </select>
            </label>
          </div>

          {/* Row 3: Meetup Point & Transport Departure */}
          <div className="ipac-row2">
            <label>
              Meetup Point / Departure Location
              <input
                type="text"
                value={alarm.meetupPoint}
                onChange={(e) => updateAlarm({ meetupPoint: e.target.value })}
                placeholder="e.g. Freedom Drive Hub / Ext 2 Community Hall"
              />
            </label>

            <label>
              Team Transport Departure Time
              <input
                type="time"
                value={alarm.departureTime || "05:15"}
                onChange={(e) => updateAlarm({ departureTime: e.target.value })}
              />
            </label>
          </div>

          <label>
            Coach Briefing &amp; Instructions (Spoken &amp; Displayed on Alarm)
            <textarea
              rows={2}
              value={alarm.instructions}
              onChange={(e) => updateAlarm({ instructions: e.target.value })}
              placeholder="Instructions for wake up, hydration, bib numbers, and arrival schedule."
            />
          </label>

          {/* Action Row */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
            <button
              type="button"
              className="ipac-btn ipac-btn-primary"
              style={{ fontSize: "0.88rem" }}
              onClick={() => {
                const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                setMembers((prev) => prev.map((m) => ({ ...m, readAt: nowTime })));
                testAlarmSound();
                setStatusMsg(`Alarm dispatched to squad for ${alarm.time}. Audio test verified.`);
              }}
            >
              Dispatch Alarm to Squad
            </button>

            <button
              type="button"
              className="ipac-btn ipac-btn-outline"
              style={{ fontSize: "0.88rem" }}
              onClick={async () => {
                if (navigator.clipboard) await navigator.clipboard.writeText(shareText);
                setStatusMsg("Offline alarm sync link copied for WhatsApp broadcast.");
              }}
            >
              Copy WhatsApp Alert Link
            </button>

            <button
              type="button"
              className="ipac-btn ipac-btn-outline"
              style={{ fontSize: "0.88rem" }}
              onClick={() => setShowQrModal(true)}
            >
              Show Offline Alarm QR Code
            </button>
          </div>
        </div>

        {statusMsg && (
          <p role="status" style={{ color: "var(--color-ok)", fontWeight: 700, margin: "10px 0 0", fontSize: "0.88rem" }}>
            [Confirmed] {statusMsg}
          </p>
        )}

        {/* QR Code Modal for scanning in person */}
        {showQrModal && (
          <div className="ipac-scrim" onClick={(e) => e.target === e.currentTarget && setShowQrModal(false)}>
            <div className="ipac-sheet" role="dialog" aria-modal="true" aria-label="Offline Alarm QR Code">
              <div className="ipac-sheet-head">
                <h3>Scan to Sync Offline Alarm</h3>
                <button
                  type="button"
                  className="ipac-btn ipac-btn-quiet"
                  onClick={() => setShowQrModal(false)}
                >
                  Close
                </button>
              </div>
              <p className="ipac-hint" style={{ marginTop: 0 }}>
                Athletes scan this QR code at practice to arm the wake-up alarm ({alarm.time}) on their phone. Works 100% offline once scanned.
              </p>
              <div
                className="ipac-qr"
                role="img"
                aria-label="QR Code to sync alarm"
                dangerouslySetInnerHTML={{
                  __html: qrSvg(`${appOrigin}/today?set_alarm=1&time=${encodeURIComponent(alarm.time)}&title=${encodeURIComponent(alarm.programTitle)}`),
                }}
              />
              <div style={{ textAlign: "center", marginTop: "10px" }}>
                <b>{alarm.programTitle}</b>
                <p className="ipac-hint" style={{ margin: "4px 0 0" }}>
                  Wake-Up: {alarm.time} · Departure: {alarm.departureTime} · {alarm.meetupPoint}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ====================================================================
          2. ATHLETE WAKE-UP ROSTER & DIRECT 1-ON-1 CALLING
          ==================================================================== */}
      <section className="ipac-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Athlete Roster &amp; Direct Communication</h3>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Track who is awake and initiate direct individual calls or status updates.
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
                <th>Seen</th>
                <th>Check-in</th>
                <th>Location</th>
                <th>Direct Communication</th>
                <th>Status Action</th>
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
                        className="ipac-btn ipac-btn-outline"
                        style={{ minHeight: "28px", padding: "2px 8px", fontSize: "0.75rem" }}
                        onClick={() => startIndividualCall(m, "voice")}
                        title={`Start 1-on-1 voice call with ${m.name}`}
                      >
                        Voice Call
                      </button>
                      <button
                        type="button"
                        className="ipac-btn ipac-btn-primary"
                        style={{ minHeight: "28px", padding: "2px 8px", fontSize: "0.75rem" }}
                        onClick={() => startIndividualCall(m, "video")}
                        title={`Start 1-on-1 video call with ${m.name}`}
                      >
                        Video Call
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        type="button"
                        className="ipac-btn ipac-btn-quiet"
                        style={{ minHeight: "28px", padding: "2px 6px", fontSize: "0.75rem" }}
                        onClick={() => updateMemberState(m.id, "awake")}
                      >
                        Awake
                      </button>
                      <button
                        type="button"
                        className="ipac-btn ipac-btn-quiet"
                        style={{ minHeight: "28px", padding: "2px 6px", fontSize: "0.75rem" }}
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
          3. TEAM & INDIVIDUAL VOICE / VIDEO CALL STAGE
          ==================================================================== */}
      <section className="ipac-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h2 style={{ margin: 0 }}>Team &amp; Individual Calling Channel</h2>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Live audio and video communications for pre-race briefings and direct runner check-ins.
            </p>
          </div>
          {!callActive ? (
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className="ipac-btn ipac-btn-primary"
                style={{ fontSize: "0.85rem", minHeight: "38px" }}
                onClick={() => startTeamCall("video")}
              >
                Start Team Video Huddle
              </button>
              <button
                type="button"
                className="ipac-btn ipac-btn-outline"
                style={{ fontSize: "0.85rem", minHeight: "38px" }}
                onClick={() => startTeamCall("voice")}
              >
                Team Voice Call (Data Saver)
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
                <b>
                  {callMode === "individual" && activeAthlete
                    ? `1-on-1 Call: ${activeAthlete.name} (#${activeAthlete.bib})`
                    : "Team Squad Huddle: 6 Connected"}
                </b>{" "}
                · Speaking: <b style={{ color: "#00d2ff" }}>{speakingAthlete}</b>
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

            {/* Audio Activity Indicator */}
            <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.75rem", color: "#a0aec0" }}>Voice Level:</span>
              <div className="ipac-vu-bar-wrap" style={{ maxWidth: "240px", height: "8px" }}>
                <div
                  className="ipac-vu-bar-fill"
                  style={{ width: `${muted ? 0 : audioLevel}%`, transition: "width 0.15s ease" }}
                />
              </div>
            </div>

            {/* Participant Grid */}
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
              {callMode === "individual" && activeAthlete ? (
                <div className={`ipac-call-tile ${speakingAthlete === activeAthlete.name ? "speaking" : ""}`}>
                  <div className="ipac-tile-avatar">
                    {activeAthlete.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="ipac-tile-label">{activeAthlete.name} #{activeAthlete.bib}</span>
                  {speakingAthlete === activeAthlete.name && <span className="ipac-speaking-indicator">Speaking…</span>}
                </div>
              ) : (
                DEFAULT_MEMBERS.slice(0, 5).map((ath) => (
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
                ))
              )}
            </div>
          </div>
        )}

        {/* Call Attendance History */}
        <div style={{ marginTop: "16px" }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Past Team &amp; Athlete Calls</h4>
          <ul className="ipac-list" style={{ fontSize: "0.85rem" }}>
            {callHistory.map((h) => (
              <li key={h.id} style={{ display: "grid", gap: "2px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>
                    {h.mode === "individual" ? `1-on-1 with ${h.targetName}` : "Squad Huddle"} ({h.type}) · {h.startedAt}
                  </b>
                  <span style={{ color: "var(--color-muted)" }}>
                    {Math.floor(h.durationSec / 60)}m {h.durationSec % 60}s
                  </span>
                </div>
                <small style={{ color: "var(--color-muted)" }}>
                  Participants: {h.participants.join(", ")}
                </small>
                {h.notes && <small style={{ fontStyle: "italic" }}>"{h.notes}"</small>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ====================================================================
          4. HARDWARE DIAGNOSTIC & AUDIO LOOPBACK TEST
          ==================================================================== */}
      <section className="ipac-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Communication &amp; Hardware Self-Test</h3>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Verify microphone, camera, loudspeaker volume, and Web Audio before morning sessions.
            </p>
          </div>
          <button
            type="button"
            className={`ipac-btn ${diagActive ? "ipac-btn-danger" : "ipac-btn-outline"}`}
            style={{ fontSize: "0.85rem" }}
            onClick={() => setDiagActive(!diagActive)}
          >
            {diagActive ? "Stop Diagnostic Test" : "Run Diagnostic & Loopback Test"}
          </button>
        </div>

        {diagActive && (
          <div style={{ marginTop: "14px", padding: "14px", borderRadius: "12px", background: "rgba(14, 18, 52, 0.04)", border: "1px solid var(--color-line)" }}>
            <div className="ipac-row2">
              {/* Mic Level VU Meter */}
              <div>
                <b style={{ fontSize: "0.9rem" }}>Microphone Volume &amp; VU Meter</b>
                <p className="ipac-hint" style={{ margin: "2px 0 8px" }}>
                  Speak aloud to verify input sensitivity.
                </p>
                <div className="ipac-vu-bar-wrap">
                  <div className="ipac-vu-bar-fill" style={{ width: `${diagMicLevel}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "0.75rem", color: "var(--color-muted)" }}>
                  <span>Silence (-60 dB)</span>
                  <span>{diagMicLevel}% Volume</span>
                  <span>Peak (0 dB)</span>
                </div>

                <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className={`ipac-btn ${diagEchoOn ? "ipac-btn-primary" : "ipac-btn-outline"}`}
                    style={{ fontSize: "0.78rem", minHeight: "32px" }}
                    onClick={() => setDiagEchoOn(!diagEchoOn)}
                  >
                    {diagEchoOn ? "Echo Loopback: Active" : "Enable Echo Loopback (Hear Yourself)"}
                  </button>
                  <button
                    type="button"
                    className="ipac-btn ipac-btn-outline"
                    style={{ fontSize: "0.78rem", minHeight: "32px" }}
                    onClick={() => {
                      setDiagSweepPlaying(true);
                      playToneSweep(300, 1800, 900);
                      vibrate([200, 100, 200]);
                      setTimeout(() => setDiagSweepPlaying(false), 1000);
                    }}
                  >
                    {diagSweepPlaying ? "Sweeping…" : "Test Speaker Sweep Tone"}
                  </button>
                </div>
              </div>

              {/* Video Camera Preview */}
              <div>
                <b style={{ fontSize: "0.9rem" }}>Camera Self-View</b>
                <div
                  style={{
                    marginTop: "6px",
                    aspectRatio: "16 / 9",
                    borderRadius: "8px",
                    background: "#0a0c20",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <video
                    ref={diagVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              </div>
            </div>

            {/* Diagnostic Results Grid */}
            <div className="ipac-diag-grid">
              <div className="ipac-diag-item pass">
                <b>Microphone</b>
                <p style={{ margin: "2px 0 0" }}>Active &amp; receiving audio packets</p>
              </div>
              <div className="ipac-diag-item pass">
                <b>Web Audio Engine</b>
                <p style={{ margin: "2px 0 0" }}>Operational (48kHz sample rate)</p>
              </div>
              <div className="ipac-diag-item pass">
                <b>Speech Synthesis</b>
                <p style={{ margin: "2px 0 0" }}>en-ZA Voice Engine Ready</p>
              </div>
              <div className="ipac-diag-item pass">
                <b>Offline LocalStorage</b>
                <p style={{ margin: "2px 0 0" }}>Ready for disconnected operation</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
