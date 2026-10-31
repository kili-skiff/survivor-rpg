import * as Phaser from 'phaser';
import { CHAIN } from '../config/balance';

/** Bolts shown at once; when there are more, the oldest one is reused */
const MAX_BOLTS = 40;
/** A jagged segment is split into pieces about this long (px) */
const PIECE = 26;
/** How far the pieces zigzag off the straight line (px) */
const JAG = 9;

interface Bolt {
  /** x, y, x, y ... of the zigzag line; reused, so a bolt allocates nothing once it has grown */
  pts: number[];
  at: number;
}

/**
 * The flash of Chain Lightning: a zigzag line through all points of a strike. All bolts are drawn
 * on one graphics object and kept in a fixed pool.
 */
export class LightningFx {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly bolts: Bolt[] = Array.from({ length: MAX_BOLTS }, () => ({ pts: [], at: -1e9 }));
  private next = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly now: () => number,
    private readonly color: number,
  ) {
    this.graphics = scene.add.graphics().setDepth(4.6);
  }

  /** `path` is x, y, x, y ... of the points the strike passes through. */
  add(path: readonly number[]): void {
    const b = this.bolts[this.next];
    this.next = (this.next + 1) % MAX_BOLTS;
    b.at = this.now();
    const pts = b.pts;
    pts.length = 0;
    pts.push(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) {
      const x0 = path[i - 2];
      const y0 = path[i - 1];
      const dx = path[i] - x0;
      const dy = path[i + 1] - y0;
      const len = Math.hypot(dx, dy);
      const pieces = Math.max(1, Math.round(len / PIECE));
      // Normal of the segment, to push the middle points sideways.
      const nx = len > 0 ? -dy / len : 0;
      const ny = len > 0 ? dx / len : 0;
      for (let k = 1; k < pieces; k++) {
        const t = k / pieces;
        const off = (Math.random() - 0.5) * 2 * JAG;
        pts.push(x0 + dx * t + nx * off, y0 + dy * t + ny * off);
      }
      pts.push(path[i], path[i + 1]);
    }
  }

  update(): void {
    const g = this.graphics;
    g.clear();
    const now = this.now();
    for (const b of this.bolts) {
      const t = (now - b.at) / CHAIN.fxMs;
      if (t < 0 || t >= 1 || b.pts.length < 4) continue;
      const a = 1 - t;
      this.stroke(b.pts, 5, this.color, 0.35 * a);
      this.stroke(b.pts, 2, 0xffffff, 0.95 * a);
    }
  }

  private stroke(pts: number[], width: number, color: number, alpha: number): void {
    const g = this.graphics;
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.strokePath();
  }
}
