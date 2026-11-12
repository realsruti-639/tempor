import { describe, expect, it } from "vitest";
import { breakdownStress, deckLine, preparesSynthTrack } from "./deck";
import { parseCommand } from "./commands";
import { CHANNELS, TRACK_IDS } from "./tracks";

describe("v3 Deck Officer", () => {
  it("prepares the synth only after two consecutive focus completions", () => {
    expect(preparesSynthTrack(1)).toBe(false);
    expect(preparesSynthTrack(2)).toBe(true);
    expect(preparesSynthTrack(3)).toBe(false);
    expect(deckLine({ type: "focus-complete", streak: 2 })).not.toBeNull();
  });

  it("parses a brain dump and produces exactly three distinct tasks locally", () => {
    const text = "I have too much code to review";
    expect(parseCommand(`/stress ${text}`)).toEqual({ type: "stress", text });
    const tasks = breakdownStress(text);
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks).size).toBe(3);
    expect(tasks[0]).toContain("code");
    expect(parseCommand("/stress")).toEqual({ type: "empty" });
  });

  it("provides nine tracks split equally across three channels", () => {
    expect(TRACK_IDS).toHaveLength(9);
    expect(Object.values(CHANNELS).map((c) => c.tracks.length)).toEqual([3, 3, 3]);
  });
});