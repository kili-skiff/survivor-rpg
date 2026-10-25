import * as Phaser from 'phaser';
import { HERB_RULES, HERBS } from '../config/herbs';
import type { HerbId } from '../config/types';
import type { Loot } from '../logic/expedition';
import { advanceGather, type HerbSpot } from '../logic/herbs';
import type { DamageNumbers } from './DamageNumbers';

interface Target {
  x: number;
  y: number;
}

interface GrowingHerb {
  spot: HerbSpot;
  image: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image | null;
  progress: number;
  gathered: boolean;
}

/** Edge-arrow information for the HUD: direction from the player and distance beyond the screen edge (world px). */
export interface HerbIndicator {
  angle: number;
  distance: number;
  color: number;
  rare: boolean;
}

/**
 * Herbs growing in the current hex. Stand next to one to gather it; moving away or taking a hit
 * resets the progress. Nothing grows back during the fight.
 */
export class HerbSystem {
  private readonly herbs: GrowingHerb[] = [];
  private readonly ring: Phaser.GameObjects.Graphics;
  private gatheredLoot: Loot = {};

  constructor(
    scene: Phaser.Scene,
    spots: HerbSpot[],
    private readonly target: Target,
    private readonly numbers: DamageNumbers,
  ) {
    for (const spot of spots) {
      const def = HERBS[spot.herb];
      const glow = def.rare
        ? scene.add
            .image(spot.x, spot.y, 'herb-glow')
            .setTint(def.color)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(0.5)
        : null;
      const image = scene.add.image(spot.x, spot.y, 'herb').setTint(def.color).setDepth(0.6);
      this.herbs.push({ spot, image, glow, progress: 0, gathered: false });
    }
    this.ring = scene.add.graphics().setDepth(6);
  }

  /** Herbs gathered in this fight, by id. */
  get loot(): Loot {
    return this.gatheredLoot;
  }

  get gatheredCount(): number {
    return Object.values(this.gatheredLoot).reduce((a, b) => a + b, 0);
  }

  get totalCount(): number {
    return this.herbs.length;
  }

  /** Taking a hit breaks your concentration. */
  interrupt(): void {
    for (const h of this.herbs) h.progress = 0;
  }

  update(dt: number, time: number): void {
    this.ring.clear();
    for (const h of this.herbs) {
      if (h.gathered) continue;
      const sway = Math.sin(time * 2 + h.spot.x * 0.01) * 0.08;
      h.image.setRotation(sway);
      h.glow?.setAlpha(0.55 + Math.sin(time * 3 + h.spot.y) * 0.25);

      const inRange =
        Math.hypot(this.target.x - h.spot.x, this.target.y - h.spot.y) <= HERB_RULES.gatherRadius;
      h.progress = advanceGather(h.progress, inRange, dt);
      if (h.progress > 0) this.drawProgress(h);
      if (h.progress >= 1) this.gather(h);
    }
  }

  /** Herbs off screen but within reveal distance, for the edge arrows. */
  indicators(viewW: number, viewH: number): HerbIndicator[] {
    const out: HerbIndicator[] = [];
    for (const h of this.herbs) {
      if (h.gathered) continue;
      const dx = h.spot.x - this.target.x;
      const dy = h.spot.y - this.target.y;
      // How far the herb lies outside the visible area (0 when on screen).
      const outX = Math.max(0, Math.abs(dx) - (viewW / 2 - 20));
      const outY = Math.max(0, Math.abs(dy) - (viewH / 2 - 20));
      const distance = Math.hypot(outX, outY);
      if (distance === 0 || distance > HERB_RULES.revealBeyondScreen) continue;
      const def = HERBS[h.spot.herb];
      out.push({ angle: Math.atan2(dy, dx), distance, color: def.color, rare: def.rare });
    }
    return out;
  }

  private drawProgress(h: GrowingHerb): void {
    const { x, y } = h.spot;
    const r = 28;
    this.ring.lineStyle(6, 0x000000, 0.5).strokeCircle(x, y, r);
    this.ring.lineStyle(4, HERBS[h.spot.herb].color, 1);
    this.ring.beginPath();
    this.ring.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + h.progress * Math.PI * 2, false);
    this.ring.strokePath();
  }

  private gather(h: GrowingHerb): void {
    h.gathered = true;
    h.image.setVisible(false);
    h.glow?.setVisible(false);
    const id: HerbId = h.spot.herb;
    this.gatheredLoot = { ...this.gatheredLoot, [id]: (this.gatheredLoot[id] ?? 0) + 1 };
    const def = HERBS[id];
    this.numbers.show(h.spot.x, h.spot.y - 20, `+1 ${def.name}`, '#bbf7d0', true);
  }
}
