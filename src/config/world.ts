import type { BiomeDef, BiomeId, PoiDef, PoiId } from './types';

/**
 * The map everyone plays: generated from this seed and generator version.
 * Seasons with a new shared map each come later (see docs/vision.md). Until then, bump
 * `generatorVersion` whenever world generation changes: map progress resets, the stash stays.
 */
export const SEASON = {
  id: 2,
  seed: 'nightwatch-season-2',
  generatorVersion: 4,
} as const;

export const WORLD = {
  /** Number of rings around the village */
  radius: 8,
  /** Share of hexes where herbs grow; the others are empty, so finding herbs stays rewarding */
  herbHexShare: 0.3,
  /** Points of interest never stand next to each other: minimum distance between any two */
  poiMinGap: 2,
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
  /** Segment duration in ring 1 (seconds). Short, so travelling near home is quick. */
  baseDurationSec: 45,
  /** Extra seconds per ring further out */
  durationPerRingSec: 15,
  maxDurationSec: 150,
  /** The countdown turns into a warning colour for the last N seconds */
  warningSec: 10,
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
  village: { id: 'village', name: 'Village', glyph: 'V', minRing: 0, chance: 0, minSpacing: 0 },
  camp: { id: 'camp', name: 'Camp', glyph: 'C', minRing: 1, chance: 0.07, minSpacing: 3 },
  merchant: { id: 'merchant', name: 'Merchant', glyph: 'M', minRing: 2, chance: 0.025, minSpacing: 5 },
  dungeon: { id: 'dungeon', name: 'Dungeon', glyph: 'D', minRing: 3, chance: 0.03, minSpacing: 4 },
  // Exactly one, in the outermost ring: the goal of the first quest. Its gate is sealed for now.
  tower: { id: 'tower', name: 'Old Tower', glyph: 'T', minRing: 0, chance: 0, minSpacing: 0 },
};
