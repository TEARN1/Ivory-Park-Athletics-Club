import { beforeEach, describe, expect, it } from "vitest";
import {
  ATHLETE_GUIDE_STEPS,
  COACH_MASTERY_STEPS,
  isTourCompleted,
  MOST_USED_TOUR_STEPS,
  OVERVIEW_TOUR_STEPS,
  setTourCompleted,
} from "./tour";

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

  it("provides comprehensive Most-Used Buttons tour steps", () => {
    expect(MOST_USED_TOUR_STEPS.length).toBe(8);

    const stepIds = MOST_USED_TOUR_STEPS.map((s) => s.id);
    expect(stepIds).toContain("btn-workout-type");
    expect(stepIds).toContain("btn-distance-chips");
    expect(stepIds).toContain("btn-start-race");
    expect(stepIds).toContain("btn-start-tracking");
    expect(stepIds).toContain("btn-map-layers");
    expect(stepIds).toContain("btn-dispatch-alarm");
    expect(stepIds).toContain("btn-call-athletes");
    expect(stepIds).toContain("btn-install-pwa");

    // Strictly ensure zero emojis in step text
    MOST_USED_TOUR_STEPS.forEach((step) => {
      expect(/[\uD800-\uDFFF]/.test(step.title)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.description)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.badge)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.actionHint)).toBe(false);
    });
  });

  it("provides specialized Athlete Guide and Coach Mastery tour tracks", () => {
    expect(ATHLETE_GUIDE_STEPS.length).toBe(6);
    expect(COACH_MASTERY_STEPS.length).toBe(6);

    [...ATHLETE_GUIDE_STEPS, ...COACH_MASTERY_STEPS].forEach((step) => {
      expect(/[\uD800-\uDFFF]/.test(step.title)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.description)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.badge)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.actionHint)).toBe(false);
    });
  });

  it("provides general overview tour steps", () => {
    expect(OVERVIEW_TOUR_STEPS.length).toBeGreaterThanOrEqual(6);

    OVERVIEW_TOUR_STEPS.forEach((step) => {
      expect(/[\uD800-\uDFFF]/.test(step.title)).toBe(false);
      expect(/[\uD800-\uDFFF]/.test(step.description)).toBe(false);
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
