let ctx: AudioContext | undefined;
/** Short tone through the phone speaker. Fails silently where audio is blocked. */
export function beep(freq = 880, ms = 160, vol = 0.35) {
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq; g.gain.value = vol;
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch { /* no audio */ }
}
export function say(text: string) {
  try { if (!("speechSynthesis" in window)) return; const u = new SpeechSynthesisUtterance(text); u.lang = "en-ZA"; speechSynthesis.speak(u); } catch { /* no voice */ }
}
/** Spoken time: 312000 -> "5 minutes 12 seconds". */
export function spokenTime(ms: number): string {
  const t = Math.round(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60, p = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return [h && p(h, "hour"), m && p(m, "minute"), (s || (!h && !m)) && p(s, "second")].filter(Boolean).join(" ");
}

/** Energetic morning wake-up chime / race fanfare */
export function playAlarmFanfare() {
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const startTime = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.16);
      gain.gain.setValueAtTime(0.35, startTime + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.16 + 0.35);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(startTime + idx * 0.16);
      osc.stop(startTime + idx * 0.16 + 0.38);
    });
  } catch {
    /* audio blocked */
  }
}
