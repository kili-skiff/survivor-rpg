// One input layer for all devices: touch, keyboard (and later gamepads)
// write into it, the game logic only reads actions.

import type { PotionId } from '../config/types';

export type Action = 'dash' | 'nova' | 'pause' | `drink:${PotionId}`;

export class InputState {
  /** Movement direction, length 0..1 */
  moveX = 0;
  moveY = 0;
  private pressed = new Set<Action>();

  setMove(x: number, y: number): void {
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.moveX = x;
    this.moveY = y;
  }

  press(action: Action): void {
    this.pressed.add(action);
  }

  /** Returns true if the action was triggered since it was last consumed. */
  consume(action: Action): boolean {
    const had = this.pressed.has(action);
    this.pressed.delete(action);
    return had;
  }

  reset(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.pressed.clear();
  }
}
