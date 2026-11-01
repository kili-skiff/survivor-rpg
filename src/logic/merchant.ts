// Buying and selling at the village merchant. Pure and tested.

import {
  EMBERS,
  EMBER_KEY,
  PHOENIX_FEATHER,
  HERB_PRICES,
  LANTERN_TIERS,
  RECIPE_PRICES,
  type LanternTier,
} from '../config/merchant';
import type { HerbId, PotionId } from '../config/types';
import type { Loot } from './expedition';

export function embersOf(stash: Loot): number {
  return stash[EMBER_KEY] ?? 0;
}

function withEmbers(stash: Loot, embers: number): Loot {
  const out = { ...stash };
  if (embers > 0) out[EMBER_KEY] = embers;
  else delete out[EMBER_KEY];
  return out;
}

/** "1 ember", "5 embers". */
export function embersText(n: number): string {
  return `${n} ${n === 1 ? 'ember' : 'embers'}`;
}

/** Puts embers caught in a fight straight into the stash: they count at once, also when you fall. */
export function bankEmbers<T extends { stash: Loot }>(save: T, embers: number): T {
  if (embers <= 0) return save;
  return { ...save, stash: withEmbers(save.stash, embersOf(save.stash) + embers) };
}

/** Embers dropped by one enemy in this ring. */
export function embersPerDrop(ring: number): number {
  return 1 + Math.floor(Math.max(0, ring) / EMBERS.extraEveryRings);
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
  if (!next || embersOf(stash) < next.price) return null;
  return { stash: withEmbers(stash, embersOf(stash) - next.price), level: level + 1 };
}

export function buyRecipe(
  stash: Loot,
  known: readonly PotionId[],
  id: PotionId,
): { stash: Loot; recipes: PotionId[] } | null {
  const price = RECIPE_PRICES[id];
  if (known.includes(id) || embersOf(stash) < price) return null;
  return { stash: withEmbers(stash, embersOf(stash) - price), recipes: [...known, id] };
}

/** Sells one herb from the stash. Null if there is none. */
export function sellHerb(stash: Loot, id: HerbId): Loot | null {
  const n = stash[id] ?? 0;
  if (n < 1) return null;
  const out = withEmbers(stash, embersOf(stash) + HERB_PRICES[id]);
  if (n - 1 > 0) out[id] = n - 1;
  else delete out[id];
  return out;
}

/** Buys a Phoenix Feather. Null when you carry the most already or it is too dear. */
export function buyFeather(stash: Loot, feathers: number): { stash: Loot; feathers: number } | null {
  if (feathers >= PHOENIX_FEATHER.max || embersOf(stash) < PHOENIX_FEATHER.price) return null;
  return { stash: withEmbers(stash, embersOf(stash) - PHOENIX_FEATHER.price), feathers: feathers + 1 };
}
