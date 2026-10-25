import * as Phaser from 'phaser';
import { HERBS } from '../config/herbs';
import { HERB_PRICES, LANTERN_BONUS_PER_TIER, LANTERN_TIERS, RECIPE_PRICES } from '../config/merchant';
import { POTION_IDS, POTIONS } from '../config/potions';
import type { HerbId, PotionId } from '../config/types';
import type { Loot } from '../logic/expedition';
import { goldOf, nextLantern } from '../logic/merchant';
import { COLORS, css, FONT } from '../ui/theme';
import type { PanelFrame } from './CauldronPanel';

export interface MerchantPanelOptions {
  stash: Loot;
  lanternLevel: number;
  recipes: readonly PotionId[];
  onBuyLantern(): void;
  onBuyRecipe(id: PotionId): void;
  onSellHerb(id: HerbId): void;
  onClose(): void;
}

const GOLD_COLOR = '#fde047';

/**
 * The merchant: lantern upgrades, potion recipes, and buying your herbs for gold.
 * A panel on top of any scene (rule 12); rebuild it whenever the save changes.
 */
export class MerchantPanel {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly frame: PanelFrame,
    private readonly opts: MerchantPanelOptions,
  ) {
    this.build();
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  private build(): void {
    const { width: W, height: H, u, sa } = this.frame;
    const wide = W > H * 1.3;
    const shade = this.track(this.scene.add.rectangle(0, 0, W, H, 0x0c0a12, 0.94).setOrigin(0, 0));
    shade.setDepth(100).setInteractive();

    const left = sa.left + 16 * u;
    const right = W - sa.right - 16 * u;
    const top = sa.top + 18 * u;
    this.text(left, top, 'Merchant', 24, { fontStyle: 'bold', color: css(COLORS.accent) });
    this.text(left, top + 32 * u, `You have ${goldOf(this.opts.stash)} gold.`, 13, {
      fontStyle: 'bold',
      color: GOLD_COLOR,
    });
    this.closeButton(right - 20 * u, top + 16 * u);

    const y0 = top + 62 * u;
    const bottom = H - sa.bottom - 16 * u;
    const gap = 12 * u;
    if (wide) {
      const colW = (right - left - gap * 2) / 3;
      this.lanternCard(left, y0, colW, bottom - y0);
      this.recipeCard(left + colW + gap, y0, colW, bottom - y0);
      this.sellCard(left + (colW + gap) * 2, y0, colW, bottom - y0);
    } else {
      const lanternH = 132 * u;
      const recipeH = 46 * u + (POTION_IDS.length - 1) * 44 * u;
      this.lanternCard(left, y0, right - left, lanternH);
      this.recipeCard(left, y0 + lanternH + gap, right - left, recipeH);
      const sy = y0 + lanternH + recipeH + gap * 2;
      this.sellCard(left, sy, right - left, bottom - sy);
    }
  }

  private card(x: number, y: number, w: number, h: number, title: string): void {
    const { u } = this.frame;
    const g = this.track(this.scene.add.graphics().setDepth(101));
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(x, y, w, h, 12 * u);
    g.lineStyle(1.5 * u, COLORS.panelEdge, 1).strokeRoundedRect(x, y, w, h, 12 * u);
    this.text(x + 12 * u, y + 10 * u, title, 15, { fontStyle: 'bold' });
  }

  /** Current lantern and the next tier to buy. */
  private lanternCard(x: number, y: number, w: number, h: number): void {
    const { u } = this.frame;
    const level = this.opts.lanternLevel;
    this.card(x, y, w, h, 'Lantern');
    const current = level > 0 ? LANTERN_TIERS[level - 1].name : 'Old lantern';
    this.text(
      x + 12 * u,
      y + 34 * u,
      `${current} · light +${Math.round(level * LANTERN_BONUS_PER_TIER * 100)}%`,
      12,
      {
        color: '#d4d4d8',
      },
    );
    const next = nextLantern(level);
    if (!next) {
      this.text(x + 12 * u, y + 58 * u, 'The best lantern there is.', 12, { color: '#a1a1aa' });
      return;
    }
    this.text(x + 12 * u, y + 58 * u, `Next: ${next.name}`, 13, { fontStyle: 'bold' });
    this.text(
      x + 12 * u,
      y + 76 * u,
      `+${Math.round(LANTERN_BONUS_PER_TIER * 100)}% light radius, for good`,
      12,
      {
        color: '#a1a1aa',
        wordWrap: { width: w - 24 * u },
      },
    );
    const affordable = goldOf(this.opts.stash) >= next.price;
    this.smallButton(
      x + w - 12 * u - 60 * u,
      y + h - 12 * u - 18 * u,
      120 * u,
      36 * u,
      `Buy · ${next.price}`,
      affordable,
      () => this.opts.onBuyLantern(),
    );
  }

  /** Potion recipes: known ones are marked, the others can be bought. */
  private recipeCard(x: number, y: number, w: number, h: number): void {
    const { u } = this.frame;
    this.card(x, y, w, h, 'Recipes');
    const buyable = POTION_IDS.filter((id) => RECIPE_PRICES[id] > 0);
    buyable.forEach((id, i) => {
      const ry = y + 40 * u + i * 44 * u;
      const def = POTIONS[id];
      this.track(
        this.scene.add
          .image(x + 22 * u, ry + 14 * u, 'potion')
          .setTint(def.color)
          .setDisplaySize(20 * u, 23 * u)
          .setDepth(102),
      );
      this.text(x + 40 * u, ry + 14 * u, def.name, 13, { fontStyle: 'bold' }).setOrigin(0, 0.5);
      if (this.opts.recipes.includes(id)) {
        this.text(x + w - 14 * u, ry + 14 * u, 'Known', 12, {
          color: '#bbf7d0',
          fontStyle: 'bold',
        }).setOrigin(1, 0.5);
      } else {
        const price = RECIPE_PRICES[id];
        this.smallButton(
          x + w - 12 * u - 50 * u,
          ry + 14 * u,
          100 * u,
          32 * u,
          `Buy · ${price}`,
          goldOf(this.opts.stash) >= price,
          () => this.opts.onBuyRecipe(id),
        );
      }
    });
  }

  /** Herbs in the stash, sold one per tap. */
  private sellCard(x: number, y: number, w: number, h: number): void {
    const { u } = this.frame;
    this.card(x, y, w, h, 'Sell herbs');
    const owned = (Object.keys(HERBS) as HerbId[]).filter((id) => (this.opts.stash[id] ?? 0) > 0);
    if (owned.length === 0) {
      this.text(x + 12 * u, y + 38 * u, 'No herbs to sell.', 12, { color: '#a1a1aa' });
      return;
    }
    const rowH = 40 * u;
    const maxRows = Math.max(1, Math.floor((h - 44 * u) / rowH));
    owned.slice(0, maxRows).forEach((id, i) => {
      const ry = y + 38 * u + i * rowH;
      const herb = HERBS[id];
      this.track(
        this.scene.add
          .image(x + 22 * u, ry + 14 * u, 'herb')
          .setTint(herb.color)
          .setDisplaySize(18 * u, 20 * u)
          .setDepth(102),
      );
      this.text(x + 40 * u, ry + 14 * u, `${herb.name} ×${this.opts.stash[id]}`, 13, {
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.smallButton(
        x + w - 12 * u - 50 * u,
        ry + 14 * u,
        100 * u,
        32 * u,
        `+${HERB_PRICES[id]} gold`,
        true,
        () => this.opts.onSellHerb(id),
      );
    });
  }

  private smallButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ): void {
    const { u } = this.frame;
    const g = this.track(this.scene.add.graphics().setDepth(102));
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(enabled ? COLORS.accent : 0x3f3a4d, enabled && hover ? 1 : 0.9).fillRoundedRect(
        x - w / 2,
        y - h / 2,
        w,
        h,
        9 * u,
      );
    };
    draw(false);
    this.text(x, y, label, 13, { fontStyle: 'bold', color: enabled ? '#1c1917' : '#71717a' }).setOrigin(0.5);
    if (!enabled) return;
    const zone = this.track(
      this.scene.add.zone(x, y, w, h).setDepth(103).setInteractive({ useHandCursor: true }),
    );
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerup', onClick);
  }

  private closeButton(x: number, y: number): void {
    const { u } = this.frame;
    this.text(x, y, '✕', 22, { fontStyle: 'bold', color: '#d4d4d8' }).setOrigin(0.5);
    const zone = this.track(
      this.scene.add
        .zone(x, y, 48 * u, 48 * u)
        .setDepth(103)
        .setInteractive({ useHandCursor: true }),
    );
    zone.on('pointerup', () => this.opts.onClose());
  }

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
  ): Phaser.GameObjects.Text {
    return this.track(
      this.scene.add
        .text(x, y, value, {
          fontFamily: FONT,
          fontSize: `${Math.round(size * this.frame.u)}px`,
          color: '#ffffff',
          ...opts,
        })
        .setDepth(102),
    );
  }
}
