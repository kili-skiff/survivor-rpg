import type { EnemyDef } from '../config/types';

export type Rng = () => number;

/** Time between spawn waves in ms, based on run time in seconds. */
export function spawnIntervalMs(t: number): number {
  return Math.max(260, 1100 - t * 3.2);
}

/** How many enemies spawn per wave. */
export function spawnBatchSize(t: number): number {
  return 1 + Math.floor(t / 40);
}

/** Maximum number of enemies alive at once. */
export function maxEnemies(t: number, hardCap: number): number {
  return Math.min(hardCap, Math.round(30 + t * 1.6));
}

/** Enemies get tougher over time. */
export function enemyHpMultiplier(t: number): number {
  return 1 + t / 80;
}

/** Picks a weighted enemy type among those unlocked at time t. */
export function pickEnemy(t: number, defs: EnemyDef[], rng: Rng): EnemyDef {
  const pool = defs.filter((d) => d.unlockAt <= t);
  const candidates = pool.length > 0 ? pool : defs;
  const total = candidates.reduce((sum, d) => sum + d.weight, 0);
  let roll = rng() * total;
  for (const def of candidates) {
    roll -= def.weight;
    if (roll < 0) return def;
  }
  return candidates[candidates.length - 1];
}
