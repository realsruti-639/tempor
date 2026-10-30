import { useEffect, useRef } from "react";
import { Pause, Play, Volume1, Volume2, VolumeX, SlidersHorizontal, Crosshair } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CHANNELS, CHANNEL_IDS, TRACKS, TRACK_IDS, type ChannelId, type TrackId } from "@/lib/tempor/tracks";
import type { AudioPrefs } from "@/lib/tempor/storage";
import { Cassette } from "./Cassette";

interface Props {
  prefs: AudioPrefs;
  isPlaying: boolean;
  blocked: boolean;
  energy: () => number;
  onLevel: (id: ChannelId, v: number) => void;
  onSelectTrack: (id: TrackId) => void;
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

/** Small CSS equaliser shown on the track that's audible right now. */
function Eq() {
  return (
    <span aria-hidden className="flex h-3 items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-eq h-full w-[2px] origin-bottom rounded-full bg-orchid"
          style={{ animationDelay: `${i * -0.28}s` }}
        />
      ))}
    </span>
  );
}

export function AudioWidget({
  prefs,
  isPlaying,
  blocked,
  energy,
  onLevel,
  onSelectTrack,
  onSolo,
  onToggle,
  onVolume,
  onChime,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const VolIcon = prefs.volume === 0 ? VolumeX : prefs.volume < 0.5 ? Volume1 : Volume2;
  const live = CHANNEL_IDS.filter((c) => prefs.levels[c] > 0);
  const title =
    live.length === 0 ? "Mixer" : live.length === 1 ? TRACKS[prefs.tracks[live[0]!]].name : `${live.length}-channel mix`;
  const statusText = blocked ? "Tap play to allow sound" : isPlaying ? "Playing" : "Paused";

  const jumpTo = (id: ChannelId) => {
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-channel="${id}"]`);
    if (root && el) root.scrollTo({ top: el.offsetTop - 4, behavior: "smooth" });
  };

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
        <PopoverContent
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-glass-border bg-popover/95 p-0 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Hyper-flow mixer · 9 tracks
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

          {/* channel quick-jump */}
          <div className="flex gap-1.5 px-4 pb-3" role="group" aria-label="Jump to channel">
            {CHANNEL_IDS.map((id) => {
              const on = prefs.levels[id] > 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => jumpTo(id)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-orchid/40 text-foreground" : "border-glass-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      on && isPlaying ? "bg-orchid shadow-[var(--glow-orchid)]" : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="truncate">{CHANNELS[id].name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          <div
            ref={scrollRef}
            className="scroll-fade scrollbar-thin relative max-h-[min(25rem,calc(100vh-15rem))] overflow-y-auto overscroll-contain scroll-smooth px-3 pb-3"
          >
            {CHANNEL_IDS.map((id) => {
              const ch = CHANNELS[id];
              const level = prefs.levels[id];
              const on = level > 0;
              return (
                <section key={id} data-channel={id} aria-label={ch.name} className="pb-3">
                  <div className="sticky top-0 z-10 -mx-3 border-b border-glass-border bg-popover/90 px-4 pb-2.5 pt-2 backdrop-blur-md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-500",
                              on && isPlaying ? "bg-orchid shadow-[var(--glow-orchid)]" : "bg-muted-foreground/40",
                            )}
                          />
                          {ch.name}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{ch.tagline}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSolo(id)}
                        aria-label={`Cross-fade to ${ch.name} only`}
                        title="Cross-fade to this channel only"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-orchid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Slider
                        aria-label={`${ch.name} level`}
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

                  <div role="radiogroup" aria-label={`${ch.name} track`} className="mt-2 space-y-1">
                    {ch.tracks.map((tid) => {
                      const t = TRACKS[tid];
                      const selected = prefs.tracks[id] === tid;
                      const audible = selected && on && isPlaying;
                      return (
                        <button
                          key={tid}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onSelectTrack(tid)}
                          className={cn(
                            "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
                            selected
                              ? "border-orchid/40 bg-orchid/[0.08]"
                              : "border-transparent hover:border-glass-border hover:bg-accent/50",
                          )}
                        >
                          {selected && (
                            <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-orchid shadow-[var(--glow-orchid)]" />
                          )}
                          <span
                            className={cn(
                              "w-5 shrink-0 font-mono text-[10px] tabular",
                              selected ? "text-orchid" : "text-muted-foreground/60",
                            )}
                          >
                            {String(TRACK_IDS.indexOf(tid) + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-sm",
                                selected ? "font-medium text-foreground" : "text-foreground/85",
                              )}
                            >
                              {t.name}
                            </span>
                            <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              {t.meta}
                            </span>
                          </span>
                          {audible ? (
                            <Eq />
                          ) : (
                            <Play
                              aria-hidden
                              className={cn(
                                "h-3 w-3 shrink-0 text-muted-foreground transition-opacity",
                                selected ? "opacity-60" : "opacity-0 group-hover:opacity-60",
                              )}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="border-t border-glass-border px-4 pb-4 pt-3">
            {blocked && (
              <p className="mb-3 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
                Your browser held back the sound. Press play once to let it through.
              </p>
            )}
            <div className="flex items-center gap-3">
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
            <div className="mt-3 flex items-center justify-between gap-3">
              <Label htmlFor="chime" className="flex flex-col gap-0.5">
                <span className="text-sm">Completion chime</span>
                <span className="text-xs font-normal text-muted-foreground">
                  A soft two-note tone when a session ends
                </span>
              </Label>
              <Switch id="chime" checked={prefs.chime} onCheckedChange={onChime} />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
