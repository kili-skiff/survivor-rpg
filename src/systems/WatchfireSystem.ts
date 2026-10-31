import * as Phaser from 'phaser';
import { GOALS } from '../config/goals';
import { advanceLighting } from '../logic/goals';
import type { LightSource } from './LightingSystem';
import type { EdgeIndicator } from './HerbSystem';

/** Colour of the watchfire's glow, its arrow and its lighting ring */
const FIRE_COLOR = 0xfb923c;
/** Glow of the cold fire, so it can be found in the dark, and of the burning one (px) */
const COLD_GLOW = 70;
const LIT_GLOW = 320;

interface Target {
  x: number;
  y: number;
}

/**
 * The goal "find the light": a cold watchfire in the dark. It is hidden until the player has searched long
 * enough (see `place`); then standing next to it lights it bit by bit, and away from it the progress
 * drains slowly. Enemies keep coming meanwhile.
 */
export class WatchfireSystem {
  x = 0;
  y = 0;
  private readonly image: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Graphics;
  /** 0..1, 1 = burning */
  private progressValue = 0;
  private foundValue = false;

  constructor(
    scene: Phaser.Scene,
    private readonly target: Target,
  ) {
    this.image = scene.add.image(0, 0, 'watchfire-cold').setOrigin(0.5, 0.93).setDepth(1.5).setVisible(false);
    this.ring = scene.add.graphics().setDepth(6);
  }

  /** Whether the player has found it (it is in the world from then on). */
  get found(): boolean {
    return this.foundValue;
  }

  /** The search is over: the fire stands at (x, y) from now on. */
  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.foundValue = true;
    this.image.setPosition(x, y).setVisible(true);
  }

  get progress(): number {
    return this.progressValue;
  }

  get lit(): boolean {
    return this.progressValue >= 1;
  }

  update(dt: number): void {
    if (!this.foundValue || this.lit) return;
    const inRange = Math.hypot(this.target.x - this.x, this.target.y - this.y) <= GOALS.light.radius;
    this.progressValue = advanceLighting(this.progressValue, inRange, dt);
    this.drawRing();
    if (this.lit) this.flare();
  }

  /** Its glow for the darkness: faint while cold, so you can spot it, bright once it burns. */
  light(): LightSource | null {
    if (!this.foundValue) return null;
    return this.lit
      ? { x: this.x, y: this.y - 20, radius: LIT_GLOW, color: FIRE_COLOR }
      : {
          x: this.x,
          y: this.y - 10,
          radius: COLD_GLOW * (1 + this.progressValue * 1.5),
          color: FIRE_COLOR,
          strength: 0.5,
        };
  }

  /** Arrow at the screen edge while it is off screen, from the moment it is found. */
  indicator(viewW: number, viewH: number): EdgeIndicator | null {
    if (!this.foundValue || this.lit) return null;
    const dx = this.x - this.target.x;
    const dy = this.y - this.target.y;
    const outX = Math.max(0, Math.abs(dx) - (viewW / 2 - 20));
    const outY = Math.max(0, Math.abs(dy) - (viewH / 2 - 20));
    const distance = Math.hypot(outX, outY);
    return distance > 0 ? { angle: Math.atan2(dy, dx), distance, color: FIRE_COLOR } : null;
  }

  private drawRing(): void {
    const g = this.ring;
    g.clear();
    const r = GOALS.light.radius;
    // The area to stand in, faint, and the progress around it.
    g.lineStyle(2, FIRE_COLOR, 0.35).strokeCircle(this.x, this.y, r);
    if (this.progressValue <= 0) return;
    g.lineStyle(7, 0x000000, 0.5).strokeCircle(this.x, this.y, r);
    g.lineStyle(5, FIRE_COLOR, 1);
    g.beginPath();
    g.arc(this.x, this.y, r, -Math.PI / 2, -Math.PI / 2 + this.progressValue * Math.PI * 2, false);
    g.strokePath();
  }

  private flare(): void {
    this.ring.clear();
    this.image.setTexture('watchfire-lit');
    const scene = this.image.scene;
    scene.tweens.add({
      targets: this.image,
      scale: { from: 1.35, to: 1 },
      duration: 450,
      ease: 'Back.easeOut',
    });
    scene.cameras.main.flash(260, 255, 190, 110);
  }
}
