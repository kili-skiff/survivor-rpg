import * as Phaser from 'phaser';
import { BALANCE } from '../../config/balance';
import { assignShots, lockFirst } from '../../logic/focus';
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

/**
 * Arcane bolt: locks on to the nearest enemy and keeps firing at it until it dies or gets out of reach;
 * all bolts of a volley go to it until the damage on its way will kill it (focus fire).
 */
export class BoltWeapon implements Weapon {
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private timer = FIRST_SHOT_DELAY;
  /** The enemy the bolt is locked on to, and which life of that pooled enemy */
  private locked: Enemy | null = null;
  private lockedGeneration = 0;
  /** What a hit does besides damage; follows the weapon's level */
  private readonly effects: HitEffects = {};

  constructor(private readonly ctx: CombatContext) {
    this.projectiles = ctx.scene.physics.add.group({ classType: Projectile, maxSize: 150 });
    ctx.scene.physics.add.overlap(this.projectiles, ctx.enemies.group, (a, b) =>
      this.onHit(a as Projectile, b as Enemy),
    );
  }

  update(stats: WeaponStats, dms: number): void {
    this.effects.knockback = stats.knockback;
    this.effects.splash = stats.splash * stats.area;
    this.effects.percent = stats.percent;
    this.expireProjectiles();
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
    const targets = lockFirst(enemies.nearest(FOCUS_CANDIDATES, range), locked, keep);
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
      const spread = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * SPREAD;
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
    // Pushed the way the bolt flew.
    this.ctx.enemies.hit(e, p.damage, this.effects, e.x - ux, e.y - uy, ux * 6, uy * 6);
    p.pierceLeft -= 1;
    if (p.pierceLeft <= 0) p.despawn();
  }

  private expireProjectiles(): void {
    const now = this.ctx.now();
    for (const p of this.projectiles.getChildren() as Projectile[]) {
      if (p.active && now > p.expiresAt) p.despawn();
    }
  }
}
