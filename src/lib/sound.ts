let ctx: AudioContext | undefined;

function getContext(): AudioContext | undefined {
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

/** Short tone through the phone speaker. Fails silently where audio is blocked. */
export function beep(freq = 880, ms = 160, vol = 0.35) {
  try {
    const c = getContext();
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + ms / 1000);
  } catch {
    /* no audio */
  }
}

export function say(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-ZA";
    speechSynthesis.speak(u);
  } catch {
    /* no voice */
  }
}

/** Spoken time: 312000 -> "5 minutes 12 seconds". */
export function spokenTime(ms: number): string {
  const t = Math.round(ms / 1000),
    h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    s = t % 60,
    p = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return [h && p(h, "hour"), m && p(m, "minute"), (s || (!h && !m)) && p(s, "second")].filter(Boolean).join(" ");
}

/** Vibrate device using vibration API if available */
export function vibrate(pattern: number | number[] = [400, 200, 400, 200, 600]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* vibration not supported */
  }
}

/** Energetic morning wake-up chime / race fanfare */
export function playAlarmFanfare() {
  try {
    const c = getContext();
    if (!c) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const startTime = c.currentTime;
    notes.forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.16);
      gain.gain.setValueAtTime(0.35, startTime + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.16 + 0.35);
      osc.connect(gain).connect(c.destination);
      osc.start(startTime + idx * 0.16);
      osc.stop(startTime + idx * 0.16 + 0.38);
    });
  } catch {
    /* audio blocked */
  }
}

/** Alternating two-tone siren */
export function playAlarmSiren() {
  try {
    const c = getContext();
    if (!c) return;
    const startTime = c.currentTime;
    const tones = [880, 660, 880, 660];
    tones.forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.22);
      gain.gain.setValueAtTime(0.25, startTime + idx * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + idx * 0.22 + 0.2);
      osc.connect(gain).connect(c.destination);
      osc.start(startTime + idx * 0.22);
      osc.stop(startTime + idx * 0.22 + 0.21);
    });
  } catch {
    /* audio blocked */
  }
}

/** Pulsing tactical alert tone */
export function playAlarmPulse() {
  try {
    const c = getContext();
    if (!c) return;
    const startTime = c.currentTime;
    [1000, 1000, 1000].forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.15);
      gain.gain.setValueAtTime(0.2, startTime + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.005, startTime + idx * 0.15 + 0.1);
      osc.connect(gain).connect(c.destination);
      osc.start(startTime + idx * 0.15);
      osc.stop(startTime + idx * 0.15 + 0.12);
    });
  } catch {
    /* audio blocked */
  }
}

/** Soft chime sequence */
export function playAlarmChime() {
  try {
    const c = getContext();
    if (!c) return;
    const startTime = c.currentTime;
    const notes = [440, 554.37, 659.25]; // A4, C#5, E5
    notes.forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.2);
      gain.gain.setValueAtTime(0.3, startTime + idx * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.2 + 0.45);
      osc.connect(gain).connect(c.destination);
      osc.start(startTime + idx * 0.2);
      osc.stop(startTime + idx * 0.2 + 0.5);
    });
  } catch {
    /* audio blocked */
  }
}

export function playAlarmTone(tone: "fanfare" | "siren" | "pulse" | "chime") {
  vibrate([300, 150, 300, 150, 450]);
  switch (tone) {
    case "siren":
      playAlarmSiren();
      break;
    case "pulse":
      playAlarmPulse();
      break;
    case "chime":
      playAlarmChime();
      break;
    case "fanfare":
    default:
      playAlarmFanfare();
      break;
  }
}

/** Plays a sweep tone to test speaker / earphone frequency response */
export function playToneSweep(startFreq = 300, endFreq = 1800, durationMs = 800) {
  try {
    const c = getContext();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const startTime = c.currentTime;
    const durSec = durationMs / 1000;

    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + durSec);

    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + durSec);

    osc.connect(gain).connect(c.destination);
    osc.start(startTime);
    osc.stop(startTime + durSec);
  } catch {
    /* audio blocked */
  }
}

/** Starts a repeating loud alarm loop until stopped */
export function startAlarmLoop(tone: "fanfare" | "siren" | "pulse" | "chime" = "fanfare"): () => void {
  playAlarmTone(tone);
  const intervalId = setInterval(() => {
    playAlarmTone(tone);
  }, 2200);

  return () => {
    clearInterval(intervalId);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
  };
}
