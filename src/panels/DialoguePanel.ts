import * as Phaser from 'phaser';
import { COLORS, css, FONT } from '../ui/theme';
import type { PanelFrame } from './CauldronPanel';

export interface DialogueButton {
  label: string;
  onClick(): void;
  primary?: boolean;
}

export interface DialoguePanelOptions {
  name: string;
  role: string;
  /** Badge colour of the speaker */
  color: number;
  text: string;
  buttons: DialogueButton[];
}

/**
 * A villager talking: name, text and up to two buttons. A panel on top of any scene, so the menu
 * village can later open it when you walk up to someone.
 */
export class DialoguePanel {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly frame: PanelFrame,
    private readonly opts: DialoguePanelOptions,
  ) {
    this.build();
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  private build(): void {
    const { width: W, height: H, u, sa } = this.frame;
    const shade = this.track(this.scene.add.rectangle(0, 0, W, H, 0x0c0a12, 0.85).setOrigin(0, 0));
    shade.setDepth(100).setInteractive();

    const w = Math.min(W - sa.left - sa.right - 32 * u, 440 * u);
    const x = W / 2 - w / 2;
    const pad = 18 * u;
    const badge = 22 * u;

    // Measure the text first so the card fits it.
    const name = this.text(x + pad + badge * 2 + 12 * u, 0, this.opts.name, 17, { fontStyle: 'bold' });
    const role = this.text(name.x, 0, this.opts.role, 12, { color: '#a1a1aa' });
    const body = this.text(x + pad, 0, this.opts.text, 14, {
      color: '#e4e4e7',
      lineSpacing: 4 * u,
      wordWrap: { width: w - pad * 2 },
    });
    const buttonH = 46 * u;
    const h = pad + badge * 2 + 16 * u + body.height + 20 * u + buttonH + pad;
    const y = Math.max(sa.top + 16 * u, H / 2 - h / 2);

    const g = this.track(this.scene.add.graphics().setDepth(101));
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(x, y, w, h, 14 * u);
    g.lineStyle(2 * u, this.opts.color, 0.9).strokeRoundedRect(x, y, w, h, 14 * u);
    g.fillStyle(this.opts.color, 0.25).fillCircle(x + pad + badge, y + pad + badge, badge);
    g.lineStyle(2 * u, this.opts.color, 1).strokeCircle(x + pad + badge, y + pad + badge, badge);
    this.text(x + pad + badge, y + pad + badge, this.opts.name.split(' ').pop()![0], 20, {
      fontStyle: 'bold',
      color: css(this.opts.color),
    }).setOrigin(0.5);
    name.setY(y + pad + 4 * u);
    role.setY(y + pad + 26 * u);
    body.setY(y + pad + badge * 2 + 16 * u);

    const by = y + h - pad - buttonH / 2;
    const buttons = this.opts.buttons.slice(0, 2);
    const bw = buttons.length === 1 ? Math.min(220 * u, w - pad * 2) : (w - pad * 2 - 12 * u) / 2;
    buttons.forEach((b, i) => {
      const bx = buttons.length === 1 ? W / 2 : x + pad + bw / 2 + i * (bw + 12 * u);
      this.button(bx, by, bw, buttonH, b);
    });
  }

  private button(x: number, y: number, w: number, h: number, b: DialogueButton): void {
    const { u } = this.frame;
    const primary = b.primary ?? false;
    const g = this.track(this.scene.add.graphics().setDepth(102));
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(primary ? COLORS.accent : 0x2e2642, hover ? 1 : 0.92).fillRoundedRect(
        x - w / 2,
        y - h / 2,
        w,
        h,
        10 * u,
      );
      if (!primary)
        g.lineStyle(1.5 * u, COLORS.panelEdge, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10 * u);
    };
    draw(false);
    this.text(x, y, b.label, 15, { fontStyle: 'bold', color: primary ? '#1c1917' : '#ffffff' }).setOrigin(
      0.5,
    );
    const zone = this.track(
      this.scene.add.zone(x, y, w, h).setDepth(103).setInteractive({ useHandCursor: true }),
    );
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerup', () => b.onClick());
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
