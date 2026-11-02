import * as Phaser from 'phaser';
import { rebirthFrame, type RebirthFrame } from '../logic/rebirth';

/** Flames shot up per second at the peak of the fire */
const FLAMES_PER_SEC = 50;
const SPARKS_IN_BURST = 36;

/**
 * The burst of fire in the Nest when the watchman wakes up: a column of flames and sparks with a warm glow.
 * It only draws; the timeline is logic/rebirth.ts, and the scene shows the watchman and lights the night.
 */
export class RebirthFx {
  private readonly flames: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly glow: Phaser.GameObjects.Image;
  private carry = 0;
  private burst = false;
  private frame: RebirthFrame = rebirthFrame(0);

  constructor(
    scene: Phaser.Scene,
    /** The watchman's feet */
    private readonly x: number,
    private readonly y: number,
    depth: number,
  ) {
    this.flames = scene.add
      .particles(0, 0, 'light', {
        emitting: false,
        speedY: { min: -170, max: -90 },
        speedX: { min: -26, max: 26 },
        lifespan: { min: 520, max: 950 },
        scale: { start: 0.34, end: 0 },
        alpha: { start: 0.42, end: 0 },
        tint: [0xffd070, 0xff9a38, 0xff6a20],
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(depth);
    this.sparks = scene.add
      .particles(0, 0, 'light', {
        emitting: false,
        speed: { min: 50, max: 160 },
        angle: { min: 215, max: 325 },
        gravityY: 60,
        lifespan: { min: 700, max: 1400 },
        scale: { start: 0.09, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xfff0b0, 0xffc060, 0xff8a30],
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(depth + 0.01);
    this.glow = scene.add
      .image(x, y - 14, 'light')
      .setTint(0xff9040)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth - 0.01)
      .setAlpha(0);
  }

  /** `elapsedMs` since the village appeared; returns the frame of the timeline. */
  update(elapsedMs: number, dtSec: number): RebirthFrame {
    const f = rebirthFrame(elapsedMs);
    this.frame = f;
    if (f.fire > 0.05 && !this.burst) {
      this.burst = true;
      this.sparks.emitParticleAt(this.x, this.y - 8, SPARKS_IN_BURST);
    }
    this.carry += f.fire * FLAMES_PER_SEC * dtSec;
    const n = Math.floor(this.carry);
    this.carry -= n;
    for (let i = 0; i < n; i++) {
      this.flames.emitParticleAt(this.x + (Math.random() - 0.5) * 14, this.y - 4 - Math.random() * 6, 1);
    }
    const size = 50 + 100 * f.fire;
    this.glow.setDisplaySize(size, size).setAlpha(0.4 * f.fire);
    return f;
  }

  /** A pool of firelight for the night layer, or null when the fire is out. */
  light(): { x: number; y: number; radius: number; strength: number } | null {
    const f = this.frame.fire;
    if (f <= 0.01) return null;
    return { x: this.x, y: this.y - 10, radius: 50 + 130 * f, strength: f };
  }

  destroy(): void {
    this.flames.destroy();
    this.sparks.destroy();
    this.glow.destroy();
  }
}
