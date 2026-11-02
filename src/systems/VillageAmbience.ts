import * as Phaser from 'phaser';
import { VILLAGE_LIFE } from '../config/village';

export interface Spot {
  x: number;
  y: number;
}

/** Where the village's small signs of life happen */
export interface AmbienceSpots {
  /** Open fires that throw sparks (the Nest, the forge) */
  fires: Spot[];
  /** Chimneys that smoke */
  chimneys: Spot[];
  /** Size of the map (px) */
  width: number;
  height: number;
}

const MOTE = 'village-mote';

interface Bat {
  sprite: Phaser.GameObjects.Image;
  dir: number;
  speed: number;
  baseY: number;
  phase: number;
}

interface FogPuff {
  image: Phaser.GameObjects.Image;
  speed: number;
}

/**
 * Small signs of life in the walkable village, all cheap enough for phones: sparks rising from the
 * fires, smoke from the forge's chimney, now and then a bat crossing the sky,
 * and a thin fog creeping along the palisade. Purely visual; numbers in VILLAGE_LIFE.
 */
export class VillageAmbience {
  private readonly bats: Bat[] = [];
  private readonly fog: FogPuff[] = [];
  private nextBatAt: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly spots: AmbienceSpots,
    /** Drawn above the night, so they show in the dark */
    private readonly depth: number,
  ) {
    if (!scene.textures.exists(MOTE)) {
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
      g.generateTexture(MOTE, 8, 8);
      g.destroy();
    }
    const L = VILLAGE_LIFE;

    for (const fire of spots.fires) {
      scene.add
        .particles(fire.x, fire.y, MOTE, {
          x: { min: -L.sparkSpread, max: L.sparkSpread },
          speedY: { min: -L.sparkRise * 1.4, max: -L.sparkRise * 0.7 },
          speedX: { min: -8, max: 8 },
          accelerationX: { min: -6, max: 6 },
          lifespan: { min: L.sparkLife * 0.6, max: L.sparkLife },
          frequency: L.sparkEvery,
          scale: { start: 0.42, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xffd28a, 0xffb060, 0xff7a30],
          blendMode: Phaser.BlendModes.ADD,
        })
        .setDepth(depth);
    }

    for (const chimney of spots.chimneys) {
      scene.add
        .particles(chimney.x, chimney.y, 'light', {
          x: { min: -3, max: 3 },
          speedY: { min: -L.smokeRise * 1.3, max: -L.smokeRise * 0.8 },
          speedX: { min: L.smokeDrift * 0.5, max: L.smokeDrift * 1.2 },
          lifespan: L.smokeLife,
          frequency: L.smokeEvery,
          scale: { start: 0.07, end: 0.32 },
          alpha: { start: L.smokeAlpha, end: 0 },
          tint: L.smokeColor,
        })
        .setDepth(depth);
    }

    // Fog along the palisade: soft pale puffs drifting slowly, only near the edges of the village.
    for (let i = 0; i < L.fogPuffs; i++) {
      const edge = i % 4;
      const along = Math.random();
      const inset = 20 + Math.random() * 50;
      const x = edge < 2 ? along * spots.width : edge === 2 ? inset : spots.width - inset;
      const y = edge === 0 ? inset + 20 : edge === 1 ? spots.height - inset : along * spots.height;
      const size = L.fogSize * (0.7 + Math.random() * 0.6);
      this.fog.push({
        image: scene.add
          .image(x, y, 'light')
          .setDisplaySize(size, size * 0.55)
          .setTint(L.fogColor)
          .setAlpha(L.fogAlpha * (0.6 + Math.random() * 0.8))
          .setDepth(depth - 0.05),
        speed: (4 + Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1),
      });
    }

    this.nextBatAt = scene.time.now + L.batFirstMs;
  }

  update(time: number, dt: number): void {
    const L = VILLAGE_LIFE;
    for (const f of this.fog) {
      let x = f.image.x + f.speed * dt;
      if (x < -100) x = this.spots.width + 100;
      if (x > this.spots.width + 100) x = -100;
      f.image.x = x;
    }

    if (time >= this.nextBatAt) {
      this.spawnBat();
      this.nextBatAt = time + L.batEveryMs * (0.6 + Math.random() * 0.8);
    }
    for (let i = this.bats.length - 1; i >= 0; i--) {
      const b = this.bats[i];
      b.sprite.x += b.dir * b.speed * dt;
      b.sprite.y = b.baseY + Math.sin(time * 0.006 + b.phase) * 10;
      // Wings: squash up and down
      b.sprite.setScale(L.batScale, L.batScale * (0.55 + Math.abs(Math.sin(time * 0.03 + b.phase)) * 0.45));
      const view = this.scene.cameras.main.worldView;
      if ((b.dir > 0 && b.sprite.x > view.right + 60) || (b.dir < 0 && b.sprite.x < view.x - 60)) {
        b.sprite.destroy();
        this.bats.splice(i, 1);
      }
    }
  }

  /** A bat crosses the upper part of the view, a dark shape against the night. */
  private spawnBat(): void {
    const view = this.scene.cameras.main.worldView;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = dir > 0 ? view.x - 40 : view.right + 40;
    const y = view.y + view.height * (0.1 + Math.random() * 0.35);
    const sprite = this.scene.add
      .image(x, y, 'enemy-bat')
      .setTint(0x15121c)
      .setFlipX(dir < 0)
      .setAlpha(0.9)
      .setDepth(this.depth + 0.5);
    this.bats.push({
      sprite,
      dir,
      speed: VILLAGE_LIFE.batSpeed * (0.8 + Math.random() * 0.4),
      baseY: y,
      phase: Math.random() * 6,
    });
  }
}
