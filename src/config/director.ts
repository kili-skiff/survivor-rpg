// How the spawn director paces a fight (logic/director.ts). Times are seconds, distances px.
//
// A fight runs in cycles: the horde builds up, a warning is announced, a surge hits, and then a
// breather lets the player recover. The pressure is the stream from logic/spawning.ts (SPAWN)
// multiplied by a factor per phase, so a whole cycle brings roughly as many enemies as the stream,
// only in a shape.

export type SurgeKind = 'swarm' | 'ring' | 'wall';

export interface SurgeDef {
  /** How often this kind is picked, relative to the others */
  weight: number;
  /** Earliest fight time (difficulty seconds) at which it can come */
  from: number;
  /** Announcement before it hits */
  warningSec: number;
  /** How long the surge lasts after the warning */
  surgeSec: number;
  /** Spawn rate during the surge, as a multiple of the normal stream */
  surgeMult: number;
  /** Enemies that arrive at once when the surge starts: base + perSec * fight time, up to max (0 = none) */
  burstBase: number;
  burstPerSec: number;
  burstMax: number;
}

export interface DirectorParams {
  openingSec: number;
  buildMinSec: number;
  buildMaxSec: number;
  buildFrom: number;
  buildTo: number;
  warningMult: number;
  breatherSec: number;
  breatherMult: number;
  maxBank: number;
  maxPerFrame: number;
  sideSpread: number;
  aheadShare: number;
  aheadSpread: number;
  minHeadingSpeed: number;
  spawnMargin: number;
  recycleMargin: number;
  recycleSpread: number;
  recycleGraceSec: number;
  wallSpacing: number;
  wallMax: number;
  surges: Record<SurgeKind, SurgeDef>;
}

export const DIRECTOR: DirectorParams = {
  /** The first build-up of a fight is longer and gentler, so the player can find their feet */
  openingSec: 24,
  /** Later build-ups last a random time between these */
  buildMinSec: 14,
  buildMaxSec: 20,
  /** Spawn rate multiple at the start and at the end of a build-up (it rises in a straight line) */
  buildFrom: 0.6,
  buildTo: 1,
  /** Spawn rate multiple while a surge is announced: the calm before the storm */
  warningMult: 0.5,
  /** The breather after a surge: almost nothing spawns */
  breatherSec: 6,
  breatherMult: 0.15,
  /** Spawned enemies that are not yet in play are never banked beyond this (e.g. while at the enemy cap) */
  maxBank: 24,
  /** At most this many enemies are placed in one frame by the stream */
  maxPerFrame: 6,
  /** A swarm surge comes from one side: enemies spread over this angle (radians, total) */
  sideSpread: 1.1,
  /**
   * While the player moves, this share of the scattered enemies appears ahead of them, within this angle
   * (radians, total), so the player runs into enemies instead of only dragging a crowd behind them.
   */
  aheadShare: 0.5,
  aheadSpread: 2.1,
  /** Below this speed (px/s) the player counts as standing: enemies come from all sides */
  minHeadingSpeed: 30,
  /** Scattered enemies and enemies coming from one side appear this far outside the edge of the view (px) */
  spawnMargin: 40,
  /**
   * An enemy further than this outside the edge of the view (px) is moved ahead of the player, spread
   * over this angle (radians, total). It thins out the tail of enemies that fell behind.
   */
  recycleMargin: 60,
  recycleSpread: 2.6,
  /**
   * Freshly placed enemies are left alone this long (s), so rings and the far ends of a wall (they are
   * placed on a circle, further out than the edge of the view) are not moved away before they arrive.
   * Beyond 0.8 of the view's diagonal an enemy is always moved.
   */
  recycleGraceSec: 6,
  /** Space between enemies in a wall (px) and the most a wall holds */
  wallSpacing: 34,
  wallMax: 26,
  /** The kinds of surge. The first one of a fight is always a swarm, so the player learns what it means. */
  surges: {
    swarm: {
      weight: 3,
      from: 0,
      warningSec: 2.5,
      surgeSec: 8,
      surgeMult: 2,
      burstBase: 0,
      burstPerSec: 0,
      burstMax: 0,
    },
    ring: {
      weight: 1,
      from: 60,
      warningSec: 3,
      surgeSec: 6,
      surgeMult: 1.5,
      burstBase: 12,
      burstPerSec: 0.12,
      burstMax: 36,
    },
    wall: {
      weight: 1,
      from: 90,
      warningSec: 3,
      surgeSec: 6,
      surgeMult: 1.5,
      burstBase: 10,
      burstPerSec: 0.1,
      burstMax: 26,
    },
  },
};
