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
  /** Lanterns that draw fireflies */
  lamps: Spot[];
  /** Size of the map (px) */
  width: number;
  height: number;
}

const MOTE = 'village-mote';

interface Firefly {
  dot: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  home: Spot;
  x: number;
  y: number;
  heading: number;
  /** Current and wanted turning rate (rad/s); the wish changes every second or so */
  turn: number;
  turnWish: number;
  wishLeft: number;
  speed: number;
  phase: number;
  blinkMs: number;
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

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
 * fires, smoke from the forge's chimney, fireflies around the lanterns, now and then a bat crossing the sky,
 * and a thin fog creeping along the palisade. Purely visual; numbers in VILLAGE_LIFE.
 */
export class VillageAmbience {
  private readonly fireflies: Firefly[] = [];
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

    for (const lamp of spots.lamps) {
      for (let i = 0; i < L.firefliesPerLamp; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * L.fireflyLeash;
        const x = lamp.x + Math.cos(a) * r;
        const y = lamp.y + Math.sin(a) * r * 0.7;
        this.fireflies.push({
          glow: scene.add
            .image(x, y, 'light')
            .setScale(0.12)
            .setTint(L.fireflyColor)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(depth),
          dot: scene.add
            .image(x, y, MOTE)
            .setScale(0.2)
            .setTint(0xfffbd0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(depth),
          home: lamp,
          x,
          y,
          heading: Math.random() * Math.PI * 2,
          turn: 0,
          turnWish: 0,
          wishLeft: 0,
          speed: rand(L.fireflySpeed.min, L.fireflySpeed.max),
          phase: Math.random() * Math.PI * 2,
          blinkMs: rand(L.fireflyBlinkMs.min, L.fireflyBlinkMs.max),
        });
      }
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
    for (const f of this.fireflies) {
      // Wander: every second or so a new wish to turn, followed smoothly, so the path curves and loops
      f.wishLeft -= dt;
      if (f.wishLeft <= 0) {
        f.turnWish = rand(-1.8, 1.8);
        f.wishLeft = rand(0.5, 1.6);
      }
      f.turn += (f.turnWish - f.turn) * Math.min(1, dt * 2.5);
      // A gentle pull back when it strays too far from the lantern
      const dx = f.home.x - f.x;
      const dy = f.home.y - f.y;
      const away = Math.hypot(dx, dy) / L.fireflyLeash;
      if (away > 0.7) {
        let diff = Math.atan2(dy, dx) - f.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        f.heading += diff * Math.min(1, dt * (away - 0.6) * 3);
      }
      f.heading += f.turn * dt;
      // Slow down and speed up a little, as if hovering
      const pace = f.speed * (0.6 + 0.4 * Math.sin(time * 0.0017 + f.phase * 2));
      f.x += Math.cos(f.heading) * pace * dt;
      f.y += Math.sin(f.heading) * pace * dt * 0.8;
      // Blink: mostly dim, then a soft glow that swells and fades
      const wave = (Math.sin((time / f.blinkMs) * Math.PI * 2 + f.phase) + 1) / 2;
      const glow = wave * wave * wave;
      const bob = Math.sin(time * 0.004 + f.phase) * 1.2;
      f.dot.setPosition(f.x, f.y + bob).setAlpha(0.1 + glow * 0.9);
      f.glow.setPosition(f.x, f.y + bob).setAlpha(glow * 0.55).setScale(0.07 + glow * 0.07);
    }

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
