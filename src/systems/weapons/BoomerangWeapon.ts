import * as Phaser from 'phaser';
import type { WeaponStats } from '../../config/types';
import { BOOMERANG_CURVE, BOOMERANG_RANGE, BOOMERANG_REACH } from '../../config/weapons';
import type { Enemy } from '../../entities/Enemy';
import type { HitEffects } from '../../logic/hitEffects';
import type { CombatContext } from '../CombatContext';
import { FIRST_SHOT_DELAY, type Weapon } from './Weapon';

/** Boomerangs in the air at once; when all are flying, the next throw waits */
const POOL = 12;
/** Angle between boomerangs thrown together (radians) */
const SPREAD = 0.3;
/** Turns per second while flying */
const SPIN = 3;
const TAU = Math.PI * 2;

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
  /** Enemies already hit on the way out and on the way back: each can be hit once per way */
  hitsOut: Set<Enemy>;
  hitsBack: Set<Enemy>;
}

/**
 * Boomerang (a main weapon): thrown at the nearest enemy, it flies a wide loop, out on one side and
 * back on the other, and is caught by the player, hitting everything on both ways.
 */
export class BoomerangWeapon implements Weapon {
  private readonly flights: Flight[];
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
      hitsOut: new Set<Enemy>(),
      hitsBack: new Set<Enemy>(),
    }));
  }

  update(stats: WeaponStats, dms: number, dt: number): void {
    this.effects.knockback = stats.knockback;
    this.effects.splash = stats.splash;
    this.effects.percent = stats.percent;
    const range = BOOMERANG_RANGE * stats.area;
    const reach = BOOMERANG_REACH * stats.area;
    for (const f of this.flights) if (f.flying) this.fly(f, stats, range, reach, dt);

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
      this.launch(f, angle, this.nextSide);
      this.nextSide = -this.nextSide;
    }
    this.timer = stats.cooldown;
  }

  clear(): void {
    for (const f of this.flights) {
      f.flying = false;
      f.image.setVisible(false);
    }
  }

  private launch(f: Flight, angle: number, side: number): void {
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
    f.hitsOut.clear();
    f.hitsBack.clear();
    f.image.setPosition(player.x, player.y).setVisible(true);
  }

  private fly(f: Flight, stats: WeaponStats, range: number, reach: number, dt: number): void {
    const { player, enemies } = this.ctx;
    const img = f.image;
    // The loop is an ellipse: half the range long, `width` to the side.
    const a = range / 2;
    const b = range * BOOMERANG_CURVE.width;
    const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    f.phase += (TAU * stats.speed * dt) / perimeter;
    if (f.phase >= TAU) {
      f.flying = false;
      img.setVisible(false);
      return;
    }
    // The start of the loop slides from the throw point to the player, so it comes back to them.
    const t = f.phase / TAU;
    const ox = f.fromX + (player.x - f.fromX) * t;
    const oy = f.fromY + (player.y - f.fromY) * t;
    const along = a * (1 - Math.cos(f.phase));
    const across = b * Math.sin(f.phase) * f.side;
    const x = ox + f.dirX * along - f.dirY * across;
    const y = oy + f.dirY * along + f.dirX * across;
    const prevX = img.x;
    const prevY = img.y;
    img.setPosition(x, y);
    img.rotation += SPIN * TAU * dt * f.side;

    const hits = f.phase < Math.PI ? f.hitsOut : f.hitsBack;
    for (const e of enemies.active()) {
      if (e.airborne || hits.has(e)) continue;
      const r = reach + e.def.radius;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 > r * r) continue;
      hits.add(e);
      // Pushed the way it flies.
      enemies.hit(e, stats.damage, this.effects, prevX, prevY);
    }
  }
}
