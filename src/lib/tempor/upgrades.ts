// System Upgrades: cosmetic overlays for Pomo-Bot bought with Grid Credits.

export type CosmeticId = "shades" | "wings" | "aura";

export interface Cosmetic {
  id: CosmeticId;
  name: string;
  cost: number;
  blurb: string;
}

export const COSMETICS: Cosmetic[] = [
  { id: "shades", name: "Hacker Shades", cost: 100, blurb: "Mirrored visor film. Pure attitude." },
  { id: "wings", name: "Cybernetic Wings", cost: 300, blurb: "Folded alloy fins with a soft glow." },
  { id: "aura", name: "Neon Matrix Aura", cost: 500, blurb: "A quiet rain of green code behind it." },
];

export const COSMETIC_IDS: CosmeticId[] = COSMETICS.map((c) => c.id);

export interface Inventory {
  credits: number;
  owned: CosmeticId[];
  equipped: CosmeticId[];
}

export type PurchaseResult =
  | { ok: true; inventory: Inventory }
  | { ok: false; reason: "owned" | "insufficient" | "unknown"; inventory: Inventory };

/** Spends credits to unlock a cosmetic and equips it straight away. */
export function purchase(inv: Inventory, id: CosmeticId): PurchaseResult {
  const item = COSMETICS.find((c) => c.id === id);
  if (!item) return { ok: false, reason: "unknown", inventory: inv };
  if (inv.owned.includes(id)) return { ok: false, reason: "owned", inventory: inv };
  if (inv.credits < item.cost) return { ok: false, reason: "insufficient", inventory: inv };
  return {
    ok: true,
    inventory: {
      credits: inv.credits - item.cost,
      owned: [...inv.owned, id],
      equipped: inv.equipped.includes(id) ? inv.equipped : [...inv.equipped, id],
    },
  };
}

/** Equip / unequip an owned cosmetic. Unowned items are ignored. */
export function toggleEquip(inv: Inventory, id: CosmeticId): Inventory {
  if (!inv.owned.includes(id)) return inv;
  return {
    ...inv,
    equipped: inv.equipped.includes(id)
      ? inv.equipped.filter((e) => e !== id)
      : [...inv.equipped, id],
  };
}
