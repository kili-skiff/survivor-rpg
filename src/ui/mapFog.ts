import * as Phaser from 'phaser';
import { MAP_FOG, type FogLayer } from '../config/mapFog';
import { WORLD } from '../config/world';
import { fogDensity } from '../logic/fogNoise';

/** Fog sits above the tiles and herbs but below travel targets, quest marks, fires and the player. */
const FOG_DEPTH = 0.4;
/** Firelight sits on top of the fog: it lights the land, but the wisps stay visible through it. */
const GLOW_DEPTH = 0.45;
const LIGHT_TEXTURE = 'light';

interface Sheet {
  def: FogLayer;
  sprite: Phaser.GameObjects.TileSprite;
  /** Offset so the sheets do not breathe in step */
  phase: number;
  /** Scrolled distance in texture pixels */
  x: number;
  y: number;
}

interface Glow {
  image: Phaser.GameObjects.Image;
  phase: number;
}

export interface FogBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Night fog over the whole world map: soft sheets of cloud drifting slowly in different directions.
 * Explored tiles stay readable through it, unexplored hexes stay black, and a lit watchfire adds
 * warm light around it without clearing the fog away. Purely visual.
 */
export class MapFog {
  private readonly sheets: Sheet[] = [];
  private readonly glows = new Map<string, Glow>();
  private hexSize = 1;

  /** `fires` are the hex keys of all watchfires on the map. */
  constructor(scene: Phaser.Scene, fires: readonly string[]) {
    MAP_FOG.layers.forEach((def, i) => {
      this.ensureTexture(scene, def);
      const sprite = scene.add
        .tileSprite(0, 0, 1, 1, def.key)
        .setDepth(FOG_DEPTH + i * 0.001)
        .setTint(def.color);
      this.sheets.push({ def, sprite, phase: i * 2.1, x: i * 97, y: i * 53 });
    });
    if (scene.textures.exists(LIGHT_TEXTURE)) {
      fires.forEach((key, i) => {
        const image = scene.add
          .image(0, 0, LIGHT_TEXTURE)
          .setDepth(GLOW_DEPTH)
          .setTint(MAP_FOG.fireGlow.color)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(false);
        this.glows.set(key, { image, phase: i * 1.7 });
      });
    }
  }

  /** Everything the map camera draws for the fog (the HUD camera must ignore it). */
  objects(): Phaser.GameObjects.GameObject[] {
    return [...this.sheets.map((s) => s.sprite), ...[...this.glows.values()].map((g) => g.image)];
  }

  /** Sizes the fog to the map. `fires` maps a watchfire's hex key to its position on the map. */
  layout(hexSize: number, bounds: FogBounds, fires: ReadonlyMap<string, { x: number; y: number }>): void {
    this.hexSize = hexSize;
    const margin = MAP_FOG.marginHexes * hexSize;
    const w = bounds.maxX - bounds.minX + margin * 2;
    const h = bounds.maxY - bounds.minY + margin * 2;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    for (const { def, sprite } of this.sheets) {
      const scale = (def.tileHexes * hexSize) / MAP_FOG.textureSize;
      sprite.setPosition(cx, cy).setSize(w, h).setTileScale(scale, scale);
    }
    const radius = WORLD.watchfireRevealRadius * 1.5 + MAP_FOG.fireGlow.extraHexes;
    for (const [key, glow] of this.glows) {
      const p = fires.get(key);
      if (p) glow.image.setPosition(p.x, p.y).setDisplaySize(radius * 2 * hexSize, radius * 2 * hexSize);
    }
  }

  /**
   * Moves the fog on. `lit` tells which watchfires burn; `showFog` switches the clouds off
   * (dev reveal), the firelight stays.
   */
  update(deltaSec: number, time: number, lit: (key: string) => boolean, showFog: boolean): void {
    const size = MAP_FOG.textureSize;
    for (const s of this.sheets) {
      const scale = s.sprite.tileScaleX || 1;
      // Drift in hexes per second, converted to texture pixels.
      s.x = (s.x + ((s.def.driftX * this.hexSize) / scale) * deltaSec) % size;
      s.y = (s.y + ((s.def.driftY * this.hexSize) / scale) * deltaSec) % size;
      const breath = 1 + s.def.breath * Math.sin((time * Math.PI * 2) / s.def.breathSec + s.phase);
      s.sprite
        .setTilePosition(s.x, s.y)
        .setAlpha(Math.min(1, s.def.alpha * breath))
        .setVisible(showFog);
    }
    const { strength, flicker } = MAP_FOG.fireGlow;
    for (const [key, glow] of this.glows) {
      const on = lit(key);
      glow.image.setVisible(on);
      if (!on) continue;
      const wobble = Math.sin(time * 7 + glow.phase) * 0.5 + Math.sin(time * 13 + glow.phase * 2) * 0.5;
      glow.image.setAlpha(strength * (1 + wobble * flicker));
    }
  }

  /** Builds a seamless, soft cloud texture once; scene restarts reuse it. */
  private ensureTexture(scene: Phaser.Scene, def: FogLayer): void {
    if (scene.textures.exists(def.key)) return;
    const n = MAP_FOG.textureSize;
    const texture = scene.textures.createCanvas(def.key, n, n);
    if (!texture) return;
    const ctx = texture.getContext();
    const pixels = ctx.createImageData(n, n);
    const density = fogDensity(n, def.seed, def);
    for (let i = 0; i < density.length; i++) {
      // White with the density as opacity; the layer's colour comes from the tint.
      pixels.data[i * 4] = 255;
      pixels.data[i * 4 + 1] = 255;
      pixels.data[i * 4 + 2] = 255;
      pixels.data[i * 4 + 3] = density[i];
    }
    ctx.putImageData(pixels, 0, 0);
    texture.refresh();
  }
}
