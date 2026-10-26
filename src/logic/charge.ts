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
  /** How long this one hesitates (ms) after it could charge, so a group does not start together */
  delay: number;
  /** Game time (ms) from which it may start the warning; -1 while the player is out of range */
  readyAt: number;
}

export function newChargeState(delay = 0): ChargeState {
  return { phase: 'approach', until: 0, dirX: 0, dirY: 1, delay, readyAt: -1 };
}

/** Walking speed during the rest, as a share of the normal one. */
export const REST_SPEED = 0.35;

/**
 * Advances the charge at game time `now` (ms) for an enemy at (x, y) and a player at (tx, ty).
 * `slotFree` says whether another charger may start now (the scene limits how many charge at once).
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
  slotFree = true,
): ChargePhase {
  switch (s.phase) {
    case 'approach': {
      const dx = tx - x;
      const dy = ty - y;
      const d = Math.hypot(dx, dy);
      if (d > p.range) {
        s.readyAt = -1;
        break;
      }
      if (s.readyAt < 0) s.readyAt = now + s.delay;
      if (now >= s.readyAt && slotFree) {
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
      if (now >= s.until) {
        s.phase = 'approach';
        s.readyAt = -1;
      }
      break;
  }
  return s.phase;
}

/** How far the dash carries (px) at the given walking speed. */
export function dashDistance(p: ChargeParams, walkSpeed: number): number {
  return p.dashSec * p.dashSpeed * walkSpeed;
}
