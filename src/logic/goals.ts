// Fight goals: which one a hex has, how far along a fight is, and how to say it. Pure and tested.

import { GOALS } from '../config/goals';
import type { FightGoal, GoalKind, PoiId } from '../config/types';
import { formatTime } from './progression';
import { createRng, hash32, seedFromString } from './rng';

/** What a fight has done so far. */
export interface GoalState {
  /** Seconds of this fight */
  time: number;
  kills: number;
}

/** The hex a goal is rolled for. */
export interface GoalHex {
  key: string;
  ring: number;
  poi?: PoiId | null;
}

/** Enemies to kill in a hunt in this ring. */
export function huntKills(ring: number): number {
  return GOALS.hunt.killsBase + GOALS.hunt.killsPerRing * Math.max(0, ring - 1);
}

/** Picks a goal kind by the weights in `GOALS`; `roll` is in [0, 1). */
export function pickGoalKind(roll: number, weights: Record<GoalKind, number> = GOALS.weights): GoalKind {
  const kinds = Object.keys(weights) as GoalKind[];
  const total = kinds.reduce((sum, k) => sum + weights[k], 0);
  let left = roll * total;
  for (const k of kinds) {
    left -= weights[k];
    if (left < 0) return k;
  }
  return kinds[kinds.length - 1];
}

/**
 * The goal of a hex on the expedition with number `expedition` (finished expeditions so far): fixed
 * for the whole expedition, so the map can show it, and rolled anew for the next one. `durationSec`
 * is the hex's survival time.
 */
export function goalForHex(
  hex: GoalHex,
  durationSec: number,
  expedition: number,
  seasonSeed: string,
): FightGoal {
  const seed = hash32(seedFromString(seasonSeed), seedFromString(hex.key), expedition, 0x60a1);
  const kind = pickGoalKind(createRng(seed)());
  switch (kind) {
    case 'survive':
      return { kind, durationSec };
    case 'hunt':
      return { kind, kills: huntKills(hex.ring) };
  }
}

/** 0 at the start, 1 when the goal is reached. */
export function goalProgress(goal: FightGoal, state: GoalState): number {
  const share = goal.kind === 'survive' ? state.time / goal.durationSec : state.kills / goal.kills;
  return Math.min(1, Math.max(0, share));
}

export function isGoalDone(goal: FightGoal, state: GoalState): boolean {
  return goalProgress(goal, state) >= 1;
}

/** The goal in a few words, for the map and the start of a fight. */
export function goalLabel(goal: FightGoal): string {
  switch (goal.kind) {
    case 'survive':
      return `Survive ${formatTime(goal.durationSec)}`;
    case 'hunt':
      return `Slay ${goal.kills} enemies`;
  }
}

/**
 * The goal's counter for the top of the screen: the time left, or kills so far out of the total.
 * `warning` is true in the last `warningSec` seconds of a survival fight.
 */
export function goalCounter(
  goal: FightGoal,
  state: GoalState,
  warningSec: number,
): { text: string; warning: boolean } {
  switch (goal.kind) {
    case 'survive': {
      const left = Math.max(0, goal.durationSec - state.time);
      return { text: formatTime(Math.ceil(left)), warning: left > 0 && left <= warningSec };
    }
    case 'hunt':
      return { text: `${Math.min(state.kills, goal.kills)} / ${goal.kills}`, warning: false };
  }
}
