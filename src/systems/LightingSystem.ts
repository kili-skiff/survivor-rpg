import * as Phaser from 'phaser';
import { LIGHT } from '../config/balance';
import { hash32 } from '../logic/rng';

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  /** Tint of the glow; warm firelight by default */
  color?: number;
}

interface Target {
  readonly x: number;
  readonly y: number;
}

/** Pool sizes: torches near the player, and glows for torches and herbs */
const MAX_TORCHES = 24;
const MAX_GLOWS = 40;
const TORCH_SALT = 91;
const WARM = 0xffb060;
const DARKNESS_KEY = 'darkness';
/** Resolution of the darkness texture; it is soft, so it can be small */
const DARKNESS_TEXTURE = 256;

/**
 * Night in a fight, kept cheap for phones: one big darkness image with a soft hole follows the
 * player (the lantern), and other lights (torches, bloomed herbs) are warm glows added on top.
 * Torches stand on a fixed grid in the world, so they stay where they are while you walk.
 * Purely visual for now.
 */
export class LightingSystem {
  private readonly darkness: Phaser.GameObjects.Image;
  private readonly darknessTexture: Phaser.Textures.CanvasTexture;
  /** Display size of the darkness image: just enough to cover the view (big quads are slow) */
  private darknessSize = 0;
  private readonly torches: Phaser.GameObjects.Image[] = [];
  private readonly glows: Phaser.GameObjects.Image[] = [];
  private readonly seed: number;
  private viewW = 1;
  private viewH = 1;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Target,
    /** Extra lights each frame, e.g. bloomed herbs */
    private readonly extraLights: () => LightSource[],
    seed: number,
  ) {
    this.seed = seed >>> 0;
    this.darknessTexture = (
      scene.textures.exists(DARKNESS_KEY)
        ? (scene.textures.get(DARKNESS_KEY) as Phaser.Textures.CanvasTexture)
        : scene.textures.createCanvas(DARKNESS_KEY, DARKNESS_TEXTURE, DARKNESS_TEXTURE)
    )!;
    this.darkness = scene.add.image(0, 0, DARKNESS_KEY).setDepth(8).setTint(LIGHT.color);
    for (let i = 0; i < MAX_TORCHES; i++) {
      this.torches.push(scene.add.image(0, 0, 'torch').setOrigin(0.5, 0.9).setDepth(1.5).setVisible(false));
    }
    for (let i = 0; i < MAX_GLOWS; i++) {
      this.glows.push(
        scene.add.image(0, 0, 'light').setDepth(8.1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
      );
    }
  }

  /** Switches darkness and glows on or off (torches stay as decoration). */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.darkness.setVisible(on);
    if (!on) for (const g of this.glows) g.setVisible(false);
  }

  /** The visible world area changed (screen size or zoom). */
  resize(viewW: number, viewH: number): void {
    this.viewW = viewW;
    this.viewH = viewH;
    // Cover the view from the player in the middle, with room for the flicker.
    const size = Math.ceil((Math.max(viewW, viewH) * 1.15) / 50) * 50;
    if (size !== this.darknessSize) {
      this.darknessSize = size;
      this.drawDarkness(LIGHT.radius / (size / 2));
    }
  }

  /** Darkness with a soft hole in the middle; `hole` is the light radius as a share of the half size. */
  private drawDarkness(hole: number): void {
    const n = DARKNESS_TEXTURE;
    const ctx = this.darknessTexture.getContext();
    ctx.clearRect(0, 0, n, n);
    const grad = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    const a = LIGHT.darkness;
    const stop = (at: number, alpha: number) =>
      grad.addColorStop(Math.min(1, at), `rgba(255,255,255,${alpha})`);
    stop(0, 0);
    stop(hole * 0.7, 0);
    stop(hole * 0.95, a * 0.5);
    stop(hole * 1.2, a * 0.9);
    stop(hole * 1.4, a);
    if (hole * 1.4 < 1) stop(1, a);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, n, n);
    // The corners stay fully dark (the gradient only reaches the inscribed circle).
    this.darknessTexture.refresh();
  }

  update(time: number): void {
    const flicker = (phase: number, amount: number) =>
      1 + (Math.sin(time * 0.009 + phase) * 0.6 + Math.sin(time * 0.023 + phase * 2) * 0.4) * amount;
    const { x, y } = this.player;

    const size = this.darknessSize * flicker(0, LIGHT.flicker);
    this.darkness.setPosition(x, y).setDisplaySize(size, size);

    const lights: LightSource[] = [];
    for (const t of this.placeTorches(x - this.viewW / 2, y - this.viewH / 2)) {
      lights.push({ x: t.x, y: t.y - 14, radius: LIGHT.torchRadius * flicker(t.x * 0.01, 0.08) });
    }
    lights.push(...this.extraLights());
    if (!this.enabled) return;
    let used = 0;
    for (const l of lights) {
      if (used >= MAX_GLOWS) break;
      this.glows[used]
        .setPosition(l.x, l.y)
        .setDisplaySize(l.radius * 2, l.radius * 2)
        .setTint(l.color ?? WARM)
        .setAlpha(LIGHT.glowStrength)
        .setVisible(true);
      used += 1;
    }
    for (let i = used; i < MAX_GLOWS; i++) this.glows[i].setVisible(false);
  }

  /** Shows the torches of the grid cells in view, reusing a small pool of images. */
  private placeTorches(left: number, top: number): { x: number; y: number }[] {
    const cell = LIGHT.torchCell;
    const placed: { x: number; y: number }[] = [];
    const x0 = Math.floor((left - cell) / cell);
    const y0 = Math.floor((top - cell) / cell);
    const x1 = Math.floor((left + this.viewW + cell) / cell);
    const y1 = Math.floor((top + this.viewH + cell) / cell);
    let used = 0;
    for (let cy = y0; cy <= y1 && used < MAX_TORCHES; cy++) {
      for (let cx = x0; cx <= x1 && used < MAX_TORCHES; cx++) {
        const h = hash32(this.seed, TORCH_SALT, cx, cy);
        if ((h % 1000) / 1000 >= LIGHT.torchChance) continue;
        const tx = cx * cell + (((h >>> 10) % 1000) / 1000) * cell * 0.8 + cell * 0.1;
        const ty = cy * cell + (((h >>> 20) % 1000) / 1000) * cell * 0.8 + cell * 0.1;
        this.torches[used].setPosition(tx, ty).setVisible(true);
        placed.push({ x: tx, y: ty });
        used += 1;
      }
    }
    for (let i = used; i < MAX_TORCHES; i++) this.torches[i].setVisible(false);
    return placed;
  }
}
