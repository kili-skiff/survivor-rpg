import * as Phaser from 'phaser';
import type { Enemy } from './Enemy';

/** Pooled arcane bolt. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  pierceLeft = 0;
  expiresAt = 0;
  readonly hits = new Set<Enemy>();

  fire(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    pierce: number,
    now: number,
    lifetime: number,
  ): void {
    this.enableBody(true, x, y, true, true);
    this.damage = damage;
    this.pierceLeft = pierce;
    this.expiresAt = now + lifetime;
    this.hits.clear();
    this.setRotation(angle);
    this.setDepth(4);
    this.body!.setCircle(5, this.width / 2 - 5, this.height / 2 - 5);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  despawn(): void {
    this.hits.clear();
    this.disableBody(true, true);
  }
}

/** XP gem or heal pickup. */
export class Pickup extends Phaser.GameObjects.Image {
  value = 0;
  kind: 'xp' | 'heal' = 'xp';
  attracted = false;
}
