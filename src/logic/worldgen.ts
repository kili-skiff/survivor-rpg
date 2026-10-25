import type { BiomeId, PoiId, SegmentDef } from '../config/types';
import { BIOMES, POIS, SEASON, WORLD } from '../config/world';
import { hexDistance, hexesInRadius, hexKey, ORIGIN, type Hex } from './hex';
import { hash32, hashFloat, seedFromString } from './rng';

export interface WorldHex {
  hex: Hex;
  key: string;
  /** Distance from the village */
  ring: number;
  biome: BiomeId;
  poi: PoiId | null;
}

export interface World {
  seed: number;
  radius: number;
  hexes: Map<string, WorldHex>;
}

const BIOME_IDS = Object.keys(BIOMES) as BiomeId[];
/** Salts keep different random decisions independent of each other. */
const SALT = { region: 1, regionBiome: 2, jitter: 3, poi: 4, campFallback: 5 } as const;

/**
 * Generates the whole world from a seed. Pure and deterministic: the same seed and generator
 * version always produce the same map on every device. Only player progress is saved, never the map.
 */
export function generateWorld(
  seedText: string,
  generatorVersion: number,
  radius: number = WORLD.radius,
): World {
  const seed = seedFromString(`${seedText}:v${generatorVersion}`);
  const all = hexesInRadius(radius);

  // Biome regions: a few seeded centres, every hex takes the biome of its nearest centre.
  const regions = Array.from({ length: WORLD.biomeRegions }, (_, i) => ({
    center: all[hash32(seed, SALT.region, i) % all.length],
    biome: BIOME_IDS[hash32(seed, SALT.regionBiome, i) % BIOME_IDS.length],
  }));

  const hexes = new Map<string, WorldHex>();
  for (const hex of all) {
    const ring = hexDistance(hex, ORIGIN);
    let best = regions[0];
    let bestScore = Infinity;
    for (const region of regions) {
      // A little jitter makes region borders less straight.
      const score = hexDistance(hex, region.center) + hashFloat(seed, SALT.jitter, hex.q, hex.r) * 0.9;
      if (score < bestScore) {
        bestScore = score;
        best = region;
      }
    }
    hexes.set(hexKey(hex), { hex, key: hexKey(hex), ring, biome: best.biome, poi: rollPoi(seed, hex, ring) });
  }

  ensureEarlyCamp(seed, hexes);
  return { seed, radius, hexes };
}

function rollPoi(seed: number, hex: Hex, ring: number): PoiId | null {
  if (ring === 0) return 'village';
  let roll = hashFloat(seed, SALT.poi, hex.q, hex.r);
  for (const id of ['dungeon', 'merchant', 'camp'] as const) {
    const def = POIS[id];
    if (ring < def.minRing) continue;
    if (roll < def.chance) return id;
    roll -= def.chance;
  }
  return null;
}

/** Makes sure there is a camp within two steps of the village, so the first expedition has a goal. */
function ensureEarlyCamp(seed: number, hexes: Map<string, WorldHex>): void {
  const early = [...hexes.values()].filter((h) => h.ring >= 1 && h.ring <= 2);
  if (early.some((h) => h.poi === 'camp')) return;
  const candidates = early.filter((h) => h.ring === 2 && h.poi === null);
  const pick = candidates[hash32(seed, SALT.campFallback) % candidates.length];
  if (pick) pick.poi = 'camp';
}

/** The fight you get when entering a hex. Further rings last longer and start harder. */
export function segmentForHex(h: WorldHex): SegmentDef {
  const biome = BIOMES[h.biome];
  const steps = Math.max(0, h.ring - 1);
  return {
    id: `hex:${h.key}`,
    name: h.poi && h.poi !== 'village' ? `${biome.name} · ${POIS[h.poi].name}` : biome.name,
    durationSec: Math.min(WORLD.maxDurationSec, WORLD.baseDurationSec + steps * WORLD.durationPerRingSec),
    warningSec: 15,
    difficultyOffsetSec: steps * WORLD.difficultyOffsetPerRingSec,
    groundTint: biome.groundTint,
  };
}

let seasonWorldCache: World | null = null;

/** The world of the current season, generated once and then reused. */
export function seasonWorld(): World {
  seasonWorldCache ??= generateWorld(SEASON.seed, SEASON.generatorVersion);
  return seasonWorldCache;
}
