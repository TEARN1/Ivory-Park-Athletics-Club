import { useEffect, useRef, useState } from "react";
import type { AthleteProfile } from "../lib/auth";
import { Icons } from "../ui";

export interface HeaderMenuProps {
  roleMode: "athlete" | "coach";
  onRoleModeChange: (mode: "athlete" | "coach") => void;
  currentAthlete: AthleteProfile | null;
  onOpenProfile: () => void;
  onOpenAICoach: () => void;
  enableAICoach?: boolean;
  onOpenTour: () => void;
  onOpenInstall: () => void;
  isNight: boolean;
  onToggleTheme: () => void;
  showToast: (msg: string) => void;
}

export default function HeaderMenu({
  roleMode,
  onRoleModeChange,
  currentAthlete,
  onOpenProfile,
  onOpenAICoach,
  enableAICoach = true,
  onOpenTour,
  onOpenInstall,
  isNight,
  onToggleTheme,
  showToast,
}: HeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="ipac-header-menu-container" ref={menuRef} style={{ position: "relative" }}>
      {/* Hamburger Toggle Button */}
      <button
        type="button"
        className={`ipac-themebtn ipac-hamburger-btn ${isOpen ? "active" : ""}`}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        title="Menu & Club Tools"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "38px",
          height: "38px",
          minHeight: "38px",
          borderRadius: "10px",
          border: isOpen ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.25)",
          background: isOpen ? "rgba(56, 189, 248, 0.18)" : "rgba(255, 255, 255, 0.1)",
          color: "#ffffff",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          className="ipac-header-dropdown"
          role="menu"
          aria-label="Club Tools and Navigation"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "300px",
            maxWidth: "calc(100vw - 24px)",
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: "16px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            padding: "12px",
            zIndex: 1000,
            color: "#f8fafc",
            animation: "ipacFadeInDown 0.18s ease-out",
          }}
        >
          {/* Athlete Profile Section */}
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "12px",
              marginBottom: "10px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {currentAthlete ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        background: "#10b981",
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: "0.75rem",
                        padding: "2px 6px",
                        borderRadius: "6px",
                      }}
                    >
                      Bib {currentAthlete.bib}
                    </span>
                    <strong style={{ fontSize: "0.95rem", color: "#f8fafc" }}>{currentAthlete.name}</strong>
                  </div>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "8px" }}>
                  {currentAthlete.titleNote || currentAthlete.section}
                </div>
                <button
                  type="button"
                  className="ipac-btn ipac-btn-outline ipac-btn-wide"
                  style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                  onClick={() => {
                    setIsOpen(false);
                    onOpenProfile();
                  }}
                >
                  Manage Profile &amp; Switch
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "4px" }}>Guest Athlete</div>
                <p style={{ margin: "0 0 8px", fontSize: "0.74rem", color: "#94a3b8" }}>
                  Sign in with your 4-digit PIN to save private coach chats &amp; stats.
                </p>
                <button
                  type="button"
                  className="ipac-btn ipac-btn-primary ipac-btn-wide"
                  style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                  onClick={() => {
                    setIsOpen(false);
                    onOpenProfile();
                  }}
                >
                  Sign In / Register
                </button>
              </div>
            )}
          </div>

          {/* Mode Switcher */}
          <div style={{ marginBottom: "10px", padding: "0 4px" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              Dashboard Mode
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <button
                type="button"
                className={`ipac-btn ${roleMode === "athlete" ? "ipac-btn-primary" : "ipac-btn-outline"}`}
                style={{ fontSize: "0.78rem", padding: "6px 8px", fontWeight: 700 }}
                onClick={() => {
                  onRoleModeChange("athlete");
                  showToast("Athlete Mode: In-run timing and HUD active");
                }}
              >
                Athlete Mode
              </button>
              <button
                type="button"
                className={`ipac-btn ${roleMode === "coach" ? "ipac-btn-primary" : "ipac-btn-outline"}`}
                style={{ fontSize: "0.78rem", padding: "6px 8px", fontWeight: 700 }}
                onClick={() => {
                  onRoleModeChange("coach");
                  showToast("Coach Mode: Fleet dispatch and master clock active");
                }}
              >
                Coach Mode
              </button>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.1)", margin: "8px 0" }} />

          {/* Menu Tools */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {/* AI Coach */}
            {enableAICoach && (
              <button
                type="button"
                className="ipac-dropdown-item"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAICoach();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "none",
                  color: "#38bdf8",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <div>
                  <div>AI Head Coach &amp; Live Voice</div>
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 400 }}>Voice call, split analysis &amp; advice</div>
                </div>
              </button>
            )}

            {/* App Tour */}
            <button
              type="button"
              className="ipac-dropdown-item"
              onClick={() => {
                setIsOpen(false);
                onOpenTour();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "transparent",
                border: "none",
                color: "#f8fafc",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              <span style={{ display: "flex", alignItems: "center" }}>{Icons.help}</span>
              <div>
                <div>Interactive App Tour</div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 400 }}>Guided walkthrough of all features</div>
              </div>
            </button>

            {/* Install / QR */}
            <button
              type="button"
              className="ipac-dropdown-item"
              onClick={() => {
                setIsOpen(false);
                onOpenInstall();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "transparent",
                border: "none",
                color: "#f8fafc",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              <span style={{ display: "flex", alignItems: "center" }}>{Icons.download}</span>
              <div>
                <div>Get App &amp; Start-Line QR</div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 400 }}>Install PWA or scan join code</div>
              </div>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              className="ipac-dropdown-item"
              onClick={() => {
                onToggleTheme();
                showToast(isNight ? "Switched to Day Theme" : "Switched to Night Theme");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "transparent",
                border: "none",
                color: "#f8fafc",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              <span style={{ display: "flex", alignItems: "center" }}>{isNight ? Icons.sun : Icons.moon}</span>
              <div>
                <div>{isNight ? "Switch to Day Theme" : "Switch to Night Theme"}</div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 400 }}>
                  Current: {isNight ? "Night / Dark" : "Day / Light"}
                </div>
              </div>
            </button>
          </div>

          <div
            style={{
              marginTop: "8px",
              paddingTop: "8px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              fontSize: "0.7rem",
              color: "#64748b",
              textAlign: "center",
            }}
          >
            Ivory Park Athletics Club • Unified DB
          </div>
        </div>
      )}
    </div>
  );
}
