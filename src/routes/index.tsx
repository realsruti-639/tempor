import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Command as CommandIcon, PanelBottomClose, Zap } from "lucide-react";

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
import { GridRoom, type GridChat } from "@/components/tempor/GridRoom";
import { OverclockView } from "@/components/tempor/OverclockView";
import { HudView } from "@/components/tempor/HudView";
import { MatrixControls } from "@/components/tempor/MatrixControls";
import { WorkspaceSkins } from "@/components/tempor/WorkspaceSkins";
import {
  OVERRIDE_LINE,
  OVERRIDE_TAG,
  bioPhaseAt,
  bioTracks,
  coolingActive,
  fatigued,
} from "@/lib/tempor/matrix";
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
import { DECK_TAG, breakdownStress, deckLine, preparesSynthTrack, type DeckEvent } from "@/lib/tempor/deck";
import { gridReaction } from "@/lib/tempor/grid";
import { SYNTH_TRACK, TRACKS } from "@/lib/tempor/tracks";
import { cn } from "@/lib/utils";

const COOLDOWN_LOG =
  "High-performance cycle complete. Core cooling initiated. Stand up, stretch, and breathe.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tempor v4 — the omnipresent focus matrix" },
      {
        name: "description",
        content:
          "A Pomodoro focus matrix with a compact HUD, time-aware Bio-Sync themes, a mascot that guards your stamina and unlockable workspace skins.",
      },
      { property: "og:title", content: "Tempor v4 — the omnipresent focus matrix" },
      {
        property: "og:description",
        content:
          "Corner HUD, Bio-Sync day/night themes, stamina-aware breaks, 9 ambient tracks and workspace skins — all saved on your device.",
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

  const { timer, progress, durations, tasks, audio, botFrozen, cosmetics, stamina, workspace } = state;
  const [hour, setHour] = useState<number | null>(null);
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [ghostOpen, setGhostOpen] = useState(false);
  const [burst, setBurst] = useState<BurstEvent | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMac, setIsMac] = useState(false);
  const [overclock, setOverclock] = useState(false);
  const [gridChat, setGridChat] = useState<GridChat[]>([]);
  const [gridPulse, setGridPulse] = useState(0);
  const logId = useRef(0);
  const taskPings = useRef(0);
  const deckTimers = useRef<number[]>([]);
  const timerCardRef = useRef<HTMLDivElement>(null);

  const pushLog = useCallback((tag: string, text: string, tone: LogTone, action?: LogEntry["action"]) => {
    logId.current += 1;
    const entry = { id: logId.current, tag, text, tone, action };
    setLogs((l) => [...l.slice(-3), entry]);
  }, []);

  /** Deck Officer speaks; `delayMs` lets an earlier line finish typing first. */
  const deck = useCallback(
    (e: DeckEvent, delayMs = 0, action?: LogEntry["action"]) => {
      const line = deckLine(e);
      if (!line) return;
      if (!delayMs) return pushLog(DECK_TAG, line, "deck", action);
      deckTimers.current.push(window.setTimeout(() => pushLog(DECK_TAG, line, "deck", action), delayMs));
    },
    [pushLog],
  );
  useEffect(() => () => deckTimers.current.forEach((t) => window.clearTimeout(t)), []);

  const pingGrid = useCallback((event: "focus" | "task") => {
    const msg = gridReaction(event, event === "task" ? taskPings.current++ : 0);
    const id = Date.now() + Math.random();
    setGridChat((c) => [...c.slice(-2), { ...msg, id }]);
    setGridPulse((p) => p + 1);
  }, []);

  completeRef.current = (info) => {
    ambience.chime();
    if (info.override) {
      pushLog(OVERRIDE_TAG, OVERRIDE_LINE, "system");
      pingGrid("focus");
      return;
    }
    if (info.mode !== "focus") return;
    pushLog("SYSTEM STATUS", COOLDOWN_LOG, "system");
    pingGrid("focus");
    if (preparesSynthTrack(info.streak)) {
      // "I've prepared your favorite synth track": cue it now if sound is on, else offer it.
      if (ambience.isPlaying) ambience.selectTrack(SYNTH_TRACK);
      deck({ type: "focus-complete", streak: info.streak }, 2400, ambience.isPlaying
        ? undefined
        : { label: `play ${TRACKS[SYNTH_TRACK].name}`, run: () => ambience.selectTrack(SYNTH_TRACK) });
    } else {
      deck({ type: "focus-complete", streak: info.streak }, 2400);
    }
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

  // Circadian wave: re-read local time every minute.
  useEffect(() => {
    const read = () => setHour(new Date().getHours());
    read();
    const id = window.setInterval(read, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const bio = bioPhaseAt(hour ?? 12);
  useEffect(() => {
    const el = document.documentElement;
    if (workspace.bioSync && hour !== null) el.setAttribute("data-bio", bio);
    else el.removeAttribute("data-bio");
    if (workspace.skin) el.setAttribute("data-skin", workspace.skin);
    else el.removeAttribute("data-skin");
  }, [workspace.bioSync, workspace.skin, bio, hour]);
  const cooling = coolingActive(stamina, now);
  const hud = workspace.hud;
  const currentTask = tasks.find((t) => !t.done)?.text;

  const start = useCallback(() => {
    ambience.prepareChime();
    if (timer.status === "ready" && timer.mode === "focus") deck({ type: "focus-start", streak: progress.streak });
    actions.start();
  }, [ambience, actions, timer.status, timer.mode, progress.streak, deck]);

  const beginNext = useCallback(
    (m: Mode) => {
      ambience.prepareChime();
      if (m === "focus") deck({ type: "focus-start", streak: progress.streak });
      actions.setMode(m, true);
    },
    [ambience, actions, progress.streak, deck],
  );

  const toggleOverclock = useCallback(
    (on?: boolean) => {
      setOverclock((cur) => {
        const next = on ?? !cur;
        if (next !== cur) deck({ type: "overclock", on: next });
        return next;
      });
    },
    [deck],
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
        case "stress": {
          const subtasks = breakdownStress(c.text);
          actions.addTasks(subtasks, "ai");
          deck({ type: "stress", count: subtasks.length });
          return true;
        }
        case "overclock":
          toggleOverclock();
          return true;
        default:
          return false;
      }
    },
    [actions, pushLog, timer, progress.completedFocus, beginNext, start, requestMode, deck, toggleOverclock],
  );

  // Global shortcuts: Ctrl/Cmd+K toggles the Ghost Terminal; Space starts/pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setGhostOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && overclock && !ghostOpen && pendingMode === null) {
        e.preventDefault();
        toggleOverclock(false);
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
  }, [timer.status, actions, start, ghostOpen, overclock, pendingMode, toggleOverclock]);

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
  const particlesOn = timer.status === "running" && ambience.isPlaying && !overclock && !hud;

  // Deck Officer notices a long pause once per pause.
  const notedPause = useRef<number | null>(null);
  useEffect(() => {
    if (botState === "extendedPause" && timer.pausedAt !== null && notedPause.current !== timer.pausedAt) {
      notedPause.current = timer.pausedAt;
      deck({ type: "long-pause" });
    }
  }, [botState, timer.pausedAt, deck]);

  // Agent tickers move per minute; a coarse clock keeps the Grid Room from re-rendering 4×/s.
  const gridNow = Math.floor(now / 5000) * 5000;

  return (
    <div className="relative min-h-screen">
      <Backdrop>
        <ParticleField active={particlesOn} getSpeed={getSpeed} />
      </Backdrop>
      <CelebrationBurst event={burst} />

      {overclock && (
        <OverclockView
          timer={timer}
          now={now}
          durations={durations}
          onStart={timer.status === "complete" ? () => beginNext(suggestedNextMode(timer.mode, progress.completedFocus)) : start}
          onPause={actions.pause}
          onExit={() => toggleOverclock(false)}
        />
      )}

      {hud && !overclock && (
        <HudView
          timer={timer}
          now={now}
          task={currentTask}
          playing={ambience.isPlaying}
          cooling={cooling}
          onAudio={ambience.togglePlay}
          onStart={timer.status === "complete" ? () => beginNext(suggestedNextMode(timer.mode, progress.completedFocus)) : start}
          onPause={actions.pause}
          onExit={() => actions.setWorkspace({ hud: false })}
        />
      )}

      <div
        aria-hidden={overclock || hud || undefined}
        inert={overclock || hud || undefined}
        className={cn(
          "mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 transition-opacity duration-500 sm:px-6 lg:px-10 lg:py-8",
          (overclock || hud) && "pointer-events-none opacity-0",
        )}
      >
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
                TEMPOR <span className="font-mono text-xs font-normal text-mode">v4</span>
              </h1>
              <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:block">
                omnipresent focus matrix
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => actions.setWorkspace({ hud: true })}
              aria-label="Enter HUD Mode"
              className="glass-panel flex h-11 items-center gap-2 rounded-2xl px-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
            >
              <PanelBottomClose className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">HUD</span>
            </button>
            <MatrixControls
              enabled={workspace.bioSync}
              phase={bio}
              onChange={(on) => actions.setWorkspace({ bioSync: on })}
            />
            <button
              type="button"
              onClick={() => setGhostOpen(true)}
              aria-label="Open Ghost Terminal"
              className="glass-panel flex h-11 items-center gap-2 rounded-2xl px-3 font-mono text-xs text-muted-foreground transition-all hover:text-foreground hover:shadow-[0_0_24px_-8px_var(--mode)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
            >
              <CommandIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isMac ? "⌘" : "Ctrl"} K</span>
            </button>
            <button
              type="button"
              onClick={() => toggleOverclock(true)}
              aria-label="Enter Overclock mode"
              className="overclock-btn group flex h-11 items-center gap-2 rounded-2xl px-3 font-mono text-[11px] uppercase tracking-[0.2em] text-mode transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:px-4"
            >
              <Zap className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
              <span className="hidden sm:inline">Overclock</span>
            </button>
            <AudioWidget
              prefs={audio}
              isPlaying={ambience.isPlaying}
              blocked={ambience.blocked}
              energy={ambience.energy}
              onLevel={ambience.setLevel}
              onSelectTrack={ambience.selectTrack}
              onSolo={ambience.solo}
              onToggle={ambience.togglePlay}
              onVolume={(v) => actions.setAudio({ volume: v })}
              onChime={(c) => actions.setAudio({ chime: c })}
              recommended={workspace.bioSync && hour !== null ? bioTracks(bio) : []}
            />
          </div>
        </header>

        <main className="mt-6 grid content-start gap-5 lg:mt-10 lg:flex-1 lg:grid-cols-12 lg:gap-6">
          <div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6 xl:col-span-8">
            <div ref={timerCardRef}>
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
            <GridRoom now={gridNow} messages={gridChat} pulse={gridPulse} />
          </div>
          <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4">
            <PomoBot
              state={botState}
              frozen={botFrozen}
              equipped={cosmetics.equipped}
              onFrozenChange={actions.setBotFrozen}
              stamina={stamina.value}
              fatigued={fatigued(stamina) || cooling}
              cooling={cooling}
            >
              <SystemUpgrades
                credits={progress.credits}
                owned={cosmetics.owned}
                equipped={cosmetics.equipped}
                onBuy={actions.buyCosmetic}
                onToggle={actions.toggleCosmetic}
              />
              <WorkspaceSkins
                workspace={workspace}
                credits={progress.credits}
                onBuy={actions.buySkin}
                onEquip={(skin) => actions.setWorkspace({ skin })}
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
              onCompleted={() => pingGrid("task")}
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
