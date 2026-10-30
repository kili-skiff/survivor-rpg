import * as Phaser from 'phaser';
import { BALANCE, BOLT_AIM } from '../../config/balance';
import { coneCos } from '../../logic/aim';
import { shotLifetimeMs } from '../../logic/vision';
import type { WeaponStats } from '../../config/types';
import type { HitEffects } from '../../logic/hitEffects';
import type { Enemy } from '../../entities/Enemy';
import { Projectile } from '../../entities/Projectile';
import type { CombatContext } from '../CombatContext';
import { FIRST_SHOT_DELAY, type Weapon } from './Weapon';

/** Angle offset for extra bolts when there are fewer targets than bolts (radians) */
const SPREAD = 0.18;

/** Cosine of the aiming cone's half angle */
const CONE_COS = coneCos(BOLT_AIM.halfAngleDeg);

/**
 * Arcane bolt: fires at the nearest enemies in front of the player while they move (where they look),
 * and at the nearest ones in any direction while they stand still, so kiting works but running away does not.
 */
export class BoltWeapon implements Weapon {
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private timer = FIRST_SHOT_DELAY;
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
    // On the move it only fires where you look; standing still it picks the nearest enemy all around.
    const { x: dirX, y: dirY } = player.aim;
    const cone = player.moving ? { dirX, dirY, cosHalf: CONE_COS } : undefined;
    const targets = enemies.nearest(stats.count, range, cone);
    if (targets.length === 0) {
      this.timer = 0;
      return;
    }
    // The player turns toward the first target; while moving, the movement direction wins again.
    player.faceToward(targets[0].x - player.x, targets[0].y - player.y);
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
