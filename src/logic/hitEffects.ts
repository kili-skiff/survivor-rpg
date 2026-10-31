// What a hit does besides plain damage: a push, a burst around it, damage as a share of health.
// Tools against a crowd that piles up. Pure and tested, no Phaser.

import { HIT_EFFECTS, ITEMS } from '../config/balance';

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

/** What items and the situation do to every weapon hit (see PlayerStats). */
export interface HitMods {
  /** Everything that scales damage at the moment: momentum, last stand, Ember Surge */
  damageMul: number;
  crit: number;
  critMul: number;
  execute: number;
  eliteMul: number;
}

export function neutralMods(): HitMods {
  return { damageMul: 1, crit: 0, critMul: 2, execute: 0, eliteMul: 1 };
}

export interface HitResult {
  damage: number;
  crit: boolean;
  executed: boolean;
}

/** The enemy a hit lands on, as far as the modifiers care. */
export interface HitTarget {
  hp: number;
  maxHp: number;
  elite: boolean;
}

/**
 * Damage of one hit after the modifiers: damage scaling, extra against elites, a chance for a critical
 * hit and the execute threshold (a hit that lands on an enemy below it takes all its health).
 */
export function resolveHit(base: number, mods: HitMods, target: HitTarget, rng: () => number): HitResult {
  let damage = base * mods.damageMul * (target.elite ? mods.eliteMul : 1);
  const crit = mods.crit > 0 && rng() < mods.crit;
  if (crit) damage *= mods.critMul;
  const threshold = mods.execute * (target.elite ? ITEMS.executeVsElite : 1);
  const executed = threshold > 0 && target.maxHp > 0 && target.hp / target.maxHp <= threshold;
  if (executed) damage = Math.max(damage, target.hp);
  return { damage, crit, executed };
}

/** Damage scaling from the situation: moving, low health and temporary boosts. */
export function situationalDamage(opts: {
  moving: boolean;
  momentum: number;
  hpShare: number;
  desperation: number;
  surge: number;
}): number {
  const lost = 1 - Math.min(1, Math.max(0, opts.hpShare));
  return (1 + (opts.moving ? opts.momentum : 0)) * (1 + opts.desperation * lost) * (1 + opts.surge);
}
