import * as Phaser from 'phaser';
import type { UpgradeOption } from '../logic/upgrades';
import { DEV_UPGRADE_GROUPS, type DevUpgradeEntry, type DevUpgradeGroup } from './devLogic';
import { devButtonStyle } from './devMode';

export interface DevUpgradePickerOptions {
  /** Every upgrade that could come now (asked again after each pick) */
  list: () => DevUpgradeEntry[];
  pick: (option: UpgradeOption) => void;
  onClose: () => void;
}

const DEPTH = 1100;

/**
 * Dev only: a full-screen list of every upgrade that could come now, in tabs (weapons, items, other),
 * page by page. Tapping one applies it at once; the list stays open for the next pick until ✕.
 * Objects are rebuilt on each change; that is fine for a dev tool outside the game loop.
 */
export class DevUpgradePicker {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private group: DevUpgradeGroup = 'weapons';
  private page = 0;
  private shown = false;
  private size = { w: 0, h: 0, u: 1, top: 0, bottom: 0, left: 0, right: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: DevUpgradePickerOptions,
  ) {}

  get isOpen(): boolean {
    return this.shown;
  }

  open(): void {
    this.shown = true;
    this.page = 0;
    this.render();
  }

  close(): void {
    if (!this.shown) return;
    this.shown = false;
    this.render();
    this.opts.onClose();
  }

  /** The screen size and the safe area insets; redraws when open. */
  layout(
    w: number,
    h: number,
    u: number,
    inset: { top: number; bottom: number; left: number; right: number },
  ): void {
    this.size = { w, h, u, ...inset };
    if (this.shown) this.render();
  }

  private render(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    if (!this.shown) return;
    const { scene } = this;
    const { w: W, h: H, u } = this.size;
    const m = 12 * u;
    const left = this.size.left + m;
    const right = W - this.size.right - m;
    const top = this.size.top + m;
    const bottom = H - this.size.bottom - m;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.objects.push(o);
      return o;
    };
    const button = (x: number, y: number, label: string, active: boolean, onTap: () => void) =>
      add(
        scene.add
          .text(x, y, label, devButtonStyle(u, active))
          .setDepth(DEPTH + 1)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', onTap),
      );

    // Swallows taps, so nothing below reacts.
    add(scene.add.rectangle(0, 0, W, H, 0x0b0613, 0.92).setOrigin(0).setDepth(DEPTH).setInteractive());

    // Tabs and close.
    let x = left;
    for (const g of DEV_UPGRADE_GROUPS) {
      const t = button(x, top, g, g === this.group, () => {
        this.group = g;
        this.page = 0;
        this.render();
      });
      x += t.width + 6 * u;
    }
    const close = button(right, top, '✕', false, () => this.close());
    close.setOrigin(1, 0);

    // Rows: two columns when wide.
    const entries = this.opts.list().filter((e) => e.group === this.group);
    const cols = W > H ? 2 : 1;
    const gap = 6 * u;
    const colW = (right - left - gap * (cols - 1)) / cols;
    const rowH = 40 * u;
    const listTop = top + 40 * u;
    const listBottom = bottom - 40 * u;
    const perCol = Math.max(1, Math.floor((listBottom - listTop) / (rowH + gap)));
    const perPage = perCol * cols;
    const pages = Math.max(1, Math.ceil(entries.length / perPage));
    this.page = Math.min(this.page, pages - 1);
    const shown = entries.slice(this.page * perPage, (this.page + 1) * perPage);
    shown.forEach((entry, i) => {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const style = devButtonStyle(u);
      add(
        scene.add
          .text(left + col * (colW + gap), listTop + row * (rowH + gap), entry.label, {
            ...style,
            fontSize: `${Math.round(11 * u)}px`,
            fixedWidth: colW,
            fixedHeight: rowH,
            wordWrap: { width: colW - 2 * style.padding.x },
            maxLines: 2,
            padding: { x: style.padding.x, y: Math.round(5 * u) },
          })
          .setDepth(DEPTH + 1)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            this.opts.pick(entry.option);
            this.render();
          }),
      );
    });
    if (entries.length === 0) {
      add(scene.add.text(left, listTop, 'nothing left here', devButtonStyle(u)).setDepth(DEPTH + 1));
    }

    // Pages.
    const pageY = bottom - 30 * u;
    button(left, pageY, '◂ prev', false, () => {
      this.page = (this.page - 1 + pages) % pages;
      this.render();
    });
    add(
      scene.add
        .text(W / 2, pageY, `${this.page + 1} / ${pages}`, devButtonStyle(u))
        .setOrigin(0.5, 0)
        .setDepth(DEPTH + 1),
    );
    button(right, pageY, 'next ▸', false, () => {
      this.page = (this.page + 1) % pages;
      this.render();
    }).setOrigin(1, 0);
  }
}
