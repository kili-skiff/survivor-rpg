// How the watchman wakes up in the Nest after a fall: a burst of fire, he rises from it, the lantern lights again.
// All times in ms from the moment the village appears.

export const REBIRTH = {
  /** The village fades in from black in this time */
  fadeInMs: 700,
  /** The fire shoots up in this time, burns at full height and dies down between these moments */
  fireUpMs: 700,
  fireDownFrom: 1900,
  fireOutAt: 3000,
  /** The watchman appears out of the flames, first as a glowing shape that cools to his own colours */
  riseFrom: 1000,
  riseMs: 900,
  glowFrom: 1100,
  glowMs: 1500,
  /** The lantern catches fire again, flaring up a little beyond its usual strength */
  lanternFrom: 1800,
  lanternMs: 900,
  lanternFlare: 0.25,
  /** The village is yours again at this moment */
  totalMs: 3200,
  /** A tap skips the rest, but only after this long */
  skipAfterMs: 700,
} as const;
