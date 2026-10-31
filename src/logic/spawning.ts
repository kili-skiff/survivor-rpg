import { SPAWN } from '../config/balance';
import type { EnemyDef } from '../config/types';

export type Rng = () => number;

/**
 * Enemies per second at `fightTime` (seconds of this fight), before the ring's factor: it grows evenly,
 * without jumps. The spawn director shapes it into build-ups, surges and breathers (logic/director.ts).
 */
export function spawnRate(fightTime: number): number {
  return SPAWN.baseRate * (1 + Math.max(0, fightTime) / SPAWN.growthSec);
}

/** Maximum number of enemies alive at once, in a ring at `fightTime` (seconds of this fight). */
export function maxEnemies(ring: number, fightTime: number, hardCap: number): number {
  const n =
    SPAWN.capBase + SPAWN.capPerRing * Math.max(0, ring - 1) + SPAWN.capPerSec * Math.max(0, fightTime);
  return Math.min(hardCap, Math.round(n));
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
