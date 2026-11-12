import { createReady, settle, startTimer, type TimerState, type Progress } from "./core";
import type { TrackId } from "./tracks";

export type BioPhase = "surge" | "ember";
export function bioPhaseAt(hour: number): BioPhase {
  return hour >= 7 && hour < 18 ? "surge" : "ember";
}
export function bioTracks(phase: BioPhase): TrackId[] {
  return phase === "surge" ? ["grid-metronome", "neon-horizon"] : ["hover-car", "terminal-echo"];
}

export const COOLING_MS = 5 * 60_000;
export const OVERRIDE_LINE = "Operator stamina critical. Initiating mandatory 5-minute cooling cycle. Step away and hydrate.";
export interface Stamina {
  value: number;
  lastSessionId: string | null;
  coolingUntil: number | null;
}
export const freshStamina = (): Stamina => ({ value: 100, lastSessionId: null, coolingUntil: null });
export const coolingActive = (s: Stamina, now: number) => s.coolingUntil !== null && now < s.coolingUntil;

/** One atomic reconciliation for timer rewards and stamina; safe on reload and stale state. */
export function settleMatrix(timer: TimerState, progress: Progress, stamina: Stamina, now: number) {
  const result = settle(timer, progress, now);
  let next = { ...stamina };
  let override = false;
  if (next.coolingUntil !== null && now >= next.coolingUntil) {
    next.value = 100;
    next.coolingUntil = null;
  }
  if (result.justCompleted && timer.sessionId && timer.sessionId !== next.lastSessionId) {
    next.lastSessionId = timer.sessionId;
    if (timer.mode === "focus") {
      next.value = Math.max(0, next.value - 35);
      if (next.value === 0) {
        const completedAt = timer.endAt ?? now;
        const coolingUntil = completedAt + COOLING_MS;
        const cooling = startTimer(createReady("short", { focus: 25, short: 5, long: 15 }), completedAt,
          { focus: 25, short: 5, long: 15 }, `cooling-${timer.sessionId}`);
        const cooled = settle(cooling, result.progress, now);
        result.timer = cooled.timer;
        next.coolingUntil = now < coolingUntil ? coolingUntil : null;
        if (now >= coolingUntil) next.value = 100;
        override = true;
      }
    } else if ((timer.sessionDurationMs ?? 0) >= COOLING_MS) {
      next.value = 100;
    }
  }
  return { ...result, stamina: next, override };
}

export type SkinId = "arcade" | "noir" | "ocean";
export const SKINS: { id: SkinId; name: string; cost: number; texture: string }[] = [
  { id: "arcade", name: "Retro Arcade 198X", cost: 600, texture: "Pixel lattice · phosphor rim" },
  { id: "noir", name: "Tokyo Noir Night", cost: 800, texture: "Rain-slick lines · orchid glass" },
  { id: "ocean", name: "Deep Ocean Submersible Terminal", cost: 1000, texture: "Sonar grid · sea-green glow" },
];
export interface Workspace { hud: boolean; bioSync: boolean; owned: SkinId[]; skin: SkinId | null }
export const freshWorkspace = (): Workspace => ({ hud: false, bioSync: false, owned: [], skin: null });
export const isSkin = (x: unknown): x is SkinId => SKINS.some((s) => s.id === x);
export function unlockSkin(workspace: Workspace, credits: number, id: SkinId) {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin || workspace.owned.includes(id) || credits < skin.cost) return { workspace, credits };
  return { workspace: { ...workspace, owned: [...workspace.owned, id], skin: id }, credits: credits - skin.cost };
}