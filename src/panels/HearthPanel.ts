import * as Phaser from 'phaser';
import type { DeedId } from '../config/deeds';
import { DEEDS } from '../config/deeds';
import { EMBER_UPGRADES, type EmberUpgradeDef, type EmberUpgradeId } from '../config/emberUpgrades';
import type { Loot } from '../logic/expedition';
import { isUnlocked, nextRankPrice, type HearthRanks } from '../logic/hearth';
import { embersOf, embersText } from '../logic/merchant';
import { COLORS, css, FONT } from '../ui/theme';
import type { PanelFrame } from './CauldronPanel';

export interface HearthPanelOptions {
  stash: Loot;
  ranks: HearthRanks;
  deeds: readonly DeedId[];
  onBuy(id: EmberUpgradeId): void;
  onClose(): void;
}

const EMBER_COLOR = '#fdba74';

/**
 * The Hearth: permanent upgrades bought with embers, a flat list like the power-ups in Vampire Survivors.
 * Each row shows the ranks as dots, what one rank gives and the price of the next; locked ones name the
 * deed that opens them. A panel on top of any scene, like the others.
 */
export class HearthPanel {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly frame: PanelFrame,
    private readonly opts: HearthPanelOptions,
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
    shade.on(
      'pointerup',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) =>
        e.stopPropagation(),
    );

    const left = sa.left + 16 * u;
    const right = W - sa.right - 16 * u;
    const top = sa.top + 18 * u;
    this.text(left, top, 'Hearth', 24, { fontStyle: 'bold', color: css(COLORS.accent) });
    this.text(
      left,
      top + 32 * u,
      `Spend embers on strength for good. You have ${embersText(embersOf(this.opts.stash))}.`,
      12,
      {
        color: EMBER_COLOR,
        wordWrap: { width: right - left - 50 * u },
      },
    );
    this.closeButton(right - 20 * u, top + 16 * u);

    const y0 = top + (wide ? 58 : 64) * u;
    const gap = 8 * u;
    const cols = wide ? 2 : 1;
    const rows = Math.ceil(EMBER_UPGRADES.length / cols);
    const rowH = Math.min(62 * u, (H - sa.bottom - 12 * u - y0 - gap * (rows - 1)) / rows);
    const colW = (right - left - gap * (cols - 1)) / cols;
    EMBER_UPGRADES.forEach((def, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      this.row(def, left + col * (colW + gap), y0 + row * (rowH + gap), colW, rowH);
    });
  }

  private row(def: EmberUpgradeDef, x: number, y: number, w: number, h: number): void {
    const { u } = this.frame;
    const rank = this.opts.ranks[def.id] ?? 0;
    const unlocked = isUnlocked(def, this.opts.deeds);
    const price = nextRankPrice(def, this.opts.ranks);
    const affordable = price !== null && embersOf(this.opts.stash) >= price;
    const g = this.track(this.scene.add.graphics().setDepth(101));
    g.fillStyle(unlocked ? COLORS.panel : 0x17131f, 1).fillRoundedRect(x, y, w, h, 10 * u);
    g.lineStyle(1.5 * u, rank > 0 ? COLORS.accent : COLORS.panelEdge, rank > 0 ? 0.8 : 0.6);
    g.strokeRoundedRect(x, y, w, h, 10 * u);

    const iconSize = Math.min(36 * u, h - 14 * u);
    this.track(
      this.scene.add
        .image(x + 10 * u + iconSize / 2, y + h / 2, def.texture)
        .setDisplaySize(iconSize, iconSize)
        .setDepth(102)
        .setAlpha(unlocked ? 1 : 0.35),
    );

    // The button on the right: buy, maxed or locked.
    const bw = 78 * u;
    const bh = Math.min(30 * u, h - 14 * u);
    const bx = x + w - 10 * u - bw;
    const by = y + (h - bh) / 2;
    const label = !unlocked ? 'Locked' : price === null ? 'Max' : `Buy · ${price}`;
    const active = unlocked && affordable;
    g.fillStyle(active ? COLORS.accent : 0x2a2438, 1).fillRoundedRect(bx, by, bw, bh, 8 * u);
    this.text(bx + bw / 2, by + bh / 2, label, 12, {
      fontStyle: 'bold',
      color: active ? '#1c1917' : '#71717a',
    }).setOrigin(0.5);
    if (active) {
      const zone = this.track(
        this.scene.add
          .zone(bx + bw / 2, by + bh / 2, bw + 8 * u, bh + 8 * u)
          .setDepth(103)
          .setInteractive({ useHandCursor: true }),
      );
      zone.on('pointerup', () => this.opts.onBuy(def.id));
    }

    // Name and ranks as dots, then what a rank gives (or which deed opens it).
    const tx = x + 20 * u + iconSize;
    const textW = bx - 8 * u - tx;
    const dots = '●'.repeat(rank) + '○'.repeat(def.maxRank - rank);
    const name = this.text(tx, y + h / 2 - 2 * u, def.name, 14, {
      fontStyle: 'bold',
      color: unlocked ? '#ffffff' : '#71717a',
    }).setOrigin(0, 1);
    this.text(tx + name.width + 8 * u, y + h / 2 - 3 * u, dots, 11, {
      color: rank > 0 ? css(COLORS.accent) : '#52525b',
    }).setOrigin(0, 1);
    const deed = def.unlockedBy ? DEEDS.find((d) => d.id === def.unlockedBy) : undefined;
    const sub = unlocked ? `${def.perRankText} per rank` : `Earn the deed “${deed?.name ?? ''}”`;
    this.text(tx, y + h / 2 + 1 * u, sub, 11, {
      color: unlocked ? '#c4c0cf' : '#71717a',
      fixedWidth: textW,
    });
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
