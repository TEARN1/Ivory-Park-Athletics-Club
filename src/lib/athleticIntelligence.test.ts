import { describe, expect, it } from "vitest";
import {
  // Category 1
  riegelRacePredictor,
  cameronRacePredictor,
  negativeSplitSchedule,
  evenSplitTarget,
  positiveSplitFade,
  criticalSpeed,
  anaerobicWorkCapacity,
  detectPacingDrift,
  sub2PacingComparison,
  comradesMarathonAdjuster,
  // Category 2
  calculateVDOT,
  vo2DemandVelocity,
  fractionalAerobicUtilization,
  danielsEasyPace,
  danielsMarathonPace,
  danielsThresholdPace,
  danielsIntervalPace,
  danielsRepetitionPace,
  runningEconomyScore,
  cooper12MinVO2Max,
  // Category 3
  minettiEnergyCost,
  gradeAdjustedPace,
  stravaGapApproximation,
  downhillBrakingMultiplier,
  elevationEquivalentDistance,
  grossElevationGainLoss,
  gradePercentage,
  verticalAscentSpeedVAM,
  hillRepeatWorkRatio,
  isPowerHikingSuperior,
  // Category 4
  tanakaMaxHR,
  gellishMaxHR,
  karvonenTargetHR,
  zone1ActiveRecovery,
  zone2AerobicBase,
  zone3Tempo,
  zone4LactateThreshold,
  zone5VO2Max,
  cardiacDriftPercentage,
  heartRateRecoveryIndex,
  // Category 5
  bannisterTrimp,
  sessionRpeLoad,
  acuteWorkload7Day,
  chronicWorkload28Day,
  acuteToChronicWorkloadRatio,
  acwrInjuryRiskZone,
  trainingMonotony,
  trainingStrain,
  taperVolumeCurve,
  restDayRecommendation,
  // Category 6
  dewPointThermalIndex,
  heatPacePenaltyPercent,
  humidityEvaporativeCooling,
  aerodynamicHeadwindLossWatts,
  windPaceAdjustment,
  gautengAltitudeVO2MaxFactor,
  altitudeToSeaLevelPace,
  windChillTemperature,
  wbgtFlagCategory,
  solarThermalExposureLoad,
  // Category 7
  stepCadenceSPM,
  strideLengthM,
  cadenceEfficiencyRating,
  overstridingBrakingIndex,
  verticalOscillationRatio,
  groundContactTimeRating,
  legSpringStiffness,
  runningEconomyCalPerKmKg,
  strideAsymmetryPercent,
  formFatigueIndex,
  // Category 8
  hourlySweatRateLiters,
  recommendedFluidIntakePerHour,
  bodyMassLossPercentage,
  dehydrationPerformancePenalty,
  carbohydrateNeedPerHour,
  glycogenDepletionRate,
  sodiumElectrolyteLossMg,
  postRunRehydrationTargetLiters,
  grossCaloricExpenditure,
  waterStationPacingStrategy,
  // Category 9
  wmaAgeGradedPercentage,
  ageGradedPerformanceTier,
  ageGradedOpenEquivalentTime,
  handicapStaggerStartDelay,
  bodyMassIndex,
  weightChangePaceEffect,
  juniorMaxWeeklyMileage,
  mastersRecoveryMultiplier,
  genderEquivalentTime,
  checkMilestoneBadges,
  // Category 10
  shoeMileageWearStatus,
  shoeFoamCompressionFatigue,
  relayExchangeAccelerationCurve,
  draftingEnergyBenefitPercent,
  packCohesionIndex,
  geofenceDeviationCheck,
  emergencyStillnessAlert,
  visibilityRiskLevel,
  raceDayBagChecklist,
  overallAthleticReadinessScore,
} from "./athleticIntelligence";

describe("100 Athletic Intelligence & Sports Science Logics", () => {
  // Category 1: Race Time & Pacing (Logics 1-10)
  describe("Category 1: Race Time & Pacing", () => {
    it("1. Riegel predicts 10k from 20m 5k", () => {
      const pred10k = riegelRacePredictor(5000, 1200, 10000);
      expect(pred10k).toBeGreaterThan(2400); // ~41:30
      expect(pred10k).toBeLessThan(2600);
    });

    it("2. Cameron predicts race time", () => {
      const pred = cameronRacePredictor(5000, 1200, 10000);
      expect(pred).toBeGreaterThan(2200);
    });

    it("3. Negative split strategy balances front/back", () => {
      const splits = negativeSplitSchedule(10000, 2400, 0.51);
      expect(splits.frontHalfTimeSec).toBe(1224);
      expect(splits.backHalfTimeSec).toBe(1176);
      expect(splits.backPaceSec).toBeLessThan(splits.frontPaceSec);
    });

    it("4. Even split calculates exact pace", () => {
      expect(evenSplitTarget(10000, 2400)).toBe(240); // 4:00/km
    });

    it("5. Positive split fade calculates fade penalty", () => {
      const fade = positiveSplitFade(10000, 2400, 0.06);
      expect(fade.fadeSeconds).toBe(72);
      expect(fade.secondHalfSec).toBeGreaterThan(fade.firstHalfSec);
    });

    it("6 & 7. Critical Speed and Anaerobic Work Capacity", () => {
      // 1500m in 300s, 3000m in 660s -> CS = 1500 / 360 = 4.17 m/s
      const cs = criticalSpeed(1500, 300, 3000, 660);
      expect(cs).toBe(4.17);
      const dPrime = anaerobicWorkCapacity(1500, 300, 3000, 660);
      expect(dPrime).toBeGreaterThan(200);
    });

    it("8. Pacing drift flags deviations", () => {
      expect(detectPacingDrift(240, 255).label).toBe("slower");
      expect(detectPacingDrift(240, 225).label).toBe("faster");
      expect(detectPacingDrift(240, 242).label).toBe("on_pace");
    });

    it("9. Kipchoge Sub-2 pacing comparison", () => {
      const comp = sub2PacingComparison(10000, 1700);
      expect(comp.sub2ExpectedSec).toBe(1706);
      expect(comp.status).toBe("ahead");
    });

    it("10. Comrades Marathon Up and Down run adjustments", () => {
      const up = comradesMarathonAdjuster(3 * 3600, "up");
      const down = comradesMarathonAdjuster(3 * 3600, "down");
      expect(up.estimatedTimeSec).toBeGreaterThan(down.estimatedTimeSec);
    });
  });

  // Category 2: Aerobic Capacity & VDOT (Logics 11-20)
  describe("Category 2: Aerobic Capacity & VDOT", () => {
    it("11. VDOT calculation from race performance", () => {
      const vdot = calculateVDOT(5000, 1200); // 20m 5k
      expect(vdot).toBeGreaterThan(48);
      expect(vdot).toBeLessThan(52);
    });

    it("12 & 13. VO2 demand and fractional utilization", () => {
      expect(vo2DemandVelocity(250)).toBeGreaterThan(45);
      expect(fractionalAerobicUtilization(30)).toBeGreaterThan(0.8);
    });

    it("14–18. Daniels Training Pace Zones", () => {
      const vdot = 50;
      expect(danielsEasyPace(vdot).minPaceSec).toBeGreaterThan(280);
      expect(danielsMarathonPace(vdot)).toBeLessThan(danielsEasyPace(vdot).minPaceSec);
      expect(danielsThresholdPace(vdot)).toBeLessThan(danielsMarathonPace(vdot));
      expect(danielsIntervalPace(vdot)).toBeLessThan(danielsThresholdPace(vdot));
      expect(danielsRepetitionPace(vdot)).toBeLessThan(danielsIntervalPace(vdot));
    });

    it("19. Running economy score", () => {
      expect(runningEconomyScore(50, 15)).toBe(200);
    });

    it("20. Cooper 12-minute run VO2max", () => {
      expect(cooper12MinVO2Max(3000)).toBeGreaterThan(50);
    });
  });

  // Category 3: Elevation & GAP (Logics 21-30)
  describe("Category 3: Elevation & Grade-Adjusted Pace", () => {
    it("21. Minetti energy cost polynomial", () => {
      expect(minettiEnergyCost(0)).toBe(3.6);
      expect(minettiEnergyCost(0.10)).toBeGreaterThan(5.0); // 10% uphill
    });

    it("22 & 23. Grade-Adjusted Pace", () => {
      const flatGAP = gradeAdjustedPace(300, 0.08); // 8% uphill at 5:00/km
      expect(flatGAP).toBeLessThan(300); // equivalent flat pace is much faster
      expect(stravaGapApproximation(300, 5)).toBeLessThan(300);
    });

    it("24. Downhill braking impact multiplier", () => {
      expect(downhillBrakingMultiplier(-0.12)).toBeGreaterThan(1.3);
      expect(downhillBrakingMultiplier(0.05)).toBe(1.0);
    });

    it("25 & 26. Elevation equivalent distance and gross gain/loss", () => {
      expect(elevationEquivalentDistance(100)).toBe(800);
      const gl = grossElevationGainLoss([100, 120, 110, 150]);
      expect(gl.gainM).toBe(60);
      expect(gl.lossM).toBe(10);
    });

    it("27 & 28. Grade percentage and VAM", () => {
      expect(gradePercentage(100, 1000)).toBe(10.0);
      expect(verticalAscentSpeedVAM(300, 1800)).toBe(600); // 600m/h
    });

    it("29 & 30. Hill repeat ratio and power hiking threshold", () => {
      expect(hillRepeatWorkRatio(120, 120).ratio).toBe("1:1");
      expect(isPowerHikingSuperior(25)).toBe(true);
      expect(isPowerHikingSuperior(15)).toBe(false);
    });
  });

  // Category 4: Heart Rate Dynamics & Zones (Logics 31-40)
  describe("Category 4: Heart Rate Dynamics & Zones", () => {
    it("31 & 32. Tanaka and Gellish Max HR", () => {
      expect(tanakaMaxHR(20)).toBe(194);
      expect(gellishMaxHR(20)).toBe(193);
    });

    it("33–38. Karvonen target HR and Zones 1-5", () => {
      const rest = 50;
      const max = 190;
      expect(karvonenTargetHR(rest, max, 0.70)).toBe(148);
      const z2 = zone2AerobicBase(rest, max);
      const z4 = zone4LactateThreshold(rest, max);
      expect(z4.min).toBeGreaterThan(z2.max);
      expect(zone5VO2Max(rest, max).max).toBe(max);
    });

    it("39 & 40. Cardiac drift and HRR 60s recovery", () => {
      const drift = cardiacDriftPercentage(150, 162, 300, 300);
      expect(drift.isDrifting).toBe(true);
      expect(heartRateRecoveryIndex(185, 150).fitnessTier).toBe("elite");
    });
  });

  // Category 5: Training Load & ACWR (Logics 41-50)
  describe("Category 5: Training Load & ACWR", () => {
    it("41 & 42. Bannister TRIMP and Session RPE load", () => {
      expect(bannisterTrimp(60, 150, 50, 190)).toBeGreaterThan(50);
      expect(sessionRpeLoad(60, 7)).toBe(420);
    });

    it("43–46. Acute & Chronic Load, ACWR and Injury Risk", () => {
      const loads = [400, 400, 400, 400, 400, 400, 400]; // 2800 acute
      const acute = acuteWorkload7Day(loads);
      const chronic = 2800;
      const acwr = acuteToChronicWorkloadRatio(acute, chronic);
      expect(acwr).toBe(1.0);
      expect(acwrInjuryRiskZone(acwr).zone).toBe("sweet_spot");
      expect(acwrInjuryRiskZone(1.6).zone).toBe("danger_zone");
    });

    it("47 & 48. Monotony and Strain", () => {
      const monotony = trainingMonotony([300, 300, 300, 300, 300]);
      expect(monotony).toBeGreaterThan(0);
      expect(trainingStrain(1500, monotony)).toBeGreaterThanOrEqual(1500);
    });

    it("49 & 50. Taper curve and Rest day recommendation", () => {
      expect(taperVolumeCurve(80, 14)).toBeLessThan(80);
      expect(restDayRecommendation(4, 1.6).restNeeded).toBe(true);
    });
  });

  // Category 6: Environmental & Weather (Logics 51-60)
  describe("Category 6: Environmental & Weather Impact", () => {
    it("51 & 52. Dew point thermal stress and heat pace penalty", () => {
      expect(dewPointThermalIndex(25, 18)).toBe(43);
      expect(heatPacePenaltyPercent(28, 20)).toBeGreaterThan(5.0);
      expect(heatPacePenaltyPercent(15, 10)).toBe(0);
    });

    it("53. Humidity cooling efficiency", () => {
      const humid = humidityEvaporativeCooling(28, 80);
      expect(humid.coolingEfficiencyPercent).toBeLessThan(60);
    });

    it("54 & 55. Aerodynamic headwind and wind pace adjustments", () => {
      expect(aerodynamicHeadwindLossWatts(5, 5)).toBeGreaterThan(20);
      expect(windPaceAdjustment(300, 20, true)).toBeGreaterThan(300);
      expect(windPaceAdjustment(300, 20, false)).toBeLessThan(300);
    });

    it("56 & 57. Gauteng Highveld Altitude adjustments", () => {
      const altFactor = gautengAltitudeVO2MaxFactor(1600);
      expect(altFactor).toBeLessThan(1.0);
      expect(altitudeToSeaLevelPace(300, 1600)).toBeLessThan(300);
    });

    it("58–60. Wind chill, WBGT flags, and solar load", () => {
      expect(windChillTemperature(5, 30)).toBeLessThan(5);
      expect(wbgtFlagCategory(25).flag).toBe("red");
      expect(solarThermalExposureLoad(8, 12)).toBeGreaterThan(8);
    });
  });

  // Category 7: Biomechanics & Cadence (Logics 61-70)
  describe("Category 7: Biomechanics & Cadence", () => {
    it("61 & 62. Cadence and Stride Length", () => {
      expect(stepCadenceSPM(540, 180)).toBe(180);
      expect(strideLengthM(4.5, 180)).toBe(1.5);
    });

    it("63–66. Cadence rating, overstriding, bounce, and GCT", () => {
      expect(cadenceEfficiencyRating(180).rating).toBe("optimal");
      expect(overstridingBrakingIndex(155, 4.0, 1.70).brakingRisk).toBe("high");
      expect(verticalOscillationRatio(9, 1.5)).toBe(6.0);
      expect(groundContactTimeRating(195).tier).toBe("elite");
    });

    it("67–70. Leg stiffness, economy, asymmetry, and form fatigue", () => {
      expect(legSpringStiffness(65, 0.20, 0.12)).toBeGreaterThan(5.0);
      expect(runningEconomyCalPerKmKg(650, 10, 65)).toBe(1.0);
      expect(strideAsymmetryPercent(210, 215)).toBeLessThan(3);
      expect(formFatigueIndex(180, 165, 240, 270).isFatigued).toBe(true);
    });
  });

  // Category 8: Hydration & Nutrition (Logics 71-80)
  describe("Category 8: Hydration & Nutrition", () => {
    it("71–74. Sweat rate, fluid targets, and dehydration penalty", () => {
      const sweat = hourlySweatRateLiters(70, 69, 0.5, 0, 1.5);
      expect(sweat).toBe(1.0); // (70-69 + 0.5) / 1.5 = 1.0 L/hr
      expect(recommendedFluidIntakePerHour(sweat)).toBe(800);
      expect(bodyMassLossPercentage(70, 68)).toBe(2.9);
      expect(dehydrationPerformancePenalty(2.5).penaltySecPerKm).toBeGreaterThan(0);
    });

    it("75–78. Carbohydrate need, glycogen, sodium, and rehydration", () => {
      expect(carbohydrateNeedPerHour(90)).toBe(30);
      expect(glycogenDepletionRate(60, 0.8)).toBeGreaterThan(150);
      expect(sodiumElectrolyteLossMg(1.5, 800)).toBe(1200);
      expect(postRunRehydrationTargetLiters(1.0)).toBe(1.5);
    });

    it("79 & 80. Caloric expenditure and water station planning", () => {
      expect(grossCaloricExpenditure(70, 10)).toBe(725);
      expect(waterStationPacingStrategy(21, 3).totalStations).toBe(7);
    });
  });

  // Category 9: Demographics & Age Grading (Logics 81-90)
  describe("Category 9: Demographics & Age Grading", () => {
    it("81–83. WMA Age grading, tiers, and open equivalent time", () => {
      const pct = wmaAgeGradedPercentage(1200, 45, "M", 5000);
      expect(pct).toBeGreaterThan(65);
      expect(ageGradedPerformanceTier(pct)).toBeDefined();
      expect(ageGradedOpenEquivalentTime(1200, 45)).toBeLessThan(1200);
    });

    it("84–86. Handicap delay, BMI, and weight pace effect", () => {
      expect(handicapStaggerStartDelay(1500, 1200)).toBe(300);
      expect(bodyMassIndex(65, 1.75)).toBe(21.2);
      expect(weightChangePaceEffect(240, 2)).toBe(245);
    });

    it("87–90. Junior caps, masters recovery, gender, and milestone badges", () => {
      expect(juniorMaxWeeklyMileage(14)).toBe(30);
      expect(mastersRecoveryMultiplier(55)).toBe(1.5);
      expect(genderEquivalentTime(1200, "M")).toBe(1332);
      const badges = checkMilestoneBadges(5000, 1150, 1200);
      expect(badges).toContain("Sub-20 5K");
      expect(badges).toContain("1000km Club Veteran");
    });
  });

  // Category 10: Equipment, Tactics & Safety (Logics 91-100)
  describe("Category 10: Equipment, Team Tactics & Safety", () => {
    it("91 & 92. Shoe wear and foam fatigue", () => {
      expect(shoeMileageWearStatus(300).status).toBe("good");
      expect(shoeMileageWearStatus(750).status).toBe("retired");
      expect(shoeFoamCompressionFatigue(500, 75)).toBeGreaterThan(70);
    });

    it("93–95. Relay acceleration, drafting, and pack cohesion", () => {
      expect(relayExchangeAccelerationCurve(30, 8.5, 8.0).exchangeEfficiencyPercent).toBeGreaterThan(85);
      expect(draftingEnergyBenefitPercent(0.8)).toBe(3.5);
      expect(packCohesionIndex([240, 242, 241, 239]).isTightPack).toBe(true);
    });

    it("96–99. Geofencing, stillness alert, visibility, and bag checklist", () => {
      const p1 = { lat: -25.9967, lon: 28.2000 };
      const p2 = { lat: -25.9968, lon: 28.2001 };
      expect(geofenceDeviationCheck(p1, [p2]).isDeviating).toBe(false);
      expect(emergencyStillnessAlert(200).alertTriggered).toBe(true);
      expect(visibilityRiskLevel(21).highVisibilityRequired).toBe(true);
      expect(raceDayBagChecklist({ bib: true, chip: true, shoes: true, hydration: true, pins: true }).ready).toBe(true);
    });

    it("100. Overall Athletic Readiness Score (ARI)", () => {
      const score = overallAthleticReadinessScore({
        sleepHours: 8,
        restingHR: 48,
        baselineRestingHR: 48,
        sorenessRpe1to10: 2,
        acwr: 1.1,
        hydrationLevel: "good",
      });
      expect(score.score).toBeGreaterThan(90);
      expect(score.status).toBe("Optimal");
    });
  });
});
