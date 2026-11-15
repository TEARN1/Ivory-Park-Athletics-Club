import { beforeEach, describe, expect, it } from "vitest";
import { isTourCompleted, setTourCompleted, TOUR_STEPS } from "./tour";

const mockStorage = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => mockStorage.set(k, String(v)),
    removeItem: (k: string) => mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  };
}

describe("tour library", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("provides comprehensive tour steps covering all core club features", () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(5);

    const stepIds = TOUR_STEPS.map((s) => s.id);
    expect(stepIds).toContain("welcome");
    expect(stepIds).toContain("offline-install");
    expect(stepIds).toContain("session-status");
    expect(stepIds).toContain("team-dispatch");
    expect(stepIds).toContain("live-map");

    // Strictly ensure zero emojis in step text
    TOUR_STEPS.forEach((step) => {
      expect(/[\uD800-\uDFFF]/.test(step.title)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.description)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.badge)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.actionHint)).toBe(false);
    });
  });

  it("tracks completion state in localStorage", () => {
    expect(isTourCompleted()).toBe(false);
    setTourCompleted(true);
    expect(isTourCompleted()).toBe(true);
    setTourCompleted(false);
    expect(isTourCompleted()).toBe(false);
  });
});
