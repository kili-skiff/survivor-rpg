import * as Phaser from 'phaser';
import { BALANCE, ELITE } from '../config/balance';
import { eliteChance, ringModifiers, type RingModifiers } from '../logic/difficulty';
import { ENEMIES } from '../config/enemies';
import { dieAnim } from '../config/sprites';
import type { EnemyDef } from '../config/types';
import { Enemy } from '../entities/Enemy';
import { enemyHpMultiplier, maxEnemies, pickEnemy, spawnBatchSize, spawnIntervalMs } from '../logic/spawning';
import { Swarm } from '../logic/swarm';
import type { DamageNumbers } from './DamageNumbers';

const ENEMY_LIST: EnemyDef[] = Object.values(ENEMIES);
/** Fallen enemies shown at once (their death animation, then they fade) */
const MAX_CORPSES = 48;
/** How long a fallen enemy stays before it fades out (ms) */
const CORPSE_STAY_MS = 900;
const CORPSE_FADE_MS = 500;

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
  /** Steers the horde so it stays a loose crowd */
  private readonly swarm = new Swarm<Enemy>();
  /** The enemies that move this frame; reused every frame */
  private readonly live: Enemy[] = [];
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
    if (!e.active) return;
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
    const live = this.live;
    live.length = 0;
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
      e.moveSpeed = e.def.speed * e.speedJitter * (slowed ? e.slowFactor : 1);
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

      live.push(e);
    }

    // Where each one goes: toward the player, around its neighbours, with a drift of its own.
    this.swarm.steer(live, this.target, now, Math.random);
    for (let i = 0; i < live.length; i++) {
      const e = live[i];
      e.setVelocity(e.steerX, e.steerY);
      e.walk(e.steerX, e.steerY, now < e.slowUntil ? e.slowFactor : 1);
    }
    // Bodies never sit inside each other.
    this.swarm.separate();
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

  private spawnPoint(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = this.viewDiag / 2 + 40;
    return { x: this.target.x + Math.cos(angle) * dist, y: this.target.y + Math.sin(angle) * dist };
  }
}
