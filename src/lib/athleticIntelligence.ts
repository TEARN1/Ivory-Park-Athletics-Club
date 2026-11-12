/**
 * ============================================================================
 * 100 ATHLETIC INTELLIGENCE & SPORTS SCIENCE LOGICS
 * IVORY PARK ATHLETICS CLUB (IPAC)
 * ============================================================================
 * Comprehensive coaching and sports science engine powering athlete performance,
 * physiology, pacing, recovery, environmental adjustments, biomechanics, and safety.
 *
 * Each logic is strictly typed, mathematically modeled, and unit-tested.
 */

import { haversineM, type LatLon } from "./geo";

// ============================================================================
// CATEGORY 1: RACE TIME & PACING INTELLIGENCE (LOGICS 1–10)
// ============================================================================

/** 1. Riegel Race Time Predictor: T2 = T1 * (D2 / D1)^1.06 */
export function riegelRacePredictor(baselineDistM: number, baselineTimeSec: number, targetDistM: number): number {
  if (baselineDistM <= 0 || baselineTimeSec <= 0 || targetDistM <= 0) return 0;
  return Math.round(baselineTimeSec * Math.pow(targetDistM / baselineDistM, 1.06));
}

/** 2. Cameron Formula Race Predictor (Endurance quadratic regression) */
export function cameronRacePredictor(baselineDistM: number, baselineTimeSec: number, targetDistM: number): number {
  if (baselineDistM <= 0 || baselineTimeSec <= 0 || targetDistM <= 0) return 0;
  const d1Km = baselineDistM / 1000;
  const d2Km = targetDistM / 1000;
  const ratio = (13.49681 - 0.048865 * d1Km + 2.438936 / Math.pow(d1Km, 0.4)) /
                (13.49681 - 0.048865 * d2Km + 2.438936 / Math.pow(d2Km, 0.4));
  return Math.round((baselineTimeSec / d1Km) * d2Km * (1 / ratio));
}

/** 3. Negative Split Pacing Strategy (Front 51% vs Back 49% elapsed time) */
export function negativeSplitSchedule(distanceM: number, targetTimeSec: number, frontHalfRatio = 0.51): { frontHalfTimeSec: number; backHalfTimeSec: number; frontPaceSec: number; backPaceSec: number } {
  const frontTime = Math.round(targetTimeSec * frontHalfRatio);
  const backTime = targetTimeSec - frontTime;
  const halfDistKm = distanceM / 2000;
  return {
    frontHalfTimeSec: frontTime,
    backHalfTimeSec: backTime,
    frontPaceSec: Math.round(frontTime / halfDistKm),
    backPaceSec: Math.round(backTime / halfDistKm),
  };
}

/** 4. Even Split Baseline Pace */
export function evenSplitTarget(distanceM: number, targetTimeSec: number): number {
  if (distanceM <= 0 || targetTimeSec <= 0) return 0;
  return Math.round(targetTimeSec / (distanceM / 1000));
}

/** 5. Positive Split Fade Decay: Estimates second-half fade penalty */
export function positiveSplitFade(distanceM: number, targetTimeSec: number, fadeRate = 0.06): { firstHalfSec: number; secondHalfSec: number; fadeSeconds: number } {
  const baseHalf = targetTimeSec / 2;
  const fadeSeconds = Math.round(baseHalf * fadeRate);
  return {
    firstHalfSec: Math.round(baseHalf - fadeSeconds / 2),
    secondHalfSec: Math.round(baseHalf + fadeSeconds / 2),
    fadeSeconds,
  };
}

/** 6. Critical Speed (CS): 2-parameter anaerobic threshold model (m/s) */
export function criticalSpeed(d1M: number, t1Sec: number, d2M: number, t2Sec: number): number {
  if (t2Sec === t1Sec || d2M === d1M) return 0;
  return Number(((d2M - d1M) / (t2Sec - t1Sec)).toFixed(2));
}

/** 7. Anaerobic Work Capacity (D'): Anaerobic reserve buffer in meters */
export function anaerobicWorkCapacity(d1M: number, t1Sec: number, d2M: number, t2Sec: number): number {
  const cs = criticalSpeed(d1M, t1Sec, d2M, t2Sec);
  if (cs <= 0) return 0;
  return Math.round(d1M - cs * t1Sec);
}

/** 8. Pacing Drift Detection: Calculates deviation percentage from target pace */
export function detectPacingDrift(targetPaceSec: number, actualSplitPaceSec: number): { percentDrift: number; label: "faster" | "on_pace" | "slower" } {
  if (targetPaceSec <= 0) return { percentDrift: 0, label: "on_pace" };
  const diff = actualSplitPaceSec - targetPaceSec;
  const percent = Number(((diff / targetPaceSec) * 100).toFixed(1));
  if (percent > 3) return { percentDrift: percent, label: "slower" };
  if (percent < -3) return { percentDrift: percent, label: "faster" };
  return { percentDrift: percent, label: "on_pace" };
}

/** 9. Kipchoge Sub-2 Pacing Delta (Target benchmark 2:50.6 /km) */
export function sub2PacingComparison(currentDistM: number, elapsedSec: number): { sub2ExpectedSec: number; deltaSec: number; status: "ahead" | "behind" } {
  const sub2PaceSecPerM = 170.6 / 1000; // 2:50.6 /km
  const expectedSec = Math.round(currentDistM * sub2PaceSecPerM);
  const delta = elapsedSec - expectedSec;
  return {
    sub2ExpectedSec: expectedSec,
    deltaSec: Math.abs(delta),
    status: delta <= 0 ? "ahead" : "behind",
  };
}

/** 10. Comrades Marathon Directional Split Adjuster (90 km Up-run vs Down-run) */
export function comradesMarathonAdjuster(marathonTimeSec: number, direction: "up" | "down"): { estimatedTimeSec: number; avgPaceSec: number; formatted: string } {
  // Comrades factor: Up-run is ~2.28x marathon, Down-run is ~2.22x marathon (eccentric muscle damage on legs)
  const factor = direction === "up" ? 2.28 : 2.22;
  const estSec = Math.round(marathonTimeSec * factor);
  const paceSec = Math.round(estSec / 90);
  const h = Math.floor(estSec / 3600);
  const m = Math.floor((estSec % 3600) / 60);
  const s = estSec % 60;
  return {
    estimatedTimeSec: estSec,
    avgPaceSec: paceSec,
    formatted: `${h}h ${m < 10 ? "0" : ""}${m}m ${s < 10 ? "0" : ""}${s}s`,
  };
}

// ============================================================================
// CATEGORY 2: AEROBIC CAPACITY & VDOT (JACK DANIELS) (LOGICS 11–20)
// ============================================================================

/** 11. Jack Daniels VDOT Score Estimator from race performance */
export function calculateVDOT(distM: number, timeSec: number): number {
  if (distM <= 0 || timeSec <= 0) return 0;
  const tMin = timeSec / 60;
  const v = distM / tMin; // m/min
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const fract = 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
  return Number((vo2 / fract).toFixed(1));
}

/** 12. VO2 Demand from Running Velocity (m/min) */
export function vo2DemandVelocity(velocityMPerMin: number): number {
  return Number((-4.60 + 0.182258 * velocityMPerMin + 0.000104 * Math.pow(velocityMPerMin, 2)).toFixed(1));
}

/** 13. Fractional Aerobic Utilization (%VO2max sustained over t minutes) */
export function fractionalAerobicUtilization(durationMin: number): number {
  return Number((0.8 + 0.1894393 * Math.exp(-0.012778 * durationMin) + 0.2989558 * Math.exp(-0.1932605 * durationMin)).toFixed(3));
}

/** 14. Daniels Easy / Recovery Pace (E-Pace: ~65-74% VO2max) */
export function danielsEasyPace(vdot: number): { minPaceSec: number; maxPaceSec: number; formatted: string } {
  // Approximate seconds per km for given VDOT at Easy pace
  const basePace = Math.round(1800 / (vdot * 0.1));
  const minPace = Math.round(basePace * 1.05);
  const maxPace = Math.round(basePace * 1.15);
  return { minPaceSec: minPace, maxPaceSec: maxPace, formatted: `${Math.floor(minPace / 60)}:${(minPace % 60).toString().padStart(2, "0")} - ${Math.floor(maxPace / 60)}:${(maxPace % 60).toString().padStart(2, "0")} /km` };
}

/** 15. Daniels Marathon Pace (M-Pace: ~75-84% VO2max) */
export function danielsMarathonPace(vdot: number): number {
  const pace = Math.round(1800 / (vdot * 0.1) * 0.94);
  return Math.max(150, pace);
}

/** 16. Daniels Threshold / Tempo Pace (T-Pace: ~86-88% VO2max) */
export function danielsThresholdPace(vdot: number): number {
  const pace = Math.round(1800 / (vdot * 0.1) * 0.88);
  return Math.max(140, pace);
}

/** 17. Daniels Interval Pace (I-Pace: ~97-100% VO2max) */
export function danielsIntervalPace(vdot: number): number {
  const pace = Math.round(1800 / (vdot * 0.1) * 0.81);
  return Math.max(130, pace);
}

/** 18. Daniels Repetition Pace (R-Pace: Anaerobic power & neuromuscular speed) */
export function danielsRepetitionPace(vdot: number): number {
  const pace = Math.round(1800 / (vdot * 0.1) * 0.74);
  return Math.max(120, pace);
}

/** 19. Running Economy Score: Oxygen cost per kg per km (mL O2 / kg / km) */
export function runningEconomyScore(vo2mLkgMin: number, speedKmH: number): number {
  if (speedKmH <= 0) return 0;
  return Number(((vo2mLkgMin * 60) / speedKmH).toFixed(1));
}

/** 20. Cooper 12-Minute Run VO2max Estimator */
export function cooper12MinVO2Max(distanceCoveredM: number): number {
  if (distanceCoveredM <= 504.9) return 0;
  return Number(((distanceCoveredM - 504.9) / 44.73).toFixed(1));
}

// ============================================================================
// CATEGORY 3: ELEVATION & GRADE-ADJUSTED PACE (GAP) (LOGICS 21–30)
// ============================================================================

/** 21. Minetti Metabolic Energy Cost Polynomial: Cr (J / kg / m) */
export function minettiEnergyCost(inclineFraction: number): number {
  const i = inclineFraction;
  return Number((155.4 * Math.pow(i, 5) - 30.4 * Math.pow(i, 4) - 32.8 * Math.pow(i, 3) + 43.7 * Math.pow(i, 2) + 13.3 * i + 3.6).toFixed(2));
}

/** 22. Grade-Adjusted Pace (GAP): Normalizes hill pace to equivalent flat velocity */
export function gradeAdjustedPace(actualPaceSec: number, inclineFraction: number): number {
  if (actualPaceSec <= 0) return 0;
  const costFlat = 3.6; // Minetti flat cost
  const costGrade = minettiEnergyCost(inclineFraction);
  const ratio = costGrade / costFlat;
  return Math.round(actualPaceSec / ratio);
}

/** 23. Strava GAP Approximation (Quadratic slope modifier) */
export function stravaGapApproximation(paceSec: number, gradePercent: number): number {
  const g = gradePercent / 100;
  const factor = 1 + (g > 0 ? 3.3 * g : 1.8 * g);
  return Math.round(paceSec / factor);
}

/** 24. Downhill Eccentric Braking Impact Multiplier */
export function downhillBrakingMultiplier(inclineFraction: number): number {
  if (inclineFraction >= 0) return 1.0;
  // Slopes steeper than -8% increase impact forces significantly
  const steepness = Math.abs(inclineFraction);
  return Number((1.0 + steepness * 3.5).toFixed(2));
}

/** 25. Climb Elevation Distance Equivalent (1m vertical ≈ 8m horizontal) */
export function elevationEquivalentDistance(verticalGainM: number): number {
  return Math.round(verticalGainM * 8);
}

/** 26. Gross Elevation Gain and Loss Totalizer */
export function grossElevationGainLoss(elevationsM: number[]): { gainM: number; lossM: number } {
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < elevationsM.length; i++) {
    const diff = elevationsM[i] - elevationsM[i - 1];
    if (diff > 0.5) gain += diff;
    else if (diff < -0.5) loss += Math.abs(diff);
  }
  return { gainM: Math.round(gain), lossM: Math.round(loss) };
}

/** 27. Grade Percentage Calculation: Rise / Run * 100 */
export function gradePercentage(verticalRiseM: number, horizontalRunM: number): number {
  if (horizontalRunM <= 0) return 0;
  return Number(((verticalRiseM / horizontalRunM) * 100).toFixed(1));
}

/** 28. VAM (Velocità Ascensionale Media): Vertical ascent rate in m/h */
export function verticalAscentSpeedVAM(gainM: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return Math.round((gainM / durationSec) * 3600);
}

/** 29. Hill Repeat Work-to-Rest Ratio */
export function hillRepeatWorkRatio(climbSec: number, recoveryDescentSec: number): { ratio: string; restMultiplier: number } {
  if (climbSec <= 0) return { ratio: "1:1", restMultiplier: 1 };
  const mult = Number((recoveryDescentSec / climbSec).toFixed(1));
  return { ratio: `1:${mult}`, restMultiplier: mult };
}

/** 30. Power Hiking Superiority Threshold: Flags if slope > 22% favors walking */
export function isPowerHikingSuperior(gradePercent: number): boolean {
  return gradePercent >= 22.0;
}

// ============================================================================
// CATEGORY 4: HEART RATE DYNAMICS & ZONES (LOGICS 31–40)
// ============================================================================

/** 31. Tanaka Maximum Heart Rate: 208 - 0.7 * Age */
export function tanakaMaxHR(age: number): number {
  return Math.round(208 - 0.7 * age);
}

/** 32. Gellish Maximum Heart Rate: 207 - 0.7 * Age */
export function gellishMaxHR(age: number): number {
  return Math.round(207 - 0.7 * age);
}

/** 33. Karvonen Heart Rate Reserve (HRR) formula */
export function karvonenTargetHR(restHR: number, maxHR: number, intensityFraction: number): number {
  return Math.round(restHR + intensityFraction * (maxHR - restHR));
}

/** 34. Zone 1: Active Recovery (50% - 60% HRR) */
export function zone1ActiveRecovery(restHR: number, maxHR: number): { min: number; max: number } {
  return { min: karvonenTargetHR(restHR, maxHR, 0.50), max: karvonenTargetHR(restHR, maxHR, 0.60) };
}

/** 35. Zone 2: Aerobic Endurance & Fat Oxidation (60% - 70% HRR) */
export function zone2AerobicBase(restHR: number, maxHR: number): { min: number; max: number } {
  return { min: karvonenTargetHR(restHR, maxHR, 0.60), max: karvonenTargetHR(restHR, maxHR, 0.70) };
}

/** 36. Zone 3: Aerobic Tempo (70% - 80% HRR) */
export function zone3Tempo(restHR: number, maxHR: number): { min: number; max: number } {
  return { min: karvonenTargetHR(restHR, maxHR, 0.70), max: karvonenTargetHR(restHR, maxHR, 0.80) };
}

/** 37. Zone 4: Lactate Threshold (80% - 90% HRR) */
export function zone4LactateThreshold(restHR: number, maxHR: number): { min: number; max: number } {
  return { min: karvonenTargetHR(restHR, maxHR, 0.80), max: karvonenTargetHR(restHR, maxHR, 0.90) };
}

/** 38. Zone 5: VO2 Max / Anaerobic Capacity (90% - 100% HRR) */
export function zone5VO2Max(restHR: number, maxHR: number): { min: number; max: number } {
  return { min: karvonenTargetHR(restHR, maxHR, 0.90), max: maxHR };
}

/** 39. Cardiac Drift Percentage: HR increase at steady pace */
export function cardiacDriftPercentage(h1AvgHR: number, h2AvgHR: number, h1PaceSec: number, h2PaceSec: number): { driftPercent: number; isDrifting: boolean } {
  if (h1AvgHR <= 0 || h1PaceSec <= 0) return { driftPercent: 0, isDrifting: false };
  const hrRatio = h2AvgHR / h1AvgHR;
  const paceRatio = h2PaceSec / h1PaceSec;
  const drift = Number(((hrRatio / paceRatio - 1) * 100).toFixed(1));
  return { driftPercent: drift, isDrifting: drift > 5.0 };
}

/** 40. Heart Rate Recovery (HRR 60s Drop) */
export function heartRateRecoveryIndex(peakHR: number, hrAfter60s: number): { dropBpm: number; fitnessTier: "poor" | "fair" | "good" | "elite" } {
  const drop = peakHR - hrAfter60s;
  if (drop >= 35) return { dropBpm: drop, fitnessTier: "elite" };
  if (drop >= 25) return { dropBpm: drop, fitnessTier: "good" };
  if (drop >= 15) return { dropBpm: drop, fitnessTier: "fair" };
  return { dropBpm: drop, fitnessTier: "poor" };
}

// ============================================================================
// CATEGORY 5: TRAINING LOAD, ACWR & FATIGUE (LOGICS 41–50)
// ============================================================================

/** 41. Bannister TRIMP (Training Impulse) */
export function bannisterTrimp(durationMin: number, avgHR: number, restHR: number, maxHR: number, isFemale = false): number {
  if (maxHR <= restHR) return 0;
  const deltaHR = (avgHR - restHR) / (maxHR - restHR);
  const y = isFemale ? 1.67 : 1.92;
  const b = isFemale ? 0.86 : 0.64;
  return Math.round(durationMin * deltaHR * b * Math.exp(y * deltaHR));
}

/** 42. Foster Session-RPE Load: Duration (min) * RPE (1-10) */
export function sessionRpeLoad(durationMin: number, rpe: number): number {
  return Math.round(durationMin * Math.max(1, Math.min(10, rpe)));
}

/** 43. Acute Workload (7-Day Rolling Load) */
export function acuteWorkload7Day(dailyLoads: number[]): number {
  const recent7 = dailyLoads.slice(-7);
  return Math.round(recent7.reduce((sum, v) => sum + v, 0));
}

/** 44. Chronic Workload (28-Day Rolling Load / 4 weeks) */
export function chronicWorkload28Day(dailyLoads: number[]): number {
  const recent28 = dailyLoads.slice(-28);
  const total = recent28.reduce((sum, v) => sum + v, 0);
  return Math.round(total / 4);
}

/** 45. Acute-to-Chronic Workload Ratio (ACWR) */
export function acuteToChronicWorkloadRatio(acuteLoad: number, chronicLoadAvg: number): number {
  if (chronicLoadAvg <= 0) return 1.0;
  return Number((acuteLoad / chronicLoadAvg).toFixed(2));
}

/** 46. ACWR Injury Risk Zone Evaluation */
export function acwrInjuryRiskZone(acwr: number): { zone: "undertraining" | "sweet_spot" | "danger_zone"; riskLevel: string } {
  if (acwr < 0.8) return { zone: "undertraining", riskLevel: "Low stimulus / undertraining" };
  if (acwr <= 1.3) return { zone: "sweet_spot", riskLevel: "Optimal fitness sweet spot (low injury risk)" };
  return { zone: "danger_zone", riskLevel: "High injury risk (acute load spike)" };
}

/** 47. Training Monotony Index: Mean / StdDev */
export function trainingMonotony(dailyLoads: number[]): number {
  if (dailyLoads.length === 0) return 0;
  const mean = dailyLoads.reduce((a, b) => a + b, 0) / dailyLoads.length;
  const variance = dailyLoads.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / dailyLoads.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 1.0;
  return Number((mean / std).toFixed(2));
}

/** 48. Training Strain Index: Weekly Load * Monotony */
export function trainingStrain(weeklyLoad: number, monotony: number): number {
  return Math.round(weeklyLoad * monotony);
}

/** 49. Mujika Taper Decay Curve: Exponential volume reduction */
export function taperVolumeCurve(baselineWeeklyKm: number, daysIntoTaper: number, totalTaperDays = 14): number {
  const fraction = 0.5 + 0.5 * Math.exp(-2.5 * (daysIntoTaper / totalTaperDays));
  return Number((baselineWeeklyKm * fraction).toFixed(1));
}

/** 50. Rest Day Recommendation Advisor */
export function restDayRecommendation(consecutiveHardDays: number, acwr: number): { restNeeded: boolean; advice: string } {
  if (consecutiveHardDays >= 3 || acwr > 1.5) {
    return { restNeeded: true, advice: "Mandatory active recovery or complete rest day recommended." };
  }
  return { restNeeded: false, advice: "Athletic load is balanced. Ready for scheduled session." };
}

// ============================================================================
// CATEGORY 6: ENVIRONMENTAL, WEATHER & ALTITUDE IMPACT (LOGICS 51–60)
// ============================================================================

/** 51. Dew Point Thermal Stress Index: Temp (°C) + Dew Point (°C) */
export function dewPointThermalIndex(tempC: number, dewPointC: number): number {
  return Math.round(tempC + dewPointC);
}

/** 52. Heat Pace Penalty Factor (% pace slowdown required) */
export function heatPacePenaltyPercent(tempC: number, dewPointC: number): number {
  const sum = tempC + dewPointC;
  if (sum <= 30) return 0; // optimal racing conditions
  if (sum <= 38) return Number(((sum - 30) * 0.4).toFixed(1));
  if (sum <= 45) return Number((3.2 + (sum - 38) * 0.8).toFixed(1));
  return Number((8.8 + (sum - 45) * 1.5).toFixed(1));
}

/** 53. Humidity Evaporative Cooling Efficiency */
export function humidityEvaporativeCooling(tempC: number, relHumidityPercent: number): { coolingEfficiencyPercent: number; sweatRateMultiplier: number } {
  const eff = Math.max(20, Math.round(100 - (relHumidityPercent * 0.75)));
  const mult = Number((1 + (100 - eff) / 100 * 0.5).toFixed(2));
  return { coolingEfficiencyPercent: eff, sweatRateMultiplier: mult };
}

/** 54. Aerodynamic Headwind Resistance Power Loss (Watts) */
export function aerodynamicHeadwindLossWatts(runnerSpeedMs: number, windSpeedMs: number, massKg = 65): number {
  const airDensity = 1.05; // ~1600m Highveld air density
  const cdA = 0.24; // Drag area for runners
  const relVelocity = runnerSpeedMs + windSpeedMs;
  return Number((0.5 * airDensity * cdA * Math.pow(relVelocity, 3)).toFixed(1));
}

/** 55. Wind Pace Adjustment: Headwind vs Tailwind */
export function windPaceAdjustment(paceSec: number, windSpeedKmH: number, isHeadwind: boolean): number {
  // Headwind penalty is ~2x greater than tailwind benefit
  const factor = isHeadwind ? 0.007 : -0.0035;
  const deltaSec = Math.round(paceSec * (windSpeedKmH * factor));
  return Math.max(120, paceSec + deltaSec);
}

/** 56. Gauteng / Highveld Altitude VO2max Reduction (~1600m above sea level) */
export function gautengAltitudeVO2MaxFactor(altitudeM = 1600): number {
  // Every 1000m above sea level reduces VO2max by ~6%
  const factor = 1 - (altitudeM / 1000) * 0.06;
  return Number(factor.toFixed(3));
}

/** 57. Highveld Altitude to Sea Level Conversion Pace */
export function altitudeToSeaLevelPace(highveldPaceSec: number, altitudeM = 1600): number {
  const factor = gautengAltitudeVO2MaxFactor(altitudeM);
  return Math.round(highveldPaceSec * factor);
}

/** 58. Wind Chill Equivalent Temperature (°C) */
export function windChillTemperature(tempC: number, windSpeedKmH: number): number {
  if (tempC > 10 || windSpeedKmH < 4.8) return tempC;
  const v = Math.pow(windSpeedKmH, 0.16);
  return Math.round(13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v);
}

/** 59. WBGT Flag Alert Category (World Athletics thermal safety) */
export function wbgtFlagCategory(wbgtC: number): { flag: "green" | "yellow" | "red" | "black"; message: string } {
  if (wbgtC < 18) return { flag: "green", message: "Normal risk: ideal race conditions." };
  if (wbgtC < 23) return { flag: "yellow", message: "Moderate risk: increase hydration intervals." };
  if (wbgtC < 28) return { flag: "red", message: "High risk: reduce target race pace." };
  return { flag: "black", message: "Extreme risk: modify distance or postpone race." };
}

/** 60. Solar Thermal Exposure Load Index (Mid-day African sun) */
export function solarThermalExposureLoad(uvIndex: number, hour24: number): number {
  const midDayFactor = hour24 >= 10 && hour24 <= 15 ? 1.4 : 1.0;
  return Number((uvIndex * midDayFactor).toFixed(1));
}

// ============================================================================
// CATEGORY 7: BIOMECHANICS, CADENCE & EFFICIENCY (LOGICS 61–70)
// ============================================================================

/** 61. Step Cadence (Steps per Minute) */
export function stepCadenceSPM(totalSteps: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return Math.round((totalSteps / durationSec) * 60);
}

/** 62. Stride Length (Meters): Velocity * 60 / Cadence */
export function strideLengthM(speedMs: number, cadenceSPM: number): number {
  if (cadenceSPM <= 0) return 0;
  return Number(((speedMs * 60) / cadenceSPM).toFixed(2));
}

/** 63. Cadence Efficiency Rating */
export function cadenceEfficiencyRating(cadenceSPM: number): { rating: "low" | "optimal" | "high"; feedback: string } {
  if (cadenceSPM < 165) return { rating: "low", feedback: "Low cadence: likely overstriding and braking." };
  if (cadenceSPM <= 186) return { rating: "optimal", feedback: "Optimal cadence: excellent elastic recoil." };
  return { rating: "high", feedback: "High cadence: quick turnover sprint mechanics." };
}

/** 64. Overstriding Braking Index */
export function overstridingBrakingIndex(cadenceSPM: number, speedMs: number, heightM = 1.75): { brakingRisk: "low" | "moderate" | "high"; strideToHeightRatio: number } {
  const strideM = strideLengthM(speedMs, cadenceSPM);
  const ratio = Number((strideM / heightM).toFixed(2));
  if (ratio > 0.90 && cadenceSPM < 165) return { brakingRisk: "high", strideToHeightRatio: ratio };
  if (ratio > 0.85) return { brakingRisk: "moderate", strideToHeightRatio: ratio };
  return { brakingRisk: "low", strideToHeightRatio: ratio };
}

/** 65. Vertical Oscillation Ratio (% bounce to forward stride) */
export function verticalOscillationRatio(verticalBounceCm: number, strideLengthM: number): number {
  if (strideLengthM <= 0) return 0;
  return Number(((verticalBounceCm / 100 / strideLengthM) * 100).toFixed(1));
}

/** 66. Ground Contact Time (GCT) Performance Rating */
export function groundContactTimeRating(gctMs: number): { tier: "elite" | "trained" | "novice" } {
  if (gctMs < 210) return { tier: "elite" };
  if (gctMs <= 260) return { tier: "trained" };
  return { tier: "novice" };
}

/** 67. Leg Spring Stiffness Proxy (kN/m) */
export function legSpringStiffness(massKg: number, gctSec: number, flightTimeSec: number): number {
  if (gctSec <= 0 || flightTimeSec <= 0) return 0;
  const omega = Math.PI / (gctSec + flightTimeSec);
  const k = (massKg * Math.pow(omega, 2)) / 1000;
  return Number(k.toFixed(1));
}

/** 68. Running Economy Efficiency Ratio: kcal / km / kg */
export function runningEconomyCalPerKmKg(calories: number, distanceKm: number, massKg: number): number {
  if (distanceKm <= 0 || massKg <= 0) return 0;
  return Number((calories / (distanceKm * massKg)).toFixed(3));
}

/** 69. Stride Asymmetry Index (%) */
export function strideAsymmetryPercent(leftMs: number, rightMs: number): number {
  if (leftMs <= 0 || rightMs <= 0) return 0;
  const diff = Math.abs(leftMs - rightMs);
  const mean = (leftMs + rightMs) / 2;
  return Number(((diff / mean) * 100).toFixed(1));
}

/** 70. Form Fatigue Degradation Score */
export function formFatigueIndex(startCadence: number, endCadence: number, startPace: number, endPace: number): { fatiguePercent: number; isFatigued: boolean } {
  const cadDrop = (startCadence - endCadence) / startCadence;
  const paceDrop = (endPace - startPace) / startPace;
  const score = Number(((cadDrop + paceDrop) * 50).toFixed(1));
  return { fatiguePercent: Math.max(0, score), isFatigued: score > 5.0 };
}

// ============================================================================
// CATEGORY 8: HYDRATION, NUTRITION & THERMOREGULATION (LOGICS 71–80)
// ============================================================================

/** 71. Hourly Sweat Rate (Liters per hour) */
export function hourlySweatRateLiters(preWeightKg: number, postWeightKg: number, fluidLiters: number, urineLiters: number, durationHours: number): number {
  if (durationHours <= 0) return 0;
  const sweatKg = preWeightKg - postWeightKg + fluidLiters - urineLiters;
  return Number((Math.max(0, sweatKg) / durationHours).toFixed(2));
}

/** 72. Recommended Fluid Intake Rate (mL / hour) */
export function recommendedFluidIntakePerHour(sweatRateLiters: number): number {
  // Replace ~75-80% of sweat rate during exercise
  return Math.round(sweatRateLiters * 0.8 * 1000);
}

/** 73. Dehydration Body Mass Loss Percentage */
export function bodyMassLossPercentage(preWeightKg: number, postWeightKg: number): number {
  if (preWeightKg <= 0) return 0;
  return Number((((preWeightKg - postWeightKg) / preWeightKg) * 100).toFixed(1));
}

/** 74. Dehydration Performance Penalty */
export function dehydrationPerformancePenalty(lossPercent: number): { penaltySecPerKm: number; warning: string } {
  if (lossPercent < 2.0) return { penaltySecPerKm: 0, warning: "Optimal hydration." };
  const sec = Math.round((lossPercent - 1.5) * 6);
  return { penaltySecPerKm: sec, warning: "Dehydration exceeding 2% impairs stroke volume and aerobic output." };
}

/** 75. Carbohydrate Intake Requirement per Hour */
export function carbohydrateNeedPerHour(durationMin: number): number {
  if (durationMin < 60) return 0;
  if (durationMin <= 120) return 30; // 30g/hr
  return 60; // 60g/hr for marathons and ultras
}

/** 76. Glycogen Depletion Estimate (grams burned) */
export function glycogenDepletionRate(durationMin: number, intensityFraction: number): number {
  // At 80% VO2max, runners burn ~2.8g carbs/min
  const rateGramsPerMin = 1.0 + intensityFraction * 2.5;
  return Math.round(durationMin * rateGramsPerMin);
}

/** 77. Sodium Electrolyte Loss Estimate (mg) */
export function sodiumElectrolyteLossMg(sweatLiters: number, sweatSodiumMgPerL = 900): number {
  return Math.round(sweatLiters * sweatSodiumMgPerL);
}

/** 78. Post-Run Rehydration Target (Drink 150% of weight lost) */
export function postRunRehydrationTargetLiters(weightLossKg: number): number {
  return Number((Math.max(0, weightLossKg) * 1.5).toFixed(2));
}

/** 79. Gross Caloric Expenditure: Mass (kg) * Distance (km) * 1.036 */
export function grossCaloricExpenditure(massKg: number, distanceKm: number): number {
  return Math.round(massKg * distanceKm * 1.036);
}

/** 80. Water Station Strategy: Optimal consumption per stop */
export function waterStationPacingStrategy(raceDistanceKm: number, stationIntervalKm = 3): { totalStations: number; mlPerStation: number } {
  const count = Math.floor(raceDistanceKm / stationIntervalKm);
  return { totalStations: count, mlPerStation: 150 };
}

// ============================================================================
// CATEGORY 9: DEMOGRAPHICS, AGE GRADING & HANDICAPPING (LOGICS 81–90)
// ============================================================================

/** 81. WMA Age-Graded Percentage */
export function wmaAgeGradedPercentage(actualTimeSec: number, age: number, gender: "M" | "F", distanceM: number): number {
  if (actualTimeSec <= 0 || distanceM <= 0) return 0;
  // World record approximations for 5k/10k/21k/42k
  const openStandard = distanceM === 5000 ? (gender === "M" ? 755 : 846) : distanceM === 10000 ? (gender === "M" ? 1571 : 1740) : (gender === "M" ? 3480 : 3860);
  const ageFactor = age <= 30 ? 1.0 : 1 - (age - 30) * 0.008;
  const ageStandard = openStandard / ageFactor;
  return Number(((ageStandard / actualTimeSec) * 100).toFixed(1));
}

/** 82. Age-Graded Performance Tier */
export function ageGradedPerformanceTier(percent: number): "World Class" | "National Class" | "Regional Class" | "Local Competitor" | "Fitness Runner" {
  if (percent >= 90) return "World Class";
  if (percent >= 80) return "National Class";
  if (percent >= 70) return "Regional Class";
  if (percent >= 60) return "Local Competitor";
  return "Fitness Runner";
}

/** 83. Age-Graded Open Equivalent Time (What the runner would run in prime) */
export function ageGradedOpenEquivalentTime(actualTimeSec: number, age: number): number {
  if (age <= 30) return actualTimeSec;
  const ageFactor = 1 - (age - 30) * 0.008;
  return Math.round(actualTimeSec * ageFactor);
}

/** 84. Ivory Park Club Handicap Start Stagger Delay (seconds) */
export function handicapStaggerStartDelay(runnerTargetTimeSec: number, scratchRunnerTimeSec: number): number {
  return Math.max(0, runnerTargetTimeSec - scratchRunnerTimeSec);
}

/** 85. Body Mass Index (BMI) */
export function bodyMassIndex(weightKg: number, heightM: number): number {
  if (heightM <= 0) return 0;
  return Number((weightKg / Math.pow(heightM, 2)).toFixed(1));
}

/** 86. Weight Change Pacing Effect (seconds per km per kg) */
export function weightChangePaceEffect(currentPaceSec: number, weightChangeKg: number): number {
  // ~2.5 seconds per km per kg of body mass change
  return Math.round(currentPaceSec + weightChangeKg * 2.5);
}

/** 87. Junior Athlete Mileage Cap (km / week) */
export function juniorMaxWeeklyMileage(age: number): number {
  if (age < 12) return 15;
  if (age < 15) return 30;
  if (age < 18) return 50;
  return 120;
}

/** 88. Masters Athlete Recovery Interval Multiplier */
export function mastersRecoveryMultiplier(age: number): number {
  if (age < 40) return 1.0;
  if (age < 50) return 1.25;
  if (age < 60) return 1.5;
  return 1.75;
}

/** 89. Gender Equivalent Performance Time (M <-> F conversion) */
export function genderEquivalentTime(timeSec: number, fromGender: "M" | "F"): number {
  // Female times average ~11% slower across middle and long distances
  if (fromGender === "M") return Math.round(timeSec * 1.11);
  return Math.round(timeSec / 1.11);
}

/** 90. Club Milestone Achievement Badge Checker */
export function checkMilestoneBadges(distanceM: number, timeSec: number, careerKm: number): string[] {
  const badges: string[] = [];
  if (distanceM >= 5000 && timeSec < 1200) badges.push("Sub-20 5K");
  if (distanceM >= 10000 && timeSec < 2400) badges.push("Sub-40 10K");
  if (distanceM >= 21097 && timeSec < 5400) badges.push("Sub-90 Half Marathon");
  if (distanceM >= 42195 && timeSec < 10800) badges.push("Sub-3hr Marathon");
  if (careerKm >= 1000) badges.push("1000km Club Veteran");
  return badges;
}

// ============================================================================
// CATEGORY 10: EQUIPMENT, TEAM TACTICS & SAFETY GEOFENCING (LOGICS 91–100)
// ============================================================================

/** 91. Running Shoe Mileage Wear Status */
export function shoeMileageWearStatus(currentKm: number, maxKm = 700): { percentWorn: number; status: "fresh" | "good" | "replace_soon" | "retired" } {
  const pct = Math.round((currentKm / maxKm) * 100);
  if (pct < 40) return { percentWorn: pct, status: "fresh" };
  if (pct < 85) return { percentWorn: pct, status: "good" };
  if (pct < 100) return { percentWorn: pct, status: "replace_soon" };
  return { percentWorn: pct, status: "retired" };
}

/** 92. Midsole Foam Compression Breakdown Index */
export function shoeFoamCompressionFatigue(currentKm: number, runnerWeightKg: number): number {
  // Heavier runners compress EVA/PEBA foam faster
  const factor = runnerWeightKg / 70;
  return Number(Math.min(100, (currentKm / 650) * factor * 100).toFixed(1));
}

/** 93. Relay Baton Exchange Acceleration Curve (30m IAAF zone) */
export function relayExchangeAccelerationCurve(zoneM = 30, incomingSpeedMs = 8.5, outgoingSpeedMs = 7.0): { exchangeEfficiencyPercent: number; speedDifferenceMs: number } {
  const diff = Math.abs(incomingSpeedMs - outgoingSpeedMs);
  const eff = Math.max(0, Math.round(100 - diff * 12));
  return { exchangeEfficiencyPercent: eff, speedDifferenceMs: Number(diff.toFixed(2)) };
}

/** 94. Drafting Aerodynamic Energy Savings (2-4% savings within 1m) */
export function draftingEnergyBenefitPercent(distanceBehindM = 1.0): number {
  if (distanceBehindM <= 1.0) return 3.5;
  if (distanceBehindM <= 2.0) return 2.0;
  return 0.5;
}

/** 95. Pack Pacing Cohesion Index: Standard deviation of squad paces */
export function packCohesionIndex(runnerPacesSec: number[]): { cohesionScore: number; isTightPack: boolean } {
  if (runnerPacesSec.length < 2) return { cohesionScore: 100, isTightPack: true };
  const mean = runnerPacesSec.reduce((a, b) => a + b, 0) / runnerPacesSec.length;
  const variance = runnerPacesSec.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / runnerPacesSec.length;
  const std = Math.sqrt(variance);
  const score = Math.max(0, Math.round(100 - std * 4));
  return { cohesionScore: score, isTightPack: std < 8 };
}

/** 96. Safety Geofencing Route Deviation Check */
export function geofenceDeviationCheck(currentPos: LatLon, routePoints: LatLon[], maxDeviationM = 150): { isDeviating: boolean; distanceToRouteM: number } {
  if (routePoints.length === 0) return { isDeviating: false, distanceToRouteM: 0 };
  let minD = Infinity;
  for (const pt of routePoints) {
    const d = haversineM(currentPos, pt);
    if (d < minD) minD = d;
  }
  return { isDeviating: minD > maxDeviationM, distanceToRouteM: Math.round(minD) };
}

/** 97. Emergency Stillness Safety Alert */
export function emergencyStillnessAlert(stillnessDurationSec: number, isWaterPoint = false): { alertTriggered: boolean; alertMessage: string } {
  if (!isWaterPoint && stillnessDurationSec >= 180) {
    return { alertTriggered: true, alertMessage: "Athlete has been motionless for 3 minutes. Check safety." };
  }
  return { alertTriggered: false, alertMessage: "Normal runner movement." };
}

/** 98. Twilight & Night Visibility Risk Rating */
export function visibilityRiskLevel(hour24: number): { highVisibilityRequired: boolean; lightingAdvice: string } {
  if (hour24 < 6 || hour24 >= 18) {
    return { highVisibilityRequired: true, lightingAdvice: "Low light / darkness: wear reflective bib and headlamp." };
  }
  return { highVisibilityRequired: false, lightingAdvice: "Daylight conditions: optimal road visibility." };
}

/** 99. Race Day Gear Verification Checklist */
export function raceDayBagChecklist(gear: { bib: boolean; chip: boolean; shoes: boolean; hydration: boolean; pins: boolean }): { ready: boolean; missingItems: string[] } {
  const missing: string[] = [];
  if (!gear.bib) missing.push("Race Bib");
  if (!gear.chip) missing.push("Timing Chip");
  if (!gear.shoes) missing.push("Running Shoes");
  if (!gear.hydration) missing.push("Electrolyte Hydration");
  if (!gear.pins) missing.push("Safety Pins");
  return { ready: missing.length === 0, missingItems: missing };
}

/** 100. Overall Athletic Readiness Index (ARI 1–100) */
export interface ReadinessInput {
  sleepHours: number;
  restingHR: number;
  baselineRestingHR: number;
  sorenessRpe1to10: number;
  acwr: number;
  hydrationLevel: "good" | "fair" | "poor";
}

export function overallAthleticReadinessScore(input: ReadinessInput): { score: number; status: "Optimal" | "Ready" | "Fatigued" | "Rest Required" } {
  let score = 100;

  // Sleep impact
  if (input.sleepHours < 7) score -= (7 - input.sleepHours) * 6;

  // Resting HR elevation
  const hrElev = input.restingHR - input.baselineRestingHR;
  if (hrElev > 3) score -= hrElev * 3;

  // Muscle Soreness (1-10)
  score -= (input.sorenessRpe1to10 - 1) * 3;

  // ACWR fatigue spike
  if (input.acwr > 1.3) score -= (input.acwr - 1.3) * 30;

  // Hydration
  if (input.hydrationLevel === "poor") score -= 15;
  else if (input.hydrationLevel === "fair") score -= 6;

  const finalScore = Math.max(1, Math.min(100, Math.round(score)));

  let status: "Optimal" | "Ready" | "Fatigued" | "Rest Required" = "Optimal";
  if (finalScore < 50) status = "Rest Required";
  else if (finalScore < 70) status = "Fatigued";
  else if (finalScore < 85) status = "Ready";

  return { score: finalScore, status };
}
