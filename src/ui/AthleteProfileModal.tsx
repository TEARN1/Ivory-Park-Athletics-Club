import { useEffect, useRef, useState } from "react";
import {
  createAthleteProfile,
  listClubProfiles,
  quickSignIn,
  logoutAthlete,
  type AthleteProfile,
  SECTIONS_IVORY_PARK,
} from "../lib/auth";
import { loadSupabaseConfig } from "../lib/supabase";
import {
  authenticateWithBiometrics,
  captureFaceSnapshot,
  enrollAthleteBiometrics,
  getAthleteFaceBiometric,
  getBiometricEnrollment,
  isCameraAvailable,
  isPlatformBiometricsSupported,
  matchFaceToAthlete,
  removeBiometricCredential,
  saveAthleteFaceBiometric,
  startFaceCamera,
  stopFaceCamera,
} from "../lib/biometrics";
import { say } from "../lib/sound";

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
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean>(true);
  const [cameraAvailable, setCameraAvailable] = useState<boolean>(false);

  // Camera Face Biometric State
  const [cameraScanning, setCameraScanning] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [faceMatchResult, setFaceMatchResult] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Registration Form State
  const [name, setName] = useState("");
  const [bib, setBib] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [enableBiometricsOnReg, setEnableBiometricsOnReg] = useState<boolean>(true);
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

  useEffect(() => {
    isPlatformBiometricsSupported().then((supported) => {
      setBiometricsAvailable(supported);
    });
    setCameraAvailable(isCameraAvailable());
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        stopFaceCamera(cameraStream);
      }
    };
  }, [cameraStream]);

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

  const handleBiometricSignIn = async () => {
    setErr("");
    setBiometricLoading(true);
    try {
      const res = await authenticateWithBiometrics(selectedProfileId);
      if (!res.ok || !res.athlete) {
        setErr(res.message || "Biometric verification failed");
        return;
      }
      onAthleteChange(res.athlete);
      say(`Welcome ${res.athlete.name.split(" ")[0]}`);
      showToast(res.message || `Biometrics verified: ${res.athlete.name} (Bib ${res.athlete.bib})`);
      onClose();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleStartCamera = async () => {
    setErr("");
    setFaceMatchResult(null);
    setCapturedPhoto(null);
    setCameraScanning(true);
    // Short delay to allow video element to mount
    setTimeout(async () => {
      if (videoRef.current) {
        const stream = await startFaceCamera(videoRef.current);
        if (!stream) {
          setErr("Could not access camera. Please verify camera permissions.");
          setCameraScanning(false);
          return;
        }
        setCameraStream(stream);
      }
    }, 100);
  };

  const handleStopCamera = () => {
    if (cameraStream) {
      stopFaceCamera(cameraStream);
      setCameraStream(null);
    }
    setCameraScanning(false);
  };

  const handleCaptureFaceScan = () => {
    if (!videoRef.current) return;
    const photo = captureFaceSnapshot(videoRef.current);
    if (!photo) {
      setErr("Failed to capture image frame from camera");
      return;
    }
    setCapturedPhoto(photo);
    const result = matchFaceToAthlete(photo, profiles);
    if (result.matched) {
      setFaceMatchResult(result.message);
      say(`Identified ${result.matched.name}`);
      setTimeout(() => {
        onAthleteChange(result.matched);
        showToast(`Face Biometrics verified: ${result.matched?.name} (Bib ${result.matched?.bib})`);
        handleStopCamera();
        onClose();
      }, 1400);
    } else {
      setFaceMatchResult(result.message);
    }
  };

  const handleEnrollDeviceBiometrics = async () => {
    if (!currentAthlete) return;
    setBiometricLoading(true);
    setErr("");
    try {
      const res = await enrollAthleteBiometrics(currentAthlete);
      if (!res.ok) {
        setErr(res.message || "Failed to enroll device biometrics");
        return;
      }
      showToast(res.message || "Device biometrics enrolled successfully");
      const updated = listClubProfiles().find((p) => p.id === currentAthlete.id);
      if (updated) onAthleteChange(updated);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleRemoveDeviceBiometrics = () => {
    if (!currentAthlete) return;
    removeBiometricCredential(currentAthlete.id);
    showToast("Biometrics removed from this device.");
    const updated = listClubProfiles().find((p) => p.id === currentAthlete.id);
    if (updated) onAthleteChange(updated);
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

      if (enableBiometricsOnReg) {
        await enrollAthleteBiometrics(newProfile).catch(() => {});
      }

      onAthleteChange(newProfile);
      showToast(`Welcome to Ivory Park AC, ${newProfile.name}! Profile registered with biometric identification.`);
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

  const isEnrolled = currentAthlete ? !!getBiometricEnrollment(currentAthlete.id) : false;
  const enrolledFace = currentAthlete ? getAthleteFaceBiometric(currentAthlete.id) : null;

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
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800 }}>Athlete Biometrics &amp; Profile</h2>
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
                {sbConfig.connected ? "Unified DB Synced" : "Local Club DB"}
              </span>
            </div>
            <p className="ipac-hint" style={{ margin: "4px 0 0" }}>
              Identify with fingerprint, face passkey, or PIN to secure your private coach chats and race splits.
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
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
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
              handleStopCamera();
            }}
          >
            Identify &amp; Sign In
          </button>
          <button
            type="button"
            aria-pressed={tab === "register"}
            onClick={() => {
              setTab("register");
              setErr("");
              handleStopCamera();
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
                handleStopCamera();
              }}
            >
              My Biometrics &amp; Stats
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
              marginBottom: "10px",
            }}
          >
            {err}
          </div>
        )}

        {/* 1. SIGN IN TAB */}
        {tab === "signin" && (
          <div style={{ display: "grid", gap: "14px" }}>
            {/* Primary Biometric Quick Identification Card */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                borderRadius: "14px",
                padding: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 0 0 4.07 9m5.936 8.528A13.96 13.96 0 0 1 6 11" />
                  </svg>
                  <strong style={{ fontSize: "0.98rem", color: "#f8fafc" }}>1-Touch Biometric Athlete Identification</strong>
                </div>
                <span style={{ fontSize: "0.72rem", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>
                  WebAuthn Active
                </span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "#94a3b8" }}>
                Use your device's fingerprint sensor, Touch ID, Face ID, or phone camera to verify athlete identity instantly.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  className="ipac-btn ipac-btn-hero"
                  disabled={biometricLoading}
                  onClick={handleBiometricSignIn}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3" />
                  </svg>
                  <span>{biometricLoading ? "Scanning Biometrics..." : "Touch Fingerprint / Face"}</span>
                </button>

                <button
                  type="button"
                  className="ipac-btn ipac-btn-outline"
                  onClick={cameraScanning ? handleStopCamera : handleStartCamera}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>{cameraScanning ? "Close Camera" : "Scan Face with Camera"}</span>
                </button>
              </div>

              {/* Live Camera Scanner Box */}
              {cameraScanning && (
                <div style={{ marginTop: "14px", padding: "12px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "12px", border: "1px solid rgba(56, 189, 248, 0.4)" }}>
                  <div style={{ position: "relative", width: "100%", maxWidth: "340px", margin: "0 auto", borderRadius: "10px", overflow: "hidden", aspectRatio: "4/3", background: "#000" }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div
                      style={{
                        position: "absolute",
                        top: "15%",
                        left: "20%",
                        width: "60%",
                        height: "70%",
                        border: "2px dashed #38bdf8",
                        borderRadius: "50%",
                        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "10px" }}>
                    <button
                      type="button"
                      className="ipac-btn ipac-btn-primary"
                      onClick={handleCaptureFaceScan}
                      style={{ padding: "8px 16px", fontWeight: 700 }}
                    >
                      Capture &amp; Match Face
                    </button>
                    <button
                      type="button"
                      className="ipac-btn ipac-btn-quiet"
                      onClick={handleStopCamera}
                    >
                      Cancel
                    </button>
                  </div>
                  {faceMatchResult && (
                    <div style={{ marginTop: "8px", textAlign: "center", fontSize: "0.85rem", color: "#38bdf8", fontWeight: 700 }}>
                      {faceMatchResult}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Roster Selection for PIN or Manual Switch */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px" }}>
                Or Select Athlete by Bib / Name from Squad Roster:
              </div>
              <div style={{ display: "grid", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                {profiles.map((p) => {
                  const isSelected = selectedProfileId === p.id;
                  const hasBio = !!getBiometricEnrollment(p.id);
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
                            {hasBio && (
                              <span style={{ fontSize: "0.68rem", color: "#10b981", background: "rgba(16, 185, 129, 0.15)", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                Biometrics Ready
                              </span>
                            )}
                            {p.titleNote && (
                              <span style={{ fontSize: "0.7rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                {p.titleNote}
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
                placeholder="Optional 4-digit PIN (e.g. 1212)"
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

            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(56, 189, 248, 0.08)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
              <input
                type="checkbox"
                id="enable-biometrics-reg"
                checked={enableBiometricsOnReg}
                onChange={(e) => setEnableBiometricsOnReg(e.target.checked)}
                style={{ width: "18px", height: "18px" }}
              />
              <label htmlFor="enable-biometrics-reg" style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#f8fafc", cursor: "pointer" }}>
                Enable 1-touch Biometrics on this device upon registration (Fingerprint / Face ID passkey)
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

            {/* Biometric Credentials Status & Actions */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3" />
                  </svg>
                  <strong style={{ fontSize: "0.92rem" }}>Athlete Biometrics &amp; Passkeys</strong>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "8px",
                    background: isEnrolled ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                    color: isEnrolled ? "#10b981" : "#f59e0b",
                    border: `1px solid ${isEnrolled ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                  }}
                >
                  {isEnrolled ? "Biometrics Enrolled" : "Not Enrolled on This Device"}
                </span>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: "#94a3b8" }}>
                {isEnrolled
                  ? "Your device's biometric sensor (fingerprint / Face ID) is linked to your athlete account. You can log in and check in with 1 touch."
                  : "Link your phone or laptop's fingerprint sensor / Face ID to log in instantly without typing your PIN."}
              </p>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {!isEnrolled ? (
                  <button
                    type="button"
                    className="ipac-btn ipac-btn-primary"
                    disabled={biometricLoading}
                    onClick={handleEnrollDeviceBiometrics}
                    style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                  >
                    {biometricLoading ? "Enrolling Biometrics..." : "Enroll Fingerprint / Face ID"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ipac-btn ipac-btn-outline"
                      onClick={handleEnrollDeviceBiometrics}
                      style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                    >
                      Re-Enroll Device
                    </button>
                    <button
                      type="button"
                      className="ipac-btn ipac-btn-quiet"
                      onClick={handleRemoveDeviceBiometrics}
                      style={{ fontSize: "0.8rem", padding: "6px 12px", color: "#ef4444" }}
                    >
                      Remove Biometrics
                    </button>
                  </>
                )}
              </div>
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
