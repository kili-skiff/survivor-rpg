import { WORLD } from './world';

// Deeds: milestones of exploring the world. Each one is earned once, pays embers straight into the
// stash, and some unlock an upgrade at the Hearth (config/emberUpgrades.ts, `unlockedBy`). Kept when you
// fall and when the map is reset (like recipes).

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
  /** Embers paid into the stash when it is earned */
  embers: number;
}

export const DEEDS: readonly DeedDef[] = [
  {
    id: 'ring2',
    name: 'Beyond the Fields',
    description: 'Reach ring 2.',
    condition: { kind: 'ring', ring: 2 },
    embers: 20,
  },
  {
    id: 'ring4',
    name: 'Into the Dark',
    description: 'Reach ring 4.',
    condition: { kind: 'ring', ring: 4 },
    embers: 40,
  },
  {
    id: 'ring6',
    name: 'Far Wanderer',
    description: 'Reach ring 6.',
    condition: { kind: 'ring', ring: 6 },
    embers: 60,
  },
  {
    id: 'ring8',
    name: 'Edge of the World',
    description: 'Reach ring 8, the outermost.',
    condition: { kind: 'ring', ring: 8 },
    embers: 100,
  },
  {
    id: 'firstCamp',
    name: 'Fireside',
    description: 'Reach a camp.',
    condition: { kind: 'camps', count: 1 },
    embers: 20,
  },
  {
    id: 'firstWatchfire',
    name: 'First Flame',
    description: 'Light a watchfire.',
    condition: { kind: 'watchfires', count: 1 },
    embers: 25,
  },
  {
    id: 'threeWatchfires',
    name: 'Keeper of Fires',
    description: 'Light three watchfires.',
    condition: { kind: 'watchfires', count: 3 },
    embers: 50,
  },
  {
    id: 'allWatchfires',
    name: 'Nightwatch',
    description: 'Light every watchfire.',
    condition: { kind: 'watchfires', count: WORLD.watchfires },
    embers: 100,
  },
  {
    id: 'tower',
    name: 'The Old Tower',
    description: 'Reach the old tower.',
    condition: { kind: 'tower' },
    embers: 150,
  },
];
