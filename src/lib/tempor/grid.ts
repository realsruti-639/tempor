// Cyber-Grid Neon-Net: a mock "room" of network agents. Pure + deterministic —
// each agent's phase is derived from wall-clock time, so it ticks in real time
// and survives reloads without any server.

export type AgentId = "akira" | "byte" | "ghost";

export interface Agent {
  id: AgentId;
  handle: string;
  focusMin: number;
  breakMin: number;
  /** Shifts the agent's cycle so the room is never in sync. */
  offsetMin: number;
}

export const AGENTS: Agent[] = [
  { id: "akira", handle: "Akira_Focus", focusMin: 25, breakMin: 5, offsetMin: 11 },
  { id: "byte", handle: "Byte_Me", focusMin: 50, breakMin: 10, offsetMin: 3 },
  { id: "ghost", handle: "Neon_Ghost", focusMin: 25, breakMin: 5, offsetMin: 23 },
];

export interface AgentStatus {
  phase: "flowing" | "cooling";
  remainingMs: number;
  /** 0..1 through the current phase. */
  progress: number;
}

export function agentStatus(a: Agent, now: number): AgentStatus {
  const cycle = (a.focusMin + a.breakMin) * 60_000;
  const pos = (((now + a.offsetMin * 60_000) % cycle) + cycle) % cycle;
  const focusMs = a.focusMin * 60_000;
  if (pos < focusMs) return { phase: "flowing", remainingMs: focusMs - pos, progress: pos / focusMs };
  const breakMs = a.breakMin * 60_000;
  return { phase: "cooling", remainingMs: cycle - pos, progress: (pos - focusMs) / breakMs };
}

/** Ticker text, e.g. `[FLOWING: 14m remaining]` or `[COOLING DOWN]`. */
export function tickerLabel(s: AgentStatus): string {
  if (s.phase === "cooling") return "[COOLING DOWN]";
  const m = Math.ceil(s.remainingMs / 60_000);
  return `[FLOWING: ${m}m remaining]`;
}

export interface GridMessage {
  agent: AgentId;
  handle: string;
  text: string;
}

/** Exact line sent when the user finishes a full focus block. */
export const FOCUS_BLOCK_LINE = "Massive push, operator! Locking into my next block now.";

const TASK_LINES: [AgentId, string][] = [
  ["byte", "Clean commit. That one’s off the board."],
  ["ghost", "Saw that ping on the grid. Quiet work, loud results."],
  ["akira", "Another node cleared. Keep the line warm."],
  ["byte", "Queue shrinking. I can feel the bandwidth from here."],
  ["ghost", "Signal received. Your trace is glowing."],
];

const handleOf = (id: AgentId) => AGENTS.find((a) => a.id === id)!.handle;

/** Agent reaction for a user event; `n` rotates task lines. */
export function gridReaction(event: "focus" | "task", n: number): GridMessage {
  if (event === "focus") return { agent: "akira", handle: handleOf("akira"), text: FOCUS_BLOCK_LINE };
  const [agent, text] = TASK_LINES[((n % TASK_LINES.length) + TASK_LINES.length) % TASK_LINES.length]!;
  return { agent, handle: handleOf(agent), text };
}
