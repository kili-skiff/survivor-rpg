// What clearing a hex brings: which reward a hex has on an expedition, and its numbers. Pure and tested.

import { REWARDS } from '../config/rewards';
import type { RewardKind } from '../config/types';
import { createRng, hash32, seedFromString } from './rng';

/** The hex a reward is rolled for. */
export interface RewardHex {
  key: string;
  ring: number;
  /** Whether herbs grow there (only then can it bring a herb harvest) */
  herbs: boolean;
}

/** The rewards a hex can roll in its ring. */
export function rewardsFor(hex: RewardHex): RewardKind[] {
  return (Object.keys(REWARDS.weights) as RewardKind[]).filter(
    (k) => hex.ring >= (REWARDS.minRing[k] ?? 0) && (k !== 'herbs' || hex.herbs),
  );
}

/**
 * The reward of a hex on the expedition with number `expedition` (finished expeditions so far): fixed for
 * the whole expedition, so the map can show it, and rolled anew for the next one.
 */
export function rewardForHex(hex: RewardHex, expedition: number, seasonSeed: string): RewardKind {
  const kinds = rewardsFor(hex);
  const seed = hash32(seedFromString(seasonSeed), seedFromString(hex.key), expedition, 0x5e3a);
  const total = kinds.reduce((sum, k) => sum + REWARDS.weights[k], 0);
  let left = createRng(seed)() * total;
  for (const k of kinds) {
    left -= REWARDS.weights[k];
    if (left < 0) return k;
  }
  return kinds[kinds.length - 1];
}

/** How the reward shows on the map and at the start of a fight. */
export function rewardLabel(reward: RewardKind): string {
  return REWARDS.names[reward];
}
