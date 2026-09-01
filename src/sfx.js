// Tiny WebAudio blips — no assets, created on first user gesture.

let ctx = null;

function beep(freq, dur = 0.12, type = 'sine', gain = 0.08, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  enable() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    ctx?.resume?.();
  },
  plant() { beep(320, 0.1, 'triangle'); beep(420, 0.1, 'triangle', 0.05, 0.06); },
  buy() { beep(660, 0.09, 'square', 0.05); beep(880, 0.11, 'square', 0.04, 0.07); },
  deny() { beep(160, 0.16, 'sawtooth', 0.05); },
  dig() { beep(120, 0.18, 'sawtooth', 0.06); beep(90, 0.22, 'triangle', 0.05, 0.08); },
  harvest(tier = 0) {
    const base = 440 + tier * 40;
    beep(base, 0.1, 'sine', 0.07);
    beep(base * 1.25, 0.1, 'sine', 0.06, 0.07);
    beep(base * 1.5, 0.16, 'sine', 0.06, 0.14);
  },
  pack(tier = 0) {
    const notes = [523, 659, 784, 1046];
    notes.slice(0, 3 + Math.min(1, tier > 3 ? 1 : 0)).forEach((n, i) => beep(n, 0.2, 'triangle', 0.06, i * 0.11));
  },
};
