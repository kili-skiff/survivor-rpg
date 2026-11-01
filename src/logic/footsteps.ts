// Footsteps: turns the hexes walked on an expedition into footprint positions. Pure maths, no Phaser.

import { FOOTSTEPS } from '../config/footsteps';
import { areNeighbors, hexToPixelFlat, parseHexKey } from './hex';

/** One footprint. Positions are in hex sizes (multiply by the hex size to get pixels). */
export interface Footstep {
  x: number;
  y: number;
  /** Direction of travel in radians (0 = to the right, y grows downwards) */
  angle: number;
  /** Which foot: -1 = left of the direction of travel, 1 = right */
  side: -1 | 1;
  /** Opacity, lower for older steps */
  alpha: number;
  /** The hex the step lies in, so the map can hide steps in hexes the player cannot see */
  key: string;
}

/** Footprints along the path, oldest first. Hexes that do not touch (a gap in the path) are not joined. */
export function footstepsOf(path: readonly string[]): Footstep[] {
  const steps: Omit<Footstep, 'alpha'>[] = [];
  const uses = new Map<string, number>();
  let side: -1 | 1 = 1;

  for (let i = 1; i < path.length; i++) {
    const fromKey = path[i - 1];
    const toKey = path[i];
    if (fromKey === toKey) continue;
    const from = parseHexKey(fromKey);
    const to = parseHexKey(toKey);
    if (!areNeighbors(from, to)) continue;

    const a = hexToPixelFlat(from, 1);
    const b = hexToPixelFlat(to, 1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    // To the right of the direction of travel (in screen coordinates, where y points down).
    const rightX = -dy / length;
    const rightY = dx / length;

    // Walking the same way again shifts the prints sideways, so the trips do not lie on top of each other.
    const edge = fromKey < toKey ? `${fromKey}|${toKey}` : `${toKey}|${fromKey}`;
    const before = uses.get(edge) ?? 0;
    uses.set(edge, before + 1);
    const lane = before * FOOTSTEPS.repeatOffset;

    // Steps sit in the middle of equal parts of the way, so none lands right on a hex centre.
    const count = Math.max(1, Math.round(length / FOOTSTEPS.spacing));
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      const offset = side * FOOTSTEPS.sideOffset + lane;
      steps.push({
        x: a.x + dx * t + rightX * offset,
        y: a.y + dy * t + rightY * offset,
        angle,
        side,
        key: t < 0.5 ? fromKey : toKey,
      });
      side = side === 1 ? -1 : 1;
    }
  }

  // The newest steps are the strongest; older ones fade out down to a floor.
  const last = steps.length - 1;
  return steps.map((s, i) => {
    const recent = Math.max(0, 1 - (last - i) / FOOTSTEPS.fadeSteps);
    return { ...s, alpha: FOOTSTEPS.alphaOldest + (FOOTSTEPS.alphaNewest - FOOTSTEPS.alphaOldest) * recent };
  });
}
