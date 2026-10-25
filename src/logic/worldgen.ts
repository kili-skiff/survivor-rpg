import type { BiomeId, PoiId, SegmentDef } from '../config/types';
import { BIOMES, POIS, SEASON, WORLD } from '../config/world';
import { hexDistance, hexesInRadius, hexKey, ORIGIN, pixelToHex, type Hex } from './hex';
import { createRng, hash32, hashFloat, seedFromString } from './rng';

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
const SALT = { regions: 1, jitter: 3, poi: 4, campFallback: 5 } as const;

interface Region {
  center: Hex;
  biome: BiomeId;
}

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

  // Biome regions: seeded centres, every hex takes the biome of its nearest centre.
  const regions = placeRegions(seed);

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

/** The hex at roughly `ring` steps from the village in direction `angle` (radians). */
function hexAtPolar(ring: number, angle: number): Hex {
  // Neighbouring hex centres are sqrt(3) apart in a pointy-top layout with size 1.
  const d = ring * Math.sqrt(3);
  return pixelToHex(Math.cos(angle) * d, Math.sin(angle) * d, 1);
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Inner regions: one per biome, like slices around the village, so every herb grows close to home.
 * Outer regions: fewer and larger further out; every biome appears there at least once more.
 */
function placeRegions(seed: number): Region[] {
  const rng = createRng(hash32(seed, SALT.regions));
  const regions: Region[] = [];

  const inner = shuffled(BIOME_IDS, rng);
  const innerTurn = rng() * Math.PI * 2;
  inner.forEach((biome, i) => {
    const angle = innerTurn + (i / inner.length) * Math.PI * 2;
    regions.push({ center: hexAtPolar(WORLD.innerRegionRing, angle), biome });
  });

  const outerBiomes = shuffled(BIOME_IDS, rng);
  while (outerBiomes.length < WORLD.outerRegions)
    outerBiomes.push(BIOME_IDS[Math.floor(rng() * BIOME_IDS.length)]);
  const outer = shuffled(outerBiomes, rng);
  const outerTurn = rng() * Math.PI * 2;
  const slice = (Math.PI * 2) / outer.length;
  outer.forEach((biome, i) => {
    const angle = outerTurn + (i + (rng() - 0.5) * 0.5) * slice;
    const ring =
      WORLD.outerRegionRingMin +
      Math.floor(rng() * (WORLD.outerRegionRingMax - WORLD.outerRegionRingMin + 1));
    regions.push({ center: hexAtPolar(ring, angle), biome });
  });
  return regions;
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
    herbs: { biome: h.biome, ring: h.ring },
  };
}

let seasonWorldCache: World | null = null;

/** The world of the current season, generated once and then reused. */
export function seasonWorld(): World {
  seasonWorldCache ??= generateWorld(SEASON.seed, SEASON.generatorVersion);
  return seasonWorldCache;
}
