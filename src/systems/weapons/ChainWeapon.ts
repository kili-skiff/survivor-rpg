import { CHAIN } from '../../config/balance';
import type { WeaponStats } from '../../config/types';
import type { Enemy } from '../../entities/Enemy';
import { buildChain, chainDamage, pickChainStart, type ChainTarget } from '../../logic/chain';
import type { HitEffects } from '../../logic/hitEffects';
import { COLORS } from '../../ui/theme';
import type { CombatContext } from '../CombatContext';
import { LightningFx } from '../LightningFx';
import { FIRST_SHOT_DELAY, type Weapon } from './Weapon';

/** Chain Lightning: strikes an enemy and jumps on to the ones around it. */
export class ChainWeapon implements Weapon {
  private timer = FIRST_SHOT_DELAY;
  private readonly fx: LightningFx;
  /** What a hit does besides damage; follows the weapon's level */
  private readonly effects: HitEffects = {};
  /** Reused every strike */
  private readonly path: number[] = [];

  constructor(private readonly ctx: CombatContext) {
    this.fx = new LightningFx(ctx.scene, () => ctx.now(), COLORS.chain);
  }

  update(stats: WeaponStats, dms: number): void {
    this.fx.update();
    this.timer -= dms;
    if (this.timer > 0) return;

    const { player, enemies } = this.ctx;
    this.effects.knockback = stats.knockback;
    this.effects.splash = stats.splash;
    this.effects.percent = stats.percent;

    const reach = Math.min(CHAIN.range * stats.area, this.ctx.visionRange());
    const list: Enemy[] = [];
    const targets: ChainTarget[] = [];
    for (const e of enemies.active()) {
      if (e.airborne) continue;
      // Everything that can be jumped to, not only what the first strike can reach.
      list.push(e);
      targets.push({ id: targets.length, x: e.x, y: e.y, r: e.def.radius });
    }

    const taken = new Set<number>();
    let struck = 0;
    for (let s = 0; s < stats.count; s++) {
      const start = pickChainStart(targets, player.x, player.y, reach, stats.seek, CHAIN.crowdRadius, taken);
      if (!start) break;
      const chain = buildChain(start, targets, stats.chains, CHAIN.jumpRange * stats.area);
      this.path.length = 0;
      this.path.push(player.x, player.y);
      let fromX = player.x;
      let fromY = player.y;
      for (let i = 0; i < chain.length; i++) {
        const t = chain[i];
        taken.add(t.id);
        this.path.push(t.x, t.y);
        enemies.hit(list[t.id], chainDamage(stats.damage, i, CHAIN.falloff), this.effects, fromX, fromY);
        fromX = t.x;
        fromY = t.y;
      }
      this.fx.add(this.path);
      struck += 1;
    }
    // Nothing in reach: look again next frame instead of waiting a full cooldown.
    this.timer = struck > 0 ? stats.cooldown : 0;
  }
}
