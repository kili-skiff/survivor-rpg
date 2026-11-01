import * as Phaser from 'phaser';
import type { WeaponStats } from '../../config/types';
import { BOOMERANG_RANGE, BOOMERANG_REACH } from '../../config/weapons';
import type { Enemy } from '../../entities/Enemy';
import type { HitEffects } from '../../logic/hitEffects';
import type { CombatContext } from '../CombatContext';
import { FIRST_SHOT_DELAY, type Weapon } from './Weapon';

/** Boomerangs in the air at once; when all are flying, the next throw waits */
const POOL = 12;
/** Angle between boomerangs thrown together (radians) */
const SPREAD = 0.3;
/** On the way back it flies this much faster, so it does not trail behind a running player */
const RETURN_SPEED = 1.25;
/** It is caught when it comes this close to the player (px) */
const CATCH = 22;
/** Turns per second while flying */
const SPIN = 3;

interface Flight {
  image: Phaser.GameObjects.Image;
  flying: boolean;
  /** Direction of the way out (unit vector) */
  dirX: number;
  dirY: number;
  outbound: boolean;
  travelled: number;
  /** Enemies already hit on the way out and on the way back: each can be hit once per way */
  hitsOut: Set<Enemy>;
  hitsBack: Set<Enemy>;
}

/**
 * Boomerang (a main weapon): thrown at the nearest enemy, it flies out a fixed distance and comes back
 * to the player, hitting everything on both ways, also behind the player.
 */
export class BoomerangWeapon implements Weapon {
  private readonly flights: Flight[];
  private timer = FIRST_SHOT_DELAY;
  /** What a hit does besides damage; follows the weapon's level */
  private readonly effects: HitEffects = {};

  constructor(private readonly ctx: CombatContext) {
    this.flights = Array.from({ length: POOL }, () => ({
      image: ctx.scene.add.image(0, 0, 'boomerang').setDepth(4).setVisible(false),
      flying: false,
      dirX: 1,
      dirY: 0,
      outbound: true,
      travelled: 0,
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
    const targets = enemies.nearest(stats.count, Math.min(range * 1.4, this.ctx.visionRange()));
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
      this.launch(f, angle);
    }
    this.timer = stats.cooldown;
  }

  private launch(f: Flight, angle: number): void {
    const { player } = this.ctx;
    f.flying = true;
    f.outbound = true;
    f.travelled = 0;
    f.dirX = Math.cos(angle);
    f.dirY = Math.sin(angle);
    f.hitsOut.clear();
    f.hitsBack.clear();
    f.image.setPosition(player.x, player.y).setVisible(true);
  }

  private fly(f: Flight, stats: WeaponStats, range: number, reach: number, dt: number): void {
    const { player, enemies } = this.ctx;
    const img = f.image;
    let vx: number;
    let vy: number;
    if (f.outbound) {
      vx = f.dirX * stats.speed;
      vy = f.dirY * stats.speed;
      f.travelled += stats.speed * dt;
      if (f.travelled >= range) f.outbound = false;
    } else {
      // Back to the player, wherever they are now.
      const dx = player.x - img.x;
      const dy = player.y - img.y;
      const d = Math.hypot(dx, dy);
      if (d <= CATCH) {
        f.flying = false;
        img.setVisible(false);
        return;
      }
      const speed = stats.speed * RETURN_SPEED;
      vx = (dx / d) * speed;
      vy = (dy / d) * speed;
    }
    img.x += vx * dt;
    img.y += vy * dt;
    img.rotation += SPIN * Math.PI * 2 * dt;

    const hits = f.outbound ? f.hitsOut : f.hitsBack;
    for (const e of enemies.active()) {
      if (e.airborne || hits.has(e)) continue;
      const r = reach + e.def.radius;
      if ((e.x - img.x) ** 2 + (e.y - img.y) ** 2 > r * r) continue;
      hits.add(e);
      // Pushed the way it flies.
      enemies.hit(e, stats.damage, this.effects, img.x - vx, img.y - vy);
    }
  }
}
