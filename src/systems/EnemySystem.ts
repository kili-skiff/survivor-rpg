import * as Phaser from 'phaser';
import { BALANCE, CHARGE_COOLDOWN_MS, ELITE, MAX_CHARGERS_AT_ONCE } from '../config/balance';
import { COLORS } from '../ui/theme';
import { eliteChance, ringModifiers, type RingModifiers } from '../logic/difficulty';
import { ENEMIES } from '../config/enemies';
import { ChargeGate, isLocked, leapAt, REST_SPEED, stepCharge, windupProgress } from '../logic/charge';
import { dieAnim } from '../config/sprites';
import {
  addPush,
  decayPush,
  inBurst,
  neutralMods,
  percentDamage,
  pushSpeed,
  resolveHit,
  splashDamage,
  type HitEffects,
  type HitMods,
} from '../logic/hitEffects';
import type { EnemyDef } from '../config/types';
import { Enemy } from '../entities/Enemy';
import { enemyHpMultiplier, maxEnemies, pickEnemy, spawnBatchSize, spawnIntervalMs } from '../logic/spawning';
import { Swarm, VelocityEstimator } from '../logic/swarm';
import { BurstFx } from './BurstFx';
import type { DamageNumbers } from './DamageNumbers';

const ENEMY_LIST: EnemyDef[] = Object.values(ENEMIES);
/** Fallen enemies shown at once (their death animation, then they fade) */
const MAX_CORPSES = 48;
/** How long a fallen enemy stays before it fades out (ms) */
const CORPSE_STAY_MS = 900;
const CORPSE_FADE_MS = 500;
/** How long the dust ring of a landing is shown (ms) */
const LAND_FX_MS = 300;

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
  /** How fast the player moves, so flankers can aim ahead of them */
  private readonly targetVelocity = new VelocityEstimator();
  /** The ring of this fight's hex: some enemies only appear further out */
  private ringNumber = 1;
  /** Decides when a pounce may start, for all chargers together (how many at once, global cooldown) */
  private readonly chargeGate = new ChargeGate(MAX_CHARGERS_AT_ONCE, CHARGE_COOLDOWN_MS);
  /** The enemies that move this frame; reused every frame */
  private readonly live: Enemy[] = [];
  /** Pool of death animations, so killing never creates new objects */
  private readonly corpses: Phaser.GameObjects.Group;
  /** The rings of bursts around hit enemies */
  private readonly bursts: BurstFx;
  /** Game time (ms) of the last update, for the push that slows down; -1 before the first */
  private lastUpdateMs = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly target: Target,
    private readonly now: () => number,
    private readonly numbers: DamageNumbers,
    private readonly onKilled: (e: Enemy) => void,
    /** A pouncing enemy has landed; the scene checks whether it hurts the player */
    private readonly onLanded: (e: Enemy) => void = () => {},
  ) {
    this.group = scene.physics.add.group({ classType: Enemy, maxSize: BALANCE.maxEnemiesHardCap });
    this.eliteRings = scene.add.graphics().setDepth(1.9);
    this.corpses = scene.add.group({ classType: Phaser.GameObjects.Sprite, maxSize: MAX_CORPSES });
    this.bursts = new BurstFx(scene, now, COLORS.bolt);
  }

  /** What items and the moment do to every weapon hit; the scene keeps it up to date */
  readonly mods: HitMods = neutralMods();
  /** Enemies spawn with this many times their health (Blood Pact) */
  hpMul = 1;

  /** DEV: while true, nothing hurts enemies (invincible mode); set by the scene. */
  devNoDamage = false;

  // DEV: spawns one elite of the given type at the edge of the view.
  devSpawnElite(def: EnemyDef, fightTime: number): void {
    const pos = this.spawnPoint();
    const e = this.group.get(pos.x, pos.y, def.texture) as Enemy | null;
    if (!e) return;
    e.spawn(
      def,
      pos.x,
      pos.y,
      enemyHpMultiplier(fightTime) * this.ring.hp * ELITE.hp * this.hpMul,
      this.ring.damage * ELITE.damage,
      true,
    );
  }

  /** Sets the difficulty for the ring of this fight's hex. */
  setRing(ring: number): void {
    this.ring = ringModifiers(ring);
    this.ringNumber = ring;
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
      if (e.airborne) continue;
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

  damage(e: Enemy, amount: number, knockX = 0, knockY = 0, color = '#ffffff'): void {
    if (!e.active || e.airborne || this.devNoDamage) return; // DEV: invincible mode deals no damage
    e.hp -= amount;
    e.flashUntil = this.now() + 70;
    e.x += knockX;
    e.y += knockY;
    this.numbers.show(e.x, e.y - e.def.radius - 4, String(Math.round(amount)), color);
    if (e.hp <= 0) {
      this.onKilled(e);
      this.showCorpse(e);
      e.despawn();
    }
  }

  /**
   * A weapon hit: damage plus what the weapon does besides, the tools against a crowd that piles up
   * (see logic/hitEffects.ts): extra damage as a share of health, a push away from (fromX, fromY)
   * and a burst that hurts the neighbours. `knockX`/`knockY` is a small instant nudge.
   */
  hit(e: Enemy, damage: number, fx: HitEffects, fromX: number, fromY: number, knockX = 0, knockY = 0): void {
    if (!e.active || e.airborne || this.devNoDamage) return; // DEV: invincible mode deals no damage
    const x = e.x;
    const y = e.y;
    const result = resolveHit(damage, this.mods, e, Math.random);
    const bonus = percentDamage(fx.percent ?? 0, e.maxHp, e.elite);
    const color = result.executed ? '#f87171' : result.crit ? '#fde047' : '#ffffff';
    this.damage(e, result.damage + bonus, knockX, knockY, color);
    if (e.active && fx.knockback) {
      const speed = pushSpeed(fx.knockback, e.def.knockResist ?? 0, e.elite);
      addPush(e.push, speed, fromX, fromY, e.x, e.y);
    }
    if (fx.splash) this.burst(x, y, fx.splash, splashDamage(result.damage), e);
  }

  /** Hurts every enemy near (x, y) except `skip`, with a ring to show where. */
  private burst(x: number, y: number, radius: number, amount: number, skip: Enemy): void {
    this.bursts.add(x, y, radius);
    for (const n of this.active()) {
      if (n === skip || n.airborne) continue;
      if (inBurst(Math.hypot(n.x - x, n.y - y), n.radius, radius)) this.damage(n, amount);
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

  /**
   * Spawns new waves. `runTime` is the difficulty time (fight time plus the ring's offset) and decides
   * which enemies come and how many; `fightTime` is the time of this fight only and decides how tough
   * they are.
   */
  spawn(dms: number, runTime: number, fightTime: number): void {
    this.spawnTimer -= dms;
    if (this.spawnTimer > 0) return;
    this.spawnTimer += spawnIntervalMs(runTime) / this.ring.spawnRate;
    const limit = maxEnemies(runTime, BALANCE.maxEnemiesHardCap);
    let alive = this.group.countActive(true);
    const batch = spawnBatchSize(runTime);
    for (let i = 0; i < batch && alive < limit; i++) {
      const def = pickEnemy(runTime, ENEMY_LIST, Math.random, this.ringNumber);
      const pos = this.spawnPoint();
      const e = this.group.get(pos.x, pos.y, def.texture) as Enemy | null;
      if (!e) break;
      const elite = Math.random() < this.elites;
      const hp = enemyHpMultiplier(fightTime) * this.ring.hp * (elite ? ELITE.hp : 1) * this.hpMul;
      e.spawn(def, pos.x, pos.y, hp, this.ring.damage * (elite ? ELITE.damage : 1), elite);
      alive += 1;
    }
  }

  update(): void {
    const now = this.now();
    // The push of hits slows down with the time that really passed (the game clock stops while paused).
    const dt = this.lastUpdateMs < 0 ? 0 : Math.min(0.05, (now - this.lastUpdateMs) / 1000);
    this.lastUpdateMs = now;
    this.bursts.update();
    const { x: px, y: py } = this.target;
    const recycleDist = this.viewDiag * 0.8;
    const live = this.live;
    live.length = 0;
    const rings = this.eliteRings;
    rings.clear();
    const pulse = 0.6 + Math.sin(now / 160) * 0.3;
    // How many chargers are busy (warning or dash) right now; the gate keeps it to a few, with breathers between.
    let chargers = 0;
    for (const e of this.active()) {
      if (e.charge.phase === 'windup' || e.charge.phase === 'leap') chargers++;
    }

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
      // Lower on screen = in front; the player (3) always stays on top. Flyers pass over the crowd.
      e.setDepth((e.flies ? 2.5 : 2) + Phaser.Math.Clamp((e.y - py) / 4000, -0.4, 0.4) * (e.flies ? 0.2 : 1));
      const behavior = e.def.behavior;
      if (behavior?.kind === 'charge') {
        const was = e.charge.phase;
        const phase = stepCharge(
          e.charge,
          behavior,
          e.x,
          e.y,
          px,
          py,
          now,
          this.chargeGate.canStart(now, chargers),
        );
        if (was === 'approach' && phase === 'windup') {
          chargers++;
          this.chargeGate.started(now);
        }
        if (was === 'leap' && phase === 'rest') this.land(e, behavior.landRadius, now);
        e.flies = phase === 'leap' || (e.def.flies ?? false); // in the air it is not part of the crowd
        if (phase === 'windup' || phase === 'leap') {
          // The warning: a circle where it will land, filling up while it crouches.
          const fill = phase === 'leap' ? 1 : windupProgress(e.charge, behavior, now);
          const { targetX: tx, targetY: ty } = e.charge;
          // Locked (it will land here now): brighter and solid.
          const locked = isLocked(e.charge, behavior, now);
          rings
            .fillStyle(0xff4d4d, 0.1 + 0.3 * fill + (locked ? 0.15 : 0))
            .fillCircle(tx, ty, behavior.landRadius);
          rings
            .lineStyle(locked ? 4 : 3, locked ? 0xffd0d0 : 0xff4d4d, locked ? 1 : 0.35 + 0.5 * pulse)
            .strokeCircle(tx, ty, behavior.landRadius);
        }
        if (phase === 'leap') {
          // Its shadow stays on the ground while it is in the air.
          const g = leapAt(e.charge, behavior, now);
          rings
            .fillStyle(0x000000, 0.35)
            .fillEllipse(
              g.x,
              g.y + (e.look ? e.look.bodyY * e.baseScale : 2) + 6,
              e.radius * 1.6,
              e.radius * 0.7,
            );
        }
        this.squash(e, behavior, now);
      }
      // The dust ring of a landing.
      const t = (now - e.landAt) / LAND_FX_MS;
      if (t >= 0 && t < 1) {
        const lr = (behavior?.kind === 'charge' ? behavior.landRadius : 30) * (0.6 + 0.8 * t);
        rings.lineStyle(3, 0xd8d0bc, 0.6 * (1 - t)).strokeCircle(e.landX, e.landY, lr);
      }
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
    this.targetVelocity.update(px, py, now);
    this.swarm.steer(live, this.target, now, Math.random, this.targetVelocity);
    for (let i = 0; i < live.length; i++) {
      const e = live[i];
      const slow = now < e.slowUntil ? e.slowFactor : 1;
      const charge = e.def.behavior?.kind === 'charge' ? e.def.behavior : null;
      if (charge && e.charge.phase === 'windup') {
        // Stands still and crouches: the animation freezes.
        e.steerX = 0;
        e.steerY = 0;
        e.push.x = 0;
        e.push.y = 0;
        e.setVelocity(0, 0);
        e.walk(e.charge.targetX - e.x, e.charge.targetY - e.y, 0);
        continue;
      }
      if (charge && e.charge.phase === 'leap') {
        // In the air: its position follows the arc (the sprite is lifted, the shadow stays down).
        const g = leapAt(e.charge, charge, now);
        e.setVelocity(0, 0);
        e.setPosition(g.x, g.y - g.height);
        e.walk(e.charge.targetX - e.charge.startX, e.charge.targetY - e.charge.startY, 0);
        continue;
      }
      if (charge && e.charge.phase === 'rest') {
        e.steerX *= REST_SPEED;
        e.steerY *= REST_SPEED;
      }
      e.setVelocity(e.steerX + e.push.x, e.steerY + e.push.y);
      decayPush(e.push, dt);
      e.walk(e.steerX, e.steerY, slow);
    }
    // Bodies never sit inside each other.
    this.swarm.separate();
  }

  /** The landing: dust, and the scene decides whether the player stood in it. */
  private land(e: Enemy, radius: number, now: number): void {
    e.setPosition(e.charge.targetX, e.charge.targetY);
    e.landAt = now;
    e.landX = e.x;
    e.landY = e.y;
    const reach = radius + e.def.radius;
    if (Math.hypot(this.target.x - e.x, this.target.y - e.y) <= reach) this.onLanded(e);
  }

  /** Crouches before the leap, stretches in the air, squashes on landing. */
  private squash(e: Enemy, p: { restSec: number }, now: number): void {
    const phase = e.charge.phase;
    const landed = phase === 'rest' && now - (e.charge.until - p.restSec * 1000) < 200;
    const [sx, sy] = phase === 'windup' || landed ? [1.15, 0.8] : phase === 'leap' ? [0.9, 1.12] : [1, 1];
    e.setScale(e.baseScale * sx, e.baseScale * sy);
  }

  private updateTint(e: Enemy, now: number, slowed: boolean): void {
    const state = now < e.flashUntil ? 1 : slowed ? 2 : e.charge.phase === 'windup' ? 3 : 0;
    if (state === e.tintState) return;
    e.tintState = state;
    if (state === 1) e.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (state === 2) e.setTint(0x8fd3ff).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (state === 3) e.setTint(0xff6a6a).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (e.elite) e.setTint(ELITE.tint).setTintMode(Phaser.TintModes.MULTIPLY);
    else e.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  private spawnPoint(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = this.viewDiag / 2 + 40;
    return { x: this.target.x + Math.cos(angle) * dist, y: this.target.y + Math.sin(angle) * dist };
  }
}
