import * as Phaser from 'phaser';
import { ELITE } from '../config/balance';
import type { EnemyDef } from '../config/types';

/** Pooled enemy: reused instead of created anew. */
export class Enemy extends Phaser.Physics.Arcade.Image {
  def!: EnemyDef;
  hp = 0;
  maxHp = 0;
  /** Per-enemy speed variation so hordes don't stack perfectly */
  speedJitter = 1;
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
    this.setScale(elite ? ELITE.scale : 1);
    this.setTexture(def.texture);
    this.enableBody(true, x, y, true, true);
    this.hp = def.hp * hpMultiplier;
    this.maxHp = this.hp;
    this.speedJitter = 0.88 + Math.random() * 0.24;
    this.slowUntil = 0;
    this.slowFactor = 1;
    this.flashUntil = 0;
    this.lastBladeHit = 0;
    this.lastDashHit = 0;
    this.tintState = -1;
    this.setDepth(2);
    const size = this.width;
    this.body!.setCircle(def.radius, size / 2 - def.radius, size / 2 - def.radius);
  }

  despawn(): void {
    this.disableBody(true, true);
  }
}
