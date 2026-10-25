// What the watchman can see in the night: weapons only aim at what he sees.

import { BALANCE, LIGHT } from '../config/balance';

/**
 * How far weapons aim (px). In the dark that is the reach of the light (where enemy eyes show);
 * with the best lantern the whole screen is lit, so the normal weapon range applies.
 * `lightScale` is the light stat (1 = the old lantern).
 */
export function visionRange(
  lightScale: number,
  lightsAll: boolean,
  maxRange: number = BALANCE.boltRange,
): number {
  if (lightsAll) return maxRange;
  return Math.min(maxRange, LIGHT.radius * lightScale * LIGHT.visionReach);
}

/** How long (ms) a shot with this speed (px/s) should fly: to the edge of what is seen, and a bit beyond. */
export function shotLifetimeMs(range: number, speed: number, maxMs: number, margin = 40): number {
  if (speed <= 0) return maxMs;
  return Math.min(maxMs, ((range + margin) / speed) * 1000);
}
