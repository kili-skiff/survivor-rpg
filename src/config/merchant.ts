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

/** How a lantern looks in the watchman's hand. Index 0 is the old one you start with, then one per tier. */
export interface LanternLook {
  /** Metal of the frame and the ring */
  frame: number;
  /** Flame colour: outer, and the bright core */
  flame: number;
  core: number;
  /** Warm glow around the flame */
  glow: number;
  /** Size of the sprite and of its glow */
  scale: number;
}

export const LANTERN_LOOKS: readonly LanternLook[] = [
  { frame: 0x2b241d, flame: 0xf59e0b, core: 0xfde68a, glow: 0xffc27a, scale: 1 },
  { frame: 0x9a7424, flame: 0xf59e0b, core: 0xfde68a, glow: 0xffc27a, scale: 1.05 },
  { frame: 0xb9c2cf, flame: 0xfcd34d, core: 0xfffbeb, glow: 0xffe0a8, scale: 1.1 },
  { frame: 0x7a8fc4, flame: 0x93c5fd, core: 0xf0f9ff, glow: 0xa8d4ff, scale: 1.15 },
  { frame: 0xe0a91c, flame: 0xfde047, core: 0xffffff, glow: 0xffe27a, scale: 1.3 },
];

/** The look for a lantern level (0 = the old one). */
export function lanternLook(level: number): LanternLook {
  return LANTERN_LOOKS[Math.max(0, Math.min(level, LANTERN_LOOKS.length - 1))];
}

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

export const EMBERS = {
  /** Chance that a defeated (normal) enemy drops embers */
  dropChance: 0.006,
  /** Embers per drop: 1, plus one more every `extraEveryRings` rings */
  extraEveryRings: 3,
} as const;

/** Loot key under which embers are kept in the stash */
export const EMBER_KEY = 'embers';

/**
 * Phoenix Feather: takes you home with everything you carry after a won fight, from anywhere. Next to the
 * village and at a lit watchfire going home is free. It is no escape from a fight in progress.
 */
export const PHOENIX_FEATHER = {
  price: 30,
  /** How many you can carry */
  max: 3,
};
