// v4 pure logic: circadian phase, mascot stamina and workspace skins.
import { createReady, startTimer, type Durations, type Mode, type TimerState } from "./core";
import type { TrackId } from "./tracks";

export type BioPhase = "surge" | "ember";
/** Neon Surge 07:00–17:59 local time, Chilled Ember otherwise. */
export const bioPhaseAt = (hour: number): BioPhase => (hour >= 7 && hour < 18 ? "surge" : "ember");
export const bioTracks = (p: BioPhase): TrackId[] =>
  p === "surge" ? ["grid-metronome", "neon-horizon"] : ["hover-car", "terminal-echo"];

export const COOLING_MS = 5 * 60_000;
export const FOCUS_DRAIN = 35;
export const OVERRIDE_TAG = "SYSTEM OVERRIDE";
export const OVERRIDE_LINE =
  "Operator stamina critical. Initiating mandatory 5-minute cooling cycle. Step away and hydrate.";

export interface Stamina {
  value: number; // 0..100
  lastSessionId: string | null;
  coolingUntil: number | null;
}
export const freshStamina = (): Stamina => ({ value: 100, lastSessionId: null, coolingUntil: null });
export const coolingActive = (s: Stamina, now: number) => s.coolingUntil !== null && now < s.coolingUntil;
export const fatigued = (s: Stamina) => s.value <= 30;

/** Stamina after a completed session (once per sessionId). `critical` → mandatory cooling. */
export function staminaAfter(
  s: Stamina,
  mode: Mode,
  sessionId: string | null,
  durationMs: number | null,
): { stamina: Stamina; critical: boolean } {
  if (!sessionId || sessionId === s.lastSessionId) return { stamina: s, critical: false };
  if (mode === "focus") {
    const value = Math.max(0, s.value - FOCUS_DRAIN);
    return { stamina: { ...s, value, lastSessionId: sessionId }, critical: value === 0 };
  }
  const full = (durationMs ?? 0) >= COOLING_MS;
  return {
    stamina: { value: full ? 100 : Math.min(100, s.value + 40), lastSessionId: sessionId, coolingUntil: null },
    critical: false,
  };
}

/** A running 5-minute break starting at `at` (the focus end time). */
export function coolingTimer(at: number, durations: Durations, id: string): TimerState {
  const ready = { ...createReady("short", durations), remainingMs: COOLING_MS };
  return startTimer(ready, at, durations, id);
}

export type SkinId = "arcade" | "noir" | "ocean";
export const SKINS: { id: SkinId; name: string; cost: number; texture: string }[] = [
  { id: "arcade", name: "Retro Arcade 198X", cost: 600, texture: "Pixel lattice · phosphor rim" },
  { id: "noir", name: "Tokyo Noir Night", cost: 800, texture: "Rain-slick lines · orchid glass" },
  { id: "ocean", name: "Deep Ocean Submersible Terminal", cost: 1000, texture: "Sonar grid · sea-green glow" },
];
export const isSkin = (x: unknown): x is SkinId => SKINS.some((s) => s.id === x);

export interface Workspace {
  hud: boolean;
  bioSync: boolean;
  owned: SkinId[];
  skin: SkinId | null;
}
export const freshWorkspace = (): Workspace => ({ hud: false, bioSync: false, owned: [], skin: null });

export function unlockSkin(w: Workspace, credits: number, id: SkinId) {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin || w.owned.includes(id) || credits < skin.cost) return { ok: false as const, workspace: w, credits };
  return { ok: true as const, workspace: { ...w, owned: [...w.owned, id], skin: id }, credits: credits - skin.cost };
}
