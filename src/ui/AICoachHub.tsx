import { useEffect, useRef, useState } from "react";
import {
  loadGeminiApiKey,
  processCoachQuery,
  saveGeminiApiKey,
  type CoachAction,
  type CoachMessage,
} from "../lib/geminiCoach";
import { startAlarmLoop, say, beep, vibrate } from "../lib/sound";
import type { Member } from "../lib/club";
import type { ClubScheduleDay } from "../lib/schedule";
import type { Session } from "../lib/session";

interface AICoachHubProps {
  onClose: () => void;
  members: Member[];
  schedule: ClubScheduleDay[];
  history: Session[];
  roleMode: "coach" | "athlete";
  onTriggerAlarmPreview?: () => void;
  onNavigateTab?: (tab: "today" | "session" | "runners" | "map" | "dispatch" | "club") => void;
  showToast: (msg: string) => void;
}

const PRESET_COMMANDS = [
  { label: "Analyze recent times", query: "Can you analyze our recent finishing times and past results?" },
  { label: "Who dropped pace?", query: "Who dropped pace or faded on the last run?" },
  { label: "Set alarm for 05:00", query: "Set wake-up alarm for all athletes at 05:00 for the morning session" },
  { label: "Saturday 21.1km Long Run", query: "Schedule Saturday 21.1km Long Run at 05:00 from Freedom Drive Hub" },
  { label: "Is training tomorrow? Reserve seat", query: "Is there training tomorrow? If so, reserve my seat in the transport van" },
  { label: "Check shoe wear & injuries", query: "Check squad for injuries, pace drop, and shoes exceeding 650km" },
  { label: "Post on The Resident & Grooves", query: "Post notice to The Resident and The Grooves: Morning endurance run starts 05:00 sharp" },
  { label: "Join QR Code (5km)", query: "Generate Join QR Code for 5km training session" },
];

function ActionCard({
  action,
  testingAlarm,
  onToggleAlarm,
  onTriggerAlarmPreview,
  onNavigateTab,
  onClose,
  showToast,
}: {
  action: CoachAction;
  testingAlarm: boolean;
  onToggleAlarm: () => void;
  onTriggerAlarmPreview?: () => void;
  onNavigateTab?: (tab: "today" | "session" | "runners" | "map" | "dispatch" | "club") => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  return (
    <div className="ipac-coach-action-card">
      <div className="ipac-coach-action-label">Action Executed: {action.description}</div>

      {/* Set Alarm Card */}
      {action.type === "set_alarm" && (
        <div className="ipac-coach-card-content">
          <div className="ipac-coach-alarm-time">{action.payload.time}</div>
          <div style={{ fontWeight: 700, margin: "2px 0" }}>{action.payload.title}</div>
          <div className="ipac-hint" style={{ margin: "0 0 8px" }}>
            Meetup: {action.payload.meetupPoint} • Distance: {action.payload.distanceKm} km
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="ipac-btn ipac-btn-outline"
              style={{ fontSize: "0.8rem", padding: "4px 8px" }}
              onClick={onToggleAlarm}
            >
              {testingAlarm ? "Stop Alarm Test" : "Test Alarm Sound"}
            </button>
            {onTriggerAlarmPreview && (
              <button
                type="button"
                className="ipac-btn ipac-btn-quiet"
                style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                onClick={onTriggerAlarmPreview}
              >
                Preview Full Screen
              </button>
            )}
          </div>
        </div>
      )}

      {/* QR Code Action Card */}
      {action.type === "generate_qr" && (
        <div className="ipac-coach-card-content" style={{ textAlign: "center" }}>
          <div
            className="ipac-coach-qr-wrap"
            dangerouslySetInnerHTML={{
              __html: action.payload.svg || "",
            }}
          />
          <div style={{ fontSize: "0.85rem", marginTop: "6px" }}>
            Session Distance: <b>{action.payload.distanceKm} km</b>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", wordBreak: "break-all", marginTop: "4px" }}>
            {action.payload.joinUrl}
          </div>
        </div>
      )}

      {/* Post Community Notice Card */}
      {action.type === "post_community_notice" && (
        <div className="ipac-coach-card-content">
          <div style={{ fontSize: "0.8rem", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase" }}>
            {action.payload.channel}
          </div>
          <blockquote className="ipac-coach-quote">{action.payload.text}</blockquote>
          <button
            type="button"
            className="ipac-btn ipac-btn-outline"
            style={{ fontSize: "0.8rem", padding: "4px 8px", marginTop: "6px" }}
            onClick={() => {
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(action.payload.text);
              }
              showToast("Notice copied to clipboard for WhatsApp");
            }}
          >
            Copy for WhatsApp
          </button>
        </div>
      )}

      {/* Reserve Seat Card */}
      {action.type === "reserve_seat" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="ipac-coach-status-confirmed">CONFIRMED</span>
            <b>{action.payload.vehicle}</b>
          </div>
          <div className="ipac-hint" style={{ margin: "4px 0 0" }}>
            Passenger: {action.payload.athleteName} • Departure: 05:15 at Freedom Drive Hub
          </div>
        </div>
      )}

      {/* Squad Analysis Card */}
      {action.type === "analyze_squad" && (
        <div className="ipac-coach-card-content">
          <div style={{ fontSize: "0.85rem" }}>{action.payload.summary || action.description}</div>
          {onNavigateTab && (
            <button
              type="button"
              className="ipac-btn ipac-btn-outline"
              style={{ fontSize: "0.8rem", padding: "4px 8px", marginTop: "8px" }}
              onClick={() => {
                onClose();
                onNavigateTab("runners");
              }}
            >
              Inspect Roster in Runners Tab
            </button>
          )}
        </div>
      )}

      {/* Route Recommendation Card */}
      {action.type === "recommend_route" && (
        <div className="ipac-coach-card-content">
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            {action.payload.routeName} ({action.payload.distanceKm} km)
          </div>
          <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "2px" }}>
            Elevation: +{action.payload.elevationGainM}m (Highveld Thin Air)
          </div>
          <div className="ipac-hint" style={{ margin: "4px 0 8px" }}>
            {action.payload.notes}
          </div>
          {onNavigateTab && (
            <button
              type="button"
              className="ipac-btn ipac-btn-outline"
              style={{ fontSize: "0.8rem", padding: "4px 8px" }}
              onClick={() => {
                onClose();
                onNavigateTab("map");
              }}
            >
              View Elevation &amp; Turns on Map
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AICoachHub({
  onClose,
  members,
  schedule,
  history,
  roleMode,
  onTriggerAlarmPreview,
  onNavigateTab,
  showToast,
}: AICoachHubProps) {
  const [apiKey, setApiKey] = useState(() => loadGeminiApiKey());
  const [apiKeyInput, setApiKeyInput] = useState(() => loadGeminiApiKey());
  const [showKeyDrawer, setShowKeyDrawer] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [testingAlarm, setTestingAlarm] = useState(false);
  const stopAlarmRef = useRef<(() => void) | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<CoachMessage[]>(() => {
    return [
      {
        id: "intro",
        role: "coach",
        text: `Sanibonani! Head Coach and Founder here. Whether you want to talk about how your training is feeling, analyze our past finishing times and pace trends, set morning alarms, or schedule our next Highveld session, I am right here with you. What is on your mind?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      if (stopAlarmRef.current) {
        stopAlarmRef.current();
        stopAlarmRef.current = null;
      }
    };
  }, []);

  const handleToggleAlarm = () => {
    if (testingAlarm) {
      if (stopAlarmRef.current) {
        stopAlarmRef.current();
        stopAlarmRef.current = null;
      }
      setTestingAlarm(false);
    } else {
      stopAlarmRef.current = startAlarmLoop("pulse");
      setTestingAlarm(true);
      vibrate([300, 100, 300, 100, 500]);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || inputVal).trim();
    if (!q || loading) return;

    const userMsg: CoachMessage = {
      id: Date.now().toString(),
      role: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setLoading(true);
    vibrate(20);

    try {
      const response = await processCoachQuery(q, {
        members,
        history,
        schedule,
        roleMode,
        apiKey,
      });

      setMessages((prev) => [...prev, response]);
      beep(880, 70);

      // Speak key confirmation if brief
      if (response.text.length < 120) {
        say(response.text);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "coach",
          text: "I encountered an issue processing that query. Operating on fallback offline mode.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim();
    saveGeminiApiKey(trimmed);
    setApiKey(trimmed);
    setShowKeyDrawer(false);
    showToast(trimmed ? "Google AI Studio API Key saved" : "API Key cleared; using offline engine");
  };

  return (
    <div className="ipac-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ipac-sheet ipac-coach-hub-sheet" role="dialog" aria-modal="true" aria-label="AI Head Coach and Founder Hub">
        {/* Header */}
        <div className="ipac-coach-header">
          <div className="ipac-coach-title-wrap">
            <div className="ipac-coach-badge">
              <span className="ipac-coach-status-dot" />
              <span>{apiKey ? "Gemini 1.5/2.0 Live" : "Offline Coach Engine"}</span>
            </div>
            <h2>Gemini Head Coach &amp; Founder</h2>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Ivory Park Athletics Club • Autonomous Squad Management
            </p>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              className="ipac-btn ipac-btn-quiet"
              style={{ fontSize: "0.8rem", padding: "6px 10px" }}
              title="Google AI Studio Settings"
              onClick={() => setShowKeyDrawer((v) => !v)}
            >
              {showKeyDrawer ? "Hide Key" : "API Key"}
            </button>
            <button
              type="button"
              className="ipac-btn ipac-btn-quiet"
              autoFocus
              aria-label="Close AI Coach Hub"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {/* API Key Drawer */}
        {showKeyDrawer && (
          <div className="ipac-coach-key-drawer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label htmlFor="gemini-key-input" style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                Google AI Studio API Key (Free Tier)
              </label>
              <small style={{ color: "#94a3b8" }}>Gemini 1.5 &amp; 2.0 Flash</small>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                id="gemini-key-input"
                type="password"
                className="ipac-input"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                style={{ flex: 1, fontFamily: "monospace", fontSize: "0.85rem" }}
              />
              <button type="button" className="ipac-btn ipac-btn-primary" onClick={handleSaveKey}>
                Save
              </button>
              {apiKey && (
                <button
                  type="button"
                  className="ipac-btn ipac-btn-outline"
                  onClick={() => {
                    setApiKeyInput("");
                    saveGeminiApiKey("");
                    setApiKey("");
                    showToast("Cleared API key");
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <p className="ipac-hint" style={{ fontSize: "0.75rem", margin: "6px 0 0" }}>
              A key enables deep reasoning with Gemini 1.5/2.0 Flash at zero cost via Google AI Studio. Without a key, all actions run 100% offline using instant heuristic pattern matching.
            </p>
          </div>
        )}

        {/* Preset Command Chips */}
        <div className="ipac-coach-presets" role="toolbar" aria-label="Quick Coach Actions">
          {PRESET_COMMANDS.map((cmd) => (
            <button
              key={cmd.label}
              type="button"
              className="ipac-coach-chip"
              onClick={() => handleSend(cmd.query)}
              disabled={loading}
            >
              {cmd.label}
            </button>
          ))}
        </div>

        {/* Conversation Stream */}
        <div className="ipac-coach-messages" ref={chatScrollRef} role="log" aria-live="polite">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`ipac-coach-msg ${m.role === "coach" ? "ipac-coach-msg-coach" : "ipac-coach-msg-user"}`}
            >
              <div className="ipac-coach-msg-header">
                <b>{m.role === "coach" ? "Head Coach (Gemini)" : "You"}</b>
                <span className="ipac-coach-msg-time">{m.timestamp}</span>
              </div>
              <div className="ipac-coach-msg-body">{m.text}</div>

              {m.action && (
                <ActionCard
                  action={m.action}
                  testingAlarm={testingAlarm}
                  onToggleAlarm={handleToggleAlarm}
                  onTriggerAlarmPreview={onTriggerAlarmPreview}
                  onNavigateTab={onNavigateTab}
                  onClose={onClose}
                  showToast={showToast}
                />
              )}
            </div>
          ))}
          {loading && (
            <div className="ipac-coach-msg ipac-coach-msg-coach">
              <div className="ipac-coach-msg-header">
                <b>Head Coach (Gemini)</b>
              </div>
              <div className="ipac-coach-msg-body ipac-coach-thinking">
                Consulting training log and executing command...
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          className="ipac-coach-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            className="ipac-input ipac-coach-text-input"
            placeholder="Command coach (e.g. 'Set alarm for 05:00', 'Post to The Resident')..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="ipac-btn ipac-btn-primary"
            style={{ fontWeight: 700, padding: "0 18px", minHeight: "44px" }}
            disabled={!inputVal.trim() || loading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
