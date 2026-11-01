import * as Phaser from 'phaser';
import { arenaLines, shortNumber, sourceName, type ArenaState } from './arenaLogic';
import { devButtonStyle } from './devMode';

const DEPTH = 1000;
/** Sources shown with a bar */
const MAX_SOURCES = 5;
/** Redraws twice a second; the numbers do not need more */
const EVERY_MS = 500;
/** Folded in: only one short line. Kept for the session, also across arena restarts. */
let folded = false;

/**
 * Dev only: the test arena's numbers in a small box on the right, always visible: where, damage per
 * second, kills per minute, falls, and a bar per damage source with its share. Tapping it folds it into
 * one short line (damage per second) and back.
 */
export class DevArenaBox {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly head: Phaser.GameObjects.Text;
  private readonly rows: Phaser.GameObjects.Text[];
  private nextAt = 0;
  private right = 0;
  private top = 0;
  private u = 1;
  private shown = true;

  constructor(
    scene: Phaser.Scene,
    private readonly state: () => { arena: ArenaState; now: number; logged: number } | null,
  ) {
    this.bg = scene.add.graphics().setDepth(DEPTH);
    this.head = scene.add
      .text(0, 0, '', textStyle(1, 11))
      .setDepth(DEPTH + 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        folded = !folded;
        this.nextAt = 0;
        this.update();
      });
    this.rows = Array.from({ length: MAX_SOURCES }, () =>
      scene.add.text(0, 0, '', textStyle(1, 10)).setDepth(DEPTH + 1),
    );
  }

  /** The box's top right corner. */
  layout(right: number, top: number, u: number): void {
    this.right = right;
    this.top = top;
    this.u = u;
    this.nextAt = 0;
  }

  setVisible(visible: boolean): void {
    if (visible === this.shown) return;
    this.shown = visible;
    this.nextAt = 0;
  }

  update(): void {
    const now = performance.now();
    if (now < this.nextAt) return;
    this.nextAt = now + EVERY_MS;
    const s = this.state();
    const g = this.bg.clear();
    const visible = s !== null && this.shown;
    this.head.setVisible(visible);
    for (const r of this.rows) r.setVisible(false);
    if (!visible) return;

    const { u } = this;
    const pad = 8 * u;
    if (folded) {
      this.head.setStyle(textStyle(u, 11)).setText(`ARENA ▸ ${shortNumber(s.arena.meter.dps(s.now))} dps`);
      const w = this.head.width + pad * 2;
      this.head.setPosition(this.right - w + pad, this.top + pad);
      g.fillStyle(0x1e0b33, 0.85).fillRoundedRect(
        this.right - w,
        this.top,
        w,
        this.head.height + pad * 2,
        8 * u,
      );
      return;
    }
    const width = 176 * u;
    const left = this.right - width;
    const lines = arenaLines({ ...s.arena, now: s.now });
    lines[0] = lines[0].replace('ARENA', 'ARENA ▾');
    if (s.logged > 0) lines.push(`log: ${s.logged} saved`);
    this.head
      .setStyle(textStyle(u, 11))
      .setText(lines.join('\n'))
      .setPosition(left + pad, this.top + pad);
    const barH = 15 * u;
    const inner = width - pad * 2;
    const shares = s.arena.meter.shares().slice(0, MAX_SOURCES);
    const barsTop = this.top + pad + this.head.height + 6 * u;
    const height = barsTop - this.top + shares.length * (barH + 3 * u) + pad - 3 * u;
    g.fillStyle(0x1e0b33, 0.85).fillRoundedRect(left, this.top, width, height, 8 * u);
    shares.forEach((share, i) => {
      const y = barsTop + i * (barH + 3 * u);
      g.fillStyle(0x3b0764, 1).fillRect(left + pad, y, inner, barH);
      g.fillStyle(0xa21caf, 1).fillRect(left + pad, y, inner * share.share, barH);
      this.rows[i]
        .setStyle(textStyle(u, 10))
        .setText(`${sourceName(share.source)} ${Math.round(share.share * 100)}%`)
        .setPosition(left + pad + 4 * u, y + 1 * u)
        .setVisible(true);
    });
  }
}

function textStyle(u: number, size: number) {
  return {
    ...devButtonStyle(u),
    backgroundColor: undefined,
    padding: { x: 0, y: 0 },
    fontSize: `${Math.round(size * u)}px`,
    color: '#f5d0fe',
  };
}
