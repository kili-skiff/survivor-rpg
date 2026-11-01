import * as Phaser from 'phaser';
import { BALANCE, BOLT_FOCUS } from '../../config/balance';
import { MOD } from '../../config/modifiers';
import { assignShots, keepsLock, lockFirst } from '../../logic/focus';
import { shotLifetimeMs } from '../../logic/vision';
import type { WeaponStats } from '../../config/types';
import type { HitEffects } from '../../logic/hitEffects';
import type { Enemy } from '../../entities/Enemy';
import { Projectile } from '../../entities/Projectile';
import type { CombatContext } from '../CombatContext';
import { FIRST_SHOT_DELAY, type Weapon } from './Weapon';

/** Angle between bolts fired at the same enemy (radians); small, so they still hit */
const SPREAD = 0.05;
/** How many of the nearest enemies focus fire looks at */
const FOCUS_CANDIDATES = 8;
/** Spark Chain hits do nothing besides damage */
const SPARK_FX: HitEffects = { source: 'sparkchain' };

/**
 * Arcane bolt: locks on to the nearest enemy and keeps firing at it until it dies, gets out of reach
 * or another enemy comes very close;
 * all bolts of a volley go to it until the damage on its way will kill it (focus fire).
 */
export class BoltWeapon implements Weapon {
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private timer = FIRST_SHOT_DELAY;
  /** The enemy the bolt is locked on to, and which life of that pooled enemy */
  private locked: Enemy | null = null;
  private lockedGeneration = 0;
  /** What a hit does besides damage; follows the weapon's level */
  private readonly effects: HitEffects = { source: 'bolt' };
  private area = 1;
  /** Spark Chain: the short lines from a hit to the enemy the spark jumped to */
  private readonly sparks: { x1: number; y1: number; x2: number; y2: number; until: number }[] = [];
  private readonly sparkGfx: Phaser.GameObjects.Graphics;

  constructor(private readonly ctx: CombatContext) {
    this.projectiles = ctx.scene.physics.add.group({ classType: Projectile, maxSize: 150 });
    this.sparkGfx = ctx.scene.add.graphics().setDepth(5);
    ctx.scene.physics.add.overlap(this.projectiles, ctx.enemies.group, (a, b) =>
      this.onHit(a as Projectile, b as Enemy),
    );
  }

  update(stats: WeaponStats, dms: number): void {
    this.effects.knockback = stats.knockback;
    this.effects.splash = stats.splash * stats.area;
    this.effects.percent = stats.percent;
    this.area = stats.area;
    this.expireProjectiles();
    this.drawSparks();
    this.timer -= dms;
    if (this.timer > 0) return;

    const { player, enemies } = this.ctx;
    const range = this.ctx.visionRange();
    // Focus fire: the bolt stays on the enemy it locked on to until that one dies or gets out of reach;
    // without a lock it takes the nearest. A volley moves on once the damage on its way will kill it.
    const locked = this.locked;
    const keep =
      locked !== null &&
      locked.active &&
      !locked.airborne &&
      locked.generation === this.lockedGeneration &&
      (locked.x - player.x) ** 2 + (locked.y - player.y) ** 2 <= range * range;
    const nearest = enemies.nearest(FOCUS_CANDIDATES, range);
    // An enemy that comes very close takes over from a target further off.
    const dist = (e: Enemy) => Math.hypot(e.x - player.x, e.y - player.y) - e.def.radius;
    const stay =
      keep && (nearest.length === 0 || keepsLock(dist(locked), dist(nearest[0]), BOLT_FOCUS.dangerRadius));
    const targets = lockFirst(nearest, locked, stay);
    if (targets.length === 0) {
      this.timer = 0;
      return;
    }
    const pending = this.pendingDamage();
    const plan = assignShots(
      targets.map((e) => ({ hp: e.hp, pending: pending.get(e) ?? 0 })),
      stats.count,
      stats.damage,
    );
    const first = targets[plan[0]];
    this.locked = first;
    this.lockedGeneration = first.generation;
    const perTarget = new Map<Enemy, number>();
    for (let i = 0; i < stats.count; i++) {
      const target = targets[plan[i]];
      // Bolts at the same enemy fan out a little, so they read as several bolts.
      const k = perTarget.get(target) ?? 0;
      perTarget.set(target, k + 1);
      const step = this.ctx.hasModifier('volley') ? MOD.volley.spread : SPREAD;
      const spread = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * step;
      const angle = Math.atan2(target.y - player.y, target.x - player.x) + spread;
      const p = this.projectiles.get(player.x, player.y, 'bolt') as Projectile | null;
      if (!p) break;
      p.fire(
        player.x,
        player.y,
        angle,
        stats.speed,
        stats.damage,
        stats.pierce,
        this.ctx.now(),
        shotLifetimeMs(range, stats.speed, BALANCE.boltLifetimeMs),
      );
      p.target = target;
      if (this.ctx.hasModifier('heavybolt')) p.setScale(MOD.heavy.scale);
      if (this.ctx.hasModifier('frostbolt')) p.setTint(0x93c5fd);
      if (this.ctx.hasModifier('ricochet')) p.bounces = MOD.ricochet.bounces;
    }
    this.timer = stats.cooldown;
  }

  /** Damage of the bolts in flight, per enemy they were fired at. */
  private pendingDamage(): Map<Enemy, number> {
    const out = new Map<Enemy, number>();
    for (const p of this.projectiles.getChildren() as Projectile[]) {
      if (!p.active || !p.target?.active || p.hits.has(p.target)) continue;
      out.set(p.target, (out.get(p.target) ?? 0) + p.damage);
    }
    return out;
  }

  private onHit(p: Projectile, e: Enemy): void {
    if (!p.active || !e.active || p.hits.has(e)) return;
    p.hits.add(e);
    const v = p.body!.velocity;
    const len = v.length() || 1;
    const ux = v.x / len;
    const uy = v.y / len;
    const { enemies } = this.ctx;
    const last = p.pierceLeft <= 1;
    // Blast Tip: the last hit bursts (on top of any burst the weapon already has).
    const fx =
      last && this.ctx.hasModifier('blasttip')
        ? { ...this.effects, splash: (this.effects.splash ?? 0) + MOD.blast.radius * this.area }
        : this.effects;
    const ex = e.x;
    const ey = e.y;
    // Pushed the way the bolt flew.
    enemies.hit(e, p.damage, fx, ex - ux, ey - uy, ux * 6, uy * 6);
    if (this.ctx.hasModifier('frostbolt') && e.active) this.chill(e);
    if (this.ctx.hasModifier('sparkchain')) this.spark(ex, ey, e, p.damage);
    p.pierceLeft -= 1;
    if (p.pierceLeft > 0) return;
    if (p.bounces > 0 && this.bounce(p, ex, ey)) return;
    p.despawn();
  }

  /** Frost Bolt: slows the enemy for a moment (a stronger slow that is still running stays). */
  private chill(e: Enemy): void {
    const now = this.ctx.now();
    if (now >= e.slowUntil || e.slowFactor > MOD.frost.factor) e.slowFactor = MOD.frost.factor;
    e.slowUntil = Math.max(e.slowUntil, now + MOD.frost.ms);
  }

  /** The nearest living enemy to (x, y) within `range`, leaving out `skip`. */
  private nearestTo(x: number, y: number, range: number, skip: (e: Enemy) => boolean): Enemy | null {
    let best: Enemy | null = null;
    let bestD = range * range;
    for (const n of this.ctx.enemies.active()) {
      if (n.airborne || skip(n)) continue;
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  /** Spark Chain: part of the hit jumps to the nearest other enemy. */
  private spark(x: number, y: number, from: Enemy, damage: number): void {
    const n = this.nearestTo(x, y, MOD.spark.range * this.area, (c) => c === from);
    if (!n) return;
    this.sparks.push({ x1: x, y1: y, x2: n.x, y2: n.y, until: this.ctx.now() + MOD.spark.showMs });
    this.ctx.enemies.hit(n, damage * MOD.spark.share, SPARK_FX, x, y);
  }

  private drawSparks(): void {
    const now = this.ctx.now();
    for (let i = this.sparks.length - 1; i >= 0; i--)
      if (this.sparks[i].until <= now) this.sparks.splice(i, 1);
    const g = this.sparkGfx.clear();
    if (this.sparks.length === 0) return;
    g.lineStyle(2, 0xfde047, 0.9);
    for (const s of this.sparks) {
      // A small kink in the middle, so it reads as a spark.
      const mx = (s.x1 + s.x2) / 2 + (s.y2 - s.y1) * 0.15;
      const my = (s.y1 + s.y2) / 2 - (s.x2 - s.x1) * 0.15;
      g.beginPath().moveTo(s.x1, s.y1).lineTo(mx, my).lineTo(s.x2, s.y2).strokePath();
    }
  }

  /** Ricochet: after its last hit the bolt flies on to the nearest enemy it has not hit yet. */
  private bounce(p: Projectile, x: number, y: number): boolean {
    const n = this.nearestTo(x, y, MOD.ricochet.range * this.area, (c) => p.hits.has(c));
    if (!n) return false;
    p.bounces -= 1;
    p.pierceLeft = 1;
    p.target = n;
    const speed = p.body!.velocity.length();
    const angle = Math.atan2(n.y - y, n.x - x);
    p.setRotation(angle);
    p.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    p.expiresAt = Math.max(
      p.expiresAt,
      this.ctx.now() + (MOD.ricochet.range * this.area * 1000) / speed + 200,
    );
    return true;
  }

  clear(): void {
    for (const p of this.projectiles.getChildren() as Projectile[]) if (p.active) p.despawn();
    this.sparks.length = 0;
    this.sparkGfx.clear();
  }

  private expireProjectiles(): void {
    const now = this.ctx.now();
    for (const p of this.projectiles.getChildren() as Projectile[]) {
      if (p.active && now > p.expiresAt) p.despawn();
    }
  }
}
