import type { WeaponStats } from '../../config/types';

/** Behaviour of one automatic weapon. Its numbers come from config/weapons.ts. */
export interface Weapon {
  update(stats: WeaponStats, dms: number, dt: number): void;
  /** Takes back everything it has in the air (e.g. when the weapon is taken away) */
  clear?(): void;
}

/** Delay before a newly acquired weapon fires for the first time (ms) */
export const FIRST_SHOT_DELAY = 300;
