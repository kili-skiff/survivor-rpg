// The lantern going out when the watchman falls, as a pure function of time.

import { DEATH } from '../config/death';

export interface DeathFrame {
  /** Strength of the flame: 1 = burning as usual, 0 = out (a short flare can go a little above 1) */
  light: number;
  /** How black the screen is: 0 = night as usual, 1 = black */
  black: number;
  /** The flame is out */
  out: boolean;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * `progress` runs from 0 (the fatal hit) to 1 (the end of the fade); `timeMs` only drives the flicker.
 * The flame sinks, flickers more and more, flares up once and goes out; the darkness follows.
 */
export function deathFrame(progress: number, timeMs: number): DeathFrame {
  const p = clamp01(progress);
  const black = smooth(clamp01((p - DEATH.blackFrom) / (1 - DEATH.blackFrom)));
  if (p >= DEATH.outAt) return { light: 0, black, out: true };
  const base = (1 - p / DEATH.outAt) ** 2;
  const flicker = DEATH.flickerStart + DEATH.flickerGrowth * p;
  // Two uneven waves, so the flame stutters instead of pulsing.
  const wave = (Math.sin(timeMs * 0.031) + Math.sin(timeMs * 0.077 + 1.3)) / 4 + 0.5;
  const flare = DEATH.flareSize * Math.exp(-(((p - DEATH.flareAt) / DEATH.flareWidth) ** 2));
  return { light: Math.max(0, base * (1 - flicker * wave) + flare), black, out: false };
}
