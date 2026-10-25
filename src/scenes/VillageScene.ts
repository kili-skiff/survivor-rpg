import * as Phaser from 'phaser';
import { HERBS } from '../config/herbs';
import type { HerbDef } from '../config/types';
import { SEASON } from '../config/world';
import { lootCount, type Loot } from '../logic/expedition';
import { loadSave, safeStorage, type SaveData } from '../logic/save';
import { safeArea, viewportSize, type SafeArea } from '../ui/display';
import { COLORS, css, FONT } from '../ui/theme';

/** Why the player just arrived in the village, to show what came home with them. */
export interface VillageSceneData {
  arrival?: {
    reason: 'returned' | 'fallen';
    /** Loot added to the stash */
    kept: Loot;
    /** Loot lost on the way (only when fallen) */
    lost: Loot;
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const HERB_LIST: HerbDef[] = Object.values(HERBS);

/**
 * The village: shows the stash of everything brought home and leads back out onto the map.
 * Herb garden and brewing will live here next.
 */
export class VillageScene extends Phaser.Scene {
  private save!: SaveData;
  private data0: VillageSceneData = {};
  private u = 1;
  private sa: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Village');
  }

  init(data: VillageSceneData): void {
    this.data0 = data ?? {};
  }

  create(): void {
    this.save = loadSave(safeStorage());
    this.objects = [];
    this.cameras.main.setBackgroundColor(0x17131f);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));
    this.input.keyboard?.on('keydown-ENTER', () => this.setOut());
  }

  // ---------------------------------------------------------------- layout

  private build(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    const { width: W, height: H } = this.scale;
    this.cameras.main.setSize(W, H);
    const cssSize = viewportSize();
    const rs = W / cssSize.width;
    this.u = rs * Phaser.Math.Clamp(Math.min(cssSize.width, cssSize.height) / 400, 0.85, 1.25);
    const sa = safeArea();
    this.sa = { top: sa.top * rs, right: sa.right * rs, bottom: sa.bottom * rs, left: sa.left * rs };
    const u = this.u;
    const wide = W > H * 1.3;
    const left = this.sa.left + 16 * u;
    const right = W - this.sa.right - 16 * u;

    // Warm light in the middle of the dark: the village is the safe place.
    const glow = this.track(this.add.graphics());
    for (let i = 0; i < 12; i++) {
      glow
        .fillStyle(0xf59e0b, 0.012 + i * 0.004)
        .fillCircle(W / 2, H * 0.35, Math.max(W, H) * (0.7 - i * 0.05));
    }

    let y = this.sa.top + 18 * u;
    this.text(left, y, 'VILLAGE', 26, { fontStyle: 'bold', color: css(COLORS.accent) });
    y += 34 * u;
    this.text(left, y, `${SEASON.name} · ${plural(this.save.segmentsCleared, 'area')} cleared`, 12, {
      color: '#a1a1aa',
    });
    y += 28 * u;

    const arrival = this.data0.arrival;
    if (arrival) {
      const t = this.text(left, y, this.describeArrival(arrival), 14, {
        color: arrival.reason === 'fallen' ? '#fda4af' : '#bbf7d0',
        wordWrap: { width: right - left },
      });
      y += t.height + 16 * u;
    }

    const buttonH = 52 * u;
    const bottom = H - this.sa.bottom - 16 * u - buttonH - 14 * u;
    if (wide) {
      const mid = (left + right) / 2;
      this.drawStash(left, y, mid - 10 * u, bottom);
      this.drawComingSoon(mid + 10 * u, y, right, bottom);
    } else {
      const stashBottom = this.drawStash(left, y, right, bottom);
      this.drawComingSoon(left, stashBottom + 16 * u, right, bottom);
    }
    this.button(W / 2, H - this.sa.bottom - 16 * u - buttonH / 2, 'Set out', () => this.setOut());
  }

  private describeArrival(a: NonNullable<VillageSceneData['arrival']>): string {
    const list = (loot: Loot) =>
      Object.entries(loot)
        .map(([id, n]) => `${n} ${HERBS[id as keyof typeof HERBS]?.name ?? id}`)
        .join(', ');
    if (a.reason === 'fallen') {
      const kept = lootCount(a.kept) > 0 ? `You saved ${list(a.kept)}.` : 'You saved nothing.';
      const lost = lootCount(a.lost) > 0 ? ` Lost: ${list(a.lost)}.` : '';
      return `You wake up in the village. ${kept}${lost}`;
    }
    return lootCount(a.kept) > 0 ? `Home safe. You brought back ${list(a.kept)}.` : 'Home safe.';
  }

  /** The stash as a grid of herb cards. Returns the bottom edge. */
  private drawStash(x0: number, y0: number, x1: number, maxY: number): number {
    const u = this.u;
    this.text(x0, y0, 'Stash', 16, { fontStyle: 'bold' });
    const top = y0 + 28 * u;
    const cols = 2;
    const gap = 10 * u;
    const cardW = (x1 - x0 - gap * (cols - 1)) / cols;
    const rows = Math.ceil(HERB_LIST.length / cols);
    const cardH = Math.min(58 * u, (maxY - top - gap * (rows - 1)) / rows);
    const g = this.track(this.add.graphics());
    HERB_LIST.forEach((herb, i) => {
      const cx = x0 + (i % cols) * (cardW + gap);
      const cy = top + Math.floor(i / cols) * (cardH + gap);
      const count = this.save.stash[herb.id] ?? 0;
      const owned = count > 0;
      g.fillStyle(COLORS.panel, owned ? 0.95 : 0.6).fillRoundedRect(cx, cy, cardW, cardH, 10 * u);
      g.lineStyle(1.5 * u, herb.rare ? COLORS.accent : COLORS.panelEdge, owned ? 1 : 0.5).strokeRoundedRect(
        cx,
        cy,
        cardW,
        cardH,
        10 * u,
      );
      const iconSize = Math.min(cardH - 14 * u, 34 * u);
      this.track(
        this.add
          .image(cx + 10 * u + iconSize / 2, cy + cardH / 2, 'herb')
          .setTint(herb.color)
          .setDisplaySize(iconSize * 0.9, iconSize)
          .setAlpha(owned ? 1 : 0.35),
      );
      const tx = cx + 18 * u + iconSize;
      this.text(tx, cy + cardH / 2, herb.name, 13, {
        fontStyle: 'bold',
        color: owned ? '#ffffff' : '#71717a',
      }).setOrigin(0, 0.5);
      this.text(cx + cardW - 10 * u, cy + cardH / 2, `×${count}`, 15, {
        fontStyle: 'bold',
        color: owned ? (herb.rare ? css(COLORS.accent) : '#bbf7d0') : '#52525b',
      }).setOrigin(1, 0.5);
    });
    return top + rows * cardH + (rows - 1) * gap;
  }

  private drawComingSoon(x0: number, y0: number, x1: number, maxY: number): void {
    const u = this.u;
    const items = [
      { title: 'Herb garden', text: 'Plant herbs to grow more of them.' },
      { title: 'Brewing', text: 'Turn herbs into potions for your next expedition.' },
    ];
    const gap = 10 * u;
    const h = Math.min(64 * u, (maxY - y0 - gap) / 2);
    if (h < 36 * u) return;
    const g = this.track(this.add.graphics());
    items.forEach((item, i) => {
      const y = y0 + i * (h + gap);
      g.lineStyle(1.5 * u, COLORS.panelEdge, 0.8).strokeRoundedRect(x0, y, x1 - x0, h, 10 * u);
      this.text(x0 + 12 * u, y + 10 * u, item.title, 14, { fontStyle: 'bold', color: '#d4d4d8' });
      this.text(x1 - 12 * u, y + 10 * u, 'Coming soon', 11, { color: css(COLORS.accent) }).setOrigin(1, 0);
      this.text(x0 + 12 * u, y + 30 * u, item.text, 12, {
        color: '#a1a1aa',
        wordWrap: { width: x1 - x0 - 24 * u },
      });
    });
  }

  // ---------------------------------------------------------------- helpers

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objects.push(o);
    return o;
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    opts: Phaser.Types.GameObjects.Text.TextStyle = {},
  ) {
    return this.track(
      this.add.text(x, y, value, {
        fontFamily: FONT,
        fontSize: `${Math.round(size * this.u)}px`,
        color: '#ffffff',
        ...opts,
      }),
    );
  }

  private button(x: number, y: number, label: string, onClick: () => void): void {
    const u = this.u;
    const w = 240 * u;
    const h = 52 * u;
    const g = this.track(this.add.graphics());
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(COLORS.accent, hover ? 1 : 0.92).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12 * u);
    };
    draw(false);
    this.text(x, y, label, 18, { fontStyle: 'bold', color: '#1c1917' }).setOrigin(0.5);
    const zone = this.track(this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }));
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerup', onClick);
  }

  private setOut(): void {
    this.scene.start('WorldMap');
  }
}
