import * as Phaser from 'phaser';
import type { WeaponStats } from '../../config/types';
import type { HitEffects } from '../../logic/hitEffects';
import { BLADES_BASE_RADIUS } from '../../config/weapons';
import type { CombatContext } from '../CombatContext';
import type { Weapon } from './Weapon';

/** Hit distance around a blade (added to the enemy radius) */
const BLADE_REACH = 12;

/** Blade vortex: blades orbit the player and hit everything they touch. */
export class BladesWeapon implements Weapon {
  private readonly blades: Phaser.GameObjects.Image[] = [];
  private angle = 0;
  /** What a hit does besides damage; follows the weapon's level */
  private readonly effects: HitEffects = { source: 'blades' };

  constructor(private readonly ctx: CombatContext) {}

  update(stats: WeaponStats, _dms: number, dt: number): void {
    const { scene, player, enemies } = this.ctx;
    while (this.blades.length < stats.count) {
      this.blades.push(scene.add.image(0, 0, 'blade').setDepth(4));
    }

    this.effects.knockback = stats.knockback;
    this.effects.splash = stats.splash;
    this.effects.percent = stats.percent;
    const radius = BLADES_BASE_RADIUS * stats.area;
    this.angle += Phaser.Math.DegToRad(stats.speed) * dt;
    const { x: px, y: py } = player;
    for (let i = 0; i < this.blades.length; i++) {
      const a = this.angle + (i / this.blades.length) * Math.PI * 2;
      this.blades[i].setPosition(px + Math.cos(a) * radius, py + Math.sin(a) * radius);
      this.blades[i].setRotation(a + Math.PI / 2);
    }

    // `cooldown` is how often the blades may hit the same enemy.
    const now = this.ctx.now();
    for (const e of enemies.active()) {
      if (now - e.lastBladeHit < stats.cooldown) continue;
      const reach = e.def.radius + BLADE_REACH;
      for (const blade of this.blades) {
        if (Math.abs(blade.x - e.x) < reach && Math.abs(blade.y - e.y) < reach) {
          e.lastBladeHit = now;
          enemies.hit(e, stats.damage, this.effects, px, py);
          break;
        }
      }
    }
  }
}
