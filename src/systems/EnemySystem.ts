import * as Phaser from 'phaser';
import { BALANCE, ELITE } from '../config/balance';
import { eliteChance, ringModifiers, type RingModifiers } from '../logic/difficulty';
import { ENEMIES } from '../config/enemies';
import { dieAnim } from '../config/sprites';
import type { EnemyDef } from '../config/types';
import { Enemy } from '../entities/Enemy';
import { enemyHpMultiplier, maxEnemies, pickEnemy, spawnBatchSize, spawnIntervalMs } from '../logic/spawning';
import type { DamageNumbers } from './DamageNumbers';

const ENEMY_LIST: EnemyDef[] = Object.values(ENEMIES);
const SEPARATION_CELL = 36;
/** Fallen enemies shown at once (their death animation, then they fade) */
const MAX_CORPSES = 48;
/** How long a fallen enemy stays before it fades out (ms) */
const CORPSE_STAY_MS = 900;
const CORPSE_FADE_MS = 500;
const MAX_PER_CELL = 6;

interface Target {
  x: number;
  y: number;
}

/** Spawns, moves, separates and damages the enemy horde. */
export class EnemySystem {
  readonly group: Phaser.Physics.Arcade.Group;
  /** Diagonal of the visible world area; set by the scene on resize */
  viewDiag = 1000;
  private spawnTimer = 400;
  /** Golden rings under elites, so they stand out from the horde */
  private readonly eliteRings: Phaser.GameObjects.Graphics;
  private ring: RingModifiers = ringModifiers(1);
  private elites = 0;
  private readonly grid = new Map<number, Enemy[]>();
  /** Pool of death animations, so killing never creates new objects */
  private readonly corpses: Phaser.GameObjects.Group;

  constructor(
    scene: Phaser.Scene,
    private readonly target: Target,
    private readonly now: () => number,
    private readonly numbers: DamageNumbers,
    private readonly onKilled: (e: Enemy) => void,
  ) {
    this.group = scene.physics.add.group({ classType: Enemy, maxSize: BALANCE.maxEnemiesHardCap });
    this.eliteRings = scene.add.graphics().setDepth(1.9);
    this.corpses = scene.add.group({ classType: Phaser.GameObjects.Sprite, maxSize: MAX_CORPSES });
  }

  /** DEV: while true, nothing hurts enemies (invincible mode); set by the scene. */
  devNoDamage = false;

  // DEV: spawns one elite of the given type at the edge of the view.
  devSpawnElite(def: EnemyDef, runTime: number): void {
    const pos = this.spawnPoint();
    const e = this.group.get(pos.x, pos.y, def.texture) as Enemy | null;
    if (!e) return;
    e.spawn(
      def,
      pos.x,
      pos.y,
      enemyHpMultiplier(runTime) * this.ring.hp * ELITE.hp,
      this.ring.damage * ELITE.damage,
      true,
    );
  }

  /** Sets the difficulty for the ring of this fight's hex. */
  setRing(ring: number): void {
    this.ring = ringModifiers(ring);
    this.elites = eliteChance(ring);
  }

  *active(): Generator<Enemy> {
    const list = this.group.getChildren() as Enemy[];
    for (let i = 0; i < list.length; i++) {
      if (list[i].active) yield list[i];
    }
  }

  /** Up to `count` living enemies within `range` of the player, nearest first. */
  nearest(count: number, range: number): Enemy[] {
    const { x: px, y: py } = this.target;
    const best: { e: Enemy; d: number }[] = [];
    const r2 = range * range;
    for (const e of this.active()) {
      const d = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d > r2) continue;
      if (best.length < count) {
        best.push({ e, d });
        best.sort((a, b) => a.d - b.d);
      } else if (d < best[best.length - 1].d) {
        best[best.length - 1] = { e, d };
        best.sort((a, b) => a.d - b.d);
      }
    }
    return best.map((b) => b.e);
  }

  damage(e: Enemy, amount: number, knockX = 0, knockY = 0): void {
    if (!e.active || this.devNoDamage) return; // DEV: invincible mode deals no damage
    e.hp -= amount;
    e.flashUntil = this.now() + 70;
    e.x += knockX;
    e.y += knockY;
    this.numbers.show(e.x, e.y - e.def.radius - 4, String(Math.round(amount)));
    if (e.hp <= 0) {
      this.onKilled(e);
      this.showCorpse(e);
      e.despawn();
    }
  }

  /** The enemy falls (death animation), lies still for a moment and fades away. */
  private showCorpse(e: Enemy): void {
    if (!e.look) return;
    const c = this.corpses.get(e.x, e.y, e.look.key) as Phaser.GameObjects.Sprite | null;
    if (!c) return;
    c.scene.tweens.killTweensOf(c);
    c.setActive(true)
      .setVisible(true)
      .setPosition(e.x, e.y)
      .setScale(e.scaleX)
      .setAlpha(1)
      .setDepth(1.8)
      .setTintMode(Phaser.TintModes.MULTIPLY);
    if (e.elite) c.setTint(ELITE.tint);
    else c.clearTint();
    c.play(dieAnim(e.look.key));
    c.scene.tweens.add({
      targets: c,
      alpha: 0,
      delay: CORPSE_STAY_MS,
      duration: CORPSE_FADE_MS,
      onComplete: () => {
        c.anims.stop();
        this.corpses.killAndHide(c);
      },
    });
  }

  /** Spawns new waves based on the run time in seconds. */
  spawn(dms: number, runTime: number): void {
    this.spawnTimer -= dms;
    if (this.spawnTimer > 0) return;
    this.spawnTimer += spawnIntervalMs(runTime) / this.ring.spawnRate;
    const limit = maxEnemies(runTime, BALANCE.maxEnemiesHardCap);
    let alive = this.group.countActive(true);
    const batch = spawnBatchSize(runTime);
    for (let i = 0; i < batch && alive < limit; i++) {
      const def = pickEnemy(runTime, ENEMY_LIST, Math.random);
      const pos = this.spawnPoint();
      const e = this.group.get(pos.x, pos.y, def.texture) as Enemy | null;
      if (!e) break;
      const elite = Math.random() < this.elites;
      const hp = enemyHpMultiplier(runTime) * this.ring.hp * (elite ? ELITE.hp : 1);
      e.spawn(def, pos.x, pos.y, hp, this.ring.damage * (elite ? ELITE.damage : 1), elite);
      alive += 1;
    }
  }

  update(): void {
    const now = this.now();
    const { x: px, y: py } = this.target;
    const recycleDist = this.viewDiag * 0.8;
    const grid = this.grid;
    grid.clear();
    const rings = this.eliteRings;
    rings.clear();
    const pulse = 0.6 + Math.sin(now / 160) * 0.3;

    for (const e of this.active()) {
      const dx = px - e.x;
      const dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;

      // Too far away? Move it to the other side instead of despawning (keeps the horde dense).
      if (d > recycleDist) {
        const pos = this.spawnPoint();
        e.setPosition(pos.x, pos.y);
        continue;
      }

      const slowed = now < e.slowUntil;
      const speed = e.def.speed * e.speedJitter * (slowed ? e.slowFactor : 1);
      e.setVelocity((dx / d) * speed, (dy / d) * speed);
      e.walk(dx, dy, slowed ? e.slowFactor : 1);
      // Lower on screen = in front; the player always stays on top.
      e.setDepth(2 + Phaser.Math.Clamp((e.y - py) / 4000, -0.4, 0.4));
      this.updateTint(e, now, slowed);
      if (e.elite) {
        const r = e.def.radius * ELITE.scale + 7;
        // Around the body: sprites stand a little below their centre.
        const ry = e.y + (e.look ? e.look.bodyY * e.scaleY : 2);
        rings.fillStyle(ELITE.tint, 0.18 * pulse).fillCircle(e.x, ry, r + 4);
        rings.lineStyle(3, ELITE.tint, pulse).strokeCircle(e.x, ry, r);
      }

      const key = Math.floor(e.x / SEPARATION_CELL) * 92821 + Math.floor(e.y / SEPARATION_CELL);
      const bucket = grid.get(key);
      if (bucket) {
        if (bucket.length < MAX_PER_CELL) bucket.push(e);
      } else grid.set(key, [e]);
    }

    this.separate();
  }

  private updateTint(e: Enemy, now: number, slowed: boolean): void {
    const state = now < e.flashUntil ? 1 : slowed ? 2 : 0;
    if (state === e.tintState) return;
    e.tintState = state;
    if (state === 1) e.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (state === 2) e.setTint(0x8fd3ff).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (e.elite) e.setTint(ELITE.tint).setTintMode(Phaser.TintModes.MULTIPLY);
    else e.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  /** Simple separation so enemies don't collapse into a single point. */
  private separate(): void {
    for (const bucket of this.grid.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i];
          const b = bucket[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = (a.def.radius + b.def.radius) * 0.9;
          const d2 = dx * dx + dy * dy;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 0.01;
            const push = (min - d) * 0.5;
            const nx = d2 > 0 ? dx / d : Math.random() - 0.5;
            const ny = d2 > 0 ? dy / d : Math.random() - 0.5;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }
    }
  }

  private spawnPoint(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = this.viewDiag / 2 + 40;
    return { x: this.target.x + Math.cos(angle) * dist, y: this.target.y + Math.sin(angle) * dist };
  }
}
