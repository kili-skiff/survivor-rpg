import type { GoalKind } from './types';

// Fight goals (logic/goals.ts). A hex gets its goal from the world map, rolled anew for every expedition,
// so it shows on the map before you go in. New goal = a kind in FightGoal (config/types.ts), its numbers
// here, its check and text in logic/goals.ts.
export const GOALS = {
  /** How often each goal is rolled for an ordinary hex (relative weights) */
  weights: { survive: 0.65, hunt: 0.35 } satisfies Record<GoalKind, number>,
  /**
   * The map shows a hex's goal only this many hexes away from the player, the village or a lit watchfire:
   * what lies further out stays a surprise.
   */
  iconReach: 1,
  /** Symbol of each goal on the map, in the hex panel and next to the counter in a fight (BootScene) */
  icons: { survive: 'goal-survive', hunt: 'goal-hunt' } satisfies Record<GoalKind, string>,
  /** Hunt: kill this many enemies; no time limit, the spawn director keeps the pressure up */
  hunt: { killsBase: 35, killsPerRing: 25 },
};
