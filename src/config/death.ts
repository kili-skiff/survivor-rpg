// How the watchman's death looks: the lantern burns down like a flame running out of oil, the night closes in,
// then the result screen.

export const DEATH = {
  /** Time the lantern needs to go out (ms) */
  fadeMs: 5200,
  /** Pause in the dark before the result screen opens (ms) */
  holdMs: 600,
  /** He sways on his feet for this long (ms), then topples sideways in `fallMs` */
  swayMs: 700,
  fallMs: 900,
  /** Lying down, his middle sits this share of his height lower */
  lieDrop: 0.3,
  /** The HUD fades away in this time (ms) */
  hudFadeMs: 1600,
  /** A tap or key skips the fade, but only after this long, so a button mashed in panic does not (ms) */
  skipAfterMs: 1200,
  /** The flame is out at this share of the fade (the rest is darkness) */
  outAt: 0.92,
  /** The light circle shrinks along (1 - share)^power: gently at first, ever slower at the end */
  envelopePower: 1.5,
  /** Now and then the flame gasps a little: at this share of the fade, by this much of full light */
  gasps: [
    { at: 0.28, size: 0.08 },
    { at: 0.52, size: 0.1 },
    { at: 0.74, size: 0.12 },
  ],
  gaspWidth: 0.025,
  /** The screen goes black from this share of the fade */
  blackFrom: 0.55,
  /** Flicker: the flame loses this much at the start; it grows the weaker the flame gets (guttering) */
  flickerStart: 0.03,
  flickerGrowth: 0.4,
} as const;
