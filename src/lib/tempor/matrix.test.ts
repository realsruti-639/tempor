import { describe, expect, it } from "vitest";
import { DEFAULT_DURATIONS, remainingAt } from "./core";
import { bioPhaseAt, bioTracks, coolingTimer, freshStamina, freshWorkspace, staminaAfter, unlockSkin } from "./matrix";

describe("Bio-Sync", () => {
  it("is Neon Surge in the day and Chilled Ember in the evening", () => {
    expect(bioPhaseAt(9)).toBe("surge");
    expect(bioPhaseAt(17)).toBe("surge");
    expect(bioPhaseAt(18)).toBe("ember");
    expect(bioPhaseAt(3)).toBe("ember");
  });
  it("recommends Cyber-Grid Metronome by day and calm tracks at night", () => {
    expect(bioTracks("surge")).toContain("grid-metronome");
    expect(bioTracks("ember")).toEqual(expect.arrayContaining(["hover-car", "terminal-echo"]));
  });
});

describe("stamina", () => {
  it("hits critical on the third back-to-back focus session, counted once each", () => {
    let s = freshStamina();
    for (const id of ["a", "b"]) {
      const r = staminaAfter(s, "focus", id, 25 * 60_000);
      expect(r.critical).toBe(false);
      s = r.stamina;
    }
    expect(staminaAfter(s, "focus", "b", 0).stamina).toBe(s);
    expect(staminaAfter(s, "focus", "c", 0).critical).toBe(true);
  });
  it("a 5-minute break fully restores stamina", () => {
    const low = { ...freshStamina(), value: 0 };
    expect(staminaAfter(low, "short", "x", 5 * 60_000).stamina.value).toBe(100);
  });
  it("mandatory cooling is a running 5-minute break", () => {
    const t = coolingTimer(1000, DEFAULT_DURATIONS, "c");
    expect(t.mode).toBe("short");
    expect(remainingAt(t, 1000)).toBe(5 * 60_000);
  });
});

describe("workspace skins", () => {
  it("costs 600 / 800 / 1000 credits and refuses when short", () => {
    expect(unlockSkin(freshWorkspace(), 599, "arcade").ok).toBe(false);
    const r = unlockSkin(freshWorkspace(), 900, "noir");
    expect(r).toMatchObject({ ok: true, credits: 100, workspace: { owned: ["noir"], skin: "noir" } });
    expect(unlockSkin(freshWorkspace(), 999, "ocean").ok).toBe(false);
  });
});
