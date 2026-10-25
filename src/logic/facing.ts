import type { Facing } from '../config/sprites';

/** Facing for a movement direction: the larger axis wins (ties go up or down). */
export function facingFor(dx: number, dy: number): Facing {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}
