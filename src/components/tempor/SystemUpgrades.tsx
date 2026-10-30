import { useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, Check } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { COSMETICS, type CosmeticId } from "@/lib/tempor/upgrades";

interface Props {
  credits: number;
  owned: CosmeticId[];
  equipped: CosmeticId[];
  onBuy: (id: CosmeticId) => void;
  onToggle: (id: CosmeticId) => void;
}

function Glyph({ id }: { id: CosmeticId }) {
  const common = "h-6 w-6";
  if (id === "shades")
    return (
      <svg viewBox="0 0 12 6" shapeRendering="crispEdges" className={common} aria-hidden>
        <rect x="0" y="1" width="5" height="3" className="fill-foreground/80" />
        <rect x="7" y="1" width="5" height="3" className="fill-foreground/80" />
        <rect x="5" y="2" width="2" height="1" className="fill-foreground/80" />
        <rect x="1" y="1" width="2" height="1" className="fill-orchid" />
        <rect x="8" y="1" width="2" height="1" className="fill-orchid" />
      </svg>
    );
  if (id === "wings")
    return (
      <svg viewBox="0 0 12 8" shapeRendering="crispEdges" className={common} aria-hidden>
        <rect x="0" y="1" width="4" height="1" className="fill-cyan" />
        <rect x="1" y="2" width="4" height="2" className="fill-cyan/60" />
        <rect x="2" y="4" width="3" height="2" className="fill-cyan/40" />
        <rect x="8" y="1" width="4" height="1" className="fill-cyan" />
        <rect x="7" y="2" width="4" height="2" className="fill-cyan/60" />
        <rect x="7" y="4" width="3" height="2" className="fill-cyan/40" />
      </svg>
    );
  return (
    <svg viewBox="0 0 12 10" shapeRendering="crispEdges" className={common} aria-hidden>
      {[1, 4, 7, 10].map((x, i) => (
        <g key={x}>
          <rect x={x} y={(i * 3) % 5} width="1" height="2" className="fill-terminal" />
          <rect x={x} y={((i * 3) % 5) + 3} width="1" height="2" className="fill-terminal/50" />
        </g>
      ))}
    </svg>
  );
}

export function SystemUpgrades({ credits, owned, equipped, onBuy, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<CosmeticId | null>(null);
  const prevCredits = useRef(credits);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (credits > prevCredits.current) setBump((b) => b + 1);
    prevCredits.current = credits;
  }, [credits]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 900);
    return () => window.clearTimeout(t);
  }, [flash]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4 rounded-2xl border border-glass-border bg-background/30">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground">
          System upgrades
        </span>
        <span className="flex items-center gap-2">
          <span
            key={bump}
            className={cn(
              "rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-0.5 font-mono text-xs tabular text-cyan",
              bump > 0 && "animate-pop",
            )}
          >
            ◆ {credits} GC
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
        <ul className="space-y-2 px-3 pb-3">
          {COSMETICS.map((c) => {
            const isOwned = owned.includes(c.id);
            const isOn = equipped.includes(c.id);
            const short = c.cost - credits;
            return (
              <li
                key={c.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-500",
                  isOn ? "border-mode/40 bg-mode/[0.06]" : "border-glass-border",
                  flash === c.id && "animate-pop shadow-[0_0_30px_-6px_var(--mode)]",
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-bot-visor/70">
                  <Glyph id={c.id} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.blurb}</span>
                </span>
                {isOwned ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    aria-label={`${isOn ? "Unequip" : "Equip"} ${c.name}`}
                    onClick={() => onToggle(c.id)}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-lg px-3 font-mono text-[11px] uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                      isOn ? "bg-mode/15 text-mode hover:bg-mode/25" : "border border-glass-border text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {isOn && <Check className="h-3 w-3" />}
                    {isOn ? "Equipped" : "Equip"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={short > 0}
                    onClick={() => {
                      onBuy(c.id);
                      setFlash(c.id);
                    }}
                    aria-label={short > 0 ? `${c.name}: needs ${short} more credits` : `Unlock ${c.name} for ${c.cost} credits`}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-cyan/40 px-3 font-mono text-[11px] tabular text-cyan transition-all hover:bg-cyan/10 hover:shadow-[0_0_20px_-6px_var(--cyan)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:cursor-not-allowed disabled:border-glass-border disabled:text-muted-foreground disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:shadow-none"
                  >
                    {short > 0 && <Lock className="h-3 w-3" />}◆ {c.cost}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="px-4 pb-3 font-mono text-[10px] text-muted-foreground/70">
          +100 GC per completed 25-min focus session
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
