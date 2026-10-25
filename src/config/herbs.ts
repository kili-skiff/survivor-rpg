import type { HerbDef, HerbId } from './types';

// Herbs grow in hexes and are gathered by standing next to them. Each biome has its own herb;
// rare herbs can grow anywhere further out.
export const HERBS: Record<HerbId, HerbDef> = {
  moonbloom: { id: 'moonbloom', name: 'Moonbloom', biome: 'meadow', rare: false, color: 0xc7d2fe },
  shadowcap: { id: 'shadowcap', name: 'Shadowcap', biome: 'forest', rare: false, color: 0xa78bfa },
  mirewort: { id: 'mirewort', name: 'Mirewort', biome: 'swamp', rare: false, color: 0x6ee7b7 },
  gravemoss: { id: 'gravemoss', name: 'Gravemoss', biome: 'graveyard', rare: false, color: 0x94a3b8 },
  emberroot: { id: 'emberroot', name: 'Emberroot', biome: 'hills', rare: false, color: 0xfb923c },
  starlily: { id: 'starlily', name: 'Star Lily', biome: null, rare: true, color: 0xfde68a },
};

export const HERB_RULES = {
  /** Herbs per hex: base + one more every `extraEveryRings` rings, up to `max` */
  base: 3,
  extraEveryRings: 2,
  max: 6,
  /** Rare herbs can only grow from this ring outwards */
  rareMinRing: 3,
  /** Chance for each herb to be a rare one (from rareMinRing on) */
  rareChance: 0.15,
  /** Distance from the starting point (px) */
  minDistance: 260,
  maxDistance: 720,
  /** Minimum distance between two herbs (px) */
  minSpacing: 170,
  /** Stand within this distance to gather (px) */
  gatherRadius: 38,
  /** Time you have to stay next to a herb (seconds) */
  gatherSec: 1,
  /**
   * Edge arrows only point to herbs at most this far beyond the edge of the screen (px).
   * Measured from the screen edge, so it works the same in portrait and landscape.
   */
  revealBeyondScreen: 320,
} as const;
