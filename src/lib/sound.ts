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
