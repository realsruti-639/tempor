import { useEffect, useRef } from "react";
import { Pause, Play, Power } from "lucide-react";

import { cn } from "@/lib/utils";
import { MODE_LABEL, formatClock, remainingAt, sessionProgress, type Durations, type TimerState } from "@/lib/tempor/core";
import { DigitalRain } from "./DigitalRain";

interface Props {
  timer: TimerState;
  now: number;
  durations: Durations;
  onStart: () => void;
  onPause: () => void;
  onExit: () => void;
}

/** Total sensory lockdown: only the countdown, a breathing neon grid and slow digital rain. */
export function OverclockView({ timer, now, durations, onStart, onPause, onExit }: Props) {
  const exitRef = useRef<HTMLButtonElement>(null);
  const remaining = remainingAt(timer, now);
  const progress = sessionProgress(timer, now, durations);
  const running = timer.status === "running";
  const complete = timer.status === "complete";

  useEffect(() => {
    exitRef.current?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="region"
      aria-label="Overclock mode"
      className="animate-overclock-in fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-background"
    >
      {/* layers: rain → flat grid → perspective floor → vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0 [contain:strict]">
        <DigitalRain />
        <div className="neon-grid animate-grid-breathe absolute inset-0" />
        <div className="absolute inset-x-[-50%] bottom-0 h-[55%] [perspective:420px]">
          <div className="neon-floor animate-floor-drift absolute inset-0 origin-bottom [transform:rotateX(62deg)]" />
        </div>
        <div className="overclock-vignette absolute inset-0" />
      </div>

      <div className="relative z-10 flex flex-col items-center px-4 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.5em] text-mode/80">
          overclock · {MODE_LABEL[timer.mode]}
          {timer.status === "paused" && " · held"}
          {complete && " · complete"}
        </p>
        <div
          role="timer"
          aria-label={`${formatClock(remaining)} remaining`}
          className={cn(
            "mt-4 select-none font-mono text-[length:clamp(5rem,22vw,15rem)] font-medium leading-none tracking-tight tabular text-mode glow-text-mode overclock-digits",
            timer.status === "paused" && "opacity-60",
            complete && "animate-complete",
          )}
        >
          {formatClock(remaining)}
        </div>
        <div className="mt-8 h-px w-[min(28rem,70vw)] overflow-hidden bg-foreground/10" aria-hidden>
          <div
            className="h-full bg-mode shadow-[0_0_12px_var(--mode)] transition-[width] duration-500 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-10 flex items-center gap-3 opacity-60 transition-opacity duration-500 hover:opacity-100 focus-within:opacity-100">
          {!complete && (
            <button
              type="button"
              onClick={running ? onPause : onStart}
              aria-label={running ? "Pause" : timer.status === "paused" ? "Resume" : "Start"}
              className="grid h-11 w-11 place-items-center rounded-full border border-mode/30 text-mode transition-all hover:bg-mode/10 hover:shadow-[0_0_24px_-6px_var(--mode)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          )}
          <button
            ref={exitRef}
            type="button"
            onClick={onExit}
            className="flex h-11 items-center gap-2 rounded-full border border-glass-border px-4 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
          >
            <Power className="h-3.5 w-3.5" /> Disengage
          </button>
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
          esc · disengage &nbsp;·&nbsp; space · {running ? "pause" : "start"}
        </p>
      </div>
    </div>
  );
}
