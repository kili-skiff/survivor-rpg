import * as Phaser from 'phaser';
import { VILLAGE, VILLAGE_ASSETS, type StationId } from '../config/village';
import { InputState } from '../input/InputState';
import { loadSave, safeStorage } from '../logic/save';
import { loadSettings } from '../logic/settings';
import {
  center,
  contains,
  findPath,
  steer,
  WalkGrid,
  zoneAt,
  type Point,
  type Rect,
  type Zone,
} from '../logic/village';
import type { Arrival } from '../panels/villagePanels';
import { LanternSystem } from '../systems/LanternSystem';
import { PlayerController } from '../systems/PlayerController';
import { viewportSize } from '../ui/display';

export interface VillageSceneData {
  /** Coming home from an expedition: what came with you */
  arrival?: Arrival;
  /** Coming out of the house (the menu village): you stand at its door */
  from?: 'house';
}

/** Our own data per prop in the atlas (see scripts/village/build_village.py) */
interface PropMeta {
  frames: number;
  fps: number;
  /** Collision box: x from the bottom centre, y up from the bottom, width, height */
  foot: [number, number, number, number] | null;
  /** Glow: x from the bottom centre, y up from the bottom, radius */
  light: [number, number, number] | null;
}

interface Glow {
  x: number;
  y: number;
  radius: number;
}

export type WalkTarget = StationId | 'gate';

/** The watchman's feet, below the centre of his sprite (px) */
const FEET_Y = 22;
/** Things further down the screen are drawn in front */
const depthAt = (y: number) => 1 + y / 100000;
/** Seconds without getting closer to the next way point before a walk gives up */
const STUCK_SEC = 1.2;

/**
 * The walkable village: the map from public/assets/village, the watchman walking with keys or the touch
 * stick (read from the shared InputState), houses and fences in his way, night light. Walking to a
 * station (by tapping it on the shortcut bar) finds a way around the houses. The buttons, the panels
 * and the stick live in VillageHudScene on top, which talks to this scene through its events:
 * `station` (the station you stand at changed) and `arrived` (a walk to a station ended).
 * Without the village art (e.g. in the single-file build) it opens the menu village instead.
 */
export class VillageScene extends Phaser.Scene {
  controls!: InputState;
  private data0: VillageSceneData = {};
  private player!: PlayerController;
  private lantern!: LanternSystem;
  private zones: Zone<StationId>[] = [];
  private gate: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private grid!: WalkGrid;
  private path: Point[] | null = null;
  private target: WalkTarget | null = null;
  private bestDist = Infinity;
  private stuckFor = 0;
  private here: StationId | null = null;
  /** Standing in the gate when the scene starts must not send you off at once */
  private inGate = true;
  private frozen = false;
  private leaving = false;
  private darkness: Phaser.GameObjects.Rectangle | null = null;
  private glows: Glow[] = [];
  private glowImages: Phaser.GameObjects.Image[] = [];
  private blockers: Phaser.Physics.Arcade.StaticGroup | null = null;
  private lanternGlow: Phaser.GameObjects.Image | null = null;
  private mapW = 0;
  private mapH = 0;

  constructor() {
    super('Village');
  }

  init(data: VillageSceneData): void {
    this.data0 = data ?? {};
  }

  create(): void {
    const { map: mapAsset, props: propsAsset } = VILLAGE_ASSETS;
    if (!this.cache.tilemap.exists(mapAsset.key) || !this.textures.exists(propsAsset.key)) {
      this.scene.start('VillageMenu', this.data0);
      return;
    }
    this.zones = [];
    this.glows = [];
    this.glowImages = [];
    this.path = null;
    this.target = null;
    this.here = null;
    this.inGate = true;
    this.frozen = false;
    this.leaving = false;

    let controls = this.registry.get('input') as InputState | undefined;
    if (!controls) {
      controls = new InputState();
      this.registry.set('input', controls);
    }
    this.controls = controls;
    this.controls.reset();

    const walls = this.buildMap();
    this.grid = new WalkGrid(this.mapW, this.mapH, VILLAGE.pathCell, walls, VILLAGE.pathClearance);

    // The watchman with his lantern
    this.player = new PlayerController(this, () => this.time.now);
    const start = this.startPoint();
    this.player.sprite.setPosition(start.x, start.y - FEET_Y);
    this.player.sprite.setCollideWorldBounds(true);
    if (this.blockers) this.physics.add.collider(this.player.sprite, this.blockers);
    this.physics.world.setBounds(0, 0, this.mapW, this.mapH);
    const save = loadSave(safeStorage());
    this.lantern = new LanternSystem(this, this.player, save.lanternLevel);
    this.lantern.depthSpread = 0.000004;

    this.buildLight();
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.mapW, this.mapH);
    cam.setBackgroundColor(0x0b0a10);
    cam.startFollow(this.player.sprite, true, 0.18, 0.18);
    this.onResize();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.controls.reset();
      // The HUD belongs to this scene; it never stays behind on its own.
      this.scene.stop('VillageHud');
    });
    this.scene.launch('VillageHud', { arrival: this.data0.arrival });
  }

  // ---------------------------------------------------------------- the map

  /** Ground, fences, props, colliders and zones from the map. Returns everything that blocks the way. */
  private buildMap(): Rect[] {
    const map = this.make.tilemap({ key: VILLAGE_ASSETS.map.key });
    this.mapW = map.widthInPixels;
    this.mapH = map.heightInPixels;
    const tileset = map.addTilesetImage(VILLAGE_ASSETS.tilesetName, VILLAGE_ASSETS.tiles.key);
    const walls: Rect[] = [];
    map.layers.forEach((layer, i) => {
      if (layer.name === 'fences') {
        // Fences stand up: each piece is drawn in order with the props, by its bottom edge.
        for (const row of layer.data) {
          for (const tile of row) {
            if (tile.index < 0) continue;
            const bottom = (tile.y + 1) * map.tileHeight;
            this.add
              .image(tile.pixelX + map.tileWidth / 2, bottom, VILLAGE_ASSETS.tiles.key, tile.index - 1)
              .setOrigin(0.5, 1)
              .setDepth(depthAt(bottom));
          }
        }
      } else if (tileset) {
        map.createLayer(layer.name, tileset, 0, 0)?.setDepth(i * 0.01);
      }
    });

    const texture = this.textures.get(VILLAGE_ASSETS.props.key);
    const meta = (texture.customData as { meta?: { props?: Record<string, PropMeta> } }).meta?.props ?? {};
    const blockers = this.physics.add.staticGroup();
    const block = (r: Rect) => {
      walls.push(r);
      const z = this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h);
      blockers.add(z);
    };

    for (const o of map.getObjectLayer('props')?.objects ?? []) {
      const key = o.name;
      const m = meta[key];
      if (!m) continue;
      const bx = (o.x ?? 0) + (o.width ?? 0) / 2;
      const by = (o.y ?? 0) + (o.height ?? 0);
      const thing =
        m.frames > 1
          ? this.add.sprite(bx, by, VILLAGE_ASSETS.props.key, `${key}-0`).play(this.propAnim(key, m))
          : this.add.image(bx, by, VILLAGE_ASSETS.props.key, key);
      thing.setOrigin(0.5, 1).setDepth(depthAt(by));
      if (m.foot) {
        const [fx, fy, fw, fh] = m.foot;
        block({ x: bx + fx, y: by - fy - fh, w: fw, h: fh });
      }
      if (m.light) {
        const [lx, ly, r] = m.light;
        this.glows.push({ x: bx + lx, y: by - ly, radius: r });
      }
    }
    for (const o of map.getObjectLayer('colliders')?.objects ?? []) {
      block({ x: o.x ?? 0, y: o.y ?? 0, w: o.width ?? 0, h: o.height ?? 0 });
    }
    for (const o of map.getObjectLayer('stations')?.objects ?? []) {
      this.zones.push({
        id: o.name as StationId,
        x: o.x ?? 0,
        y: o.y ?? 0,
        w: o.width ?? 0,
        h: o.height ?? 0,
      });
    }
    for (const o of map.getObjectLayer('marks')?.objects ?? []) {
      if (o.name === 'gate') this.gate = { x: o.x ?? 0, y: o.y ?? 0, w: o.width ?? 0, h: o.height ?? 0 };
      if (o.name === 'spawn') this.registry.set('villageSpawn', { x: o.x ?? 0, y: o.y ?? 0 });
    }
    this.blockers = blockers;
    return walls;
  }

  private propAnim(key: string, m: PropMeta): string {
    const anim = `village-${key}`;
    if (!this.anims.exists(anim)) {
      this.anims.create({
        key: anim,
        frames: Array.from({ length: m.frames }, (_, i) => ({
          key: VILLAGE_ASSETS.props.key,
          frame: `${key}-${i}`,
        })),
        frameRate: m.fps || 8,
        repeat: -1,
      });
    }
    return anim;
  }

  /** Where the watchman stands when the scene starts: at the gate when coming home, at the house door
   * when coming out of it, otherwise at the Nest (also when waking up after a fall). */
  private startPoint(): Point {
    if (this.data0.from === 'house') {
      const house = this.zones.find((z) => z.id === 'house');
      if (house) return center(house);
    }
    if (this.data0.arrival?.reason === 'returned') {
      return { x: this.gate.x + this.gate.w / 2, y: this.gate.y - 6 };
    }
    const spawn = this.registry.get('villageSpawn') as Point | undefined;
    return spawn ?? { x: this.mapW / 2, y: this.mapH / 2 };
  }

  // ---------------------------------------------------------------- light

  private buildLight(): void {
    const on = loadSettings(safeStorage()).lighting;
    this.darkness = this.add
      .rectangle(0, 0, this.mapW, this.mapH, VILLAGE.nightColor, VILLAGE.nightDarkness)
      .setOrigin(0)
      .setDepth(5)
      .setVisible(on);
    const glow = () =>
      this.add
        .image(0, 0, 'light')
        .setDepth(5.1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(VILLAGE.glowColor)
        .setVisible(on);
    this.glowImages = this.glows.map((g) => glow().setPosition(g.x, g.y));
    this.lanternGlow = glow();
  }

  private updateLight(time: number): void {
    for (const [i, g] of this.glows.entries()) {
      const flicker = 1 + Math.sin(time * 0.008 + i * 1.7) * 0.04 + Math.sin(time * 0.019 + i) * 0.03;
      const size = g.radius * 2 * flicker;
      this.glowImages[i].setDisplaySize(size, size).setAlpha(VILLAGE.glowStrength);
    }
    const l = this.lantern.light(time);
    if (this.lanternGlow) {
      this.lanternGlow.setVisible(!!l && !!this.darkness?.visible);
      if (l) {
        const flicker = 1 + Math.sin(time * 0.011) * 0.03;
        const size = VILLAGE.lanternRadius * 2 * flicker;
        this.lanternGlow
          .setPosition(l.x, l.y)
          .setDisplaySize(size, size)
          .setTint(l.color ?? VILLAGE.glowColor)
          .setAlpha(VILLAGE.glowStrength * 0.8);
      }
    }
  }

  // ---------------------------------------------------------------- camera

  private onResize(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);
    const css = viewportSize();
    const rs = width / css.width;
    const zoom =
      rs *
      Phaser.Math.Clamp(Math.min(css.width, css.height) / VILLAGE.viewSize, VILLAGE.minZoom, VILLAGE.maxZoom);
    this.cameras.main.setZoom(zoom);
  }

  // ---------------------------------------------------------------- for the HUD

  /** The station you stand at, if any */
  stationHere(): StationId | null {
    return this.here;
  }

  /** Walks to a station (or the gate) on a way around the houses. */
  walkTo(target: WalkTarget): void {
    const zone = target === 'gate' ? this.gate : this.zones.find((z) => z.id === target);
    if (!zone) return;
    if (target !== 'gate' && this.here === target) {
      this.events.emit('arrived', target);
      return;
    }
    const goal = target === 'gate' ? { x: zone.x + zone.w / 2, y: zone.y + zone.h - 2 } : center(zone);
    const path = findPath(this.grid, this.feet(), goal);
    if (!path) return;
    this.path = path;
    this.target = target;
    this.bestDist = Infinity;
    this.stuckFor = 0;
  }

  /** The walk the watchman is on, if any */
  walkingTo(): WalkTarget | null {
    return this.target;
  }

  /** While a panel is open the watchman stands still. */
  setFrozen(on: boolean): void {
    this.frozen = on;
    if (on) this.cancelWalk();
  }

  /** Into the house: the stash and the belt (the menu village). */
  enterHouse(): void {
    this.leave(() => this.scene.start('VillageMenu', {}));
  }

  /** Off through the gate to the world map. */
  setOut(): void {
    this.leave(() => this.scene.start('WorldMap'));
  }

  private leave(go: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cancelWalk();
    this.cameras.main.fadeOut(220, 8, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('VillageHud');
      go();
    });
  }

  private cancelWalk(): void {
    this.path = null;
    this.target = null;
  }

  // ---------------------------------------------------------------- every frame

  private feet(): Point {
    return { x: this.player.x, y: this.player.y + FEET_Y };
  }

  override update(time: number, deltaMs: number): void {
    if (!this.player) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    let mx = 0;
    let my = 0;
    if (!this.frozen && !this.leaving) {
      mx = this.controls.moveX;
      my = this.controls.moveY;
      // Walking yourself ends a walk to a station.
      if (Math.hypot(mx, my) > 0.1) this.cancelWalk();
      else if (this.path) [mx, my] = this.followPath(dt);
    }
    this.player.update(mx, my, VILLAGE.walkSpeed);

    const feet = this.feet();
    const depth = depthAt(feet.y);
    this.player.sprite.setDepth(depth);
    this.lantern.depth = depth;
    this.lantern.update(dt);
    this.updateLight(time);

    const here = zoneAt(this.zones, feet.x, feet.y);
    if (here !== this.here) {
      this.here = here;
      this.events.emit('station', here);
    }
    const inGate = contains(this.gate, feet.x, feet.y);
    if (inGate && !this.inGate && !this.leaving) this.setOut();
    this.inGate = inGate;
  }

  /** Steers along the way points; ends the walk at the last one or when stuck. */
  private followPath(dt: number): [number, number] {
    const path = this.path!;
    const feet = this.feet();
    let s = steer(feet, path[0]);
    while (s.dist < VILLAGE.waypointReach && path.length > 0) {
      path.shift();
      this.bestDist = Infinity;
      this.stuckFor = 0;
      if (path.length === 0) {
        const target = this.target;
        this.cancelWalk();
        if (target === 'gate') this.setOut();
        else if (target) this.events.emit('arrived', target);
        return [0, 0];
      }
      s = steer(feet, path[0]);
    }
    if (s.dist < this.bestDist - 0.5) {
      this.bestDist = s.dist;
      this.stuckFor = 0;
    } else {
      this.stuckFor += dt;
      if (this.stuckFor > STUCK_SEC) {
        this.cancelWalk();
        return [0, 0];
      }
    }
    return [s.x, s.y];
  }
}
