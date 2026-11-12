import { describe, expect, it } from "vitest";
import {
  calcPaceDelta,
  calcPaceFromTime,
  calcTimeFromPace,
  fmtDuration,
  fmtPace,
  generateSplitTargets,
  parseDuration,
  parsePace,
} from "./racePacing";

describe("racePacing calculations", () => {
  it("converts target distance and time to pace", () => {
    // 10km in 45m = 4:30 /km (270 sec/km)
    const pace = calcPaceFromTime(10000, 45 * 60);
    expect(pace).toBe(270);
    expect(fmtPace(pace)).toBe("4:30 /km");
  });

  it("converts target distance and pace to finish time", () => {
    // 5km at 4:00/km (240 sec) = 20 minutes (1200 sec)
    const timeSec = calcTimeFromPace(5000, 240);
    expect(timeSec).toBe(1200);
    expect(fmtDuration(timeSec)).toBe("00:20:00");
  });

  it("parses and formats pace and duration strings accurately", () => {
    expect(parsePace("4:15")).toBe(255);
    expect(parsePace("3:55")).toBe(235);
    expect(parsePace("invalid")).toBeNull();

    expect(parseDuration("00:45:00")).toBe(2700);
    expect(parseDuration("1:30:00")).toBe(5400);
    expect(parseDuration("25:00")).toBe(1500);
  });

  it("calculates live pace delta (ahead and behind target)", () => {
    // Target 4:30 /km (270s/km)
    // Run 2km (2000m) in 8m40s (520s) -> expected was 540s -> 20s ahead
    const deltaAhead = calcPaceDelta(2000, 520 * 1000, 270);
    expect(deltaAhead.ahead).toBe(true);
    expect(deltaAhead.deltaSec).toBe(-20);
    expect(deltaAhead.formattedDelta).toBe("-20s Ahead");

    // Run 2km (2000m) in 9m15s (555s) -> expected was 540s -> 15s behind
    const deltaBehind = calcPaceDelta(2000, 555 * 1000, 270);
    expect(deltaBehind.ahead).toBe(false);
    expect(deltaBehind.deltaSec).toBe(15);
    expect(deltaBehind.formattedDelta).toBe("+15s Behind");
  });

  it("generates exact kilometer split targets", () => {
    const splits = generateSplitTargets(5000, 270);
    expect(splits.length).toBe(5);
    expect(splits[0].km).toBe(1);
    expect(splits[0].cumulativeTime).toBe("04:30");
    expect(splits[4].km).toBe(5);
    expect(splits[4].cumulativeTime).toBe("22:30");
  });
});
