import * as Phaser from 'phaser';
import { FrameWindow, LOW_FPS, RollingRate, readoutParts, type FpsReading } from './devLogic';
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

/** A row of buttons with a small title in front (e.g. "Fight", "Build"). */
export interface DevGroup {
  title: string;
  actions: DevAction[];
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
 * Dev only: one small "DEV" header in the corner that also shows the frame rate and the enemies. Tapped,
 * it folds out the details (worst frame, kills per minute, the spawn director) and the buttons, grouped in
 * short rows. It hides while a menu is open.
 */
export class DevPanel {
  private readonly header: Phaser.GameObjects.Text;
  private readonly details: Phaser.GameObjects.Text;
  private readonly titles: Phaser.GameObjects.Text[];
  private readonly buttons: Phaser.GameObjects.Text[][];
  private readonly frames = new FrameWindow();
  private readonly kills = new RollingRate();
  private fps: FpsReading | null = null;
  private summary = '…';
  private lastFrameAt = performance.now();
  private expanded = false;
  private shown = true;
  private u: number;
  private left = 0;
  private top = 0;
  private maxRight = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    u: number,
    private readonly groups: DevGroup[],
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
      this.relayout();
    });
    this.details = scene.add.text(0, 0, '', devButtonStyle(u)).setDepth(1000);
    this.titles = groups.map((g) => scene.add.text(0, 0, g.title, titleStyle(u)).setDepth(1000));
    this.buttons = groups.map((g) =>
      g.actions.map((a) =>
        make(() => {
          a.run();
          this.relayout();
        }),
      ),
    );
    this.relayout();
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
    const parts = readoutParts({
      fps: reading,
      enemies: s.enemies,
      killsPerMinute: this.kills.update(s.kills, s.nowMs),
      director: s.director,
    });
    this.summary = parts.summary;
    this.details.setText(parts.details);
    this.relayout();
  }

  /** Hides the whole panel, e.g. while a menu is open. */
  setVisible(visible: boolean): void {
    if (visible === this.shown) return;
    this.shown = visible;
    this.relayout();
  }

  /** Puts the panel with its top left corner at (left, top); rows wrap before `maxRight`. */
  layout(left: number, top: number, u: number, maxRight = this.scene.scale.width): void {
    this.left = left;
    this.top = top;
    this.u = u;
    this.maxRight = maxRight;
    this.relayout();
  }

  private relayout(): void {
    const { u, left } = this;
    const gap = 5 * u;
    const actions = this.groups.flatMap((g) => g.actions);
    const active = actions.filter((a) => a.active?.());
    const modes = active.map((a) => a.short ?? a.label()).join(', ');
    const lowFps = this.fps !== null && this.fps.fps < LOW_FPS;
    this.header
      .setText(`DEV ${this.expanded ? '▴' : '▾'}  ${this.summary}${modes ? `  · ${modes}` : ''}`)
      .setStyle(devButtonStyle(u, this.expanded || active.length > 0 || lowFps))
      .setPosition(left, this.top)
      .setVisible(this.shown);
    const open = this.shown && this.expanded;
    let y = this.top + this.header.height + gap;
    this.details.setStyle(devButtonStyle(u)).setPosition(left, y).setVisible(open);
    if (open) y += this.details.height + gap;

    // Each group: its title, then its buttons in a row that wraps.
    const maxRight = Math.max(left + 160 * u, this.maxRight || this.scene.scale.width);
    this.groups.forEach((g, gi) => {
      const title = this.titles[gi].setStyle(titleStyle(u)).setVisible(open);
      const titleW = Math.max(...this.titles.map((t) => t.width)) + 8 * u;
      const buttons = this.buttons[gi];
      let x = left + titleW;
      let rowH = 0;
      title.setPosition(left, y + 5 * u);
      g.actions.forEach((a, i) => {
        const b = buttons[i].setText(a.label()).setStyle(compactStyle(u, !!a.active?.())).setVisible(open);
        if (x + b.width > maxRight && x > left + titleW) {
          x = left + titleW;
          y += rowH + gap;
          rowH = 0;
        }
        b.setPosition(x, y);
        x += b.width + gap;
        rowH = Math.max(rowH, b.height);
      });
      if (open) y += rowH + gap;
    });
  }
}

/** The small grey title in front of a group's buttons. */
function titleStyle(u: number) {
  return {
    ...devButtonStyle(u),
    backgroundColor: undefined,
    color: '#c4b5fd',
    fontSize: `${Math.round(11 * u)}px`,
  };
}

/** Buttons in a group: smaller than the header, so a row holds several. */
function compactStyle(u: number, active: boolean) {
  return {
    ...devButtonStyle(u, active),
    fontSize: `${Math.round(11 * u)}px`,
    padding: { x: Math.round(8 * u), y: Math.round(6 * u) },
  };
}
