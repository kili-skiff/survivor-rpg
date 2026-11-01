import * as Phaser from 'phaser';
import { LANTERN } from '../config/balance';
import { FOOTSTEPS } from '../config/footsteps';
import { LANTERN_LOOKS, lanternLook, type LanternLook } from '../config/merchant';
import { MAP_FOG } from '../config/mapFog';
import { BIOMES, POIS } from '../config/world';
import { CHARACTER_SPRITES, SHEET } from '../config/sprites';
import { FIRE_QUEST, TOWER_QUEST, VILLAGERS } from '../config/quests';
import { DialoguePanel } from '../panels/DialoguePanel';
import { herbForecast } from '../logic/herbs';
import {
  acceptFireQuest,
  questGoals,
  questMarked,
  questRevealed,
  questsAfterMove,
  toggleTracking,
} from '../logic/quests';
import { BIOME_TILES, POI_TILES, TILESET } from '../config/tiles';
import {
  hexEquals,
  hexDistance,
  hexKey,
  hexToPixelFlat,
  ORIGIN,
  parseHexKey,
  pixelToHexFlat,
  type Hex,
} from '../logic/hex';
import { footstepsOf, type Footstep } from '../logic/footsteps';
import { brightHexes } from '../logic/mapLight';
import { hash32 } from '../logic/rng';
import { loadSave, safeStorage, writeSave, type SaveData } from '../logic/save';
import { lootCount, lootGained } from '../logic/expedition';
import { returnHome, teleport, walkHome, walkThrough } from '../logic/journey';
import { deedBonus, describeEarned, earnDeeds } from '../logic/deeds';
import { computePlayerStats } from '../logic/stats';
import {
  isAtHome,
  isCleared,
  isDiscovered,
  isLit,
  isUsedUp,
  travelKind,
  type TravelKind,
  type WorldProgress,
} from '../logic/worldProgress';
import { GOALS } from '../config/goals';
import { goalLabel } from '../logic/goals';
import { REWARDS } from '../config/rewards';
import { rewardLabel } from '../logic/rewards';
import { seasonWorld, segmentForHex, type World, type WorldHex } from '../logic/worldgen';
import { jumpTo } from '../dev/devLogic'; // DEV:
import { devButtonStyle, isDevMode } from '../dev/devMode'; // DEV:
import { safeArea, viewportSize, type SafeArea } from '../ui/display';
import { MapFog } from '../ui/mapFog';
import { COLORS, css, FONT } from '../ui/theme';
import type { GameSceneData } from './GameScene';
import type { VillageSceneData } from './VillageScene';

const FOG_FILL = 0x17141f;
const FOG_EDGE = 0x2b2638;
const VILLAGE_FILL = 0x8a6a2a;
/** Pointer movement (in CSS px) after which a touch counts as dragging the map */
const DRAG_THRESHOLD = 8;
/** Map zoom limits (1 = default size) */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
/** Ring and pin colour for quest goals on the map */
const QUEST_COLOR = 0xc084fc;

/** Two fingers on the map: zoom by their distance, pan by their midpoint. */
interface PinchState {
  startDistance: number;
  startZoom: number;
  /** World point that stays under the fingers' midpoint */
  worldX: number;
  worldY: number;
}

interface DragState {
  id: number;
  startX: number;
  startY: number;
  scrollX: number;
  scrollY: number;
  moved: boolean;
}

/**
 * The season's hex world. Shows explored land, lets the player pan around and
 * pick a neighbouring hex to fight in (or walk back into the village).
 */
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export class WorldMapScene extends Phaser.Scene {
  private world!: World;
  private save!: SaveData;
  private selected: Hex | null = null;
  /** Fog and fallback hexes, below the tiles */
  private map!: Phaser.GameObjects.Graphics;
  /** The way walked on this expedition, above the fog and below the selection */
  private footprints!: Phaser.GameObjects.Graphics;
  /** What the footprints were last drawn from: the path, the discovered hexes and the reveal switch */
  private footprintsFor: {
    path: readonly string[] | null;
    discovered: readonly string[];
    reveal: boolean;
  } | null = null;
  private footsteps: Footstep[] = [];
  /** Selection and quest marks, above the tiles */
  private outlines!: Phaser.GameObjects.Graphics;
  /** Watchfires: a glow through the fog, a burning fire once lit */
  private fires!: Phaser.GameObjects.Graphics;
  /** Arrows at the screen edge pointing to quest goals that are off screen */
  private questArrows!: Phaser.GameObjects.Graphics;
  /** One tile image per hex (empty when the tile art could not be loaded) */
  private tiles: { hex: WorldHex; image: Phaser.GameObjects.Image }[] = [];
  private tileScale = 1;
  private poiLabels: { hex: WorldHex; text: Phaser.GameObjects.Text }[] = [];
  /** A small herb in each hex that shows which herb grows there */
  private herbIcons: { hex: WorldHex; icon: Phaser.GameObjects.Image }[] = [];
  /** The goal of the fight waiting in each hex (config/goals.ts), top left in the hex */
  private goalIcons: { hex: WorldHex; icon: Phaser.GameObjects.Image }[] = [];
  /** What clearing each hex brings (config/rewards.ts), top right in the hex */
  private rewardIcons: { hex: WorldHex; icon: Phaser.GameObjects.Image }[] = [];
  /** Night fog drifting over the whole map; the village and lit watchfires glow through it */
  private fog!: MapFog;
  private marker!: Phaser.GameObjects.Image;
  /** The lantern in the watchman's hand and its chain; null when its texture is missing */
  private mapLantern: Phaser.GameObjects.Image | null = null;
  private lanternChain!: Phaser.GameObjects.Graphics;
  private lanternLook!: LanternLook;
  private hud: Phaser.GameObjects.GameObject[] = [];
  private drag: DragState | null = null;
  /** Touch points on the map by pointer id, for two-finger zoom */
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: PinchState | null = null;
  /** Draws the header, panel and edge arrows, which must not zoom with the map */
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private u = 1;
  private rs = 1;
  private sa: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  private hexSize = 30;
  private headerH = 0;
  private panelH = 0;
  private time0 = 0;
  /** Hexes shown at full brightness for this progress (`logic/mapLight.ts`); the rest is dimmed */
  private bright = new Set<string>();
  private brightFor: WorldProgress | null = null;
  /** Light level of each hex, 1 = bright, 0 = dimmed; eased so hexes fade when the player moves */
  private light = new Map<string, number>();
  /** The elder handing over the lantern at the very first start */
  private introPanel: DialoguePanel | null = null;
  /** Short notice about newly earned deeds, fading out by itself */
  private deedToast: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('WorldMap');
  }

  create(): void {
    this.world = seasonWorld();
    this.save = loadSave(safeStorage());
    this.selected = null;
    this.poiLabels = [];
    this.herbIcons = [];
    this.goalIcons = [];
    this.rewardIcons = [];
    this.tiles = [];
    this.hud = [];
    this.drag = null;
    this.touches = new Map();
    this.pinch = null;
    this.deedToast = null;
    this.bright = new Set();
    this.brightFor = null;
    this.light = new Map();

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.map = this.add.graphics().setDepth(-1);
    // Above the fog and its glow (0.4 to 0.45) so the prints stay clear, below selection and marks (0.5).
    this.footprints = this.add.graphics().setDepth(0.46);
    this.footprintsFor = null;
    this.footsteps = [];
    this.outlines = this.add.graphics().setDepth(0.5);
    this.fires = this.add.graphics().setDepth(0.6);
    this.hudCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.questArrows = this.add.graphics().setDepth(9).setScrollFactor(0);
    this.cameras.main.ignore(this.questArrows);
    if (this.textures.exists(TILESET.key)) {
      // Back to front, so trees and mountains overlap the hexes behind them.
      const byRow = [...this.world.hexes.values()].sort(
        (a, b) => hexToPixelFlat(a.hex, 1).y - hexToPixelFlat(b.hex, 1).y,
      );
      for (const h of byRow) {
        const image = this.add
          .image(0, 0, TILESET.key, this.tileFrame(h))
          .setOrigin(0.5, TILESET.faceCenterY / TILESET.frameHeight);
        this.tiles.push({ hex: h, image });
      }
    }
    for (const h of this.world.hexes.values()) {
      // Points of interest with their own tile need no glyph.
      // Watchfires are drawn as fires; points of interest with their own tile need no glyph.
      if (!h.poi || h.poi === 'watchfire' || (this.tiles.length > 0 && POI_TILES[h.poi] !== undefined))
        continue;
      const text = this.add
        .text(0, 0, POIS[h.poi].glyph, {
          fontFamily: FONT,
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        // Below the fog, like the tiles they sit on.
        .setDepth(0.3);
      this.poiLabels.push({ hex: h, text });
    }
    for (const h of this.world.hexes.values()) {
      if (!h.herbs) continue;
      const icon = this.add
        .image(0, 0, 'herb')
        .setTint(herbForecast(h.biome, h.ring).common.color)
        // Below the fog, like the tiles they sit on.
        .setDepth(0.3);
      this.herbIcons.push({ hex: h, icon });
    }
    for (const h of this.world.hexes.values()) {
      // No fight in the village, and the tower is sealed.
      if (h.poi === 'village' || h.poi === 'tower') continue;
      // Below the fog, like the tiles they sit on.
      const icon = this.add.image(0, 0, GOALS.icons.survive).setDepth(0.31);
      this.goalIcons.push({ hex: h, icon });
      this.rewardIcons.push({ hex: h, icon: this.add.image(0, 0, REWARDS.icons.gold).setDepth(0.31) });
    }
    this.fog = new MapFog(
      this,
      [...this.world.hexes.values()].filter((h) => h.poi === 'watchfire').map((h) => h.key),
      hexKey(ORIGIN),
    );
    // The watchman stands on the map, or the placeholder when the sprite sheet is missing.
    const playerSheet = CHARACTER_SPRITES.player;
    this.marker = this.textures.exists(playerSheet.key)
      ? this.add.image(0, 0, playerSheet.key, SHEET.rows.down * SHEET.columns).setOrigin(0.5, 0.78)
      : this.add.image(0, 0, 'player');
    this.marker.setDepth(3);
    // The lantern in his hand: the one bought in the village, the same sprite as in a fight.
    this.lanternLook = lanternLook(this.save.lanternLevel);
    const lanternKey = `lantern-${Math.max(0, Math.min(this.save.lanternLevel, LANTERN_LOOKS.length - 1))}`;
    this.mapLantern = this.textures.exists(lanternKey)
      ? this.add.image(0, 0, lanternKey).setOrigin(0.5, 0.1).setDepth(3.1)
      : null;
    this.lanternChain = this.add.graphics().setDepth(3.05);
    // Everything so far belongs to the map; the HUD camera only draws the HUD.
    this.hudCam.ignore([
      this.map,
      this.footprints,
      this.outlines,
      this.fires,
      this.marker,
      this.lanternChain,
      ...(this.mapLantern ? [this.mapLantern] : []),
      ...this.tiles.map((t) => t.image),
      ...this.poiLabels.map((l) => l.text),
      ...this.herbIcons.map((h) => h.icon),
      ...this.fog.objects(),
    ]);
    this.cameras.main.setZoom(
      Phaser.Math.Clamp((this.registry.get('mapZoom') as number) ?? 1, MIN_ZOOM, MAX_ZOOM),
    );

    this.setupInput();
    this.layout();
    this.centerOn(parseHexKey(this.save.world.position));
    // Coming back from a fight next to the tower completes the quest.
    this.commit(this.save);
    this.introPanel = null;
    this.showIntro();

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.introPanel?.destroy();
      this.introPanel = null;
    });
  }

  override update(_t: number, deltaMs: number): void {
    this.time0 += deltaMs / 1000;
    this.drawMap(deltaMs / 1000);
    // DEV: "fog off" also clears the drifting clouds, so the tiles can be checked unobscured.
    this.fog.update(deltaMs / 1000, this.time0, (key) => isLit(this.save.world, key), !this.devReveal());
    const pos = hexToPixelFlat(parseHexKey(this.save.world.position), this.hexSize);
    this.marker.setPosition(pos.x, pos.y - Math.abs(Math.sin(this.time0 * 3)) * 3 * this.u);
    this.updateLantern();
  }

  /** Hangs the lantern from the watchman's hand and lets it sway with his bobbing. */
  private updateLantern(): void {
    const lantern = this.mapLantern;
    const chain = this.lanternChain;
    chain.clear();
    // The elder hands it over at the very first start; until then his hands are empty.
    const has = this.save.quests.fire !== 'offered' && this.marker.texture.key === CHARACTER_SPRITES.player.key;
    lantern?.setVisible(has);
    if (!lantern || !has) return;
    // Same hand and drop as in a fight, scaled to the size of the watchman on the map.
    const s = this.marker.scaleX;
    const centreY = this.marker.y - (0.78 - 0.5) * this.marker.height * s;
    const hx = this.marker.x + LANTERN.handX * s;
    const hy = centreY + LANTERN.handY * s;
    const lx = hx + Math.sin(this.time0 * 2.4) * 2 * s;
    const ly = hy + LANTERN.drop * s - Math.cos(this.time0 * 3) * 0.8 * s;
    const angle = Math.atan2(lx - hx, ly - hy);
    lantern.setPosition(lx, ly).setRotation(-angle).setScale(s * this.lanternLook.scale);
    chain.lineStyle(Math.max(1, s), 0x4a4038, 1).lineBetween(hx, hy, lx, ly);
  }

  // ---------------------------------------------------------------- first quest

  /** The very first start: the elder hands over the lantern and sends you to the watchfires. */
  private showIntro(): void {
    this.introPanel?.destroy();
    this.introPanel = null;
    if (this.save.quests.fire !== 'offered') return;
    const elder = VILLAGERS.elder;
    const { width: W, height: H } = this.scale;
    const panel = new DialoguePanel(
      this,
      { width: W, height: H, u: this.u, sa: this.sa },
      {
        name: elder.name,
        role: elder.role,
        color: elder.color,
        text: FIRE_QUEST.elder.offered,
        opaque: true,
        buttons: [
          { label: 'Take the lantern', icon: 'lantern-0', primary: true, onClick: () => this.acceptFire() },
        ],
      },
    );
    // The map camera zooms and scrolls; the panel belongs to the HUD camera only.
    this.cameras.main.ignore([...panel.getObjects()]);
    this.introPanel = panel;
  }

  private acceptFire(): void {
    this.introPanel?.destroy();
    this.introPanel = null;
    this.commit({ ...this.save, quests: acceptFireQuest(this.save.quests) });
    // The map opens from the dark.
    this.cameras.main.fadeIn(600, 12, 10, 18);
    this.hudCam.fadeIn(600, 12, 10, 18);
  }

  // ---------------------------------------------------------------- layout

  private onResize(): void {
    const pos = parseHexKey(this.save.world.position);
    this.layout();
    this.showIntro();
    this.centerOn(this.selected ?? pos);
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    this.cameras.main.setSize(W, H);
    this.hudCam.setSize(W, H);
    const cssSize = viewportSize();
    this.rs = W / cssSize.width;
    this.u = this.rs * Phaser.Math.Clamp(Math.min(cssSize.width, cssSize.height) / 400, 0.85, 1.25);
    const sa = safeArea();
    this.sa = {
      top: sa.top * this.rs,
      right: sa.right * this.rs,
      bottom: sa.bottom * this.rs,
      left: sa.left * this.rs,
    };
    if (this.tiles.length > 0) {
      // Pixel art stays crisp at whole-number scales.
      this.tileScale = Math.max(1, Math.round((30 * this.u) / (TILESET.faceWidth / 2)));
      this.hexSize = (TILESET.faceWidth / 2) * this.tileScale;
    } else {
      this.hexSize = 30 * this.u;
    }
    this.headerH = this.sa.top + 64 * this.u;
    // In landscape the button sits beside the text, so the panel can be much shorter.
    this.panelH = this.sa.bottom + (this.isWide() ? 112 : 184) * this.u;

    for (const { hex, image } of this.tiles) {
      const p = hexToPixelFlat(hex.hex, this.hexSize);
      image.setPosition(p.x, p.y).setScale(this.tileScale);
    }
    for (const { hex, text } of this.poiLabels) {
      const p = hexToPixelFlat(hex.hex, this.hexSize);
      text.setPosition(p.x, p.y).setFontSize(Math.round(15 * this.u));
    }
    for (const { hex, icon } of this.herbIcons) {
      const p = hexToPixelFlat(hex.hex, this.hexSize);
      // Bottom of the hex, so it does not cover point-of-interest glyphs or the player.
      icon.setPosition(p.x, p.y + this.hexSize * 0.58).setDisplaySize(11 * this.u, 12 * this.u);
    }
    for (const { hex, icon } of this.goalIcons) {
      const p = hexToPixelFlat(hex.hex, this.hexSize);
      // Top left of the hex: herbs sit at the bottom, the player and place symbols in the middle.
      icon
        .setPosition(p.x - this.hexSize * 0.42, p.y - this.hexSize * 0.48)
        .setDisplaySize(18 * this.u, 18 * this.u);
    }
    for (const { hex, icon } of this.rewardIcons) {
      const p = hexToPixelFlat(hex.hex, this.hexSize);
      // Top right, opposite the goal.
      icon
        .setPosition(p.x + this.hexSize * 0.42, p.y - this.hexSize * 0.48)
        .setDisplaySize(18 * this.u, 18 * this.u);
    }
    if (this.marker.texture.key === CHARACTER_SPRITES.player.key) {
      // The watchman fits on a hex with room to see the tile below.
      this.marker.setScale(this.tiles.length > 0 ? this.tileScale * 0.38 : 0.5 * this.u);
    } else {
      this.marker.setScale(1.1 * this.u);
    }
    this.layoutFog();
    this.buildHud();
  }

  /** Fits the fog to the map: its extent and the watchfire positions depend on the hex size. */
  private layoutFog(): void {
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const fires = new Map<string, { x: number; y: number }>();
    for (const h of this.world.hexes.values()) {
      const p = hexToPixelFlat(h.hex, this.hexSize);
      bounds.minX = Math.min(bounds.minX, p.x);
      bounds.minY = Math.min(bounds.minY, p.y);
      bounds.maxX = Math.max(bounds.maxX, p.x);
      bounds.maxY = Math.max(bounds.maxY, p.y);
      if (h.poi === 'watchfire' || h.poi === 'village') fires.set(h.key, p);
    }
    this.fog.layout(this.hexSize, bounds, fires);
  }

  private isWide(): boolean {
    return this.scale.width > this.scale.height * 1.3;
  }

  /** Centres the camera on a hex, inside the area between header and panel. */
  private centerOn(hex: Hex): void {
    const p = hexToPixelFlat(hex, this.hexSize);
    const cam = this.cameras.main;
    cam.centerOn(p.x, p.y + (this.panelH - this.headerH) / 2 / cam.zoom);
  }

  /** The world point under a screen point (independent of when the camera matrix updates). */
  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return {
      x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / cam.zoom,
      y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / cam.zoom,
    };
  }

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return {
      x: (wx - cam.scrollX - cam.width / 2) * cam.zoom + cam.width / 2,
      y: (wy - cam.scrollY - cam.height / 2) * cam.zoom + cam.height / 2,
    };
  }

  /** Zooms so that the world point (wx, wy) ends up under the screen point (sx, sy). */
  private zoomTo(zoom: number, wx: number, wy: number, sx: number, sy: number): void {
    const cam = this.cameras.main;
    const z = Phaser.Math.Clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    cam.setZoom(z);
    cam.setScroll(
      wx - cam.width / 2 - (sx - cam.width / 2) / z,
      wy - cam.height / 2 - (sy - cam.height / 2) / z,
    );
    this.registry.set('mapZoom', z);
  }

  /** Whether a screen point is on the map (not on the header or the bottom panel). */
  private onMapArea(y: number): boolean {
    return y >= this.headerH && y <= this.scale.height - this.panelH;
  }

  // ---------------------------------------------------------------- drawing

  private drawMap(deltaSec: number): void {
    const g = this.map;
    const u = this.u;
    const progress = this.save.world;
    this.updateLight(progress, deltaSec);
    const pulse = 0.55 + Math.sin(this.time0 * 4) * 0.35;
    const withTiles = this.tiles.length > 0;
    g.clear();
    const unexplored: { x: number; y: number }[] = [];

    for (const h of this.world.hexes.values()) {
      const p = hexToPixelFlat(h.hex, this.hexSize);
      const discovered = this.isVisible(h.key);
      if (!discovered) {
        unexplored.push(p);
        g.fillStyle(FOG_FILL, 1).lineStyle(1.5 * u, FOG_EDGE, 1);
      } else if (withTiles) continue;
      else {
        const fill = h.poi === 'village' ? VILLAGE_FILL : BIOMES[h.biome].color;
        const alpha = Phaser.Math.Linear(MAP_FOG.dim.fillAlpha, 0.85, this.lightOf(h.key));
        g.fillStyle(fill, alpha).lineStyle(1.5 * u, 0x0d0b12, 0.9);
      }
      this.hexPath(g, p.x, p.y, this.hexSize - 1.5 * u);
      g.fillPath().strokePath();
    }
    // The fog stays faint over unexplored hexes: they should look as black as ever.
    this.fog.drawCover(unexplored, FOG_FILL, this.hexSize - 1.5 * u);
    // Hexes that are not cleared and not next to you, the village or a lit watchfire are dimmed.
    for (const { hex, image } of this.tiles) {
      const discovered = this.isVisible(hex.key);
      image.setVisible(discovered);
      if (discovered) image.setTint(mixColor(MAP_FOG.dim.tint, 0xffffff, this.lightOf(hex.key)));
    }

    this.drawFootprints(progress);

    const o = this.outlines;
    o.clear();
    if (this.selected) {
      const p = hexToPixelFlat(this.selected, this.hexSize);
      o.lineStyle(3.5 * u, 0xffffff, 1);
      this.hexPath(o, p.x, p.y, this.hexSize - 3 * u);
      o.strokePath();
    }

    // Quest goals: a ring and a bobbing pin above the hex, visible through the fog.
    const bob = Math.sin(this.time0 * 3) * 3 * u;
    for (const key of questMarked(this.save.quests, this.world, progress)) {
      const p = hexToPixelFlat(parseHexKey(key), this.hexSize);
      o.lineStyle(3 * u, QUEST_COLOR, pulse);
      this.hexPath(o, p.x, p.y, this.hexSize - 6 * u);
      o.strokePath();
      const top = p.y - this.hexSize * 1.05 + bob;
      const s = 9 * u;
      o.fillStyle(0x000000, 0.5).fillCircle(p.x, top - s * 0.4, s * 1.25);
      o.fillStyle(QUEST_COLOR, 1).fillTriangle(p.x - s, top - s, p.x + s, top - s, p.x, top + s * 0.6);
      o.fillCircle(p.x, top - s, s);
      o.fillStyle(0x1c1917, 1).fillCircle(p.x, top - s, s * 0.4);
    }

    this.drawWatchfires();
    this.drawQuestArrows(pulse);

    for (const { hex, icon } of this.herbIcons) {
      icon.setVisible(this.isVisible(hex.key) && !isUsedUp(progress, hex.key));
      icon.setAlpha(Phaser.Math.Linear(MAP_FOG.dim.symbolAlpha, 1, this.lightOf(hex.key)));
    }
    // Goals change with every expedition, so the symbols follow the current one. They only show next to
    // the player.
    const at = parseHexKey(progress.position);
    for (const { hex, icon } of this.goalIcons) {
      const near = hexDistance(at, hex.hex) <= GOALS.iconReach;
      const shown = near && this.isVisible(hex.key) && !isUsedUp(progress, hex.key);
      icon.setVisible(shown);
      if (shown) {
        const goal = segmentForHex(hex, progress.expeditions, isLit(progress, hex.key)).goal;
        icon.setTexture(GOALS.icons[goal.kind]);
      }
    }
    // Rewards show where goals show: next to the player.
    for (const { hex, icon } of this.rewardIcons) {
      const near = hexDistance(at, hex.hex) <= GOALS.iconReach;
      const shown = near && this.isVisible(hex.key) && !isUsedUp(progress, hex.key);
      icon.setVisible(shown);
      const reward = shown ? segmentForHex(hex, progress.expeditions).reward : null;
      if (reward) icon.setTexture(REWARDS.icons[reward]);
    }
    for (const { hex, text } of this.poiLabels) {
      text.setVisible(this.isVisible(hex.key));
      text.setAlpha(Phaser.Math.Linear(MAP_FOG.dim.symbolAlpha, 1, this.lightOf(hex.key)));
      text.setColor(progress.waypoints.includes(hex.key) ? css(COLORS.accent) : '#ffffff');
    }
  }

  /** The way walked on this expedition. Only redrawn when the path, what is visible or the reveal switch changes. */
  private drawFootprints(progress: WorldProgress): void {
    const path = progress.expedition?.path ?? null;
    const reveal = this.devReveal(); // DEV: "fog off" shows the whole path.
    const last = this.footprintsFor;
    if (last && last.path === path && last.discovered === progress.discovered && last.reveal === reveal)
      return;
    if (!last || last.path !== path) this.footsteps = path ? footstepsOf(path) : [];
    this.footprintsFor = { path, discovered: progress.discovered, reveal };

    const g = this.footprints;
    g.clear();
    const size = this.hexSize;
    for (const step of this.footsteps) {
      if (!this.isVisible(step.key)) continue;
      // The foot turns a little outwards, like a real step.
      const angle = step.angle + step.side * 0.14;
      const x = step.x * size;
      const y = step.y * size;
      // A dark shadow first, so the print also shows on light tiles.
      g.fillStyle(FOOTSTEPS.shadowColor, step.alpha * FOOTSTEPS.shadowAlpha);
      this.fillPrint(g, x, y + FOOTSTEPS.shadowShift * size, angle, size);
      g.fillStyle(FOOTSTEPS.color, step.alpha);
      this.fillPrint(g, x, y, angle, size);
    }
  }

  /** One footprint: the ball of the foot and a smaller heel behind it. */
  private fillPrint(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number, size: number): void {
    this.fillOval(g, x, y, angle, FOOTSTEPS.length * size, FOOTSTEPS.width * size, 0.28, 0.55);
    this.fillOval(g, x, y, angle, FOOTSTEPS.length * size, FOOTSTEPS.width * size, -0.95, 0.38);
  }

  /**
   * A small filled oval for a footprint: `shift` moves it along the direction of the foot as a share of
   * `length`, `scale` shrinks it (the ball of the foot is the big oval, the heel a small one).
   */
  private fillOval(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    shift: number,
    scale: number,
  ): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const cx = x + cos * length * shift * 0.5;
    const cy = y + sin * length * shift * 0.5;
    const rx = (length * scale) / 2;
    const ry = (width * (scale < 0.4 ? 0.8 : 1)) / 2;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const t = (i / 10) * Math.PI * 2;
      const px = Math.cos(t) * rx;
      const py = Math.sin(t) * ry;
      const ox = cx + px * cos - py * sin;
      const oy = cy + px * sin + py * cos;
      if (i === 0) g.moveTo(ox, oy);
      else g.lineTo(ox, oy);
    }
    g.closePath();
    g.fillPath();
  }

  /** Eases the light level of every hex towards its target (bright or dimmed). */
  private updateLight(progress: WorldProgress, deltaSec: number): void {
    if (this.brightFor !== progress) {
      this.brightFor = progress;
      this.bright = brightHexes(this.world, progress);
    }
    const step = deltaSec / MAP_FOG.dim.fadeSec;
    const reveal = this.devReveal(); // DEV: "fog off" shows every tile at full brightness.
    for (const key of this.world.hexes.keys()) {
      const target = reveal || this.bright.has(key) ? 1 : 0;
      const now = this.light.get(key) ?? target;
      this.light.set(key, now < target ? Math.min(target, now + step) : Math.max(target, now - step));
    }
  }

  private lightOf(key: string): number {
    return this.light.get(key) ?? 1;
  }

  /**
   * Watchfires: a faint glow shows through the fog from far away; once explored you see a cold
   * brazier, and once lit a flickering fire with a warm light around it.
   */
  private drawWatchfires(): void {
    const g = this.fires;
    g.clear();
    const s = this.hexSize;
    const t = this.time0;
    for (const h of this.world.hexes.values()) {
      if (h.poi !== 'watchfire') continue;
      const p = hexToPixelFlat(h.hex, s);
      const flicker = 0.85 + Math.sin(t * 7 + h.hex.q) * 0.08 + Math.sin(t * 13 + h.hex.r) * 0.07;
      if (isLit(this.save.world, h.key)) {
        for (let i = 0; i < 6; i++)
          g.fillStyle(0xf59e0b, 0.08).fillCircle(p.x, p.y, s * (1.7 - i * 0.24) * flicker);
        this.drawBrazier(g, p.x, p.y, s, flicker, 1);
      } else if (this.isVisible(h.key)) {
        this.drawBrazier(g, p.x, p.y, s, flicker, 0.35);
      } else {
        // Seen from afar: only a glow in the dark.
        const glow = 0.5 + Math.sin(t * 2 + h.hex.q * 3) * 0.2;
        for (let i = 0; i < 4; i++)
          g.fillStyle(0xf97316, 0.07 * glow).fillCircle(p.x, p.y, s * (0.9 - i * 0.18));
        g.fillStyle(0xfdba74, 0.8 * glow).fillCircle(p.x, p.y, s * 0.08);
      }
    }
    this.drawNestFlame(g, hexToPixelFlat(ORIGIN, s));
  }

  /**
   * The flame of the Nest, drawn over the fire bowl painted on the village tile. Drawn in code, above
   * the fog, so it flickers and stays bright. Sizes are in pixels of the tile art (one tile pixel =
   * `tileScale` screen pixels); the bowl's rim sits half a pixel below the hex centre.
   */
  private drawNestFlame(g: Phaser.GameObjects.Graphics, center: { x: number; y: number }): void {
    const px = this.tiles.length > 0 ? this.tileScale : this.hexSize / 16;
    const t = this.time0;
    const flicker = 0.9 + Math.sin(t * 8) * 0.07 + Math.sin(t * 14 + 1) * 0.05;
    const sway = Math.sin(t * 5) * 0.7 * px;
    const x = center.x + px;
    const base = center.y - 0.5 * px;
    const h = 7.5 * px * flicker;
    g.fillStyle(0xdc4a0b, 0.95).fillTriangle(x - 3.5 * px, base, x + 3.5 * px, base, x + sway, base - h);
    g.fillStyle(0xf68c02, 1).fillTriangle(x - 2.6 * px, base, x + 2.6 * px, base, x + sway, base - h * 0.82);
    g.fillStyle(0xf1b81a, 1).fillTriangle(x - 1.8 * px, base, x + 1.8 * px, base, x + sway, base - h * 0.6);
    g.fillStyle(0xfbe7a2, 1).fillTriangle(x - 0.9 * px, base, x + 0.9 * px, base, x + sway, base - h * 0.34);
  }

  /** A stone brazier with a flame; `heat` 1 = burning, lower = embers only. */
  private drawBrazier(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    s: number,
    flicker: number,
    heat: number,
  ): void {
    const base = y + s * 0.25;
    g.fillStyle(0x1c1917, 0.6).fillEllipse(x, base + s * 0.12, s * 0.7, s * 0.2);
    g.fillStyle(0x57534e, 1).fillRect(x - s * 0.06, base - s * 0.2, s * 0.12, s * 0.32);
    g.fillStyle(0x78716c, 1).fillEllipse(x, base - s * 0.22, s * 0.5, s * 0.16);
    const fh = s * 0.7 * flicker * heat;
    const top = base - s * 0.26;
    g.fillStyle(0xea580c, 0.9).fillTriangle(x - s * 0.18, top, x + s * 0.18, top, x, top - fh);
    g.fillStyle(0xfacc15, 0.95).fillTriangle(x - s * 0.1, top, x + s * 0.1, top, x, top - fh * 0.65);
    if (heat >= 1)
      g.fillStyle(0xfef9c3, 1).fillTriangle(x - s * 0.04, top, x + s * 0.04, top, x, top - fh * 0.35);
  }

  /** Quest goals off screen get an arrow at the edge of the map area, pointing towards them. */
  private drawQuestArrows(pulse: number): void {
    const g = this.questArrows;
    g.clear();
    const u = this.u;
    const { width: W, height: H } = this.scale;
    const inset = 26 * u;
    const left = this.sa.left + inset;
    const right = W - this.sa.right - inset;
    const top = this.headerH + inset;
    const bottom = H - this.panelH - inset;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    for (const key of questMarked(this.save.quests, this.world, this.save.world)) {
      const p = hexToPixelFlat(parseHexKey(key), this.hexSize);
      const { x: sx, y: sy } = this.worldToScreen(p.x, p.y);
      if (sx >= left && sx <= right && sy >= top && sy <= bottom) continue;
      const angle = Math.atan2(sy - cy, sx - cx);
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      // Walk along the direction until the inset map area is hit.
      const tx = dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity;
      const ty = dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity;
      const t = Math.min(tx, ty);
      const x = cx + dx * t;
      const y = cy + dy * t;
      const size = 12 * u * (0.9 + pulse * 0.2);
      const tip = { x: x + dx * size * 1.2, y: y + dy * size * 1.2 };
      const back = { x: x - dx * size * 0.7, y: y - dy * size * 0.7 };
      const side = { x: -dy * size * 0.65, y: dx * size * 0.65 };
      g.fillStyle(0x000000, 0.55).fillCircle(x, y, size * 1.3);
      g.fillStyle(QUEST_COLOR, 1).fillTriangle(
        tip.x,
        tip.y,
        back.x + side.x,
        back.y + side.y,
        back.x - side.x,
        back.y - side.y,
      );
    }
  }

  /** Whether a hex is shown. Dev mode can lift the fog for testing; travel rules stay the same. */
  private isVisible(key: string): boolean {
    return (
      this.devReveal() || // DEV:
      isDiscovered(this.save.world, key) ||
      questRevealed(this.save.quests, this.world, this.save.world).includes(key)
    );
  }

  // DEV: the map reveal toggle.
  private devReveal(): boolean {
    return isDevMode() && this.registry.get('devReveal') === true;
  }

  /** Tile variant for a hex: points of interest have their own tile, others vary by position. */
  private tileFrame(h: WorldHex): number {
    const poiTile = h.poi ? POI_TILES[h.poi] : undefined;
    if (poiTile !== undefined) return poiTile;
    const variants = BIOME_TILES[h.biome];
    return variants[hash32(this.world.seed, 77, h.hex.q, h.hex.r) % variants.length];
  }

  /** Flat-top hexagon outline. */
  private hexPath(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Phaser.Math.DegToRad(60 * i);
      const px = x + size * Math.cos(a);
      const py = y + size * Math.sin(a);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }

  // ---------------------------------------------------------------- HUD (fixed to the screen)

  private fixed<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor>(
    o: T,
  ): T {
    o.setScrollFactor(0);
    this.cameras.main.ignore(o);
    this.hud.push(o);
    return o;
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    opts: Phaser.Types.GameObjects.Text.TextStyle = {},
  ) {
    return this.fixed(
      this.add
        .text(x, y, value, {
          fontFamily: FONT,
          fontSize: `${Math.round(size * this.u)}px`,
          color: '#ffffff',
          ...opts,
        })
        .setDepth(11),
    );
  }

  private buildHud(): void {
    for (const o of this.hud) o.destroy();
    this.hud = [];
    const { width: W, height: H } = this.scale;
    const u = this.u;
    const left = this.sa.left + 16 * u;

    const header = this.fixed(this.add.graphics().setDepth(10));
    header.fillStyle(COLORS.bg, 0.92).fillRect(0, 0, W, this.headerH);
    this.text(left, this.sa.top + 12 * u, 'NIGHTWATCH', 20, {
      fontStyle: 'bold',
      color: css(COLORS.accent),
    });
    if (isDevMode()) this.devRevealButton(W - this.sa.right - 16 * u, this.sa.top + 14 * u); // DEV:
    if (questGoals(this.save.quests, this.world, this.save.world).length > 0) {
      this.trackingButton(W - this.sa.right - 16 * u, this.headerH + 10 * u);
    }
    this.text(left, this.sa.top + 38 * u, this.statusLine(), 12, {
      color: '#a1a1aa',
    });

    const panelY = H - this.panelH;
    const panel = this.fixed(this.add.graphics().setDepth(10));
    panel.fillStyle(COLORS.panel, 0.97).fillRect(0, panelY, W, this.panelH);
    panel.lineStyle(2 * u, COLORS.panelEdge, 1).lineBetween(0, panelY, W, panelY);

    const info = this.describeSelection();
    const textW = this.isWide() ? W - left - 280 * u : W - left * 2;
    // DEV: jump to the selected hex without a fight.
    if (isDevMode() && this.selected && hexKey(this.selected) !== this.save.world.position) {
      const right = W - this.sa.right - 16 * u;
      this.devJumpButton(this.isWide() ? right - 240 * u : right, panelY + 12 * u, this.selected);
    }
    const title = this.text(left, panelY + 16 * u, info.title, 18, { fontStyle: 'bold' });
    // The goal's and the reward's symbols follow the title.
    let iconX = title.x + title.width + 8 * u;
    for (const texture of [info.goalIcon, info.rewardIcon]) {
      if (!texture) continue;
      const size = 20 * u;
      this.hud.push(
        this.fixed(
          this.add
            .image(iconX + size / 2, title.y + title.height / 2, texture)
            .setDisplaySize(size, size)
            .setDepth(11),
        ),
      );
      iconX += size + 6 * u;
    }
    const detail = this.text(left, panelY + 44 * u, info.detail, 13, {
      color: '#c4c0cf',
      wordWrap: { width: textW },
    });
    if (info.herbs) {
      this.text(left, detail.y + detail.height + 6 * u, info.herbs.text, 13, {
        fontStyle: 'bold',
        color: css(info.herbs.color),
        wordWrap: { width: textW },
      });
    }
    if (info.action) {
      if (this.isWide()) {
        const right = W - this.sa.right - 16 * u;
        this.button(right - 110 * u, panelY + 52 * u, info.action.label, info.action.run);
      } else {
        this.button(W / 2, panelY + 138 * u, info.action.label, info.action.run);
      }
    }
  }

  // DEV: moves the player to any hex; the expedition and its loot stay.
  private devJumpButton(x: number, y: number, hex: Hex): void {
    const t = this.text(x, y, 'DEV  jump here', 12, devButtonStyle(this.u)).setOrigin(1, 0);
    t.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      const next = jumpTo(this.world, this.save, hex);
      this.commit(next);
      this.centerOn(parseHexKey(next.world.position));
    });
  }

  /** Switches the quest marks (ring, pin, edge arrow) on the map on and off. */
  private trackingButton(x: number, y: number): void {
    const u = this.u;
    const on = this.save.quests.tracked;
    const t = this.text(x, y, on ? '◆  Quest marks on' : '◇  Quest marks off', 12, {
      fontStyle: 'bold',
      color: on ? '#1c1917' : '#d8b4fe',
      backgroundColor: on ? css(QUEST_COLOR) : '#2e1065',
      padding: { x: Math.round(10 * u), y: Math.round(7 * u) },
    }).setOrigin(1, 0);
    t.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.save = { ...this.save, quests: toggleTracking(this.save.quests) };
      writeSave(safeStorage(), this.save);
      this.buildHud();
    });
  }

  /** Dev mode only: shows the whole map without saving anything as discovered. */
  // DEV: lifts the fog on screen only; nothing is saved as discovered.
  private devRevealButton(x: number, y: number): void {
    const on = this.devReveal();
    const t = this.text(x, y, on ? 'DEV  fog off' : 'DEV  reveal', 12, devButtonStyle(this.u, on)).setOrigin(
      1,
      0,
    );
    t.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.registry.set('devReveal', !on);
      this.buildHud();
    });
  }

  /** Header line: the expedition while out, otherwise the season summary. */
  private statusLine(): string {
    const exp = this.save.world.expedition;
    if (exp) {
      const b = exp.build;
      const hp = b
        ? `HP ${Math.ceil(b.hp)}/${computePlayerStats(b.loadout, deedBonus(this.save.deeds)).maxHp} · Level ${b.level}`
        : 'Fresh start';
      const loot = lootCount(exp.loot);
      return `Expedition · ${hp} · ${exp.areasCleared} areas${loot > 0 ? ` · ${loot} loot` : ''}`;
    }
    return `${plural(this.save.segmentsCleared, 'area')} cleared · ${plural(this.save.world.waypoints.length, 'waypoint')}`;
  }

  private describeSelection(): {
    title: string;
    detail: string;
    /** Which herbs grow in the selected hex */
    herbs?: { text: string; color: number };
    /** Symbol of the fight goal, shown next to the title */
    goalIcon?: string;
    /** Symbol of the reward, next to the goal's */
    rewardIcon?: string;
    action?: { label: string; run: () => void };
  } {
    const progress = this.save.world;
    if (!this.selected && isAtHome(progress)) {
      return {
        title: 'Village',
        detail: 'Tap a glowing hex to set out. Camps you reach become waypoints you can travel to from here.',
        action: { label: 'Enter village', run: () => this.enterVillage() },
      };
    }
    const goHome = { label: 'Return to village', run: () => this.goHome() };
    if (!this.selected) {
      return {
        title: 'Choose your path',
        detail: 'Tap a glowing hex next to you to move on, or go home and keep all your loot.',
        action: goHome,
      };
    }
    const key = hexKey(this.selected);
    const h = this.world.hexes.get(key);
    if (!h || !this.isVisible(key)) {
      if (h?.poi === 'watchfire') {
        return {
          title: 'A distant glow',
          detail: 'Something burns out there in the dark. Travel closer to find out what it is.',
        };
      }
      return { title: 'Unknown land', detail: 'Explore further to reveal what lies here.' };
    }
    const forecast = herbForecast(h.biome, h.ring);
    // Only some hexes have herbs; the others say nothing about them.
    const herbs = h.herbs
      ? {
          text:
            `Herbs: ${forecast.count} ${forecast.common.name}` +
            (forecast.rare.length > 0
              ? ` · rare ${forecast.rare.map((r) => r.name).join(', ')} possible`
              : ''),
          color: forecast.common.color,
        }
      : undefined;
    const kind: TravelKind = travelKind(this.world, progress, this.selected);
    const here = hexEquals(this.selected, parseHexKey(progress.position));
    if (h.poi === 'tower') {
      const stage = this.save.quests.tower;
      return {
        title: POIS.tower.name,
        detail:
          stage === 'done'
            ? TOWER_QUEST.towerSealed
            : stage === 'active'
              ? `Ring ${h.ring} · Quest goal. ${TOWER_QUEST.towerFar}`
              : `Ring ${h.ring} · An old tower at the edge of the land.`,
      };
    }
    if (h.poi === 'village') {
      const homeAction =
        kind === 'walk'
          ? { label: 'Go home', run: () => this.walkHome(h.hex) }
          : kind === 'teleport'
            ? { label: 'Return to village', run: () => this.teleport(h.hex) }
            : undefined;
      return {
        title: 'Village',
        detail: here
          ? 'You are home. Safe from the night. Visit your stash before setting out.'
          : homeAction
            ? 'Going home ends the expedition. You keep all your loot.'
            : 'Your home. No monsters here.',
        action: here ? { label: 'Enter village', run: () => this.enterVillage() } : homeAction,
      };
    }
    if (kind === 'teleport') {
      return {
        title: `${BIOMES[h.biome].name} · Camp`,
        detail: `Waypoint · Ring ${h.ring}. Travel here to start a new expedition from this camp.`,
        herbs,
        action: { label: 'Travel here', run: () => this.teleport(h.hex) },
      };
    }
    if (here && h.poi === 'camp' && progress.waypoints.includes(key)) {
      return {
        title: `${BIOMES[h.biome].name} · Camp`,
        detail: 'A safe camp. Move on, or go home and keep your loot.',
        herbs,
        action: goHome,
      };
    }
    if (isUsedUp(progress, key)) {
      return {
        title: `${BIOMES[h.biome].name}${h.poi ? ` · ${POIS[h.poi].name}` : ''}`,
        detail:
          (h.poi === 'watchfire' && isLit(progress, key) ? 'The watchfire burns. ' : '') +
          (here
            ? 'You are here. Move on, or go home and keep all your loot.'
            : 'Cleared on this expedition: empty until you return home. Walk through without a fight.'),
        action: here
          ? goHome
          : kind === 'walk'
            ? { label: 'Walk here', run: () => this.walkThrough(h.hex) }
            : undefined,
      };
    }
    const seg = segmentForHex(h, progress.expeditions, isLit(progress, key));
    const poi = h.poi ? ` · ${POIS[h.poi].name}` : '';
    const fireNote =
      h.poi !== 'watchfire'
        ? ''
        : isLit(progress, key)
          ? 'The watchfire burns. '
          : 'Cold watchfire: find it in the dark and light it. ';
    const status =
      fireNote +
      (here ? 'You are here.' : kind === 'blocked' ? 'Too far: travel to a hex next to it first.' : '');
    return {
      title: `${BIOMES[h.biome].name}${poi}`,
      goalIcon: GOALS.icons[seg.goal.kind],
      rewardIcon: seg.reward ? REWARDS.icons[seg.reward] : undefined,
      detail:
        `Ring ${h.ring} · ${goalLabel(seg.goal)}${seg.reward ? ` · ${rewardLabel(seg.reward)}` : ''}${isCleared(progress, key) ? ' · cleared before' : ''}\n${status}`.trim(),
      herbs,
      action:
        kind === 'fight' ? { label: 'Enter area', run: () => this.fight(h.hex) } : here ? goHome : undefined,
    };
  }

  private button(x: number, y: number, label: string, onClick: () => void): void {
    const u = this.u;
    const w = 220 * u;
    const h = 48 * u;
    const g = this.fixed(this.add.graphics().setDepth(11));
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(COLORS.accent, hover ? 1 : 0.92).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12 * u);
    };
    draw(false);
    this.text(x, y, label, 17, { fontStyle: 'bold', color: '#1c1917' }).setOrigin(0.5).setDepth(12);
    const zone = this.fixed(this.add.zone(x, y, w, h).setDepth(13).setInteractive({ useHandCursor: true }));
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerup', onClick);
  }

  // ---------------------------------------------------------------- input & actions

  private setupInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      if (p.wasTouch && this.onMapArea(p.y)) {
        this.touches.set(p.id, { x: p.x, y: p.y });
        if (this.touches.size === 2) this.startPinch();
      }
      if (this.drag || this.pinch) return;
      const cam = this.cameras.main;
      this.drag = {
        id: p.id,
        startX: p.x,
        startY: p.y,
        scrollX: cam.scrollX,
        scrollY: cam.scrollY,
        moved: false,
      };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.touches.has(p.id)) {
        this.touches.set(p.id, { x: p.x, y: p.y });
        if (this.pinch) {
          this.updatePinch();
          return;
        }
      }
      const d = this.drag;
      if (!d || p.id !== d.id) return;
      if (!d.moved && Math.hypot(p.x - d.startX, p.y - d.startY) > DRAG_THRESHOLD * this.rs) d.moved = true;
      const zoom = this.cameras.main.zoom;
      if (d.moved) {
        this.cameras.main.setScroll(d.scrollX - (p.x - d.startX) / zoom, d.scrollY - (p.y - d.startY) / zoom);
      }
    });
    // Mouse wheel and touchpad: zoom around the pointer. A touchpad pinch arrives as a wheel
    // event with the ctrl key held and small steps, so it gets a stronger factor.
    this.input.on('wheel', (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (!this.onMapArea(p.y)) return;
      const pinchGesture = (p.event as WheelEvent | undefined)?.ctrlKey ?? false;
      const factor = Math.exp(-dy * (pinchGesture ? 0.01 : 0.0015));
      const w = this.screenToWorld(p.x, p.y);
      this.zoomTo(this.cameras.main.zoom * factor, w.x, w.y, p.x, p.y);
    });
    const release = (p: Phaser.Input.Pointer) => {
      this.touches.delete(p.id);
      if (this.pinch) {
        // Lifting a finger ends the pinch; nothing is selected until all fingers are up.
        if (this.touches.size < 2) this.pinch = null;
        return;
      }
      const d = this.drag;
      if (!d || p.id !== d.id) return;
      this.drag = null;
      if (d.moved || p.y > this.scale.height - this.panelH || p.y < this.headerH) return;
      const world = this.cameras.main.getWorldPoint(p.x, p.y);
      const hex = pixelToHexFlat(world.x, world.y, this.hexSize);
      if (!this.world.hexes.has(hexKey(hex))) return;
      this.selected = hex;
      this.buildHud();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (!this.selected) return;
      const kind = travelKind(this.world, this.save.world, this.selected);
      if (kind === 'fight') this.fight(this.selected);
      else if (kind === 'walk') this.walk(this.selected);
      else if (kind === 'teleport') this.teleport(this.selected);
    });
  }

  private startPinch(): void {
    const [a, b] = [...this.touches.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const w = this.screenToWorld(mid.x, mid.y);
    this.pinch = {
      startDistance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startZoom: this.cameras.main.zoom,
      worldX: w.x,
      worldY: w.y,
    };
    this.drag = null;
  }

  private updatePinch(): void {
    const pinch = this.pinch;
    if (!pinch || this.touches.size < 2) return;
    const [a, b] = [...this.touches.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.zoomTo((pinch.startZoom * distance) / pinch.startDistance, pinch.worldX, pinch.worldY, mid.x, mid.y);
  }

  private fight(hex: Hex): void {
    const data: GameSceneData = { hexKey: hexKey(hex) };
    this.scene.start('Game', data);
  }

  private walkHome(hex: Hex): void {
    this.arriveHome(walkHome(this.save, hex));
  }

  /** Walking without a fight: into the village, or back through a hex cleared on this expedition. */
  private walk(hex: Hex): void {
    if (this.world.hexes.get(hexKey(hex))?.poi === 'village') this.walkHome(hex);
    else this.walkThrough(hex);
  }

  private walkThrough(hex: Hex): void {
    this.commit(walkThrough(this.save, hex));
    this.centerOn(hex);
  }

  /** Going home from anywhere: keeps all the loot (portal scrolls could cost something later). */
  private goHome(): void {
    this.arriveHome(returnHome(this.save));
  }

  private teleport(hex: Hex): void {
    const next = teleport(this.save, hex);
    if (next.world.position === '0,0') {
      this.arriveHome(next);
      return;
    }
    this.commit(next);
    this.centerOn(hex);
  }

  /** Coming home ends the expedition: save, then show what was brought back. */
  private arriveHome(next: SaveData): void {
    const kept = lootGained(this.save.stash, next.stash);
    this.commit(next);
    const data: VillageSceneData = { arrival: { reason: 'returned', kept, lost: {} } };
    this.scene.start('Village', data);
  }

  private enterVillage(): void {
    this.scene.start('Village');
  }

  private commit(next: SaveData): void {
    // Standing next to the tower completes the quest: show its sealed gate.
    const quests = questsAfterMove(next.quests, this.world, next.world);
    const reachedTower = quests !== next.quests;
    // Deeds earned on the map: reaching the tower, or progress made before deeds existed.
    const { save, earned } = earnDeeds(reachedTower ? { ...next, quests } : next, this.world);
    this.save = save;
    writeSave(safeStorage(), this.save);
    this.selected = reachedTower ? parseHexKey(this.world.tower) : null;
    this.buildHud();
    if (earned.length > 0) this.showDeedToast(describeEarned(earned));
  }

  /** A notice below the header that fades out after a few seconds. */
  private showDeedToast(message: string): void {
    const u = this.u;
    this.deedToast?.destroy();
    const toast = this.add
      .text(this.scale.width / 2, this.headerH + 56 * u, message, {
        fontFamily: FONT,
        fontSize: `${Math.round(14 * u)}px`,
        fontStyle: 'bold',
        color: css(COLORS.accent),
        backgroundColor: '#1c1917',
        align: 'center',
        padding: { x: Math.round(14 * u), y: Math.round(9 * u) },
        wordWrap: { width: this.scale.width - this.sa.left - this.sa.right - 48 * u },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(12);
    this.cameras.main.ignore(toast);
    this.deedToast = toast;
    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: 4500,
      duration: 900,
      onComplete: () => {
        toast.destroy();
        if (this.deedToast === toast) this.deedToast = null;
      },
    });
  }
}

/** Blends two 0xRRGGBB colours: `t` = 0 gives `a`, 1 gives `b`. */
function mixColor(a: number, b: number, t: number): number {
  const channel = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
