import type { HerbId, PotionId } from './types';

// The village merchant: lantern upgrades, potion recipes, and buying your herbs.

export interface LanternTier {
  name: string;
  price: number;
  /** Light radius multiplier while you own this lantern (for good) */
  light: number;
  /** The best lantern drives the night away: no darkness on screen at all */
  lightsAll?: boolean;
}

export const LANTERN_TIERS: readonly LanternTier[] = [
  { name: 'Brass Lantern', price: 25, light: 1.3 },
  { name: 'Silver Lantern', price: 60, light: 1.7 },
  { name: 'Moonglass Lantern', price: 150, light: 2.3 },
  // Endgame: later perhaps found at a special place on the map instead of bought.
  { name: 'Sunstone Lantern', price: 400, light: 2.3, lightsAll: true },
];

/** Recipes you know from the start; the others are bought */
export const STARTING_RECIPES: readonly PotionId[] = ['healing'];

export const RECIPE_PRICES: Record<PotionId, number> = {
  healing: 0,
  haste: 30,
  ward: 40,
};

/** What the merchant pays for one herb */
export const HERB_PRICES: Record<HerbId, number> = {
  moonbloom: 1,
  shadowcap: 1,
  mirewort: 1,
  gravemoss: 1,
  emberroot: 1,
  starlily: 6,
};

export const GOLD = {
  /** Chance that a defeated (normal) enemy drops gold */
  dropChance: 0.006,
  /** Gold per drop: 1, plus one more every `extraEveryRings` rings */
  extraEveryRings: 3,
} as const;

/** Loot key under which gold is kept in the expedition loot and the stash */
export const GOLD_KEY = 'gold';
