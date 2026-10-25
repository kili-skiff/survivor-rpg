import * as Phaser from 'phaser';
import { HERBS } from '../config/herbs';
import { POTION_IDS, POTION_RULES, POTIONS } from '../config/potions';
import type { HerbDef, PotionId } from '../config/types';
import { grantAllHerbs } from '../logic/dev';
import { lootCount, type Loot } from '../logic/expedition';
import { beltCount, brew, packPotion, unpackPotion } from '../logic/potions';
import { loadSave, safeStorage, writeSave, type SaveData } from '../logic/save';
import { CauldronPanel } from '../panels/CauldronPanel';
import { isDevMode } from '../ui/dev';
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

/** Heights of the fixed blocks in portrait (before UI scaling) */
const POTIONS_BLOCK_H = 162;
const STATIONS_BLOCK_H = 128;

type PanelId = 'cauldron';

/**
 * The village: shows the stash of everything brought home, the potion belt for the next
 * expedition, and opens the village panels (cauldron; herb garden next).
 */
export class VillageScene extends Phaser.Scene {
  private save!: SaveData;
  private data0: VillageSceneData = {};
  private u = 1;
  private sa: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  private objects: Phaser.GameObjects.GameObject[] = [];
  private openPanel: PanelId | null = null;
  private panel: CauldronPanel | null = null;

  constructor() {
    super('Village');
  }

  init(data: VillageSceneData): void {
    this.data0 = data ?? {};
  }

  create(): void {
    this.save = loadSave(safeStorage());
    this.objects = [];
    this.openPanel = null;
    this.panel = null;
    this.cameras.main.setBackgroundColor(0x17131f);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.build, this);
      this.panel?.destroy();
      this.panel = null;
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.openPanel === null && this.setOut());
    this.input.keyboard?.on('keydown-ESC', () => this.showPanel(null));
  }

  // ---------------------------------------------------------------- state changes

  /** Saves a changed save and redraws everything. */
  private commit(save: SaveData): void {
    this.save = save;
    writeSave(safeStorage(), save);
    this.build();
  }

  private showPanel(id: PanelId | null): void {
    this.openPanel = id;
    this.build();
  }

  private brew(id: PotionId): void {
    const stash = brew(this.save.stash, id);
    if (stash) this.commit({ ...this.save, stash });
  }

  private pack(id: PotionId): void {
    const r = packPotion(this.save.stash, this.save.belt, id);
    if (r) this.commit({ ...this.save, ...r });
  }

  private unpack(id: PotionId): void {
    const r = unpackPotion(this.save.stash, this.save.belt, id);
    if (r) this.commit({ ...this.save, ...r });
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
    if (isDevMode()) this.devButton(right, y + 4 * u);
    y += 34 * u;
    this.text(left, y, `${plural(this.save.segmentsCleared, 'area')} cleared`, 12, {
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
    const gap = 16 * u;
    if (wide) {
      const colW = (right - left - gap * 2) / 3;
      const c1 = left + colW + gap;
      const c2 = c1 + colW + gap;
      this.drawStash(left, y, left + colW, bottom);
      this.drawPotions(c1, y, c1 + colW);
      this.drawStations(c2, y, c2 + colW, bottom);
    } else {
      // The herb grid takes the room that is left; potions and stations have fixed heights.
      const fixed = POTIONS_BLOCK_H * u + STATIONS_BLOCK_H * u + gap * 2;
      const stashBottom = this.drawStash(left, y, right, bottom - fixed);
      const potionsBottom = this.drawPotions(left, stashBottom + gap, right);
      this.drawStations(left, potionsBottom + gap, right, bottom);
    }
    this.button(W / 2, H - this.sa.bottom - 16 * u - buttonH / 2, 'Set out', () => this.setOut());

    this.panel?.destroy();
    this.panel = null;
    if (this.openPanel === 'cauldron') {
      this.panel = new CauldronPanel(
        this,
        { width: W, height: H, u, sa: this.sa },
        { stash: this.save.stash, onBrew: (id) => this.brew(id), onClose: () => this.showPanel(null) },
      );
    }
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
    const cardH = Phaser.Math.Clamp((maxY - top - gap * (rows - 1)) / rows, 36 * u, 58 * u);
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
      // Narrow cards (three columns in landscape) put the count below the name.
      const stacked = cardW < 165 * u;
      const nameY = stacked ? cy + cardH / 2 - 9 * u : cy + cardH / 2;
      this.text(tx, nameY, herb.name, 13, {
        fontStyle: 'bold',
        color: owned ? '#ffffff' : '#71717a',
      }).setOrigin(0, 0.5);
      const countColor = owned ? (herb.rare ? css(COLORS.accent) : '#bbf7d0') : '#52525b';
      if (stacked) {
        this.text(tx, cy + cardH / 2 + 9 * u, `×${count}`, 13, {
          fontStyle: 'bold',
          color: countColor,
        }).setOrigin(0, 0.5);
      } else {
        this.text(cx + cardW - 10 * u, cy + cardH / 2, `×${count}`, 15, {
          fontStyle: 'bold',
          color: countColor,
        }).setOrigin(1, 0.5);
      }
    });
    return top + rows * cardH + (rows - 1) * gap;
  }

  /**
   * Brewed potions (tap to pack one) and the belt for the next expedition (tap to unpack).
   * Returns the bottom edge.
   */
  private drawPotions(x0: number, y0: number, x1: number): number {
    const u = this.u;
    const n = POTION_IDS.length;
    const gap = 8 * u;
    const g = this.track(this.add.graphics());

    this.text(x0, y0, 'Potions', 16, { fontStyle: 'bold' });
    this.text(x1, y0 + 3 * u, 'Tap to pack', 11, { color: '#a1a1aa' }).setOrigin(1, 0);
    let y = y0 + 26 * u;
    const cardW = (x1 - x0 - gap * (n - 1)) / n;
    const cardH = 52 * u;
    const beltFull = beltCount(this.save.belt) >= POTION_RULES.beltSize;
    POTION_IDS.forEach((id, i) => {
      const def = POTIONS[id];
      const cx = x0 + i * (cardW + gap);
      const count = this.save.stash[id] ?? 0;
      const active = count > 0 && !beltFull;
      g.fillStyle(COLORS.panel, count > 0 ? 0.95 : 0.6).fillRoundedRect(cx, y, cardW, cardH, 10 * u);
      g.lineStyle(1.5 * u, count > 0 ? def.color : COLORS.panelEdge, count > 0 ? 1 : 0.5).strokeRoundedRect(
        cx,
        y,
        cardW,
        cardH,
        10 * u,
      );
      this.flask(cx + 18 * u, y + cardH / 2, 26 * u, def.color, count > 0 ? 1 : 0.3);
      this.text(cx + 34 * u, y + cardH / 2 - 9 * u, def.short, 12, {
        fontStyle: 'bold',
        color: count > 0 ? '#ffffff' : '#71717a',
      }).setOrigin(0, 0.5);
      this.text(cx + 34 * u, y + cardH / 2 + 9 * u, `×${count}`, 13, {
        fontStyle: 'bold',
        color: count > 0 ? css(def.color) : '#52525b',
      }).setOrigin(0, 0.5);
      if (active) this.tapZone(cx, y, cardW, cardH, () => this.pack(id));
    });
    y += cardH + 12 * u;

    const carried = beltCount(this.save.belt);
    this.text(x0, y, `Belt  ${carried}/${POTION_RULES.beltSize}`, 16, { fontStyle: 'bold' });
    if (carried > 0) this.text(x1, y + 3 * u, 'Tap to unpack', 11, { color: '#a1a1aa' }).setOrigin(1, 0);
    y += 26 * u;
    const slots: PotionId[] = POTION_IDS.flatMap((id) => Array<PotionId>(this.save.belt[id] ?? 0).fill(id));
    const slotW = (x1 - x0 - gap * (POTION_RULES.beltSize - 1)) / POTION_RULES.beltSize;
    const slotH = 46 * u;
    for (let i = 0; i < POTION_RULES.beltSize; i++) {
      const sx = x0 + i * (slotW + gap);
      const id = slots[i];
      if (id) {
        g.fillStyle(0x2a2238, 1).fillRoundedRect(sx, y, slotW, slotH, 10 * u);
        g.lineStyle(2 * u, POTIONS[id].color, 1).strokeRoundedRect(sx, y, slotW, slotH, 10 * u);
        this.flask(sx + slotW / 2, y + slotH / 2, 30 * u, POTIONS[id].color, 1);
        this.tapZone(sx, y, slotW, slotH, () => this.unpack(id));
      } else {
        g.lineStyle(1.5 * u, COLORS.panelEdge, 0.7).strokeRoundedRect(sx, y, slotW, slotH, 10 * u);
        this.text(sx + slotW / 2, y + slotH / 2, 'empty', 11, { color: '#52525b' }).setOrigin(0.5);
      }
    }
    return y + slotH;
  }

  /** The places in the village. Each one opens its own panel. */
  private drawStations(x0: number, y0: number, x1: number, maxY: number): void {
    const u = this.u;
    const gap = 10 * u;
    const h = Phaser.Math.Clamp((maxY - y0 - gap) / 2, 44 * u, 64 * u);
    const g = this.track(this.add.graphics());

    // Cauldron
    let y = y0;
    g.fillStyle(COLORS.panel, 0.95).fillRoundedRect(x0, y, x1 - x0, h, 10 * u);
    g.lineStyle(1.5 * u, COLORS.accent, 0.9).strokeRoundedRect(x0, y, x1 - x0, h, 10 * u);
    this.text(x0 + 12 * u, y + 10 * u, 'Cauldron', 14, { fontStyle: 'bold' });
    this.text(x1 - 12 * u, y + 10 * u, 'Open ›', 12, {
      fontStyle: 'bold',
      color: css(COLORS.accent),
    }).setOrigin(1, 0);
    if (h >= 56 * u) {
      this.text(x0 + 12 * u, y + 30 * u, 'Brew potions from your herbs.', 12, { color: '#a1a1aa' });
    }
    this.tapZone(x0, y, x1 - x0, h, () => this.showPanel('cauldron'));

    // Herb garden: next step
    y += h + gap;
    g.lineStyle(1.5 * u, COLORS.panelEdge, 0.8).strokeRoundedRect(x0, y, x1 - x0, h, 10 * u);
    this.text(x0 + 12 * u, y + 10 * u, 'Herb garden', 14, { fontStyle: 'bold', color: '#d4d4d8' });
    this.text(x1 - 12 * u, y + 10 * u, 'Coming soon', 11, { color: css(COLORS.accent) }).setOrigin(1, 0);
    if (h >= 56 * u) {
      this.text(x0 + 12 * u, y + 30 * u, 'Plant herbs to grow more of them.', 12, { color: '#a1a1aa' });
    }
  }

  /** Dev mode only: a small button that adds 5 of every herb to the stash. */
  private devButton(x: number, y: number): void {
    const u = this.u;
    const t = this.text(x, y, 'DEV  +5 herbs', 12, {
      fontStyle: 'bold',
      color: '#f0abfc',
      backgroundColor: '#3b0764',
      padding: { x: Math.round(10 * u), y: Math.round(7 * u) },
    }).setOrigin(1, 0);
    t.setInteractive({ useHandCursor: true }).on('pointerup', () =>
      this.commit({ ...this.save, stash: grantAllHerbs(this.save.stash, 5) }),
    );
  }

  private flask(x: number, y: number, h: number, color: number, alpha: number): void {
    this.track(
      this.add
        .image(x, y, 'potion')
        .setTint(color)
        .setDisplaySize(h * 0.87, h)
        .setAlpha(alpha),
    );
  }

  private tapZone(x: number, y: number, w: number, h: number, onTap: () => void): void {
    const zone = this.track(
      this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }),
    );
    zone.on('pointerup', onTap);
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
