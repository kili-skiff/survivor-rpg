// Treasure chests: when enemies drop one and what it holds. Pure and tested.

import { CHEST } from '../config/balance';
import { goldPerDrop } from './merchant';
import type { Rng } from './spawning';
import type { Loadout } from './stats';
import { applyUpgrade, rollUpgradeOptions, type UpgradeOption } from './upgrades';

export interface ChestReward {
  gold: number;
  /** Applied one after another, in this order */
  upgrades: UpgradeOption[];
}

/** Rolls whether a killed enemy leaves a chest; elites are far more likely to. */
export function dropsChest(elite: boolean, rng: Rng, fortune = 0): boolean {
  return rng() < (elite ? CHEST.eliteDropChance : CHEST.dropChance) * (1 + Math.max(0, fortune));
}

/** Usually one upgrade, sometimes three, rarely five. */
export function chestUpgradeCount(rng: Rng): 1 | 3 | 5 {
  const roll = rng();
  if (roll < CHEST.fiveChance) return 5;
  if (roll < CHEST.fiveChance + CHEST.threeChance) return 3;
  return 1;
}

/**
 * Rolls a chest for the current build. Upgrades are picked one at a time on the build as it
 * grows, so a chest can raise the same item twice. When everything is maxed, gold makes up for it.
 */
export function rollChest(loadout: Loadout, ring: number, rng: Rng): ChestReward {
  const count = chestUpgradeCount(rng);
  const upgrades: UpgradeOption[] = [];
  let build = loadout;
  for (let i = 0; i < count; i++) {
    const option = rollUpgradeOptions(build, rng, 1, false)[0];
    if (option.kind === 'heal') break;
    upgrades.push(option);
    build = applyUpgrade(build, option);
  }
  const drop = goldPerDrop(ring);
  const drops = CHEST.goldMin + Math.floor(rng() * (CHEST.goldMax - CHEST.goldMin + 1));
  const makeUp = (count - upgrades.length) * 2;
  return { gold: drop * (drops + makeUp), upgrades };
}
