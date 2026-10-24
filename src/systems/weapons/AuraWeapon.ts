import * as Phaser from 'phaser';
import type { WeaponStats } from '../../config/types';
import { AURA_BASE_RADIUS } from '../../config/weapons';
import type { CombatContext } from '../CombatContext';
import { FIRST_SHOT_DELAY, type Weapon } from './Weapon';

/** Size of the aura texture in px */
const TEXTURE_SIZE = 128;

/** Ember aura: damages every enemy around the player at a fixed interval. */
export class AuraWeapon implements Weapon {
  private readonly image: Phaser.GameObjects.Image;
  private timer = FIRST_SHOT_DELAY;

  constructor(private readonly ctx: CombatContext) {
    this.image = ctx.scene.add.image(0, 0, 'aura').setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
  }

  update(stats: WeaponStats, dms: number): void {
    const { player, enemies } = this.ctx;
    const radius = AURA_BASE_RADIUS * stats.area;
    const pulse = 1 + Math.sin(this.ctx.now() / 180) * 0.03;
    this.image.setPosition(player.x, player.y).setScale(((radius * 2) / TEXTURE_SIZE) * pulse);

    this.timer -= dms;
    if (this.timer > 0) return;
    this.timer = stats.cooldown;
    for (const e of enemies.active()) {
      const r = radius + e.def.radius;
      if ((e.x - player.x) ** 2 + (e.y - player.y) ** 2 <= r * r) enemies.damage(e, stats.damage);
    }
  }
}
