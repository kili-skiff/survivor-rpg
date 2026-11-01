import * as Phaser from 'phaser';
import type { WeaponId } from '../config/types';
import { MAIN_WEAPONS, WEAPONS } from '../config/weapons';
import { COLORS, css, FONT } from '../ui/theme';
import type { PanelFrame } from './CauldronPanel';

export interface ArmoryPanelOptions {
  /** The main weapon chosen for the next expedition */
  chosen: WeaponId;
  onChoose(id: WeaponId): void;
  onClose(): void;
}

/**
 * The armory: choose the main weapon for the next expedition. It is the auto attack that carries the
 * build; other weapons come from cards along the way. A panel on top of any scene, like the others.
 */
export class ArmoryPanel {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly frame: PanelFrame,
    private readonly opts: ArmoryPanelOptions,
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
    this.text(left, top, 'Armory', 24, { fontStyle: 'bold', color: css(COLORS.accent) });
    this.text(
      left,
      top + 32 * u,
      'Choose your main weapon for the next expedition. It is the backbone of your build; other weapons come from cards on the way.',
      12,
      { color: '#a1a1aa', wordWrap: { width: right - left - 50 * u } },
    );
    this.closeButton(right - 20 * u, top + 16 * u);

    const y0 = top + (wide ? 64 : 84) * u;
    const gap = 10 * u;
    const cols = wide ? MAIN_WEAPONS.length : 1;
    const cardW = (right - left - gap * (cols - 1)) / cols;
    const cardH = 96 * u;
    MAIN_WEAPONS.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.card(id, left + col * (cardW + gap), y0 + row * (cardH + gap), cardW, cardH);
    });
  }

  private card(id: WeaponId, x: number, y: number, w: number, h: number): void {
    const { u } = this.frame;
    const def = WEAPONS[id];
    const chosen = this.opts.chosen === id;
    const g = this.track(this.scene.add.graphics().setDepth(101));
    g.fillStyle(chosen ? COLORS.panel : 0x17131f, 1).fillRoundedRect(x, y, w, h, 12 * u);
    g.lineStyle((chosen ? 2.5 : 1.5) * u, chosen ? COLORS.accent : COLORS.panelEdge, chosen ? 1 : 0.7);
    g.strokeRoundedRect(x, y, w, h, 12 * u);

    const iconSize = 52 * u;
    this.track(
      this.scene.add
        .image(x + 14 * u + iconSize / 2, y + h / 2, def.texture)
        .setDisplaySize(iconSize, iconSize)
        .setDepth(102),
    );
    const tx = x + 28 * u + iconSize;
    this.text(tx, y + 12 * u, def.name, 16, { fontStyle: 'bold' });
    this.text(tx, y + 34 * u, def.description, 12, {
      color: '#c4c0cf',
      wordWrap: { width: x + w - 14 * u - tx },
    });
    this.text(x + w - 14 * u, y + 12 * u, chosen ? 'Chosen' : 'Tap to choose', 11, {
      fontStyle: 'bold',
      color: chosen ? css(COLORS.accent) : '#71717a',
    }).setOrigin(1, 0);

    if (!chosen) {
      const zone = this.track(
        this.scene.add
          .zone(x + w / 2, y + h / 2, w, h)
          .setDepth(103)
          .setInteractive({ useHandCursor: true }),
      );
      zone.on('pointerup', () => this.opts.onChoose(id));
    }
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
