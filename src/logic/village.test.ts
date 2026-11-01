import { describe, expect, it } from 'vitest';
import { contains, findPath, steer, WalkGrid, zoneAt, type Point, type Rect } from './village';

/** Walks the way points and checks that no straight stretch crosses a wall. */
function crossesWall(from: Point, path: Point[], walls: Rect[]): boolean {
  let a = from;
  for (const b of path) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
    for (let s = 0; s <= steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / Math.max(1, steps);
      const y = a.y + ((b.y - a.y) * s) / Math.max(1, steps);
      if (walls.some((w) => contains(w, x, y))) return true;
    }
    a = b;
  }
  return false;
}

describe('zones', () => {
  const zones = [
    { id: 'cauldron', x: 10, y: 10, w: 20, h: 10 },
    { id: 'hearth', x: 100, y: 100, w: 30, h: 30 },
  ];

  it('finds the zone a point stands in', () => {
    expect(zoneAt(zones, 15, 15)).toBe('cauldron');
    expect(zoneAt(zones, 130, 130)).toBe('hearth');
  });

  it('returns null outside every zone', () => {
    expect(zoneAt(zones, 50, 50)).toBeNull();
  });
});

describe('finding a way', () => {
  // A wall across the middle with a gap at the bottom
  const walls: Rect[] = [{ x: 90, y: 0, w: 20, h: 160 }];
  const grid = new WalkGrid(200, 200, 10, walls, 4);

  it('goes around a wall through the gap', () => {
    const from = { x: 20, y: 20 };
    const to = { x: 180, y: 20 };
    const path = findPath(grid, from, to)!;
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toEqual(to);
    expect(crossesWall(from, path, walls)).toBe(false);
    // It has to pass below the wall.
    expect(Math.max(...path.map((p) => p.y))).toBeGreaterThan(160);
  });

  it('merges straight stretches into few way points', () => {
    const open = new WalkGrid(200, 200, 10, [], 0);
    const path = findPath(open, { x: 5, y: 5 }, { x: 195, y: 5 })!;
    expect(path).toEqual([{ x: 195, y: 5 }]);
  });

  it('ends next to a goal that lies inside a wall', () => {
    const path = findPath(grid, { x: 20, y: 20 }, { x: 100, y: 50 })!;
    const end = path[path.length - 1];
    expect(grid.isBlocked(grid.cellOf(end).cx, grid.cellOf(end).cy)).toBe(false);
  });

  it('returns null when the goal is walled in', () => {
    const box: Rect[] = [
      { x: 140, y: 140, w: 60, h: 4 },
      { x: 140, y: 140, w: 4, h: 60 },
    ];
    const closed = new WalkGrid(200, 200, 10, box, 0);
    expect(findPath(closed, { x: 20, y: 20 }, { x: 180, y: 180 })).toBeNull();
  });

  it('never cuts a corner diagonally', () => {
    const corner: Rect[] = [{ x: 50, y: 50, w: 10, h: 10 }];
    const g = new WalkGrid(100, 100, 10, corner, 0);
    const from = { x: 45, y: 65 };
    const path = findPath(g, from, { x: 65, y: 45 })!;
    expect(crossesWall(from, path, corner)).toBe(false);
  });
});

describe('steer', () => {
  it('points at the target with length 1', () => {
    const s = steer({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(s.dist).toBe(5);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1);
  });

  it('stands still on the target', () => {
    expect(steer({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 0, y: 0, dist: 0 });
  });
});
