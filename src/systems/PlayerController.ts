import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { DASH_SPEED } from '../config/skills';
import type { SkillStats } from '../config/types';
import type { EnemySystem } from './EnemySystem';

/** Ignore stick input below this length when deciding a direction */
const DIRECTION_DEADZONE = 0.15;
/** Extra invulnerability after a dash ends (ms) */
const DASH_GRACE_MS = 80;
/** Distance within which a damaging dash hits an enemy (added to its radius) */
const DASH_HIT_REACH = 22;

/** The player sprite: movement, dash, invulnerability and hit feedback. */
export class PlayerController {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private readonly facing = new Phaser.Math.Vector2(1, 0);
  private readonly dashDir = new Phaser.Math.Vector2(1, 0);
  private dashUntil = 0;
  private dashId = 0;
  private dashDamage = 0;
  private lastGhostAt = 0;
  private invulnUntil = 0;
  private hurtFlashUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly now: () => number,
  ) {
    this.sprite = scene.physics.add.image(0, 0, 'player').setDepth(3);
    this.sprite.body!.setCircle(12, 5, 4);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  isDashing(): boolean {
    return this.now() < this.dashUntil;
  }

  /** Dashes in the movement direction, or the facing direction when standing still. */
  startDash(stats: SkillStats, moveX: number, moveY: number): void {
    const now = this.now();
    if (Math.hypot(moveX, moveY) > DIRECTION_DEADZONE) this.dashDir.set(moveX, moveY).normalize();
    else this.dashDir.copy(this.facing);
    this.dashUntil = now + stats.duration;
    this.dashDamage = stats.damage;
    this.invulnUntil = Math.max(this.invulnUntil, this.dashUntil + DASH_GRACE_MS);
    this.dashId += 1;
  }

  update(moveX: number, moveY: number, moveSpeed: number, enemies: EnemySystem): void {
    const p = this.sprite;
    const now = this.now();
    const dashing = this.isDashing();

    if (dashing) {
      p.setVelocity(this.dashDir.x * DASH_SPEED, this.dashDir.y * DASH_SPEED);
      this.spawnGhost(now);
      if (this.dashDamage > 0) this.dashHits(enemies);
    } else {
      p.setVelocity(moveX * moveSpeed, moveY * moveSpeed);
      if (Math.hypot(moveX, moveY) > DIRECTION_DEADZONE) {
        this.facing.set(moveX, moveY).normalize();
        p.setFlipX(moveX < 0);
      }
    }

    if (now < this.hurtFlashUntil) {
      p.setTint(0xff5a6e).setTintMode(Phaser.TintModes.FILL);
    } else {
      p.clearTint();
      p.setTintMode(Phaser.TintModes.MULTIPLY);
    }
    p.setAlpha(dashing ? 0.65 : now < this.invulnUntil ? 0.8 : 1);
  }

  /** Returns false while invulnerable; otherwise starts the hurt feedback and returns true. */
  tryTakeHit(): boolean {
    const now = this.now();
    if (now < this.invulnUntil) return false;
    this.invulnUntil = now + BALANCE.hurtInvulnMs;
    this.hurtFlashUntil = now + 110;
    this.scene.cameras.main.shake(110, 0.005);
    return true;
  }

  stop(): void {
    this.sprite.setVelocity(0, 0);
  }

  showDefeated(): void {
    this.sprite.setVelocity(0, 0).setAlpha(1).setTint(0x555555).setTintMode(Phaser.TintModes.MULTIPLY);
  }

  private spawnGhost(now: number): void {
    if (now - this.lastGhostAt <= 28) return;
    this.lastGhostAt = now;
    const ghost = this.scene.add
      .image(this.sprite.x, this.sprite.y, 'player')
      .setDepth(2.5)
      .setAlpha(0.45)
      .setTint(0x818cf8);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }

  private dashHits(enemies: EnemySystem): void {
    const { x, y } = this.sprite;
    for (const e of enemies.active()) {
      if (
        e.lastDashHit !== this.dashId &&
        Phaser.Math.Distance.Between(x, y, e.x, e.y) < e.def.radius + DASH_HIT_REACH
      ) {
        e.lastDashHit = this.dashId;
        enemies.damage(e, this.dashDamage);
      }
    }
  }
}
