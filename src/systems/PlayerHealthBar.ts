import * as Phaser from 'phaser';
import { COLORS } from '../ui/theme';

/** Bar size in world pixels */
const WIDTH = 26;
const HEIGHT = 4;
/** Distance from the player's centre to the bar's top edge: the feet reach 31 px down, so this is just below them */
const OFFSET_Y = 35;
/** Above the player and the lantern, below the darkness */
const DEPTH = 3.2;

/** A small health bar under the player's feet. Redrawn every frame; one Graphics object. */
export class PlayerHealthBar {
  private readonly g: Phaser.GameObjects.Graphics;
  private enabled = true;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH);
  }

  /** Shows or hides the bar (a device setting). */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.g.setVisible(on);
    if (!on) this.g.clear();
  }

  /** `share` is health as 0..1; the bar is centred below (x, y). */
  update(x: number, y: number, share: number): void {
    if (!this.enabled) return;
    // Whole pixels keep the edges crisp while the player moves.
    const left = Math.round(x - WIDTH / 2);
    const top = Math.round(y + OFFSET_Y);
    const fill = Phaser.Math.Clamp(share, 0, 1);
    const g = this.g.clear();
    g.fillStyle(0x000000, 0.6).fillRect(left - 1, top - 1, WIDTH + 2, HEIGHT + 2);
    g.fillStyle(COLORS.hpBack, 1).fillRect(left, top, WIDTH, HEIGHT);
    if (fill > 0)
      g.fillStyle(COLORS.hp, 1).fillRect(left, top, Math.max(1, Math.round(WIDTH * fill)), HEIGHT);
  }
}
