import * as Phaser from 'phaser';
import { GROUND_TEXTURES } from '../config/ground';
import { LANTERN_LOOKS } from '../config/merchant';
import { CHARACTER_SPRITES, dieAnim, SHEET, walkAnim, type Facing } from '../config/sprites';
import { TILESET } from '../config/tiles';
import { COLORS } from '../ui/theme';

type G = Phaser.GameObjects.Graphics;

/**
 * Generates placeholder graphics in code so the prototype runs without asset files.
 * Later: load real sprites from public/assets (this.load.image / atlas) and replace these.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Tile art for the world map. If it is missing (e.g. in the single-file build), the map
    // falls back to plain coloured hexes.
    this.load.spritesheet(TILESET.key, TILESET.path, {
      frameWidth: TILESET.frameWidth,
      frameHeight: TILESET.frameHeight,
    });
    // Ground tiles for fights. A biome without its tile falls back to the grey placeholder ground.
    for (const ground of Object.values(GROUND_TEXTURES)) this.load.image(ground.key, ground.path);
    // Animated characters for fights. Missing sheets fall back to the placeholder graphics below.
    for (const sprite of Object.values(CHARACTER_SPRITES)) {
      this.load.spritesheet(sprite.key, sprite.path, {
        frameWidth: SHEET.frameSize,
        frameHeight: SHEET.frameSize,
      });
    }
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => undefined);
  }

  /** Walk animations (one per facing) and the death animation for every loaded character sheet. */
  private makeCharacterAnims(): void {
    for (const sprite of Object.values(CHARACTER_SPRITES)) {
      if (!this.textures.exists(sprite.key)) continue;
      this.textures.get(sprite.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (const facing of ['up', 'left', 'down', 'right'] as Facing[]) {
        const start = SHEET.rows[facing] * SHEET.columns;
        if (this.anims.exists(walkAnim(sprite.key, facing))) continue;
        this.anims.create({
          key: walkAnim(sprite.key, facing),
          // Frame 0 is the standing pose; the walk cycle is frames 1..8.
          frames: this.anims.generateFrameNumbers(sprite.key, {
            start: start + 1,
            end: start + SHEET.walkFrames - 1,
          }),
          frameRate: sprite.walkFps,
          repeat: -1,
        });
      }
      if (!this.anims.exists(dieAnim(sprite.key))) {
        const start = SHEET.rows.die * SHEET.columns;
        this.anims.create({
          key: dieAnim(sprite.key),
          frames: this.anims.generateFrameNumbers(sprite.key, { start, end: start + SHEET.dieFrames - 1 }),
          frameRate: 14,
          repeat: 0,
        });
      }
    }
  }

  /** Soft round light: opaque in the middle, fading to nothing at the edge (cuts holes into darkness). */
  private makeLightTexture(): void {
    if (this.textures.exists('light')) return;
    const size = 256;
    const tex = this.textures.createCanvas('light', size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.8, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  create(): void {
    this.makeLightTexture();
    this.makeCharacterAnims();
    for (const ground of Object.values(GROUND_TEXTURES)) {
      if (this.textures.exists(ground.key))
        this.textures.get(ground.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    if (this.textures.exists(TILESET.key)) {
      this.textures.get(TILESET.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    const g = this.add.graphics();
    const make = (key: string, w: number, h: number, draw: (g: G) => void) => {
      g.clear();
      draw(g);
      g.generateTexture(key, w, h);
    };

    // Player
    make('player', 34, 34, (g) => {
      g.fillStyle(0x000000, 0.25).fillEllipse(17, 29, 22, 7);
      g.fillStyle(COLORS.player).fillCircle(17, 16, 13);
      g.lineStyle(2.5, COLORS.playerEdge).strokeCircle(17, 16, 13);
      g.fillStyle(0x0c4a6e).fillCircle(13, 14, 2.4).fillCircle(21, 14, 2.4);
    });

    // Enemies
    make('enemy-bat', 30, 22, (g) => {
      // Until bats have a sprite: dark purple wings with a faint rim, so they still read on dark ground.
      g.fillStyle(0x3b2f48).fillTriangle(15, 11, 1, 3, 6, 17).fillTriangle(15, 11, 29, 3, 24, 17);
      g.lineStyle(1, 0x8670a3).strokeTriangle(15, 11, 1, 3, 6, 17).strokeTriangle(15, 11, 29, 3, 24, 17);
      g.fillStyle(0x54446a).fillCircle(15, 11, 7);
      g.lineStyle(1, 0x8670a3).strokeCircle(15, 11, 7);
      g.fillStyle(0xef4444).fillCircle(12.5, 10, 1.7).fillCircle(17.5, 10, 1.7);
    });
    make('enemy-zombie', 30, 30, (g) => {
      g.fillStyle(0x4d7c0f).fillCircle(15, 15, 13);
      g.lineStyle(2, 0x1a2e05).strokeCircle(15, 15, 13);
      g.fillStyle(0xd9f99d).fillCircle(11, 13, 2.6).fillCircle(19, 13, 2.6);
      g.fillStyle(0x1a2e05).fillRect(10, 19, 10, 2);
    });
    make('enemy-ghoul', 28, 28, (g) => {
      g.fillStyle(0xea580c).fillTriangle(14, 0, 7, 8, 21, 8);
      g.fillStyle(0xc2410c).fillCircle(14, 15, 12);
      g.lineStyle(2, 0x431407).strokeCircle(14, 15, 12);
      g.fillStyle(0xfde047).fillTriangle(8, 12, 13, 14, 8, 16).fillTriangle(20, 12, 15, 14, 20, 16);
    });
    make('enemy-brute', 50, 50, (g) => {
      g.fillStyle(0xe5e7eb).fillTriangle(8, 6, 16, 16, 6, 18).fillTriangle(42, 6, 34, 16, 44, 18);
      g.fillStyle(0x7f1d1d).fillCircle(25, 26, 22);
      g.lineStyle(3, 0x2b0707).strokeCircle(25, 26, 22);
      g.fillStyle(0xfca5a5).fillCircle(18, 22, 3.5).fillCircle(32, 22, 3.5);
      g.fillStyle(0x2b0707).fillRect(16, 33, 18, 3);
    });

    // Weapons & effects
    make('bolt', 22, 12, (g) => {
      g.fillStyle(COLORS.bolt, 0.35).fillEllipse(9, 6, 18, 10);
      g.fillStyle(COLORS.bolt).fillEllipse(13, 6, 14, 7);
      g.fillStyle(0xffffff).fillCircle(15, 6, 2.5);
    });
    make('blade', 30, 12, (g) => {
      g.fillStyle(COLORS.blade).fillTriangle(0, 6, 15, 0, 15, 12).fillTriangle(30, 6, 15, 0, 15, 12);
      g.fillStyle(0x94a3b8).fillTriangle(4, 6, 15, 3, 15, 9);
    });
    make('aura', 128, 128, (g) => {
      for (let i = 0; i < 16; i++) {
        g.fillStyle(COLORS.aura, 0.022 + i * 0.004).fillCircle(64, 64, 64 - i * 3);
      }
      g.lineStyle(2, COLORS.aura, 0.55).strokeCircle(64, 64, 62);
    });
    make('ring', 128, 128, (g) => {
      g.lineStyle(6, 0xffffff, 0.9).strokeCircle(64, 64, 60);
      g.fillStyle(0xffffff, 0.12).fillCircle(64, 64, 58);
    });
    make('gem', 12, 16, (g) => {
      g.fillStyle(COLORS.gem).fillTriangle(6, 0, 0, 8, 12, 8).fillTriangle(6, 16, 0, 8, 12, 8);
      g.fillStyle(0xdbeafe).fillTriangle(6, 2, 3, 8, 6, 8);
    });
    make('gem-big', 16, 22, (g) => {
      g.fillStyle(COLORS.gemBig).fillTriangle(8, 0, 0, 11, 16, 11).fillTriangle(8, 22, 0, 11, 16, 11);
      g.fillStyle(0xf3e8ff).fillTriangle(8, 3, 4, 11, 8, 11);
    });
    make('heart', 20, 18, (g) => drawHeart(g, 10, 9, 9, COLORS.heal));
    make('chest', 26, 22, (g) => {
      g.fillStyle(0x000000, 0.35).fillEllipse(13, 20, 24, 5);
      g.fillStyle(0x7c2d12).fillRect(2, 8, 22, 12);
      g.fillStyle(0x9a3412).fillRoundedRect(2, 2, 22, 8, 3);
      g.fillStyle(0xfbbf24).fillRect(2, 9, 22, 2).fillRect(6, 2, 2, 18).fillRect(18, 2, 2, 18);
      g.fillStyle(0xfde68a).fillRect(11, 8, 4, 5);
    });
    // Big chest for the opening screen, closed and open (drawn large so it stays sharp).
    const S = 8;
    make('chest-big', 26 * S, 26 * S, (g) => {
      g.fillStyle(0x7c2d12).fillRect(2 * S, 12 * S, 22 * S, 12 * S);
      g.fillStyle(0x9a3412).fillRoundedRect(2 * S, 5 * S, 22 * S, 8 * S, 3 * S);
      g.fillStyle(0xfbbf24)
        .fillRect(2 * S, 12 * S, 22 * S, 2 * S)
        .fillRect(6 * S, 5 * S, 2 * S, 19 * S)
        .fillRect(18 * S, 5 * S, 2 * S, 19 * S);
      g.fillStyle(0xfde68a).fillRect(11 * S, 11 * S, 4 * S, 5 * S);
      g.fillStyle(0x7c2d12).fillRect(12.5 * S, 13 * S, 1 * S, 2 * S);
    });
    make('chest-big-open', 26 * S, 26 * S, (g) => {
      // Lid tipped back, seen from inside.
      g.fillStyle(0x431407).fillRoundedRect(3 * S, 1 * S, 20 * S, 7 * S, 2 * S);
      g.fillStyle(0xfbbf24)
        .fillRect(6 * S, 1 * S, 2 * S, 7 * S)
        .fillRect(18 * S, 1 * S, 2 * S, 7 * S);
      // Glowing inside.
      g.fillStyle(0xfde68a).fillRect(2 * S, 9 * S, 22 * S, 4 * S);
      g.fillStyle(0xffffff, 0.8).fillRect(5 * S, 10 * S, 16 * S, 2 * S);
      // Box.
      g.fillStyle(0x7c2d12).fillRect(2 * S, 12 * S, 22 * S, 12 * S);
      g.fillStyle(0xfbbf24)
        .fillRect(2 * S, 12 * S, 22 * S, 2 * S)
        .fillRect(6 * S, 12 * S, 2 * S, 12 * S)
        .fillRect(18 * S, 12 * S, 2 * S, 12 * S);
      g.fillStyle(0xfde68a).fillRect(11 * S, 13 * S, 4 * S, 3 * S);
    });
    make('coin', 16, 16, (g) => {
      g.fillStyle(0x92400e).fillCircle(8, 8.6, 7);
      g.fillStyle(0xfbbf24).fillCircle(8, 8, 7);
      g.fillStyle(0xfde68a).fillCircle(8, 8, 4.5);
      g.fillStyle(0xf59e0b).fillRect(7, 5, 2, 6);
    });
    // White herb sprite, tinted per herb type.
    make('herb', 22, 24, (g) => {
      g.fillStyle(0x000000, 0.3).fillEllipse(11, 21, 14, 5);
      g.fillStyle(0x9ca3af).fillRect(10, 11, 2, 10);
      g.fillStyle(0xd1d5db).fillEllipse(6, 15, 9, 5).fillEllipse(16, 13, 9, 5);
      g.fillStyle(0xffffff)
        .fillCircle(11, 7, 5)
        .fillCircle(7, 5, 3)
        .fillCircle(15, 5, 3)
        .fillCircle(11, 2, 3);
      g.fillStyle(0xe5e7eb).fillCircle(11, 6, 2);
    });
    // White potion flask, tinted per potion type.
    make('potion', 26, 30, (g) => {
      g.fillStyle(0xd1d5db).fillRect(9, 1, 8, 3);
      g.fillStyle(0xe5e7eb).fillRect(10, 4, 6, 7);
      g.fillStyle(0xffffff).fillCircle(13, 19, 10);
      g.fillStyle(0xffffff, 0.55).fillCircle(9, 16, 3);
    });
    // Small torch on a post; the light around it comes from the lighting system.
    make('torch', 14, 30, (g) => {
      g.fillStyle(0x000000, 0.3).fillEllipse(7, 28, 10, 4);
      g.fillStyle(0x5b4636).fillRect(5.5, 11, 3, 17);
      g.fillStyle(0x3f2f24).fillRect(4, 10, 6, 3);
      g.fillStyle(0xea580c).fillTriangle(2, 10, 12, 10, 7, 0);
      g.fillStyle(0xfacc15).fillTriangle(4.5, 10, 9.5, 10, 7, 3);
    });
    // The watchman's lanterns, one per level: ring on top, frame, glowing flame. Hang from their top edge.
    LANTERN_LOOKS.forEach((look, level) => {
      make(`lantern-${level}`, 12, 18, (g) => {
        g.lineStyle(1.5, look.frame).strokeCircle(6, 2.5, 2);
        g.fillStyle(look.frame).fillRect(2, 5, 8, 2).fillRect(3, 15, 6, 2);
        g.fillStyle(look.flame).fillRect(3, 7, 6, 8);
        g.fillStyle(look.core).fillRect(4.5, 8.5, 3, 5);
        g.fillStyle(look.frame).fillRect(2, 7, 1, 8).fillRect(9, 7, 1, 8).fillRect(5.5, 7, 1, 8);
      });
    });
    // Glowing eyes of an enemy in the dark (white, tinted in the game).
    make('eyes', 14, 6, (g) => {
      g.fillStyle(0xffffff, 0.35).fillCircle(3, 3, 3).fillCircle(11, 3, 3);
      g.fillStyle(0xffffff, 1).fillCircle(3, 3, 1.6).fillCircle(11, 3, 1.6);
    });
    make('herb-glow', 64, 64, (g) => {
      for (let i = 0; i < 10; i++) g.fillStyle(0xffffff, 0.04 + i * 0.012).fillCircle(32, 32, 32 - i * 3);
    });

    // Ground (tiled)
    // Neutral grey ground: each area tints it with its own colour (see groundTint in config).
    make('ground', 64, 64, (g) => {
      g.fillStyle(0xb4b4b4).fillRect(0, 0, 64, 64);
      g.fillStyle(0xffffff).fillCircle(8, 10, 1.5).fillCircle(40, 22, 1.2).fillCircle(22, 46, 1.8);
      g.fillStyle(0xffffff, 0.6).fillRect(50, 52, 6, 2).fillRect(28, 6, 2, 5);
    });

    // Icons (44x44) for weapons, items and skills
    const icon = (key: string, color: number, glyph: (g: G) => void) =>
      make(key, 44, 44, (g) => {
        g.fillStyle(color).fillRoundedRect(0, 0, 44, 44, 10);
        g.fillStyle(0x000000, 0.18).fillRoundedRect(0, 24, 44, 20, { tl: 0, tr: 0, bl: 10, br: 10 });
        g.lineStyle(2, 0xffffff, 0.35).strokeRoundedRect(1, 1, 42, 42, 9);
        glyph(g);
      });

    icon('icon-bolt', 0x854d0e, (g) => {
      g.fillStyle(COLORS.bolt, 0.5).fillEllipse(17, 22, 22, 10);
      g.fillStyle(COLORS.bolt).fillCircle(26, 22, 7);
      g.fillStyle(0xffffff).fillCircle(27, 21, 3);
    });
    icon('icon-blades', 0x334155, (g) => {
      g.fillStyle(COLORS.blade);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const x = 22 + Math.cos(a) * 11;
        const y = 22 + Math.sin(a) * 11;
        g.fillTriangle(
          x + Math.cos(a) * 6,
          y + Math.sin(a) * 6,
          x - Math.sin(a) * 4,
          y + Math.cos(a) * 4,
          x + Math.sin(a) * 4,
          y - Math.cos(a) * 4,
        );
      }
      g.fillCircle(22, 22, 3);
    });
    icon('icon-aura', 0x7c2d12, (g) => {
      g.fillStyle(COLORS.aura, 0.35).fillCircle(22, 22, 16);
      g.fillStyle(COLORS.aura, 0.6).fillCircle(22, 22, 11);
      g.fillStyle(0xfed7aa).fillCircle(22, 22, 5);
    });
    icon('icon-vitality', 0x881337, (g) => drawHeart(g, 22, 22, 13, 0xfda4af));
    icon('icon-swiftness', 0x065f46, (g) => {
      g.fillStyle(0x6ee7b7).fillTriangle(10, 12, 22, 22, 10, 32).fillTriangle(22, 12, 34, 22, 22, 32);
    });
    icon('icon-might', 0x991b1b, (g) => {
      g.fillStyle(0xfecaca).fillTriangle(22, 7, 15, 22, 29, 22).fillRect(19, 22, 6, 11);
      g.fillRect(13, 31, 18, 4);
    });
    icon('icon-haste', 0x1e3a8a, (g) => {
      g.fillStyle(0xbfdbfe).fillTriangle(12, 9, 32, 9, 22, 22).fillTriangle(12, 35, 32, 35, 22, 22);
      g.fillRect(11, 7, 22, 3).fillRect(11, 34, 22, 3);
    });
    icon('icon-magnet', 0x4c1d95, (g) => {
      g.lineStyle(7, 0xe9d5ff).beginPath().arc(22, 20, 10, 0, Math.PI, false).strokePath();
      g.fillStyle(0xfca5a5).fillRect(8.5, 11, 7, 9).fillRect(28.5, 11, 7, 9);
    });
    icon('icon-lantern', 0x78350f, (g) => {
      g.fillStyle(0xfde68a, 0.25).fillCircle(22, 24, 15);
      g.fillStyle(0x44403c).fillRect(19, 7, 6, 3).fillRect(14, 11, 16, 3).fillRect(14, 33, 16, 3);
      g.fillStyle(0xfef3c7).fillRect(16, 14, 12, 19);
      g.fillStyle(0xf59e0b).fillTriangle(18, 30, 26, 30, 22, 18);
      g.fillStyle(0xfffbeb).fillTriangle(20, 30, 24, 30, 22, 23);
    });
    icon('icon-regen', 0x14532d, (g) => {
      g.fillStyle(0xbbf7d0).fillRect(18, 9, 8, 26).fillRect(9, 18, 26, 8);
    });
    icon('icon-armor', 0x374151, (g) => {
      const shield = [22, 7, 35, 12, 33, 26, 22, 37, 11, 26, 9, 12];
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < shield.length; i += 2) pts.push(new Phaser.Math.Vector2(shield[i], shield[i + 1]));
      g.fillStyle(0xd1d5db).fillPoints(pts, true);
      g.fillStyle(0x6b7280).fillRect(20, 12, 4, 20);
    });
    icon('icon-dash', 0x3730a3, (g) => {
      g.fillStyle(0xc7d2fe, 0.5).fillTriangle(6, 12, 16, 22, 6, 32);
      g.fillStyle(0xc7d2fe, 0.8).fillTriangle(15, 12, 25, 22, 15, 32);
      g.fillStyle(0xffffff).fillTriangle(24, 12, 36, 22, 24, 32);
    });
    icon('icon-nova', 0x0c4a6e, (g) => {
      g.lineStyle(3.5, 0xe0f2fe);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        g.lineBetween(
          22 - Math.cos(a) * 14,
          22 - Math.sin(a) * 14,
          22 + Math.cos(a) * 14,
          22 + Math.sin(a) * 14,
        );
      }
      g.fillStyle(0xffffff).fillCircle(22, 22, 4);
    });

    g.destroy();
    this.scene.start('WorldMap');
  }
}

function drawHeart(g: G, cx: number, cy: number, s: number, color: number): void {
  g.fillStyle(color);
  g.fillCircle(cx - s * 0.45, cy - s * 0.2, s * 0.5);
  g.fillCircle(cx + s * 0.45, cy - s * 0.2, s * 0.5);
  g.fillTriangle(cx - s * 0.93, cy, cx + s * 0.93, cy, cx, cy + s * 0.9);
}
