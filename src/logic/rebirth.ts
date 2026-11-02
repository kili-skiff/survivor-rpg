// The watchman rising from the Nest's fire, as a pure function of time.

import { REBIRTH } from '../config/rebirth';

export interface RebirthFrame {
  /** Height of the fire: 0 = none, 1 = at its peak */
  fire: number;
  /** How much of the watchman is there: 0 = invisible, 1 = fully visible */
  body: number;
  /** How much he still glows like the fire: 1 = a glowing shape, 0 = his own colours */
  glow: number;
  /** Strength of the lantern's flame: 0 = out, 1 = as usual (a flare can go above 1) */
  lantern: number;
  /** The rebirth is over: the villager may walk */
  done: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

export function rebirthFrame(timeMs: number): RebirthFrame {
  const R = REBIRTH;
  const up = smooth(clamp01(timeMs / R.fireUpMs));
  const down = 1 - smooth(clamp01((timeMs - R.fireDownFrom) / (R.fireOutAt - R.fireDownFrom)));
  const body = smooth(clamp01((timeMs - R.riseFrom) / R.riseMs));
  const glow = body > 0 ? 1 - smooth(clamp01((timeMs - R.glowFrom) / R.glowMs)) : 0;
  const x = clamp01((timeMs - R.lanternFrom) / R.lanternMs);
  const lantern = timeMs < R.lanternFrom ? 0 : smooth(x) + R.lanternFlare * Math.sin(Math.PI * x);
  return { fire: Math.min(up, down), body, glow, lantern, done: timeMs >= R.totalMs };
}
