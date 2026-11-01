import type { BiomeId, PoiId, SegmentDef } from '../config/types';
import { BIOMES, POIS, SEASON, WORLD } from '../config/world';
import { hexDistance, hexesInRadius, hexKey, hexToPixel, ORIGIN, pixelToHex, type Hex } from './hex';
import { goalForHex } from './goals';
import { rewardForHex } from './rewards';
import { createRng, hash32, hashFloat, seedFromString } from './rng';

export interface WorldHex {
  hex: Hex;
  key: string;
  /** Distance from the village */
  ring: number;
  biome: BiomeId;
  poi: PoiId | null;
  /** Herbs grow here (only on some hexes) */
  herbs: boolean;
}

export interface World {
  seed: number;
  radius: number;
  hexes: Map<string, WorldHex>;
  /** Hex key of the old tower in the outermost ring */
  tower: string;
  /** Hex key of the camp close to the village on the way to the tower */
  roadCamp: string | null;
}

const BIOME_IDS = Object.keys(BIOMES) as BiomeId[];
/** Salts keep different random decisions independent of each other. */
const SALT = { regions: 1, jitter: 3, poi: 4, herbs: 6, herbFallback: 7 } as const;

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
    const herbs = ring >= WORLD.herbMinRing && hashFloat(seed, SALT.herbs, hex.q, hex.r) < WORLD.herbHexShare;
    hexes.set(hexKey(hex), { hex, key: hexKey(hex), ring, biome: best.biome, poi: null, herbs });
  }

  ensureHerbsNearHome(seed, hexes);
  const { tower, roadCamp } = placePois(seed, hexes, radius);
  return { seed, radius, hexes, tower, roadCamp };
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

/** Every biome has at least one herb hex in the first rings, so each common herb can be found early. */
function ensureHerbsNearHome(seed: number, hexes: Map<string, WorldHex>): void {
  const near = [...hexes.values()].filter(
    (h) => h.ring >= WORLD.herbMinRing && h.ring <= WORLD.innerRegionRing,
  );
  for (const biome of BIOME_IDS) {
    const own = near.filter((h) => h.biome === biome);
    if (own.length === 0 || own.some((h) => h.herbs)) continue;
    own[hash32(seed, SALT.herbFallback, BIOME_IDS.indexOf(biome)) % own.length].herbs = true;
  }
}

/** Distance rules: never next to another point of interest, and spread out from their own kind. */
function fitsPoi(h: WorldHex, id: PoiId, placed: WorldHex[]): boolean {
  return placed.every((p) => {
    const d = hexDistance(h.hex, p.hex);
    return d >= WORLD.poiMinGap && (p.poi !== id || d >= POIS[id].minSpacing);
  });
}

/**
 * Points of interest: the village in the centre, the old tower in the outermost ring, a camp two
 * steps from the village in the tower's direction (a first stop on the way), then rare camps,
 * merchants and dungeons spread out over the map.
 */
function placePois(
  seed: number,
  hexes: Map<string, WorldHex>,
  radius: number,
): { tower: string; roadCamp: string | null } {
  const rng = createRng(hash32(seed, SALT.poi));
  const village = hexes.get(hexKey(ORIGIN))!;
  village.poi = 'village';
  const placed: WorldHex[] = [village];
  const order = shuffled(
    [...hexes.values()].filter((h) => h.ring > 0),
    rng,
  );

  const tower = order.find((h) => h.ring === radius)!;
  tower.poi = 'tower';
  tower.herbs = false;
  placed.push(tower);

  // The road camp: of the hexes two steps out, the one closest to the tower.
  let roadCamp: WorldHex | undefined;
  for (const h of order) {
    if (h.ring !== 2 || !fitsPoi(h, 'camp', placed)) continue;
    if (!roadCamp || hexDistance(h.hex, tower.hex) < hexDistance(roadCamp.hex, tower.hex)) roadCamp = h;
  }
  if (roadCamp) {
    roadCamp.poi = 'camp';
    placed.push(roadCamp);
  }

  // Watchfires: one in each slice around the village, so every direction has something to find.
  const slice = (Math.PI * 2) / WORLD.watchfires;
  for (let i = 0; i < WORLD.watchfires; i++) {
    const fire = order.find((h) => {
      if (h.poi || h.ring < WORLD.watchfireRingMin || h.ring > WORLD.watchfireRingMax) return false;
      const p = hexToPixel(h.hex, 1);
      const angle = (Math.atan2(p.y, p.x) + Math.PI * 2) % (Math.PI * 2);
      return Math.floor(angle / slice) === i && fitsPoi(h, 'watchfire', placed);
    });
    if (!fire) continue;
    fire.poi = 'watchfire';
    placed.push(fire);
  }
  for (const id of ['dungeon', 'merchant', 'camp'] as const) {
    const def = POIS[id];
    for (const h of order) {
      if (h.poi || h.ring < def.minRing || rng() >= def.chance || !fitsPoi(h, id, placed)) continue;
      h.poi = id;
      placed.push(h);
    }
  }
  return { tower: tower.key, roadCamp: roadCamp?.key ?? null };
}

/**
 * The fight you get when entering a hex. Further rings last longer and start harder. `expedition` is the
 * number of finished expeditions: the hex's goal stays the same for one expedition and changes with the next.
 * `fireLit`: the hex's watchfire already burns.
 */
export function segmentForHex(h: WorldHex, expedition = 0, fireLit = false): SegmentDef {
  const biome = BIOMES[h.biome];
  const steps = Math.max(0, h.ring - 1);
  const durationSec = Math.min(
    WORLD.maxDurationSec,
    WORLD.baseDurationSec + steps * WORLD.durationPerRingSec,
  );
  return {
    id: `hex:${h.key}`,
    name: h.poi && h.poi !== 'village' ? `${biome.name} · ${POIS[h.poi].name}` : biome.name,
    goal: goalForHex(h, durationSec, expedition, SEASON.seed, fireLit),
    reward: rewardForHex(h, expedition, SEASON.seed),
    durationSec,
    warningSec: WORLD.warningSec,
    difficultyOffsetSec: steps * WORLD.difficultyOffsetPerRingSec,
    groundTint: biome.groundTint,
    biome: h.biome,
    herbs: h.herbs ? { biome: h.biome, ring: h.ring } : null,
  };
}

let seasonWorldCache: World | null = null;

/** The world of the current season, generated once and then reused. */
export function seasonWorld(): World {
  seasonWorldCache ??= generateWorld(SEASON.seed, SEASON.generatorVersion);
  return seasonWorldCache;
}
