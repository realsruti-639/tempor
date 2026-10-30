import { describe, expect, it } from "vitest";

import { DEFAULT_DURATIONS, createReady, pauseTimer, startTimer } from "./core";
import { defaultState, parseSaved } from "./storage";

describe("saved-state recovery", () => {
  it("falls back to defaults for missing or malformed data", () => {
    expect(parseSaved(null)).toEqual(defaultState());
    expect(parseSaved("{not json")).toEqual(defaultState());
    expect(parseSaved("[1,2,3]")).toEqual(defaultState());
    expect(parseSaved('"hello"')).toEqual(defaultState());
  });

  it("keeps valid fields when others are broken", () => {
    const s = parseSaved(
      JSON.stringify({
        tasks: [{ id: "a", text: "Write intro", done: false }, { nope: true }, 42],
        progress: { completedFocus: 6 },
        durations: { focus: "abc", short: 10 },
        timer: { status: "exploded" },
        audio: { levels: { rain: 2, alpha: "x", stream: 0.3 }, volume: 3 },
        cosmetics: { owned: ["shades", "crown"], equipped: ["shades", "wings"] },
      }),
    );
    expect(s.tasks).toHaveLength(1);
    expect(s.tasks[0]?.text).toBe("Write intro");
    expect(s.progress.completedFocus).toBe(6);
    expect(s.durations).toEqual({ focus: 25, short: 10, long: 15 });
    expect(s.timer.status).toBe("ready");
    expect(s.audio.levels).toEqual({ rain: 1, alpha: 0, stream: 0.3 });
    expect(s.audio.volume).toBe(1);
    expect(s.cosmetics).toEqual({ owned: ["shades"], equipped: ["shades"] });
  });

  it("restores a paused timer with the same remaining time", () => {
    const paused = pauseTimer(startTimer(createReady("focus", DEFAULT_DURATIONS), 0, DEFAULT_DURATIONS, "s1"), 90_000);
    const s = parseSaved(JSON.stringify({ ...defaultState(), timer: paused }));
    expect(s.timer.status).toBe("paused");
    expect(s.timer.remainingMs).toBe(25 * 60_000 - 90_000);
  });

  it("keeps a running timer's end time so remaining time is recalculated", () => {
    const running = startTimer(createReady("focus", DEFAULT_DURATIONS), 5_000, DEFAULT_DURATIONS, "s1");
    const s = parseSaved(JSON.stringify({ ...defaultState(), timer: running }));
    expect(s.timer.status).toBe("running");
    expect(s.timer.endAt).toBe(5_000 + 25 * 60_000);
  });

  it("uses a saved custom duration on a new visit", () => {
    const s = parseSaved(JSON.stringify({ durations: { focus: 50 } }));
    expect(s.timer.mode).toBe("focus");
    expect(s.timer.remainingMs).toBe(50 * 60_000);
  });

  it("keeps credits and equipped cosmetics across reloads", () => {
    const saved = { ...defaultState(), progress: { completedFocus: 5, lastCountedSessionId: "x", credits: 250 }, cosmetics: { owned: ["shades", "wings"], equipped: ["wings"] } };
    const s = parseSaved(JSON.stringify(saved));
    expect(s.progress.credits).toBe(250);
    expect(s.cosmetics).toEqual({ owned: ["shades", "wings"], equipped: ["wings"] });
  });

  it("migrates a v1 single-track sound choice into mixer levels", () => {
    const s = parseSaved(JSON.stringify({ audio: { track: "static", volume: 0.4 } }));
    expect(s.audio.levels).toEqual({ rain: 0, alpha: 0, stream: 0.7 });
    expect(s.progress.credits).toBe(0);
  });
});
