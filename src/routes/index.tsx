import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Command as CommandIcon } from "lucide-react";

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
import { ParticleField } from "@/components/tempor/ParticleField";
import { CelebrationBurst, type BurstEvent } from "@/components/tempor/CelebrationBurst";
import { AudioWidget } from "@/components/tempor/AudioWidget";
import { TimerCard } from "@/components/tempor/TimerCard";
import { PomoBot } from "@/components/tempor/PomoBot";
import { SystemUpgrades } from "@/components/tempor/SystemUpgrades";
import { TaskTerminal, type LogEntry, type LogTone } from "@/components/tempor/TaskTerminal";
import { GhostTerminal } from "@/components/tempor/GhostTerminal";
import { useTempor, type CompletionInfo } from "@/hooks/use-tempor";
import { useAmbience } from "@/hooks/use-ambience";
import {
  MODE_LABEL,
  botStateFor,
  isRestPhase,
  needsSwitchConfirm,
  sessionProgress,
  suggestedNextMode,
  type Mode,
} from "@/lib/tempor/core";
import type { Command } from "@/lib/tempor/commands";

export const COOLDOWN_LOG =
  "High-performance cycle complete. Core cooling initiated. Stand up, stretch, and breathe.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tempor v2 — the sovereign focus engine" },
      {
        name: "description",
        content:
          "A late-night Pomodoro engine with a command terminal, generative ambient mixer, a pixel co-worker you can upgrade, and a calming cooldown mode.",
      },
      { property: "og:title", content: "Tempor v2 — the sovereign focus engine" },
      {
        property: "og:description",
        content:
          "Focus timer, ambient mixer, Grid Credits and Pomo-Bot upgrades — all saved on your device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const completeRef = useRef<(info: CompletionInfo) => void>(() => {});
  const { state, now, announcement, actions } = useTempor((info) => completeRef.current(info));
  const ambience = useAmbience(state.audio, actions.setAudio);

  const { timer, progress, durations, tasks, audio, botFrozen, cosmetics } = state;
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [ghostOpen, setGhostOpen] = useState(false);
  const [burst, setBurst] = useState<BurstEvent | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMac, setIsMac] = useState(false);
  const logId = useRef(0);
  const timerCardRef = useRef<HTMLDivElement>(null);

  const pushLog = useCallback((tag: string, text: string, tone: LogTone) => {
    logId.current += 1;
    const entry = { id: logId.current, tag, text, tone };
    setLogs((l) => [...l.slice(-2), entry]);
  }, []);

  completeRef.current = (info) => {
    ambience.chime();
    if (info.mode !== "focus") return;
    pushLog("SYSTEM STATUS", COOLDOWN_LOG, "system");
    const r = timerCardRef.current?.getBoundingClientRect();
    setBurst({
      id: Date.now(),
      x: r ? r.left + r.width / 2 : window.innerWidth / 2,
      y: r ? r.top + r.height * 0.38 : window.innerHeight / 2,
      credits: info.creditsAwarded,
    });
  };

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  // Phase drives the whole document palette (cyan focus ↔ amber/lavender cooldown).
  const rest = isRestPhase(timer);
  useEffect(() => {
    document.documentElement.setAttribute("data-phase", rest ? "rest" : "focus");
  }, [rest]);

  const start = useCallback(() => {
    ambience.prepareChime();
    actions.start();
  }, [ambience, actions]);

  const beginNext = useCallback(
    (m: Mode) => {
      ambience.prepareChime();
      actions.setMode(m, true);
    },
    [ambience, actions],
  );

  const requestMode = useCallback(
    (m: Mode) => {
      if (m === timer.mode && timer.status !== "complete") return;
      if (needsSwitchConfirm(timer)) setPendingMode(m);
      else actions.setMode(m);
    },
    [timer, actions],
  );

  const runCommand = useCallback(
    (c: Command): boolean => {
      switch (c.type) {
        case "add":
          actions.addTask(c.text);
          pushLog("QUEUED", c.text, "info");
          return true;
        case "start":
          if (timer.status === "complete") beginNext(suggestedNextMode(timer.mode, progress.completedFocus));
          else if (timer.status !== "running") start();
          return true;
        case "pause":
          if (timer.status === "running") actions.pause();
          return true;
        case "break":
          requestMode(c.long ? "long" : "short");
          return true;
        case "focus":
          requestMode("focus");
          return true;
        case "reset":
          actions.reset();
          return true;
        default:
          return false;
      }
    },
    [actions, pushLog, timer, progress.completedFocus, beginNext, start, requestMode],
  );

  // Global shortcuts: Ctrl/Cmd+K toggles the Ghost Terminal; Space starts/pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setGhostOpen((o) => !o);
        return;
      }
      if (e.code !== "Space" || e.repeat || ghostOpen) return;
      const el = e.target as HTMLElement | null;
      if (el && el.closest("input, textarea, button, [role=radio], [role=slider], [role=switch], [contenteditable]"))
        return;
      e.preventDefault();
      if (timer.status === "running") actions.pause();
      else if (timer.status !== "complete") start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timer.status, actions, start, ghostOpen]);

  // Particle drift: faster as the session nears its end, lifted by audio energy.
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const durationsRef = useRef(durations);
  durationsRef.current = durations;
  const getSpeed = useCallback(() => {
    const p = sessionProgress(timerRef.current, Date.now(), durationsRef.current);
    return (0.5 + p * 1.3) * (0.6 + ambience.energy() * 1.8);
  }, [ambience]);

  const botState = botStateFor(timer, progress.completedFocus, now);
  const particlesOn = timer.status === "running" && ambience.isPlaying;

  return (
    <div className="relative min-h-screen">
      <Backdrop>
        <ParticleField active={particlesOn} getSpeed={getSpeed} />
      </Backdrop>
      <CelebrationBurst event={burst} />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-xl border border-glass-border bg-glass font-mono text-sm text-mode shadow-[0_0_20px_-6px_var(--mode)]"
            >
              T
            </span>
            <div className="leading-tight">
              <h1 className="text-lg font-semibold tracking-[0.18em]">
                TEMPOR <span className="font-mono text-xs font-normal text-mode">v2</span>
              </h1>
              <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:block">
                sovereign focus engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGhostOpen(true)}
              aria-label="Open Ghost Terminal"
              className="glass-panel flex h-11 items-center gap-2 rounded-2xl px-3 font-mono text-xs text-muted-foreground transition-all hover:text-foreground hover:shadow-[0_0_24px_-8px_var(--mode)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
            >
              <CommandIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isMac ? "⌘" : "Ctrl"} K</span>
            </button>
            <AudioWidget
              prefs={audio}
              isPlaying={ambience.isPlaying}
              blocked={ambience.blocked}
              energy={ambience.energy}
              onLevel={ambience.setLevel}
              onSolo={ambience.solo}
              onToggle={ambience.togglePlay}
              onVolume={(v) => actions.setAudio({ volume: v })}
              onChime={(c) => actions.setAudio({ chime: c })}
            />
          </div>
        </header>

        <main className="mt-6 grid content-start gap-5 lg:mt-10 lg:flex-1 lg:grid-cols-12 lg:gap-6">
          <div ref={timerCardRef} className="lg:col-span-7 xl:col-span-8">
            <TimerCard
              timer={timer}
              now={now}
              durations={durations}
              completedFocus={progress.completedFocus}
              onStart={start}
              onPause={actions.pause}
              onReset={actions.reset}
              onModeRequest={requestMode}
              onBeginNext={beginNext}
              onDurations={actions.setDurations}
            />
          </div>
          <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4">
            <PomoBot
              state={botState}
              frozen={botFrozen}
              equipped={cosmetics.equipped}
              onFrozenChange={actions.setBotFrozen}
            >
              <SystemUpgrades
                credits={progress.credits}
                owned={cosmetics.owned}
                equipped={cosmetics.equipped}
                onBuy={actions.buyCosmetic}
                onToggle={actions.toggleCosmetic}
              />
            </PomoBot>
            <TaskTerminal
              logs={logs}
              onLog={pushLog}
              tasks={tasks}
              onAdd={actions.addTask}
              onToggle={actions.toggleTask}
              onRemove={actions.removeTask}
              onClearDone={actions.clearCompleted}
            />
          </div>
        </main>

        <footer className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          Saved on this device only · clearing browser data erases your progress and credits
        </footer>
      </div>

      <div className="sr-only" role="status" aria-live="assertive">
        {announcement}
      </div>

      <GhostTerminal open={ghostOpen} onOpenChange={setGhostOpen} onRun={runCommand} />

      <AlertDialog open={pendingMode !== null} onOpenChange={(o) => !o && setPendingMode(null)}>
        <AlertDialogContent className="rounded-2xl border-glass-border bg-popover">
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
