import type { PlayerStats } from './types';
import { WORLD } from './world';

// Deeds: milestones of exploring the world. Each one is earned once and gives a small bonus for
// good, kept when you fall and when the map is reset (like recipes).

export type DeedId =
  | 'ring2'
  | 'ring4'
  | 'ring6'
  | 'ring8'
  | 'firstCamp'
  | 'firstWatchfire'
  | 'threeWatchfires'
  | 'allWatchfires'
  | 'tower';

/** What has to happen for a deed. Everything here can be read from the saved progress. */
export type DeedCondition =
  /** Stand on a hex in this ring (or further out) */
  | { kind: 'ring'; ring: number }
  /** Reach this many camps (waypoints) */
  | { kind: 'camps'; count: number }
  /** Light this many watchfires */
  | { kind: 'watchfires'; count: number }
  /** Reach the old tower (the elder's quest) */
  | { kind: 'tower' };

export interface DeedDef {
  id: DeedId;
  name: string;
  /** What you did, shown in the village */
  description: string;
  condition: DeedCondition;
  /** Added to the player stats for good */
  bonus: Partial<PlayerStats>;
  /** Short text for the bonus, e.g. "+10 health" */
  bonusText: string;
}

export const DEEDS: readonly DeedDef[] = [
  {
    id: 'ring2',
    name: 'Beyond the Fields',
    description: 'Reach ring 2.',
    condition: { kind: 'ring', ring: 2 },
    bonus: { maxHp: 10 },
    bonusText: '+10 health',
  },
  {
    id: 'ring4',
    name: 'Into the Dark',
    description: 'Reach ring 4.',
    condition: { kind: 'ring', ring: 4 },
    bonus: { might: 0.05 },
    bonusText: '+5% damage',
  },
  {
    id: 'ring6',
    name: 'Far Wanderer',
    description: 'Reach ring 6.',
    condition: { kind: 'ring', ring: 6 },
    bonus: { maxHp: 10 },
    bonusText: '+10 health',
  },
  {
    id: 'ring8',
    name: 'Edge of the World',
    description: 'Reach ring 8, the outermost.',
    condition: { kind: 'ring', ring: 8 },
    bonus: { armor: 1 },
    bonusText: '+1 armor',
  },
  {
    id: 'firstCamp',
    name: 'Fireside',
    description: 'Reach a camp.',
    condition: { kind: 'camps', count: 1 },
    bonus: { regen: 0.3 },
    bonusText: '+0.3 health/s',
  },
  {
    id: 'firstWatchfire',
    name: 'First Flame',
    description: 'Light a watchfire.',
    condition: { kind: 'watchfires', count: 1 },
    bonus: { light: 0.1 },
    bonusText: '+10% light radius',
  },
  {
    id: 'threeWatchfires',
    name: 'Keeper of Fires',
    description: 'Light three watchfires.',
    condition: { kind: 'watchfires', count: 3 },
    bonus: { haste: -0.05 },
    bonusText: '−5% cooldowns',
  },
  {
    id: 'allWatchfires',
    name: 'Nightwatch',
    description: 'Light every watchfire.',
    condition: { kind: 'watchfires', count: WORLD.watchfires },
    bonus: { moveSpeed: 16 },
    bonusText: '+10% move speed',
  },
  {
    id: 'tower',
    name: 'The Old Tower',
    description: 'Reach the old tower.',
    condition: { kind: 'tower' },
    bonus: { might: 0.05 },
    bonusText: '+5% damage',
  },
];
