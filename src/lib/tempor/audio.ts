// Self-contained Web Audio ambience. No external files or URLs.
// The AudioContext is only created inside a user gesture (see unlock()).
import type { TrackId } from "./storage";

type StopFn = () => void;
type Listener = () => void;

function makeNoiseBuffer(ctx: AudioContext, kind: "white" | "pink" | "brown", seconds = 3) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0,
    last = 0;
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

function loopNoise(ctx: AudioContext, buf: AudioBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = Math.random() * 0.5;
  return src;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AmbienceEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stopCurrent: StopFn | null = null;
  private buffers: Partial<Record<"white" | "pink" | "brown", AudioBuffer>> = {};
  private listeners = new Set<Listener>();
  private volume = 0.5;
  current: TrackId = "off";

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  get running() {
    return this.ctx?.state === "running";
  }
  get isPlaying() {
    return this.running && this.current !== "off" && this.stopCurrent !== null;
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
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        this.ctx.onstatechange = () => this.emit();
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
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
    }
  }

  private noise(kind: "white" | "pink" | "brown") {
    const ctx = this.ctx!;
    return (this.buffers[kind] ??= makeNoiseBuffer(ctx, kind));
  }

  /** Plays a track. Returns false if the browser blocked audio. */
  async play(track: TrackId): Promise<boolean> {
    this.stop();
    this.current = track;
    if (track === "off") {
      this.emit();
      return true;
    }
    const ok = await this.unlock();
    if (!ok || !this.ctx || !this.master) {
      this.emit();
      return false;
    }
    if (this.current !== track) return true; // changed while awaiting
    this.stopCurrent =
      track === "rain" ? this.rain() : track === "synth" ? this.synth() : this.static();
    this.emit();
    return true;
  }

  /** Stops ambience but remembers the selected track. */
  stop() {
    if (this.stopCurrent) {
      this.stopCurrent();
      this.stopCurrent = null;
    }
    this.emit();
  }

  private bus(level: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(level, ctx.currentTime, 0.6);
    g.connect(this.master!);
    return g;
  }

  private teardown(bus: GainNode, nodes: AudioScheduledSourceNode[], timers: number[]): StopFn {
    const ctx = this.ctx!;
    return () => {
      timers.forEach((t) => window.clearInterval(t));
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      window.setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* already stopped */
          }
        });
        bus.disconnect();
      }, 600);
    };
  }

  // Rainy Cyber-Cafe: soft rain bed, sparse droplets, warm room hum.
  private rain(): StopFn {
    const ctx = this.ctx!;
    const bus = this.bus(0.9);
    const nodes: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];

    const bed = loopNoise(ctx, this.noise("pink"));
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 350;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.32;
    bed.connect(hp).connect(lp).connect(bedGain).connect(bus);
    bed.start();
    nodes.push(bed);

    const rumble = loopNoise(ctx, this.noise("brown"));
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
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.012;
      o.connect(g).connect(bus);
      o.start();
      nodes.push(o);
    });

    const white = this.noise("white");
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

    return this.teardown(bus, nodes, timers);
  }

  // Synth Study Beats: slow warm pads, faint pulse, vinyl crackle.
  private synth(): StopFn {
    const ctx = this.ctx!;
    const bus = this.bus(0.75);
    const nodes: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.6;
    padFilter.connect(bus);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(padFilter.frequency);
    lfo.start();
    nodes.push(lfo);

    const chords = [
      [57, 60, 64, 67], // Am7
      [53, 57, 60, 64], // Fmaj7
      [48, 55, 59, 64], // Cmaj7
      [55, 59, 62, 64], // G6
    ];
    const CHORD_LEN = 8;
    let step = 0;
    const playChord = () => {
      const t = ctx.currentTime + 0.05;
      chords[step % chords.length].forEach((note) => {
        [-6, 6].forEach((det) => {
          const o = ctx.createOscillator();
          o.type = "triangle";
          o.frequency.value = mtof(note);
          o.detune.value = det;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.022, t + 2.2);
          g.gain.setValueAtTime(0.022, t + CHORD_LEN - 1.5);
          g.gain.linearRampToValueAtTime(0, t + CHORD_LEN + 1.2);
          o.connect(g).connect(padFilter);
          o.start(t);
          o.stop(t + CHORD_LEN + 1.4);
        });
      });
      // soft bass root
      const b = ctx.createOscillator();
      b.type = "sine";
      b.frequency.value = mtof(chords[step % chords.length][0] - 12);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0, t);
      bg.gain.linearRampToValueAtTime(0.05, t + 1.5);
      bg.gain.linearRampToValueAtTime(0, t + CHORD_LEN + 0.8);
      b.connect(bg).connect(bus);
      b.start(t);
      b.stop(t + CHORD_LEN + 1);
      step++;
    };
    playChord();
    timers.push(window.setInterval(playChord, CHORD_LEN * 1000));

    // gentle pulse at 70 BPM
    const beat = 60 / 70;
    timers.push(
      window.setInterval(() => {
        const t = ctx.currentTime + 0.02;
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + 0.35);
      }, beat * 2000),
    );

    // vinyl crackle
    const white = this.noise("white");
    timers.push(
      window.setInterval(() => {
        if (Math.random() > 0.35) return;
        const t = ctx.currentTime + Math.random() * 0.1;
        const s = ctx.createBufferSource();
        s.buffer = white;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 3000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.025 * Math.random(), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
        s.connect(hp).connect(g).connect(bus);
        s.start(t, Math.random() * 2, 0.02);
      }, 90),
    );

    return this.teardown(bus, nodes, timers);
  }

  // Off-Grid Static: drifting filtered noise, faint radio blips.
  private static(): StopFn {
    const ctx = this.ctx!;
    const bus = this.bus(0.7);
    const nodes: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];

    const src = loopNoise(ctx, this.noise("brown"));
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.35;
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

    const hiss = loopNoise(ctx, this.noise("white"));
    const hhp = ctx.createBiquadFilter();
    hhp.type = "highpass";
    hhp.frequency.value = 5000;
    const hg = ctx.createGain();
    hg.gain.value = 0.012;
    hiss.connect(hhp).connect(hg).connect(bus);
    hiss.start();
    nodes.push(hiss);

    timers.push(
      window.setInterval(() => {
        if (Math.random() > 0.3) return;
        const t = ctx.currentTime + 0.05;
        const o = ctx.createOscillator();
        o.type = "sine";
        const f = 500 + Math.random() * 600;
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * 1.4, t + 0.5);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0, t);
        og.gain.linearRampToValueAtTime(0.012, t + 0.1);
        og.gain.linearRampToValueAtTime(0, t + 0.6);
        o.connect(og).connect(bus);
        o.start(t);
        o.stop(t + 0.7);
      }, 2500),
    );

    return this.teardown(bus, nodes, timers);
  }

  /** Brief, gentle two-note chime. Silently skipped if audio isn't allowed. */
  chime() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.volume <= 0) return;
    const out = ctx.createGain();
    out.gain.value = 0.16 * Math.max(0.35, this.volume);
    out.connect(ctx.destination);
    [
      [76, 0],
      [83, 0.2],
    ].forEach(([note, delay]) => {
      const t = ctx.currentTime + 0.03 + delay;
      const o = ctx.createOscillator();
      o.type = "sine";
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

let engine: AmbienceEngine | null = null;
export function getEngine(): AmbienceEngine {
  return (engine ??= new AmbienceEngine());
}
