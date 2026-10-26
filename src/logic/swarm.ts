// How a horde moves: pure and tested, no Phaser.
//
// Plain "run straight at the player" makes everyone converge on one point and pile into a blob.
// Here each enemy also
//  - keeps a soft personal space and steers around neighbours (a force on the course, not a hard shove),
//  - drifts a little to the side on its own rhythm,
//  - far away aims at where the player was a moment ago (a reaction delay that differs per enemy).
// All of it fades out next to the player, so a crowd can still close in and bite.

import { SWARM } from '../config/balance';

export type Rng = () => number;

export interface SwarmParams {
  cell: number;
  maxPerCell: number;
  personalSpace: number;
  separation: number;
  separationNear: number;
  closeInStart: number;
  closeInEnd: number;
  wobble: number;
  wobbleHz: number;
  aimLagMin: number;
  aimLagMax: number;
  speedJitter: number;
  bodyOverlap: number;
}

export interface Point {
  x: number;
  y: number;
}

/** What the swarm needs to know about one enemy. `steerX`/`steerY` are filled in by `Swarm.steer`. */
export interface SwarmAgent extends Point {
  /** Body radius in the world (px) */
  radius: number;
  /** Speed this frame (px/s), after slowing */
  moveSpeed: number;
  /** Fixed per enemy (0..2π): offsets its sideways drift from the others */
  phase: number;
  /** Where it is heading while it does not look at the player */
  aimX: number;
  aimY: number;
  /** Game time (ms) at which it looks at the player again */
  nextAimAt: number;
  /** Result: the velocity to move with (px/s) */
  steerX: number;
  steerY: number;
}

/** A random speed factor around 1, e.g. 0.75..1.25 for a jitter of 0.25. */
export function speedFactor(params: Pick<SwarmParams, 'speedJitter'>, rng: Rng): number {
  return 1 - params.speedJitter + rng() * 2 * params.speedJitter;
}

/** 0 up to `from`, 1 from `to` on, smooth in between. */
function smoothstep(from: number, to: number, x: number): number {
  if (x <= from) return 0;
  if (x >= to) return 1;
  const t = (x - from) / (to - from);
  return t * t * (3 - 2 * t);
}

function cellKey(cx: number, cy: number): number {
  return cx * 92821 + cy;
}

export class Swarm<A extends SwarmAgent> {
  private readonly grid = new Map<number, A[]>();
  /** Emptied buckets, kept for the next frame so nothing is allocated in the game loop */
  private readonly spare: A[][] = [];

  constructor(readonly params: SwarmParams = SWARM) {}

  /** Sets `steerX`/`steerY` of every agent. Call `separate` afterwards if bodies should not overlap. */
  steer(agents: readonly A[], target: Point, now: number, rng: Rng): void {
    this.index(agents);
    for (let i = 0; i < agents.length; i++) this.steerOne(agents[i], target, now, rng);
  }

  /** Pushes bodies that overlap too much apart (uses the grid of the last `steer`). */
  separate(): void {
    const overlap = this.params.bodyOverlap;
    for (const bucket of this.grid.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i];
          const b = bucket[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = (a.radius + b.radius) * overlap;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          // Exactly on top of each other: split along a direction that differs per enemy.
          const nx = d > 0 ? dx / d : Math.cos(a.phase);
          const ny = d > 0 ? dy / d : Math.sin(a.phase);
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  private index(agents: readonly A[]): void {
    for (const bucket of this.grid.values()) {
      bucket.length = 0;
      this.spare.push(bucket);
    }
    this.grid.clear();
    const { cell, maxPerCell } = this.params;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const key = cellKey(Math.floor(a.x / cell), Math.floor(a.y / cell));
      let bucket = this.grid.get(key);
      if (!bucket) {
        bucket = this.spare.pop() ?? [];
        this.grid.set(key, bucket);
      }
      if (bucket.length < maxPerCell) bucket.push(a);
    }
  }

  private steerOne(a: A, target: Point, now: number, rng: Rng): void {
    const p = this.params;
    const dist = Math.hypot(target.x - a.x, target.y - a.y) || 1;
    // 0 right next to the player, 1 far away: the quirks below only apply when not in biting range.
    const far = smoothstep(p.closeInStart, p.closeInEnd, dist);

    // Aim: close by always at the player, far away at a slightly outdated spot.
    if (dist < p.closeInEnd || now >= a.nextAimAt) {
      a.aimX = target.x;
      a.aimY = target.y;
      a.nextAimAt = now + p.aimLagMin + rng() * (p.aimLagMax - p.aimLagMin);
    }
    let ux = a.aimX - a.x;
    let uy = a.aimY - a.y;
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;

    // Drift to the side, swinging left and right.
    const sway = Math.sin((now / 1000) * p.wobbleHz * Math.PI * 2 + a.phase) * p.wobble * far;
    let vx = ux - uy * sway;
    let vy = uy + ux * sway;

    // Steer away from neighbours that come too close.
    const strength = p.separation * (p.separationNear + (1 - p.separationNear) * far);
    if (strength > 0) {
      const cx = Math.floor(a.x / p.cell);
      const cy = Math.floor(a.y / p.cell);
      let sx = 0;
      let sy = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const bucket = this.grid.get(cellKey(cx + i, cy + j));
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k++) {
            const b = bucket[k];
            if (b === a) continue;
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const space = (a.radius + b.radius) * p.personalSpace;
            const d2 = dx * dx + dy * dy;
            if (d2 >= space * space) continue;
            const d = Math.sqrt(d2);
            const w = 1 - d / space;
            sx += (d > 0 ? dx / d : Math.cos(a.phase)) * w;
            sy += (d > 0 ? dy / d : Math.sin(a.phase)) * w;
          }
        }
      }
      vx += sx * strength;
      vy += sy * strength;
    }

    // Never faster than its own speed; a crowd around it may well slow it down.
    const len = Math.hypot(vx, vy);
    const scale = len > 1 ? 1 / len : 1;
    a.steerX = vx * scale * a.moveSpeed;
    a.steerY = vy * scale * a.moveSpeed;
  }
}
