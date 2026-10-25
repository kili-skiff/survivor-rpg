import * as Phaser from 'phaser';
import { LANTERN } from '../config/balance';
import { LANTERN_LOOKS, lanternLook, type LanternLook } from '../config/merchant';
import { handFor, restingLantern, stepLantern, type LanternState } from '../logic/lantern';
import type { LightSource } from './LightingSystem';
import type { PlayerController } from './PlayerController';

/** Never simulate more than this per frame (s), e.g. after the tab was in the background */
const MAX_FRAME = 0.05;

/**
 * The lantern in the watchman's hand: a sprite on a chain that swings with his movement
 * (physics in logic/lantern.ts). Its flame is also the centre of the player's light.
 */
export class LanternSystem {
  private readonly lantern: Phaser.GameObjects.Image;
  private readonly chain: Phaser.GameObjects.Graphics;
  private state: LanternState = restingLantern();
  /** Hand position relative to the character; glides to the other side when turning */
  private handX: number = LANTERN.handX;
  private handY: number = LANTERN.handY;
  private prevVx = 0;
  private prevVy = 0;
  private lit = true;
  /** World position of the flame: the centre of the player's light */
  x = 0;
  y = 0;

  private readonly look: LanternLook;

  constructor(
    scene: Phaser.Scene,
    private readonly player: PlayerController,
    /** The lantern bought in the village (0 = the old one) */
    level: number,
  ) {
    this.look = lanternLook(level);
    const key = `lantern-${Math.max(0, Math.min(level, LANTERN_LOOKS.length - 1))}`;
    this.lantern = scene.add.image(0, 0, key).setOrigin(0.5, 0.1).setScale(this.look.scale).setDepth(3.1);
    this.chain = scene.add.graphics().setDepth(3.1);
    this.x = player.x;
    this.y = player.y + LANTERN.handY + LANTERN.drop;
    this.update(0);
  }

  /** The flame goes out (the watchman has fallen). */
  snuff(): void {
    this.lit = false;
    this.lantern.setTint(0x6b6b6b);
  }

  /** The warm glow around the flame, for the lighting system. */
  light(time: number): LightSource | null {
    if (!this.lit) return null;
    const flicker = 1 + Math.sin(time * 0.017) * 0.04 + Math.sin(time * 0.041) * 0.03;
    return {
      x: this.x,
      y: this.y,
      radius: LANTERN.glowRadius * this.look.scale * flicker,
      color: this.look.glow,
      strength: LANTERN.glowStrength,
    };
  }

  update(frameSec: number): void {
    const dt = Math.min(Math.max(frameSec, 0), MAX_FRAME);
    const hand = handFor(this.player.heading());
    if (dt > 0) {
      const follow = 1 - Math.exp(-LANTERN.handFollow * dt);
      this.handX += (hand.x - this.handX) * follow;
      this.handY += (hand.y - this.handY) * follow;
      // The character's speed up or down is what makes the lantern swing.
      const v = this.player.velocity;
      this.state = stepLantern(
        this.state,
        { vx: v.x, vy: v.y, ax: (v.x - this.prevVx) / dt, ay: (v.y - this.prevVy) / dt },
        dt,
      );
      this.prevVx = v.x;
      this.prevVy = v.y;
    }

    const hx = this.player.x + this.handX;
    const hy = this.player.y + this.handY;
    const lx = hx + this.state.x;
    const ly = hy + this.state.y;
    // The lantern hangs along its chain: tilt it with the chain, and the flame sits inside it.
    const angle = Math.atan2(lx - hx, ly - hy);
    this.lantern.setPosition(lx, ly).setRotation(-angle);
    this.x = lx + Math.sin(angle) * 6;
    this.y = ly + Math.cos(angle) * 6;

    const depth = hand.behind ? 2.9 : 3.1;
    this.lantern.setDepth(depth);
    this.chain.setDepth(depth).clear().lineStyle(1, 0x4a4038, 1).lineBetween(hx, hy, lx, ly);
  }
}
