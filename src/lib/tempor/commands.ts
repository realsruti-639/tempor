// Ghost Terminal parser: slash commands plus a few plain-language phrases.
// Plain text that matches nothing becomes a new task (zero friction).

export type Command =
  | { type: "empty" }
  | { type: "add"; text: string }
  | { type: "start" }
  | { type: "pause" }
  | { type: "break"; long: boolean }
  | { type: "focus" }
  | { type: "reset" }
  | { type: "help" }
  | { type: "stress"; text: string }
  | { type: "overclock" }
  | { type: "unknown"; input: string };

export interface CommandHint {
  usage: string;
  insert: string;
  description: string;
}

export const COMMAND_HINTS: CommandHint[] = [
  { usage: "/add <task>", insert: "/add ", description: "Queue a task in the terminal" },
  { usage: "/stress <brain dump>", insert: "/stress ", description: "Deck Officer splits it into 3 sub-tasks" },
  { usage: "/start", insert: "/start", description: "Start or resume the timer" },
  { usage: "/pause", insert: "/pause", description: "Hold the clock" },
  { usage: "/break", insert: "/break", description: "Switch to a short rest" },
  { usage: "/break long", insert: "/break long", description: "Switch to a long rest" },
  { usage: "/focus", insert: "/focus", description: "Back to focus mode" },
  { usage: "/reset", insert: "/reset", description: "Reset the current timer" },
  { usage: "/overclock", insert: "/overclock", description: "Toggle Overclock mode" },
];

const ADD_WORDS = ["add", "todo", "task", "new", "+"];
const STRESS_WORDS = ["stress", "dump", "braindump", "overwhelmed"];
const START_WORDS = ["start", "go", "begin", "resume", "play", "run"];
const PAUSE_WORDS = ["pause", "stop", "hold", "halt", "freeze"];
const BREAK_WORDS = ["break", "rest", "short", "chill"];
const LONG_WORDS = ["long", "longbreak", "cooldown"];
const FOCUS_WORDS = ["focus", "work"];
const RESET_WORDS = ["reset", "restart", "clear"];
const HELP_WORDS = ["help", "?", "commands"];

const FILLER = new Set(["a", "the", "timer", "clock", "session", "please", "now", "mode", "take", "me", "to"]);

export function parseCommand(raw: string): Command {
  const input = raw.trim().replace(/\s+/g, " ");
  if (!input) return { type: "empty" };

  const slash = input.startsWith("/");
  const body = slash ? input.slice(1) : input;

  // "+ task" shorthand
  if (body.startsWith("+")) {
    const text = body.slice(1).trim();
    return text ? { type: "add", text } : { type: "empty" };
  }

  const [first = "", ...rest] = body.split(" ");
  const head = first.toLowerCase();
  const tail = rest.join(" ").trim();

  if (ADD_WORDS.includes(head)) {
    return tail ? { type: "add", text: tail } : { type: "empty" };
  }
  if (slash && STRESS_WORDS.includes(head)) {
    return tail ? { type: "stress", text: tail.slice(0, 300) } : { type: "empty" };
  }
  if (slash && head === "overclock" && !tail) return { type: "overclock" };

  // Remaining words with filler removed, for phrases like "take a long break".
  const words = body
    .toLowerCase()
    .split(" ")
    .filter((w) => !FILLER.has(w));
  const only = (set: string[]) => words.length > 0 && words.every((w) => set.includes(w));
  const has = (set: string[]) => words.some((w) => set.includes(w));

  if (words.length > 0 && words.length <= 3) {
    if (has(LONG_WORDS) && (has(BREAK_WORDS) || only(LONG_WORDS))) return { type: "break", long: true };
    if (only(BREAK_WORDS)) return { type: "break", long: false };
    if (only(PAUSE_WORDS)) return { type: "pause" };
    if (only(RESET_WORDS)) return { type: "reset" };
    if (only(HELP_WORDS)) return { type: "help" };
    if (only([...START_WORDS, ...FOCUS_WORDS])) {
      return has(START_WORDS) ? { type: "start" } : { type: "focus" };
    }
  }

  if (slash) return { type: "unknown", input };
  return { type: "add", text: input };
}

export function describeCommand(c: Command): string {
  switch (c.type) {
    case "empty":
      return "Type a command or a task";
    case "add":
      return `Add task: ${c.text}`;
    case "start":
      return "Start the timer";
    case "pause":
      return "Pause the timer";
    case "break":
      return c.long ? "Switch to Long Break" : "Switch to Short Break";
    case "focus":
      return "Switch to Focus";
    case "reset":
      return "Reset the timer";
    case "help":
      return "Show commands";
    case "stress":
      return "Brain dump → Deck Officer breaks it into 3 sub-tasks";
    case "overclock":
      return "Toggle Overclock mode";
    case "unknown":
      return `Unknown command ${c.input.split(" ")[0]}`;
  }
}
