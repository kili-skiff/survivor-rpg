import { HERB_RULES, HERBS } from '../config/herbs';
import type { BiomeId, HerbDef, HerbId } from '../config/types';
import type { Rng } from './spawning';

export interface HerbSpot {
  herb: HerbId;
  x: number;
  y: number;
}

export function herbCountForRing(ring: number): number {
  return Math.min(
    HERB_RULES.max,
    HERB_RULES.base + Math.floor(Math.max(0, ring - 1) / HERB_RULES.extraEveryRings),
  );
}

export function commonHerbFor(biome: BiomeId): HerbDef {
  const herb = Object.values(HERBS).find((h) => h.biome === biome && !h.rare);
  if (!herb) throw new Error(`No herb for biome ${biome}`);
  return herb;
}

const RARE_HERBS = Object.values(HERBS).filter((h) => h.rare);

/**
 * Places the herbs of one segment around the starting point (0, 0). Herbs are spread out and
 * kept away from the start, so the player has to go looking for them.
 */
export function placeHerbs(biome: BiomeId, ring: number, rng: Rng): HerbSpot[] {
  const count = herbCountForRing(ring);
  const common = commonHerbFor(biome);
  const spots: HerbSpot[] = [];
  let attempts = 0;
  while (spots.length < count && attempts < 400) {
    attempts += 1;
    const angle = rng() * Math.PI * 2;
    const dist = HERB_RULES.minDistance + rng() * (HERB_RULES.maxDistance - HERB_RULES.minDistance);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    // Relax the spacing rule if we are struggling to fit everything.
    const spacing = attempts > 200 ? HERB_RULES.minSpacing / 2 : HERB_RULES.minSpacing;
    if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < spacing)) continue;
    const rare = ring >= HERB_RULES.rareMinRing && RARE_HERBS.length > 0 && rng() < HERB_RULES.rareChance;
    const herb = rare ? RARE_HERBS[Math.floor(rng() * RARE_HERBS.length)].id : common.id;
    spots.push({ herb, x, y });
  }
  return spots;
}

/** Gathering progress for one herb: grows while the player stands close, resets otherwise. */
export function advanceGather(progress: number, inRange: boolean, dt: number): number {
  return inRange ? Math.min(1, progress + dt / HERB_RULES.gatherSec) : 0;
}
