import * as Phaser from 'phaser';
import { fpsLabel, FrameWindow, LOW_FPS, type FpsReading } from './devLogic';
import { devButtonStyle } from './devMode';

/** Frames longer than this are no real frames (the tab was in the background), so they are skipped. */
const IGNORE_ABOVE_MS = 1000;

/** Dev only: frame rate and worst frame as a small purple label; it lights up below `LOW_FPS`. */
export class FpsCounter {
  readonly text: Phaser.GameObjects.Text;
  private readonly window = new FrameWindow();
  private lastTime = performance.now();
  private reading: FpsReading | null = null;

  constructor(
    scene: Phaser.Scene,
    private u: number,
  ) {
    this.text = scene.add.text(0, 0, 'DEV  … fps', devButtonStyle(u)).setDepth(1000);
  }

  /** Call once per frame. */
  update(): void {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    if (delta > IGNORE_ABOVE_MS) return;
    const r = this.window.add(delta);
    if (!r) return;
    this.reading = r;
    this.refresh();
  }

  /** New UI scale (resize): restyle the label. */
  setScale(u: number): void {
    this.u = u;
    this.refresh();
  }

  private refresh(): void {
    if (!this.reading) return;
    this.text.setText(fpsLabel(this.reading)).setStyle(devButtonStyle(this.u, this.reading.fps < LOW_FPS));
  }
}
