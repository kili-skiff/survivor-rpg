// Deeds: exploration milestones that give small bonuses for good. Earned once, the moment the
// condition is met, and saved right away, so they stay when you fall or the map is reset.

import { DEEDS, type DeedDef, type DeedId } from '../config/deeds';
import type { PlayerStats } from '../config/types';
import type { SaveData } from './save';
import type { World } from './worldgen';

const DEED_IDS: readonly DeedId[] = DEEDS.map((d) => d.id);

/** The furthest ring the player stands on or has cleared on the current map. */
function furthestRing(save: SaveData, world: World): number {
  let ring = 0;
  for (const key of [save.world.position, ...save.world.cleared]) {
    ring = Math.max(ring, world.hexes.get(key)?.ring ?? 0);
  }
  return ring;
}

/** Whether the deed's condition is met by the current progress. */
export function deedMet(def: DeedDef, save: SaveData, world: World): boolean {
  const c = def.condition;
  switch (c.kind) {
    case 'ring':
      return furthestRing(save, world) >= c.ring;
    case 'camps':
      return save.world.waypoints.length >= c.count;
    case 'watchfires':
      return save.world.litWatchfires.length >= c.count;
    case 'tower':
      return save.quests.tower === 'done';
  }
}

/**
 * Adds every deed whose condition is now met. Returns the same save object when nothing new was
 * earned, so callers can tell cheaply.
 */
export function earnDeeds(save: SaveData, world: World): { save: SaveData; earned: DeedDef[] } {
  const earned = DEEDS.filter((d) => !save.deeds.includes(d.id) && deedMet(d, save, world));
  if (earned.length === 0) return { save, earned };
  const owned = new Set<DeedId>([...save.deeds, ...earned.map((d) => d.id)]);
  return { save: { ...save, deeds: DEED_IDS.filter((id) => owned.has(id)) }, earned };
}

/** All bonuses of the earned deeds added up. */
export function deedBonus(deeds: readonly DeedId[]): Partial<PlayerStats> {
  const out: Partial<PlayerStats> = {};
  for (const def of DEEDS) {
    if (!deeds.includes(def.id)) continue;
    for (const [key, value] of Object.entries(def.bonus) as [keyof PlayerStats, number][]) {
      out[key] = (out[key] ?? 0) + value;
    }
  }
  return out;
}

/** "Deed earned: Fireside (+0.3 health per second)" for one deed, a short list for several. */
export function describeEarned(earned: readonly DeedDef[]): string {
  if (earned.length === 0) return '';
  if (earned.length === 1) return `Deed earned: ${earned[0].name} (${earned[0].bonusText})`;
  return `Deeds earned: ${earned.map((d) => d.name).join(', ')}`;
}

/** Known deed ids in their listed order, so an outdated save cannot crash the game. */
export function parseDeeds(raw: unknown): DeedId[] {
  if (!Array.isArray(raw)) return [];
  return DEED_IDS.filter((id) => raw.includes(id));
}
