// AI Deck-Officer: a local, simulated co-pilot. Pure functions only —
// no network, no model; lines and task breakdowns are rule-based.

export const DECK_TAG = "DECK OFFICER";
export const AI_PREFIX = "[AI-OPTIMIZED]:";

/** Exact greeting after two consecutive focus sessions. */
export const DUAL_CYCLE_LINE =
  "Dual cycles sustained. Neural efficiency at 114%. I've prepared your favorite synth track.";

export type DeckEvent =
  | { type: "focus-start"; streak: number }
  | { type: "focus-complete"; streak: number }
  | { type: "long-pause" }
  | { type: "stress"; count: number }
  | { type: "overclock"; on: boolean };

/** What the Deck Officer prints for an event, or null to stay quiet. */
export function deckLine(e: DeckEvent): string | null {
  switch (e.type) {
    case "focus-start":
      if (e.streak === 0) return "Link established. Holding the perimeter while you work.";
      if (e.streak === 1) return "Second cycle armed. One more and we’re in rhythm.";
      return `Cycle ${e.streak + 1} armed. Momentum is on your side.`;
    case "focus-complete":
      if (e.streak === 2) return DUAL_CYCLE_LINE;
      if (e.streak === 1) return "Cycle one logged. Recharge, then we go again.";
      return `Cycle ${e.streak} sustained. Output holding steady.`;
    case "long-pause":
      return "Clock is holding. Your slot is safe — re-engage when ready.";
    case "stress":
      return `Stress signal parsed. Split into ${e.count} moves — start with the first one only.`;
    case "overclock":
      return e.on
        ? "Overclock engaged. Peripheral systems muted. Breathe with the rain."
        : "Overclock released. Peripheral systems back online.";
  }
}

/** True when a completion should trigger the "favorite synth track" hand-off. */
export const preparesSynthTrack = (streak: number) => streak === 2;

// ---------- /stress brain dump ----------

type Category = "review" | "write" | "inbox" | "bugs" | "study" | "plan" | "generic";

const KEYWORDS: [Category, RegExp][] = [
  ["review", /\b(review|reviews|pr|prs|pull requests?|audit|feedback|check)\b/],
  ["bugs", /\b(bugs?|fix|fixes|errors?|crash(es)?|debug|issues?|broken)\b/],
  ["inbox", /\b(emails?|inbox|messages?|slack|replies|reply|dms?|notifications?)\b/],
  ["write", /\b(write|writing|essay|report|docs?|documentation|article|blog|paper|thesis|draft|copy|slides?)\b/],
  ["study", /\b(study|studying|exams?|learn|learning|read|reading|course|homework|chapters?|revision|notes)\b/],
  ["plan", /\b(plan|planning|project|launch|deadline|meetings?|roadmap|presentation)\b/],
];

const LEAD_INS = [
  /^(i('ve| have)? got|i have|i've|there('s| is| are)|we have|so)\s+/,
  /^(way |far |so |too |a lot of |lots of |tons of |a ton of |so many |too many |so much |too much |many |much )+/,
  /^(i (need|have|got) to|i must|i should|need to|have to|gotta)\s+/,
  /^(the|my|our|some|all (the|my|this))\s+/,
];

function cleanSubject(raw: string): string {
  let s = raw.toLowerCase().replace(/[.!?…]+$/g, "").replace(/\s+/g, " ").trim();
  for (let pass = 0; pass < 3; pass++) for (const re of LEAD_INS) s = s.replace(re, "");
  // "code to review" → "code"; "bugs to fix" → "bugs"
  s = s.replace(/\s+(to|that i need to|i need to)\s+\w+(\s+.*)?$/, "");
  s = s.replace(/\s+(today|tonight|this week|right now|asap)$/, "").trim();
  if (s.length > 48) s = `${s.slice(0, 46).trimEnd()}…`;
  return s || "the backlog";
}

const TEMPLATES: Record<Category, (s: string) => [string, string, string]> = {
  review: (s) => [
    `Triage the ${s}: list every item and flag the 3 riskiest`,
    `Deep-review the riskiest piece in one 25-min block`,
    `Batch the rest: quick pass, leave notes, defer what can wait`,
  ],
  bugs: (s) => [
    `Reproduce the worst of the ${s} and write down the exact steps`,
    `Fix that one in isolation, then re-run the checks`,
    `Log the remaining ${s} by severity for the next block`,
  ],
  inbox: (s) => [
    `Sort the ${s}: urgent / later / archive — 10 minutes, no replies yet`,
    `Answer the 3 urgent ones in a single block`,
    `Template the rest and schedule one more sweep after a break`,
  ],
  write: (s) => [
    `Outline the ${s} in 5 bullet points`,
    `Draft the hardest section first — no editing`,
    `One edit pass: tighten, then ship a v1`,
  ],
  study: (s) => [
    `Skim the ${s} and mark the 3 core ideas`,
    `Explain idea one from memory, no notes`,
    `Write 5 quick recall prompts for what didn't stick`,
  ],
  plan: (s) => [
    `Define “done” for the ${s} in one sentence`,
    `Break the next milestone into three concrete moves`,
    `Do the smallest move now; park the rest in the queue`,
  ],
  generic: (s) => [
    `Dump every piece of “${s}” onto the page — get it out of your head`,
    `Pick the one item that unblocks the rest and give it 25 min`,
    `Park the remainder in the queue; revisit after a break`,
  ],
};

export function categorize(text: string): Category {
  const t = text.toLowerCase();
  for (const [cat, re] of KEYWORDS) if (re.test(t)) return cat;
  return "generic";
}

/** Breaks a stressed-out brain dump into exactly 3 actionable sub-tasks (without prefix). */
export function breakdownStress(text: string): string[] {
  const cat = categorize(text);
  return TEMPLATES[cat](cleanSubject(text)).map((t) => t.slice(0, 180));
}
