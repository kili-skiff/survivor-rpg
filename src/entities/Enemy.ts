import * as Phaser from 'phaser';
import { ELITE, SWARM } from '../config/balance';
import { CHARACTER_SPRITES, SHEET, walkAnim, type CharacterSprite, type Facing } from '../config/sprites';
import type { EnemyDef } from '../config/types';
import { facingFor } from '../logic/facing';
import { speedFactor, type SwarmAgent } from '../logic/swarm';

/** Pooled enemy: reused instead of created anew. */
export class Enemy extends Phaser.Physics.Arcade.Sprite implements SwarmAgent {
  def!: EnemyDef;
  hp = 0;
  maxHp = 0;
  /** Per-enemy speed variation so hordes don't stack perfectly */
  speedJitter = 1;
  // How it moves in the horde (see logic/swarm.ts)
  /** Body radius in the world (px), elites are bigger */
  radius = 0;
  /** Speed this frame (px/s), after slowing */
  moveSpeed = 0;
  /** Offsets its sideways drift from the others (0..2π) */
  phase = 0;
  aimX = 0;
  aimY = 0;
  nextAimAt = 0;
  /** Velocity chosen by the swarm this frame (px/s) */
  steerX = 0;
  steerY = 0;
  slowUntil = 0;
  slowFactor = 1;
  flashUntil = 0;
  lastBladeHit = 0;
  lastDashHit = 0;
  /** 0 = normal, 1 = hit flash, 2 = slowed */
  tintState = 0;
  /** Damage per touch, after ring and elite modifiers */
  damage = 0;
  /** Elite: big, tough, golden shimmer, always drops gold */
  elite = false;
  /** The animated sheet, or null when the placeholder texture is shown */
  look: CharacterSprite | null = null;
  /** Where the walk animation faces; null until the first move */
  facing: Facing | null = null;
  /** Height of the eyes above the enemy's position (px), for glowing eyes in the dark */
  eyesY = 4;

  spawn(
    def: EnemyDef,
    x: number,
    y: number,
    hpMultiplier: number,
    damageMultiplier = 1,
    elite = false,
  ): void {
    this.def = def;
    this.elite = elite;
    this.damage = def.damage * damageMultiplier;
    const sheet = def.sprite ? CHARACTER_SPRITES[def.sprite] : undefined;
    this.look = sheet && this.scene.textures.exists(sheet.key) ? sheet : null;
    const base = this.look?.scale ?? 1;
    const scale = base * (elite ? ELITE.scale : 1);
    this.anims.stop();
    this.facing = null;
    if (this.look) this.setTexture(this.look.key, SHEET.rows.down * SHEET.columns);
    else this.setTexture(def.texture);
    this.setScale(scale);
    this.enableBody(true, x, y, true, true);
    this.hp = def.hp * hpMultiplier;
    this.maxHp = this.hp;
    this.speedJitter = speedFactor(SWARM, Math.random);
    this.radius = def.radius * (elite ? ELITE.scale : 1);
    this.phase = Math.random() * Math.PI * 2;
    this.aimX = x;
    this.aimY = y;
    this.nextAimAt = 0;
    this.steerX = 0;
    this.steerY = 0;
    this.slowUntil = 0;
    this.slowFactor = 1;
    this.flashUntil = 0;
    this.lastBladeHit = 0;
    this.lastDashHit = 0;
    this.tintState = -1;
    this.setDepth(2);
    const size = this.width;
    if (this.look) {
      // Hitbox around the body, not the whole frame; its radius in the world stays `def.radius`.
      const r = def.radius / base;
      this.body!.setCircle(r, size / 2 - r, size / 2 + this.look.bodyY - r);
      this.eyesY = this.look.eyesY * scale;
    } else {
      this.body!.setCircle(def.radius, size / 2 - def.radius, size / 2 - def.radius);
      this.eyesY = elite ? 8 : 4;
    }
  }

  /** Walks in the direction of (dx, dy); the animation slows down with the enemy. */
  walk(dx: number, dy: number, timeScale: number): void {
    if (!this.look) {
      this.setFlipX(dx < 0);
      return;
    }
    const facing = facingFor(dx, dy);
    if (facing !== this.facing) {
      const first = this.facing === null;
      this.facing = facing;
      this.play(walkAnim(this.look.key, facing), true);
      // Start somewhere in the cycle, so a horde does not step in sync.
      if (first) this.anims.setProgress(Math.random());
    }
    this.anims.timeScale = timeScale;
  }

  despawn(): void {
    this.anims.stop();
    this.disableBody(true, true);
  }
}
