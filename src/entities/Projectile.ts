import * as Phaser from 'phaser';
import type { Enemy } from './Enemy';

/** Pooled arcane bolt. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  pierceLeft = 0;
  expiresAt = 0;
  readonly hits = new Set<Enemy>();
  /** The enemy it was fired at (for focus fire), or null */
  target: Enemy | null = null;
  /** How often it can still bounce on to another enemy after its last hit (Ricochet) */
  bounces = 0;

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
    this.bounces = 0;
    this.setScale(1).clearTint();
    this.setRotation(angle);
    this.setDepth(4);
    this.body!.setCircle(5, this.width / 2 - 5, this.height / 2 - 5);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  despawn(): void {
    this.hits.clear();
    this.target = null;
    this.disableBody(true, true);
  }
}
