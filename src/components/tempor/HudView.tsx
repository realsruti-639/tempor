import { Maximize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock, remainingAt, type TimerState } from "@/lib/tempor/core";

export function HudView({ timer, now, task, playing, onAudio, onStart, onPause, onExit, cooling }: {
  timer: TimerState; now: number; task?: string | undefined; playing: boolean; cooling: boolean;
  onAudio: () => void; onStart: () => void; onPause: () => void; onExit: () => void;
}) {
  return <section aria-label="Cyber HUD" className="cyber-hud fixed bottom-4 right-4 z-40 w-[min(440px,calc(100vw-2rem))] rounded-lg p-4">
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] text-mode">TEMPOR v4 / {cooling ? "COOLING LOCK" : timer.mode.toUpperCase()}</span>
      <Button variant="ghost" size="icon" onClick={onExit} aria-label="Exit HUD Mode" title="Expand workspace"><Maximize2 /></Button>
    </div>
    <div className="mt-1 flex items-center gap-4">
      <div role="timer" className="min-w-0 flex-1 font-mono text-5xl tabular text-mode glow-text-mode">{formatClock(remainingAt(timer, now))}</div>
      <Button variant="glass" size="icon" disabled={cooling} onClick={timer.status === "running" ? onPause : onStart} aria-label={timer.status === "running" ? "Pause HUD timer" : "Start HUD timer"} title={cooling ? "Cooling cycle locked" : "Start / pause"}>{timer.status === "running" ? <Pause /> : <Play />}</Button>
      <Button variant="glass" size="icon" onClick={onAudio} aria-label={playing ? "Pause HUD audio" : "Play HUD audio"} title="Ambient audio">{playing ? <Volume2 /> : <VolumeX />}</Button>
    </div>
    <p className="mt-3 truncate border-t border-glass-border pt-3 font-mono text-xs text-muted-foreground">{cooling ? "Step away and hydrate." : task ?? "Signal idle. No task queued."}</p>
  </section>;
}