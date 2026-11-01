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

    // Fight goal symbols (config/goals.ts): white on a dark disc, so they read on any map tile.
    make('goal-survive', 32, 32, (g) => {
      g.fillStyle(0x0d0b12, 0.8).fillCircle(16, 16, 16);
      g.fillStyle(0xf5f5f4).fillRect(13, 3, 6, 4).fillRect(22, 7, 4, 3);
      g.fillStyle(0xf5f5f4).fillCircle(16, 18, 10);
      g.fillStyle(0x0d0b12).fillCircle(16, 18, 7.5);
      g.lineStyle(2.5, 0xf5f5f4).lineBetween(16, 18, 16, 12).lineBetween(16, 18, 20, 20);
    });
    make('goal-hunt', 32, 32, (g) => {
      g.fillStyle(0x0d0b12, 0.8).fillCircle(16, 16, 16);
      g.fillStyle(0xf5f5f4).fillCircle(16, 14, 9).fillRoundedRect(10, 17, 12, 8, 2);
      g.fillStyle(0x0d0b12).fillCircle(12.5, 14, 2.8).fillCircle(19.5, 14, 2.8);
      g.fillTriangle(16, 17, 14.5, 20, 17.5, 20);
      g.fillRect(13, 22, 1.5, 3).fillRect(17.5, 22, 1.5, 3);
    });

    make('goal-light', 32, 32, (g) => {
      g.fillStyle(0x0d0b12, 0.8).fillCircle(16, 16, 16);
      g.fillStyle(0xfb923c).fillTriangle(16, 4, 24, 20, 8, 20).fillCircle(16, 20, 8);
      g.fillStyle(0xfde68a).fillTriangle(16, 11, 20, 22, 12, 22).fillCircle(16, 22, 4);
    });

    // Hex rewards (config/rewards.ts): coloured on a dark disc, like the goal symbols.
    make('reward-embers', 32, 32, (g) => {
      g.fillStyle(0x0d0b12, 0.8).fillCircle(16, 16, 16);
      g.fillStyle(0xf97316, 0.35).fillCircle(16, 16, 11);
      g.fillStyle(0xfb923c).fillCircle(16, 16, 7);
      g.fillStyle(0xfde68a).fillTriangle(16, 5, 19, 16, 13, 16).fillTriangle(16, 27, 19, 16, 13, 16);
      g.fillStyle(0xfde68a).fillTriangle(5, 16, 16, 13, 16, 19).fillTriangle(27, 16, 16, 13, 16, 19);
      g.fillStyle(0xfef3c7).fillCircle(16, 16, 3);
    });
    make('reward-chest', 32, 32, (g) => {
      g.fillStyle(0x0d0b12, 0.8).fillCircle(16, 16, 16);
      g.fillStyle(0x92400e).fillRoundedRect(7, 10, 18, 14, 3);
      g.fillStyle(0xfbbf24).fillRect(7, 15, 18, 3).fillRect(14.5, 13, 3, 7);
    });
    make('reward-card', 32, 32, (g) => {
      g.fillStyle(0x0d0b12, 0.8).fillCircle(16, 16, 16);
      g.fillStyle(0x3b82f6).fillRoundedRect(10, 6, 12, 20, 2);
      g.fillStyle(0xf59e0b).fillTriangle(16, 10, 19, 17, 13, 17).fillTriangle(16, 21, 19, 14, 13, 14);
    });
    make('reward-heal', 32, 32, (g) => {
      g.fillStyle(0x0d0b12, 0.8).fillCircle(16, 16, 16);
      drawHeart(g, 16, 17, 10, 0xf87171);
    });
    make('reward-herbs', 32, 32, (g) => {
      g.fillStyle(0x0d0b12, 0.8).fillCircle(16, 16, 16);
      g.fillStyle(0x4ade80).fillEllipse(12, 15, 8, 14).fillEllipse(20, 13, 8, 14);
      g.fillStyle(0x166534).fillRect(15, 14, 2, 12);
    });

    // The watchfire in a fight (goal "find the light"): a stone brazier, cold or burning. 48x56, base at the bottom.
    const brazier = (g: G) => {
      g.fillStyle(0x000000, 0.3).fillEllipse(24, 52, 34, 8);
      g.fillStyle(0x57534e).fillRect(14, 38, 20, 14);
      g.fillStyle(0x78716c).fillRect(8, 30, 32, 9);
      g.fillStyle(0x44403c).fillRect(8, 36, 32, 3);
    };
    make('watchfire-cold', 48, 56, (g) => {
      brazier(g);
      g.fillStyle(0x292524).fillRect(12, 26, 24, 5);
      g.fillStyle(0x1c1917).fillRect(16, 24, 4, 3).fillRect(26, 23, 5, 4);
    });
    make('watchfire-lit', 48, 56, (g) => {
      brazier(g);
      g.fillStyle(0xf97316).fillTriangle(24, 2, 38, 31, 10, 31);
      g.fillStyle(0xfb923c).fillTriangle(16, 10, 26, 31, 8, 31).fillTriangle(32, 8, 40, 31, 24, 31);
      g.fillStyle(0xfde68a).fillTriangle(24, 14, 31, 31, 17, 31);
    });

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
    // An ember: the light a monster ate, released when it falls; you catch it in your lantern.
    make('ember', 16, 16, (g) => {
      g.fillStyle(0xf97316, 0.3).fillCircle(8, 8, 8);
      g.fillStyle(0xfb923c, 0.85).fillCircle(8, 8, 5);
      g.fillStyle(0xfde68a).fillTriangle(8, 2, 10, 8, 6, 8).fillTriangle(8, 14, 10, 8, 6, 8);
      g.fillStyle(0xfef3c7).fillCircle(8, 8, 2.2);
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

    // Chain Lightning, the items from config/passives.ts that came later, and the one-time cards.
    // Simple shapes on purpose; they are placeholders like the rest.
    // Hearth upgrades without an item icon of their own
    icon('icon-greed', 0x7c2d12, (g) => {
      g.fillStyle(0xf97316, 0.4).fillCircle(22, 22, 13);
      g.fillStyle(0xfb923c).fillCircle(22, 22, 8);
      g.fillStyle(0xfde68a).fillTriangle(22, 9, 25, 22, 19, 22).fillTriangle(22, 35, 25, 22, 19, 22);
      g.fillStyle(0xfef3c7).fillCircle(22, 22, 3.5);
      g.fillStyle(0xfde68a).fillCircle(33, 12, 3).fillCircle(11, 32, 2.5);
    });
    icon('icon-pouch', 0x3f2a1d, (g) => {
      g.fillStyle(0xa16207).fillRoundedRect(9, 14, 26, 22, 6);
      g.fillStyle(0x854d0e).fillRect(9, 18, 26, 4);
      g.fillStyle(0x60a5fa).fillRoundedRect(19, 6, 6, 12, 2);
      g.fillStyle(0xfde68a).fillCircle(22, 27, 3);
    });
    icon('icon-boomerang', 0x7c2d12, (g) => {
      g.fillStyle(0xfdba74).fillTriangle(8, 30, 22, 8, 26, 14).fillTriangle(8, 30, 36, 30, 30, 24);
      g.fillStyle(0xfed7aa).fillCircle(9, 29, 3);
    });
    // The boomerang in flight (a main weapon)
    make('boomerang', 26, 26, (g) => {
      g.fillStyle(0xfdba74).fillTriangle(3, 22, 13, 3, 16, 7).fillTriangle(3, 22, 23, 22, 19, 18);
      g.lineStyle(1.5, 0x7c2d12).strokeTriangle(3, 22, 13, 3, 16, 7).strokeTriangle(3, 22, 23, 22, 19, 18);
    });
    // Modifiers of the main weapons: a gold rim marks them apart from the other cards.
    const mod = (key: string, color: number, glyph: (g: G) => void) =>
      icon(key, color, (g) => {
        g.lineStyle(2, 0xfacc15, 0.9).strokeRoundedRect(3, 3, 38, 38, 8);
        glyph(g);
      });
    mod('icon-mod-heavybolt', 0x4c1d95, (g) => {
      g.fillStyle(0xe9d5ff).fillCircle(26, 22, 9);
      g.fillStyle(0xc4b5fd, 0.6).fillTriangle(6, 18, 6, 26, 18, 22);
    });
    mod('icon-mod-volley', 0x4c1d95, (g) => {
      g.fillStyle(0xe9d5ff);
      for (const [x, y] of [
        [30, 10],
        [33, 22],
        [30, 34],
      ])
        g.fillCircle(x, y, 3.5);
      g.lineStyle(2, 0xc4b5fd, 0.7)
        .lineBetween(8, 22, 27, 11)
        .lineBetween(8, 22, 30, 22)
        .lineBetween(8, 22, 27, 33);
    });
    mod('icon-mod-ricochet', 0x4c1d95, (g) => {
      g.lineStyle(3, 0xe9d5ff).beginPath().moveTo(7, 32).lineTo(20, 12).lineTo(36, 30).strokePath();
      g.fillStyle(0xfacc15).fillCircle(20, 12, 3);
    });
    mod('icon-mod-sparkchain', 0x4c1d95, (g) => {
      g.fillStyle(0xe9d5ff).fillCircle(12, 28, 5).fillCircle(32, 16, 5);
      g.lineStyle(2, 0xfde047)
        .beginPath()
        .moveTo(16, 25)
        .lineTo(21, 18)
        .lineTo(23, 24)
        .lineTo(28, 18)
        .strokePath();
    });
    mod('icon-mod-blasttip', 0x4c1d95, (g) => {
      g.fillStyle(0xfb923c).fillCircle(24, 22, 11);
      g.fillStyle(0xfde047).fillCircle(24, 22, 6);
      g.fillStyle(0xe9d5ff).fillTriangle(5, 19, 5, 25, 14, 22);
    });
    mod('icon-mod-frostbolt', 0x4c1d95, (g) => {
      g.lineStyle(2.5, 0xbae6fd);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        g.lineBetween(
          22 - Math.cos(a) * 12,
          22 - Math.sin(a) * 12,
          22 + Math.cos(a) * 12,
          22 + Math.sin(a) * 12,
        );
      }
    });
    mod('icon-mod-whirl', 0x7c2d12, (g) => {
      g.lineStyle(3, 0xfdba74)
        .beginPath()
        .arc(22, 22, 12, 0, Math.PI * 1.5)
        .strokePath();
      g.beginPath()
        .arc(22, 22, 6, Math.PI, Math.PI * 2.5)
        .strokePath();
    });
    mod('icon-mod-pull', 0x7c2d12, (g) => {
      g.fillStyle(0xfdba74).fillTriangle(8, 22, 18, 14, 18, 30);
      g.lineStyle(3, 0xfdba74).lineBetween(18, 22, 36, 22);
      g.fillStyle(0xfca5a5).fillCircle(34, 13, 3).fillCircle(34, 31, 3);
    });
    mod('icon-mod-wideblade', 0x7c2d12, (g) => {
      g.fillStyle(0xfdba74).fillTriangle(5, 36, 21, 5, 27, 13).fillTriangle(5, 36, 39, 36, 31, 28);
    });
    mod('icon-mod-orbit', 0x7c2d12, (g) => {
      g.lineStyle(2, 0xfdba74, 0.8).strokeCircle(22, 22, 13);
      g.fillStyle(0xfed7aa).fillCircle(22, 22, 4);
      g.fillStyle(0xfdba74).fillTriangle(31, 9, 38, 15, 30, 17);
    });
    mod('icon-mod-keen', 0x7c2d12, (g) => {
      g.fillStyle(0xfdba74).fillTriangle(8, 34, 20, 8, 24, 12);
      g.fillStyle(0xfed7aa).fillTriangle(20, 34, 32, 8, 36, 12);
    });
    mod('icon-mod-embertrail', 0x7c2d12, (g) => {
      g.fillStyle(0xf97316);
      for (const [x, y, r] of [
        [10, 32, 3],
        [17, 26, 4],
        [25, 21, 4.5],
        [33, 14, 5],
      ])
        g.fillCircle(x, y, r);
      g.fillStyle(0xfde047).fillCircle(33, 14, 2.5);
    });
    // An ember the boomerang leaves behind (Ember Trail)
    make('ember-trail', 16, 16, (g) => {
      g.fillStyle(0xf97316, 0.35).fillCircle(8, 8, 8);
      g.fillStyle(0xfb923c, 0.8).fillCircle(8, 8, 4.5);
      g.fillStyle(0xfde047).fillCircle(8, 8, 2);
    });
    icon('icon-chain', 0x155e75, (g) => {
      g.lineStyle(4, 0xa5f3fc)
        .beginPath()
        .moveTo(26, 6)
        .lineTo(15, 21)
        .lineTo(25, 22)
        .lineTo(16, 38)
        .strokePath();
      g.fillStyle(0xffffff).fillCircle(26, 7, 3).fillCircle(16, 37, 3);
    });
    icon('icon-reach', 0x1e40af, (g) => {
      g.lineStyle(3, 0xbfdbfe).strokeCircle(22, 22, 7).strokeCircle(22, 22, 14);
      g.fillStyle(0xffffff).fillCircle(22, 22, 3);
    });
    icon('icon-force', 0x7c2d12, (g) => {
      g.fillStyle(0xfed7aa).fillRect(8, 17, 14, 10).fillTriangle(22, 11, 36, 22, 22, 33);
    });
    icon('icon-rend', 0x7f1d1d, (g) => {
      g.lineStyle(4, 0xfecaca)
        .lineBetween(11, 10, 31, 34)
        .lineBetween(21, 8, 38, 28)
        .lineBetween(8, 20, 24, 36);
    });
    icon('icon-wisdom', 0x4338ca, (g) => {
      g.fillStyle(0xc7d2fe).fillTriangle(22, 6, 34, 22, 10, 22).fillTriangle(22, 38, 34, 22, 10, 22);
      g.fillStyle(0xffffff).fillTriangle(22, 12, 28, 22, 16, 22);
    });
    icon('icon-bloodthirst', 0x7f1d1d, (g) => {
      g.fillStyle(0xfca5a5).fillCircle(22, 28, 9).fillTriangle(22, 7, 14, 24, 30, 24);
    });
    icon('icon-fortune', 0x854d0e, (g) => {
      g.fillStyle(0xfde047).fillCircle(22, 22, 13);
      g.fillStyle(0xa16207).fillCircle(22, 22, 9);
      g.fillStyle(0xfef08a).fillRect(20, 14, 4, 16);
    });
    icon('icon-twin', 0x0f766e, (g) => {
      g.fillStyle(0x99f6e4).fillCircle(14, 22, 7).fillCircle(30, 22, 7);
      g.fillStyle(0xffffff).fillCircle(15, 21, 3).fillCircle(31, 21, 3);
    });
    icon('icon-keenedge', 0x9a3412, (g) => {
      g.fillStyle(0xfed7aa).fillTriangle(22, 5, 27, 18, 38, 22).fillTriangle(22, 39, 17, 26, 6, 22);
      g.fillTriangle(22, 5, 17, 18, 6, 22).fillTriangle(22, 39, 27, 26, 38, 22);
      g.fillStyle(0xffffff).fillCircle(22, 22, 4);
    });
    icon('icon-deadlyaim', 0x991b1b, (g) => {
      g.lineStyle(3, 0xfecaca).strokeCircle(22, 22, 11);
      g.lineBetween(22, 5, 22, 39).lineBetween(5, 22, 39, 22);
      g.fillStyle(0xef4444).fillCircle(22, 22, 3);
    });
    icon('icon-executioner', 0x3f3f46, (g) => {
      g.fillStyle(0xe4e4e7).fillRect(21, 6, 4, 30).fillTriangle(25, 8, 37, 14, 25, 24);
      g.fillStyle(0x71717a).fillRect(15, 32, 16, 4);
    });
    icon('icon-hunter', 0x713f12, (g) => {
      g.fillStyle(0xfde68a).fillTriangle(8, 34, 22, 8, 36, 34);
      g.fillStyle(0x713f12).fillTriangle(15, 34, 22, 20, 29, 34);
    });
    icon('icon-quickhands', 0x1d4ed8, (g) => {
      g.lineStyle(3, 0xdbeafe).strokeCircle(22, 23, 12);
      g.lineBetween(22, 23, 22, 15).lineBetween(22, 23, 28, 26).fillStyle(0xdbeafe).fillRect(19, 6, 6, 4);
    });
    icon('icon-momentum', 0x065f46, (g) => {
      g.fillStyle(0xa7f3d0, 0.45).fillTriangle(4, 14, 16, 22, 4, 30);
      g.fillStyle(0xa7f3d0).fillTriangle(14, 10, 38, 22, 14, 34);
    });
    icon('icon-emberheart', 0x9a3412, (g) => {
      drawHeart(g, 22, 24, 13, 0xfb923c);
      g.fillStyle(0xfef3c7).fillTriangle(22, 14, 17, 26, 27, 26);
    });
    icon('icon-thorns', 0x14532d, (g) => {
      g.fillStyle(0x86efac);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.fillTriangle(
          22 + Math.cos(a) * 16,
          22 + Math.sin(a) * 16,
          22 + Math.cos(a + 1.6) * 6,
          22 + Math.sin(a + 1.6) * 6,
          22 + Math.cos(a - 1.6) * 6,
          22 + Math.sin(a - 1.6) * 6,
        );
      }
    });
    icon('icon-shadowstep', 0x312e81, (g) => {
      g.fillStyle(0xc7d2fe, 0.3).fillCircle(12, 22, 7);
      g.fillStyle(0xc7d2fe, 0.6).fillCircle(22, 22, 7);
      g.fillStyle(0xffffff).fillCircle(32, 22, 7);
    });
    icon('icon-piercing', 0x374151, (g) => {
      g.fillStyle(0xe5e7eb).fillTriangle(38, 22, 22, 14, 22, 30).fillRect(6, 19, 17, 6);
      g.fillStyle(0x9ca3af).fillRect(6, 19, 5, 6);
    });
    icon('icon-volatile', 0x9a3412, (g) => {
      g.fillStyle(0xfdba74);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillTriangle(
          22 + Math.cos(a) * 16,
          22 + Math.sin(a) * 16,
          22 + Math.cos(a + 0.4) * 7,
          22 + Math.sin(a + 0.4) * 7,
          22 + Math.cos(a - 0.4) * 7,
          22 + Math.sin(a - 0.4) * 7,
        );
      }
      g.fillStyle(0xfff7ed).fillCircle(22, 22, 5);
    });
    icon('icon-bloodpact', 0x581c87, (g) => {
      g.fillStyle(0xe9d5ff).fillTriangle(22, 6, 36, 22, 8, 22).fillTriangle(22, 38, 36, 22, 8, 22);
      g.fillStyle(0xdc2626).fillCircle(22, 22, 5);
    });
    // One-time cards
    icon('icon-cache', 0x854d0e, (g) => {
      g.fillStyle(0xfde047).fillCircle(22, 26, 11).fillRect(19, 8, 6, 8);
      g.fillStyle(0xa16207).fillRect(15, 15, 14, 3);
    });
    icon('icon-gemstorm', 0x1e3a8a, (g) => {
      g.fillStyle(0x93c5fd).fillTriangle(14, 10, 22, 4, 22, 16).fillTriangle(30, 20, 38, 14, 34, 28);
      g.fillStyle(0xc084fc).fillTriangle(8, 28, 16, 22, 18, 34).fillTriangle(24, 30, 32, 28, 28, 38);
    });
    icon('icon-feast', 0x9a3412, (g) => {
      g.fillStyle(0xfdba74).fillCircle(20, 20, 11).fillRect(26, 24, 12, 5);
      g.fillStyle(0xfef3c7).fillCircle(17, 17, 4);
    });
    icon('icon-novaburst', 0x92400e, (g) => {
      g.lineStyle(3, 0xfde68a).strokeCircle(22, 22, 8).strokeCircle(22, 22, 15);
      g.fillStyle(0xffffff).fillCircle(22, 22, 4);
    });
    icon('icon-judgement', 0x713f12, (g) => {
      g.fillStyle(0xfef08a).fillRect(20, 6, 4, 32).fillRect(8, 12, 28, 3);
      g.fillTriangle(8, 15, 14, 15, 11, 25).fillTriangle(30, 15, 36, 15, 33, 25).fillRect(14, 36, 16, 3);
    });
    icon('icon-secondwind', 0x166534, (g) => {
      drawHeart(g, 22, 22, 11, 0xbbf7d0);
      g.fillStyle(0xffffff).fillTriangle(22, 4, 17, 12, 27, 12);
    });
    icon('icon-embers', 0x7c2d12, (g) => {
      g.fillStyle(0xf97316).fillTriangle(22, 5, 33, 33, 11, 33);
      g.fillStyle(0xfde68a).fillTriangle(22, 17, 28, 33, 16, 33);
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
