// The charge of an enemy (behaviour `charge`): run up, warn, dash, rest. Pure and tested, no Phaser.

import type { EnemyBehavior } from '../config/types';

export type ChargeParams = Extract<EnemyBehavior, { kind: 'charge' }>;

/** approach: walks up like any chaser; windup: stands still and warns; dash: straight line; rest: slow */
export type ChargePhase = 'approach' | 'windup' | 'dash' | 'rest';

export interface ChargeState {
  phase: ChargePhase;
  /** Game time (ms) at which the phase ends (windup, dash and rest) */
  until: number;
  /** Direction of the dash (unit vector), fixed when the warning starts */
  dirX: number;
  dirY: number;
}

export function newChargeState(): ChargeState {
  return { phase: 'approach', until: 0, dirX: 0, dirY: 1 };
}

/** Walking speed during the rest, as a share of the normal one. */
export const REST_SPEED = 0.35;

/**
 * Advances the charge at game time `now` (ms) for an enemy at (x, y) and a player at (tx, ty).
 * Returns the phase it is in afterwards.
 */
export function stepCharge(
  s: ChargeState,
  p: ChargeParams,
  x: number,
  y: number,
  tx: number,
  ty: number,
  now: number,
): ChargePhase {
  switch (s.phase) {
    case 'approach': {
      const dx = tx - x;
      const dy = ty - y;
      const d = Math.hypot(dx, dy);
      if (d <= p.range) {
        s.phase = 'windup';
        s.until = now + p.windupSec * 1000;
        s.dirX = d > 0 ? dx / d : 0;
        s.dirY = d > 0 ? dy / d : 1;
      }
      break;
    }
    case 'windup':
      if (now >= s.until) {
        s.phase = 'dash';
        s.until = now + p.dashSec * 1000;
      }
      break;
    case 'dash':
      if (now >= s.until) {
        s.phase = 'rest';
        s.until = now + p.restSec * 1000;
      }
      break;
    case 'rest':
      if (now >= s.until) s.phase = 'approach';
      break;
  }
  return s.phase;
}

/** How far the dash carries (px) at the given walking speed. */
export function dashDistance(p: ChargeParams, walkSpeed: number): number {
  return p.dashSec * p.dashSpeed * walkSpeed;
}
