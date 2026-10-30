import { useCallback, useEffect, useRef, useState } from "react";

import {
  MODE_LABEL,
  createReady,
  formatClock,
  pauseTimer,
  remainingAt,
  resetTimer,
  settle,
  startTimer,
  streakAfterLeaving,
  switchMode,
  type Durations,
  type Mode,
} from "@/lib/tempor/core";
import { purchase, toggleEquip, type CosmeticId } from "@/lib/tempor/upgrades";
import {
  defaultState,
  loadState,
  saveState,
  type AudioPrefs,
  type SavedState,
  type Task,
  type TaskOrigin,
} from "@/lib/tempor/storage";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface CompletionInfo {
  mode: Mode;
  completedFocus: number;
  creditsAwarded: number;
  /** Consecutive focus sessions, including this one. */
  streak: number;
}

/**
 * All Tempor state: timer, progress, tasks, preferences.
 * `onComplete` fires exactly once per live session completion — never on reload.
 */
export function useTempor(onComplete?: (info: CompletionInfo) => void) {
  const [state, setState] = useState<SavedState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const firedFor = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Load + reconcile anything that elapsed while the page was closed.
  useEffect(() => {
    const loaded = loadState();
    const t = Date.now();
    const r = settle(loaded.timer, loaded.progress, t);
    if (r.justCompleted) firedFor.current = loaded.timer.sessionId; // no chime on reload
    setState({ ...loaded, timer: r.timer, progress: r.progress });
    setNow(t);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  // Wall-clock driven refresh; catches up instantly when the tab returns.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);

  // Completion detection.
  const { timer, progress } = state;
  useEffect(() => {
    if (!hydrated) return;
    if (timer.status !== "running" || timer.endAt === null || now < timer.endAt) return;
    const r = settle(timer, progress, now);
    setState((s) => ({ ...s, timer: r.timer, progress: r.progress }));
    if (timer.sessionId && firedFor.current !== timer.sessionId) {
      firedFor.current = timer.sessionId;
      setAnnouncement(
        timer.mode === "focus"
          ? `Focus session complete. ${r.progress.completedFocus} completed so far.`
          : `${MODE_LABEL[timer.mode]} complete.`,
      );
      onCompleteRef.current?.({
        mode: timer.mode,
        completedFocus: r.progress.completedFocus,
        creditsAwarded: r.progress.credits - progress.credits,
        streak: r.progress.streak,
      });
    }
  }, [now, hydrated, timer, progress]);

  // Tab title mirrors the countdown while active.
  useEffect(() => {
    if (!hydrated) return;
    const base = "Tempor";
    if (timer.status === "running" || timer.status === "paused") {
      const clock = formatClock(remainingAt(timer, now));
      document.title = `${timer.status === "paused" ? "⏸ " : ""}${clock} · ${MODE_LABEL[timer.mode]} — ${base}`;
    } else if (timer.status === "complete") {
      document.title = `Done · ${MODE_LABEL[timer.mode]} — ${base}`;
    } else {
      document.title = `${base} — calm Pomodoro companion`;
    }
  }, [timer, now, hydrated]);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setAnnouncement("");
    setState((s) => ({ ...s, timer: startTimer(s.timer, t, s.durations, newId()) }));
  }, []);

  const pause = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setState((s) => ({ ...s, timer: pauseTimer(s.timer, t) }));
  }, []);

  const reset = useCallback(() => {
    setAnnouncement("");
    setState((s) => ({
      ...s,
      progress: streakAfterLeaving(s.timer, s.progress),
      timer: resetTimer(s.timer, s.durations),
    }));
  }, []);

  const setMode = useCallback((mode: Mode, autoStart = false) => {
    const t = Date.now();
    setNow(t);
    setAnnouncement("");
    setState((s) => {
      const ready = switchMode(s.timer, mode, s.durations);
      return {
        ...s,
        progress: streakAfterLeaving(s.timer, s.progress),
        timer: autoStart ? startTimer(ready, t, s.durations, newId()) : ready,
      };
    });
  }, []);

  const setDurations = useCallback((d: Durations) => {
    setState((s) => ({
      ...s,
      durations: d,
      timer: s.timer.status === "ready" ? createReady(s.timer.mode, d) : s.timer,
    }));
  }, []);

  const addTasks = useCallback((texts: string[], origin: TaskOrigin = "user") => {
    const clean = texts.map((t) => t.trim().slice(0, 200)).filter(Boolean);
    if (!clean.length) return;
    const at = Date.now();
    setState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        ...clean.map((text) => ({ id: newId(), text, done: false, createdAt: at, completedAt: null, origin })),
      ],
    }));
  }, []);

  const addTask = useCallback((text: string) => addTasks([text]), [addTasks]);

  const toggleTask = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t: Task) =>
        t.id === id ? { ...t, done: !t.done, completedAt: t.done ? null : Date.now() } : t,
      ),
    }));
  }, []);

  const removeTask = useCallback((id: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }, []);

  const clearCompleted = useCallback(() => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => !t.done) }));
  }, []);

  const setAudio = useCallback((patch: Partial<AudioPrefs>) => {
    setState((s) => ({ ...s, audio: { ...s.audio, ...patch } }));
  }, []);

  /** Spends Grid Credits; ignored if already owned or unaffordable. */
  const buyCosmetic = useCallback((id: CosmeticId) => {
    setState((s) => {
      const r = purchase({ credits: s.progress.credits, ...s.cosmetics }, id);
      if (!r.ok) return s;
      const { credits, owned, equipped } = r.inventory;
      return { ...s, progress: { ...s.progress, credits }, cosmetics: { owned, equipped } };
    });
  }, []);

  const toggleCosmetic = useCallback((id: CosmeticId) => {
    setState((s) => {
      const inv = toggleEquip({ credits: s.progress.credits, ...s.cosmetics }, id);
      return { ...s, cosmetics: { owned: inv.owned, equipped: inv.equipped } };
    });
  }, []);

  const setBotFrozen = useCallback((botFrozen: boolean) => {
    setState((s) => ({ ...s, botFrozen }));
  }, []);

  return {
    state,
    hydrated,
    now,
    announcement,
    actions: {
      start,
      pause,
      reset,
      setMode,
      setDurations,
      addTask,
      addTasks,
      toggleTask,
      removeTask,
      clearCompleted,
      setAudio,
      setBotFrozen,
      buyCosmetic,
      toggleCosmetic,
    },
  };
}
