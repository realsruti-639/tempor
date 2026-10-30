import { describe, expect, it } from "vitest";

import { parseCommand } from "./commands";

describe("Ghost Terminal parser", () => {
  it("/add inserts a task", () => {
    expect(parseCommand("/add Code the API core")).toEqual({ type: "add", text: "Code the API core" });
  });

  it("/start, /pause and /break map to timer actions", () => {
    expect(parseCommand("/start")).toEqual({ type: "start" });
    expect(parseCommand("/pause")).toEqual({ type: "pause" });
    expect(parseCommand("/break")).toEqual({ type: "break", long: false });
    expect(parseCommand("/break long")).toEqual({ type: "break", long: true });
  });

  it("understands a few plain phrases", () => {
    expect(parseCommand("take a break")).toEqual({ type: "break", long: false });
    expect(parseCommand("long break")).toEqual({ type: "break", long: true });
    expect(parseCommand("start focus")).toEqual({ type: "start" });
    expect(parseCommand("pause timer")).toEqual({ type: "pause" });
  });

  it("plain text that isn't a command becomes a task", () => {
    expect(parseCommand("Review pull request")).toEqual({ type: "add", text: "Review pull request" });
    expect(parseCommand("go to the gym")).toEqual({ type: "add", text: "go to the gym" });
  });

  it("flags unknown slash commands and ignores empty input", () => {
    expect(parseCommand("/strat")).toEqual({ type: "unknown", input: "/strat" });
    expect(parseCommand("   ")).toEqual({ type: "empty" });
    expect(parseCommand("/add")).toEqual({ type: "empty" });
  });
});
