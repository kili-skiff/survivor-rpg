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

/** The ring's row of RINGS.table; beyond the last ring the last step repeats. */
export function ringModifiers(ring: number): RingModifiers {
  const table = RINGS.table;
  const i = Math.max(0, Math.floor(ring) - 1);
  if (i < table.length) return { ...table[i] };
  const last = table[table.length - 1];
  const prev = table[table.length - 2];
  const extra = i - (table.length - 1);
  return {
    hp: last.hp + (last.hp - prev.hp) * extra,
    damage: last.damage + (last.damage - prev.damage) * extra,
    spawnRate: last.spawnRate + (last.spawnRate - prev.spawnRate) * extra,
  };
}

/** Chance that a spawned enemy is an elite. */
export function eliteChance(ring: number): number {
  if (ring < ELITE.minRing) return 0;
  return Math.min(ELITE.maxChance, ELITE.chancePerRing * ring);
}
