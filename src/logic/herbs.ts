import { HERB_RULES, HERBS } from '../config/herbs';
import type { BiomeId, HerbDef, HerbId } from '../config/types';
import type { Rng } from './spawning';

/** A herb that will bloom during the fight, at `atSec` seconds into the segment. */
export interface HerbBloom {
  herb: HerbId;
  atSec: number;
}

export interface Point {
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
 * When and which herbs bloom in a segment. The bloom period is split into one window per herb and
 * each herb blooms at a random moment inside its own window: spread over the fight, but not
 * predictable. The total is fixed; nothing grows back.
 */
export function planHerbBlooms(biome: BiomeId, ring: number, durationSec: number, rng: Rng): HerbBloom[] {
  const count = herbCountForRing(ring);
  const common = commonHerbFor(biome);
  const start = durationSec * HERB_RULES.bloomFrom;
  const window = (durationSec * HERB_RULES.bloomUntil - start) / count;
  const blooms: HerbBloom[] = [];
  for (let i = 0; i < count; i++) {
    const rare = ring >= HERB_RULES.rareMinRing && RARE_HERBS.length > 0 && rng() < HERB_RULES.rareChance;
    const herb = rare ? RARE_HERBS[Math.floor(rng() * RARE_HERBS.length)].id : common.id;
    blooms.push({ herb, atSec: start + (i + rng()) * window });
  }
  return blooms;
}

/**
 * Where a herb blooms: a random spot just off screen around the player, so an edge arrow shows
 * it, and not too close to other herbs.
 */
export function bloomPosition(player: Point, viewW: number, viewH: number, others: Point[], rng: Rng): Point {
  let best: Point = player;
  let bestGap = -1;
  for (let attempt = 0; attempt < 24; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    // Distance from the player to the screen edge in this direction.
    const toEdge = Math.min(
      dx !== 0 ? viewW / 2 / Math.abs(dx) : Infinity,
      dy !== 0 ? viewH / 2 / Math.abs(dy) : Infinity,
    );
    const beyond =
      HERB_RULES.bloomMinBeyondScreen +
      rng() * (HERB_RULES.bloomMaxBeyondScreen - HERB_RULES.bloomMinBeyondScreen);
    const p = { x: player.x + dx * (toEdge + beyond), y: player.y + dy * (toEdge + beyond) };
    const gap = Math.min(Infinity, ...others.map((o) => Math.hypot(o.x - p.x, o.y - p.y)));
    if (gap >= HERB_RULES.minSpacing) return p;
    if (gap > bestGap) {
      bestGap = gap;
      best = p;
    }
  }
  return best;
}

/** Gathering progress for one herb: grows while the player stands close, resets when leaving. */
export function advanceGather(progress: number, inRange: boolean, dt: number): number {
  return inRange ? Math.min(1, progress + dt / HERB_RULES.gatherSec) : 0;
}

/** A hit breaks your concentration and costs part of the progress. */
export function progressAfterHit(progress: number): number {
  return progress * HERB_RULES.progressKeptOnHit;
}
