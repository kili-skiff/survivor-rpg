// The pounce of an enemy (behaviour `charge`): run up, crouch with a warning, leap, land stunned.
// Pure and tested, no Phaser.

import type { EnemyBehavior } from '../config/types';

export type ChargeParams = Extract<EnemyBehavior, { kind: 'charge' }>;

/** approach: walks up like any chaser; windup: crouches; leap: in the air; rest: slow after landing */
export type ChargePhase = 'approach' | 'windup' | 'leap' | 'rest';

export interface ChargeState {
  phase: ChargePhase;
  /** Game time (ms) at which the phase ends (windup, leap and rest) */
  until: number;
  /** Where it jumped from (set when the leap starts) */
  startX: number;
  startY: number;
  /** Where it will land: follows the player during the warning and stays put for its last part */
  targetX: number;
  targetY: number;
  /** How long this one hesitates (ms) after it could pounce, so a group does not start together */
  delay: number;
  /** Game time (ms) from which it may start the warning; -1 while the player is out of range */
  readyAt: number;
}

export function newChargeState(delay = 0): ChargeState {
  return { phase: 'approach', until: 0, startX: 0, startY: 0, targetX: 0, targetY: 0, delay, readyAt: -1 };
}

/** Walking speed during the rest, as a share of the normal one. */
export const REST_SPEED = 0.35;

/**
 * Decides for all chargers together whether a pounce may start: only so many at once, and a global
 * cooldown after each start, so a group of chargers pounces one after another with breathers
 * instead of constantly.
 */
export class ChargeGate {
  private nextAt = 0;

  constructor(
    private readonly maxAtOnce: number,
    private readonly cooldownMs: number,
  ) {}

  /** `busy`: how many chargers are in their warning or leap right now. */
  canStart(now: number, busy: number): boolean {
    return busy < this.maxAtOnce && now >= this.nextAt;
  }

  /** Call when a charger starts its warning. */
  started(now: number): void {
    this.nextAt = now + this.cooldownMs;
  }
}

/**
 * Advances the pounce at game time `now` (ms) for an enemy at (x, y) and a player at (tx, ty).
 * `slotFree` says whether another one may start now (the ChargeGate of the scene decides).
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
      if (Math.hypot(tx - x, ty - y) > p.range) {
        s.readyAt = -1;
        break;
      }
      if (s.readyAt < 0) s.readyAt = now + s.delay;
      if (now >= s.readyAt && slotFree) {
        s.phase = 'windup';
        s.until = now + p.windupSec * 1000;
        s.targetX = tx;
        s.targetY = ty;
      }
      break;
    }
    case 'windup':
      if (!isLocked(s, p, now)) {
        // The circle follows the player, but never further than the leap reaches.
        const dx = tx - x;
        const dy = ty - y;
        const d = Math.hypot(dx, dy);
        const k = d > p.range ? p.range / d : 1;
        s.targetX = x + dx * k;
        s.targetY = y + dy * k;
      }
      if (now >= s.until) {
        s.phase = 'leap';
        s.until = now + p.leapSec * 1000;
        s.startX = x;
        s.startY = y;
      }
      break;
    case 'leap':
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

/** Whether the landing spot is fixed already (the last part of the warning, and the leap). */
export function isLocked(s: ChargeState, p: ChargeParams, now: number): boolean {
  return s.phase !== 'windup' || now >= s.until - p.lockSec * 1000;
}

/** How far through the warning it is, 0..1 (0 outside the warning). */
export function windupProgress(s: ChargeState, p: ChargeParams, now: number): number {
  if (s.phase !== 'windup') return 0;
  return Math.min(1, Math.max(0, 1 - (s.until - now) / (p.windupSec * 1000)));
}

/** Where it is during the leap: the spot on the ground and the height above it (an arc, 0 at both ends). */
export function leapAt(
  s: ChargeState,
  p: ChargeParams,
  now: number,
): { x: number; y: number; height: number } {
  const u = Math.min(1, Math.max(0, 1 - (s.until - now) / (p.leapSec * 1000)));
  return {
    x: s.startX + (s.targetX - s.startX) * u,
    y: s.startY + (s.targetY - s.startY) * u,
    height: 4 * p.height * u * (1 - u),
  };
}
