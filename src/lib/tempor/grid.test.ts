import { describe, expect, it } from "vitest";
import { agentStatus, gridReaction } from "./grid";

describe("Grid Room simulation", () => {
  it("derives agent phases and remaining time from the wall clock", () => {
    const agent = { id: "akira" as const, handle: "Akira_Focus", focusMin: 25, breakMin: 5, offsetMin: 0 };
    expect(agentStatus(agent, 11 * 60_000)).toMatchObject({ phase: "flowing", remainingMs: 14 * 60_000 });
    expect(agentStatus(agent, 25 * 60_000)).toMatchObject({ phase: "cooling", remainingMs: 5 * 60_000 });
    expect(agentStatus(agent, 30 * 60_000)).toMatchObject({ phase: "flowing", remainingMs: 25 * 60_000 });
  });

  it("routes focus reactions to Akira and rotates task reactions", () => {
    expect(gridReaction("focus", 0).agent).toBe("akira");
    expect(gridReaction("task", 0).agent).toBe("byte");
    expect(gridReaction("task", 1).agent).toBe("ghost");
  });
});