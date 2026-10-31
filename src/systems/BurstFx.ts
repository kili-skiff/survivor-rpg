import * as Phaser from 'phaser';
import { HIT_EFFECTS } from '../config/balance';

/** Rings shown at once; when there are more, the oldest one is reused */
const MAX_BURSTS = 32;

interface Burst {
  x: number;
  y: number;
  radius: number;
  at: number;
}

/**
 * The expanding ring of a burst (e.g. an exploding bolt). All rings are drawn on one graphics object
 * and kept in a fixed pool, so many bursts per second create no objects.
 */
export class BurstFx {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly bursts: Burst[] = Array.from({ length: MAX_BURSTS }, () => ({
    x: 0,
    y: 0,
    radius: 0,
    at: -1e9,
  }));
  private next = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly now: () => number,
    private readonly color: number,
  ) {
    this.graphics = scene.add.graphics().setDepth(4.5);
  }

  add(x: number, y: number, radius: number): void {
    const b = this.bursts[this.next];
    this.next = (this.next + 1) % MAX_BURSTS;
    b.x = x;
    b.y = y;
    b.radius = radius;
    b.at = this.now();
  }

  update(): void {
    const g = this.graphics;
    g.clear();
    const now = this.now();
    for (const b of this.bursts) {
      const t = (now - b.at) / HIT_EFFECTS.burstFxMs;
      if (t < 0 || t >= 1) continue;
      const r = b.radius * (0.55 + 0.45 * t);
      g.fillStyle(this.color, 0.22 * (1 - t)).fillCircle(b.x, b.y, r);
      g.lineStyle(3, this.color, 0.8 * (1 - t)).strokeCircle(b.x, b.y, r);
    }
  }
}
