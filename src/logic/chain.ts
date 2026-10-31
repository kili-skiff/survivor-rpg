// Chain Lightning: where a strike starts and where it jumps. Pure and tested, no Phaser.

export interface ChainTarget {
  id: number;
  x: number;
  y: number;
  /** Body radius (px) */
  r: number;
}

/**
 * The enemy a strike starts at, among those within `range` of (px, py) that are not in `taken`.
 * With `seek` > 0 it is the one with the most neighbours within `crowdRadius`; else (or on a tie)
 * the nearest.
 */
export function pickChainStart(
  targets: readonly ChainTarget[],
  px: number,
  py: number,
  range: number,
  seek: number,
  crowdRadius: number,
  taken: ReadonlySet<number>,
): ChainTarget | undefined {
  let best: ChainTarget | undefined;
  let bestCrowd = -1;
  let bestDist = Infinity;
  for (const t of targets) {
    if (taken.has(t.id)) continue;
    const d = Math.hypot(t.x - px, t.y - py);
    if (d > range + t.r) continue;
    let crowd = 0;
    if (seek > 0) {
      for (const o of targets) {
        if (o !== t && Math.hypot(o.x - t.x, o.y - t.y) <= crowdRadius + o.r) crowd += 1;
      }
    }
    if (crowd > bestCrowd || (crowd === bestCrowd && d < bestDist)) {
      best = t;
      bestCrowd = crowd;
      bestDist = d;
    }
  }
  return best;
}

/**
 * The path of a strike: it starts at `first` and jumps up to `jumps` times, each time to the nearest
 * enemy not hit yet within `jumpRange` of the one before. The first entry is `first` itself.
 */
export function buildChain(
  first: ChainTarget,
  targets: readonly ChainTarget[],
  jumps: number,
  jumpRange: number,
): ChainTarget[] {
  const path = [first];
  const hit = new Set<number>([first.id]);
  let at = first;
  for (let i = 0; i < jumps; i++) {
    let next: ChainTarget | undefined;
    let nextDist = Infinity;
    for (const t of targets) {
      if (hit.has(t.id)) continue;
      const d = Math.hypot(t.x - at.x, t.y - at.y);
      if (d <= jumpRange + t.r && d < nextDist) {
        next = t;
        nextDist = d;
      }
    }
    if (!next) break;
    path.push(next);
    hit.add(next.id);
    at = next;
  }
  return path;
}

/** Damage of the n-th hit (0 = the first) of a strike; each jump keeps `falloff` of the one before. */
export function chainDamage(base: number, index: number, falloff: number): number {
  return base * Math.pow(falloff, index);
}
