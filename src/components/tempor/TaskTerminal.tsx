import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Undo2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Task } from "@/lib/tempor/storage";
import { AI_PREFIX } from "@/lib/tempor/deck";

const SUCCESS_LINES = [
  "Core task neutralized. Nice work.",
  "Objective closed. Steady hands.",
  "One less signal on the wire. Well done.",
  "Logged and filed. That counts.",
];

export type LogTone = "success" | "system" | "info" | "deck";
export interface LogAction {
  label: string;
  run: () => void;
}
export interface LogEntry {
  id: number;
  tag: string;
  text: string;
  tone: LogTone;
  action?: LogAction;
}

/** Types the newest log line out character by character (instant with reduced motion). */
function TypedText({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [text]);
  const typing = n < text.length;
  return (
    <>
      <span aria-hidden>{text.slice(0, n)}</span>
      {typing && <span aria-hidden className="ml-px inline-block h-3 w-[6px] translate-y-[2px] animate-caret bg-current" />}
      <span className="sr-only">{text}</span>
    </>
  );
}

interface Props {
  logs: LogEntry[];
  onLog: (tag: string, text: string, tone: LogTone) => void;
  tasks: Task[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onClearDone: () => void;
  onCompleted?: (t: Task) => void;
}

export function TaskTerminal({ logs, onLog, tasks, onAdd, onToggle, onRemove, onClearDone, onCompleted }: Props) {
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const logCount = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const complete = (t: Task) => {
    onToggle(t.id);
    const line = SUCCESS_LINES[logCount.current % SUCCESS_LINES.length] ?? SUCCESS_LINES[0]!;
    logCount.current += 1;
    onLog("SUCCESS", line, "success");
    onCompleted?.(t);
  };

  return (
    <section aria-labelledby="tasks-title" className="glass-panel flex flex-col overflow-hidden rounded-3xl">
      <header className="flex items-center gap-3 border-b border-glass-border px-5 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-orchid/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-cyan/70" />
        </div>
        <h2 id="tasks-title" className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          task.terminal
        </h2>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular">
          {active.length} queued
        </span>
      </header>

      <form
        className="flex items-center gap-2 px-5 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onAdd(text);
          setText("");
          inputRef.current?.focus();
        }}
      >
        <label htmlFor="task-input" className="sr-only">
          Add a task
        </label>
        <span aria-hidden className="font-mono text-sm text-terminal">
          &gt;
        </span>
        <input
          id="task-input"
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          autoComplete="off"
          placeholder="add a task, press enter"
          className="h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-background/40 px-3 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-input focus-visible:border-terminal/50 focus-visible:ring-2 focus-visible:ring-terminal/25"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="h-10 rounded-lg border border-terminal/30 px-3 font-mono text-xs uppercase tracking-widest text-terminal transition-colors hover:bg-terminal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminal/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Add
        </button>
      </form>

      <div className="flex-1 px-3 py-3">
        {active.length === 0 ? (
          <p className="px-2 py-6 text-center font-mono text-xs text-muted-foreground/70">
            // queue empty. one small task is enough.
          </p>
        ) : (
          <ul className="space-y-0.5" aria-label="Active tasks">
            {active.map((t) => (
              <li
                key={t.id}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60 focus-within:bg-accent/60"
              >
                <button
                  type="button"
                  onClick={() => complete(t)}
                  aria-label={`Mark “${t.text}” complete`}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-terminal/40 text-terminal transition-colors hover:bg-terminal/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminal/50 active:scale-90"
                >
                  <Check className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
                </button>
                <span className="min-w-0 flex-1 break-words font-mono text-sm">
                  {t.origin === "ai" ? (
                    <span className="text-orchid [text-shadow:0_0_10px_color-mix(in_oklab,var(--orchid)_55%,transparent)]">{AI_PREFIX}</span>
                  ) : (
                    <span className="text-terminal">[READY]:</span>
                  )}{" "}
                  {t.text}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(t.id)}
                  aria-label={`Remove “${t.text}”`}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-all hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {done.length > 0 && (
          <div className="mt-3 border-t border-glass-border pt-2">
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex items-center gap-1 rounded-md py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showDone && "rotate-90")} />
                Archive ({done.length})
              </button>
              {showDone && (
                <button
                  type="button"
                  onClick={onClearDone}
                  className="rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
                >
                  clear
                </button>
              )}
            </div>
            {showDone && (
              <ul className="mt-1 space-y-0.5" aria-label="Completed tasks">
                {done.map((t) => (
                  <li key={t.id} className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent/40">
                    <span className="min-w-0 flex-1 break-words font-mono text-xs text-muted-foreground/70 line-through decoration-muted-foreground/40">
                      [DONE]: {t.origin === "ai" ? `${AI_PREFIX} ` : ""}
                      {t.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggle(t.id)}
                      aria-label={`Move “${t.text}” back to active`}
                      className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(t.id)}
                      aria-label={`Remove “${t.text}”`}
                      className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-glass-border bg-background/30 px-5 pb-3 pt-2.5 font-mono text-xs">
        <p className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
          <span aria-hidden className="h-1 w-1 animate-holo rounded-full bg-orchid" />
          focus assistant log
        </p>
        <div aria-live="polite" className="min-h-10 space-y-1">
          {logs.length === 0 ? (
            <p className="text-muted-foreground/60">[SYS]: terminal online. deck officer listening.</p>
          ) : (
            logs.map((l, i) => {
              const latest = i === logs.length - 1;
              return (
                <p
                  key={l.id}
                  className={cn(
                    "leading-relaxed transition-opacity duration-500",
                    latest ? "animate-log-in opacity-100" : "opacity-45",
                    l.tone === "success" && "text-terminal",
                    l.tone === "system" && "text-amber",
                    l.tone === "info" && "text-cyan",
                    l.tone === "deck" && "text-orchid",
                  )}
                >
                  [{l.tag}]:{" "}
                  <span className="opacity-90">{latest ? <TypedText text={l.text} /> : l.text}</span>
                  {l.action && latest && (
                    <button
                      type="button"
                      onClick={l.action.run}
                      className="ml-2 rounded-md border border-orchid/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-orchid transition-colors hover:bg-orchid/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orchid/50"
                    >
                      {l.action.label}
                    </button>
                  )}
                </p>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
