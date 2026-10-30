import { describe, expect, it } from "vitest";

import { COSMETICS, purchase, toggleEquip, type Inventory } from "./upgrades";

const inv = (credits: number): Inventory => ({ credits, owned: [], equipped: [] });

describe("System Upgrades", () => {
  it("prices: Hacker Shades 100, Cybernetic Wings 300, Neon Matrix Aura 500", () => {
    expect(COSMETICS.map((c) => [c.name, c.cost])).toEqual([
      ["Hacker Shades", 100],
      ["Cybernetic Wings", 300],
      ["Neon Matrix Aura", 500],
    ]);
  });

  it("spends credits, unlocks and equips", () => {
    const r = purchase(inv(350), "wings");
    expect(r.ok).toBe(true);
    expect(r.inventory).toEqual({ credits: 50, owned: ["wings"], equipped: ["wings"] });
  });

  it("refuses when credits are short or the item is owned", () => {
    expect(purchase(inv(499), "aura")).toMatchObject({ ok: false, reason: "insufficient" });
    const owned = purchase(inv(200), "shades").inventory;
    expect(purchase(owned, "shades")).toMatchObject({ ok: false, reason: "owned" });
    expect(owned.credits).toBe(100);
  });

  it("only toggles owned items", () => {
    const owned = purchase(inv(100), "shades").inventory;
    expect(toggleEquip(owned, "shades").equipped).toEqual([]);
    expect(toggleEquip(owned, "aura").equipped).toEqual(["shades"]);
  });
});
