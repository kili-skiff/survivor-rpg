import * as Phaser from 'phaser';
import { HERBS } from '../config/herbs';
import { POTION_IDS, POTIONS } from '../config/potions';
import type { HerbId, PotionId } from '../config/types';
import type { Loot } from '../logic/expedition';
import { brewableCount } from '../logic/potions';
import type { SafeArea } from '../ui/display';
import { COLORS, css, FONT } from '../ui/theme';

export interface PanelFrame {
  width: number;
  height: number;
  /** UI scale of the scene */
  u: number;
  sa: SafeArea;
}

export interface CauldronPanelOptions {
  stash: Loot;
  onBrew(id: PotionId): void;
  onClose(): void;
}

/**
 * The cauldron: shows the three recipes and brews potions from herbs in the stash.
 * A panel on top of any scene, so the menu village can later open it at a cauldron you walk to.
 * Rebuild it (destroy + new) whenever the stash or the screen size changes.
 */
export class CauldronPanel {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly frame: PanelFrame,
    private readonly opts: CauldronPanelOptions,
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
    const depth = 100;

    const shade = this.track(this.scene.add.rectangle(0, 0, W, H, 0x0c0a12, 0.94).setOrigin(0, 0));
    shade.setDepth(depth).setInteractive();
    shade.on(
      'pointerup',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) =>
        e.stopPropagation(),
    );

    const left = sa.left + 16 * u;
    const right = W - sa.right - 16 * u;
    const top = sa.top + 18 * u;
    this.text(left, top, 'Cauldron', 24, { fontStyle: 'bold', color: css(COLORS.accent) });
    this.text(left, top + 32 * u, 'Brew potions from your herbs, then pack them into your belt.', 12, {
      color: '#a1a1aa',
      wordWrap: { width: right - left - 50 * u },
    });
    this.closeButton(right - 20 * u, top + 16 * u);

    const y0 = top + (wide ? 58 : 72) * u;
    const bottom = H - sa.bottom - 16 * u;
    const gap = 12 * u;
    const n = POTION_IDS.length;
    if (wide) {
      const cardW = (right - left - gap * (n - 1)) / n;
      POTION_IDS.forEach((id, i) => this.card(id, left + i * (cardW + gap), y0, cardW, bottom - y0, true));
    } else {
      const cardH = Math.min(150 * u, (bottom - y0 - gap * (n - 1)) / n);
      POTION_IDS.forEach((id, i) => this.card(id, left, y0 + i * (cardH + gap), right - left, cardH, false));
    }
  }

  private card(id: PotionId, x: number, y: number, w: number, h: number, tall: boolean): void {
    const { u } = this.frame;
    const def = POTIONS[id];
    const stash = this.opts.stash;
    const canBrew = brewableCount(stash, id) > 0;
    const g = this.track(this.scene.add.graphics().setDepth(101));
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(x, y, w, h, 12 * u);
    g.lineStyle(2 * u, canBrew ? def.color : COLORS.panelEdge, 1).strokeRoundedRect(x, y, w, h, 12 * u);

    const pad = 12 * u;
    const iconH = 34 * u;
    this.track(
      this.scene.add
        .image(x + pad + iconH * 0.43, y + pad + iconH / 2, 'potion')
        .setTint(def.color)
        .setDisplaySize(iconH * 0.87, iconH)
        .setDepth(102),
    );
    const tx = x + pad + iconH + 10 * u;
    this.text(tx, y + pad, def.name, 15, { fontStyle: 'bold' });
    this.text(tx, y + pad + 20 * u, `In stash ×${stash[id] ?? 0}`, 11, { color: '#a1a1aa' });

    let ty = y + pad + iconH + 10 * u;
    const desc = this.text(x + pad, ty, def.description, 12, {
      color: '#d4d4d8',
      wordWrap: { width: w - pad * 2 - (tall ? 0 : 110 * u) },
    });
    ty += desc.height + 6 * u;

    // Ingredients: what the recipe needs and what the stash holds.
    const parts = (Object.entries(def.recipe) as [HerbId, number][]).map(([herb, need]) => {
      const have = stash[herb] ?? 0;
      return { text: `${need} ${HERBS[herb].name} (${have})`, ok: have >= need };
    });
    let ix = x + pad;
    for (const part of parts) {
      const t = this.text(ix, ty, part.text, 12, {
        fontStyle: 'bold',
        color: part.ok ? '#bbf7d0' : '#fda4af',
      });
      if (tall) {
        ty += t.height + 2 * u;
      } else ix += t.width + 12 * u;
    }

    const bw = 96 * u;
    const bh = 40 * u;
    const bx = tall ? x + w / 2 : x + w - pad - bw / 2;
    const by = tall ? y + h - pad - bh / 2 : y + h / 2;
    this.brewButton(bx, by, bw, bh, canBrew, () => this.opts.onBrew(id));
  }

  private brewButton(
    x: number,
    y: number,
    w: number,
    h: number,
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
        10 * u,
      );
    };
    draw(false);
    this.text(x, y, 'Brew', 15, { fontStyle: 'bold', color: enabled ? '#1c1917' : '#71717a' }).setOrigin(0.5);
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
