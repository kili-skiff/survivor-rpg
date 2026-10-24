import * as Phaser from 'phaser';
import type { SkillStats } from '../../config/types';
import { COLORS } from '../../ui/theme';
import type { CombatContext } from '../CombatContext';

/** Size of the ring texture's visible circle in px */
const RING_SIZE = 120;
const KNOCKBACK = 14;

/** Frost Nova: damages and slows every enemy around the player. */
export function castFrostNova(ctx: CombatContext, stats: SkillStats): void {
  const { scene, player, enemies } = ctx;
  const now = ctx.now();
  const { x, y } = player;

  for (const e of enemies.active()) {
    if (Phaser.Math.Distance.Between(x, y, e.x, e.y) <= stats.radius + e.def.radius) {
      e.slowUntil = now + stats.duration;
      e.slowFactor = 1 - stats.slow;
      const a = Math.atan2(e.y - y, e.x - x);
      enemies.damage(e, stats.damage, Math.cos(a) * KNOCKBACK, Math.sin(a) * KNOCKBACK);
    }
  }

  const ring = scene.add.image(x, y, 'ring').setTint(COLORS.nova).setDepth(5).setScale(0.15);
  scene.tweens.add({
    targets: ring,
    scale: (stats.radius * 2) / RING_SIZE,
    alpha: 0,
    duration: 380,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });
  scene.cameras.main.shake(90, 0.003);
}
