// How the watchman wakes up in the Nest after a fall: a burst of fire, he floats up out of the flames, hovers over
// them while the lantern lights again, then drifts forward and sinks gently to the ground. All times in ms from
// the moment the village appears.

export const REBIRTH = {
  /** The village fades in from black in this time */
  fadeInMs: 700,
  /** The fire shoots up in this time, burns at full height and dies down between these moments */
  fireUpMs: 800,
  fireDownFrom: 2700,
  fireOutAt: 3900,
  /** The watchman appears out of the flames, first as a glowing shape that cools to his own colours */
  riseFrom: 1000,
  riseMs: 900,
  glowFrom: 1100,
  glowMs: 1800,
  /** He floats up out of the fire, hovers (a slow bob and sway), then drifts forward and sinks to the ground */
  liftFrom: 1200,
  liftMs: 1000,
  lowerFrom: 3100,
  lowerMs: 900,
  /** How high he hovers (px), how far he bobs (px) and how far he sways (radians) */
  liftPx: 30,
  bobPx: 3,
  swayRad: 0.07,
  /** The lantern catches fire again while he hovers, flaring up a little beyond its usual strength */
  lanternFrom: 2000,
  lanternMs: 900,
  lanternFlare: 0.25,
  /** The village is his again at this moment */
  totalMs: 4200,
  /** A tap skips the rest, but only after this long */
  skipAfterMs: 700,
} as const;
