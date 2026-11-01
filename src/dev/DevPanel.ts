import * as Phaser from 'phaser';
import { FrameWindow, LOW_FPS, RollingRate, readoutLabel, type FpsReading } from './devLogic';
import { devButtonStyle } from './devMode';

/** Frames longer than this are no real frames (the tab was in the background), so they are skipped. */
const IGNORE_ABOVE_MS = 1000;

/** One button in the dev panel. */
export interface DevAction {
  label: () => string;
  /** Shown highlighted while this is on (a mode); the panel header names it when collapsed */
  active?: () => boolean;
  /** Short name for the header while active */
  short?: string;
  run: () => void;
}

/** What the fight looks like right now; `nowMs` is the game clock. */
export interface DevFightStats {
  enemies: number;
  kills: number;
  nowMs: number;
  /** The spawn director's phase and the strength of the stream */
  director?: { phase: string; pressure: number };
}

/**
 * Dev only: one small "DEV" header in the corner. Under it a readout (frame rate, worst frame, enemies,
 * kills per minute, the spawn director's phase) that is always there, and the dev buttons, which fold out when the header is tapped.
 * Folded in, it needs only four short lines; it hides while a menu is open.
 */
export class DevPanel {
  private readonly items: Phaser.GameObjects.Text[] = [];
  private readonly header: Phaser.GameObjects.Text;
  private readonly readout: Phaser.GameObjects.Text;
  private readonly buttons: Phaser.GameObjects.Text[];
  private readonly frames = new FrameWindow();
  private readonly kills = new RollingRate();
  private fps: FpsReading | null = null;
  private lastFrameAt = performance.now();
  private expanded = false;
  private shown = true;
  private u: number;
  private left = 0;
  private top = 0;

  constructor(
    scene: Phaser.Scene,
    u: number,
    private readonly actions: DevAction[],
    private readonly stats: () => DevFightStats,
  ) {
    this.u = u;
    const make = (onTap: () => void) =>
      scene.add
        .text(0, 0, '', devButtonStyle(u))
        .setDepth(1000)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onTap);
    this.header = make(() => {
      this.expanded = !this.expanded;
      this.layout(this.left, this.top, this.u);
    });
    this.readout = scene.add.text(0, 0, 'DEV  …', devButtonStyle(u)).setDepth(1000);
    this.buttons = actions.map((a) =>
      make(() => {
        a.run();
        this.layout(this.left, this.top, this.u);
      }),
    );
    this.items.push(this.header, this.readout, ...this.buttons);
    this.layout(0, 0, u);
  }

  /** Call once per frame. */
  update(): void {
    const now = performance.now();
    const delta = now - this.lastFrameAt;
    this.lastFrameAt = now;
    if (delta > IGNORE_ABOVE_MS) return;
    const reading = this.frames.add(delta);
    if (!reading) return;
    this.fps = reading;
    const s = this.stats();
    this.readout.setText(
      readoutLabel({
        fps: reading,
        enemies: s.enemies,
        killsPerMinute: this.kills.update(s.kills, s.nowMs),
        director: s.director,
      }),
    );
    this.layout(this.left, this.top, this.u);
  }

  /** Hides the whole panel, e.g. while a menu is open. */
  setVisible(visible: boolean): void {
    if (visible === this.shown) return;
    this.shown = visible;
    this.layout(this.left, this.top, this.u);
  }

  /** Puts the panel with its top left corner at (left, top). */
  layout(left: number, top: number, u: number): void {
    this.left = left;
    this.top = top;
    this.u = u;
    const gap = 6 * u;
    const active = this.actions.filter((a) => a.active?.());
    const names = active.map((a) => a.short ?? a.label()).join(', ');
    this.header
      .setText(`DEV ${this.expanded ? '▴' : '▾'}${names ? `  ${names}` : ''}`)
      .setStyle(devButtonStyle(u, this.expanded || active.length > 0));
    this.readout.setStyle(devButtonStyle(u, this.fps !== null && this.fps.fps < LOW_FPS));
    this.actions.forEach((a, i) =>
      this.buttons[i].setText(`DEV  ${a.label()}`).setStyle(devButtonStyle(u, !!a.active?.())),
    );

    let y = top;
    for (const item of [this.header, this.readout]) {
      item.setPosition(left, y).setVisible(this.shown);
      if (item.visible) y += item.height + gap;
    }
    // Buttons wrap into another column when they would run off the bottom (landscape).
    const columnTop = y;
    const maxY = this.header.scene.scale.height - gap;
    let x = left;
    let columnWidth = 0;
    for (const button of this.buttons) {
      button.setVisible(this.shown && this.expanded);
      if (!button.visible) continue;
      if (y + button.height > maxY && y > columnTop) {
        x += columnWidth + gap;
        y = columnTop;
        columnWidth = 0;
      }
      button.setPosition(x, y);
      y += button.height + gap;
      columnWidth = Math.max(columnWidth, button.width);
    }
  }
}
