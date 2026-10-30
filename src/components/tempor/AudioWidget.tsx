import { Pause, Play, Volume1, Volume2, VolumeX, SlidersHorizontal } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AudioPrefs, TrackId } from "@/lib/tempor/storage";
import { Cassette } from "./Cassette";

const TRACKS: { id: TrackId; label: string; hint: string }[] = [
  { id: "rain", label: "Rainy Cyber-Cafe", hint: "Rain on glass, low room hum" },
  { id: "synth", label: "Synth Study Beats", hint: "Slow pads, soft pulse" },
  { id: "static", label: "Off-Grid Static", hint: "Drifting radio noise" },
  { id: "off", label: "Off", hint: "Silence all ambience" },
];

interface Props {
  prefs: AudioPrefs;
  isPlaying: boolean;
  blocked: boolean;
  onSelect: (id: TrackId) => void;
  onToggle: () => void;
  onVolume: (v: number) => void;
  onChime: (on: boolean) => void;
}

export function AudioWidget({ prefs, isPlaying, blocked, onSelect, onToggle, onVolume, onChime }: Props) {
  const current = TRACKS.find((t) => t.id === prefs.track)!;
  const off = prefs.track === "off";
  const VolIcon = prefs.volume === 0 ? VolumeX : prefs.volume < 0.5 ? Volume1 : Volume2;

  const statusText = off
    ? "Sound off"
    : blocked
      ? "Tap play to allow sound"
      : isPlaying
        ? "Playing"
        : "Paused";

  return (
    <div className="glass-panel flex items-center gap-1 rounded-2xl p-1 pl-3">
      <Cassette playing={isPlaying} />
      <div className="mx-2 hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="truncate text-xs font-medium">{off ? "Ambience" : current.label}</span>
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest",
            blocked ? "text-amber" : "text-muted-foreground",
          )}
        >
          {statusText}
        </span>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={off}
        aria-label={isPlaying ? `Pause ${current.label}` : `Play ${current.label}`}
        className="grid h-9 w-9 place-items-center rounded-xl text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <Popover>
        <PopoverTrigger
          aria-label="Sound settings"
          className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="glass-panel w-80 rounded-2xl p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Ambience channel
          </p>
          <div role="radiogroup" aria-label="Ambient track" className="space-y-1">
            {TRACKS.map((t) => {
              const active = prefs.track === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(t.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
                    active
                      ? "border-orchid/50 bg-orchid/10"
                      : "border-transparent hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full transition-colors",
                      active ? "bg-orchid shadow-[var(--glow-orchid)]" : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {blocked && !off && (
            <p className="mt-3 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
              Your browser held back the sound. Press play once to let it through.
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <VolIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <Slider
              aria-label="Volume"
              value={[Math.round(prefs.volume * 100)]}
              max={100}
              step={1}
              onValueChange={([v]) => onVolume(v / 100)}
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
