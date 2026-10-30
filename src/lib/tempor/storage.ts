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
import { COSMETIC_IDS, type CosmeticId } from "./upgrades";

export const STORAGE_KEY = "tempor:state";
export const STORAGE_VERSION = 2;

export type ChannelId = "rain" | "alpha" | "stream";
export const CHANNEL_IDS: ChannelId[] = ["rain", "alpha", "stream"];
export type ChannelLevels = Record<ChannelId, number>;

export interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  completedAt: number | null;
}

export interface AudioPrefs {
  /** Per-channel mixer level 0..1. */
  levels: ChannelLevels;
  volume: number; // master 0..1
  chime: boolean;
}

export interface Cosmetics {
  owned: CosmeticId[];
  equipped: CosmeticId[];
}

export interface SavedState {
  version: number;
  durations: Durations;
  timer: TimerState;
  progress: Progress;
  tasks: Task[];
  audio: AudioPrefs;
  cosmetics: Cosmetics;
  botFrozen: boolean;
}

export const DEFAULT_LEVELS: ChannelLevels = { rain: 0.7, alpha: 0, stream: 0 };
export const DEFAULT_AUDIO: AudioPrefs = { levels: { ...DEFAULT_LEVELS }, volume: 0.5, chime: true };

export function defaultState(): SavedState {
  return {
    version: STORAGE_VERSION,
    durations: { ...DEFAULT_DURATIONS },
    timer: createReady("focus", DEFAULT_DURATIONS),
    progress: { completedFocus: 0, lastCountedSessionId: null, credits: 0 },
    tasks: [],
    audio: { ...DEFAULT_AUDIO, levels: { ...DEFAULT_LEVELS } },
    cosmetics: { owned: [], equipped: [] },
    botFrozen: false,
  };
}

type Key =
  | "id" | "text" | "done" | "createdAt" | "completedAt"
  | "track" | "levels" | "volume" | "chime"
  | "durations" | "timer" | "progress" | "tasks" | "audio" | "cosmetics" | "botFrozen"
  | "owned" | "equipped" | "credits"
  | "mode" | "status" | "remainingMs" | "endAt" | "sessionId" | "sessionStartedAt" | "pausedAt"
  | "sessionDurationMs" | "completedFocus" | "lastCountedSessionId" | Mode | ChannelId;
type Bag = Partial<Record<Key, unknown>>;

const isObj = (v: unknown): v is Bag =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

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
  const savedLen = numOrNull(v.sessionDurationMs);
  const common = {
    ...base,
    sessionId: strOrNull(v.sessionId),
    sessionStartedAt: numOrNull(v.sessionStartedAt),
    // older saves have no session length: assume the configured one
    sessionDurationMs: savedLen !== null && savedLen > 0 ? savedLen : full,
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
  const p: Progress = { completedFocus: 0, lastCountedSessionId: null, credits: 0 };
  if (!isObj(v)) return p;
  if (isNum(v.completedFocus) && v.completedFocus >= 0) p.completedFocus = Math.floor(v.completedFocus);
  p.lastCountedSessionId = strOrNull(v.lastCountedSessionId);
  if (isNum(v.credits) && v.credits >= 0) p.credits = Math.floor(v.credits);
  return p;
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

const LEGACY_TRACK: Record<string, ChannelId> = { rain: "rain", synth: "alpha", static: "stream" };

function parseAudio(v: unknown): AudioPrefs {
  const a: AudioPrefs = { ...DEFAULT_AUDIO, levels: { ...DEFAULT_LEVELS } };
  if (!isObj(v)) return a;
  if (isObj(v.levels)) {
    const lv = v.levels;
    for (const c of CHANNEL_IDS) if (isNum(lv[c])) a.levels[c] = clamp01(lv[c] as number);
  } else if (typeof v.track === "string" && LEGACY_TRACK[v.track]) {
    // v1 single-track save → mixer levels
    a.levels = { rain: 0, alpha: 0, stream: 0, [LEGACY_TRACK[v.track]!]: 0.7 };
  }
  if (isNum(v.volume)) a.volume = clamp01(v.volume);
  if (typeof v.chime === "boolean") a.chime = v.chime;
  return a;
}

function parseCosmetics(v: unknown): Cosmetics {
  const c: Cosmetics = { owned: [], equipped: [] };
  if (!isObj(v)) return c;
  const ids = (x: unknown) =>
    Array.isArray(x)
      ? [...new Set(x.filter((i): i is CosmeticId => COSMETIC_IDS.includes(i as CosmeticId)))]
      : [];
  c.owned = ids(v.owned);
  c.equipped = ids(v.equipped).filter((i) => c.owned.includes(i));
  return c;
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
    cosmetics: parseCosmetics(data.cosmetics),
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
