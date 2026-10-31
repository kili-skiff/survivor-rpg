import type { GoalKind, RolledGoalKind } from './types';

// Fight goals (logic/goals.ts). A hex gets its goal from the world map, rolled anew for every expedition,
// so it shows on the map before you go in. New goal = a kind in FightGoal (config/types.ts), its numbers
// here, its check and text in logic/goals.ts.
export const GOALS = {
  /** How often each goal is rolled for an ordinary hex (relative weights) */
  weights: { survive: 0.65, hunt: 0.35 } satisfies Record<RolledGoalKind, number>,
  /**
   * The map shows a hex's goal only this many hexes away from the player: what lies further out stays a
   * surprise.
   */
  iconReach: 1,
  /** Symbol of each goal on the map, in the hex panel and next to the counter in a fight (BootScene) */
  icons: { survive: 'goal-survive', hunt: 'goal-hunt', light: 'goal-light' } satisfies Record<
    GoalKind,
    string
  >,
  /** Hunt: kill this many enemies; no time limit, the spawn director keeps the pressure up */
  hunt: { killsBase: 35, killsPerRing: 25 },
  /**
   * Find the light (watchfire hexes). First you search: the fire shows up after `searchBaseSec` (+
   * `searchPerRingSec` per ring further out, give or take `searchJitter`) of moving through the dark,
   * just outside the view (`foundMargin` px) in the direction you walk (within `foundSpread` radians).
   * Then standing within `radius` lights it in `litSec` seconds; away from it, the progress drains, all of
   * it in `drainSec`. A hit does not interrupt it.
   */
  light: {
    searchBaseSec: 25,
    searchPerRingSec: 8,
    searchJitter: 0.2,
    foundMargin: 80,
    foundSpread: 1,
    radius: 70,
    litSec: 6,
    drainSec: 8,
  },
};
