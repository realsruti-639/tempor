import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CornerDownLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { COMMAND_HINTS, describeCommand, parseCommand, type Command } from "@/lib/tempor/commands";

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
      setShowHelp(false);
      setActive(0);
    }
  }, [open]);

  const parsed = useMemo(() => parseCommand(value), [value]);
  const hints = useMemo(() => {
    const v = value.trim().toLowerCase();
    if (showHelp || v === "" ) return COMMAND_HINTS;
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
          className="fixed left-1/2 top-[14vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 outline-none"
        >
          <div
            key={error?.id}
            className={cn(
              "animate-ghost-in overflow-hidden rounded-2xl border border-glass-border bg-popover/80 shadow-[0_40px_120px_-30px_oklch(0_0_0/0.9),0_0_0_1px_color-mix(in_oklab,var(--mode)_18%,transparent)] backdrop-blur-2xl",
              error && "animate-shake",
            )}
          >
            <DialogPrimitive.Title className="sr-only">Ghost Terminal</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Type a command such as /add, /start, /pause or /break. Press Escape to close.
            </DialogPrimitive.Description>

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

            {hints.length > 0 && (
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

            <p className="border-t border-glass-border px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
              plain text becomes a task · ↑↓ select · tab complete
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
