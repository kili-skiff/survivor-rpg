import * as Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { DASH_SPEED } from '../config/skills';
import {
  CHARACTER_SPRITES,
  dieAnim,
  SHEET,
  walkAnim,
  type CharacterSprite,
  type Facing,
} from '../config/sprites';
import type { SkillStats } from '../config/types';
import { facingFor } from '../logic/facing';
import type { EnemySystem } from './EnemySystem';

/** Ignore stick input below this length when deciding a direction */
const DIRECTION_DEADZONE = 0.15;
/** Extra invulnerability after a dash ends (ms) */
const DASH_GRACE_MS = 80;
/** Distance within which a damaging dash hits an enemy (added to its radius) */
const DASH_HIT_REACH = 22;

/** The player sprite: movement, dash, invulnerability and hit feedback. */
export class PlayerController {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  /** The animated sheet, or null when the placeholder texture is shown */
  private readonly look: CharacterSprite | null;
  private readonly facing = new Phaser.Math.Vector2(1, 0);
  private readonly dashDir = new Phaser.Math.Vector2(1, 0);
  private dashUntil = 0;
  private dashId = 0;
  private dashDamage = 0;
  private lastGhostAt = 0;
  private invulnUntil = 0;
  private isMoving = false;
  private hurtFlashUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly now: () => number,
  ) {
    const sheet = CHARACTER_SPRITES.player;
    this.look = scene.textures.exists(sheet.key) ? sheet : null;
    if (this.look) {
      const look = this.look;
      this.sprite = scene.physics.add
        .sprite(0, 0, look.key, SHEET.rows.down * SHEET.columns)
        .setScale(look.scale)
        .setDepth(3);
      // A hitbox of 12 px in the world, around the body.
      const r = 12 / look.scale;
      const half = SHEET.frameSize / 2;
      this.sprite.body!.setCircle(r, half - r, half + look.bodyY - r);
    } else {
      this.sprite = scene.physics.add.sprite(0, 0, 'player').setDepth(3);
      this.sprite.body!.setCircle(12, 5, 4);
    }
  }

  /** True while the player moves or dashes, false while standing still. */
  get moving(): boolean {
    return this.isMoving;
  }

  /** Where the player looks: the last direction of movement, as a unit vector. */
  get aim(): { readonly x: number; readonly y: number } {
    return this.facing;
  }

  /**
   * Turns the player toward (dx, dy), e.g. to the enemy a weapon fires at. While moving, the direction
   * of movement takes over again at once.
   */
  faceToward(dx: number, dy: number): void {
    if (Math.hypot(dx, dy) < 0.001) return;
    this.facing.set(dx, dy).normalize();
    if (!this.look) this.sprite.setFlipX(dx < 0);
  }

  /** Walk animation in the facing direction, or the standing pose. */
  private animate(moving: boolean): void {
    if (!this.look) return;
    const facing = facingFor(this.facing.x, this.facing.y);
    if (moving) {
      this.sprite.play(walkAnim(this.look.key, facing), true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(SHEET.rows[facing] * SHEET.columns);
    }
  }

  /** Which way the character looks, for things it carries */
  heading(): Facing {
    return facingFor(this.facing.x, this.facing.y);
  }

  /** Current velocity (px/s) */
  get velocity(): Phaser.Math.Vector2 {
    return (this.sprite.body as Phaser.Physics.Arcade.Body).velocity;
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

    this.isMoving = dashing;
    if (dashing) {
      p.setVelocity(this.dashDir.x * DASH_SPEED, this.dashDir.y * DASH_SPEED);
      this.spawnGhost(now);
      if (this.dashDamage > 0) this.dashHits(enemies);
    } else {
      p.setVelocity(moveX * moveSpeed, moveY * moveSpeed);
      const moving = Math.hypot(moveX, moveY) > DIRECTION_DEADZONE;
      this.isMoving = moving;
      if (moving) {
        this.facing.set(moveX, moveY).normalize();
        if (!this.look) p.setFlipX(moveX < 0);
      }
      this.animate(moving);
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

  /** No damage for the next `ms` (e.g. after Second Wind). */
  protect(ms: number): void {
    this.invulnUntil = Math.max(this.invulnUntil, this.now() + ms);
  }

  stop(): void {
    this.sprite.setVelocity(0, 0);
  }

  showDefeated(): void {
    this.sprite.setVelocity(0, 0).setAlpha(1).setTint(0x555555).setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.look) this.sprite.play(dieAnim(this.look.key));
  }

  private spawnGhost(now: number): void {
    if (now - this.lastGhostAt <= 28) return;
    this.lastGhostAt = now;
    const ghost = this.scene.add
      .image(this.sprite.x, this.sprite.y, this.sprite.texture.key, this.sprite.frame.name)
      .setScale(this.sprite.scaleX)
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
