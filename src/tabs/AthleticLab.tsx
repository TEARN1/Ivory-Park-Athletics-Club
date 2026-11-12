import { useMemo, useState } from "react";
import * as AI from "../lib/athleticIntelligence";
import * as S from "../lib/session";

/**
 * Athletic Intelligence & Sports Science Lab
 * Interactive suite for coaches and athletes implementing 100 sports science logics.
 */
export default function AthleticLab() {
  const [activeCategory, setActiveCategory] = useState<
    "pacing" | "vdot" | "altitude" | "elevation" | "heart" | "load" | "hydration" | "biomechanics" | "agegrade" | "readiness"
  >("pacing");

  return (
    <div className="ipac-card" style={{ marginTop: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Athletic Intelligence Lab</h2>
          <p className="ipac-hint" style={{ margin: "2px 0 0" }}>
            100 Sports science algorithms, physiological models, and Highveld pacing engines.
          </p>
        </div>
      </div>

      {/* Category Navigation */}
      <div className="ipac-seg" role="group" aria-label="Sports Science Categories" style={{ marginTop: "12px", overflowX: "auto" }}>
        <button aria-pressed={activeCategory === "pacing"} onClick={() => setActiveCategory("pacing")}>Race Pacing</button>
        <button aria-pressed={activeCategory === "vdot"} onClick={() => setActiveCategory("vdot")}>VDOT Zones</button>
        <button aria-pressed={activeCategory === "altitude"} onClick={() => setActiveCategory("altitude")}>Highveld & Weather</button>
        <button aria-pressed={activeCategory === "elevation"} onClick={() => setActiveCategory("elevation")}>GAP & Hills</button>
        <button aria-pressed={activeCategory === "heart"} onClick={() => setActiveCategory("heart")}>Heart Rate</button>
        <button aria-pressed={activeCategory === "load"} onClick={() => setActiveCategory("load")}>ACWR & Load</button>
        <button aria-pressed={activeCategory === "hydration"} onClick={() => setActiveCategory("hydration")}>Hydration & Fuel</button>
        <button aria-pressed={activeCategory === "biomechanics"} onClick={() => setActiveCategory("biomechanics")}>Biomechanics</button>
        <button aria-pressed={activeCategory === "agegrade"} onClick={() => setActiveCategory("agegrade")}>Age Grade</button>
        <button aria-pressed={activeCategory === "readiness"} onClick={() => setActiveCategory("readiness")}>Readiness ARI</button>
      </div>

      <div style={{ marginTop: "16px" }}>
        {activeCategory === "pacing" && <PacingModule />}
        {activeCategory === "vdot" && <VdotModule />}
        {activeCategory === "altitude" && <AltitudeWeatherModule />}
        {activeCategory === "elevation" && <ElevationGapModule />}
        {activeCategory === "heart" && <HeartRateModule />}
        {activeCategory === "load" && <TrainingLoadModule />}
        {activeCategory === "hydration" && <HydrationNutritionModule />}
        {activeCategory === "biomechanics" && <BiomechanicsModule />}
        {activeCategory === "agegrade" && <AgeGradingModule />}
        {activeCategory === "readiness" && <ReadinessIndexModule />}
      </div>
    </div>
  );
}

/* 1. Race Pacing & Predictor Module */
function PacingModule() {
  const [baseDistM, setBaseDistM] = useState(5000);
  const [baseTimeMin, setBaseTimeMin] = useState(20);
  const [baseTimeSec, setBaseTimeSec] = useState(0);

  const t1Sec = baseTimeMin * 60 + baseTimeSec;

  const predictions = useMemo(() => {
    if (t1Sec <= 0) return null;
    const targets = [
      { name: "5K", dist: 5000 },
      { name: "10K", dist: 10000 },
      { name: "21.1K Half", dist: 21097.5 },
      { name: "42.2K Marathon", dist: 42195 },
      { name: "Comrades (89K)", dist: 89000 },
    ];

    return targets.map((tg) => {
      const riegel = AI.riegelRacePredictor(baseDistM, t1Sec, tg.dist);
      const cameron = AI.cameronRacePredictor(baseDistM, t1Sec, tg.dist);
      const evenPace = tg.dist > 0 ? riegel / (tg.dist / 1000) : 0;
      return {
        name: tg.name,
        riegelFmt: S.fmtTime(riegel * 1000),
        cameronFmt: S.fmtTime(cameron * 1000),
        paceFmt: S.fmtPace(evenPace),
      };
    });
  }, [baseDistM, t1Sec]);

  const marathonSec = useMemo(() => AI.riegelRacePredictor(baseDistM, t1Sec, 42195), [t1Sec, baseDistM]);
  const comradesUp = useMemo(() => AI.comradesMarathonAdjuster(marathonSec, "up"), [marathonSec]);
  const comradesDown = useMemo(() => AI.comradesMarathonAdjuster(marathonSec, "down"), [marathonSec]);

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>Race Time Predictor & Split Calculator</h3>
      <p className="ipac-hint">Riegel and Cameron non-linear physiological models with Comrades Marathon adjustments.</p>
      <div className="ipac-grid3">
        <label>Baseline Distance
          <select value={baseDistM} onChange={(e) => setBaseDistM(+e.target.value)}>
            <option value={3000}>3,000 m (Track)</option>
            <option value={5000}>5,000 m (5 km)</option>
            <option value={10000}>10,000 m (10 km)</option>
            <option value={21097.5}>21.1 km (Half Marathon)</option>
            <option value={42195}>42.2 km (Marathon)</option>
          </select>
        </label>
        <label>Minutes<input type="number" min={5} max={300} value={baseTimeMin} onChange={(e) => setBaseTimeMin(+e.target.value)} /></label>
        <label>Seconds<input type="number" min={0} max={59} value={baseTimeSec} onChange={(e) => setBaseTimeSec(+e.target.value)} /></label>
      </div>

      {predictions && (
        <div className="ipac-tk-table-wrap" style={{ marginTop: "12px" }}>
          <table className="ipac-tk-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Riegel Predictor</th>
                <th>Cameron Model</th>
                <th>Average Pace</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => (
                <tr key={p.name}>
                  <td><b>{p.name}</b></td>
                  <td><b>{p.riegelFmt}</b></td>
                  <td>{p.cameronFmt}</td>
                  <td>{p.paceFmt}/km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ipac-row2" style={{ marginTop: "12px" }}>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Comrades Up Run Projection</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.05rem", fontWeight: 800, color: "var(--color-hot)" }}>
            {comradesUp.formatted}
          </p>
          <small className="ipac-hint">Durban to Pietermaritzburg (+2150m climb)</small>
        </div>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Comrades Down Run Projection</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.05rem", fontWeight: 800, color: "var(--color-navy)" }}>
            {comradesDown.formatted}
          </p>
          <small className="ipac-hint">Pietermaritzburg to Durban (quadriceps braking load)</small>
        </div>
      </div>
    </div>
  );
}

/* 2. Jack Daniels VDOT & Pace Zones Module */
function VdotModule() {
  const [distM, setDistM] = useState(5000);
  const [timeMin, setTimeMin] = useState(21);
  const [timeSec, setTimeSec] = useState(30);

  const tSec = timeMin * 60 + timeSec;
  const vdot = useMemo(() => (tSec > 0 ? AI.calculateVDOT(distM, tSec) : 40), [distM, tSec]);
  const zones = useMemo(() => ({
    easyPace: AI.danielsEasyPace(vdot).formatted,
    marathonPace: S.fmtPace(AI.danielsMarathonPace(vdot)),
    thresholdPace: S.fmtPace(AI.danielsThresholdPace(vdot)),
    intervalPace: S.fmtPace(AI.danielsIntervalPace(vdot)),
    repetitionPace: S.fmtPace(AI.danielsRepetitionPace(vdot)),
  }), [vdot]);

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>Jack Daniels VDOT & Training Paces</h3>
      <p className="ipac-hint">Exact physiological training zones based on your current aerobic capacity.</p>
      <div className="ipac-grid3">
        <label>Race Distance
          <select value={distM} onChange={(e) => setDistM(+e.target.value)}>
            <option value={5000}>5 km Time Trial</option>
            <option value={10000}>10 km Road Race</option>
            <option value={21097.5}>21.1 km Half</option>
            <option value={42195}>42.2 km Marathon</option>
          </select>
        </label>
        <label>Minutes<input type="number" min={10} max={300} value={timeMin} onChange={(e) => setTimeMin(+e.target.value)} /></label>
        <label>Seconds<input type="number" min={0} max={59} value={timeSec} onChange={(e) => setTimeSec(+e.target.value)} /></label>
      </div>

      <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
        <span className="ipac-rank-badge" style={{ fontSize: "1.1rem", padding: "4px 14px" }}>
          VDOT {vdot.toFixed(1)}
        </span>
        <span className="ipac-hint">VO2max Aerobic Capacity index</span>
      </div>

      <div className="ipac-tk-table-wrap" style={{ marginTop: "12px" }}>
        <table className="ipac-tk-table">
          <thead>
            <tr>
              <th>Training Zone</th>
              <th>Intensity</th>
              <th>Target Pace</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Easy (E-Pace)</b></td>
              <td>65 - 79% HRmax</td>
              <td><b>{zones.easyPace}/km</b></td>
              <td>Aerobic base, mitochondrial development, recovery</td>
            </tr>
            <tr>
              <td><b>Marathon (M-Pace)</b></td>
              <td>80 - 89% HRmax</td>
              <td><b>{zones.marathonPace}/km</b></td>
              <td>Lactate clearance, marathon race-pace confidence</td>
            </tr>
            <tr>
              <td><b>Threshold (T-Pace)</b></td>
              <td>88 - 92% HRmax</td>
              <td><b>{zones.thresholdPace}/km</b></td>
              <td>Lactate turnpoint, sustainable 60-min pace</td>
            </tr>
            <tr>
              <td><b>Interval (I-Pace)</b></td>
              <td>97 - 100% HRmax</td>
              <td><b>{zones.intervalPace}/km</b></td>
              <td>VO2max expansion, stroke volume optimization</td>
            </tr>
            <tr>
              <td><b>Repetition (R-Pace)</b></td>
              <td>Anaerobic</td>
              <td><b>{zones.repetitionPace}/km</b></td>
              <td>Running economy, neuromuscular cadence, speed</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* 3. Highveld Altitude & Weather Adjuster */
function AltitudeWeatherModule() {
  const [seaPaceMin, setSeaPaceMin] = useState(4);
  const [seaPaceSec, setSeaPaceSec] = useState(30);
  const [altitudeM, setAltitudeM] = useState(1600); // Ivory Park Highveld
  const [tempC, setTempC] = useState(26);
  const [humidityPct, setHumidityPct] = useState(65);
  const [headwindMs, setHeadwindMs] = useState(4.0);

  const seaPaceTotal = seaPaceMin * 60 + seaPaceSec;
  const highveldPaceSec = useMemo(() => seaPaceTotal / AI.gautengAltitudeVO2MaxFactor(altitudeM), [seaPaceTotal, altitudeM]);
  const heatPenaltyPct = useMemo(() => AI.heatPacePenaltyPercent(tempC, tempC - (100 - humidityPct) / 5), [tempC, humidityPct]);
  const adjustedWeatherPaceSec = useMemo(() => highveldPaceSec * (1 + heatPenaltyPct / 100), [highveldPaceSec, heatPenaltyPct]);
  const windPenaltySec = useMemo(() => AI.windPaceAdjustment(highveldPaceSec, headwindMs * 3.6, true) - highveldPaceSec, [highveldPaceSec, headwindMs]);
  const wbgt = useMemo(() => AI.wbgtFlagCategory(tempC * 0.7 + humidityPct * 0.1), [tempC, humidityPct]);

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>Gauteng Highveld Altitude & Thermal Strain Engine</h3>
      <p className="ipac-hint">Adjusts sea-level marathon paces for 1,600m Highveld altitude, heat, humidity, and headwinds.</p>
      <div className="ipac-grid3">
        <label>Sea-Level Pace (Min/km)
          <div className="ipac-row2" style={{ gap: "4px" }}>
            <input type="number" min={2} max={10} value={seaPaceMin} onChange={(e) => setSeaPaceMin(+e.target.value)} />
            <input type="number" min={0} max={59} value={seaPaceSec} onChange={(e) => setSeaPaceSec(+e.target.value)} />
          </div>
        </label>
        <label>Altitude (m)
          <select value={altitudeM} onChange={(e) => setAltitudeM(+e.target.value)}>
            <option value={0}>Sea Level (Durban / Cape Town 0m)</option>
            <option value={1400}>Pretoria (1,400m)</option>
            <option value={1600}>Ivory Park / Midrand (1,600m)</option>
            <option value={1753}>Johannesburg CBD (1,753m)</option>
          </select>
        </label>
        <label>Ambient Temp (°C)<input type="number" min={5} max={45} value={tempC} onChange={(e) => setTempC(+e.target.value)} /></label>
      </div>

      <div className="ipac-grid3" style={{ marginTop: "8px" }}>
        <label>Relative Humidity (%)<input type="number" min={10} max={100} value={humidityPct} onChange={(e) => setHumidityPct(+e.target.value)} /></label>
        <label>Headwind (m/s)<input type="number" min={0} max={25} step="0.5" value={headwindMs} onChange={(e) => setHeadwindMs(+e.target.value)} /></label>
        <label>WBGT Risk Level
          <input readOnly value={`${wbgt.flag.toUpperCase()} Flag`} style={{ fontWeight: 700 }} />
        </label>
      </div>

      <div className="ipac-row2" style={{ marginTop: "12px" }}>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Altitude-Adjusted Pace</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--color-navy)" }}>
            {S.fmtPace(highveldPaceSec)} /km
          </p>
          <small className="ipac-hint">+{Math.round(highveldPaceSec - seaPaceTotal)}s/km vs sea-level baseline</small>
        </div>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Weather & Heat Combined Pace</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--color-hot)" }}>
            {S.fmtPace(adjustedWeatherPaceSec + windPenaltySec)} /km
          </p>
          <small className="ipac-hint">+{heatPenaltyPct.toFixed(1)}% thermal slowdown + {windPenaltySec.toFixed(1)}s wind cost</small>
        </div>
      </div>
    </div>
  );
}

/* 4. Elevation, Grade-Adjusted Pace (GAP) & Minetti Cost */
function ElevationGapModule() {
  const [paceMin, setPaceMin] = useState(4);
  const [paceSec, setPaceSec] = useState(45);
  const [gradePct, setGradePct] = useState(6.0);
  const [climbM, setClimbM] = useState(150);
  const [climbDurationMin, setClimbDurationMin] = useState(15);

  const flatPaceSec = paceMin * 60 + paceSec;
  const gradeFraction = gradePct / 100;
  const gapPaceSec = useMemo(() => AI.gradeAdjustedPace(flatPaceSec, gradeFraction), [flatPaceSec, gradeFraction]);
  const eqFlatDistM = useMemo(() => AI.elevationEquivalentDistance(climbM), [climbM]);
  const vamScore = useMemo(() => AI.verticalAscentSpeedVAM(climbM, climbDurationMin * 60), [climbM, climbDurationMin]);

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>Minetti Grade-Adjusted Pace (GAP) & Climb Power</h3>
      <p className="ipac-hint">Calculates physiological effort equivalent using Minetti's polynomial energy cost of uphill/downhill running.</p>
      <div className="ipac-grid3">
        <label>Running Pace
          <div className="ipac-row2" style={{ gap: "4px" }}>
            <input type="number" min={2} max={12} value={paceMin} onChange={(e) => setPaceMin(+e.target.value)} />
            <input type="number" min={0} max={59} value={paceSec} onChange={(e) => setPaceSec(+e.target.value)} />
          </div>
        </label>
        <label>Slope Gradient (%)<input type="number" min={-25} max={30} step="0.5" value={gradePct} onChange={(e) => setGradePct(+e.target.value)} /></label>
        <label>Elevation Gain (m)<input type="number" min={0} max={2000} value={climbM} onChange={(e) => setClimbM(+e.target.value)} /></label>
      </div>

      <div className="ipac-row2" style={{ marginTop: "12px" }}>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Grade-Adjusted Pace (GAP)</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--color-hot)" }}>
            {S.fmtPace(gapPaceSec)} /km
          </p>
          <small className="ipac-hint">Equivalent flat-ground effort for {gradePct >= 0 ? `+${gradePct}% climb` : `${gradePct}% descent`}</small>
        </div>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>VAM Ascent Velocity</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--color-navy)" }}>
            {Math.round(vamScore)} VAM (m/h)
          </p>
          <small className="ipac-hint">1 km run with +{climbM}m gain = {(eqFlatDistM / 1000).toFixed(2)} km flat effort</small>
        </div>
      </div>
    </div>
  );
}

/* 5. Heart Rate Dynamics & Karvonen Zones */
function HeartRateModule() {
  const [age, setAge] = useState(25);
  const [restHR, setRestHR] = useState(52);
  const [peakHR, setPeakHR] = useState(182);
  const [recoveryHR, setRecoveryHR] = useState(150);

  const tanakaMax = useMemo(() => AI.tanakaMaxHR(age), [age]);
  const zones = useMemo(() => ({
    z1: AI.zone1ActiveRecovery(restHR, tanakaMax),
    z2: AI.zone2AerobicBase(restHR, tanakaMax),
    z3: AI.zone3Tempo(restHR, tanakaMax),
    z4: AI.zone4LactateThreshold(restHR, tanakaMax),
    z5: AI.zone5VO2Max(restHR, tanakaMax),
  }), [tanakaMax, restHR]);
  const recoveryIndex = useMemo(() => AI.heartRateRecoveryIndex(peakHR, recoveryHR), [peakHR, recoveryHR]);

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>Heart Rate Dynamics & Karvonen Zones</h3>
      <p className="ipac-hint">Tanaka formula, Heart Rate Reserve (HRR) zones, and 60-second autonomic cardiac recovery index.</p>
      <div className="ipac-grid3">
        <label>Age<input type="number" min={12} max={90} value={age} onChange={(e) => setAge(+e.target.value)} /></label>
        <label>Resting HR (bpm)<input type="number" min={35} max={100} value={restHR} onChange={(e) => setRestHR(+e.target.value)} /></label>
        <label>Calculated Tanaka Max HR<input readOnly value={`${tanakaMax} bpm`} style={{ fontWeight: 700 }} /></label>
      </div>

      <div className="ipac-grid2" style={{ marginTop: "8px" }}>
        <label>Peak HR at Finish<input type="number" min={100} max={220} value={peakHR} onChange={(e) => setPeakHR(+e.target.value)} /></label>
        <label>HR 60s Post-Finish<input type="number" min={80} max={200} value={recoveryHR} onChange={(e) => setRecoveryHR(+e.target.value)} /></label>
      </div>

      <div className="ipac-card" style={{ padding: "10px", margin: "10px 0" }}>
        <b>60-Second Cardiac Recovery: {recoveryIndex.dropBpm} bpm drop</b>
        <span className="ipac-rank-badge" style={{ marginLeft: "10px" }}>{recoveryIndex.fitnessTier.toUpperCase()}</span>
        <p className="ipac-hint" style={{ margin: "4px 0 0" }}>High drop rate reflects strong parasympathetic vagal tone and rapid metabolic clearance.</p>
      </div>

      <div className="ipac-tk-table-wrap" style={{ marginTop: "10px" }}>
        <table className="ipac-tk-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Intensity</th>
              <th>Heart Rate Range</th>
              <th>Physiological Adaption</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><b>Zone 1 (Recovery)</b></td><td>50 - 60% HRR</td><td>{zones.z1.min} - {zones.z1.max} bpm</td><td>Active recovery, fat oxidation</td></tr>
            <tr><td><b>Zone 2 (Aerobic Base)</b></td><td>60 - 70% HRR</td><td>{zones.z2.min} - {zones.z2.max} bpm</td><td>Mitochondrial density, capillary beds</td></tr>
            <tr><td><b>Zone 3 (Tempo)</b></td><td>70 - 80% HRR</td><td>{zones.z3.min} - {zones.z3.max} bpm</td><td>Aerobic capacity, glycogen efficiency</td></tr>
            <tr><td><b>Zone 4 (Threshold)</b></td><td>80 - 90% HRR</td><td>{zones.z4.min} - {zones.z4.max} bpm</td><td>Lactate threshold, maximum steady state</td></tr>
            <tr><td><b>Zone 5 (VO2max)</b></td><td>90 - 100% HRR</td><td>{zones.z5.min} - {zones.z5.max} bpm</td><td>Maximum aerobic power, anaerobic tolerance</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* 6. Training Load & ACWR (Injury Prevention) */
function TrainingLoadModule() {
  const [acuteLoad, setAcuteLoad] = useState(480);
  const [chronicLoad, setChronicLoad] = useState(420);

  const acwrResult = useMemo(() => {
    const acwr = AI.acuteToChronicWorkloadRatio(acuteLoad, chronicLoad);
    return { acwr, zone: AI.acwrInjuryRiskZone(acwr).zone };
  }, [acuteLoad, chronicLoad]);

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>Acute:Chronic Workload Ratio (ACWR)</h3>
      <p className="ipac-hint">Gabbett's sports medicine injury prevention model comparing 7-day fatigue against 28-day chronic fitness.</p>
      <div className="ipac-grid2">
        <label>Acute Load (7-Day Fatigue AU)<input type="number" min={50} max={2000} value={acuteLoad} onChange={(e) => setAcuteLoad(+e.target.value)} /></label>
        <label>Chronic Load (28-Day Fitness AU)<input type="number" min={50} max={2000} value={chronicLoad} onChange={(e) => setChronicLoad(+e.target.value)} /></label>
      </div>

      <div className="ipac-row2" style={{ marginTop: "12px" }}>
        <div className="ipac-card" style={{ padding: "12px", margin: 0 }}>
          <b>ACWR Ratio</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800, color: acwrResult.acwr > 1.5 ? "var(--color-hot)" : "var(--color-navy)" }}>
            {acwrResult.acwr.toFixed(2)}
          </p>
          <span className="ipac-rank-badge" style={{ marginTop: "6px" }}>{acwrResult.zone.toUpperCase()} ZONE</span>
        </div>
        <div className="ipac-card" style={{ padding: "12px", margin: 0 }}>
          <b>Injury Risk Guidance</b>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
            {acwrResult.zone === "sweet_spot"
              ? "Optimal adaptation zone (0.8 - 1.3). Low injury risk while progressively building cardiovascular fitness."
              : acwrResult.zone === "danger_zone"
              ? "Danger zone (> 1.5). Sharp workload spike. High risk of soft-tissue and overuse injury. Coach should reduce weekly mileage."
              : acwrResult.zone === "undertraining"
              ? "Under-trained (< 0.8). Fitness decay. Safe to gradually step up training volume."
              : "Elevated risk zone (1.3 - 1.5). Monitor recovery and soreness closely."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* 7. Hydration, Electrolytes & Nutrition */
function HydrationNutritionModule() {
  const [preKg, setPreKg] = useState(65.0);
  const [postKg, setPostKg] = useState(63.8);
  const [fluidL, setFluidL] = useState(0.75);
  const [hours, setHours] = useState(1.5);

  const sweatRate = useMemo(() => AI.hourlySweatRateLiters(preKg, postKg, fluidL, 0, hours), [preKg, postKg, fluidL, hours]);
  const massLossPct = useMemo(() => ((preKg - postKg) / preKg) * 100, [preKg, postKg]);
  const penalty = useMemo(() => AI.dehydrationPerformancePenalty(massLossPct), [massLossPct]);
  const carbs = useMemo(() => AI.carbohydrateNeedPerHour(hours * 60), [hours]);
  const sodium = useMemo(() => AI.sodiumElectrolyteLossMg(sweatRate * hours), [sweatRate, hours]);

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>Hydration & Race Day Nutrition Planner</h3>
      <p className="ipac-hint">Calculate sweat rate, fluid replacement targets, electrolyte losses, and hourly carbohydrate fueling.</p>
      <div className="ipac-grid3">
        <label>Pre-Run Weight (kg)<input type="number" step="0.1" value={preKg} onChange={(e) => setPreKg(+e.target.value)} /></label>
        <label>Post-Run Weight (kg)<input type="number" step="0.1" value={postKg} onChange={(e) => setPostKg(+e.target.value)} /></label>
        <label>Fluids Consumed (L)<input type="number" step="0.1" value={fluidL} onChange={(e) => setFluidL(+e.target.value)} /></label>
      </div>

      <div className="ipac-row2" style={{ marginTop: "12px" }}>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Hourly Sweat Rate</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--color-navy)" }}>
            {sweatRate.toFixed(2)} L/hr
          </p>
          <small className="ipac-hint">Total sweat loss: {(sweatRate * hours).toFixed(2)} Litres</small>
        </div>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Dehydration Pace Penalty</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--color-hot)" }}>
            +{penalty.penaltySecPerKm.toFixed(1)}s/km ({massLossPct.toFixed(1)}% body mass loss)
          </p>
          <small className="ipac-hint">Recommended sodium replacement: {Math.round(sodium)} mg</small>
        </div>
      </div>

      <div className="ipac-card" style={{ padding: "10px", marginTop: "10px" }}>
        <b>Carbohydrate Fueling: {carbs} g/hr</b>
        <p className="ipac-hint" style={{ margin: "4px 0 0" }}>Gut-absorption target for this duration.</p>
      </div>
    </div>
  );
}

/* 8. Biomechanics & Cadence Module */
function BiomechanicsModule() {
  const [steps, setSteps] = useState(1050);
  const [durationMin, setDurationMin] = useState(6.0);
  const [speedMs, setSpeedMs] = useState(3.8);
  const [heightM, setHeightM] = useState(1.75);

  const cadence = useMemo(() => AI.stepCadenceSPM(steps, durationMin * 60), [steps, durationMin]);
  const strideM = useMemo(() => AI.strideLengthM(speedMs, cadence), [speedMs, cadence]);
  const overstriding = useMemo(() => AI.overstridingBrakingIndex(cadence, speedMs, heightM), [cadence, speedMs, heightM]);

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>Biomechanics & Overstriding Analysis</h3>
      <p className="ipac-hint">Analyze step cadence, stride length, ground contact braking, and vertical bounce efficiency.</p>
      <div className="ipac-grid3">
        <label>Total Steps<input type="number" value={steps} onChange={(e) => setSteps(+e.target.value)} /></label>
        <label>Duration (Minutes)<input type="number" step="0.5" value={durationMin} onChange={(e) => setDurationMin(+e.target.value)} /></label>
        <label>Runner Height (m)<input type="number" step="0.01" value={heightM} onChange={(e) => setHeightM(+e.target.value)} /></label>
      </div>

      <div className="ipac-row2" style={{ marginTop: "12px" }}>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Step Cadence</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--color-navy)" }}>
            {Math.round(cadence)} SPM
          </p>
          <small className="ipac-hint">Stride length: {strideM.toFixed(2)} m</small>
        </div>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Overstriding Braking Risk</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: overstriding.brakingRisk === "high" ? "var(--color-hot)" : "var(--color-navy)" }}>
            {overstriding.brakingRisk.toUpperCase()}
          </p>
          <small className="ipac-hint">Stride/height ratio {overstriding.strideToHeightRatio.toFixed(2)}</small>
        </div>
      </div>
    </div>
  );
}

/* 9. WMA Age Grading & Club Handicap */
function AgeGradingModule() {
  const [age, setAge] = useState(38);
  const [gender, setGender] = useState<"M" | "F">("M");
  const [distM, setDistM] = useState(10000);
  const [timeMin, setTimeMin] = useState(38);
  const [timeSec, setTimeSec] = useState(15);

  const tSec = timeMin * 60 + timeSec;
  const pct = useMemo(() => AI.wmaAgeGradedPercentage(tSec, age, gender, distM), [tSec, age, gender, distM]); const ageGrade = { percentage: pct, tier: AI.ageGradedPerformanceTier(pct) };

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>WMA Age Grading & Performance Tier</h3>
      <p className="ipac-hint">World Masters Athletics standards: benchmark your time regardless of age or gender.</p>
      <div className="ipac-grid3">
        <label>Age<input type="number" min={12} max={95} value={age} onChange={(e) => setAge(+e.target.value)} /></label>
        <label>Gender
          <select value={gender} onChange={(e) => setGender(e.target.value as "M" | "F")}>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </label>
        <label>Distance
          <select value={distM} onChange={(e) => setDistM(+e.target.value)}>
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
            <option value={21097.5}>21.1 km Half</option>
            <option value={42195}>42.2 km Marathon</option>
          </select>
        </label>
      </div>

      <div className="ipac-row2" style={{ marginTop: "12px" }}>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Age-Graded Score</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.3rem", fontWeight: 800, color: "var(--color-navy)" }}>
            {ageGrade.percentage.toFixed(1)}%
          </p>
          <span className="ipac-rank-badge" style={{ marginTop: "4px" }}>{ageGrade.tier.toUpperCase()} TIER</span>
        </div>
        <div className="ipac-card" style={{ padding: "10px", margin: 0 }}>
          <b>Benchmark Standard</b>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
            {ageGrade.percentage >= 90
              ? "World Class standard (>90%). Elite international qualification standard."
              : ageGrade.percentage >= 80
              ? "National Class standard (80-89%). Competitive nationally in South Africa."
              : ageGrade.percentage >= 70
              ? "Regional Class standard (70-79%). Leading club podium contender."
              : "Local club competitive level (60-69%)."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* 10. Athletic Readiness Index (ARI 1–100) */
function ReadinessIndexModule() {
  const [sleepHours, setSleepHours] = useState(7.5);
  const [restHR, setRestHR] = useState(55);
  const [soreness, setSoreness] = useState(3);
  const [acwrIn, setAcwrIn] = useState(1.0);
  const [hydration, setHydration] = useState<"good" | "fair" | "poor">("good");

  const ari0 = useMemo(() => AI.overallAthleticReadinessScore({ sleepHours, restingHR: restHR, baselineRestingHR: 52, sorenessRpe1to10: soreness, acwr: acwrIn, hydrationLevel: hydration }), [sleepHours, restHR, soreness, acwrIn, hydration]);
  const ari = { ...ari0, recommendation: ari0.status === "Optimal" ? "Prime state. Go hard." : ari0.status === "Ready" ? "Good. Normal training." : ari0.status === "Fatigued" ? "Keep it easy today." : "Rest day." };

  return (
    <div className="ipac-form">
      <h3 style={{ margin: "0 0 6px" }}>Daily Athletic Readiness Index (ARI)</h3>
      <p className="ipac-hint">Scores systemic recovery across sleep, autonomic stress, and musculoskeletal soreness.</p>
      <div className="ipac-grid3">
        <label>Sleep Duration (Hours)<input type="number" step="0.5" min={3} max={12} value={sleepHours} onChange={(e) => setSleepHours(+e.target.value)} /></label>
        <label>Resting HR<input type="number" min={35} max={100} value={restHR} onChange={(e) => setRestHR(+e.target.value)} /></label>
        <label>Soreness (1-10)<input type="number" min={1} max={10} value={soreness} onChange={(e) => setSoreness(+e.target.value)} /></label>
      </div>

      <div className="ipac-grid2" style={{ marginTop: "8px" }}>
        <label>ACWR<input type="number" step="0.1" min={0} max={3} value={acwrIn} onChange={(e) => setAcwrIn(+e.target.value)} /></label>
        <label>Hydration<select value={hydration} onChange={(e) => setHydration(e.target.value as "good" | "fair" | "poor")}><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option></select></label>
      </div>

      <div className="ipac-row2" style={{ marginTop: "12px" }}>
        <div className="ipac-card" style={{ padding: "12px", margin: 0 }}>
          <b>Readiness Score</b>
          <p style={{ margin: "4px 0 0", fontSize: "1.4rem", fontWeight: 800, color: ari.score >= 80 ? "#059669" : ari.score >= 60 ? "var(--color-navy)" : "var(--color-hot)" }}>
            {ari.score} / 100
          </p>
          <span className="ipac-rank-badge" style={{ marginTop: "4px" }}>{ari.status.toUpperCase()}</span>
        </div>
        <div className="ipac-card" style={{ padding: "12px", margin: 0 }}>
          <b>Training Prescription</b>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", fontWeight: 600 }}>
            {ari.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}
