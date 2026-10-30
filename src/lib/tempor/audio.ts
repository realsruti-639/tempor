// Hyper-Flow mixer: three self-contained generative Web Audio channels.
// No external files. The AudioContext is only created inside a user gesture.
import type { ChannelId, ChannelLevels } from "./storage";

type StopFn = () => void;
type Listener = () => void;
type NoiseKind = "white" | "pink" | "brown";
type Noise = (k: NoiseKind) => AudioBuffer;
type Generator = (ctx: AudioContext, out: AudioNode, noise: Noise) => StopFn;

const FADE_S = 1.4; // cross-fade time constant window

function makeNoiseBuffer(ctx: AudioContext, kind: NoiseKind, seconds = 3) {
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

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function loop(ctx: AudioContext, buf: AudioBuffer) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  return s;
}

function cleanup(nodes: AudioScheduledSourceNode[], timers: number[], extra: AudioNode[] = []): StopFn {
  return () => {
    timers.forEach((t) => window.clearInterval(t));
    nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    });
    extra.forEach((n) => n.disconnect());
  };
}

// Neon Rain — rain on glass, distant rumble, warm room hum, droplets.
const neonRain: Generator = (ctx, out, noise) => {
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  const bus = ctx.createGain();
  bus.connect(out);

  const bed = loop(ctx, noise("pink"));
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 350;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2600;
  const bg = ctx.createGain();
  bg.gain.value = 0.32;
  bed.connect(hp).connect(lp).connect(bg).connect(bus);
  bed.start();
  nodes.push(bed);

  const rumble = loop(ctx, noise("brown"));
  const rlp = ctx.createBiquadFilter();
  rlp.type = "lowpass";
  rlp.frequency.value = 220;
  const rg = ctx.createGain();
  rg.gain.value = 0.18;
  rumble.connect(rlp).connect(rg).connect(bus);
  rumble.start();
  nodes.push(rumble);

  [110, 164.8].forEach((f) => {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    o.connect(g).connect(bus);
    o.start();
    nodes.push(o);
  });

  const white = noise("white");
  timers.push(
    window.setInterval(() => {
      if (Math.random() > 0.55) return;
      const t = ctx.currentTime + Math.random() * 0.1;
      const s = ctx.createBufferSource();
      s.buffer = white;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2200 + Math.random() * 3500;
      bp.Q.value = 8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      s.connect(bp).connect(g).connect(bus);
      s.start(t, Math.random() * 2, 0.08);
    }, 140),
  );
  return cleanup(nodes, timers, [bus]);
};

// Deep Space Alpha Waves — 10 Hz binaural offset under a slow cosmic pad.
const alphaWaves: Generator = (ctx, out) => {
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  const bus = ctx.createGain();
  bus.connect(out);

  // binaural carrier: 200 Hz left, 210 Hz right → 10 Hz alpha beat
  const merger = ctx.createChannelMerger(2);
  const bin = ctx.createGain();
  bin.gain.value = 0.05;
  merger.connect(bin).connect(bus);
  [200, 210].forEach((f, ch) => {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(merger, 0, ch);
    o.start();
    nodes.push(o);
  });

  const pad = ctx.createBiquadFilter();
  pad.type = "lowpass";
  pad.frequency.value = 700;
  pad.Q.value = 0.7;
  pad.connect(bus);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.04;
  const lg = ctx.createGain();
  lg.gain.value = 260;
  lfo.connect(lg).connect(pad.frequency);
  lfo.start();
  nodes.push(lfo);

  const chords = [
    [45, 52, 57, 64], // A sus
    [41, 48, 53, 60], // F
    [43, 50, 55, 62], // G
    [40, 47, 52, 59], // E min
  ];
  const LEN = 10;
  let step = 0;
  const play = () => {
    const t = ctx.currentTime + 0.05;
    const chord = chords[step % chords.length]!;
    chord.forEach((note) => {
      [-7, 7].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(note);
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.012, t + 3);
        g.gain.setValueAtTime(0.012, t + LEN - 2);
        g.gain.linearRampToValueAtTime(0, t + LEN + 2);
        o.connect(g).connect(pad);
        o.start(t);
        o.stop(t + LEN + 2.2);
      });
    });
    // distant shimmer
    const s = ctx.createOscillator();
    s.frequency.value = mtof(chord[3]! + 12);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, t + 2);
    sg.gain.linearRampToValueAtTime(0.008, t + 4);
    sg.gain.linearRampToValueAtTime(0, t + 8);
    s.connect(sg).connect(bus);
    s.start(t + 2);
    s.stop(t + 8.2);
    step++;
  };
  play();
  timers.push(window.setInterval(play, LEN * 1000));
  return cleanup(nodes, timers, [bus, merger, pad]);
};

// Data-Stream Static — drifting band noise, hiss, soft telemetry blips.
const dataStream: Generator = (ctx, out, noise) => {
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  const bus = ctx.createGain();
  bus.connect(out);

  const src = loop(ctx, noise("brown"));
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.value = 0.33;
  src.connect(bp).connect(g).connect(bus);
  src.start();
  nodes.push(src);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lg = ctx.createGain();
  lg.gain.value = 500;
  lfo.connect(lg).connect(bp.frequency);
  lfo.start();
  nodes.push(lfo);

  const hiss = loop(ctx, noise("white"));
  const hhp = ctx.createBiquadFilter();
  hhp.type = "highpass";
  hhp.frequency.value = 5000;
  const hg = ctx.createGain();
  hg.gain.value = 0.012;
  hiss.connect(hhp).connect(hg).connect(bus);
  hiss.start();
  nodes.push(hiss);

  // telemetry: short, quiet bleep runs
  timers.push(
    window.setInterval(() => {
      if (Math.random() > 0.35) return;
      const base = ctx.currentTime + 0.05;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const t = base + i * 0.07;
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.value = 1200 + Math.floor(Math.random() * 6) * 220;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, t);
        og.gain.linearRampToValueAtTime(0.004, t + 0.005);
        og.gain.linearRampToValueAtTime(0, t + 0.04);
        o.connect(og).connect(bus);
        o.start(t);
        o.stop(t + 0.05);
      }
    }, 1800),
  );
  return cleanup(nodes, timers, [bus]);
};

const GENERATORS: Record<ChannelId, Generator> = {
  rain: neonRain,
  alpha: alphaWaves,
  stream: dataStream,
};

interface Channel {
  gain: GainNode;
  stop: StopFn | null;
  stopTimer: number | null;
  level: number;
}

export class MixerEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;
  private channels = new Map<ChannelId, Channel>();
  private buffers: Partial<Record<NoiseKind, AudioBuffer>> = {};
  private listeners = new Set<Listener>();
  private volume = 0.5;
  private playing = false;
  private smoothed = 0;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  get isPlaying() {
    return this.playing && this.ctx?.state === "running";
  }

  /** Must be called from a user gesture. Returns true if audio is allowed. */
  async unlock(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return false;
        const ctx = new Ctor();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.volume;
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.85;
        this.freq = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
        this.master.connect(this.analyser);
        this.analyser.connect(ctx.destination);
        ctx.onstatechange = () => this.emit();
      }
      if (this.ctx.state !== "running") await this.ctx.resume();
    } catch {
      return false;
    }
    this.emit();
    return this.ctx?.state === "running";
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
  }

  private noise: Noise = (k) => (this.buffers[k] ??= makeNoiseBuffer(this.ctx!, k));

  private channel(id: ChannelId): Channel {
    let ch = this.channels.get(id);
    if (!ch) {
      const gain = this.ctx!.createGain();
      gain.gain.value = 0;
      gain.connect(this.master!);
      ch = { gain, stop: null, stopTimer: null, level: 0 };
      this.channels.set(id, ch);
    }
    return ch;
  }

  /** Ramps one channel; starts/stops its generator lazily to save CPU. */
  private applyLevel(id: ChannelId, level: number) {
    const ctx = this.ctx!;
    const ch = this.channel(id);
    ch.level = level;
    const target = this.playing ? level : 0;
    ch.gain.gain.cancelScheduledValues(ctx.currentTime);
    ch.gain.gain.setTargetAtTime(target, ctx.currentTime, FADE_S / 3);
    if (target > 0) {
      if (ch.stopTimer !== null) {
        window.clearTimeout(ch.stopTimer);
        ch.stopTimer = null;
      }
      if (!ch.stop) ch.stop = GENERATORS[id](ctx, ch.gain, this.noise);
    } else if (ch.stop && ch.stopTimer === null) {
      ch.stopTimer = window.setTimeout(() => {
        ch.stop?.();
        ch.stop = null;
        ch.stopTimer = null;
      }, FADE_S * 1000 + 400);
    }
  }

  /** Starts the mix. Returns false if the browser blocked audio. */
  async play(levels: ChannelLevels): Promise<boolean> {
    const ok = await this.unlock();
    if (!ok || !this.ctx) {
      this.playing = false;
      this.emit();
      return false;
    }
    this.playing = true;
    (Object.keys(levels) as ChannelId[]).forEach((id) => this.applyLevel(id, levels[id]));
    this.emit();
    return true;
  }

  /** Cross-fades to new levels (no-op for audio while paused). */
  setLevels(levels: ChannelLevels) {
    if (!this.ctx) return;
    (Object.keys(levels) as ChannelId[]).forEach((id) => this.applyLevel(id, levels[id]));
  }

  pause() {
    if (!this.ctx) return;
    this.playing = false;
    this.channels.forEach((ch, id) => this.applyLevel(id, ch.level));
    this.emit();
  }

  /** 0..1 smoothed loudness of the mix, for visuals. */
  energy(): number {
    if (!this.analyser || !this.freq || !this.isPlaying) {
      this.smoothed *= 0.92;
      return this.smoothed;
    }
    this.analyser.getByteFrequencyData(this.freq);
    let sum = 0;
    const n = Math.min(48, this.freq.length);
    for (let i = 0; i < n; i++) sum += this.freq[i]!;
    const raw = Math.min(1, sum / n / 140);
    this.smoothed = this.smoothed * 0.85 + raw * 0.15;
    return this.smoothed;
  }

  /** Brief, gentle two-note chime. Silently skipped if audio isn't allowed. */
  chime() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.volume <= 0) return;
    const out = ctx.createGain();
    out.gain.value = 0.16 * Math.max(0.35, this.volume);
    out.connect(ctx.destination);
    (
      [
        [76, 0],
        [83, 0.2],
      ] as const
    ).forEach(([note, delay]) => {
      const t = ctx.currentTime + 0.03 + delay;
      const o = ctx.createOscillator();
      o.frequency.value = mtof(note);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.6, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.9);
    });
    window.setTimeout(() => out.disconnect(), 2600);
  }
}

let engine: MixerEngine | null = null;
export function getEngine(): MixerEngine {
  return (engine ??= new MixerEngine());
}
