// The walkable village: which station you stand at, and finding a way around houses and fences.
// Pure and tested; the scene feeds it the boxes from the map.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Zone<Id extends string = string> extends Rect {
  id: Id;
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** The zone the point stands in (the first one, if they overlap), or null. */
export function zoneAt<Id extends string>(zones: readonly Zone<Id>[], x: number, y: number): Id | null {
  return zones.find((z) => contains(z, x, y))?.id ?? null;
}

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Which cells of a grid are blocked: a box blocks every cell it touches, grown by `clearance`. */
export class WalkGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(
    width: number,
    height: number,
    readonly cell: number,
    walls: readonly Rect[],
    clearance: number,
  ) {
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (const r of walls) {
      const x0 = Math.max(0, Math.floor((r.x - clearance) / cell));
      const y0 = Math.max(0, Math.floor((r.y - clearance) / cell));
      const x1 = Math.min(this.cols - 1, Math.floor((r.x + r.w + clearance) / cell));
      const y1 = Math.min(this.rows - 1, Math.floor((r.y + r.h + clearance) / cell));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.blocked[y * this.cols + x] = 1;
    }
  }

  isBlocked(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return true;
    return this.blocked[cy * this.cols + cx] === 1;
  }

  cellOf(p: Point): { cx: number; cy: number } {
    return { cx: Math.floor(p.x / this.cell), cy: Math.floor(p.y / this.cell) };
  }

  centerOf(cx: number, cy: number): Point {
    return { x: (cx + 0.5) * this.cell, y: (cy + 0.5) * this.cell };
  }

  /** The nearest free cell to a point (searching outwards), or null if the grid is full. */
  nearestFree(p: Point): { cx: number; cy: number } | null {
    const start = this.cellOf(p);
    if (!this.isBlocked(start.cx, start.cy)) return start;
    const maxR = Math.max(this.cols, this.rows);
    for (let r = 1; r < maxR; r++) {
      let best: { cx: number; cy: number } | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const cx = start.cx + dx;
          const cy = start.cy + dy;
          if (this.isBlocked(cx, cy)) continue;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = { cx, cy };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * The shortest way from one point to another around the blocked cells (A*, eight directions, no cutting
 * corners), as way points: straight stretches are merged and the last point is the goal itself.
 * Returns null when there is no way. Start or goal inside a wall snap to the nearest free cell.
 */
export function findPath(grid: WalkGrid, from: Point, to: Point): Point[] | null {
  const start = grid.nearestFree(from);
  const goal = grid.nearestFree(to);
  if (!start || !goal) return null;
  const { cols } = grid;
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const startI = idx(start.cx, start.cy);
  const goalI = idx(goal.cx, goal.cy);
  const g = new Float64Array(cols * grid.rows).fill(Infinity);
  const came = new Int32Array(cols * grid.rows).fill(-1);
  const closed = new Uint8Array(cols * grid.rows);
  const h = (i: number) => {
    const dx = Math.abs((i % cols) - goal.cx);
    const dy = Math.abs(Math.floor(i / cols) - goal.cy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  // A small binary heap of [f, index]
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = (): number => {
    const top = heap[0][1];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };

  g[startI] = 0;
  push(h(startI), startI);
  while (heap.length > 0) {
    const i = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === goalI) break;
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (grid.isBlocked(nx, ny)) continue;
      // Diagonal steps only when both sides are free, so the walker never scrapes a corner.
      if (dx !== 0 && dy !== 0 && (grid.isBlocked(cx + dx, cy) || grid.isBlocked(cx, cy + dy))) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const cost = g[i] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (cost < g[ni]) {
        g[ni] = cost;
        came[ni] = i;
        push(cost + h(ni), ni);
      }
    }
  }
  if (!closed[goalI]) return null;

  const cells: number[] = [];
  for (let i = goalI; i !== -1; i = came[i]) cells.push(i);
  cells.reverse();
  // Keep only the cells where the direction changes.
  const points: Point[] = [];
  for (let k = 1; k < cells.length; k++) {
    const prev = cells[k - 1];
    const cur = cells[k];
    const next = cells[k + 1];
    const dir = (a: number, b: number) =>
      `${(b % cols) - (a % cols)},${Math.floor(b / cols) - Math.floor(a / cols)}`;
    if (next === undefined || dir(prev, cur) !== dir(cur, next)) {
      points.push(grid.centerOf(cur % cols, Math.floor(cur / cols)));
    }
  }
  // End on the goal itself when it is free, otherwise on its nearest free cell.
  const goalFree = !grid.isBlocked(grid.cellOf(to).cx, grid.cellOf(to).cy);
  if (points.length > 0) points.pop();
  points.push(goalFree ? { ...to } : grid.centerOf(goal.cx, goal.cy));
  return points;
}

/** Direction (length 1) and distance from a point to the next way point. */
export function steer(from: Point, to: Point): { x: number; y: number; dist: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  return dist < 1e-6 ? { x: 0, y: 0, dist: 0 } : { x: dx / dist, y: dy / dist, dist };
}
