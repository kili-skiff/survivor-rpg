import type { DeedId } from './deeds';
import type { PlayerStats } from './types';

// Ember upgrades at the Hearth in the village: a flat list of permanent bonuses bought with embers, like
// the power-ups in Vampire Survivors. Each has a few ranks; rank n costs n times the base price. Some
// are locked until a deed is earned, so exploring opens up the shop.

export type EmberUpgradeId =
  | 'vitality'
  | 'might'
  | 'swiftness'
  | 'magnet'
  | 'armor'
  | 'recovery'
  | 'haste'
  | 'growth'
  | 'greed'
  | 'pouch';

export interface EmberUpgradeDef {
  id: EmberUpgradeId;
  name: string;
  /** What one rank gives, e.g. "+10 health" */
  perRankText: string;
  texture: string;
  maxRank: number;
  /** Price of the first rank; rank n costs n times this */
  basePrice: number;
  /** Added to the player stats per rank */
  perRank: Partial<PlayerStats>;
  /** More potion slots in the belt per rank */
  beltSlots?: number;
  /** Locked until this deed is earned */
  unlockedBy?: DeedId;
}

export const EMBER_UPGRADES: readonly EmberUpgradeDef[] = [
  {
    id: 'vitality',
    name: 'Vitality',
    perRankText: '+10 health',
    texture: 'icon-vitality',
    maxRank: 5,
    basePrice: 15,
    perRank: { maxHp: 10 },
  },
  {
    id: 'might',
    name: 'Might',
    perRankText: '+5% damage',
    texture: 'icon-might',
    maxRank: 5,
    basePrice: 25,
    perRank: { might: 0.05 },
  },
  {
    id: 'magnet',
    name: 'Magnet',
    perRankText: '+15% pickup radius',
    texture: 'icon-magnet',
    maxRank: 3,
    basePrice: 15,
    perRank: { magnet: 10 },
  },
  {
    id: 'growth',
    name: 'Growth',
    perRankText: '+5% experience',
    texture: 'icon-wisdom',
    maxRank: 3,
    basePrice: 20,
    perRank: { xpGain: 0.05 },
  },
  {
    id: 'swiftness',
    name: 'Swiftness',
    perRankText: '+4% move speed',
    texture: 'icon-swiftness',
    maxRank: 3,
    basePrice: 20,
    perRank: { moveSpeed: 5 },
    unlockedBy: 'ring2',
  },
  {
    id: 'recovery',
    name: 'Recovery',
    perRankText: '+0.2 health per second',
    texture: 'icon-regen',
    maxRank: 3,
    basePrice: 20,
    perRank: { regen: 0.2 },
    unlockedBy: 'twoWatchfires',
  },
  {
    id: 'greed',
    name: 'Greed',
    perRankText: '+10% embers',
    texture: 'icon-greed',
    maxRank: 3,
    basePrice: 25,
    perRank: { emberGain: 0.1 },
    unlockedBy: 'firstWatchfire',
  },
  {
    id: 'armor',
    name: 'Armor',
    perRankText: '−1 damage taken per hit',
    texture: 'icon-armor',
    maxRank: 3,
    basePrice: 30,
    perRank: { armor: 1 },
    unlockedBy: 'ring4',
  },
  {
    id: 'haste',
    name: 'Haste',
    perRankText: '−3% cooldowns',
    texture: 'icon-haste',
    maxRank: 3,
    basePrice: 30,
    perRank: { haste: -0.03 },
    unlockedBy: 'fiveWatchfires',
  },
  {
    id: 'pouch',
    name: 'Belt Pouch',
    perRankText: '+1 potion slot in the belt',
    texture: 'icon-pouch',
    maxRank: 1,
    basePrice: 80,
    perRank: {},
    beltSlots: 1,
    unlockedBy: 'allWatchfires',
  },
];
