// Hyper-Flow mixer: three channels, each playing one of three generative tracks.
// No external files. The AudioContext is only created inside a user gesture.
import { GENERATORS, makeNoiseBuffer, mtof, type Noise, type NoiseKind, type StopFn } from "./synth";
import { CHANNEL_IDS, TRACKS, TRACK_IDS, type ChannelLevels, type ChannelTracks, type TrackId } from "./tracks";

type Listener = () => void;

const FADE_S = 1.4; // cross-fade window

export interface Mix {
  levels: ChannelLevels;
  tracks: ChannelTracks;
}

interface Voice {
  gain: GainNode;
  stop: StopFn | null;
  stopTimer: number | null;
}

export class MixerEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;
  private voices = new Map<TrackId, Voice>();
  private buffers: Partial<Record<NoiseKind, AudioBuffer>> = {};
  private listeners = new Set<Listener>();
  private volume = 0.5;
  private playing = false;
  private smoothed = 0;
  private mix: Mix | null = null;

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
        // gentle glue so stacked channels never clip
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 3;
        comp.attack.value = 0.01;
        comp.release.value = 0.3;
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.85;
        this.freq = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
        this.master.connect(comp).connect(this.analyser);
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

  private voice(id: TrackId): Voice {
    let v = this.voices.get(id);
    if (!v) {
      const gain = this.ctx!.createGain();
      gain.gain.value = 0;
      gain.connect(this.master!);
      v = { gain, stop: null, stopTimer: null };
      this.voices.set(id, v);
    }
    return v;
  }

  /** Ramps one track; starts/stops its generator lazily to save CPU. */
  private applyTrack(id: TrackId, target: number) {
    const ctx = this.ctx!;
    const existing = this.voices.get(id);
    if (!existing && target <= 0) return;
    const v = existing ?? this.voice(id);
    v.gain.gain.cancelScheduledValues(ctx.currentTime);
    v.gain.gain.setTargetAtTime(target, ctx.currentTime, FADE_S / 3);
    if (target > 0) {
      if (v.stopTimer !== null) {
        window.clearTimeout(v.stopTimer);
        v.stopTimer = null;
      }
      if (!v.stop) v.stop = GENERATORS[id](ctx, v.gain, this.noise);
    } else if (v.stop && v.stopTimer === null) {
      v.stopTimer = window.setTimeout(() => {
        v.stop?.();
        v.stop = null;
        v.stopTimer = null;
      }, FADE_S * 1000 + 400);
    }
  }

  /** Every track fades toward its target: selected track at channel level, the rest to 0. */
  private applyMix() {
    if (!this.ctx || !this.mix) return;
    const { levels, tracks } = this.mix;
    for (const id of TRACK_IDS) {
      const ch = TRACKS[id].channel;
      const target = this.playing && tracks[ch] === id ? levels[ch] : 0;
      this.applyTrack(id, target);
    }
  }

  /** Starts the mix. Returns false if the browser blocked audio. */
  async play(mix: Mix): Promise<boolean> {
    this.mix = mix;
    const ok = await this.unlock();
    if (!ok || !this.ctx) {
      this.playing = false;
      this.emit();
      return false;
    }
    this.playing = true;
    this.applyMix();
    this.emit();
    return true;
  }

  /** Cross-fades to new levels / tracks (no audio while paused). */
  setMix(mix: Mix) {
    this.mix = mix;
    this.applyMix();
  }

  pause() {
    if (!this.ctx) return;
    this.playing = false;
    this.applyMix();
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

export { CHANNEL_IDS };

let engine: MixerEngine | null = null;
export function getEngine(): MixerEngine {
  return (engine ??= new MixerEngine());
}
