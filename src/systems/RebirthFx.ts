import * as Phaser from 'phaser';
import { rebirthFrame, type RebirthFrame } from '../logic/rebirth';

/** Flames shot up per second at the peak of the fire */
const FLAMES_PER_SEC = 30;
const SPARKS_IN_BURST = 28;
/** Wisps of smoke and falling embers per second while he smoulders */
const SMOKE_PER_SEC = 7;
const EMBERS_PER_SEC = 4;

/**
 * The fire in the Nest when the watchman wakes up: a soft burst of flames and sparks with a warm glow, and the
 * smoke and embers that still come off him while he staggers out. It only draws; the timeline is
 * logic/rebirth.ts, and the scene shows the watchman and lights the night.
 */
export class RebirthFx {
  private readonly flames: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly glow: Phaser.GameObjects.Image;
  private carryFlames = 0;
  private carrySmoke = 0;
  private carryEmbers = 0;
  private burst = false;
  private frame: RebirthFrame = rebirthFrame(0);

  constructor(
    scene: Phaser.Scene,
    /** Where the fire burst stands (the Nest's flame) */
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
        scale: { start: 0.26, end: 0 },
        alpha: { start: 0.2, end: 0 },
        tint: [0xffd890, 0xffa850, 0xff7a30],
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
    // He smoulders: grey wisps rise from him, and now and then a glowing ember drops off.
    this.smoke = scene.add
      .particles(0, 0, 'light', {
        emitting: false,
        speedY: { min: -26, max: -12 },
        speedX: { min: -6, max: 6 },
        lifespan: { min: 900, max: 1500 },
        scale: { start: 0.05, end: 0.2 },
        alpha: { start: 0.22, end: 0 },
        tint: 0x8a8494,
      })
      .setDepth(depth + 0.02);
    this.embers = scene.add
      .particles(0, 0, 'light', {
        emitting: false,
        speedY: { min: 4, max: 22 },
        speedX: { min: -10, max: 10 },
        lifespan: { min: 600, max: 1100 },
        scale: { start: 0.05, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffc060, 0xff8a30],
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(depth + 0.02);
    this.glow = scene.add
      .image(x, y - 14, 'light')
      .setTint(0xffa860)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth - 0.01)
      .setAlpha(0);
  }

  /** `elapsedMs` since the village appeared; `at` is where the watchman is now (smoke and embers come off him). */
  update(elapsedMs: number, dtSec: number, at: { x: number; y: number }): RebirthFrame {
    const f = rebirthFrame(elapsedMs);
    this.frame = f;
    if (f.fire > 0.05 && !this.burst) {
      this.burst = true;
      this.sparks.emitParticleAt(this.x, this.y - 8, SPARKS_IN_BURST);
    }
    this.carryFlames += f.fire * FLAMES_PER_SEC * dtSec;
    const n = Math.floor(this.carryFlames);
    this.carryFlames -= n;
    for (let i = 0; i < n; i++) {
      this.flames.emitParticleAt(this.x + (Math.random() - 0.5) * 14, this.y - 4 - Math.random() * 6, 1);
    }
    // Smouldering while he is there, less and less once he has left the flames and cooled.
    const smoulder = f.body * (1 - 0.6 * f.walk);
    this.carrySmoke += smoulder * SMOKE_PER_SEC * dtSec;
    const s = Math.floor(this.carrySmoke);
    this.carrySmoke -= s;
    for (let i = 0; i < s; i++) {
      this.smoke.emitParticleAt(at.x + (Math.random() - 0.5) * 10, at.y - 8 - Math.random() * 10, 1);
    }
    this.carryEmbers += smoulder * EMBERS_PER_SEC * dtSec;
    const e = Math.floor(this.carryEmbers);
    this.carryEmbers -= e;
    for (let i = 0; i < e; i++) {
      this.embers.emitParticleAt(at.x + (Math.random() - 0.5) * 12, at.y + Math.random() * 10, 1);
    }
    const size = 44 + 80 * f.fire;
    this.glow.setDisplaySize(size, size).setAlpha(0.12 * f.fire);
    return f;
  }

  /** A pool of firelight for the night layer, or null when the fire is out. */
  light(): { x: number; y: number; radius: number; strength: number } | null {
    const f = this.frame.fire;
    if (f <= 0.01) return null;
    return { x: this.x, y: this.y - 10, radius: 44 + 96 * f, strength: 0.45 * f };
  }

  destroy(): void {
    this.flames.destroy();
    this.sparks.destroy();
    this.smoke.destroy();
    this.embers.destroy();
    this.glow.destroy();
  }
}
