import { parseExpedition, type Expedition } from './expedition';
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
  /** Camps the player reached; they can be teleported to from the village */
  waypoints: string[];
  /** The expedition in progress, or null while at home */
  expedition: Expedition | null;
  /** Watchfires the player has lit */
  litWatchfires: string[];
  /** Expeditions finished so far (home or fallen); fight goals are rolled anew for each one */
  expeditions: number;
}

export function createWorldProgress(seasonId: number, generatorVersion: number): WorldProgress {
  const progress: WorldProgress = {
    seasonId,
    generatorVersion,
    position: hexKey(ORIGIN),
    discovered: [hexKey(ORIGIN)],
    cleared: [hexKey(ORIGIN)],
    waypoints: [],
    expedition: null,
    expeditions: 0,
    litWatchfires: [],
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

/** Cleared on the current expedition: empty until you return home. */
export function isUsedUp(progress: WorldProgress, key: string): boolean {
  return progress.expedition?.cleared.includes(key) ?? false;
}

export function isCleared(progress: WorldProgress, key: string): boolean {
  return progress.cleared.includes(key);
}

export type TravelKind = 'fight' | 'walk' | 'teleport' | 'blocked';

export function isAtHome(progress: WorldProgress): boolean {
  return progress.position === hexKey(ORIGIN);
}

/**
 * What happens when the player taps a hex:
 * - neighbours can be entered; the village needs no fight, every other hex does
 *   (cleared hexes fill with monsters again),
 * - from the village you can teleport to any waypoint, and from a waypoint back home.
 */
export function travelKind(world: World, progress: WorldProgress, target: Hex): TravelKind {
  const key = hexKey(target);
  const info = world.hexes.get(key);
  // The tower's gate is sealed for now: it can be seen and reached, but not entered.
  if (!info || key === progress.position || info.poi === 'tower') return 'blocked';
  const from = parseHexKey(progress.position);
  // The village and hexes already cleared on this expedition are walked into without a fight.
  if (areNeighbors(from, target)) return info.poi === 'village' || isUsedUp(progress, key) ? 'walk' : 'fight';
  if (isAtHome(progress) && progress.waypoints.includes(key)) return 'teleport';
  if (info.poi === 'village' && progress.waypoints.includes(progress.position)) return 'teleport';
  return 'blocked';
}

/** Moves the player without a fight (e.g. back into the village). */
/** Lights a watchfire: it stays lit, and every hex within `radius` is revealed. */
export function lightWatchfire(progress: WorldProgress, key: string, radius: number): WorldProgress {
  if (progress.litWatchfires.includes(key)) return progress;
  const center = parseHexKey(key);
  const discovered = new Set(progress.discovered);
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      discovered.add(hexKey({ q: center.q + q, r: center.r + r }));
    }
  }
  return { ...progress, discovered: [...discovered], litWatchfires: [...progress.litWatchfires, key] };
}

export function isLit(progress: WorldProgress, key: string): boolean {
  return progress.litWatchfires.includes(key);
}

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

export function addWaypoint(progress: WorldProgress, key: string): WorldProgress {
  return progress.waypoints.includes(key)
    ? progress
    : { ...progress, waypoints: [...progress.waypoints, key] };
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
    // Added later: default when missing.
    waypoints: isKeyList(d.waypoints) ? d.waypoints : [],
    expedition: parseExpedition(d.expedition),
    litWatchfires: isKeyList(d.litWatchfires) ? d.litWatchfires : [],
    expeditions:
      typeof d.expeditions === 'number' && Number.isFinite(d.expeditions)
        ? Math.max(0, Math.floor(d.expeditions))
        : 0,
  };
}
