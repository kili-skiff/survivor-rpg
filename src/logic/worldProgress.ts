import { areNeighbors, hexKey, hexNeighbors, ORIGIN, parseHexKey, type Hex } from './hex';
import type { RunOutcome } from './segment';
import type { World } from './worldgen';

/**
 * The player's progress on the world map. This is what gets saved; the map itself is
 * regenerated from the season seed.
 */
export interface WorldProgress {
  seasonId: number;
  generatorVersion: number;
  /** Hex key where the player currently stands */
  position: string;
  /** Hex keys the player can see (visited or next to a visited hex) */
  discovered: string[];
  /** Hex keys the player has cleared at least once */
  cleared: string[];
}

export function createWorldProgress(seasonId: number, generatorVersion: number): WorldProgress {
  const progress: WorldProgress = {
    seasonId,
    generatorVersion,
    position: hexKey(ORIGIN),
    discovered: [hexKey(ORIGIN)],
    cleared: [hexKey(ORIGIN)],
  };
  return reveal(progress, ORIGIN);
}

/** Adds a hex and its neighbours to the discovered list. */
function reveal(progress: WorldProgress, hex: Hex): WorldProgress {
  const discovered = new Set(progress.discovered);
  discovered.add(hexKey(hex));
  for (const n of hexNeighbors(hex)) discovered.add(hexKey(n));
  return { ...progress, discovered: [...discovered] };
}

export function isDiscovered(progress: WorldProgress, key: string): boolean {
  return progress.discovered.includes(key);
}

export function isCleared(progress: WorldProgress, key: string): boolean {
  return progress.cleared.includes(key);
}

export type TravelKind = 'fight' | 'walk' | 'blocked';

/**
 * What happens when the player taps a hex: neighbours inside the world can be entered.
 * The village is safe and reached without a fight; every other hex means a fight
 * (cleared hexes fill with monsters again).
 */
export function travelKind(world: World, progress: WorldProgress, target: Hex): TravelKind {
  const key = hexKey(target);
  const info = world.hexes.get(key);
  if (!info) return 'blocked';
  const from = parseHexKey(progress.position);
  if (!areNeighbors(from, target)) return 'blocked';
  return info.poi === 'village' ? 'walk' : 'fight';
}

/** Moves the player without a fight (e.g. back into the village). */
export function walkTo(progress: WorldProgress, target: Hex): WorldProgress {
  return reveal({ ...progress, position: hexKey(target) }, target);
}

/** Applies the result of a fight in `target`: cleared moves you there, falling sends you home. */
export function applyFightResult(progress: WorldProgress, target: Hex, outcome: RunOutcome): WorldProgress {
  if (outcome === 'fallen') return { ...progress, position: hexKey(ORIGIN) };
  const key = hexKey(target);
  const cleared = progress.cleared.includes(key) ? progress.cleared : [...progress.cleared, key];
  return reveal({ ...progress, position: key, cleared }, target);
}

/** Validates loaded data; returns null when it is unusable. */
export function parseWorldProgress(raw: unknown): WorldProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<WorldProgress>;
  const isKeyList = (v: unknown): v is string[] => Array.isArray(v) && v.every((k) => typeof k === 'string');
  if (
    typeof d.seasonId !== 'number' ||
    typeof d.generatorVersion !== 'number' ||
    typeof d.position !== 'string' ||
    !isKeyList(d.discovered) ||
    !isKeyList(d.cleared)
  ) {
    return null;
  }
  return {
    seasonId: d.seasonId,
    generatorVersion: d.generatorVersion,
    position: d.position,
    discovered: d.discovered,
    cleared: d.cleared,
  };
}
