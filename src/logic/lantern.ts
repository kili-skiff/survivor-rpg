// The lantern the watchman carries: a pendulum on a chain with a spring and some friction.
// It trails behind while running, swings when you start, stop or turn, and settles when you stand.
// Pure and deterministic, so it can be tested; drawing is done by systems/LanternSystem.

import { LANTERN } from '../config/balance';
import type { Facing } from '../config/sprites';

/** Where the lantern hangs, relative to the hand that holds it, and how fast it moves (px, px/s). */
export interface LanternState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** What the hand is doing: velocity (px/s) and acceleration (px/s²). */
export interface HandMotion {
  vx: number;
  vy: number;
  ax: number;
  ay: number;
}

export type LanternParams = Pick<
  typeof LANTERN,
  'drop' | 'stiffness' | 'damping' | 'inertia' | 'lean' | 'leanMax' | 'maxSwing' | 'maxStep'
>;

/** The lantern hanging still. */
export function restingLantern(p: LanternParams = LANTERN): LanternState {
  return { x: 0, y: p.drop, vx: 0, vy: 0 };
}

/** Advances the lantern by `dt` seconds (split into small steps, so long frames stay stable). */
export function stepLantern(
  state: LanternState,
  motion: HandMotion,
  dt: number,
  p: LanternParams = LANTERN,
): LanternState {
  if (dt <= 0) return state;
  // Running drags the lantern back; the pull is limited so a dash does not throw it far off.
  let leanX = motion.vx * p.lean;
  let leanY = motion.vy * p.lean;
  const lean = Math.hypot(leanX, leanY);
  if (lean > p.leanMax) {
    leanX *= p.leanMax / lean;
    leanY *= p.leanMax / lean;
  }
  const restX = -leanX;
  const restY = p.drop - leanY;

  const steps = Math.ceil(dt / p.maxStep);
  const h = dt / steps;
  let { x, y, vx, vy } = state;
  for (let i = 0; i < steps; i++) {
    // A hand that speeds up leaves the lantern behind: the push works against the hand's acceleration.
    vx += (-p.stiffness * (x - restX) - p.damping * vx - p.inertia * motion.ax) * h;
    vy += (-p.stiffness * (y - restY) - p.damping * vy - p.inertia * motion.ay) * h;
    x += vx * h;
    y += vy * h;
    // The chain is only so long: stay within reach of the hanging spot and lose the outward speed.
    const dx = x;
    const dy = y - p.drop;
    const d = Math.hypot(dx, dy);
    if (d > p.maxSwing) {
      const nx = dx / d;
      const ny = dy / d;
      x = nx * p.maxSwing;
      y = p.drop + ny * p.maxSwing;
      const outward = vx * nx + vy * ny;
      if (outward > 0) {
        vx -= outward * nx;
        vy -= outward * ny;
      }
    }
  }
  return { x, y, vx, vy };
}

export interface Hand {
  /** Offset from the character's centre (px) */
  x: number;
  y: number;
  /** The lantern is drawn behind the character (walking away from the camera) */
  behind: boolean;
}

/** Where the character holds the lantern for a facing: on the side it turns to, otherwise on the right. */
export function handFor(facing: Facing | null, p: { handX: number; handY: number } = LANTERN): Hand {
  const side = facing === 'left' ? -1 : 1;
  return { x: side * p.handX, y: p.handY, behind: facing === 'up' };
}
