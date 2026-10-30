import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_DURATIONS,
  MAX_DURATION,
  MIN_DURATION,
  MODES,
  MODE_LABEL,
  clampDuration,
  type Durations,
} from "@/lib/tempor/core";

export function DurationSettings({
  durations,
  onChange,
}: {
  durations: Durations;
  onChange: (d: Durations) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    setDraft(Object.fromEntries(MODES.map((m) => [m, String(durations[m])])));
  }, [durations]);

  const commit = () => {
    const next = { ...durations };
    for (const m of MODES) {
      const n = Number(draft[m]);
      next[m] = Number.isFinite(n) && draft[m] !== "" ? clampDuration(n) : durations[m];
    }
    onChange(next);
  };

  return (
    <Popover onOpenChange={(open) => !open && commit()}>
      <PopoverTrigger
        aria-label="Timer durations"
        className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 data-[state=open]:bg-accent data-[state=open]:text-foreground"
      >
        <Settings2 className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="glass-panel w-72 rounded-2xl p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Durations · minutes
          </p>
          <div className="space-y-2">
            {MODES.map((m) => (
              <label key={m} className="flex items-center justify-between gap-3 text-sm">
                <span>{MODE_LABEL[m]}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_DURATION}
                  max={MAX_DURATION}
                  value={draft[m] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [m]: e.target.value }))}
                  onBlur={commit}
                  className="h-9 w-20 rounded-lg border border-input bg-background/60 px-2 text-right font-mono tabular outline-none transition-colors focus-visible:border-mode focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Changes apply right away when the timer is idle, otherwise from the next session.
          </p>
          <div className="mt-3 flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...DEFAULT_DURATIONS })}
            >
              Restore 25 / 5 / 15
            </Button>
            <Button type="submit" variant="glass" size="sm">
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
