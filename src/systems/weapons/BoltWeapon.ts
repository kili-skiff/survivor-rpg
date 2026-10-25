import * as Phaser from 'phaser';
import { BALANCE } from '../../config/balance';
import { shotLifetimeMs } from '../../logic/vision';
import type { WeaponStats } from '../../config/types';
import type { Enemy } from '../../entities/Enemy';
import { Projectile } from '../../entities/Projectile';
import type { CombatContext } from '../CombatContext';
import { FIRST_SHOT_DELAY, type Weapon } from './Weapon';

/** Angle offset for extra bolts when there are fewer targets than bolts (radians) */
const SPREAD = 0.18;

/** Arcane bolt: fires at the nearest enemies. */
export class BoltWeapon implements Weapon {
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private timer = FIRST_SHOT_DELAY;

  constructor(private readonly ctx: CombatContext) {
    this.projectiles = ctx.scene.physics.add.group({ classType: Projectile, maxSize: 150 });
    ctx.scene.physics.add.overlap(this.projectiles, ctx.enemies.group, (a, b) =>
      this.onHit(a as Projectile, b as Enemy),
    );
  }

  update(stats: WeaponStats, dms: number): void {
    this.expireProjectiles();
    this.timer -= dms;
    if (this.timer > 0) return;

    const { player, enemies } = this.ctx;
    const range = this.ctx.visionRange();
    const targets = enemies.nearest(stats.count, range);
    if (targets.length === 0) {
      this.timer = 0;
      return;
    }
    for (let i = 0; i < stats.count; i++) {
      const target = targets[i % targets.length];
      const spread = i >= targets.length ? (i - targets.length + 1) * SPREAD : 0;
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
    }
    this.timer = stats.cooldown;
  }

  private onHit(p: Projectile, e: Enemy): void {
    if (!p.active || !e.active || p.hits.has(e)) return;
    p.hits.add(e);
    const v = p.body!.velocity;
    const len = v.length() || 1;
    this.ctx.enemies.damage(e, p.damage, (v.x / len) * 6, (v.y / len) * 6);
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
