// Nine self-contained generative tracks. Pure Web Audio, no files.
// Each generator wires itself into `out` and returns a stop function.
import type { TrackId } from "./tracks";

export type StopFn = () => void;
export type NoiseKind = "white" | "pink" | "brown";
export type Noise = (k: NoiseKind) => AudioBuffer;
export type Generator = (ctx: AudioContext, out: AudioNode, noise: Noise) => StopFn;

export function makeNoiseBuffer(ctx: BaseAudioContext, kind: NoiseKind, seconds = 3) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w;
    else if (kind === "pink") {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

/** Collects everything a track creates so stop() tears it all down. */
class Rig {
  nodes: AudioScheduledSourceNode[] = [];
  timers: number[] = [];
  extra: AudioNode[] = [];
  bus: GainNode;
  constructor(public ctx: AudioContext, out: AudioNode, gain = 1) {
    this.bus = ctx.createGain();
    this.bus.gain.value = gain;
    this.bus.connect(out);
    this.extra.push(this.bus);
  }
  src<T extends AudioScheduledSourceNode>(n: T): T {
    n.start();
    this.nodes.push(n);
    return n;
  }
  loop(buf: AudioBuffer) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = 0;
    return this.src(s);
  }
  filter(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
  gain(v: number) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }
  /** Slow LFO modulating an AudioParam. */
  lfo(param: AudioParam, rate: number, depth: number, type: OscillatorType = "sine") {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = rate;
    const g = this.gain(depth);
    o.connect(g).connect(param);
    return this.src(o);
  }
  every(ms: number, fn: () => void) {
    this.timers.push(window.setInterval(fn, ms));
  }
  /** Look-ahead step sequencer, robust to timer jitter. */
  seq(bpm: number, stepsPerBeat: number, onStep: (step: number, t: number, dur: number) => void) {
    const ctx = this.ctx;
    const dur = 60 / bpm / stepsPerBeat;
    let next = ctx.currentTime + 0.08;
    let step = 0;
    const tick = () => {
      if (next < ctx.currentTime - 0.25) next = ctx.currentTime + 0.05; // resumed after a stall
      while (next < ctx.currentTime + 0.6) {
        onStep(step, next, dur);
        next += dur;
        step++;
      }
    };
    tick();
    this.every(120, tick);
  }
  /** Feedback echo; returns its input node. Wet output goes to `dest`. */
  delay(dest: AudioNode, time: number, feedback: number, wet: number, tone = 2400) {
    const ctx = this.ctx;
    const input = ctx.createGain();
    const d = ctx.createDelay(2);
    d.delayTime.value = time;
    const fb = this.gain(feedback);
    const lp = this.filter("lowpass", tone);
    const w = this.gain(wet);
    input.connect(d);
    d.connect(lp).connect(fb).connect(d);
    lp.connect(w).connect(dest);
    this.extra.push(input, d, fb, lp, w);
    return input;
  }
  stop: StopFn = () => {
    this.timers.forEach((t) => window.clearInterval(t));
    this.nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    });
    this.extra.forEach((n) => n.disconnect());
  };
}

// ---------- one-shot voices (all self-stopping) ----------

function env(ctx: AudioContext, t: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function kick(ctx: AudioContext, dest: AudioNode, t: number, vol = 0.5) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = env(ctx, t, vol, 0.004, 0.32);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.4);
}

function noiseHit(
  ctx: AudioContext, dest: AudioNode, buf: AudioBuffer, t: number,
  type: BiquadFilterType, freq: number, vol: number, decay: number, q = 0.8,
) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = env(ctx, t, vol, 0.002, decay);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 2, decay + 0.05);
}

function snare(ctx: AudioContext, dest: AudioNode, noise: Noise, t: number, vol = 0.25) {
  noiseHit(ctx, dest, noise("white"), t, "bandpass", 1900, vol, 0.17, 0.7);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(210, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  const g = env(ctx, t, vol * 0.5, 0.002, 0.08);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.12);
}

const hat = (ctx: AudioContext, dest: AudioNode, noise: Noise, t: number, vol = 0.06, open = false) =>
  noiseHit(ctx, dest, noise("white"), t, "highpass", 7500, vol, open ? 0.16 : 0.035);

/** Soft electric-piano note: sine + quiet octave, slow decay, tape-ish detune. */
function keys(ctx: AudioContext, dest: AudioNode, t: number, midi: number, vol: number, len = 2.4) {
  const det = rand(-7, 7);
  [
    [1, 1, "sine"],
    [2, 0.22, "sine"],
    [3, 0.06, "triangle"],
  ].forEach(([mult, amp, type]) => {
    const o = ctx.createOscillator();
    o.type = type as OscillatorType;
    o.frequency.value = mtof(midi) * (mult as number);
    o.detune.value = det;
    const g = env(ctx, t, vol * (amp as number), 0.012, len);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + len + 0.1);
  });
}

function pluck(ctx: AudioContext, dest: AudioNode, t: number, midi: number, vol: number, type: OscillatorType = "triangle", decay = 0.5) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = mtof(midi);
  const g = env(ctx, t, vol, 0.004, decay);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + decay + 0.05);
}

function padChord(ctx: AudioContext, dest: AudioNode, t: number, notes: number[], len: number, vol: number, type: OscillatorType = "sawtooth") {
  notes.forEach((n) => {
    [-8, 8].forEach((det) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = mtof(n);
      o.detune.value = det;
      const g = ctx.createGain();
      const a = Math.min(1.5, len * 0.3);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + a);
      g.gain.setValueAtTime(vol, t + len - a);
      g.gain.linearRampToValueAtTime(0, t + len + 0.4);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + len + 0.5);
    });
  });
}

/** Rain on glass: filtered pink bed + rumble + random droplets. */
function rainLayer(r: Rig, noise: Noise, dest: AudioNode, amount = 1, dropEvery = 140) {
  const bed = r.loop(noise("pink"));
  const hp = r.filter("highpass", 380);
  const lp = r.filter("lowpass", 2600);
  bed.connect(hp).connect(lp).connect(r.gain(0.28 * amount)).connect(dest);
  const rumble = r.loop(noise("brown"));
  rumble.connect(r.filter("lowpass", 220)).connect(r.gain(0.14 * amount)).connect(dest);
  const white = noise("white");
  r.every(dropEvery, () => {
    if (Math.random() > 0.55) return;
    noiseHit(r.ctx, dest, white, r.ctx.currentTime + Math.random() * 0.1, "bandpass", rand(2200, 5600), rand(0.04, 0.09) * amount, 0.05, 8);
  });
}

function vinyl(r: Rig, noise: Noise, dest: AudioNode) {
  const hiss = r.loop(noise("white"));
  hiss.connect(r.filter("bandpass", 4200, 0.4)).connect(r.gain(0.008)).connect(dest);
  const white = noise("white");
  r.every(90, () => {
    if (Math.random() > 0.3) return;
    noiseHit(r.ctx, dest, white, r.ctx.currentTime + Math.random() * 0.08, "highpass", 3000, rand(0.02, 0.07), 0.006);
  });
}

// ---------- Cyber-LoFi Beats ----------

/** Tokyo Rain-Slicked Cafe — 72 bpm swung lo-fi, jazzy rhodes, rain + vinyl. */
const tokyoCafe: Generator = (ctx, out, noise) => {
  const r = new Rig(ctx, out, 0.95);
  const drums = r.filter("lowpass", 2800);
  drums.connect(r.gain(0.9)).connect(r.bus);
  const keyBus = r.filter("lowpass", 2200);
  keyBus.connect(r.bus);
  r.lfo(keyBus.frequency, 0.07, 600);
  rainLayer(r, noise, r.bus, 0.55);
  vinyl(r, noise, r.bus);

  const prog = [
    [53, 57, 60, 64], // Fmaj7
    [52, 55, 59, 62], // Em7
    [50, 53, 57, 60], // Dm7
    [48, 52, 55, 59], // Cmaj7
  ];
  r.seq(72, 4, (step, t0, dur) => {
    const s = step % 16;
    const t = s % 2 === 1 ? t0 + dur * 0.2 : t0; // swing
    const bar = Math.floor(step / 16);
    const chord = prog[bar % prog.length]!;
    if (s === 0 || s === 10 || (s === 7 && bar % 2 === 1)) kick(ctx, drums, t, 0.42);
    if (s === 4 || s === 12) snare(ctx, drums, noise, t, 0.16);
    if (s % 2 === 0) hat(ctx, drums, noise, t, s % 4 === 0 ? 0.045 : 0.03);
    else if (Math.random() < 0.25) hat(ctx, drums, noise, t, 0.015);
    if (s === 0) chord.forEach((n, i) => keys(ctx, keyBus, t + i * 0.025, n, 0.05, 2.8));
    if (s === 10 && Math.random() < 0.6) chord.slice(1).forEach((n, i) => keys(ctx, keyBus, t + i * 0.02, n + 12, 0.022, 1.4));
    if (s === 0 || s === 10) pluck(ctx, r.bus, t, chord[0]! - 12, 0.12, "sine", 0.9);
  });
  return r.stop;
};

/** Neon Horizon Shift — 84 bpm synthwave: saw pads, pulsing bass, echo arp. */
const neonHorizon: Generator = (ctx, out, noise) => {
  const r = new Rig(ctx, out, 0.85);
  const drums = r.filter("lowpass", 5000);
  drums.connect(r.bus);
  const padBus = r.filter("lowpass", 1300, 0.9);
  padBus.connect(r.bus);
  r.lfo(padBus.frequency, 0.05, 500);
  const bassBus = r.filter("lowpass", 420, 4);
  bassBus.connect(r.bus);
  const arpEcho = r.delay(r.bus, (60 / 84) * 0.75, 0.42, 0.5);
  const arpBus = r.filter("lowpass", 2600);
  arpBus.connect(r.bus);
  arpBus.connect(arpEcho);

  const prog = [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [48, 52, 55], // C
    [55, 59, 62], // G
  ];
  r.seq(84, 4, (step, t, dur) => {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chord = prog[bar % prog.length]!;
    if (s % 4 === 0) kick(ctx, drums, t, 0.4);
    if (s === 4 || s === 12) snare(ctx, drums, noise, t, 0.13);
    if (s % 4 === 2) hat(ctx, drums, noise, t, 0.03, true);
    if (s === 0) padChord(ctx, padBus, t, chord.map((n) => n - 12).concat(chord[0]!), dur * 16, 0.011);
    if (s % 2 === 0) pluck(ctx, bassBus, t, chord[0]! - 24, 0.16, "sawtooth", dur * 1.8);
    const arp = [0, 1, 2, 1];
    if (bar % 4 !== 3 || s < 8) pluck(ctx, arpBus, t, chord[arp[s % 4]!]! + 12 + (s >= 8 ? 12 : 0), 0.035, "square", 0.18);
  });
  return r.stop;
};

/** Chilled Terminal Echo — 66 bpm minimal beat, echo plucks, soft keystrokes. */
const terminalEcho: Generator = (ctx, out, noise) => {
  const r = new Rig(ctx, out, 1);
  const drums = r.filter("lowpass", 3200);
  drums.connect(r.bus);
  const echo = r.delay(r.bus, (60 / 66) * 0.75, 0.5, 0.55, 1800);
  const plucks = r.filter("lowpass", 3000);
  plucks.connect(r.bus);
  plucks.connect(echo);
  const drone = r.filter("lowpass", 500);
  drone.connect(r.bus);
  const white = noise("white");
  const scale = [62, 65, 67, 69, 72, 74, 77]; // D minor pentatonic

  r.seq(66, 4, (step, t) => {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    if (s === 0 || s === 9) kick(ctx, drums, t, 0.36);
    if (s === 4 || s === 12) noiseHit(ctx, drums, white, t, "bandpass", 3200, 0.09, 0.03, 2);
    if (s % 2 === 0) hat(ctx, drums, noise, t, 0.02);
    if (Math.random() < 0.18) pluck(ctx, plucks, t, pick(scale), 0.06, "sine", 0.7);
    if (Math.random() < 0.22) noiseHit(ctx, r.bus, white, t + rand(0, 0.05), "highpass", 6000, 0.03, 0.008);
    if (s === 0 && bar % 2 === 0) padChord(ctx, drone, t, [38, 45, 53, 57], (60 / 66) * 8, 0.01, "triangle");
  });
  return r.stop;
};

// ---------- Cognitive Alpha Waves ----------

/** Deep Space Alpha Core — 10 Hz binaural offset under a slow cosmic pad. */
const alphaCore: Generator = (ctx, out) => {
  const r = new Rig(ctx, out, 1);
  const merger = ctx.createChannelMerger(2);
  r.extra.push(merger);
  merger.connect(r.gain(0.05)).connect(r.bus);
  [200, 210].forEach((f, ch) => {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(merger, 0, ch);
    r.src(o);
  });
  const pad = r.filter("lowpass", 700);
  pad.connect(r.bus);
  r.lfo(pad.frequency, 0.04, 260);

  const chords = [
    [45, 52, 57, 64],
    [41, 48, 53, 60],
    [43, 50, 55, 62],
    [40, 47, 52, 59],
  ];
  const LEN = 10;
  let i = 0;
  const play = () => {
    const t = ctx.currentTime + 0.05;
    const chord = chords[i % chords.length]!;
    padChord(ctx, pad, t, chord, LEN, 0.012);
    const s = ctx.createOscillator();
    s.frequency.value = mtof(chord[3]! + 12);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, t + 2);
    sg.gain.linearRampToValueAtTime(0.008, t + 4);
    sg.gain.linearRampToValueAtTime(0, t + 8);
    s.connect(sg).connect(r.bus);
    s.start(t + 2);
    s.stop(t + 8.2);
    i++;
  };
  play();
  r.every(LEN * 1000, play);
  return r.stop;
};

/** Data-Stream Static — drifting band noise, hiss, soft telemetry blips. */
const dataStatic: Generator = (ctx, out, noise) => {
  const r = new Rig(ctx, out, 1);
  const bp = r.filter("bandpass", 900, 0.6);
  r.loop(noise("brown")).connect(bp).connect(r.gain(0.33)).connect(r.bus);
  r.lfo(bp.frequency, 0.06, 500);
  r.loop(noise("white")).connect(r.filter("highpass", 5000)).connect(r.gain(0.012)).connect(r.bus);
  r.every(1800, () => {
    if (Math.random() > 0.35) return;
    const base = ctx.currentTime + 0.05;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const t = base + k * 0.07;
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = 1200 + Math.floor(Math.random() * 6) * 220;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.004, t + 0.005);
      g.gain.linearRampToValueAtTime(0, t + 0.04);
      o.connect(g).connect(r.bus);
      o.start(t);
      o.stop(t + 0.05);
    }
  });
  return r.stop;
};

/** Cyber-Grid Metronome — soft 60 bpm tick, 10 Hz isochronic pulse, sub drone. */
const gridMetronome: Generator = (ctx, out, noise) => {
  const r = new Rig(ctx, out, 1);
  // isochronic tone: 220 Hz carrier gated at 10 Hz
  const carrier = r.src(ctx.createOscillator());
  carrier.frequency.value = 220;
  const am = r.gain(0.5);
  r.lfo(am.gain, 10, 0.5);
  carrier.connect(am).connect(r.filter("lowpass", 900)).connect(r.gain(0.05)).connect(r.bus);
  // sub drone + air
  const sub = r.src(ctx.createOscillator());
  sub.frequency.value = 55;
  sub.connect(r.gain(0.05)).connect(r.bus);
  r.loop(noise("brown")).connect(r.filter("lowpass", 400)).connect(r.gain(0.08)).connect(r.bus);
  const white = noise("white");
  r.seq(60, 1, (step, t) => {
    const accent = step % 4 === 0;
    pluck(ctx, r.bus, t, accent ? 98 : 93, accent ? 0.06 : 0.04, "sine", 0.05);
    noiseHit(ctx, r.bus, white, t, "bandpass", accent ? 2600 : 2000, 0.05, 0.025, 3);
  });
  return r.stop;
};

// ---------- Atmospheric Immersion ----------

/** Hover-Car Windshield — rain on glass, engine hum, wipers, passing traffic. */
const hoverCar: Generator = (ctx, out, noise) => {
  const r = new Rig(ctx, out, 0.95);
  rainLayer(r, noise, r.bus, 0.9, 110);
  const eng = r.filter("lowpass", 170, 2);
  eng.connect(r.gain(0.09)).connect(r.bus);
  r.lfo(eng.frequency, 0.03, 40);
  [46, 46.6].forEach((f) => {
    const o = r.src(ctx.createOscillator());
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(eng);
  });
  const hum = r.src(ctx.createOscillator());
  hum.frequency.value = 92;
  hum.connect(r.gain(0.012)).connect(r.bus);

  const pink = noise("pink");
  const wipe = () => {
    const t = ctx.currentTime + 0.05;
    const s = ctx.createBufferSource();
    s.buffer = pink;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(2200, t + 0.45);
    f.frequency.linearRampToValueAtTime(700, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.2);
    g.gain.linearRampToValueAtTime(0.06, t + 0.7);
    g.gain.linearRampToValueAtTime(0, t + 0.95);
    s.connect(f).connect(g).connect(r.bus);
    s.start(t, Math.random(), 1);
    pluck(ctx, r.bus, t + 0.92, 31, 0.08, "sine", 0.08); // thunk
  };
  r.every(3600, wipe);

  r.every(5000, () => {
    if (Math.random() > 0.4) return;
    const t = ctx.currentTime + 0.05;
    const len = rand(2.5, 4);
    const s = ctx.createBufferSource();
    s.buffer = pink;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(1400, t + len * 0.45);
    f.frequency.linearRampToValueAtTime(250, t + len);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(Math.random() < 0.5 ? -0.8 : 0.8, t);
    p.pan.linearRampToValueAtTime(-p.pan.value, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + len * 0.45);
    g.gain.linearRampToValueAtTime(0, t + len);
    s.connect(f).connect(p).connect(g).connect(r.bus);
    s.start(t, Math.random(), len + 0.1);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(180, t + len);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.01, t + len * 0.45);
    og.gain.linearRampToValueAtTime(0, t + len);
    o.connect(og).connect(p);
    o.start(t);
    o.stop(t + len + 0.1);
  });
  return r.stop;
};

/** Retro Arcade 198X Ambient — room tone, distant chiptune, cabinet blips. */
const arcade198x: Generator = (ctx, out, noise) => {
  const r = new Rig(ctx, out, 1);
  r.loop(noise("brown")).connect(r.filter("lowpass", 300)).connect(r.gain(0.16)).connect(r.bus);
  [60, 120].forEach((f, i) => {
    const o = r.src(ctx.createOscillator());
    o.frequency.value = f;
    o.connect(r.gain(i ? 0.006 : 0.01)).connect(r.bus);
  });
  // "from the next room": muffled + echoed
  const room = r.filter("lowpass", 1400);
  room.connect(r.gain(0.9)).connect(r.bus);
  const echo = r.delay(r.bus, 0.27, 0.35, 0.4, 1200);
  room.connect(echo);
  const melody = [72, 74, 76, 79, 81, 84, 79, 76];
  const bassLine = [48, 48, 55, 53];
  r.seq(112, 2, (step, t, dur) => {
    const phrase = Math.floor(step / 32) % 3;
    if (phrase === 2) return; // breathing room between loops
    if (Math.random() < 0.62) pluck(ctx, room, t, melody[(step * 3 + phrase) % melody.length]!, 0.022, "square", dur * 0.8);
    if (step % 4 === 0) pluck(ctx, room, t, bassLine[Math.floor(step / 8) % 4]!, 0.05, "triangle", dur * 3);
  });
  r.every(4000, () => {
    if (Math.random() > 0.45) return;
    const t = ctx.currentTime + 0.05;
    const kind = Math.floor(Math.random() * 3);
    const p = ctx.createStereoPanner();
    p.pan.value = rand(-0.7, 0.7);
    p.connect(room);
    if (kind === 0) {
      pluck(ctx, p, t, 83, 0.03, "square", 0.08);
      pluck(ctx, p, t + 0.08, 88, 0.03, "square", 0.3);
    } else if (kind === 1) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(1300, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.3);
      const g = env(ctx, t, 0.02, 0.004, 0.3);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + 0.35);
    } else {
      [72, 76, 79, 84].forEach((n, i) => pluck(ctx, p, t + i * 0.06, n, 0.02, "square", 0.1));
    }
    window.setTimeout(() => p.disconnect(), 1500);
  });
  return r.stop;
};

/** Cybernetic Garden — wind, synthetic birdsong, water drips, soft pad. */
const cyberGarden: Generator = (ctx, out, noise) => {
  const r = new Rig(ctx, out, 1);
  const wind = r.filter("bandpass", 520, 0.5);
  const windGain = r.gain(0.22);
  r.loop(noise("pink")).connect(wind).connect(windGain).connect(r.bus);
  r.lfo(wind.frequency, 0.07, 280);
  r.lfo(windGain.gain, 0.05, 0.08);
  const pad = r.filter("lowpass", 900);
  pad.connect(r.bus);
  const chords = [
    [48, 55, 62, 64, 71],
    [45, 52, 59, 60, 67],
  ];
  let c = 0;
  const playPad = () => {
    padChord(ctx, pad, ctx.currentTime + 0.05, chords[c++ % 2]!, 12, 0.006, "triangle");
  };
  playPad();
  r.every(12_000, playPad);

  r.every(1300, () => {
    if (Math.random() > 0.45) return;
    const t0 = ctx.currentTime + 0.05;
    const p = ctx.createStereoPanner();
    p.pan.value = rand(-0.9, 0.9);
    p.connect(r.bus);
    const n = 2 + Math.floor(Math.random() * 3);
    const base = rand(2400, 3600);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * rand(0.09, 0.14);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * rand(1.3, 1.7), t + 0.06);
      const g = env(ctx, t, 0.018, 0.008, 0.07);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + 0.1);
    }
    window.setTimeout(() => p.disconnect(), 1200);
  });

  r.every(700, () => {
    if (Math.random() > 0.3) return;
    const t = ctx.currentTime + 0.05;
    const o = ctx.createOscillator();
    const f = rand(900, 1700);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.08);
    const g = env(ctx, t, 0.03, 0.002, 0.1);
    o.connect(g).connect(r.bus);
    o.start(t);
    o.stop(t + 0.15);
  });
  return r.stop;
};

export const GENERATORS: Record<TrackId, Generator> = {
  "tokyo-cafe": tokyoCafe,
  "neon-horizon": neonHorizon,
  "terminal-echo": terminalEcho,
  "alpha-core": alphaCore,
  "data-static": dataStatic,
  "grid-metronome": gridMetronome,
  "hover-car": hoverCar,
  "arcade-198x": arcade198x,
  "cyber-garden": cyberGarden,
};
