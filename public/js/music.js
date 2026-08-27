// Dynamic procedural soundtrack (WebAudio — no audio files).
//
// The score is generated live from the theme's scale/tempo and reacts to game
// state through an "intensity" value (0 calm → 1 chase):
//
//   • bass pulse       — always on, tempo follows intensity
//   • arpeggio         — fades in with intensity
//   • pad chords       — always on, darkens with intensity
//   • percussion       — kicks in above ~0.35
//   • heartbeat        — above ~0.7, or when an imposter is near you
//
// Stings (kill, door, meeting, win, lose, revive) duck the music briefly.

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class Music {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.theme = { root: 220, scale: [0, 2, 3, 5, 7, 8, 10], tempo: 96, wave: 'sawtooth' };
    this.intensity = 0;      // target
    this.smoothed = 0;       // eased toward target
    this.step = 0;
    this.timer = null;
    this.chordIdx = 0;
  }

  // Must be called from a user gesture (browsers block audio otherwise).
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.55 : 0;
    this.master.connect(this.ctx.destination);

    // Gentle master compression so stings never clip the mix.
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.ratio.value = 4;
    this.comp.connect(this.master);

    // Per-layer buses
    this.bus = {};
    for (const [name, vol] of [['bass', 0.5], ['arp', 0.0], ['pad', 0.28], ['perc', 0.0], ['heart', 0.0], ['sting', 0.9]]) {
      const g = this.ctx.createGain();
      g.gain.value = vol;
      g.connect(this.comp);
      this.bus[name] = g;
    }

    // Shared reverb-ish delay for atmosphere
    this.delay = this.ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.28;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.3;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.22;
    this.delay.connect(fb); fb.connect(this.delay);
    this.delay.connect(wet); wet.connect(this.comp);
  }

  setTheme(themeMusic) {
    if (themeMusic) this.theme = { ...this.theme, ...themeMusic };
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) {
      this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.1);
    }
  }

  // 0 = calm exploration, 1 = full chase.
  setIntensity(v) { this.intensity = clamp01(v); }

  start() {
    this.init();
    if (!this.ctx || this.started) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.started = true;
    this.step = 0;
    this.scheduleLoop();
  }

  stop() {
    this.started = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  // --- helpers -------------------------------------------------------------
  noteFreq(degree, octave = 0) {
    const s = this.theme.scale;
    const idx = ((degree % s.length) + s.length) % s.length;
    const oct = octave + Math.floor(degree / s.length);
    return this.theme.root * Math.pow(2, (s[idx] + oct * 12) / 12);
  }

  blip(freq, when, dur, { type = 'sine', gain = 0.3, bus = 'arp', detune = 0, glide = 0, echo = false } = {}) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), when + dur);
    if (detune) osc.detune.value = detune;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + Math.min(0.02, dur * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(env);
    env.connect(this.bus[bus] || this.bus.arp);
    if (echo) env.connect(this.delay);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  noise(when, dur, { gain = 0.25, bus = 'perc', hp = 800, lp = 9000 } = {}) {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hpf = this.ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
    const lpf = this.ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp;
    const env = this.ctx.createGain(); env.gain.value = gain;
    src.connect(hpf); hpf.connect(lpf); lpf.connect(env);
    env.connect(this.bus[bus] || this.bus.perc);
    src.start(when);
  }

  // --- the sequencer -------------------------------------------------------
  scheduleLoop() {
    if (!this.started || !this.ctx) return;
    // Ease intensity so transitions are musical, not jumpy.
    this.smoothed += (this.intensity - this.smoothed) * 0.12;
    const I = this.smoothed;

    // Tempo rises with intensity.
    const bpm = this.theme.tempo * (1 + I * 0.45);
    const stepDur = 60 / bpm / 2; // eighth notes
    const t = this.ctx.currentTime + 0.06;
    const s = this.step;

    // Layer volumes follow intensity.
    const set = (name, v) => this.bus[name]?.gain.setTargetAtTime(v, t, 0.25);
    set('bass', 0.34 + I * 0.2);
    set('arp', I < 0.15 ? 0.02 : 0.05 + I * 0.28);
    set('pad', 0.3 - I * 0.12);
    set('perc', I < 0.35 ? 0 : (I - 0.35) * 0.55);
    set('heart', I < 0.7 ? 0 : (I - 0.7) * 1.6);

    // Chord progression: i – VI – III – VII (minor-ish, works in every scale)
    const prog = [0, 5, 2, 6];
    if (s % 8 === 0) this.chordIdx = (this.chordIdx + 1) % prog.length;
    const rootDeg = prog[this.chordIdx];

    // Bass pulse on downbeats
    if (s % 4 === 0) {
      this.blip(this.noteFreq(rootDeg, -2), t, stepDur * 2.4, {
        type: 'triangle', gain: 0.5, bus: 'bass', glide: 0.98,
      });
    }
    // Pad every 8 steps — a sustained two-note chord
    if (s % 8 === 0) {
      for (const d of [rootDeg, rootDeg + 2, rootDeg + 4]) {
        this.blip(this.noteFreq(d, -1), t, stepDur * 7.5, {
          type: 'sine', gain: 0.12, bus: 'pad', detune: (Math.random() - 0.5) * 12, echo: true,
        });
      }
    }
    // Arpeggio — denser and higher as things heat up
    if (I > 0.12) {
      const pattern = [0, 2, 4, 2, 5, 4, 2, 0];
      const deg = rootDeg + pattern[s % pattern.length];
      const oct = I > 0.6 && s % 2 === 1 ? 1 : 0;
      this.blip(this.noteFreq(deg, oct), t, stepDur * 0.85, {
        type: this.theme.wave, gain: 0.16 + I * 0.1, bus: 'arp', echo: I > 0.4,
      });
    }
    // Percussion: kick on 1 & 3, hat on offbeats, snare on 3
    if (I > 0.3) {
      if (s % 4 === 0) this.blip(58, t, 0.16, { type: 'sine', gain: 0.7, bus: 'perc', glide: 0.35 });
      if (s % 2 === 1) this.noise(t, 0.045, { gain: 0.18 + I * 0.12, hp: 5000 });
      if (I > 0.5 && s % 8 === 4) this.noise(t, 0.14, { gain: 0.3, hp: 1200, lp: 6000 });
    }
    // Heartbeat when death is close
    if (I > 0.68 && s % 8 === 0) {
      this.blip(48, t, 0.14, { type: 'sine', gain: 0.9, bus: 'heart', glide: 0.5 });
      this.blip(44, t + 0.22, 0.18, { type: 'sine', gain: 0.7, bus: 'heart', glide: 0.5 });
    }

    this.step = (s + 1) % 64;
    this.timer = setTimeout(() => this.scheduleLoop(), stepDur * 1000);
  }

  // --- one-shot stings -----------------------------------------------------
  sting(kind) {
    this.init();
    if (!this.ctx || !this.enabled) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime + 0.02;
    const B = { bus: 'sting', echo: true };

    switch (kind) {
      case 'kill': // violent downward slash
        this.blip(880, t, 0.5, { type: 'sawtooth', gain: 0.5, glide: 0.12, ...B });
        this.noise(t, 0.35, { gain: 0.4, bus: 'sting', hp: 300, lp: 4000 });
        this.blip(110, t + 0.05, 0.7, { type: 'square', gain: 0.35, glide: 0.5, ...B });
        break;
      case 'death': // you died — long descending drone
        this.blip(330, t, 1.6, { type: 'triangle', gain: 0.4, glide: 0.25, ...B });
        this.blip(220, t + 0.1, 1.8, { type: 'sine', gain: 0.3, glide: 0.3, ...B });
        break;
      case 'door': // bright ascending unlock
        [0, 2, 4, 7].forEach((d, i) =>
          this.blip(this.noteFreq(d, 1), t + i * 0.09, 0.4, { type: 'triangle', gain: 0.32, ...B }));
        break;
      case 'pickup': // collectable grabbed
        [0, 4].forEach((d, i) =>
          this.blip(this.noteFreq(d, 2), t + i * 0.07, 0.22, { type: 'sine', gain: 0.3, ...B }));
        break;
      case 'meeting': // alarm klaxon
        for (let i = 0; i < 3; i++) {
          this.blip(440, t + i * 0.3, 0.16, { type: 'square', gain: 0.35, ...B });
          this.blip(330, t + i * 0.3 + 0.15, 0.16, { type: 'square', gain: 0.35, ...B });
        }
        break;
      case 'revive': // shimmering heal
        [0, 2, 4, 6, 7].forEach((d, i) =>
          this.blip(this.noteFreq(d, 1), t + i * 0.06, 0.5, { type: 'sine', gain: 0.24, ...B }));
        break;
      case 'win':
        [0, 2, 4, 7].forEach((d, i) =>
          this.blip(this.noteFreq(d, 1), t + i * 0.14, 0.7, { type: 'triangle', gain: 0.4, ...B }));
        break;
      case 'lose':
        [7, 4, 2, 0].forEach((d, i) =>
          this.blip(this.noteFreq(d, 0), t + i * 0.18, 0.8, { type: 'triangle', gain: 0.38, glide: 0.9, ...B }));
        break;
      case 'ability':
        this.blip(660, t, 0.3, { type: 'sawtooth', gain: 0.3, glide: 1.6, ...B });
        break;
      case 'task':
        this.blip(this.noteFreq(4, 1), t, 0.18, { type: 'sine', gain: 0.3, ...B });
        this.blip(this.noteFreq(7, 1), t + 0.1, 0.26, { type: 'sine', gain: 0.28, ...B });
        break;
    }
  }
}

export const music = new Music();
