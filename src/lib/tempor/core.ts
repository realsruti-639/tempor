// Pure timer + Pomo-Bot logic. No React, no browser APIs — fully testable.
// Time is always measured from wall-clock timestamps (endAt), never by
// counting interval ticks, so backgrounded tabs / sleep / reload stay accurate.

export type Mode = "focus" | "short" | "long";
export type Status = "ready" | "running" | "paused" | "complete";

export const MODES: Mode[] = ["focus", "short", "long"];

export const MODE_LABEL: Record<Mode, string> = {
  focus: "Focus",
  short: "Short Break",
  long: "Long Break",
};

export interface Durations {
  focus: number; // minutes
  short: number;
  long: number;
}

export const DEFAULT_DURATIONS: Durations = { focus: 25, short: 5, long: 15 };
export const MIN_DURATION = 1;
export const MAX_DURATION = 120;

export interface TimerState {
  mode: Mode;
  status: Status;
  /** Remaining ms. Authoritative while ready/paused/complete. */
  remainingMs: number;
  /** Wall-clock ms when the running session ends. Only set while running. */
  endAt: number | null;
  /** Unique id per session, used so a completion is counted at most once. */
  sessionId: string | null;
  /** When the session was first started (not resumed). */
  sessionStartedAt: number | null;
  /** When the current pause began. */
  pausedAt: number | null;
  completedAt: number | null;
  /** Full length of the current session, fixed when it starts. */
  sessionDurationMs: number | null;
}

export interface Progress {
  completedFocus: number;
  lastCountedSessionId: string | null;
  /** Grid Credits earned from focus sessions (spent on upgrades). */
  credits: number;
  /** Focus sessions completed in a row without abandoning one. */
  streak: number;
}

/** True when leaving this timer would abandon a focus session (breaks the streak). */
export function abandonsFocus(t: TimerState): boolean {
  return t.mode === "focus" && (t.status === "running" || t.status === "paused");
}

/** Streak after the user resets or switches away from the current timer. */
export function streakAfterLeaving(t: TimerState, progress: Progress): Progress {
  return abandonsFocus(t) && progress.streak !== 0 ? { ...progress, streak: 0 } : progress;
}

export const CREDITS_PER_FULL_SESSION = 100;
export const FULL_SESSION_MINUTES = 25;

/** +100 for a 25-minute (or longer) focus session; shorter custom sessions earn pro rata. */
export function creditsForSession(durationMs: number | null): number {
  const minutes = (durationMs ?? FULL_SESSION_MINUTES * 60_000) / 60_000;
  if (minutes >= FULL_SESSION_MINUTES) return CREDITS_PER_FULL_SESSION;
  return Math.max(0, Math.round((CREDITS_PER_FULL_SESSION * minutes) / FULL_SESSION_MINUTES));
}

export const LONG_BREAK_EVERY = 4;
export const ENGAGED_WINDOW_MS = 6_000;
export const EXTENDED_PAUSE_MS = 2 * 60_000;

export function clampDuration(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_DURATION;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(minutes)));
}

export function fullDurationMs(mode: Mode, durations: Durations): number {
  return clampDuration(durations[mode]) * 60_000;
}

export function createReady(mode: Mode, durations: Durations): TimerState {
  return {
    mode,
    status: "ready",
    remainingMs: fullDurationMs(mode, durations),
    endAt: null,
    sessionId: null,
    sessionStartedAt: null,
    pausedAt: null,
    completedAt: null,
    sessionDurationMs: null,
  };
}

/** Breaks, and a finished focus session, use the warm cooldown palette. */
export function isRestPhase(t: TimerState): boolean {
  return t.mode !== "focus" || t.status === "complete";
}

export function remainingAt(t: TimerState, now: number): number {
  if (t.status === "running" && t.endAt !== null) return Math.max(0, t.endAt - now);
  return Math.max(0, t.remainingMs);
}

export function startTimer(
  t: TimerState,
  now: number,
  durations: Durations,
  newSessionId: string,
): TimerState {
  if (t.status === "running") return t;
  if (t.status === "paused") {
    return { ...t, status: "running", endAt: now + t.remainingMs, pausedAt: null };
  }
  // ready or complete → fresh session
  const base = t.status === "complete" ? createReady(t.mode, durations) : t;
  return {
    ...base,
    status: "running",
    endAt: now + base.remainingMs,
    sessionId: newSessionId,
    sessionStartedAt: now,
    pausedAt: null,
    completedAt: null,
    sessionDurationMs: base.remainingMs,
  };
}

export function pauseTimer(t: TimerState, now: number): TimerState {
  if (t.status !== "running") return t;
  return { ...t, status: "paused", remainingMs: remainingAt(t, now), endAt: null, pausedAt: now };
}

export function resetTimer(t: TimerState, durations: Durations): TimerState {
  return createReady(t.mode, durations);
}

export function switchMode(_t: TimerState, mode: Mode, durations: Durations): TimerState {
  return createReady(mode, durations);
}

/** Switching away would discard an in-progress session. */
export function needsSwitchConfirm(t: TimerState): boolean {
  return t.status === "running" || t.status === "paused";
}

export interface SettleResult {
  timer: TimerState;
  progress: Progress;
  justCompleted: boolean;
}

/**
 * Moves a running timer to "complete" if its end time has passed.
 * Focus sessions are counted once per sessionId; breaks never count.
 */
export function settle(t: TimerState, progress: Progress, now: number): SettleResult {
  if (t.status !== "running" || t.endAt === null || now < t.endAt) {
    return { timer: t, progress, justCompleted: false };
  }
  const timer: TimerState = {
    ...t,
    status: "complete",
    remainingMs: 0,
    completedAt: t.endAt,
    endAt: null,
    pausedAt: null,
  };
  let next = progress;
  if (t.mode === "focus" && t.sessionId && t.sessionId !== progress.lastCountedSessionId) {
    next = {
      completedFocus: progress.completedFocus + 1,
      lastCountedSessionId: t.sessionId,
      credits: progress.credits + creditsForSession(t.sessionDurationMs),
    };
  }
  return { timer, progress: next, justCompleted: true };
}

export function suggestedNextMode(mode: Mode, completedFocus: number): Mode {
  if (mode !== "focus") return "focus";
  return completedFocus > 0 && completedFocus % LONG_BREAK_EVERY === 0 ? "long" : "short";
}

export function sessionProgress(t: TimerState, now: number, durations: Durations): number {
  const full = fullDurationMs(t.mode, durations);
  if (t.status === "complete") return 1;
  return Math.min(1, Math.max(0, 1 - remainingAt(t, now) / full));
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------- Pomo-Bot ----------

export type BotState =
  | "standby"
  | "engaged"
  | "deepFocus"
  | "paused"
  | "extendedPause"
  | "cycleFinished"
  | "shortBreak"
  | "longBreak"
  | "milestone";

export const BOT_LINES: Record<BotState, string> = {
  standby: "Signal idle. Standing by when you’re ready.",
  engaged: "Channel cleared. Let’s do some good work.",
  deepFocus: "In the groove. Zero distractions.",
  paused: "Clock frozen. Take your breath.",
  extendedPause: "Holding your spot on the wire. No rush.",
  cycleFinished: "Cycle banked. Step away from the glass.",
  shortBreak: "Rest mode. Let the eyes adjust to distance.",
  longBreak: "Deep cooldown. Walk around, drink water.",
  milestone: "Four rounds logged. You’ve built real momentum today.",
};

export function botStateFor(t: TimerState, completedFocus: number, now: number): BotState {
  switch (t.status) {
    case "ready":
      return "standby";
    case "running":
      if (t.mode === "short") return "shortBreak";
      if (t.mode === "long") return "longBreak";
      return t.sessionStartedAt !== null && now - t.sessionStartedAt < ENGAGED_WINDOW_MS
        ? "engaged"
        : "deepFocus";
    case "paused":
      return t.pausedAt !== null && now - t.pausedAt >= EXTENDED_PAUSE_MS
        ? "extendedPause"
        : "paused";
    case "complete":
      if (t.mode !== "focus") return "standby";
      return completedFocus > 0 && completedFocus % LONG_BREAK_EVERY === 0
        ? "milestone"
        : "cycleFinished";
  }
}
