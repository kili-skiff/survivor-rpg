import * as Phaser from 'phaser';
import { deedRewardShort } from '../logic/deeds';
import { DEEDS, type DeedDef, type DeedId } from '../config/deeds';
import { devButtonStyle } from '../dev/devMode'; // DEV:
import { COLORS, css, FONT } from '../ui/theme';
import type { PanelFrame } from './CauldronPanel';

export interface DeedsPanelOptions {
  /** Deeds the player has earned */
  earned: readonly DeedId[];
  onClose(): void;
  /** DEV: grants all deeds, or takes them all back; only passed in dev mode */
  onDevToggle?: () => void;
}

/**
 * Deeds: milestones of exploring and the bonuses they give for good. Earned ones shine, open ones
 * show what is still out there. A panel on top of any scene, like the other village panels.
 */
export class DeedsPanel {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly frame: PanelFrame,
    private readonly opts: DeedsPanelOptions,
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
    const count = DEEDS.filter((d) => this.opts.earned.includes(d.id)).length;
    const title = this.text(left, top, 'Deeds', 24, { fontStyle: 'bold', color: css(COLORS.accent) });
    this.text(title.x + title.width + 12 * u, top + 8 * u, `${count} / ${DEEDS.length}`, 14, {
      fontStyle: 'bold',
      color: '#d4d4d8',
    });
    this.text(
      left,
      top + 32 * u,
      'Earned by exploring, kept when you fall. Each pays embers; some open upgrades at the Hearth.',
      12,
      {
        color: '#a1a1aa',
        wordWrap: { width: right - left - 50 * u },
      },
    );
    this.closeButton(right - 20 * u, top + 16 * u);
    // DEV: all deeds on or off, to try out their bonuses.
    if (this.opts.onDevToggle) {
      const toggle = this.opts.onDevToggle;
      const all = count === DEEDS.length;
      const t = this.track(
        this.scene.add
          .text(right - 52 * u, top + 2 * u, all ? 'DEV  no deeds' : 'DEV  all deeds', devButtonStyle(u))
          .setOrigin(1, 0)
          .setDepth(103),
      );
      t.setInteractive({ useHandCursor: true }).on('pointerup', toggle);
    }

    const y0 = top + (wide ? 58 : 72) * u;
    const bottom = H - sa.bottom - 16 * u;
    const gap = 8 * u;
    const cols = wide ? 3 : 1;
    const rows = Math.ceil(DEEDS.length / cols);
    const cardW = (right - left - gap * (cols - 1)) / cols;
    const cardH = Math.min(62 * u, (bottom - y0 - gap * (rows - 1)) / rows);
    DEEDS.forEach((def, i) => {
      // Columns fill top to bottom, so each direction of progress reads as a list.
      const col = Math.floor(i / rows);
      const row = i % rows;
      this.card(def, left + col * (cardW + gap), y0 + row * (cardH + gap), cardW, cardH);
    });
  }

  private card(def: DeedDef, x: number, y: number, w: number, h: number): void {
    const { u } = this.frame;
    const earned = this.opts.earned.includes(def.id);
    const g = this.track(this.scene.add.graphics().setDepth(101));
    g.fillStyle(earned ? COLORS.panel : 0x17131f, 1).fillRoundedRect(x, y, w, h, 10 * u);
    g.lineStyle(1.5 * u, earned ? COLORS.accent : COLORS.panelEdge, earned ? 0.9 : 0.6).strokeRoundedRect(
      x,
      y,
      w,
      h,
      10 * u,
    );

    // Badge: a gold check for earned deeds, an empty ring for open ones.
    const r = 11 * u;
    const bx = x + 12 * u + r;
    const by = y + h / 2;
    if (earned) {
      g.fillStyle(COLORS.accent, 1).fillCircle(bx, by, r);
      this.text(bx, by, '✓', 13, { fontStyle: 'bold', color: '#1c1917' }).setOrigin(0.5);
    } else {
      g.lineStyle(1.5 * u, COLORS.panelEdge, 1).strokeCircle(bx, by, r);
    }

    const tx = bx + r + 10 * u;
    const bonus = this.text(x + w - 12 * u, 0, deedRewardShort(def), 12, {
      fontStyle: 'bold',
      color: earned ? css(COLORS.accent) : '#71717a',
      align: 'right',
      wordWrap: { width: Math.min(130 * u, w * 0.4) },
    }).setOrigin(1, 0.5);
    bonus.setY(by);
    const textW = bonus.x - bonus.width - 8 * u - tx;
    const showDesc = h >= 46 * u;
    const name = this.text(tx, 0, def.name, 14, {
      fontStyle: 'bold',
      color: earned ? '#ffffff' : '#a1a1aa',
    });
    if (showDesc) {
      const desc = this.text(tx, 0, def.description, 11, {
        color: earned ? '#c4c0cf' : '#71717a',
        wordWrap: { width: textW },
      });
      const total = name.height + 2 * u + desc.height;
      name.setY(by - total / 2);
      desc.setY(name.y + name.height + 2 * u);
    } else {
      name.setOrigin(0, 0.5).setY(by);
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
