// Local-only persistence. Every field is validated independently so a corrupt
// or older save recovers to defaults while preserving whatever is still valid.
import {
  DEFAULT_DURATIONS,
  MODES,
  clampDuration,
  createReady,
  fullDurationMs,
  type Durations,
  type Mode,
  type Progress,
  type Status,
  type TimerState,
} from "./core";

export const STORAGE_KEY = "tempor:state";
export const STORAGE_VERSION = 1;

export type TrackId = "rain" | "synth" | "static" | "off";
export const TRACK_IDS: TrackId[] = ["rain", "synth", "static", "off"];

export interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  completedAt: number | null;
}

export interface AudioPrefs {
  track: TrackId;
  volume: number; // 0..1
  chime: boolean;
}

export interface SavedState {
  version: number;
  durations: Durations;
  timer: TimerState;
  progress: Progress;
  tasks: Task[];
  audio: AudioPrefs;
  botFrozen: boolean;
}

export const DEFAULT_AUDIO: AudioPrefs = { track: "off", volume: 0.5, chime: true };

export function defaultState(): SavedState {
  return {
    version: STORAGE_VERSION,
    durations: { ...DEFAULT_DURATIONS },
    timer: createReady("focus", DEFAULT_DURATIONS),
    progress: { completedFocus: 0, lastCountedSessionId: null },
    tasks: [],
    audio: { ...DEFAULT_AUDIO },
    botFrozen: false,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function parseDurations(v: unknown): Durations {
  const d = { ...DEFAULT_DURATIONS };
  if (!isObj(v)) return d;
  for (const m of MODES) if (isNum(v[m])) d[m] = clampDuration(v[m] as number);
  return d;
}

function parseTimer(v: unknown, durations: Durations): TimerState {
  if (!isObj(v)) return createReady("focus", durations);
  const mode: Mode = MODES.includes(v.mode as Mode) ? (v.mode as Mode) : "focus";
  const statuses: Status[] = ["ready", "running", "paused", "complete"];
  const status = statuses.includes(v.status as Status) ? (v.status as Status) : "ready";
  const full = fullDurationMs(mode, durations);
  const base = createReady(mode, durations);

  if (status === "ready") return base;

  const remaining = isNum(v.remainingMs) ? Math.min(full, Math.max(0, v.remainingMs)) : full;
  const common = {
    ...base,
    sessionId: strOrNull(v.sessionId),
    sessionStartedAt: numOrNull(v.sessionStartedAt),
  };

  if (status === "running") {
    const endAt = numOrNull(v.endAt);
    if (endAt === null) return base;
    return { ...common, status, endAt, remainingMs: remaining };
  }
  if (status === "paused") {
    return { ...common, status, remainingMs: remaining, pausedAt: numOrNull(v.pausedAt) };
  }
  return { ...common, status: "complete", remainingMs: 0, completedAt: numOrNull(v.completedAt) };
}

function parseProgress(v: unknown): Progress {
  if (!isObj(v)) return { completedFocus: 0, lastCountedSessionId: null };
  return {
    completedFocus:
      isNum(v.completedFocus) && v.completedFocus >= 0 ? Math.floor(v.completedFocus) : 0,
    lastCountedSessionId: strOrNull(v.lastCountedSessionId),
  };
}

function parseTasks(v: unknown): Task[] {
  if (!Array.isArray(v)) return [];
  const out: Task[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (!isObj(item) || typeof item.text !== "string" || !item.text.trim()) continue;
    let id = typeof item.id === "string" && item.id ? item.id : `t-${out.length}-${Date.now()}`;
    if (seen.has(id)) id = `${id}-${out.length}`;
    seen.add(id);
    out.push({
      id,
      text: item.text.slice(0, 200),
      done: item.done === true,
      createdAt: isNum(item.createdAt) ? item.createdAt : 0,
      completedAt: numOrNull(item.completedAt),
    });
  }
  return out;
}

function parseAudio(v: unknown): AudioPrefs {
  const a = { ...DEFAULT_AUDIO };
  if (!isObj(v)) return a;
  if (TRACK_IDS.includes(v.track as TrackId)) a.track = v.track as TrackId;
  if (isNum(v.volume)) a.volume = Math.min(1, Math.max(0, v.volume));
  if (typeof v.chime === "boolean") a.chime = v.chime;
  return a;
}

export function parseSaved(raw: string | null | undefined): SavedState {
  if (!raw) return defaultState();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultState();
  }
  if (!isObj(data)) return defaultState();
  const durations = parseDurations(data.durations);
  return {
    version: STORAGE_VERSION,
    durations,
    timer: parseTimer(data.timer, durations),
    progress: parseProgress(data.progress),
    tasks: parseTasks(data.tasks),
    audio: parseAudio(data.audio),
    botFrozen: data.botFrozen === true,
  };
}

export function loadState(): SavedState {
  try {
    return parseSaved(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultState();
  }
}

export function saveState(s: SavedState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // storage full or blocked — app keeps working in memory
  }
}
