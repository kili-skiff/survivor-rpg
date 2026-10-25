// How hard a fight is, by the ring of its hex. Pure and tested.

import { ELITE, RINGS } from '../config/balance';

export interface RingModifiers {
  /** Multiplies enemy health */
  hp: number;
  /** Multiplies enemy damage */
  damage: number;
  /** Multiplies how often waves come (higher = denser) */
  spawnRate: number;
}

export function ringModifiers(ring: number): RingModifiers {
  const steps = Math.max(0, ring - 1);
  return {
    hp: 1 + RINGS.hpPerRing * steps,
    damage: 1 + RINGS.damagePerRing * steps,
    spawnRate: 1 + RINGS.spawnRatePerRing * steps,
  };
}

/** Chance that a spawned enemy is an elite. */
export function eliteChance(ring: number): number {
  if (ring < ELITE.minRing) return 0;
  return Math.min(ELITE.maxChance, ELITE.chancePerRing * ring);
}
