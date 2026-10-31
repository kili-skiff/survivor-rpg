import type { EnemyDef } from '../config/types';

export type Rng = () => number;

/** Time between spawn waves in ms, based on run time in seconds. */
export function spawnIntervalMs(t: number): number {
  return Math.max(260, 1100 - t * 3.2);
}

/** How many enemies spawn per wave: one more every minute. */
export function spawnBatchSize(t: number): number {
  return 1 + Math.floor(t / 60);
}

/**
 * Enemies per second the horde grows by at fight time t: the strength of the old constant stream.
 * The spawn director shapes this into build-ups, surges and breathers (logic/director.ts).
 */
export function baseSpawnRate(t: number): number {
  return (spawnBatchSize(t) * 1000) / spawnIntervalMs(t);
}

/** Maximum number of enemies alive at once. */
export function maxEnemies(t: number, hardCap: number): number {
  return Math.min(hardCap, Math.round(30 + t * 1.2));
}

/**
 * Enemies get a little tougher during a fight. `t` is the time of this fight only (seconds), without
 * the ring's difficulty offset: how tough enemies are overall comes from the ring (logic/difficulty.ts).
 * Pressure within a fight comes from more enemies (the spawn director), not from tougher ones.
 */
export function enemyHpMultiplier(t: number): number {
  return 1 + Math.max(0, t) / 200;
}

/** Picks a weighted enemy type among those unlocked at time t and allowed in this ring. */
export function pickEnemy(t: number, defs: EnemyDef[], rng: Rng, ring = 1): EnemyDef {
  const pool = defs.filter((d) => d.unlockAt <= t && (d.minRing ?? 1) <= ring);
  const candidates = pool.length > 0 ? pool : defs;
  const total = candidates.reduce((sum, d) => sum + d.weight, 0);
  let roll = rng() * total;
  for (const def of candidates) {
    roll -= def.weight;
    if (roll < 0) return def;
  }
  return candidates[candidates.length - 1];
}
