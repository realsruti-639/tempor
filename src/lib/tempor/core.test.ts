import { describe, expect, it } from "vitest";

import {
  BOT_LINES,
  DEFAULT_DURATIONS,
  botStateFor,
  creditsForSession,
  isRestPhase,
  createReady,
  needsSwitchConfirm,
  pauseTimer,
  remainingAt,
  resetTimer,
  settle,
  startTimer,
  suggestedNextMode,
  type Progress,
} from "./core";

const D = DEFAULT_DURATIONS;
const P0: Progress = { completedFocus: 0, lastCountedSessionId: null, credits: 0 };
const MIN = 60_000;

describe("timer", () => {
  it("starts in Focus at 25:00", () => {
    const t = createReady("focus", D);
    expect(t.mode).toBe("focus");
    expect(t.remainingMs).toBe(25 * MIN);
  });

  it("pause freezes exact remaining time and start resumes from it", () => {
    let t = startTimer(createReady("focus", D), 0, D, "s1");
    t = pauseTimer(t, 7 * MIN + 1234);
    expect(t.status).toBe("paused");
    expect(t.remainingMs).toBe(25 * MIN - (7 * MIN + 1234));
    // a long gap while paused changes nothing
    expect(remainingAt(t, 999 * MIN)).toBe(25 * MIN - (7 * MIN + 1234));
    t = startTimer(t, 1000 * MIN, D, "ignored");
    expect(t.sessionId).toBe("s1");
    expect(remainingAt(t, 1000 * MIN + 1000)).toBe(25 * MIN - (7 * MIN + 1234) - 1000);
  });

  it("measures time from wall clock, so a backgrounded tab stays accurate", () => {
    const t = startTimer(createReady("focus", D), 1_000, D, "s1");
    expect(remainingAt(t, 1_000 + 10 * MIN)).toBe(15 * MIN);
  });

  it("reset returns to full duration and never counts a session", () => {
    let t = startTimer(createReady("focus", D), 0, D, "s1");
    t = resetTimer(t, D);
    expect(t.status).toBe("ready");
    expect(t.remainingMs).toBe(25 * MIN);
    expect(settle(t, P0, 99 * MIN).progress.completedFocus).toBe(0);
  });

  it("counts a completed focus session exactly once", () => {
    const t = startTimer(createReady("focus", D), 0, D, "s1");
    const a = settle(t, P0, 25 * MIN);
    expect(a.justCompleted).toBe(true);
    expect(a.timer.status).toBe("complete");
    expect(a.progress.completedFocus).toBe(1);
    // settling again (e.g. re-render / reload) does not double count
    const b = settle(a.timer, a.progress, 30 * MIN);
    expect(b.progress.completedFocus).toBe(1);
    // even if the stale running state is seen again
    const c = settle(t, a.progress, 30 * MIN);
    expect(c.progress.completedFocus).toBe(1);
  });

  it("break timers do not increase the focus count", () => {
    const t = startTimer(createReady("short", D), 0, D, "b1");
    const r = settle(t, P0, 5 * MIN);
    expect(r.timer.status).toBe("complete");
    expect(r.progress.completedFocus).toBe(0);
  });

  it("a session that elapsed while the page was closed restores as complete", () => {
    const t = startTimer(createReady("focus", D), 0, D, "s1");
    const r = settle(t, P0, 3 * 60 * MIN);
    expect(r.timer.status).toBe("complete");
    expect(r.progress.completedFocus).toBe(1);
  });

  it("asks to confirm switching modes only when a session is in progress", () => {
    const ready = createReady("focus", D);
    expect(needsSwitchConfirm(ready)).toBe(false);
    const running = startTimer(ready, 0, D, "s1");
    expect(needsSwitchConfirm(running)).toBe(true);
    expect(needsSwitchConfirm(pauseTimer(running, 1000))).toBe(true);
  });

  it("suggests a long break after every 4th focus session", () => {
    expect(suggestedNextMode("focus", 3)).toBe("short");
    expect(suggestedNextMode("focus", 4)).toBe("long");
    expect(suggestedNextMode("focus", 8)).toBe("long");
    expect(suggestedNextMode("short", 4)).toBe("focus");
  });
});

describe("Pomo-Bot", () => {
  it("is on standby before a session", () => {
    expect(botStateFor(createReady("focus", D), 0, 0)).toBe("standby");
  });

  it("engages at start, then settles into deep focus", () => {
    const t = startTimer(createReady("focus", D), 0, D, "s1");
    expect(botStateFor(t, 0, 1000)).toBe("engaged");
    expect(botStateFor(t, 0, 30_000)).toBe("deepFocus");
  });

  it("switches to the extended pause line after 2 minutes paused", () => {
    const t = pauseTimer(startTimer(createReady("focus", D), 0, D, "s1"), 60_000);
    expect(botStateFor(t, 0, 60_000 + 119_000)).toBe("paused");
    expect(botStateFor(t, 0, 60_000 + 120_000)).toBe("extendedPause");
  });

  it("shows the milestone every 4 completed focus sessions", () => {
    const t = settle(startTimer(createReady("focus", D), 0, D, "s"), P0, 25 * MIN).timer;
    expect(botStateFor(t, 3, 0)).toBe("cycleFinished");
    expect(botStateFor(t, 4, 0)).toBe("milestone");
    expect(BOT_LINES.milestone).toBe("Four rounds logged. You’ve built real momentum today.");
  });

  it("uses break lines during breaks", () => {
    expect(botStateFor(startTimer(createReady("short", D), 0, D, "b"), 0, 10)).toBe("shortBreak");
    expect(botStateFor(startTimer(createReady("long", D), 0, D, "b"), 0, 10)).toBe("longBreak");
  });
});

describe("Grid Credits", () => {
  it("awards +100 for a completed 25-minute focus session", () => {
    const t = startTimer(createReady("focus", D), 0, D, "s1");
    expect(settle(t, P0, 25 * MIN).progress.credits).toBe(100);
  });

  it("awards credits only once per session", () => {
    const t = startTimer(createReady("focus", D), 0, D, "s1");
    const a = settle(t, P0, 25 * MIN);
    expect(settle(t, a.progress, 26 * MIN).progress.credits).toBe(100);
  });

  it("never awards credits for breaks or resets", () => {
    const b = startTimer(createReady("short", D), 0, D, "b1");
    expect(settle(b, P0, 5 * MIN).progress.credits).toBe(0);
    const r = resetTimer(startTimer(createReady("focus", D), 0, D, "s2"), D);
    expect(settle(r, P0, 30 * MIN).progress.credits).toBe(0);
  });

  it("caps at 100 for longer sessions and pro-rates shorter ones", () => {
    expect(creditsForSession(50 * MIN)).toBe(100);
    expect(creditsForSession(10 * MIN)).toBe(40);
  });
});

describe("cooldown phase", () => {
  it("turns on when focus hits 00:00 and during breaks", () => {
    const t = startTimer(createReady("focus", D), 0, D, "s1");
    expect(isRestPhase(t)).toBe(false);
    expect(isRestPhase(settle(t, P0, 25 * MIN).timer)).toBe(true);
    expect(isRestPhase(createReady("short", D))).toBe(true);
  });
});
