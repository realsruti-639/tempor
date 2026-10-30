import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BrainCircuit, CornerDownLeft, TerminalSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { COMMAND_HINTS, describeCommand, parseCommand, type Command } from "@/lib/tempor/commands";
import { AI_PREFIX, breakdownStress } from "@/lib/tempor/deck";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Executes a command. Return false to keep the overlay open. */
  onRun: (c: Command) => boolean;
}

export function GhostTerminal({ open, onOpenChange, onRun }: Props) {
  const [value, setValue] = useState("");
  const [active, setActive] = useState(0);
  const [error, setError] = useState<{ id: number; text: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tab, setTab] = useState<"command" | "dump">("command");
  const [dump, setDump] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dumpRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    panelRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 320, easing: "ease-in-out" },
    );
  }, [error]);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
      setShowHelp(false);
      setActive(0);
      setDump("");
      setTab("command");
    }
  }, [open]);

  const switchTab = (t: "command" | "dump") => {
    setTab(t);
    setError(null);
    requestAnimationFrame(() => (t === "dump" ? dumpRef.current : inputRef.current)?.focus());
  };

  const dumpPreview = useMemo(() => (dump.trim().length >= 3 ? breakdownStress(dump) : []), [dump]);
  const submitDump = () => {
    const text = dump.trim();
    if (text.length < 3) {
      setError({ id: Date.now(), text: "Tell the Deck Officer a little more first." });
      return;
    }
    if (onRun({ type: "stress", text: text.slice(0, 300) })) onOpenChange(false);
  };

  const parsed = useMemo(() => parseCommand(value), [value]);
  const hints = useMemo(() => {
    const v = value.trim().toLowerCase();
    if (showHelp || v === "") return COMMAND_HINTS;
    if (!v.startsWith("/")) return [];
    return COMMAND_HINTS.filter((h) => h.usage.toLowerCase().startsWith(v.split(" ")[0]!));
  }, [value, showHelp]);

  useEffect(() => setActive(0), [hints.length]);

  const run = (c: Command) => {
    if (c.type === "empty") return;
    if (c.type === "help") {
      setShowHelp(true);
      setValue("");
      return;
    }
    if (c.type === "unknown") {
      setError({ id: Date.now(), text: `${c.input.split(" ")[0]} isn’t a command. Try /help.` });
      return;
    }
    if (onRun(c)) onOpenChange(false);
  };

  const pickHint = (i: number) => {
    const h = hints[i];
    if (!h) return;
    if (h.insert.endsWith(" ")) {
      setValue(h.insert);
      inputRef.current?.focus();
    } else run(parseCommand(h.insert));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && hints.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % hints.length);
    } else if (e.key === "ArrowUp" && hints.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + hints.length) % hints.length);
    } else if (e.key === "Tab" && hints.length && value.startsWith("/")) {
      e.preventDefault();
      setValue(hints[active]!.insert);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const unresolved = parsed.type === "unknown" || parsed.type === "empty";
      if (unresolved && hints.length && (value.startsWith("/") || value.trim() === "")) pickHint(active);
      else run(parsed);
    }
  };

  const tone =
    parsed.type === "unknown" ? "text-destructive" : parsed.type === "empty" ? "text-muted-foreground" : "text-terminal";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/55 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 outline-none"
        >
          <div
            ref={panelRef}
            className="animate-ghost-in overflow-hidden rounded-2xl border border-glass-border bg-popover/80 shadow-[0_40px_120px_-30px_oklch(0_0_0/0.9),0_0_0_1px_color-mix(in_oklab,var(--mode)_18%,transparent)] backdrop-blur-2xl"
          >
            <DialogPrimitive.Title className="sr-only">Ghost Terminal</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Type a command such as /add, /start, /pause, /break or /stress, or switch to Brain dump. Press Escape to close.
            </DialogPrimitive.Description>

            <div role="tablist" aria-label="Terminal mode" className="flex gap-1 border-b border-glass-border px-3 pt-3">
              {(
                [
                  ["command", "Command", TerminalSquare],
                  ["dump", "Brain dump", BrainCircuit],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => switchTab(id)}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tab === id
                      ? id === "dump"
                        ? "border-orchid text-orchid"
                        : "border-mode text-mode"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            {tab === "dump" ? (
              <div>
                <div className="px-5 pt-4">
                  <label htmlFor="brain-dump" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    What’s weighing on you?
                  </label>
                  <textarea
                    id="brain-dump"
                    ref={dumpRef}
                    value={dump}
                    rows={2}
                    maxLength={300}
                    onChange={(e) => {
                      setDump(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitDump();
                      }
                    }}
                    spellCheck={false}
                    placeholder="I have too much code to review"
                    className="mt-2 w-full resize-none rounded-xl border border-glass-border bg-background/40 px-3 py-2.5 font-mono text-sm text-foreground caret-[var(--orchid)] outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-orchid/50 focus-visible:ring-2 focus-visible:ring-orchid/25"
                  />
                </div>
                <div className="px-5 pb-3 pt-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                    deck officer · proposed breakdown
                  </p>
                  {dumpPreview.length === 0 ? (
                    <p className="mt-2 font-mono text-xs text-muted-foreground/60">
                      // type it the way you’d say it. the officer splits it into 3 moves.
                    </p>
                  ) : (
                    <ol className="mt-2 space-y-1">
                      {dumpPreview.map((t, i) => (
                        <li
                          key={i}
                          className="animate-log-in font-mono text-xs leading-relaxed"
                          style={{ animationDelay: `${i * 60}ms` }}
                        >
                          <span className="text-orchid">{AI_PREFIX}</span> <span className="text-foreground/90">{t}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-glass-border px-5 py-2.5 font-mono text-xs">
                  <span className={cn("truncate", error ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
                    {error ? error.text : "Enter queues all three · shift+enter for a new line"}
                  </span>
                  <button
                    type="button"
                    onClick={submitDump}
                    disabled={dumpPreview.length === 0}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-orchid/40 px-2.5 py-1 text-[11px] uppercase tracking-widest text-orchid transition-colors hover:bg-orchid/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orchid/50 disabled:opacity-30"
                  >
                    <CornerDownLeft className="h-3 w-3" /> optimize
                  </button>
                </div>
              </div>
            ) : (
              <>
            <div className="flex items-center gap-3 px-5 py-4">
              <span aria-hidden className="font-mono text-lg text-mode">
                &gt;
              </span>
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={onKeyDown}
                spellCheck={false}
                autoComplete="off"
                aria-label="Command"
                placeholder="/add Code the API core"
                className="min-w-0 flex-1 bg-transparent font-mono text-base text-foreground caret-[var(--mode)] outline-none placeholder:text-muted-foreground/50 sm:text-lg"
              />
              <kbd className="hidden rounded-md border border-glass-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                esc
              </kbd>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-glass-border px-5 py-2.5 font-mono text-xs">
              <span className={cn("truncate", error ? "text-destructive" : tone)} aria-live="polite">
                {error ? error.text : describeCommand(parsed)}
              </span>
              {parsed.type !== "empty" && parsed.type !== "unknown" && !error && (
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  <CornerDownLeft className="h-3 w-3" /> run
                </span>
              )}
            </div>

            {parsed.type === "stress" && (
              <ol className="space-y-1 border-t border-glass-border px-5 py-2.5" aria-label="Proposed sub-tasks">
                {breakdownStress(parsed.text).map((t, i) => (
                  <li key={i} className="font-mono text-xs">
                    <span className="text-orchid">{AI_PREFIX}</span> <span className="text-foreground/85">{t}</span>
                  </li>
                ))}
              </ol>
            )}

            {hints.length > 0 && parsed.type !== "stress" && (
              <ul role="listbox" aria-label="Commands" className="border-t border-glass-border p-2">
                {hints.map((h, i) => (
                  <li key={h.usage} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pickHint(i)}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left transition-colors",
                        i === active ? "bg-mode/10 text-foreground" : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <span className="font-mono text-sm">
                        <span className={i === active ? "text-mode" : ""}>{h.usage}</span>
                      </span>
                      <span className="truncate text-xs">{h.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

              </>
            )}

            <p className="border-t border-glass-border px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
              plain text becomes a task · ↑↓ select · tab complete
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
