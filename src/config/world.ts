import type { BiomeDef, BiomeId, PoiDef, PoiId } from './types';

/**
 * The current season. Everyone playing the same season gets the same map.
 * Bump `generatorVersion` only together with a new season: changing how the map is generated
 * mid-season would change existing players' worlds.
 */
export const SEASON = {
  id: 2,
  name: 'Season 2',
  seed: 'nightwatch-season-2',
  generatorVersion: 2,
} as const;

export const WORLD = {
  /** Number of rings around the village */
  radius: 8,
  /**
   * Inner biome regions: one per biome, spread evenly around the village with their centre in
   * this ring, so every biome (and its herb) can be reached early.
   */
  innerRegionRing: 3,
  /** Outer biome regions beyond the inner ones; every biome gets at least one of them */
  outerRegions: 7,
  /** Ring range for the centres of the outer regions */
  outerRegionRingMin: 6,
  outerRegionRingMax: 8,
  /** Segment duration in ring 1 (seconds) */
  baseDurationSec: 90,
  /** Extra seconds per ring further out */
  durationPerRingSec: 20,
  maxDurationSec: 210,
  /** How many seconds "later" the enemy mix starts per ring (harder enemies appear sooner) */
  difficultyOffsetPerRingSec: 30,
} as const;

export const BIOMES: Record<BiomeId, BiomeDef> = {
  meadow: { id: 'meadow', name: 'Moonlit Meadow', color: 0x4b5d3a, groundTint: 0x2b3a22 },
  forest: { id: 'forest', name: 'Darkwood', color: 0x2e4a34, groundTint: 0x1d2e22 },
  swamp: { id: 'swamp', name: 'Mire', color: 0x3b4a43, groundTint: 0x1f2e2a },
  graveyard: { id: 'graveyard', name: 'Old Graveyard', color: 0x4a4458, groundTint: 0x29223a },
  hills: { id: 'hills', name: 'Barren Hills', color: 0x5a4d3e, groundTint: 0x33291f },
};

export const POIS: Record<PoiId, PoiDef> = {
  village: { id: 'village', name: 'Village', glyph: 'V', minRing: 0, chance: 0 },
  camp: { id: 'camp', name: 'Camp', glyph: 'C', minRing: 1, chance: 0.12 },
  merchant: { id: 'merchant', name: 'Merchant', glyph: 'M', minRing: 2, chance: 0.05 },
  dungeon: { id: 'dungeon', name: 'Dungeon', glyph: 'D', minRing: 3, chance: 0.05 },
};
