// The lantern going out when the watchman falls, as a pure function of time.

import { DEATH } from '../config/death';

export interface DeathFrame {
  /** Strength of the flame itself: 1 = burning as usual, 0 = out. It flickers and gasps. */
  light: number;
  /** The smooth size of the light circle around him: 1 = as usual, 0 = gone. No flicker, so it never jumps. */
  envelope: number;
  /** How black the screen is: 0 = night as usual, 1 = black */
  black: number;
  /** The flame is out */
  out: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * `progress` runs from 0 (the fatal hit) to 1 (the end of the fade); `timeMs` only drives the flicker.
 * The flame sinks steadily, gasps up a little now and then, and gutters more and more as it gets weaker,
 * until it is out; the darkness follows.
 */
export function deathFrame(progress: number, timeMs: number): DeathFrame {
  const p = clamp01(progress);
  const black = smooth(clamp01((p - DEATH.blackFrom) / (1 - DEATH.blackFrom)));
  if (p >= DEATH.outAt) return { light: 0, envelope: 0, black, out: true };
  const q = p / DEATH.outAt;
  const envelope = (1 - q) ** DEATH.envelopePower;
  // Three uneven waves, so the flame stutters instead of pulsing; it gutters harder the weaker it gets.
  const wave =
    (Math.sin(timeMs * 0.031) + Math.sin(timeMs * 0.077 + 1.3) + Math.sin(timeMs * 0.013 + 0.5)) / 6 + 0.5;
  const flicker = DEATH.flickerStart + DEATH.flickerGrowth * q * q;
  let gasp = 0;
  for (const g of DEATH.gasps) gasp += g.size * Math.exp(-(((p - g.at) / DEATH.gaspWidth) ** 2));
  return {
    light: Math.max(0, envelope * (1 - flicker * wave) + gasp * envelope),
    envelope,
    black,
    out: false,
  };
}
