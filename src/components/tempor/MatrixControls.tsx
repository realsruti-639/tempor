import { Activity, Moon, Sun, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { BioPhase } from "@/lib/tempor/matrix";

export function MatrixControls({ enabled, phase, onChange }: { enabled: boolean; phase: BioPhase; onChange: (on: boolean) => void }) {
  return <Popover>
    <PopoverTrigger asChild><Button variant="glass" size="icon" aria-label="Workspace settings" title="Workspace settings"><Settings2 /></Button></PopoverTrigger>
    <PopoverContent align="end" className="w-72 border-glass-border bg-popover p-4">
      <h2 className="mb-4 flex items-center gap-2 font-mono text-xs text-mode"><Activity className="h-4 w-4" /> CIRCADIAN WAVE</h2>
      <div className="flex items-center justify-between gap-4"><Label htmlFor="bio-sync">Bio-Sync</Label><Switch id="bio-sync" checked={enabled} onCheckedChange={onChange} /></div>
      <div className="mt-4 flex items-center gap-2 border-t border-glass-border pt-3 text-sm text-muted-foreground">
        {phase === "surge" ? <Sun className="h-4 w-4 text-mode" /> : <Moon className="h-4 w-4 text-mode" />}
        {enabled ? phase === "surge" ? "Neon Surge" : "Chilled Ember" : "Manual phase palette"}
      </div>
    </PopoverContent>
  </Popover>;
}