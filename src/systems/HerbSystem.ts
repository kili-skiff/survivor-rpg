import * as Phaser from 'phaser';
import { HERB_RULES, HERBS } from '../config/herbs';
import type { HerbId } from '../config/types';
import type { Loot } from '../logic/expedition';
import { advanceGather, bloomPosition, progressAfterHit, type HerbBloom } from '../logic/herbs';
import type { DamageNumbers } from './DamageNumbers';

interface Target {
  x: number;
  y: number;
}

interface GrowingHerb {
  herb: HerbId;
  x: number;
  y: number;
  image: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image | null;
  progress: number;
  gathered: boolean;
}

/** Edge-arrow information for the HUD: direction from the player and distance beyond the screen edge. */
export interface HerbIndicator {
  angle: number;
  distance: number;
  color: number;
  rare: boolean;
}

/**
 * Herbs in the current hex. They bloom one by one at planned, randomised moments just off screen
 * around the player. Stand next to one to gather it; moving away resets the progress, a hit halves it.
 * Nothing grows back during the fight.
 */
export class HerbSystem {
  private readonly herbs: GrowingHerb[] = [];
  private readonly pending: HerbBloom[];
  private readonly ring: Phaser.GameObjects.Graphics;
  private gatheredLoot: Loot = {};

  constructor(
    private readonly scene: Phaser.Scene,
    blooms: HerbBloom[],
    private readonly target: Target,
    private readonly numbers: DamageNumbers,
    /** Called when a herb blooms, e.g. for a HUD hint */
    private readonly onBloom: (herb: HerbId) => void,
  ) {
    this.pending = [...blooms].sort((a, b) => a.atSec - b.atSec);
    this.ring = scene.add.graphics().setDepth(6);
  }

  /** Herbs gathered in this fight, by id. */
  get loot(): Loot {
    return this.gatheredLoot;
  }

  get gatheredCount(): number {
    return Object.values(this.gatheredLoot).reduce((a, b) => a + b, 0);
  }

  /** All herbs of this fight, including those that have not bloomed yet. */
  get totalCount(): number {
    return this.herbs.length + this.pending.length;
  }

  /** Taking a hit breaks your concentration. */
  interrupt(): void {
    for (const h of this.herbs) h.progress = progressAfterHit(h.progress);
  }

  /** `runTime` is the segment time in seconds; `viewW`/`viewH` the visible world area. */
  update(dt: number, runTime: number, viewW: number, viewH: number): void {
    while (this.pending.length > 0 && this.pending[0].atSec <= runTime) {
      this.bloom(this.pending.shift()!, viewW, viewH);
    }

    this.ring.clear();
    for (const h of this.herbs) {
      if (h.gathered) continue;
      h.image.setRotation(Math.sin(runTime * 2 + h.x * 0.01) * 0.08);
      h.glow?.setAlpha(0.55 + Math.sin(runTime * 3 + h.y) * 0.25);

      const inRange = Math.hypot(this.target.x - h.x, this.target.y - h.y) <= HERB_RULES.gatherRadius;
      h.progress = advanceGather(h.progress, inRange, dt);
      if (h.progress > 0) this.drawProgress(h);
      if (h.progress >= 1) this.gather(h);
    }
  }

  /** Herbs off screen but close to its edge, for the edge arrows. */
  indicators(viewW: number, viewH: number): HerbIndicator[] {
    const out: HerbIndicator[] = [];
    for (const h of this.herbs) {
      if (h.gathered) continue;
      const dx = h.x - this.target.x;
      const dy = h.y - this.target.y;
      // How far the herb lies outside the visible area (0 when on screen).
      const outX = Math.max(0, Math.abs(dx) - (viewW / 2 - 20));
      const outY = Math.max(0, Math.abs(dy) - (viewH / 2 - 20));
      const distance = Math.hypot(outX, outY);
      if (distance === 0 || distance > HERB_RULES.revealBeyondScreen) continue;
      const def = HERBS[h.herb];
      out.push({ angle: Math.atan2(dy, dx), distance, color: def.color, rare: def.rare });
    }
    return out;
  }

  private bloom(b: HerbBloom, viewW: number, viewH: number): void {
    const others = this.herbs.filter((h) => !h.gathered);
    const { x, y } = bloomPosition(this.target, viewW, viewH, others, Math.random);
    const def = HERBS[b.herb];
    const glow = def.rare
      ? this.scene.add
          .image(x, y, 'herb-glow')
          .setTint(def.color)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(0.5)
      : null;
    const image = this.scene.add.image(x, y, 'herb').setTint(def.color).setDepth(0.6).setScale(0.2);
    this.scene.tweens.add({ targets: image, scale: 1, duration: 500, ease: 'Back.easeOut' });
    this.herbs.push({ herb: b.herb, x, y, image, glow, progress: 0, gathered: false });
    this.onBloom(b.herb);
  }

  private drawProgress(h: GrowingHerb): void {
    const r = 28;
    this.ring.lineStyle(6, 0x000000, 0.5).strokeCircle(h.x, h.y, r);
    this.ring.lineStyle(4, HERBS[h.herb].color, 1);
    this.ring.beginPath();
    this.ring.arc(h.x, h.y, r, -Math.PI / 2, -Math.PI / 2 + h.progress * Math.PI * 2, false);
    this.ring.strokePath();
  }

  private gather(h: GrowingHerb): void {
    h.gathered = true;
    h.image.setVisible(false);
    h.glow?.setVisible(false);
    this.gatheredLoot = { ...this.gatheredLoot, [h.herb]: (this.gatheredLoot[h.herb] ?? 0) + 1 };
    this.numbers.show(h.x, h.y - 20, `+1 ${HERBS[h.herb].name}`, '#bbf7d0', true);
  }
}
