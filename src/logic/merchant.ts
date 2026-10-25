// Buying and selling at the village merchant. Pure and tested.

import {
  GOLD,
  GOLD_KEY,
  HERB_PRICES,
  LANTERN_TIERS,
  RECIPE_PRICES,
  type LanternTier,
} from '../config/merchant';
import type { HerbId, PotionId } from '../config/types';
import type { Loot } from './expedition';

export function goldOf(stash: Loot): number {
  return stash[GOLD_KEY] ?? 0;
}

function withGold(stash: Loot, gold: number): Loot {
  const out = { ...stash };
  if (gold > 0) out[GOLD_KEY] = gold;
  else delete out[GOLD_KEY];
  return out;
}

/** Gold dropped by one enemy in this ring. */
export function goldPerDrop(ring: number): number {
  return 1 + Math.floor(Math.max(0, ring) / GOLD.extraEveryRings);
}

/** The lantern you own (null for the old one you start with). */
export function currentLantern(level: number): LanternTier | null {
  const clamped = Math.max(0, Math.min(level, LANTERN_TIERS.length));
  return clamped > 0 ? LANTERN_TIERS[clamped - 1] : null;
}

/** Light radius multiplier from the lantern you own. */
export function lanternMultiplier(level: number): number {
  return currentLantern(level)?.light ?? 1;
}

/** Whether your lantern lights up the whole screen (no darkness in fights). */
export function lanternLightsAll(level: number): boolean {
  return currentLantern(level)?.lightsAll ?? false;
}

/** The next lantern tier and its price, or null when all are bought. */
export function nextLantern(level: number): { tier: number; name: string; price: number } | null {
  const t = LANTERN_TIERS[level];
  return t ? { tier: level + 1, name: t.name, price: t.price } : null;
}

export function buyLantern(stash: Loot, level: number): { stash: Loot; level: number } | null {
  const next = nextLantern(level);
  if (!next || goldOf(stash) < next.price) return null;
  return { stash: withGold(stash, goldOf(stash) - next.price), level: level + 1 };
}

export function buyRecipe(
  stash: Loot,
  known: readonly PotionId[],
  id: PotionId,
): { stash: Loot; recipes: PotionId[] } | null {
  const price = RECIPE_PRICES[id];
  if (known.includes(id) || goldOf(stash) < price) return null;
  return { stash: withGold(stash, goldOf(stash) - price), recipes: [...known, id] };
}

/** Sells one herb from the stash. Null if there is none. */
export function sellHerb(stash: Loot, id: HerbId): Loot | null {
  const n = stash[id] ?? 0;
  if (n < 1) return null;
  const out = withGold(stash, goldOf(stash) + HERB_PRICES[id]);
  if (n - 1 > 0) out[id] = n - 1;
  else delete out[id];
  return out;
}
