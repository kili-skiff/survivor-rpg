// Fight goals: which one a hex has, how far along a fight is, and how to say it. Pure and tested.

import { GOALS } from '../config/goals';
import type { FightGoal, PoiId, RolledGoalKind } from '../config/types';
import { formatTime } from './progression';
import { createRng, hash32, seedFromString } from './rng';

/** What a fight has done so far. */
export interface GoalState {
  /** Seconds of this fight */
  time: number;
  kills: number;
  /** How far the watchfire is lit, 0..1 (only for the light goal; 0 when missing) */
  lit?: number;
}

/** The hex a goal is rolled for. */
export interface GoalHex {
  key: string;
  ring: number;
  poi?: PoiId | null;
}

/** Whether the watchfire of a hex already burns (it then rolls an ordinary goal). */
export type FireLit = boolean;

/** Enemies to kill in a hunt in this ring. */
export function huntKills(ring: number): number {
  return GOALS.hunt.killsBase + GOALS.hunt.killsPerRing * Math.max(0, ring - 1);
}

/** Picks a goal kind by the weights in `GOALS`; `roll` is in [0, 1). */
export function pickGoalKind(
  roll: number,
  weights: Record<RolledGoalKind, number> = GOALS.weights,
): RolledGoalKind {
  const kinds = Object.keys(weights) as RolledGoalKind[];
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
 * is the hex's survival time. A cold watchfire always asks to be lit; once it burns, the hex rolls like
 * any other.
 */
export function goalForHex(
  hex: GoalHex,
  durationSec: number,
  expedition: number,
  seasonSeed: string,
  fireLit: FireLit = false,
): FightGoal {
  if (hex.poi === 'watchfire' && !fireLit) return { kind: 'light', litSec: GOALS.light.litSec };
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
  const share =
    goal.kind === 'survive'
      ? state.time / goal.durationSec
      : goal.kind === 'hunt'
        ? state.kills / goal.kills
        : (state.lit ?? 0);
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
    case 'light':
      return 'Light the watchfire';
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
    case 'light':
      return (state.lit ?? 0) > 0
        ? { text: `Lighting ${Math.floor((state.lit ?? 0) * 100)}%`, warning: false }
        : { text: 'Find the watchfire', warning: false };
  }
}

/**
 * Lighting the watchfire: it grows while the player stands next to it (full in `litSec`) and drains slowly
 * while they are away (all of it in `drainSec`).
 */
export function advanceLighting(
  progress: number,
  inRange: boolean,
  dt: number,
  params: { litSec: number; drainSec: number } = GOALS.light,
): number {
  const next = inRange ? progress + dt / params.litSec : progress - dt / params.drainSec;
  return Math.min(1, Math.max(0, next));
}

/** Where the cold watchfire stands, as an offset from where the fight starts. `rng` gives [0, 1). */
export function firePlacement(
  rng: () => number,
  params: { distanceMin: number; distanceMax: number } = GOALS.light,
): { x: number; y: number } {
  const angle = rng() * Math.PI * 2;
  const d = params.distanceMin + rng() * (params.distanceMax - params.distanceMin);
  return { x: Math.cos(angle) * d, y: Math.sin(angle) * d };
}
