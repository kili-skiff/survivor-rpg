import * as Phaser from 'phaser';
import { MOD } from '../../config/modifiers';
import type { WeaponStats } from '../../config/types';
import { BOOMERANG_CURVE, BOOMERANG_RANGE, BOOMERANG_REACH } from '../../config/weapons';
import type { Enemy } from '../../entities/Enemy';
import type { HitEffects } from '../../logic/hitEffects';
import type { CombatContext } from '../CombatContext';
import { FIRST_SHOT_DELAY, type Weapon } from './Weapon';

/** Boomerangs in the air at once; when all are flying, the next throw waits */
const POOL = 12;
/** Embers of Ember Trail on the ground at once */
const EMBER_POOL = 90;
/** Angle between boomerangs thrown together (radians) */
const SPREAD = 0.3;
/** Turns per second while flying */
const SPIN = 3;
/** Whirl spins this much faster at the turn */
const WHIRL_SPIN = 2.5;
const TAU = Math.PI * 2;
/** Embers stay a bit see-through, so a trail does not cover the fight */
const EMBER_ALPHA = 0.55;

/** How often and when an enemy was hit on one way (Keen Edge allows more than one hit) */
type Hits = Map<Enemy, { n: number; at: number }>;

interface Flight {
  image: Phaser.GameObjects.Image;
  flying: boolean;
  /** Direction to the far point of the loop (unit vector) */
  dirX: number;
  dirY: number;
  /** Which way the loop bends: 1 or -1 */
  side: number;
  /** Where it was thrown from; the loop's end slides from here to the player */
  fromX: number;
  fromY: number;
  /** Position on the loop, 0 to 2π; the far point is at π */
  phase: number;
  /** Whirl: time left spinning at the turn (ms), and until the next round of hits; -1 = not yet */
  holdLeft: number;
  tickLeft: number;
  /** Orbit: circling the player; the angle so far, and where around the player it is */
  orbiting: boolean;
  orbitDone: boolean;
  orbitTurned: number;
  orbitAngle: number;
  /** Ember Trail: distance since the last ember */
  trail: number;
  /** Enemies already hit on the way out and on the way back (and while circling) */
  hitsOut: Hits;
  hitsBack: Hits;
}

interface Ember {
  image: Phaser.GameObjects.Image;
  until: number;
  nextTick: number;
  damage: number;
  radius: number;
}

/**
 * Boomerang (a main weapon): thrown at the nearest enemy, it flies a wide loop, out on one side and
 * back on the other, and is caught by the player, hitting everything on both ways. Its modifiers
 * (config/modifiers.ts) make it stop and spin at the turn, drag enemies in, circle the player, hit twice
 * or leave burning embers.
 */
export class BoomerangWeapon implements Weapon {
  private readonly flights: Flight[];
  private readonly embers: Ember[];
  private timer = FIRST_SHOT_DELAY;
  /** Throws alternate between bending left and right */
  private nextSide = 1;
  /** What a hit does besides damage; follows the weapon's level */
  private readonly effects: HitEffects = {};

  constructor(private readonly ctx: CombatContext) {
    this.flights = Array.from({ length: POOL }, () => ({
      image: ctx.scene.add.image(0, 0, 'boomerang').setDepth(4).setVisible(false),
      flying: false,
      dirX: 1,
      dirY: 0,
      side: 1,
      fromX: 0,
      fromY: 0,
      phase: 0,
      holdLeft: -1,
      tickLeft: 0,
      orbiting: false,
      orbitDone: false,
      orbitTurned: 0,
      orbitAngle: 0,
      trail: 0,
      hitsOut: new Map(),
      hitsBack: new Map(),
    }));
    this.embers = Array.from({ length: EMBER_POOL }, () => ({
      image: ctx.scene.add.image(0, 0, 'ember-trail').setDepth(1.5).setVisible(false),
      until: 0,
      nextTick: 0,
      damage: 0,
      radius: 0,
    }));
  }

  update(stats: WeaponStats, dms: number, dt: number): void {
    this.effects.knockback = stats.knockback;
    this.effects.splash = stats.splash;
    this.effects.percent = stats.percent;
    const range = BOOMERANG_RANGE * stats.area;
    const reach = BOOMERANG_REACH * stats.area;
    for (const f of this.flights) if (f.flying) this.fly(f, stats, range, reach, dms, dt);
    this.burnEmbers();

    this.timer -= dms;
    if (this.timer > 0) return;
    const { player, enemies } = this.ctx;
    const targets = enemies.nearest(stats.count, Math.min(range * 1.2, this.ctx.visionRange()));
    if (targets.length === 0) {
      this.timer = 0;
      return;
    }
    for (let i = 0; i < stats.count; i++) {
      const f = this.flights.find((x) => !x.flying);
      if (!f) break;
      const target = targets[i % targets.length];
      // More boomerangs than targets fan out around the last one.
      const extra = i - targets.length + 1;
      const offset = extra > 0 ? (extra % 2 === 1 ? 1 : -1) * Math.ceil(extra / 2) * SPREAD : 0;
      const angle = Math.atan2(target.y - player.y, target.x - player.x) + offset;
      this.launch(f, angle, this.nextSide, stats.area);
      this.nextSide = -this.nextSide;
    }
    this.timer = stats.cooldown;
  }

  clear(): void {
    for (const f of this.flights) {
      f.flying = false;
      f.image.setVisible(false);
    }
    for (const e of this.embers) {
      e.until = 0;
      e.image.setVisible(false);
    }
  }

  private launch(f: Flight, angle: number, side: number, area: number): void {
    const { player } = this.ctx;
    // Turned a little against the bend, so the way out sweeps across the target.
    const a = angle - side * BOOMERANG_CURVE.aimTilt;
    f.flying = true;
    f.phase = 0;
    f.side = side;
    f.dirX = Math.cos(a);
    f.dirY = Math.sin(a);
    f.fromX = player.x;
    f.fromY = player.y;
    f.holdLeft = -1;
    f.tickLeft = 0;
    f.orbiting = false;
    f.orbitDone = false;
    f.orbitTurned = 0;
    f.trail = 0;
    f.hitsOut.clear();
    f.hitsBack.clear();
    // A wider blade looks wider.
    f.image
      .setPosition(player.x, player.y)
      .setScale(1 + (area - 1) * 0.8)
      .setVisible(true);
  }

  private fly(f: Flight, stats: WeaponStats, range: number, reach: number, dms: number, dt: number): void {
    const { player } = this.ctx;
    const img = f.image;
    const prevX = img.x;
    const prevY = img.y;
    let spin = SPIN;

    if (f.orbiting) {
      // Orbit: once around the player, then caught.
      const radius = MOD.orbit.radius * stats.area;
      const step = (stats.speed / radius) * dt;
      f.orbitTurned += step;
      f.orbitAngle += step * f.side;
      if (f.orbitTurned >= TAU) {
        this.catch(f);
        return;
      }
      img.setPosition(player.x + Math.cos(f.orbitAngle) * radius, player.y + Math.sin(f.orbitAngle) * radius);
    } else {
      // The loop is an ellipse: half the range long, `width` to the side.
      const a = range / 2;
      const b = range * BOOMERANG_CURVE.width;
      const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
      const holding = this.updateWhirl(f, stats, reach, dms);
      if (holding) spin = SPIN * WHIRL_SPIN;
      else f.phase += (TAU * stats.speed * dt) / perimeter;
      if (f.phase >= TAU) {
        this.catch(f);
        return;
      }
      // The start of the loop slides from the throw point to the player, so it comes back to them.
      const t = f.phase / TAU;
      const ox = f.fromX + (player.x - f.fromX) * t;
      const oy = f.fromY + (player.y - f.fromY) * t;
      const along = a * (1 - Math.cos(f.phase));
      const across = b * Math.sin(f.phase) * f.side;
      img.setPosition(ox + f.dirX * along - f.dirY * across, oy + f.dirY * along + f.dirX * across);

      // Orbit starts on the way back, once it is as close as the circle.
      const radius = MOD.orbit.radius * stats.area;
      if (
        this.ctx.hasModifier('orbit') &&
        !f.orbitDone &&
        f.phase > Math.PI * 1.3 &&
        Math.hypot(img.x - player.x, img.y - player.y) <= radius
      ) {
        f.orbiting = true;
        f.orbitDone = true;
        f.orbitTurned = 0;
        f.orbitAngle = Math.atan2(img.y - player.y, img.x - player.x);
        f.hitsOut.clear();
      }
      if (holding) {
        img.rotation += spin * TAU * dt * f.side;
        return;
      }
    }
    img.rotation += spin * TAU * dt * f.side;
    this.dropEmbers(f, stats, reach, prevX, prevY);

    const back = !f.orbiting && f.phase >= Math.PI;
    const hits = back ? f.hitsBack : f.hitsOut;
    const pull = back && this.ctx.hasModifier('pull');
    const fx = pull
      ? { ...this.effects, knockback: Math.max(this.effects.knockback ?? 0, MOD.pull.speed) }
      : this.effects;
    for (const e of this.ctx.enemies.active()) {
      if (e.airborne || !this.touches(e, img, reach) || !this.mayHit(hits, e)) continue;
      // Pushed the way it flies; Undertow drags towards the player instead.
      const fromX = pull ? e.x + (e.x - player.x) : prevX;
      const fromY = pull ? e.y + (e.y - player.y) : prevY;
      this.ctx.enemies.hit(e, stats.damage, fx, fromX, fromY);
    }
  }

  /** Whirl: at the turn it stops and spins, hitting everything near every few moments. True while it holds. */
  private updateWhirl(f: Flight, stats: WeaponStats, reach: number, dms: number): boolean {
    if (!this.ctx.hasModifier('whirl')) return false;
    if (f.holdLeft < 0) {
      if (f.phase < Math.PI) return false;
      f.phase = Math.PI;
      f.holdLeft = MOD.whirl.holdMs;
      f.tickLeft = 0;
    }
    if (f.holdLeft === 0) return false;
    f.holdLeft = Math.max(0, f.holdLeft - dms);
    f.tickLeft -= dms;
    if (f.tickLeft <= 0) {
      f.tickLeft = MOD.whirl.tickMs;
      for (const e of this.ctx.enemies.active()) {
        if (e.airborne || !this.touches(e, f.image, reach * 1.3)) continue;
        this.ctx.enemies.hit(e, stats.damage, this.effects, f.image.x, f.image.y);
      }
    }
    // The way back starts fresh, so everything can be hit once more.
    if (f.holdLeft === 0) f.phase = Math.PI + 0.0001;
    return f.holdLeft > 0;
  }

  private touches(e: Enemy, img: Phaser.GameObjects.Image, reach: number): boolean {
    const r = reach + e.def.radius;
    return (e.x - img.x) ** 2 + (e.y - img.y) ** 2 <= r * r;
  }

  /** Each enemy can be hit once per way; Keen Edge allows a second hit a moment later. Records the hit. */
  private mayHit(hits: Hits, e: Enemy): boolean {
    const now = this.ctx.now();
    const max = this.ctx.hasModifier('keen') ? MOD.keen.hits : 1;
    const rec = hits.get(e);
    if (rec && (rec.n >= max || now - rec.at < MOD.keen.gapMs)) return false;
    hits.set(e, { n: (rec?.n ?? 0) + 1, at: now });
    return true;
  }

  private catch(f: Flight): void {
    f.flying = false;
    f.image.setVisible(false);
  }

  /** Ember Trail: drops an ember every few steps along the way. */
  private dropEmbers(f: Flight, stats: WeaponStats, reach: number, prevX: number, prevY: number): void {
    if (!this.ctx.hasModifier('embertrail')) return;
    f.trail += Math.hypot(f.image.x - prevX, f.image.y - prevY);
    if (f.trail < MOD.trail.step) return;
    f.trail = 0;
    const ember = this.embers.find((e) => e.until === 0);
    if (!ember) return;
    const now = this.ctx.now();
    ember.until = now + MOD.trail.ms;
    ember.nextTick = now;
    ember.damage = stats.damage * MOD.trail.share;
    ember.radius = MOD.trail.radius * (reach / BOOMERANG_REACH);
    ember.image
      .setPosition(f.image.x, f.image.y)
      .setScale(ember.radius / 8)
      .setAlpha(EMBER_ALPHA)
      .setVisible(true);
  }

  /** Embers burn what stands in them every few moments and fade out. */
  private burnEmbers(): void {
    const now = this.ctx.now();
    for (const em of this.embers) {
      if (em.until === 0) continue;
      if (now >= em.until) {
        em.until = 0;
        em.image.setVisible(false);
        continue;
      }
      em.image.setAlpha(EMBER_ALPHA * Math.min(1, (em.until - now) / 400));
      if (now < em.nextTick) continue;
      em.nextTick = now + MOD.trail.tickMs;
      for (const e of this.ctx.enemies.active()) {
        if (e.airborne) continue;
        const r = em.radius + e.def.radius;
        if ((e.x - em.image.x) ** 2 + (e.y - em.image.y) ** 2 > r * r) continue;
        this.ctx.enemies.hit(e, em.damage, {}, em.image.x, em.image.y);
      }
    }
  }
}
