import { useEffect, useRef, useState } from "react";
import {
  loadGeminiApiKey,
  processCoachQuery,
  saveGeminiApiKey,
  type CoachAction,
  type CoachMessage,
  type CoachStructuredReport,
} from "../lib/geminiCoach";
import { startAlarmLoop, say, beep, vibrate } from "../lib/sound";
import type { Member } from "../lib/club";
import type { ClubScheduleDay } from "../lib/schedule";
import type { Session } from "../lib/session";
import type { AthleteProfile } from "../lib/auth";
import {
  loadAthleteChatHistory,
  saveAthleteChatHistory,
  clearAthleteChatHistory,
} from "../lib/chatStorage";

interface AICoachHubProps {
  onClose: () => void;
  members: Member[];
  schedule: ClubScheduleDay[];
  history: Session[];
  roleMode: "coach" | "athlete";
  currentAthlete?: AthleteProfile | null;
  onOpenProfileModal?: () => void;
  onTriggerAlarmPreview?: () => void;
  onNavigateTab?: (tab: "today" | "session" | "runners" | "map" | "dispatch" | "club") => void;
  showToast: (msg: string) => void;
}

const PRESET_COMMANDS = [
  { label: "Analyze recent times", query: "Can you analyze our recent finishing times and past results?" },
  { label: "Who dropped pace?", query: "Who dropped pace or faded on the last run?" },
  { label: "Cadence Metronome", query: "Activate 180 SPM cadence metronome" },
  { label: "Shoe Wear Scanner", query: "Inspect shoe tread wear and foam creasing" },
  { label: "Race Time Predictor", query: "Predict my Soweto and Comrades race times from 5km PB" },
  { label: "Weather Pace Adjuster", query: "Adjust training pace for Highveld weather and 28C heat" },
  { label: "Morning Readiness", query: "Check my morning readiness and recovery score" },
  { label: "Heart Rate Zones", query: "Calculate my 5 personalized heart rate zones" },
  { label: "Generate 15km Route", query: "Generate a 15km perimeter route with elevation and GPX" },
  { label: "Fartlek Workout (Sync)", query: "Create a 40-minute Highveld fartlek ladder workout" },
  { label: "Highveld Nutrition Guide", query: "Show Highveld fueling and pre-run nutrition guide" },
  { label: "Transport Manifest", query: "Show away race transport manifest and reserve seat" },
  { label: "Club Trophies", query: "Show club trophy room and milestone achievements" },
  { label: "Relay Selector", query: "Pick our fastest 4x400m senior relay squad" },
  { label: "Pacing Card (Sub-40)", query: "Generate 10km Sub-40 kilometer split pacing card" },
  { label: "Injury Checker", query: "Triage shin splints injury and return-to-run rehab" },
  { label: "Set alarm for 05:00", query: "Set wake-up alarm for all athletes at 05:00 for the morning session" },
  { label: "Saturday 21.1km Long Run", query: "Schedule Saturday 21.1km Long Run at 05:00 from Freedom Drive Hub" },
  { label: "Post on WhatsApp", query: "Format official WhatsApp broadcast for Saturday morning run" },
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
  currentMetronomeSpm,
  onToggleMetronome,
  selectedSpm,
  onSelectSpm,
  handleDownloadGpx,
}: {
  action: CoachAction;
  testingAlarm: boolean;
  onToggleAlarm: () => void;
  onTriggerAlarmPreview?: () => void;
  onNavigateTab?: (tab: "today" | "session" | "runners" | "map" | "dispatch" | "club") => void;
  onClose: () => void;
  showToast: (msg: string) => void;
  currentMetronomeSpm: number | null;
  onToggleMetronome: (spm: number) => void;
  selectedSpm: number;
  onSelectSpm: (spm: number) => void;
  handleDownloadGpx: (filename: string, gpxData: string) => void;
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

      {/* Post Community Notice / WhatsApp Card */}
      {action.type === "post_community_notice" && (
        <div className="ipac-coach-card-content">
          <div style={{ fontSize: "0.8rem", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase" }}>
            {action.payload.channel}
          </div>
          <blockquote className="ipac-coach-quote" style={{ whiteSpace: "pre-line" }}>{action.payload.text}</blockquote>
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

      {/* 1. Shoe Scan Card */}
      {action.type === "shoe_scan" && (
        <div className="ipac-coach-card-content ipac-coach-shoe-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{action.payload.shoeModel}</b>
            <span className={`ipac-stat-badge ipac-stat-badge-${action.payload.injuryRisk === "High" ? "drop" : "warning"}`}>
              {action.payload.injuryRisk} Injury Risk
            </span>
          </div>
          <div className="ipac-shoe-km-meter" style={{ margin: "6px 0" }}>
            <div className="ipac-shoe-km-label">
              <span>Mileage: {action.payload.kmLogged} km</span>
              <span>Limit: {action.payload.thresholdKm} km</span>
            </div>
            <div className="ipac-shoe-progress-bar">
              <div
                className="ipac-shoe-progress-fill"
                style={{ width: `${Math.min(100, (action.payload.kmLogged / action.payload.thresholdKm) * 100)}%` }}
              />
            </div>
          </div>
          <div style={{ fontSize: "0.82rem", lineHeight: 1.4, margin: "6px 0" }}>
            <div>• <b>Outsole:</b> {action.payload.outsoleWear}</div>
            <div>• <b>Midsole:</b> {action.payload.midsoleCompression}</div>
            <div>• <b>Pronation:</b> {action.payload.pronationType}</div>
          </div>
          <div className="ipac-stat-details" style={{ color: "#b91c1c" }}>
            {action.payload.recommendation}
          </div>
        </div>
      )}

      {/* 2. Weather & Altitude Pace Adjuster */}
      {action.type === "weather_pace" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#0284c7" }}>
              Highveld Conditions: {action.payload.tempC}°C • {action.payload.humidityPct}% Humidity • {action.payload.altitudeM}m
            </span>
            <span className="ipac-stat-badge ipac-stat-badge-warning">{action.payload.heatIndexLevel}</span>
          </div>
          <div className="ipac-stat-metrics" style={{ margin: "8px 0" }}>
            <div className="ipac-stat-metric">
              <span className="ipac-stat-metric-label">Base Pace</span>
              <span className="ipac-stat-metric-val">{action.payload.basePace}</span>
            </div>
            <div className="ipac-stat-metric">
              <span className="ipac-stat-metric-label">Target Adjusted</span>
              <span className="ipac-stat-metric-val ipac-stat-time" style={{ color: "#d97706" }}>
                {action.payload.adjustedPace}
              </span>
            </div>
            <div className="ipac-stat-metric">
              <span className="ipac-stat-metric-label">Pace Offset</span>
              <span className="ipac-stat-metric-val">+{action.payload.differenceSec}s/km</span>
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.35 }}>
            <div>• <b>Hydration:</b> {action.payload.hydrationTarget}</div>
            <div>• <b>Optimal Window:</b> {action.payload.optimalWindow}</div>
          </div>
        </div>
      )}

      {/* 3. GPX Route Generator */}
      {action.type === "gpx_route" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{action.payload.routeName}</b>
            <span className="ipac-stat-badge ipac-stat-badge-steady">{action.payload.distanceKm} km</span>
          </div>
          <div className="ipac-hint" style={{ margin: "4px 0" }}>
            Elevation Gain: +{action.payload.elevationGainM}m • Surface: {action.payload.surface}
          </div>
          <div style={{ fontSize: "0.8rem", margin: "6px 0", paddingLeft: "4px" }}>
            {action.payload.waypoints?.map((w: any, idx: number) => (
              <div key={idx} style={{ margin: "2px 0" }}>
                <span style={{ color: "#0284c7", fontWeight: 700 }}>km {w.km}:</span> {w.name} ({w.elevationM}m)
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              className="ipac-btn ipac-btn-primary"
              style={{ fontSize: "0.8rem", padding: "6px 12px" }}
              onClick={() => handleDownloadGpx(action.payload.gpxFilename, action.payload.gpxData)}
            >
              Download GPX File
            </button>
            {onNavigateTab && (
              <button
                type="button"
                className="ipac-btn ipac-btn-outline"
                style={{ fontSize: "0.8rem", padding: "6px 10px" }}
                onClick={() => {
                  onClose();
                  onNavigateTab("map");
                }}
              >
                Inspect Map
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Morning Readiness Score */}
      {action.type === "readiness_score" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="ipac-readiness-circle">
                <span className="ipac-readiness-score-num">{action.payload.score}</span>
                <span className="ipac-readiness-score-denom">/10</span>
              </div>
              <div>
                <span className="ipac-stat-badge ipac-stat-badge-pb">{action.payload.status} Readiness</span>
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "3px" }}>
                  Sleep: {action.payload.sleepHours}h • Resting HR: {action.payload.restingHrBpm} BPM
                </div>
              </div>
            </div>
          </div>
          <div className="ipac-stat-details" style={{ marginTop: "8px" }}>
            <div>• <b>Prescription:</b> {action.payload.workoutRecommendation}</div>
            <div>• <b>Contingency:</b> {action.payload.alternativeSession}</div>
          </div>
        </div>
      )}

      {/* 5. Race Time Predictor */}
      {action.type === "race_prediction" && (
        <div className="ipac-coach-card-content">
          <div style={{ fontWeight: 800, fontSize: "0.88rem", marginBottom: "4px" }}>
            Pete Riegel Championship Predictions (Baseline: 5km in {action.payload.baseTimeStr})
          </div>
          <div className="ipac-table-wrap" style={{ margin: "6px 0" }}>
            <table className="ipac-table" style={{ fontSize: "0.78rem", width: "100%" }}>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Projected Time</th>
                  <th>Target Pace</th>
                </tr>
              </thead>
              <tbody>
                {action.payload.predictions?.map((p: any, idx: number) => (
                  <tr key={idx}>
                    <td><b>{p.race}</b></td>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{p.timeStr}</td>
                    <td style={{ fontFamily: "monospace" }}>{p.paceStr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Relay Selector */}
      {action.type === "relay_selector" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{action.payload.eventName}</b>
            <span className="ipac-stat-badge ipac-stat-badge-pb">Projected: {action.payload.projectedTotalTime}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "8px 0" }}>
            {action.payload.legs?.map((leg: any, idx: number) => (
              <div key={idx} className="ipac-relay-leg-item">
                <span className="ipac-relay-leg-num">Leg {leg.leg}</span>
                <div style={{ flex: 1 }}>
                  <b>{leg.athlete}</b> (#{leg.bib}) • <span style={{ color: "#0284c7" }}>{leg.role}</span>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{leg.tacticalReason}</div>
                </div>
                <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{leg.splitTime}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Heart Rate Zones */}
      {action.type === "hr_zones" && (
        <div className="ipac-coach-card-content">
          <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>
            5-Zone Highveld Heart Rate Targets (Max HR: {action.payload.maxHr} BPM)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", margin: "8px 0" }}>
            {action.payload.zones?.map((z: any, idx: number) => (
              <div key={idx} className="ipac-hr-zone-row">
                <span className={`ipac-hr-zone-tag ipac-hr-zone-${idx + 1}`}>{z.zone}</span>
                <div style={{ flex: 1 }}>
                  <b>{z.name}</b> ({z.pctRange})
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{z.purpose}</div>
                </div>
                <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{z.bpmRange}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Nutrition Guide */}
      {action.type === "nutrition_guide" && (
        <div className="ipac-coach-card-content">
          <div style={{ fontWeight: 800, fontSize: "0.88rem", marginBottom: "6px" }}>
            Highveld Fueling &amp; Hydration Protocol
          </div>
          <div style={{ fontSize: "0.8rem", lineHeight: 1.4, display: "flex", flexDirection: "column", gap: "4px" }}>
            <div>• <b>Pre-Run ({action.payload.preRunTiming}):</b> {action.payload.preRunMeal}</div>
            <div>• <b>During Run (&gt;75 min):</b> {action.payload.intraRunFuel}</div>
            <div>• <b>Post-Run Recovery:</b> {action.payload.postRunMeal}</div>
            <div>• <b>Hydration Schedule:</b> {action.payload.hydrationSchedule}</div>
          </div>
          <div className="ipac-hint" style={{ marginTop: "6px" }}>
            {action.payload.highveldTip}
          </div>
        </div>
      )}

      {/* 9. Injury Triage */}
      {action.type === "injury_triage" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{action.payload.suspectedCondition}</b>
            <span className="ipac-stat-badge ipac-stat-badge-warning">{action.payload.severity} Severity</span>
          </div>
          <div style={{ fontSize: "0.82rem", margin: "6px 0" }}>
            <div>• <b>Immediate Action:</b> {action.payload.immediateAction}</div>
          </div>
          <div style={{ fontSize: "0.8rem", margin: "6px 0" }}>
            <b>Rehabilitation Exercises:</b>
            <ul style={{ margin: "4px 0", paddingLeft: "18px" }}>
              {action.payload.rehabExercises?.map((ex: string, idx: number) => (
                <li key={idx}>{ex}</li>
              ))}
            </ul>
          </div>
          <div style={{ fontSize: "0.78rem", color: "#0e7a3d", fontWeight: 700 }}>
            Return Criteria: {action.payload.returnCriteria}
          </div>
          <div className="ipac-hint" style={{ marginTop: "4px" }}>
            {action.payload.referralWarning}
          </div>
        </div>
      )}

      {/* 10. Pacing Card */}
      {action.type === "pacing_card" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{action.payload.raceName}</b>
            <span className="ipac-stat-badge ipac-stat-badge-pb">{action.payload.targetTime}</span>
          </div>
          <div className="ipac-hint" style={{ margin: "2px 0 6px" }}>
            Avg Pace: {action.payload.avgPace} • Strategy: {action.payload.strategy}
          </div>
          <div className="ipac-table-wrap" style={{ maxHeight: "200px", overflowY: "auto" }}>
            <table className="ipac-table" style={{ fontSize: "0.75rem", width: "100%" }}>
              <thead>
                <tr>
                  <th>Km</th>
                  <th>Split</th>
                  <th>Elapsed</th>
                  <th>Terrain / Tactics</th>
                </tr>
              </thead>
              <tbody>
                {action.payload.kmSplits?.map((s: any) => (
                  <tr key={s.km}>
                    <td><b>{s.km}</b></td>
                    <td style={{ fontFamily: "monospace" }}>{s.splitTime}</td>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{s.cumulativeTime}</td>
                    <td>{s.elevationNote} {s.aidStation ? "• Water" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 11. Audio Cue Card */}
      {action.type === "audio_cue" && (
        <div className="ipac-coach-card-content">
          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#0284c7" }}>
            Tactical Audio Drop • Kilometer {action.payload.kmMarker}
          </div>
          <blockquote className="ipac-coach-quote">{action.payload.cueText}</blockquote>
          <button
            type="button"
            className="ipac-btn ipac-btn-primary"
            style={{ fontSize: "0.8rem", padding: "6px 12px", marginTop: "6px" }}
            onClick={() => {
              beep(880, 80);
              say(action.payload.cueText);
              showToast("Playing Coach Audio Drop");
            }}
          >
            Play Coach Audio Drop
          </button>
        </div>
      )}

      {/* 12. Cadence Metronome Widget */}
      {action.type === "cadence_metronome" && (
        <div className="ipac-coach-card-content ipac-coach-metronome-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>Cadence Metronome</b>
            <span className="ipac-stat-badge ipac-stat-badge-steady">
              {currentMetronomeSpm || action.payload.defaultSpm} SPM
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "10px 0" }}>
            <input
              type="range"
              min={action.payload.minSpm}
              max={action.payload.maxSpm}
              value={selectedSpm}
              onChange={(e) => onSelectSpm(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontFamily: "monospace", fontWeight: 800, minWidth: "55px" }}>
              {selectedSpm} SPM
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className={`ipac-btn ${currentMetronomeSpm ? "ipac-btn-danger" : "ipac-btn-primary"}`}
              style={{ fontSize: "0.82rem", padding: "6px 14px" }}
              onClick={() => onToggleMetronome(selectedSpm)}
            >
              {currentMetronomeSpm ? "Stop Metronome" : "Start 180 SPM Beat"}
            </button>
            {currentMetronomeSpm && (
              <span className="ipac-metronome-pulse-dot" />
            )}
          </div>
          <div className="ipac-hint" style={{ marginTop: "6px" }}>
            {action.payload.benefits}
          </div>
        </div>
      )}

      {/* 13. Trophy Room */}
      {action.type === "trophy_room" && (
        <div className="ipac-coach-card-content">
          <div style={{ fontWeight: 800, fontSize: "0.88rem", marginBottom: "6px" }}>
            Club Honors &amp; Milestone Achievements
          </div>
          <div className="ipac-trophy-grid">
            {action.payload.trophies?.map((t: any, idx: number) => (
              <div key={idx} className="ipac-trophy-badge">
                <div className="ipac-trophy-icon">🏆</div>
                <div style={{ fontWeight: 800, fontSize: "0.82rem" }}>{t.title}</div>
                <div style={{ fontSize: "0.74rem", color: "#0284c7" }}>{t.recipient}</div>
                <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{t.achievement}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 14. Periodization Plan */}
      {action.type === "periodization_plan" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{action.payload.totalWeeks}-Week Championship Periodization</b>
            <span className="ipac-stat-badge ipac-stat-badge-steady">{action.payload.raceTarget}</span>
          </div>
          <div className="ipac-table-wrap" style={{ margin: "6px 0" }}>
            <table className="ipac-table" style={{ fontSize: "0.75rem", width: "100%" }}>
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Timeline</th>
                  <th>Weekly Km</th>
                  <th>Key Session</th>
                </tr>
              </thead>
              <tbody>
                {action.payload.phases?.map((p: any, idx: number) => (
                  <tr key={idx}>
                    <td><b>{p.phase}</b></td>
                    <td>{p.weeks}</td>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{p.weeklyKm}</td>
                    <td>{p.keyWorkout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 15. Workout Sync */}
      {action.type === "workout_sync" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{action.payload.workoutName}</b>
            <span className="ipac-stat-badge ipac-stat-badge-pb">{action.payload.totalMinutes} Min</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "6px 0" }}>
            {action.payload.steps?.map((st: any, idx: number) => (
              <div key={idx} style={{ fontSize: "0.78rem", display: "flex", justifyContent: "space-between" }}>
                <span><b>{st.step}</b> ({st.durationMin}m)</span>
                <span style={{ fontFamily: "monospace" }}>{st.targetPace}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ipac-btn ipac-btn-primary"
            style={{ fontSize: "0.82rem", padding: "6px 14px", marginTop: "6px" }}
            onClick={() => {
              onClose();
              if (onNavigateTab) onNavigateTab("session");
              showToast("Workout loaded into active interval session");
            }}
          >
            Sync to Workout Timer
          </button>
        </div>
      )}

      {/* 16. Transport Manifest */}
      {action.type === "transport_manifest" && (
        <div className="ipac-coach-card-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>{action.payload.destination}</b>
            <span className="ipac-stat-badge ipac-stat-badge-steady">R{action.payload.costPerRunnerZar} / Runner</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "8px 0" }}>
            {action.payload.vans?.map((v: any, idx: number) => (
              <div key={idx} className="ipac-relay-leg-item">
                <span className="ipac-relay-leg-num">{v.name}</span>
                <div style={{ flex: 1 }}>
                  <b>Driver: {v.driver}</b> • Depart: {v.departureTime}
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Pickup: {v.pickupLocation}</div>
                </div>
                <span style={{ fontWeight: 800 }}>{v.booked} / {v.capacity} Seats</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ipac-btn ipac-btn-outline"
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
            onClick={() => showToast("Seat reservation confirmed")}
          >
            Reserve My Seat
          </button>
        </div>
      )}
    </div>
  );
}

function StructuredReportView({ report }: { report: CoachStructuredReport }) {
  return (
    <div className="ipac-report-container">
      <div className="ipac-report-header">
        <div className="ipac-report-title">{report.title}</div>
        {report.subtitle && <div className="ipac-report-sub">{report.subtitle}</div>}
      </div>
      <div className="ipac-report-list">
        {report.items.map((item, idx) => {
          const statusClass =
            item.status === "drop"
              ? "ipac-stat-card-drop"
              : item.status === "pb"
              ? "ipac-stat-card-pb"
              : item.status === "warning"
              ? "ipac-stat-card-warning"
              : "ipac-stat-card-steady";

          return (
            <div key={`${item.name}-${idx}`} className={`ipac-runner-stat-card ${statusClass}`}>
              <div className="ipac-stat-card-top">
                <div className="ipac-stat-runner-name">
                  <span className="ipac-stat-bullet" aria-hidden="true">•</span>
                  <b>{item.name}</b>
                  {item.bib && <span className="ipac-stat-bib">#{item.bib}</span>}
                </div>
                <span className={`ipac-stat-badge ipac-stat-badge-${item.status}`}>
                  {item.statusLabel}
                </span>
              </div>
              <div className="ipac-stat-metrics">
                <div className="ipac-stat-metric">
                  <span className="ipac-stat-metric-label">Finishing Time</span>
                  <span className="ipac-stat-metric-val ipac-stat-time">{item.timeStr}</span>
                </div>
                <div className="ipac-stat-metric">
                  <span className="ipac-stat-metric-label">Avg Pace</span>
                  <span className="ipac-stat-metric-val ipac-stat-pace">{item.paceStr}</span>
                </div>
                {item.distanceKm !== undefined && (
                  <div className="ipac-stat-metric">
                    <span className="ipac-stat-metric-label">Distance</span>
                    <span className="ipac-stat-metric-val">{item.distanceKm} km</span>
                  </div>
                )}
              </div>
              {item.details && (
                <div className="ipac-stat-details">
                  <span className="ipac-stat-detail-icon" aria-hidden="true">↳</span> {item.details}
                </div>
              )}
              {item.shoeInfo && (
                <div className="ipac-stat-shoe">
                  Gear: {item.shoeInfo}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {report.summaryNote && (
        <div className="ipac-report-summary-note">
          {report.summaryNote}
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
  currentAthlete,
  onOpenProfileModal,
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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [metronomeSpm, setMetronomeSpm] = useState<number | null>(null);
  const [selectedSpm, setSelectedSpm] = useState<number>(180);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stopAlarmRef = useRef<(() => void) | null>(null);
  const metronomeTimerRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<CoachMessage[]>(() =>
    loadAthleteChatHistory(currentAthlete || null)
  );

  // Sync chat history if athlete profile changes
  useEffect(() => {
    setMessages(loadAthleteChatHistory(currentAthlete || null));
  }, [currentAthlete?.id]);

  // Persist messages whenever updated
  useEffect(() => {
    if (messages.length > 0) {
      saveAthleteChatHistory(currentAthlete || null, messages);
    }
  }, [messages, currentAthlete?.id]);

  const handleClearHistory = () => {
    const fresh = clearAthleteChatHistory(currentAthlete || null);
    setMessages(fresh);
    showToast("Private coaching chat history cleared");
  };

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
      if (metronomeTimerRef.current) {
        clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
    };
  }, []);

  const toggleMetronome = (spm: number) => {
    if (metronomeSpm) {
      if (metronomeTimerRef.current) {
        clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
      setMetronomeSpm(null);
    } else {
      setMetronomeSpm(spm);
      beep(1200, 20, 0.4);
      const intervalMs = Math.round(60000 / spm);
      metronomeTimerRef.current = setInterval(() => {
        beep(1200, 18, 0.35);
      }, intervalMs);
    }
  };

  const handleDownloadGpx = (filename: string, gpxData: string) => {
    const blob = new Blob([gpxData], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "IPAC_Highveld_15km.gpx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded " + (filename || "route GPX"));
  };

  const startVoiceListening = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast("Web Speech Recognition is not supported in this browser");
      return;
    }
    try {
      const recognition = new SpeechRec();
      recognition.lang = "en-ZA";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListening(true);
        beep(880, 50);
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputVal(transcript);
        setListening(false);
        handleSend(transcript);
      };
      recognition.onerror = () => {
        setListening(false);
      };
      recognition.onend = () => {
        setListening(false);
      };
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAttachedImage(dataUrl);
      showToast("Shoe outsole image staged for scan");
    };
    reader.readAsDataURL(file);
  };

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
    const imgToSend = attachedImage;
    let q = (textToSend !== undefined ? textToSend : inputVal).trim();
    if (!q && imgToSend) {
      q = "Please scan this shoe outsole photo for tread wear, pronation patterns, and injury risk.";
    }
    if (!q || loading) return;

    const userMsg: CoachMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      imageUrl: imgToSend || undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setAttachedImage(null);
    setLoading(true);
    vibrate(20);

    try {
      const response = await processCoachQuery(q, {
        members,
        history,
        schedule,
        roleMode,
        apiKey,
        athlete: currentAthlete || null,
        chatHistory: messages,
      });

      setMessages((prev) => [...prev, response]);
      beep(880, 70);

      // Speak key confirmation if voice enabled and brief
      if (voiceEnabled && response.text.length < 120) {
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
    let trimmed = apiKeyInput.trim();
    // Strip accidental wrapping quotes from copy-pasting
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    saveGeminiApiKey(trimmed);
    setApiKey(trimmed);
    setApiKeyInput(trimmed);
    setShowKeyDrawer(false);
    showToast(trimmed ? "Gemini API Key saved! Live Cloud AI active." : "API Key cleared; using offline engine");
  };

  return (
    <div className="ipac-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ipac-sheet ipac-coach-hub-sheet" role="dialog" aria-modal="true" aria-label="AI Head Coach and Founder Hub">
        {/* Header */}
        <div className="ipac-coach-header">
          <div className="ipac-coach-title-wrap">
            <div className="ipac-coach-badge">
              <span className="ipac-coach-status-dot" style={{ background: apiKey ? "#10b981" : "#38bdf8" }} />
              <span>{apiKey ? "Live Cloud AI (Gemini Flash Active)" : "Local Coach Engine"}</span>
            </div>
            <h2>Head Coach &amp; Founder</h2>
            <p className="ipac-hint" style={{ margin: 0 }}>
              Ivory Park Athletics Club • Autonomous Squad Management
            </p>
            {currentAthlete ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  Private Chat: {currentAthlete.name} (Bib {currentAthlete.bib})
                </span>
                {onOpenProfileModal && (
                  <button
                    type="button"
                    className="ipac-btn ipac-btn-quiet"
                    style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                    onClick={onOpenProfileModal}
                  >
                    Switch Athlete
                  </button>
                )}
                <button
                  type="button"
                  className="ipac-btn ipac-btn-quiet"
                  style={{ fontSize: "0.7rem", padding: "2px 6px", color: "#94a3b8" }}
                  onClick={handleClearHistory}
                  title="Clear private chat history"
                >
                  Clear History
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  background: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                  borderRadius: "6px",
                  fontSize: "0.74rem",
                  marginTop: "4px",
                  gap: "6px",
                }}
              >
                <span>Guest mode. Sign in to save private chats with The Gruvs & Resident DB.</span>
                {onOpenProfileModal && (
                  <button
                    type="button"
                    className="ipac-btn ipac-btn-primary"
                    style={{ fontSize: "0.7rem", padding: "2px 8px", whiteSpace: "nowrap" }}
                    onClick={onOpenProfileModal}
                  >
                    Sign In
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              className="ipac-btn ipac-btn-quiet"
              style={{ fontSize: "0.8rem", padding: "6px 10px" }}
              title="Cloud AI Settings"
              onClick={() => setShowKeyDrawer((v) => !v)}
            >
              {showKeyDrawer ? "Hide Key" : "API Key"}
            </button>
            <button
              type="button"
              className="ipac-btn-icon-close"
              autoFocus
              aria-label="Close"
              title="Close"
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* API Key Drawer */}
        {showKeyDrawer && (
          <div className="ipac-coach-key-drawer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label htmlFor="coach-key-input" style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                Cloud AI Engine Key (Free Tier)
              </label>
              <small style={{ color: "#94a3b8" }}>Free Cloud Intelligence</small>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                id="coach-key-input"
                type="password"
                className="ipac-input"
                placeholder="Paste AIzaSy... here"
                value={apiKeyInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setApiKeyInput(val);
                  const clean = val.trim().replace(/^["']|["']$/g, "");
                  if (clean.startsWith("AIza") && clean.length >= 35) {
                    saveGeminiApiKey(clean);
                    setApiKey(clean);
                    showToast("Gemini API Key detected & saved! Live Cloud AI active.");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveKey();
                  }
                }}
                onBlur={() => {
                  const clean = apiKeyInput.trim().replace(/^["']|["']$/g, "");
                  if (clean.length > 20 && clean !== apiKey) {
                    handleSaveKey();
                  }
                }}
                style={{ flex: 1, fontFamily: "monospace", fontSize: "0.85rem" }}
              />
              <button type="button" className="ipac-btn ipac-btn-primary" onClick={handleSaveKey}>
                Save Key
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
            {apiKey ? (
              <div style={{ marginTop: "6px", fontSize: "0.78rem", color: "#10b981", fontWeight: 600 }}>
                Active Key: {apiKey.slice(0, 6)}...{apiKey.slice(-4)} (Gemini Cloud Connected)
              </div>
            ) : (
              <p className="ipac-hint" style={{ fontSize: "0.75rem", margin: "6px 0 0" }}>
                Paste your key and tap <strong>Save Key</strong>. Once saved, the badge turns green with Live Cloud AI enabled.
              </p>
            )}
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
                <b>{m.role === "coach" ? "Head Coach & Founder" : "You"}</b>
                <span className="ipac-coach-msg-time">{m.timestamp}</span>
              </div>
              <div className="ipac-coach-msg-body">{m.text}</div>

              {m.imageUrl && (
                <div className="ipac-coach-msg-image-wrap">
                  <img src={m.imageUrl} alt="Shoe scan attachment" className="ipac-coach-msg-image" />
                </div>
              )}

              {m.report && <StructuredReportView report={m.report} />}

              {m.action && (
                <ActionCard
                  action={m.action}
                  testingAlarm={testingAlarm}
                  onToggleAlarm={handleToggleAlarm}
                  onTriggerAlarmPreview={onTriggerAlarmPreview}
                  onNavigateTab={onNavigateTab}
                  onClose={onClose}
                  showToast={showToast}
                  currentMetronomeSpm={metronomeSpm}
                  onToggleMetronome={toggleMetronome}
                  selectedSpm={selectedSpm}
                  onSelectSpm={setSelectedSpm}
                  handleDownloadGpx={handleDownloadGpx}
                />
              )}
            </div>
          ))}
          {loading && (
            <div className="ipac-coach-msg ipac-coach-msg-coach">
              <div className="ipac-coach-msg-header">
                <b>Head Coach & Founder</b>
              </div>
              <div className="ipac-coach-msg-body ipac-coach-thinking">
                Consulting training log and executing command...
              </div>
            </div>
          )}
        </div>

        {/* Image Attachment Preview */}
        {attachedImage && (
          <div className="ipac-coach-attached-preview">
            <img src={attachedImage} alt="Staged scan" className="ipac-coach-preview-thumb" />
            <span style={{ fontSize: "0.78rem" }}>Shoe outsole photo attached for scan</span>
            <button
              type="button"
              className="ipac-btn-remove-thumb"
              onClick={() => setAttachedImage(null)}
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form
          className="ipac-coach-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          {/* Photo attach button */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*"
            onChange={handleImageUpload}
          />
          <button
            type="button"
            className="ipac-btn ipac-btn-quiet ipac-coach-tool-btn"
            title="Upload and scan shoe photo"
            aria-label="Upload shoe photo"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          {/* Voice Mic Dictation Button */}
          <button
            type="button"
            className={`ipac-btn ipac-btn-quiet ipac-coach-tool-btn ${listening ? "ipac-coach-mic-active" : ""}`}
            title={listening ? "Listening to voice..." : "Speak command (Voice dictation)"}
            aria-label={listening ? "Listening to voice" : "Speak command"}
            onClick={startVoiceListening}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          {/* Voice Speaker Toggle */}
          <button
            type="button"
            className={`ipac-btn ipac-btn-quiet ipac-coach-tool-btn ${voiceEnabled ? "ipac-coach-speaker-on" : ""}`}
            title={voiceEnabled ? "Voice audio responses enabled" : "Voice audio responses muted"}
            aria-label="Toggle voice responses"
            onClick={() => setVoiceEnabled((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {voiceEnabled ? (
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              ) : (
                <line x1="23" y1="9" x2="17" y2="15" />
              )}
            </svg>
          </button>

          <input
            type="text"
            className="ipac-input ipac-coach-text-input"
            placeholder={listening ? "Listening to voice... speak now" : "Command coach (e.g. 'Cadence metronome', 'Predict race times')..."}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="ipac-btn ipac-btn-primary"
            style={{ fontWeight: 700, padding: "0 18px", minHeight: "44px" }}
            disabled={(!inputVal.trim() && !attachedImage) || loading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
