import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Backdrop } from "@/components/tempor/Backdrop";
import { AudioWidget } from "@/components/tempor/AudioWidget";
import { TimerCard } from "@/components/tempor/TimerCard";
import { PomoBot } from "@/components/tempor/PomoBot";
import { TaskTerminal } from "@/components/tempor/TaskTerminal";
import { useTempor } from "@/hooks/use-tempor";
import { useAmbience } from "@/hooks/use-ambience";
import { MODE_LABEL, botStateFor, needsSwitchConfirm, type Mode } from "@/lib/tempor/core";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tempor — a calm, characterful Pomodoro companion" },
      {
        name: "description",
        content:
          "A late-night focus nook: Pomodoro timer, gentle ambient sound, a quiet pixel co-worker and a tiny task terminal. Saved on your device.",
      },
      { property: "og:title", content: "Tempor — a calm, characterful Pomodoro companion" },
      {
        property: "og:description",
        content:
          "Focus in a retro-futuristic study nook with ambient sound, Pomo-Bot and a task terminal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {


  const [chimeRef] = useState<{ fn: () => void }>(() => ({ fn: () => {} }));
  const { state, now, announcement, actions } = useTempor(() => chimeRef.fn());
  const ambience = useAmbience(state.audio, actions.setAudio);
  chimeRef.fn = ambience.chime;

  const { timer, progress, durations, tasks, audio, botFrozen } = state;
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);

  // Mode accent drives the whole document, including popovers.
  useEffect(() => {
    document.documentElement.setAttribute("data-mode", timer.mode);
  }, [timer.mode]);

  const start = useCallback(() => {
    ambience.prepareChime();
    actions.start();
  }, [ambience, actions]);

  const requestMode = (m: Mode) => {
    if (needsSwitchConfirm(timer)) setPendingMode(m);
    else actions.setMode(m);
  };

  // Space toggles start/pause when not typing or on a control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && el.closest("input, textarea, button, [role=radio], [role=slider], [contenteditable]"))
        return;
      e.preventDefault();
      if (timer.status === "running") actions.pause();
      else if (timer.status !== "complete") start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timer.status, actions, start]);

  const botState = botStateFor(timer, progress.completedFocus, now);

  return (
    <div className="relative min-h-screen">
      <Backdrop />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-xl border border-glass-border bg-glass font-mono text-sm text-mode shadow-[0_0_20px_-6px_var(--mode)]"
            >
              T
            </span>
            <div className="leading-tight">
              <h1 className="text-lg font-semibold tracking-[0.18em]">TEMPOR</h1>
              <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:block">
                late-night focus nook
              </p>
            </div>
          </div>
          <AudioWidget
            prefs={audio}
            isPlaying={ambience.isPlaying}
            blocked={ambience.blocked}
            onSelect={ambience.selectTrack}
            onToggle={ambience.togglePlay}
            onVolume={(v) => actions.setAudio({ volume: v })}
            onChime={(c) => actions.setAudio({ chime: c })}
          />
        </header>

        <main className="mt-6 grid content-start gap-5 lg:flex-1 lg:mt-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-7 xl:col-span-8">
            <TimerCard
              timer={timer}
              now={now}
              durations={durations}
              completedFocus={progress.completedFocus}
              onStart={start}
              onPause={actions.pause}
              onReset={actions.reset}
              onModeRequest={requestMode}
              onBeginNext={(m) => {
                ambience.prepareChime();
                actions.setMode(m, true);
              }}
              onDurations={actions.setDurations}
            />
          </div>
          <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4">
            <PomoBot state={botState} frozen={botFrozen} onFrozenChange={actions.setBotFrozen} />
            <TaskTerminal
              tasks={tasks}
              onAdd={actions.addTask}
              onToggle={actions.toggleTask}
              onRemove={actions.removeTask}
              onClearDone={actions.clearCompleted}
            />
          </div>
        </main>

        <footer className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          Saved on this device only · clearing browser data erases your progress
        </footer>
      </div>

      <div className="sr-only" role="status" aria-live="assertive">
        {announcement}
      </div>

      <AlertDialog open={pendingMode !== null} onOpenChange={(o) => !o && setPendingMode(null)}>
        <AlertDialogContent className="border-glass-border bg-popover rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this {MODE_LABEL[timer.mode].toLowerCase()} session?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching to {pendingMode ? MODE_LABEL[pendingMode] : ""} discards the time on the
              current clock. It won’t count as a completed session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMode) actions.setMode(pendingMode);
                setPendingMode(null);
              }}
            >
              Switch mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
