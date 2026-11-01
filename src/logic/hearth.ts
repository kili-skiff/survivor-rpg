// The Hearth: permanent upgrades bought with embers (config/emberUpgrades.ts). Pure and tested.

import { EMBER_UPGRADES, type EmberUpgradeDef, type EmberUpgradeId } from '../config/emberUpgrades';
import type { DeedId } from '../config/deeds';
import { POTION_RULES } from '../config/potions';
import type { PlayerStats } from '../config/types';
import type { Loot } from './expedition';
import { embersOf } from './merchant';
import { EMBER_KEY } from '../config/merchant';

/** The ranks bought at the Hearth, by upgrade (missing = none). */
export type HearthRanks = Partial<Record<EmberUpgradeId, number>>;

export function upgradeDef(id: EmberUpgradeId): EmberUpgradeDef {
  return EMBER_UPGRADES.find((d) => d.id === id)!;
}

/** True once the deed that unlocks it is earned (or when it needs none). */
export function isUnlocked(def: EmberUpgradeDef, deeds: readonly DeedId[]): boolean {
  return def.unlockedBy === undefined || deeds.includes(def.unlockedBy);
}

/** Price of the next rank, or null when it is at its highest. Rank n costs n times the base price. */
export function nextRankPrice(def: EmberUpgradeDef, ranks: HearthRanks): number | null {
  const rank = ranks[def.id] ?? 0;
  return rank >= def.maxRank ? null : def.basePrice * (rank + 1);
}

/** Buys the next rank. Null when it is locked, at its highest or too dear. */
export function buyRank(
  stash: Loot,
  ranks: HearthRanks,
  deeds: readonly DeedId[],
  id: EmberUpgradeId,
): { stash: Loot; ranks: HearthRanks } | null {
  const def = upgradeDef(id);
  const price = nextRankPrice(def, ranks);
  if (price === null || !isUnlocked(def, deeds) || embersOf(stash) < price) return null;
  const left = embersOf(stash) - price;
  const nextStash: Loot = { ...stash };
  if (left > 0) nextStash[EMBER_KEY] = left;
  else delete nextStash[EMBER_KEY];
  return { stash: nextStash, ranks: { ...ranks, [id]: (ranks[id] ?? 0) + 1 } };
}

/** All bonuses of the bought ranks added up (they go on top of the base stats in every fight). */
export function hearthBonus(ranks: HearthRanks): Partial<PlayerStats> {
  const out: Partial<PlayerStats> = {};
  for (const def of EMBER_UPGRADES) {
    const rank = ranks[def.id] ?? 0;
    if (rank <= 0) continue;
    for (const [key, value] of Object.entries(def.perRank) as [keyof PlayerStats, number][]) {
      out[key] = (out[key] ?? 0) + value * rank;
    }
  }
  return out;
}

/** How many potions the belt holds: the base size plus slots from the Hearth. */
export function beltSize(ranks: HearthRanks): number {
  let size = POTION_RULES.beltSize;
  for (const def of EMBER_UPGRADES) size += (def.beltSlots ?? 0) * (ranks[def.id] ?? 0);
  return size;
}

/** The largest belt possible (to read a saved belt before the ranks are known). */
export function maxBeltSize(): number {
  return beltSize(Object.fromEntries(EMBER_UPGRADES.map((d) => [d.id, d.maxRank])) as HearthRanks);
}

/** Reads saved ranks: known upgrades only, whole numbers within their ranks. */
export function parseHearth(raw: unknown): HearthRanks {
  const out: HearthRanks = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const def of EMBER_UPGRADES) {
    const v = (raw as Record<string, unknown>)[def.id];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const rank = Math.max(0, Math.min(def.maxRank, Math.floor(v)));
    if (rank > 0) out[def.id] = rank;
  }
  return out;
}
