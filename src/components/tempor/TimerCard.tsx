import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LONG_BREAK_EVERY,
  MODES,
  MODE_LABEL,
  formatClock,
  remainingAt,
  sessionProgress,
  suggestedNextMode,
  type Durations,
  type Mode,
  type TimerState,
} from "@/lib/tempor/core";
import { DurationSettings } from "./DurationSettings";

const STATUS_LABEL = {
  ready: "Ready",
  running: "Running",
  paused: "Paused",
  complete: "Complete",
} as const;

interface Props {
  timer: TimerState;
  now: number;
  durations: Durations;
  completedFocus: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onModeRequest: (m: Mode) => void;
  onBeginNext: (m: Mode) => void;
  onDurations: (d: Durations) => void;
}

export function TimerCard({
  timer,
  now,
  durations,
  completedFocus,
  onStart,
  onPause,
  onReset,
  onModeRequest,
  onBeginNext,
  onDurations,
}: Props) {
  const remaining = remainingAt(timer, now);
  const progress = sessionProgress(timer, now, durations);
  const { status, mode } = timer;
  const complete = status === "complete";
  const next = suggestedNextMode(mode, completedFocus);
  const inCycle = completedFocus % LONG_BREAK_EVERY;
  const cycleFilled = completedFocus > 0 && inCycle === 0 ? LONG_BREAK_EVERY : inCycle;

  return (
    <section
      aria-labelledby="timer-title"
      className="glass-panel glow-mode relative flex flex-col overflow-hidden rounded-[2rem] p-5 sm:p-8 lg:p-10"
    >
      <h2 id="timer-title" className="sr-only">
        Timer
      </h2>

      {/* top row */}
      <div className="flex items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Timer mode"
          className="flex rounded-2xl border border-glass-border bg-background/40 p-1"
        >
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => !active && onModeRequest(m)}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:px-4 sm:text-sm",
                  active
                    ? "bg-mode/15 text-mode shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--mode)_35%,transparent)]"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {MODE_LABEL[m]}
                <span className="ml-1.5 hidden font-mono text-[10px] opacity-60 sm:inline">
                  {durations[m]}m
                </span>
              </button>
            );
          })}
        </div>
        <DurationSettings durations={durations} onChange={onDurations} />
      </div>

      {/* status */}
      <div className="mt-8 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground sm:mt-10">
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-colors",
            status === "running" && "bg-mode shadow-[0_0_10px_var(--mode)] animate-complete",
            status === "paused" && "bg-amber",
            status === "ready" && "bg-muted-foreground/50",
            complete && "bg-terminal shadow-[0_0_10px_var(--terminal)]",
          )}
        />
        <span>
          {MODE_LABEL[mode]} · <span className={cn(complete && "text-terminal")}>{STATUS_LABEL[status]}</span>
        </span>
      </div>

      {/* digits */}
      <div
        role="timer"
        aria-label={`${MODE_LABEL[mode]} timer, ${formatClock(remaining)} remaining, ${STATUS_LABEL[status]}`}
        className={cn(
          "mt-3 select-none text-center font-mono text-[length:clamp(4.75rem,19vw,10.5rem)] font-medium leading-none tracking-tight tabular text-mode text-glow-mode mode-transition",
          status === "paused" && "opacity-70",
          complete && "animate-complete",
        )}
      >
        {formatClock(remaining)}
      </div>

      {/* session progress */}
      <div className="mx-auto mt-8 w-full max-w-md">
        <div
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-1 overflow-hidden rounded-full bg-foreground/10"
        >
          <div
            className="h-full rounded-full bg-mode shadow-[0_0_12px_var(--mode)] transition-[width] duration-500 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* completion note */}
      <div className="mt-6 min-h-6 text-center text-sm" aria-hidden={!complete}>
        {complete && (
          <p className="animate-log-in text-foreground/90">
            {mode === "focus" ? "Focus session complete." : `${MODE_LABEL[mode]} complete.`}{" "}
            <span className="text-muted-foreground">Up next: {MODE_LABEL[next]}.</span>
          </p>
        )}
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {complete ? (
          <Button variant="mode" size="xl" onClick={() => onBeginNext(next)} className="min-w-52">
            <SkipForward /> Begin {MODE_LABEL[next]}
          </Button>
        ) : status === "running" ? (
          <Button variant="mode" size="xl" onClick={onPause} className="min-w-44">
            <Pause /> Pause
          </Button>
        ) : (
          <Button variant="mode" size="xl" onClick={onStart} className="min-w-44">
            <Play /> {status === "paused" ? "Resume" : "Start"}
          </Button>
        )}
        <Button
          variant="glass"
          size="xl"
          onClick={onReset}
          disabled={status === "ready"}
          aria-label="Reset timer"
        >
          <RotateCcw /> Reset
        </Button>
      </div>

      {/* footer */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-glass-border pt-5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: LONG_BREAK_EVERY }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-5 rounded-full transition-colors duration-500",
                  i < cycleFilled ? "bg-orchid shadow-[var(--glow-orchid)]" : "bg-foreground/10",
                )}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            <span className="font-mono tabular text-foreground">{completedFocus}</span> focus{" "}
            {completedFocus === 1 ? "session" : "sessions"} completed
          </span>
        </div>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 sm:inline">
          Space · start / pause
        </span>
      </div>
    </section>
  );
}
