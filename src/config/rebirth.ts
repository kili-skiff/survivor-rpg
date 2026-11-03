// How the watchman wakes up in the Nest after a fall: he is reborn in the fire, but weak. Hunched, trembling and
// hurting he gets up in the flames and staggers out of them, step by step. All times in ms from the moment the
// village appears.

export const REBIRTH = {
  /** The village fades in from black in this time */
  fadeInMs: 700,
  /** The fire shoots up in this time, burns and dies down between these moments */
  fireUpMs: 700,
  fireDownFrom: 2700,
  fireOutAt: 3900,
  /** He appears in the flames, first as a glowing shape that cools to his own (ashen) colours */
  /** He stands this many pixels higher in the flames of the Nest (world pixels) */
  bowlLiftPx: 14,
  riseFrom: 900,
  riseMs: 700,
  glowFrom: 1000,
  glowMs: 2600,
  /** Hunched in the fire at first; he pulls himself up only part of the way, and stays bent while he walks */
  getUpFrom: 1500,
  getUpMs: 900,
  /** How bent he stays while walking (1 = as bent as at the start) */
  hunchWalk: 0.5,
  /** How much he is squashed when fully hunched (share of his height), and how far he shakes (px) */
  hunchSquash: 0.22,
  trembleBase: 1.1,
  /** Moments where the pain hits: he flinches */
  flinchAt: [1900, 3000],
  flinchMs: 140,
  /** The lantern catches fire again, weakly, flaring only a little */
  lanternFrom: 2300,
  lanternMs: 900,
  lanternFlare: 0.15,
  /** He staggers out of the fire in a few lunges with a pause after each, and straightens up at the end */
  walkFrom: 2500,
  walkMs: 2000,
  steps: 5,
  /** Share of each step that is the lunge (the rest he stands and gasps) */
  stepShare: 0.65,
  straightenMs: 500,
  /** A tap skips the rest, but only after this long */
  skipAfterMs: 700,
} as const;

/** The village is his again at this moment */
export const REBIRTH_TOTAL_MS = REBIRTH.walkFrom + REBIRTH.walkMs + REBIRTH.straightenMs;
