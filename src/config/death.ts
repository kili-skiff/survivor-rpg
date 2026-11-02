// How the watchman's death looks: the lantern burns down, the night closes in, then the result screen.

export const DEATH = {
  /** Time the lantern needs to go out (ms) */
  fadeMs: 3200,
  /** Pause in the dark before the result screen opens (ms) */
  holdMs: 500,
  /** The HUD fades away in this time (ms) */
  hudFadeMs: 900,
  /** A tap or key skips the fade, but only after this long, so a button mashed in panic does not (ms) */
  skipAfterMs: 1200,
  /** The flame is out at this share of the fade (the rest is darkness) */
  outAt: 0.9,
  /** The flame flares up once, at this share of the fade, by this much of full light, this wide */
  flareAt: 0.32,
  flareSize: 0.35,
  flareWidth: 0.05,
  /** The screen goes black from this share of the fade */
  blackFrom: 0.5,
  /** Flicker: the flame loses this much at the start, and this much more by the end */
  flickerStart: 0.04,
  flickerGrowth: 0.4,
} as const;
