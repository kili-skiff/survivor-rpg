// The spawn director: decides when and how enemies come, instead of a constant stream.
// A fight runs in cycles: build-up, an announced surge, a breather. Pure and tested, no Phaser.

import { DIRECTOR, type DirectorParams, type SurgeKind } from '../config/director';
import type { Rng } from './spawning';

/** Where a group of new enemies appears around the player */
export type SpawnPattern = 'scatter' | 'side' | 'ring' | 'wall';

/** "Place `count` enemies like this"; `angle` is the side they come from (0 = east, clockwise on screen) */
export interface SpawnOrder {
  count: number;
  pattern: SpawnPattern;
  angle: number;
}

/** Shown to the player when a surge is on its way */
export interface Announcement {
  kind: SurgeKind;
  angle: number;
  text: string;
}

export type DirectorPhase = 'build' | 'warning' | 'surge' | 'breather';

export interface DirectorInput {
  /** Fight time in seconds, including the difficulty offset */
  time: number;
  /** Enemies per second at full strength (the old constant stream, already scaled by the ring) */
  rate: number;
  /** How many more enemies fit in before the enemy cap */
  room: number;
}

export interface DirectorStep {
  orders: SpawnOrder[];
  announce: Announcement | null;
}

const SECTORS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

/** The compass side of an angle (0 = east, clockwise on screen, so up is north). */
export function directionName(angle: number): string {
  const turn = Math.PI * 2;
  const a = ((angle % turn) + turn) % turn;
  return SECTORS[Math.round(a / (Math.PI / 4)) % 8];
}

export function announcementText(kind: SurgeKind, angle: number): string {
  if (kind === 'ring') return 'Something is closing in from all sides!';
  const side = directionName(angle);
  return kind === 'wall'
    ? `A wall of enemies approaches from the ${side}!`
    : `A wave is coming from the ${side}!`;
}

/** Enemies that arrive at once when a surge of this kind starts. */
export function burstCount(kind: SurgeKind, time: number, params: DirectorParams = DIRECTOR): number {
  const s = params.surges[kind];
  if (s.burstMax <= 0) return 0;
  return Math.min(s.burstMax, Math.round(s.burstBase + s.burstPerSec * time));
}

/** The spawn rate multiple of a phase; `progress` (0..1) only matters during the build-up. */
export function pressure(
  phase: DirectorPhase,
  kind: SurgeKind,
  progress: number,
  params: DirectorParams = DIRECTOR,
): number {
  switch (phase) {
    case 'build':
      return params.buildFrom + (params.buildTo - params.buildFrom) * Math.min(1, Math.max(0, progress));
    case 'warning':
      return params.warningMult;
    case 'surge':
      return params.surges[kind].surgeMult;
    case 'breather':
      return params.breatherMult;
  }
}

/**
 * Paces a fight. Call `update` every frame; it returns what to spawn and, now and then, something to
 * announce. The step it returns is reused and only valid until the next call.
 */
export class SpawnDirector {
  phase: DirectorPhase = 'build';
  /** The surge that is announced, running, or was the last one */
  kind: SurgeKind = 'swarm';
  /** The side a swarm or wall comes from */
  angle = 0;
  /** Surges started so far in this fight */
  surges = 0;
  private duration: number;
  private left: number;
  private budget = 0;
  private readonly step: DirectorStep = { orders: [], announce: null };

  constructor(
    private readonly rng: Rng,
    private readonly params: DirectorParams = DIRECTOR,
  ) {
    this.duration = params.openingSec;
    this.left = params.openingSec;
  }

  /** Current spawn rate multiple, for dev readouts. */
  get pressure(): number {
    return pressure(this.phase, this.kind, 1 - this.left / this.duration, this.params);
  }

  update(dt: number, input: DirectorInput): DirectorStep {
    const step = this.step;
    step.orders.length = 0;
    step.announce = null;
    let room = Math.max(0, input.room);

    this.left -= dt;
    while (this.left <= 0) room -= this.advance(input.time, room);

    // The stream: a budget of enemies that fills at the current pressure and is spent in whole ones.
    const p = this.params;
    this.budget = Math.min(p.maxBank, this.budget + input.rate * this.pressure * dt);
    const count = Math.min(Math.floor(this.budget), room, p.maxPerFrame);
    if (count > 0) {
      this.budget -= count;
      const swarm = this.phase === 'surge' && this.kind === 'swarm';
      step.orders.push({ count, pattern: swarm ? 'side' : 'scatter', angle: this.angle });
    }
    return step;
  }

  /** Moves on to the next phase. Returns how many enemies it ordered at once. */
  private advance(time: number, room: number): number {
    const p = this.params;
    const step = this.step;
    let ordered = 0;
    switch (this.phase) {
      case 'build': {
        this.kind = this.pickKind(time);
        this.angle = this.rng() * Math.PI * 2;
        this.phase = 'warning';
        this.setDuration(p.surges[this.kind].warningSec);
        step.announce = { kind: this.kind, angle: this.angle, text: announcementText(this.kind, this.angle) };
        break;
      }
      case 'warning': {
        this.phase = 'surge';
        this.surges += 1;
        this.setDuration(p.surges[this.kind].surgeSec);
        const count = Math.min(room, burstCount(this.kind, time, p));
        if (count > 0) {
          step.orders.push({ count, pattern: this.kind === 'ring' ? 'ring' : 'wall', angle: this.angle });
          ordered = count;
        }
        break;
      }
      case 'surge':
        this.phase = 'breather';
        this.setDuration(p.breatherSec);
        break;
      case 'breather':
        this.phase = 'build';
        this.setDuration(p.buildMinSec + this.rng() * (p.buildMaxSec - p.buildMinSec));
        break;
    }
    return ordered;
  }

  /** Starts the next phase; the time the last one overran carries over. */
  private setDuration(sec: number): void {
    this.duration = sec;
    this.left += sec;
  }

  /** The first surge is always a swarm; later ones are picked by weight among those unlocked. */
  private pickKind(time: number): SurgeKind {
    if (this.surges === 0) return 'swarm';
    const kinds = Object.keys(this.params.surges) as SurgeKind[];
    const open = kinds.filter((k) => this.params.surges[k].from <= time);
    const total = open.reduce((sum, k) => sum + this.params.surges[k].weight, 0);
    let roll = this.rng() * total;
    for (const k of open) {
      roll -= this.params.surges[k].weight;
      if (roll < 0) return k;
    }
    return open[open.length - 1] ?? 'swarm';
  }
}

/**
 * Calls `place` with the spot of every enemy of an order, around the centre (cx, cy) at distance
 * `dist` (just outside the view).
 */
export function forEachSpawnPoint(
  order: SpawnOrder,
  cx: number,
  cy: number,
  dist: number,
  rng: Rng,
  place: (x: number, y: number) => void,
  params: DirectorParams = DIRECTOR,
): void {
  const { count, pattern, angle } = order;
  const turn = Math.PI * 2;
  switch (pattern) {
    case 'scatter':
      for (let i = 0; i < count; i++) {
        const a = rng() * turn;
        place(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist);
      }
      break;
    case 'side':
      // A stream from one side: spread over an arc, a little uneven in depth.
      for (let i = 0; i < count; i++) {
        const a = angle + (rng() - 0.5) * params.sideSpread;
        const d = dist + rng() * 60;
        place(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      }
      break;
    case 'ring':
      // All around the player, evenly spaced.
      for (let i = 0; i < count; i++) {
        const a = angle + (i / count) * turn + (rng() - 0.5) * 0.06;
        const d = dist + rng() * 30;
        place(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      }
      break;
    case 'wall': {
      // A line across one side, perpendicular to the way it comes; more rows behind it when it is long.
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const perRow = Math.max(1, params.wallMax);
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / perRow);
        const inRow = Math.min(perRow, count - row * perRow);
        const offset = ((i % perRow) - (inRow - 1) / 2) * params.wallSpacing;
        const d = dist + row * params.wallSpacing + rng() * 14;
        place(cx + dx * d - dy * offset, cy + dy * d + dx * offset);
      }
      break;
    }
  }
}
