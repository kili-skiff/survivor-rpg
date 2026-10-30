// What a hit does besides plain damage: a push, a burst around it, damage as a share of health.
// Tools against a crowd that piles up. Pure and tested, no Phaser.

import { HIT_EFFECTS } from '../config/balance';

/** The extra effects of a weapon hit (see WeaponStats). */
export interface HitEffects {
  knockback?: number;
  splash?: number;
  percent?: number;
}

/** Extra damage of a hit that is a share of the target's maximum health. Elites take only a part of it. */
export function percentDamage(percent: number, maxHp: number, elite: boolean): number {
  if (percent <= 0 || maxHp <= 0) return 0;
  return percent * maxHp * (elite ? HIT_EFFECTS.percentVsElite : 1);
}

/** The speed (px/s) a push gives to a target; `resist` is the type's own resistance (0..1). */
export function pushSpeed(strength: number, resist: number, elite: boolean): number {
  if (strength <= 0) return 0;
  let keep = 1 - Math.min(1, Math.max(0, resist));
  if (elite) keep *= 1 - HIT_EFFECTS.eliteKnockResist;
  return strength * keep;
}

export interface Push {
  x: number;
  y: number;
}

/**
 * Adds a push of `speed` (px/s) away from (fromX, fromY) to the push an enemy at (x, y) already has.
 * Pushes of several hits add up, but never beyond `pushMax`.
 */
export function addPush(push: Push, speed: number, fromX: number, fromY: number, x: number, y: number): void {
  if (speed <= 0) return;
  const dx = x - fromX;
  const dy = y - fromY;
  const d = Math.hypot(dx, dy);
  // Right on top of the source: any direction will do.
  const [ux, uy] = d > 0.001 ? [dx / d, dy / d] : [1, 0];
  push.x += ux * speed;
  push.y += uy * speed;
  const v = Math.hypot(push.x, push.y);
  if (v > HIT_EFFECTS.pushMax) {
    push.x *= HIT_EFFECTS.pushMax / v;
    push.y *= HIT_EFFECTS.pushMax / v;
  }
}

/** Slows a push down over `dt` seconds; it stops at once when it gets slow. */
export function decayPush(push: Push, dt: number): void {
  const k = Math.exp(-HIT_EFFECTS.pushDecay * dt);
  push.x *= k;
  push.y *= k;
  if (Math.hypot(push.x, push.y) < HIT_EFFECTS.pushStop) {
    push.x = 0;
    push.y = 0;
  }
}

/** How far a push carries an enemy in total (px), before it stops: speed over the decay rate. */
export function pushDistance(speed: number): number {
  return speed / HIT_EFFECTS.pushDecay;
}

/** Damage a neighbour takes from a burst. */
export function splashDamage(damage: number): number {
  return damage * HIT_EFFECTS.splashShare;
}

/** Whether an enemy (centre at distance `d`, body radius `r`) is inside a burst of `radius`. */
export function inBurst(d: number, r: number, radius: number): boolean {
  return d <= radius + r;
}
