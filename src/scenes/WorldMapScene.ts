import * as Phaser from 'phaser';
import { BIOMES, POIS } from '../config/world';
import { TOWER_QUEST } from '../config/quests';
import { herbForecast } from '../logic/herbs';
import { questMarked, questRevealed, questsAfterMove } from '../logic/quests';
import { BIOME_TILES, POI_TILES, TILESET } from '../config/tiles';
import { hexEquals, hexKey, hexToPixelFlat, parseHexKey, pixelToHexFlat, type Hex } from '../logic/hex';
import { hash32 } from '../logic/rng';
import { formatTime } from '../logic/progression';
import { loadSave, safeStorage, writeSave, type SaveData } from '../logic/save';
import { lootCount, lootGained } from '../logic/expedition';
import { returnHome, teleport, walkHome, walkThrough } from '../logic/journey';
import { computePlayerStats } from '../logic/stats';
import {
  isAtHome,
  isCleared,
  isDiscovered,
  isUsedUp,
  travelKind,
  type TravelKind,
} from '../logic/worldProgress';
import { seasonWorld, segmentForHex, type World, type WorldHex } from '../logic/worldgen';
import { isDevMode } from '../ui/dev';
import { safeArea, viewportSize, type SafeArea } from '../ui/display';
import { COLORS, css, FONT } from '../ui/theme';
import type { GameSceneData } from './GameScene';
import type { VillageSceneData } from './VillageScene';

const FOG_FILL = 0x17141f;
const FOG_EDGE = 0x2b2638;
const VILLAGE_FILL = 0x8a6a2a;
/** Pointer movement (in CSS px) after which a touch counts as dragging the map */
const DRAG_THRESHOLD = 8;
/** Darkens hexes cleared on this expedition */
const USED_TINT = 0x4d4d57;
/** Ring and pin colour for quest goals on the map */
const QUEST_COLOR = 0xc084fc;

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
  /** Travel targets and selection, above the tiles */
  private outlines!: Phaser.GameObjects.Graphics;
  /** Arrows at the screen edge pointing to quest goals that are off screen */
  private questArrows!: Phaser.GameObjects.Graphics;
  /** One tile image per hex (empty when the tile art could not be loaded) */
  private tiles: { hex: WorldHex; image: Phaser.GameObjects.Image }[] = [];
  private tileScale = 1;
  private poiLabels: { hex: WorldHex; text: Phaser.GameObjects.Text }[] = [];
  /** A small herb in each hex that shows which herb grows there */
  private herbIcons: { hex: WorldHex; icon: Phaser.GameObjects.Image }[] = [];
  private marker!: Phaser.GameObjects.Image;
  private hud: Phaser.GameObjects.GameObject[] = [];
  private drag: DragState | null = null;
  private u = 1;
  private rs = 1;
  private sa: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  private hexSize = 30;
  private headerH = 0;
  private panelH = 0;
  private time0 = 0;

  constructor() {
    super('WorldMap');
  }

  create(): void {
    this.world = seasonWorld();
    this.save = loadSave(safeStorage());
    this.selected = null;
    this.poiLabels = [];
    this.herbIcons = [];
    this.tiles = [];
    this.hud = [];
    this.drag = null;

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.map = this.add.graphics().setDepth(-1);
    this.outlines = this.add.graphics().setDepth(0.5);
    this.questArrows = this.add.graphics().setDepth(9).setScrollFactor(0);
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
      if (!h.poi || (this.tiles.length > 0 && POI_TILES[h.poi] !== undefined)) continue;
      const text = this.add
        .text(0, 0, POIS[h.poi].glyph, {
          fontFamily: FONT,
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(2);
      this.poiLabels.push({ hex: h, text });
    }
    for (const h of this.world.hexes.values()) {
      if (!h.herbs) continue;
      const icon = this.add
        .image(0, 0, 'herb')
        .setTint(herbForecast(h.biome, h.ring).common.color)
        .setDepth(1);
      this.herbIcons.push({ hex: h, icon });
    }
    this.marker = this.add.image(0, 0, 'player').setDepth(3);

    this.setupInput();
    this.layout();
    this.centerOn(parseHexKey(this.save.world.position));
    // Coming back from a fight next to the tower completes the quest.
    this.commit(this.save);

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
  }

  override update(_t: number, deltaMs: number): void {
    this.time0 += deltaMs / 1000;
    this.drawMap();
    const pos = hexToPixelFlat(parseHexKey(this.save.world.position), this.hexSize);
    this.marker.setPosition(pos.x, pos.y - Math.abs(Math.sin(this.time0 * 3)) * 3 * this.u);
  }

  // ---------------------------------------------------------------- layout

  private onResize(): void {
    const pos = parseHexKey(this.save.world.position);
    this.layout();
    this.centerOn(this.selected ?? pos);
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    this.cameras.main.setSize(W, H);
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
    this.panelH = this.sa.bottom + (this.isWide() ? 112 : 172) * this.u;

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
    this.marker.setScale(1.1 * this.u);
    this.buildHud();
  }

  private isWide(): boolean {
    return this.scale.width > this.scale.height * 1.3;
  }

  /** Centres the camera on a hex, inside the area between header and panel. */
  private centerOn(hex: Hex): void {
    const p = hexToPixelFlat(hex, this.hexSize);
    this.cameras.main.centerOn(p.x, p.y + (this.panelH - this.headerH) / 2);
  }

  // ---------------------------------------------------------------- drawing

  private drawMap(): void {
    const g = this.map;
    const u = this.u;
    const progress = this.save.world;
    const targets = new Set(
      [...this.world.hexes.values()]
        .filter((h) => isDiscovered(progress, h.key) && travelKind(this.world, progress, h.hex) !== 'blocked')
        .map((h) => h.key),
    );
    const pulse = 0.55 + Math.sin(this.time0 * 4) * 0.35;
    const withTiles = this.tiles.length > 0;
    g.clear();

    for (const h of this.world.hexes.values()) {
      const p = hexToPixelFlat(h.hex, this.hexSize);
      const discovered = this.isVisible(h.key);
      if (!discovered) g.fillStyle(FOG_FILL, 1).lineStyle(1.5 * u, FOG_EDGE, 1);
      else if (withTiles) continue;
      else {
        const fill = h.poi === 'village' ? VILLAGE_FILL : BIOMES[h.biome].color;
        g.fillStyle(fill, isUsedUp(progress, h.key) ? 0.25 : 0.85).lineStyle(1.5 * u, 0x0d0b12, 0.9);
      }
      this.hexPath(g, p.x, p.y, this.hexSize - 1.5 * u);
      g.fillPath().strokePath();
    }
    // Hexes cleared on this expedition are greyed out: used up until you return home.
    for (const { hex, image } of this.tiles) {
      const discovered = this.isVisible(hex.key);
      image.setVisible(discovered);
      if (discovered) image.setTint(isUsedUp(progress, hex.key) ? USED_TINT : 0xffffff);
    }

    const o = this.outlines;
    o.clear();
    for (const key of targets) {
      const p = hexToPixelFlat(parseHexKey(key), this.hexSize);
      o.lineStyle(3 * u, COLORS.accent, pulse);
      this.hexPath(o, p.x, p.y, this.hexSize - 3 * u);
      o.strokePath();
    }

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

    this.drawQuestArrows(pulse);

    for (const { hex, icon } of this.herbIcons) {
      icon.setVisible(this.isVisible(hex.key) && !isUsedUp(progress, hex.key));
    }
    for (const { hex, text } of this.poiLabels) {
      text.setVisible(this.isVisible(hex.key));
      text.setColor(progress.waypoints.includes(hex.key) ? css(COLORS.accent) : '#ffffff');
    }
  }

  /** Quest goals off screen get an arrow at the edge of the map area, pointing towards them. */
  private drawQuestArrows(pulse: number): void {
    const g = this.questArrows;
    g.clear();
    const u = this.u;
    const cam = this.cameras.main;
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
      const sx = p.x - cam.scrollX;
      const sy = p.y - cam.scrollY;
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
      this.devReveal() ||
      isDiscovered(this.save.world, key) ||
      questRevealed(this.save.quests, this.world).includes(key)
    );
  }

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
    if (isDevMode()) this.devRevealButton(W - this.sa.right - 16 * u, this.sa.top + 14 * u);
    this.text(left, this.sa.top + 38 * u, this.statusLine(), 12, {
      color: '#a1a1aa',
    });

    const panelY = H - this.panelH;
    const panel = this.fixed(this.add.graphics().setDepth(10));
    panel.fillStyle(COLORS.panel, 0.97).fillRect(0, panelY, W, this.panelH);
    panel.lineStyle(2 * u, COLORS.panelEdge, 1).lineBetween(0, panelY, W, panelY);

    const info = this.describeSelection();
    const textW = this.isWide() ? W - left - 280 * u : W - left * 2;
    this.text(left, panelY + 16 * u, info.title, 18, { fontStyle: 'bold' });
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
        this.button(W / 2, panelY + 126 * u, info.action.label, info.action.run);
      }
    }
  }

  /** Dev mode only: shows the whole map without saving anything as discovered. */
  private devRevealButton(x: number, y: number): void {
    const u = this.u;
    const on = this.devReveal();
    const t = this.text(x, y, on ? 'DEV  fog off' : 'DEV  reveal', 12, {
      fontStyle: 'bold',
      color: '#f0abfc',
      backgroundColor: on ? '#6b21a8' : '#3b0764',
      padding: { x: Math.round(10 * u), y: Math.round(7 * u) },
    }).setOrigin(1, 0);
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
        ? `HP ${Math.ceil(b.hp)}/${computePlayerStats(b.loadout).maxHp} · Level ${b.level}`
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
        detail: here
          ? 'You are here. Move on, or go home and keep all your loot.'
          : 'Cleared on this expedition: empty until you return home. Walk through without a fight.',
        action: here
          ? goHome
          : kind === 'walk'
            ? { label: 'Walk here', run: () => this.walkThrough(h.hex) }
            : undefined,
      };
    }
    const seg = segmentForHex(h);
    const poi = h.poi ? ` · ${POIS[h.poi].name}` : '';
    const status = here
      ? 'You are here.'
      : kind === 'blocked'
        ? 'Too far: travel to a hex next to it first.'
        : '';
    return {
      title: `${BIOMES[h.biome].name}${poi}`,
      detail:
        `Ring ${h.ring} · Survive ${formatTime(seg.durationSec)}${isCleared(progress, key) ? ' · cleared before' : ''}\n${status}`.trim(),
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
      if (over.length > 0 || this.drag) return;
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
      const d = this.drag;
      if (!d || p.id !== d.id) return;
      if (!d.moved && Math.hypot(p.x - d.startX, p.y - d.startY) > DRAG_THRESHOLD * this.rs) d.moved = true;
      if (d.moved) this.cameras.main.setScroll(d.scrollX - (p.x - d.startX), d.scrollY - (p.y - d.startY));
    });
    const release = (p: Phaser.Input.Pointer) => {
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
    this.save = reachedTower ? { ...next, quests } : next;
    writeSave(safeStorage(), this.save);
    this.selected = reachedTower ? parseHexKey(this.world.tower) : null;
    this.buildHud();
  }
}
