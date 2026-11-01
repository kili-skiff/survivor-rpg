// Deeds: exploration milestones. Earned once, the moment the condition is met, and saved right away, so
// they stay when you fall or the map is reset. Each pays embers into the stash, some unlock an upgrade
// at the Hearth.

import { DEEDS, type DeedDef, type DeedId } from '../config/deeds';
import { EMBER_UPGRADES, type EmberUpgradeDef } from '../config/emberUpgrades';
import { bankEmbers, embersText } from './merchant';
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
    case 'watchfires': {
      const total = [...world.hexes.values()].filter((h) => h.poi === 'watchfire').length;
      const need = c.count === 'all' ? total : Math.min(c.count, total);
      return need > 0 && save.world.litWatchfires.length >= need;
    }
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
  // Their embers go straight into the stash.
  const embers = earned.reduce((sum, d) => sum + d.embers, 0);
  return { save: bankEmbers({ ...save, deeds: DEED_IDS.filter((id) => owned.has(id)) }, embers), earned };
}

/** The Hearth upgrade a deed unlocks, if any. */
export function deedUnlock(id: DeedId): EmberUpgradeDef | undefined {
  return EMBER_UPGRADES.find((u) => u.unlockedBy === id);
}

/** What a deed gives: "+40 embers, unlocks Armor at the Hearth". */
export function deedRewardText(def: DeedDef): string {
  const unlock = deedUnlock(def.id);
  return `+${embersText(def.embers)}${unlock ? `, unlocks ${unlock.name} at the Hearth` : ''}`;
}

/** The reward in two short lines for the deeds panel: "+40 embers", "Unlocks Armor". */
export function deedRewardShort(def: DeedDef): string {
  const unlock = deedUnlock(def.id);
  return `+${embersText(def.embers)}${unlock ? `\nUnlocks ${unlock.name}` : ''}`;
}

/** "Deed earned: Fireside (+20 embers, unlocks …)" for one deed, a short list for several. */
export function describeEarned(earned: readonly DeedDef[]): string {
  if (earned.length === 0) return '';
  if (earned.length === 1) return `Deed earned: ${earned[0].name} (${deedRewardText(earned[0])})`;
  const embers = earned.reduce((sum, d) => sum + d.embers, 0);
  return `Deeds earned: ${earned.map((d) => d.name).join(', ')} (+${embersText(embers)})`;
}

/** Known deed ids in their listed order, so an outdated save cannot crash the game. */
export function parseDeeds(raw: unknown): DeedId[] {
  if (!Array.isArray(raw)) return [];
  return DEED_IDS.filter((id) => raw.includes(id));
}
