import { useState } from "react";
import {
  createAthleteProfile,
  getCurrentAthlete,
  listClubProfiles,
  quickSignIn,
  logoutAthlete,
  type AthleteProfile,
  SECTIONS_IVORY_PARK,
} from "../lib/auth";
import { loadSupabaseConfig } from "../lib/supabase";

interface AthleteProfileModalProps {
  onClose: () => void;
  currentAthlete: AthleteProfile | null;
  onAthleteChange: (athlete: AthleteProfile | null) => void;
  showToast: (msg: string) => void;
}

export default function AthleteProfileModal({
  onClose,
  currentAthlete,
  onAthleteChange,
  showToast,
}: AthleteProfileModalProps) {
  const [tab, setTab] = useState<"signin" | "register" | "profile">(currentAthlete ? "profile" : "signin");
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    currentAthlete ? currentAthlete.id : "profile-asemahle-nkwali"
  );
  const [pinInput, setPinInput] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Registration Form State
  const [name, setName] = useState("");
  const [bib, setBib] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [section, setSection] = useState<string>(SECTIONS_IVORY_PARK[0]);
  const [ageGroup, setAgeGroup] = useState<AthleteProfile["ageGroup"]>("Senior (20-39)");
  const [gender, setGender] = useState<"M" | "F" | "X">("M");
  const [best5k, setBest5k] = useState("");
  const [best10k, setBest10k] = useState("");
  const [targetPace, setTargetPace] = useState("");
  const [shoeModel, setShoeModel] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const profiles = listClubProfiles();
  const sbConfig = loadSupabaseConfig();

  const handleQuickSignIn = (profileId: string) => {
    setErr("");
    const res = quickSignIn(profileId, pinInput);
    if (!res.ok) {
      setErr(res.message || "Failed to sign in");
      return;
    }
    onAthleteChange(res.profile || null);
    showToast(`Signed in as ${res.profile?.name} (Bib ${res.profile?.bib})`);
    onClose();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      if (!name.trim()) {
        throw new Error("Full name is required");
      }

      const newProfile = await createAthleteProfile({
        name,
        bib,
        phone,
        pin: pin || "1234",
        section,
        ageGroup,
        gender,
        best5k,
        best10k,
        targetPace,
        shoeModel,
        emergencyName,
        emergencyPhone,
      });

      onAthleteChange(newProfile);
      showToast(`Welcome to Ivory Park AC, ${newProfile.name}! Private profile created.`);
      onClose();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    logoutAthlete();
    onAthleteChange(null);
    showToast("Signed out. Operating as guest.");
    setTab("signin");
  };

  return (
    <div className="ipac-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="ipac-sheet ipac-profile-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Athlete Profile and Authentication"
        style={{ maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>Athlete Profile & Sign In</h2>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: sbConfig.connected ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                  color: sbConfig.connected ? "#10b981" : "#3b82f6",
                  border: `1px solid ${sbConfig.connected ? "rgba(16, 185, 129, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
                }}
              >
                {sbConfig.connected ? "The Gruvs & Resident DB Synced" : "Local Club Database"}
              </span>
            </div>
            <p className="ipac-hint" style={{ margin: "4px 0 0" }}>
              Sign in so your training results, PBs, and AI Coach chats remain private to you.
            </p>
          </div>
          <button
            type="button"
            className="ipac-close-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="ipac-seg" style={{ margin: "4px 0 12px" }}>
          <button
            type="button"
            aria-pressed={tab === "signin"}
            onClick={() => {
              setTab("signin");
              setErr("");
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            aria-pressed={tab === "register"}
            onClick={() => {
              setTab("register");
              setErr("");
            }}
          >
            Create Profile
          </button>
          {currentAthlete && (
            <button
              type="button"
              aria-pressed={tab === "profile"}
              onClick={() => {
                setTab("profile");
                setErr("");
              }}
            >
              My Profile
            </button>
          )}
        </div>

        {err && (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#ef4444",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {err}
          </div>
        )}

        {/* 1. SIGN IN TAB */}
        {tab === "signin" && (
          <div style={{ display: "grid", gap: "14px" }}>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px" }}>
                Select Your Athlete Account (Ivory Park AC Roster):
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                {profiles.map((p) => {
                  const isSelected = selectedProfileId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProfileId(p.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        border: isSelected ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                        background: isSelected ? "rgba(59, 130, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "0.8rem",
                            background: "rgba(59, 130, 246, 0.2)",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            minWidth: "32px",
                            textAlign: "center",
                          }}
                        >
                          Bib {p.bib}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.92rem", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span>{p.name}</span>
                            {p.titleNote && (
                              <span style={{ fontSize: "0.7rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                {p.titleNote}
                              </span>
                            )}
                            {p.contributionPaid && (
                              <span style={{ fontSize: "0.7rem", color: "#10b981", background: "rgba(16, 185, 129, 0.15)", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                Subs: {p.contributionPaid}
                              </span>
                            )}
                          </div>
                          <div className="ipac-hint" style={{ fontSize: "0.75rem" }}>
                            {p.section} • {p.best4k ? `4km: ${p.best4k}` : p.best6k ? `6km: ${p.best6k}` : `5km PB: ${p.best5k || "-"}`}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ipac-btn ipac-btn-primary"
                        style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickSignIn(p.id);
                        }}
                      >
                        Sign In
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="password"
                placeholder="Optional 4-digit PIN (default bib repeated e.g. 1212)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                maxLength={6}
                style={{ flex: 1, fontSize: "0.85rem" }}
              />
              <button
                type="button"
                className="ipac-btn ipac-btn-primary"
                onClick={() => handleQuickSignIn(selectedProfileId)}
              >
                Sign In Selected
              </button>
            </div>
          </div>
        )}

        {/* 2. CREATE PROFILE TAB */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="ipac-form" style={{ display: "grid", gap: "12px" }}>
            <div className="ipac-grid2" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px" }}>
              <label>
                Full Name *
                <input
                  type="text"
                  required
                  placeholder="e.g. Sindi Ndlovu"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Club Bib #
                <input
                  type="text"
                  placeholder="e.g. 42"
                  value={bib}
                  onChange={(e) => setBib(e.target.value)}
                />
              </label>
            </div>

            <div className="ipac-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label>
                Mobile Phone
                <input
                  type="tel"
                  placeholder="082-123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label>
                4-Digit Private PIN
                <input
                  type="password"
                  placeholder="1234"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </label>
            </div>

            <div className="ipac-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label>
                Highveld Residential Section
                <select value={section} onChange={(e) => setSection(e.target.value)}>
                  {SECTIONS_IVORY_PARK.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Age Category
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value as AthleteProfile["ageGroup"])}
                >
                  <option value="Junior (under 20)">Junior (under 20)</option>
                  <option value="Senior (20-39)">Senior (20-39)</option>
                  <option value="Veteran (40-49)">Veteran (40-49)</option>
                  <option value="Master (50+)">Master (50+)</option>
                </select>
              </label>
            </div>

            <div className="ipac-grid3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <label>
                5km PB
                <input
                  type="text"
                  placeholder="e.g. 21:30"
                  value={best5k}
                  onChange={(e) => setBest5k(e.target.value)}
                />
              </label>
              <label>
                10km PB
                <input
                  type="text"
                  placeholder="e.g. 44:15"
                  value={best10k}
                  onChange={(e) => setBest10k(e.target.value)}
                />
              </label>
              <label>
                Target Pace
                <input
                  type="text"
                  placeholder="e.g. 4:15/km"
                  value={targetPace}
                  onChange={(e) => setTargetPace(e.target.value)}
                />
              </label>
            </div>

            <label>
              Primary Running Shoe Model
              <input
                type="text"
                placeholder="e.g. Nike Pegasus 40 or Asics Novablast"
                value={shoeModel}
                onChange={(e) => setShoeModel(e.target.value)}
              />
            </label>

            <div className="ipac-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label>
                Emergency Contact Name
                <input
                  type="text"
                  placeholder="Next of Kin"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                />
              </label>
              <label>
                Emergency Phone
                <input
                  type="tel"
                  placeholder="082-999-0000"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </label>
            </div>

            <div
              style={{
                fontSize: "0.78rem",
                color: "#94a3b8",
                background: "rgba(255, 255, 255, 0.04)",
                padding: "8px 10px",
                borderRadius: "8px",
              }}
            >
              Your profile is registered in the unified Ivory Park AC database (shared with The Resident and The Gruvs) under table <code>ipac_profiles</code>. All AI Coach conversations are saved privately to your account.
            </div>

            <button type="submit" className="ipac-btn ipac-btn-primary" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Creating Profile..." : "Create Athlete Profile"}
            </button>
          </form>
        )}

        {/* 3. MY PROFILE TAB */}
        {tab === "profile" && currentAthlete && (
          <div style={{ display: "grid", gap: "14px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                borderRadius: "12px",
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
              }}
            >
              <div
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 900,
                  background: "#3b82f6",
                  color: "#fff",
                  borderRadius: "12px",
                  padding: "8px 14px",
                }}
              >
                {currentAthlete.bib}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{currentAthlete.name}</h3>
                <div className="ipac-hint" style={{ fontSize: "0.8rem" }}>
                  {currentAthlete.section} • {currentAthlete.ageGroup}
                </div>
              </div>
              <button
                type="button"
                className="ipac-btn ipac-btn-outline"
                onClick={handleSignOut}
                style={{ fontSize: "0.8rem" }}
              >
                Sign Out
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.04)" }}>
                <div className="ipac-hint" style={{ fontSize: "0.75rem" }}>5km PB</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{currentAthlete.best5k || "-"}</div>
              </div>
              <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.04)" }}>
                <div className="ipac-hint" style={{ fontSize: "0.75rem" }}>10km PB</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{currentAthlete.best10k || "-"}</div>
              </div>
              <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.04)" }}>
                <div className="ipac-hint" style={{ fontSize: "0.75rem" }}>Target Pace</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{currentAthlete.targetPace || "-"}</div>
              </div>
              <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.04)" }}>
                <div className="ipac-hint" style={{ fontSize: "0.75rem" }}>Running Shoes</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                  {currentAthlete.shoeModel || "Road Trainers"}
                </div>
                <div className="ipac-hint" style={{ fontSize: "0.72rem" }}>
                  {currentAthlete.shoeKm || 0} km logged
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: "0.8rem",
                color: "#10b981",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                padding: "8px 12px",
                borderRadius: "8px",
              }}
            >
              Private Chat Channel Active: Head Coach conversations are saved exclusively to your account and synced with The Resident & The Gruvs database.
            </div>

            <button
              type="button"
              className="ipac-btn ipac-btn-primary"
              onClick={onClose}
              style={{ width: "100%", marginTop: "4px" }}
            >
              Back to App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
