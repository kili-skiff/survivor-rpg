import type { RewardKind } from './types';

// What a hex brings when you clear it (logic/rewards.ts), shown on the map next to its goal, like the
// doors in Hades: you pick your way by what you need. Rolled anew for every expedition, like goals.
export const REWARDS = {
  /** How often each reward is rolled (relative weights) */
  weights: { gold: 1, chest: 0.8, card: 0.6, heal: 0.6, herbs: 0.7 } satisfies Record<RewardKind, number>,
  /** Rewards that only appear from this ring on */
  minRing: { card: 2 } as Partial<Record<RewardKind, number>>,
  /** Gold: gold drops count this many times as often during the fight, plus this many drops at the end */
  goldDropMul: 2,
  goldBonusDrops: 6,
  /** Herbs: this many times as many blooms (only hexes where herbs grow) */
  herbsMul: 2,
  /** Rare card: a choice of this many magic or legendary cards at the end */
  cardChoices: 3,
  names: {
    gold: 'Gold',
    chest: 'Treasure chest',
    card: 'Rare card',
    heal: 'Full health',
    herbs: 'Herb harvest',
  } satisfies Record<RewardKind, string>,
  /** Symbol of each reward on the map and in the hex panel (BootScene) */
  icons: {
    gold: 'reward-gold',
    chest: 'reward-chest',
    card: 'reward-card',
    heal: 'reward-heal',
    herbs: 'reward-herbs',
  } satisfies Record<RewardKind, string>,
};
