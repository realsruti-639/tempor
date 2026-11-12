import { Check, Lock, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SKINS, type SkinId, type Workspace } from "@/lib/tempor/matrix";

export function WorkspaceSkins({ workspace, credits, onBuy, onEquip }: { workspace: Workspace; credits: number; onBuy: (id: SkinId) => void; onEquip: (id: SkinId | null) => void }) {
  return <div className="border-t border-glass-border px-3 pb-3 pt-3">
    <div className="mb-3 flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Palette className="h-3 w-3" /> WORKSPACE SKINS</h3><Button variant="ghost" size="sm" onClick={() => onEquip(null)} disabled={workspace.skin === null}>Default</Button></div>
    <ul className="space-y-2">{SKINS.map((s) => {
      const owned = workspace.owned.includes(s.id);
      const active = workspace.skin === s.id;
      return <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-glass-border p-3">
        <span aria-hidden className={`skin-swatch skin-${s.id} h-9 w-9 shrink-0 rounded-md`} />
        <div className="min-w-0 flex-1"><p className="text-xs font-medium">{s.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{s.texture}</p></div>
        <Button variant={active ? "mode" : "glass"} size="sm" disabled={!owned && credits < s.cost} aria-label={owned ? `Equip ${s.name}` : `Unlock ${s.name} for ${s.cost} credits`} onClick={() => owned ? onEquip(s.id) : onBuy(s.id)}>
          {active ? <Check /> : !owned && credits < s.cost ? <Lock /> : <Palette />}{owned ? active ? "On" : "Equip" : `${s.cost} GC`}
        </Button>
      </li>;
    })}</ul>
  </div>;
}