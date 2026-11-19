import { describe, expect, it, beforeEach } from "vitest";
import {
  isPlatformBiometricsSupported,
  isCameraAvailable,
  listBiometricCredentials,
  saveBiometricCredential,
  getBiometricEnrollment,
  removeBiometricCredential,
  enrollAthleteBiometrics,
  authenticateWithBiometrics,
  listFaceBiometrics,
  saveAthleteFaceBiometric,
  getAthleteFaceBiometric,
  matchFaceToAthlete,
  type BiometricCredentialRecord,
} from "./biometrics";
import { DEFAULT_CLUB_PROFILES } from "./auth";

const mockStorage = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
    removeItem: (k: string) => mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  };
}

describe("Biometric Athlete Identification", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("checks platform biometrics and camera availability without crashing", async () => {
    const bioSupported = await isPlatformBiometricsSupported();
    expect(typeof bioSupported).toBe("boolean");

    const camSupported = isCameraAvailable();
    expect(typeof camSupported).toBe("boolean");
  });

  it("saves, lists, and removes biometric credentials in storage", () => {
    const cred: BiometricCredentialRecord = {
      athleteId: "profile-asemahle-nkwali",
      athleteName: "Asemahle Nkwali",
      bib: "4",
      credentialId: "cred-test-12345",
      registeredAt: Date.now(),
      deviceType: "platform_biometric",
    };

    saveBiometricCredential(cred);

    const list = listBiometricCredentials();
    expect(list.length).toBe(1);
    expect(list[0].athleteName).toBe("Asemahle Nkwali");
    expect(list[0].bib).toBe("4");

    const found = getBiometricEnrollment("profile-asemahle-nkwali");
    expect(found).not.toBeNull();
    expect(found?.credentialId).toBe("cred-test-12345");

    removeBiometricCredential("profile-asemahle-nkwali");
    expect(listBiometricCredentials().length).toBe(0);
    expect(getBiometricEnrollment("profile-asemahle-nkwali")).toBeNull();
  });

  it("enrolls an athlete and enables biometric login", async () => {
    const athlete = DEFAULT_CLUB_PROFILES[0]; // Asemahle Nkwali
    const res = await enrollAthleteBiometrics(athlete);

    expect(res.ok).toBe(true);
    expect(res.credential).toBeDefined();
    expect(res.credential?.athleteId).toBe(athlete.id);

    const enrollment = getBiometricEnrollment(athlete.id);
    expect(enrollment).not.toBeNull();
  });

  it("authenticates and identifies an athlete using enrolled biometrics", async () => {
    const athlete = DEFAULT_CLUB_PROFILES[1]; // Siyavuya Thomas
    await enrollAthleteBiometrics(athlete);

    const authRes = await authenticateWithBiometrics(athlete.id);
    expect(authRes.ok).toBe(true);
    expect(authRes.athlete).toBeDefined();
    expect(authRes.athlete?.name).toBe("Siyavuya Thomas");
    expect(authRes.athlete?.bib).toBe("1");
    expect(authRes.message).toContain("Siyavuya Thomas");
  });

  it("returns an error if authenticating with no biometric credentials enrolled", async () => {
    localStorage.clear();
    const res = await authenticateWithBiometrics();
    expect(res.ok).toBe(false);
    expect(res.message).toContain("No biometric credentials enrolled");
  });

  it("saves and matches face biometric records", () => {
    const athlete = DEFAULT_CLUB_PROFILES[3]; // George Mmonwa
    const sampleDataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

    const saved = saveAthleteFaceBiometric(athlete.id, sampleDataUrl);
    expect(saved.athleteId).toBe(athlete.id);
    expect(saved.visualHash).toContain(athlete.id);

    const list = listFaceBiometrics();
    expect(list.length).toBe(1);

    const record = getAthleteFaceBiometric(athlete.id);
    expect(record).not.toBeNull();
    expect(record?.photoDataUrl).toBe(sampleDataUrl);

    // Matching
    const match = matchFaceToAthlete(sampleDataUrl, DEFAULT_CLUB_PROFILES);
    expect(match.matched).not.toBeNull();
    expect(match.matched?.name).toBe("George Mmonwa");
    expect(match.confidence).toBeGreaterThan(90);
  });
});
