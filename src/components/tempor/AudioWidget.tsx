import { useEffect, useRef } from "react";
import { Pause, Play, Volume1, Volume2, VolumeX, SlidersHorizontal, Crosshair } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CHANNEL_IDS, type AudioPrefs, type ChannelId } from "@/lib/tempor/storage";
import { Cassette } from "./Cassette";

export const CHANNELS: Record<ChannelId, { label: string; hint: string }> = {
  rain: { label: "Neon Rain", hint: "Rain on glass, low room hum" },
  alpha: { label: "Deep Space Alpha Waves", hint: "10 Hz binaural drift · best on headphones" },
  stream: { label: "Data-Stream Static", hint: "Drifting band noise, soft telemetry" },
};

interface Props {
  prefs: AudioPrefs;
  isPlaying: boolean;
  blocked: boolean;
  energy: () => number;
  onLevel: (id: ChannelId, v: number) => void;
  onSolo: (id: ChannelId) => void;
  onToggle: () => void;
  onVolume: (v: number) => void;
  onChime: (on: boolean) => void;
}

/** Tiny live level meter driven by the analyser. */
function Meter({ energy, playing }: { energy: () => number; playing: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const bars = ref.current?.children;
    const loop = () => {
      const e = energy();
      if (bars) {
        for (let i = 0; i < bars.length; i++) {
          const el = bars[i] as HTMLElement;
          const k = Math.min(1, e * (1.4 - i * 0.18) + Math.random() * e * 0.25);
          el.style.transform = `scaleY(${0.15 + k * 0.85})`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    if (playing) raf = requestAnimationFrame(loop);
    else if (bars) for (const b of Array.from(bars)) (b as HTMLElement).style.transform = "scaleY(0.15)";
    return () => cancelAnimationFrame(raf);
  }, [playing, energy]);
  return (
    <div ref={ref} aria-hidden className="flex h-4 items-end gap-[2px]">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="h-full w-[3px] origin-bottom rounded-full bg-orchid/80 transition-transform duration-75" />
      ))}
    </div>
  );
}

export function AudioWidget({ prefs, isPlaying, blocked, energy, onLevel, onSolo, onToggle, onVolume, onChime }: Props) {
  const VolIcon = prefs.volume === 0 ? VolumeX : prefs.volume < 0.5 ? Volume1 : Volume2;
  const live = CHANNEL_IDS.filter((c) => prefs.levels[c] > 0);
  const title = live.length === 0 ? "Mixer" : live.length === 1 ? CHANNELS[live[0]!].label : `${live.length}-channel mix`;
  const statusText = blocked ? "Tap play to allow sound" : isPlaying ? "Playing" : "Paused";

  return (
    <div className="glass-panel flex items-center gap-1 rounded-2xl p-1 pl-3">
      <Cassette playing={isPlaying} />
      <div className="mx-2 hidden min-w-0 max-w-[11rem] flex-col leading-tight md:flex">
        <span className="truncate text-xs font-medium">{title}</span>
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest",
            blocked ? "text-amber" : "text-muted-foreground",
          )}
        >
          {statusText}
        </span>
      </div>
      <div className="mx-1 hidden sm:block">
        <Meter energy={energy} playing={isPlaying} />
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={isPlaying ? "Pause ambience" : "Play ambience"}
        className="grid h-9 w-9 place-items-center rounded-xl text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <Popover>
        <PopoverTrigger
          aria-label="Open ambient mixer"
          className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90 data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="w-[22rem] rounded-2xl border-glass-border bg-popover/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Hyper-flow mixer
            </p>
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {isPlaying ? "Pause all" : "Play mix"}
            </button>
          </div>

          <div className="space-y-2">
            {CHANNEL_IDS.map((id) => {
              const level = prefs.levels[id];
              const on = level > 0;
              return (
                <div
                  key={id}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 transition-colors duration-500",
                    on && isPlaying ? "border-orchid/40 bg-orchid/[0.07]" : "border-glass-border bg-background/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-500",
                            on && isPlaying ? "bg-orchid shadow-[var(--glow-orchid)]" : "bg-muted-foreground/40",
                          )}
                        />
                        {CHANNELS[id].label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{CHANNELS[id].hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSolo(id)}
                      aria-label={`Cross-fade to ${CHANNELS[id].label} only`}
                      title="Cross-fade to this channel"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-orchid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
                    >
                      <Crosshair className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Slider
                      aria-label={`${CHANNELS[id].label} level`}
                      value={[Math.round(level * 100)]}
                      max={100}
                      step={1}
                      onValueChange={([v]) => onLevel(id, (v ?? 0) / 100)}
                    />
                    <span className="w-8 text-right font-mono text-xs tabular text-muted-foreground">
                      {Math.round(level * 100)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {blocked && (
            <p className="mt-3 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
              Your browser held back the sound. Press play once to let it through.
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <VolIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <Slider
              aria-label="Master volume"
              value={[Math.round(prefs.volume * 100)]}
              max={100}
              step={1}
              onValueChange={([v]) => onVolume((v ?? 0) / 100)}
            />
            <span className="w-8 text-right font-mono text-xs tabular text-muted-foreground">
              {Math.round(prefs.volume * 100)}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-glass-border pt-4">
            <Label htmlFor="chime" className="flex flex-col gap-0.5">
              <span className="text-sm">Completion chime</span>
              <span className="text-xs font-normal text-muted-foreground">
                A soft two-note tone when a session ends
              </span>
            </Label>
            <Switch id="chime" checked={prefs.chime} onCheckedChange={onChime} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
