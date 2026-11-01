// The footsteps that show the way walked on the current expedition. All values here, so the look can be
// tuned in one place. Lengths are in hexes (1 = the size of one hex), so the steps look the same at every
// zoom and screen size. No Phaser here.

export const FOOTSTEPS = {
  /** Distance between two steps along the way */
  spacing: 0.4,
  /** How far each foot sits to the side of the line (left and right alternate) */
  sideOffset: 0.12,
  /** Extra sideways shift for every time the same way was walked before, so a second trip stays readable */
  repeatOffset: 0.1,
  /** Size of one footprint */
  length: 0.3,
  width: 0.16,
  /** Colour of the prints: a pale, dusty tone, with a dark shadow so they also show on light tiles */
  color: 0xf3ead0,
  shadowColor: 0x120d08,
  /** Opacity of the shadow as a share of the print's own opacity, and how far it is shifted down (in hexes) */
  shadowAlpha: 0.75,
  shadowShift: 0.035,
  /** Opacity of the newest step and of everything older than `fadeSteps` steps */
  alphaNewest: 0.9,
  alphaOldest: 0.42,
  /** How many of the newest steps fade from `alphaOldest` up to `alphaNewest` */
  fadeSteps: 24,
} as const;
