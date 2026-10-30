import type { ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BOT_LINES, type BotState } from "@/lib/tempor/core";
import type { CosmeticId } from "@/lib/tempor/upgrades";

type R = [x: number, y: number, w: number, h: number];
const Px = ({ r, className }: { r: R[]; className: string }) => (
  <>
    {r.map(([x, y, w, h], i) => (
      <rect key={i} x={x} y={y} width={w} height={h} className={className} />
    ))}
  </>
);

const HEADPHONES_ON = new Set<BotState>(["engaged", "deepFocus", "paused", "extendedPause"]);
const WITH_TEA = new Set<BotState>(["cycleFinished", "milestone"]);
const HAPPY_EYES = new Set<BotState>(["cycleFinished", "milestone"]);

function headAnimation(s: BotState) {
  if (s === "engaged") return "animate-nod";
  if (s === "deepFocus") return "animate-bob";
  if (s === "longBreak") return "";
  return "animate-breathe";
}

const MATRIX_COLS = [1, 4, 7, 10, 21, 24, 27, 30];

function Aura() {
  return (
    <g aria-hidden>
      <ellipse cx="16" cy="15" rx="13" ry="12" className="fill-terminal/[0.07]" />
      {MATRIX_COLS.map((x, i) => (
        <g
          key={x}
          className="animate-matrix"
          style={{ animationDelay: `${-(i * 0.47) % 3.6}s`, animationDuration: `${3 + (i % 3) * 0.7}s` }}
        >
          <rect x={x} y={0} width={1} height={1} className="fill-terminal" />
          <rect x={x} y={-2} width={1} height={1} className="fill-terminal/70" />
          <rect x={x} y={-4} width={1} height={1} className="fill-terminal/45" />
          <rect x={x} y={-6} width={1} height={1} className="fill-terminal/25" />
        </g>
      ))}
    </g>
  );
}

function Wings() {
  return (
    <g aria-hidden>
      <g className="animate-wing origin-right [transform-box:fill-box]">
        <Px r={[[2, 17, 7, 1]]} className="fill-cyan" />
        <Px r={[[1, 18, 8, 2], [2, 20, 7, 2]]} className="fill-cyan/55" />
        <Px r={[[3, 22, 6, 1], [5, 23, 4, 1]]} className="fill-lavender/45" />
      </g>
      <g className="animate-wing origin-left [transform-box:fill-box]">
        <Px r={[[23, 17, 7, 1]]} className="fill-cyan" />
        <Px r={[[23, 18, 8, 2], [23, 20, 7, 2]]} className="fill-cyan/55" />
        <Px r={[[23, 22, 6, 1], [23, 23, 4, 1]]} className="fill-lavender/45" />
      </g>
    </g>
  );
}

function BotArt({ state, equipped }: { state: BotState; equipped: CosmeticId[] }) {
  const phonesOn = HEADPHONES_ON.has(state);
  const tea = WITH_TEA.has(state);
  const book = state === "shortBreak";
  const sleeping = state === "longBreak";
  const visorDim = state === "engaged" || state === "deepFocus";
  const tilt =
    state === "extendedPause"
      ? "rotate(-7 16 12)"
      : sleeping
        ? "translate(0 2) rotate(5 16 12)"
        : book
          ? "translate(0 1)"
          : undefined;
  const milestone = state === "milestone";
  const shades = equipped.includes("shades");

  let eyes: ReactNode;
  if (sleeping) eyes = <Px r={[[12, 11, 3, 1], [18, 11, 3, 1]]} className="fill-mode" />;
  else if (book) eyes = <Px r={[[12, 11, 2, 1], [19, 11, 2, 1]]} className="fill-mode" />;
  else if (HAPPY_EYES.has(state))
    eyes = (
      <Px
        r={[[12, 10, 2, 1], [11, 11, 1, 1], [14, 11, 1, 1], [19, 10, 2, 1], [18, 11, 1, 1], [21, 11, 1, 1]]}
        className="fill-mode"
      />
    );
  else eyes = <Px r={[[12, 10, 2, 2], [19, 10, 2, 2]]} className="fill-mode" />;

  return (
    <svg
      viewBox="0 0 32 30"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Pomo-Bot${sleeping ? ", asleep" : book ? ", reading" : tea ? ", sipping tea" : ""}${
        equipped.length ? `, wearing ${equipped.length} upgrade${equipped.length > 1 ? "s" : ""}` : ""
      }`}
      className="h-auto w-full max-w-[260px] overflow-hidden [image-rendering:pixelated]"
    >
      {equipped.includes("aura") && <Aura />}
      {equipped.includes("wings") && <Wings />}

      {/* desk */}
      <Px r={[[1, 27, 30, 1]]} className="fill-glass-border" />
      <Px r={[[2, 28, 28, 1]]} className="fill-bot-silhouette/40" />

      {/* body */}
      <g className={cn("[transform-box:fill-box]", sleeping ? "" : "animate-breathe")}>
        <Px r={[[10, 18, 12, 1], [9, 19, 14, 8]]} className="fill-bot-shell" />
        <Px r={[[9, 25, 14, 2]]} className="fill-bot-shade" />
        <Px r={[[12, 20, 8, 5]]} className="fill-bot-visor" />
        <Px
          r={[[13, 21, 5, 1], [13, 23, 5, 1], [13, 21, 1, 3], [17, 21, 1, 3], [18, 22, 1, 1]]}
          className={milestone ? "fill-amber" : "fill-bot-silhouette"}
        />
        <Px r={[[14, 22, 3, 1]]} className={milestone ? "fill-amber" : "fill-bot-visor"} />

        {book ? (
          <>
            {/* arms forward holding a holographic book */}
            <Px r={[[8, 21, 3, 2], [21, 21, 3, 2]]} className="fill-bot-shade" />
            <g className="animate-holo">
              <Px r={[[10, 19, 12, 6]]} className="fill-cyan/25" />
              <Px r={[[10, 19, 12, 1], [15, 19, 2, 6]]} className="fill-cyan/60" />
              <Px r={[[11, 21, 3, 1], [11, 23, 3, 1], [18, 21, 3, 1], [18, 23, 2, 1]]} className="fill-cyan/70" />
            </g>
            <g className="animate-ember">
              <Px r={[[12, 17, 1, 1], [19, 16, 1, 1]]} className="fill-cyan" />
            </g>
            <g className="animate-ember [animation-delay:0.9s]">
              <Px r={[[16, 16, 1, 1], [14, 15, 1, 1]]} className="fill-lavender" />
            </g>
          </>
        ) : (
          <>
            <Px r={[[7, 20, 2, 5]]} className="fill-bot-shade" />
            {tea ? (
              <>
                <Px r={[[23, 19, 2, 4]]} className="fill-bot-shade" />
                <Px r={[[25, 18, 4, 5]]} className="fill-bot-mug" />
                <Px r={[[29, 19, 1, 3]]} className="fill-bot-mug" />
                <Px r={[[25, 18, 4, 1]]} className="fill-lavender" />
                <g className="animate-steam">
                  <Px r={[[26, 15, 1, 2], [27, 13, 1, 2]]} className="fill-lavender/80" />
                </g>
                <g className="animate-steam [animation-delay:1.3s]">
                  <Px r={[[28, 14, 1, 2]]} className="fill-cyan/60" />
                </g>
              </>
            ) : (
              <Px r={[[23, 20, 2, 5]]} className="fill-bot-shade" />
            )}
          </>
        )}

        <Px r={[[13, 17, 6, 1]]} className="fill-bot-shade" />
        {!phonesOn && (
          <>
            <Px r={[[10, 18, 12, 1]]} className="fill-orchid" />
            <Px r={[[7, 17, 3, 4], [22, 17, 3, 4]]} className="fill-orchid" />
            <Px r={[[7, 18, 1, 2], [24, 18, 1, 2]]} className="fill-orchid/60" />
          </>
        )}
      </g>

      {/* head */}
      <g transform={tilt}>
        <g key={state} className={cn("origin-bottom [transform-box:fill-box]", headAnimation(state))}>
          <Px r={[[8, 3, 1, 1], [8, 4, 2, 1], [8, 5, 3, 1], [23, 3, 1, 1], [22, 4, 2, 1], [21, 5, 3, 1]]} className="fill-bot-shell" />
          <Px r={[[9, 5, 1, 1], [22, 5, 1, 1]]} className="fill-orchid/70" />
          <Px r={[[8, 6, 16, 1], [7, 7, 18, 9], [8, 16, 16, 1]]} className="fill-bot-shell" />
          <Px r={[[8, 16, 16, 1], [7, 15, 1, 1], [24, 15, 1, 1]]} className="fill-bot-shade" />
          <Px r={[[9, 8, 14, 5]]} className="fill-bot-visor" />
          <Px r={[[10, 8, 3, 1]]} className="fill-foreground/15" />
          <g className={cn("transition-opacity duration-700", visorDim ? "opacity-55" : "opacity-100")}>{eyes}</g>
          {shades && (
            <g>
              <Px r={[[10, 9, 5, 3], [17, 9, 5, 3], [15, 10, 2, 1], [9, 9, 1, 1], [22, 9, 1, 1]]} className="fill-background" />
              <Px r={[[11, 9, 2, 1], [18, 9, 2, 1]]} className="fill-orchid" />
              <Px r={[[13, 11, 1, 1], [20, 11, 1, 1]]} className="fill-cyan/60" />
            </g>
          )}
          <Px r={[[14, 14, 1, 1], [15, 15, 1, 1], [16, 14, 1, 1], [17, 15, 1, 1], [18, 14, 1, 1]]} className="fill-bot-shade" />
          {phonesOn && (
            <>
              <Px r={[[9, 1, 14, 1], [8, 2, 1, 1], [23, 2, 1, 1], [7, 3, 1, 5], [24, 3, 1, 5]]} className="fill-orchid" />
              <Px r={[[5, 8, 3, 6], [24, 8, 3, 6]]} className="fill-orchid" />
              <Px r={[[5, 9, 1, 4], [26, 9, 1, 4]]} className="fill-orchid/60" />
            </>
          )}
        </g>
      </g>

      {sleeping && (
        <>
          <g className="animate-zzz">
            <Px r={[[25, 6, 2, 1], [26, 7, 1, 1], [25, 8, 2, 1]]} className="fill-mode" />
          </g>
          <g className="animate-zzz [animation-delay:1.1s]">
            <Px r={[[27, 2, 3, 1], [28, 3, 1, 1], [27, 4, 3, 1]]} className="fill-lavender/80" />
          </g>
          <g className="animate-ember">
            <Px r={[[4, 25, 1, 1], [27, 24, 1, 1]]} className="fill-amber" />
          </g>
          <g className="animate-ember [animation-delay:1.2s]">
            <Px r={[[6, 23, 1, 1], [29, 25, 1, 1]]} className="fill-lavender" />
          </g>
        </>
      )}
    </svg>
  );
}

interface Props {
  state: BotState;
  frozen: boolean;
  equipped: CosmeticId[];
  onFrozenChange: (v: boolean) => void;
  children?: ReactNode;
}

export function PomoBot({ state, frozen, equipped, onFrozenChange, children }: Props) {
  return (
    <section aria-labelledby="bot-title" className="glass-panel flex flex-col rounded-3xl p-5">
      <header className="flex items-center justify-between">
        <h2 id="bot-title" className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Pomo-Bot <span className="hidden text-orchid/80 sm:inline">// desk unit 07</span>
        </h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="bot-still" className="cursor-pointer text-xs text-muted-foreground">
            Still mode
          </Label>
          <Switch id="bot-still" checked={frozen} onCheckedChange={onFrozenChange} />
        </div>
      </header>

      <div
        className={cn(
          "relative mt-4 grid place-items-center overflow-hidden rounded-2xl bg-bot-visor/50 px-6 py-6 transition-shadow duration-700",
          equipped.includes("aura") && !frozen && "shadow-[inset_0_0_40px_-10px_var(--terminal)]",
          frozen && "bot-frozen [&_ellipse]:fill-bot-silhouette/10 [&_rect]:fill-bot-silhouette",
        )}
      >
        <BotArt state={state} equipped={equipped} />
      </div>

      <p
        aria-live="polite"
        className="mt-4 min-h-[2.75rem] rounded-xl border border-glass-border bg-background/40 px-3 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground"
      >
        <span className="text-terminal/80">&gt;</span> {BOT_LINES[state]}
        <span aria-hidden className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-muted-foreground/60 animate-caret" />
      </p>

      {children}
    </section>
  );
}
