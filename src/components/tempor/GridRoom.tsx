import { memo } from "react";

import { cn } from "@/lib/utils";
import { AGENTS, agentStatus, tickerLabel, type AgentId, type GridMessage } from "@/lib/tempor/grid";

export interface GridChat extends GridMessage {
  id: number;
}

interface Props {
  /** Wall clock, sampled coarsely by the parent (tickers move per minute). */
  now: number;
  messages: GridChat[];
  /** Changes on every user event; replays the pulse animation. */
  pulse: number;
}

const GLYPH: Record<AgentId, string> = { akira: "AK", byte: "B/", ghost: "NG" };

export const GridRoom = memo(function GridRoom({ now, messages, pulse }: Props) {
  const speaker = messages.at(-1)?.agent;

  return (
    <section aria-labelledby="grid-title" className="glass-panel relative overflow-hidden rounded-3xl [contain:paint]">
      {pulse > 0 && (
        <span
          key={pulse}
          aria-hidden
          className="animate-grid-pulse pointer-events-none absolute inset-0 rounded-3xl"
        />
      )}
      <header className="flex items-center gap-3 border-b border-glass-border px-5 py-3">
        <span aria-hidden className="relative grid h-2.5 w-2.5 place-items-center">
          <span className="absolute h-full w-full animate-ping rounded-full bg-terminal/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-terminal" />
        </span>
        <h2 id="grid-title" className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          grid.room <span className="text-muted-foreground/50">// neon-net</span>
        </h2>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular">
          {AGENTS.length} agents linked
        </span>
      </header>

      <ul className="grid gap-2 p-3 sm:grid-cols-3" aria-label="Network agents">
        {AGENTS.map((a) => {
          const s = agentStatus(a, now);
          const flowing = s.phase === "flowing";
          const speaking = speaker === a.id && pulse > 0;
          return (
            <li
              key={a.id}
              className={cn(
                "relative rounded-2xl border px-3 py-2.5 transition-[border-color,background-color,box-shadow] duration-700",
                speaking
                  ? "border-orchid/50 bg-orchid/[0.07] shadow-[0_0_24px_-10px_var(--orchid)]"
                  : "border-glass-border bg-background/30",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-[10px] font-semibold",
                    flowing ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-amber/40 bg-amber/10 text-amber",
                  )}
                >
                  {GLYPH[a.id]}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-foreground">{a.handle}</p>
                  <p
                    className={cn(
                      "truncate font-mono text-[10px] tracking-wide tabular",
                      flowing ? "text-cyan" : "text-amber",
                    )}
                  >
                    {tickerLabel(s)}
                  </p>
                </div>
              </div>
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                <div
                  className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", flowing ? "bg-cyan" : "bg-amber")}
                  style={{ width: `${Math.round(s.progress * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div
        aria-live="polite"
        className="min-h-[3.25rem] space-y-1 border-t border-glass-border bg-background/30 px-5 py-2.5 font-mono text-xs"
      >
        {messages.length === 0 ? (
          <p className="text-muted-foreground/60">// channel quiet. finish a task or a block to ping the grid.</p>
        ) : (
          messages.map((m, i) => (
            <p
              key={m.id}
              className={cn(
                "break-words transition-opacity duration-500",
                i === messages.length - 1 ? "animate-log-in text-foreground/90" : "text-muted-foreground/60",
              )}
            >
              <span className="text-orchid">[{m.handle}]:</span> {m.text}
            </p>
          ))
        )}
      </div>
    </section>
  );
});
