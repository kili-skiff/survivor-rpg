import * as Phaser from 'phaser';
import { BALANCE, BOLT_AIM } from '../../config/balance';
import { coneCos, fanOffset } from '../../logic/aim';
import { shotLifetimeMs } from '../../logic/vision';
import type { WeaponStats } from '../../config/types';
import type { HitEffects } from '../../logic/hitEffects';
import type { Enemy } from '../../entities/Enemy';
import { Projectile } from '../../entities/Projectile';
import type { CombatContext } from '../CombatContext';
import { FIRST_SHOT_DELAY, type Weapon } from './Weapon';

/** Angle between the extra bolts that fan out in front of the player (radians) */
const SPREAD = 0.18;

/** Cosine of the aim assist's half angle */
const ASSIST_COS = coneCos(BOLT_AIM.assistHalfAngleDeg);

/**
 * Arcane bolt: fires forward, where the player looks, at regular intervals, whether it hits or not.
 * A light aim assist bends bolts toward the nearest enemies close to the line of fire; extra bolts
 * fan out in front.
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
    const { x: dirX, y: dirY } = player.aim;
    const forward = Math.atan2(dirY, dirX);
    const targets = enemies.nearest(stats.count, range, { dirX, dirY, cosHalf: ASSIST_COS });
    // Bolts with a target go to it; the rest fan out around the line of fire.
    for (let i = 0; i < stats.count; i++) {
      const target = targets[i];
      const angle = target
        ? Math.atan2(target.y - player.y, target.x - player.x)
        : forward + fanOffset(i - targets.length, SPREAD);
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
