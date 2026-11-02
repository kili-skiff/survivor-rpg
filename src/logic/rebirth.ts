// The watchman floating up out of the Nest's fire and sinking to the ground, as a pure function of time.

import { REBIRTH } from '../config/rebirth';

export interface RebirthFrame {
  /** Height of the fire: 0 = none, 1 = at its peak */
  fire: number;
  /** How much of the watchman is there: 0 = invisible, 1 = fully visible */
  body: number;
  /** How much he still glows like the fire: 1 = a glowing shape, 0 = his own colours */
  glow: number;
  /** How high he floats: 0 = on the ground, 1 = hovering at full height */
  lift: number;
  /** Extra up and down of the hover (px, already 0 on the ground) */
  bob: number;
  /** Tilt of the hover (radians, already 0 on the ground) */
  sway: number;
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
  const lift =
    smooth(clamp01((timeMs - R.liftFrom) / R.liftMs)) *
    (1 - smooth(clamp01((timeMs - R.lowerFrom) / R.lowerMs)));
  const bob = Math.sin(timeMs * 0.005) * R.bobPx * lift;
  const sway = Math.sin(timeMs * 0.0037 + 1) * R.swayRad * lift;
  return { fire: Math.min(up, down), body, glow, lift, bob, sway, lantern, done: timeMs >= R.totalMs };
}
