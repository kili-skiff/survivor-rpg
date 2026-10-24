import * as Phaser from 'phaser';
import { FONT } from '../ui/theme';

const POOL_SIZE = 40;
const LIFE = 0.6;
/** Minimum time between two non-forced numbers, so heavy hits don't flood the screen */
const THROTTLE_MS = 25;

interface FloatingText {
  text: Phaser.GameObjects.Text;
  life: number;
}

/** Floating damage and heal numbers from a fixed pool of text objects. */
export class DamageNumbers {
  private readonly texts: FloatingText[] = [];
  private next = 0;
  private lastShownAt = -Infinity;

  constructor(
    scene: Phaser.Scene,
    private readonly now: () => number,
  ) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: FONT,
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(10)
        .setVisible(false);
      this.texts.push({ text, life: 0 });
    }
  }

  /** `force` bypasses the throttle, e.g. for damage the player takes. */
  show(x: number, y: number, value: string, color = '#ffffff', force = false): void {
    const now = this.now();
    if (!force && now - this.lastShownAt < THROTTLE_MS) return;
    this.lastShownAt = now;
    const ft = this.texts[this.next];
    this.next = (this.next + 1) % this.texts.length;
    ft.life = LIFE;
    ft.text
      .setText(value)
      .setColor(color)
      .setPosition(x + (Math.random() - 0.5) * 10, y)
      .setAlpha(1)
      .setVisible(true);
  }

  update(dt: number): void {
    for (const ft of this.texts) {
      if (ft.life <= 0) continue;
      ft.life -= dt;
      ft.text.y -= 34 * dt;
      ft.text.setAlpha(Math.max(0, ft.life / LIFE));
      if (ft.life <= 0) ft.text.setVisible(false);
    }
  }
}
