import { useEffect, useRef, useState } from "react";
import { say } from "../lib/sound";
import {
  MOST_USED_TOUR_STEPS,
  OVERVIEW_TOUR_STEPS,
  setTourCompleted,
  type TourMode,
  type TourStep,
} from "../lib/tour";

interface TourGuideProps {
  onClose: () => void;
  onNavigateTab?: (tab: "today" | "session" | "runners" | "map" | "dispatch" | "club") => void;
}

export default function TourGuide({ onClose, onNavigateTab }: TourGuideProps) {
  const [tourMode, setTourMode] = useState<TourMode>("most_used");
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);

  const steps: TourStep[] = tourMode === "most_used" ? MOST_USED_TOUR_STEPS : OVERVIEW_TOUR_STEPS;
  const curStep: TourStep = steps[stepIndex] || steps[0];
  const totalSteps = steps.length;
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Navigate to corresponding tab if step suggests it
  useEffect(() => {
    if (curStep.suggestedTab && onNavigateTab) {
      onNavigateTab(curStep.suggestedTab);
    }
  }, [curStep, onNavigateTab]);

  // Calculate spotlight position
  useEffect(() => {
    const updateRect = () => {
      if (!curStep.selector) {
        setSpotlightRect(null);
        return;
      }
      const el = document.querySelector(curStep.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setSpotlightRect(r);
          return;
        }
      }
      setSpotlightRect(null);
    };

    updateRect();
    const timer = setTimeout(updateRect, 120);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [stepIndex, curStep.selector, tourMode]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        finishTour();
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepIndex, totalSteps]);

  const speakStep = () => {
    setVoiceSpeaking(true);
    say(`${curStep.title}. ${curStep.description}. Action: ${curStep.actionHint}`);
    setTimeout(() => setVoiceSpeaking(false), 3000);
  };

  const goNext = () => {
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    } else {
      finishTour();
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  };

  const finishTour = () => {
    setTourCompleted(true);
    onClose();
  };

  // Determine card placement relative to target
  let cardTop = "auto";
  let cardBottom = "24px";
  let cardLeft = "50%";
  let cardTransform = "translateX(-50%)";

  if (spotlightRect) {
    const spaceBelow = window.innerHeight - spotlightRect.bottom;
    const spaceAbove = spotlightRect.top;

    if (spaceBelow > 280) {
      cardTop = `${Math.min(window.innerHeight - 300, spotlightRect.bottom + 14)}px`;
      cardBottom = "auto";
    } else if (spaceAbove > 280) {
      cardBottom = `${window.innerHeight - spotlightRect.top + 14}px`;
      cardTop = "auto";
    }
  }

  return (
    <div className="ipac-tour-overlay" role="dialog" aria-modal="true" aria-label="Interactive App Tour">
      {/* Target Spotlight Cutout Ring */}
      {spotlightRect && (
        <div
          className="ipac-tour-spotlight"
          style={{
            top: `${Math.max(4, spotlightRect.top - 6)}px`,
            left: `${Math.max(4, spotlightRect.left - 6)}px`,
            width: `${Math.min(window.innerWidth - 8, spotlightRect.width + 12)}px`,
            height: `${spotlightRect.height + 12}px`,
          }}
        />
      )}

      {/* Floating Coach Mark Card */}
      <div
        ref={cardRef}
        className="ipac-tour-card"
        style={{
          top: cardTop,
          bottom: cardBottom,
          left: cardLeft,
          transform: cardTransform,
        }}
      >
        {/* Mode Selector Toggle */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
          <button
            type="button"
            className={`ipac-btn ${tourMode === "most_used" ? "ipac-btn-primary" : "ipac-btn-quiet"}`}
            style={{ fontSize: "0.74rem", padding: "2px 8px", minHeight: "26px", flex: 1 }}
            onClick={() => {
              setTourMode("most_used");
              setStepIndex(0);
            }}
          >
            Most-Used Buttons ({MOST_USED_TOUR_STEPS.length})
          </button>
          <button
            type="button"
            className={`ipac-btn ${tourMode === "overview" ? "ipac-btn-primary" : "ipac-btn-quiet"}`}
            style={{ fontSize: "0.74rem", padding: "2px 8px", minHeight: "26px", flex: 1 }}
            onClick={() => {
              setTourMode("overview");
              setStepIndex(0);
            }}
          >
            Full App Tour ({OVERVIEW_TOUR_STEPS.length})
          </button>
        </div>

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span className="ipac-tour-badge">{curStep.badge}</span>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-muted)" }}>
            Button {stepIndex + 1} of {totalSteps}
          </span>
        </div>

        {/* Step Progress Dots */}
        <div className="ipac-tour-dots" aria-hidden="true">
          {steps.map((s, idx) => (
            <span
              key={s.id}
              className={`ipac-tour-dot ${idx === stepIndex ? "active" : idx < stepIndex ? "done" : ""}`}
            />
          ))}
        </div>

        <h3 style={{ margin: "10px 0 6px", fontSize: "1.15rem", color: "var(--color-fg)" }}>
          {curStep.title}
        </h3>

        <p style={{ margin: "0 0 8px", fontSize: "0.88rem", lineHeight: 1.45, color: "var(--color-fg)" }}>
          {curStep.description}
        </p>

        <div className="ipac-tour-hint">
          <b>How to use:</b> {curStep.actionHint}
        </div>

        {/* Action Controls */}
        <div className="ipac-tour-actions">
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              className="ipac-btn ipac-btn-quiet"
              style={{ fontSize: "0.78rem", padding: "4px 8px", minHeight: "32px" }}
              onClick={speakStep}
              title="Listen to spoken audio guidance"
            >
              {voiceSpeaking ? "Speaking…" : "Listen"}
            </button>
            <button
              type="button"
              className="ipac-btn ipac-btn-quiet"
              style={{ fontSize: "0.78rem", padding: "4px 8px", minHeight: "32px" }}
              onClick={finishTour}
            >
              Skip
            </button>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            {stepIndex > 0 && (
              <button
                type="button"
                className="ipac-btn ipac-btn-outline"
                style={{ fontSize: "0.82rem", padding: "4px 12px", minHeight: "32px" }}
                onClick={goPrev}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="ipac-btn ipac-btn-primary"
              style={{ fontSize: "0.82rem", padding: "4px 14px", minHeight: "32px", fontWeight: 700 }}
              onClick={goNext}
            >
              {stepIndex === totalSteps - 1 ? "Finish Tour" : "Next Button"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
